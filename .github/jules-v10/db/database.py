"""
v10 Database Layer
==================
Centralized DB access with connection pooling + retry logic.
"""
import os, psycopg2, json, time
from datetime import datetime, timezone, timedelta
from psycopg2.extras import RealDictCursor

NEON_DB = os.environ.get("NEON_DATABASE_URL", "")

def get_conn():
    """Get a Neon DB connection with retry."""
    if not NEON_DB:
        return None
    for attempt in range(3):
        try:
            return psycopg2.connect(NEON_DB, cursor_factory=RealDictCursor, connect_timeout=10)
        except Exception as e:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)

def execute(sql, params=None, fetch=False):
    """Execute SQL with retry. Returns rows (list of dicts) if fetch=True."""
    for attempt in range(3):
        try:
            conn = get_conn()
            if not conn:
                return None
            with conn.cursor() as cur:
                cur.execute(sql, params or ())
                if fetch:
                    rows = cur.fetchall()
                    conn.commit()
                    return [dict(r) for r in rows]
                conn.commit()
                return cur.rowcount
        except Exception as e:
            if attempt == 2:
                print(f"  [DB] error after 3 retries: {e}")
                return None
            time.sleep(2 ** attempt)
    return None

def execute_one(sql, params=None):
    """Execute SQL, return one row as dict."""
    for attempt in range(3):
        try:
            conn = get_conn()
            if not conn:
                return None
            with conn.cursor() as cur:
                cur.execute(sql, params or ())
                row = cur.fetchone()
                conn.commit()
                return dict(row) if row else None
        except Exception as e:
            if attempt == 2:
                print(f"  [DB] error: {e}")
                return None
            time.sleep(2 ** attempt)
    return None


def ensure_schema():
    """Create v10 tables if they don't exist (idempotent)."""
    schema_sql = """
    -- Repo memory: persistent context per repo
    CREATE TABLE IF NOT EXISTS jules_repo_memory (
        repo_id TEXT PRIMARY KEY,
        last_5_tasks JSONB DEFAULT '[]'::jsonb,
        last_5_pr_scores JSONB DEFAULT '[]'::jsonb,
        failed_patterns JSONB DEFAULT '[]'::jsonb,
        success_patterns JSONB DEFAULT '[]'::jsonb,
        quality_score FLOAT DEFAULT 0.7,
        cooldown_until TIMESTAMP WITH TIME ZONE,
        consecutive_failures INT DEFAULT 0,
        consecutive_successes INT DEFAULT 0,
        last_task_at TIMESTAMP WITH TIME ZONE,
        last_pr_at TIMESTAMP WITH TIME ZONE,
        last_build_status TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Task queue: prioritized backlog
    CREATE TABLE IF NOT EXISTS jules_task_queue (
        id SERIAL PRIMARY KEY,
        repo_id TEXT NOT NULL,
        task_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        jules_prompt TEXT,
        priority INT DEFAULT 5,
        origin TEXT DEFAULT 'pm_agent',
        status TEXT DEFAULT 'pending',
        session_id TEXT,
        pr_number INT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE
    );

    -- Pipeline runs: track each run
    CREATE TABLE IF NOT EXISTS jules_pipeline_runs (
        id SERIAL PRIMARY KEY,
        run_id TEXT UNIQUE,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        finished_at TIMESTAMP WITH TIME ZONE,
        phase TEXT,
        status TEXT DEFAULT 'running',
        sessions_created INT DEFAULT 0,
        sessions_completed INT DEFAULT 0,
        prs_created INT DEFAULT 0,
        prs_merged INT DEFAULT 0,
        error TEXT
    );

    -- Circuit breakers
    CREATE TABLE IF NOT EXISTS jules_circuit_breakers (
        key TEXT PRIMARY KEY,
        state TEXT DEFAULT 'closed',
        failure_count INT DEFAULT 0,
        last_failure_at TIMESTAMP WITH TIME ZONE,
        opened_until TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Add v10_state column to existing jules_sessions if not exists
    ALTER TABLE jules_sessions ADD COLUMN IF NOT EXISTS v10_state TEXT;
    ALTER TABLE jules_sessions ADD COLUMN IF NOT EXISTS v10_run_id TEXT;
    ALTER TABLE jules_sessions ADD COLUMN IF NOT EXISTS v10_phase TEXT;
    ALTER TABLE jules_sessions ADD COLUMN IF NOT EXISTS v10_quality_score INT;
    ALTER TABLE jules_sessions ADD COLUMN IF NOT EXISTS v10_review_status TEXT;

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_jules_sessions_v10_state ON jules_sessions(v10_state);
    CREATE INDEX IF NOT EXISTS idx_jules_task_queue_status ON jules_task_queue(status, priority);
    CREATE INDEX IF NOT EXISTS idx_jules_pipeline_runs_started ON jules_pipeline_runs(started_at DESC);
    """
    return execute(schema_sql)


# === Repo memory operations ===
def load_repo_memory(repo_id):
    """Load repo memory (returns dict, or None if not found)."""
    return execute_one(
        "SELECT * FROM jules_repo_memory WHERE repo_id = %s",
        (repo_id,)
    )

def upsert_repo_memory(repo_id, **fields):
    """Update repo memory fields."""
    if not fields:
        return 0
    set_parts = [f"{k} = %s" for k in fields.keys()]
    set_parts.append("updated_at = NOW()")
    values = list(fields.values()) + [repo_id]
    sql = f"""INSERT INTO jules_repo_memory (repo_id, {', '.join(fields.keys())}, updated_at)
              VALUES (%s, {', '.join(['%s']*len(fields))}, NOW())
              ON CONFLICT (repo_id) DO UPDATE SET {', '.join(set_parts)}"""
    params = [repo_id] + list(fields.values())
    return execute(sql, params)

def add_task_to_memory(repo_id, task_title, task_type, pr_number=None, success=True):
    """Add task to repo's recent tasks list (keep last 5)."""
    mem = load_repo_memory(repo_id) or {}
    tasks = mem.get('last_5_tasks', []) or []
    if isinstance(tasks, str):
        import json as _json
        tasks = _json.loads(tasks)
    tasks.insert(0, {
        'title': task_title, 'type': task_type, 'pr': pr_number,
        'success': success, 'at': datetime.now(timezone.utc).isoformat()
    })
    tasks = tasks[:5]
    return upsert_repo_memory(repo_id, last_5_tasks=json.dumps(tasks))


# === Task queue operations ===
def enqueue_task(repo_id, task_type, title, description='', jules_prompt='', priority=5, origin='pm_agent'):
    """Add task to queue."""
    return execute(
        """INSERT INTO jules_task_queue
           (repo_id, task_type, title, description, jules_prompt, priority, origin)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (repo_id, task_type, title, description, jules_prompt, priority, origin)
    )

def dequeue_task(repo_id=None):
    """Get highest priority pending task."""
    if repo_id:
        return execute_one(
            """SELECT * FROM jules_task_queue
               WHERE status = 'pending' AND repo_id = %s
               ORDER BY priority ASC, created_at ASC LIMIT 1""",
            (repo_id,)
        )
    return execute_one(
        """SELECT * FROM jules_task_queue
           WHERE status = 'pending' ORDER BY priority ASC, created_at ASC LIMIT 1"""
    )

def mark_task_started(task_id, session_id):
    return execute(
        """UPDATE jules_task_queue
           SET status = 'in_progress', session_id = %s, started_at = NOW()
           WHERE id = %s""",
        (session_id, task_id)
    )

def mark_task_completed(task_id, pr_number=None, success=True):
    return execute(
        """UPDATE jules_task_queue
           SET status = %s, pr_number = %s, completed_at = NOW()
           WHERE id = %s""",
        ('completed' if success else 'failed', pr_number, task_id)
    )


# === Pipeline runs ===
def start_pipeline_run(run_id, phase='dispatch'):
    return execute(
        """INSERT INTO jules_pipeline_runs (run_id, phase, status)
           VALUES (%s, %s, 'running')
           ON CONFLICT (run_id) DO UPDATE SET phase = EXCLUDED.phase, status = 'running'""",
        (run_id, phase)
    )

def finish_pipeline_run(run_id, status='success', error=None, **counts):
    sets = ['status = %s', 'finished_at = NOW()']
    params = [status]
    if error:
        sets.append('error = %s')
        params.append(error[:500])
    for k, v in counts.items():
        sets.append(f'{k} = %s')
        params.append(v)
    params.append(run_id)
    return execute(
        f"""UPDATE jules_pipeline_runs SET {', '.join(sets)} WHERE run_id = %s""",
        params
    )


# === Circuit breakers ===
def get_circuit(key):
    return execute_one(
        "SELECT * FROM jules_circuit_breakers WHERE key = %s",
        (key,)
    )

def trip_circuit(key, opened_for_minutes=360):
    """Open a circuit breaker."""
    return execute(
        """INSERT INTO jules_circuit_breakers (key, state, failure_count, last_failure_at, opened_until, updated_at)
           VALUES (%s, 'open', 1, NOW(), NOW() + INTERVAL '%s minutes', NOW())
           ON CONFLICT (key) DO UPDATE SET
             state = 'open',
             failure_count = jules_circuit_breakers.failure_count + 1,
             last_failure_at = NOW(),
             opened_until = NOW() + INTERVAL '%s minutes',
             updated_at = NOW()""",
        (key, opened_for_minutes, opened_for_minutes)
    )

def reset_circuit(key):
    """Close a circuit breaker (after success)."""
    return execute(
        """INSERT INTO jules_circuit_breakers (key, state, failure_count, updated_at)
           VALUES (%s, 'closed', 0, NOW())
           ON CONFLICT (key) DO UPDATE SET
             state = 'closed',
             failure_count = 0,
             opened_until = NULL,
             updated_at = NOW()""",
        (key,)
    )

def is_circuit_open(key):
    """Check if circuit is open (blocking)."""
    cb = get_circuit(key)
    if not cb:
        return False
    if cb.get('state') != 'open':
        return False
    # Check if opened_until has passed (half-open probe)
    until = cb.get('opened_until')
    if until and datetime.now(timezone.utc) > until:
        return False  # half-open, allow probe
    return True


# === Session helpers ===
def update_session_v10(session_id, **fields):
    if not fields:
        return 0
    sets = [f"{k} = %s" for k in fields.keys()]
    sets.append("updated_at = NOW()")
    params = list(fields.values()) + [session_id]
    return execute(
        f"""UPDATE jules_sessions SET {', '.join(sets)} WHERE id = %s""",
        params
    )

def get_sessions_by_v10_state(state, limit=50):
    return execute(
        """SELECT * FROM jules_sessions
           WHERE v10_state = %s AND updated_at > NOW() - INTERVAL '24 hours'
           ORDER BY created_at DESC LIMIT %s""",
        (state, limit),
        fetch=True
    ) or []

def get_stuck_sessions(minutes=30):
    """Get sessions stuck in IN_PROGRESS for too long."""
    return execute(
        """SELECT * FROM jules_sessions
           WHERE v10_state = 'IN_PROGRESS'
             AND updated_at < NOW() - INTERVAL '%s minutes'
           ORDER BY created_at ASC""",
        (minutes,),
        fetch=True
    ) or []


# === Logging helpers (used by dispatch/reconcile) ===
def log_db(sid, repo, ptype, title):
    """Insert session into Neon DB (legacy interface for v9 compat)."""
    if not NEON_DB: return
    try:
        c = psycopg2.connect(NEON_DB, connect_timeout=10)
        cur = c.cursor()
        cur.execute("""INSERT INTO jules_sessions
            (id, repo_id, title, prompt_type, state, jules_url, created_at, updated_at)
            VALUES (%s, %s, %s, %s, 'IN_PROGRESS', %s, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING""",
            (sid, repo, (title or '')[:100], ptype, f"https://jules.google.com/session/{sid}"))
        c.commit()
        cur.close()
        c.close()
    except Exception as e:
        print(f'  [DB] log_db error: {e}')


def log_pipeline_run(repo, session_id, ai_feature, ai_model, status, error=None):
    """Insert pipeline log entry (legacy interface)."""
    if not NEON_DB: return
    try:
        c = psycopg2.connect(NEON_DB, connect_timeout=10)
        cur = c.cursor()
        cur.execute("""INSERT INTO jules_pipeline_logs
            (repo_id, session_id, ai_feature, ai_model, status, error, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())""",
            (repo, session_id, (ai_feature or '')[:200], ai_model, status, error))
        c.commit()
        cur.close()
        c.close()
    except Exception as e:
        print(f'  [DB] log_pipeline_run error: {e}')
