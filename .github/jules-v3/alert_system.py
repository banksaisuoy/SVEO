#!/usr/bin/env python3
"""Alert System — checks production health + failed sessions + stale PRs"""
import sys, os, json, urllib.request, urllib.error, time
from datetime import datetime, timezone
sys.path.insert(0, '/home/z/.local/lib/python3.13/site-packages')

JULES_KEY = os.environ.get("JULES_API_KEY", "")
RENDER_KEY = os.environ.get("RENDER_API_KEY", "")
GH_TOKEN = os.environ.get("GH_PAT", "")
NEON_DB = os.environ.get("NEON_DATABASE_URL", "")

def check_health():
    alerts = []
    for name, url in [("SVEO","https://sveo-814d.onrender.com"),("Magsevo","https://magsevo.onrender.com"),("omni-flow","https://omni-flow.onrender.com")]:
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=15) as resp:
                if resp.status != 200: alerts.append(f"⚠️ {name}: HTTP {resp.status}")
        except: alerts.append(f"❌ {name}: DOWN")
    return alerts

def check_failed():
    try:
        req = urllib.request.Request("https://jules.googleapis.com/v1alpha/sessions?pageSize=20", headers={"X-Goog-Api-Key": JULES_KEY})
        with urllib.request.urlopen(req, timeout=15) as resp: d = json.loads(resp.read())
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return [f"❌ Jules FAILED: {s.get('sourceContext',{}).get('source','').split('/')[-1]}" for s in d.get('sessions',[]) if s.get('state')=='FAILED' and s.get('createTime','').startswith(today)]
    except: return []

def daily_report():
    try:
        import psycopg2
        conn = psycopg2.connect(NEON_DB)
        cur = conn.cursor()
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        cur.execute("SELECT COUNT(*) FROM jules_sessions WHERE created_at::date = %s", (today,))
        total = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM jules_sessions WHERE state='COMPLETED' AND created_at::date=%s", (today,))
        done = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM jules_sessions WHERE state='FAILED' AND created_at::date=%s", (today,))
        fail = cur.fetchone()[0]
        cur.execute("SELECT repo_id,title FROM jules_sessions WHERE created_at::date=%s ORDER BY created_at DESC LIMIT 10", (today,))
        recent = cur.fetchall()
        cur.close(); conn.close()
        r = f"📊 {today}: {total} sessions (✓{done} ✗{fail})\n"
        for repo,title in recent: r += f"  • {repo}: {title[:40]}\n"
        return r
    except Exception as e: return f"Report: {e}"

now = datetime.now(timezone.utc)
print(f"=== Alert System — {now.isoformat()} ===\n")
alerts = []
print("1. Production health...")
h = check_health()
alerts.extend(h)
for a in h: print(f"  {a}")
if not h: print("  ✓ All healthy")
print("\n2. Failed sessions...")
f = check_failed()
alerts.extend(f)
for a in f: print(f"  {a}")
if not f: print("  ✓ No failures")
print(f"\n3. Daily report:\n{daily_report()}")
if alerts: print(f"\n🚨 {len(alerts)} alerts!")
else: print("\n✅ All good!")
