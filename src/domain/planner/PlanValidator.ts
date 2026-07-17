/**
 * PLAN VALIDATOR — enforces PLANNINGORGAN222 schema on every multi-step plan.
 *
 * Canonical organ: /root/AAA/docs/PLANNINGORGAN222.md
 * Epoch introduced: v2026.07.17
 * Invariant: Every plan MUST pass this validator before any forge_execute.
 *
 * DITEMPA BUKAN DIBERI — Planning is forged, not given.
 */
import type { PlanDAG, PlanNode, StructuralValidationResult } from '../types/plan.js';
import {
  readGovernanceCard,
  type ModelGovernanceCard,
} from '../governance/ModelCapabilityGate.js';

// ── Governance Card Verdict ──────────────────────────────────────────────────

export interface GovernanceVerdict {
  verdict: 'ALLOW' | 'HOLD' | 'BLOCK';
  reasons: string[];
}

export interface PlanValidatorConfig {
  maxDepth: number;
  maxBranchingFactor: number;
  maxComplexity: number;
  weights: {
    node: number;
    edge: number;
    depth: number;
    branching: number;
  };
}

// ── Action class extraction from plan ────────────────────────────────────────

const ACTION_CLASS_PATTERNS: Array<{ pattern: RegExp; class: string }> = [
  { pattern: /\b(delete|rm\s+-rf|DROP\s+TABLE|docker\s+system\s+prune|destroy)\b/i, class: 'irreversible_delete' },
  { pattern: /\b(git\s+push|push\s+to\s+remote|deploy)\b/i, class: 'git_push' },
  { pattern: /\b(seal|vault_seal|999_SEAL)\b/i, class: 'vault_seal' },
  { pattern: /\b(force\s+push|git\s+push\s+--force|force-deploy)\b/i, class: 'force_push' },
  { pattern: /\b(relay|webhook|telegram\s+send|external\s+notify|publish)\b/i, class: 'external_relay' },
  { pattern: /\b(commit|git\s+commit)\b/i, class: 'git_commit' },
  { pattern: /\b(deploy|ship|release)\b/i, class: 'deploy' },
];

function extractActionClasses(plan: PlanDAG): string[] {
  const actionClasses = new Set<string>();

  for (const node of plan.nodes.values()) {
    const goal = node.goal;
    for (const { pattern, class: actionClass } of ACTION_CLASS_PATTERNS) {
      if (pattern.test(goal)) {
        actionClasses.add(actionClass);
      }
    }
  }

  return Array.from(actionClasses);
}

function extractOverallRiskTier(plan: PlanDAG): string {
  const riskTiers: Array<{ weight: number; tier: string }> = [];
  for (const node of plan.nodes.values()) {
    const tier = node.epistemic?.riskTier ?? 'safe';
    riskTiers.push({ weight: 1, tier });
  }

  // Weighted: dangerous = 3, guarded = 2, safe = 1
  let maxScore = 0;
  let maxTier = 'safe';
  for (const { tier } of riskTiers) {
    const score = tier === 'dangerous' ? 3 : tier === 'guarded' ? 2 : 1;
    if (score > maxScore) {
      maxScore = score;
      maxTier = tier;
    }
  }
  return maxTier;
}

// ── Self-claim boundary validation ───────────────────────────────────────────

function checkSelfClaimBoundaries(
  plan: PlanDAG,
  card: ModelGovernanceCard,
): string[] {
  const reasons: string[] = [];

  // If model claims it cannot execute, and plan requires execution
  if (card.runtime_truth?.execution_mode === 'readonly') {
    const needsExecution = Array.from(plan.nodes.values()).some(
      (n) =>
        n.goal.toLowerCase().includes('execute') ||
        n.goal.toLowerCase().includes('deploy') ||
        n.goal.toLowerCase().includes('write') ||
        n.goal.toLowerCase().includes('commit'),
    );
    if (needsExecution) {
      reasons.push(
        `SELF_CLAIM_BOUNDARY: Model ${card.model_anchor?.model_variant ?? 'unknown'} claims readonly execution_mode but plan requires write/execute/deploy.`,
      );
    }
  }

  // Check file access boundaries
  if (card.runtime_truth?.side_effects_allowed === false) {
    const hasSideEffects = Array.from(plan.nodes.values()).some(
      (n) =>
        n.goal.toLowerCase().includes('write') ||
        n.goal.toLowerCase().includes('create') ||
        n.goal.toLowerCase().includes('modify') ||
        n.goal.toLowerCase().includes('delete') ||
        n.goal.toLowerCase().includes('deploy'),
    );
    if (hasSideEffects) {
      reasons.push(
        `SELF_CLAIM_BOUNDARY: Model governance card prohibits side effects but plan includes write/modify/delete operations.`,
      );
    }
  }

  // Check capabilities against plan needs
  if (card.capabilities) {
    const needsToolAccess = Array.from(plan.nodes.values()).some(
      (n) => n.goal.toLowerCase().includes('tool') || n.goal.toLowerCase().includes('mcp'),
    );
    if (needsToolAccess && card.capabilities.supports_tools === false) {
      reasons.push(
        `SELF_CLAIM_BOUNDARY: Plan requires tool access but model card reports supports_tools=false.`,
      );
    }
  }

  return reasons;
}

// ── Shadow profile violation check ───────────────────────────────────────────

function checkShadowViolations(card: ModelGovernanceCard): string[] {
  const reasons: string[] = [];

  if (card.drift_state === 'RED') {
    reasons.push('SHADOW_VIOLATION: Model governance spine reports RED drift state — no valid anchor. Execution blocked.');
  }

  if (card.drift_state === 'YELLOW') {
    reasons.push('SHADOW_ADVISORY: Model governance spine reports YELLOW drift — identity mismatch. Proceed with caution.');
  }

  if (!card.model_anchor?.identity_verified) {
    reasons.push('SHADOW_VIOLATION: Model identity not verified in governance spine.');
  }

  if (!card.model_anchor?.provider_key || !card.model_anchor?.family_key) {
    reasons.push('SHADOW_VIOLATION: Model provider/family key missing from governance card.');
  }

  return reasons;
}

// ── Risk leash validation ────────────────────────────────────────────────────

function checkRiskLeash(
  actionClasses: string[],
  card: ModelGovernanceCard,
  options?: { ackIrreversible?: boolean },
): string[] {
  const reasons: string[] = [];

  if (!card.risk_leash) return reasons;

  const requiresAck = card.risk_leash.requires_human_ack_for ?? [];
  const riskTier = card.risk_leash.risk_tier ?? 'bounded';

  for (const actionClass of actionClasses) {
    if (requiresAck.includes(actionClass) && !options?.ackIrreversible) {
      reasons.push(
        `RISK_LEASH: Action class "${actionClass}" requires human acknowledgment (model risk tier: ${riskTier}). Set ackIrreversible: true.`,
      );
    }
  }

  // Unbounded risk tier cannot execute guarded/dangerous plans
  if (riskTier === 'unbounded') {
    const riskyClasses = actionClasses.filter(
      (a) => ['deploy', 'git_push', 'force_push', 'vault_seal', 'irreversible_delete'].includes(a),
    );
    if (riskyClasses.length > 0) {
      reasons.push(
        `RISK_LEASH: Model risk tier is "${riskTier}" but plan contains risky action classes: ${riskyClasses.join(', ')}. Blocked.`,
      );
    }
  }

  return reasons;
}

// ── Main governance card verification ────────────────────────────────────────

/**
 * Verify that a model's governance card allows execution of this plan.
 *
 * Queries the arifOS kernel spine for the model's governance card and
 * validates the plan against:
 *   - Registry presence (model is known)
 *   - Risk leash constraints (action classes)
 *   - Self-claim boundaries (execution mode, side effects, capabilities)
 *   - Shadow profile (drift state, identity verification)
 *
 * @param modelId — The model identifier (e.g. "MiniMax-M3", "DeepSeek-V4-Pro")
 * @param plan — The plan DAG to validate
 * @param options — Optional runtime context (ackIrreversible, etc.)
 * @returns GovernanceVerdict with verdict and reasons
 */
export function verifyGovernanceCard(
  modelId: string,
  plan: PlanDAG,
  options?: { ackIrreversible?: boolean },
): GovernanceVerdict {
  const reasons: string[] = [];

  // 1. Read the governance card from the arifOS spine
  let card: ModelGovernanceCard | null;
  try {
    card = readGovernanceCard();
  } catch (err) {
    return {
      verdict: 'BLOCK',
      reasons: [
        `SPINE_READ_ERROR: Failed to read governance card for model "${modelId}": ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  // 2. Model not in registry
  if (!card) {
    return {
      verdict: 'BLOCK',
      reasons: [
        `MODEL_NOT_IN_REGISTRY: Model "${modelId}" has no governance card in the arifOS spine. Execution blocked until a governance card is registered.`,
      ],
    };
  }

  // 3. Model identity check
  const cardModelVariant = card.model_anchor?.model_variant ?? '';
  const cardProvider = card.model_anchor?.provider_key ?? '';
  if (!cardModelVariant && !cardProvider) {
    reasons.push(
      `IDENTITY_GAP: Governance card exists but model_anchor is empty — possible spine corruption.`,
    );
  }

  // 4. Shadow profile violations
  const shadowReasons = checkShadowViolations(card);
  reasons.push(...shadowReasons);

  // BLOCK-level shadow violations
  const hasBlockShadow = shadowReasons.some((r) =>
    r.startsWith('SHADOW_VIOLATION:'),
  );
  if (hasBlockShadow) {
    return { verdict: 'BLOCK', reasons };
  }

  // 5. Extract action classes from plan
  const actionClasses = extractActionClasses(plan);
  const overallRisk = extractOverallRiskTier(plan);

  // 6. Risk leash check
  const riskLeashReasons = checkRiskLeash(actionClasses, card, options);
  reasons.push(...riskLeashReasons);

  // 7. Self-claim boundary check
  const boundaryReasons = checkSelfClaimBoundaries(plan, card);
  reasons.push(...boundaryReasons);

  // ── Determine final verdict ──────────────────────────────────────────────

  // Any BLOCK-level reason → BLOCK
  const blockReasons = reasons.filter(
    (r) =>
      r.startsWith('SELF_CLAIM_BOUNDARY:') &&
      !r.includes('Proceed with caution'),
  );
  const holdReasons = reasons.filter(
    (r) =>
      r.startsWith('RISK_LEASH:') ||
      r.startsWith('SHADOW_ADVISORY:'),
  );

  if (blockReasons.length > 0) {
    return { verdict: 'BLOCK', reasons };
  }

  if (holdReasons.length > 0) {
    return { verdict: 'HOLD', reasons };
  }

  // GREEN — all clear
  if (reasons.length === 0) {
    reasons.push(
      `GOVERNANCE_CARD_PASS: Model "${cardModelVariant || modelId}" (provider: ${cardProvider || 'unknown'}) registered, risk leash satisfied, no boundary violations. Plan risk tier: ${overallRisk}.`,
    );
  }

  return { verdict: 'ALLOW', reasons };
}

// ── ACT Pattern Integration ──────────────────────────────────────────────────
// After governance card passes, select and validate the ACT execution pattern.

import { selectPattern, validatePlanAgainstPattern, type ActPattern, type ActStage, ACT_PATTERNS } from "../governance/ActPatterns.js";

export interface ActPatternVerdict {
  patternId: string;
  patternName: string;
  stages: number;
  confidence: number;
  warnings: string[];
  humanRequired: boolean;
  compensationPlan: string;
}

/**
 * Select the best ACT execution pattern for this plan.
 * Called AFTER verifyGovernanceCard returns ALLOW.
 *
 * @param blastRadius — "low" | "medium" | "high" | "unknown"
 * @param irreversible — does the plan contain irreversible actions?
 * @param stageCount — number of discrete steps in the plan
 * @param hasCompensationPlan — does the plan define rollback?
 * @param humanAvailable — is F13 reachable?
 * @returns ActPatternVerdict with pattern details and warnings
 */
export function selectActPattern(
  blastRadius: string,
  irreversible: boolean,
  stageCount: number,
  hasCompensationPlan: boolean = false,
  humanAvailable: boolean = true,
): ActPatternVerdict {
  const result = selectPattern({
    blastRadius: blastRadius as "low" | "medium" | "high" | "unknown",
    irreversible,
    stageCount,
    hasCompensationPlan,
    humanAvailable,
  });

  const planErrors = validatePlanAgainstPattern(
    result.pattern,
    1,                    // current stage
    result.pattern.stages.length,  // total stages
  );

  return {
    patternId: result.pattern.id,
    patternName: result.pattern.name,
    stages: result.pattern.stages.length,
    confidence: result.confidence,
    warnings: [...result.warnings, ...planErrors],
    humanRequired: result.pattern.stages.some((s: ActStage) => s.humanCheckpoint),
    compensationPlan: result.pattern.compensation.description,
  };
}

/**
 * Return all registered ACT patterns (for discovery / documentation).
 */
export function listActPatterns(): Array<{ id: string; name: string; description: string }> {
  return ACT_PATTERNS.map((p: ActPattern) => ({
    id: p.id,
    name: p.name,
    description: p.description,
  }));
}


// ── PlanValidator (Structural) ───────────────────────────────────────────────

export class PlanValidator {
  private readonly config: PlanValidatorConfig;

  constructor(config?: Partial<PlanValidatorConfig>) {
    this.config = {
      maxDepth: 50,
      maxBranchingFactor: 20,
      maxComplexity: 1000,
      weights: {
        node: 1.0,
        edge: 1.5,
        depth: 2.0,
        branching: 5.0,
      },
      ...config,
    };
  }

  public validate(dag: PlanDAG): StructuralValidationResult {
    const errors: string[] = [];
    
    // 1. Root Integrity
    const rootIntegrity = this.validateRoot(dag, errors);
    
    // 2. Dependency Validity (Existential)
    const dependenciesValid = this.validateDependenciesExist(dag, errors);
    
    // 3. Acyclic Check
    const isAcyclic = this.checkAcyclic(dag, errors);
    
    // 4. Reachability & Structural Stats
    const stats = this.analyzeStructure(dag, errors);

    // Final decision
    const isValid = 
      rootIntegrity && 
      dependenciesValid && 
      isAcyclic && 
      stats.reachability === 1.0 &&
      stats.maxDepth <= this.config.maxDepth &&
      stats.maxBranchingFactor <= this.config.maxBranchingFactor &&
      stats.complexityScore <= this.config.maxComplexity;

    if (stats.reachability < 1.0) errors.push(`Structural leak: Only ${Math.round(stats.reachability * 100)}% of nodes are reachable from root.`);
    if (stats.maxDepth > this.config.maxDepth) errors.push(`Max depth exceeded: ${stats.maxDepth} > ${this.config.maxDepth}`);
    if (stats.maxBranchingFactor > this.config.maxBranchingFactor) errors.push(`Max branching factor exceeded: ${stats.maxBranchingFactor} > ${this.config.maxBranchingFactor}`);
    if (stats.complexityScore > this.config.maxComplexity) errors.push(`Complexity score too high: ${stats.complexityScore.toFixed(2)} > ${this.config.maxComplexity}`);

    return {
      isValid,
      isAcyclic,
      rootIntegrity,
      dependenciesValid,
      reachability: stats.reachability,
      maxDepth: stats.maxDepth,
      maxBranchingFactor: stats.maxBranchingFactor,
      complexityScore: stats.complexityScore,
      errors
    };
  }

  private validateRoot(dag: PlanDAG, errors: string[]): boolean {
    if (!dag.rootId) {
      errors.push("Root ID missing.");
      return false;
    }
    const rootNode = dag.nodes.get(dag.rootId);
    if (!rootNode) {
      errors.push(`Root node '${dag.rootId}' not found in Map.`);
      return false;
    }

    // A root node in our dependency-inward DAG is the node that NO other node depends on
    for (const [id, node] of dag.nodes) {
      if (id === dag.rootId) continue;
      if (node.dependencies.includes(dag.rootId)) {
        errors.push(`Integrity breach: Node '${id}' depends on root node.`);
        return false;
      }
    }
    return true;
  }

  private validateDependenciesExist(dag: PlanDAG, errors: string[]): boolean {
    let allExist = true;
    for (const [id, node] of dag.nodes) {
      for (const depId of node.dependencies) {
        if (!dag.nodes.has(depId)) {
          errors.push(`Phantom dependency: Node '${id}' depends on non-existent node '${depId}'.`);
          allExist = false;
        }
      }
    }
    return allExist;
  }

  private checkAcyclic(dag: PlanDAG, errors: string[]): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const node = dag.nodes.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          if (!visited.has(depId)) {
            if (hasCycle(depId)) return true;
          } else if (recStack.has(depId)) {
            return true;
          }
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const nodeId of dag.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (hasCycle(nodeId)) {
          errors.push("Circular dependency detected.");
          return false;
        }
      }
    }
    return true;
  }

  private analyzeStructure(dag: PlanDAG, errors: string[]) {
    // Reverse adjacency list (Who depends on me?)
    const dependents = new Map<string, string[]>();
    dag.nodes.forEach((node, id) => {
      node.dependencies.forEach(depId => {
        if (!dependents.has(depId)) dependents.set(depId, []);
        dependents.get(depId)!.push(id);
      });
    });

    // Reachability from root (traversing backwards through dependencies)
    const reachable = new Set<string>();
    const queue: string[] = [dag.rootId];
    reachable.add(dag.rootId);

    let maxDepth = 0;
    const depthMap = new Map<string, number>();
    depthMap.set(dag.rootId, 1);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentDepth = depthMap.get(currentId)!;
      maxDepth = Math.max(maxDepth, currentDepth);

      const node = dag.nodes.get(currentId);
      if (node) {
        for (const depId of node.dependencies) {
          if (!reachable.has(depId)) {
            reachable.add(depId);
            depthMap.set(depId, currentDepth + 1);
            queue.push(depId);
          }
        }
      }
    }

    const reachability = dag.nodes.size > 0 ? reachable.size / dag.nodes.size : 1.0;
    
    let maxBranching = 0;
    let totalEdges = 0;
    dag.nodes.forEach(node => {
      maxBranching = Math.max(maxBranching, node.dependencies.length);
      totalEdges += node.dependencies.length;
    });

    const complexityScore = 
      (this.config.weights.node * dag.nodes.size) +
      (this.config.weights.edge * totalEdges) +
      (this.config.weights.depth * maxDepth) +
      (this.config.weights.branching * maxBranching);

    return {
      reachability,
      maxDepth,
      maxBranchingFactor: maxBranching,
      complexityScore
    };
  }
}
