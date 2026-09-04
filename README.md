<!-- SOT-MANIFEST
federation_release: v2026.09.05
last_verified: 2026-09-05T00:00:00Z
live_commit: main
sense_port: 7071 (healthy)
forge_port: 7072 (healthy)
tools_live: 116+ (live-witnessed via :7072/tools/list — beats any static count in prose)
authority_ceiling: 777_FORGE (execution only — never adjudicate)
act_ingress: HMAC-SHA256 verified, FI alias map complete
infra_organs: arifFlow:7073 METABOLISM, FED:7074 ADVISORY, FLAME:18901 ADVISORY, FRAME:frame-organ OBSERVE
truth_rule: MCP tools/list on :7072 beats any static count in prose
-->

# A-FORGE

**The execution engine for arifOS — where governed actions become reality.**

[![Agentic CI](https://github.com/ariffazil/A-FORGE/actions/workflows/agentic-ci.yml/badge.svg?branch=main)](https://github.com/ariffazil/A-FORGE/actions)
[![Boundary Guard](https://github.com/ariffazil/A-FORGE/actions/workflows/a-forge-boundary-guard.yml/badge.svg?branch=main)](https://github.com/ariffazil/A-FORGE/actions)
[![Governance Gate](https://github.com/ariffazil/A-FORGE/actions/workflows/governance-gate.yml/badge.svg?branch=main)](https://github.com/ariffazil/A-FORGE/actions)
[![🔥 FORGE](https://img.shields.io/badge/%F0%9F%94%A5%20FORGE-116%20Live%20Tools-orange)](https://forge.arif-fazil.com/mcp)
[![MCP 2026-07-28](https://img.shields.io/badge/MCP-stateless%202026--07--28-6750a0)](https://modelcontextprotocol.io)
[![ACT Bridge](https://img.shields.io/badge/ACT%20Bridge-HMAC%20verified%20%C2%B7%20FI%20aliases%20PASS-brightgreen)](#architecture)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](./LICENSE)

> **DITEMPA BUKAN DIBERI** — *Forged, Not Given.*

A-FORGE is the governed execution engine of the arifOS Federation. It provides **200+ tools across 50+ sub-skills** spanning code, infrastructure, security, documentation, and deployment — all operating under a constitutional kernel that ensures every mutation is authorized, witnessed, and immutably recorded.

---

## What A-FORGE Does

| Capability | Details |
|---|---|
| **Task Execution** | Governed filesystem mutations, shell operations, and workflow automation — every action classified, leased, and receipted |
| **CI/CD Pipelines** | GitHub Actions workflows for agentic CI, boundary-guard enforcement, governance gates, Dependabot orchestration, and multi-language lock-invariant checks |
| **Docker Orchestration** | Container fleet management, Compose orchestration, image builds, multi-stage pipelines, and runtime health probes |
| **MCP Server Lifecycle** | Build, test, deploy, and conformance-validate Model Context Protocol servers with full stateless HTTP transport |
| **Code Analysis & Review** | LSP-gated mutations, pre-commit review, structural refactoring, PR governance, and release attestation |
| **Deployment Automation** | Zero-downtight VPS deploys, rsync pipelines, Caddy reverse proxy management, and post-deploy verification crawls |
| **Infrastructure Management** | systemd service orchestration, port probes, network diagnostics, SOPS-encrypted secrets, and fleet-wide health monitoring |

---

## Architecture

A-FORGE operates as the **executor** in a separation-of-powers model. It receives SEAL'd verdicts from the arifOS kernel and produces cryptographically verifiable receipts — it **never** self-certifies its own work.

```
┌──────────────┐     SEAL / HOLD / VOID     ┌──────────────────┐     receipts     ┌───────────┐
│  arifOS      │ ──────────────────────────▶ │   A-FORGE        │ ───────────────▶ │  VAULT999 │
│  :8088       │    (HMAC-SHA256 verified)   │   :7071 / :7072  │   (JSONL chain)  │  :999     │
│  JUDGE       │                             │   EXECUTOR       │                  │  SEAL     │
└──────────────┘                             └────────┬─────────┘                  └───────────┘
       ▲                                              │
       │          evidence                             │
       └───────────────────────────────────────────────┘
```

### The 4-Layer Forge Gate

Every execution passes through four independent gates before touching reality:

```
Intent ─▶ [Valid Lease?] ─▶ [L1: AMANAH ─ Secret & Pattern Scan]
                              └─ FAIL → DENIED
                            ─▶ [L2: Identity ─ Model Capability & Band Check]
                              └─ FAIL → DEGRADED
                            ─▶ [L3: Governance ─ arifOS F1–F12 Constitutional Check]
                              └─ FAIL → VOID / 888_HOLD
                            ─▶ [L4: Irreversibility ─ Human Consent Required?]
                              └─ IRREVERSIBLE → F13 Sovereign Ratification
                            ─▶ ⚡ EXECUTE → Receipt → VAULT999
```

**The Gödel Lock:** A-FORGE cannot reach station 888 (judge) or 999 (seal). The executor never certifies its own output. Every receipt must be independently sealed by the kernel or ratified by the sovereign.

---

## Quick Start

### Prerequisites

- Node.js ≥ 20, TypeScript ≥ 7.0
- Python 3.10+ (for auxiliary scripts and tool harnesses)
- Docker & Docker Compose (for container orchestration tools)
- GitHub CLI `gh` (for CI/CD workflows)

### Install & Build

```bash
git clone https://github.com/ariffazil/A-FORGE.git
cd A-FORGE
npm install
npm run build
```

### Start the MCP Gateway

```bash
# HTTP gateway (port 7072)
npm start

# MCP stdio transport (for embedding in agent CLIs)
npm run mcp:stdio

# MCP HTTP transport (custom port)
npm run mcp:http -- --port 3000
```

### Verify

```bash
# Health check — confirms gateway, commit hash, and live tool count
curl -sf http://localhost:7072/health | jq '{status, commit, stateless_tools}'

# Sense API health
curl -sf http://localhost:7071/health

# Full test suite
npm test
```

### Call a Tool

```bash
# List all available tools (stateless — no session needed)
curl -sf http://localhost:7072/tools/list | jq '.[].name' | head -20
```

---

## Key Capabilities

A-FORGE exposes **200+ tools across 50+ sub-skills** organized into five operational domains:

### 🔧 Code & Development (60+ tools)
- Safe file edits with LSP pre-gate validation
- Structural refactoring and multi-replace operations
- Automated Git commits with governance metadata
- PR creation, review, and release attestation
- Python, TypeScript, Rust, and multi-language lock-invariant checks
- Ephemeral sandbox tool genesis and destruction

### 🏗️ Infrastructure & Deployment (40+ tools)
- Docker Compose orchestration and container lifecycle management
- systemd service provisioning and health monitoring
- Caddy reverse proxy configuration and validation
- VPS deployment pipelines with rsync and post-deploy verification
- Port probing, network diagnostics, and fleet health sweeps
- SOPS-encrypted secret management

### 🔒 Security & Governance (35+ tools)
- ACT ingress with HMAC-SHA256 verification
- Session lease management and scoped capability binding
- APEX constitutional evaluation (F1–F13 floors)
- Secret scanning and pattern-based policy gates
- Irreversibility classification and F13 sovereign escalation
- Witness consensus and cross-organ audit trails

### 📚 Documentation & Research (25+ tools)
- Governed web fetch and evidence retrieval
- DocsGPT and Context7 integration
- Site audit and crawl verification (74-URL methodology)
- Content-truth validation (SPA-aware, not status-code-only)
- Federation documentation reconciliation

### 🧠 Composition & Orchestration (40+ tools)
- DAG-based task composition and dependency resolution
- Trust scoring and registry management
- OTel observability with receipt-span processors
- arifFlow metabolic bridge integration
- Experience trace and scar database management
- World model query and promotion gates

> **Live truth:** The authoritative tool count is always `curl localhost:7072/tools/list` — not prose. If the badge and the wire disagree, the wire wins.

---

## Federation Role

A-FORGE occupies **station 777** in the arifOS Federation's canonical ladder (000–999):

| Station | Organ | Authority | Relationship to A-FORGE |
|---|---|---|---|
| 000–666 | arifOS (cognition) | Route, sense, reason, direct | Provides evidence — never direct commands |
| **777** | **A-FORGE** | **Execute only** | **The only mutation station — lease + session + 4-layer gate** |
| 888 | arifOS (judge) | SEAL / HOLD / VOID | A-FORGE cannot reach this station — no self-adjudication |
| 999 | VAULT999 | Immutable seal chain | A-FORGE writes receipts; kernel seals them |

**Core invariant:** A-FORGE executes. It does not judge. It does not self-certify. Every action is leased, classified, gated, receipted, and sealed by an independent authority.

```
ARIF (Sovereign) → arifOS (Judge) → AAA (Router) → A-FORGE (Executor) → VAULT999 (Seal)
```

---

## Sister Repos

| Organ | Repository | Role | Endpoint |
|---|---|---|---|
| **Kernel** | [arifOS](https://github.com/ariffazil/arifos) | Constitutional judge — SEAL/HOLD/VOID | :8088 |
| **Cockpit** | [AAA](https://github.com/ariffazil/AAA) | A2A mesh, routing, and display | :3001 |
| **Earth** | [GEOX](https://github.com/ariffazil/GEOX) | Geoscience evidence and physical grounding | :8081 |
| **Capital** | [WEALTH](https://github.com/ariffazil/WEALTH) | Financial risk and consequence modeling | :18082 |
| **Vitality** | [WELL](https://github.com/ariffazil/WELL) | Human readiness and dignity mirror | :18083 |
| **Metabolism** | arifFlow | Federation health and FQ scheduling | :7073 |
| **Observation** | FRAME | Passive monitoring and drift detection | frame-organ |
| **Sovereign** | [ariffazil](https://github.com/ariffazil/ariffazil) | L0 canon and civilization origin | — |

Full federation contract: [`FEDERATION_CONTRACT.md`](./FEDERATION_CONTRACT.md)

---

## Production Operations

### Health Dashboard

```bash
# MCP gateway
curl -sf http://localhost:7072/health | jq .

# Sense API
curl -sf http://localhost:7071/health | jq .

# Full federation pulse
bash scripts/federation_pulse.sh
```

### Rebuild & Deploy

```bash
cd /root/A-FORGE
npm run build
systemctl restart a-forge-mcp.service
```

### CI/CD Workflows

Three independent GitHub Actions workflows gate every merge:

1. **agentic-ci** — Build, test, and conformance validation
2. **a-forge-boundary-guard** — Authority ceiling enforcement (no tool may adjudicate)
3. **governance-gate** — Kernel bridge contract verification

Dependabot runs under an unprivileged pipeline with constitutional package denylists requiring sovereign (F13) review for merges.

---

## License

**GNU Affero General Public License v3.0** (AGPL-3.0)

Sovereign: **Muhammad Arif bin Fazil** (F13)

---

> *The hands never judge. The forge never self-authorizes.*
>
> **DITEMPA BUKAN DIBERI** — *Forged, Not Given.*
