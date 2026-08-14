/**
 * AUTH Task Contract v1.0 — The Institutional Protocol Schema
 *
 * "A task is not a prompt. A prompt is instructions. A task is:
 *   objective + acceptance criteria + evidence requirements +
 *   merge policy + constitutional classification."
 *
 * This schema defines the contract that gates the transition from
 * OBSERVE (free) → MUTATE (governed) → DEPLOY (sealed).
 *
 * THE THREE LAWS:
 *   OBSERVE is free.
 *   MUTATE is governed.
 *   DEPLOY is sealed.
 *
 * @doctrine DITEMPA BUKAN DIBERI — Forged, Not Given
 * @ratified 2026-08-08 — Arif F13 SOVEREIGN
 * @institution AUTH Protocol v1.0
 */

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// §1 — ACTION CLASS (the three laws)
// ═══════════════════════════════════════════════════════════════════

export const ACTION_CLASS = {
  OBSERVE: "OBSERVE",   // read, explore, explain — no contract needed
  MUTATE: "MUTATE",     // edit, refactor, fix — contract + lease + evidence + receipt
  DEPLOY: "DEPLOY",     // production, credentials, infrastructure — full pipeline + seal
} as const;

export type ActionClass = (typeof ACTION_CLASS)[keyof typeof ACTION_CLASS];

// ═══════════════════════════════════════════════════════════════════
// §2 — WORKER ROLE (role-bound lease)
// ═══════════════════════════════════════════════════════════════════

export const WORKER_ROLE = {
  BUILDER: "builder",       // writes code, edits files
  REVIEWER: "reviewer",     // reviews diffs, gate-keeps quality
  SECURITY: "security",     // audits for vulnerabilities
  ARCHITECT: "architect",   // designs systems, not implementation
  TESTER: "tester",         // writes/runs tests
} as const;

export type WorkerRole = (typeof WORKER_ROLE)[keyof typeof WORKER_ROLE];

// ═══════════════════════════════════════════════════════════════════
// §3 — MERGE POLICY
// ═══════════════════════════════════════════════════════════════════

export const MERGE_POLICY = {
  AUTO: "auto",                          // merge if tests pass (Tier 1 only)
  REQUIRE_555_VERIFICATION: "require_555_verification", // 555-ASI must verify
  REQUIRE_888_SEAL: "require_888_seal",  // 888-APEX must judge + seal
  REQUIRE_F13_ACK: "require_f13_ack",    // Arif must approve (T3 actions)
} as const;

export type MergePolicy = (typeof MERGE_POLICY)[keyof typeof MERGE_POLICY];

// ═══════════════════════════════════════════════════════════════════
// §4 — EVIDENCE TYPE (what must be produced)
// ═══════════════════════════════════════════════════════════════════

export const EVIDENCE_TYPE = {
  DIFF: "diff",                 // git diff of changes
  TEST_OUTPUT: "test_output",   // test runner output
  BENCHMARK: "benchmark",       // performance benchmarks
  SCREENSHOT: "screenshot",     // visual evidence
  LOG: "log",                   // execution logs
  RECEIPT: "receipt",           // structured receipt
} as const;

export type EvidenceType = (typeof EVIDENCE_TYPE)[keyof typeof EVIDENCE_TYPE];

// ═══════════════════════════════════════════════════════════════════
// §5 — RISK TIER
// ═══════════════════════════════════════════════════════════════════

export const RISK_TIER = {
  LOW: "low",         // single file, fully reversible, no blast radius
  MEDIUM: "medium",   // multi-file, reversible via git, moderate blast
  HIGH: "high",       // multi-organ, deployment, requires verification
  CRITICAL: "critical", // irreversible, production, credentials, requires F13
} as const;

export type RiskTier = (typeof RISK_TIER)[keyof typeof RISK_TIER];

// ═══════════════════════════════════════════════════════════════════
// §6 — TASK CONTRACT (the core schema)
// ═══════════════════════════════════════════════════════════════════

export const TaskContractSchema = z.object({
  /** Unique task identifier */
  task_id: z.string().min(3).max(64)
    .describe("Unique task identifier, e.g. 'AUTH_001'"),

  /** Human-readable objective */
  objective: z.string().min(10).max(500)
    .describe("What this task aims to accomplish"),

  /** Action class — determines which pipeline gates apply */
  action_class: z.nativeEnum(ACTION_CLASS).default(ACTION_CLASS.MUTATE)
    .describe("OBSERVE=free, MUTATE=governed, DEPLOY=sealed"),

  /** Worker role for lease binding */
  worker_role: z.nativeEnum(WORKER_ROLE).default(WORKER_ROLE.BUILDER)
    .describe("Role of the worker acquiring the lease"),

  /** Concrete acceptance criteria */
  acceptance_criteria: z.array(z.string().min(5).max(200)).min(1).max(10)
    .describe("List of criteria that must be satisfied for task completion"),

  /** Evidence types required before the task can be sealed */
  evidence_required: z.array(z.nativeEnum(EVIDENCE_TYPE)).min(1).max(6)
    .describe("Types of evidence that must be produced"),

  /** Merge policy — who must approve before merge */
  merge_policy: z.nativeEnum(MERGE_POLICY).default(MERGE_POLICY.REQUIRE_555_VERIFICATION)
    .describe("Who must approve before changes are merged"),

  /** Whether a VAULT999 seal is required */
  seal_required: z.boolean().default(false)
    .describe("If true, task must be sealed to VAULT999 (Lane A)"),

  /** Whether the task is reversible (affects F1 AMANAH gating) */
  reversible: z.boolean().default(true)
    .describe("Whether the task can be rolled back after execution"),

  /** Risk tier */
  risk_tier: z.nativeEnum(RISK_TIER).default(RISK_TIER.LOW)
    .describe("Risk classification"),

  /** Constitutional classification — what kind of action this is */
  constitutional_class: z.enum(["read", "write", "execute", "mutation", "deploy"])
    .default("mutation")
    .describe("Constitutional action class: read=OBSERVE, write=MUTATE, execute=MUTATE, mutation=MUTATE, deploy=DEPLOY"),

  /** Authority that requested this task */
  authority: z.object({
    requested_by: z.string().default("ARIF")
      .describe("Who requested this task"),
    approved_by: z.string().optional()
      .describe("Who approved this task (if different from requester)"),
    delegated_to: z.string().optional()
      .describe("Worker agent this task is delegated to"),
  }).default({ requested_by: "ARIF" })
    .describe("Authority chain for this task"),

  /** Target repository or organ */
  target: z.string().min(1).max(200).optional()
    .describe("Target repository or organ path"),

  /** Authorized worker agent IDs (empty = any available) */
  authorized_workers: z.array(z.string()).optional()
    .describe("Specific worker agents authorized (empty = any)"),

  /** Maximum execution time in ms */
  timeout_ms: z.number().int().positive().max(900_000).default(300_000)
    .describe("Maximum execution time (default 5 min, max 15 min)"),

  /** Optional context for the worker */
  context: z.string().max(10_000).optional()
    .describe("Additional context, constraints, or specifications"),

  /** Task dependencies (must complete before this task starts) */
  depends_on: z.array(z.string()).optional()
    .describe("Task IDs that must complete before this one"),

  /** Authority that requested this task */
  requested_by: z.string().default("ARIF")
    .describe("Who requested this task (F13 sovereign default)"),
});

export type TaskContract = z.infer<typeof TaskContractSchema>;

// ═══════════════════════════════════════════════════════════════════
// §7 — EVIDENCE BUNDLE (what the worker produces)
// ═══════════════════════════════════════════════════════════════════

export const EvidenceBundleSchema = z.object({
  /** Task this evidence belongs to */
  task_id: z.string(),

  /** Git diff of changes */
  diff: z.string().optional(),

  /** Test output */
  test_output: z.string().optional(),

  /** Benchmark results */
  benchmark: z.string().optional(),

  /** Screenshot path(s) */
  screenshots: z.array(z.string()).optional(),

  /** Execution logs */
  logs: z.string().optional(),

  /** Structured receipt */
  receipt: z.string().optional(),

  /** Files changed */
  files_changed: z.array(z.string()),

  /** Exit code of the worker */
  exit_code: z.number().int(),

  /** Execution time in ms */
  execution_time_ms: z.number().int().positive(),

  /** Worker agent that produced this evidence */
  worker_agent: z.string(),

  /** Timestamp */
  produced_at: z.string().datetime(),
});

export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;

// ═══════════════════════════════════════════════════════════════════
// §8 — PIPELINE STATUS (tracking the institutional workflow)
// ═══════════════════════════════════════════════════════════════════

export const PIPELINE_STAGE = {
  DECLARED: "DECLARED",       // Contract created
  FQ_GATED: "FQ_GATED",     // FQ reality-contact gate passed
  LEASED: "LEASED",           // Worktree lease acquired
  LOCKED: "LOCKED",           // Target files locked
  EXECUTING: "EXECUTING",     // Worker executing in sandbox
  EVIDENCED: "EVIDENCED",     // Evidence bundle produced
  VERIFIED: "VERIFIED",       // 555-ASI verification passed
  JUDGED: "JUDGED",           // 888-APEX verdict rendered
  MERGED: "MERGED",           // Changes merged to target
  SEALED: "SEALED",           // Receipt sealed to VAULT999
  INGESTED: "INGESTED",       // arifFLOW metabolized
  FAILED: "FAILED",           // Pipeline failed
  ROLLED_BACK: "ROLLED_BACK", // Reversible rollback executed
} as const;

export type PipelineStage = (typeof PIPELINE_STAGE)[keyof typeof PIPELINE_STAGE];

export const PipelineStatusSchema = z.object({
  /** Contract this pipeline is executing */
  task_id: z.string(),

  /** Current stage */
  stage: z.nativeEnum(PIPELINE_STAGE),

  /** Lease ID if acquired */
  lease_id: z.string().optional(),

  /** Lock ID if acquired */
  lock_id: z.string().optional(),

  /** Sandbox/stage ID */
  stage_id: z.string().optional(),

  /** Evidence bundle if produced */
  evidence: EvidenceBundleSchema.optional(),

  /** 555-ASI verification result */
  verification: z.object({
    passed: z.boolean(),
    verdict: z.string().optional(),
    witness_organ: z.string().optional(),
  }).optional(),

  /** 888-APEX judgment result */
  judgment: z.object({
    verdict: z.enum(["SEAL", "HOLD", "SABAR", "VOID"]),
    constitutional_chain_id: z.string().optional(),
    reason: z.string().optional(),
  }).optional(),

  /** Receipt ID if sealed */
  receipt_id: z.string().optional(),

  /** Vault seal ID if Lane A sealed */
  vault_seal_id: z.string().optional(),

  /** Error message if failed */
  error: z.string().optional(),

  /** Timestamps per stage */
  timestamps: z.record(z.string()).optional(),

  /** Pipeline started at */
  started_at: z.string().datetime(),

  /** Pipeline completed/terminated at */
  completed_at: z.string().datetime().optional(),
});

export type PipelineStatus = z.infer<typeof PipelineStatusSchema>;

// ═══════════════════════════════════════════════════════════════════
// §9 — PIPELINE SUMMARY (what the orchestrator returns)
// ═══════════════════════════════════════════════════════════════════

export interface PipelineResult {
  /** Whether the pipeline completed successfully */
  success: boolean;

  /** Final stage reached */
  final_stage: PipelineStage;

  /** Task contract that was executed */
  contract: TaskContract;

  /** Full pipeline status */
  status: PipelineStatus;

  /** Summary for human consumption */
  summary: string;

  /** Delta-S (entropy change) */
  delta_s: number;
}
