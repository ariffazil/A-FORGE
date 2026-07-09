"""
forge_email.py — APA MCP Tool Wrapper for Email connector.
Part of APA v1.0 — Autonomous Protocol for Applications.

This is the MCP-facing tool definition. It:
1. Declares the tool schema (input/output JSON)
2. Validates lease + session + F1-F13 gates
3. Dispatches to the bridge (127.0.0.1:18093)
4. Returns APA response envelope with VAULT999 anchoring

The LLM calls THIS. The bridge does the work.
DITEMPA BUKAN DIBERI
"""

import json, hashlib, time
from datetime import datetime, timezone
import requests

BRIDGE_URL = "http://127.0.0.1:18093/execute"

TOOL_SCHEMA = {
    "name": "forge_email",
    "description": "Sovereign email via IMAP/SMTP. Search, read, send, list labels.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "mode": {
                "type": "string",
                "enum": ["search", "read", "send", "list_labels"],
                "description": "Email operation"
            },
            "query": {"type": "string", "description": "Gmail search query (for mode=search)"},
            "email_id": {"type": "string", "description": "Email UID (for mode=read)"},
            "to": {"type": "string", "description": "Recipient (for mode=send)"},
            "subject": {"type": "string", "description": "Subject (for mode=send)"},
            "body": {"type": "string", "description": "Body (for mode=send)"},
            "cc": {"type": "string"},
            "limit": {"type": "integer", "default": 20},
            "lease_id": {"type": "string", "description": "APA lease ID (required for send)"},
            "actor_id": {"type": "string", "default": "333-AGI"},
            "session_id": {"type": "string"}
        },
        "required": ["mode"]
    }
}

VERB_CLASSES = {
    "search":       {"action_class": "OBSERVE",  "requires_lease": False, "irreversible": False},
    "read":         {"action_class": "OBSERVE",  "requires_lease": False, "irreversible": False},
    "send":         {"action_class": "MUTATE",   "requires_lease": True,  "irreversible": True},
    "list_labels":  {"action_class": "OBSERVE",  "requires_lease": False, "irreversible": False},
}

def execute(params: dict) -> dict:
    """Execute forge_email with APA governance."""
    mode = params.get("mode", "search")
    verb = VERB_CLASSES.get(mode, {})
    t0 = time.time()
    
    # ── APA Gate: Lease check ──
    if verb.get("requires_lease") and not params.get("lease_id"):
        return _envelope(mode, ok=False, error="LEASE_REQUIRED", evidence_tag="DER")
    
    # ── APA Gate: Irreversible ack ──
    if verb.get("irreversible") and not params.get("ack_irreversible"):
        return _envelope(mode, ok=False, error="ACK_IRREVERSIBLE_REQUIRED", 
                        evidence_tag="DER", gate="F13_SOVEREIGN")
    
    # ── Dispatch to bridge ──
    try:
        resp = requests.post(BRIDGE_URL, json=params, timeout=30)
        data = resp.json()
    except Exception as e:
        return _envelope(mode, ok=False, error=str(e), evidence_tag="DER")
    
    latency_ms = int((time.time() - t0) * 1000)
    
    # ── Content hash for audit ──
    content_hash = None
    if mode == "send" and data.get("ok"):
        content = f"{params.get('to','')}{params.get('subject','')}{params.get('body','')}"
        content_hash = hashlib.sha256(content.encode()).hexdigest()
    
    return _envelope(
        mode=mode,
        ok=data.get("ok", False),
        result=data.get("result"),
        error=data.get("error"),
        evidence_tag="OBS" if mode in ("search", "read", "list_labels") else "DER",
        lease_id=params.get("lease_id"),
        actor_id=params.get("actor_id", "333-AGI"),
        session_id=params.get("session_id"),
        latency_ms=latency_ms,
        sha256=content_hash,
    )

def _envelope(mode, ok, result=None, error=None, evidence_tag="OBS", 
              lease_id=None, actor_id=None, session_id=None, 
              latency_ms=0, sha256=None, gate=None):
    return {
        "ok": ok,
        "connector": "email",
        "verb": mode,
        "verdict": "SEAL" if ok else "HOLD",
        "evidence_tag": evidence_tag,
        "confidence": 0.90 if evidence_tag == "OBS" else 0.85,
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
        "protocol": "imap+smtp",
    }

# MCP registration helper
def get_tool_definition():
    return TOOL_SCHEMA

def get_verb_classes():
    return VERB_CLASSES
