"""
v10 Clients — external API wrappers with retry + circuit breaker
"""
import os, json, time, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta

JULES_KEY = os.environ.get("JULES_API_KEY", "")
GH_TOKEN = os.environ.get("GH_PAT", "")
OWNER = os.environ.get("GH_OWNER", "banksaisuoy")
OR_KEY = os.environ.get("OPENROUTER_API_KEY", "")
RENDER_KEY = os.environ.get("RENDER_API_KEY", "")


def _retry(fn, max_attempts=3, backoff=2):
    """Retry wrapper with exponential backoff."""
    last_err = None
    for attempt in range(max_attempts):
        try:
            return fn()
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code == 429:  # rate limit
                wait = backoff ** (attempt + 2)
                print(f"  [retry] 429 rate limited, waiting {wait}s")
                time.sleep(wait)
            elif e.code >= 500:  # server error
                wait = backoff ** attempt
                print(f"  [retry] {e.code}, waiting {wait}s")
                time.sleep(wait)
            else:
                raise  # client error, don't retry
        except Exception as e:
            last_err = e
            if attempt == max_attempts - 1:
                raise
            wait = backoff ** attempt
            print(f"  [retry] {type(e).__name__}: {e}, waiting {wait}s")
            time.sleep(wait)
    raise last_err


# === Jules API ===
class JulesClient:
    BASE = "https://jules.googleapis.com/v1alpha"

    def __init__(self, api_key=None):
        self.api_key = api_key or JULES_KEY

    def _req(self, method, path, body=None, timeout=30):
        url = f"{self.BASE}{path}"
        data = json.dumps(body).encode() if body else None
        req = urllib.request.Request(url, data=data, method=method,
            headers={"X-Goog-Api-Key": self.api_key, "Content-Type": "application/json"})
        return _retry(lambda: self._do_req(req, timeout))

    def _do_req(self, req, timeout):
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            return json.loads(body) if body else {}

    def list_sessions(self, page_size=100, page_token=None):
        url = f"/sessions?pageSize={page_size}"
        if page_token:
            url += f"&pageToken={page_token}"
        return self._req("GET", url)

    def get_session(self, sid):
        return self._req("GET", f"/sessions/{sid}")

    def create_session(self, prompt, repo, branch, title="", require_plan_approval=True):
        body = {
            "prompt": prompt,
            "title": title[:80] if title else "feat: improvement",
            "sourceContext": {
                "source": f"sources/github/{OWNER}/{repo}",
                "githubRepoContext": {"startingBranch": branch},
                "environmentVariablesEnabled": True
            },
            "requirePlanApproval": require_plan_approval
        }
        result = self._req("POST", "/sessions", body)
        return result.get("id")

    def approve_plan(self, sid):
        return self._req("POST", f"/sessions/{sid}:approvePlan", {})

    def send_message(self, sid, message):
        return self._req("POST", f"/sessions/{sid}:sendMessage", {"prompt": message})

    def delete_session(self, sid):
        try:
            self._req("DELETE", f"/sessions/{sid}")
            return True
        except:
            return False

    def archive_session(self, sid):
        try:
            self._req("POST", f"/sessions/{sid}:archive", {})
            return True
        except:
            return False

    def list_sources(self):
        return self._req("GET", "/sources")


# === GitHub API ===
class GitHubClient:
    BASE = "https://api.github.com"

    def __init__(self, token=None):
        self.token = token or GH_TOKEN

    def call(self, method, path, repo=None, body=None):
        r = repo or ""
        url = f"{self.BASE}/repos/{OWNER}/{r}{path}" if r else f"{self.BASE}{path}"
        data = json.dumps(body).encode() if body else None
        req = urllib.request.Request(url, data=data, method=method,
            headers={"Authorization": f"Bearer {self.token}",
                     "Content-Type": "application/json",
                     "Accept": "application/vnd.github+json"})
        try:
            return _retry(lambda: self._do(req))
        except urllib.error.HTTPError as e:
            try:
                err_body = json.loads(e.read())
            except:
                err_body = {}
            return e.code, err_body
        except Exception as e:
            return 0, {"error": str(e)}

    def _do(self, req):
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read()
            return resp.status, (json.loads(body) if body and resp.status != 204 else {})

    # === Convenience methods ===
    def get_progress_md(self, repo, branch):
        """Returns (content, sha, actual_branch)."""
        for b in [branch, "main", "master"]:
            code, data = self.call("GET", f"/contents/PROGRESS.md?ref={b}", repo)
            if code == 200 and isinstance(data, dict) and 'content' in data:
                import base64
                content = base64.b64decode(data['content']).decode('utf-8', 'ignore')
                return content, data.get('sha'), b
        return None, None, branch

    def update_progress_md(self, repo, branch, content, sha, msg):
        import base64
        body = {
            "message": msg,
            "content": base64.b64encode(content.encode()).decode(),
            "branch": branch
        }
        if sha:
            body["sha"] = sha
        code, _ = self.call("PUT", "/contents/PROGRESS.md", repo, body)
        return code in (200, 201)

    def get_recent_commits(self, repo, branch, n=5):
        code, data = self.call("GET", f"/commits?sha={branch}&per_page={n}", repo)
        if code == 200 and isinstance(data, list):
            return [c.get('commit', {}).get('message', '')[:60] for c in data]
        return []

    def get_merged_prs(self, repo, n=3):
        code, data = self.call("GET", f"/pulls?state=closed&sort=updated&direction=desc&per_page={n}", repo)
        if code == 200 and isinstance(data, list):
            return [p.get('title', '')[:40] for p in data if p.get('merged_at')]
        return []

    def get_pr(self, repo, pr_number):
        code, data = self.call("GET", f"/pulls/{pr_number}", repo)
        return data if code == 200 else None

    def get_pr_files(self, repo, pr_number):
        code, data = self.call("GET", f"/pulls/{pr_number}/files?per_page=100", repo)
        return data if code == 200 else []

    def comment_pr(self, repo, pr_number, body):
        code, _ = self.call("POST", f"/issues/{pr_number}/comments", repo, {"body": body})
        return code == 201

    def close_pr(self, repo, pr_number):
        code, _ = self.call("PATCH", f"/pulls/{pr_number}", repo, {"state": "closed"})
        return code == 200

    def create_pr(self, repo, branch_name, base_branch, title, body):
        code, pr = self.call("POST", "/pulls", repo, {
            "title": title, "head": branch_name, "base": base_branch, "body": body
        })
        if code == 201:
            return pr
        return None

    def get_branch_sha(self, repo, branch):
        code, ref = self.call("GET", f"/git/refs/heads/{branch}", repo)
        if code == 200:
            return ref['object']['sha']
        return None

    def create_branch(self, repo, branch_name, sha):
        code, _ = self.call("POST", "/git/refs", repo,
            {"ref": f"refs/heads/{branch_name}", "sha": sha})
        return code == 201

    def delete_branch(self, repo, branch_name):
        self.call("DELETE", f"/git/refs/heads/{branch_name}", repo)

    def update_file(self, repo, path, content, branch_name, message, sha=None):
        import base64
        body = {
            "message": message,
            "content": base64.b64encode(content.encode()).decode(),
            "branch": branch_name
        }
        if sha:
            body["sha"] = sha
        code, _ = self.call("PUT", f"/contents/{path}", repo, body)
        return code in (200, 201)

    def get_file_sha(self, repo, path, branch_name):
        code, data = self.call("GET", f"/contents/{path}?ref={branch_name}", repo)
        if isinstance(data, dict):
            return data.get('sha')
        return None

    def get_existing_pr(self, repo, branch_name):
        """Check if PR already exists for branch."""
        code, prs = self.call("GET",
            f"/pulls?state=all&head={OWNER}:{branch_name}&per_page=5", repo)
        if code == 200 and isinstance(prs, list) and len(prs) > 0:
            return prs[0]
        return None


# === OpenRouter AI ===
class AIClient:
    BASE = "https://openrouter.ai/api/v1"

    def __init__(self, api_key=None):
        self.api_key = api_key or OR_KEY

    MODELS = [
        "openrouter/free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "qwen/qwen-2.5-coder-32b-instruct:free",
        "deepseek/deepseek-chat:free"
    ]

    def chat(self, prompt, system="", max_tokens=4000):
        if not self.api_key:
            return None
        body = json.dumps({
            "model": self.MODELS[0],
            "messages": [
                {"role": "system", "content": system or "You are a helpful assistant."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": max_tokens
        }).encode()
        req = urllib.request.Request(f"{self.BASE}/chat/completions",
            data=body, method="POST",
            headers={"Authorization": f"Bearer {self.api_key}",
                     "Content-Type": "application/json",
                     "HTTP-Referer": "https://github.com/banksaisuoy"})
        try:
            return _retry(lambda: self._do(req))
        except Exception as e:
            print(f"  [AI] error: {e}")
            return None

    def _do(self, req):
        with urllib.request.urlopen(req, timeout=30) as resp:
            d = json.loads(resp.read())
        if 'choices' in d:
            return d['choices'][0]['message']['content']
        return None

    def chat_json(self, prompt, system=""):
        """Get JSON response from AI."""
        result = self.chat(prompt, system or "You are a JSON-only responder. Respond with valid JSON only.")
        if not result:
            return None
        import re
        m = re.search(r'\{.*\}', result, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except:
                pass
        return None


# === Render API ===
class RenderClient:
    BASE = "https://api.render.com/v1"

    def __init__(self, token=None):
        self.token = token or RENDER_KEY

    def deploy(self, service_id):
        if not self.token or not service_id:
            return None
        req = urllib.request.Request(f"{self.BASE}/services/{service_id}/deploys",
            data=b"{}", method="POST",
            headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read()).get("id")
        except:
            return None

    def get_service(self, service_id):
        req = urllib.request.Request(f"{self.BASE}/services/{service_id}",
            headers={"Authorization": f"Bearer {self.token}"})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read())
        except:
            return None


# Module-level singletons (lazy)
_jules = None
_github = None
_ai = None
_render = None

def get_jules():
    global _jules
    if _jules is None:
        _jules = JulesClient()
    return _jules

def get_github():
    global _github
    if _github is None:
        _github = GitHubClient()
    return _github

def get_ai():
    global _ai
    if _ai is None:
        _ai = AIClient()
    return _ai

def get_render():
    global _render
    if _render is None:
        _render = RenderClient()
    return _render
