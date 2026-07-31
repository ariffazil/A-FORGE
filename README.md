<!-- SOT-MANIFEST
federation_release: v2026.07.31
last_verified: 2026-07-31T03:28:00Z
live_commit: 800085a2
qqq_version: v1.1.1 (10/10 tests passing, verdict round-trip closed)
seal_chain: append-only (chattr +a) + Merkle anchor every 100 receipts
sense_port: 7071 (healthy)
mcp_port: 7072 (healthy)
tools_exposed_via_mcp: 131 (live-witnessed tools_loaded: 131)
authority_ceiling: 777_FORGE (execution only — never adjudicate)
owner_summary: GREEN (identity_present, service_healthy, deployment_drift: false)
truth_rule: MCP tools/list on :7072 beats any static count in prose
-->

# ⚒️ A-FORGE — Governed Execution Subprocessor & Systems Engineering Engine

[![Agentic CI](https://github.com/ariffazil/A-FORGE/actions/workflows/agentic-ci.yml/badge.svg?branch=main)](https://github.com/ariffazil/A-FORGE/actions)
[![Boundary Guard](https://github.com/ariffazil/A-FORGE/actions/workflows/a-forge-boundary-guard.yml/badge.svg?branch=main)](https://github.com/ariffazil/A-FORGE/actions)
[![Governance Gate](https://github.com/ariffazil/A-FORGE/actions/workflows/governance-gate.yml/badge.svg?branch=main)](https://github.com/ariffazil/A-FORGE/actions)
[![🔥 FORGE](https://img.shields.io/badge/%F0%9F%94%A5%20FORGE-131%20Canonical%20Tools-orange)](https://forge.arif-fazil.com/mcp)
[![Federation](https://img.shields.io/badge/Federation-v2026.07.31-0a7b83)](https://arifos.arif-fazil.com)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](./LICENSE)

**A-FORGE** is the governed execution subprocessor and systems engineering engine for the arifOS Federation. Operating on ports **7071** (Sense REST API) and **7072** (FastMCP Gateway), A-FORGE exposes **131 high-performance tools** providing safe, audited access to filesystem mutations, Git operations, Docker container fleets, and CI/CD pipelines.

> **The Separation Principle:**  
> *A-FORGE is the hands. arifOS is the brain. The hands execute. The brain judges. The hands never self-authorize.*

---

## 🔒 The 4-Layer Forge Gate & Gödel Lock

Every tool invocation or system mutation routed through A-FORGE must pass **4 sequential security gates**:

```mermaid
graph TB
    AGENT[🤖 Agent / Intent] -->|request| LEASE{Valid Lease?}
    LEASE -->|No Lease| BLOCK[🚫 DENIED: Unbound Mutation]
    LEASE -->|Valid Lease| L1[Layer 1: F1 AMANAH<br/>Catastrophic Pattern & Secret Scan]
    L1 -->|HARAM| BLOCK
    L1 -->|PASS| L2[Layer 2: Model Capability<br/>Identity + Capability Band Verification]
    L2 -->|DEGRADED| BLOCK
    L2 -->|PASS| L3[Layer 3: Governance Bridge<br/>arifOS F1-F12 Constitutional Check]
    L3 -->|VOID| BLOCK
    L3 -->|SEAL| L4[Layer 4: Approval Boundary<br/>Irreversibility & Blast Radius Check]
    L4 -->|888_HOLD| HOLD[⏸️ Human Sovereign Ratification]
    L4 -->|APPROVED| EXEC[⚡ Execute Mutation<br/>Shell · Git · Docker · Deploy]
    EXEC -->|Receipt| VAULT[(VAULT999<br/>Immutable Ledger)]
    HOLD -->|Approve| EXEC
```

| Layer | Security Check | Execution Boundary |
|:---:|:---|:---|
| **Layer 1: F1 AMANAH** | Catastrophic pattern scan | Prevents dangerous system commands (`rm -rf /`, raw secret leaks) |
| **Layer 2: Model Capability** | Identity & capability band check | Enforces agent lease permissions & role-based access limits |
| **Layer 3: Governance Bridge** | arifOS F1–F12 floor evaluation | Blocks ungrounded or epistemically invalid mutations (`VOID`) |
| **Layer 4: Approval Boundary** | Irreversibility & blast radius check | Triggers `888_HOLD` for high-blast operations requiring sovereign veto |

### The Gödel Lock Invariant
A-FORGE **cannot seal its own execution outcomes**. The executor cannot certify its own work—every `forge_execute` receipt must be cryptographically witnessed and sealed by the **arifOS Kernel** or ratified by **Arif (F13 Sovereign)**.

---

## 🛠️ Core Capabilities (131 Live Tools)

A-FORGE hosts 131 canonical tools across five primary operational domains:

- **Filesystem & Codebase Operations:** Safe file edits, structural refactoring, multi-replace operations, and workspace boundary checks.
- **Git & Repository Management:** Automated commits, branch isolation, PR governance checklist validation, and release attestation.
- **Infrastructure & Container Management:** Bare-metal systemd unit management, Docker Compose fleet management, port health probes, and Caddy reverse-proxy checks.
- **CI/CD & Deployment:** GitHub Actions diagnostic analysis, automated deployment sync (`rsync`), and build pipeline verification.
- **Session & Capability Tokens (SCT):** Session token minting, capability verification, and authentication binding.

---

## ⚡ Deployment & Operational Architecture

A-FORGE runs as dual bare-metal systemd daemons on the VPS infrastructure:

```
Sense API Endpoint:  http://127.0.0.1:7071
MCP Gateway:         http://127.0.0.1:7072
Public MCP Surface:  https://forge.arif-fazil.com/mcp
```

### Production Operations

```bash
# 1. Inspect A-FORGE Live Health & Tool Witness
curl -s http://127.0.0.1:7071/health | jq .

# 2. Rebuild & Deploy A-FORGE
cd /root/A-FORGE
npm run build
systemctl restart a-forge
systemctl restart a-forge-mcp

# 3. Execute Full Verification Suite
make test
```

---

## 🏛️ Federation Separation of Powers

| Layer | Organ / Actor | Authority & Capability | Must Never |
|:---|:---|:---|:---|
| **Sovereign** | **ARIF (F13)** | Absolute Veto, final decision, policy ratification | Be overridden by algorithms |
| **Institution** | **AAA (:3001)** | Agent registration, A2A task routing, Cockpit UI | Self-issue verdicts or execute code |
| **Kernel** | **arifOS (:8088)** | Constitutional adjudication (`SEAL`, `HOLD`, `VOID`) | Execute code mutations directly |
| **Executor** | **A-FORGE (:7071)**| Systems engineering, CI/CD, deployment execution | Self-authorize mutations without SEAL |
| **Witnesses** | **GEOX / WEALTH / WELL** | Earth, capital, & human evidence calculation | Make sovereign decisions |
| **Ledger** | **VAULT999** | Cryptographic append-only proof store | Edit or erase historical receipts |

---

## 📜 Sovereignty & License

- **License:** GNU Affero General Public License v3.0 (**AGPL-3.0**).
- **Sovereign Authority:** **Muhammad Arif bin Fazil** (F13 SOVEREIGN).

---

*DITEMPA BUKAN DIBERI — Execution is forged, not given.*  
*The hands never judge. The forge never self-authorizes. 999 SEAL ALIVE.*
──────────┐
    │                                          │
    │   A-FORGE EXECUTES.                      │
    │   arifOS JUDGES.                         │
    │   AAA DISPLAYS.                          │
    │   The domain organs WITNESS.             │
    │   Arif HOLDS THE VETO.                   │
    │                                          │
    │   The hands never judge.                 │
    │   The forge never self-authorizes.       │
    │   The executor never seals its own work. │
    │                                          │
    │   Without lease → no action.             │
    │   Without SEAL → no mutation.            │
    │   Without witness → no seal.             │
    │                                          │
    │   DITEMPA BUKAN DIBERI                  │
    │   Execution is forged, not given.        │
    │   999 SEAL ALIVE.                        │
    │                                          │
    └──────────────────────────────────────────┘
```
