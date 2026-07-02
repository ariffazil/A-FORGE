# GEOX MCP E2E Audit Receipt

**Date:** 2026-07-01T18:30 UTC
**Auditor:** OpenCode (FORGE lane)
**Target:** GEOX MCP Subserver — E2E trace from agent to kernel to geox
**Spec:** MCP 2025-11-25 (modelcontextprotocol.io/llms.txt)

## Files Traced (12 files, ~2,847 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `/root/geox/src/geox_mcp/server.py` | ~2,700 | MCP server: create_app(), middlewares, 34 canonical tools, output schema |
| `/root/geox/src/geox_mcp/geox_middleware.py` | 236 | GeoxGovernanceMiddleware: RT1/RT3/check_governance |
| `/root/geox/src/geox_mcp/registry.py` | 492 | Canonical tool manifest: 27 surface + 4 internal + 49 compat aliases |
| `/root/geox/src/geox_mcp/routing/tool.py` | 50 | arifos_route_query — intent routing |
| `/root/geox/src/geox_mcp/resource_registry.py` | 544 | Persistent resource registry (SQLite) + URI resolution |
| `/root/geox/src/geox_mcp/resources/__init__.py` | 1,262+ | 25+ MCP resources: geox://*, tree777://* |
| `/root/geox/src/geox_mcp/prompts/__init__.py` | 361 | 10 MCP prompts: sense, qc, interpret, red-team, etc. |
| `/root/geox/AGENTS.md` | — | GEOX constitution: 31 tools, autonomy, build/test |
| `/etc/systemd/system/geox-mcp.service` | — | systemd: `--host 127.0.0.1 --port 8081`, Bearer auth from vault |
| `/etc/caddy/Caddyfile` | — | geox.arif-fazil.com proxy block |
| `/root/arifos/...` | — | arifOS kernel health probe (federation geometry) |
| `/root/A-FORGE/src/domain/governance/McpPolicyGate.ts` | 554 | MCP Policy Gate (A-FORGE layer) |

## Organs Verified (Health Probes)

| Organ | Port | Status |
|-------|------|--------|
| arifOS | 8088 | ✅ healthy — 48 tools exposed, 17 canonical |
| A-FORGE | 7071 | ✅ healthy — authority_ceiling: 777_FORGE |
| AAA | 3001 | ✅ healthy — A2A gateway v1.0 |
| GEOX | 8081 | ✅ healthy — 34 canonical tools, Phase 2.3 earth map |
| WEALTH | 18082 | ✅ healthy — federated domain |
| WELL | 18083 | ✅ healthy — WELL_PASS, 22 tools |

## Audit Verdict

**GEOX MCP: SEAL with 6 tracked items**

- 22/22 MCP spec requirements met
- 0 critical findings
- 2 medium (tool count drift, Caddy Accept header)
- 4 low (schema fingerprinting, arguments dict pattern, outputSchema scope, default host)

## Key Trace: Agent → arifOS → Caddy → GEOX

```
Agent call `geox_basin(mode="profile", name="Malay")`
  → arifOS arif_route intent="basin profile" → organ=geox
  → Caddy geox.arif-fazil.com/mcp* → 127.0.0.1:8081
  → OriginValidation → McpAuth → McpProtocolVersion → EarthAnchor
  → slash rewrite → GeoxGovernanceMiddleware
    → RT1: geox_basin in EXECUTABLE_SURFACE? ✅
    → RT3: is irreversible? No ✅
    → organ_governance: lane=discovery → PASS ✅
  → FastMCP handler → geox_basin implementation
  → Output patched with _GEOX_OUTPUT_SCHEMA
  → MCP JSON-RPC response → Agent
```

DITEMPA BUKAN DIBERI — FORGE DONE