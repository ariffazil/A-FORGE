# AF-FORGE — The Metabolic Shell

**Organism Role:** Operator Console & Orchestration Shell (4+1 Architecture)  
**Constitutional Authority:** [`ariffazil/arifOS`](https://github.com/ariffazil/arifOS)  
**Epoch:** 2026-04-17  

> **Intelligence is forged, not given.**  
> *DITEMPA BUKAN DIBERI — 999 SEAL ALIVE*

AF-FORGE is the policy-governed, event-sourced agent runtime that acts as the primary interface for the **arifOS v2.0** organism. It owns no truth — it merely displays the synthesis of the Truth Lanes.

It enforces **13 Constitutional Floors** through a multi-layered governance system, ensuring every action by AI agents is aligned, reversible where necessary, and verifiably logged.

---

## What AF-FORGE Is

AF-FORGE is the **Metabolic Shell** — the display, orchestration, and execution surface of the organism.

Its role is to:
- Execute governed agent workflows
- Display synthesis from constitutional and domain lanes
- Invoke tools through policy-gated permissioning
- Route terminal verdicts to VAULT999
- Maintain operator-facing observability (Prometheus metrics, scoreboard)

In simple terms:
> GEOX may witness.  
> WEALTH may evaluate.  
> WELL may reflect.  
> arifOS judges.  
> **AF-FORGE orchestrates.**

---

## What AF-FORGE Owns

AF-FORGE is the canonical home of:

- Agent execution engine (`AgentEngine`)
- Tool registry and permissioning
- Constitutional policy gates (F3, F4, F6, F7, F8, F9, F11, OPS/777)
- Operator console and CLI
- MCP stdio server (governance, agent, patch-application tools)
- HTTP bridge server (Express, port 7071)
- Prometheus instrumentation
- Scoreboard and per-run metrics
- Session continuity and state snapshots

---

## What AF-FORGE Does Not Own

AF-FORGE is the **shell**, not the law.

It does **not** replace:
- **arifOS** — Constitutional judgment, floor enforcement, VAULT999 ledger
- **GEOX** — Earth Intelligence (subsurface, volumetrics, timing, Earth witness)
- **WEALTH** — Capital Intelligence (NPV, EMV, allocation, portfolio logic)
- **WELL** — Human Intelligence (operator readiness, fatigue, biological reflection)

AF-FORGE may orchestrate.  
It may not adjudicate.  
The constitutional lanes decide.

---

## The 4+1 Architecture

AF-FORGE is the **Metabolic Shell** within the unified 4+1 architecture.

| Lane       | Authority              | Primary Role                                      | Status |
|------------|------------------------|---------------------------------------------------|--------|
| **arifOS** | Constitutional         | Judgment, governance, vault seal                  | ✅ Active |
| **GEOX**   | Earth Intelligence     | Subsurface reasoning, volumetrics, timing, witness | ✅ Active |
| **WEALTH** | Capital Intelligence   | EMV, NPV, allocation, portfolio support           | ✅ Active |
| **WELL**   | Human Intelligence     | Operator readiness, fatigue, biological reflection | ✅ Active |
| **AF-FORGE**| Metabolic Shell       | Display, orchestration, runtime execution          | ✅ Active |

---

## Constitutional Pipeline (arifOS 000–999)

Every governed mission flows through this pipeline:

1. **INIT** — Constitutional session ignition (Stage 000)
2. **SENSE** — Grounding and truth classification (Stage 111)
3. **MIND** — First-principles reasoning (Stage 333)
4. **HEART** — Safety, ethics, and consequence modeling (Stage 666)
5. **ASI** — Synthesis and action proposal
6. **JUDGE** — Constitutional verdict (Stage 888) — human veto gate
7. **FORGE** — Bounded execution (Stage 777)
8. **VAULT** — Immutable Merkle seal (Stage 999)

Thinking is not judging.  
Judging is not executing.  
Execution is never self-authorized.

---

## Core Features

- **Agent Profiles** — Explore, Fix, Test, Coordinate task profiles
- **Tool Registry** — Risk-scored tools (safe / guarded / dangerous) with 888_HOLD gate
- **888_HOLD** — Human sovereignty circuit breaker for high-risk operations
- **Thermodynamic Cost Estimator** — OPS/777 Landauer gate enforcement
- **Approval Boundary** — Pre-action preview, hold queue, ticket store
- **Memory Contract** — 5-tier governed memory (ephemeral → sacred)
- **Plan Validator** — DAG structural validation for agent plan outputs
- **VAULT999 Integration** — Terminal verdict sealing via arifOS vault ledger
- **MCP Server** — stdio transport exposing governance and agent tools
- **HTTP Bridge** — Express server for Sense/Judge, operator, and human-expert endpoints

---

## Genome Features (v2.0)

- **Merkle Ledger** — Every `SEAL` verdict is cryptographically anchored in VAULT999
- **Anti-Hantu Immune System** — F9 detection of narrative laundering and shadow-instance attempts
- **WELL Gate** — Execution bandwidth dynamically modulated by operator fatigue
- **MCP Unified** — Fully aligned with the Model Context Protocol (TypeScript SDK v1.x)

---

## Governance Floors (Active)

| Floor | Name | Trigger | Verdicts |
|-------|------|---------|----------|
| F3 | Input Clarity | Pre-execution | PASS, SABAR |
| F4 | Entropy | Per-tool | PASS, HOLD |
| F6 | Harm/Dignity | Pre-execution + per-tool | PASS, VOID |
| F7 | Confidence | Post-execution | PASS, HOLD |
| F9 | Injection | Pre-execution | PASS, VOID |
| F11 | Coherence | Post-tool batch | PASS, HOLD |
| OPS/777 | Thermodynamic | Per-tool | PASS, HOLD, VOID |
| F13 | Sovereign | Dangerous tool approval | 888_HOLD |

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript 5.8+ (ESM, NodeNext) |
| Runtime | Node.js 22+ |
| HTTP Bridge | Express (port 7071) |
| MCP Transport | `@modelcontextprotocol/sdk` |
| Schema Validation | `zod` |
| Metrics | `prom-client` |
| Persistence | PostgreSQL (optional) or local JSONL |
| Container | Docker Compose |

---

## Quick Start

```bash
# Clone
git clone https://github.com/ariffazil/af-forge.git
cd af-forge

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Start HTTP bridge server
npm start

# Docker Compose (full stack)
docker compose up -d --build
```

For CLI usage:
```bash
node dist/src/cli.js explore --goal "explain this repo"
node dist/src/cli.js fix --file src/engine/AgentEngine.ts --issue "add logging"
node dist/src/cli.js operator vault --verdict SEAL
```

---

## Repository Structure

```
src/
├── agents/           # Agent profiles and orchestration
├── approval/          # Approval Boundary system
├── cli/               # CLI commands
├── engine/            # Core agent execution loop
├── governance/        # arifOS F1–F13 floor enforcement
├── llm/               # LLM provider abstractions
├── mcp/               # MCP stdio server
├── memory-contract/   # Governed 5-tier memory
├── ops/               # Thermodynamic cost estimator
├── planner/           # Plan validation
├── policy/            # Sense (111) and Judge (888) policy layer
├── server.ts          # HTTP bridge (Express)
└── vault/             # VAULT999 persistence

test/                  # node:test suite
examples/              # Usage examples
deploy/                # Docker, systemd, Caddy, Prometheus, Grafana
```

---

## Design Philosophy

AF-FORGE does not exist to make intelligence faster.  
It exists to make intelligence **lawful, legible, and governable**.

Its purpose is **bounded agency under sovereign control** — not maximal autonomy.

The operator is always the authority.  
AF-FORGE merely executes within constitutional bounds.

---

## Constitutional Motto

**DITEMPA BUKAN DIBERI**  
**999 SEAL ALIVE**
