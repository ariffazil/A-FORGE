/**
 * missionContract.test.ts — Mission contract construction, defaults,
 * missing-capability detection, and ratification flag.
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createMissionContract,
  findMissingCapabilities,
  type MissionContract,
} from "../src/domain/forge/missionContract.js";
import { CapabilityABIRegistry } from "../src/domain/forge/capabilityAbi.js";
import { z } from "zod";

function baseInput() {
  return {
    mission_intent: "parse CSV",
    outcome_spec_id: "os-1",
    run_config_id: "rc-1",
    required_capabilities: [
      { capability_id: "cap.parse.csv", invocation_count: 1, expected_outputs: 1, failure_tolerance: 0 },
    ],
    lease_requirement: { authority_band: "GREEN" as const, ttl_seconds: 600 },
    ratification_required: true,
    signed_by: "aforge-mission-author" as const,
  };
}

describe("MissionContract — construction", () => {
  it("produces a contract with deterministic defaults", () => {
    const c = createMissionContract(baseInput());
    assert.ok(c.contract_id.startsWith("mc-"));
    assert.equal(c.mission_intent, "parse CSV");
    assert.equal(c.outcome_spec_id, "os-1");
    assert.equal(c.run_config_id, "rc-1");
    assert.equal(c.success_criteria.min_capability_satisfaction_rate, 0.95);
    assert.equal(c.success_criteria.min_independent_verifier_passes, 3);
    assert.equal(c.ratification_required, true);
    assert.equal(c.signed_by, "aforge-mission-author");
  });

  it("honours custom success criteria", () => {
    const c = createMissionContract({
      ...baseInput(),
      success_criteria: {
        min_capability_satisfaction_rate: 0.7,
        min_independent_verifier_passes: 1,
      },
    });
    assert.equal(c.success_criteria.min_capability_satisfaction_rate, 0.7);
    assert.equal(c.success_criteria.min_independent_verifier_passes, 1);
  });
});

describe("MissionContract — missing capability detection", () => {
  it("returns empty when all required ids are registered", () => {
    const reg = new CapabilityABIRegistry();
    reg.register({
      abi_version: "1.0.0",
      capability_id: "cap.parse.csv",
      name: "csv",
      description: "parse csv",
      template_type: "data_parser",
      serves: ["Investigate"],
      input_schema: z.object({}),
      output_schema: z.object({}),
      resource_budget: { max_runtime_ms: 100, max_memory_mb: 64, max_cpu_seconds: 1, max_file_size_mb: 1 },
      requires: [],
      min_authority_band: "GREEN",
      verifier_methods_required: ["schema_invariant"],
      credential_refs: [],
      author: "t",
      arifos_witness_required: false,
      hash: "h",
    });
    const c = createMissionContract(baseInput());
    assert.deepEqual(findMissingCapabilities(c, reg), []);
  });

  it("returns missing ids when some are not registered", () => {
    const reg = new CapabilityABIRegistry();
    const c = createMissionContract({
      ...baseInput(),
      required_capabilities: [
        { capability_id: "cap.parse.csv", invocation_count: 1, expected_outputs: 1, failure_tolerance: 0 },
        { capability_id: "cap.parse.json", invocation_count: 1, expected_outputs: 1, failure_tolerance: 0 },
      ],
    });
    const missing = findMissingCapabilities(c, reg);
    assert.equal(missing.length, 2);
    assert.ok(missing.includes("cap.parse.csv"));
    assert.ok(missing.includes("cap.parse.json"));
  });
});

describe("MissionContract — ratification routing", () => {
  it("marks ratification_required=true → arif_judge", () => {
    const c: MissionContract = createMissionContract({ ...baseInput(), ratification_required: true });
    assert.equal(c.ratification_required, true);
  });

  it("ratification_required=false remains aforge-mission-author", () => {
    const c = createMissionContract({ ...baseInput(), ratification_required: false, signed_by: "aforge-mission-author" });
    assert.equal(c.ratification_required, false);
    assert.equal(c.signed_by, "aforge-mission-author");
  });
});
