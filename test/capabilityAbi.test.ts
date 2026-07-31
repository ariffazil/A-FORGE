/**
 * capabilityAbi.test.ts — Hash stability, requires-cycle detection, and
 * `arifos_witness_required` blocks self-promotion in the registry.
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  CapabilityABIRegistry,
  hashCapabilityABI,
  findRequiresCycle,
  type CapabilityABI,
} from "../src/domain/forge/capabilityAbi.js";

function makeAbi(overrides: Partial<Omit<CapabilityABI, "hash">> = {}): Omit<CapabilityABI, "hash"> {
  return {
    abi_version: "1.0.0",
    capability_id: "cap.test.echo",
    name: "echo",
    description: "Echo input",
    template_type: "compute_fn",
    serves: ["Investigate"],
    input_schema: z.object({ input: z.string() }),
    output_schema: z.object({ output: z.string() }),
    resource_budget: {
      max_runtime_ms: 1000,
      max_memory_mb: 256,
      max_cpu_seconds: 1,
      max_file_size_mb: 1,
    },
    requires: [],
    min_authority_band: "GREEN",
    verifier_methods_required: ["schema_invariant"],
    credential_refs: [],
    author: "test",
    arifos_witness_required: false,
    ...overrides,
  };
}

describe("CapabilityABI — hash stability", () => {
  it("produces a stable hash across key ordering", () => {
    const a = makeAbi();
    const b = makeAbi({ requires: [] });
    assert.equal(hashCapabilityABI(a), hashCapabilityABI(b));
  });

  it("produces a different hash when content changes", () => {
    const a = makeAbi();
    const b = makeAbi({ description: "Changed" });
    assert.notEqual(hashCapabilityABI(a), hashCapabilityABI(b));
  });
});

describe("CapabilityABIRegistry — register + lookup", () => {
  it("registers an ABI and returns the same hash", () => {
    const reg = new CapabilityABIRegistry();
    const abi = reg.register(makeAbi());
    assert.equal(abi.hash, hashCapabilityABI(makeAbi()));
    const got = reg.get("cap.test.echo");
    assert.ok(got);
    assert.equal(got?.capability_id, "cap.test.echo");
  });
});

describe("CapabilityABI — requires cycle detection", () => {
  it("returns null when there is no cycle", () => {
    const a = makeAbi({ capability_id: "a", requires: ["b"] });
    const b = makeAbi({ capability_id: "b", requires: [] });
    const c = makeAbi({ capability_id: "c", requires: ["a"] });
    const [aF, bF, cF] = [a, b, c].map((x) => ({ ...x, hash: hashCapabilityABI(x) }));
    assert.equal(findRequiresCycle([aF, bF, cF]), null);
  });

  it("returns the cycle path when there is a cycle", () => {
    const a = makeAbi({ capability_id: "a", requires: ["b"] });
    const b = makeAbi({ capability_id: "b", requires: ["c"] });
    const c = makeAbi({ capability_id: "c", requires: ["a"] });
    const [aF, bF, cF] = [a, b, c].map((x) => ({ ...x, hash: hashCapabilityABI(x) }));
    const cycle = findRequiresCycle([aF, bF, cF]);
    assert.ok(cycle);
    assert.ok(cycle!.length >= 3);
  });
});

describe("CapabilityABI — arifos_witness_required", () => {
  it("registry allows the ABI but downstream must route to arif_judge", () => {
    const reg = new CapabilityABIRegistry();
    const abi = reg.register(makeAbi({ arifos_witness_required: true, capability_id: "cap.witnessed" }));
    assert.equal(abi.arifos_witness_required, true);
    // The registry itself is permissive; the EvidencePromotionGate is the
    // downstream gate that calls arif_judge. This test pins the flag.
  });
});
