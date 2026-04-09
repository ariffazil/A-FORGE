# AF-FORGE Agent Workbench — AGENTS.md

> **For AI coding agents working on this codebase.**  
> **Motto:** *Ditempa Bukan Diberi* — Forged, Not Given [ΔΩΨ | ARIF]

---

## Project Overview

AF-FORGE is a **constitutional, event-sourced agent runtime** written in TypeScript. It implements a **Planner/Executor/Verifier triad** architecture with built-in policy gates, memory governance, and human sovereignty controls (888_HOLD).

**Key Philosophy:**
- State is explicit (state machine, not chat loop)
- Memory is governed (single gateway service)
- Tools are risk-scored (reversibility labels)
- Everything is replayable (append-only event log)

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript 5.8+ |
| Module System | ESM (NodeNext resolution) |
| Runtime | Node.js 22+ |
| Test Framework | Built-in `node:test` + `node:assert/strict` |
| Build Tool | `tsc` (TypeScript compiler) |
| Package Manager | npm / pnpm / bun |

---

## Build and Test Commands

```bash
# Install dependencies
npm install

# Compile TypeScript → dist/
npm run build

# Run all tests (uses node:test built-in runner)
npm test
# Equivalent to: node dist/test/AgentEngine.test.js

# Run a single test and filter output
node dist/test/AgentEngine.test.js 2>&1 | grep -A5 "test name"

# Run example
npm run example:explore
# Equivalent to: node dist/examples/runExploreExample.js

# CLI usage
node dist/src/cli.js <command> [options]

# Full trust mode (root-key equivalent — disables all sandboxing)
AGENT_WORKBENCH_TRUST_LOCAL_VPS=1 node dist/src/cli.js explore "scan this repo"
```

**Important:** Always rebuild (`npm run build`) before running tests after making changes. There is no watch mode.

---

## Project Structure

```
af-forge/
├── src/
│   ├── agents/           # Agent profiles and orchestration
│   │   ├── CoordinatorAgent.ts   # Planner/Coordinator for multi-agent tasks
│   │   ├── WorkerAgent.ts        # Worker agent executor
│   │   └── profiles.ts           # Profile builders (explore, fix, test, coordinator, worker)
│   ├── cli/              # Command-line interface
│   │   ├── commands.ts           # CLI command implementations
│   │   └── parseArgs.ts          # Argument parsing
│   ├── config/           # Runtime configuration
│   │   └── RuntimeConfig.ts      # Environment-driven config (env vars, paths, policies)
│   ├── engine/           # Core execution loop
│   │   ├── AgentEngine.ts        # Main agent loop (LLM calls, tool execution, memory)
│   │   ├── BudgetManager.ts      # Token and turn budget tracking
│   │   ├── RunReporter.ts        # Metrics reporting to scoreboard
│   │   └── redact.ts             # External mode data redaction
│   ├── flags/            # Feature flags and runtime modes
│   │   ├── featureFlags.ts       # ENABLE_* flags
│   │   └── modes.ts              # internal_mode vs external_safe_mode
│   ├── jobs/             # Background job management
│   │   └── BackgroundJobManager.ts
│   ├── llm/              # LLM provider abstractions
│   │   ├── LlmProvider.ts        # Interface definition
│   │   ├── MockLlmProvider.ts    # Mock for testing
│   │   ├── OpenAIResponsesProvider.ts  # OpenAI Responses API implementation
│   │   └── providerFactory.ts    # Provider factory
│   ├── memory/           # Memory management
│   │   ├── ShortTermMemory.ts    # In-session transcript
│   │   └── LongTermMemory.ts     # File-backed persistent memory (JSON)
│   ├── scoreboard/       # Metrics and telemetry
│   │   ├── ForgeScoreboard.ts    # Weekly task aggregation
│   │   └── RunMetricsLogger.ts   # Per-run JSON logging
│   ├── tools/            # Tool implementations
│   │   ├── base.ts               # BaseTool abstract class
│   │   ├── ToolRegistry.ts       # Tool registration and dispatch
│   │   ├── FileTools.ts          # read_file, write_file, list_files
│   │   ├── SearchTools.ts        # grep_text
│   │   └── ShellTools.ts         # run_tests, run_command
│   ├── types/            # TypeScript type definitions
│   │   ├── agent.ts              # Agent messages, profiles, results
│   │   ├── jobs.ts               # Job types
│   │   ├── memory.ts             # Memory record types
│   │   ├── scoreboard.ts         # Scoreboard types
│   │   └── tool.ts               # Tool schemas, permissions, results
│   ├── utils/            # Utilities
│   │   ├── fs.ts                 # Filesystem helpers
│   │   └── paths.ts              # Path resolution (sandboxing)
│   ├── cli.ts            # CLI entry point
│   └── index.ts          # Public API exports
├── test/
│   └── AgentEngine.test.ts       # Test suite (node:test)
├── examples/
│   └── runExploreExample.ts      # Example usage
├── dist/                 # Compiled JavaScript output (gitignored)
├── package.json          # NPM manifest
├── tsconfig.json         # TypeScript configuration (ES2022, NodeNext)
└── .gitignore            # Git ignore patterns
```

---

## Code Style Guidelines

### TypeScript ESM Imports

**CRITICAL:** All intra-package imports **must** use `.js` extensions (NodeNext module resolution):

```typescript
// ✅ CORRECT
import { AgentEngine } from "../engine/AgentEngine.js";
import type { AgentProfile } from "../types/agent.js";

// ❌ WRONG
import { AgentEngine } from "../engine/AgentEngine";
import { AgentEngine } from "../engine/AgentEngine.ts";
```

### TypeScript Configuration

- **Target:** ES2022
- **Module:** NodeNext
- **ModuleResolution:** NodeNext
- **Strict:** true
- **Declaration:** true (generates .d.ts files)

### Naming Conventions

- **Files:** PascalCase for class files (e.g., `AgentEngine.ts`), camelCase for utilities
- **Classes:** PascalCase (e.g., `AgentEngine`, `ToolRegistry`)
- **Interfaces:** PascalCase with descriptive names (e.g., `LlmProvider`, `ToolExecutionContext`)
- **Types:** PascalCase (e.g., `AgentProfile`, `ToolResult`)
- **Variables/Functions:** camelCase
- **Constants:** UPPER_SNAKE_CASE for true constants, camelCase for others
- **Environment Variables:** `AGENT_WORKBENCH_*` prefix

### Tool Implementation Pattern

When adding a new tool:

1. Extend `BaseTool` from `src/tools/base.ts`
2. Set `name`, `description`, `parameters` (JSON Schema), and `riskLevel` (`"safe" | "guarded" | "dangerous"`)
3. Override `run()` method
4. Register in `buildToolRegistry()` in `src/cli.ts`

Example:
```typescript
export class MyTool extends BaseTool {
  readonly name = "my_tool";
  readonly description = "Does something useful";
  readonly riskLevel = "safe" as const;
  readonly parameters = {
    type: "object" as const,
    properties: {
      arg: { type: "string" as const, description: "An argument" },
    },
    required: ["arg"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    // Implementation
    return { ok: true, output: "result" };
  }
}
```

---

## Testing Instructions

### Test Framework

- Uses **Node.js built-in `node:test`** and `node:assert/strict`**
- **No Jest, Vitest, or other external test frameworks**
- Tests are compiled to `dist/test/` and run from there

### Test Patterns

1. **Always build before testing:** `npm run build`
2. **Use isolated temp directories:** Each test creates its own `tmpdir` for memory and file state
3. **Use `ScriptedProvider` for deterministic multi-turn tests:** See `test/AgentEngine.test.ts` for the pattern
4. **Use `MockLlmProvider` for simple tests:** When you don't need scripted turns

### Example Test Structure

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";

class ScriptedProvider implements LlmProvider {
  constructor(private readonly turns: Array<{ content: string; toolCalls?: Array<...> }>) {}
  async completeTurn() {
    const next = this.turns.shift();
    if (!next) throw new Error("No scripted turns left");
    return { /* LlmTurnResponse */ };
  }
}

test("test name", async () => {
  const root = resolve(tmpdir(), `agent-workbench-${Date.now()}`);
  await mkdir(root, { recursive: true });
  // ... test implementation
});
```

---

## Architecture Overview

### Core Execution Flow

1. **CLI** (`src/cli.ts`) parses args → selects an `AgentProfile`
2. **AgentEngine** (`src/engine/AgentEngine.ts`) drives the loop:
   - Injects relevant `LongTermMemory` entries as system messages
   - Calls `LlmProvider.completeTurn()` each turn
   - Passes tool calls through `ToolRegistry.runTool()` with permission + policy checks
   - Appends results to `ShortTermMemory` (in-session transcript)
3. On completion, stores summary in `LongTermMemory` and reports metrics via `RunReporter` → `ForgeScoreboard` + `RunMetricsLogger`

### Trust & Safety Layers

| Layer | Mechanism |
|-------|-----------|
| **Mode** | `internal_mode` (full access) vs `external_safe_mode` (no `run_command`, secrets redacted) |
| **Tool Risk** | `safe` / `guarded` / `dangerous` — `dangerous` tools require `ENABLE_DANGEROUS_TOOLS=1` |
| **Policy** | `allowedCommandPrefixes`, `blockedCommandPatterns`, `commandTimeoutMs`, `maxFileBytes` |
| **Feature Flags** | `ENABLE_DANGEROUS_TOOLS`, `ENABLE_BACKGROUND_JOBS`, `ENABLE_EXPERIMENTAL_TOOLS` |
| **Trust Shortcut** | `AGENT_WORKBENCH_TRUST_LOCAL_VPS=1` sets `allowedCommandPrefixes: ["*"]` and enables all flags |

### Agent Profiles

Five built-in profiles in `src/agents/profiles.ts`:

| Profile | Purpose | Allowed Tools | Token Budget | Max Turns |
|---------|---------|---------------|--------------|-----------|
| `explore` | Repository exploration | list_files, read_file, grep_text | 12,000 | 6 |
| `fix` | Code fixes | +write_file, run_tests | 20,000 | 8 |
| `test` | Test running | list_files, run_tests, grep_text, read_file | 10,000 | 4 |
| `coordinator` | Multi-agent coordination | list_files, read_file, grep_text | 24,000 | 10 |
| `worker` | Worker tasks | +run_tests | 8,000 | 5 |

---

## Environment Configuration

All runtime configuration is in `src/config/RuntimeConfig.ts` via `readRuntimeConfig()`.

### Key Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `AGENT_WORKBENCH_TRUST_LOCAL_VPS` | **⚠️ ROOT-KEY EQUIVALENT** — disables all sandboxing | `0` |
| `AGENT_WORKBENCH_PROVIDER` | LLM provider (`mock`, `openai_responses`) | `mock` |
| `AGENT_WORKBENCH_MODEL` | Model name | `gpt-5` |
| `OPENAI_API_KEY` | OpenAI API key | — |
| `OPENAI_BASE_URL` | OpenAI API base URL | `https://api.openai.com/v1` |
| `AGENT_WORKBENCH_LLM_TIMEOUT_MS` | LLM request timeout | `120000` |
| `AGENT_WORKBENCH_COMMAND_TIMEOUT_MS` | Shell command timeout | `30000` |
| `AGENT_WORKBENCH_MAX_FILE_BYTES` | Max file size for read/write | `262144` (256KB) |
| `AGENT_WORKBENCH_ALLOWED_COMMAND_PREFIXES` | CSV of allowed command prefixes | test runners only |
| `AGENT_WORKBENCH_BLOCKED_COMMAND_PATTERNS` | CSV of blocked command patterns | dangerous commands |
| `AGENT_WORKBENCH_MEMORY_PATH` | Long-term memory file path | `~/.agent-workbench/memory.json` |
| `AGENT_WORKBENCH_SCOREBOARD_PATH` | Scoreboard file path | `~/.agent-workbench/scoreboard.json` |
| `AGENT_WORKBENCH_RUN_METRICS_DIR` | Per-run metrics directory | `~/.agent-workbench/metrics` |
| `AGENT_WORKBENCH_DEFAULT_MODE` | Default mode (`internal`, `external`) | `external_safe_mode` |
| `AGENT_WORKBENCH_INPUT_COST_PER_MILLION_TOKENS` | API pricing (input) | `0` |
| `AGENT_WORKBENCH_OUTPUT_COST_PER_MILLION_TOKENS` | API pricing (output) | `0` |
| `ENABLE_DANGEROUS_TOOLS` | Enable dangerous tools | `false` |
| `ENABLE_BACKGROUND_JOBS` | Enable background jobs | `false` |
| `ENABLE_EXPERIMENTAL_TOOLS` | Enable experimental tools | `false` |

---

## Security Considerations

### Tool Risk Levels

| Risk Level | Gate | Examples |
|------------|------|----------|
| `read_only` | ALLOW | repo scan, summarize, test read |
| `write_safe` / `external_network` | ON_LOOP | branch create, local edit, package install |
| `destructive` / `credential` / `infra_mutation` / `merge_publish` | **888_HOLD** | delete files, secret handle, docker-compose, merge to protected branch |

### 888_HOLD Gate

The **888_HOLD** is a human sovereignty circuit breaker:
- Blocks high-risk operations until human approval
- Maps to constitutional principle **F13 Sovereign** (Arif holds final authority)
- Required for: `destructive`, `credential`, `infra_mutation`, `merge_publish` risk tools

### External Safe Mode

When in `external_safe_mode`:
- `run_command` tool is **disabled**
- Both outgoing task text and incoming LLM responses are **redacted** (strips tokens matching `sk-…` patterns and `https://…` references)

### Trust Local VPS Flag

**⚠️ WARNING:** `AGENT_WORKBENCH_TRUST_LOCAL_VPS=1` is a **high-blast-radius** flag equivalent to a root key:
- Sets `allowedCommandPrefixes: ["*"]` (disables shell command filtering)
- Enables `ENABLE_DANGEROUS_TOOLS`, `ENABLE_BACKGROUND_JOBS`, and `ENABLE_EXPERIMENTAL_TOOLS`
- Forces `defaultMode: "internal_mode"`

---

## Development Workflow

1. **Make changes** to TypeScript source files
2. **Build:** `npm run build`
3. **Test:** `npm test`
4. **Run CLI:** `node dist/src/cli.js <command>`

### Adding a New Tool

1. Create tool class extending `BaseTool` in `src/tools/`
2. Implement `name`, `description`, `parameters`, `riskLevel`, and `run()`
3. Export from tool module
4. Register in `buildToolRegistry()` in `src/cli.ts`
5. Add tests in `test/AgentEngine.test.ts`
6. Build and test

### Adding a New Agent Profile

1. Add profile builder function in `src/agents/profiles.ts`
2. Export the profile builder
3. Add CLI command handler in `src/cli/commands.ts` if needed
4. Build and test

---

## Constitutional Principles (arifOS F1–F13)

AF-FORGE implements constitutional constraints from arifOS:

- **F1 Amanah** — No irreversible action without VAULT999 seal → maps to `888_HOLD` gate / `destructive` risk tools
- **F2 Truth** — No ungrounded claims (τ ≥ 0.99)
- **F9 Anti-Hantu** — No deception or manipulation in agent output
- **F13 Sovereign** — Human (Arif) holds final authority → `888_HOLD` gates must block, not auto-approve

---

## CLI Commands

```bash
# Explore a repository
agent explore --goal "explain this repo" [--mode internal|external] [--cwd path]

# Fix a file
agent fix --file src/file.ts [--issue "what to fix"] [--mode internal|external] [--cwd path]

# Run tests
agent test [--goal "what to validate"] [--mode internal|external] [--cwd path]

# Coordinate multi-agent task
agent coordinate --goal "ship this feature" [--mode internal|external] [--cwd path]

# View scoreboard
agent scoreboard [--period weekly] [--command explore|fix|test|coordinate] [--trust-mode local_vps|default]
```

---

## Related Files

- `README.md` — Project overview and vision
- `ARCHITECTURE.md` — Detailed architecture description
- `ROADMAP.md` — Development roadmap and milestones
- `TODO.md` — Current tasks and priorities
- `ALIGNMENT.md` — MCP ↔ Kimi Skills alignment
- `.github/copilot-instructions.md` — GitHub Copilot instructions

---

## Notes for AI Agents

1. **Always use `.js` extensions in imports** — even for `.ts` source files
2. **Rebuild before testing** — no watch mode available
3. **Respect risk levels** — dangerous tools require explicit flags
4. **Test in isolation** — use temp directories, don't pollute working directory
5. **Follow constitutional principles** — F1, F2, F9, F13 are non-negotiable
6. **Use ScriptedProvider for deterministic tests** — see existing tests for patterns
7. **Keep mode-aware** — `internal_mode` vs `external_safe_mode` have different capabilities

---

---

## Unified Philosophical Calibration

arifOS utilizes a global corpus of human anchors to discipline reasoning across all tool stages. These anchors are ingested as constitutional nudges, ensuring every tool output is grounded in human wisdom.

### Cross-Tool Anchors (000–FORGE)

| Tool | Principle / Anchor Category | Constitutional Role |
|------|-----------------------------|---------------------|
| **arifos.init** | `origin_intent`, `foundation` | Purpose before motion (Montaigne) |
| **arifos.sense** | `evidence`, `perception` | Evidence threshold guard (Clifford) |
| **arifos.mind** | `logic`, `uncertainty` | Anti-self-deception (Feynman) |
| **arifos.route** | `discernment`, `fit` | Anti-tool monoculture (Maslow) |
| **arifos.memory** | `continuity`, `identity` | History as prevention (Santayana) |
| **arifos.heart** | `dignity`, `non-harm` | Harm floor (Hippocrates) |
| **arifos.ops** | `practice`, `resilience` | Execution over theater (Franklin) |
| **arifos.judge** | `justice`, `fairness` | Power humility (Acton) |
| **arifos.vault** | `integrity`, `finality` | Record preservation (Cicero) |
| **arifos.forge** | `craftsmanship`, `form` | Minimal strong form (Saint-Exupéry) |

### Trigger-Based Digestion
The `OutputEnvelope` for every tool includes a `philosophical_anchor`. The runtime selects anchors based on:
1.  **Tool Context:** Specific to the stage (e.g., `VAULT_Q` for 999_VAULT).
2.  **Cognitive State:** Triggers like `low_grounding` or `overconfidence` pull specific category anchors (e.g., `uncertainty_humility` for high unknowns).

---

*Last updated: 2026-04-07*
