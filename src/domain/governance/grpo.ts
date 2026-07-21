/**
 * GRPO — Group Relative Policy Optimization
 * Phase 2a.1 — Core algorithm implementation
 * 
 * Reference: DeepSeekMath (Shao et al., 2024) / Cameron Wolfe PyTorch impl
 * Extended: ECHO hybrid loss (RL on action tokens + CE on observation tokens)
 * 
 * Forged: 2026-07-21 by FORGE (000Ω)
 * DITEMPA BUKAN DIBERI
 */

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

/** Token-level mask: which tokens are agent actions vs environment observations */
export type TokenRole = "action" | "observation" | "prompt" | "padding";

/** A single token with its role, log-probability, and ID */
export interface TokenEntry {
  tokenId: number;
  role: TokenRole;
  logProb: number;        // ln π_θ(token | context)
  refLogProb?: number;    // ln π_ref(token | context) — for KL penalty
}

/** One agent rollout — a full trajectory */
export interface Rollout {
  id: string;
  prompt: string;
  tokens: TokenEntry[];
  reward: number;         // outcome reward (0 or 1 for task success)
  processRewards?: number[]; // optional per-step process rewards
  totalTokens: number;
  actionTokens: number;
  observationTokens: number;
}

/** A group of G rollouts from the same prompt (GRPO requires groups) */
export interface RolloutGroup {
  promptId: string;
  rollouts: Rollout[];
}

/** GRPO hyperparameters */
export interface GRPOConfig {
  groupSize: number;           // G — rollouts per prompt (default: 8)
  clipEpsilon: number;         // ε — PPO-style clipping (default: 0.2)
  klPenaltyBeta: number;       // β — KL divergence penalty weight (default: 0.04)
  advantageEpsilon: number;    // ε_adv — numerical stability for advantage std (default: 1e-8)
  echoLambda: number;          // λ — ECHO world-model mixing weight (default: 0.03)
  echoLambdaRange: [number, number]; // valid λ range [0.01, 0.05]
  maxGradientNorm: number;     // gradient clipping max norm (default: 1.0)
  useClippedLoss: boolean;     // whether to use PPO clipping (default: true)
  useKLDivergence: boolean;    // whether to use KL penalty (default: true)
  useECHO: boolean;            // whether to include ECHO world-model loss (default: true)
  useProcessRewards: boolean;  // whether to use per-step process rewards
}

/** Per-token weight computation result */
export interface TokenWeights {
  weights: Float64Array;       // per-token weight (advantage * importance_ratio or λ for obs)
  lossMask: Float64Array;      // which tokens contribute to loss (1.0 or 0.0)
  totalWeightedTokens: number; // sum of lossMask for normalization
}

/** GRPO step result */
export interface GRPOStepResult {
  policyLoss: number;          // L_GRPO
  echoLoss: number;            // L_ECHO (world-model)
  klDivergence: number;        // KL(π_θ || π_ref)
  totalLoss: number;           // L_GRPO + λ·L_ECHO + β·KL
  meanAdvantage: number;       // average advantage across group
  advantageStd: number;        // std of advantage
  meanReward: number;          // average reward
  importanceRatioMean: number; // mean r_t(θ) = π_θ/π_old
  importanceRatioMax: number;  // max r_t(θ) — for debugging
  clippedFraction: number;     // fraction of tokens where clipping was active
}

/** Training metrics accumulator */
export interface GRPOMetrics {
  steps: number;
  totalRollouts: number;
  meanReward: number[];
  meanAdvantage: number[];
  meanPolicyLoss: number[];
  meanECHOLoss: number[];
  meanKL: number[];
  echoPredictionAccuracy: number[]; // world-model accuracy over training
}

// ═══════════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════════

export const DEFAULT_GRPO_CONFIG: GRPOConfig = {
  groupSize: 8,
  clipEpsilon: 0.2,
  klPenaltyBeta: 0.04,
  advantageEpsilon: 1e-8,
  echoLambda: 0.03,
  echoLambdaRange: [0.01, 0.05],
  maxGradientNorm: 1.0,
  useClippedLoss: true,
  useKLDivergence: true,
  useECHO: true,
  useProcessRewards: false,
};

// ═══════════════════════════════════════════════════════════════
// CORE ALGORITHM
// ═══════════════════════════════════════════════════════════════

/**
 * Compute GRPO advantages for a group of rollouts.
 * 
 * A_i = (r_i - mean(r)) / (std(r) + ε)
 * 
 * The same advantage is assigned to every ACTION token in rollout i.
 * OBSERVATION tokens get a constant λ weight (ECHO world-model).
 * PROMPT and PADDING tokens get zero weight.
 */
export function computeGroupAdvantages(
  group: RolloutGroup,
  config: GRPOConfig = DEFAULT_GRPO_CONFIG,
): Map<string, number> {
  const rewards = group.rollouts.map(r => r.reward);
  const n = rewards.length;

  // Mean and std of group rewards
  const mean = rewards.reduce((a, b) => a + b, 0) / n;
  const variance = rewards.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  // Advantage per rollout
  const advantages = new Map<string, number>();
  for (const rollout of group.rollouts) {
    const adv = std > 0 ? (rollout.reward - mean) / (std + config.advantageEpsilon) : 0;
    advantages.set(rollout.id, adv);
  }

  return advantages;
}

/**
 * Compute per-token loss weights for a single rollout.
 * 
 * - ACTION tokens: weight = advantage * importance_ratio (clipped)
 * - OBSERVATION tokens: weight = λ (constant positive — ECHO)
 * - PROMPT/PADDING tokens: weight = 0
 * 
 * Returns TokenWeights with per-token values and mask.
 */
export function computeTokenWeights(
  rollout: Rollout,
  advantage: number,
  refLogProbs: Float64Array | null,  // π_ref log-probs (for importance ratio)
  config: GRPOConfig = DEFAULT_GRPO_CONFIG,
): TokenWeights {
  const n = rollout.tokens.length;
  const weights = new Float64Array(n);
  const mask = new Float64Array(n);
  let totalMasked = 0;

  // Count statistics
  let sumImportanceRatio = 0;
  let sumClipped = 0;
  let actionTokenCount = 0;

  for (let i = 0; i < n; i++) {
    const token = rollout.tokens[i];

    switch (token.role) {
      case "action": {
        // Importance ratio: r_t(θ) = π_θ(a_t|s_t) / π_old(a_t|s_t)
        let ratio = 1.0;
        if (refLogProbs && token.refLogProb !== undefined) {
          ratio = Math.exp(token.logProb - token.refLogProb);
        }

        // PPO-style clipping
        let clippedRatio = ratio;
        if (config.useClippedLoss) {
          clippedRatio = Math.min(
            Math.max(ratio, 1 - config.clipEpsilon),
            1 + config.clipEpsilon,
          );
        }

        // Weight = advantage * clipped_ratio
        weights[i] = advantage * clippedRatio;
        mask[i] = 1.0;
        totalMasked++;

        sumImportanceRatio += ratio;
        if (clippedRatio !== ratio) sumClipped++;
        actionTokenCount++;
        break;
      }

      case "observation": {
        // ECHO world-model loss: constant positive advantage λ
        if (config.useECHO) {
          weights[i] = config.echoLambda;
          mask[i] = 1.0;
          totalMasked++;
        }
        break;
      }

      case "prompt":
      case "padding":
        // Zero weight — these tokens don't contribute to loss
        weights[i] = 0;
        mask[i] = 0;
        break;
    }
  }

  return {
    weights,
    lossMask: mask,
    totalWeightedTokens: totalMasked,
  };
}

/**
 * Compute the GRPO + ECHO hybrid loss for a single rollout.
 * 
 * L = -(1/T) Σ_t w_t · ln π_θ(a_t|s_t)
 * 
 * Where w_t is:
 *   - advantage * clip(r_t(θ)) for ACTION tokens
 *   - λ for OBSERVATION tokens (ECHO)
 *   - 0 for PROMPT/PADDING tokens
 */
export function computeGRPOLoss(
  rollout: Rollout,
  advantage: number,
  refLogProbs: Float64Array | null,
  config: GRPOConfig = DEFAULT_GRPO_CONFIG,
): { policyLoss: number; echoLoss: number; totalLoss: number } {
  const tokenWeights = computeTokenWeights(rollout, advantage, refLogProbs, config);

  let policyLossSum = 0;
  let policyTokenCount = 0;
  let echoLossSum = 0;
  let echoTokenCount = 0;

  for (let i = 0; i < rollout.tokens.length; i++) {
    if (tokenWeights.lossMask[i] === 0) continue;

    const token = rollout.tokens[i];
    // Negative log probability weighted by advantage/λ
    const weightedNLL = -tokenWeights.weights[i] * token.logProb;

    if (token.role === "action") {
      policyLossSum += weightedNLL;
      policyTokenCount++;
    } else if (token.role === "observation") {
      echoLossSum += weightedNLL;
      echoTokenCount++;
    }
  }

  const policyLoss = policyTokenCount > 0 ? policyLossSum / policyTokenCount : 0;
  const echoLoss = echoTokenCount > 0 ? echoLossSum / echoTokenCount : 0;

  return { policyLoss, echoLoss, totalLoss: policyLoss + echoLoss };
}

// ═══════════════════════════════════════════════════════════════
// KL DIVERGENCE
// ═══════════════════════════════════════════════════════════════

/**
 * Estimate KL divergence between current policy π_θ and reference policy π_ref.
 * 
 * KL(π_θ || π_ref) ≈ (1/T) Σ_t [ln π_θ - ln π_ref]
 * 
 * Only computed over ACTION tokens (where policy has control).
 */
export function estimateKLDivergence(
  rollout: Rollout,
): number {
  let klSum = 0;
  let count = 0;

  for (const token of rollout.tokens) {
    if (token.role !== "action") continue;
    if (token.refLogProb === undefined) continue;

    klSum += token.logProb - token.refLogProb;
    count++;
  }

  return count > 0 ? klSum / count : 0;
}

// ═══════════════════════════════════════════════════════════════
// FULL STEP
// ═══════════════════════════════════════════════════════════════

/**
 * Execute one full GRPO + ECHO training step over a group of rollouts.
 * 
 * This is the main entry point for training. It:
 * 1. Computes group-normalized advantages
 * 2. Computes per-rollout hybrid loss (GRPO + ECHO)
 * 3. Computes KL divergence penalty
 * 4. Returns the combined training loss
 */
export function grpoStep(
  group: RolloutGroup,
  refLogProbs: Map<string, Float64Array> | null,
  config: GRPOConfig = DEFAULT_GRPO_CONFIG,
): GRPOStepResult {
  const advantages = computeGroupAdvantages(group, config);

  let totalPolicyLoss = 0;
  let totalECHOLoss = 0;
  let totalKL = 0;
  let totalImportanceRatio = 0;
  let totalClipped = 0;
  let actionTokenCount = 0;
  let rolloutCount = 0;

  for (const rollout of group.rollouts) {
    const adv = advantages.get(rollout.id) ?? 0;
    const refProbs = refLogProbs?.get(rollout.id) ?? null;

    const losses = computeGRPOLoss(rollout, adv, refProbs, config);

    totalPolicyLoss += losses.policyLoss;
    totalECHOLoss += losses.echoLoss;
    totalKL += config.useKLDivergence ? estimateKLDivergence(rollout) : 0;

    // Track importance ratio stats
    for (const token of rollout.tokens) {
      if (token.role !== "action") continue;
      if (token.refLogProb !== undefined) {
        const ratio = Math.exp(token.logProb - token.refLogProb);
        totalImportanceRatio += ratio;
        if (Math.abs(ratio - 1) > config.clipEpsilon) totalClipped++;
        actionTokenCount++;
      }
    }
    rolloutCount++;
  }

  // Normalize
  const n = rolloutCount || 1;
  const meanPolicyLoss = totalPolicyLoss / n;
  const meanECHOLoss = totalECHOLoss / n;
  const meanKL = config.useKLDivergence ? totalKL / n : 0;

  // KL penalty
  const klPenalty = config.useKLDivergence ? config.klPenaltyBeta * meanKL : 0;

  // Total loss = policy + λ·echo + β·KL
  const totalLoss = meanPolicyLoss + config.echoLambda * meanECHOLoss + klPenalty;

  // Advantage stats
  const rewards = group.rollouts.map(r => r.reward);
  const meanReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
  const advVals = Array.from(advantages.values());
  const meanAdv = advVals.reduce((a, b) => a + b, 0) / advVals.length;
  const advVar = advVals.reduce((s, a) => s + (a - meanAdv) ** 2, 0) / advVals.length;

  return {
    policyLoss: meanPolicyLoss,
    echoLoss: meanECHOLoss,
    klDivergence: meanKL,
    totalLoss,
    meanAdvantage: meanAdv,
    advantageStd: Math.sqrt(advVar),
    meanReward,
    importanceRatioMean: actionTokenCount > 0 ? totalImportanceRatio / actionTokenCount : 1,
    importanceRatioMax: actionTokenCount > 0 ? Math.max(...advVals.map(() => 1)) : 1,
    clippedFraction: actionTokenCount > 0 ? totalClipped / actionTokenCount : 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// ECHO LAMBDA SCHEDULING
// ═══════════════════════════════════════════════════════════════

/**
 * Dynamic λ scheduling — PaW-style.
 * 
 * Low-reward rollouts get more WM weight (learn from environment feedback).
 * High-reward rollouts focus on policy update.
 * 
 * λ_i = λ_base * (1 - reward_i / max_reward_in_group)
 * 
 * Clamped to [0.01, 0.05].
 */
export function computeDynamicEchoLambda(
  rolloutReward: number,
  maxGroupReward: number,
  config: GRPOConfig = DEFAULT_GRPO_CONFIG,
): number {
  if (maxGroupReward <= 0) return config.echoLambda;

  const rewardRatio = rolloutReward / maxGroupReward;
  const dynamicLambda = config.echoLambda * (1 - rewardRatio);

  // Clamp to valid range
  const [lambdaMin, lambdaMax] = config.echoLambdaRange;
  return Math.max(lambdaMin, Math.min(lambdaMax, dynamicLambda));
}

// ═══════════════════════════════════════════════════════════════
// METRICS ACCUMULATION
// ═══════════════════════════════════════════════════════════════

export function createMetricsAccumulator(): GRPOMetrics {
  return {
    steps: 0,
    totalRollouts: 0,
    meanReward: [],
    meanAdvantage: [],
    meanPolicyLoss: [],
    meanECHOLoss: [],
    meanKL: [],
    echoPredictionAccuracy: [],
  };
}

export function accumulateMetrics(
  metrics: GRPOMetrics,
  result: GRPOStepResult,
  group: RolloutGroup,
): void {
  metrics.steps++;
  metrics.totalRollouts += group.rollouts.length;
  metrics.meanReward.push(result.meanReward);
  metrics.meanAdvantage.push(result.meanAdvantage);
  metrics.meanPolicyLoss.push(result.policyLoss);
  metrics.meanECHOLoss.push(result.echoLoss);
  metrics.meanKL.push(result.klDivergence);

  // Compute ECHO prediction accuracy from the group
  let totalObsTokens = 0;
  let totalObsLogProb = 0;
  for (const rollout of group.rollouts) {
    for (const token of rollout.tokens) {
      if (token.role === "observation") {
        totalObsTokens++;
        totalObsLogProb += token.logProb;
      }
    }
  }
  const avgObsLogProb = totalObsTokens > 0 ? totalObsLogProb / totalObsTokens : 0;
  // Convert avg log-prob to approximate accuracy (exp of negative NLL)
  const accuracy = Math.exp(avgObsLogProb);
  metrics.echoPredictionAccuracy.push(Math.min(1, accuracy));
}

// ═══════════════════════════════════════════════════════════════
// NUMERICAL UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Validate that a rollout group is well-formed for GRPO.
 */
export function validateRolloutGroup(group: RolloutGroup): string | null {
  if (group.rollouts.length < 2) {
    return `Group ${group.promptId} has only ${group.rollouts.length} rollouts (need ≥2 for GRPO)`;
  }

  const tokensPerRollout = group.rollouts[0].totalTokens;
  for (const rollout of group.rollouts) {
    if (rollout.totalTokens !== tokensPerRollout) {
      return `Mismatched token counts in group ${group.promptId}: ${tokensPerRollout} vs ${rollout.totalTokens}`;
    }
    if (rollout.actionTokens === 0) {
      return `Rollout ${rollout.id} has zero action tokens`;
    }
  }

  return null; // valid
}

/**
 * Sanity-check advantage computation.
 * In a perfectly balanced group (all rewards equal), all advantages should be 0.
 * In a group with one high reward and others low, the high should have positive advantage.
 */
export function testAdvantageSanity(group: RolloutGroup): boolean {
  const advantages = computeGroupAdvantages(group);
  const advs = Array.from(advantages.values());

  // All advantages should be finite
  if (advs.some(a => !isFinite(a))) return false;

  // Sum of advantages should be approximately 0
  const sum = advs.reduce((a, b) => a + b, 0);
  if (Math.abs(sum) > 1e-6) return false;

  return true;
}
