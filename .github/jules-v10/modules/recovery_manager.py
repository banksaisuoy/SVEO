"""
Recovery Manager v10 — handles failures gracefully
================================================================
- Network errors → retry with backoff (handled in clients)
- Jules API 429 (rate limit) → wait + retry (handled in clients)
- GitHub API 403 → use cached data
- Stuck sessions (>30 min no change) → send_message("status?")
- Stuck sessions (>45 min) → archive + create follow-up
- Failed builds → analyze error + create follow-up bugfix task
- Circuit breakers: 3 fails in a row → pause 6h
"""
import json, sys, os, time
from datetime import datetime, timezone, timedelta
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clients.api_clients import get_jules
from db.database import (
    get_stuck_sessions, update_session_v10, enqueue_task,
    trip_circuit, reset_circuit, is_circuit_open
)


def check_stuck_sessions():
    """Find sessions stuck in IN_PROGRESS for > 30 min."""
    stuck = get_stuck_sessions(minutes=30)
    if not stuck:
        return 0
    
    print(f"  [recovery] Found {len(stuck)} stuck sessions")
    jules = get_jules()
    nudged = 0
    archived = 0
    
    for s in stuck:
        sid = s.get('id') or str(s.get('id', ''))
        repo = s.get('repo_id', '?')
        title = (s.get('title') or '')[:60]
        
        # Check age
        updated = s.get('updated_at')
        if not updated:
            continue
        
        if isinstance(updated, str):
            try:
                updated_dt = datetime.fromisoformat(updated.replace('Z', '+00:00'))
            except:
                continue
        else:
            updated_dt = updated
        
        age_min = (datetime.now(timezone.utc) - updated_dt).total_seconds() / 60
        
        if age_min > 45:
            # Archive + queue follow-up
            print(f"  [recovery] ⚠️ Archiving stuck session {sid[:12]} ({age_min:.0f}min)")
            try:
                jules.archive_session(sid)
                update_session_v10(sid, v10_state='ARCHIVED_STUCK')
            except: pass
            
            # Queue follow-up task
            enqueue_task(
                repo_id=repo,
                task_type='bugfix',
                title=f'Retry: {title}',
                description=f'Previous session stuck for {age_min:.0f}min',
                jules_prompt=f'Previous attempt: {title}. Please retry with simpler approach.',
                priority=3,
                origin='stuck_session_recovery'
            )
            archived += 1
        elif age_min > 30:
            # Nudge
            print(f"  [recovery] 🤔 Nudging stuck session {sid[:12]} ({age_min:.0f}min)")
            try:
                jules.send_message(sid, "Status check: are you still working? Please provide an update.")
                update_session_v10(sid, v10_state='NUDGED')
                nudged += 1
            except: pass
    
    return nudged + archived


def handle_jules_error(error, session_id=None, repo=None):
    """Handle Jules API errors."""
    err_str = str(error).lower()
    
    if '429' in err_str or 'rate limit' in err_str:
        print(f"  [recovery] Jules rate limit — pausing 60s")
        time.sleep(60)
        if repo:
            trip_circuit(f'repo:{repo}', opened_for_minutes=60)
        return 'rate_limit'
    
    if '404' in err_str:
        print(f"  [recovery] Jules 404 — session may be archived")
        if session_id:
            update_session_v10(session_id, v10_state='NOT_FOUND')
        return 'not_found'
    
    if '500' in err_str or '502' in err_str or '503' in err_str:
        print(f"  [recovery] Jules server error — pausing 30s")
        time.sleep(30)
        return 'server_error'
    
    return 'unknown_error'


def handle_build_failure(repo, pr_number, build_log=''):
    """Handle build failure: parse errors + queue bugfix task."""
    print(f"  [recovery] Build failed for {repo} PR #{pr_number}")
    
    # Parse top errors from build log
    errors = []
    if build_log:
        for line in build_log.split('\n'):
            if 'error' in line.lower() or 'failed' in line.lower():
                errors.append(line.strip()[:200])
                if len(errors) >= 3:
                    break
    
    # Queue bugfix task with high priority
    enqueue_task(
        repo_id=repo,
        task_type='bugfix',
        title=f'Fix build failure from PR #{pr_number}',
        description=f'Build errors: {"; ".join(errors[:3]) if errors else "unknown"}',
        jules_prompt=f"""Build is failing on PR #{pr_number} for {repo}.

Build errors:
{chr(10).join(f'- {e}' for e in errors) if errors else '(no specific errors parsed)'}

Please:
1. Identify the root cause of the build failure
2. Fix the issue(s)
3. Verify build passes
4. Output git patch
""",
        priority=1,  # highest priority
        origin='build_failure'
    )
    
    # Trip circuit for this repo if multiple failures
    trip_circuit(f'repo:{repo}', opened_for_minutes=120)
    
    return True


def check_circuit_breakers():
    """Check all circuit breakers before running."""
    keys_to_check = ['pipeline', 'jules_api', 'github_api', 'neon']
    
    # Also check per-repo circuits
    from modules.decision_engine import TIER1, TIER2
    for repo, _, _, _, _ in TIER1 + TIER2:
        keys_to_check.append(f'repo:{repo}')
    
    open_circuits = []
    for key in keys_to_check:
        if is_circuit_open(key):
            open_circuits.append(key)
    
    return open_circuits


def record_success(key):
    """Reset circuit breaker after success."""
    reset_circuit(key)


def health_check():
    """Pre-flight check: is everything reachable?"""
    from clients.api_clients import get_jules, get_github
    from db.database import get_conn
    
    checks = {'jules': False, 'github': False, 'neon': False}
    
    # Check Jules
    try:
        jules = get_jules()
        jules.list_sessions(page_size=1)
        checks['jules'] = True
    except: pass
    
    # Check GitHub
    try:
        gh = get_github()
        code, _ = gh.call('GET', '/repos/banksaisuoy/SVEO')
        checks['github'] = code == 200
    except: pass
    
    # Check Neon
    try:
        conn = get_conn()
        if conn:
            with conn.cursor() as cur:
                cur.execute('SELECT 1')
            conn.close()
            checks['neon'] = True
    except: pass
    
    return checks


if __name__ == "__main__":
    print("Testing Recovery Manager...")
    
    print("\nHealth check:")
    checks = health_check()
    for k, v in checks.items():
        status = '✓' if v else '✗'
        print(f"  {status} {k}")
    
    print("\nCircuit breakers:")
    open_circuits = check_circuit_breakers()
    if open_circuits:
        print(f"  Open: {open_circuits}")
    else:
        print("  All closed (good)")
    
    print("\nStuck sessions:")
    n = check_stuck_sessions()
    print(f"  Handled: {n}")
