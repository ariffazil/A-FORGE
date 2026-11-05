/**
 * Federation Lane Conformance — Lane B (deterministic lease-gate suite).
 *
 * Directive: AUDIT_RECEPTACLE CONSTITUTIONAL_ALIGNMENT (2026-11-05) —
 * "Penguatkuasaan Runtime Penuh = UNVERIFIED — memerlukan suite ujian
 * kepatuhan (conformance suite)". This suite makes the A-FORGE lease gate
 * falsifiable: every invalid-lease / class-escalation / scope-expansion class
 * the constitution names must refuse with its NAMED gate, and two controls
 * must pass (a suite that only ever refuses is vacuously green).
 *
 * Target: /root/A-FORGE/dist/src/interfaces/mcp/forgeTools.js — the BUILT
 * artifact the live :7072 service runs (dist/build-commit.txt = 97b90bc0 =
 * git HEAD). Tests the deployed gate, not a source copy.
 *
 * Lanes:
 *   Lane B (this file)  — deterministic gate matrix vs validateLeaseForTool
 *   Lane A (live)       — lease_lane_probe.py → A-FORGE :7072 ingress
 *   Lane C (live)       — lease_lane_probe.py → arifOS :8088 arif_forge seal gate
 *
 * Evidence: every assertion is OBS (asserted against the deployed module).
 * Run: node --test /root/A-FORGE/conformance/lease-lane/leaseLaneConformance.test.mjs
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  validateLeaseForTool,
  registerActLease,
  registerLocalLease,
} from "/root/A-FORGE/dist/src/interfaces/mcp/forgeTools.js";

const t0 = Date.now();
let seq = 0;
const uid = (p) => `${p}-conf-${t0}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function baseLease(over) {
  return {
    agent_id: "lane-conformance",
    scope: [],
    max_action_class: "IRREVERSIBLE",
    ttl_seconds: 300,
    issued_at: t0,
    expires_at: t0 + 300_000,
    forbidden: [],
    revoked: false,
    ...over,
  };
}

/** Narrow an ok:false result or fail the test with the observed payload. */
function expectRefusal(r, gate) {
  if (r.ok) {
    throw new Error(`expected refusal gate=${gate}, got ok:true lease=${JSON.stringify(r.lease)}`);
  }
  assert.equal(r.gate, gate, `expected gate=${gate}, got ${r.gate}: ${r.reason}`);
  return r.reason;
}

// ── B1–B2: invalid lease material ───────────────────────────────────────────

test("B1 no lease + governed action → LEASE_REQUIRED (fail-closed)", async () => {
  const r = await validateLeaseForTool(undefined, "forge_vault", "EXECUTE_REVERSIBLE");
  const reason = expectRefusal(r, "LEASE_REQUIRED");
  assert.match(reason, /lease_id is required/i);
});

test("B2 unknown lease id (kernel stub + no local record) → LEASE_KERNEL_UNKNOWN", async () => {
  const r = await validateLeaseForTool(uid("LEASE-BOGUS"), "forge_vault", "EXECUTE_REVERSIBLE");
  expectRefusal(r, "LEASE_KERNEL_UNKNOWN");
});

// ── B3–B4: revoked / expired lease material ────────────────────────────────
// FINDING (recorded, not hidden): inspectLeaseViaKernel() is a measured stub
// returning null (arifOS exposes no lease verbs — forgeTools.ts MEASURED
// 2026-10-27), so revoked and expired local records fail under the
// LEASE_KERNEL_UNKNOWN label rather than LEASE_REVOKED / LEASE_EXPIRED.
// Fail-closed behavior HOLDS (refused either way); the gate LABEL for
// revoked/expired is drift — carried into the conformance receipt.

test("B3 revoked lease → refused (fail-closed; observed label LEASE_KERNEL_UNKNOWN)", async () => {
  const id = uid("LEASE-REVOKED");
  registerActLease(baseLease({ lease_id: id, scope: ["forge_vault"], revoked: true }));
  const r = await validateLeaseForTool(id, "forge_vault", "EXECUTE_REVERSIBLE");
  expectRefusal(r, "LEASE_KERNEL_UNKNOWN");
});

test("B4 expired lease → refused (fail-closed; observed label LEASE_KERNEL_UNKNOWN)", async () => {
  const id = uid("LEASE-EXPIRED");
  registerActLease(baseLease({ lease_id: id, scope: ["forge_vault"], expires_at: t0 - 1_000 }));
  const r = await validateLeaseForTool(id, "forge_vault", "EXECUTE_REVERSIBLE");
  expectRefusal(r, "LEASE_KERNEL_UNKNOWN");
});

// ── B5: class escalation (lease below requested severity) ───────────────────

test("B5 action above lease max_action_class → LEASE_CLASS_EXCEEDED", async () => {
  const id = uid("LEASE-OBSERVE-BAND");
  registerActLease(baseLease({ lease_id: id, scope: ["forge_vault"], max_action_class: "OBSERVE" }));
  const r = await validateLeaseForTool(id, "forge_vault", "EXECUTE_REVERSIBLE");
  expectRefusal(r, "LEASE_CLASS_EXCEEDED");
});

// ── B6: scope expansion (the AUDIT_RECEPTACLE core case) ────────────────────

test("B6 tool outside lease scope → LEASE_SCOPE_DENIED (scope expansion refused)", async () => {
  const id = uid("LEASE-NARROW-SCOPE");
  registerActLease(baseLease({ lease_id: id, scope: ["forge_filesystem"], max_action_class: "IRREVERSIBLE" }));
  const r = await validateLeaseForTool(id, "forge_vault", "EXECUTE_REVERSIBLE");
  expectRefusal(r, "LEASE_SCOPE_DENIED");
});

// ── B7–B8: explicit forbid list + unknown class ─────────────────────────────

test("B7 tool explicitly forbidden by lease → LEASE_FORBIDDEN", async () => {
  const id = uid("LEASE-FORBID");
  registerActLease(
    baseLease({ lease_id: id, scope: ["forge_vault"], max_action_class: "IRREVERSIBLE", forbidden: ["forge_vault"] }),
  );
  const r = await validateLeaseForTool(id, "forge_vault", "EXECUTE_REVERSIBLE");
  expectRefusal(r, "LEASE_FORBIDDEN");
});

test("B8 unknown action class → UNKNOWN_ACTION_CLASS (never silent rank 0)", async () => {
  const id = uid("LEASE-CLASS-PROBE");
  registerActLease(baseLease({ lease_id: id, scope: ["forge_vault"], max_action_class: "IRREVERSIBLE" }));
  const r = await validateLeaseForTool(id, "forge_vault", "MADE_UP_CLASS");
  expectRefusal(r, "UNKNOWN_ACTION_CLASS");
});

// ── B9–B10: verdict loop / restraint (non-OBSERVE has one path only) ───────

test("B9 governed action without verdict trace → VERDICT_RESTRAINT_GATE", async () => {
  const id = uid("LEASE-NO-TRACE");
  registerActLease(baseLease({ lease_id: id, scope: ["forge_vault"], max_action_class: "EXECUTE_REVERSIBLE" }));
  const r = await validateLeaseForTool(id, "forge_vault", "EXECUTE_REVERSIBLE");
  const reason = expectRefusal(r, "VERDICT_RESTRAINT_GATE");
  assert.match(reason, /VERDICT_LOOP_REQUIRED/);
});

test("B10 restraint flag on lease → VERDICT_RESTRAINT_GATE (restraint wins)", async () => {
  const id = uid("LEASE-RESTRAINT");
  registerActLease(
    baseLease({
      lease_id: id,
      scope: ["forge_vault"],
      max_action_class: "EXECUTE_REVERSIBLE",
      verdict_geometry: { trace_id: uid("trace") },
      restraint_flags: ["restraint_under_uncertainty"],
    }),
  );
  const r = await validateLeaseForTool(id, "forge_vault", "EXECUTE_REVERSIBLE");
  const reason = expectRefusal(r, "VERDICT_RESTRAINT_GATE");
  assert.match(reason, /RESTRAINT/);
});

// ── B11–B12: controls (the suite must not be vacuously green) ───────────────

test("B11 positive control: correctly scoped lease + verdict trace → ok", async () => {
  const id = uid("LEASE-VALID");
  registerActLease(
    baseLease({
      lease_id: id,
      scope: ["forge_vault"],
      max_action_class: "EXECUTE_REVERSIBLE",
      verdict_geometry: { trace_id: uid("trace") },
    }),
  );
  const r = await validateLeaseForTool(id, "forge_vault", "EXECUTE_REVERSIBLE");
  if (!r.ok) throw new Error(`expected ok, got ${r.gate}: ${r.reason}`);
});

test("B12 observe-lane control: OBSERVE action needs no lease → ok", async () => {
  const r = await validateLeaseForTool(undefined, "forge_probe", "OBSERVE");
  if (!r.ok) throw new Error(`expected ok for observe lane, got ${r.gate}: ${r.reason}`);
});

// ── B13: local fallback can never self-grant ────────────────────────────────

test("B13 registerLocalLease narrows to OBSERVE and cannot authorize governed action", async () => {
  const governed = registerLocalLease(
    baseLease({ lease_id: uid("LCL-SELFG"), scope: ["forge_vault", "forge_shell"], max_action_class: "IRREVERSIBLE" }),
  );
  assert.equal(governed.max_action_class, "OBSERVE", "local lease must be class-capped");
  assert.equal(governed.degraded, true, "narrowing must be marked degraded, never silent");
  assert.deepEqual(governed.scope, ["forge_vault"], "only OBSERVE-scope tools survive narrowing");
  const r = await validateLeaseForTool(governed.lease_id, "forge_vault", "EXECUTE_REVERSIBLE");
  expectRefusal(r, "LEASE_CLASS_EXCEEDED");
});
