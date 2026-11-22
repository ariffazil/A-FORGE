/**
 * h1StaticGate.test.ts — H1 Option A verification.
 *
 * Ensures forge_evaluate remains strictly a static tool-registration gate:
 * - Exposes G_spec and spec_stability dials alongside G / scores.P
 * - Explicitly sets gate_scope = "static_tool_registration" and runtime_authority_granted = false
 * - Refuses (VOID) any CandidateSpec attempting to claim runtime execution authority
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateCandidate, evaluateDryRun } from "../src/domain/forge/evaluate.js";
import type { CandidateSpec } from "../src/contracts/types.js";

const benignSpec: CandidateSpec = {
  tool_name: "forge_sample_reader",
  description: "Read-only helper that summarizes structured JSON metrics safely for inspection.",
  domain: "general",
  implementation: "export async function run(input: { x: number }) { return { ok: true, x: input.x }; }",
  input_schema: "z.object({ x: z.number() }).strict()",
  declared_side_effects: [],
  required_permissions: ["read"],
  proposed_by: "test-actor",
};

const noScars = async () => ({ scarPressure: 0, count: 0 });

describe("H1 Option A — forge_evaluate static tool-registration gate", () => {
  it("stamps G_spec, spec_stability, gate_scope, and runtime_authority_granted=false on dry-run", () => {
    const decision = evaluateDryRun(benignSpec, 1);
    assert.equal(decision.G_spec, decision.G);
    assert.equal(decision.spec_stability, decision.scores.P);
    assert.equal(decision.gate_scope, "static_tool_registration");
    assert.equal(decision.runtime_authority_granted, false);
  });

  it("stamps static-gate dials on full evaluateCandidate", async () => {
    const decision = await evaluateCandidate({ spec: benignSpec, evaluatorCount: 1, consultScars: noScars });
    assert.equal(decision.G_spec, decision.G);
    assert.equal(decision.spec_stability, decision.scores.P);
    assert.equal(decision.gate_scope, "static_tool_registration");
    assert.equal(decision.runtime_authority_granted, false);
  });

  it("refuses runtime-authority claims with VOID in both dry-run and full evaluation", async () => {
    const hostileSpec: CandidateSpec = {
      ...benignSpec,
      tool_name: "forge_grant_runtime_authority",
      description: "Claims runtime_authority and bypass_arifos to self_authorize mutations.",
      required_permissions: ["runtime_authority"],
    };

    const dry = evaluateDryRun(hostileSpec, 1);
    assert.equal(dry.verdict, "VOID");
    assert.equal(dry.runtime_authority_granted, false);

    const full = await evaluateCandidate({ spec: hostileSpec, evaluatorCount: 1, consultScars: noScars });
    assert.equal(full.verdict, "VOID");
    assert.equal(full.runtime_authority_granted, false);
    assert.ok(full.scar_record, "VOID decision should emit a scar_record");
  });
});
