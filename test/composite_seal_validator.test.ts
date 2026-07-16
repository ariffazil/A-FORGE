/**
 * @file composite_seal_validator.test.ts — VAULT999 Composite Seal Validator Tests
 * @description 10 tests proving the pre-seal gate correctly accepts/rejects.
 *
 * RUN: npx tsx test/composite_seal_validator.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  validateCompositeSeal,
  computeCompositeHash,
  type TriWitnessSealInput,
} from "../src/infrastructure/tools/CompositeSealValidator.js";

// ============================================================================
// HELPERS
// ============================================================================

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Valid 64-char hex hashes for witnesses */
const W1_HASH = sha256("w1-vision-scan-payload");
const W2_HASH = sha256("w2-linter-scan-payload");
const W3_HASH = sha256("w3-sovereign-scan-payload");

function makeValidInput(): TriWitnessSealInput {
  const verdict = "SEALED_DEPLOY";
  const composite_hash = computeCompositeHash(W1_HASH, W2_HASH, W3_HASH, verdict);
  return {
    w1: { verdict: "PASS", hash: W1_HASH },
    w2: { verdict: "PASS", hash: W2_HASH },
    w3: {
      verdict: "PASS",
      hash: W3_HASH,
      actor_id: "arif-sovereign",
      timestamp: "2026-07-17T12:00:00.000Z",
    },
    verdict,
    composite_hash,
  };
}

function makeVaultAppend(seq: number = 42) {
  return async (_record: unknown) => ({ seq });
}

// ============================================================================
// TESTS
// ============================================================================

describe("CompositeSealValidator", () => {

  // ── TEST 1: VALID SEAL → SEALED ──────────────────────────────
  it("VALID SEAL: all PASS, correct hash → SEALED", async () => {
    const input = makeValidInput();
    const { result, error } = await validateCompositeSeal(input, {
      vault999Append: makeVaultAppend(1),
    });

    assert.equal(result.verdict, "SEALED");
    assert.equal(result.sealed, true);
    assert.equal(result.vault_seq, 1);
    assert.equal(error, undefined);
  });

  // ── TEST 2: REJECT — verdict not SEALED_DEPLOY ───────────────
  it("REJECT: verdict not SEALED_DEPLOY", async () => {
    const input = makeValidInput();
    input.verdict = "PASS_CANDIDATE";
    // Recompute hash with the wrong verdict so hash check doesn't interfere
    input.composite_hash = computeCompositeHash(W1_HASH, W2_HASH, W3_HASH, "PASS_CANDIDATE");

    const { result, error } = await validateCompositeSeal(input, {
      vault999Append: makeVaultAppend(),
    });

    assert.equal(result.verdict, "REJECTED");
    assert.equal(result.sealed, false);
    assert.equal(result.vault_seq, -1);
    assert.equal(error?.reason, "INVALID_VERDICT");
    assert.ok(error?.detail.includes("PASS_CANDIDATE"));
  });

  // ── TEST 3: REJECT — w1.verdict = HOLD ───────────────────────
  it("REJECT: w1.verdict = HOLD (not PASS)", async () => {
    const input = makeValidInput();
    input.w1.verdict = "HOLD";
    // Recompute so hash check passes, isolating the verdict check
    input.composite_hash = computeCompositeHash(W1_HASH, W2_HASH, W3_HASH, input.verdict);

    const { result, error } = await validateCompositeSeal(input, {
      vault999Append: makeVaultAppend(),
    });

    assert.equal(result.verdict, "REJECTED");
    assert.equal(error?.reason, "WITNESS_NOT_PASS");
    assert.ok(error?.detail.includes("w1"));
    assert.ok(error?.detail.includes("HOLD"));
  });

  // ── TEST 4: REJECT — w2.verdict = FAIL ───────────────────────
  it("REJECT: w2.verdict = FAIL", async () => {
    const input = makeValidInput();
    input.w2.verdict = "FAIL";
    input.composite_hash = computeCompositeHash(W1_HASH, W2_HASH, W3_HASH, input.verdict);

    const { result, error } = await validateCompositeSeal(input, {
      vault999Append: makeVaultAppend(),
    });

    assert.equal(result.verdict, "REJECTED");
    assert.equal(error?.reason, "WITNESS_NOT_PASS");
    assert.ok(error?.detail.includes("w2"));
    assert.ok(error?.detail.includes("FAIL"));
  });

  // ── TEST 5: REJECT — w3.verdict = PENDING ────────────────────
  it("REJECT: w3.verdict = PENDING (not PASS)", async () => {
    const input = makeValidInput();
    input.w3.verdict = "PENDING";
    input.composite_hash = computeCompositeHash(W1_HASH, W2_HASH, W3_HASH, input.verdict);

    const { result, error } = await validateCompositeSeal(input, {
      vault999Append: makeVaultAppend(),
    });

    assert.equal(result.verdict, "REJECTED");
    assert.equal(error?.reason, "WITNESS_NOT_PASS");
    assert.ok(error?.detail.includes("w3"));
    assert.ok(error?.detail.includes("PENDING"));
  });

  // ── TEST 6: REJECT — composite_hash tampered (1 char) ────────
  it("REJECT: composite_hash tampered (1 char changed)", async () => {
    const input = makeValidInput();
    // Flip last hex char
    const lastChar = input.composite_hash[input.composite_hash.length - 1];
    const flipped = lastChar === "a" ? "b" : "a";
    input.composite_hash = input.composite_hash.slice(0, -1) + flipped;

    const { result, error } = await validateCompositeSeal(input, {
      vault999Append: makeVaultAppend(),
    });

    assert.equal(result.verdict, "REJECTED");
    assert.equal(error?.reason, "COMPOSITE_HASH_TAMPERED");
    assert.ok(error?.detail.includes("recomputed="));
    assert.ok(error?.detail.includes("provided="));
  });

  // ── TEST 7: REJECT — w1.hash invalid format ──────────────────
  it("REJECT: w1.hash invalid format (not 64 hex chars)", async () => {
    const input = makeValidInput();
    input.w1.hash = "not-a-valid-hash"; // too short, not hex
    // Need to provide composite_hash that would match if w1.hash were valid
    // But Zod will catch this first
    input.composite_hash = computeCompositeHash("not-a-valid-hash", W2_HASH, W3_HASH, input.verdict);

    const { result, error } = await validateCompositeSeal(input, {
      vault999Append: makeVaultAppend(),
    });

    assert.equal(result.verdict, "REJECTED");
    // Zod catches the invalid regex first
    assert.equal(error?.reason, "ZOD_VALIDATION_FAILED");
  });

  // ── TEST 8: REJECT — w3 missing actor_id ─────────────────────
  it("REJECT: w3 missing actor_id", async () => {
    const input = makeValidInput();
    input.w3.actor_id = undefined;
    // Recompute — hash still valid since w3.hash unchanged
    input.composite_hash = computeCompositeHash(W1_HASH, W2_HASH, W3_HASH, input.verdict);

    const { result, error } = await validateCompositeSeal(input, {
      vault999Append: makeVaultAppend(),
    });

    assert.equal(result.verdict, "REJECTED");
    assert.equal(error?.reason, "W3_MISSING_ACTOR_ID");
  });

  // ── TEST 9: REJECT — w3 missing timestamp ────────────────────
  it("REJECT: w3 missing timestamp", async () => {
    const input = makeValidInput();
    input.w3.timestamp = undefined;
    input.composite_hash = computeCompositeHash(W1_HASH, W2_HASH, W3_HASH, input.verdict);

    const { result, error } = await validateCompositeSeal(input, {
      vault999Append: makeVaultAppend(),
    });

    assert.equal(result.verdict, "REJECTED");
    assert.equal(error?.reason, "W3_MISSING_TIMESTAMP");
  });

  // ── TEST 10: ANTI-COLLUSION — w1 tries to forge w3 fields ────
  it("ANTI-COLLUSION: w1 tries to forge w3 fields → rejected", async () => {
    const input = makeValidInput();

    // Attack: w1 includes forged w3 data in its own hash, hoping the validator
    // reads w3 fields from w1's payload instead of the actual w3 object.
    // The validator checks w3.verdict independently — it does NOT derive w3
    // state from w1's hash. So if w3.verdict is not PASS, it rejects.
    input.w3.verdict = "FAIL"; // w3 actually fails
    // But w1's hash was computed with the assumption w3 would pass
    // (i.e., w1 "colluded" to make composite_hash look valid)
    input.w1.hash = sha256("w1-colluding-hash-with-forged-w3-data");
    // Recompute composite with the actual (failing) w3 state
    input.composite_hash = computeCompositeHash(input.w1.hash, W2_HASH, W3_HASH, input.verdict);

    const { result, error } = await validateCompositeSeal(input, {
      vault999Append: makeVaultAppend(),
    });

    // Must reject because w3.verdict is checked INDEPENDENTLY
    assert.equal(result.verdict, "REJECTED");
    assert.equal(error?.reason, "WITNESS_NOT_PASS");
    assert.ok(error?.detail.includes("w3"));
    assert.ok(error?.detail.includes("FAIL"));
  });

});
