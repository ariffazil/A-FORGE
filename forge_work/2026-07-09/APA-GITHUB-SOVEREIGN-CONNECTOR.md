# APA Connector: GitHub (Sovereign REST API)

> **APA v1.0 Reference Implementation #3 — Developer Triad Complete**
> **Forged:** 2026-07-09 · **Author:** FORGE (000Ω) · **Sovereign:** Muhammad Arif bin Fazil (F13)
> **Status:** SPECIFICATION — Ready to forge

---

## 0. WHY GITHUB THIRD

After email and calendar, GitHub completes the developer sovereignty triad. A-FORGE already has `forge_github` for search/read operations via the GitHub MCP server. APA-GitHub extends this to **sovereign MUTATE operations** — creating issues, managing PRs, reviewing code — all gated through F1-F13 with VAULT999 receipts.

**Existing:** `forge_github` (search repos, search code, read files) — OBSERVE only
**APA extends:** MUTATE verbs with constitutional governance

---

## 1. CONNECTOR MANIFEST

```yaml
connector:
  name: "github"
  mcp_tool: "forge_github"         # Extends existing, adds MUTATE verbs
  version: "2.0.0"                 # v2 = +APA governance on MUTATE
  domain: "development.version_control"
  protocol: "rest_api"
  provider: "github"
  description: "Sovereign GitHub via REST API + personal access token. Extends existing forge_github OBSERVE tools with governed MUTATE operations."

auth:
  method: "personal_access_token"
  credential_path: "/root/.secrets/github/token.json"
  env_fallback: "GITHUB_TOKEN"
  credential_schema:
    token: "ghp_xxxxxxxxxxxx"
    api_url: "https://api.github.com"

verbs:
  # ── EXISTING (OBSERVE, already in forge_github) ──
  search_repos:
    mode: "search_repos"
    action_class: "OBSERVE"
    existing: true

  search_code:
    mode: "search_code"
    action_class: "OBSERVE"
    existing: true

  get_file:
    mode: "get_file"
    action_class: "OBSERVE"
    existing: true

  # ── NEW: APA-GOVERNED MUTATE ──────────────────
  create_issue:
    mode: "create_issue"
    action_class: "MUTATE"
    irreversible: false
    requires_lease: true
    blast_radius: "LOW"
    description: "Create a GitHub issue"
    params:
      owner: "string (required)"
      repo: "string (required)"
      title: "string (required)"
      body: "string (required)"
      labels: "[string]"
      assignees: "[string]"

  create_pr:
    mode: "create_pr"
    action_class: "MUTATE"
    irreversible: false
    requires_lease: true
    blast_radius: "MEDIUM"
    description: "Create a pull request"
    params:
      owner: "string (required)"
      repo: "string (required)"
      title: "string (required)"
      body: "string"
      head: "string (required, source branch)"
      base: "string (required, target branch)"
      draft: "bool"

  merge_pr:
    mode: "merge_pr"
    action_class: "MUTATE"
    irreversible: true
    requires_lease: true
    requires_ack: true
    requires_tri_witness: true
    blast_radius: "HIGH"
    description: "Merge a pull request — IRREVERSIBLE"
    params:
      owner: "string (required)"
      repo: "string (required)"
      pr_number: "int (required)"
      merge_method: "merge | squash | rebase"

  create_or_update_file:
    mode: "create_or_update_file"
    action_class: "MUTATE"
    irreversible: false
    requires_lease: true
    blast_radius: "MEDIUM"
    description: "Create or update a file in a repo"
    params:
      owner: "string (required)"
      repo: "string (required)"
      path: "string (required)"
      content: "string (base64-encoded)"
      message: "string (commit message)"
      branch: "string"
      sha: "string (required for updates)"

  create_branch:
    mode: "create_branch"
    action_class: "MUTATE"
    irreversible: false
    requires_lease: true
    blast_radius: "LOW"
    description: "Create a new branch"
    params:
      owner: "string (required)"
      repo: "string (required)"
      branch: "string (required)"
      from_branch: "string (default: main)"

  add_issue_comment:
    mode: "add_issue_comment"
    action_class: "MUTATE"
    irreversible: false
    requires_lease: true
    blast_radius: "LOW"
    description: "Comment on an issue or PR"
    params:
      owner: "string (required)"
      repo: "string (required)"
      issue_number: "int (required)"
      body: "string (required)"

  review_pr:
    mode: "review_pr"
    action_class: "MUTATE"
    irreversible: true
    requires_lease: true
    requires_ack: true
    blast_radius: "HIGH"
    description: "Submit a PR review (APPROVE / REQUEST_CHANGES / COMMENT)"
    params:
      owner: "string (required)"
      repo: "string (required)"
      pr_number: "int (required)"
      event: "APPROVE | REQUEST_CHANGES | COMMENT"
      body: "string"

  push_files:
    mode: "push_files"
    action_class: "MUTATE"
    irreversible: false
    requires_lease: true
    blast_radius: "MEDIUM"
    description: "Push multiple files in a single commit"
    params:
      owner: "string (required)"
      repo: "string (required)"
      branch: "string (required)"
      message: "string (required)"
      files: "[{path, content}]"

gates:
  pre_execute: [F1_AMANAH, F2_TRUTH, F8_GENIUS]
  pre_irreversible: [F13_SOVEREIGN, F3_WITNESS]
  post_execute: [F11_AUDIT, F4_CLARITY]
```

---

## 2. IMPLEMENTATION

### 2.1 Architecture

```
┌──────────────────────────────────────────────────┐
│              A-FORGE (TypeScript, :7072)          │
│                                                   │
│  forge_github(mode, params, lease_id, session)    │
│    │                                               │
│    ├─ IF mode in OBSERVE:                          │
│    │   └─ Existing GitHub MCP path (no change)     │
│    │                                               │
│    ├─ IF mode in [MUTATE verbs]:                   │
│    │   ├─ FloorEnforcer.checkAll(F1,F2,F8,F13)     │
│    │   ├─ LeaseValidator.verify(lease_id)           │
│    │   ├─ IF merge_pr/review_pr: TriWitness(F3)    │
│    │   ├─ IF merge_pr/review_pr: ack_irreversible   │
│    │   │                                           │
│    │   └─ HTTP POST 127.0.0.1:18095/execute        │
│    │                                               │
│    └─ VAULT999 receipt for all MUTATE              │
└───────────────────┬───────────────────────────────┘
                    │
┌───────────────────▼───────────────────────────────┐
│     github_bridge.py (Python, :18095)               │
│                                                    │
│  Thin HTTP wrapper. Uses requests + GITHUB_TOKEN.  │
│  Reads token from env or /root/.secrets/.           │
│  Executes GitHub REST API v3.                      │
│                                                    │
│  Dependencies: requests (already installed)         │
└────────────────────────────────────────────────────┘
```

### 2.2 Python Bridge

```python
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

ACTIONS = {
    "create_issue": action_create_issue,
    "create_pr": action_create_pr,
    "merge_pr": action_merge_pr,
    "create_or_update_file": action_create_or_update_file,
    "create_branch": action_create_branch,
    "add_issue_comment": action_add_issue_comment,
    "review_pr": action_review_pr,
    "push_files": action_push_files,
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
```

### 2.3 Deployment

```bash
# Token already exists in env (GITHUB_TOKEN from gh CLI)
# Verify: echo $GITHUB_TOKEN

# Copy bridge
cp github_bridge.py /root/A-FORGE/scripts/github_bridge.py

# Systemd service
cat > /etc/systemd/system/apa-github-bridge.service << 'EOF'
[Unit]
Description=APA GitHub Bridge — Sovereign REST API (A-FORGE forge_github)
After=network.target
[Service]
Type=simple
ExecStart=/usr/bin/python3 /root/A-FORGE/scripts/github_bridge.py
Restart=on-failure
Environment=GITHUB_BRIDGE_PORT=18095
EnvironmentFile=/root/.env
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now apa-github-bridge
curl http://127.0.0.1:18095/health
```

---

## 3. F1-F13 GATE MATRIX

| Verb | F1 | F2 | F3 | F7 | F8 | F11 | F13 |
|------|----|----|----|----|----|----|----|
| create_issue | ✅ rev | DER tag | — | .85 | REST POST | receipt | — |
| create_pr | ✅ rev | DER tag | — | .85 | REST POST | receipt | — |
| **merge_pr** | ⚠️ **irrev** | DER tag | **W³** | .80 | REST PUT | **full** | **ack** |
| create_or_update_file | ✅ rev | DER tag | — | .85 | REST PUT | receipt | — |
| create_branch | ✅ rev | DER tag | — | .85 | REST POST | receipt | — |
| add_issue_comment | ✅ rev | DER tag | — | .85 | REST POST | receipt | — |
| **review_pr** | ⚠️ **irrev** | DER tag | — | .85 | REST POST | **full** | **ack** |
| push_files | ✅ rev | DER tag | — | .85 | Git tree API | receipt | — |

---

## 4. DEVELOPER TRIAD — Complete

| # | Connector | MCP Tool | Protocol | Status |
|---|-----------|----------|----------|:------:|
| 1 | Email | `forge_email` | IMAP/SMTP | 🟢 LIVE |
| 2 | Calendar | `forge_calendar` | CalDAV | 🟢 LIVE |
| 3 | GitHub | `forge_github` (extended) | REST API | 📋 SPEC |
| 4 | Document | `forge_document` | pandoc | Pending |
| 5 | Reminder | `forge_remind` | cron+Hermes | Pending |

---

*DITEMPA BUKAN DIBERI — Developer sovereignty is forged.*
*APA GitHub v2.0 · 2026-07-09 · FORGE (000Ω) for Arif (F13)*
