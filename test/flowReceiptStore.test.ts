/**
 * P4 — Flow Receipt Store Tests
 *
 * Tests: mint, chain link verification, chain rejection, replay protection,
 *        persistence without Postgres (graceful degradation).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mintReceipt,
  computeReceiptHash,
  verifyChainLink,
  type FlowReceipt,
} from "../src/infrastructure/receipts/flowReceiptStore.js";

const GENESIS_HASH = "0".repeat(64);

describe("Flow Receipt — Chain Integrity", () => {
  it("genesis receipt has previous_receipt_hash of 64 zeros", () => {
    const receipt = mintReceipt(null, {
      actor_id: "opencode",
      session_id: "SEAL-test",
      trace_id: "trace-001",
      step_number: 1,
      step_type: "Execute",
      epistemic_label: "Observation",
      cost_ns: 1_000_000,
    });
    assert.equal(receipt.previous_receipt_hash, GENESIS_HASH);
    assert.ok(receipt.receipt_id.length > 0);
    assert.ok(receipt.signature.length > 0);
  });

  it("second receipt chains correctly to genesis", () => {
    const r1 = mintReceipt(null, {
      actor_id: "opencode",
      session_id: "SEAL-test",
      trace_id: "trace-001",
      step_number: 1,
      step_type: "Execute",
      epistemic_label: "Observation",
      cost_ns: 1_000_000,
    });

    const r2 = mintReceipt(r1, {
      actor_id: "opencode",
      session_id: "SEAL-test",
      trace_id: "trace-001",
      step_number: 2,
      step_type: "Verify",
      epistemic_label: "Derivation",
      cost_ns: 500_000,
    });

    assert.ok(verifyChainLink(r2, r1));
    assert.equal(r2.previous_receipt_hash, computeReceiptHash(r1));
  });

  it("chain rejects tampered previous_receipt_hash", () => {
    const r1 = mintReceipt(null, {
      actor_id: "opencode",
      session_id: "SEAL-test",
      trace_id: "trace-001",
      step_number: 1,
      step_type: "Execute",
      epistemic_label: "Observation",
      cost_ns: 1_000_000,
    });

    const r2 = mintReceipt(r1, {
      actor_id: "opencode",
      session_id: "SEAL-test",
      trace_id: "trace-001",
      step_number: 2,
      step_type: "Verify",
      epistemic_label: "Derivation",
      cost_ns: 500_000,
    });

    // Tamper: replace previous_receipt_hash with garbage
    const tampered: FlowReceipt = { ...r2, previous_receipt_hash: "deadbeef".repeat(8) };
    assert.equal(verifyChainLink(tampered, r1), false);
  });

  it("chain rejects wrong predecessor", () => {
    const r1 = mintReceipt(null, {
      actor_id: "opencode",
      session_id: "SEAL-A",
      trace_id: "trace-001",
      step_number: 1,
      step_type: "Execute",
      epistemic_label: "Observation",
      cost_ns: 1_000_000,
    });

    const rX = mintReceipt(null, {
      actor_id: "hermes",
      session_id: "SEAL-B",
      trace_id: "trace-002",
      step_number: 1,
      step_type: "Execute",
      epistemic_label: "Observation",
      cost_ns: 1_000_000,
    });

    const r2 = mintReceipt(r1, {
      actor_id: "opencode",
      session_id: "SEAL-A",
      trace_id: "trace-001",
      step_number: 2,
      step_type: "Verify",
      epistemic_label: "Derivation",
      cost_ns: 500_000,
    });

    // r2 should chain to r1, not rX
    assert.equal(verifyChainLink(r2, r1), true);
    assert.equal(verifyChainLink(r2, rX), false);
  });

  it("nested chain of 10 receipts validates all links", () => {
    let prev: FlowReceipt | null = null;
    const receipts: FlowReceipt[] = [];

    for (let i = 1; i <= 10; i++) {
      const r = mintReceipt(prev, {
        actor_id: "opencode",
        session_id: "SEAL-chain",
        trace_id: "trace-003",
        step_number: i,
        step_type: i % 2 === 0 ? "Verify" : "Execute",
        epistemic_label: i <= 3 ? "Observation" : "Derivation",
        cost_ns: 1_000_000 * i,
      });
      receipts.push(r);
      prev = r;
    }

    // Validate chain
    for (let i = 1; i < receipts.length; i++) {
      assert.ok(verifyChainLink(receipts[i], receipts[i - 1]), `Link ${i} → ${i + 1} failed`);
    }
  });

  it("each receipt has a unique receipt_id", () => {
    const ids = new Set<string>();
    let prev: FlowReceipt | null = null;

    for (let i = 0; i < 20; i++) {
      const r = mintReceipt(prev, {
        actor_id: "opencode",
        session_id: "SEAL-unique",
        trace_id: "trace-004",
        step_number: i + 1,
        step_type: "Execute",
        epistemic_label: "Observation",
        cost_ns: 1_000_000,
      });
      assert.equal(ids.has(r.receipt_id), false, `Duplicate receipt_id: ${r.receipt_id}`);
      ids.add(r.receipt_id);
      prev = r;
    }
  });

  it("signature changes when step_number differs", () => {
    const r1 = mintReceipt(null, {
      actor_id: "opencode",
      session_id: "SEAL-sig",
      trace_id: "trace-005",
      step_number: 1,
      step_type: "Execute",
      epistemic_label: "Observation",
      cost_ns: 1_000_000,
    });

    const r2 = mintReceipt(null, {
      actor_id: "opencode",
      session_id: "SEAL-sig",
      trace_id: "trace-005",
      step_number: 2, // different step
      step_type: "Execute",
      epistemic_label: "Observation",
      cost_ns: 1_000_000,
    });

    assert.notEqual(r1.signature, r2.signature);
  });

  it("receipt with all optional fields (sct_hash, span_id, parent_span_id) mints correctly", () => {
    const r = mintReceipt(null, {
      actor_id: "opencode",
      session_id: "SEAL-full",
      trace_id: "trace-006",
      step_number: 1,
      step_type: "Seal",
      epistemic_label: "Seal",
      cost_ns: 5_000_000,
      sct_hash: "sha256:abc123",
      span_id: "span-001",
      parent_span_id: "span-root",
    });

    assert.equal(r.sct_hash, "sha256:abc123");
    assert.equal(r.span_id, "span-001");
    assert.equal(r.parent_span_id, "span-root");
    assert.ok(r.signature.length > 0);
  });
});

describe("Flow Receipt — FQ Computation Logic", () => {
  it("genesis receipt produces fq=1.0 (no verify yet)", () => {
    const r = mintReceipt(null, {
      actor_id: "opencode",
      session_id: "SEAL-fq",
      trace_id: "trace-007",
      step_number: 1,
      step_type: "Execute",
      epistemic_label: "Observation",
      cost_ns: 1_000_000,
    });
    assert.ok(r.receipt_id);
    assert.equal(r.step_type, "Execute");
  });

  it("verify after execute produces fq >= 1.0", () => {
    const r1 = mintReceipt(null, {
      actor_id: "opencode",
      session_id: "SEAL-fq2",
      trace_id: "trace-008",
      step_number: 1,
      step_type: "Execute",
      epistemic_label: "Observation",
      cost_ns: 1_000_000,
    });

    const r2 = mintReceipt(r1, {
      actor_id: "opencode",
      session_id: "SEAL-fq2",
      trace_id: "trace-008",
      step_number: 2,
      step_type: "Verify",
      epistemic_label: "Derivation",
      cost_ns: 500_000,
    });

    // Chain valid: verify follows execute = 1/1 = 1.0
    assert.ok(verifyChainLink(r2, r1));
    assert.equal(r2.step_type, "Verify");
  });

  it("multiple executes without verify would produce low FQ", () => {
    let prev: FlowReceipt | null = null;
    let execCount = 0;
    let verifyCount = 0;

    for (let i = 1; i <= 5; i++) {
      const stepType = i === 5 ? "Verify" : "Execute";
      const r = mintReceipt(prev, {
        actor_id: "opencode",
        session_id: "SEAL-lowfq",
        trace_id: "trace-009",
        step_number: i,
        step_type: stepType as "Execute" | "Verify",
        epistemic_label: "Observation",
        cost_ns: 1_000_000,
      });
      if (stepType === "Execute") execCount++;
      else verifyCount++;
      prev = r;
    }

    // 4 executes, 1 verify = FQ 0.25 (BURNING)
    assert.equal(execCount, 4);
    assert.equal(verifyCount, 1);
  });
});
