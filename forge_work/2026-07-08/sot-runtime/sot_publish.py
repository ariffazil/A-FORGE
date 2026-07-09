#!/usr/bin/env python3
"""
sot_publish.py — arifOS Federation SOT Publisher
================================================

Agentic design: DYNAMIC = live organ state. STATIC = schema + floors.
This script scrapes each organ's /mcp and /health, validates against
the static schema, and emits ARIFOS_SOT_LIVE.json.

Run: python3 sot_publish.py
Cron: daily (proposed: /etc/cron.d/arifos-sot-publish)

DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

from __future__ import annotations

import http.client
import json
import socket
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA_PATH = Path(__file__).parent / "SOT_SCHEMA.json"
OUTPUT_PATH = Path(__file__).parent / "ARIFOS_SOT_LIVE.json"
TIMEOUT_SEC = 5

# ── STATIC: organ registry. Adding/removing an organ is F13. ──────────
ORGANS: dict[str, dict[str, Any]] = {
    "arifOS":   {"host": "127.0.0.1", "health_port": 8088,  "mcp_port": 8088,  "protocol": "mcp",    "kind": "kernel"},
    "A-FORGE":  {"host": "127.0.0.1", "health_port": 7071,  "mcp_port": 7072,  "protocol": "mcp",    "kind": "executor"},
    "AAA":      {"host": "127.0.0.1", "health_port": 3001,  "mcp_port": None,  "protocol": "a2a",    "kind": "control_plane"},
    "GEOX":     {"host": "127.0.0.1", "health_port": 8081,  "mcp_port": 8081,  "protocol": "mcp",    "kind": "earth_intel"},
    "WEALTH":   {"host": "127.0.0.1", "health_port": 18082, "mcp_port": 18082, "protocol": "mcp",    "kind": "capital_intel"},
    "WELL":     {"host": "127.0.0.1", "health_port": 18083, "mcp_port": 18083, "protocol": "mcp",    "kind": "human_readiness"},
    "VAULT999": {"host": None,         "health_port": None,  "mcp_port": None,  "protocol": "ledger", "kind": "ledger"},
}


def _http(host: str, port: int, method: str, path: str, payload: dict | None = None) -> dict | None:
    try:
        conn = http.client.HTTPConnection(host, port, timeout=TIMEOUT_SEC)
        body = json.dumps(payload or {}).encode() if payload else b""
        conn.request(method, path, body=body, headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        })
        r = conn.getresponse()
        raw = r.read().decode("utf-8", errors="replace")
        conn.close()
        return json.loads(raw)
    except (OSError, socket.timeout, json.JSONDecodeError, ConnectionRefusedError):
        return None


def _classify_tool(t: dict) -> str:
    """DYNAMIC: per-tool classification. Returns canonical|deprecated|experimental|unmarked."""
    ann = t.get("annotations") or {}
    meta = t.get("_meta") or {}
    if meta.get("canonical") is True or ann.get("canonical") is True:
        return "canonical"
    if meta.get("deprecated") is True or ann.get("deprecated") is True:
        return "deprecated"
    if meta.get("experimental") is True or ann.get("experimental") is True:
        return "experimental"
    return "unmarked"


def _probe_organ(name: str, ep: dict[str, Any]) -> dict[str, Any]:
    """DYNAMIC: probe one organ. Pure function of live state."""
    host = ep["host"]
    health_port = ep.get("health_port")
    mcp_port = ep.get("mcp_port")
    protocol = ep.get("protocol", "mcp")

    # Ledger organ
    if not host:
        return {
            "endpoint": "ledger://VAULT999", "protocol": "ledger",
            "status": "maintenance", "tool_count": 0,
            "canonical_count": 0, "deprecated_count": 0,
            "experimental_count": 0, "version": "ledger",
            "identity_hash_prefix": None, "tools": [],
        }

    health = _http(host, health_port, "GET", "/health") or {}
    version = health.get("version") or health.get("v") or "unknown"
    identity_hash = (
        (health.get("identity_hash") or {}).get("hash", "")
        if isinstance(health.get("identity_hash"), dict)
        else str(health.get("identity_hash") or "")
    )

    # A2A organ — no MCP tools
    if protocol == "a2a":
        return {
            "endpoint": f"http://{host}:{health_port}",
            "port": health_port, "protocol": "a2a",
            "status": "healthy" if health else "unreachable",
            "tool_count": 0,
            "canonical_count": 0, "deprecated_count": 0,
            "experimental_count": 0, "version": version,
            "identity_hash_prefix": identity_hash[:8] if identity_hash else None,
            "tools": [],
            "note": "A2A gateway — tools governed via agent cards, not MCP list_tools",
        }

    # MCP organ — probe /mcp
    tools: list[dict] = []
    canonical_count = deprecated_count = experimental_count = 0
    rpc = _http(host, mcp_port, "POST", "/mcp",
                {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}) if mcp_port else None

    if rpc and "result" in rpc:
        for t in rpc["result"].get("tools", []):
            tool_name = t.get("name", "")
            if not tool_name:
                continue
            status = _classify_tool(t)
            if status == "canonical":
                canonical_count += 1
            elif status == "deprecated":
                deprecated_count += 1
            elif status == "experimental":
                experimental_count += 1
            ann = t.get("annotations") or {}
            tools.append({
                "name": tool_name,
                "status": status,
                "title": t.get("title") or ann.get("title"),
                "description_excerpt": (t.get("description") or "")[:120],
            })

    if rpc is None:
        status = "unreachable"
    elif health.get("status") == "degraded":
        status = "degraded"
    else:
        status = "healthy" if tools else "degraded"

    return {
        "endpoint": f"http://{host}:{mcp_port}/mcp",
        "port": mcp_port, "protocol": "mcp", "status": status,
        "tool_count": len(tools),
        "canonical_count": canonical_count,
        "deprecated_count": deprecated_count,
        "experimental_count": experimental_count,
        "version": version,
        "identity_hash_prefix": identity_hash[:8] if identity_hash else None,
        "tools": tools,
    }


def _load_schema() -> dict:
    """STATIC: load the contract. Fails closed if missing."""
    if not SCHEMA_PATH.exists():
        sys.exit(f"FATAL: schema not found at {SCHEMA_PATH}. SOT cannot proceed without contract.")
    return json.loads(SCHEMA_PATH.read_text())


def main() -> int:
    schema = _load_schema()
    dynamic: dict[str, Any] = {
        "last_verified_utc": datetime.now(timezone.utc).isoformat(),
        "schema_drift": [],
        "unreachable_organs": [],
        "organs": {},
    }

    for name, ep in ORGANS.items():
        result = _probe_organ(name, ep)
        if result["status"] == "unreachable":
            dynamic["unreachable_organs"].append(name)
        dynamic["organs"][name] = result
        # Surface unmarked tools as schema drift
        for tool in result.get("tools", []):
            if tool.get("status") == "unmarked":
                dynamic["schema_drift"].append(f"{name}/{tool['name']}: unmarked")

    sot = {
        "schema_version": schema["schema_version"],
        "invariants": schema["invariants"],
        "dynamic_state": dynamic,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(sot, indent=2) + "\n")

    # Compact human-readable report
    print("=" * 78)
    print(f"ARIFOS FEDERATION SOT — {dynamic['last_verified_utc']}")
    print("=" * 78)
    for name, body in dynamic["organs"].items():
        print(
            f"  {name:10s}  status={body['status']:11s}  "
            f"tools={body['tool_count']:>4d}  "
            f"canonical={body['canonical_count']:>4d}  "
            f"deprecated={body['deprecated_count']:>3d}  "
            f"experimental={body['experimental_count']:>3d}  "
            f"protocol={body.get('protocol', 'mcp')}"
        )
    if dynamic["unreachable_organs"]:
        print(f"\n  UNREACHABLE: {', '.join(dynamic['unreachable_organs'])}")
    if dynamic["schema_drift"]:
        print(f"\n  SCHEMA DRIFT: {len(dynamic['schema_drift'])} tools lack canonical/deprecated flag")
        for d in dynamic["schema_drift"][:5]:
            print(f"    - {d}")
        if len(dynamic["schema_drift"]) > 5:
            print(f"    ... and {len(dynamic['schema_drift']) - 5} more")
    else:
        print(f"\n  SCHEMA DRIFT: none — every tool carries canonical/deprecated/experimental flag")
    print(f"\n  Output: {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
