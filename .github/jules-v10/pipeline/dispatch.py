"""
v10 Dispatch — creates new sessions (fast, exits in 5 min)
================================================================
"""
import sys, os, json, time, traceback
from datetime import datetime, timezone, timedelta
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import (
    ensure_schema, load_repo_memory, upsert_repo_memory,
    update_session_v10, start_pipeline_run, finish_pipeline_run,
    trip_circuit, reset_circuit, is_circuit_open,
    log_db, log_pipeline_run
)
from clients.api_clients import get_jules, get_github
from modules.decision_engine import (
    ACTIVE_REPOS, STOP_REPOS,
    get_repo_metadata, pick_task, review_task_safety
)
from modules.recovery_manager import health_check, check_circuit_breakers
from utils.config import BATCH_SIZE, DAILY_QUOTA, WAIT_PLAN_TIMEOUT


def cleanup_stuck_jules_sessions():
    """Cleanup stuck sessions on Jules side (delete IN_PROGRESS older than 6h)."""
    jules = get_jules()
    try:
        result = jules.list_sessions(page_size=50)
        sessions = result.get('sessions', [])
        n = 0
        cutoff = datetime.now(timezone.utc) - timedelta(hours=6)
        for s in sessions:
            state = s.get('state')
            if state in ('IN_PROGRESS', 'QUEUED', 'AWAITING_USER_FEEDBACK', 'AWAITING_PLAN_APPROVAL'):
                ct = s.get('createTime', '')
                if ct:
                    try:
                        cdt = datetime.fromisoformat(ct.replace('Z', '+00:00'))
                        if cdt < cutoff:
                            jules.delete_session(s['id'])
                            n += 1
                    except: pass
        return n
    except Exception as e:
        print(f"  [dispatch] cleanup error: {e}")
        return 0


def get_jules_sessions_today():
    jules = get_jules()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    all_sessions = []
    page_token = None
    for _ in range(10):
        try:
            result = jules.list_sessions(page_size=100, page_token=page_token)
        except Exception as e:
            print(f"  [dispatch] list_sessions error: {e}")
            break
        for s in result.get('sessions', []):
            ct = s.get('createTime', '')
            if ct:
                try:
                    cdt = datetime.fromisoformat(ct.replace('Z', '+00:00'))
                    if cdt > cutoff: all_sessions.append(s)
                except: pass
        page_token = result.get('nextPageToken')
        if not page_token: break
    return all_sessions


def count_repo_sessions(sessions, repo):
    return sum(1 for s in sessions if repo.lower() in s.get('sourceContext', {}).get('source', '').lower())


def get_repo_last_time(sessions, repo):
    t = None
    for s in sessions:
        if repo.lower() in s.get('sourceContext', {}).get('source', '').lower():
            ct = s.get('createTime', '')
            if ct and (t is None or ct > t): t = ct
    return t


def select_repos(sessions_today, rem_quota):
    now = datetime.now(timezone.utc)
    hour_bucket = now.hour // 2
    include_tier2 = (hour_bucket % 3 == 0)
    candidates = list(ACTIVE_REPOS)  # Only repos that actually build
    
    total_weight = sum(w for _, _, _, _, w in candidates)
    repo_states = []
    
    for repo, branch, svc, ptype, weight in candidates:
        used_today = count_repo_sessions(sessions_today, repo)
        daily_target = int(round(weight / total_weight * DAILY_QUOTA))
        remaining = max(0, daily_target - used_today)
        
        mem = load_repo_memory(repo)
        cooldown_until = None
        if mem and mem.get('cooldown_until'):
            cu = mem['cooldown_until']
            if isinstance(cu, str):
                try:
                    cooldown_until = datetime.fromisoformat(cu.replace('Z', '+00:00'))
                except: pass
            else:
                cooldown_until = cu
        
        in_cooldown = cooldown_until and now < cooldown_until
        if in_cooldown:
            remaining = 0
        
        last_time = get_repo_last_time(sessions_today, repo)
        hours_ago = (now - datetime.fromisoformat(last_time.replace('Z', '+00:00'))).total_seconds() / 3600 if last_time else 9999
        
        # 30min cooldown between touches (was 2h — too long)
        if hours_ago < 0.5:
            remaining = 0
        
        repo_states.append({
            'repo': repo, 'branch': branch, 'svc': svc, 'ptype': ptype,
            'weight': weight, 'used_today': used_today,
            'daily_target': daily_target, 'remaining': remaining,
            'hours_ago': hours_ago, 'in_cooldown': in_cooldown
        })
    
    repo_states.sort(key=lambda x: (-x['remaining'], -x['hours_ago'], -x['weight']))
    eligible = [r for r in repo_states if r['remaining'] > 0]
    n_select = min(BATCH_SIZE, max(1, rem_quota - 2), len(eligible))
    return eligible[:n_select], repo_states


def process_repo(repo_state, run_id):
    repo = repo_state['repo']
    branch = repo_state['branch']
    ptype = repo_state['ptype']
    
    print(f"\n  ┌─ {repo} [{ptype}] (today: {repo_state['used_today']}/{repo_state['daily_target']})")
    
    metadata = get_repo_metadata(repo, branch)
    print(f"  │  ✓ PROGRESS.md ({len(metadata['progress'])} chars)")
    print(f"  │  {len(metadata['commits'])} commits, {len(metadata['merged_prs'])} merged PRs")
    
    memory = load_repo_memory(repo)
    
    print(f"  │  AI deciding task...")
    task = pick_task(repo, ptype, metadata, memory)
    print(f"  │  ✓ [{task.get('task_type','?')}] {task.get('title','?')[:60]}")
    print(f"  │    Risk: {task.get('risk_level','?')} | Files: ~{task.get('estimated_files_touched','?')}")
    
    print(f"  │  AI safety review...")
    is_safe, reason = review_task_safety(task, repo, ptype)
    if not is_safe:
        print(f"  │  ✗ Rejected: {reason}")
        log_pipeline_run(repo, None, task.get('title', ''), 'safety-ai', 'rejected', reason)
        if memory:
            failed = memory.get('failed_patterns', []) or []
            if isinstance(failed, str): failed = json.loads(failed)
            failed.insert(0, {'title': task.get('title',''), 'reason': f'safety: {reason}'})
            failed = failed[:5]
            upsert_repo_memory(repo, failed_patterns=json.dumps(failed))
        return None
    print(f"  │  ✓ Safe: {reason}")
    
    print(f"  │  Creating Jules session (requirePlanApproval=True)...")
    jules = get_jules()
    sid = jules.create_session(
        prompt=task.get('jules_prompt', 'Review and improve. Output git patch.'),
        repo=repo, branch=metadata['branch'],
        title=task.get('title', 'feat: improvement'),
        require_plan_approval=False  # v10.1: False = Jules just does it (no plan wait)
    )
    if not sid:
        print(f"  │  ✗ Session creation FAILED")
        log_pipeline_run(repo, None, task.get('title', ''), 'openrouter', 'session_failed')
        return None
    print(f"  │  ✓ Session: {sid}")
    
    log_db(sid, repo, task.get('task_type', 'feature'), task.get('title', ''))
    update_session_v10(sid, v10_state='IN_PROGRESS', v10_run_id=run_id, v10_phase='awaiting_plan')
    log_pipeline_run(repo, sid, task.get('title', ''), 'openrouter', 'session_created')
    
    upsert_repo_memory(repo, last_task_at=datetime.now(timezone.utc).isoformat())
    
    return (sid, repo, task, metadata)


def main():
    now = datetime.now(timezone.utc)
    run_id = now.strftime("%Y%m%d-%H%M%S")
    
    print("=" * 78)
    print(f"  JULES v10 — DISPATCH")
    print(f"  {now.isoformat()}")
    print(f"  Batch: {BATCH_SIZE} | Daily quota: {DAILY_QUOTA}")
    print("=" * 78)
    
    ensure_schema()
    start_pipeline_run(run_id, phase='dispatch')
    
    print("\n[1] Health check...")
    checks = health_check()
    all_healthy = all(checks.values())
    for k, v in checks.items():
        print(f"  {'✓' if v else '✗'} {k}")
    if not all_healthy:
        print("  ⚠️ Health check failed — aborting dispatch")
        finish_pipeline_run(run_id, status='skipped', error='health check failed')
        sys.exit(0)
    
    print("\n[2] Check circuit breakers...")
    open_circuits = check_circuit_breakers()
    if 'pipeline' in open_circuits:
        print("  ⚠️ Pipeline circuit OPEN — pausing")
        finish_pipeline_run(run_id, status='skipped', error='pipeline circuit open')
        sys.exit(0)
    if open_circuits:
        print(f"  Open: {open_circuits}")
    
    print("\n[3] Cleanup stuck sessions...")
    cleaned = cleanup_stuck_jules_sessions()
    print(f"  ✓ Cleaned {cleaned}")
    
    print("\n[4] Fetch today's sessions...")
    sessions_today = get_jules_sessions_today()
    used = len(sessions_today)
    rem = DAILY_QUOTA - used
    print(f"  Used: {used}/{DAILY_QUOTA} | Remaining: {rem}")
    if rem < 5:
        print("  ⚠️ Low quota — skipping dispatch")
        finish_pipeline_run(run_id, status='skipped', error='low quota')
        sys.exit(0)
    
    print("\n[5] Per-repo quota distribution...")
    selected, all_states = select_repos(sessions_today, rem)
    print(f"  {'Repo':<25} {'W':<3} {'Tgt':<5} {'Used':<5} {'Rem':<5} {'Last':<8} {'CD':<3}")
    for s in all_states:
        marker = "▶" if any(r['repo'] == s['repo'] for r in selected) else " "
        cd = "🔒" if s['in_cooldown'] else " "
        print(f"  {marker}{s['repo']:<24} {s['weight']:<3} {s['daily_target']:<5} {s['used_today']:<5} {s['remaining']:<5} {s['hours_ago']:.1f}h {cd}")
    print(f"\n  → Selected {len(selected)} repos")
    
    print(f"\n[6] Process {len(selected)} repos...")
    created = []
    for s in selected:
        try:
            result = process_repo(s, run_id)
            if result: created.append(result)
        except Exception as e:
            print(f"  ✗ Error: {e}")
            traceback.print_exc()
        time.sleep(2)
    
    print(f"\n{'='*78}")
    print(f"  v10 DISPATCH COMPLETE — {len(created)} sessions created")
    print(f"  Next: monitor.yml polls every 5min, reconcile.py runs next cron")
    print(f"{'='*78}")
    
    finish_pipeline_run(run_id, status='success', sessions_created=len(created))
    reset_circuit('pipeline')
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n⚠️ Pipeline error: {e}")
        traceback.print_exc()
        try: trip_circuit('pipeline', opened_for_minutes=60)
        except: pass
        sys.exit(0)
