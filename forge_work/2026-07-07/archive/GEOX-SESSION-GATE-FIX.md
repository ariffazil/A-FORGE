# GEOX Session Gate Fix — Foreman Report

**Date:** 2026-07-07
**Actor:** FORGE (000Ω) under F13 SOVEREIGN
**Prequest:** GEOX-NW-SABAH-AUDIT-2026-07-07.md

## Root Cause (3 layers)

| Layer | Issue | Block |
|-------|-------|-------|
| MCP Transport | `stateless_http=False` in server.py:2665 | FastMCP rejects ALL requests without Mcp-Session-Id |
| Migration Route | `geox_basin`, `geox_deep_time_state`, `geox_atlas` in migration map | Rewritten to dimension tools with `lane="reasoning"` |
| Lane Override | No mode-based overrides for read-only modes | `geox_model(mode="deep_time")` blocked as "reasoning" |

## Fixes

1. **server.py:2665** — `stateless_http=False` → `stateless_http=True`
2. **surface_migration.py** — Removed 3 tools from migration map (all have direct @mcp.tool registrations)
3. **organ_governance.py** — Added 7 mode-based lane overrides for read-only discovery tools

## Verification

| Tool | Before | After |
|------|--------|-------|
| `geox_deep_time_state(age_ma=10.5)` | SESSION_REQUIRED | OK |
| `geox_basin(name="northwest_sabah")` | SESSION_REQUIRED | OK |
| `geox_atlas(lat=5.188, lon=118.502)` | SESSION_REQUIRED | OK |

GEOX running in tmux session 'geox' :8081

DITEMPA BUKAN DIBERI
