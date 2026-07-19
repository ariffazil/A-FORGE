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

import {
  type ExecutorReceipt,
  type ActionResult,
  type ExecutionReport,
} from "./types.js";

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

  // Find tool
  const tool = toolRegistry.get(toolName);
  if (!tool) {
    return {
      actionId,
      status: "FAILURE",
      tool: toolName,
      output: null,
      error: `Tool '${toolName}' not registered in A-FORGE`,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }

  // Check bounds: timeout
  const timeout = bounds.timeoutMs ?? 30000;
  if (timeout > 120000) {
    return {
      actionId,
      status: "FAILURE",
      tool: toolName,
      output: null,
      error: `Timeout ${timeout}ms exceeds maximum 120000ms`,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }

  try {
    const output = await Promise.race([
      tool.execute(params),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timed out after ${timeout}ms`)), timeout)
      ),
    ]);

    return {
      actionId,
      status: "SUCCESS",
      tool: toolName,
      output,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      actionId,
      status: "FAILURE",
      tool: toolName,
      output: null,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
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

  return {
    receipt,
    results,
    summary: {
      totalActions: actions.length,
      succeeded,
      failed,
      totalDurationMs: totalDuration,
      verdict:
        failed === 0 ? "SUCCESS" :
        succeeded === 0 ? "FAILURE" :
        "PARTIAL",
    },
    timestamp: new Date().toISOString(),
  };
}
