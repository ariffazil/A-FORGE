/**
 * state-machine.ts — Vertical Agent Lifecycle State Machine
 *
 * Enforces valid forward transitions through the 000-999 canonical lifecycle.
 * Correction paths allow backward transitions for error recovery and re-observation.
 * Reasoning budget gating prevents infinite loops — advanceStage checks budget before moving.
 *
 * @see /root/A-FORGE/docs/AGENTIC_APP_ARCHITECTURE.md — Section 9
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 * @constitutional F1 AMANAH — reversible-first; correction paths preserve state
 * @constitutional F7 HUMILITY — budget check prevents over-confident infinite reasoning
 * @constitutional F11 AUDITABILITY — every transition result is a sealed record
 */
import type { LifecycleStage } from "./types.js";
import type {
  ReasoningBudget,
  ReasoningBudgetStatus,
} from "../../types/memory-lifecycle.js";
import { DEFAULT_REASONING_BUDGET, checkReasoningBudget } from "../../types/memory-lifecycle.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — TRANSITION RESULT (Immutable record of every transition attempt)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of a single transition attempt.
 * Every transition — valid or invalid — produces a TransitionResult.
 * This is the audit trail for lifecycle movement.
 */
export interface TransitionResult {
  /** Whether the transition was allowed */
  allowed: boolean;
  /** The stage the agent was at before the transition */
  from: LifecycleStage;
  /** The stage the agent moved to (or attempted to move to) */
  to: LifecycleStage;
  /** Human-readable reason for the outcome */
  reason: string;
  /** Timestamp of the transition attempt */
  attempted_at: string;
  /** If the transition was blocked, what stages ARE valid from the source */
  valid_from_here?: LifecycleStage[];
  /** Whether this transition was a backward correction path */
  is_correction: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — STAGE ADVANCE RESULT (Budget-gated progression)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of a stage advance attempt.
 * Wraps TransitionResult with budget awareness — the agent cannot advance
 * if the reasoning budget is exhausted.
 *
 * @see /root/A-FORGE/src/domain/types/memory-lifecycle.ts — §8B ReasoningBudget
 */
export interface StageAdvanceResult {
  /** Whether the advance succeeded */
  success: boolean;
  /** The transition result (populated on success or blocked-by-validity) */
  transition: TransitionResult;
  /** Whether the reasoning budget was exceeded (blocks advance even on valid transition) */
  budget_exceeded: boolean;
  /** Which budget dimensions are exceeded */
  budget_violations: string[];
  /** Whether the agent should escalate to higher authority */
  should_escalate: boolean;
  /** Whether the agent should halt entirely */
  should_halt: boolean;
  /** If the advance failed, why */
  block_reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — FORWARD TRANSITION TABLE (Canonical happy path + branching)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Canonical forward order through the lifecycle.
 * The happy path is: 000->111->222->333->444->555->666->777->888->999
 * Each stage can also branch to alternative forward targets.
 */
const FORWARD_ORDER: LifecycleStage[] = [
  "000_INIT",
  "111_OBSERVE",
  "222_ENCODE",
  "333_THINK",
  "444_ROUTE",
  "555_CRITIQUE",
  "666_HEART",
  "777_FORGE",
  "888_JUDGE",
  "999_SEAL",
];

/**
 * Valid forward transitions from each lifecycle stage.
 * These follow the canonical 000->111->...->999 path, with branching.
 * Only forward jumps (toward higher stage numbers) are listed here.
 */
const FORWARD_TRANSITIONS: Record<LifecycleStage, LifecycleStage[]> = {
  "000_INIT":     ["111_OBSERVE"],
  "111_OBSERVE":  ["222_ENCODE", "333_THINK"],
  "222_ENCODE":   ["333_THINK"],
  "333_THINK":    ["444_ROUTE", "555_CRITIQUE"],
  "444_ROUTE":    ["555_CRITIQUE", "666_HEART", "777_FORGE"],
  "555_CRITIQUE": ["666_HEART", "777_FORGE"],
  "666_HEART":    ["777_FORGE"],
  "777_FORGE":    ["888_JUDGE"],
  "888_JUDGE":    ["999_SEAL"],
  "999_SEAL":     [],  // Terminal — no forward transitions
};

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — BACKWARD TRANSITION TABLE (Correction paths)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Valid backward (correction) transitions.
 * These allow the agent to re-observe, re-think, or re-forge after a failed
 * judgment, contradiction, or other error condition.
 *
 * Backward transitions are governed:
 *   - 888_JUDGE can send back to 111_OBSERVE (re-evidence) or 777_FORGE (re-execute)
 *   - 555_CRITIQUE can send back to 333_THINK (re-reason)
 *   - 777_FORGE can send back to 333_THINK (re-plan before re-execution)
 *   - 222_ENCODE can send back to 111_OBSERVE (re-observe if encoding reveals gaps)
 *   - 999_SEAL can cycle back to 000_INIT (new run from sealed state)
 */
const BACKWARD_TRANSITIONS: Record<LifecycleStage, LifecycleStage[]> = {
  "000_INIT":     [],
  "111_OBSERVE":  [],
  "222_ENCODE":   ["111_OBSERVE"],
  "333_THINK":    ["111_OBSERVE", "222_ENCODE"],
  "444_ROUTE":    ["333_THINK"],
  "555_CRITIQUE": ["333_THINK", "444_ROUTE"],
  "666_HEART":    ["555_CRITIQUE"],
  "777_FORGE":    ["333_THINK", "444_ROUTE", "555_CRITIQUE"],
  "888_JUDGE":    ["111_OBSERVE", "333_THINK", "444_ROUTE", "555_CRITIQUE", "666_HEART", "777_FORGE"],
  "999_SEAL":     ["000_INIT"],  // Cycle: sealed agent can start new run
};

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — MERGED TRANSITION TABLE (Forward + Backward)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * All valid transitions from each lifecycle stage (forward + backward combined).
 * This is the single source of truth for the state machine.
 */
const ALL_TRANSITIONS: Record<LifecycleStage, LifecycleStage[]> = (() => {
  const result: Partial<Record<LifecycleStage, LifecycleStage[]>> = {};
  for (const stage of FORWARD_ORDER) {
    const forward = FORWARD_TRANSITIONS[stage] ?? [];
    const backward = BACKWARD_TRANSITIONS[stage] ?? [];
    // Deduplicate (e.g., 888_JUDGE -> 777_FORGE appears in both forward... wait, no, forward for 888 is only 999)
    // But just in case, deduplicate
    const merged = [...forward, ...backward.filter((b) => !forward.includes(b))];
    result[stage] = merged;
  }
  return result as Record<LifecycleStage, LifecycleStage[]>;
})();

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determine whether a transition from `current` to `target` is a forward transition.
 *
 * @param current — Current lifecycle stage
 * @param target — Desired target stage
 * @returns true if target is ahead of current in the canonical order
 */
function isForwardTransition(current: LifecycleStage, target: LifecycleStage): boolean {
  const currentIdx = FORWARD_ORDER.indexOf(current);
  const targetIdx = FORWARD_ORDER.indexOf(target);
  if (currentIdx === -1 || targetIdx === -1) return false;
  return targetIdx > currentIdx;
}

/**
 * Validate whether a transition from current to target is allowed.
 *
 * Checks both forward and backward transition tables.
 * Returns a structured TransitionResult with full audit information.
 *
 * @param current — Current lifecycle stage
 * @param target — Desired target stage
 * @returns TransitionResult with allowed flag, reason, and metadata
 */
export function validateTransition(
  current: LifecycleStage,
  target: LifecycleStage,
): TransitionResult {
  const now = new Date().toISOString();
  const allowedTargets = ALL_TRANSITIONS[current] ?? [];
  const isAllowed = allowedTargets.includes(target);
  const isCorrection = isForwardTransition(current, target)
    ? false
    : BACKWARD_TRANSITIONS[current]?.includes(target) ?? false;

  if (isAllowed) {
    const direction = isForwardTransition(current, target) ? "forward" : "correction";
    return {
      allowed: true,
      from: current,
      to: target,
      reason: `Valid ${direction} transition: ${current} -> ${target}`,
      attempted_at: now,
      is_correction: isCorrection,
    };
  }

  // Build helpful error with valid options
  const validForward = (FORWARD_TRANSITIONS[current] ?? [])
    .filter((t) => !allowedTargets.includes(t));
  const validBackward = (BACKWARD_TRANSITIONS[current] ?? [])
    .filter((t) => !allowedTargets.includes(t));

  const allValid = [...allowedTargets];
  const reason = allowedTargets.length === 0
    ? `Terminal stage ${current} has no outgoing transitions`
    : `Invalid transition: ${current} -> ${target}. Valid targets: [${allValid.join(", ")}]`;

  return {
    allowed: false,
    from: current,
    to: target,
    reason,
    attempted_at: now,
    valid_from_here: allValid,
    is_correction: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — ADVANCE STAGE (Budget-gated progression)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Attempt to advance the agent to the next stage in the canonical forward order.
 *
 * This is the primary entry point for lifecycle progression. It:
 *   1. Determines the canonical next stage from the current position
 *   2. Validates the transition is allowed (forward or correction)
 *   3. Checks the reasoning budget — if exceeded, blocks the advance
 *   4. Returns a StageAdvanceResult with full audit information
 *
 * The budget check is critical: it prevents infinite reasoning loops where an
 * agent keeps thinking without converging on action. If budget is exceeded,
 * the agent must either escalate to higher authority or halt.
 *
 * @param current — Current lifecycle stage
 * @param budget — Reasoning budget limits (defaults to conservative DEFAULT_REASONING_BUDGET)
 * @param budgetStatus — Current reasoning budget consumption
 * @returns StageAdvanceResult with success flag, transition, and budget info
 *
 * @see /root/A-FORGE/src/domain/types/memory-lifecycle.ts — §8B ReasoningBudget
 */
export function advanceStage(
  current: LifecycleStage,
  budget: ReasoningBudget = DEFAULT_REASONING_BUDGET,
  budgetStatus: ReasoningBudgetStatus,
): StageAdvanceResult {
  const now = new Date().toISOString();

  // Step 1: Determine the canonical next stage
  const currentIdx = FORWARD_ORDER.indexOf(current);
  if (currentIdx === -1) {
    const transition: TransitionResult = {
      allowed: false,
      from: current,
      to: current,
      reason: `Unknown stage: ${current}`,
      attempted_at: now,
      is_correction: false,
    };
    return {
      success: false,
      transition,
      budget_exceeded: false,
      budget_violations: [],
      should_escalate: false,
      should_halt: false,
      block_reason: `Unknown lifecycle stage: ${current}`,
    };
  }

  // Terminal check
  if (current === "999_SEAL") {
    const transition: TransitionResult = {
      allowed: false,
      from: current,
      to: current,
      reason: "Terminal stage 999_SEAL — lifecycle complete, use resetToInit() for new run",
      attempted_at: now,
      is_correction: false,
    };
    return {
      success: false,
      transition,
      budget_exceeded: false,
      budget_violations: [],
      should_escalate: false,
      should_halt: false,
      block_reason: "Lifecycle complete at 999_SEAL",
    };
  }

  // Step 2: Check reasoning budget BEFORE attempting transition
  const budgetCheck = checkReasoningBudget(budgetStatus, budget);
  if (budgetCheck.exceeded_dimension || budgetCheck.should_halt) {
    const violations = budgetCheck.exceeded_dimension ? [budgetCheck.exceeded_dimension] : [];
    const blockedTransition: TransitionResult = {
      allowed: false,
      from: current,
      to: FORWARD_ORDER[currentIdx + 1] ?? current,
      reason: `Budget exceeded in dimensions: [${violations.join(", ")}]`,
      attempted_at: now,
      valid_from_here: ALL_TRANSITIONS[current] ?? [],
      is_correction: false,
    };
    return {
      success: false,
      transition: blockedTransition,
      budget_exceeded: true,
      budget_violations: violations,
      should_escalate: budgetCheck.should_escalate,
      should_halt: budgetCheck.should_halt,
      block_reason: budgetCheck.should_halt
        ? `HALT: consecutive failures >= 3 or unresolved contradictions`
        : `Budget exceeded in: [${violations.join(", ")}]`,
    };
  }

  // Step 3: Determine target stage (canonical forward next)
  const targetIdx = currentIdx + 1;
  const target = FORWARD_ORDER[targetIdx];

  // Step 4: Validate the transition
  const transition = validateTransition(current, target);

  if (!transition.allowed) {
    return {
      success: false,
      transition,
      budget_exceeded: false,
      budget_violations: [],
      should_escalate: budgetCheck.should_escalate,
      should_halt: budgetCheck.should_halt,
      block_reason: transition.reason,
    };
  }

  // Step 5: Advance succeeded
  return {
    success: true,
    transition,
    budget_exceeded: false,
    budget_violations: [],
    should_escalate: budgetCheck.should_escalate,
    should_halt: budgetCheck.should_halt,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — RESET TO INIT (Cycle completion)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reset the agent back to 000_INIT for a new lifecycle run.
 *
 * This is only valid from 999_SEAL (the terminal stage).
 * It allows a sealed agent to begin a new governed run with fresh observations.
 *
 * The reset produces a TransitionResult as an audit trail — the previous
 * lifecycle's final state is preserved in the caller's state object.
 *
 * @param current — Current lifecycle stage (must be 999_SEAL)
 * @returns TransitionResult for the reset transition
 */
export function resetToInit(current: LifecycleStage): TransitionResult {
  const now = new Date().toISOString();

  if (current !== "999_SEAL") {
    return {
      allowed: false,
      from: current,
      to: "000_INIT",
      reason: `Reset only valid from 999_SEAL terminal stage. Current stage: ${current}`,
      attempted_at: now,
      is_correction: false,
    };
  }

  return {
    allowed: true,
    from: current,
    to: "000_INIT",
    reason: `Lifecycle reset: 999_SEAL -> 000_INIT (new governed run)`,
    attempted_at: now,
    is_correction: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — QUERY FUNCTIONS (Read-only state inspection)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all valid targets (forward + backward) from the current stage.
 */
export function validTargets(current: LifecycleStage): LifecycleStage[] {
  return ALL_TRANSITIONS[current] ?? [];
}

/**
 * Get only forward transitions from the current stage.
 */
export function forwardTargets(current: LifecycleStage): LifecycleStage[] {
  return FORWARD_TRANSITIONS[current] ?? [];
}

/**
 * Get only backward (correction) transitions from the current stage.
 */
export function correctionTargets(current: LifecycleStage): LifecycleStage[] {
  return BACKWARD_TRANSITIONS[current] ?? [];
}

/**
 * Check if the agent is at the terminal stage (999_SEAL).
 */
export function isTerminal(current: LifecycleStage): boolean {
  return current === "999_SEAL";
}

/**
 * Check if a specific target is ahead of the current stage in canonical order.
 */
export function isAhead(current: LifecycleStage, target: LifecycleStage): boolean {
  return isForwardTransition(current, target);
}

/**
 * Get the stage name for display (strips the numeric prefix).
 */
export function stageName(stage: LifecycleStage): string {
  const names: Record<LifecycleStage, string> = {
    "000_INIT": "INIT",
    "111_OBSERVE": "OBSERVE",
    "222_ENCODE": "ENCODE",
    "333_THINK": "THINK",
    "444_ROUTE": "ROUTE",
    "555_CRITIQUE": "CRITIQUE",
    "666_HEART": "HEART",
    "777_FORGE": "FORGE",
    "888_JUDGE": "JUDGE",
    "999_SEAL": "SEAL",
  };
  return names[stage] ?? stage;
}

/**
 * Get the organ responsible for each stage.
 */
export function stageOrgan(stage: LifecycleStage): string {
  const organs: Record<LifecycleStage, string> = {
    "000_INIT": "arifOS",
    "111_OBSERVE": "domain_organ",
    "222_ENCODE": "A-FORGE",
    "333_THINK": "arifOS",
    "444_ROUTE": "arifOS",
    "555_CRITIQUE": "WELL",
    "666_HEART": "WELL",
    "777_FORGE": "A-FORGE",
    "888_JUDGE": "arifOS",
    "999_SEAL": "VAULT999",
  };
  return organs[stage] ?? "unknown";
}

/**
 * Validate a full lifecycle trace — all transitions in order must be valid.
 */
export function validateLifecycleTrace(trace: LifecycleStage[]): { valid: boolean; error?: string } {
  if (trace.length === 0) {
    return { valid: false, error: "Empty trace — no stages visited" };
  }
  if (trace[0] !== "000_INIT") {
    return { valid: false, error: `Trace must start at 000_INIT, starts at ${trace[0]}` };
  }

  for (let i = 1; i < trace.length; i++) {
    const prev = trace[i - 1];
    const curr = trace[i];
    const result = validateTransition(prev, curr);
    if (!result.allowed) {
      return {
        valid: false,
        error: `Invalid transition at position ${i}: ${result.reason}`,
      };
    }
  }

  return { valid: true };
}
