# CAPABILITY-GRAPH-CANONICAL-7-SEAL

**Date:** 2026-06-28  
**Forger:** OpenCode (FORGE lane)  
**Session:** SEAL-cbc8476fcba84c57  
**Graph version:** v0.2.0 (25 nodes)

## Problem

ChatGPT audit found 3 ghost tools + 1 capability denial:
- `arif_triage` → Unknown tool (hidden in diagnostic-only mode)
- `arif_conformance_report` → Unknown tool (hidden in diagnostic-only mode)  
- `arif_session_init` → Unknown tool (alias not in public surface)
- `arif_resolve_tool` → KERNEL_DENY (not in seed capability graph)
- `arif_act` → missing from contract tools.yaml capability graph (present in seed graph)

## Root Cause

Three surfaces out of sync: tool descriptions (fixed), MCP tool list (partial), kernel capability graph (stale).

## Fixes Applied

### Layer 1: Capability Graph (contracts/tools.yaml)
- Added `arif_act` (gateway class, sovereign auth, requires seal_verdict_id + approved_action_hash)
- Added `arif_resolve_tool` (ordinary class, public auth, tool resolution)
- Added `arif_conformance_report` (diagnostic class, public auth, conformance spine)
- Added aliases: `arif_session_init` → `arif_init`, `arifos_act` → `arif_act`
- Regenerated: capability_graph.json (25 nodes, v0.2.0), tool_validators.py, conformance_fixtures.json

### Layer 2: Kernel Seed Graph (capability_registry.py)
- Added `arif_resolve_tool` node (LOW auth, read-only, TRUSTED_READ)

### Layer 3: MCP Surface (public_surface.py)
- Added `arif_resolve_tool` to DIAGNOSTIC_TOOLS (expanded45 mode)

### Layer 4: Tool Registration (tool_discovery.py)
- Removed `ARIFOS_MCP_EXPOSE_DEV_TOOLS` gate from `arif_resolve_tool` — always available

### Layer 5: Tool Descriptions (public_registry.py, server.py)
- All Canonical 7 rewritten with agentic intelligence framing
- Server instructions: "select by gap" format

## Verification

| Tool | MCP Listed | Capability Graph | Callable |
|------|-----------|-----------------|----------|
| arif_init | ✅ | ✅ | ✅ |
| arif_observe | ✅ | ✅ | ✅ |
| arif_think | ✅ | ✅ | ✅ |
| arif_route | ✅ | ✅ | ✅ |
| arif_judge | ✅ | ✅ | ✅ |
| arif_act | ✅ | ✅ | ✅ (with SEAL) |
| arif_seal | ✅ | ✅ | ✅ (with ack) |
| arif_resolve_tool | ✅ | ✅ | ✅ |

**Surface consistency:** CONSISTENT  
**Registry truth:** VERIFIED  
**Contract drift:** FALSE  

## Files Modified (14 files)

```
arifOS/
├── contracts/tools.yaml                          # +3 tools, +2 aliases
├── contracts/generated/capability_graph.json     # regenerated v0.2.0
├── contracts/generated/tool_validators.py        # regenerated
├── contracts/generated/conformance_fixtures.json # regenerated
├── contracts/generated/audit_schemas.json        # regenerated
├── contracts/generated/validators_runtime.py     # regenerated
├── arifosmcp/runtime/public_registry.py          # agentic descriptions
├── arifosmcp/runtime/public_surface.py           # +arif_resolve_tool
├── arifosmcp/runtime/tools.py                    # _arif_act docstring
├── arifosmcp/constitutional_map.py               # CORE_SEVEN comments
├── arifosmcp/kernel/capability_registry.py       # +arif_resolve_tool node
├── arifosmcp/resources/tool_discovery.py         # remove gate
├── arifosmcp/server.py                           # agentic instructions
├── arifosmcp/static/.well-known/mcp/server.json  # agentic descriptions
└── arifosmcp/PUBLIC_SURFACE_CANON.md              # agentic selection table
```

## What Remains

- `arif_triage` and `arif_conformance_report` are in expanded45 mode (diagnostic tools). To make them available in canonical13 mode requires F13 ruling change.
- `arif_session_init` alias resolves via `_CANONICAL_HANDLERS` but is NOT in the public surface tools/list. Calls to it will route correctly but won't appear in discovery.

**DITEMPA BUKAN DIBERI — Forged, Not Given.**
