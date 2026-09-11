/**
 * sroAdmissibility.test.ts — SRO v1 read gate, TS port parity tests.
 *
 * Mirrors the Python canonical suite (arifOS tests/constitutional/
 * test_memory_sro_admissibility.py) for the subset forge_memory relies on.
 * The parity assertions (same policy twin, same admit lists) prove the two
 * gates cannot quietly diverge: one SOT, two runtimes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateSro, loadPolicy, SRO_GATED_COLLECTIONS } from "../src/interfaces/mcp/sroAdmissibility.js";

const NOW = new Date("2026-09-12T00:00:00Z");
const FUTURE = new Date(NOW.getTime() + 30 * 86400_000).toISOString();
const PAST = new Date(NOW.getTime() - 30 * 86400_000).toISOString();

function sro(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    supersession: { supersedes: null, superseded_by: null, supersession_reason: null, supersession_date: null },
    expiry: { expires_at: FUTURE, review_by: null, status: "ACTIVE" },
    calibration: { confidence_at_creation: null, outcome_observed: null, outcome_date: null, calibration_error: null },
    sro_version: 1,
    sro_migrated_at: "2026-09-12T00:00:00Z",
    ...overrides,
  };
}

function withStatus(status: string, expiresAt: string | null = FUTURE, supersededBy: string | null = null) {
  return sro({
    expiry: { expires_at: expiresAt, review_by: null, status },
    supersession: { supersedes: null, superseded_by: supersededBy, supersession_reason: null, supersession_date: null },
  });
}

test("policy twin loads and matches the YAML SOT shape (parity with Python gate)", () => {
  const pol = loadPolicy();
  assert.equal(pol.policy_version, 1);
  assert.equal(pol.sro_schema_version, 1);
  assert.deepEqual(pol.modes?.default?.admit_statuses, ["ACTIVE"]);
  assert.deepEqual(pol.modes?.historical?.admit_statuses, ["ACTIVE", "STALE", "EXPIRED", "SUPERSEDED"]);
  assert.equal(pol.temporal?.enforce_expires_at, true);
  assert.ok(SRO_GATED_COLLECTIONS.has("arifos_memory"));
});

test("ACTIVE with future expiry admitted in default mode", () => {
  const d = evaluateSro({ sro: withStatus("ACTIVE") }, "default", undefined, NOW);
  assert.equal(d.admitted, true);
  assert.equal(d.label, null);
});

test("EXPIRED refused in default mode, admitted + labelled HISTORICAL in historical mode", () => {
  const refused = evaluateSro({ sro: withStatus("EXPIRED", null) }, "default", undefined, NOW);
  assert.equal(refused.admitted, false);
  assert.equal(refused.reasonCode, "STATUS_NOT_ADMISSIBLE");

  const admitted = evaluateSro({ sro: withStatus("EXPIRED", null) }, "historical", undefined, NOW);
  assert.equal(admitted.admitted, true);
  assert.equal(admitted.label, "HISTORICAL");
});

test("temporal guard: ACTIVE with past expires_at → EXPIRED_BY_TIME (status lies, time does not)", () => {
  const d = evaluateSro({ sro: withStatus("ACTIVE", PAST) }, "default", undefined, NOW);
  assert.equal(d.admitted, false);
  assert.equal(d.reasonCode, "EXPIRED_BY_TIME");
  assert.equal(d.effectiveStatus, "EXPIRED");
});

test("supersession chain refused in default mode", () => {
  const d = evaluateSro({ sro: withStatus("ACTIVE", FUTURE, "successor-1") }, "default", undefined, NOW);
  assert.equal(d.admitted, false);
  assert.equal(d.reasonCode, "SUPERSEDED");
});

test("missing SRO block and wrong version fail closed", () => {
  assert.equal(evaluateSro({ content: "old shape" }, "default", undefined, NOW).reasonCode, "SRO_MISSING");
  assert.equal(
    evaluateSro({ sro: sro({ sro_version: 2 }) }, "default", undefined, NOW).reasonCode,
    "SRO_VERSION_MISMATCH",
  );
});

test("unknown mode fails closed everywhere", () => {
  const d = evaluateSro({ sro: withStatus("ACTIVE") }, "yolo", undefined, NOW);
  assert.equal(d.admitted, false);
  assert.equal(d.reasonCode, "MODE_UNKNOWN");
});

test("historical mode leaves ACTIVE records unlabelled", () => {
  const d = evaluateSro({ sro: withStatus("ACTIVE") }, "historical", undefined, NOW);
  assert.equal(d.admitted, true);
  assert.equal(d.label, null);
});
