/**
 * Judgment Reference — Unit Tests
 *
 * Ensures ExecutorReceipt.judgment_reference and AAEV1.judgment_reference
 * are validated correctly. An execution receipt without a judgment_reference
 * cannot prove which judgment authorized it — must hard-fail.
 *
 * Test cases:
 *  [1] validateReceipt — missing judgment_reference → violation
 *  [2] validateReceipt — present judgment_reference → passes
 *  [3] forgeExecute   — missing judgment_reference → REFUSED
 *  [4] AAEV1 buildAAE — judgment_reference set on envelope
 *  [5] AAEV1 computeSignature — judgment_reference included in HMAC body
 *  [6] McpPolicyGate  — EXECUTE_HIGH_IMPACT without judgment_reference → DENY
 *  [7] McpPolicyGate  — EXECUTE_HIGH_IMPACT with judgment_reference → ALLOW
 *  [8] McpPolicyGate  — IRREVERSIBLE without judgment_reference → DENY
 *  [9] McpPolicyGate  — low-severity (OBSERVE) without judgment_reference → ALLOW
 *  [10] AAEV1 extendAAE — judgment_reference preserved
 *
 * F2 TRUTH: all claims labeled OBS/DER/INT/SPEC in test names.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  validateReceipt,
  forgeExecute,
} from "../src/executor/forge.js";
import type { ExecutorReceipt } from "../src/executor/types.js";
import {
  buildAAE,
  verifyAAE,
  computeSignature,
  extendAAE,
  type AAEV1,
} from "../src/domain/governance/amanahEnvelope.js";
import { McpPolicyGate } from "../src/domain/governance/McpPolicyGate.js";

const SECRET = "test-judgment-ref-secret-32bytes!!";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeReceipt(overrides?: Partial<ExecutorReceipt>): ExecutorReceipt {
  return {
    receiptId: "rcpt-001",
    kernelSignature: "kern-sig-abc123",
    verdict: "SEAL",
    ccId: "cc-2026-07-18-001",
    judgment_reference: "verdict-888-seal-001",
    allowedActions: ["forge_deploy"],
    toolName: "forge_deploy",
    inputHash: "blake3-input-hash",
    bounds: {
      reversible: true,
      blastRadius: "MEDIUM",
      maxTools: 5,
    },
    authority: {
      actorId: "arif",
      sessionId: "sess-001",
      validUntil: new Date(Date.now() + 300_000).toISOString(),
      scope: "EXECUTE",
    },
    lineage: {
      evidenceIds: ["vault-e-001"],
      collapseTimestamp: new Date().toISOString(),
    },
    ...overrides,
  };
}

// ── TEST 1: validateReceipt — missing judgment_reference ─────────────────────
// OBS: missing judgment_reference produces a validation violation
function test1_missing_judgment_reference() {
  const receipt = makeReceipt({ judgment_reference: "" });
  const result = validateReceipt(receipt);

  assert.strictEqual(result.valid, false, "[OBS] receipt without judgment_reference is invalid");
  assert.ok(
    result.violations.some((v) => v.includes("judgment_reference")),
    "[OBS] violation mentions judgment_reference",
  );
  console.log("  ✅ TEST 1 missing judgment_reference → violation — PASS");
}

// ── TEST 2: validateReceipt — present judgment_reference ─────────────────────
// OBS: receipt with judgment_reference passes validation
function test2_present_judgment_reference() {
  const receipt = makeReceipt();
  const result = validateReceipt(receipt);

  assert.strictEqual(result.valid, true, "[OBS] receipt with judgment_reference is valid");
  assert.strictEqual(result.violations.length, 0, "[OBS] no violations");
  console.log("  ✅ TEST 2 present judgment_reference → valid — PASS");
}

// ── TEST 3: forgeExecute — missing judgment_reference → REFUSED ──────────────
// DER: forgeExecute refuses execution when judgment_reference is missing
async function test3_forgeExecute_refuses_missing_judgment_reference() {
  const receipt = makeReceipt({ judgment_reference: "" });
  const report = await forgeExecute(receipt);

  assert.strictEqual(report.summary.verdict, "REFUSED", "[DER] verdict is REFUSED");
  assert.ok(
    report.refusalReasons!.some((r) => r.includes("judgment_reference")),
    "[DER] refusal reason mentions judgment_reference",
  );
  console.log("  ✅ TEST 3 forgeExecute REFUSED without judgment_reference — PASS");
}

// ── TEST 4: AAEV1 buildAAE — judgment_reference set on envelope ──────────────
// OBS: buildAAE propagates judgment_reference to the envelope
async function test4_AAEV1_buildAAE_judgment_reference() {
  const aae = await buildAAE({
    actor_id: "arif",
    intent: "deploy webapp",
    action_class: "EXECUTE_HIGH_IMPACT",
    reversibility: 0.3,
    blast_radius: "service",
    organ_secret: SECRET,
    judgment_reference: "verdict-888-seal-002",
  });

  assert.strictEqual(aae.judgment_reference, "verdict-888-seal-002", "[OBS] judgment_reference propagated");
  console.log("  ✅ TEST 4 AAEV1 buildAAE judgment_reference — PASS");
}

// ── TEST 5: AAEV1 computeSignature — judgment_reference in HMAC body ─────────
// DER: changing judgment_reference invalidates the signature
async function test5_judgment_reference_in_signature() {
  const aae = await buildAAE({
    actor_id: "arif",
    intent: "deploy api",
    action_class: "EXECUTE_HIGH_IMPACT",
    reversibility: 0.5,
    blast_radius: "repo",
    organ_secret: SECRET,
    judgment_reference: "verdict-001",
  });

  // Verify with correct judgment_reference
  const validResult = verifyAAE(aae, SECRET);
  assert.strictEqual(validResult.valid, true, "[DER] original envelope valid");

  // Tamper: change judgment_reference
  const tampered: AAEV1 = { ...aae, judgment_reference: "verdict-999" };
  const tamperedResult = verifyAAE(tampered, SECRET);
  assert.strictEqual(tamperedResult.valid, false, "[DER] tampered judgment_reference invalidates signature");
  assert.match(tamperedResult.reason!, /signature/, "[DER] reason mentions signature mismatch");

  console.log("  ✅ TEST 5 judgment_reference in HMAC body — PASS");
}

// ── TEST 6: McpPolicyGate — EXECUTE_HIGH_IMPACT without judgment_reference ──
// DER: high-severity AAE without judgment_reference is DENY
async function test6_McpPolicyGate_high_impact_no_judgment_ref() {
  const gate = new McpPolicyGate();
  gate.setActor("arif");

  const aae = await buildAAE({
    actor_id: "arif",
    intent: "deploy webapp",
    action_class: "EXECUTE_HIGH_IMPACT",
    reversibility: 0.3,
    blast_radius: "service",
    organ_secret: SECRET,
    // no judgment_reference
  });

  const result = gate.evaluate({
    actor_id: "arif",
    tool_name: "forge_execute",
    arguments: {},
    aae,
    organ_secret: SECRET,
  });

  assert.strictEqual(result.verdict, "DENY", "[DER] DENY without judgment_reference");
  assert.ok(
    result.reasons.some((r) => r.includes("judgment_reference")),
    "[DER] reason mentions judgment_reference",
  );
  console.log("  ✅ TEST 6 McpPolicyGate EXECUTE_HIGH_IMPACT no judgment_ref → DENY — PASS");
}

// ── TEST 7: McpPolicyGate — EXECUTE_HIGH_IMPACT with judgment_reference ──────
// OBS: high-severity AAE with judgment_reference passes L5
async function test7_McpPolicyGate_high_impact_with_judgment_ref() {
  const gate = new McpPolicyGate();
  gate.setActor("arif");

  const aae = await buildAAE({
    actor_id: "arif",
    intent: "deploy webapp",
    action_class: "EXECUTE_HIGH_IMPACT",
    reversibility: 0.3,
    blast_radius: "service",
    organ_secret: SECRET,
    judgment_reference: "verdict-888-seal-003",
  });

  const result = gate.evaluate({
    actor_id: "arif",
    tool_name: "forge_execute",
    arguments: {},
    aae,
    organ_secret: SECRET,
  });

  assert.strictEqual(result.verdict, "ALLOW", "[OBS] ALLOW with judgment_reference");
  console.log("  ✅ TEST 7 McpPolicyGate EXECUTE_HIGH_IMPACT with judgment_ref → ALLOW — PASS");
}

// ── TEST 8: McpPolicyGate — IRREVERSIBLE without judgment_reference ──────────
// DER: IRREVERSIBLE action without judgment_reference is DENY
async function test8_McpPolicyGate_irreversible_no_judgment_ref() {
  const gate = new McpPolicyGate();
  gate.setActor("arif");

  const aae = await buildAAE({
    actor_id: "arif",
    intent: "delete production database",
    action_class: "IRREVERSIBLE",
    reversibility: 0.0,
    blast_radius: "federation",
    organ_secret: SECRET,
    // no judgment_reference
  });

  const result = gate.evaluate({
    actor_id: "arif",
    tool_name: "forge_shell",
    arguments: { command: "rm -rf /data" },
    aae,
    organ_secret: SECRET,
  });

  assert.strictEqual(result.verdict, "DENY", "[DER] DENY IRREVERSIBLE without judgment_reference");
  assert.ok(
    result.reasons.some((r) => r.includes("judgment_reference")),
    "[DER] reason mentions judgment_reference",
  );
  console.log("  ✅ TEST 8 McpPolicyGate IRREVERSIBLE no judgment_ref → DENY — PASS");
}

// ── TEST 9: McpPolicyGate — low-severity (OBSERVE) without judgment_reference
// OBS: low-severity actions do NOT require judgment_reference
async function test9_McpPolicyGate_observe_no_judgment_ref() {
  const gate = new McpPolicyGate();
  gate.setActor("arif");

  const aae = await buildAAE({
    actor_id: "arif",
    intent: "read logs",
    action_class: "OBSERVE",
    reversibility: 1.0,
    blast_radius: "local",
    organ_secret: SECRET,
    // no judgment_reference — OK for OBSERVE
  });

  const result = gate.evaluate({
    actor_id: "arif",
    tool_name: "forge_memory",
    arguments: {},
    aae,
    organ_secret: SECRET,
  });

  assert.strictEqual(result.verdict, "ALLOW", "[OBS] ALLOW OBSERVE without judgment_reference");
  console.log("  ✅ TEST 9 McpPolicyGate OBSERVE no judgment_ref → ALLOW — PASS");
}

// ── TEST 10: AAEV1 extendAAE — judgment_reference preserved ─────────────────
// OBS: extendAAE carries judgment_reference through the extension
async function test10_extendAAE_preserves_judgment_reference() {
  const aae = await buildAAE({
    actor_id: "arif",
    intent: "deploy webapp",
    action_class: "EXECUTE_HIGH_IMPACT",
    reversibility: 0.3,
    blast_radius: "service",
    organ_secret: SECRET,
    judgment_reference: "verdict-888-seal-004",
  });

  const extended = extendAAE(aae, 60_000, SECRET);

  assert.strictEqual(extended.judgment_reference, "verdict-888-seal-004", "[OBS] judgment_reference preserved in extension");
  assert.strictEqual(extended.intent_hash, aae.intent_hash, "[OBS] intent_hash unchanged");

  // Verify extended is still valid
  const result = verifyAAE(extended, SECRET);
  assert.strictEqual(result.valid, true, "[OBS] extended envelope still valid");
  console.log("  ✅ TEST 10 extendAAE preserves judgment_reference — PASS");
}

// ── Run all tests ────────────────────────────────────────────────────────────

async function runAll() {
  console.log("\nJudgment Reference — 10 test cases\n");
  test1_missing_judgment_reference();
  test2_present_judgment_reference();
  await test3_forgeExecute_refuses_missing_judgment_reference();
  await test4_AAEV1_buildAAE_judgment_reference();
  await test5_judgment_reference_in_signature();
  await test6_McpPolicyGate_high_impact_no_judgment_ref();
  await test7_McpPolicyGate_high_impact_with_judgment_ref();
  await test8_McpPolicyGate_irreversible_no_judgment_ref();
  await test9_McpPolicyGate_observe_no_judgment_ref();
  await test10_extendAAE_preserves_judgment_reference();
  console.log("\n🎉 All 10 judgment_reference tests PASSED\n");
}

runAll().catch((e) => {
  console.error("❌ Test suite FAILED:", e);
  process.exit(1);
});
