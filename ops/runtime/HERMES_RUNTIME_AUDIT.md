# HERMES_RUNTIME_AUDIT.md — A-FORGE Runtime State

> Runtime operational facts for Hermes agent when operating in A-FORGE context.
> Source: AAA/agents/hermes/MEMORY.md — canonical home is AAA.

## VPS System State (2026-05-05)
- VPS: af-forge (srv1325122.hstgr.cloud)
- Kernel: Linux 6.17 Ubuntu x86_64
- Disk: 193GB total, 79% used (~42GB free)
- RAM: 15Gi total, 3.4Gi used, 12Gi available
- Swap: 19Gi total, 1Gi used

## A-FORGE Container
- Container: `af-bridge-prod`
- Image: `a-forge-af-bridge`
- Port: 127.0.0.1:7071
- Transport: Express HTTP + MCP
- Health: healthy (up 14h)
- Network: arifos_core_network

## Federation Container Topology

| Container | Port | Status | Notes |
|-----------|------|--------|-------|
| arifosmcp | 8080 | healthy | 13 tools |
| af-bridge-prod | 7071 | healthy | A-FORGE |
| geox_eic | 8081, 8000 | healthy | 31 tools |
| vault999 | 8100 | healthy | ledger |
| wealth-organ | 8082 | up | 19 tools |
| well | 8083 | up | 88+ tools |
| redis | 6379 | healthy | infra |
| qdrant | 6333-6334 | up | vector DB |
| postgres | 5432 | healthy | DB |
| ollama-engine-prod | 11434 | up | model runtime |
| aaa-a2a | 3001 | healthy | isolated network |

## Caddy Public Routing

| Domain | Internal | Path |
|--------|----------|------|
| arifOS.arif-fazil.com | arifosmcp:8080 | /mcp, /health, /tools |
| geox.arif-fazil.com | geox_eic:8081 | /mcp, /health, /tools |
| wealth.arif-fazil.com | wealth-organ:8082 | /mcp, /health, /tools |
| well.arif-fazil.com | well:8083 | /mcp, /health, /tools |
| aaa.arif-fazil.com | aaa-a2a:3001 | /a2a, /health |

## Active Ops Holds
1. GEOX-BRIDGE-001: geox_bridge.py returns SIMULATED — live MCP wiring pending
2. FED-SSE-001: WEALTH/WELL SSE-only — arifOS has no SSE client — federation calls fail silently
3. ARCH-001: arif_mind_reason forge-dispatch boundary unclear

## Hard Ops Guards
- No docker system prune -a or docker volume prune without 888_HOLD + Arif explicit confirm
- Itemize volume deletions per volume before approval
- Verify RAM/swap state before cleanup or restart

## GitHub Repos
1AGI · A-FORGE · AAA · AGI_ASI_bot · arifos · arifosmcp · geox · wealth · well +11 more

Last updated: 2026-05-05
