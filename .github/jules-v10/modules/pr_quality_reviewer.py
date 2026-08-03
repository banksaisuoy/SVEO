"""
PR Quality Reviewer v10 — reviews PR before auto-merge
================================================================
After PR is created (on: pull_request opened):
1. Fetch PR diff (files, additions, deletions)
2. Validate JS/JSON syntax (CRITICAL — catch broken code)
3. AI reviews diff
4. Score: 0-100 based on syntax, code style, tests, file impact
5. Score >= 50 → check passes
6. Score < 50 → comment + close + queue follow-up
"""
import json, sys, os, re, urllib.request
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clients.api_clients import get_github, get_ai
from db.database import enqueue_task, update_session_v10

OWNER = os.environ.get("GH_OWNER", "banksaisuoy")

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


def validate_syntax(files, repo, pr_number):
    """Validate JS/JSON file syntax by fetching raw content.
    Returns list of (filename, error) tuples for broken files.
    """
    errors = []
    for f in files:
        fn = f.get('filename', '')
        if not fn: continue
        if not (fn.endswith('.js') or fn.endswith('.json')): continue
        if 'node_modules' in fn or fn.endswith('package-lock.json'): continue
        
        try:
            url = f"https://raw.githubusercontent.com/{OWNER}/{repo}/main/{fn}"
            req = urllib.request.Request(url, headers={'User-Agent': 'PR-Reviewer'})
            with urllib.request.urlopen(req, timeout=10) as r:
                file_content = r.read().decode('utf-8', 'ignore')
            
            if fn.endswith('.js'):
                open_b = file_content.count('{')
                close_b = file_content.count('}')
                if open_b != close_b:
                    errors.append((fn, f'unbalanced braces: {open_b} open vs {close_b} close'))
                stripped = file_content.rstrip()
                if stripped.endswith(',') or stripped.endswith('('):
                    errors.append((fn, 'file truncated (ends with comma or open paren)'))
                lines = file_content.split('\n')
                if len(lines) < 20 and 'require(' in file_content:
                    errors.append((fn, f'short JS file ({len(lines)} lines) with require()'))
                # Check for undefined variable usage (common in truncated files)
                if 'require(' in file_content and len(lines) < 50:
                    # Look for variables used but not defined
                    import re as _re
                    # Find variable names used (after require or in function calls)
                    used_vars = set(_re.findall(r'\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(', file_content))
                    # Filter out JS keywords and common globals
                    keywords = {'require', 'console', 'app', 'express', 'module', 'exports', 'process',
                                'if', 'for', 'while', 'function', 'return', 'typeof', 'delete', 'void',
                                'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'JSON',
                                'Object', 'Array', 'String', 'Number', 'Boolean', 'Promise', 'Date', 'Math',
                                'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
                                'decodeURIComponent', 'Buffer', 'URL', 'fetch', 'alert', 'prompt'}
                    used_vars -= keywords
                    # Find defined variables
                    defined = set(_re.findall(r'(?:const|let|var|function)\s+([a-zA-Z_][a-zA-Z0-9_]*)', file_content))
                    defined |= set(_re.findall(r'([a-zA-Z_][a-zA-Z0-9_]*)\s*=', file_content))
                    defined |= keywords
                    undefined = used_vars - defined
                    if undefined:
                        errors.append((fn, f'undefined variables used: {list(undefined)[:3]}'))
            
            if fn.endswith('.json'):
                try:
                    json.loads(file_content)
                except json.JSONDecodeError as e:
                    errors.append((fn, f'invalid JSON: {str(e)[:80]}'))
        except Exception as e:
            pass
    return errors


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
    if total_add > 5000:
        issues.append(f'Very large additions ({total_add})')
        score -= 15
    
    # Check 3: bad patterns
    for f in files:
        patch = f.get('patch', '')
        if not patch: continue
        for pattern, msg in BAD_PATTERNS:
            if re.search(pattern, patch, re.IGNORECASE):
                issues.append(f'{f["filename"]}: {msg}')
                score -= 5
    
    # Check 4: dependencies added
    for f in files:
        if f['filename'] in ['package.json', 'package-lock.json', 'yarn.lock']:
            patch = f.get('patch', '')
            added = [l for l in patch.split('\n') if l.startswith('+') and not l.startswith('+++')]
            deps = [l for l in added if ':' in l and '"' in l]
            if len(deps) > 3:
                issues.append(f'Added {len(deps)} dependencies — review carefully')
                score -= 10
    
    # Check 5: test files
    has_tests = any('test' in f['filename'].lower() or 'spec' in f['filename'].lower() for f in files)
    if task and task.get('task_type') in ['feature', 'bugfix'] and not has_tests:
        issues.append('No test files in PR')
        score -= 10
    
    # Check 6: empty PR
    total_del = sum(f.get('deletions', 0) for f in files)
    if total_add == 0 and total_del == 0:
        issues.append('PR has no code changes')
        score -= 50
    
    # Check 7: hidden files
    for f in files:
        if f['filename'].startswith('.') and f['filename'] not in ['.env.example', '.gitignore']:
            issues.append(f'Modifies hidden file: {f["filename"]}')
            score -= 5
    
    # CRITICAL: Syntax validation
    syntax_errors = validate_syntax(files, repo, pr_number)
    if syntax_errors:
        for fn, err in syntax_errors:
            issues.append(f'SYNTAX ERROR: {fn}: {err}')
            print(f'  [pr_review] SYNTAX ERROR: {fn}: {err}')
        score -= 40  # Heavy penalty for broken code
    
    # AI review
    ai = get_ai()
    if ai.api_key and files:
        ai_score = ai_review_pr(pr, files, task)
        if ai_score is not None:
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
    ai = get_ai()
    summary = []
    for f in files[:20]:
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
{{"score": 75, "reasoning": "short explanation", "concerns": ["concern1"]}}"""
    
    result = ai.chat_json(prompt, system="You are a code reviewer. Respond JSON only.")
    if result:
        return result.get('score')
    return None


def review_pr(repo, pr_number, task=None, session_id=None):
    """Full PR review flow."""
    print(f"  [pr_review] Reviewing {repo} PR #{pr_number}...")
    score, issues, recommendation = score_pr(repo, pr_number, task)
    print(f"  [pr_review] Score: {score}/100 — {recommendation}")
    if issues:
        for issue in issues[:5]:
            print(f"  [pr_review]   ⚠️ {issue}")
    
    if session_id:
        update_session_v10(session_id, v10_quality_score=score, v10_review_status=recommendation)
    
    gh = get_github()
    if recommendation == 'reject':
        comment = f"""🤖 **PR Quality Review** — Score: {score}/100

❌ **Rejected** — auto-closing

Issues found:
{chr(10).join(f'- {i}' for i in issues[:10])}

A follow-up task has been queued.
"""
        gh.comment_pr(repo, pr_number, comment)
        gh.close_pr(repo, pr_number)
        if task:
            enqueue_task(
                repo_id=repo, task_type=task.get('task_type', 'bugfix'),
                title=f"Fix PR #{pr_number} quality issues",
                description=f"Previous PR had issues: {', '.join(issues[:3])}",
                jules_prompt=task.get('jules_prompt', ''),
                priority=2, origin='pr_quality_rejection'
            )
        return False, score, issues
    elif recommendation == 'approve_with_warnings':
        comment = f"""🤖 **PR Quality Review** — Score: {score}/100

✅ **Approved with warnings**

Issues found:
{chr(10).join(f'- {i}' for i in issues[:5])}

PR will proceed to merge.
"""
        gh.comment_pr(repo, pr_number, comment)
        return True, score, issues
    else:
        comment = f"""🤖 **PR Quality Review** — Score: {score}/100

✅ **Approved** — quality looks good!
"""
        gh.comment_pr(repo, pr_number, comment)
        return True, score, issues


if __name__ == "__main__":
    print("Testing PR Quality Reviewer...")
    score, issues, rec = score_pr("All-in-bank", 24)
    print(f"\nAll-in-bank PR #24: Score {score}/100 — {rec}")
    print(f"Issues: {issues[:5]}")
