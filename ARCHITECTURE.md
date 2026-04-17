# Agent Workbench Architecture

`agent-workbench` is a TypeScript ESM package for running a coding-oriented agent loop with pluggable tools, configurable safety modes, layered memory, and simple coordinator/worker delegation.

## Main Layers

- `src/types`: shared contracts for messages, profiles, tools, budgets, permissions, job hooks, and scoreboard records.
- `src/config`: env-driven runtime configuration (`RuntimeConfig`) for providers, tool policies, pricing, and paths.
- `src/engine`: the core loop that calls an LLM adapter, executes tool calls through a registry, tracks budgets, and stops on completion or limits. Also includes `RunReporter` for persisting metrics to the scoreboard and run logs.
- `src/tools`: concrete tool implementations plus the registry and permission gates.
- `src/agents`: profile builders and coordinator/worker orchestration helpers.
- `src/memory`: short-term session memory and file-backed long-term memory.
- `src/flags`: feature flags and runtime modes.
- `src/jobs`: background job data structures and registration APIs.
- `src/cli`: command parsing and mappings from CLI commands to agent profiles/tasks.
- `src/llm`: a provider interface and a mock provider for local development.
- `src/scoreboard`: file-backed metrics aggregation (`ForgeScoreboard`) and per-run JSON logging (`RunMetricsLogger`).
- `src/utils`: filesystem and path helpers.

## Flow

1. CLI selects a mode and command profile.
2. `AgentEngine` builds the system prompt, prior messages, tool schemas, and runtime state.
3. LLM adapter returns either a final answer or tool calls.
4. Tool registry validates permissions and executes approved tools.
5. Tool results are appended to the transcript and the loop repeats.
6. Completed task summaries are stored in long-term memory for later retrieval.
7. `RunReporter` appends the run to the scoreboard and writes per-run metrics.

## Trust & Safety

⚠️ **`AGENT_WORKBENCH_TRUST_LOCAL_VPS=1`** is a high-blast-radius flag. When set, it:
- Sets `allowedCommandPrefixes: ["*"]` (disables shell command filtering)
- Enables `ENABLE_DANGEROUS_TOOLS`, `ENABLE_BACKGROUND_JOBS`, and `ENABLE_EXPERIMENTAL_TOOLS`
- Forces `defaultMode: "internal_mode"`

Treat this as a root key equivalent. Document who can set it and where.

## File Tree

```text
agent-workbench/
  ARCHITECTURE.md
  package.json
  tsconfig.json
  src/
    agents/
      CoordinatorAgent.ts
      WorkerAgent.ts
      profiles.ts
    cli/
      commands.ts
      parseArgs.ts
    config/
      RuntimeConfig.ts
    engine/
      AgentEngine.ts
      BudgetManager.ts
      redact.ts
      RunReporter.ts
    flags/
      featureFlags.ts
      modes.ts
    jobs/
      BackgroundJobManager.ts
    llm/
      LlmProvider.ts
      MockLlmProvider.ts
      OpenAIResponsesProvider.ts
      providerFactory.ts
    memory/
      LongTermMemory.ts
      ShortTermMemory.ts
    scoreboard/
      ForgeScoreboard.ts
      RunMetricsLogger.ts
    tools/
      base.ts
      FileTools.ts
      SearchTools.ts
      ShellTools.ts
      ToolRegistry.ts
    types/
      agent.ts
      jobs.ts
      memory.ts
      scoreboard.ts
      tool.ts
    utils/
      fs.ts
      paths.ts
    cli.ts
    index.ts
  examples/
    runExploreExample.ts
  test/
    AgentEngine.test.ts
```

## 9-Agent Federation (SOT v2026-04-16)

A-FORGE functions as the execution adapter for the arifOS federation:
- **AAA-Agent** (`POST /route`) evaluates intents, calculates thermodynamic cost (`OPS/777`), and routes requests to the correct Specialist Organ (e.g. `GEOX`, `WEALTH`).
- If an operation breaches the Gödel Lock (High Risk/Constitutional Contradiction), it forces `888_HOLD`.
- Terminal decisions (`SEAL`) are routed via the **ARCHIVIST-Agent** directly into `arifos.canon_records` via `PostgresVaultClient`.



