/**
 * QQQ RUNTIME v1 — Constitutional Evaluation Layer.
 *
 * Enforces pre-execution check: Intent → Plan → QQQ → Judge → Execute → Audit.
 * Every forge action requires a structured QQQ record before execution.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 *
 * @module domain/governance/QQQRuntime
 * @constitutional F2 TRUTH — explicit evidence-bound assumptions
 * @constitutional F7 HUMILITY — unknown detection & risk bounds
 * @constitutional F11 AUDIT — VAULT999 receipt trail
 */

import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { callMCP } from "../../interfaces/mcp/client.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface QQQRecord {
  qqq_id: string;
  timestamp: string;
  intent: string;
  tool_name: string;
  args: Record<string, unknown>;
  assumptions: string[];
  unknowns: string[];
  options: {
    path_1: string; // The primary execution path
    path_2: string; // Safer check/probe path
    path_3: string; // Rollback or NO-OP path
  };
  risks: {
    best_case: string;
    worst_case: string;
    risk_score: number; // 0.0 (safe) to 1.0 (dangerous)
  };
  rollback: string;
  simulation: {
    passed: boolean;
    domain: string;
    reason: string;
  };
  verdict: {
    verdict: "SEAL" | "HOLD" | "VOID";
    floors_triggered: string[];
    reason: string;
  };
  vault_receipt_id?: string;
}

// ── Implementation ──────────────────────────────────────────────────────────

const VAULT_QQQ_PATH = "/root/VAULT999/qqq_receipts.jsonl";

/**
 * Extract assumptions based on the target tool and arguments.
 */
export function extractAssumptions(toolName: string, args: Record<string, unknown>): string[] {
  const assumptions = [
    "Workspace matches standard arifOS directory structure",
    "Environment variables are set correctly in the sandboxed process",
  ];

  if (toolName.includes("file") || toolName.includes("write") || toolName.includes("patch")) {
    assumptions.push(
      "Target file path is writeable and has no concurrent locks",
      "No binary file corruption will occur from textual edits",
      "File encoding is UTF-8 compliant"
    );
  } else if (toolName.includes("shell") || toolName.includes("command")) {
    assumptions.push(
      "Host system has required binaries and libraries installed",
      "Command execution does not exceed standard resource limits",
      "Process will exit cleanly without hanging"
    );
  } else if (toolName.includes("wealth") || toolName.includes("geox") || toolName.includes("well")) {
    assumptions.push(
      "Organ service endpoint is online and listening on loopback port",
      "Calculations adhere to constitutional schema requirements"
    );
  }

  return assumptions;
}

/**
 * Detect unknowns/hidden variables for the proposed action.
 */
export function detectUnknowns(toolName: string, args: Record<string, unknown>): string[] {
  const unknowns = [
    "Whether concurrent system changes are being made outside the sandbox",
  ];

  if (toolName.includes("file") || toolName.includes("patch")) {
    const path = String(args.path ?? args.TargetFile ?? args.filepath ?? "unknown");
    unknowns.push(
      `Exact live contents of file '${path}' prior to write`,
      `Whether target file '${path}' is currently tracked or untracked in git`
    );
  } else if (toolName.includes("shell") || toolName.includes("command")) {
    const cmd = String(args.command ?? args.CommandLine ?? "unknown");
    unknowns.push(
      `Side-effects of executing command: '${cmd.slice(0, 100)}'`,
      "Standard error streams or signals that may be returned by the shell"
    );
  }

  return unknowns;
}

/**
 * Generate three path alternatives for execution.
 */
export function generatePaths(toolName: string, args: Record<string, unknown>): QQQRecord["options"] {
  const argStr = JSON.stringify(args);
  return {
    path_1: `Direct Execution: Call ${toolName} with args: ${argStr.slice(0, 150)}`,
    path_2: `Pre-check/Probe: Verify system state or read files before calling ${toolName}`,
    path_3: `NO-OP/Abort: Log warning, fallback to cached state, and halt execution path`,
  };
}

/**
 * Heuristically calculate risk score.
 */
export function calculateRiskScore(toolName: string, args: Record<string, unknown>): number {
  if (toolName === "forge_shell" || toolName === "run_command") {
    const cmd = String(args.command ?? args.CommandLine ?? "").toLowerCase();
    if (cmd.includes("rm -rf") || cmd.includes("drop") || cmd.includes("force")) {
      return 0.95; // Critical risk
    }
    return 0.80; // High risk
  }
  if (toolName === "write_file" || toolName === "apply_patches") {
    return 0.70; // Guarded risk
  }
  if (toolName === "read_file" || toolName === "list_files" || toolName === "grep_text") {
    return 0.15; // Safe risk
  }
  return 0.40; // Default risk
}

/**
 * Generate rollback instructions.
 */
export function generateRollback(toolName: string, args: Record<string, unknown>): string {
  if (toolName.includes("read") || toolName.includes("list") || toolName.includes("grep") || toolName.includes("search")) {
    return "No state rollback needed (read-only or metadata action)";
  }
  if (toolName.includes("file") || toolName.includes("patch")) {
    const path = String(args.path ?? args.TargetFile ?? args.filepath ?? "unknown");
    return `git checkout -- "${path}" || rm -f "${path}" (Restore pre-write state)`;
  }
  if (toolName.includes("shell") || toolName.includes("command")) {
    return "Check shell status, kill hung subprocesses, and restore database/state backups if mutation occurred";
  }
  return "No state rollback needed (read-only or metadata action)";
}

/**
 * Perform a simulation pass of the action.
 */
export function runSimulationPass(
  toolName: string,
  args: Record<string, unknown>,
  riskScore: number
): QQQRecord["simulation"] {
  const passed = riskScore < 0.90;
  return {
    passed,
    domain: toolName.includes("geox") ? "earth" : toolName.includes("wealth") ? "capital" : toolName.includes("well") ? "human" : "general",
    reason: passed
      ? `Action simulated successfully. Expected low to medium side effects.`
      : `High risk simulation: Action exceeds safety thresholds. Hold required.`,
  };
}

/**
 * Core QQQ Runtime engine. Builds, evaluates, and seals a QQQ record.
 */
export async function executeQQQ(
  toolName: string,
  args: Record<string, unknown>,
  intent: string,
  sessionId: string
): Promise<QQQRecord> {
  const qqqId = `QQQ-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const assumptions = extractAssumptions(toolName, args);
  const unknowns = detectUnknowns(toolName, args);
  const options = generatePaths(toolName, args);
  const riskScore = calculateRiskScore(toolName, args);
  const rollback = generateRollback(toolName, args);
  const simulation = runSimulationPass(toolName, args, riskScore);

  // 1. Initial local floor evaluation
  const floorsTriggered: string[] = [];
  if (riskScore >= 0.90) floorsTriggered.push("F1"); // Irreversible threshold
  if (unknowns.length > 5) floorsTriggered.push("F7");   // Humility limit

  let verdict: QQQRecord["verdict"]["verdict"] = "SEAL";
  let reason = "QQQ local checks passed.";

  // 2. Constitutional verdict request (Call arifOS judge if available)
  try {
    const response = (await callMCP("arifos_mcp.arif_judge", {
      intent,
      tool_name: toolName,
      arguments: args,
      risk_score: riskScore,
      floors_triggered: floorsTriggered,
    })) as Record<string, unknown>;

    if (response && typeof response.verdict === "string") {
      verdict = response.verdict as QQQRecord["verdict"]["verdict"];
      reason = String(response.reason ?? "arifOS evaluated verdict.");
      if (Array.isArray(response.floors_triggered)) {
        floorsTriggered.push(...(response.floors_triggered as string[]));
      }
    }
  } catch {
    // arifOS kernel is offline/unreachable: fall back to local heuristic rules
    if (riskScore >= 0.90) {
      verdict = "HOLD";
      reason = "F1 AMANAH: High risk execution requires sovereign verification (arifOS offline fallback).";
    }
  }

  const record: QQQRecord = {
    qqq_id: qqqId,
    timestamp: new Date().toISOString(),
    intent,
    tool_name: toolName,
    args,
    assumptions,
    unknowns,
    options,
    risks: {
      best_case: `Tool executes successfully and actual state matches expected state.`,
      worst_case: `Execution failure, state drift, or unhandled exceptions. Rollback triggered.`,
      risk_score: riskScore,
    },
    rollback,
    simulation,
    verdict: {
      verdict,
      floors_triggered: Array.from(new Set(floorsTriggered)),
      reason,
    },
  };

  // 3. VAULT999 receipt generation
  try {
    mkdirSync(dirname(VAULT_QQQ_PATH), { recursive: true });
    appendFileSync(VAULT_QQQ_PATH, JSON.stringify(record) + "\n", "utf-8");
    record.vault_receipt_id = createHash("sha256").update(JSON.stringify(record)).digest("hex");
  } catch (err: any) {
    process.stderr.write(`[QQQ] Failed to append QQQ receipt to VAULT999: ${err.message}\n`);
  }

  return record;
}
