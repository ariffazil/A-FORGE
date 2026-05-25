# INVARIANTS.md — A-FORGE Execution Shell
> **DITEMPA BUKAN DIBERI** — Federated Source of Truth.
> **Owner:** A-FORGE
> **Last verified:** 2026-05-25

## Owns
- Agent execution workflows
- Build and deploy automation
- MCP tool registry and execution
- Personal OS (SovereignLoop, DailyLoop)
- Federation orchestration

## Does NOT Own
- Constitutional law (→ arifOS)
- GEOX earth intelligence (→ GEOX)
- WEALTH capital intelligence (→ WEALTH)
- WELL human readiness (→ WELL)

## Live Routing Invariants

| Service | Local target | Status |
|---------|-------------|--------|
| arifOS MCP | `127.0.0.1:8088` | ✅ LIVE |
| GEOX MCP | `127.0.0.1:18081` | ✅ LIVE |
| WEALTH MCP | `127.0.0.1:18082` | ✅ LIVE |
| WELL | disabled | ⛔ 404 |

## Public URLs

| Endpoint | URL |
|----------|-----|
| arifOS MCP | `https://arifos.arif-fazil.com/mcp` |
| GEOX MCP | `https://geox.arif-fazil.com/mcp` |
| WEALTH MCP | `https://wealth.arif-fazil.com/mcp` |

## MCP Config
- File: `.mcp.json`
- arifOS endpoint: `http://127.0.0.1:8088/mcp` (NOT 8080)
- GEOX endpoint: `http://127.0.0.1:18081/mcp` (NOT 8081)

## Forbidden Stale Assumptions
- ❌ arifOS MCP at `localhost:8080` — correct is `8088`
- ❌ GEOX MCP at `localhost:8081` — correct is `18081`
- ❌ WEALTH disabled — it is LIVE on `18082`
- ❌ WELL live — it is NOT DEPLOYED
- ❌ Any MCP config with hardcoded `8080` for arifOS

## Required Pre-Flight Check
```bash
./scripts/preflight-check-mcp.sh
```

## Related Files
- `AGENTS.md` — agent behavior rules
- `.mcp.json` — active MCP endpoints
- `scripts/preflight-check-mcp.sh` — MCP invariant validator
- `AGENT_KERNEL_START.md` — estate entry ritual
