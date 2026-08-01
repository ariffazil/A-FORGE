/**
 * missionContract.test.ts — MissionContract schema validation,
 * compatibility checking (Mission vs Capability ABI), and
 * acceptance-criterion enforcement.
 *
 * Rewritten 2026-08-01 from .bak — old API (createMissionContract,
 * findMissingCapabilities, ratification routing) replaced by Zod schema
 * + checkMissionCompatibility.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MissionContractSchema,
  checkMissionCompatibility,
  type MissionContract,
  type MissionCompatibility,
} from "../src/domain/forge/missionContract.js";
import {
  CapabilityAbiSchema,
  type CapabilityAbi,
} from "../src/domain/forge/capabilityAbi.js";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeValidMission(overrides: Partial<MissionContract> = {}): MissionContract {
  const base: MissionContract = {
    mission_id: "msn-test-001",
    capability_id: "forge_test_echo",
    capability_abi_ref: "abi-forge_test_echo-v1",
    expected_outcome: "Echo the input back unchanged for testing purposes",
    acceptance_criteria: [
      {
        id: "ac-echo-output",
        description: "Output text matches input text",
        output_path: "text",
        predicate: "output.text === input.text",
        hard: true,
      },
    ],
    allowed_side_effects: [{ kind: "network_request", scope: "localhost", requires_approval: false }],
    budget: { max_invocations: 10, max_total_runtime_ms: 30000, max_cost_units: 1000 },
    deadline: "2026-12-31T23:59:59Z",
    verifier: {
      method: "schema_invariant",
      witness_actor_id: "555-ASI",
      criteria_ids: ["ac-echo-output"],
    },
    rollback: {
      strategy: "transactional",
      steps: ["revert-echo"],
      estimated_ms: 50,
      must_complete_before_signoff: false,
    },
    forged_by: "333-AGI",
    forged_at: "2026-08-01T00:00:00Z",
    contract_version: "v1",
    ...overrides,
  };
  return base;
}

function makeMatchingAbi(overrides: Partial<CapabilityAbi> = {}): CapabilityAbi {
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

// ── Schema validation ─────────────────────────────────────────────────────────

describe("MissionContractSchema — validation", () => {
  it("accepts a valid MissionContract", () => {
    const result = MissionContractSchema.safeParse(makeValidMission());
    assert.ok(result.success, `expected success, got: ${JSON.stringify(result.error?.issues)}`);
  });

  it("rejects a contract with empty mission_id", () => {
    const result = MissionContractSchema.safeParse(makeValidMission({ mission_id: "" }));
    assert.equal(result.success, false);
  });

  it("rejects a contract with no acceptance criteria", () => {
    const result = MissionContractSchema.safeParse(
      makeValidMission({ acceptance_criteria: [] }),
    );
    assert.equal(result.success, false);
  });

  it("rejects a contract with expected_outcome shorter than 10 characters", () => {
    const result = MissionContractSchema.safeParse(
      makeValidMission({ expected_outcome: "short" }),
    );
    assert.equal(result.success, false);
  });

  it("rejects SELF_CERTIFIED verifier method", () => {
    const result = MissionContractSchema.safeParse(
      makeValidMission({
        verifier: {
          method: "SELF_CERTIFIED" as any,
          witness_actor_id: "me",
          criteria_ids: ["ac-1"],
        },
      }),
    );
    assert.equal(result.success, false);
  });
});

// ── checkMissionCompatibility — compatible ────────────────────────────────────

describe("checkMissionCompatibility — compatible", () => {
  it("returns ok=true when mission matches ABI", () => {
    const mission = makeValidMission();
    const abi = makeMatchingAbi();
    const result = checkMissionCompatibility(mission, abi);
    assert.equal(result.ok, true);
    assert.deepEqual(result.issues, []);
  });
});

// ── Compatibility: capability_id mismatch ─────────────────────────────────────

describe("checkMissionCompatibility — capability_id mismatch", () => {
  it("detects when mission.capability_id differs from abi.capability_id", () => {
    const mission = makeValidMission({ capability_id: "forge_other_tool" });
    const abi = makeMatchingAbi(); // capability_id="forge_test_echo"
    const result = checkMissionCompatibility(mission, abi);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.includes("capability_id mismatch")));
  });
});

// ── Compatibility: side effects ───────────────────────────────────────────────

describe("checkMissionCompatibility — side effects", () => {
  it("detects when mission declares a side effect not in ABI", () => {
    const mission = makeValidMission({
      allowed_side_effects: [
        { kind: "fs_write", scope: "/tmp", requires_approval: true },
      ],
    });
    const abi = makeMatchingAbi(); // side_effects: ["network_request"] only
    const result = checkMissionCompatibility(mission, abi);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.includes("not in ABI.side_effects")));
  });
});

// ── Compatibility: budget exceeds ABI ─────────────────────────────────────────

describe("checkMissionCompatibility — budget", () => {
  it("detects when mission budget exceeds ABI resource timeout", () => {
    const mission = makeValidMission({
      budget: { max_invocations: 10, max_total_runtime_ms: 120000, max_cost_units: 1000 },
    });
    const abi = makeMatchingAbi(); // resource_budget.timeout_ms = 30000
    const result = checkMissionCompatibility(mission, abi);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.includes("exceeds ABI timeout")));
  });
});

// ── Compatibility: rollback ───────────────────────────────────────────────────

describe("checkMissionCompatibility — rollback", () => {
  it("detects when ABI rollback=none but mission claims rollback strategy", () => {
    const mission = makeValidMission({
      rollback: { strategy: "transactional", steps: [], estimated_ms: 0, must_complete_before_signoff: false },
    });
    const abi = makeMatchingAbi({
      rollback: { strategy: "none", estimated_rollback_ms: 0, requires_lease_extension: false },
    });
    const result = checkMissionCompatibility(mission, abi);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.includes("ABI rollback=none but mission rollback")));
  });

  it("detects human_undo_required with must_complete_before_signoff", () => {
    const mission = makeValidMission({
      rollback: {
        strategy: "human_undo_required",
        steps: [],
        estimated_ms: 0,
        must_complete_before_signoff: true,
      },
    });
    const abi = makeMatchingAbi({
      rollback: {
        strategy: "human_undo_required",
        estimated_rollback_ms: 0,
        requires_lease_extension: false,
      },
    });
    const result = checkMissionCompatibility(mission, abi);
    assert.equal(result.ok, false);
    assert.ok(
      result.issues.some((i) => i.includes("human_undo_required cannot auto-complete before signoff")),
    );
  });
});

// ── Compatibility: acceptance criteria ────────────────────────────────────────

describe("checkMissionCompatibility — acceptance criteria", () => {
  it("detects when no criteria are hard", () => {
    const mission = makeValidMission({
      acceptance_criteria: [
        {
          id: "ac-soft",
          description: "Soft criterion",
          hard: false,
        },
      ],
      verifier: {
        method: "schema_invariant",
        witness_actor_id: "555-ASI",
        criteria_ids: ["ac-soft"],
      },
    });
    const abi = makeMatchingAbi();
    const result = checkMissionCompatibility(mission, abi);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.includes("no hard acceptance criteria")));
  });

  it("detects when a hard criterion is not in verifier.criteria_ids", () => {
    const mission = makeValidMission({
      acceptance_criteria: [
        {
          id: "ac-unwitnessed",
          description: "Hard but unwitnessed",
          hard: true,
        },
      ],
      verifier: {
        method: "schema_invariant",
        witness_actor_id: "555-ASI",
        criteria_ids: ["ac-something-else"],
      },
    });
    const abi = makeMatchingAbi();
    const result = checkMissionCompatibility(mission, abi);
    assert.equal(result.ok, false);
    assert.ok(
      result.issues.some((i) => i.includes("not in verifier.criteria_ids")),
    );
  });
});
