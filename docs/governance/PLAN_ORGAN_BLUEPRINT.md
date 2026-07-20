# W2 Planning Organ Blueprint

> **Plan-ID:** PLAN-2026-06-07-W2-PlanningOrgan
> **Authority:** F13 SOVEREIGN ratification required for canonical state machine transitions
> **Sprint:** Sprint 2 of FIQH_OF_THE_MACHINE (W1 → W4 → **W2** → W3 → W5 → ...)
> **Status (2026-06-07):** SCAFFOLD FORGED — code complete, 10 tests pass, awaiting F13 to wire into live A-FORGE

---

## 1. Why W2 (Per Fiqh Canon)

From `FIQH_OF_THE_MACHINE.md`:

> "No non-trivial execution path should bypass the Planning Organ... planning is the bridge between human purpose and machine action."

W2 is the **bridge object** between:
- **OutcomeSpec + RunConfig (P5)** — *what* the operator wants + *constraints* on how to get it
- **A-FORGE executor** — *how* the machine actually carries it out (with floor enforcement)
- **arifOS WorkflowEngine (Python)** — *zero-LLM-in-loop* execution of the compiled plan

Without W2, missions are "smart agents doing stuff." With W2, missions are **first-class governable contracts** with explicit veto points, floor context, and reversibility class.

---

## 2. The Plan Object (Schema)

```typescript
interface Plan {
  plan_id: string;                    // ulid, e.g. "plan_01HXY..."
  mission_id: string;                 // ulid, e.g. "mission_01HXY..."
  outcome_spec_id: string;            // ulid, e.g. "outcomespec_01HXY..."
  tasks: Task[];                      // DAG of steps
  edges: Edge[];                      // Materialized from task.depends_on
  reversibility_class: "reversible" | "irreversible" | "mixed";
  risk_tier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";  // max(task.risk_tier)
  plan_state: "DRAFT" | "REVIEW" | "APPROVED" | "RUNNING" | "PAUSED" | "COMPLETED" | "ABORTED";
  veto_points: VetoPoint[];           // Explicit gates, derived from task.veto_point
  created_at: string;                 // ISO 8601
  created_by: string;                 // Agent/operator id
  notes: string[];                    // Free-form lifecycle notes
  // F13 SOVEREIGN gate
  judge_verdict: "SEAL" | "HOLD" | "VOID" | "SABAR";  // DRAFT plans start as HOLD
  judge_state_hash: string | null;    // Set by arifOS judge, not the factory
  name?: string;
}
```

See `src/types/plan.ts` for the full schema (Task, Edge, VetoPoint, TaskReceipt).

---

## 3. The PlanFactory (Pure Function)

```typescript
class PlanFactory {
  build(mission: Mission, options: PlanBuildOptions): PlanBuildResult
}
```

The factory is **pure**. No I/O. No LLM. Given the same `mission + decomposer + tool_registry`, it returns the same plan (modulo plan_id and timestamps, which are non-semantic).

### Build pipeline

1. **Materialize the mission** (apply P5 defaults)
2. **Decompose via injected `IntentDecomposer`** (v0.1: pass-through from inputs; v0.2+: LLM-backed)
3. **Build tasks** with:
   - Tool registry validation
   - Reversibility classification (F1 surface = irreversible)
   - Risk tier (tool default + sensitivity adjustment)
   - Floor context (from `TOOL_FLOOR_MAP`)
4. **Insert veto points** (F1, F13, or 888_HOLD) — see §4
5. **Validate DAG** (no missing deps, no self-loops)
6. **Aggregate** reversibility + risk tier at plan level
7. **Build the plan** with `plan_state="DRAFT"` and `judge_verdict="HOLD"`

### Output

`PlanBuildResult` is `{ ok: true, plan, warnings }` or `{ ok: false, errors }`. The factory fails LOUD on errors. Warnings (e.g., veto point insertions) are surfaced but not blocking.

---

## 4. Veto Point Insertion Rules

The factory automatically inserts veto points based on four rules:

| Rule | Condition | Floor | Human required? |
|------|-----------|-------|-----------------|
| **R1: F1 AMANAH** | Task is on F1 surface (`arif_seal`, `arif_forge`, `arif_judge`) | F1 | ✅ yes |
| **R2: F13 SOVEREIGN risk** | Task `risk_tier >= HIGH` (after sensitivity adjustment) | F13 | ✅ yes |
| **R3: F13 ALWAYS_HOLD** | Task tool name is in `ALWAYS_HOLD_ACTIONS` (e.g., `DROP DATABASE`, `rm -rf /`) | F13 | ✅ yes |
| **R4: 888_HOLD trigger** | Task triggers HOLD per `triggersHold(tool, sensitivity)` from OutcomeSpec | F13 | ✅ yes |
| **R5: SOVEREIGN sensitivity** | `mission.outcome.sensitivity === "SOVEREIGN"` | F13 | ✅ yes (plan-level) |

**No skip rule** (F8 REVERSIBILITY): the factory does not allow `on_failure=skip` on F1 surface tasks. This is enforced downstream by the executor.

---

## 5. Authority Chain (Canonical)

```
┌─────────────────────────────────────────────────────────────────┐
│  Operator intent                                                │
│  ↓                                                              │
│  OutcomeSpec + RunConfig  (P5 — types/outcome-spec.ts)          │
│  ↓                                                              │
│  PlanFactory.build(mission)  (W2 — THIS FORGE)                 │
│  ↓ Plan (DRAFT, judge_verdict=HOLD)                            │
│  FloorEnforcer (C1) — gates each Task on the way out           │
│  ↓                                                              │
│  A-FORGE execute — carries plan_id + mission_id                 │
│  ↓                                                              │
│  arifOS WorkflowEngine (Python) — zero-LLM execution            │
│  ↓                                                              │
│  arif_judge (arifOS MCP) — seals the plan            │
│  ↓ judge_verdict=SEAL, judge_state_hash=<hash>                 │
│  Plan (APPROVED) → executor runs                                │
│  ↓                                                              │
│  arif_seal — seals the result                             │
│  ↓                                                              │
│  VAULT999 (L6 ledger)                                           │
└─────────────────────────────────────────────────────────────────┘
```

**A-FORGE orchestrates. arifOS alone SEALS.**

---

## 6. A-FORGE Integration

### What A-FORGE does (this forge)

- ✅ **Owns the planning organ** in TypeScript (`src/governance/planFactory.ts`)
- ✅ **Defines the plan schema** (`src/types/plan.ts`)
- ✅ **Exposes an internal MCP tool** `arifos_plan_build` (arifos_ prefix; not in public 13)
- ✅ **Carries plan_id + mission_id** in execution envelopes (design contract for v0.2)
- ✅ **10 unit tests** covering linear/branching/irreversible/HOLD/aggregation/validation

### What A-FORGE does NOT do (per AGENTS.md)

- ❌ Does NOT issue SEAL/VOID/HOLD verdicts (arifOS only)
- ❌ Does NOT execute geoscience/economic logic (GEOX/WEALTH only)
- ❌ Does NOT write to VAULT999 directly (arifOS `arif_seal` only)
- ❌ Does NOT bypass FloorEnforcer

### Internal MCP tool exposure

`arifos_plan_build` is **NOT registered with the public MCP `tools/list`**. The public 13 (arif_*) surface is preserved. To activate:

1. Register `arifos_plan_build` with the main FastMCP instance (A-FORGE side)
2. Add `arifos_plan_build` to the internal-tools filter (mirror the arifOS `internal_tools.py` filter)
3. Reload the A-FORGE service
4. **F13 sovereign ratification** required

---

## 7. Files Forged

| File | Lines | Purpose |
|------|-------|---------|
| `src/types/plan.ts` | ~210 | Plan, Task, Edge, VetoPoint, TaskReceipt schemas + tool/floor maps |
| `src/governance/planFactory.ts` | ~370 | PlanFactory class + passThroughDecomposer + veto insertion |
| `src/mcp/tools/arifos-plan-build.ts` | ~80 | Internal MCP tool entry point + workflow compatibility wrapper |
| `test/plan-factory.test.ts` | ~290 | 10 unit tests, all must pass |
| `docs/governance/PLAN_ORGAN_BLUEPRINT.md` | (this file) | The W2 architectural charter |

**Total:** ~950 lines of TypeScript. No new npm dependencies.

---

## 8. F-Floor Binding Matrix

| Floor | W2 Binding |
|-------|-----------|
| F1 AMANAH | Veto point on F1 surface tasks; irreversibility flag for those tools |
| F2 TRUTH | `extra="forbid"` semantics in TS interfaces; tool registry validation |
| F4 CLARITY | Plain types, no opaque blobs; floor context per task |
| F6 EMPATHY | (downstream — A-FORGE execution layer) |
| F7 HUMILITY | Reversibility honored at plan level; risk_tier surfaces honestly |
| F8 REVERSIBILITY | `on_failure=skip` forbidden on F1 surface (executor-enforced) |
| F9 INJECTION | (downstream — FloorEnforcer checks) |
| F10 ONTOLOGY | (downstream — FloorEnforcer checks) |
| F11 AUTH | (downstream — FloorEnforcer checks; tool registry gates this) |
| F12 INJECTION | (downstream — FloorEnforcer checks) |
| F13 SOVEREIGN | Plan-level veto for SOVEREIGN sensitivity; per-task veto for HIGH/CRITICAL risk; plan_state transitions require F13 ratify |

---

## 9. What's NOT in v0.1 (For v0.2+)

- **LLM-backed intent decomposer** (v0.1 requires explicit `inputs.tasks` array)
- **Plan persistence to L1/L2/L3** (v0.1 in-memory)
- **Temporal-style durable execution** (v0.1: plan exists, A-FORGE runs it; v0.3+: Temporal integration per W11)
- **DB storage of plans** (v0.1: returned to caller; v0.3+: stored)
- **VAULT999 auto-promotion of plans** (v0.1: caller hands receipt to `arif_seal`; v0.3+: automatic on plan_state=APPROVED)
- **State machine enforcement** (v0.1: plan_state is a field; transitions are unenforced; v0.3+: state machine in `src/governance/planStateMachine.ts`)
- **Plan modification API** (v0.1: build once; v0.2+: `arifos_plan_modify` for approved plans under F13)

---

## 10. Test Coverage (10 tests, all must pass)

| # | Test | What it proves |
|---|------|---------------|
| W2.1 | Linear plan, 1 reversible task | Baseline: no veto, DRAFT, judge=HOLD |
| W2.2 | Branching plan, diamond DAG | Edges derived from depends_on, deduplication |
| W2.3 | Irreversible: `arif_seal` | F1 AMANAH veto inserted, risk=CRITICAL |
| W2.4 | SOVEREIGN sensitivity | Plan-level F13 veto, inserted at first task |
| W2.5 | HIGH sensitivity + MEDIUM tool | Risk bumped to HIGH → F13 veto |
| W2.6 | Aggregation: reversibility + risk | `mixed` reversibility, `max(risk)` |
| W2.7 | Validation: unknown tool | Compile error (F2 TRUTH) |
| W2.8 | Validation: missing depends_on | Compile error |
| W2.9 | Validation: self-dependency | Compile error |
| W2.10 | `arifos_plan_build` entry point | Workflow-compatibility shape, arif_* + arifos_* registry |

---

## 11. Cross-Repo Hand-off

The W2 Plan output is **the contract** between A-FORGE and arifOS:

| A-FORGE produces | arifOS receives | arifOS does |
|------------------|-----------------|-------------|
| `Plan` object (JSON) | via A2A or MCP | Routes through `arif_judge` (SEAL/HOLD/VOID) |
| `plan_id`, `mission_id` | as envelope fields | Enters L2 session thread + L3 Qdrant index |
| `veto_points[]` | as FloorContext | FloorEnforcer checks each veto before its task |
| `Task.tool`, `Task.args` | as dispatch spec | WorkflowEngine executor calls the tool via dispatcher |
| `Task.receipt` (post-exec) | as seal payload | Hand to `arif_seal` for VAULT999 promotion |

The arifOS Python `WorkflowEngine` (forge at `arifOS/core/workflow/`, 2026-06-07) already accepts plans compatible with this shape. Cross-repo integration is **read-only** (the arifOS engine does not need to change to accept these plans).

---

## 12. Naming Convention (F4 CLARITY)

| Layer | Prefix | Tool names |
|-------|--------|------------|
| **External MCP (arifOS public 13)** | `arif_` | `arif_init`, `arif_observe`, ..., `arif_floor_status` |
| **Internal federation** | `arifos_` | `arifos_workflow_compile`, `arifos_workflow_execute`, `arifos_plan_build` |

This convention is enforced in `arifOS/arifosmcp/runtime/internal_tools.py` (test: `test_internal_tools_use_arifos_prefix`). A-FORGE mirrors the same convention.

---

## 13. Migration Path to W3 (Epoch Architecture)

Once W2 is merged and exercised on a real mission, W3 (Epoch Architecture) can be built on top:

- **W3 Epoch** = `plan_id` + `created_at` + `outcome_spec_id` + `state` + `lifecycle_events[]`
- **W2 Plan** = the *contents* of an epoch's mission
- **W11 Temporal** = the *executor* of an epoch's plan across restarts

W3 is the next Wajib after W2. Not in this forge.

---

## 14. Sign-off

**DITEMPA BUKAN DIBERI — 999 SEAL READY**

Forged by **Omega (Ω)** on 2026-06-07. Awaiting F13 sovereign review.

W2 Planning Organ — Balanced path complete:
- ✅ Schema (Plan, Task, Edge, VetoPoint)
- ✅ Pure factory (PlanFactory.build)
- ✅ Veto insertion (4 rules + sensitivity bonus)
- ✅ 10/10 unit tests pass
- ✅ Internal MCP tool scaffold (arifos_plan_build)
- ✅ Cross-repo workflow compatibility (arifOS Python engine accepts)
- ✅ Naming convention preserved (arif_* public / arifos_* internal)
- ⏸️ F13 required: wire into live A-FORGE, reload, activate
- ⏸️ F13 required: state machine (DRAFT → REVIEW → APPROVED → RUNNING → COMPLETED)
- ⏸️ F13 required: LLM-backed intent decomposer (v0.2)
