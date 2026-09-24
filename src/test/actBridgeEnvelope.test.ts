/**
 * actBridgeEnvelope.test.ts — F13 L11 (2026-09-25) envelope Budget/RevocationRef.
 *
 * Tests:
 *  - envelope with budget+revocation_ref validates & round-trips on the wire
 *  - malformed budget shapes are rejected (non-object, unknown key, negative,
 *    non-integer, empty object, non-numeric)
 *  - malformed revocation_ref shapes are rejected (non-string, < 8 chars)
 *  - legacy token (no budget/revocation_ref) still verifies with a warning
 *    at MUTATE+ bands; verify at OBSERVE_ONLY does not warn
 *  - mintAct with budget/revocation_ref fields round-trips through verifyAct
 *
 * Run: node --test dist/test/actBridgeEnvelope.test.js
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mintAct,
  verifyAct,
  validateEnvelope,
  type ActClaims,
  type EnvelopeBudget,
} from "../infrastructure/governance/actBridge.js";

const SECRET = "l11-test-0123456789abcdef";
process.env.ARIFOS_SESSION_SECRET = SECRET;

const baseMint = {
  sid: "sid-l11",
  actor: "ARIF",
  auth: "FULL",
  av: true,
};

// ─── §1 — Envelope with budget+revocation_ref round-trips on the wire ──────
test("mintAct carries budget+revocation_ref through to verifyAct", () => {
  const budget: EnvelopeBudget = { max_seconds: 300, max_organ_calls: 50, cost_units: 1000 };
  const revocationRef = "vault-lease-deadbeef12345678";
  const minted = mintAct({
    ...baseMint,
    budget,
    revocation_ref: revocationRef,
  });
  // Wire-format: both fields present in claims (canonical arifOS JSON sort_keys)
  assert.ok(minted.claims.budget, "claims.budget present after mint");
  assert.equal(minted.claims.budget!.max_seconds, 300);
  assert.equal(minted.claims.budget!.max_organ_calls, 50);
  assert.equal(minted.claims.budget!.cost_units, 1000);
  assert.equal(minted.claims.revocation_ref, revocationRef);

  const verified = verifyAct(minted.token, { expectedActor: "ARIF", requiredAuthority: "FULL" });
  assert.ok(verified.ok, `verifyAct must pass with valid envelope: ${JSON.stringify(verified)}`);
  if (verified.ok) {
    assert.deepEqual(verified.claims.budget, budget);
    assert.equal(verified.claims.revocation_ref, revocationRef);
    assert.deepEqual(verified.envelopeWarnings, [], "no warnings on a fully-attributed envelope");
  }
});

// ─── §2 — Malformed budget shapes are rejected ──────────────────────────────
test("validateEnvelope: budget must be an object, not array", () => {
  const result = validateEnvelope({ ...fakeClaims(), budget: [1, 2, 3] as unknown as EnvelopeBudget });
  assert.equal(result.valid, false);
  assert.match(result.reason || "", /ENVELOPE_MALFORMED.*budget must be an object/);
});

test("validateEnvelope: budget rejects unknown keys", () => {
  const result = validateEnvelope({
    ...fakeClaims(),
    budget: { max_seconds: 60, evil: 1 } as unknown as EnvelopeBudget,
  });
  assert.equal(result.valid, false);
  assert.match(result.reason || "", /unknown key "evil"/);
});

test("validateEnvelope: budget rejects negative values", () => {
  const result = validateEnvelope({
    ...fakeClaims(),
    budget: { max_seconds: -1 },
  });
  assert.equal(result.valid, false);
  assert.match(result.reason || "", /budget\.max_seconds must be a non-negative integer/);
});

test("validateEnvelope: budget rejects non-integer values", () => {
  const result = validateEnvelope({
    ...fakeClaims(),
    budget: { max_organ_calls: 3.14 },
  });
  assert.equal(result.valid, false);
  assert.match(result.reason || "", /budget\.max_organ_calls must be a non-negative integer/);
});

test("validateEnvelope: budget rejects non-finite values", () => {
  const result = validateEnvelope({
    ...fakeClaims(),
    budget: { cost_units: Number.POSITIVE_INFINITY },
  });
  assert.equal(result.valid, false);
  assert.match(result.reason || "", /budget\.cost_units must be a non-negative integer/);
});

test("validateEnvelope: budget rejects empty object (must declare ≥1 ceiling)", () => {
  const result = validateEnvelope({
    ...fakeClaims(),
    budget: {},
  });
  assert.equal(result.valid, false);
  assert.match(result.reason || "", /at least one of max_seconds|max_organ_calls|cost_units/);
});

// ─── §3 — Malformed revocation_ref shapes are rejected ─────────────────────
test("validateEnvelope: revocation_ref must be a string", () => {
  const result = validateEnvelope({ ...fakeClaims(), revocation_ref: 42 as unknown as string });
  assert.equal(result.valid, false);
  assert.match(result.reason || "", /revocation_ref must be a string/);
});

test("validateEnvelope: revocation_ref must be >= 8 chars", () => {
  const result = validateEnvelope({ ...fakeClaims(), revocation_ref: "short" });
  assert.equal(result.valid, false);
  assert.match(result.reason || "", /revocation_ref must be >= 8 chars/);
});

// ─── §4 — verifyAct rejects malformed shapes on the wire ───────────────────
test("verifyAct: malformed budget on wire → ERR_ENVELOPE_MALFORMED", () => {
  const minted = mintAct({
    ...baseMint,
    auth: "OBSERVE_ONLY",
    // Cast through unknown to bypass the type checker (simulating a forged wire payload)
    budget: { max_seconds: -10 } as unknown as EnvelopeBudget,
  });
  const verified = verifyAct(minted.token);
  assert.equal(verified.ok, false);
  if (!verified.ok) {
    assert.equal(verified.error, "ERR_ENVELOPE_MALFORMED");
  }
});

// ─── §5 — MUTATE+ bands without budget/revocation_ref: WARNING only ────────
test("verifyAct: legacy FULL token (no budget/revocation_ref) verifies with WARNING", () => {
  const minted = mintAct({ ...baseMint, auth: "FULL" });
  assert.equal(minted.claims.budget, undefined);
  assert.equal(minted.claims.revocation_ref, undefined);

  const verified = verifyAct(minted.token);
  assert.ok(verified.ok, "legacy FULL token still verifies");
  if (verified.ok) {
    assert.equal(verified.envelopeWarnings.length, 2,
      "expect 2 warnings: budget missing + revocation_ref missing");
    assert.ok(verified.envelopeWarnings.some(w => /without budget/.test(w)));
    assert.ok(verified.envelopeWarnings.some(w => /without revocation_ref/.test(w)));
  }
});

test("verifyAct: legacy LIMITED_MUTATE token (no fields) warns at MUTATE+", () => {
  const minted = mintAct({ ...baseMint, auth: "LIMITED_MUTATE" });
  const verified = verifyAct(minted.token);
  assert.ok(verified.ok);
  if (verified.ok) {
    assert.equal(verified.envelopeWarnings.length, 2);
  }
});

test("verifyAct: legacy OBSERVE_ONLY token (no fields) does NOT warn", () => {
  const minted = mintAct({ ...baseMint, auth: "OBSERVE_ONLY" });
  const verified = verifyAct(minted.token);
  assert.ok(verified.ok);
  if (verified.ok) {
    assert.deepEqual(verified.envelopeWarnings, [],
      "OBSERVE_ONLY is below MUTATE — missing budget/revocation_ref is not a warning");
  }
});

test("verifyAct: legacy SOVEREIGN token (no fields) warns at MUTATE+", () => {
  const minted = mintAct({ ...baseMint, auth: "SOVEREIGN" });
  const verified = verifyAct(minted.token);
  assert.ok(verified.ok);
  if (verified.ok) {
    assert.equal(verified.envelopeWarnings.length, 2);
  }
});

test("verifyAct: legacy OPERATOR token (no fields) does NOT warn (below MUTATE)", () => {
  const minted = mintAct({ ...baseMint, auth: "OPERATOR" });
  const verified = verifyAct(minted.token);
  assert.ok(verified.ok);
  if (verified.ok) {
    assert.deepEqual(verified.envelopeWarnings, [],
      "OPERATOR is below MUTATE — missing budget/revocation_ref is not a warning");
  }
});

// ─── §6 — Fully-attributed MUTATE+ token: no warnings ──────────────────────
test("verifyAct: MUTATE+ token with both fields has no warnings", () => {
  const minted = mintAct({
    ...baseMint,
    auth: "LIMITED_MUTATE",
    budget: { max_seconds: 60 },
    revocation_ref: "token-deadbeef12345678",
  });
  const verified = verifyAct(minted.token);
  assert.ok(verified.ok);
  if (verified.ok) {
    assert.deepEqual(verified.envelopeWarnings, []);
  }
});

// ─── helper ────────────────────────────────────────────────────────────────
function fakeClaims(): ActClaims {
  return {
    act_v: 1,
    sid: "sid-fake",
    actor: "ARIF",
    auth: "FULL",
    av: true,
    stage: "000",
    lane: "AGI",
    iat: 1000,
    exp: 9999999999,
    ttl: 3600,
    nbf: 1000,
    kid: "test",
    verdict: { state: "OK", dominant_reason: null },
    apex: { G: "UNMEASURED", C_dark: "UNMEASURED", W3: "UNMEASURED", h: "UNMEASURED" },
    witness: { active: 1, diversity: "PARTIAL" },
    allowed: [],
  };
}
