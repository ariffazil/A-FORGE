# Hermes MCP Topology Fix — 2026-07-07

## Problem
Hermes agent had broken MCP server connections and a suboptimal routing topology.

## Findings

### Gateway Config (`/root/.hermes/config.yaml`)
Already had direct organ MCP endpoints configured:
- `arifos` → :8088 (streamable-http) ✅
- `geox` → :8081/mcp/ (streamable-http) ✅
- `wealth` → :18082/mcp (streamable-http) ✅
- `well` → :18083/mcp (streamable-http) ✅
- `aforge` → :7072/mcp (streamable-http) ✅ (intermittent drops)
- `hermes` → :18086/mcp (streamable-http) ❌ → FIXED
- `openclaw` → :18789/mcp (streamable-http) ❌ → REMOVED (not MCP server)

### Agent Config (`/root/.openclaw/workspace/agents/hermes-asi/config/config.yaml`)
Only had ONE MCP server:
```yaml
mcp_servers:
  - id: arifos-mcp
    url: https://mcp.arif-fazil.com/mcp
```
This was the 4-hop path: Hermes → mcp.arif-fazil.com → Caddy → arifOS(:8088) → organ proxy.

### Fixes Applied

1. **Hermes MCP (:18086)** — `hermes_mcp.py` was hardcoded to stdio transport. Modified to support HTTP via env vars:
   - `HERMES_MCP_TRANSPORT=streamable-http`
   - `HERMES_MCP_HOST=127.0.0.1`
   - `HERMES_MCP_PORT=18086`
   - Now running and responding on :18086/mcp

2. **OpenClaw MCP** — Removed from gateway config. `:18789` runs a Telegram bot (`bot.py`), not an MCP server.

3. **Gateway restart** — Restarted `hermes-asi-gateway.service` to pick up config changes.

### Current Topology (post-fix)
```
Hermes Gateway
  ├── arifos  → :8088/mcp  (F1-F13, judge, vault, route)
  ├── geox    → :8081/mcp/ (68 tools, seismic, petrophysics, basin)
  ├── wealth  → :18082/mcp (EMV, NPV, Monte Carlo, conservation)
  ├── well    → :18083/mcp (vitality, readiness, dignity)
  ├── aforge  → :7072/mcp  (build, deploy, shell, git)
  └── hermes  → :18086/mcp (diagnostic/governance tools)
```

### MCP Transport Status
| Organ | Port | Transport | Status |
|-------|------|-----------|--------|
| arifOS | :8088 | streamable-http | ✅ |
| GEOX | :8081 | SSE → streamable-http | ✅ |
| WEALTH | :18082 | streamable-http | ✅ |
| WELL | :18083 | streamable-http | ✅ |
| A-FORGE | :7072 | streamable-http | ✅ (intermittent) |
| Hermes | :18086 | streamable-http | ✅ (newly fixed) |

### Recommendation
- GEOX on HTTP is correct for shared-organ, multi-agent architecture
- FastMCP CLI not needed — organs already use FastMCP 3.4.2 as HTTP servers
- The real optimization was fixing the broken connections, not changing transport
- A-FORGE connection drops need monitoring (may be session management issue)

### MCP Spec Alignment
Per MCP spec 2025-06-18: HTTP is first-class for shared servers. Stdio is for per-session local tools. Federation organs are shared → HTTP correct.

## Files Modified
- `/root/.hermes/mcp_servers/hermes_mcp.py` — stdio → HTTP transport
- `/root/.hermes/config.yaml` — removed `openclaw` MCP entry

## Sovereign Note
All changes are reversible. No production data touched. Gateway restart was T2 (announced).
