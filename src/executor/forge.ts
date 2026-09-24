/**
 * A-FORGE Executor — Forge Execution Engine
 *
 * Takes a sealed receipt from the Python kernel and maps it to
 * forge_* tool execution. Returns an execution report to the kernel.
 *
 * A-FORGE never:
 *   - judges (Python constitutional judgment engine does that)
 *   - seals (VAULT999 does that; F13 remains sovereign)
 *   - bypasses 888
 *   - runs without a complete ExecutorReceipt (hard-fail)
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

import { createHash } from "node:crypto";
import {
  type ExecutorReceipt,
  type ActionResult,
  type ExecutionReport,
  type OutcomeClass,
  outcomeClassFromStatus,
} from "./types.js";
import { recordUnknownOutcome } from "./reconcile.js";
import { recordExperienceTrace } from "../interfaces/mcp/experienceTraceTools.js";


/**
 * Compute stable action_hash for reconcile() lookup.
 * Canonical: sha256 of `${tool}|${inputHash_or_params_hash}|${actorId}|${timestamp}`.
 * Spec §2.2 — reconcile-before-retry requires same action_hash.
 */
function computeActionHash(
  toolName: string,
  params: Record<string, unknown>,
  authority: ExecutorReceipt["authority"],
  timestamp: string,
): string {
  const paramsJson = stableStringify(params);
  const material = `${toolName}|${paramsJson}|${authority.actorId}|${timestamp}`;
  return createHash("sha256").update(material).digest("hex");
}

/** Stable stringify (sorted keys) so identical inputs hash identically. */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

/**
 * Spec §2.3 — aggregate outcome_class across results, with anti-self-seal:
 * if ANY result is UNKNOWN_OUTCOME, the aggregate stays UNKNOWN_OUTCOME.
 * Executor self-report CANNOT promote UNKNOWN_OUTCOME → SUCCESS/FAILURE
 * (that requires reconcile() with an external probe receipt — Q9 anti-self-seal).
 */
function aggregateOutcomeClass(results: ActionResult[]): OutcomeClass {
  let hasSuccess = false;
  let hasFailure = false;
  let hasRecovery = false;
  let hasDenied = false;
  for (const r of results) {
    if (r.outcome_class === "UNKNOWN_OUTCOME") return "UNKNOWN_OUTCOME"; // wins by spec
    if (r.outcome_class === "FAILURE") hasFailure = true;
    else if (r.outcome_class === "SUCCESS") hasSuccess = true;
    else if (r.outcome_class === "RECOVERY") hasRecovery = true;
    else if (r.outcome_class === "DENIED") hasDenied = true;
  }
  if (hasFailure) return "FAILURE";
  if (hasRecovery) return "RECOVERY";
  if (hasSuccess && hasDenied) return "RECOVERY"; // mixed success + denied → treat as recovery
  if (hasSuccess) return "SUCCESS";
  if (hasDenied) return "DENIED";
  return "DENIED"; // no results = nothing was allowed to execute
}

// ── Tool Registry ────────────────────────────

interface ToolDefinition {
  name: string;
  execute(params: Record<string, unknown>): Promise<unknown>;
  domain: string;
}

const toolRegistry = new Map<string, ToolDefinition>();

/**
 * Register a tool that A-FORGE can execute.
 * Tools are registered at startup by their domain organ.
 */
export function registerTool(tool: ToolDefinition): void {
  toolRegistry.set(tool.name, tool);
}

/**
 * Get registered tool by name.
 */
export function getTool(name: string): ToolDefinition | undefined {
  return toolRegistry.get(name);
}

/**
 * List all registered tools.
 */
export function listTools(): ToolDefinition[] {
  return Array.from(toolRegistry.values());
}

// ── Execution Core ───────────────────────────

/**
 * Execute a single forge command with bounds checking.
 */
async function executeCommand(
  toolName: string,
  params: Record<string, unknown>,
  bounds: ExecutorReceipt["bounds"],
  authority: ExecutorReceipt["authority"],
): Promise<ActionResult> {
  const startTime = Date.now();
  const actionId = `act-${crypto.randomUUID().slice(0, 8)}`;
  const actionTimestamp = new Date().toISOString();

  // Find tool
  const tool = toolRegistry.get(toolName);
  if (!tool) {
    const r: ActionResult = {
      actionId,
      status: "FAILURE",
      outcome_class: "FAILURE",
      tool: toolName,
      output: null,
      error: `Tool '${toolName}' not registered in A-FORGE`,
      timestamp: actionTimestamp,
      durationMs: Date.now() - startTime,
    };
    r.actionHash = computeActionHash(toolName, params, authority, actionTimestamp);
    return r;
  }

  // Check bounds: timeout
  const timeout = bounds.timeoutMs ?? 30000;
  if (timeout > 120000) {
    const r: ActionResult = {
      actionId,
      status: "FAILURE",
      outcome_class: "FAILURE",
      tool: toolName,
      output: null,
      error: `Timeout ${timeout}ms exceeds maximum 120000ms`,
      timestamp: actionTimestamp,
      durationMs: Date.now() - startTime,
    };
    r.actionHash = computeActionHash(toolName, params, authority, actionTimestamp);
    return r;
  }

  // Spec §2.4: Timeout / AbortError / external transport-drop → UNKNOWN_OUTCOME,
  // NOT FAILURE. The external side may have succeeded with the response lost.
  // Promise.race timeout error message must match this pattern.
  const TIMEOUT_ERROR_RE = /^(Timed out|AbortError|aborted|The operation was aborted)/i;

  try {
    const output = await Promise.race([
      tool.execute(params),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timed out after ${timeout}ms`)), timeout)
      ),
    ]);

    const r: ActionResult = {
      actionId,
      status: "SUCCESS",
      outcome_class: "SUCCESS",
      tool: toolName,
      output,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
    r.actionHash = computeActionHash(toolName, params, authority, r.timestamp);
    return r;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTransport = TIMEOUT_ERROR_RE.test(msg);
    const r: ActionResult = {
      actionId,
      status: isTransport ? "FAILURE" : "FAILURE", // legacy status unchanged
      outcome_class: isTransport ? "UNKNOWN_OUTCOME" : "FAILURE",
      tool: toolName,
      output: null,
      error: msg,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
    r.actionHash = computeActionHash(toolName, params, authority, r.timestamp);
    if (isTransport) {
      // Spec §2 — record for reconcile() before the function returns.
      recordUnknownOutcome(r);
    }
    return r;
  }
}

// ── Receipt Validation ───────────────────────

export interface ReceiptValidation {
  valid: boolean;
  violations: string[];
}

/**
 * Validate a kernel receipt before execution.
 * Hard-fails if any required field is missing or invalid.
 *
 * Hard-fail set (command-runner ban — sovereign 2026-07-09):
 *   receiptId, kernelSignature, verdict, authority_scope/actor/session,
 *   allowedActions, toolName, blastRadius, reversibility, inputHash,
 *   validUntil (lease expiry), ccId, judgment_reference, lineage
 */
export function validateReceipt(receipt: ExecutorReceipt): ReceiptValidation {
  const violations: string[] = [];

  // Identity + kernel binding
  if (!receipt.receiptId) violations.push("Missing receiptId");
  if (!receipt.kernelSignature) violations.push("Missing kernelSignature");
  if (!receipt.ccId) violations.push("Missing ccId (constitutional chain ID)");
  if (!receipt.judgment_reference) violations.push("Missing judgment_reference — cannot prove which judgment authorized this execution");
  if (!receipt.inputHash) violations.push("Missing inputHash");
  if (!receipt.lineage?.collapseTimestamp) {
    violations.push("Missing lineage.collapseTimestamp");
  }

  // Verdict
  if (!receipt.verdict) violations.push("Missing verdict");
  else if (!["SEAL", "SABAR", "HOLD", "VOID"].includes(receipt.verdict)) {
    violations.push(`Invalid verdict: ${receipt.verdict}`);
  }

  // Authority / lease
  if (!receipt.authority?.actorId) violations.push("Missing authority.actorId");
  if (!receipt.authority?.sessionId) violations.push("Missing authority.sessionId");
  if (!receipt.authority?.validUntil) violations.push("Missing authority.validUntil (lease)");
  else if (new Date(receipt.authority.validUntil) < new Date()) {
    violations.push("Authority lease expired");
  }
  if (!receipt.authority?.scope && !receipt.authority?.leaseId) {
    // scope OR leaseId required as authority band / lease anchor
    violations.push("Missing authority.scope or authority.leaseId");
  }

  // Tool + allowed actions
  if (!receipt.toolName) violations.push("Missing toolName");
  if (!receipt.allowedActions || receipt.allowedActions.length === 0) {
    violations.push("No allowedActions — nothing to execute");
  } else if (receipt.toolName && !receipt.allowedActions.includes(receipt.toolName)) {
    violations.push(`toolName '${receipt.toolName}' not in allowedActions`);
  }

  // Bounds
  if (!receipt.bounds?.blastRadius) violations.push("Missing bounds.blastRadius");
  if (receipt.bounds?.reversible === undefined) {
    violations.push("Missing bounds.reversible");
  }
  if (!receipt.bounds?.maxTools || receipt.bounds.maxTools < 1) {
    violations.push("bounds.maxTools must be >= 1");
  }
  // CRITICAL blast without reversibility is not auto-executable
  if (
    receipt.bounds?.blastRadius === "CRITICAL" &&
    receipt.bounds?.reversible === false
  ) {
    violations.push("CRITICAL irreversible action requires F13 sovereign path — not auto forgeExecute");
  }

  // Lineage
  if (!receipt.lineage?.evidenceIds || receipt.lineage.evidenceIds.length === 0) {
    violations.push("Missing lineage.evidenceIds");
  }

  return { valid: violations.length === 0, violations };
}

// ── Forge Execute ────────────────────────────

/**
 * Execute allowed actions from a kernel receipt.
 *
 * This is the main entry point for A-FORGE execution.
 * Called after Python kernel issues SEAL or SABAR verdict.
 *
 * Hard-fails on receipt validation: if validateReceipt returns any
 * violations, forgeExecute returns FAILURE before touching any tool.
 *
 * @param receipt — Sealed receipt from Python kernel (888)
 * @param params — Optional parameter overrides per action
 * @returns ExecutionReport to send back to kernel for audit
 */
export async function forgeExecute(
  receipt: ExecutorReceipt,
  params?: Record<string, Record<string, unknown>>,
): Promise<ExecutionReport> {
  const startTime = Date.now();

  // ── Hard-fail: validate receipt ───────────
  const validation = validateReceipt(receipt);
  if (!validation.valid) {
    return {
      receipt,
      results: [],
      summary: {
        totalActions: 0,
        succeeded: 0,
        failed: 0,
        totalDurationMs: 0,
        verdict: "REFUSED",
        outcome_class: "DENIED", // F13-ratified 2026-09-25
      },
      refusalReasons: validation.violations,
      timestamp: new Date().toISOString(),
    };
  }

  // Only SEAL or SABAR can execute (kernel already collapsed; F13 still supreme)
  if (receipt.verdict !== "SEAL" && receipt.verdict !== "SABAR") {
    return {
      receipt,
      results: [],
      summary: {
        totalActions: 0,
        succeeded: 0,
        failed: 0,
        totalDurationMs: 0,
        verdict: "REFUSED",
        outcome_class: "DENIED",
      },
      refusalReasons: [
        `Verdict ${receipt.verdict} is not executable — only SEAL|SABAR after 888`,
      ],
      timestamp: new Date().toISOString(),
    };
  }

  // Execute each allowed action
  const results: ActionResult[] = [];
  const actions = receipt.allowedActions.slice(
    0,
    receipt.bounds.maxTools,
  );

  for (const actionName of actions) {
    const actionParams = params?.[actionName] ?? {};
    const result = await executeCommand(
      actionName,
      actionParams,
      receipt.bounds,
      receipt.authority,
    );
    results.push(result);
  }

  const totalDuration = Date.now() - startTime;
  const succeeded = results.filter((r) => r.status === "SUCCESS").length;
  const failed = results.filter((r) => r.status === "FAILURE").length;

  const summaryVerdict =
    failed === 0 ? "SUCCESS" :
    succeeded === 0 ? "FAILURE" :
    "PARTIAL";

  // F13-ratified 2026-09-25 — aggregate outcome_class (anti-self-seal preserved
  // by aggregateOutcomeClass: any UNKNOWN_OUTCOME wins).
  const summaryOutcome = aggregateOutcomeClass(results);

  // ── P1: Auto-diff expected vs actual (F13-ratified 2026-09-08) ──
  // For each action that supplied expected_output (e.g., forge_shell's
  // expected_output param), compute diff against actual result. The
  // apprentice "rep" — auto-populate feedback_environmental with the
  // delta so the experience trace captures surprise, not just count.
  const diffs: string[] = [];
  for (const r of results) {
    const actionParams = params?.[r.tool] as Record<string, unknown> | undefined;
    const expected = actionParams?.expected_output;
    if (typeof expected === "string" && r.output !== undefined && r.output !== null) {
      const actualStr = typeof r.output === "string" ? r.output : JSON.stringify(r.output);
      const lenExpected = expected.length;
      const lenActual = actualStr.length;
      const lenRatio = lenExpected > 0 ? Number((lenActual / lenExpected).toFixed(2)) : 0;
      const exactMatch = expected === actualStr;
      const headEqual = expected.slice(0, 80) === actualStr.slice(0, 80);
      diffs.push(
        `${r.tool}:status=${r.status} expected_len=${lenExpected} actual_len=${lenActual} ratio=${lenRatio} exact=${exactMatch ? "yes" : "no"} head80=${headEqual ? "yes" : "no"}`,
      );
    } else if (typeof expected === "string") {
      diffs.push(`${r.tool}:status=${r.status} no_actual_output`);
    } else {
      diffs.push(`${r.tool}:status=${r.status} no_prediction`);
    }
  }

  // ── P0: Auto-fire experience trace (F13-ratified 2026-09-08) ──
  // Constitutional territory: each forgeExecute invocation leaves a
  // Chain-of-Experience trace so the experience loop auto-fires without
  // agent decision. Fire-and-forget (void); never block execution path
  // on trace failure (F1 AMANAH: trace is observational, not gating).
  void recordExperienceTrace({
    session_id: (receipt as unknown as { session_id?: string }).session_id ?? "unknown",
    agent_id: (receipt as unknown as { actor_id?: string }).actor_id ?? "aforge-auto",
    tool: "forge_execute",
    input_summary: `forgeExecute actions=[${actions.join(",")}] blastRadius=${receipt.bounds?.blastRadius ?? "?"} reversible=${receipt.bounds?.reversible ?? "?"}`,
    output_summary: `verdict=${summaryVerdict} succeeded=${succeeded} failed=${failed} duration_ms=${totalDuration}`,
    success: failed === 0,
    feedback_constitutional: receipt.verdict === "SEAL" || receipt.verdict === "SABAR" ? `PASS (kernel verdict ${receipt.verdict})` : "UNKNOWN",
    feedback_environmental: `actions=${actions.length}/${receipt.bounds?.maxTools ?? "?"} | diffs=[${diffs.join("; ")}]`,
  }).catch((err: unknown) => {
    // Fail-soft: log but never break forgeExecute.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[forgeExecute] auto-fire trace failed:", msg);
  });

  return {
    receipt,
    results,
    summary: {
      totalActions: actions.length,
      succeeded,
      failed,
      totalDurationMs: totalDuration,
      verdict: summaryVerdict,
      outcome_class: summaryOutcome,
    },
    timestamp: new Date().toISOString(),
  };
}
