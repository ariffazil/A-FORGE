/**
 * @file forge_visual_qa_seal.test.ts — VAULT999 Composite Seal Validator Tests
 * @description Proves the 5 invariants + routing guard for visual seal.
 *
 * INVARIANTS:
 *   I1: No seal unless verdict === "SEALED_DEPLOY"
 *   I2: No seal unless w1 = w2 = w3 = "PASS"
 *   I3: No seal unless recomputed_hash === composite_hash
 *   I4: VAULT999 only stores composite_hash (never raw witness hashes)
 *   I5: Any mismatch → REJECTED (never partial seal)
 *
 * RUN: npx tsx test/forge_visual_qa_seal.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  computeCompositeHash,
  validateSealComposite,
  sealVisualComposite,
  routingGuardPreSeal,
  type SealVisualInput,
  type TriWitnessLedgerInput,
} from "../src/infrastructure/tools/ForgeVisualQASeal.js";

// ============================================================================
// HELPERS
// ============================================================================

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function makeWitness(verdict: "PASS" | "HOLD" | "FAIL", hash?: string) {
  return {
    verdict,
    hash: hash ?? sha256(`witness-${verdict}-${Date.now()}`),
    score: 0.90,
  };
}

function makeLedger(
  w1Verdict: "PASS" | "HOLD" | "FAIL" = "PASS",
  w2Verdict: "PASS" | "HOLD" | "FAIL" = "PASS",
  w3Verdict: "PASS" | "HOLD" | "FAIL" = "PASS",
  compositeHash?: string,
): TriWitnessLedgerInput {
  const w1 = makeWitness(w1Verdict);
  const w2 = makeWitness(w2Verdict);
  const w3 = makeWitness(w3Verdict);
  const correctHash = compositeHash ?? computeCompositeHash(w1.hash, w2.hash, w3.hash, "SEALED_DEPLOY");
  return { w1, w2, w3, composite_hash: correctHash };
}

function makeInput(
  verdict: "PASS_CANDIDATE" | "SEALED_DEPLOY" = "SEALED_DEPLOY",
  ledger?: TriWitnessLedgerInput,
): SealVisualInput {
  return {
    tri_witness_ledger: ledger ?? makeLedger(),
    verdict,
  };
}

// ============================================================================
// TEST: Composite Hash Computation
// ============================================================================

describe("Composite hash computation", () => {
  it("SHA256(w1 ‖ w2 ‖ w3 ‖ verdict) produces 64 hex chars", () => {
    const hash = computeCompositeHash(
      sha256("w1-data"),
      sha256("w2-data"),
      sha256("w3-data"),
      "SEALED_DEPLOY",
    );
    assert.match(hash, /^[a-f0-9]{64}$/);
  });

  it("deterministic — same inputs produce same hash", () => {
    const w1 = sha256("w1");
    const w2 = sha256("w2");
    const w3 = sha256("w3");
    const h1 = computeCompositeHash(w1, w2, w3, "SEALED_DEPLOY");
    const h2 = computeCompositeHash(w1, w2, w3, "SEALED_DEPLOY");
    assert.equal(h1, h2);
  });

  it("different verdict → different hash", () => {
    const w1 = sha256("w1");
    const w2 = sha256("w2");
    const w3 = sha256("w3");
    const h1 = computeCompositeHash(w1, w2, w3, "SEALED_DEPLOY");
    const h2 = computeCompositeHash(w1, w2, w3, "PASS_CANDIDATE");
    assert.notEqual(h1, h2);
  });

  it("different witness hash → different composite", () => {
    const w1a = sha256("w1-version-a");
    const w1b = sha256("w1-version-b");
    const w2 = sha256("w2");
    const w3 = sha256("w3");
    const h1 = computeCompositeHash(w1a, w2, w3, "SEALED_DEPLOY");
    const h2 = computeCompositeHash(w1b, w2, w3, "SEALED_DEPLOY");
    assert.notEqual(h1, h2);
  });
});

// ============================================================================
// I1: No seal unless verdict === "SEALED_DEPLOY"
// ============================================================================

describe("I1: No seal unless verdict === SEALED_DEPLOY", () => {
  it("PASS_CANDIDATE → REJECTED", () => {
    const result = validateSealComposite(makeInput("PASS_CANDIDATE"));
    assert.equal(result.valid, false);
    assert.ok(!result.valid && result.error.includes("I1_VIOLATION"));
  });

  it("SEALED_DEPLOY → passes I1 check", () => {
    const result = validateSealComposite(makeInput("SEALED_DEPLOY"));
    assert.equal(result.valid, true);
  });
});

// ============================================================================
// I2: No seal unless w1 = w2 = w3 = "PASS"
// ============================================================================

describe("I2: No seal unless all witnesses PASS", () => {
  it("w1 FAIL → REJECTED", () => {
    const ledger = makeLedger("FAIL", "PASS", "PASS");
    // Need to recompute hash for this combo
    ledger.composite_hash = computeCompositeHash(
      ledger.w1.hash, ledger.w2.hash, ledger.w3.hash, "SEALED_DEPLOY",
    );
    const result = validateSealComposite(makeInput("SEALED_DEPLOY", ledger));
    assert.equal(result.valid, false);
    assert.ok(!result.valid && result.error.includes("I2_VIOLATION"));
    assert.ok(!result.valid && result.error.includes("w1"));
  });

  it("w2 HOLD → REJECTED", () => {
    const ledger = makeLedger("PASS", "HOLD", "PASS");
    ledger.composite_hash = computeCompositeHash(
      ledger.w1.hash, ledger.w2.hash, ledger.w3.hash, "SEALED_DEPLOY",
    );
    const result = validateSealComposite(makeInput("SEALED_DEPLOY", ledger));
    assert.equal(result.valid, false);
    assert.ok(!result.valid && result.error.includes("w2"));
  });

  it("w3 FAIL → REJECTED", () => {
    const ledger = makeLedger("PASS", "PASS", "FAIL");
    ledger.composite_hash = computeCompositeHash(
      ledger.w1.hash, ledger.w2.hash, ledger.w3.hash, "SEALED_DEPLOY",
    );
    const result = validateSealComposite(makeInput("SEALED_DEPLOY", ledger));
    assert.equal(result.valid, false);
    assert.ok(!result.valid && result.error.includes("w3"));
  });

  it("all PASS → passes I2 check", () => {
    const result = validateSealComposite(makeInput("SEALED_DEPLOY"));
    assert.equal(result.valid, true);
  });
});

// ============================================================================
// I3: No seal unless recomputed hash === composite_hash
// ============================================================================

describe("I3: Composite hash integrity", () => {
  it("tampered composite_hash → REJECTED", () => {
    const ledger = makeLedger("PASS", "PASS", "PASS");
    // Tamper with composite hash
    ledger.composite_hash = sha256("tampered");
    const result = validateSealComposite(makeInput("SEALED_DEPLOY", ledger));
    assert.equal(result.valid, false);
    assert.ok(!result.valid && result.error.includes("I3_VIOLATION"));
    assert.ok(!result.valid && result.error.includes("mismatch"));
  });

  it("correct composite_hash → passes I3 check", () => {
    const result = validateSealComposite(makeInput("SEALED_DEPLOY"));
    assert.equal(result.valid, true);
  });
});

// ============================================================================
// I4: VAULT999 only stores composite_hash, never raw witness hashes
// ============================================================================

describe("I4: VAULT999 stores only composite_hash", () => {
  it("vault record contains composite_hash but NOT raw w1/w2/w3 hashes", async () => {
    let capturedRecord: Record<string, unknown> | null = null;

    const result = await sealVisualComposite(
      makeInput("SEALED_DEPLOY"),
      {
        vaultAppend: async (record) => {
          capturedRecord = record as Record<string, unknown>;
          return { seq: 42, receipt_id: "seal-42" };
        },
      },
    );

    assert.equal(result.verdict, "SEALED");
    assert.equal(result.sealed, true);
    assert.equal(result.vault_seq, 42);

    // I4: Record must have composite_hash
    assert.ok(capturedRecord);
    assert.ok(typeof capturedRecord!["composite_hash"] === "string");
    assert.match(capturedRecord!["composite_hash"] as string, /^[a-f0-9]{64}$/);

    // I4: Record must NOT have raw witness hashes
    assert.equal(capturedRecord!["w1_hash"], undefined, "Must not store raw w1 hash");
    assert.equal(capturedRecord!["w2_hash"], undefined, "Must not store raw w2 hash");
    assert.equal(capturedRecord!["w3_hash"], undefined, "Must not store raw w3 hash");

    // I4: Record has verdicts (not hashes) for witnesses
    assert.equal(capturedRecord!["w1_verdict"], "PASS");
    assert.equal(capturedRecord!["w2_verdict"], "PASS");
    assert.equal(capturedRecord!["w3_verdict"], "PASS");
  });
});

// ============================================================================
// I5: Any mismatch → REJECTED, never partial seal
// ============================================================================

describe("I5: Any mismatch → REJECTED, never partial seal", () => {
  it("vault append failure → REJECTED, not partial seal", async () => {
    const result = await sealVisualComposite(
      makeInput("SEALED_DEPLOY"),
      {
        vaultAppend: async () => {
          throw new Error("VAULT999 connection failed");
        },
      },
    );

    assert.equal(result.verdict, "REJECTED");
    assert.equal(result.sealed, false);
    assert.equal(result.vault_seq, -1);
    assert.ok(result.error.includes("VAULT_APPEND_FAILED"));
    assert.ok(result.rejection_reason?.includes("no partial state"));
  });

  it("I1 failure → REJECTED (not attempted seal)", async () => {
    let vaultCalled = false;
    const result = await sealVisualComposite(
      makeInput("PASS_CANDIDATE"),
      {
        vaultAppend: async () => {
          vaultCalled = true;
          return { seq: 99, receipt_id: "should-not-happen" };
        },
      },
    );

    assert.equal(result.verdict, "REJECTED");
    assert.equal(vaultCalled, false, "Vault must NOT be called when validation fails");
  });

  it("I3 failure → REJECTED (vault never called)", async () => {
    let vaultCalled = false;
    const ledger = makeLedger("PASS", "PASS", "PASS");
    ledger.composite_hash = sha256("wrong");

    const result = await sealVisualComposite(
      makeInput("SEALED_DEPLOY", ledger),
      {
        vaultAppend: async () => {
          vaultCalled = true;
          return { seq: 99, receipt_id: "should-not-happen" };
        },
      },
    );

    assert.equal(result.verdict, "REJECTED");
    assert.equal(vaultCalled, false, "Vault must NOT be called when hash mismatch");
  });
});

// ============================================================================
// ROUTING GUARD: W³ Gate Before Seal
// ============================================================================

describe("Routing guard: W³ gate before seal", () => {
  it("missing tri_witness_ledger → BLOCKED", () => {
    const result = routingGuardPreSeal({
      tri_witness_ledger: null,
      entropy_gate_passed: true,
      verdict: "PASS_CANDIDATE",
    });
    assert.equal(result.kind, "blocked");
    assert.ok(result.kind === "blocked" && result.reason.includes("W³_NOT_POPULATED"));
  });

  it("invalid w1 hash → BLOCKED", () => {
    const ledger = makeLedger();
    ledger.w1.hash = "not-a-hash";
    const result = routingGuardPreSeal({
      tri_witness_ledger: ledger,
      entropy_gate_passed: true,
      verdict: "PASS_CANDIDATE",
    });
    assert.equal(result.kind, "blocked");
    assert.ok(result.kind === "blocked" && result.reason.includes("W1_HASH_INVALID"));
  });

  it("invalid composite hash → BLOCKED", () => {
    const ledger = makeLedger();
    ledger.composite_hash = "invalid";
    const result = routingGuardPreSeal({
      tri_witness_ledger: ledger,
      entropy_gate_passed: true,
      verdict: "PASS_CANDIDATE",
    });
    assert.equal(result.kind, "blocked");
    assert.ok(result.kind === "blocked" && result.reason.includes("COMPOSITE_HASH_INVALID"));
  });

  it("entropy gate not passed → BLOCKED", () => {
    const result = routingGuardPreSeal({
      tri_witness_ledger: makeLedger(),
      entropy_gate_passed: false,
      verdict: "PASS_CANDIDATE",
    });
    assert.equal(result.kind, "blocked");
    assert.ok(result.kind === "blocked" && result.reason.includes("ENTROPY_GATE_NOT_PASSED"));
  });

  it("verdict not sealable → BLOCKED", () => {
    const result = routingGuardPreSeal({
      tri_witness_ledger: makeLedger(),
      entropy_gate_passed: true,
      verdict: "ITERATING",
    });
    assert.equal(result.kind, "blocked");
    assert.ok(result.kind === "blocked" && result.reason.includes("VERDICT_NOT_SEALABLE"));
  });

  it("all gates pass → ALLOWED", () => {
    const result = routingGuardPreSeal({
      tri_witness_ledger: makeLedger(),
      entropy_gate_passed: true,
      verdict: "PASS_CANDIDATE",
    });
    assert.equal(result.kind, "allowed");
  });

  it("SEALED_DEPLOY with all gates → ALLOWED", () => {
    const result = routingGuardPreSeal({
      tri_witness_ledger: makeLedger(),
      entropy_gate_passed: true,
      verdict: "SEALED_DEPLOY",
    });
    assert.equal(result.kind, "allowed");
  });
});
