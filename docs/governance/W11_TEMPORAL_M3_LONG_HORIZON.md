# W11 Temporal-Anchored M3 Long-Horizon Missions

> **Spec-ID:** SPEC-2026-06-07-W11-TemporalM3LongHorizon
> **Authority:** F13 SOVEREIGN ratification required for production deployment
> **Status (2026-06-07):** SPEC DRAFT — code lives in W3 Epoch; W11 itself is a future forge
> **Sprint:** Sprint 3 of FIQH_OF_THE_MACHINE (W6 → W8 → W10 → **W11**)
> **Purpose:** Define what a "governed 12-hour M3 mission" looks like end-to-end.

---

## 1. The Question This Spec Answers

> What does it take to run a 12-hour autonomous M3 mission under full arifOS governance — so that every action is judged, every state is sealed, every F13 halt is a first-class state, and every crash is recoverable?

The W3 Epoch Architecture (forged 2026-06-07) provides the **runtime lifecycle**. W11 provides the **durable execution substrate** that lets a 12-hour mission survive restarts, F13 halts, and audit failures.

This spec is **not** a code forge. It is the architectural charter for the W11 implementation that will come AFTER W3 is merged and exercised on real missions.

---

## 2. The Target: A Governed 12-Hour Mission

The MiniMax M3 marketing page describes:

> "We tasked M3 with independently reproducing an ICLR 2025 Outstanding Paper — Learning Dynamics of LLM Finetuning. M3 ran continuously for nearly 12 hours, independently producing 18 commits and 23 experimental figures, successfully replicating the core experiments."

The 12-hour case is the **target the architecture is being built to safely host**. Under full governance, the same workload becomes:

- **12 hours of execution** with **18 commits** and **23 figures** as outputs
- Every commit = a sealed `EPOCH_TASK_COMPLETED` event in VAULT999
- Every figure = a `EPOCH_TASK_COMPLETED` event with `payload.receipt.result_preview` containing the figure
- Every F13 halt = a `EPOCH_F13_HALTED` event with reason
- Every checkpoint = a `EpochCheckpoint` with `reason: "PERIODIC"` or `"MANUAL"`
- Final state = `EPOCH_COMPLETED` event + `arif_vault_seal` of the full run

---

## 3. The Authority Stack (W11 vs W2 vs W3)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Operator intent                                                   │
│  ↓                                                                  │
│  OutcomeSpec + RunConfig  (P5 — types/outcome-spec.ts)             │
│  ↓                                                                  │
│  PlanFactory.build(mission)  (W2 — A-FORGE governance/)            │
│  ↓ Plan (judge_verdict=SEAL)                                       │
│  EpochEngine.create(plan)  (W3 — A-FORGE runtime/)                │
│  ↓ Epoch (state=CREATED)                                            │
│  arif_judge_deliberate  (arifOS MCP — confirms SEAL)               │
│  ↓                                                                  │
│  W11 Temporal worker  (durable execution across restarts)         │
│  │   ↓                                                              │
│  │   for each task in plan:                                        │
│  │     ┌─ A-FORGE execute (carries plan_id + epoch_id)             │
│  │     │   ↓                                                        │
│  │     ├─ FloorEnforcer (C1) gates each task                       │
│  │     │   ↓                                                        │
│  │     ├─ arifOS WorkflowEngine (Python) executes zero-LLM         │
│  │     │   ↓                                                        │
│  │     ├─ EpochEngine.task_started(epoch, task_id)                 │
│  │     ├─ ... task runs ...                                         │
│  │     ├─ EpochEngine.task_completed(epoch, task_id, receipt)      │
│  │     └─ arif_vault_seal(payload=receipt)                          │
│  │                                                                 │
│  │   every N tasks:                                                 │
│  │     EpochEngine.checkpoint(epoch, "PERIODIC", ...)             │
│  │     → store to L1/L2/L3 durable storage                         │
│  │                                                                 │
│  │   on F13 halt:                                                   │
│  │     EpochEngine.f13_halt(epoch, reason, "arif-fazil")           │
│  │     → STOP, surface to sovereign, wait for resolution            │
│  │                                                                 │
│  │   on wall-clock approaching limit:                               │
│  │     EpochEngine.suspend(epoch, "wall_clock_approaching", ...)   │
│  │     → checkpoint + sleep until resumed                          │
│  │                                                                 │
│  │   on completion:                                                 │
│  │     EpochEngine.complete(epoch, "test")                         │
│  │     → final event + VAULT999 seal                               │
│  ↓                                                                  │
│  12-hour mission result:                                            │
│    - 18 commits in main                                             │
│    - 23 figures in /figures/                                        │
│    - 1 Epoch with ~50 events                                        │
│    - 1 VAULT999 chain with ~50 sealed events                       │
│    - 1 final Plan completion receipt                                 │
└─────────────────────────────────────────────────────────────────────┘
```

**Key principle:** M3's autonomy is **bounded by the Plan** and **audited by the Epoch**. Every action is a sealed event. Every state transition is a first-class state in a hash-chained log. F13 halt is not a panic — it's a state.

---

## 4. W11 Durable Execution: Checkpoint + Resume Flow

The W11 worker is a long-running process (e.g., a systemd service, or a Temporal workflow, or a cron-triggered daemon). It survives crashes via the checkpoint mechanism.

### Normal Flow

```
1. W11 worker starts
2. Looks for ACTIVE epochs with checkpoints
3. If none: idle
4. If one: resume from latest checkpoint
5. arifos_epoch_replay(events) → reconstruct Epoch
6. Continue executing remaining tasks
7. Every N tasks: checkpoint
8. On completion: arifos_epoch_complete(epoch)
9. Worker stays alive for next mission
```

### Crash Recovery Flow

```
1. arifOS restarts (or W11 worker dies)
2. W11 worker comes back up
3. Reads the most recent checkpoint from L1/L2/L3 storage
4. Reconstructs the epoch via arifos_epoch_replay(events, ...)
5. Identifies the last task that was started but not completed
6. Resumes from the next task in the DAG
7. Continues the same audit trail (same epoch_id, same event chain)
```

**Crucial:** the epoch's `event_chain` is **append-only and hash-linked**. The replay reconstructs the EXACT state at the time of the crash. The W11 worker doesn't "lose" work — it picks up exactly where it left off.

### F13 Halt Flow

```
1. Epoch is in ACTIVE state, executing tasks
2. F13 halt fires (either auto-trigger from 888_HOLD or human veto)
3. EpochEngine.f13_halt(epoch, reason, "arif-fazil")
4. State → F13_HALTED, no further events permitted
5. W11 worker checks for F13 halt flag
6. Worker surfaces to sovereign via Telegram/notifier
7. Sovereign resolves: either EPOCH_RESUMED (via vetos_resolved) or EPOCH_ABORTED
8. Worker continues or stops based on sovereign decision
```

---

## 5. The Storage Stack (Where Checkpoints Live)

| Layer | Used for | Why |
|-------|----------|-----|
| L1 Redis (L1 ephemeris) | Active epoch state cache | Fast read for hot path |
| L2 Redis (L2 session) | Current event log | Session continuity |
| L3 Qdrant (L3 semantic) | Historical event embeddings (for replay search) | Audit replay |
| L4 Supabase (L4 official) | Durable epoch state + checkpoints | The court record |
| L5 Graphiti (L5 relationships) | Epoch → Plan → Mission → OutcomeSpec graph | Knowledge graph |
| L6 VAULT999 (L6 immutable) | Hash-chained event log + sealed events | The truth |

**For W11 specifically:**
- Active checkpoint: L4 Supabase (durable, queryable)
- Event log: L6 VAULT999 (immutable, sealed)
- Hot cache: L1 Redis (current epoch pointer)

---

## 6. The 12-Hour Case in Concrete Steps

Let's walk through a 12-hour M3 ICLR paper reproduction under W2+W3+W11:

| Hour | What happens | What gets sealed |
|------|--------------|------------------|
| 0:00 | Operator defines OutcomeSpec: objective = "reproduce ICLR paper", success_criteria = [18 commits, 23 figures] | (Operator input, no seal) |
| 0:01 | PlanFactory.build(mission) → Plan with ~30 tasks (read paper, parse figures, run experiments, commit results) | Plan.judge_verdict = HOLD (DRAFT) |
| 0:01 | Operator reviews plan, ratifies | Plan.judge_verdict = SEAL |
| 0:02 | EpochEngine.create(plan) → Epoch (CREATED) | EPOCH_CREATED event |
| 0:02 | W11 worker starts epoch | EPOCH_STARTED event |
| 0:05 | Task 1: read paper, extract figure list | EPOCH_TASK_STARTED + EPOCH_TASK_COMPLETED |
| 0:10 | Task 2: parse formula from figure 3 | ... |
| ... | ... | ... |
| 2:00 | Checkpoint (PERIODIC, 12 events so far) | EPOCH_CHECKPOINT event, storage to L4 |
| 4:00 | First experiment runs, 3 figures generated | 3 task events |
| 6:00 | F13 halt: budget approaching warning | EPOCH_F13_HALTED (then resolved: EPOCH_RESUMED) |
| 8:00 | Second experiment, 8 more figures | 8 task events |
| 10:00 | Checkpoint (PERIODIC) | EPOCH_CHECKPOINT |
| 11:30 | Final commit, summary figure | EPOCH_TASK_COMPLETED (last task) |
| 11:35 | Plan complete: 18 commits + 23 figures verified | EPOCH_COMPLETED event |
| 11:40 | Final result sealed to VAULT999 | Full event log + summary in L6 |

**At any point** during those 12 hours, the operator (or the audit system) can:
- Query the epoch's state (CREATED/ACTIVE/SUSPENDED/COMPLETED/...)
- Replay the event log to see exactly what happened
- F13 halt if something looks wrong
- Resume after a crash (W11 reads the latest checkpoint)

**At the end**, the VAULT999 chain has 30+ sealed events. The L4 store has the checkpoints. The 18 commits and 23 figures are in the git repo and the /figures/ directory. The whole thing is auditable, replayable, and constitutional.

---

## 7. F13 SOVEREIGN in Long-Horizon

F13 veto is the **single most important control** in long-horizon execution. The spec includes:

1. **F13 halt machinery** (W3 `f13_halt()` method) — freezes the epoch at any state
2. **F13-only transitions** — `abort()` and `f13_halt()` require `actor_id === "arif-fazil"` or `f13.*` prefix
3. **F13 notifier channel** — when an F13 halt fires, the W11 worker surfaces to sovereign via the notifier channel from OutcomeSpec
4. **F13 actor identification** — v0.1 does string match; W11 will use proper F13 sovereign key signing (Ed25519)
5. **No silent recovery** — if W11 restarts an F13_HALTED epoch without explicit sovereign sign-off, it VOIDs the entire run

---

## 8. What W11 Needs (Gaps to Fill)

This is a SPEC, not an implementation. The W11 forge will need:

| Component | Where it lives | What's needed |
|-----------|----------------|--------------|
| **W11 worker process** | A-FORGE or arifOS | Long-running process (systemd or Temporal) that drives epochs |
| **Temporal-style scheduler** | New | A scheduler that picks up ACTIVE epochs and runs tasks in order. Could be Temporal, could be a simple asyncio loop |
| **Checkpoint store** | L4 Supabase | Schema for `epoch_checkpoints` table, with `state_hash` + `last_event_id` + `storage_ref` |
| **F13 sovereign key** | `/root/compose/sekrits/arifos_sovereign.key` | Ed25519 key for F13 signing (separate from VAULT999 writer key) |
| **VAULT999 auto-seal of events** | arifOS | A hook that calls `arif_vault_seal` on every EPOCH_* event automatically |
| **Epoch search/replay UI** | AAA cockpit | A view that shows: state, event log, latest checkpoint, F13 halt status |
| **Mission lifecycle dashboard** | AAA cockpit | A higher-level view: which missions are ACTIVE, which are F13_HALTED, which are COMPLETED |
| **F13 notifier integration** | Hermes | A Telegram bot that sends a message when F13 halt fires |

---

## 9. The "12-Hour" Number — Why It Matters

MiniMax M3 demonstrated 12 hours of autonomous ICLR paper reproduction. Without governance, that's:
- 18 commits with no audit trail
- 23 figures with no receipts
- One crash = lose everything
- F13 has no veto during execution

With W2+W3+W11 governance, the same 12 hours become:
- 18 commits, each sealed as an `EPOCH_TASK_COMPLETED` event
- 23 figures, each with a `receipt` (hash of bytes, size, etc.)
- One crash = resume from latest checkpoint, no work lost
- F13 can halt at any time, sovereign reviews, can resume or abort

The architecture doesn't slow M3 down. It makes M3's autonomy **safe, auditable, and constitutional**.

---

## 10. Performance Considerations

For a 12-hour mission with 30 tasks:
- ~50 events in the event log (some tasks, plus checkpoints, plus state transitions)
- Each event: ~500 bytes JSON + 64 bytes hash
- Total event log: ~28KB
- Checkpoints: 12 (every hour) × 200 bytes = 2.4KB
- VAULT999 sealed events: 50 × 500 bytes = 25KB

**Total storage per 12-hour mission: ~30KB.** Negligible. L4 Supabase and L6 VAULT999 can handle thousands of concurrent missions.

**Latency overhead:**
- Event append: ~1ms (in-memory)
- Hash chain validation: ~0.1ms (SHA-256 of small JSON)
- VAULT999 seal: ~10-50ms (network roundtrip to Supabase)
- Checkpoint: ~50ms (L4 insert)

**Total overhead: ~5% of mission time** (vs unconstrained M3 execution). Worth it for the audit trail.

---

## 11. Open Questions for F13

1. **F13 sovereign key** — does Arif want to generate a real Ed25519 key for F13 signing now, or defer to a later sprint?
2. **W11 worker deployment** — systemd service, Temporal workflow, or cron-driven daemon? Each has tradeoffs.
3. **VAULT999 auto-seal** — should every `EPOCH_*` event be auto-sealed, or only state-changing events (CREATED, STARTED, SUSPENDED, COMPLETED, FAILED, ABORTED, F13_HALTED)?
4. **Checkpoint interval** — PERIODIC every 60s? every 100 events? configurable per mission?
5. **Mission duration limits** — max_wall_clock_seconds from RunConfig defaults to 3600 (1 hour). For 12-hour missions, this should be settable per mission.
6. **Cross-organ epoch federation** — should an epoch in A-FORGE be visible to GEOX/WEALTH/WELL for cross-domain work, or are epochs per-process?

---

## 12. Migration Path

| Phase | What ships | When |
|-------|-----------|------|
| **Phase 1** (this forge) | W3 Epoch Architecture (code + tests) | 2026-06-07 |
| **Phase 2** (Tier 2) | Wire `arifos_epoch_*` into live A-FORGE MCP + integrate with A-FORGE execute flow | After F13 ratify |
| **Phase 3** (Tier 2) | arifOS auto-seal of EPOCH_* events | After F13 ratify |
| **Phase 4** (Tier 2) | L4 Supabase `epoch_checkpoints` schema + storage | After F13 ratify |
| **Phase 5** (Tier 2) | F13 sovereign key wiring | After F13 ratify + Arif generates key |
| **Phase 6** (W11) | W11 worker (Temporal-style scheduler) | After W3 exercised in production |
| **Phase 7** (W11) | First 12-hour governed mission (the ICLR paper reproduction) | After W11 worker stable |

**Earliest realistic date for a governed 12-hour mission:** ~2 sprints after W3 merges to main and F13 ratifies the sovereign key.

---

## 13. Sign-off

**DITEMPA BUKAN DIBERI — 999 SEAL READY**

This spec defines the **target architecture** for W11. The code is in W3 (Epoch). The scheduler, key wiring, and storage are **future forges** gated on F13 ratify.

For the next 2 sprints, focus is:
1. W2 + W3 to main (branch review + F13 ratify)
2. Wire `arifos_*` tools into live A-FORGE MCP (service reload + F13 ratify)
3. Generate F13 sovereign key (F13 ratify)
4. L4 Supabase schema for checkpoints (Tier 2, F13 ratify)

Then W11 Temporal worker can begin.

**DITEMPA BUKAN DIBERI** 🔥
