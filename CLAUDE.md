# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Repository Layout

This workspace is a **policy-governed AI engineering workspace** with three primary subprojects:

| Directory | Stack | Role |
|-----------|-------|------|
| `A-FORGE/` | TypeScript / Node.js 22+ | Agent runtime (Planner/Executor/Verifier, event store, policy engine) |
| `arifOS/` | Python 3.12+ / FastMCP | Policy kernel (F1-F13 governance, MCP server, immutable audit path) |
| `GEOX/` | Python 3.10+ + React 19 | Geospatial domain service (seismic, well-log, governance verdicts) |
| `APEX/` | Docs only | Constitutional theory hub |
| `WORKFLOWS/` | Markdown | Autonomous workflow definitions (Subuh, Morning, etc.) |
| `VAULT999/` | Ledger | Immutable audit registry for sealed verdicts |

Each subproject has its own CLAUDE.md / AGENTS.md — this file covers workspace-level conventions.

---

## Shared MCP Launchers

Use the repo-local launcher scripts in `.github/mcp/` for agent MCP wiring:

- `start-arifos-stdio.sh`
- `start-geox-stdio.sh`
- `start-playwright.sh`

The shared server names are `arifos-local`, `geox-local`, and `playwright`. Keep `.mcp.json`, `.claude/mcp.json`, `.cursor/mcp.json`, `.opencode.json`, and `.gemini/settings.json` aligned to those names.

## Scientific terminology

Keep repo and tool identifiers exactly as implemented, but use operational descriptions in prose:

- `sense` = evidence acquisition
- `mind` = reasoning
- `heart` = safety and impact review
- `judge` = policy verdict
- `vault` = immutable audit record
- `forge` = controlled execution or build/test dispatch
- `888_HOLD` = manual approval gate

---

## A-FORGE Commands

Work from `A-FORGE/`:

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

### A-FORGE Environment Variables

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
# Python dev
pip install -e ".[dev]"
pytest tests/ -v                           # full suite
pytest tests/test_constitutional.py -v    # single file
pytest tests/ --cov=core --cov-report=term-missing

# Lint / format / type check (100-char line length)
ruff check .          # lint
ruff check . --fix    # auto-fix
black .               # format
mypy --ignore-missing-imports .

# Run MCP server
python stdio_server.py    # stdio transport
python server.py          # HTTP/SSE transport

# Deployment (Docker-based)
make fast-deploy     # 2-3 min — code changes only (uses layer cache)
make reforge         # 10-15 min — full rebuild (Dockerfile / deps changed)
make auto-deploy     # autonomous deploy based on change analysis
make status && make logs && make health
```

**Async tests:** `asyncio_mode = "auto"` in `pyproject.toml` — do **not** add `@pytest.mark.asyncio`.

**Tool decorators:** `@mcp.tool()` outer, `@constitutional_floor()` inner (see `server.py`). Confirm current tool list in `server.py` or `codebase/mcp/core/tool_registry.py` before edits — tool sets differ across docs.

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

# Canonical dimension-native server
python geox_unified.py --mode bridge

# Compatibility wrapper for stdio-oriented integrations
python geox_mcp_server.py

# GUI (React 19)
cd geox-gui
npm run dev          # dev server
npm run typecheck
npm run lint
npm run build
```

`geox_unified.py` is the canonical GEOX server. `geox_mcp_server.py` is retained as a compatibility wrapper for older integrations.

Public deployment truth must stay explicit: only the dashboard (`/`), health endpoint (`/health`), and MCP endpoint (`/mcp/`) are live right now; WebMCP discovery and A2A publication are still partial/internal until their public route and contract are verified.

---

## Architecture

### A-FORGE Core Execution Flow

```
CLI (cli.ts) → AgentProfile → AgentEngine
  → LongTermMemory injection → LlmProvider.completeTurn()
  → ToolRegistry.runTool() [permission + policy check]
  → ShortTermMemory append
  → RunReporter → ForgeScoreboard + RunMetricsLogger
```

Task state machine: `TASK_CREATED → PLAN_PROPOSED → APPROVAL_REQUIRED → TOOL_RUN_STARTED → TOOL_RUN_FINISHED → TASK_COMPLETED | TASK_ABORTED`

**Agent profiles** (`src/agents/profiles.ts`): `explore`, `fix`, `test`, `coordinator`, `worker` — plain objects (`AgentProfile` type), not classes. Each has a tool allowlist and token budget. All config in `src/config/RuntimeConfig.ts` via `readRuntimeConfig()` (env vars use `AGENT_WORKBENCH_` prefix).

**Trust layers:**

| Layer | Mechanism |
|---|---|
| Mode | `internal_mode` (full access) vs `external_safe_mode` (no `run_command`, secrets/URLs redacted) |
| Tool risk | `safe` / `guarded` / `dangerous` — `dangerous` requires `ENABLE_DANGEROUS_TOOLS=1` |
| Policy | `allowedCommandPrefixes`, `blockedCommandPatterns`, `commandTimeoutMs`, `maxFileBytes` |

### Policy Gates (shared across all subprojects)

| Risk | Gate | Examples |
|------|------|---------|
| `read_only` | ALLOW | repo scan, summarize |
| `write_safe` / `external_network` | ON_LOOP | branch create, package install |
| `destructive` / `credential` / `infra_mutation` / `merge_publish` | **888_HOLD** | delete files, .env write, docker-compose, protected-branch merge |

**888_HOLD blocks until human approval.** Treat it as a manual approval gate and never auto-approve it.

### GEOX Architecture (Theory → Engine → Tools → Governance)

Every MCP tool is wrapped by `@contrast_governed_tool` which runs the full THEORY → ENGINE → GOVERNANCE pass and returns a verdict (`SEAL ≥ 0.80`, `PARTIAL ≥ 0.50`, `SABAR ≥ 0.25`, `VOID < 0.25`) before any data is written. Verdict constants in `arifos/geox/__init__.py`.

**GUI stack:** React 19, TypeScript, Vite, MapLibre GL 4, CesiumJS, Zustand, Radix UI, Tailwind CSS. Governance badges must remain visible at all times — constitutional constraint, not style.

**Federated domain service:** In production GEOX connects to the arifOS kernel at `arifosmcp.arif-fazil.com/mcp`. For local dev the MCP server runs standalone and skips immutable-record writes gracefully.

---

## Governance Floors (F1-F13)

These are non-negotiable in all subprojects. The four most load-bearing:

| Floor | Rule | Implementation |
|-------|------|----------------|
| **F1 Irreversible-change control** | No irreversible action without an explicit audit record | Maps to `888_HOLD` / `destructive` risk tools |
| **F2 Truth** | No ungrounded claims (τ ≥ 0.99) | Evidence links required on every conclusion |
| **F9 Injection/deception prevention** | No deception or manipulation | Enforced in agent output and LLM response redaction |
| **F13 Human approval authority** | Human (Arif) holds final authority | `888_HOLD` gates must block, not auto-approve |

---

## A-FORGE Code Conventions

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

## arifOS MCP Standard Pipeline

```
init → sense → mind → heart → judge → vault
```

Public tools: `arifos.v2.init`, `arifos.v2.route`, `arifos.v2.judge`
Internal tools: `sense`, `mind`, `heart`, `ops`, `memory`, `vault`, `forge` (use the identifiers as implemented; describe them operationally with the terminology map above)

Skill registry rule: one primary skill per task, max two secondary. Run `floor-checker` first for any risky operation. `vps-operator` never designs architecture; `web-architect` never executes production infra changes.

---

## VPS & Docker Operations

### Verify runtime context first
```bash
hostname && whoami && pwd
docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | head -5
```
If `docker ps` returns containers, you are already on the VPS — do not ask for SSH credentials.

### Canonical container names (singular, no `arifos_` prefix)

| Container | Role |
|---|---|
| `mcp` | arifOS kernel / MCP server (port 8080) |
| `traefik` | Edge router / TLS |
| `postgres` | Primary database |
| `redis` | Cache / pub-sub |
| `qdrant` | Vector memory |
| `ollama` | Local LLM inference |
| `openclaw` | Agent gateway (port 18789) |
| `geox` | Geospatial MCP co-agent |
| `prometheus` / `grafana` | Metrics |
| `n8n` | Workflow automation |

Always set an explicit `name:` in Docker Compose networks to prevent auto-prefixing:
```yaml
networks:
  arifos_net:
    name: arifos_net
    external: true
```

### Multi-agent file conflict prevention
Copilot, Gemini, Kimi, Claude, and OpenCode all operate on the same VPS files. Before editing `docker-compose.yml`, `.env`, or any config:
```bash
git fetch origin && git status
```
If `origin/main` is ahead, reconcile before editing.

---

## Operator shorthand

These are **unambiguous execution directives** — do not ask for clarification:

| Shorthand | Meaning |
|---|---|
| `seal` / `forge seal` | Finalize, commit, push |
| `forge` | Execute the plan now |
| `phase N` | Execute phase N of the agreed plan |
| `yes` / `start` / `Start. ✅` | Proceed with the proposed action |
| `1 2 3 4 forge` | Execute items 1, 2, 3, 4 in order |
| `alligned` / `align all` | Sync all agent config files (CLAUDE.md, GEMINI.md, copilot-instructions.md, AGENTS.md, KIMI.md) |


