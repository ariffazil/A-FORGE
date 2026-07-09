#!/usr/bin/env python3
"""Mint signed arif_init sessions for F3 witness pulses (Hermes / OpenClaw)."""

from __future__ import annotations

import base64
import json
import sys
import urllib.request
from pathlib import Path

from cryptography.hazmat.primitives.serialization import load_pem_private_key

BASE = "http://127.0.0.1:8088/mcp"
OUT = Path("/root/A-FORGE/forge_work/2026-07-09/F3-WITNESS-SESSIONS.json")

AGENTS = {
    "hermes": Path("/root/A-FORGE/IDENTITY/keys/hermes/hermes_ed25519_private.pem"),
    "openclaw": Path("/root/A-FORGE/IDENTITY/keys/openclaw/openclaw_ed25519_private.pem"),
}


def rpc(method, params=None, sid=None, rid=1):
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    if sid:
        headers["mcp-session-id"] = sid
    body = {"jsonrpc": "2.0", "id": rid, "method": method, "params": params or {}}
    req = urllib.request.Request(BASE, data=json.dumps(body).encode(), headers=headers)
    with urllib.request.urlopen(req, timeout=45) as resp:
        raw = resp.read().decode()
        newsid = resp.headers.get("mcp-session-id")
        if "data:" in raw:
            for line in raw.splitlines():
                if line.startswith("data:"):
                    return json.loads(line[5:].strip()), newsid
        return json.loads(raw), newsid


def jtool(r):
    return json.loads(r["result"]["content"][0]["text"])


def find_nonce(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in ("challenge_nonce", "pending_challenge_nonce") and isinstance(v, str) and len(v) > 10:
                return v
            found = find_nonce(v)
            if found:
                return found
    if isinstance(o, list):
        for v in o:
            found = find_nonce(v)
            if found:
                return found
    return None


def handshake(actor: str, priv_path: Path) -> dict:
    priv = load_pem_private_key(priv_path.read_bytes(), password=None)
    _, sid = rpc(
        "initialize",
        {
            "protocolVersion": "2025-11-25",
            "capabilities": {},
            "clientInfo": {"name": f"{actor}-f3-prep", "version": "1"},
        },
        rid=0,
    )
    r1, _ = rpc(
        "tools/call",
        {
            "name": "arif_init",
            "arguments": {
                "mode": "init",
                "actor_id": actor,
                "requested_authority": "EXECUTE_APPROVED",
                "intent": "F3 witness pulse prep",
            },
        },
        sid=sid,
        rid=1,
    )
    j1 = jtool(r1)
    n = find_nonce(j1)
    if not n:
        return {"actor": actor, "error": "no_challenge", "detail": j1.get("status")}
    sig = base64.b64encode(priv.sign(f"{actor}:{n}".encode())).decode()
    r2, _ = rpc(
        "tools/call",
        {
            "name": "arif_init",
            "arguments": {
                "mode": "init",
                "actor_id": actor,
                "nonce": n,
                "actor_signature": sig,
                "requested_authority": "EXECUTE_APPROVED",
                "intent": "F3 witness pulse",
            },
        },
        sid=sid,
        rid=2,
    )
    j2 = jtool(r2)
    res = j2.get("result") or {}
    return {
        "actor": actor,
        "session_id": res.get("session_id") or j2.get("session_id"),
        "actor_verified": bool(j2.get("actor_verified") or res.get("actor_verified")),
        "authority": res.get("authority"),
        "call_hash": j2.get("call_hash") or res.get("call_hash"),
    }


def main() -> int:
    out = {}
    for actor, path in AGENTS.items():
        if not path.is_file():
            out[actor] = {"error": f"missing private key {path}"}
            continue
        out[actor] = handshake(actor, path)
        print(json.dumps(out[actor]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2) + "\n")
    print(f"wrote {OUT}")
    return 0 if all(v.get("actor_verified") for v in out.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
