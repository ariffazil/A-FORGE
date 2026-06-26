# Grok Build Narrow MCP Servers for arifOS Federation

**Forge date:** 2026-06-23 (extended with skills/plugins/hooks per xAI Grok Build extension surface)
**Owner:** Grok Build (AAA citizen) + A-FORGE execution + arifOS kernel

These are **narrow, policy-scoped** capability surfaces designed for Grok Build CLI orchestration inside the real arifOS / AAA / A-FORGE federation.

**Extension Model Integration (from xAI docs):**
- Skills = reusable instructions/playbooks (see .grok/skills/repo-ops/SKILL.md, callable as /repo-ops).
- Plugins = bundles (skills + hooks + MCP servers). See .grok/plugins/arif-narrow-mcp/plugin.toml.
- Hooks = lifecycle (pre_tool_governance.py for policy/deny/audit).
- MCPs = tool plane (this package).
- Subagents = parallel (Grok Build native + spawn_subagent).
- Claude compat: Grok reads .grok/ + AGENTS.md + CLAUDE.md.

They follow the spirit of the external guidance but are implemented against live reality:
- arifos-mcp-federation skill (the router / planner layer)
- A-FORGE MCP (7072) + lease system (authority scopes ≈ allowed_tools)
- arifOS MCP (8088) for governance / 888
- AAA A2A mesh for coordination
- Organ MCPs (geox/wealth/well) for evidence
- stdio for local low-blast-radius; Streamable HTTP for remote / A2A
- Read/write separation, server-side gates, structured outputs
- Minimum tools only

## Recommended Topology (Reality)

1. **Planner / Router**: Grok Build + `arifos-mcp-federation` skill (or this gb-federation-router)
2. **Read tier**: GEOX/WEALTH/WELL + arifOS sense + narrow repo (native or gb: mcp-repo-read)
3. **Change tier**: A-FORGE lease-gated (mcp-repo-write)
4. **Execution tier**: A-FORGE (tests, build, staging deploy via forge_* tools + lease)
5. **Control tier**: arifOS (judge, vault, floors) + AAA A2A handoff
6. **Memory / Governance**: mcp-memory + AAA memory + arifOS L1-L6 + Cooling Ledger/Dream Engine

**One server per trust boundary.** Never a monolithic "everything" MCP. Bundle via plugin for Grok discovery (/plugins, /mcps, /skills, /hooks).

## The Servers Here

### gb_federation_router.py (stdio + http)

Minimal orchestration surface (6 tools) — 555_ROUTE / Planner layer:
- Function mode: 555_ROUTE (canonical arif_route)
- Cognitive action: route + orchestrate (boundary metabolizer)
- `orchestrate_sequence` — returns editable plan + canonical_handoff + geometry (use before mutation)
- `route_to_mcp` — narrow router with allowlist + stage mapping
- `request_aforge_lease_exec` — bridge to A-FORGE real lease system (scopes limited, requires prior canonical SEAL)
- `emit_federation_telemetry` — canonical envelope (to VAULT / receipts)
- `check_constitutional_floors` — lightweight F-gate (777_MEASURE)
- `fallback_route` — degradation to native / skill / A2A

All responses include: canonical_stage, cognitive_action, agent_geometry (scar+soul), handoff_to_canonical for gov paths.

Run stdio:
```bash
python -m A-FORGE.services.grok-build-mcp.gb_federation_router
```

Run http (for remote registration):
```bash
python A-FORGE/services/grok-build-mcp/gb_federation_router.py --http --port 18790
```

### mcp-arifos-kernel.py — Narrow Kernel Transport (2026-06-23)

The direct low-entropy transport of arifOS kernel (constitutional core, floors, judgment entry, entropy, rhythm hooks) to Grok Build.

**Why this reduces chaos:**
- arifOS MCP runtime/tools.py is ~17.8k LOC (all tools mixed).
- This server imports only what it needs from core + FS truth. 7 focused tools.
- Grok Build uses this (or mcp-memory + mcp-repo-read) for precise governed work instead of the full monolith.
- Daily closed loop (Pagi/Midday/Malam + Cooling + Dream) is first-class via `get_rhythm_context` + `record_malam_reflection`.

Run:
```bash
python mcp_arifos_kernel.py          # stdio
python mcp_arifos_kernel.py --http   # :18793
```

### mcp-repo-read (Evolved for Cognitive Clarity — 2026-06-23)

**See full design:** `DESIGN_mcp_repo_read.md`

Evolved from mechanical FS tools to a **clarifying cognitive instrument**:
- Consistent response envelope (summary first, reasoning, related_context, limitations, calm suggestions).
- Smart defaults in `read_file` (summary + outline + excerpt + auto-related for governance files).
- `query_context`: primary agentic synthesis entrypoint (natural query → evidence package).
- `get_adr` now returns synthesized + proactively related ADRs.
- All tools prioritize low mental overhead while staying strictly read-only and bounded.

Use this for grounded repo/ADR exploration before planning or after external research.

Run (stdio):
```bash
python -m A-FORGE.services.grok-build-mcp.mcp_repo_read
```

### Adding More Narrow Surfaces (pattern)

Create similar FastMCP servers for:
- `gb-repo-read` (only list/read/grep/symbol — no write)
- `gb-ci` (thin wrapper over A-FORGE test/build tools + lease)
- `gb-memory` (bridge to cognitive-memory + sequential-thinking services)

Register each separately in config so Grok Build (and the model) sees clear `server_label` + description.

## Config for Grok Build (Claude-style / mcporter)

See `mcp-configs/grok-build-mcp.example.json`.

Place or merge into the active mcp config that your Grok Build CLI reads (often `~/.config/...` or project mcporter.json / .mcp.json).

Example entry for this router (local stdio):
```json
"gb-federation": {
  "command": "python",
  "args": ["-m", "A-FORGE.services.grok-build-mcp.gb_federation_router"],
  "env": {
    "ARIFOS_MCP_URL": "http://127.0.0.1:8088/mcp",
    "AFORGE_MCP_URL": "http://127.0.0.1:7072/mcp",
    "AAA_A2A_URL": "http://127.0.0.1:3001"
  }
}
```

For remote (when declaring to xAI side):
```json
{
  "type": "mcp",
  "server_url": "http://127.0.0.1:18790/mcp",
  "server_label": "gb-federation-router",
  "server_description": "Narrow orchestration router for arifOS federation (A-FORGE leases + arifOS floors + A2A).",
  "allowed_tools": ["orchestrate_sequence", "route_to_mcp", "check_constitutional_floors", "emit_federation_telemetry"]
}
```

Also register the core federation ones with tight `allowed_tools`:
- A-FORGE MCP: only lease + dry-run + registry + safe exec
- arifOS: only sense/judge/vault read paths
- Organs: evidence only

## Metrics (the ones that matter here)

Use the envelope from `emit_federation_telemetry`:
- tool selection precision (did it pick the right narrow server first?)
- success / schema validity
- P50/P95 latency
- escalation / policy_denied rate
- read/write ratio (via scopes)
- context overhead (keep allowed_tools tiny)

Log to VAULT999 or A-FORGE receipts for F11.

## Security & Holds (real)

- Server-side: A-FORGE leases (authority objects), arifOS floors.
- 888_HOLD for any T3 (prod deploy, secret, vault write, destructive).
- One narrow server per trust boundary.
- Never omit allowed_tools when registering remote.
- Ephemeral creds + audit where possible.
- Local stdio for anything touching private FS or high-trust infra.

## Integration with Existing

- Primary router: `arifos-mcp-federation` skill (see /root/AAA/skills/arifos-mcp-federation/SKILL.md)
- Execution substrate: A-FORGE MCP + leases (see test-mcp.mjs and src/interfaces/mcp)
- A2A mesh: AAA (agent cards, handoff, discovery)
- Grok Build declaration: update in agents/grok-build/ + AAA_AGENTS_REGISTRY "toolbench"

## Next Forge Steps (if directed)

- Wire the Python router to actually proxy a couple calls (arifOS + A-FORGE).
- Add gb-repo-read.py narrow stdio server.
- Add A2A tool surface as MCP (thin).
- Update AAA mcp contracts + run mcp-smoke-test.
- 888 review + seal.

All irreversible paths go through 888_HOLD + F13.

DITEMPA BUKAN DIBERI.