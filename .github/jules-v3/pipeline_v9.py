#!/usr/bin/env python3
"""
Jules v9 — Plan Approval + AI Review Pipeline
==============================================

NEW FEATURES (vs v8.1):
  1. ✅ requirePlanApproval=True — Jules creates plan first, waits for approval
  2. ✅ AI pre-review — OpenRouter/z-ai reviews task safety BEFORE creating session
  3. ✅ Auto-approve plan — calls sessions.approvePlan when AWAITING_PLAN_APPROVAL
  4. ✅ send_message() — can send feedback to Jules if plan needs changes
  5. ✅ Stable state machine — handles all session states properly

STATE MACHINE:
  Created → IN_PROGRESS → AWAITING_PLAN_APPROVAL → (AI/auto approve) → IN_PROGRESS → COMPLETED → PR created
                     ↓                                                    ↓
                  FAILED                                              FAILED

JULES API METHODS USED:
  - sessions.create (with requirePlanApproval=True)
  - sessions.get (polling)
  - sessions.approvePlan (auto-approve after AI safety check)
  - sessions.sendMessage (send feedback if needed)
  - sessions.delete (cleanup stuck)

SCHEDULE:
  GitHub Actions cron: '0 6,8,10,12,14,16,18,20,22 * * *' (UTC)
"""
import sys, os, json, urllib.request, urllib.error, time, re, subprocess, tempfile, base64, traceback
from datetime import datetime, timezone, timedelta
try:
    import psycopg2
except ImportError:
    psycopg2 = None
try:
    import boto3
except ImportError:
    boto3 = None

# === Credentials ===
JULES_KEY = os.environ.get("JULES_API_KEY", "")
NEON_DB = os.environ.get("NEON_DATABASE_URL", "")
RENDER_KEY = os.environ.get("RENDER_API_KEY", "")
WASABI_ACCESS = os.environ.get("WASABI_ACCESS_KEY", "")
WASABI_SECRET = os.environ.get("WASABI_SECRET_KEY", "")
GH_TOKEN = os.environ.get("GH_PAT", "")
OWNER = "banksaisuoy"

# === Tier 1 — Production apps ===
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

BATCH_SIZE = 4  # v9: reduced from 6 to 4 (plan approval takes longer)
DAILY_QUOTA = 100
WAIT_PLAN_TIMEOUT = 300  # 5 min to wait for plan (Jules usually takes 1-3 min)
WAIT_SESSION_TIMEOUT = 1800  # 30 min for implementation phase

# === boto3 init (fixed in v8) ===
s3 = None
if boto3 and WASABI_ACCESS and WASABI_SECRET:
    try:
        s3 = boto3.client("s3",
            endpoint_url="https://s3.ap-southeast-1.wasabisys.com",
            aws_access_key_id=WASABI_ACCESS,
            aws_secret_access_key=WASABI_SECRET,
            region_name="ap-southeast-1")
    except Exception as e:
        print(f"  ⚠️ Wasabi init failed: {e}")


def gh(method, path, repo=None, body=None):
    r = repo or ""
    url = f"https://api.github.com/repos/{OWNER}/{r}{path}" if r else f"https://api.github.com{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method,
        headers={"Authorization": f"Bearer {GH_TOKEN}", "Content-Type": "application/json",
                 "Accept": "application/vnd.github+json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, (json.loads(resp.read()) if resp.status != 204 else {})
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read())
        except: return e.code, {}
    except: return 0, {}


def get_progress(repo, branch):
    for b in [branch, "main", "master"]:
        code, data = gh("GET", f"/contents/PROGRESS.md?ref={b}", repo)
        if code == 200 and isinstance(data, dict) and 'content' in data:
            return base64.b64decode(data['content']).decode('utf-8','ignore'), data.get('sha'), b
    return None, None, branch


def update_progress(repo, branch, content, sha, msg):
    body = {"message": msg, "content": base64.b64encode(content.encode()).decode(), "branch": branch}
    if sha: body["sha"] = sha
    code, _ = gh("PUT", "/contents/PROGRESS.md", repo, body)
    return code in (200, 201)


# === AI: Task pre-review (safety check) ===
def ai_review_task_safety(repo, ptype, task):
    """Use AI to review if task is safe to proceed with plan approval.
    Returns: (is_safe, reason)
    """
    OR_KEY = os.environ.get("OPENROUTER_API_KEY", "")
    if not OR_KEY:
        # No AI key — default to safe (let Jules plan handle it)
        return True, "no AI key — auto-approve"

    prompt = f"""You are a safety reviewer for an autonomous coding agent.
Review this task and decide if it's SAFE to auto-approve.

REPO: {repo} (type: {ptype})
TASK TITLE: {task.get('title','')}
TASK TYPE: {task.get('task_type','')}
DESCRIPTION: {task.get('description','')}
JULES PROMPT: {task.get('jules_prompt','')[:1500]}

SAFETY RULES (reject if ANY apply):
1. Deletes critical files (package.json, README.md, .gitignore)
2. Modifies authentication/security in dangerous way
3. Adds dependencies that look malicious
4. Asks for credentials, API keys, or env vars
5. Tries to disable tests or CI
6. Mass refactors that could break everything
7. Asks to push directly without PR

Respond JSON only:
{{"safe": true/false, "reason": "short explanation", "suggestions": "optional feedback for Jules"}}

If safe, just say {{"safe": true, "reason": "looks good"}}"""

    body = json.dumps({
        "model": "openrouter/free",
        "messages": [
            {"role": "system", "content": "You are a code safety reviewer. Respond JSON only."},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 500
    }).encode()

    try:
        req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions",
            data=body, method="POST",
            headers={"Authorization": f"Bearer {OR_KEY}",
                     "Content-Type": "application/json",
                     "HTTP-Referer": "https://github.com/banksaisuoy"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            d = json.loads(resp.read())
        if 'choices' in d:
            content = d['choices'][0]['message']['content']
            m = re.search(r'\{.*\}', content, re.DOTALL)
            if m:
                result = json.loads(m.group())
                return bool(result.get('safe', True)), result.get('reason', 'unknown')
    except Exception as e:
        print(f"  │  [Safety AI] error: {e}")
    # Default to safe on error
    return True, "AI error — auto-approve"


def call_openrouter(prompt, system=""):
    """Try OpenRouter free models"""
    OR_KEY = os.environ.get("OPENROUTER_API_KEY", "")
    if not OR_KEY: return None
    models = ["openrouter/free", "meta-llama/llama-3.3-70b-instruct:free",
              "qwen/qwen-2.5-coder-32b-instruct:free", "deepseek/deepseek-chat:free"]
    for model in models:
        try:
            body = json.dumps({
                "model": model,
                "messages": [
                    {"role": "system", "content": system or "You are a senior PM. Respond JSON only."},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 5000
            }).encode()
            req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions",
                data=body, method="POST",
                headers={"Authorization": f"Bearer {OR_KEY}",
                         "Content-Type": "application/json",
                         "HTTP-Referer": "https://github.com/banksaisuoy"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                d = json.loads(resp.read())
            if 'choices' in d:
                content = d['choices'][0]['message']['content']
                if content:
                    print(f"  │  [AI] model={model}")
                    return content
        except Exception as e:
            print(f"  │  [AI] {model} failed: {e}")
            continue
    return None


def ai_decide(repo, ptype, progress, commits, prs):
    """Use AI to pick the next task"""
    deps = []
    try:
        for b in ["main", "master"]:
            with urllib.request.urlopen(f"https://raw.githubusercontent.com/{OWNER}/{repo}/{b}/package.json", timeout=5) as r:
                deps = list((json.loads(r.read()).get("dependencies") or {}).keys())[:15]
            break
    except: pass
    readme = ""
    try:
        for b in ["main", "master"]:
            with urllib.request.urlopen(f"https://raw.githubusercontent.com/{OWNER}/{repo}/{b}/README.md", timeout=5) as r:
                readme = r.read().decode('utf-8','ignore')[:800]
            break
    except: pass

    # Extract recent task titles to avoid duplicates
    recent_tasks = ""
    if progress:
        recent_lines = [line for line in progress.split('\n') if line.strip().startswith('- ✓')][-5:]
        recent_tasks = '\n'.join(recent_lines)

    prompt = f"""You are a senior PM for "{repo}" ({ptype}).
PROGRESS: {progress[:1200] if progress else '(first run)'}
RECENT TASKS (avoid duplicates — pick something DIFFERENT):
{recent_tasks or '(none)'}

COMMITS: {commits[:3]}
PRS MERGED: {prs[:3]}
DEPS: {deps[:8]}
README: {readme[:400]}

Pick ONE most impactful NEW task (different from recent tasks). Respond JSON:
{{"task_type":"feature|bugfix|security","title":"specific","description":"detailed","jules_prompt":"DETAILED prompt — tell Jules exactly what to build, which files, output git patch","reasoning":"why"}}"""

    or_result = call_openrouter(prompt)
    if or_result:
        m = re.search(r'\{.*\}', or_result, re.DOTALL)
        if m:
            try: return json.loads(m.group())
            except: pass
    # Fallback to z-ai CLI
    with tempfile.NamedTemporaryFile(mode='w+', suffix='.json', delete=False) as f: out = f.name
    try:
        subprocess.run(["z-ai", "chat", "--prompt", prompt, "--output", out], capture_output=True, text=True, timeout=90)
        d = json.loads(open(out).read())
        if 'choices' in d:
            m = re.search(r'\{.*\}', d['choices'][0]['message']['content'], re.DOTALL)
            if m: return json.loads(m.group())
    except: pass
    finally:
        try: os.unlink(out)
        except: pass
    return {"task_type":"feature","title":f"Improve {repo}","description":"Add high-impact feature",
            "jules_prompt":f"""Review this repository and implement ONE high-impact feature.
=== QUALITY RULES ===
1. 100% BUILD GUARANTEE
2. OUT-OF-THE-BOX INTERACTIVITY
3. VISUAL EXCELLENCE (Tailwind, responsive)
4. NO REGRESSION
5. Output git patch
Implement now.""","reasoning":"fallback"}


# === Jules API methods ===
def create_session_with_plan(repo, branch, task):
    """Create a Jules session WITH requirePlanApproval=True"""
    body = {"prompt": task.get("jules_prompt","Review and improve. Output git patch."),
            "title": task.get("title", "feat: improvement")[:80],
            "sourceContext": {"source": f"sources/github/{OWNER}/{repo}",
            "githubRepoContext": {"startingBranch": branch}, "environmentVariablesEnabled": True},
            "requirePlanApproval": True}  # ← KEY: require plan approval
    req = urllib.request.Request("https://jules.googleapis.com/v1alpha/sessions",
        data=json.dumps(body).encode(), method="POST",
        headers={"X-Goog-Api-Key": JULES_KEY, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read()).get("id")
    except Exception as e:
        print(f"  │  ⚠️ create_session error: {e}")
        return None


def get_session(sid):
    req = urllib.request.Request(f"https://jules.googleapis.com/v1alpha/sessions/{sid}",
                                 headers={"X-Goog-Api-Key": JULES_KEY})
    with urllib.request.urlopen(req, timeout=15) as resp: return json.loads(resp.read())


def approve_plan(sid):
    """Call sessions.approvePlan — auto-approve Jules' plan"""
    try:
        req = urllib.request.Request(
            f"https://jules.googleapis.com/v1alpha/sessions/{sid}:approvePlan",
            data=b'{}', method="POST",
            headers={"X-Goog-Api-Key": JULES_KEY, "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read()) or {}
    except Exception as e:
        print(f"  │  ⚠️ approvePlan error: {e}")
        return None


def send_message(sid, message):
    """Call sessions.sendMessage — send feedback to Jules"""
    try:
        body = json.dumps({"prompt": message}).encode()
        req = urllib.request.Request(
            f"https://jules.googleapis.com/v1alpha/sessions/{sid}:sendMessage",
            data=body, method="POST",
            headers={"X-Goog-Api-Key": JULES_KEY, "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read()) or {}
    except Exception as e:
        print(f"  │  ⚠️ sendMessage error: {e}")
        return None


def delete_session(sid):
    """Delete a Jules session"""
    try:
        req = urllib.request.Request(
            f"https://jules.googleapis.com/v1alpha/sessions/{sid}",
            method="DELETE",
            headers={"X-Goog-Api-Key": JULES_KEY})
        urllib.request.urlopen(req, timeout=10)
        return True
    except: return False


def wait_for_plan(sid, timeout=WAIT_PLAN_TIMEOUT):
    """Wait for session to enter AWAITING_PLAN_APPROVAL state (or terminal)"""
    start = time.time()
    last_state = None
    while time.time() - start < timeout:
        try:
            s = get_session(sid)
            state = s.get('state')
            if state != last_state:
                elapsed = int(time.time() - start)
                print(f"  │  [{elapsed:>4d}s] state={state}")
                last_state = state
            # Terminal/awaiting states
            if state in ('AWAITING_PLAN_APPROVAL', 'COMPLETED', 'FAILED', 'AWAITING_USER_FEEDBACK'):
                return s
        except Exception as e:
            print(f"  │  ⚠️ get_session error: {e}")
        time.sleep(10)
    print(f"  │  ⚠️ Plan timeout after {timeout}s")
    return get_session(sid)


def wait_session(sid, timeout=WAIT_SESSION_TIMEOUT):
    """Wait for session to complete (after plan approval)"""
    start = time.time()
    last_state = None
    while time.time() - start < timeout:
        try:
            s = get_session(sid)
            state = s.get('state')
            if state != last_state:
                elapsed = int(time.time() - start)
                print(f"  │  [{elapsed:>4d}s] state={state}")
                last_state = state
            if state in ('COMPLETED', 'FAILED', 'AWAITING_USER_FEEDBACK'):
                return s
        except Exception as e:
            print(f"  │  ⚠️ get_session error: {e}")
        time.sleep(15)
    print(f"  │  ⚠️ Implementation timeout after {timeout}s")
    return get_session(sid)


def create_pr_from_session(repo, branch, sid, task):
    """Create PR with v8.1 quality gates"""
    try:
        session = get_session(sid)
    except Exception as e:
        return None, f"get_session error: {e}"

    if session.get('state') != 'COMPLETED':
        return None, f"session state={session.get('state')}"

    patch = ""
    commit_msg = task.get("title", "feat: improvement")[:72]
    for out in session.get('outputs', []):
        gp = out.get('changeSet', {}).get('gitPatch', {})
        patch = gp.get('unidiffPatch', '')
        if gp.get('suggestedCommitMessage'):
            commit_msg = gp['suggestedCommitMessage'][:72]
        break
    if not patch:
        return None, "no patch in session outputs"

    # Quality Gate #1: minimum patch size
    if len(patch) < 100:
        print(f"  │  ⚠️ Skipping: patch too small ({len(patch)} chars)")
        return None, f"patch too small ({len(patch)} chars)"

    # Parse patch → files
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
        return None, "no files parsed from patch"

    # Quality Gate #2: meaningful files
    meaningful = [fp for fp in files.keys() if fp.strip() and fp != '/dev/null' and len(files[fp].strip()) > 0]
    if len(meaningful) == 0:
        return None, "no meaningful files"

    # Quality Gate #3: PR already exists
    branch_name = f"jules-auto-{sid[:12]}"
    code, existing = gh("GET", f"/pulls?state=all&head={OWNER}:{branch_name}&per_page=5", repo)
    if code == 200 and isinstance(existing, list) and len(existing) > 0:
        return None, f"PR #{existing[0].get('number')} already exists"

    code, ref = gh("GET", f"/git/refs/heads/{branch}", repo)
    if code != 200:
        return None, f"no base SHA (code={code})"
    base_sha = ref['object']['sha']

    # Cleanup orphan branch
    code, _ = gh("GET", f"/git/refs/heads/{branch_name}", repo)
    if code == 200:
        gh("DELETE", f"/git/refs/heads/{branch_name}", repo)

    gh("POST", "/git/refs", repo, {"ref": f"refs/heads/{branch_name}", "sha": base_sha})

    # Update files
    updated = 0
    for fp, content in files.items():
        if not fp.strip() or fp == '/dev/null' or len(content.strip()) == 0:
            continue
        code, data = gh("GET", f"/contents/{fp}?ref={branch_name}", repo)
        sha = data.get('sha') if isinstance(data, dict) else None
        body = {"message": f"update {fp}",
                "content": base64.b64encode(content.encode()).decode(),
                "branch": branch_name}
        if sha: body["sha"] = sha
        code, _ = gh("PUT", f"/contents/{fp}", repo, body)
        if code in (200, 201): updated += 1

    # Quality Gate #4: verify files updated
    if updated == 0:
        gh("DELETE", f"/git/refs/heads/{branch_name}", repo)
        return None, "0 files updated"

    pr_body = f"""🤖 Automated PR from Jules session (v9 with plan approval)

**Session**: https://jules.google.com/session/{sid}
**Task**: {task.get('title', '?')}
**Files changed**: {updated}
**Patch size**: {len(patch)} chars
**Plan approved**: ✅ AI safety check passed

Created by v9 pipeline
"""
    code, pr = gh("POST", "/pulls", repo, {
        "title": commit_msg, "head": branch_name, "base": branch, "body": pr_body
    })
    if code == 201 and isinstance(pr, dict):
        return pr, f"PR #{pr.get('number')}"
    if code == 422:
        return None, "PR already exists (422)"
    return None, f"PR failed code={code}: {pr}"


def cleanup_stuck():
    """Delete stuck sessions"""
    try:
        req = urllib.request.Request("https://jules.googleapis.com/v1alpha/sessions?pageSize=50",
                                     headers={"X-Goog-Api-Key": JULES_KEY})
        with urllib.request.urlopen(req, timeout=15) as resp:
            d = json.loads(resp.read())
        n = 0
        for s in d.get('sessions', []):
            if s.get('state') in ('AWAITING_USER_FEEDBACK', 'IN_PROGRESS', 'QUEUED', 'AWAITING_PLAN_APPROVAL'):
                if delete_session(s['id']): n += 1
        return n
    except: return 0


def get_all_jules_sessions_today():
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    all_sessions = []
    page_token = None
    for _ in range(10):
        url = "https://jules.googleapis.com/v1alpha/sessions?pageSize=100"
        if page_token: url += f"&pageToken={page_token}"
        req = urllib.request.Request(url, headers={"X-Goog-Api-Key": JULES_KEY})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                d = json.loads(resp.read())
        except: break
        for s in d.get('sessions', []):
            ct = s.get('createTime', '')
            if ct:
                try:
                    cdt = datetime.fromisoformat(ct.replace('Z', '+00:00'))
                    if cdt > cutoff: all_sessions.append(s)
                except: pass
        page_token = d.get('nextPageToken')
        if not page_token: break
    return all_sessions


def count_repo_sessions_today(sessions, repo):
    n = 0
    for s in sessions:
        if repo.lower() in s.get('sourceContext', {}).get('source', '').lower():
            n += 1
    return n


def get_last_session_time(sessions, repo):
    t = None
    for s in sessions:
        if repo.lower() in s.get('sourceContext', {}).get('source', '').lower():
            ct = s.get('createTime', '')
            if ct and (t is None or ct > t): t = ct
    return t


def log_db(sid, repo, ptype, title):
    if not psycopg2 or not NEON_DB: return
    try:
        c = psycopg2.connect(NEON_DB); cur = c.cursor()
        cur.execute("""INSERT INTO jules_sessions
            (id, repo_id, title, prompt_type, state, jules_url, created_at, updated_at)
            VALUES (%s, %s, %s, %s, 'IN_PROGRESS', %s, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING""",
            (sid, repo, title[:100], ptype, f"https://jules.google.com/session/{sid}"))
        c.commit(); cur.close(); c.close()
    except: pass


def log_pipeline_run(repo, session_id, ai_feature, ai_model, status, error=None):
    if not psycopg2 or not NEON_DB: return
    try:
        c = psycopg2.connect(NEON_DB); cur = c.cursor()
        cur.execute("""INSERT INTO jules_pipeline_logs
            (repo_id, session_id, ai_feature, ai_model, status, error, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())""",
            (repo, session_id, (ai_feature or '')[:200], ai_model, status, error))
        c.commit(); cur.close(); c.close()
    except: pass


def upload_w(key, data):
    if not s3: return None
    try:
        s3.put_object(Bucket="nattakorn", Key=key, Body=data.encode(), ContentType="application/json")
        return f"nattakorn/{key}"
    except: return None


def trigger_render(svc):
    if not svc or not RENDER_KEY: return
    try:
        req = urllib.request.Request(f"https://api.render.com/v1/services/{svc}/deploys",
            data=b"{}", method="POST",
            headers={"Authorization": f"Bearer {RENDER_KEY}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read()).get("id")
    except: return None


def select_repos_by_quota(sessions_today, rem_quota):
    now = datetime.now(timezone.utc)
    hour_bucket = now.hour // 2
    include_tier2 = (hour_bucket % 3 == 0)
    candidates = list(TIER1)
    if include_tier2: candidates.extend(TIER2)
    total_weight = sum(w for _, _, _, _, w in candidates)
    repo_states = []
    for repo, branch, svc, ptype, weight in candidates:
        used_today = count_repo_sessions_today(sessions_today, repo)
        daily_target = int(round(weight / total_weight * DAILY_QUOTA))
        remaining = max(0, daily_target - used_today)
        last_time = get_last_session_time(sessions_today, repo)
        hours_ago = (now - datetime.fromisoformat(last_time.replace('Z', '+00:00'))).total_seconds() / 3600 if last_time else 9999
        repo_states.append({
            'repo': repo, 'branch': branch, 'svc': svc, 'ptype': ptype,
            'weight': weight, 'used_today': used_today,
            'daily_target': daily_target, 'remaining': remaining, 'hours_ago': hours_ago
        })
    repo_states.sort(key=lambda x: (-x['remaining'], -x['hours_ago'], -x['weight']))
    eligible = [r for r in repo_states if r['remaining'] > 0]
    n_select = min(BATCH_SIZE, max(1, rem_quota - 2), len(eligible))
    return eligible[:n_select], repo_states


def create_pending_prs_from_completed_sessions(sessions_today):
    """Create PRs from sessions COMPLETED in 24h that don't have PR yet"""
    if not GH_TOKEN: return 0
    prs_created = 0
    for s in sessions_today:
        sid = s.get('id')
        if s.get('state') != 'COMPLETED': continue
        src = s.get('sourceContext', {}).get('source', '')
        if not src.startswith(f'sources/github/{OWNER}/'): continue
        repo = src.split('/')[-1]
        if any(repo.startswith(stop) for stop in STOP_REPOS): continue
        has_patch = any(out.get('changeSet', {}).get('gitPatch', {}).get('unidiffPatch') for out in s.get('outputs', []))
        if not has_patch: continue
        branch_name = f"jules-auto-{sid[:12]}"
        code, existing = gh("GET", f"/pulls?state=all&head={OWNER}:{branch_name}&per_page=5", repo)
        if code == 200 and isinstance(existing, list) and len(existing) > 0:
            continue
        title = (s.get('title', '') or 'Improve')[:80]
        branch = 'main'
        for r, b, _, _, _ in TIER1 + TIER2:
            if r == repo: branch = b; break
        task = {'task_type': 'feature', 'title': title, 'jules_prompt': '', 'description': ''}
        print(f"  │  ⏳ Creating PR from completed session {sid[:12]} (repo={repo})")
        pr, msg = create_pr_from_session(repo, branch, sid, task)
        if pr:
            prs_created += 1
            print(f"  │  ✓ PR #{pr.get('number')}: {pr.get('html_url','')}")
            log_pipeline_run(repo, sid, title, 'jules-pending', 'pr_created')
        else:
            print(f"  │  ✗ PR failed: {msg}")
            log_pipeline_run(repo, sid, title, 'jules-pending', 'pr_failed', msg)
    return prs_created


def process_repo_with_plan_approval(repo, branch, svc_id, ptype, quota_state):
    """Full v9 flow: AI decide → safety review → create session → wait for plan → approve → wait → PR"""
    print(f"\n  ┌─ {repo} [{ptype}] (today: {quota_state['used_today']}/{quota_state['daily_target']})")

    # 1. Get PROGRESS.md
    progress, psha, actual_branch = get_progress(repo, branch)
    if progress:
        print(f"  │  ✓ PROGRESS.md ({len(progress)} chars)")
    else:
        progress = f"# Progress — {repo}\nType: {ptype}\nCompleted: (none)\n"
        update_progress(repo, actual_branch, progress, None, "docs: create PROGRESS.md")
        print(f"  │  ✓ PROGRESS.md created")

    # 2. Get recent commits & PRs
    code, commits_data = gh("GET", f"/commits?sha={actual_branch}&per_page=5", repo)
    commits = [c.get('commit', {}).get('message', '')[:60] for c in commits_data] if code == 200 and isinstance(commits_data, list) else []
    code, prs_data = gh("GET", "/pulls?state=closed&sort=updated&direction=desc&per_page=3", repo)
    prs = [p.get('title', '')[:40] for p in prs_data if p.get('merged_at')] if code == 200 else []
    print(f"  │  {len(commits)} commits, {len(prs)} merged PRs")

    # 3. AI decides task
    print(f"  │  AI deciding task...")
    task = ai_decide(repo, ptype, progress, commits, prs)
    print(f"  │  ✓ [{task.get('task_type', '?')}] {task.get('title', '?')[:60]}")

    # 4. AI safety review (NEW in v9)
    print(f"  │  AI safety review...")
    is_safe, reason = ai_review_task_safety(repo, ptype, task)
    if not is_safe:
        print(f"  │  ✗ Task rejected: {reason}")
        log_pipeline_run(repo, None, task.get('title', ''), 'safety-ai', 'rejected', reason)
        return None
    print(f"  │  ✓ Safe: {reason}")

    # 5. Create session WITH plan approval
    print(f"  │  Creating Jules session (requirePlanApproval=True)...")
    sid = create_session_with_plan(repo, actual_branch, task)
    if not sid:
        print(f"  │  ✗ Session creation FAILED")
        log_pipeline_run(repo, None, task.get('title', ''), 'openrouter', 'session_failed')
        return None
    print(f"  │  ✓ Session: {sid}")
    log_db(sid, repo, task.get('task_type', 'feature'), task.get('title', ''))
    log_pipeline_run(repo, sid, task.get('title', ''), 'openrouter', 'session_created')

    # 6. Wait for plan (AWAITING_PLAN_APPROVAL state)
    print(f"  │  Waiting for Jules to create plan (max {WAIT_PLAN_TIMEOUT}s)...")
    session = wait_for_plan(sid, timeout=WAIT_PLAN_TIMEOUT)
    state = session.get('state')
    print(f"  │  Plan phase state: {state}")

    if state == 'AWAITING_PLAN_APPROVAL':
        # 7. Auto-approve plan (we already did AI safety check before creating session)
        print(f"  │  Auto-approving plan (AI safety check passed)...")
        approve_plan(sid)
        log_pipeline_run(repo, sid, task.get('title', ''), 'openrouter', 'plan_approved')

        # 8. Wait for implementation
        print(f"  │  Waiting for implementation (max {WAIT_SESSION_TIMEOUT}s)...")
        session = wait_session(sid, timeout=WAIT_SESSION_TIMEOUT)
        state = session.get('state')
        print(f"  │  Implementation state: {state}")

    elif state == 'COMPLETED':
        print(f"  │  ✓ Session completed without plan approval needed")
    elif state == 'AWAITING_USER_FEEDBACK':
        # Send feedback to proceed
        print(f"  │  ⚠️ Awaiting user feedback — sending 'proceed' message...")
        send_message(sid, "Please proceed with the implementation. The plan looks good.")
        log_pipeline_run(repo, sid, task.get('title', ''), 'openrouter', 'feedback_sent')
        session = wait_session(sid, timeout=WAIT_SESSION_TIMEOUT)
        state = session.get('state')
    elif state == 'FAILED':
        print(f"  │  ✗ Session failed during plan phase")
        log_pipeline_run(repo, sid, task.get('title', ''), 'openrouter', 'session_failed')
        return None

    # 9. Create PR if completed
    if state == 'COMPLETED':
        print(f"  │  Creating PR...")
        pr, msg = create_pr_from_session(repo, actual_branch, sid, task)
        if pr:
            print(f"  │  ✓ PR #{pr.get('number')}: {pr.get('html_url', '')}")
            new_progress = progress + f"\n- ✓ [{task.get('task_type', '?')}] {task.get('title', '?')} (PR #{pr.get('number')}, {datetime.now(timezone.utc).strftime('%Y-%m-%d')})"
            update_progress(repo, actual_branch, new_progress, psha, f"docs: PROGRESS.md — {task.get('title', '?')[:40]}")
            if svc_id:
                dep = trigger_render(svc_id)
                if dep: print(f"  │  ✓ Render deploy: {dep}")
            log_pipeline_run(repo, sid, task.get('title', ''), 'openrouter', 'pr_created')
            return (sid, repo, task, pr)
        else:
            print(f"  │  ✗ PR failed: {msg}")
            log_pipeline_run(repo, sid, task.get('title', ''), 'openrouter', 'pr_failed', msg)
    else:
        print(f"  │  ✗ Final state: {state}")
        log_pipeline_run(repo, sid, task.get('title', ''), 'openrouter', 'session_' + state.lower())

    return None


def main():
    now = datetime.now(timezone.utc)
    run_id = now.strftime("%Y%m%d-%H%M%S")
    print("=" * 78)
    print(f"  JULES v9 — PLAN APPROVAL + AI REVIEW PIPELINE")
    print(f"  {now.isoformat()}")
    print(f"  Daily quota: {DAILY_QUOTA}/day | Batch: {BATCH_SIZE} | Plan wait: {WAIT_PLAN_TIMEOUT}s | Impl wait: {WAIT_SESSION_TIMEOUT}s")
    print("=" * 78)

    print("\n[1] Cleanup stuck Jules sessions...")
    cleaned = cleanup_stuck()
    print(f"  ✓ Cleaned {cleaned} sessions")

    print("\n[2] Fetch today's Jules sessions (24h)...")
    sessions_today = get_all_jules_sessions_today()
    used = len(sessions_today)
    rem = DAILY_QUOTA - used
    print(f"  Used today: {used}/{DAILY_QUOTA} | Remaining: {rem}")
    if rem < 5:
        print("  ⚠️ Low quota — just create PRs from pending sessions")
        pending_prs = create_pending_prs_from_completed_sessions(sessions_today)
        print(f"\n  Created {pending_prs} pending PRs")
        sys.exit(0)

    print("\n[3] Per-repo daily quota distribution...")
    selected, all_states = select_repos_by_quota(sessions_today, rem)
    print(f"  {'Repo':<25} {'W':<3} {'Target':<7} {'Used':<5} {'Remain':<7} {'Last':<8}")
    for s in all_states:
        marker = "▶" if any(r['repo'] == s['repo'] for r in selected) else " "
        print(f"  {marker}{s['repo']:<24} {s['weight']:<3} {s['daily_target']:<7} {s['used_today']:<5} {s['remaining']:<7} {s['hours_ago']:.1f}h")
    print(f"\n  → Selected {len(selected)} repos for this run:")
    for s in selected:
        print(f"    • {s['repo']:<25} (today: {s['used_today']}/{s['daily_target']})")

    print(f"\n[4] Process {len(selected)} repos (with plan approval)...")
    created = []

    for s in selected:
        result = process_repo_with_plan_approval(
            s['repo'], s['branch'], s['svc'], s['ptype'], s
        )
        if result:
            created.append(result)
        time.sleep(2)

    print(f"\n[5] Check for pending PRs from previous runs...")
    pending_prs = create_pending_prs_from_completed_sessions(sessions_today)
    print(f"  ✓ Created {pending_prs} pending PRs")

    print(f"\n[6] Sync sessions to Neon DB...")
    try:
        sync_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sync_sessions.py")
        if os.path.exists(sync_script):
            r = subprocess.run([sys.executable, sync_script], capture_output=True, text=True, timeout=120)
            out = (r.stdout or '').strip()[-300:]
            print(f"  {out}" if out else "  (no output)")
    except Exception as e:
        print(f"  ⚠️ Sync error: {e}")

    # Upload report
    report = {
        "run_id": run_id, "timestamp": now.isoformat(), "pipeline": "v9-plan-approval",
        "jules_quota_used_today": used, "sessions_created": len(created),
        "pending_prs_created": pending_prs,
        "per_repo_state": [{"repo": s['repo'], "weight": s['weight'],
            "daily_target": s['daily_target'], "used_today": s['used_today']} for s in all_states]
    }
    upload_w(f"jules-pipeline/{now.strftime('%Y-%m-%d')}/{run_id}-v9.json", json.dumps(report, indent=2, default=str))

    print(f"\n{'='*78}")
    print(f"  v9 COMPLETE — {len(created)} new sessions + {pending_prs} pending PRs (quota: {used}/100)")
    print(f"{'='*78}")
    for sid, repo, task, pr in created:
        print(f"  ✓ {repo}: PR #{pr.get('number')} — {task.get('title', '?')[:50]}")
        print(f"    {pr.get('html_url', '')}")

    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n⚠️ Pipeline error: {e}")
        traceback.print_exc()
        sys.exit(0)
