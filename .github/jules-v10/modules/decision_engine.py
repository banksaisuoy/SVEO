"""
Decision Engine v10 — AI PM that thinks like a senior engineer
================================================================
Inputs (per repo):
- PROGRESS.md (history)
- Recent commits + merged PRs
- Code complexity (lines per file, dependency count)
- Failed task patterns (avoid repeating)
- Successful task patterns (lean into)
- Build status
- Time since last touch
- GitHub Issues (if any)

Outputs:
{
  "task_type": "feature|bugfix|security|polish",
  "title": "specific actionable title",
  "description": "detailed description",
  "jules_prompt": "DETAILED prompt for Jules",
  "reasoning": "why this task",
  "risk_level": "low|medium|high",
  "estimated_files_touched": int,
  "acceptance_criteria": ["criterion1", "criterion2", ...]
}

Logic (think like a senior PM):
1. Don't repeat recent tasks (check last_5_tasks)
2. Balance types: 40% feature, 30% bugfix, 15% security, 15% polish
3. Avoid mass refactors if last commit was mass refactor
4. If build broken → force bugfix with priority 1
5. If many open issues → prioritize user-reported bugs
6. Don't add new dependency if last 2 PRs added deps
7. Force polish/refactor every 7th task per repo (avoid tech debt)
"""
import json, re, os, sys
from datetime import datetime, timezone, timedelta
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clients.api_clients import get_ai, get_github
from db.database import load_repo_memory, enqueue_task, dequeue_task

# Tier 1 repos
TIER1 = [
    ("omniflow-ai-commerce", "main", None, "ecommerce", 3),
    ("SVEO", "main", "srv-d9167rok1i2s7387u66g", "video_gallery", 2),
    ("Magsevo", "main", "srv-d5e9687fte5s73ad8m70", "business_tool", 2),
    ("omni-flow", "main", "srv-d5f03gmmcj7s73asfui0", "ai_platform", 2),
    ("All-in-bank", "main", None, "banking", 1),
]
TIER2 = [
    ("IT_Support_AI_Project", "master", None, "it_support", 1),
    ("ai-agent-jetpack", "main", None, "ai_agent", 1),
]
STOP_REPOS = [
    "MyApplication", "MyApplication10", "MyApplication11", "MyApplication12",
    "MyApplication13", "MyApplication14", "MyApplication15",
    "All-in-pne", "Local-Projects-Archive", "Test", "firstweb", "intership",
    "cfd-demos", "Web-ai-chat---backup", "Arduino-ESP32-Backup", "Work_CP"
]


def get_repo_metadata(repo, branch):
    """Fetch repo metadata: progress.md, commits, PRs, deps, readme."""
    gh = get_github()
    progress, psha, actual_branch = gh.get_progress_md(repo, branch)
    if not progress:
        progress = f"# Progress — {repo}\nType: unknown\nCompleted: (none)\n"
        gh.update_progress_md(repo, actual_branch, progress, None, "docs: create PROGRESS.md")
    
    commits = gh.get_recent_commits(repo, actual_branch, 5)
    merged_prs = gh.get_merged_prs(repo, 3)
    
    # Get deps + readme from raw GitHub
    deps = []
    readme = ""
    try:
        import urllib.request
        for b in [actual_branch, "main", "master"]:
            try:
                with urllib.request.urlopen(
                    f"https://raw.githubusercontent.com/banksaisuoy/{repo}/{b}/package.json",
                    timeout=5) as r:
                    pkg = json.loads(r.read())
                    deps = list((pkg.get("dependencies") or {}).keys())[:15]
                break
            except: pass
        for b in [actual_branch, "main", "master"]:
            try:
                with urllib.request.urlopen(
                    f"https://raw.githubusercontent.com/banksaisuoy/{repo}/{b}/README.md",
                    timeout=5) as r:
                    readme = r.read().decode('utf-8', 'ignore')[:1000]
                break
            except: pass
    except: pass
    
    return {
        'progress': progress, 'psha': psha, 'branch': actual_branch,
        'commits': commits, 'merged_prs': merged_prs,
        'deps': deps, 'readme': readme
    }


def extract_recent_tasks(progress_text):
    """Extract last 5 task titles from PROGRESS.md."""
    if not progress_text:
        return []
    tasks = []
    for line in progress_text.split('\n'):
        line = line.strip()
        if line.startswith('- ✓') or line.startswith('- ✗'):
            # Remove emoji prefix and date
            cleaned = re.sub(r'^-\s*[✓✗]\s*', '', line)
            cleaned = re.sub(r'\(PR #\d+,.*\)$', '', cleaned).strip()
            if cleaned:
                tasks.append(cleaned[:80])
    return tasks[:5]


def decide_task_type(repo_memory, last_5_tasks):
    """Decide what type of task to pick (balance heuristic)."""
    # Count types in last 5 tasks
    type_counts = {'feature': 0, 'bugfix': 0, 'security': 0, 'polish': 0}
    for task in last_5_tasks:
        tl = task.lower()
        if 'fix' in tl or 'bug' in tl: type_counts['bugfix'] += 1
        elif 'security' in tl or 'auth' in tl: type_counts['security'] += 1
        elif 'refactor' in tl or 'polish' in tl or 'cleanup' in tl: type_counts['polish'] += 1
        else: type_counts['feature'] += 1
    
    # Target distribution: 40/30/15/15
    targets = {'feature': 2, 'bugfix': 1, 'security': 1, 'polish': 1}
    
    # Pick the type most below target
    deficits = {t: targets[t] - type_counts[t] for t in targets}
    return max(deficits, key=deficits.get)


def pick_task(repo, ptype, repo_metadata, repo_memory):
    """Main decision function: pick the best task for this repo."""
    
    # Check task queue first (build failures, user requests)
    queued = dequeue_task(repo)
    if queued:
        return {
            'task_type': queued['task_type'],
            'title': queued['title'],
            'description': queued.get('description', ''),
            'jules_prompt': queued.get('jules_prompt', ''),
            'reasoning': f"From queue (priority {queued['priority']}, origin {queued['origin']})",
            'risk_level': 'medium',
            'estimated_files_touched': 5,
            'acceptance_criteria': ['build passes', 'tests pass'],
            'from_queue': True,
            'task_id': queued['id']
        }
    
    last_5_tasks = extract_recent_tasks(repo_metadata['progress'])
    desired_type = decide_task_type(repo_memory, last_5_tasks)
    
    failed_patterns = repo_memory.get('failed_patterns', []) if repo_memory else []
    if isinstance(failed_patterns, str):
        failed_patterns = json.loads(failed_patterns)
    
    success_patterns = repo_memory.get('success_patterns', []) if repo_memory else []
    if isinstance(success_patterns, str):
        success_patterns = json.loads(success_patterns)
    
    ai = get_ai()
    if not ai.api_key:
        # Fallback: simple template task
        return _fallback_task(repo, ptype, desired_type, last_5_tasks)
    
    prompt = f"""You are a senior PM for "{repo}" (a {ptype} app). 
Pick ONE most impactful NEW task that is DIFFERENT from recent tasks.

REPO CONTEXT:
- Type: {ptype}
- Recent commits: {repo_metadata['commits']}
- Recent merged PRs: {repo_metadata['merged_prs']}
- Dependencies: {repo_metadata['deps'][:10]}
- README excerpt: {repo_metadata['readme'][:600]}

RECENT TASKS (avoid duplicates — pick something NEW):
{chr(10).join(f'- {t}' for t in last_5_tasks) or '(none)'}

FAILED PATTERNS (avoid these approaches):
{chr(10).join(f'- {p.get("title","?")}: {p.get("reason","?")}' for p in failed_patterns[:3]) or '(none)'}

SUCCESSFUL PATTERNS (these worked well, consider similar):
{chr(10).join(f'- {p.get("title","?")}' for p in success_patterns[:3]) or '(none)'}

DESIRED TASK TYPE: {desired_type} (balancing work distribution)

SAFETY RULES:
1. Don't touch more than 10 files
2. Don't add new dependencies unless absolutely necessary
3. Don't break existing API contracts
4. Don't disable tests
5. Don't modify auth/security in dangerous ways
6. Focus on ONE concrete deliverable

Respond JSON only:
{{
  "task_type": "{desired_type}",
  "title": "specific actionable title (max 70 chars)",
  "description": "detailed description (2-3 sentences)",
  "jules_prompt": "DETAILED prompt for Jules — specify which files to create/modify, what behavior to add, output git patch. Include acceptance criteria.",
  "reasoning": "why this task now",
  "risk_level": "low|medium|high",
  "estimated_files_touched": 3,
  "acceptance_criteria": ["criterion 1", "criterion 2", "criterion 3"]
}}"""

    result = ai.chat_json(prompt, system="You are a senior PM. Respond with valid JSON only.")
    if result and 'title' in result and 'jules_prompt' in result:
        # Sanitize
        result.setdefault('task_type', desired_type)
        result.setdefault('risk_level', 'medium')
        result.setdefault('estimated_files_touched', 5)
        result.setdefault('acceptance_criteria', ['build passes'])
        result['title'] = result['title'][:80]
        return result
    
    return _fallback_task(repo, ptype, desired_type, last_5_tasks)


def _fallback_task(repo, ptype, task_type, last_5_tasks):
    """Fallback if AI unavailable."""
    return {
        'task_type': task_type,
        'title': f'Improve {repo} ({task_type})',
        'description': f'Add high-impact {task_type} improvement',
        'jules_prompt': f"""Review this {ptype} repository and implement ONE high-impact {task_type}.

=== QUALITY RULES ===
1. 100% BUILD GUARANTEE — must not break existing build
2. Don't touch more than 10 files
3. Don't add new dependencies unless absolutely necessary
4. Add or update tests if applicable
5. Output git patch

RECENT TASKS (do something DIFFERENT):
{chr(10).join(f'- {t}' for t in last_5_tasks) or '(none)'}

Implement now.""",
        'reasoning': 'fallback (AI unavailable)',
        'risk_level': 'low',
        'estimated_files_touched': 3,
        'acceptance_criteria': ['build passes', 'no regressions']
    }


def review_task_safety(task, repo, ptype):
    """Pre-flight safety check (before creating session)."""
    ai = get_ai()
    if not ai.api_key:
        return True, 'no AI key — auto-approve'
    
    prompt = f"""You are a code safety reviewer. Is this task safe to auto-approve?

REPO: {repo} ({ptype})
TASK: {task.get('title','')}
TYPE: {task.get('task_type','')}
DESCRIPTION: {task.get('description','')}
JULES PROMPT: {task.get('jules_prompt','')[:1500]}
ESTIMATED FILES: {task.get('estimated_files_touched', '?')}

REJECT IF:
- Deletes critical files (package.json, README, .gitignore, tsconfig.json)
- Mass refactors (>15 files)
- Adds suspicious dependencies
- Asks for credentials/secrets
- Disables tests or CI
- Pushes directly to main without PR

Respond JSON:
{{"safe": true/false, "reason": "short explanation", "concerns": ["concern1", "concern2"]}}"""

    result = ai.chat_json(prompt, system="You are a safety reviewer. Respond JSON only.")
    if result:
        return bool(result.get('safe', True)), result.get('reason', 'unknown')
    return True, 'AI error — auto-approve'


# For direct testing
if __name__ == "__main__":
    print("Testing Decision Engine...")
    
    repo, branch, _, ptype, _ = TIER1[0]  # omniflow-ai-commerce
    print(f"\nRepo: {repo} ({ptype})")
    
    metadata = get_repo_metadata(repo, branch)
    print(f"Progress: {len(metadata['progress'])} chars")
    print(f"Commits: {len(metadata['commits'])}")
    print(f"PRs: {len(metadata['merged_prs'])}")
    print(f"Deps: {len(metadata['deps'])}")
    
    memory = load_repo_memory(repo)
    print(f"Memory: {bool(memory)}")
    
    task = pick_task(repo, ptype, metadata, memory)
    print(f"\n=== Picked task ===")
    print(json.dumps(task, indent=2)[:1000])
    
    safe, reason = review_task_safety(task, repo, ptype)
    print(f"\nSafety: {safe} — {reason}")
