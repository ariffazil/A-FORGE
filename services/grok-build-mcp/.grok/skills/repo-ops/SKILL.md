---
name: repo-ops
description: Sovereign repo operations for Grok Build in arifOS. Narrow read + escalation for write. Call as /repo-ops.
tags: [read, governance, adr, cooling]
floor_scope: ["F1", "F2", "F4", "F7", "F11", "F13"]
---

# repo-ops Skill

Reusable instructions for narrow orchestration.

## Usage
- `/repo-ops list adr` → use mcp-repo-read get_adr
- `/repo-ops recall cooling` → mcp-memory
- For changes: escalate to mcp-ops-change + A-FORGE lease + arifOS 888.

## Procedures
1. Always start with read tier (mcp-repo-read or native).
2. Check governance via mcp-memory search_governance or arifos-mcp-federation.
3. Never mutate without lease + HOLD gate.

See GB_MCP_ORCHESTRATION_LAYOUT.md for full topology and hybrid (multi-agent research → this).
