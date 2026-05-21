<!-- SOT-MANIFEST
owner: Arif
last_verified: 2026-05-22
valid_from: 2026-05-22
valid_until: 2026-06-22
confidence: high
scope: /root/A-FORGE
epistemic_status: CLAIM
-->

# A-FORGE — Governed Execution Runtime

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8%2B-3178C6?style=flat-square)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?style=flat-square)](https://nodejs.org/)
[![arifOS](https://img.shields.io/badge/arifOS-F1%E2%80%93F13_Governed-FF6B00?style=flat-square)](https://github.com/ariffazil/arifos)

> **In one sentence:** A-FORGE is the engine — when arifOS says "approved," A-FORGE is what actually runs the code, builds the artifact, or executes the task.

**Federation role:** EXECUTION / FORGE
**Surfaces:** CLI · MCP (stdio + HTTP) · HTTP Bridge (port 7071)
**Authority:** arifOS SEAL required for all destructive operations

---

## What This Is

A-FORGE executes governed agent workloads under arifOS constitutional law. It takes a request, runs it through policy gates, calls arifOS for approval on high-risk actions, executes the approved action, and records the result in VAULT999 — irreversibly if sealed.

**The question A-FORGE answers:** How does an approved action get executed safely and verifiably?

---

## What It Is / What It Is NOT

| What A-FORGE IS | What A-FORGE is NOT |
|-----------------|---------------------|
| Execution runtime for governed agents | The constitutional law kernel (→ arifOS) |
| MCP server for agent tool calls | The human cockpit (→ AAA) |
| HTTP bridge for external agent access | The Earth-science engine (→ GEOX) |
| Multi-LLM orchestration shell | The capital intelligence engine (→ WEALTH) |
| Budget and cost estimation layer | Final authority on constitutional verdicts |

A-FORGE executes under governance. It does not grant itself authority.

---

## Execution Flow

```
Human / Agent Request
        ↓
┌─────────────────────┐
│  CLI / MCP / HTTP   │  ← Three entry points; same execution pipeline
│  Bridge             │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  AgentEngine        │  ← Orchestrates LLM + tools, budget, intent routing
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  Governance Gates   │  ← F3–F13 floor checks; arifOS SEAL call if needed
│  (F3–F13)           │
└──────────┬──────────┘
           ↓ (approved)
┌─────────────────────┐
│  Tool Execution     │  ← File, shell, code-mode, search, wealth tools
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  Approval Boundary  │  ← Human-in-loop for destructive / high-risk operations
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  VAULT999           │  ← Immutable Merkle-V3 audit record
└─────────────────────┘
```

---

## Quick Start

```bash
# Install
npm install

# Build TypeScript → dist/
npm run build

# Run all tests
npm test
# or: make test (runs all 18 test files individually)

# Start HTTP bridge (port 7071)
node dist/src/server.js

# Start MCP stdio server
node dist/src/mcp/cli.js serve --transport stdio

# Full docker stack
make up    # docker compose up -d --build --remove-orphans
make down  # docker compose down
```

---

## Repository Structure

```
A-FORGE/
├── src/                        # ALL canonical TypeScript source
│   │
│   ├── server.ts               # HTTP Bridge — Express composition root (port 7071)
│   ├── cli.ts                  # CLI entry point — full runtime assembly
│   ├── index.ts                # Public API exports
│   │
│   ├── engine/                 # AgentEngine, BudgetManager, RunReporter, IntentRouter
│   ├── mcp/                    # MCP server core, CLI runner, SSE/stdio transport, telemetry
│   │
│   ├── tools/                  # Executable tool implementations
│   │   ├── FileTools.ts        # Read, write, delete, patch files
│   │   ├── ShellTools.ts       # Bash execution (governed, sandboxed)
│   │   ├── SearchTools.ts      # Code search, grep, glob
│   │   ├── EditorTools.ts      # Editor-style multi-block patching
│   │   └── ToolRegistry.ts     # Central tool registration
│   │
│   ├── governance/             # F3–F13 runtime floor gates
│   │   ├── CoolingGate.ts      # Rate limiting + cooling periods
│   │   ├── AmanahLockManager.ts # Reversibility enforcement (F1)
│   │   └── floors/             # Per-floor runtime implementations
│   │
│   ├── approval/               # Human-in-loop approvals
│   │   ├── TicketStore.ts      # Pending approval tickets
│   │   ├── ApprovalBoundary.ts # Route actions requiring human ack
│   │   └── ApprovalRouter.ts   # Approval request dispatcher
│   │
│   ├── vault/                  # VAULT999 immutable ledger clients
│   │   ├── PostgresVault.ts    # Direct Postgres append-only writes
│   │   ├── SupabaseVault.ts    # Supabase REST vault client
│   │   └── MerkleV3.ts         # Merkle hash chain implementation
│   │
│   ├── llm/                    # Multi-provider LLM abstraction
│   │   ├── OllamaProvider.ts   # Local Ollama (primary)
│   │   ├── OpenAIProvider.ts   # OpenAI-compatible endpoints
│   │   ├── SeaLionProvider.ts  # SEA-LION (AI Singapore)
│   │   ├── MockLlmProvider.ts  # Deterministic mock for tests
│   │   └── FallbackProvider.ts # Cascade: Ollama → OpenAI → Mock
│   │
│   ├── memory/                 # 5-tier memory implementation
│   ├── memory-contract/        # Memory contract types + governance
│   │
│   ├── planner/                # Plan validation + parallel plan contracts
│   ├── agents/                 # CoordinatorAgent, WorkerAgent, AAAgent
│   ├── a2a/                    # A2A v1.0.0 router + message types
│   ├── routes/                 # Express route handlers
│   ├── middleware/             # Auth, rate-limit, logging
│   ├── guards/                 # Execution guards (auth, sandbox boundary)
│   ├── escalation/             # HOLD state escalation paths
│   ├── flags/                  # Feature flags
│   ├── ops/                    # ThermodynamicCostEstimator (777 OPS)
│   ├── metrics/                # Prometheus instrumentation
│   ├── policy/                 # Policy enforcement rules
│   ├── code-mode/              # CodeModeExecutor, NodeSandbox, SecurityScanner
│   ├── jobs/                   # AgentManager, BackgroundJobManager
│   ├── discovery/              # Service discovery
│   ├── continuity/             # Session continuity across turns
│   ├── personal/               # Personal OS v1 (SovereignLoop, DailyLoop, HumanCLI)
│   ├── personal-v2/            # Personal OS v2 (remember/recall/track/think/hold)
│   ├── scoreboard/             # Execution scoreboard + run history
│   ├── notifier/               # Notification system
│   ├── domains/                # Domain-specific logic
│   ├── types/                  # Shared TypeScript type definitions
│   ├── utils/                  # Utility functions
│   └── config/                 # Config loaders
│
├── test/                       # 18 *.test.ts files (node:test built-in runner)
│                               # Run from dist/test/ after npm run build
├── scripts/                    # Ops scripts, pre-push governance hooks
├── deploy/                     # Caddy, Grafana, Prometheus, systemd configs
├── contracts/                  # MCP + governance contracts (JSON)
├── docs/                       # Architecture, API, operations docs
│   ├── ARCHITECTURE.md
│   ├── AGENT_LAYOUT_CONTRACT.md
│   └── archive/
└── Makefile                    # Local dev + VPS ops targets
```

---

## For Agentic Coders: How to Extend

### Add a new executable tool

1. Create `src/tools/MyNewTool.ts`:

```typescript
import { z } from "zod";
import type { Tool, ToolResult } from "../types/Tool.js";  // .js extension required

export class MyNewTool implements Tool {
  name = "my_new_tool";
  description = "What this does in one sentence";
  inputSchema = z.object({
    target: z.string().describe("The target to act on"),
    dry_run: z.boolean().default(true),
  });

  async execute(input: z.infer<typeof this.inputSchema>): Promise<ToolResult> {
    if (input.dry_run) {
      return { success: true, output: "[DRY RUN] would execute on " + input.target };
    }
    // real execution here
    return { success: true, output: "done" };
  }
}
```

2. Register in `src/tools/ToolRegistry.ts`
3. Add tests in `test/MyNewTool.test.ts`
4. Run `npm run build` — tests run from `dist/test/`

### Critical: TypeScript import convention

This repo uses **NodeNext ESM resolution**. All local imports **must** use `.js` extension:

```typescript
// CORRECT — NodeNext requires .js
import { AgentEngine } from "../engine/AgentEngine.js";
import { VaultClient } from "../vault/PostgresVault.js";

// WRONG — will fail at runtime
import { AgentEngine } from "../engine/AgentEngine";
import { AgentEngine } from "../engine/AgentEngine.ts";
```

### Governance rules for new tools

- **Read-only tools:** Can bypass `ApprovalBoundary` but must log to VAULT999
- **Write / modify tools:** Must go through `ApprovalBoundary`
- **Destructive tools:** Must receive `ack_irreversible: true` from caller
- **External network tools:** Need governance gate + retry budget
- Every tool should default to `dry_run: true`

### Add a new LLM provider

1. Implement `LlmProvider` interface in `src/llm/`
2. Register in `src/llm/FallbackProvider.ts` cascade chain
3. Add health check in the provider constructor

---

## Federation Map

| Repo | Role | What A-FORGE gets from it |
|------|------|--------------------------|
| [arifOS](https://github.com/ariffazil/arifos) | LAW | Floor checks, SEAL/HOLD/VOID verdicts |
| [AAA](https://github.com/ariffazil/AAA) | INTERFACE | Session context, A2A task routing |
| **A-FORGE** | EXECUTION | — |
| [GEOX](https://github.com/ariffazil/geox) | FIELD | Earth evidence (as MCP tool consumer) |
| [WEALTH](https://github.com/ariffazil/wealth) | CAPITAL | Financial evidence (as MCP tool consumer) |

---

## Ownership Boundaries

- `src/` is the ONLY canonical source. Never edit `dist/` directly.
- `test/` uses Node.js built-in `node:test` — no Jest, no Vitest, no Mocha.
- A-FORGE may **execute** governed actions but may **NOT** issue constitutional verdicts.
- A-FORGE may **orchestrate** other agents but may **NOT** override arifOS floor decisions.
- Every commit must include `REPO=ariffazil/A-FORGE` trailer.
- Do NOT reintroduce sibling-repo artifacts (GEOX Python files, arifOS deploy configs) at the repo root.

---

## TREE777 Wiki

Full architecture documentation and design decisions:
→ **https://wiki.arif-fazil.com**

---

*Last Verified: 2026-05-22 | 999 SEAL ALIVE*
**DITEMPA BUKAN DIBERI — Forged, Not Given.**
