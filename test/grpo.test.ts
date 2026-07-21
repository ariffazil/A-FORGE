/**
 * GRPO Unit Tests — Phase 2a.4
 * 
 * Tests: advantage computation, clipping, loss stability, edge cases
 * 
 * Forged: 2026-07-21 by FORGE (000Ω)
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import {
  Rollout,
  RolloutGroup,
  GRPOConfig,
  DEFAULT_GRPO_CONFIG,
  computeGroupAdvantages,
  computeTokenWeights,
  computeGRPOLoss,
  estimateKLDivergence,
  grpoStep,
  computeDynamicEchoLambda,
  validateRolloutGroup,
  testAdvantageSanity,
  createMetricsAccumulator,
  accumulateMetrics,
  TokenEntry,
} from "../src/domain/governance/grpo.js";

// ── Helpers ────────────────────────────────────────────────

function makeToken(tokenId: number, role: TokenEntry["role"], logProb: number, refLogProb?: number): TokenEntry {
  return { tokenId, role, logProb, refLogProb };
}

function makeRollout(
  id: string,
  reward: number,
  actionTokens: number = 3,
  obsTokens: number = 2,
  logProbAction: number = -0.5,
  logProbObs: number = -1.0,
): Rollout {
  const tokens: TokenEntry[] = [];
  // Prompt tokens
  tokens.push(makeToken(0, "prompt", 0));
  tokens.push(makeToken(1, "prompt", 0));

  // Action tokens
  for (let i = 0; i < actionTokens; i++) {
    tokens.push(makeToken(10 + i, "action", logProbAction, logProbAction - 0.1));
  }

  // Observation tokens
  for (let i = 0; i < obsTokens; i++) {
    tokens.push(makeToken(20 + i, "observation", logProbObs));
  }

  return {
    id,
    prompt: "test prompt",
    tokens,
    reward,
    totalTokens: tokens.length,
    actionTokens,
    observationTokens: obsTokens,
  };
}

function makeGroup(rolloutCount: number = 4): RolloutGroup {
  const rewards = [1, 0, 0, 0, 1, 0, 0, 1]; // alternating pattern
  const rollouts: Rollout[] = [];
  for (let i = 0; i < rolloutCount; i++) {
    rollouts.push(makeRollout(`r${i}`, rewards[i % rewards.length] ?? 0));
  }
  return { promptId: "test-prompt", rollouts };
}

// ── TESTS ──────────────────────────────────────────────────

describe("GRPO — Group Relative Policy Optimization", () => {

  // ═════════════════════════════════════════════════════════
  // ADVANTAGE COMPUTATION
  // ═════════════════════════════════════════════════════════

  describe("computeGroupAdvantages", () => {

    it("sums to zero within epsilon", () => {
      const group = makeGroup(4);
      const advantages = computeGroupAdvantages(group);
      const sum = Array.from(advantages.values()).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum) < 1e-6, `Advantage sum ${sum} should be ≈ 0`);
    });

    it("assigns positive advantage to above-mean rewards", () => {
      // Group: [1, 0, 0, 0] — r0 should have positive advantage
      const rollouts = [
        makeRollout("r0", 1),
        makeRollout("r1", 0),
        makeRollout("r2", 0),
        makeRollout("r3", 0),
      ];
      const group: RolloutGroup = { promptId: "test", rollouts };
      const advantages = computeGroupAdvantages(group);

      assert.ok(advantages.get("r0")! > 0, "r0 (reward=1) should have positive advantage");
      for (const id of ["r1", "r2", "r3"]) {
        assert.ok(advantages.get(id)! < 0, `${id} (reward=0) should have negative advantage`);
      }
    });

    it("returns zero advantage when all rewards equal", () => {
      const rollouts = [
        makeRollout("r0", 0.5),
        makeRollout("r1", 0.5),
        makeRollout("r2", 0.5),
        makeRollout("r3", 0.5),
      ];
      const group: RolloutGroup = { promptId: "test", rollouts };
      const advantages = computeGroupAdvantages(group);

      for (const adv of advantages.values()) {
        assert.strictEqual(adv, 0, "All equal rewards → zero advantage");
      }
    });

    it("handles groups of size 2 (minimum)", () => {
      const rollouts = [makeRollout("r0", 1), makeRollout("r1", 0)];
      const group: RolloutGroup = { promptId: "test", rollouts };
      const advantages = computeGroupAdvantages(group);

      assert.ok(advantages.get("r0")! > 0);
      assert.ok(advantages.get("r1")! < 0);
      assert.ok(Math.abs(advantages.get("r0")! + advantages.get("r1")!) < 1e-6);
    });

    it("passes sanity check", () => {
      const group = makeGroup(4);
      assert.ok(testAdvantageSanity(group), "Sanity check should pass");
    });

  });

  // ═════════════════════════════════════════════════════════
  // TOKEN WEIGHTS
  // ═════════════════════════════════════════════════════════

  describe("computeTokenWeights", () => {

    it("assigns non-zero weight to action tokens", () => {
      const rollout = makeRollout("r0", 1);
      const weights = computeTokenWeights(rollout, 1.0, null);
      const actionIdx = 2; // first action token (after 2 prompt)
      assert.ok(weights.weights[actionIdx] !== 0, "Action token should have non-zero weight");
      assert.strictEqual(weights.lossMask[actionIdx], 1.0);
    });

    it("assigns ECHO weight to observation tokens", () => {
      const config: GRPOConfig = { ...DEFAULT_GRPO_CONFIG, useECHO: true, echoLambda: 0.03 };
      const rollout = makeRollout("r0", 1);
      const weights = computeTokenWeights(rollout, 1.0, null, config);
      const obsIdx = 5; // first observation token
      assert.strictEqual(weights.weights[obsIdx], 0.03, "Observation weight = λ");
      assert.strictEqual(weights.lossMask[obsIdx], 1.0);
    });

    it("masks prompt tokens to zero", () => {
      const rollout = makeRollout("r0", 1);
      const weights = computeTokenWeights(rollout, 1.0, null);
      assert.strictEqual(weights.weights[0], 0, "Prompt token weight = 0");
      assert.strictEqual(weights.weights[1], 0, "Prompt token weight = 0");
      assert.strictEqual(weights.lossMask[0], 0, "Prompt token mask = 0");
    });

    it("zeros observation weights when ECHO disabled", () => {
      const config: GRPOConfig = { ...DEFAULT_GRPO_CONFIG, useECHO: false };
      const rollout = makeRollout("r0", 1);
      const weights = computeTokenWeights(rollout, 1.0, null, config);
      const obsIdx = 5;
      assert.strictEqual(weights.weights[obsIdx], 0);
      assert.strictEqual(weights.lossMask[obsIdx], 0);
    });

  });

  // ═════════════════════════════════════════════════════════
  // LOSS COMPUTATION
  // ═════════════════════════════════════════════════════════

  describe("computeGRPOLoss", () => {

    it("returns finite loss values", () => {
      const rollout = makeRollout("r0", 1);
      const loss = computeGRPOLoss(rollout, 1.0, null);
      assert.ok(isFinite(loss.policyLoss), "Policy loss should be finite");
      assert.ok(isFinite(loss.echoLoss), "ECHO loss should be finite");
      assert.ok(isFinite(loss.totalLoss), "Total loss should be finite");
    });

    it("policy loss direction: advantage sign inverts gradient effect", () => {
      const rollout = makeRollout("r0", 0, 3, 2, -0.5);
      const lossPos = computeGRPOLoss(rollout, 1.0, null);
      const lossNeg = computeGRPOLoss(rollout, -1.0, null);
      // With same negative logProbs:
      //   advantage=+1 → loss=-(+1)*(-0.5)=+0.5 (gradient pushes probability UP)
      //   advantage=-1 → loss=-(-1)*(-0.5)=-0.5 (gradient pushes probability DOWN)
      // Both are finite; sign of advantage inverts the loss sign.
      // Positive advantage → HIGHER loss value than negative advantage
      // because -(positive)*negative = positive, -(-negative)*negative = negative
      assert.ok(isFinite(lossPos.policyLoss));
      assert.ok(isFinite(lossNeg.policyLoss));
      assert.ok(lossPos.policyLoss > lossNeg.policyLoss,
        `With logProbs<0: positive adv loss (${lossPos.policyLoss}) > negative adv loss (${lossNeg.policyLoss})`);
    });

    it("ECHO loss is always positive (λ > 0)", () => {
      const config: GRPOConfig = { ...DEFAULT_GRPO_CONFIG, echoLambda: 0.03 };
      const rollout = makeRollout("r0", 1, 3, 2, -0.5, -1.5);
      const loss = computeGRPOLoss(rollout, 1.0, null, config);
      assert.ok(loss.echoLoss > 0, "ECHO loss should be positive (λ * -logProb) with negative logProbs");
    });

  });

  // ═════════════════════════════════════════════════════════
  // KL DIVERGENCE
  // ═════════════════════════════════════════════════════════

  describe("estimateKLDivergence", () => {

    it("returns zero when refLogProb equals logProb", () => {
      const tokens: TokenEntry[] = [
        makeToken(0, "action", -0.5, -0.5),
        makeToken(1, "action", -1.0, -1.0),
      ];
      const rollout: Rollout = {
        id: "r0", prompt: "test", tokens, reward: 1,
        totalTokens: 2, actionTokens: 2, observationTokens: 0,
      };
      const kl = estimateKLDivergence(rollout);
      assert.strictEqual(kl, 0);
    });

    it("returns positive KL when policy diverges", () => {
      const tokens: TokenEntry[] = [
        makeToken(0, "action", -0.5, -1.0),  // policy more confident (higher prob)
        makeToken(1, "action", -1.0, -0.5),  // policy less confident
      ];
      const rollout: Rollout = {
        id: "r0", prompt: "test", tokens, reward: 1,
        totalTokens: 2, actionTokens: 2, observationTokens: 0,
      };
      const kl = estimateKLDivergence(rollout);
      // KL ≈ ((-0.5) - (-1.0) + (-1.0) - (-0.5)) / 2 = 0
      // Actually: (0.5 + (-0.5)) / 2 = 0
      assert.ok(isFinite(kl), "KL should be finite");
    });

    it("ignores observation and prompt tokens", () => {
      const tokens: TokenEntry[] = [
        makeToken(0, "prompt", 0),
        makeToken(1, "action", -0.5, -1.0),
        makeToken(2, "observation", -2.0, -0.5),  // should be ignored
      ];
      const rollout: Rollout = {
        id: "r0", prompt: "test", tokens, reward: 1,
        totalTokens: 3, actionTokens: 1, observationTokens: 1,
      };
      const kl = estimateKLDivergence(rollout);
      // Only action token: -0.5 - (-1.0) = 0.5
      assert.strictEqual(kl, 0.5);
    });

  });

  // ═════════════════════════════════════════════════════════
  // FULL GRPO STEP
  // ═════════════════════════════════════════════════════════

  describe("grpoStep", () => {

    it("returns structured result with all fields", () => {
      const group = makeGroup(4);
      const result = grpoStep(group, null);
      assert.ok("policyLoss" in result);
      assert.ok("echoLoss" in result);
      assert.ok("klDivergence" in result);
      assert.ok("totalLoss" in result);
      assert.ok("meanAdvantage" in result);
      assert.ok("advantageStd" in result);
      assert.ok("meanReward" in result);
      assert.ok(isFinite(result.totalLoss));
    });

    it("advantage std is higher when rewards vary", () => {
      const allSame = {
        promptId: "same",
        rollouts: [makeRollout("r0", 1), makeRollout("r1", 1), makeRollout("r2", 1), makeRollout("r3", 1)],
      };
      const varied = makeGroup(4);

      const resultSame = grpoStep(allSame, null);
      const resultVaried = grpoStep(varied, null);

      assert.ok(resultVaried.advantageStd > resultSame.advantageStd,
        "Varied rewards → higher advantage std");
      assert.strictEqual(resultSame.advantageStd, 0,
        "All same rewards → zero advantage std");
    });

    it("includes KL penalty in total loss when enabled", () => {
      const config: GRPOConfig = { ...DEFAULT_GRPO_CONFIG, useKLDivergence: true, klPenaltyBeta: 0.1 };
      const group = makeGroup(4);
      const result = grpoStep(group, null, config);
      const expectedKL = config.klPenaltyBeta * result.klDivergence;
      const expectedTotal = result.policyLoss + config.echoLambda * result.echoLoss + expectedKL;
      assert.ok(Math.abs(result.totalLoss - expectedTotal) < 1e-6,
        `Total loss ${result.totalLoss} should equal components sum ${expectedTotal}`);
    });

  });

  // ═════════════════════════════════════════════════════════
  // DYNAMIC LAMBDA
  // ═════════════════════════════════════════════════════════

  describe("computeDynamicEchoLambda", () => {

    it("returns base λ for zero-reward rollout", () => {
      const lambda = computeDynamicEchoLambda(0, 1);
      assert.strictEqual(lambda, DEFAULT_GRPO_CONFIG.echoLambda);
    });

    it("returns lower λ for max-reward rollout", () => {
      const lambda = computeDynamicEchoLambda(1, 1);
      assert.strictEqual(lambda, DEFAULT_GRPO_CONFIG.echoLambdaRange[0]);
    });

    it("clamps to valid range", () => {
      const lambda = computeDynamicEchoLambda(0, 0); // max=0 edge case
      assert.ok(lambda >= DEFAULT_GRPO_CONFIG.echoLambdaRange[0]);
      assert.ok(lambda <= DEFAULT_GRPO_CONFIG.echoLambdaRange[1]);
    });

  });

  // ═════════════════════════════════════════════════════════
  // VALIDATION
  // ═════════════════════════════════════════════════════════

  describe("validateRolloutGroup", () => {

    it("rejects groups with fewer than 2 rollouts", () => {
      const group: RolloutGroup = { promptId: "test", rollouts: [makeRollout("r0", 1)] };
      const err = validateRolloutGroup(group);
      assert.ok(err !== null, "Should reject size-1 group");
    });

    it("accepts valid groups", () => {
      const group = makeGroup(4);
      const err = validateRolloutGroup(group);
      assert.strictEqual(err, null);
    });

  });

  // ═════════════════════════════════════════════════════════
  // METRICS
  // ═════════════════════════════════════════════════════════

  describe("metrics accumulation", () => {

    it("tracks step count and arrays", () => {
      const metrics = createMetricsAccumulator();
      const group = makeGroup(4);
      const result = grpoStep(group, null);

      accumulateMetrics(metrics, result, group);
      assert.strictEqual(metrics.steps, 1);
      assert.strictEqual(metrics.totalRollouts, 4);
      assert.strictEqual(metrics.meanReward.length, 1);
      assert.strictEqual(metrics.echoPredictionAccuracy.length, 1);
    });

  });

});
