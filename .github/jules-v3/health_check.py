#!/usr/bin/env python3
"""
health_check.py — Check Render production URLs every 5 minutes
================================================================
Saves results to Neon DB jules_health_checks table.

Scheduled via GitHub Actions cron every 5 minutes.
"""
import os, sys, json, urllib.request, time, psycopg2
from datetime import datetime, timezone

NEON_DB = os.environ.get("NEON_DATABASE_URL", "")

URLS = {
    'SVEO': 'https://sveo-814d.onrender.com/',
    'Magsevo': 'https://magsevo.onrender.com/',
    'omni-flow': 'https://omni-flow.onrender.com/',
}

def check_url(url, timeout=15):
    """Check URL and return (status, http_code, response_time_ms, error)"""
    start = time.time()
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Jules-HealthCheck/1.0'})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed_ms = int((time.time() - start) * 1000)
            return 'healthy', resp.status, elapsed_ms, None
    except urllib.error.HTTPError as e:
        elapsed_ms = int((time.time() - start) * 1000)
        return 'unhealthy', e.code, elapsed_ms, str(e)
    except urllib.error.URLError as e:
        elapsed_ms = int((time.time() - start) * 1000)
        return 'down', None, elapsed_ms, str(e.reason)
    except Exception as e:
        elapsed_ms = int((time.time() - start) * 1000)
        return 'down', None, elapsed_ms, str(e)

def main():
    if not NEON_DB:
        print("NEON_DATABASE_URL not set")
        sys.exit(0)

    print(f"=== Health Check {datetime.now(timezone.utc).isoformat()} ===")
    
    try:
        conn = psycopg2.connect(NEON_DB)
        cur = conn.cursor()
    except Exception as e:
        print(f"Neon connect error: {e}")
        sys.exit(0)

    for name, url in URLS.items():
        status, http_code, rt_ms, error = check_url(url)
        print(f"  {name:<15} {status:<12} HTTP {http_code or '?'} {rt_ms}ms")
        
        # Insert into DB
        try:
            cur.execute("""
                INSERT INTO jules_health_checks 
                (repo_id, status, http_status, response_time_ms, error_message, checked_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                ON CONFLICT DO NOTHING
            """, (name, status, http_code, rt_ms, error))
            
            # Update repos table
            cur.execute("""
                UPDATE jules_repos 
                SET health_status = %s, last_health_check_at = NOW()
                WHERE id = %s
            """, (status, name))
        except Exception as e:
            print(f"    DB error: {e}")

    conn.commit()
    cur.close()
    conn.close()
    print("✓ Done")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(0)
