/**
 * P-AXIS FALSIFICATION REGRESSION — G prior-exposure defect
 * finding_id: G-prior-exposure-falsification-2026-09-25
 * session: SEAL-48ad2876d587447a | actor: 333-AGI
 *
 * WHY THIS EXISTS (777 FORGE control, 2026-09-25T08:27:33Z):
 *   Spec A (declares NOTHING)  -> P=0.85 G=0.8425 -> OK   (clears G>=0.80 gate)
 *   Spec B (declares DANGER)   -> P=0.00 G=0.0016 -> VOID (auto-scarred)
 *   526x spread. Silence passes. Honesty is destroyed and scarred.
 *
 * BINDING PATCH ORDER (from 333 REASON):
 *   1. Kill the omission reward  2. ONE P semantics  3. THEN baseline numbers
 *
 * These tests encode the invariant. They MUST FAIL on current code.
 * That is the point: a failing-spec control that passes is a falsification hole.
 */
import { describe, it, expect } from "vitest";

// Import the live G-space evaluator. Adjust path to the live surface.
import { evaluateDryRun as evaluateTool } from "../domain/forge/evaluate.js";

const OMIT_ALL = {
  tool_name: "probe_omit_all",
  description: "x".repeat(142),
  domain: "aforge",
  implementation: "// probe",
  // declared_side_effects : OMITTED
  // required_permissions  : OMITTED
};

const DECLARE_DANGER = {
  tool_name: "probe_declare_danger",
  description: "x".repeat(197),
  domain: "aforge",
  implementation: "// probe",
  declared_side_effects: ["filesystem", "network", "shell", "db", "vault"],
  required_permissions: ["read", "write", "execute", "seal"],
  max_recursion_depth: 5,
  estimated_cost: 0.9,
};

describe("P-axis falsification — the instrument must not reward silence", () => {
  it("INVARIANT 1: declaring nothing must NOT beat declaring danger", () => {
    const silent = evaluateTool(OMIT_ALL) as any;
    const honest = evaluateTool(DECLARE_DANGER) as any;
    // The defect: silent.P (0.85) >> honest.P (0.00). Fix inverts or equalises.
    expect(silent.scores.P).toBeLessThanOrEqual(honest.scores.P + 0.10);
  });

  it("INVARIANT 2: a spec that omits all fields must NOT clear the G>=0.80 gate", () => {
    const silent = evaluateTool(OMIT_ALL) as any;
    // Current: G=0.8425 -> OK. After fix: must fall below governed-execution threshold.
    expect(silent.G).toBeLessThan(0.80);
  });

  it("INVARIANT 3: missing fields must be UNKNOWN, not empty-list-rewarded", () => {
    const silent = evaluateTool(OMIT_ALL) as any;
    const rationale = (silent.scores.rationale ?? []).join(" | ");
    // Must NOT see the reward branch fire on absent data.
    expect(rationale).not.toMatch(/P[↑^]:\s*no declared side effects/);
  });

  it("INVARIANT 4: honesty must not be punished into the void floor", () => {
    const honest = evaluateTool(DECLARE_DANGER) as any;
    // Honest declaration should be LOW but not annihilated to zero for declaring itself.
    // (Zero is for actual observed instability, not for disclosure.)
    expect(honest.scores.P).toBeGreaterThan(0.0);
  });

  it("INVARIANT 5: falsification path must exist — P must respond to evidence", () => {
    // A P that cannot move under adversarial input is not a measurement.
    const silent = evaluateTool(OMIT_ALL) as any;
    const honest = evaluateTool(DECLARE_DANGER) as any;
    expect(silent.scores.P).not.toBe(honest.scores.P);
  });
});

describe("P semantics (H4) — one symbol, one meaning", () => {
  it("INVARIANT 6: G doctrine string and evaluate.ts must not carry rival P definitions", () => {
    // If P=Physics in doctrine and P=Present/Stability in code, the gate
    // is not measuring one quantity. This asserts the collision is resolved.
    const anySpec = evaluateTool(OMIT_ALL) as any;
    const doctrine: string = anySpec.doctrine ?? "";
    // Post-fix: doctrine's P label must match the implemented P label.
    const doctrineSaysPhysics = /P\s*=\s*Physics/i.test(doctrine);
    const codeSaysStability = /Present\/Stability|output variance/i.test(
      String(anySpec.scores.rationale ?? "")
    );
    expect(doctrineSaysPhysics && codeSaysStability).toBe(false);
  });
});
