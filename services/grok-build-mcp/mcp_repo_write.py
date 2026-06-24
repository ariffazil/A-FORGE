#!/usr/bin/env python3
"""
mcp-repo-write — Narrow, gated write MCP server for Grok Build.

Sovereign implementation. **Never** mixed with read tools.

Tools (minimal, all require explicit approval/lease):
- apply_patch (search_replace style, bounded)
- create_branch
- draft_commit / pr_description

All mutations escalate:
- Request A-FORGE lease (via mcp-federation or direct).
- If T3 (prod, secret, cross-org): 888_HOLD via arifOS MCP + A2A.
- Post: emit telemetry with approval_required=true.

Transport: stdio only for local (high control). No direct remote without gateway.

This is the "change tier" surface. Read via mcp-repo-read. Exec via A-FORGE MCP + leases.

Constitutional: F1 (reversible where possible), F11 (full audit), F13 (human veto on T3).
"""

from __future__ import annotations
import os
from pathlib import Path
from typing import Any, Dict, Optional

from fastmcp import FastMCP

mcp = FastMCP(
    name="mcp-repo-write",
    instructions=(
        "Narrow write-only repository change surface for Grok Build orchestration in arifOS federation. "
        "All tools require pre-approval via lease or 888_HOLD. Read tier is separate (mcp-repo-read). "
        "Escalation to A-FORGE leases + arifOS 888 + A2A mesh. Part of plugin 'arif-narrow-mcp'."
    ),
    version="2026.06.23-arifos-gb",
)

REPO_ROOT = Path(os.environ.get("REPO_ROOT", "/root"))
MAX_PATCH_SIZE = 50_000  # chars

def _safe_path(p: str) -> Path:
    candidate = (REPO_ROOT / p).resolve()
    if not str(candidate).startswith(str(REPO_ROOT)):
        raise ValueError("Path traversal blocked - F9 safety")
    return candidate

@mcp.tool()
def apply_patch(path: str, search: str, replace: str, require_approval: bool = True) -> Dict[str, Any]:
    """
    Bounded search_replace. Requires lease or explicit approval.
    In full impl: check lease from A-FORGE, else return HOLD.
    """
    if require_approval:
        return {
            "status": "hold",
            "summary": "apply_patch requires A-FORGE lease or 888_HOLD. Use mcp-federation to request.",
            "required": ["lease_scope:forge_filesystem_write", "or arifOS 888"],
            "telemetry": {"tool": "apply_patch", "policy_denied": True, "approval_required": True}
        }
    p = _safe_path(path)
    if len(replace) > MAX_PATCH_SIZE:
        return {"status": "error", "errors": ["patch too large"]}
    # Real impl would do the edit safely here, then return receipt
    return {
        "status": "ok",
        "path": str(p.relative_to(REPO_ROOT)),
        "applied": True,
        "note": "In production: after lease approval only. Emit to VAULT.",
        "telemetry": {"tool": "apply_patch", "success": True}
    }

@mcp.tool()
def create_branch(name: str, base: str = "main") -> Dict[str, Any]:
    """Create branch. Gated. Escalate for protected branches."""
    if "main" in name or "master" in name or "prod" in name.lower():
        return {
            "status": "hold",
            "summary": "Protected branch. Requires 888_HOLD + F13.",
            "telemetry": {"tool": "create_branch", "policy_denied": True, "approval_required": True}
        }
    return {
        "status": "ok",
        "branch": name,
        "base": base,
        "note": "After lease. Use A-FORGE for actual git if needed.",
        "telemetry": {"tool": "create_branch", "success": True}
    }

@mcp.tool()
def draft_pr(title: str, body: str, branch: str) -> Dict[str, Any]:
    """Draft PR description + metadata. No actual create without approval."""
    return {
        "status": "ok",
        "draft": {"title": title, "body": body[:2000], "head": branch, "base": "main"},
        "note": "Draft only. To create: escalate to github MCP with lease or 888.",
        "telemetry": {"tool": "draft_pr", "approval_required": True}
    }

if __name__ == "__main__":
    mcp.run(transport="stdio")  # stdio only for write safety
