# CLAUDE.md — A-FORGE Execution Engine

> **A-FORGE orchestrates and executes. It does NOT adjudicate.**
> **DITEMPA BUKAN DIBERI — Forged, Not Given.**

---

## 0. LOADING SEQUENCE

```bash
# 1. Install and build
npm ci && npm run build

# 2. Verify the engine compiles
ls dist/domain/engine/AgentEngine.js

# 3. Health check (if server is running)
curl -s http://localhost:7071/health | python3 -m json.tool

# 4. Run fast tests
node dist/test/PlanValidator.test.js
node dist/test/sense.test.js
```

---

## 1. WHAT THIS REPO IS

**A-FORGE** is the TypeScript execution shell of the arifOS federation. It:
- Runs governed agent loops (LLM → tool → governance → seal)
- Bridges arifOS judgment to execution substrates
- Exposes HTTP and MCP surfaces for agent interactions
- Enforces tool permission tiers and 888_HOLD before dangerous operations

**A-FORGE does NOT:** geoscience computation (GEOX), economic evaluation (WEALTH), or constitutional verdicts (arifOS).

---

## 2. ARCHITECTURE — HEXAGONAL LAYERS

```
src/
├── domain/          ← Pure business logic. No I/O. No external deps.
│   ├── engine/      ← AgentEngine.ts — the core agent loop
│   ├── governance/  ← GovernanceBridge, FloorEnforcer, mcpFloorEnforcer
│   ├── planner/     ← Task decomposition and plan validation
│   ├── agents/      ← Agent profiles and capability definitions
│   ├── policy/      ← Permission policies, trust tiers
│   └── types/       ← All shared domain types and ports
│
├── application/     ← Use cases and orchestration services
│   ├── services/    ← Composed workflows (run, deploy, forge)
│   ├── memory/      ← Long-term memory retrieval/storage
│   ├── approval/    ← Human approval gate management
│   └── a2a/         ← Agent-to-Agent protocol handlers
│
├── infrastructure/  ← External adapters (implements domain ports)
│   ├── llm/         ← LLM providers: OpenAI, SeaLion, Ollama, MiniMax
│   ├── tools/       ← MCP tool registry, tool execution
│   ├── vault/       ← VAULT999 writer, approval storage
│   ├── bridges/     ← arifOS/GEOX/WEALTH MCP bridges
│   └── cli/         ← Terminal, verify, compose root
│
└── interfaces/      ← Delivery mechanisms (HTTP, MCP stdio, CLI)
    ├── routes/      ← Express HTTP endpoints
    ├── mcp/         ← MCP stdio/HTTP server tools
    └── config/      ← RuntimeConfig — environment-driven behavior
```

**Composition root:** `src/infrastructure/cli/cli.ts`
**Agent loop:** `src/domain/engine/AgentEngine.ts`

---

## 3. BUILD, TEST, RUN

```bash
# Install + build (REQUIRED before any test run)
npm ci
npm run build

# Full test battery (CI standard)
make test

# Individual compiled test files
node dist/test/AgentEngine.test.js
node dist/test/PlanValidator.test.js
node dist/test/confidence.test.js
node dist/test/sense.test.js
node dist/test/governanceViolation.test.js
node dist/test/ticketStore.test.js
node dist/test/operatorConsole.test.js

# Start server (HTTP bridge, port 7071)
npm start

# MCP stdio mode
npm run mcp:stdio
```

---

## 4. KEY CONVENTIONS

- **NodeNext ESM** — intra-repo TypeScript imports use explicit `.js` extensions.
- **Tests run from `dist/test/`**, not source. Always rebuild before running tests.
- **New tools** → extend `BaseTool` in `src/infrastructure/tools/base.ts`, assign `riskLevel`, register in `buildToolRegistry()` in `src/infrastructure/cli/cli.ts`.
- **Tool risk tiers:** `low` → auto-execute | `medium` → advisory check | `high/critical` → force human approval.
- **`external_safe_mode`** removes `run_command` and redacts secrets. Default for untrusted contexts.
- **`AGENT_WORKBENCH_TRUST_LOCAL_VPS=1`** opens full internal mode — high blast radius.
- **`ScriptedProvider`** for deterministic multi-turn engine tests.

---

## 5. GOVERNANCE BOUNDARY CONTRACT

| ✅ A-FORGE does | ❌ A-FORGE never does |
|----------------|----------------------|
| Routes intent to arifOS/GEOX/WEALTH/WELL | Geoscience computation (Vsh, φ, Sw) |
| Handles orchestration, retries, escalation | Economic evaluation logic |
| Runs advisory checks (non-binding) | Constitutional verdicts (SEAL/VOID/HOLD) |
| Build, deploy, artifact execution | Import NumPy, Pandas, SciPy, lasio, welly |

---

## 6. 888_HOLD BEFORE

- `rm -rf` of unknown directories
- `git push --force` or `git rebase`
- Production deploys without verified test pass
- Any destructive database operation

---

*Companion: `/root/AGENTS.md` (federation-wide), `/root/CONTEXT.md` (live state)*
*DITEMPA BUKAN DIBERI — 999 SEAL ALIVE*
