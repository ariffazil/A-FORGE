/**
 * AMANAH Authorization Envelope (AAE) v1 — Unit Tests
 *
 * 7 test cases:
 *  [1] buildAAE  — happy path, all fields present, signature valid
 *  [2] verifyAAE — valid envelope passes all F1/F8 checks
 *  [3] F1 DENY  — missing actor_id → DENY
 *  [4] F1 DENY  — missing expiry   → DENY
 *  [5] F1 DENY  — missing signature → DENY
 *  [6] F8 DENY  — expired AAE       → DENY
 *  [7] tampered  — wrong secret     → DENY
 *
 * F2 TRUTH: all claims labeled OBS/DER/INT/SPEC in test names.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { buildAAE, verifyAAE, extendAAE, computeIntentHash, type AAEV1 } from "../src/domain/governance/amanahEnvelope.js";

const SECRET = "test-organ-secret-32bytes-long!!"; // ≥32 bytes for HMAC-SHA256
const ISSUER = "test-forge";

function makeBase() {
  return {
    actor_id: "arif",
    intent: "Deploy webapp to production",
    action_class: "EXECUTE_HIGH_IMPACT" as const,
    reversibility: 0.3,
    blast_radius: "service" as const,
    evidence_refs: ["vault-001", "vault-002"],
    organ_secret: SECRET,
    issuer: ISSUER,
  };
}

// ─── TEST 1: buildAAE happy path ──────────────────────────────────────────────
// OBS: buildAAE returns a fully-formed AAEV1 with correct fields
async function test1_buildAAE_happy() {
  const opts = makeBase();
  const aae = await buildAAE(opts);

  assert.strictEqual(aae.version, "AAE-v1", "[OBS] version field correct");
  assert.strictEqual(aae.actor_id, "arif", "[OBS] actor_id correct");
  assert.strictEqual(typeof aae.intent_hash, "string", "[OBS] intent_hash is string");
  assert.strictEqual(aae.intent_hash.length, 64, "[OBS] BLAKE3 hex = 64 chars");
  assert.strictEqual(aae.action_class, "EXECUTE_HIGH_IMPACT", "[OBS] action_class correct");
  assert.strictEqual(aae.reversibility, 0.3, "[OBS] reversibility correct");
  assert.strictEqual(aae.blast_radius, "service", "[OBS] blast_radius correct");
  assert.deepStrictEqual(aae.evidence_refs, ["vault-001", "vault-002"], "[OBS] evidence_refs preserved");
  assert.ok(aae.expiry > Date.now(), "[OBS] expiry is in the future");
  assert.ok(aae.nonce.length > 10, "[OBS] nonce generated");
  assert.ok(aae.idempotency_key.length > 10, "[OBS] idempotency_key generated");
  assert.strictEqual(typeof aae.signature, "string", "[OBS] signature is string");
  assert.strictEqual(aae.signature.length, 64, "[OBS] HMAC-SHA256 hex = 64 chars");
  assert.strictEqual(aae.issuer, ISSUER, "[OBS] issuer correct");
  console.log("  ✅ TEST 1 buildAAE happy path — PASS");
}

// ─── TEST 2: verifyAAE valid envelope ─────────────────────────────────────────
// OBS: verifyAAE returns valid:true for a correctly signed, non-expired AAE
async function test2_verifyAAE_valid() {
  const opts = makeBase();
  const aae = await buildAAE(opts);
  const result = verifyAAE(aae, SECRET);

  assert.strictEqual(result.valid, true, "[OBS] envelope valid");
  assert.strictEqual(result.reason, "AAE valid", "[OBS] reason correct");
  assert.strictEqual(result.missing_actor_id, undefined, "[OBS] no F1 missing_actor_id");
  assert.strictEqual(result.missing_expiry, undefined, "[OBS] no F1 missing_expiry");
  assert.strictEqual(result.missing_signature, undefined, "[OBS] no F1 missing_signature");
  assert.strictEqual(result.expired, undefined, "[OBS] not expired");
  console.log("  ✅ TEST 2 verifyAAE valid — PASS");
}

// ─── TEST 3: F1 DENY — missing actor_id ───────────────────────────────────────
// DER: missing actor_id triggers F1 AMANAH DENY
async function test3_F1_DENY_missing_actor_id() {
  // buildAAE must throw when actor_id is undefined
  await assert.rejects(
    async () =>
      await buildAAE({
        intent: "Deploy webapp",
        action_class: "EXECUTE_HIGH_IMPACT",
        reversibility: 0.3,
        blast_radius: "service",
        organ_secret: SECRET,
        // actor_id deliberately omitted
      }),
    /actor_id is required/,
    "[DER] buildAAE throws when actor_id missing"
  );

  // verifyAAE also DENYs an envelope with empty actor_id
  const opts = makeBase();
  const base = await buildAAE(opts);
  const fakeAae: AAEV1 = { ...base, actor_id: "" };

  const result = verifyAAE(fakeAae, SECRET);
  assert.strictEqual(result.valid, false, "[DER] verifyAAE returns invalid");
  assert.strictEqual(result.missing_actor_id, true, "[DER] missing_actor_id flagged");
  assert.match(result.reason!, /actor_id/, "[DER] reason mentions actor_id");
  console.log("  ✅ TEST 3 F1 DENY missing actor_id — PASS");
}

// ─── TEST 4: F1 DENY — missing expiry ──────────────────────────────────────────
// DER: missing expiry triggers F1 AMANAH DENY
async function test4_F1_DENY_missing_expiry() {
  // Fabricate an AAE with expiry = 0 (missing-like)
  const opts = makeBase();
  const aae = await buildAAE(opts);
  const noExpiryAae: AAEV1 = { ...aae, expiry: 0 as any };
  (noExpiryAae as any).expiry = 0;

  const result = verifyAAE(noExpiryAae as AAEV1, SECRET);
  assert.strictEqual(result.valid, false, "[DER] verifyAAE returns invalid");
  assert.strictEqual(result.missing_expiry, true, "[DER] missing_expiry flagged");
  assert.match(result.reason!, /expiry/, "[DER] reason mentions expiry");
  console.log("  ✅ TEST 4 F1 DENY missing expiry — PASS");
}

// ─── TEST 5: F1 DENY — missing signature ───────────────────────────────────────
// DER: missing signature triggers F1 AMANAH DENY
async function test5_F1_DENY_missing_signature() {
  const opts = makeBase();
  const aae = await buildAAE(opts);
  const noSigAae: AAEV1 = { ...aae, signature: "" as any };

  const result = verifyAAE(noSigAae as AAEV1, SECRET);
  assert.strictEqual(result.valid, false, "[DER] verifyAAE returns invalid");
  assert.strictEqual(result.missing_signature, true, "[DER] missing_signature flagged");
  assert.match(result.reason!, /signature/, "[DER] reason mentions signature");
  console.log("  ✅ TEST 5 F1 DENY missing signature — PASS");
}

// ─── TEST 6: F8 DENY — expired AAE ────────────────────────────────────────────
// OBS: expired AAE triggers F8 LAW automatic DENY
async function test6_F8_DENY_expired() {
  const opts = makeBase();
  // Create AAE that expired 1 second ago
  const expiredAae = await buildAAE({ ...opts, expiry_ms: Date.now() - 1000 });

  const result = verifyAAE(expiredAae, SECRET);
  assert.strictEqual(result.valid, false, "[OBS] verifyAAE returns invalid for expired");
  assert.strictEqual(result.expired, true, "[OBS] expired flag set");
  assert.match(result.reason!, /F8 LAW/, "[OBS] reason mentions F8 LAW");
  assert.match(result.reason!, /expired/, "[OBS] reason mentions expired");
  console.log("  ✅ TEST 6 F8 DENY expired AAE — PASS");
}

// ─── TEST 7: tampered — wrong secret ──────────────────────────────────────────
// DER: signature fails timing-safe compare when wrong secret used
async function test7_tampered_wrong_secret() {
  const opts = makeBase();
  const aae = await buildAAE(opts);

  const result = verifyAAE(aae, "wrong-secret-!!!");
  assert.strictEqual(result.valid, false, "[DER] verifyAAE returns invalid with wrong secret");
  assert.strictEqual(result.reason, "F1 DENY: signature mismatch (possible tampering)", "[DER] reason = tampering");
  assert.strictEqual(result.epistemic, "DER", "[DER] epistemic label DER (derived from computation)");
  console.log("  ✅ TEST 7 tampered wrong secret — PASS");
}

// ─── BONUS TEST 8: extendAAE ─────────────────────────────────────────────────
// OBS: extendAAE preserves intent_hash, updates expiry + signature
async function test8_extendAAE() {
  const opts = makeBase();
  const original = await buildAAE(opts);
  const extended = extendAAE(original, 60_000, SECRET); // +60s

  assert.strictEqual(extended.intent_hash, original.intent_hash, "[OBS] intent_hash unchanged");
  assert.ok(extended.expiry > original.expiry, "[OBS] expiry extended");
  assert.notStrictEqual(extended.signature, original.signature, "[OBS] signature updated");

  const origResult = verifyAAE(original, SECRET);
  const extResult = verifyAAE(extended, SECRET);
  assert.strictEqual(origResult.valid, true, "[OBS] original still valid before expiry");
  assert.strictEqual(extResult.valid, true, "[OBS] extended still valid");
  console.log("  ✅ TEST 8 extendAAE — PASS");
}

// ─── BONUS TEST 9: computeIntentHash deterministic ───────────────────────────
// OBS: same intent always produces same BLAKE3 hash
async function test9_intent_hash_deterministic() {
  const h1 = await computeIntentHash("Deploy webapp");
  const h2 = await computeIntentHash("Deploy webapp");
  const h3 = await computeIntentHash("Deploy api");

  assert.strictEqual(h1, h2, "[OBS] identical intents → identical hashes");
  assert.notStrictEqual(h1, h3, "[OBS] different intents → different hashes");
  assert.strictEqual(h1.length, 64, "[OBS] BLAKE3 = 64 hex chars");
  console.log("  ✅ TEST 9 intent_hash deterministic — PASS");
}

// ─── Run all tests ─────────────────────────────────────────────────────────────

async function runAll() {
  console.log("\nAAE v1 — 7 test cases + 2 bonus\n");
  await test1_buildAAE_happy();
  await test2_verifyAAE_valid();
  await test3_F1_DENY_missing_actor_id();
  await test4_F1_DENY_missing_expiry();
  await test5_F1_DENY_missing_signature();
  await test6_F8_DENY_expired();
  await test7_tampered_wrong_secret();
  await test8_extendAAE();
  await test9_intent_hash_deterministic();
  console.log("\n🎉 All 9 tests PASSED\n");
}

runAll().catch((e) => {
  console.error("❌ Test suite FAILED:", e);
  process.exit(1);
});
