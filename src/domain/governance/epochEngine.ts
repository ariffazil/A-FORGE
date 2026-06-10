/**
 * EpochEngine — the orchestrator for W3 Epoch lifecycle.
 *
 * "Without epochs, auditability is decorative and governance collapses."
 *
 * The EpochEngine wraps a W2 Plan and provides:
 *   - create(plan) → Epoch   (birth an epoch)
 *   - start(epoch) → Epoch   (CREATED → ACTIVE)
 *   - task_started(epoch, task_id) → EpochEvent
 *   - task_completed(epoch, task_id, receipt) → EpochEvent
 *   - task_failed(epoch, task_id, error) → EpochEvent
 *   - veto_triggered(epoch, task_id, reason) → EpochEvent
 *   - veto_resolved(epoch, veto_id, resolution) → EpochEvent
 *   - suspend(epoch, reason) → Epoch    (ACTIVE → SUSPENDED)
 *   - resume(epoch) → Epoch             (SUSPENDED → ACTIVE)
 *   - checkpoint(epoch, reason) → EpochCheckpoint
 *   - complete(epoch) → Epoch           (ACTIVE → COMPLETED)
 *   - fail(epoch, reason) → Epoch       (ACTIVE → FAILED)
 *   - abort(epoch, reason, actor_id) → Epoch  (F13 only)
 *   - f13_halt(epoch, reason) → Epoch   (F13 only)
 *   - replay(events[]) → Epoch          (reconstruct from event log)
 *
 * All operations:
 *   - Are pure functions (no I/O; no VAULT writes)
 *   - Mutate the Epoch object in place (or return a new one — see method)
 *   - Append events to the epoch's event log (immutable)
 *   - Maintain the hash chain (each event's prev_event_hash = previous event's event_hash)
 *   - Enforce state machine transitions
 *   - Block F13-only transitions unless actor_id is provided
 *
 * F-floor binding:
 *   - F1 AMANAH: epoch creation requires plan.judge_verdict === "SEAL"
 *   - F2 TRUTH: every event is hash-chained; the event log is the truth
 *   - F4 CLARITY: state transitions are explicit; no implicit carry
 *   - F7 STEWARDSHIP: checkpoints at sensible intervals (configurable)
 *   - F8 REVERSIBILITY: state machine is reversible (suspend/resume)
 *   - F9 ANTI-HANTU: no phantom events (every event has a real payload)
 *   - F11 AUTH: every event carries actor_id where applicable
 *   - F13 SOVEREIGN: F13-only transitions require explicit actor_id
 *
 * Plan: PLAN-2026-06-07-W3-EpochArchitecture
 *
 * @constitutional F2 TRUTH — the event log is the canonical audit trail
 */

import { createHash } from "node:crypto";
import {
  type Epoch,
  type EpochEvent,
  type EpochCheckpoint,
  type EpochEventType,
  type EpochVerdict,
  type EpochState,
  isTerminalState,
  canTransition,
  isF13OnlyTransition,
} from "../types/epoch.js";
import type { Plan } from "../types/plan.js";
import { newId } from "../../util/id.js";

// ─── Error types ────────────────────────────────────────────────────────

export class EpochError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "EpochError";
  }
}

export class EpochStateError extends EpochError {
  constructor(from: EpochState, to: EpochState) {
    super(`Invalid state transition: ${from} → ${to}`, "EPOCH_INVALID_TRANSITION");
  }
}

export class EpochF13Error extends EpochError {
  constructor(action: string) {
    super(`F13 SOVEREIGN gate: action '${action}' requires F13 actor_id`, "EPOCH_F13_GATE");
  }
}

export class EpochF1Error extends EpochError {
  constructor(planId: string) {
    super(
      `F1 AMANAH gate: cannot create epoch from plan '${planId}' with judge_verdict != SEAL`,
      "EPOCH_F1_GATE"
    );
  }
}

// ─── Hash chain helpers ─────────────────────────────────────────────────

/**
 * Canonical JSON serialization for hashing. Stable across runs.
 */
function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child !== undefined) {
        out[key] = canonicalize(child);
      }
    }
    return out;
  }
  return value;
}

/**
 * SHA-256 hex digest of a canonicalized object.
 */
function digest(obj: Record<string, unknown>): string {
  return createHash("sha256").update(canonicalJson(obj)).digest("hex");
}

/**
 * Compute the hash of an event. Includes all fields EXCEPT event_hash itself
 * (chicken-and-egg). The first event's prev_event_hash is "0" * 64.
 */
function computeEventHash(event: Omit<EpochEvent, "event_hash">): string {
  return digest(event as unknown as Record<string, unknown>);
}

// ─── EpochEngine ────────────────────────────────────────────────────────

export interface EpochCreateOptions {
  /** Identifier of the agent/operator creating the epoch. */
  created_by: string;
  /** Optional human-readable name. */
  name?: string;
  /** Optional parent epoch (for hierarchical missions). */
  parent_epoch_id?: string;
}

export class EpochEngine {
  /**
   * Create a new Epoch from a W2 Plan.
   *
   * F1 AMANAH gate: the Plan must have judge_verdict="SEAL" (i.e., it has
   * been judged and approved by arifOS).
   */
  create(plan: Plan, options: EpochCreateOptions): Epoch {
    if (plan.judge_verdict !== "SEAL") {
      throw new EpochF1Error(plan.plan_id);
    }

    const now = new Date().toISOString();
    const epochId = newId("epoch");
    const genesisEventId = newId("event");

    // The genesis event: EPOCH_CREATED
    const genesisEventInput: Omit<EpochEvent, "event_hash"> = {
      event_id: genesisEventId,
      epoch_id: epochId,
      event_type: "EPOCH_CREATED",
      ts: now,
      task_id: undefined,
      actor_id: options.created_by,
      verdict: "SEAL" as EpochVerdict,
      state_hash: undefined,
      payload: {
        plan_id: plan.plan_id,
        mission_id: plan.mission_id,
        outcome_spec_id: plan.outcome_spec_id,
        name: options.name ?? plan.name,
        parent_epoch_id: options.parent_epoch_id,
        max_wall_clock_seconds: plan.name ? 3600 : 3600,  // default; v0.2 reads from RunConfig
      },
      vauld_seal_id: undefined,
      prev_event_hash: "0".repeat(64),
    };
    const genesisEvent: EpochEvent = {
      ...genesisEventInput,
      event_hash: computeEventHash(genesisEventInput),
    };

    return {
      epoch_id: epochId,
      plan_id: plan.plan_id,
      mission_id: plan.mission_id,
      outcome_spec_id: plan.outcome_spec_id,
      state: "CREATED",
      created_at: now,
      started_at: undefined,
      completed_at: undefined,
      parent_epoch_id: options.parent_epoch_id,
      max_wall_clock_seconds: genesisEventInput.payload["max_wall_clock_seconds"] as number,
      remaining_seconds: genesisEventInput.payload["max_wall_clock_seconds"] as number,
      events: [genesisEvent],
      checkpoints: [],
      f13_halt_active: false,
      f13_halt_reason: undefined,
      reversibility_class: plan.reversibility_class,
      notes: [],
      name: options.name ?? plan.name,
      genesis_event_hash: genesisEvent.event_hash,
      latest_event_hash: genesisEvent.event_hash,
    };
  }

  // ─── State transitions ─────────────────────────────────────────────

  /**
   * Transition CREATED → ACTIVE.
   */
  start(epoch: Epoch, actor_id: string): Epoch {
    this.assertF13NotActive(epoch);
    this.assertCanTransition(epoch, "ACTIVE");
    return this.appendEventAndTransition(epoch, {
      event_type: "EPOCH_STARTED",
      actor_id,
      verdict: "SEAL",
      payload: { previous_state: "CREATED" },
    });
  }

  /**
   * Transition ACTIVE → SUSPENDED.
   */
  suspend(epoch: Epoch, reason: string, actor_id: string): Epoch {
    this.assertF13NotActive(epoch);
    this.assertCanTransition(epoch, "SUSPENDED");
    return this.appendEventAndTransition(epoch, {
      event_type: "EPOCH_SUSPENDED",
      actor_id,
      verdict: "HOLD",
      payload: { reason, previous_state: "ACTIVE" },
    });
  }

  /**
   * Transition SUSPENDED → ACTIVE.
   */
  resume(epoch: Epoch, actor_id: string): Epoch {
    this.assertF13NotActive(epoch);
    this.assertCanTransition(epoch, "ACTIVE");
    return this.appendEventAndTransition(epoch, {
      event_type: "EPOCH_RESUMED",
      actor_id,
      verdict: "SEAL",
      payload: { previous_state: "SUSPENDED" },
    });
  }

  /**
   * Transition ACTIVE → COMPLETED.
   */
  complete(epoch: Epoch, actor_id: string): Epoch {
    this.assertF13NotActive(epoch);
    this.assertCanTransition(epoch, "COMPLETED");
    return this.appendEventAndTransition(epoch, {
      event_type: "EPOCH_COMPLETED",
      actor_id,
      verdict: "SEAL",
      payload: { previous_state: "ACTIVE" },
    });
  }

  /**
   * Transition ACTIVE → FAILED.
   */
  fail(epoch: Epoch, reason: string, actor_id: string): Epoch {
    this.assertF13NotActive(epoch);
    this.assertCanTransition(epoch, "FAILED");
    return this.appendEventAndTransition(epoch, {
      event_type: "EPOCH_FAILED",
      actor_id,
      verdict: "VOID",
      payload: { reason, previous_state: "ACTIVE" },
    });
  }

  /**
   * Transition any state → ABORTED.
   * F13 SOVEREIGN: requires F13 actor_id.
   */
  abort(epoch: Epoch, reason: string, actor_id: string): Epoch {
    this.assertF13Actor(actor_id);
    this.assertCanTransition(epoch, "ABORTED");
    return this.appendEventAndTransition(epoch, {
      event_type: "EPOCH_ABORTED",
      actor_id,
      verdict: "VOID",
      payload: { reason, previous_state: epoch.state, f13_override: true },
    });
  }

  /**
   * Activate F13 halt (any non-terminal state → F13_HALTED).
   * F13 SOVEREIGN: requires F13 actor_id.
   */
  f13_halt(epoch: Epoch, reason: string, actor_id: string): Epoch {
    this.assertF13Actor(actor_id);
    if (isTerminalState(epoch.state)) {
      throw new EpochStateError(epoch.state, "F13_HALTED");
    }
    const halted = this.appendEventAndTransition(epoch, {
      event_type: "EPOCH_F13_HALTED",
      actor_id,
      verdict: "VOID",
      payload: { reason, previous_state: epoch.state, f13_override: true },
    });
    halted.f13_halt_active = true;
    halted.f13_halt_reason = reason;
    return halted;
  }

  // ─── Task events ─────────────────────────────────────────────────────

  /**
   * Record a task start (does NOT change epoch state).
   */
  task_started(epoch: Epoch, task_id: string, actor_id: string): Epoch {
    this.assertF13NotActive(epoch);
    this.assertNotTerminal(epoch);
    return this.appendEvent(epoch, {
      event_type: "EPOCH_TASK_STARTED",
      actor_id,
      task_id,
      verdict: "SEAL",
      payload: { task_id },
    });
  }

  /**
   * Record a task completion (does NOT change epoch state).
   */
  task_completed(epoch: Epoch, task_id: string, actor_id: string, receipt: Record<string, unknown>): Epoch {
    this.assertF13NotActive(epoch);
    this.assertNotTerminal(epoch);
    return this.appendEvent(epoch, {
      event_type: "EPOCH_TASK_COMPLETED",
      actor_id,
      task_id,
      verdict: "SEAL",
      payload: { task_id, receipt },
    });
  }

  /**
   * Record a task failure (does NOT change epoch state).
   */
  task_failed(epoch: Epoch, task_id: string, actor_id: string, error: string): Epoch {
    this.assertF13NotActive(epoch);
    this.assertNotTerminal(epoch);
    return this.appendEvent(epoch, {
      event_type: "EPOCH_TASK_FAILED",
      actor_id,
      task_id,
      verdict: "VOID",
      payload: { task_id, error },
    });
  }

  /**
   * Record a veto trigger (does NOT change epoch state).
   */
  veto_triggered(epoch: Epoch, task_id: string, veto_id: string, floor: string, reason: string, actor_id: string): Epoch {
    this.assertF13NotActive(epoch);
    this.assertNotTerminal(epoch);
    return this.appendEvent(epoch, {
      event_type: "EPOCH_VETO_TRIGGERED",
      actor_id,
      task_id,
      verdict: "HOLD",
      payload: { task_id, veto_id, floor, reason },
    });
  }

  /**
   * Record a veto resolution (does NOT change epoch state).
   * F13 SOVEREIGN: requires F13 actor_id.
   */
  veto_resolved(epoch: Epoch, veto_id: string, resolution: "CONTINUE" | "ABORT", actor_id: string): Epoch {
    this.assertF13Actor(actor_id);
    return this.appendEvent(epoch, {
      event_type: "EPOCH_VETO_RESOLVED",
      actor_id,
      verdict: resolution === "CONTINUE" ? "SEAL" : "VOID",
      payload: { veto_id, resolution },
    });
  }

  // ─── Checkpoints ───────────────────────────────────────────────────

  /**
   * Create a durable checkpoint of the epoch's state.
   * W11 Temporal will use these to resume a mission after a restart.
   */
  checkpoint(epoch: Epoch, reason: EpochCheckpoint["reason"], actor_id: string, storage_ref?: string): Epoch {
    this.assertF13NotActive(epoch);
    const lastEvent = epoch.events[epoch.events.length - 1];
    if (!lastEvent) {
      throw new EpochError("Cannot checkpoint an epoch with no events", "EPOCH_EMPTY");
    }

    const stateHash = digest({
      epoch_id: epoch.epoch_id,
      state: epoch.state,
      events_count: epoch.events.length,
      latest_event_hash: epoch.latest_event_hash,
      remaining_seconds: epoch.remaining_seconds,
    });

    const checkpoint: EpochCheckpoint = {
      checkpoint_id: newId("checkpoint"),
      epoch_id: epoch.epoch_id,
      ts: new Date().toISOString(),
      state_hash: stateHash,
      last_event_id: lastEvent.event_id,
      reason,
      storage_ref,
      event_count: epoch.events.length,
    };

    const withCheckpoint: Epoch = {
      ...epoch,
      checkpoints: [...epoch.checkpoints, checkpoint],
    };

    // Append a CHECKPOINT event linking to the checkpoint
    return this.appendEvent(withCheckpoint, {
      event_type: "EPOCH_CHECKPOINT",
      actor_id,
      verdict: "SEAL",
      state_hash: stateHash,
      payload: { checkpoint_id: checkpoint.checkpoint_id, reason },
    });
  }

  // ─── Replay ────────────────────────────────────────────────────────

  /**
   * Reconstruct an epoch's state from a sequence of events.
   * W11 Temporal's resume flow uses this to rebuild state after a crash.
   */
  replay(events: EpochEvent[], epoch_id: string, plan_id: string, mission_id: string, outcome_spec_id: string): Epoch {
    if (events.length === 0) {
      throw new EpochError("Cannot replay from empty event list", "EPOCH_EMPTY");
    }
    const genesis = events[0]!;
    if (genesis.epoch_id !== epoch_id) {
      throw new EpochError(
        `Genesis event epoch_id '${genesis.epoch_id}' does not match expected '${epoch_id}'`,
        "EPOCH_EPOCH_ID_MISMATCH"
      );
    }

    // Validate hash chain
    let prevHash = "0".repeat(64);
    for (const e of events) {
      if (e.prev_event_hash !== prevHash) {
        throw new EpochError(
          `Event '${e.event_id}' prev_event_hash mismatch (chain broken at '${e.event_type}')`,
          "EPOCH_HASH_CHAIN_BROKEN"
        );
      }
      const { event_hash: _storedHash, ...hashInput } = e;
      const recomputedHash = computeEventHash(hashInput);
      if (e.event_hash !== recomputedHash) {
        throw new EpochError(
          `Event '${e.event_id}' event_hash mismatch (payload or metadata tampered at '${e.event_type}')`,
          "EPOCH_EVENT_HASH_MISMATCH"
        );
      }
      prevHash = e.event_hash;
    }

    // Reconstruct state from event sequence
    const lastEvent = events[events.length - 1]!;
    const state = deriveStateFromEvents(events);

    // Find first EPOCH_CREATED payload for max_wall_clock_seconds
    const created = genesis.payload;
    const maxWallClock = (created["max_wall_clock_seconds"] as number) ?? 3600;
    const startedAt = findFirstEventTs(events, "EPOCH_STARTED");
    const completedAt = findFirstEventTs(events, "EPOCH_COMPLETED") ||
                       findFirstEventTs(events, "EPOCH_FAILED") ||
                       findFirstEventTs(events, "EPOCH_ABORTED") ||
                       findFirstEventTs(events, "EPOCH_F13_HALTED");
    const elapsed = completedAt
      ? (new Date(completedAt).getTime() - new Date(genesis.ts).getTime()) / 1000
      : (Date.now() - new Date(genesis.ts).getTime()) / 1000;
    const remaining = Math.max(0, maxWallClock - elapsed);

    // F13 halt
    const f13HaltEvent = events.find((e) => e.event_type === "EPOCH_F13_HALTED");
    const f13HaltActive = f13HaltEvent !== undefined;
    const f13HaltReason = f13HaltEvent?.payload["reason"] as string | undefined;

    return {
      epoch_id,
      plan_id,
      mission_id,
      outcome_spec_id,
      state,
      created_at: genesis.ts,
      started_at: startedAt,
      completed_at: completedAt,
      parent_epoch_id: created["parent_epoch_id"] as string | undefined,
      max_wall_clock_seconds: maxWallClock,
      remaining_seconds: remaining,
      events,
      checkpoints: [],  // checkpoints are reconstructed separately
      f13_halt_active: f13HaltActive,
      f13_halt_reason: f13HaltReason,
      reversibility_class: "mixed",  // v0.2: derive from underlying plan
      notes: [],
      name: created["name"] as string | undefined,
      genesis_event_hash: genesis.event_hash,
      latest_event_hash: lastEvent.event_hash,
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────

  private assertF13NotActive(epoch: Epoch): void {
    if (epoch.f13_halt_active) {
      throw new EpochError(
        `F13 SOVEREIGN halt active: ${epoch.f13_halt_reason ?? "(no reason)"}`,
        "EPOCH_F13_HALT_BLOCK"
      );
    }
  }

  private assertNotTerminal(epoch: Epoch): void {
    if (isTerminalState(epoch.state)) {
      throw new EpochError(
        `Epoch is in terminal state '${epoch.state}'; no further events permitted`,
        "EPOCH_TERMINAL"
      );
    }
  }

  private assertF13Actor(actor_id: string): void {
    // F13 SOVEREIGN: actor_id must be "arif-fazil" or start with "f13."
    // (Production: a real F13 sovereign key check; v0.1: simple string match)
    if (actor_id !== "arif-fazil" && !actor_id.startsWith("f13.")) {
      throw new EpochF13Error("transition");
    }
  }

  private assertCanTransition(epoch: Epoch, to: EpochState): void {
    if (!canTransition(epoch.state, to)) {
      throw new EpochStateError(epoch.state, to);
    }
  }

  /**
   * Append a new event to the epoch's event log and update the state.
   * Returns a new Epoch object (immutable update pattern).
   */
  private appendEventAndTransition(
    epoch: Epoch,
    args: {
      event_type: EpochEventType;
      actor_id: string;
      task_id?: string;
      verdict: EpochVerdict;
      state_hash?: string;
      payload: Record<string, unknown>;
    }
  ): Epoch {
    const now = new Date().toISOString();
    const eventInput: Omit<EpochEvent, "event_hash"> = {
      event_id: newId("event"),
      epoch_id: epoch.epoch_id,
      event_type: args.event_type,
      ts: now,
      task_id: args.task_id,
      actor_id: args.actor_id,
      verdict: args.verdict,
      state_hash: args.state_hash,
      payload: args.payload,
      vauld_seal_id: undefined,
      prev_event_hash: epoch.latest_event_hash,
    };
    const event: EpochEvent = {
      ...eventInput,
      event_hash: computeEventHash(eventInput),
    };

    // Derive new state from event type
    const newState = eventTypeToState(args.event_type);

    // Update remaining_seconds
    const elapsed = (new Date(now).getTime() - new Date(epoch.created_at).getTime()) / 1000;
    const remaining = Math.max(0, epoch.max_wall_clock_seconds - elapsed);

    return {
      ...epoch,
      state: newState,
      started_at: newState === "ACTIVE" && !epoch.started_at ? now : epoch.started_at,
      completed_at: isTerminalState(newState) ? now : epoch.completed_at,
      remaining_seconds: remaining,
      events: [...epoch.events, event],
      latest_event_hash: event.event_hash,
    };
  }

  /**
   * Append a non-state-changing event (task_*, veto_*).
   */
  private appendEvent(
    epoch: Epoch,
    args: {
      event_type: EpochEventType;
      actor_id: string;
      task_id?: string;
      verdict: EpochVerdict;
      state_hash?: string;
      payload: Record<string, unknown>;
    }
  ): Epoch {
    const now = new Date().toISOString();
    const eventInput: Omit<EpochEvent, "event_hash"> = {
      event_id: newId("event"),
      epoch_id: epoch.epoch_id,
      event_type: args.event_type,
      ts: now,
      task_id: args.task_id,
      actor_id: args.actor_id,
      verdict: args.verdict,
      state_hash: args.state_hash,
      payload: args.payload,
      vauld_seal_id: undefined,
      prev_event_hash: epoch.latest_event_hash,
    };
    const event: EpochEvent = {
      ...eventInput,
      event_hash: computeEventHash(eventInput),
    };
    return {
      ...epoch,
      events: [...epoch.events, event],
      latest_event_hash: event.event_hash,
    };
  }
}

// ─── State derivation helpers ─────────────────────────────────────────

function eventTypeToState(eventType: EpochEventType): EpochState {
  switch (eventType) {
    case "EPOCH_CREATED":
      return "CREATED";
    case "EPOCH_STARTED":
    case "EPOCH_RESUMED":
      return "ACTIVE";
    case "EPOCH_SUSPENDED":
      return "SUSPENDED";
    case "EPOCH_COMPLETED":
      return "COMPLETED";
    case "EPOCH_FAILED":
      return "FAILED";
    case "EPOCH_ABORTED":
      return "ABORTED";
    case "EPOCH_F13_HALTED":
      return "F13_HALTED";
    default:
      // Non-state-changing events (task_*, veto_*, checkpoint)
      // Don't change state — caller should not route through this function
      throw new EpochError(
        `eventType '${eventType}' is not a state transition`,
        "EPOCH_INVALID_TRANSITION"
      );
  }
}

function deriveStateFromEvents(events: EpochEvent[]): EpochState {
  // Walk events in order; the LAST state-changing event determines the current state
  let currentState: EpochState = "CREATED";
  for (const e of events) {
    if (
      e.event_type === "EPOCH_STARTED" ||
      e.event_type === "EPOCH_RESUMED"
    ) {
      currentState = "ACTIVE";
    } else if (e.event_type === "EPOCH_SUSPENDED") {
      currentState = "SUSPENDED";
    } else if (e.event_type === "EPOCH_COMPLETED") {
      currentState = "COMPLETED";
    } else if (e.event_type === "EPOCH_FAILED") {
      currentState = "FAILED";
    } else if (e.event_type === "EPOCH_ABORTED") {
      currentState = "ABORTED";
    } else if (e.event_type === "EPOCH_F13_HALTED") {
      currentState = "F13_HALTED";
    }
  }
  return currentState;
}

function findFirstEventTs(events: EpochEvent[], type: EpochEventType): string | undefined {
  return events.find((e) => e.event_type === type)?.ts;
}
