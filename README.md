<!-- SOT-MANIFEST
owner: Arif
last_verified: 2026-05-21
valid_from: 2026-05-21
valid_until: 2026-06-21
confidence: high
scope: /root/A-FORGE
epistemic_status: CLAIM
-->

# A-FORGE - Governed Execution Runtime

> A-FORGE executes agent workloads under arifOS governance.
>
> **Federation role:** EXECUTION / FORGE
> **Primary runtime:** TypeScript + Node.js
> **Surfaces:** CLI, MCP, HTTP bridge
> **Authority:** arifOS policy gates, Arif final judgment
> **Status:** Active

## What This Repo Is

A-FORGE is the execution shell of the arifOS federation. It runs governed agent workflows, exposes CLI/MCP/HTTP surfaces, applies policy gates, and records execution outcomes for audit.

This repo answers one question:

> How does a governed action get executed safely and verifiably?

## What This Repo Is Not

A-FORGE is not the constitutional law kernel, not the human cockpit, not the Earth evidence engine, and not the capital evidence engine. It executes under governance; it does not grant itself final authority.

## What It Owns

| Owns | Does not own |
| --- | --- |
| CLI execution loop | Constitutional law itself |
| MCP execution tools and resources | Frontend/operator cockpit |
| HTTP operator bridge | Geoscience interpretation |
| Approval boundary mechanics | Capital modeling |
| Runtime policy enforcement | Final human judgment |
| VAULT999 client integration | arifOS floor definitions |

## Federation Map

| Repo | Role | Plain-English purpose |
| --- | --- | --- |
| `arifos` | LAW | Decides whether actions are allowed, held, or void |
| `AAA` | INTERFACE | Lets the human operator see and steer sessions |
| `A-FORGE` | EXECUTION | Runs governed actions and agent workflows |
| `geox` | FIELD | Produces governed earth-science evidence |
| `wealth` | CAPITAL | Produces governed capital and resource evidence |

## Quick Start

```bash
# install
npm install

# build
npm run build

# test
npm test

# start HTTP bridge
node dist/src/server.js

# start MCP stdio server
node dist/src/mcp/cli.js serve --transport stdio
```

## Repository Map

```txt
A-FORGE/
├── src/                 # TypeScript runtime source
├── test/                # node:test verification suite
├── scripts/             # ops scripts and pre-push governance hooks
├── deploy/              # deployment source for A-FORGE surfaces
├── contracts/           # MCP and governance contracts
├── governance/          # policy docs and governance artifacts
├── extensions/          # MCP bridge generator and extension bridges
├── docs/                # architecture, operations, archive, API docs
└── .AGENTS.md           # coding-agent onboarding surface
```

## Important Files

| File | Purpose |
| --- | --- |
| `src/server.ts` | HTTP bridge composition root |
| `src/cli.ts` | CLI entrypoint |
| `src/mcp/` | MCP server and tool/resource registration |
| `src/engine/` | agent engine, budget, reporting, intent routing |
| `src/governance/` | runtime governance gates and policy enforcement |
| `src/tools/` | executable tool implementations |
| `src/vault/` | VAULT999 clients and Merkle service |
| `scripts/hooks/pre-push/repo_guard.py` | repo-boundary and commit trailer guard |
| `docs/AGENT_LAYOUT_CONTRACT.md` | federation root/layout policy |
| `docs/archive/ENTROPY_REDUCTION_2026-05-20.md` | historical cleanup record |

## Operating Boundaries

- Keep `src/` as the canonical execution source.
- Preserve `test/` singular; this repo intentionally uses Node's built-in `node:test` runner.
- Do not reintroduce GEOX, arifOS deploy copies, field data, root `server.py`, or sibling-repo artifacts.
- Do not change deployment files, package manager, lockfile, public contracts, or policy gates without explicit approval and verification.
- A-FORGE may execute governed actions, but it may not adjudicate constitutional verdicts or override Arif.

## Deeper Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Agent layout contract](docs/AGENT_LAYOUT_CONTRACT.md)
- [API specs](docs/api/)
- [Deployment docs](docs/deployment/)
- [Governance docs](docs/governance/)
- [Operations notes](docs/operations/)
- [Historical archive](docs/archive/)

## Seal

Ditempa Bukan Diberi.
