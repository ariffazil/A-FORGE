# ARIF.md | METABOLIC KERNEL v1.0

> SYSTEM TYPE: LORE INTERFACE
> GOVERNANCE: arifOS AAA
> VETO: 888 JUDGE
>
> INVARIANT: Descriptive memory of repo state.
> This file NEVER modifies Law. It only reports and compresses observed reality.


## 0. IDENTITY & MOUNT POINT

- REPO_NAME: A-FORGE
- CONTAINER_ID: 2026-05-15
- DOMAIN_ROLE: Execution Intelligence / Forge Engine — TypeScript agent runtime with constitutional governance, Planner/Executor/Verifier triad, governed memory, 888_HOLD sovereignty controls
- STABILITY_CLASS: ACTIVE
- VERSION: v2026.06.07-W3-EPOCH-ARCHITECTURE


## 1. CURRENT FOCUS (INSTRUCTION POINTER)

- **W3 Epoch Architecture forged** (FIQH Sprint 2): `src/types/epoch.ts` (Epoch, EpochEvent, EpochCheckpoint) + `src/governance/epochEngine.ts` (pure engine, 14 methods, hash-chained events) + `src/mcp/tools/arifos-epoch.ts` (8 internal MCP tools) + 10/10 tests + `docs/governance/W3_EPOCH_BLUEPRINT.md`. Branch `forge/w3-epoch-architecture-2026-06-07`.
- **W11 spec delivered in parallel**: `docs/governance/W11_TEMPORAL_M3_LONG_HORIZON.md` — governed 12-hour M3 mission charter.
- W2 still uncommitted on `forge/w2-planning-organ-2026-06-07` (NOT committed, NOT pushed).
- W1 FloorEnforcer (C1) on `forge/c1-floor-enforcer-2026-06-06`: full verdict composition, awaiting main merge.
- arifOS Python WorkflowEngine v0.1: forged 2026-06-07, 11/11 tests, plan-compatible with W2.
- Internal `arifos_` tool count: 12 (workflow_compile, workflow_execute, plan_build, 8 epoch_*). Public 13 unchanged.



## 2. OPERATIONAL MANDATE

- A-FORGE is the execution bridge — builds, tests, deploys under constitutional governance.
- Implements 13 Constitutional Laws (F1–F13) as TypeScript guards.
- Approval Boundary: PENDING → DISPATCHED → APPROVED/REJECTED → REPLAYED.
- Memory Contract: 5 tiers (ephemeral, working, canon, sacred, quarantine).
- VAULT999 client: File, Postgres, NoOp backends.
- MCP tools: forge_check_governance, forge_run, forge_hold, forge_approve, forge_remember, forge_recall.
- Upstream: arifOS kernel (constitutional doctrine).
- Downstream: AAA workspace, GEOX, WEALTH, WELL organs.


## 3. THE 999 SEAL (SESSION LOG)

- 2026-06-07 | Omega | W3 Epoch Architecture forged. 14-method EpochEngine, hash-chained event log, F13 halt machinery, checkpoints, 10/10 tests. W11 spec delivered. Build clean.
- 2026-06-07 | Omega | W2 Planning Organ forged. Plan schema + PlanFactory + arifos_plan_build + 10/10 tests + blueprint. Build clean. Awaiting F13 to wire live.
- 2026-05-15 | Omega + Claude | SABAR cooldown protocol. DeepnShadow guard. Personal OS v2. Pushed to main.
- 2026-05-13 | OpenCode | DeepnShadow protocol migrated. HumanInteractionGuard forged.
- 2026-05-12 | OpenCode | GEOX artifacts cleaned from A-FORGE root.


## 4. ACTIVE TOPOLOGY (MEMORY MAP)

- CRITICAL_FILES:
  - `src/server.ts` → HTTP Bridge (port 7071)
  - `src/engine/AgentEngine.ts` → Core execution loop
  - `src/governance/CoolingGate.ts` → SABAR cooldown
  - `src/governance/FloorEnforcer.ts` → F1-F13 (on C1 branch)
  - `src/governance/planFactory.ts` → **W2 Planning Organ** (this forge)
  - `src/types/plan.ts` → **W2 Plan/Task/Edge/VetoPoint schemas** (this forge)
  - `src/mcp/tools/arifos-plan-build.ts` → **W2 internal MCP tool** (this forge)
  - `src/governance/epochEngine.ts` → **W3 Epoch Engine** (this forge)
  - `src/types/epoch.ts` → **W3 Epoch/EpochEvent/EpochCheckpoint schemas** (this forge)
  - `src/mcp/tools/arifos-epoch.ts` → **W3 internal MCP tools** (8 epoch_*, this forge)
  - `src/approval/` → Approval Boundary
  - `src/memory-contract/` → 5-tier governed memory
  - `src/vault/` → VAULT999 client
  - `src/mcp/server.ts` → MCP stdio server (19 tool classes)


## 5. INTERRUPTS & FAULTS (BLOCKERS)

- SOFT_FRICTION: W2 not yet merged to main; W1 FloorEnforcer (C1) not yet merged to main. arifOS WorkflowEngine v0.1 on feature branch.
- HARD_BLOCK: None. Build clean. W2 10/10 tests pass. Pre-existing PlanValidator rot (uses deprecated PlanDAG/PlanNode) preserved with compat shims.


## 6. RECENT SCARS (W_scar)

- [2026-06-07] → [W2 Planning Organ scaffolded on feature branch] → [Awaiting F13 ratify + merge]
- [2026-05-15] → [SABAR cooldown protocol forged] → [Code in git, not yet in container]
- [2026-05-12] → [GEOX artifacts co-located in A-FORGE root] → [Cleaned. Moved to geox.]


## 7. EXECUTION BUFFER (COMMANDS)

| Command | Status | Context |
|---------|--------|---------|
| `npm run build` | ✅ | TypeScript → dist/ (clean with W2) |
| `npm test` | ✅ | 7/7 pre-existing pass; W2 10/10 pass via `node --test dist/test/plan-factory.test.js` |
| `make up` | ✅ | Docker Compose stack |
| `node dist/src/server.js` | ✅ | HTTP bridge on 7071 |


## 8. PRIVILEGE ESCALATION (888 HOLD)

- [Q]: Wire `arifos_plan_build` (W2) + `arifos_epoch_*` (W3) into live A-FORGE MCP? Requires F13 ratify + service reload.
- [Q]: Merge W1 FloorEnforcer (C1) to main? Currently on `forge/c1-floor-enforcer-2026-06-06` branch.
- [Q]: W2 + W3 state machine enforcement at runtime gate? F13 territory.
- [Q]: F13 sovereign key generation for EpochEngine.f13_halt signature? F13 territory.
- [Q]: W11 Temporal worker deployment (systemd vs Temporal vs cron)? Spec at `W11_TEMPORAL_M3_LONG_HORIZON.md`.


## 9. PIPELINE PREFETCH (NEXT MOVES)

- [ ] F13 ratify + merge W2 + W3 branches to main
- [ ] Wire 9 `arifos_*` tools (3 W2 + 6 W3 epoch_*) into live A-FORGE FastMCP
- [ ] Merge C1 FloorEnforcer to main (foundational W1)
- [ ] Begin Sprint 3: W6, W8, W10, W11 (per FIQH sprint order)
- [ ] Generate F13 sovereign key for EpochEngine.f13_halt signature
- [ ] W2 v0.2: LLM-backed intent decomposer (replaces passThroughDecomposer)

---

*🪙 GOLD SEAL | METABOLIC KERNEL v1.0 | arifOS AAA | 888 JUDGE VETO | DITEMPA BUKAN DIBERI*
