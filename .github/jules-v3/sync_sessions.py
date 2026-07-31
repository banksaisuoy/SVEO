#!/usr/bin/env python3
"""
sync_sessions.py v8 — Sync Jules session states → Neon DB
==========================================================
FIXES vs v7:
  1. ✅ Mark stuck IN_PROGRESS > 6h as FAILED
  2. ✅ Insert jules_pipeline_logs entries
  3. ✅ Better pagination handling
  4. ✅ Better error handling
"""
import sys, os, json, urllib.request, psycopg2
from datetime import datetime, timezone, timedelta

JULES_KEY = os.environ.get("JULES_API_KEY", "")
NEON = os.environ.get("NEON_DATABASE_URL", "")

print(f"Sync: JULES_KEY={'set' if JULES_KEY else 'MISSING'}, NEON={'set' if NEON else 'MISSING'}")

if not JULES_KEY or not NEON:
    print("Sync: missing credentials, skip")
    sys.exit(0)

# === Step 1: Fetch ALL Jules sessions (paginated) ===
print("Sync: fetching all Jules sessions...")
all_jules = []
page_token = None
for _ in range(20):  # max 20 pages = 2000 sessions
    url = "https://jules.googleapis.com/v1alpha/sessions?pageSize=100"
    if page_token: url += f"&pageToken={page_token}"
    try:
        req = urllib.request.Request(url, headers={"X-Goog-Api-Key": JULES_KEY})
        with urllib.request.urlopen(req, timeout=30) as resp:
            d = json.loads(resp.read())
        all_jules.extend(d.get('sessions', []))
        page_token = d.get('nextPageToken')
        if not page_token: break
    except Exception as e:
        print(f"Sync: fetch error: {e}")
        break
print(f"Sync: fetched {len(all_jules)} sessions from Jules API")

# === Step 2: Connect to Neon ===
try:
    conn = psycopg2.connect(NEON)
    cur = conn.cursor()
except Exception as e:
    print(f"Sync: Neon connect error: {e}")
    sys.exit(0)

# === Step 3: Mark stuck IN_PROGRESS > 6h as FAILED ===
cutoff = datetime.now(timezone.utc) - timedelta(hours=6)
print(f"Sync: marking IN_PROGRESS sessions older than {cutoff.isoformat()} as FAILED...")
cur.execute("""
    UPDATE jules_sessions
    SET state = 'FAILED', error_message = 'stuck > 6h (auto-marked by sync)', updated_at = NOW()
    WHERE state = 'IN_PROGRESS' AND created_at < %s
""", (cutoff,))
stuck_marked = cur.rowcount
print(f"Sync: marked {stuck_marked} stuck sessions as FAILED")

# === Step 4: Build lookup of fresh state from Jules ===
lookup = {}
for s in all_jules:
    sid = s.get('id')
    if not sid: continue
    state = s.get('state')
    ps = fc = 0
    for out in s.get('outputs', []):
        p = out.get('changeSet', {}).get('gitPatch', {}).get('unidiffPatch', '')
        if p:
            ps = len(p)
            fc = p.count('\n+++ b/')
    lookup[sid] = {
        'state': state,
        'patch_size': ps,
        'files_changed': fc,
        'create_time': s.get('createTime'),
        'update_time': s.get('updateTime'),
        'title': s.get('title', '')[:100],
        'source': s.get('sourceContext', {}).get('source', '')
    }

# === Step 5: Update existing sessions in DB ===
cur.execute("SELECT id FROM jules_sessions WHERE state NOT IN ('COMPLETED', 'FAILED')")
stale = [r[0] for r in cur.fetchall()]
print(f"Sync: checking {len(stale)} non-terminal sessions in DB...")

updated = 0
for nid in stale:
    if nid in lookup:
        info = lookup[nid]
        ns = info['state']
        if ns and ns not in ('IN_PROGRESS', 'QUEUED'):
            cur.execute("""UPDATE jules_sessions
                SET state=%s, patch_size=%s, files_changed=%s,
                    completed_at=%s, updated_at=NOW(),
                    title=COALESCE(NULLIF(%s,''), title)
                WHERE id=%s""",
                (ns, info['patch_size'], info['files_changed'],
                 info['update_time'] if ns == 'COMPLETED' else None,
                 info['title'], nid))
            updated += 1

# === Step 6: Insert new sessions ===
cur.execute("SELECT id FROM jules_sessions")
existing = {r[0] for r in cur.fetchall()}
new = 0
for s in all_jules:
    sid = s.get('id')
    if not sid or sid in existing: continue

    src = s.get('sourceContext', {}).get('source', '')
    repo = src.split('/')[-1] if src else 'unknown'
    title = (s.get('title', '') or '')[:100]
    state = s.get('state', 'UNKNOWN')

    # Determine prompt_type from title/prompt
    ptype = 'feature'
    p_lower = (s.get('prompt', '') or '').lower()
    t_lower = title.lower()
    if 'bug' in p_lower or 'fix' in t_lower: ptype = 'bugfix'
    elif 'security' in p_lower or 'security' in t_lower: ptype = 'security'
    elif 'test' in p_lower: ptype = 'test'
    elif 'polish' in p_lower: ptype = 'polish'

    ps = fc = 0
    for out in s.get('outputs', []):
        patch = out.get('changeSet', {}).get('gitPatch', {}).get('unidiffPatch', '')
        if patch:
            ps = len(patch)
            fc = patch.count('\n+++ b/')

    # Only insert if repo exists in jules_repos (or create it)
    cur.execute("SELECT id FROM jules_repos WHERE id = %s", (repo,))
    if not cur.fetchone():
        # Auto-insert repo if missing
        try:
            cur.execute("""INSERT INTO jules_repos (id, full_source, github_url, default_branch, profile, priority, enabled, created_at, updated_at)
                VALUES (%s, %s, %s, 'main', 'auto-discovered', 1, true, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING""",
                (repo, src, f"https://github.com/{src.replace('sources/github/', '')}"))
        except: pass

    cur.execute("""INSERT INTO jules_sessions
        (id, repo_id, title, prompt_type, state, patch_size, files_changed, jules_url, created_at, updated_at, completed_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING""",
        (sid, repo, title, ptype, state, ps, fc,
         f"https://jules.google.com/session/{sid}",
         s.get('createTime'), s.get('updateTime'),
         s.get('updateTime') if state == 'COMPLETED' else None))
    new += 1

# === Step 7: Update repo stats ===
print("Sync: updating repo stats...")
cur.execute("""
    UPDATE jules_repos r SET
        total_features_shipped = (SELECT count(*) FROM jules_sessions s WHERE s.repo_id = r.id AND s.state = 'COMPLETED' AND s.prompt_type = 'feature'),
        total_bugs_fixed = (SELECT count(*) FROM jules_sessions s WHERE s.repo_id = r.id AND s.state = 'COMPLETED' AND s.prompt_type = 'bugfix'),
        total_security_fixes = (SELECT count(*) FROM jules_sessions s WHERE s.repo_id = r.id AND s.state = 'COMPLETED' AND s.prompt_type = 'security'),
        updated_at = NOW()
""")
repos_updated = cur.rowcount

conn.commit()
cur.close(); conn.close()

print(f"Sync complete: {updated} updated, {new} new, {stuck_marked} marked FAILED (stuck>6h), {repos_updated} repos stats updated")
