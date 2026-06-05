# A-FORGE Architecture

> **Last verified:** 2026-06-05
> **Source files:** 150 TypeScript (~24K lines)
> **Runtime:** Node.js 22+, Express 5, TypeScript 6

---

## Architecture Overview

A-FORGE is a **governed agent runtime** — not a generic agent framework, not a constitutional kernel. It accepts approved execution plans, applies constitutional gates inline, executes across MCP organs, and produces telemetry for the AAA cockpit.

```
                    ┌──────────────┐
                    │   arifOS     │  Constitutional Kernel
                    │   (judge)    │  F1-F13, SEAL/SABAR/VOID
                    └──────┬───────┘
                           │ JUDGE_SEAL_AUTHORIZATION
                           ▼
                    ┌──────────────┐
                    │   A-FORGE    │  Governed Execution Shell
                    │  (execute)   │  4-layer forge gate
                    └──┬───┬───┬──┘
                       │   │   │
              ┌────────┘   │   └────────┐
              ▼            ▼            ▼
        ┌─────────┐ ┌──────────┐ ┌──────────┐
        │  GEOX   │ │ WEALTH   │ │  WELL    │
        │ (earth) │ │ (capital)│ │ (human)  │
        └─────────┘ └──────────┘ └──────────┘
```

---

## Module Architecture (150 files across 16 modules)

```
src/
├── engine/             ← Core Agent Loop (6 files)
│   ├── AgentEngine.ts          — Primary agent loop: LLM → tool → result → repeat
│   ├── PipelineCoordinator.ts  — Plan execution with governance gates
│   ├── IntentRouter.ts         — Routes user intent to correct organ/tool
│   ├── ArifOSKernel.ts         — arifOS MCP client for constitutional checks
│   ├── BudgetManager.ts        — Token/cost budgeting across providers
│   ├── RunReporter.ts          — Metrics aggregation for scoreboard
│   └── ...
│
├── governance/         ← Constitutional Floor Enforcement (16 files)
│   ├── ModelCapabilityGate.ts  — Fast spine-check before model access
│   ├── AmanahLockManager.ts    — F1 catastrophic action detection
│   ├── PolicyEnforcer.ts       — Policy evaluation engine
│   ├── GovernanceBridge.ts     — Bridge to arifOS for full floor evaluation
│   ├── f3Witness.ts            — F3 greeting bypass + witness check
│   ├── f6Empathy.ts            — F6 empathy evaluation
│   ├── f9AntiHantu.ts          — F9 anti-hallucination / ghost detection
│   ├── f11Auth.ts / f11Coherence.ts — F11 authorization + coherence
│   ├── SealService.ts          — VAULT999 seal integration
│   ├── preflight.ts            — Pre-flight checks before execution
│   └── ...
│
├── planner/            ← Plan Validation (2 files)
│   ├── PlanValidator.ts        — verifyGovernanceCard() + reversibility scoring
│   └── ParallelPlannerContract.ts — Multi-plan coordination contract
│
├── approval/           ← Approval & Escalation (7 files)
│   ├── ApprovalBoundary.ts     — Irreversibility threshold + 888_HOLD escalation
│   ├── ApprovalRouter.ts       — Routes HOLDs to human or APEX
│   ├── HumanEscalationClient.ts — Telegram/Webhook escalation channels
│   └── ...
│
├── bridges/            ← Organ MCP Bridges (2 files)
│   ├── geoxBridge.ts           — GEOX MCP client
│   └── wealthBridge.ts         — WEALTH MCP client
│
├── mcp/                ← MCP Server Implementation (7 files)
│   ├── server.ts               — Express-based MCP server (port 7071)
│   ├── cli.ts                  — CLI entry point for MCP
│   ├── client.ts               — MCP client for connecting to other organs
│   ├── stdio.ts                — Stdio transport for local agents
│   └── ...
│
├── llm/                ← Multi-Provider LLM (8 files)
│   ├── LlmProvider.ts          — Interface definition
│   ├── ChatCompletionProvider.ts — Streaming SSE support + tool-use parsing
│   ├── BudgetAwareRouter.ts    — Routes to cheapest capable model
│   ├── FallbackProvider.ts     — Provider fallback chain
│   ├── OllamaProvider.ts       — Local Ollama (bge-m3)
│   ├── SeaLionProvider.ts      — SEA_LION trial provider
│   └── ...
│
├── tools/              ← Tool Registry & Implementations (12 files)
│   ├── ToolRegistry.ts         — Dynamic tool registration + permission gates
│   ├── FileTools.ts / ShellTools.ts / SearchTools.ts — Built-in tools
│   ├── EditorTools.ts          — Code editing tools
│   ├── MiniMaxTools.ts         — MiniMax MCP client integration
│   └── ...
│
├── agents/             ← Agent Profiles & Coordination (4 files)
│   ├── profiles.ts             — Agent profiles (explore, forge, audit, etc.)
│   ├── AAAgent.ts / CoordinatorAgent.ts / WorkerAgent.ts
│
├── memory/             ← Layered Memory (2 files)
│   ├── ShortTermMemory.ts      — Sliding window + eviction to long-term
│   └── LongTermMemory.ts       — File-backed archival
│
├── types/              ← Type Contracts (16 files)
│   ├── agent.ts, tool.ts, session.ts, plan.ts, sovereign.ts
│   ├── forge.ts, policy.ts, wealth.ts, memory.ts
│   └── ...
│
├── config/             ← Runtime Configuration (3 files)
│   ├── RuntimeConfig.ts        — Environment-driven config
│   └── featureFlags.ts / modes.ts
│
├── discovery/          ← A2A Discovery (2 files)
│   └── A2ACard.ts              — Agent card generation + .well-known endpoint
│
├── vault/              ← VAULT999 Integration (5 files)
│   ├── PostgresVaultClient.ts  — Direct Postgres access
│   ├── SupabaseVaultClient.ts  — Supabase pooler access
│   ├── MerkleV3Service.ts      — Merkle chain verification
│   └── ...
│
├── cli/                ← Terminal Forge (5 files)
│   ├── terminal.ts             — Interactive terminal with streaming LLM
│   ├── commands.ts             — /tools, /federation, /status, /retry, /save
│   └── ...
│
├── a2a/                ← A2A Protocol (4 files)
│   └── server.ts               — Agent-to-Agent task routing
│
└── ops/                ← Operations (2 files)
    └── ThermodynamicCostEstimator.ts — Compute budget estimation
```

---

## Execution Flow

```
User Intent
    │
    ▼
IntentRouter ──→ which organ handles this?
    │
    ▼
PlanValidator ──→ verifyGovernanceCard() — is the model capable?
    │
    ▼
ModelCapabilityGate ──→ fast spine-check from arifOS registry
    │
    ├─ (fail) → 888_HOLD → ApprovalBoundary
    │
    ▼ (pass)
GovernanceBridge ──→ F3/F6/F9/F11 full evaluation
    │
    ├─ (fail) → 888_HOLD → ApprovalBoundary
    │
    ▼ (pass)
AmanahLockManager ──→ F1 catastrophic action detection
    │
    ├─ (triggered) → HARAM → BLOCKED
    │
    ▼ (pass)
ToolRegistry.execute()
    │
    ▼
Result → RunReporter → Prometheus + Supabase + VAULT999
```

---

## Federation Discovery

On startup, A-FORGE discovers all connected organs via A2A agent cards:

```
A-FORGE startup
  ├── Probe arifOS  at 127.0.0.1:8088  → 13 tools registered
  ├── Probe GEOX    at 127.0.0.1:8081  → 31 tools registered
  ├── Probe WEALTH  at 127.0.0.1:18082 → 44 tools registered
  ├── Probe WELL    at 127.0.0.1:18083 → 45 tools registered
  └── Probe AAA     at 127.0.0.1:3001  → A2A gateway active
  ─────────────────────────────────────
  TOTAL: 62+ tools across 5 organs
```

The `/api/federation-probe` endpoint returns live status of all connected organs.

---

## Key Design Decisions

1. **No NumPy/Pandas.** A-FORGE is TypeScript-only. All domain computation stays in the Python MCP organs.
2. **Gates are inline, not wrapped.** Each execution path hits the governance pipeline in-route, not as a middleware layer.
3. **No self-authorization.** A-FORGE cannot approve its own execution. Every forge requires external JUDGE_SEAL_AUTHORIZATION from arifOS.
4. **Streaming-first LLM.** SSE parsing in ChatCompletionProvider with onToken/onThinking/onComplete callbacks.
5. **Multi-provider with fallback.** BudgetAwareRouter selects cheapest capable model; FallbackProvider handles provider outages.

---

## Related

- `CONSTITUTION.md` — A-FORGE's constitutional role and boundaries
- `INVARIANTS.md` — Live ports, federation topology, forbidden assumptions
- `QUICKSTART.md` — 15-minute local setup
- `README.md` — Repository overview

**DITEMPA BUKAN DIBERI — Forged, Not Given.**
