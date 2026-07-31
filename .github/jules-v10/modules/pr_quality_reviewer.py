"""
PR Quality Reviewer v10 — reviews PR before auto-merge
================================================================
After PR is created (on: pull_request opened):
1. Fetch PR diff (files, additions, deletions)
2. AI reviews diff
3. Score: 0-100 based on:
   - Code style (no console.log, TODO, commented code)
   - Test coverage (did Jules add tests?)
   - File impact (not too many files)
   - Breaking changes
   - Dependency additions
4. Score >= 50 → 'PR Quality Review' check passes
5. Score < 50 → comment + close + queue follow-up

This runs as a GitHub Actions workflow on PR open.
"""
import json, sys, os, re
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clients.api_clients import get_github, get_ai
from db.database import enqueue_task, update_session_v10


# Bad patterns to detect
BAD_PATTERNS = [
    (r'console\.log\(', 'console.log left in code'),
    (r'//\s*TODO', 'TODO comment left in code'),
    (r'//\s*FIXME', 'FIXME comment left in code'),
    (r'//\s*HACK', 'HACK comment left in code'),
    (r'debugger;', 'debugger statement left in code'),
    (r'password\s*=\s*[\'"][^\'"]+[\'"]', 'hardcoded password'),
    (r'api[_-]?key\s*=\s*[\'"][^\'"]+[\'"]', 'hardcoded API key'),
    (r'secret\s*=\s*[\'"][^\'"]+[\'"]', 'hardcoded secret'),
]


def score_pr(repo, pr_number, task=None):
    """Score a PR from 0-100. Returns (score, issues, recommendation)."""
    gh = get_github()
    
    pr = gh.get_pr(repo, pr_number)
    if not pr:
        return 0, ['PR not found'], 'reject'
    
    files = gh.get_pr_files(repo, pr_number)
    if not files:
        return 0, ['Cannot fetch PR files'], 'reject'
    
    issues = []
    score = 100
    
    # Check 1: file count
    file_count = len(files)
    if file_count == 0:
        issues.append('Empty PR (0 files)')
        score -= 50
    elif file_count > 20:
        issues.append(f'Too many files ({file_count} > 20)')
        score -= 15
    elif file_count > 15:
        issues.append(f'Many files ({file_count})')
        score -= 5
    
    # Check 2: total additions
    total_add = sum(f.get('additions', 0) for f in files)
    total_del = sum(f.get('deletions', 0) for f in files)
    
    if total_add > 5000:
        issues.append(f'Very large additions ({total_add})')
        score -= 15
    elif total_add > 2000:
        issues.append(f'Large additions ({total_add})')
        score -= 5
    
    # Check 3: bad patterns
    for f in files:
        patch = f.get('patch', '')
        if not patch:
            continue
        for pattern, msg in BAD_PATTERNS:
            if re.search(pattern, patch, re.IGNORECASE):
                issues.append(f'{f["filename"]}: {msg}')
                score -= 5
    
    # Check 4: dependencies added
    for f in files:
        if f['filename'] in ['package.json', 'package-lock.json', 'yarn.lock']:
            patch = f.get('patch', '')
            # Look for added deps (lines starting with +)
            added_lines = [l for l in patch.split('\n') if l.startswith('+') and not l.startswith('+++')]
            added_deps = [l for l in added_lines if ':' in l and '"' in l]
            if len(added_deps) > 3:
                issues.append(f'Added {len(added_deps)} dependencies — review carefully')
                score -= 10
    
    # Check 5: test files
    has_tests = any('test' in f['filename'].lower() or 'spec' in f['filename'].lower() 
                    for f in files)
    if task and task.get('task_type') in ['feature', 'bugfix'] and not has_tests:
        issues.append('No test files in PR')
        score -= 10
    
    # Check 6: empty PR
    if total_add == 0 and total_del == 0:
        issues.append('PR has no code changes')
        score -= 50
    
    # Check 7: suspicious patterns
    for f in files:
        if f['filename'].startswith('.'):
            issues.append(f'Modifies hidden file: {f["filename"]}')
            score -= 5
    
    # AI review (if available)
    ai = get_ai()
    if ai.api_key and files:
        ai_score = ai_review_pr(pr, files, task)
        if ai_score is not None:
            # Blend AI score with rule-based score
            score = int(0.5 * score + 0.5 * ai_score)
    
    # Recommendation
    if score >= 70:
        recommendation = 'approve'
    elif score >= 50:
        recommendation = 'approve_with_warnings'
    else:
        recommendation = 'reject'
    
    return max(0, min(100, score)), issues, recommendation


def ai_review_pr(pr, files, task=None):
    """AI review of PR diff."""
    ai = get_ai()
    
    # Build summary of changes
    summary = []
    for f in files[:20]:  # cap at 20 files
        fn = f['filename']
        add = f.get('additions', 0)
        del_ = f.get('deletions', 0)
        status = f.get('status', '?')
        summary.append(f'- {fn} ({status}, +{add} -{del_})')
    
    prompt = f"""You are a code reviewer. Score this PR from 0-100.

PR Title: {pr.get('title','')}
PR Body: {(pr.get('body') or '')[:500]}
Task: {task.get('title','') if task else 'unknown'}

Files changed ({len(files)}):
{chr(10).join(summary)}

Respond JSON:
{{"score": 75, "reasoning": "short explanation", "concerns": ["concern1", "concern2"]}}"""

    result = ai.chat_json(prompt, system="You are a code reviewer. Respond JSON only.")
    if result:
        return result.get('score')
    return None


def review_pr(repo, pr_number, task=None, session_id=None):
    """Full PR review flow.
    
    Returns: (passed: bool, score: int, issues: list)
    """
    print(f"  [pr_review] Reviewing {repo} PR #{pr_number}...")
    
    score, issues, recommendation = score_pr(repo, pr_number, task)
    
    print(f"  [pr_review] Score: {score}/100 — {recommendation}")
    if issues:
        for issue in issues[:5]:
            print(f"  [pr_review]   ⚠️ {issue}")
    
    # Update session in DB
    if session_id:
        update_session_v10(session_id,
            v10_quality_score=score,
            v10_review_status=recommendation)
    
    gh = get_github()
    
    if recommendation == 'reject':
        # Comment + close
        comment = f"""🤖 **PR Quality Review** — Score: {score}/100

❌ **Rejected** — auto-closing

Issues found:
{chr(10).join(f'- {i}' for i in issues[:10])}

The PR will be closed. A follow-up task has been queued.
"""
        gh.comment_pr(repo, pr_number, comment)
        gh.close_pr(repo, pr_number)
        
        # Queue follow-up task
        if task:
            enqueue_task(
                repo_id=repo,
                task_type=task.get('task_type', 'bugfix'),
                title=f"Fix PR #{pr_number} quality issues",
                description=f"Previous PR had issues: {', '.join(issues[:3])}",
                jules_prompt=task.get('jules_prompt', ''),
                priority=2,
                origin='pr_quality_rejection'
            )
        
        return False, score, issues
    
    elif recommendation == 'approve_with_warnings':
        # Comment but allow merge
        comment = f"""🤖 **PR Quality Review** — Score: {score}/100

✅ **Approved with warnings**

Issues found:
{chr(10).join(f'- {i}' for i in issues[:5])}

PR will proceed to merge.
"""
        gh.comment_pr(repo, pr_number, comment)
        return True, score, issues
    
    else:  # approve
        comment = f"""🤖 **PR Quality Review** — Score: {score}/100

✅ **Approved** — quality looks good!
"""
        gh.comment_pr(repo, pr_number, comment)
        return True, score, issues


if __name__ == "__main__":
    # Test with a recent PR
    print("Testing PR Quality Reviewer...")
    
    # All-in-bank PR #24 (recently merged)
    score, issues, rec = score_pr("All-in-bank", 24)
    print(f"\nAll-in-bank PR #24:")
    print(f"  Score: {score}/100")
    print(f"  Recommendation: {rec}")
    print(f"  Issues: {issues}")
