# AF-FORGE Copilot Instructions

## Build, test, and lint commands

```bash
npm install
npm run build

# Main package.json test entrypoint
npm test

# Full test battery used by Makefile and CI
make test

# Run one compiled test file directly
node dist/test/PlanValidator.test.js
node dist/test/confidence.test.js
node dist/test/sense.test.js
node dist/test/governanceViolation.test.js
node dist/test/ticketStore.test.js
node dist/test/operatorConsole.test.js

# Run one named test from the main suite
npm run build
node --test --test-name-pattern="multi-turn tool execution" dist/test/AgentEngine.test.js
```

Tests run from `dist/test/`, not directly from `test/`. Rebuild before running tests after source changes. There is no dedicated lint script in `package.json`, `Makefile`, or `.github/workflows/ci.yml`.

## High-level architecture

AF-FORGE is the TypeScript runtime layer that executes governed agents under arifOS. The repo is organized around four planes from the README: governance, agent execution, data/memory, and infrastructure/observability.

`src/cli.ts` is the main composition root. It reads runtime config, builds the tool registry, selects the LLM provider, creates long-term memory, scoreboard/metrics reporting, vault and approval storage, governance client, and optional human-escalation client, then passes control to command-specific profiles from `src/agents/profiles.ts` through `src/cli/commands.ts`.

`src/engine/AgentEngine.ts` is the core loop. It runs preflight governance checks, injects relevant long-term memory, executes the LLM/tool loop, applies tool permissions through `ToolRegistry`, tracks budgets and metrics, and seals terminal outcomes to the vault. Runtime behavior is shaped jointly by profile, mode, feature flags, and tool risk level.

The external surfaces share those same subsystems instead of reimplementing them. `src/server.ts` exposes the HTTP bridge for Sense/Judge, governance evaluation, metrics, operator approval/vault access, and human-expert flows. `src/mcp/server.ts` exposes governance, run, approval, and memory capabilities over stdio MCP. Persistent state for approvals, vault records, governed memory, and continuity lives under `src/approval/`, `src/vault/`, `src/memory-contract/`, and `src/continuity/`.

`src/config/RuntimeConfig.ts` is the central switchboard for environment-driven behavior: provider selection, trust mode, command policy, storage paths, and Postgres-backed versus local JSON/JSONL persistence.

## Key conventions

- This repo uses NodeNext ESM. Intra-repo TypeScript imports must use explicit `.js` extensions.
- The canonical AF-FORGE code lives at the repository root under `src/`. Older docs that mention `AF-FORGE/` still mean this repo root, and sibling directories in `/root` are separate projects unless the task explicitly targets them.
- `npm test` only runs the main `AgentEngine` suite. The broader validated surface is `make test` plus the individual compiled test files CI runs.
- Tests use Node's built-in `node:test` runner and usually create isolated temp directories. `ScriptedProvider` is the standard pattern for deterministic multi-turn engine tests, while `MockLlmProvider` is used for simpler cases.
- New tools should extend `BaseTool` in `src/tools/base.ts`, declare JSON-schema parameters, assign a `riskLevel`, and be registered in `buildToolRegistry()` in `src/cli.ts`.
- Tool availability is controlled in two layers: agent profiles whitelist tool names, and mode settings further filter behavior. In `external_safe_mode`, `run_command` is removed and obvious secrets/URLs are redacted from both outgoing and incoming text.
- Dangerous tools are intentionally gated. `ToolRegistry` returns `[888_HOLD]` unless dangerous execution is allowed, and high/critical risk still forces human approval even in trusted contexts.
- `AGENT_WORKBENCH_TRUST_LOCAL_VPS=1` is a high-blast-radius switch: it effectively opens internal mode, wildcard command prefixes, and dangerous/experimental/background capabilities.
- Treat the checked-out repo as the source of truth. Verify browser notes, pasted plans, and deployment claims against live files, config, and git state before relying on them.
- Distinguish source edits from live rollout. Do not claim a route, site, service, or manifest is deployed without checking the running surface.

