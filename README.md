# A-FORGE — Governed Execution Shell

```
   ╔══════════════════════════════════════════════════════════════════════╗
   ║                                                                      ║
   ║        █████╗       ███████╗ ██████╗ ██████╗  ██████╗ ███████╗      ║
   ║       ██╔══██╗      ██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝      ║
   ║       ███████║█████╗█████╗  ██║   ██║██████╔╝██║  ███╗█████╗        ║
   ║       ██╔══██║╚════╝██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝        ║
   ║       ██║  ██║      ██║     ╚██████╔╝██║  ██║╚██████╔╝███████╗      ║
   ║       ╚═╝  ╚═╝      ╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝      ║
   ║                                                                      ║
   ║               GOVERNED EXECUTION SHELL · arifOS Federation           ║
   ║                                                                      ║
   ║    A constitutional kernel without a governed execution shell         ║
   ║                       is just a PDF.                                  ║
   ║                                                                      ║
   ╚══════════════════════════════════════════════════════════════════════╝
```

[![Organ](https://img.shields.io/badge/organ-A--FORGE-8B5CF6)](https://github.com/ariffazil/A-FORGE)
[![Status](https://img.shields.io/badge/status-LIVE-brightgreen)](http://127.0.0.1:7071/health)
[![Node](https://img.shields.io/badge/node-22+-339933?logo=node.js&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/typescript-6.0-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Port](https://img.shields.io/badge/port-7071-64748b?logo=express&logoColor=white)](deploy/Caddyfile)
[![Federation](https://img.shields.io/badge/federation-arifOS-8B5CF6)](https://github.com/ariffazil/arifOS)
[![Systemd](https://img.shields.io/badge/systemd-a--forge.service-orange)](deploy/a-forge.service)
[![Tests](https://img.shields.io/badge/tests-25_suites-success)](test/)
[![Tools](https://img.shields.io/badge/discovered-62%2B_tools-8B5CF6)](docs/)

---

## Federation Position

> **This organ operates under the arifOS Constitutional Federation.**
> **Canonical contract:** [ariffazil/arifOS/FEDERATION_CONTRACT.md](https://github.com/ariffazil/arifOS/blob/main/FEDERATION_CONTRACT.md)
> **Kernel canon:** [ariffazil/arifOS/GENESIS/000_KERNEL_CANON.md](https://github.com/ariffazil/arifOS/blob/main/GENESIS/000_KERNEL_CANON.md)

A-FORGE is the **governed execution shell** of the arifOS Federation — one of 7 sovereign organs running bare-metal on VPS `af-forge` (72.62.71.199). It does not judge. It does not compute domain logic. It **executes** — within bounded constitutional gates, with full audit trail, and never without upstream authorization.

---

## The Execution Chain

```
                         ┌─────────────────────────┐
                         │                         │
                         │      F13 SOVEREIGN       │
                         │   Muhammad Arif Fazil    │
                         │      (absolute veto)     │
                         │                         │
                         └────────────┬────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │       arifOS (judge)     │
                         │  Port 8088 · 13 floors   │
                         │  F1–F13 · SEAL/SABAR/VOID│
                         │  VAULT999 · 888 JUDGE    │
                         │                          │
                         │   "Can this be done?"    │
                         └────────────┬─────────────┘
                                      │ JUDGE_SEAL_AUTHORIZATION
                         ┌────────────▼─────────────┐
                         │       AAA (route)         │
                         │  Port 3001 · Cockpit      │
                         │  A2A mesh · agent cards   │
                         │                           │
                         │   "What should be done?"  │
                         └────────────┬──────────────┘
                                      │ mission + envelope
                         ┌────────────▼──────────────┐
      ┌──────────────────│      A-FORGE (execute)     │──────────────────┐
      │                  │  Port 7071 · Governed Shell │                  │
      │                  │  4-layer forge gate        │                  │
      │                  │  62+ tools auto-discovered  │                  │
      │                  │                             │                  │
      │                  │  "Do it, safely, with       │                  │
      │                  │         evidence."          │                  │
      │                  └──┬──────────┬──────────┬────┘                  │
      │                     │          │          │                       │
      │        ┌────────────┘          │          └────────────┐          │
      │        ▼                       ▼                       ▼          │
      │  ┌──────────┐           ┌──────────┐           ┌──────────┐       │
      │  │   GEOX   │           │  WEALTH  │           │   WELL   │       │
      │  │   earth  │           │  capital │           │   human  │       │
      │  │ :8081    │           │  :18082  │           │  :18083  │       │
      │  └──────────┘           └──────────┘           └──────────┘       │
      │                                                                   │
      └───────────  MCP federation bridge · 5 organs · all on 127.0.0.1 ──┘
```

---

## One-Sentence Identity

> **A-FORGE is the governed execution shell of the arifOS constitutional federation. It receives approved plans, gates them through four constitutional layers, and executes them across federation organs — never self-authorizing, never skipping audit.**

---

### What A-FORGE IS

| Domain | Description |
|--------|-------------|
| **Execution body** | Receives `JUDGE_SEAL_AUTHORIZATION` from arifOS, then gates and runs the plan |
| **MCP federation bridge** | Auto-discovers 62+ tools across 5 organs on startup |
| **Constitutional gatekeeper** | 4-layer forge gate inline on every execution path |
| **Telemetry producer** | Every execution → Prometheus + Supabase + VAULT999 + Langfuse |
| **Orchestration engine** | Routes intents, retries failures, handles escalation |
| **Terminal forge** | Interactive streaming-LLM terminal with session persistence |
| **Audit trail generator** | F11 AUDITABILITY — every call, every gate, every verdict logged |

### What A-FORGE IS NOT

| It is NOT | The truth |
|-----------|-----------|
| **A constitutional judge** | Verdicts (SEAL/SABAR/VOID/HOLD) live in arifOS only |
| **A self-authorizing agent** | Every forge requires external JUDGE_SEAL_AUTHORIZATION |
| **A geoscience engine** | Vsh, PHIE, Sw, AVO → GEOX |
| **A capital modeler** | NPV, IRR, EMV, EVOI → WEALTH |
| **A human readiness sensor** | Biometric state, vitality → WELL |
| **A NumPy/Pandas host** | Domain logic stays in Python organs. TypeScript bridge only. |

---

## Quick Start

```bash
# Clone the canon
git clone git@github.com:ariffazil/A-FORGE.git
cd A-FORGE

# Install dependencies
npm install

# Build TypeScript
npm run build

# Start the execution shell
node dist/interfaces/server.js
# → A-FORGE listening on 127.0.0.1:7071

# Verify health
curl -s http://127.0.0.1:7071/health | python3 -m json.tool
# → {"ok": true, "service": "A-FORGE", "version": "2026.06.06", "uptime_ms": 1234}

# Federation status (auto-discovers all organs)
curl -s http://127.0.0.1:7071/api/federation-probe | python3 -m json.tool
# → {"verdict": "GREEN", "up": 5, "total": 5, "organs": {...}}

# Run the terminal forge (streaming LLM interface)
npm run terminal
# → ◬ A-FORGE Terminal Forge · 62+ tools available · type /help
```

**Prerequisites:**
- Node.js 22+ (TypeScript 6.0 target)
- arifOS MCP kernel running on `127.0.0.1:8088` (or set `ARIFOS_MCP_URL`)
- Federation organs (GEOX, WEALTH, WELL) for full tool surface

For detailed setup including standalone mode and stdio MCP configuration, see [QUICKSTART.md](QUICKSTART.md).

---

## The 4-Layer Forge Gate

Every execution path in A-FORGE passes through four constitutional gates **in order**. The order is the invariant. Reordering any layer voids the constitutional guarantee.

```
                           EXECUTION REQUEST
                                  │
                                  ▼
  ╔══════════════════════════════════════════════════════════════════╗
  ║                         THE FORGE GATE                          ║
  ╠══════════════════════════════════════════════════════════════════╣
  ║                                                                  ║
  ║   LAYER 1: F1 AMANAH GATE                                       ║
  ║   ┌──────────────────────────────────────────────────────────┐  ║
  ║   │ Detects catastrophic patterns before execution:           │  ║
  ║   │   rm -rf /    ·   DROP TABLE   ·   dd if=/dev/zero       │  ║
  ║   │   docker system prune -a   ·   ufw deny 22               │  ║
  ║   │   chmod -R 777 /etc   ·   DELETE FROM vault              │  ║
  ║   │                                                          │  ║
  ║   │ Verdict: HARAM → BLOCKED (no appeal)                     │  ║
  ║   │          HOLD  → escalate to ApprovalBoundary             │  ║
  ║   │          PASS  → proceed to Layer 2                      │  ║
  ║   └──────────────────────────────────────────────────────────┘  ║
  ║                              │                                   ║
  ║                              ▼                                   ║
  ║   LAYER 2: MODEL CAPABILITY GATE                                ║
  ║   ┌──────────────────────────────────────────────────────────┐  ║
  ║   │ Fast spine-check against arifOS registry:                 │  ║
  ║   │   · Reads model_governance_card from arifOS kernel        │  ║
  ║   │   · Verifies model identity, capability band, rate limit  │  ║
  ║   │   · Checks tool access grants against capability registry │  ║
  ║   │                                                          │  ║
  ║   │ Verdict: DEGRADED → route to fallback provider            │  ║
  ║   │          MISSING  → HOLD (model not in registry)          │  ║
  ║   │          PASS     → proceed to Layer 3                    │  ║
  ║   └──────────────────────────────────────────────────────────┘  ║
  ║                              │                                   ║
  ║                              ▼                                   ║
  ║   LAYER 3: GOVERNANCE BRIDGE                                    ║
  ║   ┌──────────────────────────────────────────────────────────┐  ║
  ║   │ Full floor evaluation via arifOS kernel:                  │  ║
  ║   │   F3  WITNESS    — greeting bypass, witness verification  │  ║
  ║   │   F6  EMPATHY    — weakest-stakeholder protection         │  ║
  ║   │   F9  ANTI-HANTU — deception / manipulation detection    │  ║
  ║   │   F10 ONTOLOGY   — AI-only framing, no soul claims       │  ║
  ║   │   F11 COHERENCE  — internal logical consistency           │  ║
  ║   │   F12 INJECTION  — prompt injection defense (c_dark<0.3) │  ║
  ║   │                                                          │  ║
  ║   │ Verdict: SEAL  → proceed to Layer 4                      │  ║
  ║   │          SABAR → HOLD (needs more evidence)               │  ║
  ║   │          VOID  → BLOCKED (floor violation)               │  ║
  ║   └──────────────────────────────────────────────────────────┘  ║
  ║                              │                                   ║
  ║                              ▼                                   ║
  ║   LAYER 4: APPROVAL BOUNDARY                                    ║
  ║   ┌──────────────────────────────────────────────────────────┐  ║
  ║   │ Irreversibility gate — the final lock:                    │  ║
  ║   │   · reversibility_score calculation                       │  ║
  ║   │   · If ack_irreversible required but missing → 888_HOLD   │  ║
  ║   │   · Routes to human (Telegram/Webhook) or APEX judge      │  ║
  ║   │   · Postgres-backed approval ticket with TTL              │  ║
  ║   │                                                          │  ║
  ║   │ Verdict: APPROVED → EXECUTE                               │  ║
  ║   │          888_HOLD → escalation queue (human/APEX)         │  ║
  ║   │          DENIED   → BLOCKED (reversibility=0)             │  ║
  ║   └──────────────────────────────────────────────────────────┘  ║
  ║                              │                                   ║
  ╚══════════════════════════════╪════════════════════════════════════╝
                                 │
                                 ▼
                          ╔═══════════╗
                          ║  EXECUTE  ║
                          ╚═══════════╝
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
               Tool Call    Build/Deploy   LLM Query
                    │            │            │
                    └────────────┼────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │    TELEMETRY FANOUT     │
                    │  Prometheus · Supabase  │
                    │  VAULT999  · Langfuse   │
                    └─────────────────────────┘
```

**The iron rule:** No layer may be skipped. No execution path must be silent. Every 888_HOLD must surface in the AAA approval queue.

---

## Full Capability Map

### Build & Deploy

| Capability | Implementation | Constitutional Gate |
|------------|---------------|---------------------|
| Build orchestration | `ForgeExecutionService` — npm/pip/docker build pipelines | Layer 1–4 full gate |
| Deploy to VPS | `systemctl restart`, Caddy reload, rsync to `/opt/` | Layer 4 (irreversible) |
| Artifact management | Docker image build + push, GHCR tagging | Layer 4 (requires lease) |
| Security audit | `make security-audit` — Trivy + Semgrep + Gitleaks + Ruff | Layer 1 (non-blocking) |

### Code Execution

| Capability | Implementation | Constitutional Gate |
|------------|---------------|---------------------|
| Code-mode sandbox | `domain/containment/ExecutionSandbox.ts` + `NodeSandbox.ts` | Layer 1 (HARAM pattern scan) |
| Security scanner | `SecurityScanner.ts` — AST-level dangerous pattern detection | Layer 1 |
| Shell execution | `ShellTools.ts` — bounded subprocess with timeout | Layer 1 + Layer 4 |
| File operations | `FileTools.ts`, `EditorTools.ts` — read/write/edit with path allowlisting | Layer 1 |

### Orchestration & Federation

| Capability | Implementation | Constitutional Gate |
|------------|---------------|---------------------|
| Intent routing | `IntentRouter.ts` — routes to correct organ (GEOX/WEALTH/WELL/arifOS) | Layer 2 + 3 |
| MCP auto-discovery | Federation bridge probes 5 organs on startup → 62+ tools | Startup-only |
| Federation probe | `GET /api/federation-probe` — live organ status, latency, verdict | Read-only |
| A2A protocol | `application/a2a/` — agent card, task routing, agent profiles | Layer 3 |
| Cross-organ orchestration | `PipelineCoordinator.ts` — multi-step plans with retry | Layer 2 + 3 |
| Agent lifecycle | `AgentManager.ts`, `BackgroundJobManager.ts` — spawn, monitor, kill | Layer 4 |

### Multi-Provider LLM

| Capability | Implementation | Gate |
|------------|---------------|------|
| Streaming SSE | `ChatCompletionProvider.ts` — onToken/onThinking/onComplete | Layer 2 |
| Budget-aware routing | `BudgetAwareRouter.ts` — cheapest capable model first | Layer 2 |
| Fallback chain | `FallbackProvider.ts` — graceful degradation on outage | Layer 2 |
| Providers | MiniMax-M3, SEA_LION, Ollama (bge-m3), OpenAI-compatible | Layer 2 |

### Terminal Forge

| Capability | Implementation |
|------------|---------------|
| Interactive session | `infrastructure/cli/terminal.ts` — streaming LLM with SSE parsing |
| Federation commands | `/tools`, `/federation`, `/status`, `/retry`, `/forge` |
| Session persistence | `/save`, `/load`, `/sessions` — auto-save on Ctrl+C |
| History navigation | 500-entry command buffer, Up/Down arrows |
| Multi-line input | Backslash continuation + `/multi` mode |

### Memory & Persistence

| Capability | Implementation |
|------------|---------------|
| Short-term memory | `ShortTermMemory.ts` — 20-message window, 16K token ceiling, sliding eviction |
| Long-term memory | `LongTermMemory.ts` — file-backed archival, cross-session retrieval |
| Memory contract | `domain/memory-contract/MemoryContract.ts` — F2 TRUTH, F11 AUDIT |
| Continuity store | `ContinuityStore.ts` — shutdown flush, startup restore |
| arifOS L3 bridge | `ArifOSMemoryClient.ts` — Qdrant semantic memory |

### Observability

| Capability | Implementation |
|------------|---------------|
| Prometheus metrics | `infrastructure/metrics/prometheus.ts` — exposed on port 7071 |
| Supabase receipts | Tool call receipts → `arifosmcp_tool_calls` table |
| VAULT999 escrow | Irreversible action records → canonical ledger |
| Langfuse traces | Session-level LLM traces |
| Scoreboard | `ForgeScoreboard.ts` + `RunMetricsLogger.ts` — per-run metrics |
| Thermodynamic tracking | `ThermodynamicCostEstimator.ts` — compute budget, entropy delta |

---

## Boundary Declaration

The boundary between A-FORGE and the rest of the federation is defined by **what code may exist in this repository**. It is enforced by the boundary contract in [INVARIANTS.md](INVARIANTS.md) and the prime directive in [CONSTITUTION.md](CONSTITUTION.md).

```
  ┌───────────────────────────────────────────────────────────────────────┐
  │                         A-FORGE OWNS                                  │
  │                                                                       │
  │   ▸ BUILD pipelines      ▸ DEPLOY orchestration    ▸ CODE execution   │
  │   ▸ Intent ROUTING       ▸ MCP federation bridge   ▸ ORCHESTRATION   │
  │   ▸ Constitutional GATES ▸ Multi-provider LLM      ▸ TELEMETRY       │
  │   ▸ Terminal forge       ▸ Session PERSISTENCE     ▸ ESCALATION      │
  │   ▸ Agent lifecycle      ▸ Memory management       ▸ Tool registry   │
  │                                                                       │
  └───────────────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────────────────┐
  │                        A-FORGE NEVER                                  │
  │                                                                       │
  │   ▸ Issue SEAL/SABAR/VOID constitutional verdicts       → arifOS     │
  │   ▸ SELF-AUTHORIZE any execution                        → arifOS     │
  │   ▸ Compute geoscience (Vsh, PHIE, Sw, AVO, seismic)    → GEOX       │
  │   ▸ Compute capital (NPV, IRR, EMV, EVOI, DCF)          → WEALTH     │
  │   ▸ Sense human readiness / biometric state             → WELL       │
  │   ▸ Render cockpit UI / control plane                   → AAA        │
  │   ▸ Import NumPy, Pandas, SciPy, lasio, welly           → WRONG LAYER│
  │   ▸ Modify constitutional floors F1–F13                 → arifOS     │
  │   ▸ Skip the 4-layer forge gate on ANY execution        → NEVER      │
  │                                                                       │
  └───────────────────────────────────────────────────────────────────────┘
```

**The litmus test:** If your code needs NumPy, Pandas, or reservoir physics → wrong layer. If your code is judging constitutionality → wrong layer. A-FORGE is TypeScript-only. Domain logic lives in Python MCP organs. The bridge is governed.

---

## Constitutional Binding

A-FORGE enforces three constitutional floors as its **runtime mandate**. The remaining floors are enforced by arifOS on the upstream side before A-FORGE ever receives a plan. The constitution lives in **one canonical file**:

→ [arifOS/static/arifos/theory/000/000_CONSTITUTION.md](../arifOS/static/arifos/theory/000/000_CONSTITUTION.md)

### Floors enforced in A-FORGE runtime

| Floor | Name | How A-FORGE enforces it |
|-------|------|--------------------------|
| **F1** | AMANAH | Catastrophic action detection at Layer 1. HARAM patterns block before any tool runs. No override — not even sovereign bypasses `rm -rf /`. |
| **F11** | AUDITABILITY | Every execution path produces: tool call receipt (Supabase), federation telemetry (Prometheus), escalation record (VAULT999), session trace (Langfuse). No execution is silent. |
| **F12** | RESILIENCE | Injection defense in `f12Injection.ts`. Prompt injection patterns detected at Layer 3. `c_dark < 0.30` hard threshold. Redaction before domain tool receives input. |

### Floors enforced by arifOS (upstream, before A-FORGE)

| Floor | What happens before A-FORGE receives the plan |
|-------|-----------------------------------------------|
| **F2** | TRUTH — P(truth) ≥ 0.99 required for SEAL. A-FORGE receives only verified plans. |
| **F3** | TRI-WITNESS — Human+AI+Earth+Verifier consensus ≥ 0.75 before SEAL. |
| **F4** | CLARITY — ΔS ≤ 0. Every plan must reduce system entropy. |
| **F5** | PEACE² — Non-destructive power. Blocks harm/harass/extort. |
| **F6** | EMPATHY — κᵣ ≥ 0.10. Protect weakest stakeholder. |
| **F7** | HUMILITY — Ω₀ ∈ [0.03, 0.05]. No fake certainty. |
| **F8** | GENIUS — G ≥ 0.80 for high-stakes plans. |
| **F9** | ANTIHANTU — C_dark < 0.30. No deception, no consciousness claims. |
| **F10** | ONTOLOGY — AI-only framing. No soul/feelings/personhood. |
| **F13** | SOVEREIGN — Arif's veto is final. No plan bypasses F13. |

**What this means in practice:** A-FORGE never receives a plan that hasn't passed arifOS's full F2–F13 evaluation. A-FORGE's own gates are defense-in-depth — catching execution-level patterns that the plan-level evaluation may not have detected. The forge is hot only when the verdict is cold.

---

## Architecture

A-FORGE source is organized as **5 top-level layers** with Hexagonal Architecture (domain / application / infrastructure / interfaces separation, forged in v2026.06.06-HEXAGON).

```
A-FORGE/
│
├── GENESIS/                        ← constitutional mandate chain
│   └── 012_AFORGE_MANDATE.md       ← organ identity + invariants (stub)
│
├── src/
│   ├── domain/                     ← Pure domain logic (NO I/O, NO Express)
│   │   ├── engine/                 ← Core agent loop
│   │   │   ├── AgentEngine.ts          — Primary agent cycle
│   │   │   ├── PipelineCoordinator.ts  — Governed plan execution
│   │   │   ├── IntentRouter.ts         — Organ routing decisions
│   │   │   ├── ArifOSKernel.ts         — arifOS MCP client
│   │   │   ├── BudgetManager.ts        — Token/cost budgeting
│   │   │   └── RunReporter.ts          — Per-run metrics aggregation
│   │   │
│   │   ├── governance/             ← Constitutional floor enforcement (34 files)
│   │   │   ├── AmanahLockManager.ts    — F1: HARAM pattern scanner
│   │   │   ├── ModelCapabilityGate.ts  — Layer 2: model identity + capability
│   │   │   ├── GovernanceBridge.ts     — Layer 3: arifOS floor evaluation
│   │   │   ├── PolicyEnforcer.ts       — Policy evaluation engine
│   │   │   ├── SealService.ts          — VAULT999 seal integration
│   │   │   ├── F13HaltChannel.ts       — Sovereign emergency halt
│   │   │   ├── f1Amanah.ts  …  f12Injection.ts   — Per-floor enforcement
│   │   │   ├── planFactory.ts          — Plan construction from missions
│   │   │   ├── preflight.ts            — Pre-execution checks
│   │   │   └── floor-types.ts          — Type system for constitutional verdicts
│   │   │
│   │   ├── planner/                ← Plan construction + validation
│   │   │   ├── PlanValidator.ts        — verifyGovernanceCard() + reversibility
│   │   │   └── ParallelPlannerContract.ts — Multi-plan coordination
│   │   │
│   │   ├── agents/                 ← Agent profiles + coordination
│   │   │   ├── AAAgent.ts / CoordinatorAgent.ts / WorkerAgent.ts
│   │   │   └── profiles.ts             — explore, forge, audit, general
│   │   │
│   │   ├── containment/            ← Execution sandbox
│   │   │   ├── ContainmentEngine.ts    — Sandbox lifecycle
│   │   │   ├── ExecutionSandbox.ts     — Isolated execution environment
│   │   │   └── SandboxPolicy.ts        — Resource limits + network caps
│   │   │
│   │   ├── memory-contract/        ← Memory constitution
│   │   ├── continuity/             ← Session persistence
│   │   ├── policy/                 ← confidence.ts, sense.ts
│   │   ├── reply/                  ← reply_forge.ts — constitutional response composer
│   │   ├── ops/                    ← SentinelStream, ThermodynamicCostEstimator
│   │   ├── scoreboard/             ← ForgeScoreboard, RunMetricsLogger
│   │   └── types/                  ← 20 type contract files (Plan, Agent, Session, etc.)
│   │
│   ├── application/                ← Application services (orchestration layer)
│   │   ├── approval/               ← Approval + escalation pipeline
│   │   │   ├── ApprovalBoundary.ts     — Layer 4: irreversibility gate
│   │   │   ├── ApprovalRouter.ts       — HOLD → human or APEX
│   │   │   ├── HumanEscalationClient.ts — Telegram/Webhook channels
│   │   │   └── PostgresTicketStore.ts  — Approval ticket persistence
│   │   │
│   │   ├── a2a/                    ← Agent-to-Agent protocol
│   │   │   ├── server.ts               — A2A task router
│   │   │   └── types.ts                — A2A envelope types
│   │   │
│   │   ├── discovery/              ← A2A agent-card discovery
│   │   ├── memory/                 ← ShortTermMemory + LongTermMemory + ArifOS bridge
│   │   ├── personal-v2/            ← PersonalOS — sovereign digital twin
│   │   ├── jobs/                   ← AgentManager, BackgroundJobManager
│   │   └── services/               ← ForgeExecutionService
│   │
│   ├── infrastructure/             ← I/O, external services, transport
│   │   ├── bridges/                ← Organ MCP bridges
│   │   │   ├── geoxBridge.ts           — GEOX MCP client
│   │   │   └── wealthBridge.ts         — WEALTH MCP client
│   │   │
│   │   ├── llm/                    ← Multi-provider LLM abstraction
│   │   │   ├── ChatCompletionProvider.ts — Streaming SSE + tool-use parsing
│   │   │   ├── BudgetAwareRouter.ts     — Cost-minimizing provider selection
│   │   │   ├── FallbackProvider.ts      — Provider failover chain
│   │   │   └── OllamaProvider.ts / SeaLionProvider.ts — Provider adapters
│   │   │
│   │   ├── tools/                  ← Built-in tool implementations
│   │   │   ├── ToolRegistry.ts         — Dynamic registration + permission gates
│   │   │   ├── FileTools.ts / ShellTools.ts / SearchTools.ts / EditorTools.ts
│   │   │   ├── MiniMaxTools.ts         — MiniMax MCP client
│   │   │   └── WealthTools.ts          — WEALTH domain tool wrappers
│   │   │
│   │   ├── vault/                  ← VAULT999 integration
│   │   │   ├── PostgresVaultClient.ts  — Direct Postgres
│   │   │   ├── SupabaseVaultClient.ts  — Supabase pooler
│   │   │   └── MerkleV3Service.ts      — Chain verification
│   │   │
│   │   ├── cli/                    ← Terminal forge
│   │   ├── code-mode/              ← Code execution sandbox
│   │   ├── metrics/                ← Prometheus metrics
│   │   └── notifier/               ← Telegram + Webhook escalation
│   │
│   ├── interfaces/                 ← HTTP, MCP, CLI entry points
│   │   ├── server.ts               ← Express-based HTTP server (port 7071)
│   │   ├── mcp/                    ← MCP protocol (server, client, stdio, tools)
│   │   ├── middleware/             ← ConstitutionalBoundary, operatorAuth
│   │   ├── routes/                 ← Approval, governance, vault, repo steward
│   │   └── config/                 ← RuntimeConfig, featureFlags, modes
│   │
│   └── util/  +  utils/           ← Shared utilities
│
├── test/                            ← 25 TypeScript test suites (~4,700 lines)
│   ├── AgentEngine.test.ts
│   ├── PlanValidator.test.ts
│   ├── AmanahLockManager.test.ts
│   ├── FloorEnforcer.test.ts
│   ├── sealService.test.ts
│   ├── thermodynamic.test.ts
│   └── ... 19 more
│
├── deploy/                          ← VPS deployment configs
├── contracts/                       ← Cross-organ interface contracts
├── docs/                            ← Documentation
├── governance/                      ← Policy YAML
├── scripts/                         ← Build/ops scripts
│
├── CONSTITUTION.md                  ← A-FORGE constitutional role + boundaries
├── FEDERATION_CONTRACT.md           ← Organ contract within arifOS Federation
├── INVARIANTS.md                    ← Live ports, forbidden assumptions
├── ARCHITECTURE.md                  ← Deep module map (150+ files, 16 modules)
├── RUNBOOK.md                       ← Start/stop/health/debug procedures
├── CONTEXT.md                       ← Live machine state for agents
├── AGENTS.md                        ← Agent operating rules + boundary contract
├── CHANGELOG.md                     ← Version history
├── CODEOWNERS                       ← Ownership map
├── Makefile                         ← build, test, install, clean
├── tsconfig.json                    ← TypeScript 6.0 config
├── package.json                     ← v2026.06.06, AGPL-3.0
├── smithery.yaml                    ← Smithery MCP registry entry
└── Dockerfile                       ← Production container build
```

---

## For Human Operators

### Arif — How to Trigger a Forge

You don't run A-FORGE directly. You speak to arifOS. The kernel judges. A-FORGE executes.

```
YOU (F13 SOVEREIGN)
    │
    │  "forge the WEALTH stock analysis"
    │
    ▼
arifOS (judge) ──→ evaluates F1–F13
    │
    │  JUDGE_SEAL_AUTHORIZATION
    │
    ▼
A-FORGE (execute) ──→ 4-layer gate ──→ builds, tests, deploys
    │
    │  telemetry: Prometheus + Supabase + VAULT999
    │
    ▼
AAA cockpit ──→ shows you what happened (green/red/yellow)
```

### What "888_HOLD" Means

If A-FORGE escalates to 888_HOLD, it means:

1. **The forge gate blocked an action** at Layer 4 (ApprovalBoundary)
2. The action is **irreversible** (deploy, delete, drop, force-push)
3. A-FORGE will **not proceed** without your explicit `ack_irreversible`
4. You will see an approval ticket in the AAA cockpit
5. Reply `888 approve <ticket_id>` to proceed, or `888 deny <ticket_id>` to halt

**888_HOLD is not a failure.** It's the system working correctly — catching what should not be auto-executed.

### Production Commands

```bash
# Check if A-FORGE is running
systemctl status a-forge

# Restart after deploy
systemctl restart a-forge

# View logs
journalctl -u a-forge -n 100 --no-pager

# Federation health check
curl -s http://127.0.0.1:7071/api/federation-probe | python3 -m json.tool
```

---

## For AI Agents

### How to Route Through A-FORGE

As an AI agent in the federation, you do not call A-FORGE's internal gates directly. You route through its **public MCP surface** and the **A2A protocol**.

```
Agent Intent
    │
    ▼
arif_session_init()           ← constitutional session binding
    │
    ▼
arif_mind_reason(mode=plan)   ← generate an execution plan
    │
    ▼
arif_judge_deliberate()       ← arifOS constitutional verdict
    │
    │  JUDGE_SEAL_AUTHORIZATION received
    │
    ▼
arif_forge_execute()          ← A-FORGE receives, gates, executes
    │
    ▼
arif_reply_compose()          ← surface the result to user
```

### The Forge Gate Rules for Agents

When calling `arif_forge_execute()`:

| Rule | What it means |
|------|---------------|
| **You must carry a valid JUDGE_SEAL_AUTHORIZATION** | The forge is cold without it. The gate will 888_HOLD. |
| **Your session must be bound** | `arif_session_init()` must have been called. Anonymous execution is blocked at F11. |
| **Reversible actions pass faster** | `reversibility_score > 0.5` skips Layer 4 entirely. |
| **Irreversible actions need your `ack_irreversible`** | If `ack_irreversible: false` and the action is irreversible → 888_HOLD. |
| **The forge gate is ordered** | Layer 1 → 2 → 3 → 4. No path skips any layer. |
| **HARAM at Layer 1 has no appeal** | `rm -rf /`, `DROP TABLE`, `dd if=/dev/zero` — blocked permanently. |

### Example: Executing a GEOX data ingest

```typescript
// DO: route through arifOS
const plan = await arifos.arif_mind_reason({
  mode: "plan",
  query: "Ingest LAS file for Well Bonanza-1"
});

const verdict = await arifos.arif_judge_deliberate({
  mode: "judge",
  candidate: plan.plan_id,
  ack_irreversible: false  // reversible = no HOLD
});
// → { verdict: "SEAL", judge_state_hash: "sha256:abcd..." }

const result = await aforge.arif_forge_execute({
  mode: "engineer",
  manifest: plan.manifest,
  judge_state_hash: verdict.judge_state_hash
});
// → A-FORGE auto-routes to GEOX MCP, returns QC results

// DON'T: call A-FORGE directly without judgment
// ❌ aforge.execute(raw_command)   ← blocked at Layer 4
// ❌ aforge.build({ skip_gate: true }) ← blocked at Layer 1
```

---

## For Institutions

### Governed Execution, Not Autonomous Agency

A-FORGE is built for institutions that need **execution with constitutional guarantees** — not black-box autonomy.

| Institutional Need | A-FORGE Mechanism |
|-------------------|-------------------|
| **Audit trail** | Every execution path logged to Supabase + VAULT999. Who authorized, what ran, what was the result, what was the reversibility score. |
| **No self-authorization** | A-FORGE cannot approve its own execution. The `JUDGE_SEAL_AUTHORIZATION` must come from arifOS. No employee, no agent, no bypass. |
| **Separation of powers** | arifOS judges. AAA routes. A-FORGE executes. No single organ holds all three. |
| **Reversibility gates** | Irreversible actions require explicit approval. 888_HOLD escalation with human-verifiable tickets. |
| **Defense in depth** | 4-layer gate chain. Even if Layer 2 is bypassed, Layers 1 and 3 remain. Even if all software gates are bypassed, F14 (the physical kill switch) stands. |
| **Observability** | Prometheus dashboards. Supabase tool call receipts. Langfuse trace sessions. No execution is invisible. |
| **AGPL-3.0 copyleft** | The governed execution runtime is free software. Any modification that runs on a network server must release its source. The constitutional authority (arifOS) remains the sole arbiter of lawful use. |

### The AGPL-3.0 Guarantee

A-FORGE is licensed under the **GNU Affero General Public License v3.0**. This means:

- **You can run it** for any purpose
- **You can study it** and modify it
- **You can redistribute it** with your changes
- **You MUST share your changes** if you run the modified version on a network server
- **The constitutional authority** (arifOS) is NOT covered by this license — it is the arbiter, not the runtime

AGPL-3.0 was chosen deliberately. Governed execution is meaningless if the governance itself is proprietary.

---

## Known Limitations

| Limitation | Status | Notes |
|-----------|--------|-------|
| **Pre-existing CI rot on main** | ⚠️ Known | `Boundary Guard` + `AF-FORGE CI` checks fail on main. These are CI infrastructure issues, not code defects. `make test` passes locally. |
| **No domain logic** | ✅ By design | A-FORGE is TypeScript-only. All geoscience/capital/human computation stays in Python MCP organs. |
| **Requires arifOS upstream** | ✅ By design | A-FORGE cannot execute without arifOS. This is the architecture, not a bug. |
| **GENESIS/012 stub** | ⏳ Pending | Full canon expansion pending F13 sovereign ratification. |
| **No production LLM router** | ⚠️ Roadmap | BudgetAwareRouter and FallbackProvider exist but need production hardening. |
| **25 test suites, not all pass CI** | ⚠️ Known | Local `make test` passes; CI infrastructure is stale. |

---

## Federation Cross-Reference

A-FORGE is one of **7 organs** in the arifOS Federation. Every organ has its own repository, port, and constitutional role.

| Organ | Repository | Role | Port | License |
|-------|-----------|------|------|---------|
| **arifOS** | [ariffazil/arifOS](https://github.com/ariffazil/arifOS) | Constitutional Kernel · Judge | 8088 | AGPL-3.0 |
| **A-FORGE** | [ariffazil/A-FORGE](https://github.com/ariffazil/A-FORGE) | Execution Shell · Forge | 7071 | AGPL-3.0 |
| **AAA** | [ariffazil/AAA](https://github.com/ariffazil/AAA) | Control Plane · Cockpit | 3001 | AGPL-3.0 |
| **GEOX** | [ariffazil/geox](https://github.com/ariffazil/geox) | Earth Intelligence | 8081 | AGPL-3.0 |
| **WEALTH** | [ariffazil/wealth](https://github.com/ariffazil/wealth) | Capital Intelligence | 18082 | AGPL-3.0 |
| **WELL** | [ariffazil/well](https://github.com/ariffazil/well) | Human Readiness | 18083 | AGPL-3.0 |
| **arif-sites** | [ariffazil/arif-sites](https://github.com/ariffazil/arif-sites) | Public Surfaces | 443 | AGPL-3.0 |

**Live federation status:** [FEDERATION_STATUS.md](https://github.com/ariffazil/arifOS/blob/main/FEDERATION_STATUS.md)
**Federation topology:** `/root/CONTEXT.md` on the VPS (live state)

---

## Build, Test, Deploy

### Local Development

```bash
# Install
npm install

# Build TypeScript → dist/
npm run build

# Run test suites (25 suites, ~4,700 lines)
make test
# → security-audit + build + all test suites

# Lint
npx tsc --noEmit

# Start locally
node dist/interfaces/server.js
# → listening on 127.0.0.1:7071
```

### Production (bare-metal systemd)

```bash
# Build & test
make test

# Deploy (commits should already be pushed to origin/main)
systemctl restart a-forge

# Verify
curl -s http://127.0.0.1:7071/health | python3 -m json.tool
# → {"ok":true,"service":"A-FORGE","version":"2026.06.06"}

# Check federation organs
curl -s http://127.0.0.1:7071/api/federation-probe | python3 -m json.tool
# → {"verdict":"GREEN","up":5,"total":5}

# Monitor
journalctl -u a-forge -f
```

### Available Makefile Targets

| Target | Description |
|--------|-------------|
| `make build` | Security audit (`security-audit.mk`) then TypeScript build |
| `make test` | Security audit + build + 25 test suites |
| `make install` | `npm install` |
| `make clean` | Remove `dist/` and `node_modules/` |

### Security Audit (Steel Security Layer)

Every `make build` and `make test` runs four tools non-blocking:

| Tool | What it scans |
|------|--------------|
| **Trivy** | Known CVEs in dependencies |
| **Semgrep** | Risky code patterns (injection, hardcoded credentials) |
| **Gitleaks** | Committed secrets (API keys, tokens) |
| **Ruff** | (Python organs only — not applicable to A-FORGE TypeScript) |

CRITICAL/HIGH findings fire a `888_HOLD` event into NATS. The scanners **never block** the build pipeline.

---

## GENESIS Chain

A-FORGE's constitutional mandate is anchored in the federation's GENESIS chain:

| Number | Document | Status |
|--------|----------|--------|
| **000** | `arifOS/GENESIS/000_KERNEL_CANON.md` | ✅ CANON — root source of truth |
| **012** | `A-FORGE/GENESIS/012_AFORGE_MANDATE.md` | ⏳ STUB — full canon pending F13 |

The GENESIS chain provides ordinal numbering for every constitutional document across the federation. 012 is reserved for A-FORGE. Full canon expansion requires F13 sovereign ratification.

**Invariants from 012 (binding regardless of stub status):**
1. Never self-authorize. Every execution requires `JUDGE_SEAL_AUTHORIZATION`.
2. Never adjudicate. Constitutional verdicts are arifOS territory only.
3. Never compute domain logic. No NumPy/Pandas/SciPy.
4. Always log. Every execution path produces F11-auditable telemetry.

---

## License & Sovereignty

```
A-FORGE — Governed Execution Shell of the arifOS Federation
Copyright (C) 2025–2026  Muhammad Arif bin Fazil

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.
```

**The execution runtime is free software. The constitutional authority (arifOS) is the sole arbiter of its lawful use.**

F13 SOVEREIGN: Muhammad Arif bin Fazil holds absolute veto over all execution paths. This license grants code freedom. It does not grant constitutional authority. The forge is governed. The constitution is sovereign.

---

<p align="center">
  <strong>arifOS judges. AAA routes. A-FORGE executes.</strong><br>
  <em>The muscle, not the conscience. The forge, not the verdict.</em>
</p>

<p align="center">
  <strong>DITEMPA BUKAN DIBERI — Forged, Not Given.</strong><br>
  <sub>999 SEAL ALIVE · arifOS Federation · v2026.06.06-HEXAGON</sub>
</p>
