# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Repository Layout

This workspace is a **constitutional AI governance ecosystem** with three primary subprojects:

| Directory | Stack | Role |
|-----------|-------|------|
| `AF-FORGE/` | TypeScript / Node.js 22+ | Agent runtime (Planner/Executor/Verifier, event store, policy engine) |
| `arifOS/` | Python 3.12+ / FastMCP | Constitutional kernel (13 Floors F1–F13, MCP server, VAULT999) |
| `GEOX/` | Python 3.10+ + React 19 | Geospatial co-agent (seismic, well-log, governance verdicts) |
| `APEX/` | Docs only | Constitutional theory hub |
| `WORKFLOWS/` | Markdown | Autonomous workflow definitions (Subuh, Morning, etc.) |
| `VAULT999/` | Ledger | Immutable audit registry for sealed verdicts |

Each subproject has its own CLAUDE.md / AGENTS.md — this file covers workspace-level conventions.

---

## AF-FORGE Commands

Work from `AF-FORGE/`:

```bash
npm install          # install dependencies
npm run build        # compile TypeScript → dist/ (required before every test run)
npm test             # run all tests (node:test built-in, no jest/vitest)

# Run a single test by name
node dist/test/AgentEngine.test.js 2>&1 | grep -A5 "test name"

# CLI
node dist/src/cli.js <command> [options]
# e.g. node dist/src/cli.js explore "scan this repo"

# Full trust mode (root-key equivalent — disables all sandboxing)
AGENT_WORKBENCH_TRUST_LOCAL_VPS=1 node dist/src/cli.js explore "scan this repo"
```

There is **no watch mode**. Always `npm run build` before running tests after any change.

### AF-FORGE Environment Variables

| Variable | Effect |
|----------|--------|
| `AGENT_WORKBENCH_TRUST_LOCAL_VPS=1` | ⚠️ Root-key: disables sandboxing, enables all flags, forces `internal_mode` |
| `AGENT_WORKBENCH_PROVIDER` | `mock` (default) or `openai_responses` |
| `AGENT_WORKBENCH_DEFAULT_MODE` | `internal` or `external_safe_mode` (default) |
| `ENABLE_DANGEROUS_TOOLS=1` | Unlock dangerous-risk tools |
| `OPENAI_API_KEY` | Required when provider is `openai_responses` |

---

## arifOS Commands

Work from `arifOS/`:

```bash
# Deployment (Docker-based)
make fast-deploy     # 2-3 min — code changes only (uses layer cache)
make reforge         # 10-15 min — full rebuild (Dockerfile / deps changed)
make auto-deploy     # autonomous deploy based on change analysis
make strategy        # analyze and recommend rebuild strategy

# Monitoring
make status          # service status
make logs            # follow logs
make health          # health endpoint check

# Python development
pip install -e ".[dev]"
pytest               # run tests
ruff check .         # lint
mypy .               # type check
```

---

## GEOX Commands

Work from `GEOX/`:

```bash
pip install -e ".[dev]"

# Tests (must reach 65% coverage)
pytest tests -q
pytest tests -k "test_name" -q    # single test
pytest tests --cov=arifos.geox    # with coverage

# Lint / format / type check
ruff check arifos/geox/
ruff format arifos/geox/
mypy arifos/geox/

# MCP server (stdio — for Claude Desktop / Smithery)
python geox_mcp_server.py

# GUI (React 19)
cd geox-gui
npm run dev          # dev server
npm run typecheck
npm run lint
npm run build
```

---

## Architecture

### AF-FORGE Core Execution Flow

```
CLI (cli.ts) → AgentProfile → AgentEngine
  → LongTermMemory injection → LlmProvider.completeTurn()
  → ToolRegistry.runTool() [permission + policy check]
  → ShortTermMemory append
  → RunReporter → ForgeScoreboard + RunMetricsLogger
```

Task state machine: `TASK_CREATED → PLAN_PROPOSED → APPROVAL_REQUIRED → TOOL_RUN_STARTED → TOOL_RUN_FINISHED → TASK_COMPLETED | TASK_ABORTED`

### Policy Gates (shared across all subprojects)

| Risk | Gate | Examples |
|------|------|---------|
| `read_only` | ALLOW | repo scan, summarize |
| `write_safe` / `external_network` | ON_LOOP | branch create, package install |
| `destructive` / `credential` / `infra_mutation` / `merge_publish` | **888_HOLD** | delete files, .env write, docker-compose, protected-branch merge |

**888_HOLD blocks until human approval.** It must never be auto-approved — this maps to constitutional principle F13 Sovereign.

### GEOX Architecture (Theory → Engine → Tools → Governance)

Every MCP tool is wrapped by `@contrast_governed_tool` which runs the full THEORY → ENGINE → GOVERNANCE pass and returns a verdict (`SEAL ≥ 0.80`, `PARTIAL ≥ 0.50`, `SABAR ≥ 0.25`, `VOID < 0.25`) before any data is written.

---

## Constitutional Floors (F1–F13)

These are non-negotiable in all subprojects. The four most load-bearing:

| Floor | Rule | Implementation |
|-------|------|----------------|
| **F1 Amanah** | No irreversible action without VAULT999 seal | Maps to `888_HOLD` / `destructive` risk tools |
| **F2 Truth** | No ungrounded claims (τ ≥ 0.99) | Evidence links required on every conclusion |
| **F9 Anti-Hantu** | No deception or manipulation | Enforced in agent output and LLM response redaction |
| **F13 Sovereign** | Human (Arif) holds final authority | `888_HOLD` gates must block, not auto-approve |

---

## AF-FORGE Code Conventions

**TypeScript ESM imports require `.js` extensions** (NodeNext module resolution):

```typescript
// ✅ correct
import { AgentEngine } from "../engine/AgentEngine.js";

// ❌ wrong — will fail at runtime
import { AgentEngine } from "../engine/AgentEngine";
```

**Adding a new tool:**
1. Extend `BaseTool` (`src/tools/base.ts`) — set `name`, `description`, `parameters` (JSON Schema), `riskLevel` (`"safe" | "guarded" | "dangerous"`)
2. Override `run(args, context): Promise<ToolResult>`
3. Register in `buildToolRegistry()` in `src/cli.ts`
4. Build and add tests using `node:test` + `node:assert/strict` with an isolated `tmpdir`

**Testing — use `ScriptedProvider` for deterministic multi-turn tests** (see `test/AgentEngine.test.ts`). Use `MockLlmProvider` for simpler single-turn cases.

**`external_safe_mode`** disables `run_command` and redacts secrets / URLs from both outgoing task text and incoming LLM responses.

---

## arifOS MCP Golden Path

```
init → sense → mind → heart → judge → vault
```

Public tools: `arifos.v2.init`, `arifos.v2.route`, `arifos.v2.judge`
Internal tools: `sense`, `mind`, `heart`, `ops`, `memory`, `vault`, `forge` (forge only after SEAL)

Skill registry rule: one primary skill per task, max two secondary. Run `floor-checker` first for any risky operation.
