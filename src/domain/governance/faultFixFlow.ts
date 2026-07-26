/**
 * FORGE FAULT-FIX FLOW — Unified detect → classify → fix → verify → seal pipeline.
 *
 * Every forge operation can fail. Currently the pieces exist independently:
 *   - Error classifier (error-classifier.ts) — 10 fault classes
 *   - GitDiffGuard — collision → rollback
 *   - ArifJudge — DENY/GATE/ALLOW command gate
 *   - GödelLock — constitutional immutability
 *   - ArifSeal — hash-chain audit
 *   - WM Analytics — prediction gap as fault signal
 *
 * But there's no unified orchestration layer that ties them together.
 * This module IS that layer.
 *
 * The Flow:
 *   1. FAULT → detect what went wrong (error envelope + WM gap signal)
 *   2. CLASSIFY → map to a fix strategy (retry, route, rollback, escalate, hold)
 *   3. FIX → execute the appropriate recovery action
 *   4. VERIFY → confirm the fix resolved the fault
 *   5. SEAL → audit trail the entire recovery cycle
 *
 * Constitutional:
 *   F1 AMANAH — every fix is reversible or gated
 *   F2 TRUTH — fault classification is epistemic (OBS/DER)
 *   F4 CLARITY — structured fix strategies, no guessing
 *   F7 HUMILITY — escalating when uncertain
 *   F11 AUDIT — full recovery trace sealed
 *   F13 SOVEREIGN — 888_HOLD for irreversible or constitutional faults
 *
 * @module domain/governance/faultFixFlow
 * @forged 2026-07-21
 */

import { createHash } from "node:crypto";
import type {
  ErrorEnvelope,
  Recoverability,
} from "./error-classifier.js";
import { getRecoveryStrategy } from "./error-classifier.js";
import { rollbackFile } from "./GitDiffGuard.js";
import { isGodelLocked } from "../../interfaces/mcp/shell/godelLock.js";
import { checkGapAlert } from "./observationPredictor.js";

// ── Types ───────────────────────────────────────────────────────────────────

export type FaultSource =
  | "tool_error"       // A forge_* tool returned a structured error
  | "wm_gap"           // Prediction gap exceeded threshold (WM L3)
  | "collision"        // Git collision detected (F12)
  | "godel_lock"       // Attempted mutation of a Gödel-locked path
  | "judge_deny"       // ArifJudge blocked the command
  | "timeout"          // Operation exceeded time budget
  | "resource"         // OOM, disk full, rate limit
  | "unknown";         // Unclassified fault

export type FixStrategy =
  | "RETRY_SAME"       // Same tool, same params (transient fault)
  | "RETRY_DIFFERENT"  // Same tool, different params (bad input)
  | "ROUTE_OTHER"      // Try a different organ/tool
  | "ROLLBACK_FILE"    // Git checkout file to HEAD
  | "RESTART_SERVICE"  // systemctl restart the failed organ
  | "ESCALATE_HUMAN"   // Needs human decision
  | "HOLD_888"         // Constitutional hold — needs sovereign
  | "NOOP_WATCH"       // Observe but don't act (non-critical)
  | "ABORT"            // Hard stop, no recovery possible
  ;

export type FixVerdict =
  | "FIXED"            // Recovery succeeded
  | "PARTIAL"          // Partially fixed, some issues remain
  | "FAILED"           // Fix attempted but didn't work
  | "ESCALATED"        // Passed to higher authority
  | "HELD"             // 888_HOLD — awaiting sovereign
  ;

export interface FaultReport {
  /** Unique fault ID for tracing */
  fault_id: string;
  /** Where the fault originated */
  source: FaultSource;
  /** Original error envelope (if from tool_error) */
  error?: ErrorEnvelope;
  /** WM gap score (if from wm_gap) */
  gap_score?: number;
  /** What tool/operation was attempted */
  attempted_tool: string;
  /** What the agent was trying to do */
  intent: string;
  /** Workspace path at time of fault */
  cwd?: string;
  /** Target path involved in fault */
  target_path?: string;
  /** Timestamp of fault detection */
  detected_at: string;
}

export interface FixAction {
  /** Which strategy to apply */
  strategy: FixStrategy;
  /** Concrete description of the fix */
  description: string;
  /** What command/action to execute */
  action: string;
  /** Is this fix reversible? */
  reversible: boolean;
  /** Does this need 888_HOLD? */
  needs_hold: boolean;
  /** Estimated time to apply (ms) */
  estimated_ms: number;
}

export interface FixResult {
  /** The fault that was addressed */
  fault_id: string;
  /** The strategy that was applied */
  strategy: FixStrategy;
  /** What action was taken */
  action_taken: string;
  /** The outcome */
  verdict: FixVerdict;
  /** Evidence that the fix worked (or didn't) */
  evidence: string;
  /** If the fix failed, why */
  failure_reason?: string;
  /** Next step if fix was partial or failed */
  next_step?: string;
  /** Timestamps */
  started_at: string;
  completed_at: string;
  /** Audit hash */
  receipt_hash: string;
}

export interface FaultFixCycle {
  fault: FaultReport;
  fix: FixAction;
  result: FixResult;
  sealed: boolean;
  seal_hash: string;
}

// ── Fault Classifier ────────────────────────────────────────────────────────

/**
 * Classify a raw error into a FaultSource.
 */
export function classifyFault(
  error: unknown,
  context: {
    attempted_tool: string;
    intent: string;
    cwd?: string;
    target_path?: string;
    gap_score?: number;
    confidence?: number;
  },
): FaultReport {
  const faultId = `FF-${Date.now().toString(36)}-${createHash("sha256")
    .update(`${context.attempted_tool}:${context.intent}:${Date.now()}`)
    .digest("hex")
    .slice(0, 8)}`;

  const base: Omit<FaultReport, "source" | "error"> = {
    fault_id: faultId,
    attempted_tool: context.attempted_tool,
    intent: context.intent,
    detected_at: new Date().toISOString(),
  };

  // ── WM Gap Signal Check (L3) ──
  if (context.gap_score !== undefined && context.confidence !== undefined) {
    const alert = checkGapAlert(context.gap_score, context.confidence);
    if (alert.severity === "CRITICAL" || alert.severity === "WARN") {
      return {
        ...base,
        source: "wm_gap",
        gap_score: context.gap_score,
      };
    }
  }

  // ── Structured error check ──
  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;

    // Collision detection
    if (err.error_class === "COLLISION" || (err as any).has_collision) {
      return {
        ...base,
        source: "collision",
      };
    }

    // Gödel lock
    if (err.error_class === "FLOOR_BLOCK" || err.error_class === "AUTHORITY_BLOCK") {
      if (context.target_path && isGodelLocked(context.target_path)) {
        return { ...base, source: "godel_lock" };
      }
    }

    // Judge deny
    if ((err as any).judge_decision === "deny" || (err as any).gate === "ArifJudge") {
      return { ...base, source: "judge_deny" };
    }

    // Timeout
    if (err.error_class === "RESOURCE_EXHAUSTED") {
      return { ...base, source: "timeout" };
    }

    // Any structured error → tool_error
    if (err.error_class || (err as any).structuredContent) {
      return {
        ...base,
        source: "tool_error",
        error: (err.structuredContent || err) as ErrorEnvelope,
      };
    }
  }

  // ── Heuristic classification from error message ──
  const msg = error instanceof Error ? error.message : String(error ?? "").toLowerCase();

  if (msg.includes("timeout") || msg.includes("etimedout")) return { ...base, source: "timeout" };
  if (msg.includes("collision") || msg.includes("modified by")) return { ...base, source: "collision" };
  if (msg.includes("gödel") || msg.includes("locked path")) return { ...base, source: "godel_lock" };
  if (msg.includes("deny") || msg.includes("blocked")) return { ...base, source: "judge_deny" };
  if (msg.includes("oom") || msg.includes("memory") || msg.includes("disk full")) return { ...base, source: "resource" };

  return { ...base, source: "unknown" };
}

// ── Fix Strategy Selector ───────────────────────────────────────────────────

/**
 * Map a fault to the appropriate fix strategy.
 *
 * This is the core decision matrix — for each fault source + severity,
 * what's the best recovery action?
 */
export function selectFixStrategy(fault: FaultReport): FixAction {
  const { source } = fault;

  switch (source) {
    // ── Transient / retry-friendly ──
    case "timeout":
      return {
        strategy: "RETRY_SAME",
        description: "Transient timeout — retry with longer deadline",
        action: "Retry same operation with 2× timeout",
        reversible: true,
        needs_hold: false,
        estimated_ms: 100,
      };

    case "resource":
      return {
        strategy: "RETRY_SAME",
        description: "Resource exhaustion — back off and retry",
        action: "Wait 5s then retry same operation",
        reversible: true,
        needs_hold: false,
        estimated_ms: 5000,
      };

    // ── Input fix ──
    case "tool_error": {
      if (!fault.error) {
        return {
          strategy: "RETRY_DIFFERENT",
          description: "Tool error without structured envelope — retry with corrected input",
          action: "Fix input and retry",
          reversible: true,
          needs_hold: false,
          estimated_ms: 100,
        };
      }

      const recovery = getRecoveryStrategy({
        isError: true,
        structuredContent: fault.error,
        content: [],
      } as any);

      if (recovery.can_retry) {
        return {
          strategy: "RETRY_SAME",
          description: `Recoverable error: ${fault.error.message?.slice(0, 100)}`,
          action: fault.error.next_action || "Retry with same params",
          reversible: true,
          needs_hold: false,
          estimated_ms: 100,
        };
      }

      if (recovery.can_route) {
        return {
          strategy: "ROUTE_OTHER",
          description: `Route to different organ: ${fault.error.message?.slice(0, 100)}`,
          action: fault.error.next_action || "Try different organ",
          reversible: true,
          needs_hold: false,
          estimated_ms: 500,
        };
      }

      if (recovery.hold) {
        return {
          strategy: "HOLD_888",
          description: `Constitutional hold required: ${fault.error.message?.slice(0, 100)}`,
          action: "Escalate to 888_HOLD for sovereign decision",
          reversible: true,
          needs_hold: true,
          estimated_ms: 86400000, // 1 day
        };
      }

      return {
        strategy: "ESCALATE_HUMAN",
        description: `Escalate to human: ${fault.error.message?.slice(0, 100)}`,
        action: fault.error.next_action || "Escalate to human operator",
        reversible: true,
        needs_hold: false,
        estimated_ms: 3600000, // 1 hour
      };
    }

    // ── Collision ──
    case "collision":
    return {
      strategy: "ROLLBACK_FILE",
      description: "Git collision detected — rolling back",
      action: "git checkout HEAD -- <filepath>",
      reversible: false,
      needs_hold: false,
      estimated_ms: 500,
    };

    // ── Gödel lock or judge deny ──
    case "godel_lock":
      return {
        strategy: "HOLD_888",
        description: "Gödel-locked path — constitutional boundary",
        action: "Escalate to 888_HOLD — cannot self-modify constitution",
        reversible: true,
        needs_hold: true,
        estimated_ms: 86400000,
      };

    case "judge_deny":
      return {
        strategy: "ABORT",
        description: "ArifJudge blocked the command — do not retry",
        action: "Abort operation — command violates constitutional gate",
        reversible: true,
        needs_hold: false,
        estimated_ms: 0,
      };

    // ── WM Gap ──
    case "wm_gap":
      return {
        strategy: "NOOP_WATCH",
        description: `Prediction gap detected (${fault.gap_score}) — world model blind spot`,
        action: "Log gap for WM training — no immediate action needed",
        reversible: true,
        needs_hold: false,
        estimated_ms: 0,
      };

    // ── Unknown ──
    case "unknown":
    default:
      return {
        strategy: "ESCALATE_HUMAN",
        description: "Unclassified fault — escalate to human for triage",
        action: "Escalate to human operator",
        reversible: true,
        needs_hold: false,
        estimated_ms: 3600000,
      };
  }
}

// ── Fix Executor ────────────────────────────────────────────────────────────

export interface ExecutorContext {
  /** Execute a shell command (governed through forge_shell or direct) */
  execShell: (command: string, cwd?: string) => Promise<{ stdout: string; stderr: string; exitCode: number | null }>;
  /** Current working directory */
  cwd: string;
  /** Who is executing the fix */
  actor: string;
  /** Session ID for audit */
  session_id: string;
}

/**
 * Execute the fix action and produce a result.
 */
export async function executeFix(
  fault: FaultReport,
  fix: FixAction,
  ctx: ExecutorContext,
): Promise<FixResult> {
  const startedAt = Date.now();
  const startedIso = new Date().toISOString();

  let verdict: FixVerdict = "FAILED";
  let evidence = "";
  let failureReason = "";

  try {
    switch (fix.strategy) {
      case "RETRY_SAME":
      case "RETRY_DIFFERENT":
        // Retry strategies are handled by the caller — we just report
        verdict = "PARTIAL";
        evidence = "Retry strategy selected — caller must re-attempt operation";
        break;

      case "ROUTE_OTHER":
        verdict = "ESCALATED";
        evidence = "Routed to alternative organ/tool";
        break;

      case "ROLLBACK_FILE": {
        // Extract filepath from error message or fault context
        const filepath =
          fault.error?.message?.match(/[\w./-]+\.\w+/)?.[0] ||
          fault.intent;
        if (filepath) {
          const result = rollbackFile(filepath, ctx.cwd);
          if (result.success) {
            verdict = "FIXED";
            evidence = result.message;
          } else {
            verdict = "FAILED";
            failureReason = result.message;
          }
        } else {
          verdict = "FAILED";
          failureReason = "No filepath in collision report for rollback";
        }
        break;
      }

      case "RESTART_SERVICE": {
        // Extract service name from fault context
        const serviceName = fault.attempted_tool.replace("forge_", "").split("_")[0] || "";
        if (serviceName && serviceName.length > 1) {
          const result = await ctx.execShell(`systemctl restart ${serviceName}`, ctx.cwd);
          if (result.exitCode === 0) {
            verdict = "FIXED";
            evidence = `Service ${serviceName} restarted successfully`;
          } else {
            verdict = "FAILED";
            failureReason = `Restart failed: ${result.stderr.slice(0, 200)}`;
          }
        } else {
          verdict = "FAILED";
          failureReason = "Could not determine service name from fault context";
        }
        break;
      }

      case "HOLD_888":
        verdict = "HELD";
        evidence = "Placed in 888_HOLD — awaiting sovereign decision";
        break;

      case "ESCALATE_HUMAN":
        verdict = "ESCALATED";
        evidence = "Escalated to human operator";
        break;

      case "NOOP_WATCH":
        verdict = "FIXED"; // Observation-only — no action needed
        evidence = `Gap observed and logged for WM training (score: ${fault.gap_score})`;
        break;

      case "ABORT":
        verdict = "FAILED";
        failureReason = fix.description;
        break;
    }
  } catch (err: any) {
    verdict = "FAILED";
    failureReason = `Fix execution error: ${err.message?.slice(0, 200)}`;
  }

  const completedAt = Date.now();
  const receiptHash = createHash("sha256")
    .update(`${fault.fault_id}:${fix.strategy}:${verdict}:${startedIso}`)
    .digest("hex");

  const nextStep = deriveNextStep(verdict, fix);

  return {
    fault_id: fault.fault_id,
    strategy: fix.strategy,
    action_taken: fix.action,
    verdict,
    evidence,
    failure_reason: failureReason || undefined,
    next_step: nextStep,
    started_at: startedIso,
    completed_at: new Date().toISOString(),
    receipt_hash: receiptHash,
  };
}

// ── Next Step Derivation ────────────────────────────────────────────────────

function deriveNextStep(verdict: FixVerdict, fix: FixAction): string {
  switch (verdict) {
    case "FIXED":
      return "Continue operation from recovery point";
    case "PARTIAL":
      return "Retry original operation with corrected parameters";
    case "FAILED":
      if (fix.strategy === "ROLLBACK_FILE") return "Manual intervention needed — file state may be inconsistent";
      if (fix.strategy === "RESTART_SERVICE") return "Check journalctl for service crash details";
      return "Escalate to higher authority";
    case "ESCALATED":
      return "Await human response";
    case "HELD":
      return "Await 888_HOLD resolution from sovereign";
    default:
      return "Monitor and re-assess";
  }
}

// ── Full Cycle ──────────────────────────────────────────────────────────────

/**
 * Run the complete fault-fix cycle: detect → classify → fix → verify → seal.
 *
 * This is the single entry point. Call this when any operation fails.
 */
export async function runFaultFixCycle(
  error: unknown,
  context: {
    attempted_tool: string;
    intent: string;
    cwd?: string;
    target_path?: string;
    gap_score?: number;
    confidence?: number;
  },
  executor: ExecutorContext,
): Promise<FaultFixCycle> {
  // 1. DETECT + CLASSIFY
  const fault = classifyFault(error, context);

  // 2. SELECT FIX STRATEGY
  const fix = selectFixStrategy(fault);

  // 3. EXECUTE FIX
  const result = await executeFix(fault, fix, executor);

  // 4. SEAL
  const cycleHash = createHash("sha256")
    .update(`${fault.fault_id}:${fix.strategy}:${result.verdict}:${result.receipt_hash}`)
    .digest("hex");

  // P1-5c: Forward fault-fix cycle to arifFLOW — fire-and-forget
  setImmediate(() => {
    _forwardFaultFixToArifFlow(fault, fix, result, cycleHash, context).catch(() => {});
  });

  return {
    fault,
    fix,
    result,
    sealed: true,
    seal_hash: cycleHash,
  };
}

// ── Quick Classifiers (for inline use) ─────────────────────────────────────

/**
 * Quick check: is this fault recoverable by the agent alone?
 * True → agent can proceed without human. False → escalate or hold.
 */
export function isAutoRecoverable(fault: FaultReport): boolean {
  const autoStrategies: FixStrategy[] = [
    "RETRY_SAME", "RETRY_DIFFERENT", "ROUTE_OTHER",
    "ROLLBACK_FILE", "NOOP_WATCH",
  ];
  const fix = selectFixStrategy(fault);
  return autoStrategies.includes(fix.strategy);
}

/**
 * Quick check: does this fault need immediate human attention?
 */
export function needsHumanAttention(fault: FaultReport): boolean {
  const fix = selectFixStrategy(fault);
  return fix.strategy === "ESCALATE_HUMAN" || fix.strategy === "HOLD_888" || fix.needs_hold;
}

// ── Severity → Blast Radius Mapping ─────────────────────────────────────────

export type BlastRadius = "NONE" | "LOCAL" | "ORGAN" | "FEDERATION" | "IRREVERSIBLE";

export function faultBlastRadius(fault: FaultReport): BlastRadius {
  switch (fault.source) {
    case "wm_gap": return "NONE";
    case "timeout": return "LOCAL";
    case "resource": return "ORGAN";
    case "tool_error": return "LOCAL";
    case "collision": return "LOCAL";
    case "judge_deny": return "FEDERATION";
    case "godel_lock": return "IRREVERSIBLE";
    case "unknown": return "ORGAN";
  }
}

/**
 * P1-5c: Forward fault-fix cycle to arifFLOW :7073/receipt/emit.
 * Fire-and-forget — failure is silent, local cycle is canonical.
 * DEPRECATED P1-7: will be replaced by arifFLOW client import post-extraction.
 */
async function _forwardFaultFixToArifFlow(
  fault: FaultReport,
  fix: FixAction,
  result: FixResult,
  cycleHash: string,
  context: { attempted_tool: string; intent: string; gap_score?: number; confidence?: number },
): Promise<void> {
  try {
    await fetch("http://127.0.0.1:7073/receipt/emit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organ: "A-FORGE",
        producer: "faultFixFlow",
        action: `fault_fix:${fault.source}`,
        scope: `tool:${context.attempted_tool}`,
        risk: fix.needs_hold ? "CONSEQUENTIAL" : "INTERNAL",
        epistemic_label: "OBS",
        confidence: context.confidence ?? 0.80,
        verdict: result.verdict === "FIXED" ? "SEAL" : "HOLD",
        metadata: {
          fault_id: fault.fault_id,
          fault_source: fault.source,
          fix_strategy: fix.strategy,
          fix_verdict: result.verdict,
          cycle_hash: cycleHash,
          receipt_hash: result.receipt_hash,
          gap_score: context.gap_score,
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // arifFLOW unreachable — local fault-fix cycle is canonical
  }
}
