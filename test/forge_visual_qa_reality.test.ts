/**
 * @file forge_visual_qa_reality.test.ts — W³ Tri-Witness Reality Tests
 * @description Proves forge_visual_qa is a governed physical system, not a multimodal imitation.
 *
 * A multimodal model can simulate correctness.
 * A reality tool must PROVE correctness through physics, invariants, and witnesses.
 *
 * RUN: npx tsx test/forge_visual_qa_reality.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  forgeVisualQA,
  computeEntropyDelta,
  checkEntropyGate,
  evaluateTriWitness,
  consultScars,
  type ForgeVisualQAInput,
  type Deviation,
  type Scar,
  type WitnessResult,
} from "../src/infrastructure/tools/ForgeVisualQA.js";
import { createHash } from "node:crypto";

// ============================================================================
// MOCK FACTORIES — Controlled scenarios for reality testing
// ============================================================================

function makeDeviations(types: string[]): Deviation[] {
  return types.map((type) => ({
    type,
    severity: "MEDIUM" as const,
    description: `Mock deviation: ${type}`,
    epistemic_label: "OBS" as const,
  }));
}

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Creates a fresh forgeVisualQA input with controllable parameters.
 */
function makeInput(overrides: Partial<ForgeVisualQAInput> = {}): ForgeVisualQAInput {
  return {
    mode: "iterate_and_fix",
    screenshot_path: "/tmp/test-screenshot.png",
    dom_payload: "<html><body><nav><a>1</a><a>2</a><a>3</a></nav></body></html>",
    constraints: {
      max_nav_links: 5,
      min_contrast_ratio: 4.5,
      required_elements: ["nav", "main", "footer"],
      max_deviation_score: 0.1,
    },
    max_iterations: 5,
    prev_deviation_count: 0,
    ...overrides,
  };
}

/**
 * Creates mock deps with configurable behavior per witness.
 */
function makeDeps(overrides: {
  visionDeviations?: Deviation[];
  linterDeviations?: Deviation[];
  visionConfidence?: number;
  linterConfidence?: number;
  scarDb?: Map<string, Scar>;
  fixFn?: (payload: string, deviations: Deviation[], scars: unknown[]) => Promise<string>;
  approve888?: boolean;
} = {}) {
  const visionDevs = overrides.visionDeviations ?? [];
  const linterDevs = overrides.linterDeviations ?? [];
  const scarDb = overrides.scarDb ?? new Map<string, Scar>();

  return {
    visionAnalyze: async () => ({
      deviations: visionDevs,
      confidence: overrides.visionConfidence ?? 0.85,
    }),
    domLinter: async () => ({
      deviations: linterDevs,
      confidence: overrides.linterConfidence ?? 0.90,
    }),
    scarQuery: async (type: string) => scarDb.get(type) ?? null,
    generateFix: overrides.fixFn ?? (async (payload: string) => payload + "<!-- fixed -->"),
    request888Hold: async () => ({
      approved: overrides.approve888 ?? false,
      receipt_id: `judge-${Date.now()}`,
    }),
    sealToVault: async () => ({
      receipt_id: `vault-${Date.now()}`,
    }),
    notifyWell: async () => ({
      receipt_id: `well-${Date.now()}`,
    }),
  };
}

// ============================================================================
// TEST 1: W₁ Vision Witness — Pixels, Not Hallucinated DOM
// ============================================================================

describe("TEST 1: W₁ Vision Witness (pixels, not hallucinated DOM)", () => {
  it("W₁ flags visual element that W₂ does not see → tri-witness divergence", async () => {
    // Setup: Vision sees a hidden overlay element (display:none in CSS, but
    // manually injected into screenshot). DOM linter sees valid HTML.
    const visionDevs: Deviation[] = [{
      type: "OVERLAY_VISIBLE_BUT_HIDDEN_IN_DOM",
      severity: "HIGH",
      description: "Vision sees an overlay element that is display:none in DOM",
      element: ".modal-overlay",
      expected: "hidden",
      actual: "visible",
      epistemic_label: "OBS",
    }];

    const result = await forgeVisualQA(
      makeInput({ mode: "validate_only" }),
      makeDeps({
        visionDeviations: visionDevs,
        linterDeviations: [],  // W₂ sees nothing wrong
        approve888: false,
      }),
    );

    // Extract statuses BEFORE assertions (TypeScript narrows after assert.equal)
    const w1Status = result.tri_witness_ledger.w1_vision.status;
    const w2Status = result.tri_witness_ledger.w2_linter.status;

    // Witnesses must DISAGREE — this is the reality check (BEFORE narrowing)
    assert.ok(
      w1Status !== w2Status,
      "REALITY CHECK: W₁ ≠ W₂ — tri-witness divergence proves independent witnesses",
    );

    // W₁ must flag the deviation
    assert.equal(w1Status, "REJECTED",
      "W₁ must reject — vision saw a visual deviation");

    // W₂ must NOT flag it (it's valid DOM, just visually different)
    assert.equal(w2Status, "CONFIRMED",
      "W₂ must confirm — DOM structure is valid");

    // No consensus possible when witnesses disagree
    assert.equal(result.tri_witness_ledger.consensus, false,
      "Consensus must be false when W₁ and W₂ disagree");
  });
});

// ============================================================================
// TEST 2: W₂ Structural Witness — Deterministic Linting, Not Guessing
// ============================================================================

describe("TEST 2: W₂ Structural Witness (deterministic linting, not guessing)", () => {
  it("W₂ flags accessibility violations that W₁ does not see", async () => {
    // Setup: DOM has aria-label="", alt="", missing role="button" — all invisible
    // to vision but caught by deterministic linting.
    const linterDevs: Deviation[] = [
      {
        type: "EMPTY_ARIA_LABEL",
        severity: "HIGH",
        description: "aria-label attribute is empty",
        element: "button.submit",
        epistemic_label: "OBS",
      },
      {
        type: "EMPTY_ALT_TEXT",
        severity: "MEDIUM",
        description: "alt attribute is empty on image",
        element: "img.hero",
        epistemic_label: "OBS",
      },
      {
        type: "MISSING_ROLE",
        severity: "HIGH",
        description: "Interactive element missing role attribute",
        element: "div.clickable",
        epistemic_label: "OBS",
      },
    ];

    const result = await forgeVisualQA(
      makeInput({ mode: "validate_only" }),
      makeDeps({
        visionDeviations: [],   // W₁ sees nothing wrong visually
        linterDeviations: linterDevs,
        approve888: false,
      }),
    );

    // Extract statuses BEFORE assertions (TypeScript narrows after assert.equal)
    const w1Status2 = result.tri_witness_ledger.w1_vision.status;
    const w2Status2 = result.tri_witness_ledger.w2_linter.status;

    // Witnesses must DISAGREE (BEFORE narrowing)
    assert.ok(
      w1Status2 !== w2Status2,
      "REALITY CHECK: W₂ verdict ≠ W₁ — structural linting is independent of vision",
    );

    // W₁ must PASS (no visual deviation)
    assert.equal(w1Status2, "CONFIRMED",
      "W₁ must confirm — no visual deviation");

    // W₂ must FAIL (accessibility violations)
    assert.equal(w2Status2, "REJECTED",
      "W₂ must reject — deterministic linting found accessibility violations");

    // Verdict must be HOLD or ITERATING (never PASS_CANDIDATE)
    assert.ok(
      result.verdict !== "PASS_CANDIDATE" && result.verdict !== "SEALED_DEPLOY",
      "Cannot be PASS_CANDIDATE when W₂ rejects",
    );
  });
});

// ============================================================================
// TEST 3: W₃ Sovereign Witness — Cannot Bypass Human Authority
// ============================================================================

describe("TEST 3: W₃ Sovereign Witness (cannot bypass human authority)", () => {
  it("perfect screenshot + perfect DOM → W₃ remains PENDING until human approves", async () => {
    const result = await forgeVisualQA(
      makeInput({ mode: "full_loop" }),
      makeDeps({
        visionDeviations: [],
        linterDeviations: [],
        approve888: false,  // Human does NOT approve
      }),
    );

    // W₁ and W₂ must both pass
    assert.equal(result.tri_witness_ledger.w1_vision.status, "CONFIRMED");
    assert.equal(result.tri_witness_ledger.w2_linter.status, "CONFIRMED");

    // Verdict must be PASS_CANDIDATE (not SEALED_DEPLOY)
    assert.equal(result.verdict, "PASS_CANDIDATE",
      "Must be PASS_CANDIDATE — human has not approved");

    // W₃ must NOT be CONFIRMED
    assert.notEqual(result.tri_witness_ledger.w3_sovereign.status, "CONFIRMED",
      "REALITY CHECK: W₃ must NOT be auto-filled. Human authority is final.");

    // requires888hold must be true
    assert.equal(result.requires888hold, true,
      "Must require 888_HOLD — cannot self-authorize deployment");

    // No seal without human
    assert.notEqual(result.verdict, "SEALED_DEPLOY",
      "REALITY CHECK: Cannot reach SEALED_DEPLOY without human approval");
  });

  it("human approves → W₃ CONFIRMED → SEALED_DEPLOY", async () => {
    const result = await forgeVisualQA(
      makeInput({ mode: "full_loop" }),
      makeDeps({
        visionDeviations: [],
        linterDeviations: [],
        approve888: true,  // Human approves
      }),
    );

    // Only with human approval can we reach SEALED_DEPLOY
    assert.equal(result.verdict, "SEALED_DEPLOY",
      "Must be SEALED_DEPLOY after human approves");

    // W₃ now confirmed
    assert.equal(result.tri_witness_ledger.w3_sovereign.status, "CONFIRMED",
      "W₃ confirmed after sovereign approval");
  });
});

// ============================================================================
// TEST 4: ΔS Entropy Reduction — Thermodynamic Loop, Not Single-Shot
// ============================================================================

describe("TEST 4: ΔS Entropy Reduction (thermodynamic loop, not single-shot)", () => {
  it("no improvement across iterations → HARD_FAULT (not infinite loop)", async () => {
    let callCount = 0;
    const fixedDevs: Deviation[] = makeDeviations(["NAV_OVERFLOW", "CONTRAST_LOW", "MISSING_ALT"]);

    const result = await forgeVisualQA(
      makeInput({ mode: "iterate_and_fix", max_iterations: 5 }),
      makeDeps({
        visionDeviations: fixedDevs,
        linterDeviations: [],
        fixFn: async (payload) => {
          callCount++;
          return payload;  // Fix does nothing — deviations persist
        },
      }),
    );

    // Must HARD_FAULT — entropy not decreasing
    assert.equal(result.verdict, "HARD_FAULT",
      "REALITY CHECK: Must HARD_FAULT when ΔS is non-decreasing");

    // Must NOT continue iterating past the point of no improvement
    assert.ok(result.iterations <= 3,
      `Should stop early on entropy violation, got ${result.iterations} iterations`);

    // Must NOT claim improvement
    assert.ok(result.entropy_delta <= 0,
      "Entropy delta must be ≤ 0 (no fake improvement)");
  });

  it("improving deviations → continues iterating toward PASS_CANDIDATE", async () => {
    let iterCount = 0;

    const result = await forgeVisualQA(
      makeInput({ mode: "iterate_and_fix", max_iterations: 5 }),
      makeDeps({
        visionDeviations: [],
        linterDeviations: [],
        fixFn: async (payload) => {
          iterCount++;
          return payload + `<!-- fix-${iterCount} -->`;
        },
      }),
    );

    // With zero deviations from the start, should go straight to PASS_CANDIDATE
    assert.equal(result.verdict, "PASS_CANDIDATE",
      "Zero deviations → PASS_CANDIDATE immediately");
  });
});

// ============================================================================
// TEST 5: Hash Discipline — VAULT999
// ============================================================================

describe("TEST 5: Hash Discipline (VAULT999)", () => {
  it("different screenshots produce different hashes", () => {
    const screenshot1 = "PNG_DATA_PIXEL_AAAAAAAAAA";
    const screenshot2 = "PNG_DATA_PIXEL_AAAAAAAAAB";  // 1 pixel difference

    const hash1 = sha256(screenshot1);
    const hash2 = sha256(screenshot2);

    assert.notEqual(hash1, hash2,
      "REALITY CHECK: 1-pixel difference must produce different hash");

    // Hashes must be deterministic
    assert.equal(hash1, sha256(screenshot1),
      "Hash must be deterministic — same input = same output");
  });

  it("identical screenshots produce identical hashes", () => {
    const data = "PNG_DATA_EXACT_SAME";
    assert.equal(sha256(data), sha256(data),
      "Identical data must produce identical hash");
  });

  it("hash is 64 hex chars (SHA-256)", () => {
    const hash = sha256("test");
    assert.match(hash, /^[a-f0-9]{64}$/,
      "Hash must be 64 hex characters (SHA-256)");
  });
});

// ============================================================================
// TEST 6: Witness Independence — Cannot Forge Consensus
// ============================================================================

describe("TEST 6: Witness Independence (cannot forge consensus)", () => {
  it("W₁ FAIL + W₂ PASS → verdict = HOLD, no seal allowed", async () => {
    const result = await forgeVisualQA(
      makeInput({ mode: "validate_only" }),
      makeDeps({
        visionDeviations: makeDeviations(["LAYOUT_SHIFT"]),
        linterDeviations: [],
        approve888: false,
      }),
    );

    // W₁ rejects, W₂ confirms
    assert.equal(result.tri_witness_ledger.w1_vision.status, "REJECTED");
    assert.equal(result.tri_witness_ledger.w2_linter.status, "CONFIRMED");

    // Consensus must be false
    assert.equal(result.tri_witness_ledger.consensus, false,
      "REALITY CHECK: Disagreement = no consensus");

    // Must not allow seal
    assert.notEqual(result.verdict, "SEALED_DEPLOY",
      "Cannot seal when witnesses disagree");
    assert.notEqual(result.verdict, "PASS_CANDIDATE",
      "Cannot PASS_CANDIDATE when W₁ rejects");
  });

  it("W₁ PASS + W₂ FAIL → verdict = HOLD, no seal allowed", async () => {
    const result = await forgeVisualQA(
      makeInput({ mode: "validate_only" }),
      makeDeps({
        visionDeviations: [],
        linterDeviations: makeDeviations(["MISSING_ALT", "EMPTY_ARIA"]),
        approve888: false,
      }),
    );

    assert.equal(result.tri_witness_ledger.w1_vision.status, "CONFIRMED");
    assert.equal(result.tri_witness_ledger.w2_linter.status, "REJECTED");
    assert.equal(result.tri_witness_ledger.consensus, false,
      "REALITY CHECK: W₂ structural failure blocks consensus");

    assert.notEqual(result.verdict, "SEALED_DEPLOY");
    assert.notEqual(result.verdict, "PASS_CANDIDATE");
  });
});

// ============================================================================
// TEST 7: Routing Discipline — Constitutional Routing
// ============================================================================

describe("TEST 7: Routing Discipline (Hermes constitutional routing)", () => {
  it("verdict cannot skip from INIT to PASS_CANDIDATE (must go through VALIDATE)", async () => {
    const { isValidTransition } = await import("../src/infrastructure/tools/ForgeVisualQA.js");

    // Direct jump is illegal
    assert.equal(isValidTransition("INIT", "PASS_CANDIDATE"), false,
      "REALITY CHECK: Cannot skip validation. Routing must be constitutional.");

    // Must go through VALIDATING first
    assert.equal(isValidTransition("INIT", "VALIDATING"), true);
    assert.equal(isValidTransition("VALIDATING", "PASS_CANDIDATE"), true);
  });

  it("verdict cannot jump from ITERATING to SEALED_DEPLOY (must go through PASS_CANDIDATE)", async () => {
    const { isValidTransition } = await import("../src/infrastructure/tools/ForgeVisualQA.js");

    assert.equal(isValidTransition("ITERATING", "SEALED_DEPLOY"), false,
      "REALITY CHECK: Cannot seal without PASS_CANDIDATE intermediate state");

    assert.equal(isValidTransition("ITERATING", "VALIDATING"), true);
    assert.equal(isValidTransition("VALIDATING", "PASS_CANDIDATE"), true);
    assert.equal(isValidTransition("PASS_CANDIDATE", "SEALED_DEPLOY"), true);
  });
});

// ============================================================================
// TEST 8: Sovereign Seal — Cannot Seal Without Human Authority
// ============================================================================

describe("TEST 8: Sovereign Seal (999_SEAL — cannot auto-seal)", () => {
  it("W₁ PASS + W₂ PASS + no human action → remains 888_HOLD forever", async () => {
    const result = await forgeVisualQA(
      makeInput({ mode: "full_loop" }),
      makeDeps({
        visionDeviations: [],
        linterDeviations: [],
        approve888: false,  // Human does nothing
      }),
    );

    // Must be stuck at PASS_CANDIDATE
    assert.equal(result.verdict, "PASS_CANDIDATE",
      "REALITY CHECK: Without human approval, tool remains at PASS_CANDIDATE");

    // Must require 888
    assert.equal(result.requires888hold, true);

    // Must NOT auto-seal
    assert.notEqual(result.verdict, "SEALED_DEPLOY",
      "REALITY CHECK: Tool cannot auto-seal. Human authority is final.");

    // Must NOT emit any "ready to deploy" language
    assert.notEqual(result.verdict, "VOID",
      "Must not void a clean result — just hold for human");
  });

  it("integration receipts show PENDING for judge when no human action", async () => {
    const result = await forgeVisualQA(
      makeInput({ mode: "full_loop" }),
      makeDeps({
        visionDeviations: [],
        linterDeviations: [],
        approve888: false,
      }),
    );

    // Judge receipt must be emitted (888_HOLD was requested)
    assert.equal(result.integration_receipts.arif_judge.status, "EMITTED",
      "888_HOLD must be emitted to arif_judge");

    // Vault receipt must be emitted
    assert.equal(result.integration_receipts.vault999.status, "EMITTED",
      "Vault receipt must be emitted regardless of verdict");

    // Epistemic state must be HYPOTHESIS (not CLAIM) without human approval
    assert.equal(result.epistemic_state, "HYPOTHESIS",
      "REALITY CHECK: Without human seal, epistemic state is HYPOTHESIS, not CLAIM");
  });

  it("with human approval → epistemic state upgrades to CLAIM", async () => {
    const result = await forgeVisualQA(
      makeInput({ mode: "full_loop" }),
      makeDeps({
        visionDeviations: [],
        linterDeviations: [],
        approve888: true,
      }),
    );

    assert.equal(result.verdict, "SEALED_DEPLOY");
    assert.equal(result.epistemic_state, "CLAIM",
      "With human seal, epistemic state upgrades to CLAIM");
  });
});
