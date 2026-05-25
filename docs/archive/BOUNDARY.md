> ⚠️ **NOT CURRENT AUTHORITY** — This document is archived.
> 
> It was demoted to `INTERNAL REFERENCE` in the 2026-05-25 PHOENIX-73E cleanup.
> **Do not cite as current policy.** Current policy: `FEDERATION_STATUS.md` + `REPO_ROLE_MAP.md`.
>
> ---
> 
<!-- SOT-MANIFEST
owner: ariffazil/A-FORGE
last_verified: 2026-05-19
valid_from: 2026-05-19
valid_until: 2026-06-19
confidence: high
scope: /
-->

# BOUNDARY.md — A-FORGE Execution Intelligence / Forge Engine

> **DITEMPA BUKAN DIBERI** — Forged, not given.

## Owns

- **Deployment Packaging** — Docker images, compose definitions, release assembly, ingress configs
- **Runtime Bridge** — HTTP bridge (Express, port 7071), MCP stdio server, tool execution substrate
- **Build Pipeline** — TypeScript compilation, dist/ generation, GHCR image publishing
- **Health & Observability** — Prometheus metrics, health probes, thermodynamic cost estimation (OPS/777)
- **Environment Contracts** — `.env` schemas, Caddyfile, systemd units, per-service deploy manifests
- **Personal OS** — SovereignLoop, DailyLoop, HumanCLI, remember/recall/track/think/hold/execute
- **Code Execution** — CodeModeExecutor, NodeSandbox, SecurityScanner, file/shell/editor tools

## Does Not Own

- **Constitutional Law** — F1–F13 enforcement, verdict engine, seal authority (owned by arifOS)
- **Earth-Truth Modeling** — Geospatial, subsurface, prospect evaluation (owned by GEOX)
- **Capital Allocation** — NPV/IRR, portfolio logic, economic sovereignty (owned by WEALTH)
- **Operator Cockpit** — React dashboard, agent workspace UX (owned by AAA)
- **MCP Schema Authority** — Canonical schemas, tool registry, governance contracts (owned by arifOS)
- **Vault / Seal** — Append-only ledger, cryptographic seals (owned by arifOS)

## Imports From

| Source | What | Interface |
|--------|------|-----------|
| **arifOS** | Constitutional constraints, floor status, session tokens, tool registry | MCP stdio / HTTP bridge, `/health` |
| **GEOX** | Earth-truth artifacts (when delegate tool calls GEOX) | MCP mesh via MiniMaxMcpClient |
| **WEALTH** | Capital scores (when delegate tool calls WEALTH) | MCP mesh via MiniMaxMcpClient |
| **AAA** | Operator intent, deploy approval signals | A2A mesh, webhook |

## Exports To

| Consumer | What | Interface |
|----------|------|-----------|
| **arifOS** | Execution traces, build SHA, deploy metadata | GHCR image, env vars |
| **AAA** | Deploy status, release artifacts, health metrics | HTTP bridge (port 7071) |
| **All nodes** | Container images, compose definitions, ingress configs | GHCR, `deploy/` manifests |

## Known Boundary Violations (888 HOLD Queue)

1. ~~**GEOX artifacts co-located in root**~~ — **RESOLVED 2026-05-19.** Foreign artifacts archived to `.archive/foreign-artifacts-2026-05-19/`. Stale compose files and duplicates deleted. Zero Python files remain in A-FORGE root.
2. **WealthTools in A-FORGE** — `src/tools/WealthTools.ts` implements WEALTH-domain logic (ROI, EMV, portfolio optimize). Should be delegated to WEALTH MCP, not reimplemented.
3. **Personal OS v2 overlap** — `src/personal-v2/` implements memory/recall/tracking that overlaps with arifOS `arif_memory_recall`. One must be canonical.

## Canonical Surfaces

- **HTTP Bridge:** Express on port 7071 (`node dist/src/server.js`)
- **MCP Server:** stdio via `dist/src/mcp/cli.js serve --transport stdio`
- **Build:** `npm run build` → `dist/`
- **Test:** `npm test` (node:test built-in)
- **Deploy:** `make up` (docker compose up)

## Foreign Artifact Trace Summary

| File | Actual Owner | Referenced By A-FORGE? | Verdict |
|------|-------------|------------------------|---------|
| `server.py` | WELL/arifOS gateway | No active compose reference | **Safe to move** |
| `arifos_od_siphon.py` | GEOX | Also exists in `geox/scripts/` | **Duplicate — safe to delete** |
| `conformance_test.py` | arifOS test | No Makefile/CI reference | **Safe to move** |
| `tests/` (Python) | GEOX test suite | No Makefile/CI reference | **Safe to move** |
| `docker-compose.local.yml` | GEOX local deploy | References missing `GEOX_mcp_server.py` | **Stale — safe to delete** |
| `docker-compose.site.yml` | GEOX site deploy | References `Dockerfile.unified` | **Stale — safe to delete** |
| `docker-compose.enterprise.yml` | GEOX enterprise | Self-identifies as GEOX | **Stale — safe to delete** |
| `docker-compose.aaa.yml` | GEOX AAA deploy | Self-identifies as GEOX | **Stale — safe to delete** |
| `Dockerfile.local` | GEOX local build | Self-identifies as GEOX | **Stale — safe to delete** |
