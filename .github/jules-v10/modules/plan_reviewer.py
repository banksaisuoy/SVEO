"""
Plan Reviewer v10 — reviews Jules' plan before approving
================================================================
After Jules creates plan (session in AWAITING_PLAN_APPROVAL state):
1. Fetch session detail (plan content if available)
2. AI reviews plan structure
3. Checks: file impact, risky changes, dependency additions
4. If approved → call approvePlan()
5. If rejected → call sendMessage("please simplify") → wait for new plan

3-strike rule: if plan rejected 3 times → archive session + queue follow-up
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clients.api_clients import get_jules, get_ai


def get_plan_info(sid):
    """Get session info that contains the plan."""
    jules = get_jules()
    try:
        session = jules.get_session(sid)
        return session
    except Exception as e:
        print(f"  [plan_review] get_session error: {e}")
        return None


def review_plan(sid, task, repo, ptype):
    """Review Jules' plan. Returns (approve, reason, feedback)."""
    session = get_plan_info(sid)
    if not session:
        return True, "session fetch failed — auto-approve", None
    
    state = session.get('state')
    if state != 'AWAITING_PLAN_APPROVAL':
        return True, f"state is {state} — no plan to review", None
    
    # Extract plan info from session (Jules may not expose plan content via API yet)
    # We use the task's estimated_files_touched + risk_level as proxy
    est_files = task.get('estimated_files_touched', 5)
    risk = task.get('risk_level', 'medium')
    
    ai = get_ai()
    if not ai.api_key:
        # No AI — apply rule-based check
        if est_files > 15:
            return False, f"too many files ({est_files} > 15)", "Please reduce scope to under 15 files."
        if risk == 'high':
            return False, "high risk task", "Please break down into smaller, safer changes."
        return True, "rule-based: looks good", None
    
    # AI review
    prompt = f"""You are reviewing a plan from an autonomous coding agent (Jules).

CONTEXT:
- Repo: {repo} ({ptype})
- Task: {task.get('title','')}
- Task type: {task.get('task_type','')}
- Description: {task.get('description','')}
- Original prompt: {task.get('jules_prompt','')[:1500]}
- Estimated files: {est_files}
- Risk level: {risk}

SESSION STATE: {state}

Since we cannot see the actual plan content, evaluate based on the task itself:
1. Is the task scope reasonable (≤15 files)?
2. Are there red flags (mass refactor, breaking changes, suspicious deps)?
3. Is the task type appropriate for the repo?

Respond JSON:
{{"approve": true/false, "reason": "short explanation", "feedback": "message to Jules if rejected (or null if approved)"}}"""

    result = ai.chat_json(prompt, system="You are a plan reviewer. Respond JSON only.")
    if result:
        approve = bool(result.get('approve', True))
        reason = result.get('reason', 'unknown')
        feedback = result.get('feedback')
        return approve, reason, feedback
    
    return True, "AI error — auto-approve", None


def approve_plan(sid):
    """Call Jules approvePlan API."""
    jules = get_jules()
    try:
        jules.approve_plan(sid)
        return True
    except Exception as e:
        print(f"  [plan_review] approve_plan error: {e}")
        return False


def send_feedback(sid, message):
    """Send feedback to Jules (when plan rejected)."""
    jules = get_jules()
    try:
        jules.send_message(sid, message)
        return True
    except Exception as e:
        print(f"  [plan_review] send_message error: {e}")
        return False


def review_and_approve(sid, task, repo, ptype, rejection_count=0):
    """Full flow: review → approve or send feedback.
    
    Returns: (approved: bool, reason: str, new_rejection_count: int)
    """
    print(f"  │  [plan_review] Reviewing plan for session {sid[:12]}...")
    
    approve, reason, feedback = review_plan(sid, task, repo, ptype)
    
    if approve:
        print(f"  │  [plan_review] ✓ Approved: {reason}")
        if approve_plan(sid):
            return True, reason, rejection_count
        return False, "approvePlan API failed", rejection_count
    
    # Rejected
    new_count = rejection_count + 1
    print(f"  │  [plan_review] ✗ Rejected (#{new_count}): {reason}")
    
    if new_count >= 3:
        # 3-strike rule: archive session
        print(f"  │  [plan_review] 3 strikes — archiving session")
        jules = get_jules()
        try:
            jules.archive_session(sid)
        except: pass
        return False, "3 rejections — archived", new_count
    
    # Send feedback and wait for new plan
    if feedback:
        print(f"  │  [plan_review] Sending feedback: {feedback[:80]}")
        send_feedback(sid, feedback)
    
    return False, reason, new_count


if __name__ == "__main__":
    # Test with manual session
    SID = "4164765062053180754"
    print(f"Testing plan reviewer with session {SID}")
    session = get_plan_info(SID)
    if session:
        print(f"State: {session.get('state')}")
        print(f"Title: {session.get('title')}")
