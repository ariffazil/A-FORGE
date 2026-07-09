# W3 Epoch Architecture Blueprint

> **Plan-ID:** PLAN-2026-06-07-W3-EpochArchitecture
> **Authority:** F13 SOVEREIGN ratification required for canonical state machine transitions
> **Sprint:** Sprint 2 of FIQH_OF_THE_MACHINE (W1 → W4 → W2 → **W3** → W5 → W7 → W9 → ...)
> **Status (2026-06-07):** SCAFFOLD FORGED — code complete, 10/10 tests pass, awaiting F13 to wire into live A-FORGE

---

## 1. Why W3 (Per Fiqh Canon)

From `FIQH_OF_THE_MACHINE.md`:

> **W3** | **Epoch Architecture** | Canon §"Continuity" | "Without epochs, auditability is decorative and governance collapses"

W2 gave us a **static** artifact (the Plan — a frozen DAG of tasks).
W3 gives us the **runtime** (the Epoch — the time-bound audit trail of a Plan being executed).

Without W3:
- A long mission = a Plan that "ran for 12 hours" with no recorded state
- F13 halt = no clear "this is where the machine stopped"
- Resume after crash = no clear "this is where to pick up"
- VAULT999 = records the result, but not the journey

With W3:
- Every state transition is a sealed event
- The event log is the truth (F2 TRUTH)
- Hash chain makes tampering evident
- Checkpoints are durable (W11 Temporal can resume from them)
- F13 halt is a first-class state, not a panic

---

## 2. The Epoch Object (Schema)

```typescript
interface Epoch {
  epoch_id: string;                  // ulid
  plan_id: string;                   // reference to W2 Plan
  mission_id: string;                // reference to Mission
  outcome_spec_id: string;           // reference to OutcomeSpec
  state: EpochState;                 // CREATED|ACTIVE|SUSPENDED|COMPLETED|FAILED|ABORTED|F13_HALTED
  created_at: string;                // ISO 8601
  started_at?: string;               // first CREATED → ACTIVE
  completed_at?: string;             // terminal state
  parent_epoch_id?: string;          // for hierarchical missions
  max_wall_clock_seconds: number;    // from RunConfig or default
  remaining_seconds: number;         // computed
  events: EpochEvent[];              // append-only, hash-chained
  checkpoints: EpochCheckpoint[];    // durable snapshots
  f13_halt_active: boolean;          // F13 SOVEREIGN gate
  f13_halt_reason?: string;
  reversibility_class: "reversible" | "irreversible" | "mixed";
  notes: string[];
  name?: string;
  genesis_event_hash: string;        // hash of first event
  latest_event_hash: string;         // hash of last event
}
```

See `src/types/epoch.ts` for the full schema (EpochEvent, EpochCheckpoint, EpochEventType, EpochState).

---

## 3. The State Machine (Canonical)

```
                     ┌──────────┐
                     │ CREATED  │ ← epoch birth
                     └─────┬────┘
                           │ start()
                           ▼
                     ┌──────────┐
              ┌─────→│  ACTIVE  │←──── resume()
              │      └────┬─────┘
              │           │ suspend()
              │           ▼
              │      ┌──────────┐
              │      │SUSPENDED │
              │      └────┬─────┘
              │           │ resume() (back to ACTIVE)
              │           │
              │           │ complete()
              │           ▼
              │      ┌──────────┐
              │      │COMPLETED │  (terminal)
              │      └──────────┘
              │
              │      fail()
              │           ▼
              │      ┌──────────┐
              │      │  FAILED  │  (terminal)
              │      └──────────┘
              │
              │      abort()        [F13 only]
              │           ▼
              │      ┌──────────┐
              │      │ ABORTED  │  (terminal)
              │      └──────────┘
              │
              │      f13_halt()     [F13 only, any state]
              │           ▼
              │      ┌────────────┐
              │      │F13_HALTED  │  (terminal)
              │      └────────────┘
```

**Terminal states:** COMPLETED, FAILED, ABORTED, F13_HALTED — no transitions out.

**F13-only transitions:** ABORT, F13_HALT. arifOS alone can issue them; agents cannot.

---

## 4. The Event Log (F2 TRUTH)

The Epoch carries an **append-only event log** where every entry is:
- Hash-chained to its predecessor (`prev_event_hash = previous event_hash`)
- Sealed to VAULT999 (production) or to a local mirror (dev)
- Tagged with verdict (SEAL | HOLD | VOID | SABAR)
- Carry actor_id, task_id (if applicable), payload, timestamp

**Hash chain validation:** the `replay()` method verifies the chain before reconstructing state. If any event's `prev_event_hash` doesn't match, the chain is broken → the epoch is untrustworthy.

**14 event types:**
- `EPOCH_CREATED`, `EPOCH_STARTED`, `EPOCH_RESUMED`, `EPOCH_SUSPENDED`
- `EPOCH_COMPLETED`, `EPOCH_FAILED`, `EPOCH_ABORTED`, `EPOCH_F13_HALTED`
- `EPOCH_TASK_STARTED`, `EPOCH_TASK_COMPLETED`, `EPOCH_TASK_FAILED`
- `EPOCH_VETO_TRIGGERED`, `EPOCH_VETO_RESOLVED`
- `EPOCH_CHECKPOINT`

---

## 5. Checkpoints (W11 Bridge)

A `EpochCheckpoint` is a **durable state snapshot** of an epoch at a point in time:

```typescript
interface EpochCheckpoint {
  checkpoint_id: string;
  epoch_id: string;
  ts: string;
  state_hash: string;          // SHA-256 of epoch state at this moment
  last_event_id: string;       // linkage to event log
  reason: "PERIODIC" | "ON_SUSPEND" | "ON_F13_HALT" | "ON_ABORT" | "ON_COMPLETE" | "MANUAL";
  storage_ref?: string;        // L1/L2/L3/L4/L5 storage location
  event_count: number;         // events at checkpoint time
}
```

W11 Temporal uses checkpoints to **resume** a mission after a crash/restart. The flow:
1. W11 worker wakes up, sees an ACTIVE epoch with no progress
2. Reads the latest checkpoint from storage
3. Calls `arifos_epoch_replay(events, ...)` to reconstruct state
4. Resumes from where the checkpoint left off

---

## 6. The EpochEngine (Pure)

```typescript
class EpochEngine {
  create(plan, options) → Epoch              // F1 gate: plan.judge_verdict must be SEAL
  start(epoch, actor_id) → Epoch            // CREATED → ACTIVE
  complete(epoch, actor_id) → Epoch        // ACTIVE → COMPLETED
  suspend(epoch, reason, actor_id) → Epoch  // ACTIVE → SUSPENDED
  resume(epoch, actor_id) → Epoch           // SUSPENDED → ACTIVE
  fail(epoch, reason, actor_id) → Epoch     // ACTIVE → FAILED
  abort(epoch, reason, actor_id) → Epoch    // any → ABORTED [F13 only]
  f13_halt(epoch, reason, actor_id) → Epoch // any → F13_HALTED [F13 only]
  task_started(epoch, task_id, actor_id) → Epoch
  task_completed(epoch, task_id, actor_id, receipt) → Epoch
  task_failed(epoch, task_id, actor_id, error) → Epoch
  veto_triggered(epoch, task_id, veto_id, floor, reason, actor_id) → Epoch
  veto_resolved(epoch, veto_id, resolution, actor_id) → Epoch
  checkpoint(epoch, reason, actor_id, storage_ref?) → Epoch
  replay(events, epoch_id, plan_id, mission_id, outcome_spec_id) → Epoch
}
```

All operations are **pure functions**. No I/O. No VAULT writes. The caller (an internal agent) is responsible for routing events to `arif_seal`.

---

## 7. F-Floor Binding Matrix

| Floor | W3 Binding |
|-------|-----------|
| F1 AMANAH | `create(plan)` requires `plan.judge_verdict === "SEAL"` |
| F2 TRUTH | Every event is hash-chained; the event log is the canonical truth |
| F4 CLARITY | State transitions are explicit; no implicit carry; "Terminal" states are named |
| F7 STEWARDSHIP | Checkpoints happen at sensible intervals (PERIODIC, ON_SUSPEND, etc.) |
| F8 REVERSIBILITY | State machine is reversible — `suspend()` / `resume()` cycle is first-class |
| F9 ANTI-HANTU | No phantom events; every event has a real `payload` |
| F11 AUTH | Every event carries `actor_id` (where applicable) |
| F13 SOVEREIGN | `f13_halt()` and `abort()` are F13-only (require `actor_id === "arif-fazil"` or `actor_id.startsWith("f13.")`) |

---

## 8. The Internal MCP Tool Surface (arifos_* prefix)

8 new internal MCP tools, all `arifos_` prefixed, all hidden from public 13:

| Tool | Purpose |
|------|---------|
| `arifos_epoch_create` | Create an epoch from a W2 plan |
| `arifos_epoch_start` | CREATED → ACTIVE |
| `arifos_epoch_complete` | ACTIVE → COMPLETED |
| `arifos_epoch_suspend` | ACTIVE → SUSPENDED |
| `arifos_epoch_resume` | SUSPENDED → ACTIVE |
| `arifos_epoch_abort` | any → ABORTED (F13 only) |
| `arifos_epoch_status` | Query epoch state |
| `arifos_epoch_replay` | Reconstruct epoch from event log (W11 helper) |

**Total `arifos_` tools (after W3):** 12 (workflow_compile, workflow_execute, plan_build, 8 epoch_*). The public 13 (`arif_*`) is unchanged.

---

## 9. Cross-Repo Hand-off (W2 → W3 → W11 → arifOS)

| Layer | Artifact | Where |
|-------|----------|-------|
| W2 (A-FORGE) | `Plan` with `judge_verdict=SEAL` | `src/types/plan.ts` |
| W3 (A-FORGE) | `Epoch` wrapping the Plan | `src/types/epoch.ts` |
| A-FORGE execute | Carries `plan_id` + `epoch_id` | (next: integration in `src/server.ts`) |
| arifOS Python | `WorkflowEngine` consumes the Plan | `arifOS/core/workflow/` |
| arifOS judge | `arif_judge` SEALs the Plan | `arifOS` MCP (port 8088) |
| arifOS vault | `arif_seal` writes the Event receipts | `arifOS` MCP (port 8088) |
| W11 Temporal | Resume from checkpoint | (this forge: spec only — see `W11_TEMPORAL_M3_LONG_HORIZON.md`) |

---

## 10. Files Forged

| File | Lines | Purpose |
|------|-------|---------|
| `src/types/epoch.ts` | ~290 | Epoch, EpochEvent, EpochCheckpoint schemas + state machine helpers |
| `src/governance/epochEngine.ts` | ~530 | Pure EpochEngine class + 14 methods + hash chain + replay |
| `src/mcp/tools/arifos-epoch.ts` | ~150 | 8 internal MCP tool entry points (arifos_ prefix) |
| `test/epoch-engine.test.ts` | ~225 | 10 unit tests, all must pass |
| `docs/governance/W3_EPOCH_BLUEPRINT.md` | (this file) | The W3 architectural charter |
| `docs/governance/W11_TEMPORAL_M3_LONG_HORIZON.md` | (parallel deliverable) | W11 spec |

**Total:** ~1,200 lines of TypeScript. 0 new npm dependencies (uses Node 22 crypto).

---

## 11. Test Coverage (10 tests, all must pass)

| # | Test | What it proves |
|---|------|---------------|
| W3.1 | Epoch creation requires Plan.judge_verdict=SEAL | F1 AMANAH gate at create time |
| W3.2 | Linear lifecycle: CREATED → ACTIVE → COMPLETED | State machine happy path |
| W3.3 | Suspend/resume cycle | F8 REVERSIBILITY at state machine level |
| W3.4 | F13 abort requires F13 actor_id | F13 SOVEREIGN gate |
| W3.5 | F13 halt freezes any non-terminal state | F13 halt is terminal |
| W3.6 | Hash chain: every event links to previous | F2 TRUTH tamper-evidence |
| W3.7 | Event log is append-only (order preserved) | F9 ANTI-HANTU |
| W3.8 | Replay reconstructs state from event log | W11 bridge |
| W3.9 | Parent epoch + sub-epoch (hierarchy) | Hierarchical missions |
| W3.10 | Checkpoint creates durable state snapshot | W11 bridge |

---

## 12. What's NOT in W3 v0.1 (For v0.2+ / W11)

- **Persistent epoch storage** (v0.1: in-memory; W11 Temporal will persist to L1/L2/L3/L4)
- **VAULT999 auto-seal of every event** (v0.1: caller hands event to `arif_seal`; v0.2: automatic on every transition)
- **State machine enforcement in the executor** (v0.1: the engine validates; v0.2: the executor will reject illegal transitions at the runtime gate)
- **F13 sovereign key check** (v0.1: simple string match `actor_id === "arif-fazil"`; v0.2: real F13 signing key)
- **Cross-organ epoch federation** (v0.1: single-process; v0.2: federated epochs across organs)
- **Sub-epoch scheduling** (v0.1: parent can have children, but no built-in scheduler; v0.2: parent waits for child completion)

---

## 13. Migration Path to W5 / W7 / W11

After W3:
- **W5** (arifOS as single constitutional chokepoint) — already in place; W3 just gives epochs a place in the chokepoint
- **W7** (A-FORGE as MCP-governed execution) — W3 events flow into the A-FORGE execute flow
- **W11** (Epoch-bound durable execution) — the next big forge; uses W3 checkpoints + Temporal-style scheduling

W3 is the bridge artifact. W11 is the LATER forge that depends on W3.

---

## 14. Sign-off

**DITEMPA BUKAN DIBERI — 999 SEAL READY**

Forged by **Omega (Ω)** on 2026-06-07. Awaiting F13 sovereign review.

W3 Epoch Architecture — Balanced path complete:
- ✅ Schemas (Epoch, EpochEvent, EpochCheckpoint, EpochState)
- ✅ Pure EpochEngine with 14 methods
- ✅ State machine (7 states, 11 valid transitions, F13-only gates)
- ✅ Hash-chained event log (tamper-evident)
- ✅ Checkpoints (durable snapshots for W11)
- ✅ 10/10 unit tests pass
- ✅ 8 internal MCP tools (arifos_ prefix)
- ✅ F1, F2, F4, F7, F8, F9, F11, F13 floor bindings
- ⏸️ F13 required: wire into live A-FORGE, reload, activate
- ⏸️ W11 spec delivered in parallel (this forge)
- ⏸️ F13 required: state machine enforcement at runtime gate
- ⏸️ F13 required: F13 sovereign key check
