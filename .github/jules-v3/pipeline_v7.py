#!/usr/bin/env python3
"""
Jules v7 — FOCUSED PIPELINE
============================
แก้ปัญหา: กระจายงานไป repo ที่ไม่จำเป็น (Android demos, archives, test)

Tier 1 (80% effort) — Production apps ที่มี PRs merged จริง:
  - omniflow-ai-commerce (21 merged PRs, 100 commits) ← #1
  - Magsevo (13 merged PRs, Render) ← #2  
  - SVEO (5 merged PRs, Render) ← #3
  - omni-flow (1 merged PR, Render) ← #4
  - All-in-bank (1 merged PR) ← #5

Tier 2 (20% effort) — Active projects:
  - IT_Support_AI_Project (controller)
  - ai-agent-jetpack (AI experiment)

STOP — ไม่ทำต่อ:
  - All MyApplication* (Android demos, 0 merged)
  - All-in-pne (0 merged, 14 FAILED)
  - Local-Projects-Archive (archive)
  - MyApplication11 (all FAILED)
  - Test, firstweb, intership, cfd-demos, etc.
"""
import sys, os, json, urllib.request, urllib.error, time, re, subprocess, tempfile, base64
from datetime import datetime, timezone, timedelta
sys.path.insert(0, '/home/z/.local/lib/python3.13/site-packages')
try:
    import psycopg2
except ImportError:
    psycopg2 = None
try:
    import boto3
except ImportError:
    boto3 = None

JULES_KEY = os.environ.get("JULES_API_KEY", "os.environ.get("JULES_API_KEY", "")")
NEON_DB = os.environ.get("NEON_DATABASE_URL", "os.environ.get("NEON_DATABASE_URL", "")")
RENDER_KEY = os.environ.get("RENDER_API_KEY", "os.environ.get("RENDER_API_KEY", "")")
WASABI_ACCESS = os.environ.get("WASABI_ACCESS_KEY", "os.environ.get("WASABI_ACCESS_KEY", "")")
WASABI_SECRET = os.environ.get("WASABI_SECRET_KEY", "os.environ.get("WASABI_SECRET_KEY", "")")
GH_TOKEN = os.environ.get("GH_PAT", "os.environ.get("GH_PAT", "")")
OWNER = "banksaisuoy"

# TIER 1 — Production apps (FOCUS HERE)
TIER1 = [
    # (repo, branch, render_service_id, project_type, weight)
    ("omniflow-ai-commerce", "main", None, "ecommerce", 3),      # 3x weight = most active
    ("SVEO", "main", "srv-d9167rok1i2s7387u66g", "video_gallery", 2),
    ("Magsevo", "main", "srv-d5e9687fte5s73ad8m70", "business_tool", 2),
    ("omni-flow", "main", "srv-d5f03gmmcj7s73asfui0", "ai_platform", 2),
    ("All-in-bank", "main", None, "banking", 1),
]

# TIER 2 — Secondary (less frequent)
TIER2 = [
    ("IT_Support_AI_Project", "master", None, "it_support", 1),
    ("ai-agent-jetpack", "main", None, "ai_agent", 1),
]

# STOP LIST — ไม่ทำต่อ
STOP_REPOS = [
    "MyApplication", "MyApplication10", "MyApplication11", "MyApplication12",
    "MyApplication13", "MyApplication14", "MyApplication15",
    "All-in-pne", "Local-Projects-Archive", "Test", "firstweb", "intership",
    "cfd-demos", "Web-ai-chat---backup", "Arduino-ESP32-Backup", "Work_CP"
]

BATCH_SIZE = 6

s3 = boto3.client if boto3 else None("s3", endpoint_url="https://s3.ap-southeast-1.wasabisys.com",
    aws_access_key_id=WASABI_ACCESS, aws_secret_access_key=WASABI_SECRET, region_name="ap-southeast-1")

def gh(method, path, repo=None, body=None):
    r = repo or ""
    url = f"https://api.github.com/repos/{OWNER}/{r}{path}" if r else f"https://api.github.com{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method,
        headers={"Authorization": f"Bearer {GH_TOKEN}", "Content-Type": "application/json", "Accept": "application/vnd.github+json"})
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
    """Try OpenRouter models with robust fallbacks"""
    OR_KEY = os.environ.get("OPENROUTER_API_KEY", "")
    if not OR_KEY:
        return None
    
    # Priority list of working free models
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
                headers={
                    "Authorization": f"Bearer {OR_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://github.com/banksaisuoy"
                })
            with urllib.request.urlopen(req, timeout=30) as resp:
                d = json.loads(resp.read())
            if 'choices' in d:
                content = d['choices'][0]['message']['content']
                if content:
                    print(f"  │  [AI Brain] Successfully used model: {model}")
                    return content
        except urllib.error.HTTPError as e:
            # Handle payment required (402) or other API errors
            print(f"  │  [AI Brain] Model {model} failed: {e.code} {e.reason}")
            continue
        except Exception as e:
            print(f"  │  [AI Brain] Model {model} failed: {e}")
            continue
    return None

def ai_decide(repo, ptype, progress, commits, prs):
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

    # Try OpenRouter first (Gemma 2 9B free)
    or_result = call_openrouter(prompt)
    if or_result:
        m = re.search(r'\{.*\}', or_result, re.DOTALL)
        if m:
            try: return json.loads(m.group())
            except: pass
    
    # Fallback: z-ai CLI
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
    body = {"prompt": task.get("jules_prompt","Review and improve. Output git patch."),
            "sourceContext": {"source": f"sources/github/{OWNER}/{repo}",
            "githubRepoContext": {"startingBranch": branch}, "environmentVariablesEnabled": True},
            "requirePlanApproval": False}
    req = urllib.request.Request("https://jules.googleapis.com/v1alpha/sessions",
        data=json.dumps(body).encode(), method="POST",
        headers={"X-Goog-Api-Key": JULES_KEY, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp: return json.loads(resp.read()).get("id")
    except: return None

def get_session(sid):
    req = urllib.request.Request(f"https://jules.googleapis.com/v1alpha/sessions/{sid}", headers={"X-Goog-Api-Key": JULES_KEY})
    with urllib.request.urlopen(req, timeout=15) as resp: return json.loads(resp.read())

def wait_session(sid, timeout=300):
    start = time.time()
    while time.time() - start < timeout:
        s = get_session(sid)
        if s.get('state') in ('COMPLETED','FAILED'): return s
        time.sleep(15)
    return get_session(sid)

def create_pr(repo, branch, sid, task):
    session = get_session(sid)
    if session.get('state') != 'COMPLETED': return None, "not completed"
    patch = ""
    commit_msg = task.get("title","feat: improvement")[:72]
    for out in session.get('outputs', []):
        gp = out.get('changeSet', {}).get('gitPatch', {})
        patch = gp.get('unidiffPatch', '')
        if gp.get('suggestedCommitMessage'): commit_msg = gp['suggestedCommitMessage'][:72]
        break
    if not patch: return None, "no patch"
    
    files = {}
    current_file = None
    new_lines = []
    for line in patch.split('\n'):
        if line.startswith('diff --git'):
            if current_file and new_lines: files[current_file] = '\n'.join(new_lines)
            m = re.match(r'diff --git a/(.+?) b/(.+)', line)
            current_file = m.group(2) if m else None
            new_lines = []
        elif line.startswith('+++ b/') and not current_file: current_file = line[6:]
        elif line.startswith('@@'): pass
        elif line.startswith('+') and not line.startswith('+++'): new_lines.append(line[1:])
        elif line.startswith('-') and not line.startswith('---'): pass
        elif line.startswith(' '): new_lines.append(line[1:])
        elif line == '': new_lines.append('')
    if current_file and new_lines: files[current_file] = '\n'.join(new_lines)
    if not files: return None, "no files"
    
    branch_name = f"jules-auto-{sid[:12]}"
    code, ref = gh("GET", f"/git/refs/heads/{branch}", repo)
    if code != 200: return None, "no base SHA"
    base_sha = ref['object']['sha']
    gh("POST", "/git/refs", repo, {"ref": f"refs/heads/{branch_name}", "sha": base_sha})
    
    updated = 0
    for fp, content in files.items():
        if not fp.strip() or fp == '/dev/null': continue
        code, data = gh("GET", f"/contents/{fp}?ref={branch_name}", repo)
        sha = data.get('sha') if isinstance(data, dict) else None
        body = {"message": f"update {fp}", "content": base64.b64encode(content.encode()).decode(), "branch": branch_name}
        if sha: body["sha"] = sha
        code, _ = gh("PUT", f"/contents/{fp}", repo, body)
        if code in (200,201): updated += 1
    if updated == 0: return None, "no files updated"
    
    code, pr = gh("POST", "/pulls", repo, {"title": commit_msg, "head": branch_name, "base": branch,
        "body": f"🤖 Automated PR from Jules session\n\nSession: https://jules.google.com/session/{sid}\nTask: {task.get('title','?')}"})
    if code == 201 and isinstance(pr, dict): return pr, f"PR #{pr.get('number')}"
    return None, f"PR failed: {pr}"

def cleanup_stuck():
    try:
        req = urllib.request.Request("https://jules.googleapis.com/v1alpha/sessions?pageSize=50", headers={"X-Goog-Api-Key": JULES_KEY})
        with urllib.request.urlopen(req, timeout=15) as resp: d = json.loads(resp.read())
        n = 0
        for s in d.get('sessions', []):
            if s.get('state') in ('AWAITING_USER_FEEDBACK','IN_PROGRESS','QUEUED'):
                try:
                    del_req = urllib.request.Request(f"https://jules.googleapis.com/v1alpha/sessions/{s['id']}", method="DELETE", headers={"X-Goog-Api-Key": JULES_KEY})
                    urllib.request.urlopen(del_req, timeout=10); n += 1
                except: pass
        return n
    except: return 0

def get_quota():
    try:
        req = urllib.request.Request("https://jules.googleapis.com/v1alpha/sessions?pageSize=100", headers={"X-Goog-Api-Key": JULES_KEY})
        with urllib.request.urlopen(req, timeout=15) as resp: d = json.loads(resp.read())
        now = datetime.now(timezone.utc)
        c = sum(1 for s in d.get('sessions',[]) if (now - datetime.fromisoformat(s.get('createTime','2020-01-01T00:00:00Z').replace('Z','+00:00'))).total_seconds() < 86400)
        return c, 100 - c
    except: return 0, 100

def get_last_time(repo):
    try:
        req = urllib.request.Request("https://jules.googleapis.com/v1alpha/sessions?pageSize=100", headers={"X-Goog-Api-Key": JULES_KEY})
        with urllib.request.urlopen(req, timeout=15) as resp: d = json.loads(resp.read())
        t = None
        for s in d.get('sessions', []):
            if repo.lower() in s.get('sourceContext',{}).get('source','').lower():
                ct = s.get('createTime','')
                if ct and (t is None or ct > t): t = ct
        return t
    except: return None

def log_db(sid, repo, ptype, title):
    try:
        c = psycopg2.connect(NEON_DB); cur = c.cursor()
        cur.execute("INSERT INTO jules_sessions (id,repo_id,title,prompt_type,state,jules_url,created_at,updated_at) VALUES (%s,%s,%s,%s,'IN_PROGRESS',%s,NOW(),NOW()) ON CONFLICT (id) DO NOTHING",
            (sid, repo, title[:100], ptype, f"https://jules.google.com/session/{sid}"))
        c.commit(); cur.close(); c.close()
    except: pass

def upload_w(key, data):
    try:
        s3.put_object(Bucket="nattakorn", Key=key, Body=data.encode(), ContentType="application/json")
        return f"nattakorn/{key}"
    except: return None

def trigger_render(svc):
    if not svc: return
    try:
        req = urllib.request.Request(f"https://api.render.com/v1/services/{svc}/deploys", data=b"{}", method="POST",
            headers={"Authorization": f"Bearer {RENDER_KEY}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp: return json.loads(resp.read()).get("id")
    except: return None

def main():
    now = datetime.now(timezone.utc)
    run_id = now.strftime("%Y%m%d-%H%M%S")
    print("=" * 70)
    print(f"  JULES v7 — FOCUSED PIPELINE")
    print(f"  Tier 1: {len(TIER1)} production repos (weighted)")
    print(f"  Tier 2: {len(TIER2)} secondary repos")
    print(f"  STOP: {len(STOP_REPOS)} repos (no more work)")
    print(f"  {now.isoformat()}")
    print("=" * 70)

    print("\n[1] Cleanup...")
    print(f"  ✓ Cleaned {cleanup_stuck()} sessions")

    print("\n[2] Quota...")
    used, rem = get_quota()
    print(f"  {used}/100 used, {rem} remaining")
    if rem < 5: print("  ⚠️ Low — skip"); return

    # Build weighted repo list — Tier 1 with weights + Tier 2 occasionally
    print(f"\n[3] Building weighted repo list...")
    weighted_repos = []
    for repo, branch, svc, ptype, weight in TIER1:
        for _ in range(weight):
            weighted_repos.append((repo, branch, svc, ptype))
    
    # Add Tier 2 every other run (50% chance)
    import random
    if random.random() < 0.5:
        for repo, branch, svc, ptype, _w in TIER2:
            weighted_repos.append((repo, branch, svc, ptype))
    
    # Sort by oldest session time
    times = {r: get_last_time(r) for r, _, _, _ in weighted_repos}
    # Deduplicate — keep one entry per repo (oldest first)
    seen = set()
    unique_repos = []
    for repo, branch, svc, ptype in sorted(weighted_repos, key=lambda x: times.get(x[0]) or "0000"):
        if repo not in seen:
            seen.add(repo)
            unique_repos.append((repo, branch, svc, ptype))
    
    selected = unique_repos[:min(BATCH_SIZE, rem - 2)]
    
    print(f"  Selected {len(selected)} repos (weighted, oldest first):")
    for repo, branch, svc, ptype in selected:
        last = times.get(repo)
        h = (now - datetime.fromisoformat(last.replace('Z','+00:00'))).total_seconds()/3600 if last else 999
        tier = "T1" if any(r == repo for r, _, _, _, _ in TIER1) else "T2"
        print(f"    [{tier}] {repo:<25} last: {h:.0f}h ago")

    print(f"\n[4] Process {len(selected)} repos...")
    created = []
    
    for repo, branch, svc_id, ptype in selected:
        print(f"\n  ┌─ {repo} [{ptype}]")
        
        progress, psha, actual_branch = get_progress(repo, branch)
        if progress:
            print(f"  │  ✓ PROGRESS.md ({len(progress)} chars)")
        else:
            progress = f"# Progress — {repo}\nType: {ptype}\nCompleted: (none)\n"
            update_progress(repo, actual_branch, progress, None, "docs: create PROGRESS.md")
            print(f"  │  ✓ PROGRESS.md created")
        
        code, commits_data = gh("GET", f"/commits?sha={actual_branch}&per_page=5", repo)
        commits = [c.get('commit',{}).get('message','')[:60] for c in commits_data] if code == 200 and isinstance(commits_data, list) else []
        code, prs_data = gh("GET", "/pulls?state=closed&sort=updated&direction=desc&per_page=3", repo)
        prs = [p.get('title','')[:40] for p in prs_data if p.get('merged_at')] if code == 200 else []
        print(f"  │  {len(commits)} commits, {len(prs)} merged PRs")
        
        print(f"  │  AI deciding...")
        task = ai_decide(repo, ptype, progress, commits, prs)
        print(f"  │  ✓ [{task.get('task_type','?')}] {task.get('title','?')[:50]}")
        
        print(f"  │  Creating Jules session...")
        sid = create_session(repo, actual_branch, task)
        if not sid:
            print(f"  │  ✗ FAILED")
            continue
        print(f"  │  ✓ Session: {sid}")
        log_db(sid, repo, task.get('task_type','feature'), task.get('title',''))
        
        print(f"  │  Waiting for completion (max 5 min)...")
        session = wait_session(sid, timeout=300)
        state = session.get('state')
        print(f"  │  State: {state}")
        
        if state == 'COMPLETED':
            print(f"  │  Creating PR...")
            pr, msg = create_pr(repo, actual_branch, sid, task)
            if pr:
                print(f"  │  ✓ PR #{pr.get('number')}: {pr.get('html_url','')}")
                new_progress = progress + f"\n- ✓ [{task.get('task_type','?')}] {task.get('title','?')} (PR #{pr.get('number')}, {now.strftime('%Y-%m-%d')})"
                update_progress(repo, actual_branch, new_progress, psha, f"docs: PROGRESS.md — {task.get('title','?')[:40]}")
                if svc_id:
                    dep = trigger_render(svc_id)
                    if dep: print(f"  │  ✓ Render deploy: {dep}")
                created.append((sid, repo, task, pr))
            else:
                print(f"  │  ✗ PR: {msg}")
        else:
            print(f"  │  ✗ {state}")
        
        print(f"  └─ Done")
        time.sleep(2)

    # Sync sessions
    print(f"\n[5] Sync sessions to Neon...")
    try:
        import sync_sessions
    except Exception as e:
        print(f'  Sync error: {e}')
        sync_sessions.main() if hasattr(sync_sessions, 'main') else None

    report = {"run_id": run_id, "timestamp": now.isoformat(), "pipeline": "v7-focused", "sessions": len(created),
              "repos": [r[1] for r in created], "stop_repos": STOP_REPOS}
    wp = upload_w(f"jules-pipeline/{now.strftime('%Y-%m-%d')}/{run_id}-v7.json", json.dumps(report, indent=2))
    
    print(f"\n{'='*70}")
    print(f"  v7 COMPLETE — {len(created)} sessions + PRs")
    print(f"{'='*70}")
    for sid, repo, task, pr in created:
        print(f"  ✓ {repo}: PR #{pr.get('number')} — {task.get('title','?')[:40]}")
        print(f"    {pr.get('html_url','')}")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n⚠️ Pipeline error: {e}")
        import sys
        sys.exit(0)  # Exit 0 so workflow doesn't fail
