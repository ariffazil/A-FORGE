import test from "node:test";
import assert from "node:assert/strict";
import {
  validateExecutionGrant,
  LegacySealProjection,
  assertJacobianNonAuthority,
  FORMULA_VERSION_REGISTRY,
  isLeaseActive,
  type ExecutionAuthorizationGrant,
  type GovernedTransition,
  type SessionCapabilityLease,
} from "../src/domain/governance/governed-transition.js";

function makeGrant(overrides: Partial<ExecutionAuthorizationGrant> = {}): ExecutionAuthorizationGrant {
  const now = new Date();
  const exp = new Date(now.getTime() + 3600 * 1000);
  return {
    authorization_grant_id: "authz_ts_001",
    proposal_hash: "sha256:prop123",
    plan_hash: "sha256:plan456",
    session_id: "sess_ts_123",
    actor_id: "arif",
    executor_id: "a-forge",
    allowed_operation: "write_file",
    target_scope: ["/root/arifOS/test.py"],
    baseline_hash: "sha256:base789",
    policy_version: "2026.10-F13",
    issued_at: now.toISOString(),
    expires_at: exp.toISOString(),
    single_use: true,
    issuer: "arif_judge",
    ...overrides,
  };
}

test("ADR-015 TS: validateExecutionGrant passes on valid grant", () => {
  const grant = makeGrant();
  const res = validateExecutionGrant(grant, {
    proposal_hash: "sha256:prop123",
    plan_hash: "sha256:plan456",
    executor_id: "a-forge",
    target: "/root/arifOS/test.py",
  });
  assert.equal(res.valid, true);
  assert.equal(res.reason, "valid");
});

test("ADR-015 TS: validateExecutionGrant rejects expired grant", () => {
  const grant = makeGrant({
    expires_at: new Date(Date.now() - 10000).toISOString(),
  });
  const res = validateExecutionGrant(grant, {
    proposal_hash: "sha256:prop123",
    plan_hash: "sha256:plan456",
    executor_id: "a-forge",
    target: "/root/arifOS/test.py",
  });
  assert.equal(res.valid, false);
  assert.match(res.reason, /grant_expired/);
});

test("ADR-015 TS: validateExecutionGrant rejects revoked grant", () => {
  const grant = makeGrant({
    revoked_at: new Date().toISOString(),
  });
  const res = validateExecutionGrant(grant, {
    proposal_hash: "sha256:prop123",
    plan_hash: "sha256:plan456",
    executor_id: "a-forge",
    target: "/root/arifOS/test.py",
  });
  assert.equal(res.valid, false);
  assert.match(res.reason, /grant_revoked/);
});

test("ADR-015 TS: validateExecutionGrant rejects single-use already used", () => {
  const grant = makeGrant({
    used_at: new Date().toISOString(),
  });
  const res = validateExecutionGrant(grant, {
    proposal_hash: "sha256:prop123",
    plan_hash: "sha256:plan456",
    executor_id: "a-forge",
    target: "/root/arifOS/test.py",
  });
  assert.equal(res.valid, false);
  assert.match(res.reason, /grant_already_used/);
});

test("ADR-015 TS: validateExecutionGrant rejects hash mismatches and scope escape", () => {
  const grant = makeGrant();

  // Proposal hash mismatch
  const res1 = validateExecutionGrant(grant, {
    proposal_hash: "sha256:wrong",
    plan_hash: "sha256:plan456",
    executor_id: "a-forge",
  });
  assert.equal(res1.valid, false);
  assert.match(res1.reason, /proposal_hash_mismatch/);

  // Plan hash mismatch
  const res2 = validateExecutionGrant(grant, {
    proposal_hash: "sha256:prop123",
    plan_hash: "sha256:wrong",
    executor_id: "a-forge",
  });
  assert.equal(res2.valid, false);
  assert.match(res2.reason, /plan_hash_mismatch/);

  // Target scope escape
  const res3 = validateExecutionGrant(grant, {
    proposal_hash: "sha256:prop123",
    plan_hash: "sha256:plan456",
    executor_id: "a-forge",
    target: "/etc/shadow",
  });
  assert.equal(res3.valid, false);
  assert.match(res3.reason, /target_scope_escape/);
});

test("ADR-015 TS: LegacySealProjection separates consumer meanings", () => {
  const t: GovernedTransition = {
    transition_id: "gt_001",
    authorization: {
      verdict: "SEAL",
      grant: makeGrant(),
      judge: "arif_judge",
    },
    lifecycle: {
      execution_state: "COMPLETED",
      deployment_state: "DEPLOYED",
      session_closed: true,
    },
    witness: {
      receipt_id: "rcpt_001",
      receipt_type: "EXEC_RECORD",
      outcome_observed: true,
    },
    attestation: {
      decision: "ACCEPTED",
      subject_type: "DEPLOYMENT",
      subject_id: "dep_001",
      subject_hash: "sha256:out123",
      outcome_witness_ref: "rcpt_wit_001",
      actor: "ARIF",
      assurance_level: "MEDIUM_BOUND",
      recorded_at: new Date().toISOString(),
      scope: "standard",
    },
  };

  assert.equal(LegacySealProjection.projectAuthorized(t), true);
  assert.equal(LegacySealProjection.projectReceiptWritten(t), true);
  assert.equal(LegacySealProjection.projectCompleted(t), true);
  assert.equal(LegacySealProjection.projectDeployed(t), true);
  assert.equal(LegacySealProjection.projectRatified(t), true);
  assert.equal(LegacySealProjection.projectSessionClosed(t), true);
});

test("ADR-015 TS: assertJacobianNonAuthority invariant", () => {
  assert.doesNotThrow(() => {
    assertJacobianNonAuthority("task_sensitivity_actuator");
  });
  assert.throws(() => {
    assertJacobianNonAuthority("constitutional_verdict_emitter");
  }, /JACOBIAN INVARIANT VIOLATION/);
});

test("ADR-015 TS: Formula version registry parity", () => {
  assert.equal(FORMULA_VERSION_REGISTRY["apex-g-v2-runtime"].formula, "A * P * E * X * Phi");
  assert.equal(FORMULA_VERSION_REGISTRY["apex-g-v3-proposed"].formula, "(A * P * E * X) ** 0.25");
});
