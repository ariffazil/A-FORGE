<!-- SOT-MANIFEST
federation_release: v2026.08.09
last_verified: 2026-08-10T12:10:00Z
live_commit: 5687d5b7 (P0 hardening — FQ metabolic gate + Gödel lock Q9)
qqq_version: v1.1.1 (10/10 tests passing, verdict round-trip closed)
seal_chain: append-only (chattr +a) + Merkle anchor every 100 receipts
sense_port: 7071 (healthy)
mcp_port: 7072 (healthy)
tools_exposed_via_mcp: 110 (live-witnessed via MCP tools/list on :7072)
authority_ceiling: 777_FORGE (execution only — never adjudicate)
owner_summary: GREEN (identity_present, service_healthy, deployment_drift: false)
truth_rule: MCP tools/list on :7072 beats any static count in prose
-->

# ⚒️ A-FORGE — Governed Execution Shell

[![Agentic CI](https://github.com/ariffazil/A-FORGE/actions/workflows/agentic-ci.yml/badge.svg?branch=main)](https://github.com/ariffazil/A-FORGE/actions)
[![Boundary Guard](https://github.com/ariffazil/A-FORGE/actions/workflows/a-forge-boundary-guard.yml/badge.svg?branch=main)](https://github.com/ariffazil/A-FORGE/actions)
[![Governance Gate](https://github.com/ariffazil/A-FORGE/actions/workflows/governance-gate.yml/badge.svg?branch=main)](https://github.com/ariffazil/A-FORGE/actions)
[![🔥 FORGE](https://img.shields.io/badge/%F0%9F%94%A5%20FORGE-110%20Canonical%20Tools-orange)](https://forge.arif-fazil.com/mcp)
[![Federation](https://img.shields.io/badge/Federation-v2026.08.04-0a7b83)](https://arifos.arif-fazil.com)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](./LICENSE)

> **A-FORGE is the hands. It executes. It never self-authorizes.**
> **DITEMPA BUKAN DIBERI — Execution is forged, not given.**

**A-FORGE** is the governed execution subprocessor of the arifOS Federation. Operating on ports **7071** (Sense API) and **7072** (FastMCP Gateway), it exposes **110 governed tools** for filesystem mutations, Git operations, Docker container fleets, CI/CD pipelines, and VPS infrastructure — all gated behind the arifOS constitutional kernel.

---

## 🔒 The 4-Layer Forge Gate

```mermaid
graph TB
    AGENT[🤖 Agent / Intent] -->|request| LEASE{Valid Lease?}
    LEASE -->|No Lease| BLOCK[🚫 DENIED]
    LEASE -->|Valid| L1[L1: F1 AMANAH<br/>Pattern & Secret Scan]
    L1 -->|HARAM| BLOCK
    L1 -->|PASS| L2[L2: Model Capability<br/>Identity & Band Check]
    L2 -->|DEGRADED| BLOCK
    L2 -->|PASS| L3[L3: Governance Bridge<br/>arifOS F1-F12 Check]
    L3 -->|VOID| BLOCK
    L3 -->|SEAL| L4[L4: Approval Boundary<br/>Irreversibility Check]
    L4 -->|888_HOLD| HOLD[⏸️ Human Ratification]
    L4 -->|APPROVED| EXEC[⚡ Execute]
    EXEC -->|Receipt| VAULT[(VAULT999)]
    HOLD -->|Approve| EXEC
```

### The Gödel Lock
A-FORGE **cannot seal its own execution outcomes**. Every `forge_execute` receipt must be cryptographically witnessed and sealed by the **arifOS Kernel** or ratified by **Arif (F13 Sovereign)**. The executor never certifies its own work.

---

## 🛠️ Core Capabilities (110 Live Tools)

| Domain | Tools | Examples |
|--------|-------|---------|
| **Filesystem** | 15+ | Safe file edits, structural refactoring, multi-replace |
| **Git & Repo** | 12+ | Automated commits, PR governance, release attestation |
| **Infrastructure** | 20+ | systemd management, Docker Compose, port probes, Caddy |
| **CI/CD** | 10+ | GitHub Actions diagnostics, rsync deploy, build verification |
| **Governance** | 25+ | Session tokens, leases, APEX evaluation, witness consensus |
| **Browser & Web** | 8+ | Browser automation, screenshots, visual QA |
| **Vault & Memory** | 10+ | VAULT999 receipts, scar database, memory recall |

---

## ⚡ Production Operations

```bash
# Live Health
curl -s http://127.0.0.1:7071/health | jq .

# Rebuild & Deploy
cd /root/A-FORGE && npm run build
systemctl restart a-forge && systemctl restart a-forge-mcp

# Full Test Suite
make test
```

```
Sense API:     http://127.0.0.1:7071
MCP Gateway:   http://127.0.0.1:7072
Public MCP:    https://forge.arif-fazil.com/mcp
```

---

## 🏛️ Federation Navigation

| Organ | Role | Port | Repo | MCP | Health | LLMs |
|:---|:---|:---:|:---|:---|:---|:---|
| **⚖️ arifOS** | Constitutional Kernel — judges, seals | 8088 | [repo](https://github.com/ariffazil/arifos) | [mcp](https://mcp.arif-fazil.com/mcp) | [health](https://arifos.arif-fazil.com/health) | [llms.txt](https://arifos.arif-fazil.com/llms.txt) |
| **⚒️ A-FORGE** | Execution Engine — builds, deploys | 7071/72 | [repo](https://github.com/ariffazil/A-FORGE) | [mcp](https://forge.arif-fazil.com/mcp) | [health](https://forge.arif-fazil.com/health) | [llms.txt](https://forge.arif-fazil.com/llms.txt) |
| **🏛️ AAA** | Control Plane — A2A gateway, cockpit | 3001 | [repo](https://github.com/ariffazil/AAA) | — | [health](https://aaa.arif-fazil.com/health) | [llms.txt](https://aaa.arif-fazil.com/llms.txt) |
| **🌍 GEOX** | Earth Intelligence — seismic, wells | 8081 | [repo](https://github.com/ariffazil/GEOX) | [mcp](https://geox.arif-fazil.com/mcp) | [health](https://geox.arif-fazil.com/health) | [llms.txt](https://geox.arif-fazil.com/llms.txt) |
| **💰 WEALTH** | Capital Intelligence — NPV, risk | 18082 | [repo](https://github.com/ariffazil/WEALTH) | [mcp](https://wealth.arif-fazil.com/mcp) | [health](https://wealth.arif-fazil.com/health) | [llms.txt](https://wealth.arif-fazil.com/llms.txt) |
| **🫀 WELL** | Vitality Guard — human readiness | 18083 | [repo](https://github.com/ariffazil/WELL) | [mcp](https://well.arif-fazil.com/mcp) | [health](https://well.arif-fazil.com/health) | [llms.txt](https://well.arif-fazil.com/llms.txt) |
| **🔮 HERMES** | Multi-Modal Bridge — Telegram relay | 8644 | [repo](https://github.com/ariffazil/HERMES) | — | — | — |
| **🌐 arif-fazil.com** | Public Web Surface — one domain | 443 | [repo](https://github.com/ariffazil/arif-fazil.com) | — | [verify](https://arif-fazil.com/999/verify) | — |

---

## 📡 MCP Registries

A-FORGE is registered as an MCP server on the federation registries. Discovery metadata is exposed at each endpoint.

| Registry | Server | Manifest |
|----------|--------|----------|
| **Glama** | [glama.ai/mcp/servers/ariffazil/a-forge](https://glama.ai/mcp/servers/ariffazil/a-forge) | `https://forge.arif-fazil.com/.well-known/glama.json` |
| **Smithery** | [smithery.ai/server/a-forge](https://smithery.ai/server/a-forge) | `https://forge.arif-fazil.com/.well-known/smithery.yaml` |
| **mcp.so** | [mcp.so/server/ariffazil/a-forge](https://mcp.so/server/ariffazil/a-forge) | `https://forge.arif-fazil.com/.well-known/mcp-so.json` |
| **PulseMCP** | [pulsemcp.com/servers/ariffazil/a-forge](https://www.pulsemcp.com/servers/ariffazil/a-forge) | `https://forge.arif-fazil.com/.well-known/pulsemcp.json` |

Discovery endpoint: `GET https://forge.arif-fazil.com/.well-known/mcp/server.json`

---

---

## 🛡️ CI Governance (F13 verdict 2026-08-10)

This repo follows the federation's CI governance pattern (replicated from `ariffazil/arifOS` PR #683). The pattern ensures Dependabot PRs receive a real, reproducible unprivileged verdict — no more all-red check rolls from structurally-incompatible gates.

**Per-repo adapter** (see `.github/workflows/` for the actual files):

- `.github/dependabot.yml` — `uv` (Python) / `cargo` (Rust) / `npm` (TypeScript) ecosystem; cooldown 3d; open-PRs 5; constitutional packages un-grouped (no `ignore:` — visibility preserved)
- `.github/workflows/dependabot-ci.yml` — unprivileged gate; runs ONLY on Dependabot PRs; SHA-bound probes
- `.github/workflows/{ci-uv-lock-invariant|cargo-lock-invariant|npm-lock-invariant}.yml` — universal `{uv lock --check && uv sync --frozen | cargo check --locked && cargo build --locked | npm ci}` invariant on every PR + push to main
- `.github/workflows/auto-merge-dependabot.yml` — constitutional package denylist (per-language); F13 review the only merge path
- Privileged workflows gated with `if: github.actor != 'dependabot[bot]' && github.actor != 'app/dependabot'` — so they SKIP for Dependabot PRs where their inputs cannot be satisfied

**Constitutional packages** (denied auto-merge, require F13 review):

| Language | Denylist |
|---|---|
| Python | `protobuf`, `cryptography`, `fastmcp-slim`, `fastmcp`, `caio`, `sentence-transformers`, `pynacl`, `blake3` |
| Rust    | `serde`, `tokio`, `hyper`, `axum`, `reqwest`, `rustls`, `async-trait`, `clap`, `tracing` |
| TypeScript | `zod`, `@modelcontextprotocol/sdk`, `fastmcp`, `mcp-sdk`, `tsx`, `vitest`, `@types/node`, `typescript`, `ts-node` |
| Static site | `vite`, `react`, `react-dom`, `react-router`, `@tanstack/react-query`, `tailwindcss` |

**Reference:** [`/root/AGENTS.md`](/root/AGENTS.md) — canonical federation doctrine. `AAA/docs/ORGAN.md` — topology.

DITEMPA BUKAN DIBERI — governance is forged, not given.

## 📜 Sovereignty & License

- **License:** GNU Affero General Public License v3.0 (**AGPL-3.0**)
- **Sovereign:** **Muhammad Arif bin Fazil** (F13 SOVEREIGN)

> *DITEMPA BUKAN DIBERI — Forged, Not Given.*  
> *The hands never judge. The forge never self-authorizes. 999 SEAL ALIVE.*
