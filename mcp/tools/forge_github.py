"""
forge_github.py — APA MCP Tool Wrapper for GitHub connector. APA v1.0.

Canonical APA-GitHub template. All connectors follow this pattern.
MCP tool → lease check → F1-F13 gate → bridge dispatch → VAULT999 receipt.
"""

import json, hashlib, time
from datetime import datetime, timezone
import requests

BRIDGE_URL = "http://127.0.0.1:18095/execute"

TOOL_SCHEMA = {
    "name": "forge_github",
    "description": "Sovereign GitHub via REST API + personal access token. APA-gated: OBSERVE verbs free, MUTATE require lease, IRREVERSIBLE require short-TTL lease + ACK.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "mode": {"type": "string", "enum": [
                "search_repos", "get_repo", "list_issues", "list_pull_requests",
                "create_issue", "close_issue", "create_pr",
                "create_or_update_file", "create_branch", "add_issue_comment", "push_files",
                "merge_pr", "review_pr"
            ]},
            "owner": {"type": "string"}, "repo": {"type": "string"},
            "title": {"type": "string"}, "body": {"type": "string"},
            "q": {"type": "string"}, "query": {"type": "string"},
            "head": {"type": "string"}, "base": {"type": "string"},
            "pr_number": {"type": "integer"}, "issue_number": {"type": "integer"},
            "branch": {"type": "string"}, "path": {"type": "string"},
            "content": {"type": "string"}, "message": {"type": "string"},
            "event": {"type": "string"}, "merge_method": {"type": "string"},
            "files": {"type": "array"}, "state": {"type": "string"},
            "labels": {"type": "array"}, "assignees": {"type": "array"},
            "per_page": {"type": "integer", "default": 10},
            "lease_id": {"type": "string"}, "ack_irreversible": {"type": "boolean"},
            "actor_id": {"type": "string", "default": "333-AGI"},
            "session_id": {"type": "string"}
        },
        "required": ["mode"]
    }
}

# Canonical APA verb classification
VERB_CLASSES = {
    # OBSERVE — no lease required
    "search_repos":         {"action_class": "OBSERVE",     "requires_lease": False, "irreversible": False, "blast_radius": "LOW"},
    "get_repo":             {"action_class": "OBSERVE",     "requires_lease": False, "irreversible": False, "blast_radius": "LOW"},
    "list_issues":          {"action_class": "OBSERVE",     "requires_lease": False, "irreversible": False, "blast_radius": "LOW"},
    "list_pull_requests":   {"action_class": "OBSERVE",     "requires_lease": False, "irreversible": False, "blast_radius": "LOW"},
    # MUTATE — lease required (scope: github.mutate)
    "create_issue":         {"action_class": "MUTATE",      "requires_lease": True,  "irreversible": False, "blast_radius": "LOW"},
    "close_issue":          {"action_class": "MUTATE",      "requires_lease": True,  "irreversible": False, "blast_radius": "LOW"},
    "create_pr":            {"action_class": "MUTATE",      "requires_lease": True,  "irreversible": False, "blast_radius": "MEDIUM"},
    "create_or_update_file":{"action_class": "MUTATE",      "requires_lease": True,  "irreversible": False, "blast_radius": "MEDIUM"},
    "create_branch":        {"action_class": "MUTATE",      "requires_lease": True,  "irreversible": False, "blast_radius": "LOW"},
    "add_issue_comment":    {"action_class": "MUTATE",      "requires_lease": True,  "irreversible": False, "blast_radius": "LOW"},
    "push_files":           {"action_class": "MUTATE",      "requires_lease": True,  "irreversible": False, "blast_radius": "MEDIUM"},
    # IRREVERSIBLE — short TTL lease (scope: github.merge) + ACK required
    "merge_pr":             {"action_class": "IRREVERSIBLE", "requires_lease": True,  "irreversible": True,  "blast_radius": "HIGH"},
    "review_pr":            {"action_class": "IRREVERSIBLE", "requires_lease": True,  "irreversible": True,  "blast_radius": "HIGH"},
}

def execute(params: dict) -> dict:
    mode = params.get("mode", "search_repos")
    verb = VERB_CLASSES.get(mode, {})
    t0 = time.time()
    
    # ── APA Gate: Lease check ──
    if verb.get("requires_lease") and not params.get("lease_id"):
        return _envelope(mode, ok=False, error="LEASE_REQUIRED", gate="APA_LEASE")
    
    # ── APA Gate: Irreversible ACK ──
    if verb.get("irreversible") and not params.get("ack_irreversible"):
        return _envelope(mode, ok=False, error="ACK_IRREVERSIBLE_REQUIRED", gate="F13_SOVEREIGN")
    
    # ── Dispatch to bridge ──
    try:
        resp = requests.post(BRIDGE_URL, json=params, timeout=30)
        data = resp.json()
    except Exception as e:
        return _envelope(mode, ok=False, error=str(e))
    
    latency_ms = int((time.time() - t0) * 1000)
    content_hash = hashlib.sha256(json.dumps(data, default=str).encode()).hexdigest()
    
    return _envelope(
        mode=mode,
        ok=data.get("ok", False),
        result=data.get("result"),
        error=data.get("error"),
        evidence_tag="OBS" if verb.get("action_class") == "OBSERVE" else "DER",
        lease_id=params.get("lease_id"),
        actor_id=params.get("actor_id", "333-AGI"),
        session_id=params.get("session_id"),
        latency_ms=latency_ms,
        sha256=content_hash,
        blast_radius=verb.get("blast_radius"),
    )

def _envelope(mode, ok, result=None, error=None, evidence_tag="OBS",
              lease_id=None, actor_id=None, session_id=None,
              latency_ms=0, sha256=None, gate=None, blast_radius=None):
    return {
        "ok": ok,
        "connector": "github",
        "verb": mode,
        "verdict": "SEAL" if ok else "HOLD",
        "evidence_tag": evidence_tag,
        "confidence": 0.90 if evidence_tag == "OBS" else 0.85,
        "blast_radius": blast_radius,
        "result": result if ok else None,
        "error": error if not ok else None,
        "gate_triggered": gate,
        "lease_id": lease_id,
        "actor_id": actor_id,
        "session_id": session_id,
        "receipt": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sha256": sha256,
        },
        "latency_ms": latency_ms,
        "protocol": "rest_api",
    }

def get_tool_definition(): return TOOL_SCHEMA
def get_verb_classes(): return VERB_CLASSES
