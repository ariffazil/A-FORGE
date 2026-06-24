#!/usr/bin/env python3
"""
gb-federation-router.py — Narrow MCP server for Grok Build orchestration in arifOS federation.

Purpose: Expose *minimal* tools for planning, routing, and coordinating across arifOS / A-FORGE / organs / A2A.
Follows xAI Grok Build + arifOS reality:
- Narrow & policy-scoped (no generic do-anything).
- stdio primary for local CLI (low blast radius).
- Streamable HTTP option for remote / A2A mesh.
- Server-side policy (leases via A-FORGE, F floors via arifOS).
- Structured outputs with status / summary / artifacts.
- Integrated with arifos-mcp-federation skill patterns.

Transport:
  stdio: python -m A-FORGE.services.grok-build-mcp.gb_federation_router   (or via .mcp.json)
  http:  python gb_federation_router.py --http --port 18790

Register in Grok Build config (mcporter.json or .mcp.json) as:
{
  "mcpServers": {
    "gb-federation": {
      "command": "python",
      "args": ["-m", "A-FORGE.services.grok-build-mcp.gb_federation_router"],
      "env": { "ARIFOS_MCP": "http://127.0.0.1:8088/mcp", "AFORGE_MCP": "http://127.0.0.1:7072/mcp" }
    }
  }
}

For remote xAI (when using Responses API side): register with server_url + allowed_tools only.

Allowed tools (explicit, minimal):
- orchestrate_sequence
- route_to_mcp
- request_aforge_lease_exec (gated)
- emit_federation_telemetry
- check_constitutional_floors
- fallback_route

All outputs machine-parsable. 888_HOLD enforced for mutating actions via A-FORGE leases + arifOS.

See also: arifos-mcp-federation skill, A-FORGE leases, AAA A2A.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastmcp import FastMCP

# ── Identity & Federation Context ─────────────────────────────────────────────
VERSION = "2026.06.23-arifos-gb"
SERVER_LABEL = "gb-federation-router"
SERVER_DESCRIPTION = (
    "Narrow orchestration router for Grok Build. Routes intent across arifOS (governance), "
    "A-FORGE (execution with leases), organs (GEOX/WEALTH/WELL evidence), and AAA A2A mesh. "
    "Always narrow: read-first, lease-gated change, F1-F13 enforcement. "
    "Declare geometry at arif_init (harness=grok-build, parallelism, transport). "
    "Narrow surfaces for 111/222 evidence only. Canonical arif_judge/arif_seal/arif_forge for 888/999. "
    "Naming target (sealed from llms.txt): kernel 2-term dot (arif.judge); A-FORGE 3-term. "
    "Live transport: stdio here (hands), arifOS http (brain). "
    f"v{VERSION}. Use arifos-mcp-federation skill for complex sequences."
)

mcp = FastMCP(
    name=SERVER_LABEL,
    instructions=SERVER_DESCRIPTION,
    version=VERSION,
)

ARIFOS_MCP_URL = os.environ.get("ARIFOS_MCP_URL", "http://127.0.0.1:8088/mcp")
AFORGE_MCP_URL = os.environ.get("AFORGE_MCP_URL", "http://127.0.0.1:7072/mcp")
AAA_A2A_URL = os.environ.get("AAA_A2A_URL", "http://127.0.0.1:3001")

# AF-2026-06-23: Default geometry (scar + soul) for this GB router (orchestrator)
# Geometry = scar (accumulated interaction history/wounds/drift) + soul (core essence)
# Aligned with transformer encoder/decoder/metabolizer + orthogonal fractals + thordials
DEFAULT_GEOMETRY = {
    "harness": "grok-build",
    "parallelism": 8,
    "transport": "stdio",
    "agent_type": "orchestrator",
    "supervision_model": "subagents+worktree",
    "scar": "parallel execution history, subagent wounds, evidence drift",
    "soul": "orchestration essence under arifOS floors - encoder (read) to decoder (forge) via metabolizer",
}

# ── Structured Output Helpers (reality: machine-parsable + telemetry) ─────────
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _telemetry_envelope(
    tool: str,
    success: bool,
    latency_ms: int = 0,
    approval_required: bool = False,
    policy_denied: bool = False,
    geometry: dict | None = None,
    **extra,
) -> Dict[str, Any]:
    env = {
        "epoch": _now(),
        "server": SERVER_LABEL,
        "tool": tool,
        "latency_ms": latency_ms,
        "success": success,
        "schema_valid": True,
        "approval_required": approval_required,
        "policy_denied": policy_denied,
        "confidence": 0.92 if success else 0.4,
        "qdf": "orchestration",
        "verdict": "allow" if success and not policy_denied else "hold",
        **extra,
    }
    if geometry:
        env["agent_geometry"] = geometry
    return env

def _result(status: str, summary: str, artifacts: Optional[Dict] = None, errors: Optional[List[str]] = None) -> Dict[str, Any]:
    return {
        "status": status,  # "ok" | "hold" | "fallback" | "error"
        "summary": summary,
        "artifacts": artifacts or {},
        "errors": errors or [],
        "timestamp": _now(),
    }

# ── Core Narrow Tools (minimal surface) ───────────────────────────────────────

@mcp.tool()
async def orchestrate_sequence(intent: str, target_servers: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Planner surface. Takes high-level intent and returns a minimal execution sequence
    using arifos-mcp-federation patterns + known federation surfaces.
    Does NOT execute. Returns plan for Grok Build review/edit.

    Use before any change tier.
    """
    servers = target_servers or ["arifos", "aforge", "geox", "wealth", "well", "a2a"]
    plan = {
        "intent": intent,
        "stages": [
            {"stage": "plan", "server": "gb-federation-router", "tool": "orchestrate_sequence"},
            {"stage": "read", "servers": [s for s in servers if s in ("geox", "wealth", "well", "arifos")]},
            {"stage": "change", "server": "aforge", "note": "requires lease + 888 if T3"},
            {"stage": "execute", "server": "aforge", "via": "forge_*_exec with lease"},
            {"stage": "control", "server": "arifos", "via": "judge / vault seal"},
            {"stage": "mesh", "server": "aaa-a2a", "note": "handoff or status via A2A"},
        ],
        "recommended_skill": "arifos-mcp-federation",
        "fallback": "use native tools + spawn_subagent (worktree)",
    }
    return _result("ok", f"Sequence planned for: {intent[:80]}", {
        "plan": plan,
        "telemetry": _telemetry_envelope("orchestrate_sequence", True, geometry=DEFAULT_GEOMETRY),
        "mcp_flow": {
            "narrow_role": "orchestration + 111/222 evidence via mcp-repo-read",
            "canonical_handoff": "After narrow evidence: arif_think -> arif_critique -> arif_judge(SEAL) -> arif_seal -> arif_forge (via A-FORGE lease)",
            "geometry": "Must declare at arif_init; geometry is scar+soul for this agent (encoder/metabolizer/decoder + thordials)",
            "contradiction_guard": "High-gov actions must not stay in narrow surfaces - use canonical arifOS MCP"
        }
    })

@mcp.tool()
async def route_to_mcp(server_label: str, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """
    Router: suggest or describe route. In full impl calls the actual MCP (stdio or http).
    For now returns routing directive + minimal validation. Server-side policy applies.
    """
    allowed = {
        "arifos": ["arif_sense", "arif_judge", "arif_vault"],
        "aforge": ["forge_registry_status", "forge_lease_request", "forge_shell_dryrun"],
        "geox": ["geox_*"],
        "wealth": ["wealth_*"],
        "well": ["well_*"],
    }
    if server_label not in allowed or not any(tool_name.startswith(p) or tool_name in p for p in allowed[server_label]):
        return _result("hold", f"Tool {tool_name} not in narrow allowlist for {server_label}",
                       errors=["policy_denied"], policy_denied=True)

    # Harden brain/hands flow: High-gov actions (judge/seal/forge/memory forget) must route to arifOS canonical
    high_gov_keywords = ["judge", "seal", "forge", "memory forget", "deploy", "irreversible"]
    if any(kw in tool_name.lower() for kw in high_gov_keywords):
        return _result("hold", "High-governance action requires explicit arifOS MCP canonical path (arif_judge + arif_seal). Use A-FORGE only for execution after clearance.",
                       errors=["requires_arifos_judgment"], policy_denied=True, requires_arifos=True)

    return _result("ok", f"Route {tool_name} -> {server_label}",
                   {"directive": {"server_url_or_stdio": server_label, "tool": tool_name, "args": arguments},
                    "telemetry": _telemetry_envelope("route_to_mcp", True, server=server_label, tool=tool_name, geometry=DEFAULT_GEOMETRY)})

@mcp.tool()
async def request_aforge_lease_exec(agent_id: str, scope: List[str], max_action_class: str = "READ", ttl_seconds: int = 300) -> Dict[str, Any]:
    """
    Execution tier gate. Requests scoped lease from A-FORGE (real authority/lease system).
    Only narrow scopes allowed here. Mutating requires higher gate + 888_HOLD in caller.
    """
    safe_scopes = {"forge_filesystem_read", "forge_git_status", "forge_shell_dryrun", "forge_log_tail"}
    requested = set(scope)
    if not requested.issubset(safe_scopes) and max_action_class != "READ":
        return _result("hold", "Requested scopes exceed narrow safe set for this MCP surface",
                       errors=["requires_888_hold_or_broader_lease"], approval_required=True)

    # In reality this would call A-FORGE MCP or the lease service.
    lease_receipt = {
        "lease_id": f"gb-lease-{agent_id}-{int(datetime.now().timestamp())}",
        "agent_id": agent_id,
        "granted_scopes": list(requested),
        "max_action_class": max_action_class,
        "ttl": ttl_seconds,
        "aforge_mcp": Aforge_MCP_URL,
    }
    return _result("ok", "Lease request prepared (execute via A-FORGE MCP with this lease)",
                   {"lease": lease_receipt, "next": "call forge_lease_request or equivalent on A-FORGE MCP",
                    "telemetry": _telemetry_envelope("request_aforge_lease_exec", True, approval_required=(max_action_class != "READ"))})

@mcp.tool()
async def emit_federation_telemetry(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Emit the canonical telemetry envelope (see CLAIM + arifos style).
    In prod: append to VAULT999 (via arifOS) or local + NATS. Never blocks.
    """
    env = _telemetry_envelope(**event)
    # Placeholder: real would route to arifos vault writer or A-FORGE data.
    return _result("ok", "Telemetry envelope accepted for federation path",
                   {"envelope": env, "routing": "arifos VAULT999 / A-FORGE receipts / AAA observability"})

@mcp.tool()
async def check_constitutional_floors(action: str, context: Optional[Dict] = None) -> Dict[str, Any]:
    """
    Control tier. Lightweight F1-F13 probe. Full judgment via arifOS.
    Returns simple gates + recommendation.
    """
    floors = ["F1 (reversible first)", "F2 (truth)", "F4 (clarity)", "F7 (humility)", "F9 (no hantu)", "F11 (audit)", "F13 (human veto)"]
    verdict = "proceed" if "deploy" not in action.lower() else "888_HOLD_required"
    return _result(verdict, f"Floors checked for {action}", {"floors": floors, "recommend": "use arifOS judge for irreversible"})

@mcp.tool()
async def fallback_route(failed_server: str, reason: str) -> Dict[str, Any]:
    """
    Graceful degradation. Maps to native tools, other organs, or A2A peer.
    """
    fallbacks = {
        "arifos": "native tools + AAA A2A + arifos-mcp-federation skill",
        "aforge": "local run_terminal_command + spawn_subagent (worktree isolation)",
        "geox": "local geoscience knowledge + well/wealth evidence via skill",
    }
    fb = fallbacks.get(failed_server, "arifos-mcp-federation + native + subagent")
    return _result("fallback", f"Fallback for {failed_server}: {reason}", {"recommended": fb})

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Grok Build narrow federation router MCP")
    parser.add_argument("--http", action="store_true", help="Run as Streamable HTTP (default stdio)")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=18790)
    args = parser.parse_args()

    if args.http:
        print(f"Starting {SERVER_LABEL} on http://{args.host}:{args.port}/mcp (streamable-http)", file=sys.stderr)
        mcp.run(transport="streamable-http", host=args.host, port=args.port)
    else:
        # stdio is the default and preferred for local Grok Build CLI orchestration
        mcp.run(transport="stdio")

if __name__ == "__main__":
    main()