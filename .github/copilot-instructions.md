# AF-FORGE Copilot Instructions

## Build, Test & Run

```bash
npm install          # install dependencies
npm run build        # tsc → dist/
npm test             # node dist/test/AgentEngine.test.js (node:test runner)

# Run a single test (no jest/vitest — uses node:test built-in)
node dist/test/AgentEngine.test.js 2>&1 | grep -A5 "test name"

# CLI
node dist/src/cli.js <command> [options]

# Full trust mode (root-key equivalent — disables all sandboxing)
AGENT_WORKBENCH_TRUST_LOCAL_VPS=1 node dist/src/cli.js explore "scan this repo"
```

The test suite lives in `test/AgentEngine.test.ts` and is compiled to `dist/test/`. There is no watch mode; rebuild before re-running tests.

## Architecture

AF-FORGE is a **constitutional, event-sourced agent runtime** built around a **Planner / Executor / Verifier triad**. The codebase is TypeScript ESM (NodeNext module resolution, Node.js v22+).

### Core execution path

1. CLI (`src/cli.ts`) parses args → selects an `AgentProfile`
2. `AgentEngine` (`src/engine/AgentEngine.ts`) drives the loop:
   - Injects relevant `LongTermMemory` entries as system messages
   - Calls `LlmProvider.completeTurn()` each turn
   - Passes tool calls through `ToolRegistry.runTool()` with permission + policy checks
   - Appends results to `ShortTermMemory` (in-session transcript)
3. On completion, stores a summary in `LongTermMemory` and reports metrics via `RunReporter` → `ForgeScoreboard` + `RunMetricsLogger`

### Trust & safety layers

| Layer | Mechanism |
|---|---|
| Mode | `internal_mode` (full access) vs `external_safe_mode` (no `run_command`, secrets redacted) |
| Tool risk | `safe` / `guarded` / `dangerous` — `dangerous` tools require `ENABLE_DANGEROUS_TOOLS=1` |
| Policy | `allowedCommandPrefixes`, `blockedCommandPatterns`, `commandTimeoutMs`, `maxFileBytes` |
| Feature flags | `ENABLE_DANGEROUS_TOOLS`, `ENABLE_BACKGROUND_JOBS`, `ENABLE_EXPERIMENTAL_TOOLS` |
| Trust shortcut | `AGENT_WORKBENCH_TRUST_LOCAL_VPS=1` sets `allowedCommandPrefixes: ["*"]` and enables all flags |

`external_safe_mode` also runs `redactForExternalMode()` on both outgoing task text and incoming LLM responses (strips tokens, URLs matching `sk-…` patterns and `https://…` references).

### Agent profiles (`src/agents/profiles.ts`)

Five built-in profiles with different tool allowlists and token budgets: `explore`, `fix`, `test`, `coordinator`, `worker`. Profiles are plain objects (`AgentProfile` type) — no classes.

## VPS & Docker Operations

### Verify runtime context first
Before asking for credentials or assuming remote-only access, always check where you're running:
```bash
hostname && whoami && pwd
docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | head -5
```
If `docker ps` returns containers, you are already on the VPS — act accordingly without asking for SSH access.

### Canonical container names (singular, no prefix)
All arifOS containers use **singular names with no `arifos_` prefix**. Never revert to `arifosmcp`, `arifos_postgres`, `arifos_redis`, etc.:

| Container | Role |
|---|---|
| `mcp` | arifOS kernel / MCP server (port 8080) |
| `traefik` | Edge router / TLS termination |
| `postgres` | Primary database |
| `redis` | Cache / pub-sub |
| `qdrant` | Vector memory |
| `ollama` | Local LLM inference |
| `openclaw` | Agent gateway (port 18789) |
| `registry` | Model registry |
| `geox` | Geospatial MCP co-agent |
| `uptime` | Endpoint health monitor |
| `browser` | Headless browser |
| `webhook` | Webhook receiver |
| `landing` | Landing page |
| `prometheus` | Metrics scraper |
| `grafana` | Metrics dashboard |
| `n8n` | Workflow automation |
| `forge` | Forge landing |
| `pdf` | PDF processor |
| `whatsapp` | WhatsApp bridge |
| `code` | Code server |

### Docker Compose network naming
Always set an explicit `name:` in the `networks:` block to prevent Compose auto-prefixing (which causes `arifos_arifos_trinity` style chaos):
```yaml
networks:
  arifos_net:
    name: arifos_net    # explicit — prevents auto-prefix
    external: true
```

### Multi-agent file conflict prevention
Copilot, Gemini, Kimi, Claude, and OpenCode all operate on the same VPS files. Before editing any `docker-compose.yml`, `.env`, or config file:
```bash
git fetch origin && git status
```
If `origin/main` is ahead, reconcile before editing — don't push onto a diverged branch.

### Arif's execution shorthand
These short messages are **unambiguous execution directives** — do not ask for clarification:

| Shorthand | Meaning |
|---|---|
| `seal` / `forge seal` | Finalize, commit, push |
| `forge` | Execute the plan now |
| `phase N` | Execute phase N of the agreed plan |
| `yes` / `start` / `Start. ✅` | Proceed with the proposed action |
| `1 2 3 4 forge` | Execute items 1, 2, 3, 4 in order |
| `alligned` / `align all` | Sync all agent config files (CLAUDE.md, GEMINI.md, copilot-instructions.md, AGENTS.md, KIMI.md) |

## Key Conventions

### TypeScript ESM imports
All intra-package imports **must** use `.js` extensions (NodeNext resolution):
```ts
import { AgentEngine } from "../engine/AgentEngine.js";
```
Never use `.ts` extensions in imports, even though the source files are `.ts`.

### Adding a new tool
Extend `BaseTool` from `src/tools/base.ts`, set `name`, `description`, `parameters` (JSON Schema), and `riskLevel` (`"safe" | "guarded" | "dangerous"`). Override `run()`. Register in `buildToolRegistry()` in `src/cli.ts`. The `isPermitted()` logic in `BaseTool` is inherited automatically.

### LlmProvider interface
`LlmProvider` has a single method `completeTurn(request: LlmTurnRequest): Promise<LlmTurnResponse>`. Use `MockLlmProvider` for unit tests that don't need scripted turns; use the `ScriptedProvider` pattern (see `test/AgentEngine.test.ts`) when you need deterministic multi-turn sequences.

### Testing pattern
Tests use **Node.js built-in `node:test`** and `node:assert/strict`. No external test framework. Each test creates an isolated `tmpdir` for memory and file state. Build first, then run the compiled output.

### Environment configuration
All runtime knobs are in `src/config/RuntimeConfig.ts` via `readRuntimeConfig()`. Env vars follow the `AGENT_WORKBENCH_` prefix convention (e.g., `AGENT_WORKBENCH_MODEL`, `AGENT_WORKBENCH_MEMORY_PATH`).

### Constitutional constraints (arifOS F1–F13)
- **F1 Amanah**: No irreversible action without a VAULT999 seal — map to `888_HOLD` gate / `destructive` risk tools
- **F2 Truth**: No ungrounded claims (τ ≥ 0.99)
- **F9 Anti-Hantu**: No deception or manipulation in agent output
- **F13 Sovereign**: Human (Arif) holds final authority — `888_HOLD` gates must block, not auto-approve

Tool risk levels directly map to these gates: `read_only` → ALLOW, `write_safe` / `external_network` → ON_LOOP, `destructive` / `credential` / `infra_mutation` / `merge_publish` → **888_HOLD**.

### Skill registry (arifOS workspace)
- One primary skill per task, max 2 secondary
- `floor-checker` first for risky operations (F1–F13 validation)
- `vps-operator` never designs architecture; `web-architect` never executes production infra changes
