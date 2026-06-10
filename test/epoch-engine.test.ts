/**
 * Tests for EpochEngine — W3 Epoch Architecture.
 *
 * 10 cases covering:
 *  - Epoch creation from Plan (F1 gate)
 *  - Linear lifecycle (CREATED → ACTIVE → COMPLETED)
 *  - Suspend/resume cycle
 *  - F13 abort with reason (F13 SOVEREIGN gate)
 *  - F13 halt freezes any state
 *  - Hash chain immutability
 *  - Replay reconstructs state
 *  - Event log append-only
 *  - Parent epoch + sub-epoch
 *  - Checkpoint creation and linkage
 *
 * Run with: node --test dist/test/epoch-engine.test.js
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EpochEngine, EpochError, EpochF1Error, EpochF13Error } from "../src/domain/governance/epochEngine.js";
import type { Plan } from "../src/domain/types/plan.js";
import type { Epoch, EpochEvent } from "../src/domain/types/epoch.js";

// ─── Fixtures ────────────────────────────────────────────────────────────

function makeSealedPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    plan_id: "plan_test_001",
    mission_id: "mission_test_001",
    outcome_spec_id: "outcomespec_test_001",
    tasks: [
      {
        task_id: "t1",
        tool: "arif_sense_observe",
        args: { mode: "search" },
        depends_on: [],
        reversibility_class: "reversible",
        risk_tier: "LOW",
        floor_context: ["F2", "F4"],
        timeout_s: 60,
      },
    ],
    edges: [],
    reversibility_class: "reversible",
    risk_tier: "LOW",
    plan_state: "DRAFT",
    veto_points: [],
    created_at: new Date().toISOString(),
    created_by: "test",
    notes: [],
    judge_verdict: "SEAL",  // F1 gate requires SEAL
    judge_state_hash: "hash_test_001",
    name: "test_plan",
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────

test("W3.1 — epoch creation requires Plan with judge_verdict=SEAL (F1 AMANAH)", () => {
  const engine = new EpochEngine();
  const plan = makeSealedPlan();

  // SEAL → ok
  const epoch = engine.create(plan, { created_by: "test" });
  assert.equal(epoch.state, "CREATED");
  assert.equal(epoch.plan_id, plan.plan_id);
  assert.equal(epoch.events.length, 1);
  assert.equal(epoch.events[0]!.event_type, "EPOCH_CREATED");
  assert.equal(epoch.f13_halt_active, false);

  // HOLD → throws F1
  const heldPlan = makeSealedPlan({ judge_verdict: "HOLD" });
  assert.throws(() => engine.create(heldPlan, { created_by: "test" }), EpochF1Error);

  // VOID → throws F1
  const voidPlan = makeSealedPlan({ judge_verdict: "VOID" });
  assert.throws(() => engine.create(voidPlan, { created_by: "test" }), EpochF1Error);
});

test("W3.2 — linear lifecycle: CREATED → ACTIVE → COMPLETED", () => {
  const engine = new EpochEngine();
  let epoch = engine.create(makeSealedPlan(), { created_by: "test" });
  assert.equal(epoch.state, "CREATED");

  epoch = engine.start(epoch, "test");
  assert.equal(epoch.state, "ACTIVE");
  assert.ok(epoch.started_at !== undefined);
  assert.equal(epoch.events.length, 2);
  assert.equal(epoch.events[1]!.event_type, "EPOCH_STARTED");

  epoch = engine.complete(epoch, "test");
  assert.equal(epoch.state, "COMPLETED");
  assert.ok(epoch.completed_at !== undefined);
  assert.equal(epoch.events.length, 3);
  assert.equal(epoch.events[2]!.event_type, "EPOCH_COMPLETED");
});

test("W3.3 — suspend/resume cycle: ACTIVE → SUSPENDED → ACTIVE", () => {
  const engine = new EpochEngine();
  let epoch = engine.create(makeSealedPlan(), { created_by: "test" });
  epoch = engine.start(epoch, "test");
  assert.equal(epoch.state, "ACTIVE");

  epoch = engine.suspend(epoch, "budget_low", "test");
  assert.equal(epoch.state, "SUSPENDED");
  assert.equal(epoch.events[2]!.event_type, "EPOCH_SUSPENDED");

  epoch = engine.resume(epoch, "test");
  assert.equal(epoch.state, "ACTIVE");
  assert.equal(epoch.events[3]!.event_type, "EPOCH_RESUMED");
});

test("W3.4 — F13 abort requires F13 actor_id", () => {
  const engine = new EpochEngine();
  let epoch = engine.create(makeSealedPlan(), { created_by: "test" });
  epoch = engine.start(epoch, "test");

  // Non-F13 actor → F13 gate
  assert.throws(() => engine.abort(epoch, "test", "non_f13_agent"), EpochF13Error);

  // F13 actor → ok
  epoch = engine.abort(epoch, "f13_override", "arif-fazil");
  assert.equal(epoch.state, "ABORTED");
  assert.ok(epoch.completed_at !== undefined);
});

test("W3.5 — F13 halt freezes any non-terminal state", () => {
  const engine = new EpochEngine();
  let epoch = engine.create(makeSealedPlan(), { created_by: "test" });
  epoch = engine.start(epoch, "test");

  epoch = engine.f13_halt(epoch, "f13_sovereign_halt", "arif-fazil");
  assert.equal(epoch.state, "F13_HALTED");
  assert.equal(epoch.f13_halt_active, true);
  assert.equal(epoch.f13_halt_reason, "f13_sovereign_halt");

  // After halt, no further events permitted
  assert.throws(() => engine.task_started(epoch, "t1", "test"), EpochError);
  assert.throws(() => engine.suspend(epoch, "test", "test"), EpochError);
});

test("W3.6 — hash chain: every event.prev_event_hash = previous event.event_hash", () => {
  const engine = new EpochEngine();
  let epoch = engine.create(makeSealedPlan(), { created_by: "test" });
  epoch = engine.start(epoch, "test");
  epoch = engine.task_started(epoch, "t1", "test");
  epoch = engine.task_completed(epoch, "t1", "test", { result: "ok" });

  // Validate chain
  for (let i = 1; i < epoch.events.length; i++) {
    const prev = epoch.events[i - 1]!;
    const cur = epoch.events[i]!;
    assert.equal(cur.prev_event_hash, prev.event_hash, `chain broken at event ${i}`);
  }
  // Genesis has prev_event_hash = 0x00
  assert.equal(epoch.events[0]!.prev_event_hash, "0".repeat(64));
  // latest_event_hash tracks the most recent
  assert.equal(epoch.latest_event_hash, epoch.events[epoch.events.length - 1]!.event_hash);
});

test("W3.7 — event log is append-only (events never re-ordered or removed)", () => {
  const engine = new EpochEngine();
  let epoch = engine.create(makeSealedPlan(), { created_by: "test" });

  // Multiple task events
  epoch = engine.start(epoch, "test");
  epoch = engine.task_started(epoch, "t1", "test");
  epoch = engine.task_completed(epoch, "t1", "test", { ok: true });
  epoch = engine.task_started(epoch, "t2", "test");
  epoch = engine.task_completed(epoch, "t2", "test", { ok: true });

  // Check ordering
  const order = epoch.events.map((e) => e.event_type);
  const expected = [
    "EPOCH_CREATED",
    "EPOCH_STARTED",
    "EPOCH_TASK_STARTED",
    "EPOCH_TASK_COMPLETED",
    "EPOCH_TASK_STARTED",
    "EPOCH_TASK_COMPLETED",
  ];
  assert.deepEqual(order, expected);

  // The append() pattern returns a NEW epoch; original events list is not mutated
  // (We can't easily prove non-mutation in TS, but the function signature returns Epoch)
});

test("W3.8 — replay reconstructs state from event log", () => {
  const engine = new EpochEngine();
  let epoch = engine.create(makeSealedPlan(), { created_by: "test" });
  epoch = engine.start(epoch, "test");
  epoch = engine.suspend(epoch, "budget_check", "test");
  epoch = engine.resume(epoch, "test");
  epoch = engine.complete(epoch, "test");

  // Capture the events
  const events: EpochEvent[] = [...epoch.events];

  // Replay from events only
  const replayed = engine.replay(events, epoch.epoch_id, epoch.plan_id, epoch.mission_id, epoch.outcome_spec_id);
  assert.equal(replayed.state, "COMPLETED");
  assert.equal(replayed.events.length, events.length);
  assert.equal(replayed.latest_event_hash, epoch.latest_event_hash);
  assert.equal(replayed.genesis_event_hash, epoch.genesis_event_hash);
});

test("W3.9 — parent epoch + sub-epoch (hierarchical missions)", () => {
  const engine = new EpochEngine();
  // Parent epoch
  const parent = engine.create(makeSealedPlan({ name: "parent_mission" }), { created_by: "test" });
  assert.equal(parent.parent_epoch_id, undefined);

  // Sub-epoch (child)
  const child = engine.create(
    makeSealedPlan({ name: "child_task" }),
    { created_by: "test", parent_epoch_id: parent.epoch_id }
  );
  assert.equal(child.parent_epoch_id, parent.epoch_id);
  assert.equal(parent.epoch_id, child.parent_epoch_id);
});

test("W3.10 — checkpoint creates durable state snapshot, hash-linked", () => {
  const engine = new EpochEngine();
  let epoch = engine.create(makeSealedPlan(), { created_by: "test" });
  epoch = engine.start(epoch, "test");
  epoch = engine.task_started(epoch, "t1", "test");

  epoch = engine.checkpoint(epoch, "PERIODIC", "test", "l1://epoch/checkpoint-1");
  assert.equal(epoch.checkpoints.length, 1);
  const cp = epoch.checkpoints[0]!;
  assert.equal(cp.reason, "PERIODIC");
  // event_count is the count AT checkpoint time (before the CHECKPOINT event is appended).
  // After this call, epoch.events.length = 4 (CREATED + STARTED + TASK_STARTED + CHECKPOINT),
  // but cp.event_count snapshots the state at the moment of checkpoint = 3.
  assert.equal(cp.event_count, 3);
  assert.ok(cp.state_hash.length === 64);  // SHA-256 hex
  assert.equal(cp.storage_ref, "l1://epoch/checkpoint-1");

  // Verify the CHECKPOINT event links to the checkpoint
  const lastEvent = epoch.events[epoch.events.length - 1]!;
  assert.equal(lastEvent.event_type, "EPOCH_CHECKPOINT");
  assert.equal(lastEvent.payload["checkpoint_id"], cp.checkpoint_id);
  assert.equal(lastEvent.state_hash, cp.state_hash);
});

test("W3.11 — replay rejects nested payload tampering", () => {
  const engine = new EpochEngine();
  let epoch = engine.create(makeSealedPlan(), { created_by: "test" });
  epoch = engine.start(epoch, "test");
  epoch = engine.task_completed(epoch, "t1", "test", {
    receipt: { plan_id: "plan_original", nested: { ok: true } },
  });

  const events: EpochEvent[] = epoch.events.map((event) => ({ ...event }));
  const tampered = events[2]!;
  tampered.payload = {
    ...tampered.payload,
    receipt: { plan_id: "plan_tampered", nested: { ok: false } },
  };

  assert.throws(
    () => engine.replay(events, epoch.epoch_id, epoch.plan_id, epoch.mission_id, epoch.outcome_spec_id),
    /EPOCH_EVENT_HASH_MISMATCH|event_hash mismatch/
  );
});

test("W3.12 — replay recomputes current event hashes, not just prev links", () => {
  const engine = new EpochEngine();
  let epoch = engine.create(makeSealedPlan(), { created_by: "test" });
  epoch = engine.start(epoch, "test");
  epoch = engine.suspend(epoch, "operator_pause", "test");

  const events: EpochEvent[] = epoch.events.map((event) => ({ ...event }));
  events[1] = {
    ...events[1]!,
    actor_id: "tampered_actor",
  };

  assert.equal(events[2]!.prev_event_hash, events[1]!.event_hash);
  assert.throws(
    () => engine.replay(events, epoch.epoch_id, epoch.plan_id, epoch.mission_id, epoch.outcome_spec_id),
    /EPOCH_EVENT_HASH_MISMATCH|event_hash mismatch/
  );
});
