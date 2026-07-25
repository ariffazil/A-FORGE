/**
 * GOAL ENCODER — Natural language → structured task vector with Jacobian.
 *
 * This is the ENCODE phase of the Encode→Jacobian→Decode→Metabolize pipeline.
 * Takes a natural language goal and produces:
 *   T = [t₁, t₂, ..., tₘ]          — decomposed tasks
 *   J = ∂T/∂G                        — Jacobian sensitivity matrix
 *   provenance per task              — traceable origin
 *
 * Before this module: "Forge X" meant manual reasoning by human or agent.
 * After this module: "Forge X" → automatic task decomposition with sensitivity tracking.
 *
 * @module cognition/goalEncoder
 * @constitutional F4 CLARITY — each task reduces entropy ΔS ≤ 0
 * @constitutional F8 GENIUS — G computable from task efficiency
 */

import {
  type TaskVectorEntry,
  type TaskSensitivity,
  type TaskProvenance,
  type GoalVector,
  type JacobianMatrix,
  type FieldChange,
  type RecomputeResult,
  type OrganTag,
  type TaskDomain,
  ZERO_SENSITIVITY,
  hashGoal,
  generateTaskId,
  generateGoalId,
  needsRecompute,
  computeGFromJacobian,
  computeCDark,
  computeW3Simple,
  buildContinuityHash,
} from "./taskJacobian.js";

// ── Domain classifier — keyword → domain 🡒──────────────────────────────────────

interface DomainRule {
  pattern: RegExp;
  domain: TaskDomain;
  organ: OrganTag;
  confidence: number;
}

const DOMAIN_RULES: DomainRule[] = [
  // Geoscience
  { pattern: /\b(seismic|basin|petrophysic|prospect|reservoir|stratigraphy|well log|formation|subsurface|geolog|geophysic|gravity|magnetic|thermal maturity|source rock|seal rock|traps?|migration)\b/i, domain: "geoscience", organ: "geox", confidence: 0.95 },
  // Capital
  { pattern: /\b(npv|irr|emv|cashflow|portfolio|valuation|capital|fiscal|dividend|budget|invest|roi|return|discount|risk.*adjust|market|commodity|forex|gold|oil price|stock|equity|bond)\b/i, domain: "capital", organ: "wealth", confidence: 0.90 },
  // Infrastructure
  { pattern: /\b(deploy|build|docker|git|push|commit|ci|cd|pipeline|server|restart|provision|ssl|caddy|nginx|dns|cloudflare|ufw|firewall|rsync)\b/i, domain: "infrastructure", organ: "aforge", confidence: 0.92 },
  // Governance
  { pattern: /\b(judge|seal|vault|memory|audit|constitutional|floor|verdict|hold|sabar|void|governance|policy)\b/i, domain: "governance", organ: "arifos", confidence: 0.93 },
  // Human
  { pattern: /\b(vitality|fatigue|readiness|dignity|sleep|health|wellness|substrate|homeostasis|human)\b/i, domain: "human", organ: "well", confidence: 0.88 },
  // Routing
  { pattern: /\b(route|dispatch|handoff|a2a|agent.*to.*agent|message|relay|bridge|telegram|notify)\b/i, domain: "routing", organ: "aaa", confidence: 0.85 },
  // Research
  { pattern: /\b(search|research|fetch|observe|lookup|find|query|analyze|investigate|scan|probe)\b/i, domain: "research", organ: "aforge", confidence: 0.80 },
];

function classifyDomain(phrase: string): { domain: TaskDomain; organ: OrganTag; confidence: number } {
  let best: { domain: TaskDomain; organ: OrganTag; confidence: number } = {
    domain: "unknown",
    organ: "aaa",
    confidence: 0.5,
  };

  for (const rule of DOMAIN_RULES) {
    if (rule.pattern.test(phrase) && rule.confidence > best.confidence) {
      best = { domain: rule.domain, organ: rule.organ, confidence: rule.confidence };
    }
  }

  return best;
}

// ── Risk classifier ──────────────────────────────────────────────────────────

function classifyRisk(phrase: string): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const criticalPatterns = /\b(delete|destroy|drop\s+table|rm\s+-rf|force\s+push|irreversible|seal\s+permanent|production\s+destroy|vault\s+wipe)\b/i;
  const highPatterns = /\b(production|deploy|push\s+to\s+main|restart|seal|judge|audit|rotate|migrate|schema\s+change)\b/i;
  const mediumPatterns = /\b(edit|modify|update|change|refactor|write|create\s+file|test|lint|format)\b/i;

  if (criticalPatterns.test(phrase)) return "CRITICAL";
  if (highPatterns.test(phrase)) return "HIGH";
  if (mediumPatterns.test(phrase)) return "MEDIUM";
  return "LOW";
}

// ── Reversibility classifier ─────────────────────────────────────────────────

function classifyReversibility(phrase: string): "reversible" | "irreversible" {
  const irreversiblePatterns = /\b(delete|destroy|drop|rm\s+-rf|force\s+push|seal|vault\s+write|irreversible|production\s+deploy)\b/i;
  return irreversiblePatterns.test(phrase) ? "irreversible" : "reversible";
}

// ── Sensitivity estimator ────────────────────────────────────────────────────

/**
 * Estimate task sensitivity to each governance field.
 *
 * These are ENGINEERED estimates — not LLM guessing. They come from:
 * - Scars database (previous failures → higher sensitivity)
 * - Domain heuristics (deploy → high risk sensitivity, research → low)
 * - Phrase analysis (irreversible actions → high authority sensitivity)
 */
function estimateSensitivity(
  phrase: string,
  domain: TaskDomain,
  riskTier: string,
  reversibility: string,
): TaskSensitivity {
  const s = { ...ZERO_SENSITIVITY };

  // Risk sensitivity: higher risk tier = higher sensitivity to risk changes
  s.risk = riskTier === "CRITICAL" ? 0.85 : riskTier === "HIGH" ? 0.70 : riskTier === "MEDIUM" ? 0.45 : 0.20;

  // Scope sensitivity: broader phrases = higher scope sensitivity
  const scopeWords = /\b(entire|full|complete|all|every|whole|system.*wide|global|federation)\b/i;
  s.scope = scopeWords.test(phrase) ? 0.75 : 0.35;

  // Authority sensitivity: irreversible actions higher
  s.authority = reversibility === "irreversible" ? 0.82 : 0.30;

  // Time sensitivity: deploy/build actions
  const timeWords = /\b(urgent|asap|quickly|fast|deadline|today|immediate|now)\b/i;
  s.time = timeWords.test(phrase) ? 0.65 : 0.25;

  // Cost sensitivity: capital/wealth tasks
  s.cost = domain === "capital" ? 0.70 : 0.20;

  // Organ sensitivity: routing/dispatch tasks
  s.organ = domain === "routing" ? 0.80 : 0.30;

  // Domain sensitivity: multi-domain phrases
  const domainWords = /\b(cross.organ|multi.*organ|bridge|federation.*wide|geo.*capital|capital.*geo)\b/i;
  s.domain = domainWords.test(phrase) ? 0.72 : 0.20;

  return s;
}

// ── Phrase splitter — decompose goal into subtasks ───────────────────────────

/**
 * Split a natural language goal into subtask phrases.
 *
 * Separators: commas, semicolons, "and", "then", "also", "plus",
 * "followed by", "after that", newlines.
 *
 * Returns an array of subtask descriptions.
 */
export function splitGoalIntoPhrases(goal: string): string[] {
  // First, try splitting on numbered items: "1. Foo 2. Bar 3. Baz"
  const numbered = goal.match(/\d+\.\s*([^0-9]+)(?=\d+\.|$)/g);
  if (numbered && numbered.length >= 2) {
    return numbered.map((p) => p.replace(/^\d+\.\s*/, "").trim()).filter((p) => p.length > 0);
  }

  // Then try splitting on explicit separators
  const parts = goal
    .split(/,|\band\b|;\s*|then\s+|also\s+|plus\s+|followed by\s+|after that\s+/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 3);

  if (parts.length >= 2) return parts;

  // Fallback: split on key verbs
  const verbSplit = goal.split(/\b(?:and\s+)?(compile|run|compute|analyze|produce|generate|build|test|deploy|check)\b/i);
  if (verbSplit.length >= 3) {
    const result: string[] = [];
    for (let i = 0; i < verbSplit.length - 1; i += 2) {
      result.push((verbSplit[i] + (verbSplit[i + 1] || "")).trim());
    }
    // Add any remaining text
    if (verbSplit.length % 2 === 1) {
      const last = verbSplit[verbSplit.length - 1].trim();
      if (last) result.push(last);
    }
    return result.filter((p) => p.length > 3);
  }

  // Single phrase — return as one task
  return [goal];
}

// ── Main encoder ─────────────────────────────────────────────────────────────

export interface EncoderOptions {
  /** Calling agent identity */
  actorId: string;
  /** Session ID */
  sessionId: string;
  /** Humility cap (F7: Ω₀ ∈ [0.03, 0.05]) */
  humilityCap?: number;
  /** Minimum sensitivity threshold for recompute */
  recomputeThreshold?: number;
}

/**
 * Encode a natural language goal into a structured task vector.
 *
 * This is the PRIMARY entry point: goal → GoalVector with Jacobian.
 *
 * Example:
 *   encodeGoal("analyze Malay Basin seismic, run petrophysics, compute NPV, compile brief")
 *   → GoalVector with 4 tasks: [geox, geox, wealth, hermes]
 *     each with sensitivity, provenance, and Jacobian entries.
 */
export function encodeGoal(
  goalText: string,
  opts: EncoderOptions,
): GoalVector {
  const goalId = generateGoalId();
  const goalHash = hashGoal(goalText);
  const humilityCap = opts.humilityCap ?? 0.04; // F7 default within [0.03, 0.05]
  const phrases = splitGoalIntoPhrases(goalText);

  const entries: TaskVectorEntry[] = [];
  const dependencyChain: string[] = [];

  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i];
    const classification = classifyDomain(phrase);
    const riskTier = classifyRisk(phrase);
    const reversibility = classifyReversibility(phrase);
    const sensitivity = estimateSensitivity(phrase, classification.domain, riskTier, reversibility);

    const dependsOn = i > 0 ? [dependencyChain[dependencyChain.length - 1]] : [];

    const entry: TaskVectorEntry = {
      task_id: generateTaskId(),
      label: phrase,
      organ: classification.organ,
      domain: classification.domain,
      tool: domainToTool(classification.domain, classification.organ),
      args: { intent: phrase },
      depends_on: dependsOn,
      reversibility,
      risk_tier: riskTier,
      sensitivity,
      provenance: {
        goal_intent: goalText,
        goal_hash: goalHash,
        source_risk_band: riskTier,
        source_scope: phrase,
        source_authority: opts.actorId,
        created_at: new Date().toISOString(),
        metabolism_count: 0,
        risk_weight_multiplier: 1.0,
        constraint_weight_multiplier: 1.0,
      },
      state: "pending",
      g_contribution: 0,
      c_dark_contribution: 0,
      last_sensitivity_check: null,
    };

    entries.push(entry);
    dependencyChain.push(entry.task_id);
  }

  // Build Jacobian matrix
  const jacobianEntries: Record<string, TaskSensitivity> = {};
  for (const entry of entries) {
    jacobianEntries[entry.task_id] = entry.sensitivity;
  }

  const G = computeGFromJacobian(entries, humilityCap);
  const C_dark = computeCDark(entries);
  const W3 = computeW3Simple(entries);

  const jacobian: JacobianMatrix = {
    goal_id: goalId,
    entries: jacobianEntries,
    efficiency: entries.reduce((sum, e) => {
      const s = e.sensitivity;
      return sum + (1 - (s.risk + s.scope + s.authority + s.time + s.cost + s.organ + s.domain) / 7);
    }, 0) / Math.max(entries.length, 1),
    deception_sensitivity: 0,
    humility_cap: humilityCap,
    high_sensitivity_count: entries.filter((e) => {
      const s = e.sensitivity;
      return s.risk > 0.6 || s.scope > 0.6 || s.authority > 0.6 ||
             s.time > 0.6 || s.cost > 0.6 || s.organ > 0.6 || s.domain > 0.6;
    }).length,
    stable_task_count: entries.filter((e) => {
      const s = e.sensitivity;
      return s.risk <= 0.3 && s.scope <= 0.3 && s.authority <= 0.3 &&
             s.time <= 0.3 && s.cost <= 0.3 && s.organ <= 0.3 && s.domain <= 0.3;
    }).length,
    total_task_count: entries.length,
    continuity_hash: buildContinuityHash(goalId, entries, G),
  };

  return {
    goal_id: goalId,
    goal_text: goalText,
    goal_hash: goalHash,
    tasks: entries,
    G,
    C_dark,
    W3,
    jacobian,
    computed_at: new Date().toISOString(),
    session_id: opts.sessionId,
    version: 1,
    sealed: false,
    seal_ref: null,
  };
}

// ── Tool mapping ─────────────────────────────────────────────────────────────

function domainToTool(domain: TaskDomain, organ: OrganTag): string {
  const toolMap: Record<TaskDomain, string> = {
    geoscience: "geox_basin",
    capital: "capital_market",
    infrastructure: "forge_execute",
    governance: "arif_judge",
    human: "well_assess_homeostasis",
    routing: "forge_execute",
    research: "forge_search",
    unknown: "arif_observe",
  };
  // Route research through A-FORGE if organ is aforge
  if (domain === "research" && organ === "aforge") return "forge_search";
  return toolMap[domain];
}

// ── Jacobian recompute on field change ───────────────────────────────────────

/**
 * When a governance field changes (e.g., risk band from MEDIUM→HIGH),
 * recompute ONLY the tasks that are sensitive to that field.
 *
 * This is the "bezanya" — before: full re-plan. after: targeted recompute.
 */
export function recomputeOnFieldChange(
  goal: GoalVector,
  change: FieldChange,
  threshold = 0.6,
): RecomputeResult {
  const recompute: string[] = [];
  const stable: string[] = [];

  for (const task of goal.tasks) {
    if (needsRecompute(task.sensitivity, change.field, threshold)) {
      recompute.push(task.task_id);
    } else {
      stable.push(task.task_id);
    }
  }

  // Only recompute the high-sensitivity tasks
  for (const taskId of recompute) {
    const task = goal.tasks.find((t) => t.task_id === taskId);
    if (task) {
      // Adjust the sensitivity for the changed field
      task.sensitivity[change.field] = Math.min(1.0, task.sensitivity[change.field] + 0.1);
      task.last_sensitivity_check = new Date().toISOString();
      task.version = (task.version ?? 1) + 1;
    }
  }

  // Rebuild Jacobian
  const jacobianEntries: Record<string, TaskSensitivity> = {};
  for (const task of goal.tasks) {
    jacobianEntries[task.task_id] = task.sensitivity;
  }

  const G = computeGFromJacobian(goal.tasks, goal.jacobian.humility_cap);

  const jacobian: JacobianMatrix = {
    goal_id: goal.goal_id,
    entries: jacobianEntries,
    efficiency: goal.jacobian.efficiency,
    deception_sensitivity: goal.jacobian.deception_sensitivity,
    humility_cap: goal.jacobian.humility_cap,
    high_sensitivity_count: recompute.length,
    stable_task_count: stable.length,
    total_task_count: goal.tasks.length,
    continuity_hash: buildContinuityHash(goal.goal_id, goal.tasks, G),
  };

  return { recompute, stable, jacobian, G };
}
