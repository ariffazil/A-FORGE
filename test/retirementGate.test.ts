/**
 * retirementGate.test.ts — P2.6 reversible auto-retirement.
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RetirementGate, type RetirementPolicy } from "../src/domain/forge/RetirementGate.js";

const policy: RetirementPolicy = {
  capability_id: "cap.retire",
  triggers: {
    age_hours: 24,
    invocations_since_last_verify: 50,
    verifier_pass_rate_drop: 0.1,
    canonical_g_drop: 0.1,
  },
  on_retire: "snapshot_then_evict",
  arifos_acknowledgement_required: true,
};

const gate = new RetirementGate();

describe("RetirementGate — no triggers", () => {
  it("extends when nothing fires", () => {
    const d = gate.evaluate(policy, {}, { now: 1_700_000_000_000 });
    assert.equal(d.action, "EXTEND");
    assert.equal(d.arifos_acknowledgement_required, false);
  });
});

describe("RetirementGate — age trigger", () => {
  it("retires when age > threshold", () => {
    const NOW = 1_700_000_000_000;
    const lastVerifiedAt = NOW - 25 * 3_600_000;
    const d = gate.evaluate(policy, {}, { now: NOW, lastVerifiedAt });
    assert.equal(d.action, "RETIRE");
    assert.match(d.reason, /age/);
    assert.equal(d.arifos_acknowledgement_required, true);
    assert.ok(d.snapshot_id);
  });
});

describe("RetirementGate — verifier_pass_rate trigger", () => {
  it("retires when baseline - current >= threshold", () => {
    const d = gate.evaluate(policy, {}, {
      baselinePassRate: 0.95,
      currentPassRate: 0.8,
    });
    assert.equal(d.action, "RETIRE");
    assert.match(d.reason, /verifier pass rate drop/);
  });
});

describe("RetirementGate — canonical_g trigger", () => {
  it("retires when baseline - current >= threshold", () => {
    const d = gate.evaluate(policy, {}, {
      baselineG: 0.85,
      canonicalG: 0.7,
    });
    assert.equal(d.action, "RETIRE");
    assert.match(d.reason, /canonical G drop/);
  });
});

describe("RetirementGate — invocations trigger", () => {
  it("retires when invocations_since_last_verify >= threshold", () => {
    const d = gate.evaluate(policy, {}, { invocations: 60 });
    assert.equal(d.action, "RETIRE");
    assert.match(d.reason, /invocations/);
  });
});

describe("RetirementGate — soft_delete policy emits no snapshot", () => {
  it("returns no snapshot_id when on_retire=soft_delete", () => {
    const d = gate.evaluate(
      { ...policy, on_retire: "soft_delete" },
      {},
      { invocations: 100 },
    );
    assert.equal(d.action, "RETIRE");
    assert.equal(d.snapshot_id, undefined);
  });
});
