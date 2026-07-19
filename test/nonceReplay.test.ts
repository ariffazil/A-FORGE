/**
 * NonceStore + AAE Replay Detection — Unit Tests
 *
 * Tests:
 *  [1] NonceStore: fresh nonce is not a replay
 *  [2] NonceStore: same nonce twice = replay
 *  [3] NonceStore: expired nonce is not a replay (TTL expiry)
 *  [4] NonceStore: isReplay check-only does not record
 *  [5] NonceStore: cleanup bounds memory
 *  [6] AAE verifyAAE with NonceStore: first use passes
 *  [7] AAE verifyAAE with NonceStore: second use = REPLAY_DETECTED
 *  [8] AAE verifyAAE without NonceStore: no replay check (backward compat)
 *  [9] McpPolicyGate: Layer 1b replay detection
 * [10] McpPolicyGate: Layer 5 replay detection (no organ_secret)
 * [11] McpPolicyGate: fresh nonce passes both layers
 *
 * F2 TRUTH: all claims labeled OBS/DER/INT/SPEC.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { NonceStore, globalNonceStore } from "../src/domain/governance/nonceStore.js";
import { buildAAE, verifyAAE, type AAEV1 } from "../src/domain/governance/amanahEnvelope.js";
import { McpPolicyGate } from "../src/domain/governance/McpPolicyGate.js";

const SECRET = "test-organ-secret-32bytes-long!!";

function makeBase() {
  return {
    actor_id: "arif",
    intent: "Deploy webapp to production",
    action_class: "OBSERVE" as const,
    reversibility: 0.3,
    blast_radius: "service" as const,
    evidence_refs: ["vault-001"],
    organ_secret: SECRET,
    issuer: "test-forge",
  };
}

// ─── TEST 1: fresh nonce is not a replay ─────────────────────────────────────
// OBS: a nonce seen for the first time is not a replay
function test1_fresh_nonce_not_replay() {
  const store = new NonceStore();
  const result = store.checkAndRecord("nonce-abc-123");
  assert.strictEqual(result.replay, false, "[OBS] fresh nonce is not a replay");
  assert.strictEqual(store.size, 1, "[OBS] nonce recorded in store");
  console.log("  ✅ TEST 1 fresh nonce not replay — PASS");
}

// ─── TEST 2: same nonce twice = replay ───────────────────────────────────────
// DER: checking the same nonce twice triggers replay detection
function test2_same_nonce_replay() {
  const store = new NonceStore();
  const first = store.checkAndRecord("nonce-replay-test");
  assert.strictEqual(first.replay, false, "[DER] first use is clean");

  const second = store.checkAndRecord("nonce-replay-test");
  assert.strictEqual(second.replay, true, "[DER] second use is replay");
  assert.match(second.reason!, /REPLAY_DETECTED/, "[DER] reason mentions REPLAY_DETECTED");
  assert.match(second.reason!, /nonce-replay-test/, "[DER] reason includes the nonce");
  console.log("  ✅ TEST 2 same nonce replay — PASS");
}

// ─── TEST 3: expired nonce is not a replay (TTL expiry) ─────────────────────
// OBS: after TTL expires, the same nonce can be reused
function test3_expired_nonce_not_replay() {
  // Use a very short TTL (1ms) for testing
  const store = new NonceStore(1);
  store.checkAndRecord("nonce-expire-test");

  // Wait for TTL to expire
  const start = Date.now();
  while (Date.now() - start < 5) { /* spin */ }

  const result = store.checkAndRecord("nonce-expire-test");
  assert.strictEqual(result.replay, false, "[OBS] expired nonce is not a replay");
  console.log("  ✅ TEST 3 expired nonce not replay — PASS");
}

// ─── TEST 4: isReplay check-only does not record ────────────────────────────
// OBS: isReplay is a read-only check
function test4_isReplay_no_record() {
  const store = new NonceStore();
  assert.strictEqual(store.isReplay("nonce-readonly"), false, "[OBS] unseen nonce is not replay");

  // After isReplay, the nonce should NOT be recorded
  const result = store.checkAndRecord("nonce-readonly");
  assert.strictEqual(result.replay, false, "[OBS] nonce not recorded by isReplay");
  console.log("  ✅ TEST 4 isReplay no record — PASS");
}

// ─── TEST 5: cleanup bounds memory ──────────────────────────────────────────
// OBS: cleanup removes expired entries
function test5_cleanup_bounds_memory() {
  const store = new NonceStore(1, 10); // 1ms TTL, max 10 entries
  for (let i = 0; i < 20; i++) {
    store.checkAndRecord(`nonce-cleanup-${i}`);
  }
  assert.ok(store.size <= 20, "[OBS] all nonces recorded before cleanup");

  // Wait for expiry
  const start = Date.now();
  while (Date.now() - start < 5) { /* spin */ }

  store.cleanup();
  assert.strictEqual(store.size, 0, "[OBS] all expired nonces cleaned up");
  console.log("  ✅ TEST 5 cleanup bounds memory — PASS");
}

// ─── TEST 6: AAE verifyAAE with NonceStore: first use passes ────────────────
// OBS: valid AAE with fresh nonce passes verification
async function test6_aae_first_use_passes() {
  const store = new NonceStore();
  const opts = makeBase();
  const aae = await buildAAE(opts);

  const result = verifyAAE(aae, SECRET, store);
  assert.strictEqual(result.valid, true, "[OBS] AAE valid on first use");
  assert.strictEqual(result.replay_detected, undefined, "[OBS] no replay flag");
  assert.strictEqual(store.size, 1, "[OBS] nonce recorded in store");
  console.log("  ✅ TEST 6 AAE first use passes — PASS");
}

// ─── TEST 7: AAE verifyAAE with NonceStore: second use = REPLAY_DETECTED ────
// DER: replaying the same AAE nonce is detected
async function test7_aae_second_use_replay() {
  const store = new NonceStore();
  const opts = makeBase();
  const aae = await buildAAE(opts);

  // First use — should pass
  const first = verifyAAE(aae, SECRET, store);
  assert.strictEqual(first.valid, true, "[DER] first use valid");

  // Second use — should be detected as replay
  const second = verifyAAE(aae, SECRET, store);
  assert.strictEqual(second.valid, false, "[DER] second use invalid");
  assert.strictEqual(second.replay_detected, true, "[DER] replay_detected flag set");
  assert.match(second.reason!, /REPLAY_DETECTED/, "[DER] reason mentions REPLAY_DETECTED");
  console.log("  ✅ TEST 7 AAE second use replay — PASS");
}

// ─── TEST 8: AAE verifyAAE without NonceStore: no replay check ──────────────
// OBS: backward compatibility — no NonceStore means no replay check
async function test8_aae_no_store_backward_compat() {
  const opts = makeBase();
  const aae = await buildAAE(opts);

  // Both uses should pass without a NonceStore
  const first = verifyAAE(aae, SECRET);
  assert.strictEqual(first.valid, true, "[OBS] first use valid without store");

  const second = verifyAAE(aae, SECRET);
  assert.strictEqual(second.valid, true, "[OBS] second use also valid without store");
  console.log("  ✅ TEST 8 AAE no store backward compat — PASS");
}

// ─── TEST 9: McpPolicyGate Layer 1b replay detection ────────────────────────
// DER: McpPolicyGate rejects replayed AAE at Layer 1b
async function test9_policy_gate_layer1b_replay() {
  const store = new NonceStore();
  const gate = new McpPolicyGate(store);
  // Add a permissive policy for the test actor
  gate.addPolicy({
    policy_id: "test:arif",
    actor_id: "arif",
    role: "sovereign",
    allow_by_default: true,
    allowed_mcp_servers: {
      forge: { allow: true, tools: {} },
    },
  });
  const opts = makeBase();
  const aae = await buildAAE(opts);

  // First call — should ALLOW
  const first = gate.evaluate({
    actor_id: "arif",
    tool_name: "forge_probe",
    arguments: {},
    aae,
    organ_secret: SECRET,
  });
  assert.strictEqual(first.verdict, "ALLOW", `[DER] first call ALLOW (got ${first.verdict}: ${first.reasons.join(", ")})`);

  // Second call with same AAE — should DENY with REPLAY_DETECTED
  const second = gate.evaluate({
    actor_id: "arif",
    tool_name: "forge_probe",
    arguments: {},
    aae,
    organ_secret: SECRET,
  });
  assert.strictEqual(second.verdict, "DENY", "[DER] second call DENY");
  assert.ok(
    second.reasons.some(r => r.includes("REPLAY_DETECTED")),
    "[DER] reason includes REPLAY_DETECTED"
  );
  console.log("  ✅ TEST 9 PolicyGate Layer 1b replay — PASS");
}

// ─── TEST 10: McpPolicyGate Layer 5 replay detection (no organ_secret) ─────
// DER: when no organ_secret, Layer 5 catches replay
async function test10_policy_gate_layer5_replay() {
  const store = new NonceStore();
  const gate = new McpPolicyGate(store);
  gate.addPolicy({
    policy_id: "test:arif",
    actor_id: "arif",
    role: "sovereign",
    allow_by_default: true,
    allowed_mcp_servers: {
      forge: { allow: true, tools: {} },
    },
  });
  const opts = makeBase();
  const aae = await buildAAE(opts);

  // First call without organ_secret — Layer 1b skips AAE verify, Layer 5 checks nonce
  const first = gate.evaluate({
    actor_id: "arif",
    tool_name: "forge_probe",
    arguments: {},
    aae,
    // no organ_secret
  });
  assert.strictEqual(first.verdict, "ALLOW", `[DER] first call ALLOW (got ${first.verdict}: ${first.reasons.join(", ")})`);

  // Second call — Layer 5 should catch replay
  const second = gate.evaluate({
    actor_id: "arif",
    tool_name: "forge_probe",
    arguments: {},
    aae,
    // no organ_secret
  });
  assert.strictEqual(second.verdict, "DENY", "[DER] second call DENY at Layer 5");
  assert.ok(
    second.reasons.some(r => r.includes("REPLAY_DETECTED")),
    "[DER] reason includes REPLAY_DETECTED at Layer 5"
  );
  console.log("  ✅ TEST 10 PolicyGate Layer 5 replay — PASS");
}

// ─── TEST 11: McpPolicyGate fresh nonce passes both layers ──────────────────
// OBS: different AAEs (different nonces) each pass independently
async function test11_policy_gate_fresh_nonces_pass() {
  const store = new NonceStore();
  const gate = new McpPolicyGate(store);
  gate.addPolicy({
    policy_id: "test:arif",
    actor_id: "arif",
    role: "sovereign",
    allow_by_default: true,
    allowed_mcp_servers: {
      forge: { allow: true, tools: {} },
    },
  });

  // Create two different AAEs (different nonces)
  const aae1 = await buildAAE({ ...makeBase(), intent: "Action 1" });
  const aae2 = await buildAAE({ ...makeBase(), intent: "Action 2" });

  const r1 = gate.evaluate({
    actor_id: "arif",
    tool_name: "forge_probe",
    arguments: {},
    aae: aae1,
    organ_secret: SECRET,
  });
  assert.strictEqual(r1.verdict, "ALLOW", "[OBS] first AAE passes");

  const r2 = gate.evaluate({
    actor_id: "arif",
    tool_name: "forge_probe",
    arguments: {},
    aae: aae2,
    organ_secret: SECRET,
  });
  assert.strictEqual(r2.verdict, "ALLOW", "[OBS] second AAE (different nonce) passes");
  console.log("  ✅ TEST 11 PolicyGate fresh nonces pass — PASS");
}

// ─── Run all tests ───────────────────────────────────────────────────────────

async function runAll() {
  console.log("\nNonceStore + AAE Replay Detection — 11 tests\n");
  test1_fresh_nonce_not_replay();
  test2_same_nonce_replay();
  test3_expired_nonce_not_replay();
  test4_isReplay_no_record();
  test5_cleanup_bounds_memory();
  await test6_aae_first_use_passes();
  await test7_aae_second_use_replay();
  await test8_aae_no_store_backward_compat();
  await test9_policy_gate_layer1b_replay();
  await test10_policy_gate_layer5_replay();
  await test11_policy_gate_fresh_nonces_pass();
  console.log("\n🎉 All 11 NonceStore + Replay Detection tests PASSED\n");
}

runAll().catch((e) => {
  console.error("❌ Test suite FAILED:", e);
  process.exit(1);
});
