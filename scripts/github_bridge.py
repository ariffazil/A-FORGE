#!/usr/bin/env python3
"""
github_bridge.py — APA-GitHub canonical protocol adapter.

APA v1.0 template connector (developer triad #3).
Port: 18095 · bind 127.0.0.1 only.

OBSERVE:  search_repos, get_repo, list_issues, list_pull_requests
MUTATE:   create_issue, close_issue, create_pr, …
IRREVERSIBLE: merge_pr  (short TTL lease + ack at A-FORGE layer)

Bridge never judges, never seals VAULT999, never returns the token.
Returns APA-shaped envelope with result_sha256 for audit anchoring.

DITEMPA BUKAN DIBERI
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

import requests

logging.basicConfig(level=logging.INFO, format="[github_bridge] %(message)s")
log = logging.getLogger(__name__)

API_URL = os.environ.get("GITHUB_API_URL", "https://api.github.com")
SECRET_PATHS = (
    os.environ.get("GITHUB_CRED_PATH", "/root/.secrets/github/token.json"),
    "/root/.secrets/github/pat.json",
    "/root/.secrets/env/github-bridge.env",
)

# Verb → action_class (canonical APA-GitHub template)
VERB_CLASS = {
    "search_repos": "OBSERVE",
    "get_repo": "OBSERVE",
    "list_issues": "OBSERVE",
    "list_pull_requests": "OBSERVE",
    "create_issue": "MUTATE",
    "close_issue": "MUTATE",
    "create_pr": "MUTATE",
    "add_issue_comment": "MUTATE",
    "create_branch": "MUTATE",
    "create_or_update_file": "MUTATE",
    "push_files": "MUTATE",
    "review_pr": "MUTATE",
    "merge_pr": "IRREVERSIBLE",
    # aliases for lease scope docs
    "merge_pull_request": "IRREVERSIBLE",
}

LEASE_SCOPE_HINT = {
    "OBSERVE": "github.read",
    "MUTATE": "github.mutate",
    "IRREVERSIBLE": "github.merge",
}


def load_token() -> str | None:
    tok = os.environ.get("GITHUB_TOKEN") or os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN")
    if tok:
        return tok.strip()
    for path in SECRET_PATHS:
        if not os.path.exists(path):
            continue
        try:
            if path.endswith(".env") or path.endswith("github-bridge.env"):
                with open(path) as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("GITHUB_TOKEN="):
                            return line.split("=", 1)[1].strip().strip('"').strip("'")
            else:
                with open(path) as f:
                    data = json.load(f)
                return (data.get("token") or data.get("pat") or "").strip() or None
        except Exception as e:
            log.error("secret read failed (path redacted): %s", type(e).__name__)
    return None


def headers() -> dict[str, str]:
    token = load_token()
    if not token:
        raise RuntimeError("GITHUB_TOKEN not configured")
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "APA-github-bridge/1.0",
    }


def api(method: str, path: str, data: dict | None = None, params: dict | None = None) -> Any:
    url = f"{API_URL}{path}"
    resp = requests.request(
        method,
        url,
        headers=headers(),
        json=data,
        params=params,
        timeout=60,
    )
    if resp.status_code >= 400:
        # Never include request Authorization in error bodies
        raise RuntimeError(f"GitHub API {resp.status_code}: {resp.text[:500]}")
    if not resp.text:
        return {"status": resp.status_code}
    return resp.json()


def result_hash(obj: Any) -> str:
    raw = json.dumps(obj, sort_keys=True, default=str).encode()
    return hashlib.sha256(raw).hexdigest()


def envelope(mode: str, result: Any, lease_id: str | None = None) -> dict:
    action_class = VERB_CLASS.get(mode, "OBSERVE")
    rh = result_hash(result)
    return {
        "ok": True,
        "status": "ok",
        "mode": mode,
        "action_class": action_class,
        "lease_scope_hint": LEASE_SCOPE_HINT.get(action_class),
        "lease_id": lease_id,
        "evidence_tags": ["OBSERVED" if action_class == "OBSERVE" else "DERIVED", "GITHUB_REST"],
        "confidence_cap": 0.90 if action_class == "OBSERVE" else 0.85,
        "result": result,
        "result_sha256": rh,
        # vault_receipt_id minted by A-FORGE/arifOS — bridge only supplies anchor material
        "vault_anchor_material": {
            "connector": "github",
            "verb": mode,
            "result_sha256": rh,
            "lease_id": lease_id,
        },
    }


# ── OBSERVE ───────────────────────────────────────────────────────────

def action_search_repos(p: dict) -> dict:
    q = p.get("q") or p.get("query") or ""
    if not q:
        raise ValueError("q/query required")
    limit = min(int(p.get("limit", p.get("per_page", 10))), 30)
    data = api("GET", "/search/repositories", params={"q": q, "per_page": limit})
    items = [
        {
            "full_name": i.get("full_name"),
            "url": i.get("html_url"),
            "description": i.get("description"),
            "stars": i.get("stargazers_count"),
            "language": i.get("language"),
        }
        for i in (data.get("items") or [])
    ]
    return {"total": data.get("total_count"), "returned": len(items), "items": items}


def action_get_repo(p: dict) -> dict:
    owner, repo = p["owner"], p["repo"]
    r = api("GET", f"/repos/{owner}/{repo}")
    return {
        "full_name": r.get("full_name"),
        "url": r.get("html_url"),
        "description": r.get("description"),
        "default_branch": r.get("default_branch"),
        "private": r.get("private"),
        "stars": r.get("stargazers_count"),
        "open_issues": r.get("open_issues_count"),
        "language": r.get("language"),
    }


def action_list_issues(p: dict) -> dict:
    owner, repo = p["owner"], p["repo"]
    state = p.get("state", "open")
    limit = min(int(p.get("limit", p.get("per_page", 20))), 50)
    data = api(
        "GET",
        f"/repos/{owner}/{repo}/issues",
        params={"state": state, "per_page": limit},
    )
    # GitHub issues API includes PRs — filter unless include_prs
    include_prs = bool(p.get("include_prs", False))
    issues = []
    for i in data:
        if not include_prs and i.get("pull_request"):
            continue
        issues.append(
            {
                "number": i.get("number"),
                "title": i.get("title"),
                "state": i.get("state"),
                "url": i.get("html_url"),
                "user": (i.get("user") or {}).get("login"),
            }
        )
    return {"count": len(issues), "issues": issues}


def action_list_pull_requests(p: dict) -> dict:
    owner, repo = p["owner"], p["repo"]
    state = p.get("state", "open")
    limit = min(int(p.get("limit", p.get("per_page", 20))), 50)
    data = api(
        "GET",
        f"/repos/{owner}/{repo}/pulls",
        params={"state": state, "per_page": limit},
    )
    prs = [
        {
            "number": pr.get("number"),
            "title": pr.get("title"),
            "state": pr.get("state"),
            "url": pr.get("html_url"),
            "user": (pr.get("user") or {}).get("login"),
            "draft": pr.get("draft"),
        }
        for pr in data
    ]
    return {"count": len(prs), "pull_requests": prs}


# ── MUTATE ────────────────────────────────────────────────────────────

def action_create_issue(p: dict) -> dict:
    owner, repo = p["owner"], p["repo"]
    result = api(
        "POST",
        f"/repos/{owner}/{repo}/issues",
        {
            "title": p["title"],
            "body": p.get("body", ""),
            "labels": p.get("labels", []),
            "assignees": p.get("assignees", []),
        },
    )
    return {
        "number": result.get("number"),
        "url": result.get("html_url"),
        "title": result.get("title"),
        "state": result.get("state"),
    }


def action_close_issue(p: dict) -> dict:
    owner, repo = p["owner"], p["repo"]
    num = p.get("issue_number") or p.get("number")
    if num is None:
        raise ValueError("issue_number required")
    result = api(
        "PATCH",
        f"/repos/{owner}/{repo}/issues/{num}",
        {"state": "closed"},
    )
    return {
        "number": result.get("number"),
        "url": result.get("html_url"),
        "state": result.get("state"),
    }


def action_create_pr(p: dict) -> dict:
    owner, repo = p["owner"], p["repo"]
    result = api(
        "POST",
        f"/repos/{owner}/{repo}/pulls",
        {
            "title": p["title"],
            "body": p.get("body", ""),
            "head": p["head"],
            "base": p.get("base", "main"),
            "draft": p.get("draft", True),
        },
    )
    return {
        "number": result.get("number"),
        "url": result.get("html_url"),
        "state": result.get("state"),
        "draft": result.get("draft"),
    }


def action_create_or_update_file(p: dict) -> dict:
    owner, repo = p["owner"], p["repo"]
    body: dict[str, Any] = {
        "message": p["message"],
        "content": p["content"],
        "branch": p.get("branch"),
    }
    if "sha" in p:
        body["sha"] = p["sha"]
    result = api("PUT", f"/repos/{owner}/{repo}/contents/{p['path']}", body)
    return {"path": p["path"], "sha": (result.get("content") or {}).get("sha")}


def action_create_branch(p: dict) -> dict:
    owner, repo = p["owner"], p["repo"]
    base = p.get("from_branch", "main")
    ref = api("GET", f"/repos/{owner}/{repo}/git/ref/heads/{base}")
    sha = ref["object"]["sha"]
    result = api(
        "POST",
        f"/repos/{owner}/{repo}/git/refs",
        {"ref": f"refs/heads/{p['branch']}", "sha": sha},
    )
    return {"branch": p["branch"], "ref": result.get("ref")}


def action_add_issue_comment(p: dict) -> dict:
    owner, repo = p["owner"], p["repo"]
    result = api(
        "POST",
        f"/repos/{owner}/{repo}/issues/{p['issue_number']}/comments",
        {"body": p["body"]},
    )
    return {"comment_url": result.get("html_url")}


def action_review_pr(p: dict) -> dict:
    owner, repo, num = p["owner"], p["repo"], p["pr_number"]
    result = api(
        "POST",
        f"/repos/{owner}/{repo}/pulls/{num}/reviews",
        {"event": p["event"], "body": p.get("body", "")},
    )
    return {"state": result.get("state")}


def action_push_files(p: dict) -> dict:
    owner, repo = p["owner"], p["repo"]
    branch = p["branch"]
    message = p["message"]
    files = p["files"]
    tree_items = []
    for f in files:
        blob = api(
            "POST",
            f"/repos/{owner}/{repo}/git/blobs",
            {"content": f["content"], "encoding": "utf-8"},
        )
        tree_items.append(
            {
                "path": f["path"],
                "mode": "100644",
                "type": "blob",
                "sha": blob["sha"],
            }
        )
    tree = api("POST", f"/repos/{owner}/{repo}/git/trees", {"tree": tree_items})
    ref = api("GET", f"/repos/{owner}/{repo}/git/ref/heads/{branch}")
    parent_sha = ref["object"]["sha"]
    commit = api(
        "POST",
        f"/repos/{owner}/{repo}/git/commits",
        {
            "message": message,
            "tree": tree["sha"],
            "parents": [parent_sha],
        },
    )
    api(
        "PATCH",
        f"/repos/{owner}/{repo}/git/refs/heads/{branch}",
        {"sha": commit["sha"]},
    )
    return {"pushed": True, "sha": commit["sha"], "files": len(files)}


# ── IRREVERSIBLE ──────────────────────────────────────────────────────

def action_merge_pr(p: dict) -> dict:
    owner, repo, num = p["owner"], p["repo"], p.get("pr_number") or p.get("number")
    if num is None:
        raise ValueError("pr_number required")
    method = p.get("merge_method", "merge")
    result = api(
        "PUT",
        f"/repos/{owner}/{repo}/pulls/{num}/merge",
        {"merge_method": method},
    )
    return {
        "merged": result.get("merged", False),
        "sha": result.get("sha"),
        "message": result.get("message"),
    }


ACTIONS = {
    "search_repos": action_search_repos,
    "get_repo": action_get_repo,
    "list_issues": action_list_issues,
    "list_pull_requests": action_list_pull_requests,
    "create_issue": action_create_issue,
    "close_issue": action_close_issue,
    "create_pr": action_create_pr,
    "merge_pr": action_merge_pr,
    "merge_pull_request": action_merge_pr,
    "create_or_update_file": action_create_or_update_file,
    "create_branch": action_create_branch,
    "add_issue_comment": action_add_issue_comment,
    "review_pr": action_review_pr,
    "push_files": action_push_files,
}


class GitHubHandler(BaseHTTPRequestHandler):
    def _send(self, data: dict, status: int = 200) -> None:
        body = json.dumps(data, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            tok = bool(load_token())
            self._send(
                {
                    "ok": True,
                    "bridge": "github_bridge",
                    "protocol": "rest_api",
                    "apa_version": "1.0",
                    "template": "APA-GitHub-canonical",
                    "auth_configured": tok,
                    "status": "READY" if tok else "AWAITING_TOKEN",
                    "verbs": sorted(ACTIONS.keys()),
                    "verb_classes": {
                        k: VERB_CLASS.get(k, "OBSERVE") for k in sorted(ACTIONS.keys())
                    },
                    "lease_scopes": {
                        "github.read": "OBSERVE verbs",
                        "github.mutate": "MUTATE verbs",
                        "github.merge": "IRREVERSIBLE merge_pr",
                    },
                }
            )
        elif self.path == "/manifest":
            self._send(
                {
                    "connector": "github",
                    "apa_version": "1.0",
                    "verbs": [
                        {"name": n, "action_class": VERB_CLASS.get(n, "OBSERVE")}
                        for n in sorted(ACTIONS.keys())
                    ],
                }
            )
        else:
            self._send({"error": "not found"}, 404)

    def do_POST(self) -> None:  # noqa: N802
        body: dict = {}
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}
            mode = body.get("mode")
            if mode not in ACTIONS:
                self._send(
                    {
                        "ok": False,
                        "status": "error",
                        "error": f"Unknown mode: {mode}",
                        "known_modes": sorted(ACTIONS.keys()),
                    },
                    400,
                )
                return
            lease_id = body.get("lease_id")
            action_class = VERB_CLASS.get(mode, "OBSERVE")
            # Soft gate: MUTATE/IRREVERSIBLE should carry lease_id (A-FORGE enforces hard)
            if action_class in ("MUTATE", "IRREVERSIBLE") and not lease_id:
                if os.environ.get("APA_REQUIRE_LEASE_ID", "0") == "1":
                    self._send(
                        {
                            "ok": False,
                            "status": "error",
                            "error": f"{action_class} requires lease_id",
                            "lease_scope_hint": LEASE_SCOPE_HINT[action_class],
                        },
                        403,
                    )
                    return
            result = ACTIONS[mode](body)
            self._send(envelope(mode, result, lease_id=lease_id))
        except Exception as e:
            log.error("Error in %s: %s", body.get("mode", "?"), e)
            self._send({"ok": False, "status": "error", "error": str(e)[:800]}, 500)

    def log_message(self, fmt: str, *args) -> None:
        log.info("%s - %s", self.client_address[0], fmt % args)


if __name__ == "__main__":
    port = int(os.environ.get("GITHUB_BRIDGE_PORT", "18095"))
    server = HTTPServer(("127.0.0.1", port), GitHubHandler)
    log.info("APA GitHub Bridge (canonical template) on 127.0.0.1:%s", port)
    server.serve_forever()
