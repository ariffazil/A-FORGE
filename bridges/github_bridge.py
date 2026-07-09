#!/usr/bin/env python3
"""
github_bridge.py — APA GitHub Connector: Sovereign REST API bridge.
Part of APA v1.0 (Autonomous Protocol for Applications).
A-FORGE → APA → GitHub.

Port: 18095 (internal, 127.0.0.1)

DITEMPA BUKAN DIBERI — Code sovereignty is forged.
"""

import json, os, base64, logging
from http.server import HTTPServer, BaseHTTPRequestHandler
import requests

logging.basicConfig(level=logging.INFO, format='[github_bridge] %(message)s')
log = logging.getLogger(__name__)

API_URL = "https://api.github.com"
TOKEN = os.environ.get("GITHUB_TOKEN") or os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN")

# Fallback: read from secrets file
if not TOKEN:
    SECRET_PATH = "/root/.secrets/github/token.json"
    if os.path.exists(SECRET_PATH):
        with open(SECRET_PATH) as f:
            TOKEN = json.load(f).get("token", "")

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

def api(method, path, data=None):
    url = f"{API_URL}{path}"
    resp = requests.request(method, url, headers=HEADERS, json=data)
    resp.raise_for_status()
    return resp.json() if resp.text else {"status": resp.status_code}

def action_create_issue(p):
    owner, repo = p["owner"], p["repo"]
    result = api("POST", f"/repos/{owner}/{repo}/issues", {
        "title": p["title"],
        "body": p.get("body", ""),
        "labels": p.get("labels", []),
        "assignees": p.get("assignees", []),
    })
    return {"issue_url": result["html_url"], "number": result["number"]}

def action_create_pr(p):
    owner, repo = p["owner"], p["repo"]
    result = api("POST", f"/repos/{owner}/{repo}/pulls", {
        "title": p["title"],
        "body": p.get("body", ""),
        "head": p["head"],
        "base": p["base"],
        "draft": p.get("draft", False),
    })
    return {"pr_url": result["html_url"], "number": result["number"]}

def action_merge_pr(p):
    owner, repo, num = p["owner"], p["repo"], p["pr_number"]
    method = p.get("merge_method", "merge")
    result = api("PUT", f"/repos/{owner}/{repo}/pulls/{num}/merge", {
        "merge_method": method,
    })
    return {"merged": result.get("merged", False), "sha": result.get("sha")}

def action_create_or_update_file(p):
    owner, repo = p["owner"], p["repo"]
    body = {
        "message": p["message"],
        "content": p["content"],
        "branch": p.get("branch"),
    }
    if "sha" in p:
        body["sha"] = p["sha"]
    result = api("PUT", f"/repos/{owner}/{repo}/contents/{p['path']}", body)
    return {"path": p["path"], "sha": result["content"]["sha"]}

def action_create_branch(p):
    owner, repo = p["owner"], p["repo"]
    # Get SHA of base branch
    base = p.get("from_branch", "main")
    ref = api("GET", f"/repos/{owner}/{repo}/git/ref/heads/{base}")
    sha = ref["object"]["sha"]
    # Create new branch
    result = api("POST", f"/repos/{owner}/{repo}/git/refs", {
        "ref": f"refs/heads/{p['branch']}",
        "sha": sha,
    })
    return {"branch": p["branch"], "ref": result["ref"]}

def action_add_issue_comment(p):
    owner, repo = p["owner"], p["repo"]
    result = api("POST", f"/repos/{owner}/{repo}/issues/{p['issue_number']}/comments", {
        "body": p["body"],
    })
    return {"comment_url": result["html_url"]}

def action_review_pr(p):
    owner, repo, num = p["owner"], p["repo"], p["pr_number"]
    result = api("POST", f"/repos/{owner}/{repo}/pulls/{num}/reviews", {
        "event": p["event"],
        "body": p.get("body", ""),
    })
    return {"state": result["state"]}

def action_push_files(p):
    owner, repo = p["owner"], p["repo"]
    branch = p["branch"]
    message = p["message"]
    files = p["files"]
    # Build tree
    tree_items = []
    for f in files:
        blob = api("POST", f"/repos/{owner}/{repo}/git/blobs", {
            "content": f["content"],
            "encoding": "utf-8",
        })
        tree_items.append({
            "path": f["path"],
            "mode": "100644",
            "type": "blob",
            "sha": blob["sha"],
        })
    tree = api("POST", f"/repos/{owner}/{repo}/git/trees", {"tree": tree_items})
    # Get parent commit
    ref = api("GET", f"/repos/{owner}/{repo}/git/ref/heads/{branch}")
    parent_sha = ref["object"]["sha"]
    # Create commit
    commit = api("POST", f"/repos/{owner}/{repo}/git/commits", {
        "message": message,
        "tree": tree["sha"],
        "parents": [parent_sha],
    })
    # Update ref
    api("PATCH", f"/repos/{owner}/{repo}/git/refs/heads/{branch}", {
        "sha": commit["sha"],
    })
    return {"pushed": True, "sha": commit["sha"], "files": len(files)}


def action_search_repos(p):
    q = p.get("q", p.get("query", ""))
    result = api("GET", f"/search/repositories?q={q}&per_page={p.get('per_page',10)}")
    items = result.get("items", [])
    return {"total_count": result.get("total_count", 0), "repos": [
        {"full_name": r["full_name"], "description": r.get("description",""), 
         "stars": r.get("stargazers_count",0), "url": r["html_url"]} for r in items
    ]}

def action_get_repo(p):
    result = api("GET", f"/repos/{p['owner']}/{p['repo']}")
    return {"full_name": result["full_name"], "description": result.get("description",""),
            "stars": result.get("stargazers_count",0), "forks": result.get("forks_count",0),
            "open_issues": result.get("open_issues_count",0), "default_branch": result.get("default_branch",""),
            "url": result["html_url"]}

def action_list_issues(p):
    owner, repo = p["owner"], p["repo"]
    state = p.get("state", "open")
    result = api("GET", f"/repos/{owner}/{repo}/issues?state={state}&per_page={p.get('per_page',10)}")
    return {"count": len(result), "issues": [
        {"number": i["number"], "title": i["title"], "state": i["state"],
         "url": i["html_url"]} for i in result
    ]}

def action_close_issue(p):
    owner, repo = p["owner"], p["repo"]
    result = api("PATCH", f"/repos/{owner}/{repo}/issues/{p['issue_number']}", {"state": "closed"})
    return {"number": result["number"], "state": result["state"], "url": result["html_url"]}

def action_list_pull_requests(p):
    owner, repo = p["owner"], p["repo"]
    state = p.get("state", "open")
    result = api("GET", f"/repos/{owner}/{repo}/pulls?state={state}&per_page={p.get('per_page',10)}")
    return {"count": len(result), "prs": [
        {"number": pr["number"], "title": pr["title"], "state": pr["state"],
         "head": pr["head"]["ref"], "base": pr["base"]["ref"],
         "url": pr["html_url"]} for pr in result
    ]}

ACTIONS = {
    # OBSERVE (no lease required)
    "search_repos": action_search_repos,
    "get_repo": action_get_repo,
    "list_issues": action_list_issues,
    "list_pull_requests": action_list_pull_requests,
    # MUTATE (lease required)
    "create_issue": action_create_issue,
    "close_issue": action_close_issue,
    "create_pr": action_create_pr,
    "create_or_update_file": action_create_or_update_file,
    "create_branch": action_create_branch,
    "add_issue_comment": action_add_issue_comment,
    "push_files": action_push_files,
    # IRREVERSIBLE (short TTL lease + ACK required)
    "merge_pr": action_merge_pr,
    "review_pr": action_review_pr,
}

class GitHubHandler(BaseHTTPRequestHandler):
    def _send(self, data, status=200):
        body = json.dumps(data, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    
    def do_GET(self):
        if self.path == "/health":
            self._send({
                "ok": True,
                "bridge": "github_bridge",
                "protocol": "rest_api",
                "apa_version": "1.0",
                "auth_configured": bool(TOKEN),
                "status": "READY" if TOKEN else "AWAITING_TOKEN",
            })
        else:
            self._send({"error": "not found"}, 404)
    
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}
            mode = body.get("mode")
            if mode not in ACTIONS:
                self._send({"ok": False, "error": f"Unknown mode: {mode}"}, 400)
                return
            result = ACTIONS[mode](body)
            self._send({"ok": True, "mode": mode, "result": result})
        except Exception as e:
            log.error(f"Error in {body.get('mode', '?')}: {e}")
            self._send({"ok": False, "error": str(e)}, 500)
    
    def log_message(self, format, *args):
        log.info(f"{self.client_address[0]} - {format % args}")

if __name__ == "__main__":
    port = int(os.environ.get("GITHUB_BRIDGE_PORT", "18095"))
    server = HTTPServer(("127.0.0.1", port), GitHubHandler)
    log.info(f"APA GitHub Bridge listening on 127.0.0.1:{port}")
    server.serve_forever()
