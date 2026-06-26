# A-FORGE Copilot Instructions

## Build, test, and lint commands

```bash
npm install
npm run build

# Full test battery (security-audit + build + all suites)
make test

# Run one compiled test file directly
node dist/test/AgentEngine.test.js
node dist/test/PlanValidator.test.js
node dist/test/AmanahLockManager.test.js

# Run one named test from the main suite
npm run build
node --test --test-name-pattern="multi-turn tool execution" dist/test/AgentEngine.test.js
```

Tests run from `dist/test/`, not directly from `test/`. Rebuild before running tests after source changes.

## High-level architecture

A-FORGE is the governed execution shell of the arifOS Federation. It uses **hexagonal architecture** (domain / application / infrastructure / interfaces) with 40 load-bearing primitives after the tool collapse (v2026.06.24).

### Layer map

| Layer | Path | Role |
|-------|------|------|
| **domain/** | `src/domain/` | Pure business logic — engine, governance, planner, agents, policy. NO I/O, NO Express. |
| **application/** | `src/application/` | Use cases — services, approval, memory, a2a, jobs. |
| **infrastructure/** | `src/infrastructure/` | External adapters — llm, tools, vault, bridges, cli, code-mode, metrics. |
| **interfaces/** | `src/interfaces/` | Delivery — server.ts (Express :7071), routes, mcp, config. |

### Entry points

- **HTTP:** `src/interfaces/server.ts` — Express server on port 7071
- **MCP:** `src/interfaces/mcp/` — MCP protocol server (stdio preferred, HTTP on :7072)
- **CLI:** `src/infrastructure/cli/terminal.ts` — Interactive streaming LLM terminal

### Key modules

- `src/domain/engine/AgentEngine.ts` — Core agent loop (preflight → LLM/tool loop → seal)
- `src/domain/governance/` — 34 files: AmanahLockManager, GovernanceBridge, PolicyEnforcer, per-floor enforcement (f1Amanah–f12Injection)
- `src/domain/engine/IntentRouter.ts` — Routes intents to correct organ (GEOX/WEALTH/WELL/arifOS)
- `src/domain/containment/` — Execution sandbox with resource limits
- `src/application/approval/ApprovalBoundary.ts` — Layer 4 irreversibility gate

### Tool surface (40 primitives, v2026.06.24)

All tools use `forge_*` namespace. Mode-gated tools collapse multiple related operations into one primitive with a `mode` parameter:

- `forge_filesystem` — read/write/glob/grep/stat (5 modes)
- `forge_git` — status/diff/log/commit (4 modes)
- `forge_github` — search/pr (2 modes)
- `forge_docker` — ps/logs/exec/images (4 modes)
- `forge_browser` — navigate/click/type/screenshot/extract_text/evaluate_js (6 modes)
- `forge_agent` — register/status/list (3 modes)
- `forge_lease` — request/status/revoke (3 modes)
- `forge_vault` — read/list/write (3 modes)
- `forge_systemctl` — status/list_units (2 modes)
- `forge_journalctl` — logs/errors/tail/grep (4 modes)
- `forge_netdata` — alarms/metrics (2 modes)

Single-mode tools: `forge_run`, `forge_execute`, `forge_heart_critique`, `forge_check_governance`, `forge_shell_dryrun`, `forge_pipeline_run`, `forge_wealth`, `forge_well`, `forge_job`, `forge_memory`, `forge_research`, `forge_minimax_search`, `forge_minimax_text_to_image`, `forge_minimax_text_to_audio`, `forge_minimax_music_generation`, `forge_minimax_understand_image`, `forge_docs_lookup`, `forge_registry_status`, `forge_lock_acquire`, `forge_lock_release`, `forge_forge_browser`, `forge_forge_github_create_issue`, `forge_forge_github_create_or_update_file`, `forge_forge_github_get_file`, `forge_postgres`

## Key conventions

- **ESM with .js extensions.** NodeNext ESM. Intra-repo TypeScript imports must use explicit `.js` extensions.
- **Hexagonal architecture.** Domain logic has NO I/O dependencies. Infrastructure implements ports defined in domain.
- **40 primitives, not 93.** Tool collapse v2026.06.24 merged mode-gated variants. Do not re-expand.
- **Brain/Hands separation.** arifOS judges (8088). A-FORGE executes (7071/7072). Never mix.
- **Action taxonomy.** Every tool classified: OBSERVE → ANALYZE → DRAFT → MUTATE → EXTERNAL_SIDE_EFFECT → IRREVERSIBLE → PROPOSE.
- **4-layer forge gate.** Layer 1 (F1 AMANAH) → Layer 2 (Model Capability) → Layer 3 (Governance Bridge) → Layer 4 (Approval Boundary). No layer skippable.
- **No domain computation.** NumPy/Pandas/SciPy/geoscience/capital logic belongs in Python MCP organs (GEOX/WEALTH/WELL), not A-FORGE.
- **Tests use Node's built-in runner.** `node:test` with isolated temp directories. `ScriptedProvider` for deterministic engine tests.
- **Git-first deploy.** All production changes committed and pushed to `origin/main` before deployment.
- **Date-stamp tags only.** Format: `vYYYY.MM.DD`. Never semantic versioning.
