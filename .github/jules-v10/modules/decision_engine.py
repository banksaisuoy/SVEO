"""
v10.1 Decision Engine — "Quality Over Quantity" Strategy
=========================================================
Based on data analysis:
- Old strategy: 40-50 sessions/day, 6% success rate → 2.4 real outputs/day
- New strategy: 8-10 sessions/day, 60%+ success rate → 5+ real outputs/day

KEY CHANGES:
1. Only target repos that actually BUILD (omniflow-ai-commerce, All-in-bank)
2. Use "persona" prompts (Sentinel, Tester, Reviewer) — proven to work
3. Task types that ALWAYS produce output:
   - code_review: Review code → output findings as GitHub issue
   - test_generation: Write tests for existing functions
   - documentation: Write/improve docs
   - security_audit: Find vulnerabilities
   - small_feature: Only if very well-scoped
4. Skip repos with broken package.json
5. Track VALUE metrics (not just PR count)
"""
import json, re, os, sys, urllib.request
from datetime import datetime, timezone, timedelta
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clients.api_clients import get_ai, get_github
from db.database import load_repo_memory, enqueue_task, dequeue_task

# === ONLY target repos that actually work ===
# (repos with valid package.json + buildable code)
ACTIVE_REPOS = [
    # (repo, branch, render_service_id, project_type, weight)
    ("omniflow-ai-commerce", "main", None, "ecommerce", 3),   # TypeScript, works!
    ("All-in-bank", "main", None, "banking", 2),               # Vite app, valid JSON
]

# Repos that are BROKEN — don't waste quota on these
BROKEN_REPOS = [
    "SVEO",       # package.json broken (was restored but Jules keeps breaking)
    "Magsevo",    # package.json broken
    "omni-flow",  # Next.js + Prisma, build fails, DB mismatch
]

# Legacy (kept for reference but not used)
TIER1 = ACTIVE_REPOS
TIER2 = []
STOP_REPOS = BROKEN_REPOS + [
    "MyApplication", "MyApplication10", "MyApplication11", "MyApplication12",
    "MyApplication13", "MyApplication14", "MyApplication15",
    "All-in-pne", "Local-Projects-Archive", "Test", "firstweb", "intership",
    "cfd-demos", "Web-ai-chat---backup", "Arduino-ESP32-Backup", "Work_CP",
    "IT_Support_AI_Project", "ai-agent-jetpack",  # not production apps
]

# === Task types with proven success rates ===
# Based on analysis: "persona" prompts work, "improve X" doesn't
TASK_PERSONAS = {
    'code_review': {
        'title_prefix': 'Reviewer',
        'persona': 'You are "Reviewer" 🔍 — a senior code reviewer who finds bugs, security issues, and improvement opportunities.',
        'instruction': """Your mission: Review the codebase and identify ONE concrete issue worth fixing.

Focus areas (pick ONE):
1. Bug: Find a real bug that could cause incorrect behavior
2. Security: Find a vulnerability (XSS, SQL injection, hardcoded secrets, etc.)
3. Performance: Find a performance issue (N+1 query, memory leak, etc.)
4. Code smell: Find code that should be refactored (duplication, long functions)

Output requirements:
- Create or modify files to FIX the issue you found
- Add a comment explaining what was wrong and how you fixed it
- Keep changes SMALL (1-3 files, <100 lines)
- Output git patch

If you cannot find any issue worth fixing, output an empty patch.""",
        'expected_files': '1-3',
        'success_rate': 0.7,  # code review almost always produces output
    },
    'test_generation': {
        'title_prefix': 'Tester',
        'persona': 'You are "Tester" 🧪 — a test engineer who writes comprehensive tests.',
        'instruction': """Your mission: Write tests for existing code that lacks coverage.

Steps:
1. Find a file with functions/components that have NO tests
2. Create a test file for it (use the project's existing test framework)
3. Write at least 3 test cases covering:
   - Happy path (normal usage)
   - Edge case (empty input, invalid data)
   - Error case (failure handling)

Output requirements:
- Create ONE new test file (don't modify existing code)
- Use the project's existing test framework (jest, vitest, pytest, etc.)
- Tests must be runnable: `npm test` or equivalent
- Output git patch

If all code already has tests, find the file with LEAST coverage and add more tests.""",
        'expected_files': '1',
        'success_rate': 0.8,  # test generation almost always works
    },
    'documentation': {
        'title_prefix': 'Docs',
        'persona': 'You are "Docs" 📝 — a technical writer who creates clear documentation.',
        'instruction': """Your mission: Improve documentation for this project.

Pick ONE:
1. Find a file with complex logic and add inline comments explaining how it works
2. Find a function/component without JSDoc/docstring and add it
3. Find a README section that's missing or outdated and improve it
4. Create an API documentation file for undocumented endpoints

Output requirements:
- Modify 1-2 files (documentation only, NO code changes)
- Use clear, concise language
- Include examples where helpful
- Output git patch

If documentation is already comprehensive, add examples or improve existing docs.""",
        'expected_files': '1-2',
        'success_rate': 0.75,
    },
    'security_audit': {
        'title_prefix': 'Sentinel',
        'persona': 'You are "Sentinel" 🛡️ — a security-focused agent who protects the codebase from vulnerabilities.',
        'instruction': """Your mission: Find and fix ONE security issue.

Check for:
1. Hardcoded secrets (passwords, API keys, tokens)
2. SQL injection vulnerabilities
3. XSS vulnerabilities (dangerouslySetInnerHTML, unescaped output)
4. Missing input validation
5. Insecure authentication
6. Missing rate limiting on sensitive endpoints

Output requirements:
- Fix ONE security issue (don't try to fix everything)
- Add a comment explaining the vulnerability and the fix
- Keep changes SMALL (1-3 files)
- Output git patch

If no security issues found, add ONE security enhancement (e.g., input sanitization).""",
        'expected_files': '1-3',
        'success_rate': 0.7,
    },
    'small_feature': {
        'title_prefix': 'Builder',
        'persona': 'You are "Builder" 🔨 — a focused developer who adds small, well-defined features.',
        'instruction': """Your mission: Add ONE small, self-contained feature.

Rules:
- Feature must touch MAXIMUM 3 files
- Feature must not break existing functionality
- Feature must be testable
- Feature must be useful to users

Good examples:
- Add a loading spinner to a slow component
- Add keyboard shortcut for a common action
- Add empty state UI for a list
- Add a "copy to clipboard" button

Bad examples (DON'T do these):
- Add authentication system (too big)
- Refactor the entire codebase (too risky)
- Add a new database table (too complex)

Output requirements:
- Implement the feature completely
- Don't leave TODO comments
- Output git patch

If you're unsure about the feature, output an empty patch instead of guessing.""",
        'expected_files': '1-3',
        'success_rate': 0.5,
    },
}

# Task type distribution (must sum to 1.0)
TASK_DISTRIBUTION = {
    'code_review': 0.30,      # 30% — high value, high success
    'test_generation': 0.30,  # 30% — always produces output
    'documentation': 0.15,    # 15% — low risk, useful
    'security_audit': 0.15,   # 15% — high value
    'small_feature': 0.10,    # 10% — only if well-scoped
}


def get_repo_metadata(repo, branch):
    """Fetch repo metadata."""
    gh = get_github()
    progress, psha, actual_branch = gh.get_progress_md(repo, branch)
    if not progress:
        progress = f"# Progress — {repo}\nType: unknown\nCompleted: (none)\n"
        gh.update_progress_md(repo, actual_branch, progress, None, "docs: create PROGRESS.md")
    
    commits = gh.get_recent_commits(repo, actual_branch, 5)
    merged_prs = gh.get_merged_prs(repo, 3)
    
    deps = []
    readme = ""
    try:
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
                    readme = r.read().decode('utf-8','ignore')[:1000]
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
            cleaned = re.sub(r'^-\s*[✓✗]\s*', '', line)
            cleaned = re.sub(r'\(PR #\d+,.*\)$', '', cleaned).strip()
            if cleaned:
                tasks.append(cleaned[:80])
    return tasks[:5]


def pick_task_type(repo_memory, last_5_tasks):
    """Pick task type based on distribution + recent history."""
    # Count types in recent tasks
    type_counts = {t: 0 for t in TASK_DISTRIBUTION}
    for task in last_5_tasks:
        tl = task.lower()
        if 'review' in tl or 'reviewer' in tl:
            type_counts['code_review'] += 1
        elif 'test' in tl or 'tester' in tl:
            type_counts['test_generation'] += 1
        elif 'doc' in tl or 'docs' in tl:
            type_counts['documentation'] += 1
        elif 'security' in tl or 'sentinel' in tl:
            type_counts['security_audit'] += 1
        elif 'feature' in tl or 'builder' in tl:
            type_counts['small_feature'] += 1
    
    # Calculate deficit (target - actual)
    deficits = {}
    for t, target_pct in TASK_DISTRIBUTION.items():
        # Target count out of 5 recent tasks
        target_count = target_pct * 5
        deficits[t] = target_count - type_counts[t]
    
    # Pick the type with highest deficit (most below target)
    # Add some randomness to avoid always picking the same
    import random
    weighted = []
    for t, deficit in deficits.items():
        weight = max(0.1, deficit)  # minimum weight
        weighted.append((t, weight))
    
    total = sum(w for _, w in weighted)
    r = random.random() * total
    cumulative = 0
    for t, w in weighted:
        cumulative += w
        if r <= cumulative:
            return t
    return 'code_review'  # default


def pick_task(repo, ptype, repo_metadata, repo_memory):
    """Pick task using persona-based prompts (proven to work)."""
    
    # Check task queue first (build failures, user requests)
    queued = dequeue_task(repo)
    if queued:
        return {
            'task_type': queued['task_type'],
            'title': queued['title'],
            'description': queued.get('description', ''),
            'jules_prompt': queued.get('jules_prompt', ''),
            'reasoning': f"From queue (priority {queued['priority']})",
            'risk_level': 'medium',
            'estimated_files_touched': 3,
            'acceptance_criteria': ['build passes'],
            'from_queue': True,
            'task_id': queued['id']
        }
    
    last_5_tasks = extract_recent_tasks(repo_metadata['progress'])
    task_type = pick_task_type(repo_memory, last_5_tasks)
    persona = TASK_PERSONAS[task_type]
    
    # Build prompt using persona + repo context
    prompt = f"""{persona['persona']}

REPO: {repo} ({ptype})
RECENT COMMITS: {repo_metadata['commits'][:3]}
RECENT PRS: {repo_metadata['merged_prs'][:3]}
DEPENDENCIES: {repo_metadata['deps'][:8]}

RECENT TASKS (avoid duplicates):
{chr(10).join(f'- {t}' for t in last_5_tasks) or '(none)'}

{persona['instruction']}

IMPORTANT: Output git patch. If you cannot do this safely, output an empty patch.
Do NOT truncate files. Do NOT break existing functionality."""

    title = f"{persona['title_prefix']}: {repo} {task_type.replace('_', ' ')}"
    
    return {
        'task_type': task_type,
        'title': title[:80],
        'description': f"{task_type} for {repo}",
        'jules_prompt': prompt,
        'reasoning': f"Persona-based {task_type} (expected success rate: {persona['success_rate']*100:.0f}%)",
        'risk_level': 'low' if task_type in ['test_generation', 'documentation'] else 'medium',
        'estimated_files_touched': 2,
        'acceptance_criteria': ['build passes', 'no regressions'],
    }


def review_task_safety(task, repo, ptype):
    """Pre-flight safety check."""
    ai = get_ai()
    if not ai.api_key:
        return True, 'no AI key — auto-approve'
    
    prompt = f"""You are a code safety reviewer. Is this task safe to auto-approve?

REPO: {repo} ({ptype})
TASK: {task.get('title','')}
TYPE: {task.get('task_type','')}
PROMPT (first 800 chars): {task.get('jules_prompt','')[:800]}

REJECT IF:
- Deletes critical files (package.json, README, .gitignore)
- Mass refactors (>10 files)
- Adds suspicious dependencies
- Disables tests or CI

Respond JSON: {{"safe": true/false, "reason": "short"}}"""

    result = ai.chat_json(prompt, system="You are a safety reviewer. Respond JSON only.")
    if result:
        return bool(result.get('safe', True)), result.get('reason', 'unknown')
    return True, 'AI error — auto-approve'


# For testing
if __name__ == "__main__":
    print("Testing v10.1 Decision Engine...")
    print(f"Active repos: {[r[0] for r in ACTIVE_REPOS]}")
    print(f"Broken repos (skipped): {BROKEN_REPOS}")
    print(f"Task distribution: {TASK_DISTRIBUTION}")
    print()
    
    for repo, branch, _, ptype, _ in ACTIVE_REPOS:
        print(f"\n=== {repo} ({ptype}) ===")
        metadata = get_repo_metadata(repo, branch)
        print(f"Progress: {len(metadata['progress'])} chars")
        print(f"Commits: {len(metadata['commits'])}")
        
        memory = load_repo_memory(repo)
        task = pick_task(repo, ptype, metadata, memory)
        print(f"\nTask: {task['title']}")
        print(f"Type: {task['task_type']}")
        print(f"Risk: {task['risk_level']}")
        print(f"Prompt (first 200 chars): {task['jules_prompt'][:200]}...")
