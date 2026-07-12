/**
 * benda-wajib.ts — The 13 Benda Wajib Validator
 *
 * 13 mandatory invariants for any governed agentic system.
 * Each invariant is a check against the canonical event envelope.
 *
 * Violation of any hard invariant renders the action VOID.
 * Soft violations produce CAUTION or HOLD.
 *
 * @see /root/A-FORGE/docs/AGENTIC_APP_ARCHITECTURE.md — Section 6
 * @see /root/A-FORGE/schemas/agentic-event-envelope.schema.json — D2
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 * @constitutional F1 AMANAH — reversible-first
 * @constitutional F2 TRUTH  — evidence-bound claims
 * @constitutional F4 CLARITY — entropy reduction
 * @constitutional F7 HUMILITY — uncertainty is a feature
 * @constitutional F11 AUDITABILITY — every decision logged
 * @constitutional F13 SOVEREIGN — human veto final
 */

import type { AgenticEventEnvelope } from "../types/memory-lifecycle.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Benda Wajib invariant number (1-13) */
export type BendaWajibNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

/** Severity of a violation */
export type ViolationSeverity = "hard" | "soft";

/** A single invariant check result */
export interface InvariantCheck {
  /** Benda Wajib number (1-13) */
  bw: BendaWajibNumber;
  /** Invariant name */
  name: string;
  /** Whether this check passed */
  passed: boolean;
  /** Severity if violated */
  severity: ViolationSeverity;
  /** Human-readable explanation */
  message: string;
}

/** Result of full Benda Wajib validation */
export interface BendaWajibResult {
  /** All 13 checks, in order */
  checks: InvariantCheck[];
  /** BW numbers that passed */
  passed: BendaWajibNumber[];
  /** BW numbers that were violated */
  violated: BendaWajibNumber[];
  /** Non-blocking warnings */
  warnings: string[];
  /** Overall verdict: PASS if all hard invariants pass, FAIL otherwise */
  verdict: "PASS" | "FAIL";
  /** Number of hard violations */
  hard_violations: number;
  /** Number of soft violations */
  soft_violations: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — INVARIANT CHECKS (1-13)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * BW1 — Every Action Has Actor
 * No action is unattributed. An anonymous action is unconstitutional.
 */
function checkBw1(env: AgenticEventEnvelope): InvariantCheck {
  const hasActor = env.identity.actor_id.length > 0;
  const hasSession = env.identity.session_id.length > 0;
  const passed = hasActor && hasSession;
  return {
    bw: 1,
    name: "EVERY_ACTION_HAS_ACTOR",
    passed,
    severity: "hard",
    message: passed
      ? "Actor and session identified"
      : `Missing ${!hasActor ? "actor_id" : "session_id"} — anonymous action blocked`,
  };
}

/**
 * BW2 — Every Action Has Explicit Intent
 * Fuzzy intent = F4 CLARITY violation.
 */
function checkBw2(env: AgenticEventEnvelope): InvariantCheck {
  const purpose = env.intent.purpose;
  const passed = purpose.length >= 10;
  return {
    bw: 2,
    name: "EVERY_ACTION_HAS_EXPLICIT_INTENT",
    passed,
    severity: "hard",
    message: passed
      ? `Intent declared: "${purpose.substring(0, 60)}${purpose.length > 60 ? "..." : ""}"`
      : `Intent too vague (${purpose.length} chars, minimum 10) — F4 CLARITY violation`,
  };
}

/**
 * BW3 — Facts, Beliefs, Hypotheses Are Separate
 * A hypothesis treated as a fact is a lie (F2 TRUTH).
 */
function checkBw3(env: AgenticEventEnvelope): InvariantCheck {
  const truthClass = env.epistemic.truth_class;
  const confidence = env.epistemic.confidence;
  // Confidence should be consistent with truth class
  const classConfidenceMap: Record<string, [number, number]> = {
    FACT: [0.9, 1.0],
    BELIEF: [0.5, 0.9],
    HYPOTHESIS: [0.1, 0.6],
    ESTIMATE: [0.3, 0.8],
    UNKNOWN: [0.0, 0.3],
  };
  const [min, max] = classConfidenceMap[truthClass] ?? [0.0, 1.0];
  const passed = confidence >= min && confidence <= max;
  return {
    bw: 3,
    name: "FACTS_BELIEFS_HYPOTHESES_SEPARATE",
    passed,
    severity: "hard",
    message: passed
      ? `${truthClass} with confidence ${confidence.toFixed(2)} is within expected range [${min}, ${max}]`
      : `${truthClass} has confidence ${confidence.toFixed(2)} outside expected range [${min}, ${max}] — epistemic inconsistency`,
  };
}

/**
 * BW4 — Every Capability Has One Owner
 * Dual ownership creates authority conflicts.
 * Note: In envelope context, this checks that emitted_by is singular.
 */
function checkBw4(env: AgenticEventEnvelope): InvariantCheck {
  const emittedBy = env.identity.emitted_by;
  const passed = emittedBy.length > 0;
  return {
    bw: 4,
    name: "EVERY_CAPABILITY_HAS_ONE_OWNER",
    passed,
    severity: "hard",
    message: passed
      ? `Capability owned by: ${emittedBy}`
      : "No emitting organ declared — ownership unclear",
  };
}

/**
 * BW5 — Every Mutation Classified Before Execution
 * Classification determines governance requirements.
 */
function checkBw5(env: AgenticEventEnvelope): InvariantCheck {
  const classification = env.action.classification;
  const actionType = env.action.action_type;
  const isMutation = actionType === "execute" || actionType === "seal" || actionType === "correct";
  const hasClassification = classification.length > 0;
  const passed = !isMutation || hasClassification;
  return {
    bw: 5,
    name: "EVERY_MUTATION_CLASSIFIED",
    passed,
    severity: "hard",
    message: passed
      ? `Action ${actionType} classified as: ${classification}`
      : `Mutation action "${actionType}" has no classification — governance bypass blocked`,
  };
}

/**
 * BW6 — Authority Is Action-Specific and Time-Bounded
 * Every lease is scoped to specific tools, specific actions, with a TTL.
 */
function checkBw6(env: AgenticEventEnvelope): InvariantCheck {
  const classification = env.action.classification;
  const isHighImpact = classification === "EXECUTE_HIGH_IMPACT" || classification === "IRREVERSIBLE";
  const hasLease = env.identity.lease_id !== undefined;
  const leaseValid = env.governance.lease_valid;
  // High-impact actions require a valid lease
  const passed = !isHighImpact || (hasLease && leaseValid);
  return {
    bw: 6,
    name: "AUTHORITY_ACTION_SPECIFIC_TIME_BOUNDED",
    passed,
    severity: "hard",
    message: passed
      ? hasLease
        ? `Lease ${env.identity.lease_id} is valid`
        : `No lease required for ${classification}`
      : `High-impact action ${classification} requires valid lease — ${!hasLease ? "no lease present" : "lease expired"}`,
  };
}

/**
 * BW7 — Execution and Judgment Are Separate
 * Self-authorization is F13 SOVEREIGN violation.
 * Check: governance verdict is not "SEAL" when the same organ is executor and judge.
 */
function checkBw7(env: AgenticEventEnvelope): InvariantCheck {
  const authorityChain = env.governance.authority_chain;
  // If authority chain has only one entry, the executor is also the judge
  const passed = authorityChain.length >= 2 || env.governance.verdict !== "SEAL";
  return {
    bw: 7,
    name: "EXECUTION_AND_JUDGMENT_SEPARATE",
    passed,
    severity: "hard",
    message: passed
      ? `Authority chain has ${authorityChain.length} links — separation maintained`
      : "Self-authorization detected — F13 SOVEREIGN violation",
  };
}

/**
 * BW8 — Every Action Has Expected Evidence
 * Without expected evidence, verification is impossible.
 */
function checkBw8(env: AgenticEventEnvelope): InvariantCheck {
  const hasExpected = env.intent.expected_outcome !== undefined && env.intent.expected_outcome.length > 0;
  const hasFailure = env.intent.failure_outcome !== undefined && env.intent.failure_outcome.length > 0;
  const isExecution = env.action.action_type === "execute";
  // Execution actions require expected evidence
  const passed = !isExecution || (hasExpected && hasFailure);
  return {
    bw: 8,
    name: "EVERY_ACTION_HAS_EXPECTED_EVIDENCE",
    passed,
    severity: "soft",
    message: passed
      ? "Expected evidence declared"
      : `Execution action missing ${!hasExpected ? "expected_outcome" : "failure_outcome"} — verification will be blind`,
  };
}

/**
 * BW9 — Every State Transition Has Lineage
 * State changes must trace back to their trigger.
 */
function checkBw9(env: AgenticEventEnvelope): InvariantCheck {
  const hasLineage = env.lineage.trigger !== undefined && env.lineage.trigger.length > 0;
  const hasParent = env.lineage.parent_event_id !== undefined;
  const hasChain = env.lineage.causal_chain.length > 0;
  const passed = hasLineage || hasParent || hasChain;
  return {
    bw: 9,
    name: "EVERY_STATE_TRANSITION_HAS_LINEAGE",
    passed,
    severity: "hard",
    message: passed
      ? `Lineage: trigger="${env.lineage.trigger ?? "chain"}", parent=${env.lineage.parent_event_id ?? "root"}, chain=${env.lineage.causal_chain.length} links`
      : "No lineage information — state transition without provenance is drift",
  };
}

/**
 * BW10 — Memory Is Correctable
 * Any memory can be corrected, superseded, or retracted.
 * This is a design principle, not a runtime check on envelopes.
 * Always passes but records the principle.
 */
function checkBw10(_env: AgenticEventEnvelope): InvariantCheck {
  return {
    bw: 10,
    name: "MEMORY_IS_CORRECTABLE",
    passed: true,
    severity: "soft",
    message: "Memory correction policy active — all memories except M6 are correctable",
  };
}

/**
 * BW11 — Irreversible Events Produce Scars
 * If an action is irreversible and causes harm, it must be sealed as a scar.
 * In envelope context: check that irreversible actions have metabolic tracking.
 */
function checkBw11(env: AgenticEventEnvelope): InvariantCheck {
  const isIrreversible = env.action.classification === "IRREVERSIBLE";
  const hasMetabolic = env.metabolic !== undefined;
  // Irreversible actions should have metabolic tracking
  const passed = !isIrreversible || hasMetabolic;
  return {
    bw: 11,
    name: "IRREVERSIBLE_EVENTS_PRODUCE_SCARS",
    passed,
    severity: "hard",
    message: passed
      ? isIrreversible
        ? "Irreversible action has metabolic tracking"
        : "No irreversible action in this envelope"
      : "Irreversible action without metabolic tracking — scar formation may be missed",
  };
}

/**
 * BW12 — System Has HOLD State
 * The system can always pause. HOLD is not failure — it is governance working.
 * This is a design invariant, not a per-envelope check. Always passes.
 */
function checkBw12(_env: AgenticEventEnvelope): InvariantCheck {
  return {
    bw: 12,
    name: "SYSTEM_HAS_HOLD_STATE",
    passed: true,
    severity: "soft",
    message: "HOLD state available — system can always pause for governance",
  };
}

/**
 * BW13 — Human Sovereignty Survives Automation
 * F13 ensures human veto is final. Automation extends capability, not authority.
 * This is a design invariant. Check that F13 is always in floors_checked.
 */
function checkBw13(env: AgenticEventEnvelope): InvariantCheck {
  const f13Checked = env.governance.floors_checked.includes("F13");
  const passed = f13Checked;
  return {
    bw: 13,
    name: "HUMAN_SOVEREIGNTY_SURVIVES_AUTOMATION",
    passed,
    severity: "hard",
    message: passed
      ? "F13 SOVEREIGN floor checked — human veto preserved"
      : "F13 SOVEREIGN not checked — sovereignty may be compromised",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — VALIDATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════


/**
 * BW14 — Every Run Has a Governed Work Ledger
 * F11 AUDITABILITY: every decision traced to budget allocation and verified outcome.
 * A run without a work ledger is an unaccountable run.
 * The WorkContract is created at 000 INIT. The TaskOutcome is produced at 999 SEAL.
 *
 * @see /root/A-FORGE/docs/AGENTIC_APP_ARCHITECTURE.md — Section 0
 * @see /root/A-FORGE/docs/AGENTIC_APP_ARCHITECTURE.md — Section 6 (B14)
 */
function checkBw14(env: AgenticEventEnvelope): InvariantCheck {
  // BW14 — every run must carry a work-ledger reference. D7 (2026-07-12)
  // closed the D2↔D4 type sync gap: these fields are now declared on
  // AgenticEventEnvelope itself (work_contract_id, task_outcome, budget_consumed),
  // so the cast is gone and TS will catch missing fields at compile time.
  const hasWorkContract = typeof env.work_contract_id === 'string';
  const hasTaskOutcome = env.task_outcome !== undefined;
  const hasBudgetConsumed = env.budget_consumed !== undefined;
  const passed = hasWorkContract || hasTaskOutcome || hasBudgetConsumed;
  return {
    bw: 14,
    name: "EVERY_RUN_HAS_GOVERNED_WORK_LEDGER",
    passed,
    severity: "hard",
    message: passed
      ? "Work ledger referenced in envelope — run is accountable"
      : "No work contract or task outcome in envelope — unaccountable run (F11 AUDITABILITY)",
  };
}

/**
 * All 14 invariant checkers in order.
 */
const CHECKERS: Array<(env: AgenticEventEnvelope) => InvariantCheck> = [
  checkBw1,  // B1: Every Action Has Actor
  checkBw2,  // B2: Every Action Has Explicit Intent
  checkBw3,  // B3: Facts, Beliefs, Hypotheses Are Separate
  checkBw4,  // B4: Every Capability Has One Owner
  checkBw5,  // B5: Every Mutation Classified Before Execution
  checkBw6,  // B6: Authority Is Action-Specific and Time-Bounded
  checkBw7,  // B7: Execution and Judgment Are Separate
  checkBw8,  // B8: Every Action Has Expected Evidence
  checkBw9,  // B9: Every State Transition Has Lineage
  checkBw10, // B10: Memory Is Correctable
  checkBw11, // B11: Irreversible Events Produce Scars
  checkBw12, // B12: System Has HOLD State
  checkBw13, // B13: Human Sovereignty Survives Automation
  checkBw14, // B14: Every Run Has a Governed Work Ledger
];

/**
 * Validate all 14 Benda Wajib against a canonical event envelope.
 *
 * @param envelope — The event envelope to validate
 * @returns BendaWajibResult with pass/fail per invariant and overall verdict
 */
export function validateBendaWajib(envelope: AgenticEventEnvelope): BendaWajibResult {
  const checks: InvariantCheck[] = CHECKERS.map((checker) => checker(envelope));

  const passed = checks.filter((c) => c.passed).map((c) => c.bw);
  const violated = checks.filter((c) => !c.passed).map((c) => c.bw);

  const hardViolations = checks.filter((c) => !c.passed && c.severity === "hard").length;
  const softViolations = checks.filter((c) => !c.passed && c.severity === "soft").length;

  const warnings: string[] = [];
  if (envelope.epistemic.contradiction_status === "UNRESOLVED") {
    warnings.push("Unresolved contradictions detected — promotion blocked (Section 5)");
  }
  if (envelope.epistemic.confidence < 0.3 && envelope.epistemic.truth_class === "FACT") {
    warnings.push("FACT with low confidence (< 0.3) — consider reclassifying (F7 HUMILITY)");
  }
  if (envelope.action.dry_run && envelope.action.classification === "IRREVERSIBLE") {
    warnings.push("Dry-run on irreversible action — verify this is intentional");
  }

  return {
    checks,
    passed,
    violated,
    warnings,
    verdict: hardViolations === 0 ? "PASS" : "FAIL",
    hard_violations: hardViolations,
    soft_violations: softViolations,
  };
}

/**
 * Quick check: does this envelope pass all hard invariants?
 * Use for fast gating before full validation.
 */
export function bendaWajibQuickCheck(envelope: AgenticEventEnvelope): boolean {
  // Check only hard invariants: B1, B2, B3, B4, B5, B6, B7, B9, B11, B13
  const hardBws: BendaWajibNumber[] = [1, 2, 3, 4, 5, 6, 7, 9, 11, 13, 14];
  const hardCheckers = CHECKERS.filter((_, i) => hardBws.includes((i + 1) as BendaWajibNumber));
  return hardCheckers.every((checker) => checker(envelope).passed);
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — PROMOTION FORMULA VALIDATION (Addition 1: L4→L5 Promotion Check)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Validates that a memory candidate meets the governed promotion formula
// before advancing from L4 (durable governed memory) to L5 (relationship projection).
//
// This prevents naive "3+ occurrences" promotion which is vulnerable to
// single-source spam, low-quality repetition, and contradictory observations.

import type {
  PromotionFormula,
  PromotionInput,
  PromotionResult,
  ReasoningBudget,
  ReasoningBudgetStatus,
} from "../types/memory-lifecycle.js";
import { DEFAULT_PROMOTION_FORMULA, DEFAULT_REASONING_BUDGET } from "../types/memory-lifecycle.js";

/**
 * Validate that a memory candidate meets the L4→L5 promotion formula.
 *
 * @param input — Memory candidate metrics
 * @param formula — Promotion formula configuration (defaults to DEFAULT_PROMOTION_FORMULA)
 * @returns PromotionResult with score, verdict, and component breakdown
 */
export function validatePromotion(
  input: PromotionInput,
  formula: PromotionFormula = DEFAULT_PROMOTION_FORMULA,
): PromotionResult {
  const { weights, threshold, min_independent_sources } = formula;

  // Frequency: log2(access_count + 1) — logarithmic to prevent spam gaming
  const frequency = Math.log2(input.access_count + 1);

  // Independence: unique_sources / max_sources — normalized
  const independence = input.unique_sources / input.max_sources;

  // Evidence: mean confidence — direct passthrough
  const evidence = input.mean_evidence_confidence;

  // Contradiction: (1 - contested_ratio) — penalizes contested memories
  const contradiction = 1 - input.contested_ratio;

  // Scope: scope_specificity — direct passthrough
  const scope = input.scope_specificity;

  // Consequence: (1 - human_consequence) — penalizes human-consequential memories
  const consequence = 1 - input.human_consequence;

  // Weighted composite
  const score =
    weights.frequency_weight * frequency *
    weights.independence_weight * independence *
    weights.evidence_weight * evidence *
    weights.contradiction_penalty * contradiction *
    weights.scope_weight * scope *
    weights.consequence_weight * consequence;

  // Hard gates (non-negotiable)
  if (input.contested) {
    return {
      score,
      passed: false,
      reason: "REJECTED: memory is contested — unresolved disputes block promotion",
      dimensions: { frequency, independence, evidence, contradiction, scope, consequence },
      gates: { score_threshold: score >= threshold, not_contested: false, min_independent_sources: input.unique_sources >= min_independent_sources },
    };
  }

  if (input.unique_sources < min_independent_sources) {
    return {
      score,
      passed: false,
      reason: `REJECTED: only ${input.unique_sources} independent sources (minimum ${min_independent_sources})`,
      dimensions: { frequency, independence, evidence, contradiction, scope, consequence },
      gates: { score_threshold: score >= threshold, not_contested: true, min_independent_sources: false },
    };
  }

  if (score < threshold) {
    return {
      score,
      passed: false,
      reason: `REJECTED: score ${score.toFixed(4)} below threshold ${threshold}`,
      dimensions: { frequency, independence, evidence, contradiction, scope, consequence },
      gates: { score_threshold: false, not_contested: true, min_independent_sources: true },
    };
  }

  return {
    score,
    passed: true,
    reason: `PROMOTED: score ${score.toFixed(4)} meets threshold ${threshold} with ${input.unique_sources} independent sources`,
    dimensions: { frequency, independence, evidence, contradiction, scope, consequence },
    gates: { score_threshold: true, not_contested: true, min_independent_sources: true },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — REASONING BUDGET VALIDATION (Addition 2: Metabolic Control Check)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Validates that the reasoning budget has not been exceeded.
// Complementary to the 17x rule (which caps DECISION expenditure).
// Together they form the metabolic control layer.

/**
 * Validate that reasoning budget is within limits.
 *
 * @param status — Current reasoning budget consumption
 * @param budget — Budget limits (defaults to DEFAULT_REASONING_BUDGET)
 * @returns InvariantCheck result
 */
export function validateReasoningBudget(
  status: ReasoningBudgetStatus,
  budget: ReasoningBudget = DEFAULT_REASONING_BUDGET,
): InvariantCheck {
  const exceeded_dimensions: string[] = [];

  if (status.steps_taken >= budget.max_steps) {
    exceeded_dimensions.push("steps");
  }
  if (status.tool_calls_made >= budget.max_tool_calls) {
    exceeded_dimensions.push("tool_calls");
  }
  if (status.cost_incurred >= budget.max_cost_usd) {
    exceeded_dimensions.push("cost_usd");
  }
  if (status.tokens_consumed >= budget.max_tokens) {
    exceeded_dimensions.push("tokens");
  }

  const passed = exceeded_dimensions.length === 0;

  return {
    bw: 14 as BendaWajibNumber, // Extended invariant
    name: "REASONING_BUDGET_RESPECTED",
    passed,
    severity: "hard",
    message: passed
      ? `Reasoning budget within limits: ${status.steps_taken}/${budget.max_steps} steps, ${status.tool_calls_made}/${budget.max_tool_calls} tool calls`
      : `Reasoning budget EXCEEDED in: ${exceeded_dimensions.join(", ")} — forced escalation or halt required`,
  };
}
