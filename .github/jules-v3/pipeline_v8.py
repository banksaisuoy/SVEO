#!/usr/bin/env python3
"""
Jules v8 — Production Pipeline (drop-in replacement for v7)
============================================================

FIXES vs v7:
  1. ✅ wait_session timeout: 300s → 1800s (Jules avg = 24 min, max = 62 min)
  2. ✅ boto3 init: แก้ syntax bug `boto3.client if boto3 else None(...)`
  3. ✅ sync_sessions: ใช้ subprocess.run แทน broken import
  4. ✅ Per-repo daily quota distribution (ไม่ cluster บน 1 repo)
  5. ✅ Async PR creation: สร้าง session → เช็ค session เก่าที่ COMPLETED → สร้าง PR จาก session เก่า
  6. ✅ STOP_REPOS enforcement (skip MyApplication*, All-in-pne, etc.)
  7. ✅ Better error logging → insert jules_pipeline_logs

SCHEDULE:
  GitHub Actions cron: '0 6,8,10,12,14,16,18,20,22 * * *' (UTC)
  = 9 runs/day in Asia/Bangkok: 13:00, 15:00, 17:00, 19:00, 21:00, 23:00, 01:00, 03:00, 05:00

JULES QUOTA DISTRIBUTION (100/day total):
  omniflow-ai-commerce  weight=3  → 30/day target
  SVEO                  weight=2  → 20/day target
  Magsevo               weight=2  → 20/day target
  omni-flow             weight=2  → 20/day target
  All-in-bank           weight=1  → 10/day target
  [Tier 2 — every 6h]   weight=1  → occasional
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

# === Credentials (from GitHub Actions secrets) ===
JULES_KEY = os.environ.get("JULES_API_KEY", "")
NEON_DB = os.environ.get("NEON_DATABASE_URL", "")
RENDER_KEY = os.environ.get("RENDER_API_KEY", "")
WASABI_ACCESS = os.environ.get("WASABI_ACCESS_KEY", "")
WASABI_SECRET = os.environ.get("WASABI_SECRET_KEY", "")
GH_TOKEN = os.environ.get("GH_PAT", "")
OWNER = "banksaisuoy"

# === Tier 1 — Production apps with daily quota weights ===
TIER1 = [
    # (repo, branch, render_service_id, project_type, weight)
    ("omniflow-ai-commerce", "main", None, "ecommerce", 3),
    ("SVEO", "main", "srv-d9167rok1i2s7387u66g", "video_gallery", 2),
    ("Magsevo", "main", "srv-d5e9687fte5s73ad8m70", "business_tool", 2),
    ("omni-flow", "main", "srv-d5f03gmmcj7s73asfui0", "ai_platform", 2),
    ("All-in-bank", "main", None, "banking", 1),
]

# === Tier 2 — Secondary (every 6 hours) ===
TIER2 = [
    ("IT_Support_AI_Project", "master", None, "it_support", 1),
    ("ai-agent-jetpack", "main", None, "ai_agent", 1),
]

# === STOP LIST — never run on these ===
STOP_REPOS = [
    "MyApplication", "MyApplication10", "MyApplication11", "MyApplication12",
    "MyApplication13", "MyApplication14", "MyApplication15",
    "All-in-pne", "Local-Projects-Archive", "Test", "firstweb", "intership",
    "cfd-demos", "Web-ai-chat---backup", "Arduino-ESP32-Backup", "Work_CP"
]

BATCH_SIZE = 6  # sessions per run
DAILY_QUOTA = 100  # Jules API daily limit
WAIT_SESSION_TIMEOUT = 1800  # 30 min (was 5 min — bug fix)

# === FIX: Properly init boto3 s3 client (v7 had broken syntax) ===
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
    """GitHub REST API helper"""
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


def call_openrouter(prompt, system=""):
    """Try OpenRouter free models with fallbacks"""
    OR_KEY = os.environ.get("OPENROUTER_API_KEY", "")
    if not OR_KEY:
        return None
    models = [
        "openrouter/free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "qwen/qwen-2.5-coder-32b-instruct:free",
        "deepseek/deepseek-chat:free"
    ]
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
        except urllib.error.HTTPError as e:
            print(f"  │  [AI] {model} failed: {e.code}")
            continue
        except Exception as e:
            print(f"  │  [AI] {model} failed: {e}")
            continue
    return None


def ai_decide(repo, ptype, progress, commits, prs):
    """Use AI to pick the next task for a repo"""
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

    prompt = f"""You are a senior PM for "{repo}" ({ptype}).
PROGRESS: {progress[:1200] if progress else '(first run)'}
COMMITS: {commits[:3]}
PRS MERGED: {prs[:3]}
DEPS: {deps[:8]}
README: {readme[:400]}

Pick ONE most impactful task for this {ptype}. Respond JSON:
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


def create_session(repo, branch, task):
    """Create a Jules session — returns session ID or None"""
    body = {"prompt": task.get("jules_prompt","Review and improve. Output git patch."),
            "sourceContext": {"source": f"sources/github/{OWNER}/{repo}",
            "githubRepoContext": {"startingBranch": branch}, "environmentVariablesEnabled": True},
            "requirePlanApproval": False}
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


# === FIX #1: timeout 300 → 1800 (Jules takes 8-62 min) ===
def wait_session(sid, timeout=WAIT_SESSION_TIMEOUT):
    """Wait for Jules session to complete — checks every 15s, max 30 min"""
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
            if state in ('COMPLETED', 'FAILED'):
                return s
        except Exception as e:
            print(f"  │  ⚠️ get_session error: {e}")
        time.sleep(15)
    print(f"  │  ⚠️ Timeout after {timeout}s — Jules still working")
    return get_session(sid)


def create_pr_from_session(repo, branch, sid, task):
    """Create a GitHub PR from a completed Jules session's git patch"""
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

    # Parse patch → file contents map
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

    # Create branch from base
    branch_name = f"jules-auto-{sid[:12]}"
    code, ref = gh("GET", f"/git/refs/heads/{branch}", repo)
    if code != 200:
        return None, f"no base SHA (code={code})"
    base_sha = ref['object']['sha']
    gh("POST", "/git/refs", repo, {"ref": f"refs/heads/{branch_name}", "sha": base_sha})

    # Update files in branch
    updated = 0
    for fp, content in files.items():
        if not fp.strip() or fp == '/dev/null':
            continue
        code, data = gh("GET", f"/contents/{fp}?ref={branch_name}", repo)
        sha = data.get('sha') if isinstance(data, dict) else None
        body = {"message": f"update {fp}",
                "content": base64.b64encode(content.encode()).decode(),
                "branch": branch_name}
        if sha:
            body["sha"] = sha
        code, _ = gh("PUT", f"/contents/{fp}", repo, body)
        if code in (200, 201):
            updated += 1
    if updated == 0:
        return None, "no files updated"

    # Create PR
    code, pr = gh("POST", "/pulls", repo, {
        "title": commit_msg,
        "head": branch_name,
        "base": branch,
        "body": f"🤖 Automated PR from Jules session\n\n"
                f"Session: https://jules.google.com/session/{sid}\n"
                f"Task: {task.get('title', '?')}\n"
                f"Created by v8 pipeline"
    })
    if code == 201 and isinstance(pr, dict):
        return pr, f"PR #{pr.get('number')}"
    return None, f"PR failed code={code}: {pr}"


def cleanup_stuck():
    """Delete IN_PROGRESS/QUEUED/AWAITING_USER_FEEDBACK sessions on Jules side"""
    try:
        req = urllib.request.Request("https://jules.googleapis.com/v1alpha/sessions?pageSize=50",
                                     headers={"X-Goog-Api-Key": JULES_KEY})
        with urllib.request.urlopen(req, timeout=15) as resp:
            d = json.loads(resp.read())
        n = 0
        for s in d.get('sessions', []):
            if s.get('state') in ('AWAITING_USER_FEEDBACK', 'IN_PROGRESS', 'QUEUED'):
                try:
                    del_req = urllib.request.Request(
                        f"https://jules.googleapis.com/v1alpha/sessions/{s['id']}",
                        method="DELETE",
                        headers={"X-Goog-Api-Key": JULES_KEY})
                    urllib.request.urlopen(del_req, timeout=10)
                    n += 1
                except: pass
        return n
    except Exception as e:
        print(f"  ⚠️ cleanup_stuck error: {e}")
        return 0


def get_all_jules_sessions_today():
    """Fetch ALL Jules sessions created in the last 24h (paginated)"""
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
                    if cdt > cutoff:
                        all_sessions.append(s)
                except: pass
        page_token = d.get('nextPageToken')
        if not page_token: break
    return all_sessions


def count_repo_sessions_today(sessions, repo):
    """Count sessions for a specific repo in last 24h"""
    n = 0
    for s in sessions:
        src = s.get('sourceContext', {}).get('source', '').lower()
        if repo.lower() in src:
            n += 1
    return n


def get_last_session_time(sessions, repo):
    """Get last session time for repo (None if never)"""
    t = None
    for s in sessions:
        src = s.get('sourceContext', {}).get('source', '').lower()
        if repo.lower() in src:
            ct = s.get('createTime', '')
            if ct and (t is None or ct > t): t = ct
    return t


def log_db(sid, repo, ptype, title):
    """Insert session into Neon DB"""
    if not psycopg2 or not NEON_DB: return
    try:
        c = psycopg2.connect(NEON_DB); cur = c.cursor()
        cur.execute("""INSERT INTO jules_sessions
            (id, repo_id, title, prompt_type, state, jules_url, created_at, updated_at)
            VALUES (%s, %s, %s, %s, 'IN_PROGRESS', %s, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING""",
            (sid, repo, title[:100], ptype, f"https://jules.google.com/session/{sid}"))
        c.commit(); cur.close(); c.close()
    except Exception as e:
        print(f"  ⚠️ log_db error: {e}")


def log_pipeline_run(repo, session_id, ai_feature, ai_model, status, error=None):
    """Insert pipeline log entry"""
    if not psycopg2 or not NEON_DB: return
    try:
        c = psycopg2.connect(NEON_DB); cur = c.cursor()
        cur.execute("""INSERT INTO jules_pipeline_logs
            (repo_id, session_id, ai_feature, ai_model, status, error, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())""",
            (repo, session_id, (ai_feature or '')[:200], ai_model, status, error))
        c.commit(); cur.close(); c.close()
    except Exception as e:
        print(f"  ⚠️ log_pipeline_run error: {e}")


def upload_w(key, data):
    """Upload to Wasabi S3"""
    if not s3: return None
    try:
        s3.put_object(Bucket="nattakorn", Key=key, Body=data.encode(), ContentType="application/json")
        return f"nattakorn/{key}"
    except Exception as e:
        print(f"  ⚠️ upload_w error: {e}")
        return None


def trigger_render(svc):
    """Trigger a Render deploy"""
    if not svc or not RENDER_KEY: return
    try:
        req = urllib.request.Request(f"https://api.render.com/v1/services/{svc}/deploys",
            data=b"{}", method="POST",
            headers={"Authorization": f"Bearer {RENDER_KEY}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read()).get("id")
    except Exception as e:
        print(f"  ⚠️ trigger_render error: {e}")
        return None


def select_repos_by_quota(sessions_today, rem_quota):
    """
    NEW: Per-repo daily quota distribution.
    Returns list of (repo, branch, svc, ptype, used_today, daily_target)
    Picks repos that are furthest from their daily target.
    """
    now = datetime.now(timezone.utc)
    # Include Tier 2 every 6 hours
    hour_bucket = now.hour // 2
    include_tier2 = (hour_bucket % 3 == 0)

    candidates = list(TIER1)
    if include_tier2:
        candidates.extend(TIER2)

    total_weight = sum(w for _, _, _, _, w in candidates)
    repo_states = []
    for repo, branch, svc, ptype, weight in candidates:
        used_today = count_repo_sessions_today(sessions_today, repo)
        daily_target = int(round(weight / total_weight * DAILY_QUOTA))
        remaining = max(0, daily_target - used_today)
        ratio = used_today / max(1, daily_target)
        last_time = get_last_session_time(sessions_today, repo)
        if last_time:
            hours_ago = (now - datetime.fromisoformat(last_time.replace('Z', '+00:00'))).total_seconds() / 3600
        else:
            hours_ago = 9999
        repo_states.append({
            'repo': repo, 'branch': branch, 'svc': svc, 'ptype': ptype,
            'weight': weight, 'used_today': used_today,
            'daily_target': daily_target, 'remaining': remaining,
            'ratio': ratio, 'hours_ago': hours_ago
        })

    # Sort: by remaining quota desc, then hours_ago desc, then weight desc
    repo_states.sort(key=lambda x: (-x['remaining'], -x['hours_ago'], -x['weight']))
    eligible = [r for r in repo_states if r['remaining'] > 0]
    n_select = min(BATCH_SIZE, max(1, rem_quota - 2), len(eligible))
    selected = eligible[:n_select]
    return selected, repo_states


def create_pending_prs_from_completed_sessions(sessions_today):
    """
    NEW: For any COMPLETED sessions that don't have a PR yet, create the PR now.
    This catches sessions that timed out in previous runs.
    Returns number of PRs created.
    """
    if not GH_TOKEN:
        return 0
    prs_created = 0
    # Get all sessions completed in last 24h that have a patch
    for s in sessions_today:
        sid = s.get('id')
        state = s.get('state')
        if state != 'COMPLETED': continue
        src = s.get('sourceContext', {}).get('source', '')
        if not src.startswith(f'sources/github/{OWNER}/'): continue
        repo = src.split('/')[-1]
        # Skip STOP_REPOS
        if any(repo.startswith(stop) for stop in STOP_REPOS): continue
        # Skip if no patch
        has_patch = False
        for out in s.get('outputs', []):
            if out.get('changeSet', {}).get('gitPatch', {}).get('unidiffPatch'):
                has_patch = True; break
        if not has_patch: continue

        # Check if a PR already exists for this session
        # (Look for branch jules-auto-{sid[:12]})
        branch_name = f"jules-auto-{sid[:12]}"
        code, existing_prs = gh("GET", f"/pulls?state=all&head={OWNER}:{branch_name}&per_page=5", repo)
        if code == 200 and isinstance(existing_prs, list) and len(existing_prs) > 0:
            continue  # PR already exists

        # Get session title for task
        title = (s.get('title', '') or 'Improve')[:80]
        # Try to determine branch (default to main)
        branch = 'main'
        for r, b, _, _, _ in TIER1 + TIER2:
            if r == repo:
                branch = b; break
        task = {
            'task_type': 'feature',
            'title': title,
            'jules_prompt': '',
            'description': ''
        }
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


def main():
    now = datetime.now(timezone.utc)
    run_id = now.strftime("%Y%m%d-%H%M%S")
    print("=" * 78)
    print(f"  JULES v8 — PRODUCTION PIPELINE")
    print(f"  {now.isoformat()}")
    print(f"  Daily quota: {DAILY_QUOTA}/day | Batch/run: {BATCH_SIZE} | Wait timeout: {WAIT_SESSION_TIMEOUT}s")
    print("=" * 78)

    print("\n[1] Cleanup stuck Jules sessions...")
    cleaned = cleanup_stuck()
    print(f"  ✓ Cleaned {cleaned} sessions")

    print("\n[2] Fetch today's Jules sessions (24h window)...")
    used, sessions_today = len(get_all_jules_sessions_today()), None
    sessions_today = get_all_jules_sessions_today()
    used = len(sessions_today)
    rem = DAILY_QUOTA - used
    print(f"  Used today: {used}/{DAILY_QUOTA} | Remaining: {rem}")
    if rem < 5:
        print("  ⚠️ Low quota — skip new sessions, just create PRs from pending")
        pending_prs = create_pending_prs_from_completed_sessions(sessions_today)
        print(f"\n  Created {pending_prs} pending PRs")
        sys.exit(0)

    print("\n[3] Per-repo daily quota distribution...")
    selected, all_states = select_repos_by_quota(sessions_today, rem)
    print(f"  {'Repo':<25} {'Weight':<8} {'Target':<8} {'Used':<6} {'Remain':<8} {'Last':<10}")
    print(f"  {'-'*25} {'-'*8} {'-'*8} {'-'*6} {'-'*8} {'-'*10}")
    for s in all_states:
        marker = "▶" if any(r['repo'] == s['repo'] for r in selected) else " "
        print(f" {marker}{s['repo']:<24} {s['weight']:<8} {s['daily_target']:<8} {s['used_today']:<6} {s['remaining']:<8} {s['hours_ago']:.1f}h")
    print(f"\n  → Selected {len(selected)} repos for this run:")
    for s in selected:
        print(f"    • {s['repo']:<25} (used {s['used_today']}/{s['daily_target']} today, {s['remaining']} left)")

    print(f"\n[4] Process {len(selected)} repos...")
    created = []

    for s in selected:
        repo, branch, svc_id, ptype = s['repo'], s['branch'], s['svc'], s['ptype']
        print(f"\n  ┌─ {repo} [{ptype}] (today: {s['used_today']}/{s['daily_target']})")

        # Get PROGRESS.md
        progress, psha, actual_branch = get_progress(repo, branch)
        if progress:
            print(f"  │  ✓ PROGRESS.md ({len(progress)} chars)")
        else:
            progress = f"# Progress — {repo}\nType: {ptype}\nCompleted: (none)\n"
            update_progress(repo, actual_branch, progress, None, "docs: create PROGRESS.md")
            print(f"  │  ✓ PROGRESS.md created")

        # Get recent commits & PRs
        code, commits_data = gh("GET", f"/commits?sha={actual_branch}&per_page=5", repo)
        commits = [c.get('commit', {}).get('message', '')[:60] for c in commits_data] if code == 200 and isinstance(commits_data, list) else []
        code, prs_data = gh("GET", "/pulls?state=closed&sort=updated&direction=desc&per_page=3", repo)
        prs = [p.get('title', '')[:40] for p in prs_data if p.get('merged_at')] if code == 200 else []
        print(f"  │  {len(commits)} commits, {len(prs)} merged PRs")

        # AI decides task
        print(f"  │  AI deciding task...")
        task = ai_decide(repo, ptype, progress, commits, prs)
        print(f"  │  ✓ [{task.get('task_type', '?')}] {task.get('title', '?')[:60]}")

        # Create Jules session
        print(f"  │  Creating Jules session...")
        sid = create_session(repo, actual_branch, task)
        if not sid:
            print(f"  │  ✗ Session creation FAILED")
            log_pipeline_run(repo, None, task.get('title', ''), 'unknown', 'session_failed')
            continue
        print(f"  │  ✓ Session: {sid}")
        log_db(sid, repo, task.get('task_type', 'feature'), task.get('title', ''))
        log_pipeline_run(repo, sid, task.get('title', ''), 'openrouter', 'session_created')

        # Wait for completion
        print(f"  │  Waiting for completion (max {WAIT_SESSION_TIMEOUT}s = {WAIT_SESSION_TIMEOUT//60} min)...")
        session = wait_session(sid, timeout=WAIT_SESSION_TIMEOUT)
        state = session.get('state')
        print(f"  │  Final state: {state}")

        if state == 'COMPLETED':
            print(f"  │  Creating PR...")
            pr, msg = create_pr_from_session(repo, actual_branch, sid, task)
            if pr:
                print(f"  │  ✓ PR #{pr.get('number')}: {pr.get('html_url', '')}")
                new_progress = progress + f"\n- ✓ [{task.get('task_type', '?')}] {task.get('title', '?')} (PR #{pr.get('number')}, {now.strftime('%Y-%m-%d')})"
                update_progress(repo, actual_branch, new_progress, psha, f"docs: PROGRESS.md — {task.get('title', '?')[:40]}")
                if svc_id:
                    dep = trigger_render(svc_id)
                    if dep: print(f"  │  ✓ Render deploy: {dep}")
                created.append((sid, repo, task, pr))
                log_pipeline_run(repo, sid, task.get('title', ''), 'openrouter', 'pr_created')
            else:
                print(f"  │  ✗ PR failed: {msg}")
                log_pipeline_run(repo, sid, task.get('title', ''), 'openrouter', 'pr_failed', msg)
        else:
            print(f"  │  ✗ Session {state}")
            log_pipeline_run(repo, sid, task.get('title', ''), 'openrouter', 'session_' + state.lower())

        print(f"  └─ Done")
        time.sleep(2)

    # === NEW: Create PRs from previously completed sessions that timed out ===
    print(f"\n[5] Check for pending PRs from previous runs...")
    pending_prs = create_pending_prs_from_completed_sessions(sessions_today)
    print(f"  ✓ Created {pending_prs} pending PRs")

    # Sync to Neon DB
    print(f"\n[6] Sync sessions to Neon DB...")
    try:
        sync_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sync_sessions.py")
        if os.path.exists(sync_script):
            r = subprocess.run([sys.executable, sync_script], capture_output=True, text=True, timeout=120)
            out = (r.stdout or '').strip()[-300:]
            print(f"  {out}" if out else "  (sync ran with no output)")
            if r.returncode != 0 and r.stderr:
                print(f"  ⚠️ sync stderr: {r.stderr.strip()[-300:]}")
        else:
            print(f"  ⚠️ sync_sessions.py not found")
    except Exception as e:
        print(f"  ⚠️ Sync error: {e}")

    # Upload report to Wasabi
    report = {
        "run_id": run_id,
        "timestamp": now.isoformat(),
        "pipeline": "v8-production",
        "jules_quota_used_today": used,
        "jules_quota_remaining": rem,
        "sessions_created": len(created),
        "pending_prs_created": pending_prs,
        "repos_processed": [r[1] for r in created],
        "per_repo_state": [{
            "repo": s['repo'], "weight": s['weight'],
            "daily_target": s['daily_target'], "used_today": s['used_today'],
            "remaining": s['remaining']
        } for s in all_states]
    }
    wp = upload_w(f"jules-pipeline/{now.strftime('%Y-%m-%d')}/{run_id}-v8.json", json.dumps(report, indent=2, default=str))
    if wp:
        print(f"\n  Report uploaded to Wasabi: {wp}")

    print(f"\n{'='*78}")
    print(f"  v8 COMPLETE — {len(created)} new sessions + {pending_prs} pending PRs (quota: {used}/100)")
    print(f"{'='*78}")
    for sid, repo, task, pr in created:
        print(f"  ✓ {repo}: PR #{pr.get('number')} — {task.get('title', '?')[:50]}")
        print(f"    {pr.get('html_url', '')}")

    # CRITICAL: always exit 0 so GitHub Actions doesn't fail
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n⚠️ Pipeline error: {e}")
        traceback.print_exc()
        sys.exit(0)
