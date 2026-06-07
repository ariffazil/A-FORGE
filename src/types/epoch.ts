/**
 * Epoch + EpochEvent + EpochState — canonical epoch architecture schemas (W3 WAJIB).
 *
 * "Without epochs, auditability is decorative and governance collapses."
 *   — FIQH_OF_THE_MACHINE.md, W3 entry
 *
 * The Epoch is the **time-bound audit trail** for a single mission. It wraps
 * a W2 Plan with:
 *   - A state machine (CREATED → ACTIVE → SUSPENDED → ... → COMPLETED/FAILED/ABORTED)
 *   - An append-only event log (every transition is a sealed event)
 *   - Checkpoints (durable snapshots for W11 Temporal-style resume)
 *   - F13 SOVEREIGN halt machinery
 *   - Reversibility tracking
 *
 * Plan: PLAN-2026-06-07-W3-EpochArchitecture
 * Authority: F13 ratification required for canonical state machine transitions
 *
 * Relationship to other canon artifacts:
 *   - W2 Plan    = the *contents* of a mission (DAG of tasks, veto points)
 *   - W3 Epoch   = the *lifecycle wrapper* around a Plan (state, events, time)
 *   - W11 Temporal = the *executor* of an Epoch across restarts (this forge: spec only)
 *
 * @constitutional F2 TRUTH — every event is sealed; the event log is the truth
 */

// ─── Enumerations ────────────────────────────────────────────────────────

/**
 * Epoch lifecycle states.
 *
 * State machine (canonical, W3 v0.1):
 *
 *   CREATED ──start()──→ ACTIVE ──complete()──→ COMPLETED  (terminal)
 *                  │         │
 *                  │         ├─fail()───────→ FAILED       (terminal)
 *                  │         ├─abort()──────→ ABORTED      (terminal, F13 only)
 *                  │         └─suspend()───→ SUSPENDED
 *                  │                              │
 *                  │                              └─resume()─→ ACTIVE
 *                  │
 *                  └─F13 halt (any state)──→ F13_HALTED  (terminal, F13 only)
 *
 * Terminal states: COMPLETED, FAILED, ABORTED, F13_HALTED.
 * Non-terminal: CREATED, ACTIVE, SUSPENDED.
 *
 * F13 SOVEREIGN: F13_HALTED and ABORTED are F13-only transitions.
 * arifOS alone can issue them; agents cannot.
 */
export type EpochState =
  | "CREATED"       // freshly created, not yet started
  | "ACTIVE"        // executor is running tasks
  | "SUSPENDED"     // paused (budget exhausted, F13 halt pre-resolution, etc.)
  | "COMPLETED"     // all tasks completed successfully; result sealed
  | "FAILED"        // unrecoverable error; halted without F13 intervention
  | "ABORTED"       // F13 human aborted
  | "F13_HALTED";   // F13 halt active; no further state transitions permitted

/**
 * Terminal states — no transitions out of these.
 */
export const TERMINAL_EPOCH_STATES: ReadonlySet<EpochState> = new Set([
  "COMPLETED",
  "FAILED",
  "ABORTED",
  "F13_HALTED",
]);

/**
 * All event types that can appear in an epoch's event log.
 * Each event is a single append-only entry, hash-chained to its predecessor.
 */
export type EpochEventType =
  | "EPOCH_CREATED"         // epoch birth
  | "EPOCH_STARTED"         // CREATED → ACTIVE
  | "EPOCH_TASK_STARTED"    // a task within the plan began
  | "EPOCH_TASK_COMPLETED"  // a task completed (SEAL)
  | "EPOCH_TASK_FAILED"     // a task failed (VOID)
  | "EPOCH_VETO_TRIGGERED"  // a veto point fired
  | "EPOCH_VETO_RESOLVED"   // F13 resolved a veto (continue or abort)
  | "EPOCH_SUSPENDED"       // ACTIVE → SUSPENDED
  | "EPOCH_RESUMED"         // SUSPENDED → ACTIVE
  | "EPOCH_CHECKPOINT"      // durable state snapshot
  | "EPOCH_COMPLETED"       // ACTIVE → COMPLETED
  | "EPOCH_FAILED"          // ACTIVE → FAILED
  | "EPOCH_ABORTED"         // any state → ABORTED (F13)
  | "EPOCH_F13_HALTED";     // any state → F13_HALTED (F13)

// ─── Verdict (re-export from plan for cohesion) ─────────────────────────

/** Verdict attached to every event for F2 TRUTH binding. */
export type EpochVerdict = "SEAL" | "HOLD" | "VOID" | "SABAR";

// ─── EpochEvent — single entry in the append-only event log ─────────────

/**
 * A single event in the epoch's lifecycle. Immutable once appended.
 *
 * Hash chain: each event's `event_hash` is SHA-256 of (prev_event_hash || canonical(event)).
 * This makes the event log tamper-evident (F2 TRUTH): altering any event breaks
 * the chain downstream.
 */
export interface EpochEvent {
  /** Stable id (uuid v4 with prefix). */
  event_id: string;
  /** The epoch this event belongs to. */
  epoch_id: string;
  /** Event type. */
  event_type: EpochEventType;
  /** ISO 8601 timestamp. */
  ts: string;
  /** Optional task_id (for task-related events). */
  task_id?: string;
  /** Optional F13 actor id (for F13_ABORTED, F13_HALTED, VETO_RESOLVED). */
  actor_id?: string;
  /** Verdict attached to this event. */
  verdict: EpochVerdict;
  /** Optional hash of the state at the time of the event (checkpoint linkage). */
  state_hash?: string;
  /** Free-form payload. JSON-serializable. */
  payload: Record<string, unknown>;
  /** Optional pointer to a VAULT999 sealed entry. */
  vauld_seal_id?: string;
  /** Hash of the previous event in the chain (for tamper detection). */
  prev_event_hash: string;
  /** SHA-256 hash of this event's canonical form. */
  event_hash: string;
}

// ─── EpochCheckpoint — durable snapshot for W11 resume ─────────────────

/**
 * A checkpoint is a durable snapshot of the epoch's state at a point in time.
 * W11 Temporal uses checkpoints to resume a mission after a crash/restart.
 *
 * Checkpoints are hash-linked: checkpoint[N].state_hash = SHA-256 of the
 * serialized epoch state at checkpoint time. The next event after the
 * checkpoint has prev_event_hash = checkpoint[N].state_hash.
 */
export interface EpochCheckpoint {
  checkpoint_id: string;
  epoch_id: string;
  ts: string;
  /** Hash of the epoch state at checkpoint time. */
  state_hash: string;
  /** The last event_id before this checkpoint (linkage). */
  last_event_id: string;
  /** Reason for checkpoint (periodic, on_suspend, on_f13_halt, etc.). */
  reason: "PERIODIC" | "ON_SUSPEND" | "ON_F13_HALT" | "ON_ABORT" | "ON_COMPLETE" | "MANUAL";
  /** Optional storage location (L1/L2/L3/L4/L5). */
  storage_ref?: string;
  /** Number of events at checkpoint time. */
  event_count: number;
}

// ─── Epoch — the first-class time-bound audit object ────────────────────

/**
 * An Epoch is the runtime lifecycle of a W2 Plan.
 *
 * The Epoch is:
 * - A reference to the underlying Plan (plan_id)
 * - A reference to the Mission (mission_id) and OutcomeSpec (outcome_spec_id)
 * - A state machine
 * - An event log
 * - A list of checkpoints
 * - Wall-clock budget tracking
 * - F13 SOVEREIGN halt machinery
 * - Hierarchy support (parent_epoch_id for sub-missions)
 */
export interface Epoch {
  /** Stable id (uuid v4 with prefix). */
  epoch_id: string;
  /** Reference to the W2 Plan. The Plan is the static intent; the Epoch is its runtime. */
  plan_id: string;
  /** Reference to the Mission. */
  mission_id: string;
  /** Reference to the OutcomeSpec. */
  outcome_spec_id: string;
  /** Current state. */
  state: EpochState;
  /** ISO 8601 timestamp of epoch creation. */
  created_at: string;
  /** ISO 8601 timestamp of last start (CREATED → ACTIVE or SUSPENDED → ACTIVE). */
  started_at?: string;
  /** ISO 8601 timestamp of last completion (any → COMPLETED). */
  completed_at?: string;
  /** Optional parent epoch (for hierarchical missions). */
  parent_epoch_id?: string;
  /** Wall-clock budget in seconds (from RunConfig.max_wall_clock_seconds or default 3600). */
  max_wall_clock_seconds: number;
  /** Computed remaining budget in seconds (max - elapsed). */
  remaining_seconds: number;
  /** Append-only event log. NEVER mutated after append. */
  events: EpochEvent[];
  /** Durable checkpoints (for W11 Temporal-style resume). */
  checkpoints: EpochCheckpoint[];
  /** F13 SOVEREIGN halt flag. If true, no further state transitions permitted. */
  f13_halt_active: boolean;
  /** Reason for F13 halt (if active). */
  f13_halt_reason?: string;
  /** Reversibility class (from underlying Plan). */
  reversibility_class: "reversible" | "irreversible" | "mixed";
  /** Free-form notes. */
  notes: string[];
  /** Optional human-readable name. */
  name?: string;
  /** Hash of the genesis event (first event in the log). */
  genesis_event_hash: string;
  /** Hash of the latest event. */
  latest_event_hash: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Is this state terminal? */
export function isTerminalState(state: EpochState): boolean {
  return TERMINAL_EPOCH_STATES.has(state);
}

/** Can this state transition to that state? (Pure state machine check.) */
export function canTransition(from: EpochState, to: EpochState): boolean {
  // No transitions out of terminal states
  if (isTerminalState(from)) return false;
  // Same state — not a transition
  if (from === to) return false;
  // From CREATED
  if (from === "CREATED") {
    return to === "ACTIVE" || to === "F13_HALTED" || to === "ABORTED";
  }
  // From ACTIVE
  if (from === "ACTIVE") {
    return (
      to === "SUSPENDED" ||
      to === "COMPLETED" ||
      to === "FAILED" ||
      to === "ABORTED" ||
      to === "F13_HALTED"
    );
  }
  // From SUSPENDED
  if (from === "SUSPENDED") {
    return to === "ACTIVE" || to === "ABORTED" || to === "F13_HALTED" || to === "FAILED";
  }
  return false;
}

/** Is this an F13-only transition? (arifOS alone can issue; agents cannot.) */
export function isF13OnlyTransition(from: EpochState, to: EpochState): boolean {
  return to === "ABORTED" || to === "F13_HALTED";
}
