/**
 * OutcomeSpec + RunConfig — canonical goal schemas for arifOS Goal Plane.
 *
 * Plain TypeScript types with a parse() function. No Zod dependency.
 * Matches A-FORGE's prevailing style (PolicyConfig, PlannerOutput are plain
 * interfaces with manual validation).
 *
 * Every A-FORGE mission is a governed contract, not an ad-hoc prompt.
 * The contract is first-class, machine-checkable, and sealable in VAULT999
 * as the epoch anchor.
 *
 * Plan: PLAN-2026-06-06-P5-GoalPlane
 * Authority: F13 ratification required before mutation
 *
 * @constitutional F1 Amanah — the contract is the trust boundary
 */

// ─── Enumerations (plain union types) ────────────────────────────────

export type SensitivityLevel = "LOW" | "MEDIUM" | "HIGH" | "SOVEREIGN";

export type PersistencePolicy =
  | "EPHEMERAL"
  | "SESSION"
  | "EPOCH"
  | "PERMANENT";

export type EvidenceType =
  // Petroleum systems (GEOX)
  | "WELL_LOG" | "SEISMIC" | "PRODUCTION" | "PVT" | "DST"
  | "GEOLOGICAL_MAP" | "STRATIGRAPHIC" | "TOP" | "CHECKSHOT"
  // Capital (WEALTH)
  | "FINANCIAL_REPORT" | "MARKET_DATA" | "LEDGER_ENTRY"
  // Human readiness (WELL)
  | "BIOMETRIC" | "READINESS_SNAPSHOT"
  // Generic
  | "LEGAL_DOCUMENT" | "REGULATORY_FILING" | "EXTERNAL_API"
  | "MODEL_INFERENCE" | "HUMAN_STATEMENT" | "VAULT_SEAL" | "OTHER";

export const ALL_SENSITIVITY: SensitivityLevel[] = ["LOW", "MEDIUM", "HIGH", "SOVEREIGN"];
export const ALL_PERSISTENCE: PersistencePolicy[] = ["EPHEMERAL", "SESSION", "EPOCH", "PERMANENT"];

// ─── Sub-types ────────────────────────────────────────────────────────

export interface OutcomeConstraints {
  time_budget_seconds?: number;       // max 86400 (24h)
  token_budget?: number;              // max 10_000_000
  cost_budget_usd?: number;           // max 10_000
  tool_scope?: string[];              // max 50 tool names
  data_scope?: string[];              // max 50 data references
}

export interface BudgetLimit {
  tokens?: number;                    // max 10_000_000
  cost_usd?: number;                   // max 10_000
}

export interface ApprovalPolicy {
  auto_approve_below?: number;        // 0.0–1.0
  hold_above?: number;                // 0.0–1.0
}

// ─── OutcomeSpec ──────────────────────────────────────────────────────

export interface OutcomeSpec {
  /** What must be achieved. Plain language, falsifiable. */
  objective: string;

  /** Verifiable conditions that prove the objective is met. */
  success_criteria: string[];

  /** Inputs given to the mission (data, files, URLs, parameters). */
  inputs?: Record<string, unknown>;

  /** Resource and scope constraints. */
  constraints?: OutcomeConstraints;

  /** Sensitivity tier — drives 888_HOLD trigger policy. */
  sensitivity?: SensitivityLevel;

  /** Must every consequential action be reversible? */
  reversibility_required?: boolean;

  /** Evidence types required to declare the mission complete. */
  evidence_required?: EvidenceType[];

  /** Channel ID for 888_HOLD notifications (Telegram chat, Matrix room, webhook). */
  notifier_channel?: string;

  /** Free-form metadata for traceability. */
  metadata?: Record<string, unknown>;
}

// ─── RunConfig ────────────────────────────────────────────────────────

export type AllowedModels = string[] | "auto";

export interface RunConfig {
  /** Specific tool names that may be invoked. Empty = use tool_scope from OutcomeSpec. */
  allowed_tools?: string[];

  /** Specific model IDs allowed. "auto" = router decides. */
  allowed_models?: AllowedModels;

  /** Hard budget cap; tool calls beyond this get VOID. */
  budget_limit?: BudgetLimit;

  /** How long state is kept after the run completes. */
  persistence_policy?: PersistencePolicy;

  /** Approval thresholds. 0.0 = strict, 1.0 = permissive. */
  approval_policy?: ApprovalPolicy;

  /** Reference to a SandboxSpec (P3) for ephemeral execution. */
  sandbox_class?: string;

  /** Notifier channel override (Telegram/Matrix/webhook ID). */
  notifier_channel?: string;

  /** Maximum wall-clock duration before forced teardown. */
  max_wall_clock_seconds?: number;     // max 86400, default 3600
}

// ─── Compound type ────────────────────────────────────────────────────

/** OutcomeSpec + RunConfig bound together. The mission contract. */
export interface Mission {
  outcome: OutcomeSpec;
  run: RunConfig;
  /** Optional human-readable name. */
  name?: string;
  /** Optional parent plan_id for hierarchical missions. */
  parent_plan_id?: string;
}

// ─── Defaults (applied by validator if fields are missing) ───────────

/** Filled into a parsed OutcomeSpec before validation if field is undefined. */
export const OutcomeSpecDefaults = {
  inputs: {} as Record<string, unknown>,
  constraints: {} as OutcomeConstraints,
  sensitivity: "MEDIUM" as SensitivityLevel,
  reversibility_required: true,
  evidence_required: [] as EvidenceType[],
  metadata: {} as Record<string, unknown>,
};

/** Filled into a parsed RunConfig before validation if field is undefined. */
export const RunConfigDefaults = {
  allowed_tools: [] as string[],
  allowed_models: "auto" as AllowedModels,
  budget_limit: {} as BudgetLimit,
  persistence_policy: "SESSION" as PersistencePolicy,
  approval_policy: { auto_approve_below: 0.5, hold_above: 0.8 },
  max_wall_clock_seconds: 3600,
};

/** Materialize a parsed-but-defaults-applied mission for validation. */
export interface MaterializedMission {
  outcome: {
    objective: string;
    success_criteria: string[];
    inputs: Record<string, unknown>;
    constraints: OutcomeConstraints;
    sensitivity: SensitivityLevel;
    reversibility_required: boolean;
    evidence_required: EvidenceType[];
    notifier_channel?: string;
    metadata: Record<string, unknown>;
  };
  run: {
    allowed_tools: string[];
    allowed_models: AllowedModels;
    budget_limit: BudgetLimit;
    persistence_policy: PersistencePolicy;
    approval_policy: Required<ApprovalPolicy>;
    max_wall_clock_seconds: number;
    sandbox_class?: string;
    notifier_channel?: string;
  };
  name?: string;
  parent_plan_id?: string;
}

export function materialize(mission: Mission): MaterializedMission {
  return {
    outcome: {
      objective: mission.outcome.objective,
      success_criteria: mission.outcome.success_criteria,
      inputs: mission.outcome.inputs ?? OutcomeSpecDefaults.inputs,
      constraints: mission.outcome.constraints ?? OutcomeSpecDefaults.constraints,
      sensitivity: mission.outcome.sensitivity ?? OutcomeSpecDefaults.sensitivity,
      reversibility_required:
        mission.outcome.reversibility_required ?? OutcomeSpecDefaults.reversibility_required,
      evidence_required:
        mission.outcome.evidence_required ?? OutcomeSpecDefaults.evidence_required,
      notifier_channel: mission.outcome.notifier_channel,
      metadata: mission.outcome.metadata ?? OutcomeSpecDefaults.metadata,
    },
    run: {
      allowed_tools: mission.run.allowed_tools ?? RunConfigDefaults.allowed_tools,
      allowed_models: mission.run.allowed_models ?? RunConfigDefaults.allowed_models,
      budget_limit: mission.run.budget_limit ?? RunConfigDefaults.budget_limit,
      persistence_policy:
        mission.run.persistence_policy ?? RunConfigDefaults.persistence_policy,
      approval_policy: {
        auto_approve_below:
          mission.run.approval_policy?.auto_approve_below ??
          RunConfigDefaults.approval_policy.auto_approve_below,
        hold_above:
          mission.run.approval_policy?.hold_above ??
          RunConfigDefaults.approval_policy.hold_above,
      },
      max_wall_clock_seconds:
        mission.run.max_wall_clock_seconds ?? RunConfigDefaults.max_wall_clock_seconds,
      sandbox_class: mission.run.sandbox_class,
      notifier_channel: mission.run.notifier_channel,
    },
    name: mission.name,
    parent_plan_id: mission.parent_plan_id,
  };
}

// ─── Sensitivity → 888_HOLD trigger map (F13 enforcement) ─────────────

/**
 * Action classes that, when combined with a sensitivity tier, trigger 888_HOLD.
 * Lower tier → fewer triggers. SOVEREIGN tier → always HOLD.
 */
export const HOLD_TRIGGER_MAP: Record<SensitivityLevel, ReadonlyArray<string>> = {
  LOW: [],
  MEDIUM: ["FILE_WRITE_OUTSIDE_ROOT", "INTERNAL_SERVICE_RESTART"],
  HIGH: [
    "EXTERNAL_API_CALL",
    "FORM_SUBMIT",
    "EMAIL_SEND",
    "FILE_DELETE",
    "DATABASE_WRITE",
  ],
  SOVEREIGN: [
    "PRODUCTION_DEPLOY",
    "VAULT_SEAL",
    "FINANCIAL_TRANSACTION",
    "SECRET_ROTATION",
    "VAULT999_WRITE",
    "CONSTITUTIONAL_FLOOR_CHANGE",
  ],
};

/**
 * Action classes that always 888_HOLD regardless of sensitivity.
 * The machine must never execute these autonomously.
 */
export const ALWAYS_HOLD_ACTIONS: ReadonlyArray<string> = [
  "git push --force",
  "DROP DATABASE",
  "DROP TABLE",
  "rm -rf /",
  "chmod -R 777 /",
  "ufw disable",
  "systemctl stop arifos",
  "vault999.chain.reset",
  "constitution.floor.mutate",
];

// ─── Validation helpers ───────────────────────────────────────────────

/**
 * Check whether a specific action class triggers 888_HOLD given a sensitivity.
 */
export function triggersHold(
  actionClass: string,
  sensitivity: SensitivityLevel
): boolean {
  if (ALWAYS_HOLD_ACTIONS.includes(actionClass)) return true;
  return HOLD_TRIGGER_MAP[sensitivity]?.includes(actionClass) ?? false;
}

/**
 * Determine if a sensitivity tier itself requires human ratification.
 * SOVEREIGN tier always requires human approval per F13.
 */
export function sensitivityRequiresHuman(sensitivity: SensitivityLevel): boolean {
  return sensitivity === "SOVEREIGN";
}

// ─── Lightweight parse() — no Zod, just structural checks ────────────

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

/**
 * Parse a raw object into a Mission. Returns errors if structure invalid.
 * Pure runtime check. No exceptions thrown.
 */
export function parseMission(raw: unknown): ParseResult<Mission> {
  const errors: string[] = [];

  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["MISSION_NOT_OBJECT"] };
  }
  const r = raw as Record<string, unknown>;

  // outcome
  if (typeof r.outcome !== "object" || r.outcome === null) {
    return { ok: false, errors: ["OUTCOME_REQUIRED"] };
  }
  const o = r.outcome as Record<string, unknown>;
  if (typeof o.objective !== "string" || o.objective.length < 10) {
    errors.push("OBJECTIVE_REQUIRED_AND_10_CHARS");
  }
  if (!Array.isArray(o.success_criteria) || o.success_criteria.length === 0) {
    errors.push("SUCCESS_CRITERIA_REQUIRED_NONEMPTY");
  } else {
    for (const c of o.success_criteria) {
      if (typeof c !== "string" || c.length === 0) {
        errors.push("SUCCESS_CRITERIA_ITEM_NOT_STRING");
      }
    }
  }
  if (o.sensitivity !== undefined && !ALL_SENSITIVITY.includes(o.sensitivity as SensitivityLevel)) {
    errors.push(`SENSITIVITY_INVALID: ${o.sensitivity}`);
  }
  if (o.persistence_policy !== undefined && !ALL_PERSISTENCE.includes(o.persistence_policy as PersistencePolicy)) {
    // ignore — persistence is on RunConfig, not OutcomeSpec
  }

  // run
  if (typeof r.run !== "object" || r.run === null) {
    errors.push("RUN_REQUIRED");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: raw as Mission };
}
