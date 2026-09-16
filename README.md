<!-- SOT-MANIFEST
federation_release: v2026.09.17
last_verified: 2026-09-16T16:35:00Z
live_commit: cbc25cb4 (runtime-reported via :7072/health)
sense_port: 7071 (healthy)
forge_port: 7072 (healthy)
tools_live: 121 (tools_listed via :7072/health) · 87 stateless
authority_ceiling: 777_FORGE (execution only — never adjudicate)
apex_zen: A2A delegates ⊥ MCP equips ⊥ ACT mutates ⊥ arifOS governs ⊥ F13 decides
act_ingress: HMAC-SHA256 verified, FI alias map complete
infra_organs: arifFlow:7073 METABOLISM, FED:7074 ADVISORY, FRAME:frame-organ OBSERVE (FLAME:18901 decommissioned 2026-09-04)
truth_rule: MCP tools/list on :7072 beats any static count in prose
public_a2a_card: none by default — A-FORGE is actuator, not a public A2A mind
-->

# A-FORGE

**The execution engine for arifOS — where governed actions become reality.**

[![Agentic CI](https://github.com/ariffazil/A-FORGE/actions/workflows/agentic-ci.yml/badge.svg?branch=main)](https://github.com/ariffazil/A-FORGE/actions)
[![Boundary Guard](https://github.com/ariffazil/A-FORGE/actions/workflows/a-forge-boundary-guard.yml/badge.svg?branch=main)](https://github.com/ariffazil/A-FORGE/actions)
[![Governance Gate](https://github.com/ariffazil/A-FORGE/actions/workflows/governance-gate.yml/badge.svg?branch=main)](https://github.com/ariffazil/A-FORGE/actions)
[![🔥 FORGE](https://img.shields.io/badge/%F0%9F%94%A5%20FORGE-121%20Live%20Tools-orange)](https://forge.arif-fazil.com/mcp)
[![MCP 2026-07-28](https://img.shields.io/badge/MCP-stateless%202026--07--28-6750a0)](https://modelcontextprotocol.io)
[![ACT Bridge](https://img.shields.io/badge/ACT%20Bridge-HMAC%20verified%20%C2%B7%20FI%20aliases%20PASS-brightgreen)](#architecture)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](./LICENSE)

> **DITEMPA BUKAN DIBERI** — *Forged, Not Given.*

A-FORGE is the **EXECUTION** engine of the arifOS Federation (plane: EXECUTION, never governance). It exposes **121 live tools (87 stateless)** across five operational domains — code, infrastructure, security, web intelligence, and orchestration — all operating under the arifOS constitutional kernel (`:8088 JUDGE_ONLY`) that ensures every mutation is authorized, witnessed, and immutably recorded. **A-FORGE never adjudicates.**

---

## What A-FORGE Does

| Capability | Details |
|---|---|
| **Task Execution** | Filesystem mutations, shell operations, and workflow automation under constitutional authority — every action classified, leased, and receipted |
| **CI/CD Pipelines** | GitHub Actions workflows for agentic CI, boundary-guard enforcement, governance gates, Dependabot orchestration, and multi-language lock-invariant checks |
| **Docker Orchestration** | Container fleet management, Compose orchestration, image builds, multi-stage pipelines, and runtime health probes |
| **MCP Server Lifecycle** | Build, test, deploy, and conformance-validate Model Context Protocol servers with full stateless HTTP transport |
| **Code Analysis & Review** | LSP-gated mutations, pre-commit review, structural refactoring, PR governance, and release attestation |
| **Web Intelligence** | Governed URL intake, federated search, SPA-aware extraction, and site-doctor missions — evidence in, provenance out |
| **Deployment Automation** | Zero-downtime VPS deploys, rsync pipelines, Caddy reverse proxy management, and post-deploy verification crawls |
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
curl -sf http://localhost:7072/health | jq '{status, commit, tools_listed, stateless_tools}'

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

A-FORGE exposes **121 live tools (87 stateless)** organized into operational domains:

### 🔧 Code & Development
- Safe file edits with LSP pre-gate validation (`forge_filesystem`)
- Governed git primitives — status, diff, log, commit (`forge_git`, `forge_git_commit`)
- GitHub read/write bridge (`forge_github*` — search, PRs, issues, file ops)
- Local git physics sensor for blast-radius checks (`forge_worktree`)
- Ephemeral sandbox tool genesis and destruction (`forge_skill`, `forge_ephemeral`)
- Artifact synthesis to buffer-only staging (`forge_synthesize`, `forge_stage`, `forge_canonize`)

### 🏗️ Infrastructure & Deployment
- Docker primitives (`forge_docker`), systemd/journal observability (`forge_journalctl`, `forge_vps_*`)
- Machine Constitution registries — ports, services, cron (`forge_vps_ports`, `forge_vps_services`, `forge_vps_cron`)
- Production security telemetry against the Machine Constitution (`forge_security_drift_scan`)
- Netdata metrics and alarm reads (`forge_netdata_metrics`, `forge_netdata_alarms`)
- Health probes across organs and sites (`forge_probe`, `forge_probe_site`)
- Isolated sandbox lifecycle — stage, pause, resume, auto-evict (`forge_sandbox_*`, 5 tools)

### 🔒 Security & Governance
- ACT ingress with HMAC-SHA256 verification (`auth_pipeline`, `forge_session_init`)
- Session lease lifecycle — request, status, revoke (`forge_lease`, `forge_lock`)
- APEX evaluation and tri-witness consensus (`forge_evaluate`, `forge_witness`)
- Constitutional proxy to the kernel — never local adjudication (`forge_kernel`, `forge_judge_proxy`, `forge_check_governance`, `forge_heart_critique`)
- Secret/pattern scanning before execution (`forge_scan`, L1 AMANAH)
- F13 consent-gated confirmations (`forge_send_confirm`, `forge_transfer_confirm`)
- Scar metabolization and vault staging (`forge_scar`, `forge_vault`, `forge_seal_run`)

### 🌐 Web Intelligence
- Governed URL intake — markdown/text/JSON/article modes with provenance (`forge_fetch`)
- Unified federated search — web (Brave), docs (Context7), deep research, epistemic labels (`forge_search`)
- Full-capability SPA-aware agentic extraction — rendering, authenticated sessions, downloads (`forge_web_extract`)
- Site sense/verify/orphan/doctor missions (`forge_web_zen` — humans get six missions, agents call the tool)
- Browser actuator suite — navigate, click, type, extract, screenshot, evaluate (`forge_browser_*`, 6 tools)

### 🧠 Composition, Orchestration & Metabolism
- TaskIR compilation and bounded-lane dispatch (`forge_compile_task`, `forge_dispatch_lane`)
- Composition bus — sequential, parallel, conditional, loop (`forge_compose`, `forge_pipeline_run`)
- A2A fan-out with group lifecycle (`forge_parallel*`, 4 tools)
- Experience traces — action→observation→feedback→delta (`forge_experience_trace`, `forge_experience_query`)
- Ablative tool genesis and registry governance (`forge_register`, `forge_registry`, `forge_fingerprint_check`)

> **Live truth:** The authoritative tool count is always `curl localhost:7072/health` (`tools_listed`) — not prose. If the badge and the wire disagree, the wire wins.

---

## ZPEX-ZEN Capability Fabric

A-FORGE participates in the federation's capability fabric under one law: **CAPABILITY ≠ AUTHORITY**. Knowing a tool exists never implies permission to use it.

The fabric extends four existing registries — it does not fork a fifth (F13 doctrine, 2026-09-17):

| Registry | Location | Carries |
|---|---|---|
| **Kernel capability index** | `arifOS/core/capability_index` | `action_class`, `effective_class`, `authority_ceiling`, `risk_tier` per capability |
| **A-FORGE affordances** | `a_think/affordances.yaml` | `capability_surface`, `kernel_verb`, `risk_label` (R1–R5) per tool |
| **AAA agent-card registry** | AAA | identity, interfaces, authority per warga agent |
| **Live-verified matrix** | capability-fabric observation (2026-09-12) | 118/118 tools live-witnessed, reconciliation state |

A-FORGE's fabric sensors keep declared and live capability in agreement:

- `forge_registry_status` — callable / blocked / degraded / drift per tool (the live truth)
- `forge_fingerprint_check` — duplicate and schema-drift detection
- `forge_surface_audit` + `forge_surface_guard` — registry vs. affordances phantom/missing/drift detection

The one open fabric build item is kernel-side: `resolve_capabilities(task_id, agent_id, role, domains)` → eager/deferred/hidden capability sets. A-FORGE will consume it; it will not define it.

---

## Observability & Metabolic Telemetry

A-FORGE instruments its own execution — every consequential action leaves joinable evidence:

- **Hash-chain shell ledger** — every governed shell decision appended with chain integrity (`forge_shell_ledger`, `forge_shell_status`, `forge_shell_alert_history`)
- **RSI control loop** — state vector `s_t = (identity, plant, memory, controller)`, impulse response `h(t)` of HOLD/scar events, dual-rate FQ (daily observational / 7-day constitutional) (`forge_rsi_state_vector`, `forge_rsi_impulse_response`, `forge_rsi_dual_rate_fq`)
- **World Model quality** — surprise scores, tool grades A–D, high-confidence wrong predictions (`forge_wm_stats`, `forge_wm_quality`, `forge_wm_gaps`)
- **Runtime consistency** — git source vs. installed wheel vs. import path, fail-closed on drift (`forge_runtime_verify`)
- **Journal + system telemetry** — PII-redacted journalctl reads, Netdata charts/alarms
- **Evidence packets and docket handoff** — runtime reality collected typed and handed to the kernel (`forge_collect_evidence`, `forge_docket_prep`)

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
