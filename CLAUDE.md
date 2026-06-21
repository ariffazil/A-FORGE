# CLAUDE.md — A-FORGE Execution Engine

> **Canonical agent instruction file:** `/root/AAA/CLAUDE.md`
> **A-FORGE** — governed execution shell of the arifOS federation.
> **HTTP Port:** 7071 | **MCP Port:** 7072 | **Runtime:** Node.js 22+, TypeScript 6.0

**A-FORGE orchestrates and executes. It does NOT adjudicate.**
**DITEMPA BUKAN DIBERI — Forged, Not Given.**

---

## 0. LOADING SEQUENCE

```bash
npm ci && npm run build
ls dist/interfaces/server.js      # Verify compile
curl -s http://localhost:7071/health | python3 -m json.tool
node dist/test/PlanValidator.test.js
```

---

## 1. WHAT THIS REPO IS

A-FORGE is the **governed execution shell** of the arifOS Federation. It:

- **Executes** approved plans through the 4-layer forge gate (F1 → Model → Governance → Irreversibility)
- **Auto-discovers** 62+ tools across 5 MCP surfaces (arifOS, GEOX, WEALTH, WELL, A-FORGE)
- **Bridges** arifOS SEAL authorization to execution substrates
- **Hosts** MIND:51001 & MEMORY:51002 federated intelligence services
- **Terminal forge** — interactive streaming-LLM interface with session persistence

**A-FORGE NEVER:** geoscience (GEOX), economics (WEALTH), verdicts (arifOS), NumPy/Pandas.

---

## 2. ARCHITECTURE — HEXAGONAL LAYERS

```
src/
├── domain/          ← Pure business logic. No I/O.
│   ├── engine/      ← AgentEngine.ts — core agent loop
│   ├── governance/  ← 4-layer forge gate: AmanahLock, ModelCapability, GovernanceBridge, ApprovalBoundary
│   ├── planner/     ← PlanValidator.ts — verifyGovernanceCard + reversibility
│   ├── agents/      ← Agent profiles and capability definitions
│   ├── policy/      ← Permission policies, trust tiers
│   └── types/       ← All shared domain types and ports
├── application/     ← Use cases: services, approval, memory, a2a, jobs
├── infrastructure/  ← Adapters: llm, tools, vault, bridges, cli, code-mode, metrics
└── interfaces/      ← Delivery: server.ts (Express 7071), routes, mcp, config
```

---

## 3. THE 4-LAYER FORGE GATE

Every execution passes ALL four layers. No skipping.

| Layer | Component | Verdict |
|-------|-----------|---------|
| **1: F1 AMANAH** | `AmanahLock.ts` — catastrophic pattern scan | HARAM/BLOCK | HOLD | PASS |
| **2: Model Capability** | `ModelCapabilityGate.ts` — identity + capability band | DEGRADED | MISSING | PASS |
| **3: Governance Bridge** | `GovernanceBridge.ts` — F1-F12 floor eval via arifOS | SEAL | SABAR | VOID |
| **4: Approval Boundary** | `ApprovalBoundary.ts` — irreversibility check | APPROVED | 888_HOLD | DENIED |

**Iron rule:** No layer may be skipped. No execution path may be silent.

---

## 4. BUILD, TEST, RUN

```bash
# Install + build
npm ci && npm run build

# Full test battery
make test

# Compiled test files
node dist/test/AgentEngine.test.js
node dist/test/PlanValidator.test.js
node dist/test/sense.test.js
node dist/test/governanceViolation.test.js

# Start HTTP server (port 7071)
npm start

# MCP stdio mode
npm run mcp:stdio
```

---

## 5. KEY CONVENTIONS

- **NodeNext ESM** — intra-repo imports use explicit `.js` extensions
- **Tests run from `dist/test/`** — rebuild before testing
- **Tool risk tiers:** low → auto | medium → advisory | high/critical → 888_HOLD
- **`FloorEnforcer`** emits canonical `SABAR` not legacy `CAUTION` (fix per `9ded584`)
- **STALE SOT FILES:** CLAUDE.md ✅ Updated 2026-06-21

---

## 6. GOVERNANCE BOUNDARY

| ✅ A-FORGE does | ❌ A-FORGE never does |
|----------------|----------------------|
| Routes intent to arifOS/GEOX/WEALTH/WELL | Geoscience computation |
| 4-layer forge gate on every execution | Economic evaluation logic |
| Build, deploy, orchestrate | Constitutional verdicts (SEAL/VOID/HOLD) |
| Terminal forge with session persistence | Import NumPy, Pandas, SciPy |

---

## 7. 888_HOLD BEFORE

- `rm -rf` unknown dirs | `git push --force` | `git rebase`
- Production deploy without test pass
- Destructive DB ops | Secret rotation

---

**Companion:** `/root/AAA/CLAUDE.md` (federation-wide)
**DITEMPA BUKAN DIBERI — 999 SEAL ALIVE**
