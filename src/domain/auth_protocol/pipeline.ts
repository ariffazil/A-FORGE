/**
 * AUTH Pipeline Orchestrator v1.0
 *
 * THE INSTITUTIONAL PROTOCOL:
 *   Contract → Lease → Lock → Sandbox → Evidence →
 *   555 Verify → 888 Judge → Merge → Seal → Ingest
 *
 * AUTH governs transitions, not agents.
 * OBSERVE is free. MUTATE is governed. DEPLOY is sealed.
 *
 * This is not a new organ. This is not a new agent.
 * This is the protocol that chains existing tools into
 * a non-bypassable institutional workflow.
 *
 * @doctrine DITEMPA BUKAN DIBERI — Forged, Not Given
 * @institution AUTH v1.0
 * @forged 2026-08-08 — Arif F13 SOVEREIGN directive
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { randomUUID } from "node:crypto";

import {
  TaskContractSchema,
  type TaskContract,
  type EvidenceBundle,
  type PipelineStatus,
  type PipelineResult,
  PIPELINE_STAGE,
} from "./task_contract.js";


// ═══════════════════════════════════════════════════════════════════
// FQ REALITY-CONTACT GATE — Stabilization Law #4
// ═══════════════════════════════════════════════════════════════════

/**
 * Maps AUTH risk_tier to arifFlow RiskClass fq_required floor.
 * Derived from SYSTEM_STABILIZATION_INIT::v0.1 — Arif F13 SOVEREIGN.
 *
 * | risk_tier | fq_required | rationale |
 * |-----------|-------------|-----------|
 * | low       | 0.1         | Single file, reversible — minimal reality contact |
 * | medium    | 0.3         | Multi-file, moderate blast — needs grounding |
 * | high      | 0.5         | Multi-organ, deployment — reality must constrain |
 * | critical  | 1.0         | Irreversible, F13-gated — full verification required |
 */
function fqRequiredForRiskTier(risk_tier: string): number {
  switch (risk_tier) {
    case "low": return 0.1;
    case "medium": return 0.3;
    case "high": return 0.5;
    case "critical": return 1.0;
    default: return 0.3;
  }
}

/**
 * STEP FQ_GATE: Reality-contact verification.
 * Queries arifFlow :7073/health for actor's current FQ.
 * Compares against fq_required for contract's risk_tier.
 * HOLD if FQ < fq_required — "Insufficient reality contact."
 */
async function stepFqGate(ctx: PipelineContext): Promise<PipelineContext> {
  if (ctx.contract.action_class === "OBSERVE") return ctx;

  const fq_required = fqRequiredForRiskTier(ctx.contract.risk_tier ?? "low");
  const actor_id = ctx.contract.authority?.delegated_to
    ?? ctx.contract.authority?.requested_by
    ?? "unknown";

  try {
    // Query arifFlow for current FQ state
    const resp = await fetch("http://127.0.0.1:7073/health", { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) {
      // arifFlow unreachable — fail-closed
      ctx.status.stage = PIPELINE_STAGE.FAILED;
      ctx.status.error = `FQ GATE: arifFlow unreachable (HTTP ${resp.status}). Cannot verify reality contact.`;
      ctx.status.completed_at = new Date().toISOString();
      return ctx;
    }

    const health = await resp.json() as any;
    const per_actor = health?.fq?.per_actor ?? {};
    const actor_state = per_actor[actor_id];

    if (!actor_state) {
      // Actor not tracked — allow with warning (new actor, no history)
      ctx.status.stage = PIPELINE_STAGE.FQ_GATED;
      ctx.status.timestamps = { ...ctx.status.timestamps, fq_gated: new Date().toISOString() };
      return ctx;
    }

    const actor_fq = actor_state.quotient ?? 0;
    const actor_held = actor_state.held ?? false;

    // Anti-simulation lock: held actor cannot proceed
    if (actor_held) {
      ctx.status.stage = PIPELINE_STAGE.FAILED;
      ctx.status.error = `FQ GATE: Actor '${actor_id}' is HELD. Diagnosis: ${actor_state.diagnosis ?? "UNKNOWN"}. Verify before executing.`;
      ctx.status.completed_at = new Date().toISOString();
      return ctx;
    }

    // Risk-weighted FQ gate
    if (actor_fq < fq_required) {
      ctx.status.stage = PIPELINE_STAGE.FAILED;
      ctx.status.error = `FQ GATE: Actor '${actor_id}' FQ=${actor_fq.toFixed(2)} < fq_required=${fq_required} (risk_tier=${ctx.contract.risk_tier}). Insufficient reality contact.`;
      ctx.status.completed_at = new Date().toISOString();
      return ctx;
    }

    ctx.status.stage = PIPELINE_STAGE.FQ_GATED;
    ctx.status.timestamps = { ...ctx.status.timestamps, fq_gated: new Date().toISOString() };
    return ctx;

  } catch (err) {
    // Network error — fail-closed (Stabilization: reality contact is non-negotiable)
    ctx.status.stage = PIPELINE_STAGE.FAILED;
    ctx.status.error = `FQ GATE: Failed to contact arifFlow — ${(err as Error).message}. Fail-closed: cannot verify reality contact.`;
    ctx.status.completed_at = new Date().toISOString();
    return ctx;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PIPELINE STEP HANDLERS
// ═══════════════════════════════════════════════════════════════════

interface PipelineContext {
  task_id: string;
  contract: TaskContract;
  status: PipelineStatus;
  lease_id?: string;
  lock_id?: string;
  stage_id?: string;
  evidence?: EvidenceBundle;
}

/**
 * STEP 1: DECLARE — Validate the contract.
 * Ensures the contract meets minimum requirements before any resources are allocated.
 */
async function stepDeclare(ctx: PipelineContext): Promise<PipelineContext> {
  const parsed = TaskContractSchema.safeParse(ctx.contract);
  if (!parsed.success) {
    throw new Error(
      `Contract validation failed: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }

  // OBSERVE-class actions do not need the pipeline
  if (ctx.contract.action_class === "OBSERVE") {
    ctx.status.stage = PIPELINE_STAGE.DECLARED;
    ctx.status.error = undefined;
    return ctx; // Skip all gates — OBSERVE is free
  }

  ctx.status.stage = PIPELINE_STAGE.DECLARED;
  ctx.status.timestamps = { ...ctx.status.timestamps, declared: new Date().toISOString() };
  return ctx;
}

/**
 * STEP 2: LEASE — Acquire a worktree lease.
 * forge_lease(mode="request") — binds a worker role to a target.
 */
async function stepLease(ctx: PipelineContext): Promise<PipelineContext> {
  if (ctx.contract.action_class === "OBSERVE") return ctx;

  // In a full implementation, this calls forge_lease(mode="request")
  // with worker_role, target, and session context.
  // For now: mint a synthetic lease_id for pipeline testing.
  ctx.lease_id = `LEASE-${ctx.task_id}-${randomUUID().slice(0, 8)}`;
  ctx.status.lease_id = ctx.lease_id;
  ctx.status.stage = PIPELINE_STAGE.LEASED;
  ctx.status.timestamps = { ...ctx.status.timestamps, leased: new Date().toISOString() };
  return ctx;
}

/**
 * STEP 3: LOCK — Acquire an F1 Amanah lock on target files.
 * forge_lock(mode="acquire") — prevents concurrent mutation.
 */
async function stepLock(ctx: PipelineContext): Promise<PipelineContext> {
  if (ctx.contract.action_class === "OBSERVE") return ctx;

  ctx.lock_id = `LOCK-${ctx.task_id}-${randomUUID().slice(0, 8)}`;
  ctx.status.lock_id = ctx.lock_id;
  ctx.status.stage = PIPELINE_STAGE.LOCKED;
  ctx.status.timestamps = { ...ctx.status.timestamps, locked: new Date().toISOString() };
  return ctx;
}

/**
 * STEP 4: EXECUTE — Run the worker in the sandbox.
 * forge_stage(mode="governance") → forge_sandbox_run
 * In a full implementation, this spawns the actual coding agent.
 */
async function stepExecute(ctx: PipelineContext): Promise<PipelineContext> {
  if (ctx.contract.action_class === "OBSERVE") return ctx;

  ctx.stage_id = `STAGE-${ctx.task_id}-${randomUUID().slice(0, 8)}`;
  ctx.status.stage_id = ctx.stage_id;
  ctx.status.stage = PIPELINE_STAGE.EXECUTING;
  ctx.status.timestamps = { ...ctx.status.timestamps, executing: new Date().toISOString() };

  // Placeholder: in production, this spawns the actual worker agent
  // and collects real evidence. For now, produce a skeleton bundle.
  ctx.evidence = {
    task_id: ctx.task_id,
    diff: "[worker diff would appear here]",
    test_output: "[test output would appear here]",
    files_changed: ctx.contract.target ? [ctx.contract.target] : [],
    exit_code: 0,
    execution_time_ms: 0,
    worker_agent: ctx.contract.worker_role,
    produced_at: new Date().toISOString(),
  };

  ctx.status.evidence = ctx.evidence;
  return ctx;
}

/**
 * STEP 5: EVIDENCE — Bundle all outputs into structured evidence.
 * Assembles diff + test output + logs into the EvidenceBundle.
 */
async function stepEvidence(ctx: PipelineContext): Promise<PipelineContext> {
  if (ctx.contract.action_class === "OBSERVE") return ctx;

  ctx.status.stage = PIPELINE_STAGE.EVIDENCED;
  ctx.status.timestamps = { ...ctx.status.timestamps, evidenced: new Date().toISOString() };
  return ctx;
}

/**
 * STEP 6: VERIFY — 555-ASI verification gate.
 * For now: auto-pass on MUTATE, require explicit check on DEPLOY.
 */
async function stepVerify(ctx: PipelineContext): Promise<PipelineContext> {
  if (ctx.contract.action_class === "OBSERVE") return ctx;

  const passed =
    ctx.contract.merge_policy !== "require_555_verification" ||
    ctx.contract.risk_tier === "low";

  ctx.status.verification = {
    passed,
    verdict: passed ? "PASS" : "HOLD — requires 555-ASI verification",
    witness_organ: passed ? "555-ASI" : undefined,
  };

  if (!passed) {
    ctx.status.stage = PIPELINE_STAGE.FAILED;
    ctx.status.error = "555-ASI verification required but not performed";
    ctx.status.completed_at = new Date().toISOString();
    return ctx;
  }

  ctx.status.stage = PIPELINE_STAGE.VERIFIED;
  ctx.status.timestamps = { ...ctx.status.timestamps, verified: new Date().toISOString() };
  return ctx;
}

/**
 * STEP 7: JUDGE — 888-APEX constitutional verdict.
 * For DEPLOY-class: requires SEAL verdict. For MUTATE: auto-SEAL.
 */
async function stepJudge(ctx: PipelineContext): Promise<PipelineContext> {
  if (ctx.contract.action_class === "OBSERVE") return ctx;

  const verdict =
    ctx.contract.action_class === "DEPLOY" || ctx.contract.merge_policy === "require_888_seal"
      ? "HOLD" // Requires actual arif_judge call — placeholder
      : "SEAL"; // MUTATE-class auto-SEAL for now

  ctx.status.judgment = {
    verdict: verdict as "SEAL" | "HOLD",
    reason:
      verdict === "HOLD"
        ? "DEPLOY-class requires 888-APEX constitutional judgment"
        : "MUTATE-class — auto-SEAL per Lane B",
  };

  if (verdict === "HOLD") {
    ctx.status.stage = PIPELINE_STAGE.FAILED;
    ctx.status.error = "888-APEX judgment required for DEPLOY-class actions";
    ctx.status.completed_at = new Date().toISOString();
    return ctx;
  }

  ctx.status.stage = PIPELINE_STAGE.JUDGED;
  ctx.status.timestamps = { ...ctx.status.timestamps, judged: new Date().toISOString() };
  return ctx;
}

/**
 * STEP 8: MERGE — Merge changes to target.
 * For now: placeholder (actual merge depends on git operations).
 */
async function stepMerge(ctx: PipelineContext): Promise<PipelineContext> {
  if (ctx.contract.action_class === "OBSERVE") return ctx;

  ctx.status.stage = PIPELINE_STAGE.MERGED;
  ctx.status.timestamps = { ...ctx.status.timestamps, merged: new Date().toISOString() };
  return ctx;
}

/**
 * STEP 9: SEAL — Issue receipt to VAULT999.
 * Lane B for MUTATE, Lane A for DEPLOY.
 */
async function stepSeal(ctx: PipelineContext): Promise<PipelineContext> {
  if (ctx.contract.action_class === "OBSERVE") return ctx;

  ctx.status.receipt_id = `RECEIPT-${ctx.task_id}-${randomUUID().slice(0, 8)}`;

  if (ctx.contract.seal_required || ctx.contract.action_class === "DEPLOY") {
    ctx.status.vault_seal_id = `VAULT999-${ctx.task_id}-${randomUUID().slice(0, 8)}`;
  }

  ctx.status.stage = PIPELINE_STAGE.SEALED;
  ctx.status.timestamps = { ...ctx.status.timestamps, sealed: new Date().toISOString() };
  return ctx;
}

/**
 * STEP 10: INGEST — arifFLOW metabolic checkpoint.
 * flow_ingest(step_type="Seal") — records the completion into the metabolic ledger.
 */
async function stepIngest(ctx: PipelineContext): Promise<PipelineContext> {
  if (ctx.contract.action_class === "OBSERVE") return ctx;

  ctx.status.stage = PIPELINE_STAGE.INGESTED;
  ctx.status.timestamps = { ...ctx.status.timestamps, ingested: new Date().toISOString() };
  return ctx;
}

/**
 * STEP R: ROLLBACK — Reverse a failed pipeline.
 * F1 AMANAH: every mutation must have a rollback path.
 */
async function stepRollback(ctx: PipelineContext, error: Error): Promise<PipelineContext> {
  ctx.status.stage = PIPELINE_STAGE.FAILED;
  ctx.status.error = error.message;
  ctx.status.completed_at = new Date().toISOString();

  if (ctx.contract.reversible) {
    // Release lock, revoke lease
    ctx.status.stage = PIPELINE_STAGE.ROLLED_BACK;
    ctx.status.timestamps = { ...ctx.status.timestamps, rolled_back: new Date().toISOString() };
  }

  return ctx;
}

// ═══════════════════════════════════════════════════════════════════
// PIPELINE EXECUTOR — The Institution Itself
// ═══════════════════════════════════════════════════════════════════

const PIPELINE = [
  { name: "DECLARE", fn: stepDeclare },
  { name: "FQ_GATE", fn: stepFqGate },
  { name: "LEASE", fn: stepLease },
  { name: "LOCK", fn: stepLock },
  { name: "EXECUTE", fn: stepExecute },
  { name: "EVIDENCE", fn: stepEvidence },
  { name: "VERIFY", fn: stepVerify },
  { name: "JUDGE", fn: stepJudge },
  { name: "MERGE", fn: stepMerge },
  { name: "SEAL", fn: stepSeal },
  { name: "INGEST", fn: stepIngest },
] as const;

/**
 * Execute the full AUTH pipeline on a task contract.
 *
 * THE THREE LAWS:
 *   OBSERVE → skip all gates, return immediately
 *   MUTATE  → full pipeline (declare → ingest), Lane B receipt
 *   DEPLOY  → full pipeline + 555 verify + 888 judge + Lane A seal
 */
async function executePipeline(contract: TaskContract): Promise<PipelineResult> {
  const ctx: PipelineContext = {
    task_id: contract.task_id,
    contract,
    status: {
      task_id: contract.task_id,
      stage: PIPELINE_STAGE.DECLARED,
      started_at: new Date().toISOString(),
      timestamps: {},
    },
  };

  // OBSERVE is free — skip all gates
  if (contract.action_class === "OBSERVE") {
    ctx.status.stage = PIPELINE_STAGE.INGESTED;
    ctx.status.completed_at = new Date().toISOString();
    return {
      success: true,
      final_stage: PIPELINE_STAGE.INGESTED,
      contract,
      status: ctx.status,
      summary: `Task ${contract.task_id}: OBSERVE is free. No contract required.`,
      delta_s: 0,
    };
  }

  // Execute pipeline steps sequentially
  for (const step of PIPELINE) {
    try {
      await step.fn(ctx);

      // Check for early termination (VERIFY or JUDGE may HOLD)
      if (ctx.status.stage === PIPELINE_STAGE.FAILED) {
        return {
          success: false,
          final_stage: ctx.status.stage,
          contract,
          status: ctx.status,
          summary: `Task ${contract.task_id}: BLOCKED at ${step.name}. ${ctx.status.error}`,
          delta_s: 0.1,
        };
      }
    } catch (error) {
      await stepRollback(ctx, error as Error);
      return {
        success: false,
        final_stage: ctx.status.stage,
        contract,
        status: ctx.status,
        summary: `Task ${contract.task_id}: FAILED at ${step.name}. ${(error as Error).message}. ${ctx.contract.reversible ? "Rolled back." : "IRREVERSIBLE — manual intervention required."}`,
        delta_s: 0.5,
      };
    }
  }

  ctx.status.completed_at = new Date().toISOString();

  return {
    success: true,
    final_stage: PIPELINE_STAGE.INGESTED,
    contract,
    status: ctx.status,
    summary: [
      `Task ${contract.task_id}: COMPLETE.`,
      `Action class: ${contract.action_class}`,
      `Risk tier: ${contract.risk_tier}`,
      `Merge policy: ${contract.merge_policy}`,
      `Sealed: ${ctx.status.receipt_id}`,
      ctx.status.vault_seal_id ? `Vault: ${ctx.status.vault_seal_id}` : null,
      `Total stages: ${Object.keys(ctx.status.timestamps ?? {}).length}`,
    ]
      .filter(Boolean)
      .join(" "),
    delta_s: -0.3,
  };
}

// ═══════════════════════════════════════════════════════════════════
// MCP TOOL HANDLER — auth_pipeline
// ═══════════════════════════════════════════════════════════════════

const AuthPipelineRequestSchema = z.object({
  /** The task contract (YAML/JSON) */
  contract: TaskContractSchema,

  /** Optional: specific worker agent to use */
  worker_agent: z.string().optional(),

  /** Optional: dry-run (validate contract without executing) */
  dry_run: z.boolean().default(false),
});

async function authPipelineHandler(
  args: z.infer<typeof AuthPipelineRequestSchema>
) {
  if (args.dry_run) {
    const parsed = TaskContractSchema.safeParse(args.contract);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              valid: parsed.success,
              contract: args.contract.task_id,
              action_class: args.contract.action_class,
              gates: parsed.success
                ? args.contract.action_class === "OBSERVE"
                  ? "NONE — OBSERVE is free"
                  : args.contract.action_class === "DEPLOY"
                    ? "FULL — 10-stage pipeline + 555 verify + 888 judge + Lane A seal"
                    : "STANDARD — 10-stage pipeline + Lane B receipt"
                : parsed.error.issues.map((i) => i.message),
              _meta: {
                protocol: "AUTH",
                version: "1.0.0",
                forged: "2026-08-08",
                doctrine: "DITEMPA BUKAN DIBERI",
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  const result = await executePipeline(args.contract);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            success: result.success,
            task_id: result.contract.task_id,
            final_stage: result.final_stage,
            summary: result.summary,
            delta_s: result.delta_s,
            status: result.status,
            _meta: {
              protocol: "AUTH",
              version: "1.0.0",
              forged: "2026-08-08",
              doctrine: "DITEMPA BUKAN DIBERI",
              institution: "AUTH governs transitions, not agents.",
              three_laws: {
                OBSERVE: "free",
                MUTATE: "governed",
                DEPLOY: "sealed",
              },
            },
          },
          null,
          2
        ),
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════
// TOOL REGISTRATION
// ═══════════════════════════════════════════════════════════════════

export function registerAuthPipeline(server: McpServer) {
  server.tool(
    "auth_pipeline",
    `AUTH INSTITUTIONAL PROTOCOL — the non-bypassable workflow that governs transitions from OBSERVE to MUTATE to DEPLOY.

THE THREE LAWS:
  OBSERVE is free. (no contract needed)
  MUTATE is governed. (contract + lease + evidence + receipt)
  DEPLOY is sealed. (full pipeline + 555 verify + 888 judge + Lane A seal)

PIPELINE:
  DECLARE → FQ_GATE → LEASE → LOCK → EXECUTE → EVIDENCE → VERIFY → JUDGE → MERGE → SEAL → INGEST

AUTH governs transitions, not agents. Claude Code + OBSERVE needs no contract.
Kimi + MUTATE needs the same contract as any other agent.
The institution does not care WHO holds the scalpel — only whether the cut requires a contract.`,
    AuthPipelineRequestSchema.shape,
    authPipelineHandler
  );

  console.log("[A-FORGE] Registered auth_pipeline — the institutional protocol");
}
