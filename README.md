<!-- SOT-MANIFEST
owner: Arif
last_verified: 2026-05-20
valid_from: 2026-05-20
valid_until: 2026-06-20
confidence: high
scope: /root/A-FORGE
epistemic_status: CLAIM
-->

# A-FORGE — Governed Execution Shell

> **Status:** ACTIVE  
> **Role:** Execution/runtime organ in the arifOS federation  
> **Surfaces:** CLI + MCP + HTTP bridge

## What this repo is

A-FORGE is the execution engine that runs agent workloads under constitutional governance.  
It is **not only deployment infra** and **not only MCP** — it is a dual-surface runtime with:

1. **CLI execution loop** (`src/cli.ts`, `src/cli/*`)
2. **MCP server surface** (`src/mcp/*`)
3. **HTTP bridge + operator APIs** (`src/server.ts`, `src/routes/*`)

## Current source-of-truth layout

```text
A-FORGE/
├── src/
│   ├── server.ts                 # HTTP composition root (Express, port 7071)
│   ├── routes/
│   │   ├── approvalOperatorRoutes.ts
│   │   ├── vaultMerkleRoutes.ts
│   │   └── governanceRoutes.ts   # extracted from server.ts
│   ├── mcp/
│   │   ├── core.ts               # MCP tool registry (resources extracted)
│   │   └── resources.ts          # MCP resource registration
│   ├── approval/filterParsing.ts # typed boundary for filter/query parsing
│   ├── engine/                   # AgentEngine, BudgetManager, RunReporter
│   ├── governance/               # F1-F13 floor checks, CoolingGate, AmanahLock
│   ├── tools/                    # Tool implementations
│   ├── vault/                    # VAULT999 clients + MerkleV3
│   └── components/diagrams/      # React substrate diagrams
├── test/                         # node:test suite
├── deploy/                       # A-FORGE deploy surface
│   ├── af-forge/                 # A-FORGE container + compose
│   ├── agent-plane/              # Job queue, notifier, backup cron
│   ├── caddy/                    # Reverse proxy config
│   ├── grafana/                  # Observability datasource
│   ├── prometheus/               # Metrics scraping
│   └── systemd/                  # Host service units
├── extensions/                   # MCP bridge generator (Python)
├── scripts/                      # Ops scripts + pre-push governance hooks
├── contracts/                    # MCP surface contracts (YAML)
├── examples/                     # TypeScript usage examples
├── WORKFLOWS/                    # Constitutional workflow definitions
├── shared/                       # Shared schema packs
├── docs/
│   ├── api/                      # API specs (A2A, MCP, reserved tools)
│   ├── deployment/               # Deployment seals + status
│   ├── governance/               # Governance docs
│   ├── archive/                  # Historical audit-time records
│   └── SOT_2026-05-20_CANONICAL.md
└── .AGENTS.md                    # Onboarding truth surface for coding agents
```

## Verified local commands

```bash
npm install
npm run build
npm test
```

## 2026-05-20 entropy reduction seals

- **`b619eb1`** — Root-doc entropy cleanup (`docs/api|deployment|governance|archive` + `.AGENTS.md`)
- **`7a6afba`** — Code entropy cleanup
  - `as any` reduced to **0** across `src/` + `test/`
  - `/governance/evaluate` extracted to `src/routes/governanceRoutes.ts`
  - MCP resources extracted to `src/mcp/resources.ts`
- **`be5cbe1`** — Evicted 276 GEOX artifacts, dead code, and foreign deploy configs
- **`f827cad`** — Relocated arifOS/arif-sites/AAA deploy configs to canonical repos
- **`d006ca1`** — Final entropy sweep: removed disguised GEOX files (`legacy` = server.py, `stash` = fastmcp.json), GEOX deploy scripts, entrypoints, and data dumps
- **`3196ca8`** — Evicted 15 GEOX documentation files to `/root/geox/docs/`
- **`2033a85`** — Removed GEOX `app.json` manifest and copy-pasted GEOX `SECURITY.md`

**Result:** Repo reduced from 190M → 33M. A-FORGE now contains only A-FORGE + arifOS federation concerns. GEOX lives in `/root/geox`.

## Runtime truth note

Historical runtime snapshots in `docs/archive/*SOT*.md` are **audit-time records**, not live status assertions.  
Use current health checks and compose state before making runtime claims.

## Federation links

- [arifOS](https://github.com/ariffazil/arifos)
- [AAA](https://github.com/ariffazil/AAA)
- [geox](https://github.com/ariffazil/geox)
- [WEALTH](https://github.com/ariffazil/wealth)
- [WELL](https://github.com/ariffazil/well)

---

**DITEMPA BUKAN DIBERI — 999 SEAL ALIVE**
