# Agent Workbench Architecture

`agent-workbench` is a TypeScript ESM package for running a coding-oriented agent loop with pluggable tools, configurable safety modes, layered memory, and simple coordinator/worker delegation.

## Main Layers

- `src/types`: shared contracts for messages, profiles, tools, budgets, permissions, and job hooks.
- `src/engine`: the core loop that calls an LLM adapter, executes tool calls through a registry, tracks budgets, and stops on completion or limits.
- `src/tools`: concrete tool implementations plus the registry and permission gates.
- `src/agents`: profile builders and coordinator/worker orchestration helpers.
- `src/memory`: short-term session memory and file-backed long-term memory.
- `src/flags`: feature flags and runtime modes.
- `src/jobs`: background job data structures and registration APIs.
- `src/cli`: command parsing and mappings from CLI commands to agent profiles/tasks.
- `src/llm`: a provider interface and a mock provider for local development.

## Flow

1. CLI selects a mode and command profile.
2. `AgentEngine` builds the system prompt, prior messages, tool schemas, and runtime state.
3. LLM adapter returns either a final answer or tool calls.
4. Tool registry validates permissions and executes approved tools.
5. Tool results are appended to the transcript and the loop repeats.
6. Completed task summaries are stored in long-term memory for later retrieval.

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
    engine/
      AgentEngine.ts
      BudgetManager.ts
      redact.ts
    flags/
      featureFlags.ts
      modes.ts
    jobs/
      BackgroundJobManager.ts
    llm/
      LlmProvider.ts
      MockLlmProvider.ts
    memory/
      LongTermMemory.ts
      ShortTermMemory.ts
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
