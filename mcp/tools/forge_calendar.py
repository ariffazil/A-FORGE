"""forge_calendar.py — APA MCP Tool Wrapper for Calendar connector. APA v1.0."""

import json, hashlib, time
from datetime import datetime, timezone
import requests

BRIDGE_URL = "http://127.0.0.1:18094/execute"

TOOL_SCHEMA = {
    "name": "forge_calendar",
    "description": "Sovereign calendar via CalDAV. List, create, update, delete events. Find free slots.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "mode": {"type": "string", "enum": ["list_events","get_event","create_event","update_event","delete_event","find_free_slots"]},
            "start": {"type": "string", "description": "ISO8601 start time"},
            "end": {"type": "string", "description": "ISO8601 end time"},
            "uid": {"type": "string"},
            "summary": {"type": "string"},
            "location": {"type": "string"},
            "description": {"type": "string"},
            "duration_minutes": {"type": "integer", "default": 30},
            "limit": {"type": "integer", "default": 50},
            "lease_id": {"type": "string"},
            "actor_id": {"type": "string", "default": "333-AGI"},
            "session_id": {"type": "string"}
        },
        "required": ["mode"]
    }
}

VERB_CLASSES = {
    "list_events":      {"action_class": "OBSERVE", "requires_lease": False, "irreversible": False},
    "get_event":        {"action_class": "OBSERVE", "requires_lease": False, "irreversible": False},
    "create_event":     {"action_class": "MUTATE",  "requires_lease": True,  "irreversible": False},
    "update_event":     {"action_class": "MUTATE",  "requires_lease": True,  "irreversible": False},
    "delete_event":     {"action_class": "MUTATE",  "requires_lease": True,  "irreversible": True},
    "find_free_slots":  {"action_class": "OBSERVE", "requires_lease": False, "irreversible": False},
}

def execute(params: dict) -> dict:
    mode = params.get("mode", "list_events")
    verb = VERB_CLASSES.get(mode, {})
    t0 = time.time()
    
    if verb.get("requires_lease") and not params.get("lease_id"):
        return _envelope(mode, ok=False, error="LEASE_REQUIRED", evidence_tag="DER")
    if verb.get("irreversible") and not params.get("ack_irreversible"):
        return _envelope(mode, ok=False, error="ACK_IRREVERSIBLE_REQUIRED", evidence_tag="DER", gate="F13_SOVEREIGN")
    
    try:
        resp = requests.post(BRIDGE_URL, json=params, timeout=30)
        data = resp.json()
    except Exception as e:
        return _envelope(mode, ok=False, error=str(e), evidence_tag="DER")
    
    return _envelope(mode=mode, ok=data.get("ok", False), result=data.get("result"),
                     error=data.get("error"),
                     evidence_tag="OBS" if mode in ("list_events","get_event","find_free_slots") else "DER",
                     lease_id=params.get("lease_id"), actor_id=params.get("actor_id","333-AGI"),
                     session_id=params.get("session_id"),
                     latency_ms=int((time.time()-t0)*1000))

def _envelope(mode, ok, result=None, error=None, evidence_tag="OBS", lease_id=None, actor_id=None, session_id=None, latency_ms=0, gate=None):
    return {"ok": ok, "connector": "calendar", "verb": mode, "verdict": "SEAL" if ok else "HOLD",
            "evidence_tag": evidence_tag, "confidence": 0.90 if evidence_tag=="OBS" else 0.85,
            "result": result if ok else None, "error": error if not ok else None,
            "gate_triggered": gate, "lease_id": lease_id, "actor_id": actor_id,
            "session_id": session_id,
            "receipt": {"timestamp": datetime.now(timezone.utc).isoformat()},
            "latency_ms": latency_ms, "protocol": "caldav"}

def get_tool_definition(): return TOOL_SCHEMA
def get_verb_classes(): return VERB_CLASSES
