/**
 * ACT Patterns — 3 Canonical Execution Ceremonies
 * ====================================================================
 *
 * These are the three fundamental execution patterns that bridge
 * the gap between "the plan is lawful" and "the plan is executed safely."
 *
 * Each pattern is a complete ceremony with:
 *   - Preconditions (what must be true before starting)
 *   - Stages (ordered, with verification gates between)
 *   - Compensation (rollback plan if a stage fails)
 *   - Human coordination (when to notify, when to pause)
 *
 * Usage:
 *   import { selectPattern, ACT_PATTERNS } from "./ActPatterns.js";
 *   const pattern = selectPattern("high", false, 5);
 *   // Returns "DANGEROUS_MIGRATION" with all stage details
 *
 * Forged: 2026-06-21 — Part of ACT layer, sibling of ART
 * Canonical SoT: arifOS/GENESIS/040_ACT_PLAYBOOK.md §3
 *
 * DITEMPA BUKAN DIBERI — Execution craft is forged, not given.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface ActStage {
  readonly number: number;
  readonly name: string;
  readonly description: string;
  readonly verificationRequired: boolean;
  readonly humanCheckpoint: boolean;
  readonly reversible: boolean;
}

export interface CompensationPlan {
  readonly description: string;
  readonly steps: string[];
  readonly automatic: boolean;   // can rollback automatically, or needs human?
}

export interface ActPattern {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly applicableWhen: {
    readonly maxBlastRadius: "low" | "medium" | "high";
    readonly irreversibleAllowed: boolean;
    readonly minStages: number;
    readonly maxStages: number;
  };
  readonly stages: ActStage[];
  readonly compensation: CompensationPlan;
  readonly humanCoordination: {
    readonly notifyBeforeFirst: boolean;
    readonly notifyAfterEach: boolean;
    readonly requireAckBeforeIrreversible: boolean;
    readonly escalationContact: string;
  };
  readonly invariants: string[];
}

// ── Pattern 1: DEFAULT DEPLOY ────────────────────────────────────────────────
// For: low-medium blast, reversible or compensated.
// Ritual: dry-run → deploy → verify → done. No human needed if all green.

export const DEFAULT_DEPLOY: ActPattern = {
  id: "act-pattern-001",
  name: "Default Deploy",
  description:
    "Standard safe deployment for low-to-medium blast operations. " +
    "Runs a dry-run first, then deploys to full scope, then verifies. " +
    "No human checkpoint required unless dry-run fails. " +
    "Compensation: automatic rollback to previous state on failure.",

  applicableWhen: {
    maxBlastRadius: "medium",
    irreversibleAllowed: false,
    minStages: 3,
    maxStages: 3,
  },

  stages: [
    {
      number: 1,
      name: "DRY_RUN",
      description:
        "Simulate the entire operation without side effects. " +
        "Verify that all preconditions are met and the output matches expectations.",
      verificationRequired: true,
      humanCheckpoint: false,
      reversible: true,
    },
    {
      number: 2,
      name: "DEPLOY",
      description:
        "Execute the operation against the full target. " +
        "All changes are reversible at this stage.",
      verificationRequired: true,
      humanCheckpoint: false,
      reversible: true,
    },
    {
      number: 3,
      name: "VERIFY",
      description:
        "Post-execution verification. Confirm the target state matches expectations. " +
        "If verification fails, trigger automatic rollback to pre-deploy state.",
      verificationRequired: false, // this is the final stage
      humanCheckpoint: true,       // notify human that deploy is complete
      reversible: false,
    },
  ],

  compensation: {
    description:
      "Automatic rollback to pre-deploy state. " +
      "Uses the dry-run snapshot as the rollback target.",
    steps: [
      "1. Save pre-deploy state before Stage 2 begins",
      "2. If Stage 2 verification fails → restore pre-deploy state",
      "3. If Stage 3 verification fails → restore pre-deploy state",
      "4. Log compensation to VAULT999",
    ],
    automatic: true,
  },

  humanCoordination: {
    notifyBeforeFirst: false,
    notifyAfterEach: false,
    requireAckBeforeIrreversible: false,
    escalationContact: "none (automatic)",
  },

  invariants: [
    "F1 AMANAH: Every change is reversible through rollback",
    "F4 CLARITY: Post-deploy state is verified before declaring success",
    "F11 AUDIT: Dry-run and deploy results are logged to VAULT999",
  ],
};

// ── Pattern 2: DANGEROUS MIGRATION ───────────────────────────────────────────
// For: high blast, irreversible, multi-step.
// Ritual: stage 1 (1%) → verify → stage 2 (25%) → verify → stage 3 (100%) → verify → done.
// Human must acknowledge before each stage. Must have compensation plan.

export const DANGEROUS_MIGRATION: ActPattern = {
  id: "act-pattern-002",
  name: "Dangerous Migration",
  description:
    "High-risk, irreversible migration executed in staged rollout. " +
    "Starts with a canary (1%), verifies, expands to 25%, verifies, " +
    "then full rollout. Human must acknowledge EACH stage before proceeding. " +
    "Compensation plan must be approved before Stage 1.",

  applicableWhen: {
    maxBlastRadius: "high",
    irreversibleAllowed: true,
    minStages: 5,
    maxStages: 5,
  },

  stages: [
    {
      number: 1,
      name: "PREFLIGHT + COMPENSATION APPROVAL",
      description:
        "Dry-run the migration against a synthetic target. " +
        "Submit the compensation plan for human approval. " +
        "Do NOT proceed to Stage 2 until compensation plan is ACK'd by F13.",
      verificationRequired: true,
      humanCheckpoint: true,
      reversible: true,
    },
    {
      number: 2,
      name: "CANARY (1%)",
      description:
        "Execute migration against 1% of target scope. " +
        "Monitor for failures, schema drift, or unexpected state changes. " +
        "If canary fails → rollback using compensation plan.",
      verificationRequired: true,
      humanCheckpoint: true,
      reversible: true,
    },
    {
      number: 3,
      name: "EXPAND (25%)",
      description:
        "Expand migration to 25% of target scope. " +
        "Run full verification suite. " +
        "If verification fails → rollback canary+expanded to pre-migration state.",
      verificationRequired: true,
      humanCheckpoint: true,
      reversible: true,
    },
    {
      number: 4,
      name: "FULL ROLLOUT (100%)",
      description:
        "Execute migration against the remaining 75% of target scope. " +
        "This stage is irreversible — the old state is overwritten.",
      verificationRequired: true,
      humanCheckpoint: true,  // human must ACK before FULL
      reversible: false,
    },
    {
      number: 5,
      name: "POST-MIGRATION VERIFICATION",
      description:
        "Run complete verification suite against full target. " +
        "Check: data integrity, system health, performance, security boundaries. " +
        "Log the complete migration receipt to VAULT999.",
      verificationRequired: false,
      humanCheckpoint: true,
      reversible: false,
    },
  ],

  compensation: {
    description:
      "Staged rollback: if a stage fails, rollback ONLY that stage's changes. " +
      "If any stage is IRREVERSIBLE (Stage 4), the compensation plan shifts to " +
      "'contain and rebuild' instead of 'undo and restore'.",
    steps: [
      "PRE-APPROVED (before Stage 1): Compensation plan must be approved by F13",
      "Stage 2 fails → rollback 1%, retry or abort",
      "Stage 3 fails → rollback 25%, retry or abort",
      "Stage 4 fails (partial) → contain remaining 25%, notify human immediately",
      "Stage 4 fails (complete) → declare incident, rebuild from snapshot",
      "ALL failures → log complete trace to VAULT999 with compensation outcome",
    ],
    automatic: false, // human must decide on Stage 4 failure
  },

  humanCoordination: {
    notifyBeforeFirst: true,
    notifyAfterEach: true,
    requireAckBeforeIrreversible: true,
    escalationContact: "888_HOLD — F13 SOVEREIGN (Arif)",
  },

  invariants: [
    "F1 AMANAH: Every partial migration is reversible until Stage 4",
    "F2 TRUTH: Every verification produces evidence, not ceremony",
    "F4 CLARITY: Each stage leaves the system cleaner (ΔS ≤ 0)",
    "F6 MARUAH: Human is notified before every irreversible step",
    "F11 AUDIT: Complete trace to VAULT999, including compensation outcomes",
    "F13 SOVEREIGN: Irreversible migration requires F13 approval",
  ],
};

// ── Pattern 3: HUMAN-IN-LOOP CHANGE ──────────────────────────────────────────
// For: high blast, human must verify EACH individual change.
// Ritual: propose → human reviews → execute 1 → human verifies → execute N → done.
// Every mutation requires human ack. Pattern is slow but safe for critical systems.

export const HUMAN_IN_LOOP_CHANGE: ActPattern = {
  id: "act-pattern-003",
  name: "Human-in-Loop Change",
  description:
    "Every individual change requires human review and acknowledgment. " +
    "Agent proposes the change (including expected outcome and rollback plan). " +
    "Human reviews and approves (or rejects). Agent executes. Human verifies. " +
    "This is the slowest but safest pattern — for critical infrastructure only.",

  applicableWhen: {
    maxBlastRadius: "high",
    irreversibleAllowed: true,
    minStages: 2,
    maxStages: 10, // loop is flexible
  },

  stages: [
    {
      number: 1,
      name: "PROPOSE",
      description:
        "Agent presents the proposed change to the human. " +
        "Includes: exact diff, expected outcome, blast radius, rollback plan, " +
        "verification criteria. Human reviews and responds: APPROVE / REJECT / MODIFY.",
      verificationRequired: true,
      humanCheckpoint: true,
      reversible: true,
    },
    {
      number: 2,
      name: "EXECUTE + VERIFY (LOOP)",
      description:
        "Execute the approved change. This is a loop — for each change in the plan: " +
        "  a) Agent executes the change (with ART reflex + Kernel gate per call) " +
        "  b) Agent verifies the expected outcome " +
        "  c) If verification fails → rollback that change " +
        "  d) If verification passes → human must verify " +
        "  e) Human approves / rejects the outcome " +
        "  f) If rejected → rollback, notify, pause " +
        "  g) If approved → continue to next change " +
        "Loop continues until all changes are executed.",
      verificationRequired: true,
      humanCheckpoint: true,
      reversible: true,
    },
  ],

  compensation: {
    description:
      "Per-change rollback. Each change is individually reversible. " +
      "If a change fails verification before human approval, auto-rollback. " +
      "If human rejects a verified change, rollback. " +
      "If human rejects without failure — that's a decision, not an error.",
    steps: [
      "Each change has its own rollback plan (defined in PROPOSE stage)",
      "Auto-rollback on verification failure (before human sees it)",
      "Human-requested rollback on rejection (after human sees it)",
      "All rollbacks logged to VAULT999 for audit",
    ],
    automatic: false, // human decides rollback vs accept
  },

  humanCoordination: {
    notifyBeforeFirst: true,
    notifyAfterEach: true, // human must verify each change
    requireAckBeforeIrreversible: true,
    escalationContact: "888_HOLD — F13 SOVEREIGN (Arif) — per-change ACK required",
  },

  invariants: [
    "F1 AMANAH: Every change individually reversible",
    "F2 TRUTH: Each change produces verification evidence",
    "F6 MARUAH: Human is in the loop for EVERY mutation",
    "F11 AUDIT: Every propose/execute/verify/reject cycle logged",
    "F13 SOVEREIGN: Human has absolute veto over every individual change",
  ],
};

// ── Registry ─────────────────────────────────────────────────────────────────

export const ACT_PATTERNS: ActPattern[] = [
  DEFAULT_DEPLOY,
  DANGEROUS_MIGRATION,
  HUMAN_IN_LOOP_CHANGE,
];

export const ACT_PATTERN_MAP: Record<string, ActPattern> = {
  [DEFAULT_DEPLOY.id]: DEFAULT_DEPLOY,
  [DANGEROUS_MIGRATION.id]: DANGEROUS_MIGRATION,
  [HUMAN_IN_LOOP_CHANGE.id]: HUMAN_IN_LOOP_CHANGE,
};

// ── Pattern Selector ─────────────────────────────────────────────────────────

export interface PatternSelectionCriteria {
  blastRadius: "low" | "medium" | "high" | "unknown";
  irreversible: boolean;
  stageCount: number;       // number of discrete steps in the plan
  hasCompensationPlan: boolean;
  humanAvailable: boolean;  // is F13 reachable right now?
}

export interface PatternSelectionResult {
  pattern: ActPattern;
  confidence: number;       // 0.0 - 1.0 how well this pattern fits
  warnings: string[];
}

/**
 * Select the best ACT pattern based on blast radius, irreversibility, and
 * stage count. Returns the highest-confidence match with warnings.
 *
 * Rules:
 *   - LOW blast + reversible → DEFAULT_DEPLOY (confidence 0.95)
 *   - HIGH blast + irreversible + multi-stage → DANGEROUS_MIGRATION (0.90)
 *   - HIGH blast + human required per-change → HUMAN_IN_LOOP_CHANGE (0.85)
 *   - LOW blast + irreversible → DEFAULT_DEPLOY with dry-run enforcement (0.70)
 *   - HIGH blast + reversible + single stage → DEFAULT_DEPLOY (0.60, with warnings)
 */
export function selectPattern(
  criteria: PatternSelectionCriteria,
): PatternSelectionResult {
  const warnings: string[] = [];

  // ── HIGH blast + irreversible → DANGEROUS_MIGRATION ──
  if (criteria.blastRadius === "high" && criteria.irreversible) {
    if (criteria.stageCount > 1) {
      return {
        pattern: DANGEROUS_MIGRATION,
        confidence: 0.90,
        warnings: criteria.humanAvailable
          ? []
          : ["F13 not available — DANGEROUS_MIGRATION requires human checkpoints"],
      };
    }
    // Single-stage irreversible with high blast — still needs full ceremony
    return {
      pattern: DANGEROUS_MIGRATION,
      confidence: 0.75,
      warnings: [
        "Single-stage irreversible operation mapped to DANGEROUS_MIGRATION — " +
        "consider splitting into multiple stages for safer execution",
        !criteria.humanAvailable ? "F13 not available — cannot proceed without human" : "",
      ].filter(Boolean),
    };
  }

  // ── HIGH blast + human wants per-change veto → HUMAN_IN_LOOP_CHANGE ──
  if (criteria.blastRadius === "high" && criteria.stageCount > 3) {
    return {
      pattern: HUMAN_IN_LOOP_CHANGE,
      confidence: 0.85,
      warnings: !criteria.humanAvailable
        ? ["F13 not available — HUMAN_IN_LOOP requires human for every change"]
        : [],
    };
  }

  // ── HIGH blast + reversible + single stage → DEFAULT_DEPLOY (with warnings) ──
  if (criteria.blastRadius === "high" && !criteria.irreversible) {
    return {
      pattern: DEFAULT_DEPLOY,
      confidence: 0.60,
      warnings: [
        "High blast radius but marked reversible — DEFAULT_DEPLOY is marginal. " +
        "Consider HUMAN_IN_LOOP if human wants per-change visibility.",
      ],
    };
  }

  // ── MEDIUM blast + irreversible → DEFAULT_DEPLOY with dry-run ──
  if (criteria.blastRadius === "medium" && criteria.irreversible) {
    return {
      pattern: DEFAULT_DEPLOY,
      confidence: 0.70,
      warnings: [
        "Irreversible with medium blast — ensure DRY_RUN stage (Stage 1) " +
        "is properly executed before DEPLOY (Stage 2).",
      ],
    };
  }

  // ── LOW blast + everything → DEFAULT_DEPLOY ──
  return {
    pattern: DEFAULT_DEPLOY,
    confidence: 0.95,
    warnings: [],
  };
}

/**
 * Get validation errors if a plan violates the selected pattern's invariants.
 * Returns empty array if the plan is compliant.
 */
export function validatePlanAgainstPattern(
  pattern: ActPattern,
  currentStage: number,
  totalStages: number,
): string[] {
  const errors: string[] = [];

  if (totalStages < pattern.applicableWhen.minStages) {
    errors.push(
      `ACT INVARIANT: Pattern "${pattern.name}" requires at least ` +
      `${pattern.applicableWhen.minStages} stages, but plan has ${totalStages}.`,
    );
  }

  if (totalStages > pattern.applicableWhen.maxStages) {
    errors.push(
      `ACT INVARIANT: Pattern "${pattern.name}" supports at most ` +
      `${pattern.applicableWhen.maxStages} stages, but plan has ${totalStages}.`,
    );
  }

  // Verify current stage exists in the pattern
  const stage = pattern.stages.find((s) => s.number === currentStage);
  if (!stage) {
    errors.push(
      `ACT INVARIANT: Pattern "${pattern.name}" does not define stage ${currentStage}. ` +
      `Valid stages: ${pattern.stages.map((s) => `${s.number}: ${s.name}`).join(", ")}`,
    );
  }

  // Check human checkpoint invariant for irreversible stages
  if (stage && !stage.reversible && !stage.humanCheckpoint) {
    errors.push(
      `ACT INVARIANT: Pattern "${pattern.name}" stage ${currentStage} ` +
      `("${stage.name}") is irreversible but has no human checkpoint. ` +
      `This violates F13 SOVEREIGN.`,
    );
  }

  return errors;
}
