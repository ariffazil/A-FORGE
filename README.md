# AF-FORGE ΔΩΨ — Agent Workbench (TypeScript Runtime)

> **⚠️ SOURCE OF TRUTH:** This is a **TypeScript runtime shell** for the arifOS ecosystem.
> 
> **Canonical doctrine and kernel:** [`ariffazil/arifOS`](https://github.com/ariffazil/arifOS)
> 
> **Runtime truth:** `/health` and `/tools` on deployed arifOS server

**Constitutional Event-Sourced Agent Runtime**  
*Ditempa Bukan Diberi — Forged, Not Given*

> AF-FORGE is not a chatbot wrapper. It is a **governed agentic machine** — a Planner/Executor/Verifier triad running over an append-only event log, with a policy engine, memory gateway, and human sovereignty gate (888_HOLD) baked into the architecture.

---

## Why AF-FORGE Exists

Most agent systems feel chaotic because:
- State is implicit (chat loop, not state machine)
- Memory is dirty (any agent writes anywhere)
- Tools are overpowered (no reversibility labels)
- Nothing is replayable ("what happened?" = guesswork)

AF-FORGE fixes all four by being **a factory, not a karaoke machine**:

| Role | Component | Constraint |
|------|-----------|-----------|
| Worker intelligence | LLM (any provider) | Bounded by policy |
| Foreman | Control plane + policy engine | Risk-scores every action |
| CCTV + ledger | Event store (append-only) | Hash-chained, replayable |
| Safety officer | 888_HOLD gates | Human ratification required |

---

## Architecture

```
ARIF (Sovereign) ──────────────────────────────────────
                        │ 888_HOLD approvals
                   Dashboard / CLI approval queue
                        │
CONTROL PLANE ──────────────────────────────────────────
Policy Engine  →  ALLOW | ON_LOOP | 888_HOLD | DENY
Feature Flags  →  Redis-backed, sovereign-gated
Approval Queue →  ON_LOOP (TTL auto) + 888_HOLD (block)
                        │
AGENT PLANE ────────────────────────────────────────────
Planner   →  goal → steps, CANNOT exec shell/network
Executor  →  bounded tools only, emits structured events
Verifier  →  checks diffs/tests/policy before promotion
                        │
EVENT STORE ────────────────────────────────────────────
Append-only, hash-chained, fully replayable
TASK_CREATED → PLAN_PROPOSED → APPROVAL_REQUIRED
→ TOOL_RUN_STARTED → TOOL_RUN_FINISHED
→ TASK_COMPLETED | TASK_ABORTED
                        │
MEMORY GATEWAY ─────────────────────────────────────────
All reads/writes through one governed service
L1: fast index (TTL)  |  L2: embeddings  |  L3: archive
                        │
VAULT999 ───────────────────────────────────────────────
Immutable seals (arifOS VAULT999 integration)
```

---

## Task State Machine

```
TASK_CREATED
    → PLAN_PROPOSED        (planner emits steps)
    → APPROVAL_REQUIRED    (high-risk action detected)
    → TOOL_RUN_STARTED     (executor begins)
    → TOOL_RUN_FINISHED    (executor done)
    → MEMORY_WRITE_BLOCKED (memory gateway rejected write)
    → TASK_COMPLETED       (verifier approved)
    → TASK_ABORTED         (policy denied or human cancelled)
```

---

## Tool Risk Registry

| Scope | Examples | Gate |
|-------|----------|------|
| `read_only` | repo scan, summarize, test read | ALLOW |
| `write_safe` | branch create, local edit, sandbox test | ON_LOOP |
| `external_network` | package install, web fetch | ON_LOOP |
| `destructive` | delete files, drop tables | **888_HOLD** |
| `credential` | secret handle, .env write | **888_HOLD** |
| `infra_mutation` | docker-compose, traefik | **888_HOLD** |
| `merge_publish` | protected branch merge | **888_HOLD** |

---

## Current Source Structure

```
src/
  agents/          CoordinatorAgent, WorkerAgent (→ becoming Planner/Executor)
  cli/             Command parsing
  config/          RuntimeConfig — env-driven
  engine/          AgentEngine (core loop), BudgetManager, RunReporter
  flags/           FeatureFlags, autonomy modes
  jobs/            BackgroundJobManager
  llm/             LlmProvider interface + OpenAI/Mock providers
  memory/          ShortTermMemory + LongTermMemory
  scoreboard/      ForgeScoreboard metrics, RunMetricsLogger
  tools/           FileTools, SearchTools, ShellTools, ToolRegistry
  types/           Shared contracts
  utils/           fs, paths
```

---

## Upgrade Roadmap (AF-FORGE v1)

### Week 1 — Event Foundation
- [ ] `event_store.ts` — append-only task+event tables, hash-chained
- [ ] `task_fsm.ts` — explicit state machine (replaces chat loop)
- [ ] `approval_queue.ts` — ON_LOOP (TTL) + 888_HOLD (block) routing
- [ ] Replay endpoint — dry-run state reconstruction from event log

### Week 2 — Agent Plane
- [ ] Planner agent — goal→steps, no exec tools
- [ ] Executor agent — bounded tools, emits structured events
- [ ] Tool registry upgrade — reversibility + risk labels per tool
- [ ] Policy engine — ALLOW/ON_LOOP/888_HOLD/DENY risk scoring

### Week 3 — Verification
- [ ] Verifier agent — gates TOOL_RUN_FINISHED → TASK_COMPLETED
- [ ] Evidence maps — every conclusion links to tool outputs
- [ ] Checkpoint summaries — compress state every N events

### Week 4 — Memory Governance
- [ ] Memory gateway — single service, no direct writes by agents
- [ ] TTL + provenance metadata on all memory objects
- [ ] Rollback snapshots — recover from poisoning/drift
- [ ] Runtime feature flags (Redis-backed, sovereign-gated)

---

## Feature Flags

```typescript
// Current (env-based, Week 1)
ENABLE_BACKGROUND_JOBS
ENABLE_EXPERIMENTAL_TOOLS
ENABLE_DANGEROUS_TOOLS

// Planned (Redis-backed, sovereign-gated)
event_sourcing        // Week 1 foundation
planner_executor      // Week 2
policy_engine         // Week 2
verifier_gate         // Week 3
memory_gateway        // Week 4
sabr_daemon           // Future: background autonomous agent
swarm_agents          // Future: only after logs+gates solid
browser_tool          // Future: Playwright
```

---

## Quick Start

```bash
cd af-forge
npm install
npm run build
npm test

# With local VPS trust (high-blast-radius — treat as root key)
AGENT_WORKBENCH_TRUST_LOCAL_VPS=1 node dist/src/cli.js explore "scan this repo"
```

---

## Constitutional Principles (from arifOS)

- **F1 Amanah** — No irreversible action without VAULT999 seal
- **F2 Truth** — No ungrounded claims (τ ≥ 0.99)
- **F9 Anti-Hantu** — No manipulation, no deception
- **F13 Sovereign** — Arif holds final authority (888_HOLD)

---

## Relation to arifOS

AF-FORGE is the **TypeScript execution runtime** that complements the Python arifOS kernel:

| Layer | Repo | Role |
|-------|------|------|
| Constitutional kernel | `ariffazil/arifOS` | F1-F13, VAULT999, G† physics |
| Agent runtime | `ariffazil/af-forge` | Planner/Executor/Verifier, event store, policy engine |
| Frontend | waw (React 19) | Dashboard, approval inbox |

*AF-FORGE is not a fork or port of any leaked source. Architecture is original, principles distilled from public research.*

---

**Motto:** *Ditempa Bukan Diberi* — Forged, Not Given [ΔΩΨ | ARIF]
