# FORGE RECEIPT — 2026-06-28 MCP Transport Engineering Session

> **DITEMPA BUKAN DIBERI**
> **Timestamp:** 2026-06-28 06:35 UTC
> **Actor:** FORGE (000Ω) / OpenCode
> **Session type:** AUTO-DO + ANNOUNCE (T1/T2) + 888_HOLD Caddy fixes

## Changes Applied

| # | Fix | Files | Status | Verification |
|---|-----|-------|--------|-------------|
| 1 | Bearer token removed from mcporter configs → vault.flat.env | 3 files | ✅ | Token `969d067a...` gone from configs |
| 2 | PEER_SOVEREIGNS metadata fix (GEOX port, protocol versions) | `public_surface.py` | ✅ | GEOX port `18081→8081`, versions `2025-03-26→2025-11-25` |
| 3 | MCP-Protocol-Version header on A-FORGE | `serve.ts` | ✅ | Returns header on all responses |
| 4 | Fault_codes.py bogus version fix | `fault_codes.py` | ✅ | `2025-06-18` (NOT a real spec version) → `2025-11-25` |
| 5 | Session cleanup (DELETE /mcp + idle timeout + max age) | `serve.ts` | ✅ | DELETE/404 correct, health shows session info |
| 6 | Caddy: Host header normalization on WEALTH/WELL MCP routes | `Caddyfile` | ✅ | Validated, reloaded, all 4 MCP routes responding |
| 7 | Caddy: Accept header forwarding on all MCP routes | `Caddyfile` | ✅ | All MCP routes now forward Accept header |
| 8 | Caddy: DELETE in CORS allowed methods | `Caddyfile` | ✅ | `Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS` |
| 9 | A-FORGE tool schema strictification (36 tools) | `zod-compat.js` + `core.ts` | ✅ | SDK patched to add `.strict()`; registerTool wrapper |
| 10 | WELL: mcp_health_check removed | `server.py` | ✅ | SOMATIC_TOOLS, handler dict, manifest all clean |
| 11 | WELL: well_health_check hardened (4 dimensions) | `server.py` | ✅ | Returns machine·governance·intelligence·human |
| 12 | WEALTH: legacy aliases removed from tools/list | `server.py`, `pipeline.py` | ✅ | 3 aliases hidden, kept as internal functions |
| 13 | arifOS: hermes_vault_query → arif_vault_query | 14 files (10 P0) | ✅ | Deployed to /opt/arifos/app/, verified |
| 14 | Transport topology documented | `forge_work/MCP-TRANSPORT-TOPOLOGY.md` | ✅ | First canonical transport map |
| 15 | A-FORGE rate limiter (120 req/min per IP) | `serve.ts` | ✅ | `X-RateLimit-Remaining` header, 429 on overflow |

## Files Changed (total: ~30 files across 4 repos)

| Repo | Files |
|------|-------|
| **A-FORGE** | `serve.ts`, `core.ts` + SDK `zod-compat.js` |
| **arifOS** | `hermes.py`, `server.py`, `tool_discovery.py`, `constitutional_map.py`, `interceptor.py`, `capability_registry.py`, `public_surface.py`, `conformance_spine.py`, `tool_registry.json`, `tool_discovery_resource.py`, `bootstrap.py`, `reality_state.py`, `substrate_namespace_registry.py`, `fault_codes.py` |
| **WELL** | `server.py` |
| **WEALTH** | `server.py`, `pipeline.py` |
| **Caddy** | `Caddyfile` |
| **Config** | `mcporter.json` × 2, `vault.flat.env` |

## All Organs Verified

| Organ | Health | Tools | Status |
|-------|--------|-------|--------|
| arifOS :8088 | ✅ | 8 | `arif_vault_query` confirmed |
| A-FORGE MCP :7072 | ✅ | 0 (singleton) | Rate limiter active |
| GEOX :8081 | ✅ | 29 | Unchanged |
| WEALTH :18082 | ✅ | 25 | Legacy aliases removed |
| WELL :18083 | ✅ | 18 | `mcp_health_check` removed, 4-d health |
| AAA :3001 | ✅ | N/A (A2A) | Unchanged |
| Caddy | ✅ | All 4 public MCP | Validated, reloaded |
