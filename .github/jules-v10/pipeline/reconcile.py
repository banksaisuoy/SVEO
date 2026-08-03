"""
v10 Reconcile — polls COMPLETED sessions + creates PRs
================================================================
Runs after dispatch.py. Handles:
1. Find sessions in AWAITING_PLAN_APPROVAL → call plan_reviewer.approve
2. Find sessions in COMPLETED state without PR → create PR
3. Find sessions in AWAITING_USER_FEEDBACK → send "proceed" message
4. Update DB states
"""
import sys, os, json, time, re, base64, traceback
from datetime import datetime, timezone, timedelta
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import (
    ensure_schema, update_session_v10, log_pipeline_run,
    add_task_to_memory, upsert_repo_memory,
    start_pipeline_run, finish_pipeline_run,
    get_sessions_by_v10_state
)
from clients.api_clients import get_jules, get_github
from modules.plan_reviewer import review_and_approve
from modules.decision_engine import TIER1, TIER2, STOP_REPOS
from modules.recovery_manager import check_stuck_sessions


def get_session_state_from_jules(sid):
    """Get fresh state from Jules API. Returns None if session deleted (404)."""
    jules = get_jules()
    try:
        return jules.get_session(sid)
    except Exception as e:
        err_str = str(e)
        if '404' in err_str or 'Not Found' in err_str:
            # Session was deleted on Jules side — mark as ARCHIVED in DB
            print(f"  [reconcile] session {sid[:12]} deleted on Jules — marking ARCHIVED")
            update_session_v10(sid, v10_state='ARCHIVED', v10_phase='deleted_on_jules')
            return None
        print(f"  [reconcile] get_session({sid[:12]}) error: {e}")
        return None


def create_pr_from_session(repo, branch, sid, task):
    """Create PR with quality gates (from v8.1)."""
    gh = get_github()
    jules = get_jules()
    
    try:
        session = jules.get_session(sid)
    except Exception as e:
        return None, f"get_session error: {e}"
    
    if session.get('state') != 'COMPLETED':
        return None, f"state={session.get('state')}"
    
    patch = ""
    commit_msg = task.get("title", "feat: improvement")[:72]
    for out in session.get('outputs', []):
        gp = out.get('changeSet', {}).get('gitPatch', {})
        patch = gp.get('unidiffPatch', '')
        if gp.get('suggestedCommitMessage'):
            commit_msg = gp['suggestedCommitMessage'][:72]
        break
    if not patch:
        return None, "no patch"
    
    if len(patch) < 100:
        return None, f"patch too small ({len(patch)})"
    
    files = {}
    current_file = None
    new_lines = []
    for line in patch.split('\n'):
        if line.startswith('diff --git'):
            if current_file and new_lines:
                files[current_file] = '\n'.join(new_lines)
            m = re.match(r'diff --git a/(.+?) b/(.+)', line)
            current_file = m.group(2) if m else None
            new_lines = []
        elif line.startswith('+++ b/') and not current_file:
            current_file = line[6:]
        elif line.startswith('@@'):
            pass
        elif line.startswith('+') and not line.startswith('+++'):
            new_lines.append(line[1:])
        elif line.startswith('-') and not line.startswith('---'):
            pass
        elif line.startswith(' '):
            new_lines.append(line[1:])
        elif line == '':
            new_lines.append('')
    if current_file and new_lines:
        files[current_file] = '\n'.join(new_lines)
    if not files:
        return None, "no files parsed"
    
    meaningful = [fp for fp in files.keys() if fp.strip() and fp != '/dev/null' and len(files[fp].strip()) > 0]
    if len(meaningful) == 0:
        return None, "no meaningful files"
    
    branch_name = f"jules-auto-{sid[:12]}"
    
    if gh.get_existing_pr(repo, branch_name):
        return None, "PR already exists"
    
    base_sha = gh.get_branch_sha(repo, branch)
    if not base_sha:
        return None, "no base SHA"
    
    # Cleanup orphan
    gh.delete_branch(repo, branch_name)
    gh.create_branch(repo, branch_name, base_sha)
    
    updated = 0
    for fp, content in files.items():
        if not fp.strip() or fp == '/dev/null' or len(content.strip()) == 0:
            continue
        sha = gh.get_file_sha(repo, fp, branch_name)
        if gh.update_file(repo, fp, content, branch_name, f"update {fp}", sha):
            updated += 1
    
    if updated == 0:
        gh.delete_branch(repo, branch_name)
        return None, "0 files updated"
    
    pr_body = f"""🤖 Automated PR from Jules session (v10)

**Session**: https://jules.google.com/session/{sid}
**Task**: {task.get('title', '?')}
**Files changed**: {updated}
**Patch size**: {len(patch)} chars
**Plan approved**: ✅ via plan_reviewer module

Created by v10 pipeline
"""
    pr = gh.create_pr(repo, branch_name, branch, commit_msg, pr_body)
    if pr:
        return pr, f"PR #{pr.get('number')}"
    return None, "PR creation failed"


def reconcile_session(session_row):
    """Check + advance a single session."""
    sid = session_row.get('id')
    repo = session_row.get('repo_id')
    title = session_row.get('title', '') or 'Improve'
    
    # Get fresh state from Jules
    fresh = get_session_state_from_jules(sid)
    if not fresh:
        return
    
    state = fresh.get('state')
    v10_state = session_row.get('v10_state')
    
    print(f"\n  ┌─ {repo} / {sid[:12]}")
    print(f"  │  DB v10_state: {v10_state}")
    print(f"  │  Jules state: {state}")
    
    # Determine action based on state
    if state == 'AWAITING_PLAN_APPROVAL' and v10_state != 'PLAN_APPROVED':
        # Plan is ready — review and approve
        print(f"  │  → Plan ready, reviewing...")
        task = {
            'title': title, 'task_type': session_row.get('prompt_type', 'feature'),
            'description': '', 'jules_prompt': '',
            'risk_level': 'medium', 'estimated_files_touched': 5
        }
        ptype = 'unknown'
        for r, _, _, pt, _ in TIER1 + TIER2:
            if r == repo:
                ptype = pt; break
        approved, reason, _ = review_and_approve(sid, task, repo, ptype)
        if approved:
            update_session_v10(sid, v10_state='PLAN_APPROVED', v10_phase='implementing')
            log_pipeline_run(repo, sid, title, 'plan-reviewer', 'plan_approved')
        else:
            update_session_v10(sid, v10_state='PLAN_REJECTED', v10_phase='plan_rejected')
            log_pipeline_run(repo, sid, title, 'plan-reviewer', 'plan_rejected', reason)
    
    elif state == 'IN_PROGRESS' and v10_state == 'PLAN_APPROVED':
        # Implementation in progress — just update timestamp
        print(f"  │  → Implementation in progress, waiting...")
    
    elif state == 'COMPLETED' and v10_state not in ('PR_CREATED', 'PR_FAILED', 'ARCHIVED'):
        # Implementation done — create PR
        print(f"  │  → Creating PR...")
        task = {
            'title': title, 'task_type': session_row.get('prompt_type', 'feature'),
            'jules_prompt': '', 'description': ''
        }
        branch = 'main'
        for r, b, _, _, _ in TIER1 + TIER2:
            if r == repo: branch = b; break
        
        pr, msg = create_pr_from_session(repo, branch, sid, task)
        if pr:
            print(f"  │  ✓ PR #{pr.get('number')}: {pr.get('html_url','')}")
            update_session_v10(sid, v10_state='PR_CREATED', v10_phase='pr_created')
            log_pipeline_run(repo, sid, title, 'reconcile', 'pr_created')
            add_task_to_memory(repo, title, task['task_type'], pr.get('number'), success=True)
        else:
            print(f"  │  ✗ PR failed: {msg}")
            update_session_v10(sid, v10_state='PR_FAILED', v10_phase='pr_failed')
            log_pipeline_run(repo, sid, title, 'reconcile', 'pr_failed', msg)
    
    elif state == 'AWAITING_USER_FEEDBACK':
        # Send "proceed" message
        print(f"  │  → Sending 'proceed' feedback...")
        jules = get_jules()
        try:
            jules.send_message(sid, "Please proceed with the implementation. The plan looks good.")
            update_session_v10(sid, v10_state='FEEDBACK_SENT')
            log_pipeline_run(repo, sid, title, 'reconcile', 'feedback_sent')
        except Exception as e:
            print(f"  │  ⚠️ sendMessage error: {e}")
    
    elif state == 'FAILED':
        print(f"  │  → Session FAILED")
        update_session_v10(sid, v10_state='FAILED', v10_phase='failed')
        log_pipeline_run(repo, sid, title, 'reconcile', 'session_failed')
        add_task_to_memory(repo, title, session_row.get('prompt_type', 'feature'), None, success=False)
    
    else:
        print(f"  │  → No action needed (state={state}, v10={v10_state})")


def main():
    now = datetime.now(timezone.utc)
    run_id = now.strftime("%Y%m%d-%H%M%S") + '-reconcile'
    
    print("=" * 78)
    print(f"  JULES v10 — RECONCILE")
    print(f"  {now.isoformat()}")
    print("=" * 78)
    
    ensure_schema()
    start_pipeline_run(run_id, phase='reconcile')
    
    # 1. Check stuck sessions first (both Jules-side and DB-side)
    print("\n[1] Check stuck sessions (>30 min)...")
    n_stuck = check_stuck_sessions()  # Jules-side: nudge/archive
    print(f"  ✓ Handled {n_stuck} stuck sessions (Jules-side)")
    
    # Also clean up DB-side stuck sessions (IN_PROGRESS > 6h with no Jules session)
    from db.database import execute
    db_cleaned = execute("""
        UPDATE jules_sessions
        SET state = 'FAILED',
            error_message = 'stuck > 6h, Jules session not found (auto-marked by reconcile)',
            updated_at = NOW()
        WHERE state = 'IN_PROGRESS'
          AND created_at < NOW() - INTERVAL '6 hours'
          AND v10_state NOT IN ('PR_CREATED', 'ARCHIVED')
    """)
    if db_cleaned and db_cleaned > 0:
        print(f"  ✓ Marked {db_cleaned} DB stuck sessions as FAILED")
    
    # 2. Get sessions that need attention
    print("\n[2] Get sessions to reconcile...")
    states_to_check = ['IN_PROGRESS', 'PLAN_APPROVED', 'FEEDBACK_SENT', None]
    sessions_to_reconcile = []
    
    for state in states_to_check:
        sessions = get_sessions_by_v10_state(state, limit=30)
        sessions_to_reconcile.extend(sessions)
    
    # Also check sessions where v10_state is null but created in last 3h
    from db.database import execute
    recent = execute(
        """SELECT * FROM jules_sessions
           WHERE created_at > NOW() - INTERVAL '3 hours'
             AND (v10_state IS NULL OR v10_state NOT IN ('PR_CREATED', 'PR_FAILED', 'FAILED', 'ARCHIVED'))
           ORDER BY created_at DESC LIMIT 30""",
        fetch=True
    ) or []
    sessions_to_reconcile.extend(recent)
    
    # Dedupe by id
    seen = set()
    unique = []
    for s in sessions_to_reconcile:
        sid = s.get('id')
        if sid and sid not in seen:
            seen.add(sid)
            unique.append(s)
    
    print(f"  Found {len(unique)} sessions to check")
    
    # 3. Reconcile each
    print(f"\n[3] Reconcile {len(unique)} sessions...")
    for s in unique:
        try:
            reconcile_session(s)
        except Exception as e:
            print(f"  ✗ Error: {e}")
        time.sleep(1)
    
    print(f"\n{'='*78}")
    print(f"  v10 RECONCILE COMPLETE")
    print(f"{'='*78}")
    
    finish_pipeline_run(run_id, status='success')
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n⚠️ Reconcile error: {e}")
        traceback.print_exc()
        sys.exit(0)
