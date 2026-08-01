/**
 * capabilityAbi.test.ts — Schema validation, non-compensatory admissibility
 * gate (H_A ∧ H_S ∧ H_E ∧ H_R ∧ H_V), and CapabilityAbi type correctness.
 *
 * Rewritten 2026-08-01 from .bak — old API (hashCapabilityABI, registry,
 * findRequiresCycle) replaced by Zod schema + evaluateAdmissibility.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CapabilityAbiSchema,
  evaluateAdmissibility,
  type CapabilityAbi,
  type AdmissibilityVerdict,
} from "../src/domain/forge/capabilityAbi.js";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeValidAbi(overrides: Partial<CapabilityAbi> = {}): CapabilityAbi {
  const base: CapabilityAbi = {
    capability_id: "forge_test_echo",
    intent: "Echo the input back unchanged for testing purposes",
    input_schema: { type: "object", properties: { text: { type: "string" } } },
    output_schema: { type: "object", properties: { text: { type: "string" } } },
    authority_class: "EXECUTE_REVERSIBLE",
    side_effects: ["network_request"],
    data_classification: "INTERNAL",
    network_scope: { default_policy: "LOCALHOST_ONLY", allowed_domains: [], allowed_endpoints: [] },
    filesystem_scope: { default_policy: "DENY", read_allowlist: [], write_allowlist: [], explicit_denies: [] },
    resource_budget: { cpu_cores: 1, memory_mb: 256, storage_mb: 512, timeout_ms: 30000, network_required: false },
    timeout_ms: 30000,
    idempotency: { is_idempotent: true, idempotency_key_input: false, dedup_window_ms: 0 },
    rollback: { strategy: "transactional", estimated_rollback_ms: 100, requires_lease_extension: false },
    verifier: {
      method: "schema_invariant",
      external_executor: "555-ASI",
      witness_required: false,
      min_passes: 1,
      receipt_policy: "emit_to_local",
    },
    evidence_requirements: {
      provenance_required: true,
      merkle_chain_intact_required: true,
      receipts_emitted: ["flow_receipt"],
    },
    ttl: { ttl_ms: 60000, auto_retire_on_expiry: true, promotion_eligible_after_expiry: false },
    forged_by: "333-AGI",
    forged_at: "2026-08-01T00:00:00Z",
    abi_version: "v1",
    ...overrides,
  };
  return base;
}

function allGatesOkCtx() {
  return {
    identity_valid: true,
    containment_available: true,
    merkle_intact: true,
    receipts_present: true,
    rollback_compatible: true,
    verifier_external_executor_registered: true,
  };
}

// ── Schema validation ─────────────────────────────────────────────────────────

describe("CapabilityAbiSchema — validation", () => {
  it("accepts a valid ABI", () => {
    const result = CapabilityAbiSchema.safeParse(makeValidAbi());
    assert.ok(result.success, `expected success, got: ${JSON.stringify(result.error?.issues)}`);
  });

  it("rejects an ABI with empty capability_id", () => {
    const result = CapabilityAbiSchema.safeParse(makeValidAbi({ capability_id: "" }));
    assert.equal(result.success, false);
  });

  it("rejects an ABI with intent shorter than 10 characters", () => {
    const result = CapabilityAbiSchema.safeParse(makeValidAbi({ intent: "short" }));
    assert.equal(result.success, false);
  });

  it("rejects an ABI with missing forged_by", () => {
    const result = CapabilityAbiSchema.safeParse(makeValidAbi({ forged_by: "" }));
    assert.equal(result.success, false);
  });

  it("rejects invalid authority_class", () => {
    const result = CapabilityAbiSchema.safeParse(
      makeValidAbi({ authority_class: "SUPER_USER" as any }),
    );
    assert.equal(result.success, false);
  });

  it("rejects SELF_CERTIFIED verifier method (not in enum)", () => {
    const result = CapabilityAbiSchema.safeParse(
      makeValidAbi({
        verifier: {
          method: "SELF_CERTIFIED" as any,
          external_executor: "me",
        } as any,
      }),
    );
    assert.equal(result.success, false);
  });
});

// ── evaluateAdmissibility — all gates pass ────────────────────────────────────

describe("evaluateAdmissibility — all gates pass", () => {
  it("returns ok=true with no failing gates when all conditions are met", () => {
    const abi = makeValidAbi();
    const ctx = allGatesOkCtx();
    const verdict = evaluateAdmissibility(abi, ctx);
    assert.equal(verdict.ok, true);
    assert.deepEqual(verdict.failing_gates, []);
    assert.equal(verdict.H_A.ok, true);
    assert.equal(verdict.H_S.ok, true);
    assert.equal(verdict.H_E.ok, true);
    assert.equal(verdict.H_R.ok, true);
    assert.equal(verdict.H_V.ok, true);
  });
});

// ── H_A — authority + identity ────────────────────────────────────────────────

describe("evaluateAdmissibility — H_A (authority + identity)", () => {
  it("fails H_A when identity is not valid", () => {
    const abi = makeValidAbi();
    const ctx = { ...allGatesOkCtx(), identity_valid: false };
    const verdict = evaluateAdmissibility(abi, ctx);
    assert.equal(verdict.ok, false);
    assert.ok(verdict.failing_gates.includes("H_A"));
  });

  it("fails H_A when forged_by is empty", () => {
    const abi = makeValidAbi({ forged_by: "" });
    // forged_by="" will fail schema, but evaluateAdmissibility only checks length
    // We bypass schema to test the gate in isolation
    const ctx = allGatesOkCtx();
    const verdict = evaluateAdmissibility(abi, ctx);
    assert.equal(verdict.ok, false);
    assert.ok(verdict.failing_gates.includes("H_A"));
  });
});

// ── H_S — containment + safety ────────────────────────────────────────────────

describe("evaluateAdmissibility — H_S (containment + safety)", () => {
  it("fails H_S when containment is unavailable for IRREVERSIBLE authority", () => {
    const abi = makeValidAbi({ authority_class: "IRREVERSIBLE" });
    const ctx = { ...allGatesOkCtx(), containment_available: false };
    const verdict = evaluateAdmissibility(abi, ctx);
    assert.equal(verdict.ok, false);
    assert.ok(verdict.failing_gates.includes("H_S"));
  });

  it("passes H_S for OBSERVE authority even without containment", () => {
    const abi = makeValidAbi({ authority_class: "OBSERVE" });
    const ctx = { ...allGatesOkCtx(), containment_available: false };
    const verdict = evaluateAdmissibility(abi, ctx);
    assert.equal(verdict.H_S.ok, true);
  });
});

// ── H_E — evidence + provenance ──────────────────────────────────────────────

describe("evaluateAdmissibility — H_E (evidence + provenance)", () => {
  it("fails H_E when merkle chain is not intact", () => {
    const abi = makeValidAbi();
    const ctx = { ...allGatesOkCtx(), merkle_intact: false };
    const verdict = evaluateAdmissibility(abi, ctx);
    assert.equal(verdict.ok, false);
    assert.ok(verdict.failing_gates.includes("H_E"));
  });

  it("fails H_E when no receipts are present", () => {
    const abi = makeValidAbi();
    const ctx = { ...allGatesOkCtx(), receipts_present: false };
    const verdict = evaluateAdmissibility(abi, ctx);
    assert.equal(verdict.ok, false);
    assert.ok(verdict.failing_gates.includes("H_E"));
  });
});

// ── H_R — rollback ────────────────────────────────────────────────────────────

describe("evaluateAdmissibility — H_R (rollback)", () => {
  it("fails H_R when rollback is none and authority is IRREVERSIBLE with incompatible rollback", () => {
    const abi = makeValidAbi({
      authority_class: "IRREVERSIBLE",
      rollback: { strategy: "none", estimated_rollback_ms: 0, requires_lease_extension: false },
    });
    const ctx = { ...allGatesOkCtx(), rollback_compatible: false };
    const verdict = evaluateAdmissibility(abi, ctx);
    assert.equal(verdict.ok, false);
    assert.ok(verdict.failing_gates.includes("H_R"));
  });

  it("passes H_R when rollback_compatible is true", () => {
    const abi = makeValidAbi();
    const ctx = allGatesOkCtx();
    const verdict = evaluateAdmissibility(abi, ctx);
    assert.equal(verdict.H_R.ok, true);
  });
});

// ── H_V — independent verifier ────────────────────────────────────────────────

describe("evaluateAdmissibility — H_V (independent verifier)", () => {
  it("fails H_V when verifier external executor is not registered", () => {
    const abi = makeValidAbi();
    const ctx = { ...allGatesOkCtx(), verifier_external_executor_registered: false };
    const verdict = evaluateAdmissibility(abi, ctx);
    assert.equal(verdict.ok, false);
    assert.ok(verdict.failing_gates.includes("H_V"));
  });

  it("fails H_V when external_executor is empty", () => {
    const abi = makeValidAbi({
      verifier: {
        method: "schema_invariant",
        external_executor: "",
        witness_required: false,
        min_passes: 1,
        receipt_policy: "emit_to_local",
      },
    });
    const ctx = allGatesOkCtx();
    const verdict = evaluateAdmissibility(abi, ctx);
    assert.equal(verdict.ok, false);
    assert.ok(verdict.failing_gates.includes("H_V"));
  });
});

// ── Non-compensatory — any single failure collapses ──────────────────────────

describe("evaluateAdmissibility — non-compensatory", () => {
  it("returns ok=false when exactly one gate fails", () => {
    const abi = makeValidAbi();
    const ctx = { ...allGatesOkCtx(), identity_valid: false };
    const verdict = evaluateAdmissibility(abi, ctx);
    assert.equal(verdict.ok, false);
    assert.equal(verdict.failing_gates.length, 1);
  });

  it("returns all failing gates when multiple fail", () => {
    const abi = makeValidAbi({ authority_class: "IRREVERSIBLE" });
    const ctx = {
      identity_valid: false,
      containment_available: false,
      merkle_intact: false,
      receipts_present: false,
      rollback_compatible: false,
      verifier_external_executor_registered: false,
    };
    const verdict = evaluateAdmissibility(abi, ctx);
    assert.equal(verdict.ok, false);
    assert.equal(verdict.failing_gates.length, 5);
  });
});
