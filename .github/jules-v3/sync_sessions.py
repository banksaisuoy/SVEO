#!/usr/bin/env python3
"""Sync Jules session states → Neon DB (run before pipeline)"""
import sys, os, json, urllib.request, psycopg2
sys.path.insert(0, '/home/z/.local/lib/python3.13/site-packages')

JULES_KEY = os.environ.get("JULES_API_KEY", "")
NEON = os.environ.get("NEON_DATABASE_URL", "")

# Get all Jules sessions
all_jules = []
page_token = None
for _ in range(10):
    url = "https://jules.googleapis.com/v1alpha/sessions?pageSize=100"
    if page_token: url += f"&pageToken={page_token}"
    req = urllib.request.Request(url, headers={"X-Goog-Api-Key": JULES_KEY})
    with urllib.request.urlopen(req, timeout=15) as resp:
        d = json.loads(resp.read())
    all_jules.extend(d.get('sessions', []))
    page_token = d.get('nextPageToken')
    if not page_token: break

conn = psycopg2.connect(NEON)
cur = conn.cursor()

# Update stale
cur.execute("SELECT id FROM jules_sessions WHERE state != 'COMPLETED' AND state != 'FAILED'")
stale = [r[0] for r in cur.fetchall()]

lookup = {}
for s in all_jules:
    sid = s.get('id')
    state = s.get('state')
    ps = fc = 0
    for out in s.get('outputs', []):
        p = out.get('changeSet', {}).get('gitPatch', {}).get('unidiffPatch', '')
        if p: ps = len(p); fc = p.count('\n+++ b/')
    lookup[sid] = {'state': state, 'ps': ps, 'fc': fc, 'ca': s.get('updateTime') if state == 'COMPLETED' else None}

updated = 0
for nid in stale:
    if nid in lookup:
        info = lookup[nid]
        ns = info['state']
        if ns and ns not in ('IN_PROGRESS', 'QUEUED'):
            cur.execute("UPDATE jules_sessions SET state=%s, patch_size=%s, files_changed=%s, completed_at=%s, updated_at=NOW() WHERE id=%s",
                (ns, info['ps'], info['fc'], info['ca'], nid))
            updated += 1

# Insert new
cur.execute("SELECT id FROM jules_sessions")
existing = {r[0] for r in cur.fetchall()}
new = 0
for s in all_jules:
    sid = s.get('id')
    if sid not in existing:
        repo = s.get('sourceContext', {}).get('source', '').split('/')[-1]
        title = (s.get('title', '') or '')[:100]
        state = s.get('state', 'UNKNOWN')
        ptype = 'feature'
        p = (s.get('prompt', '') or '').lower()
        if 'bug' in p or 'fix' in (s.get('title','') or '').lower(): ptype = 'bugfix'
        elif 'security' in p: ptype = 'security'
        elif 'test' in p: ptype = 'test'
        elif 'polish' in p: ptype = 'polish'
        ps = fc = 0
        for out in s.get('outputs', []):
            patch = out.get('changeSet', {}).get('gitPatch', {}).get('unidiffPatch', '')
            if patch: ps = len(patch); fc = patch.count('\n+++ b/')
        cur.execute("SELECT id FROM jules_repos WHERE id = %s", (repo,))
        if cur.fetchone():
            cur.execute("INSERT INTO jules_sessions (id,repo_id,title,prompt_type,state,patch_size,files_changed,jules_url,created_at,updated_at,completed_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING",
                (sid, repo, title, ptype, state, ps, fc, f"https://jules.google.com/session/{sid}", s.get('createTime'), s.get('updateTime'), s.get('updateTime') if state == 'COMPLETED' else None))
            new += 1

conn.commit()
cur.close(); conn.close()
print(f"Sync: {updated} updated, {new} new")
