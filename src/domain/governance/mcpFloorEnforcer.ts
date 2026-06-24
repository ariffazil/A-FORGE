/**
 * mcpFloorEnforcer — per-tool FloorEnforcer wrapper for mcp/core.ts.
 *
 * Wraps every MCP tool call in FloorEnforcer.checkAll() so that
 * the F1–F13 enforcement layer is constitutionally unavoidable.
 *
 * Pattern:
 *   server.tool("foo", "...", schema, async (args) => {
 *     const verdict = await enforceMcpFloor("foo", args);
 *     if (!verdict.allowed) return floorErrorResponse(verdict);
 *     return await originalHandler(args);
 *   });
 *
 * Plan: PLAN-2026-06-06-C1-F13EnforcementLayer (Phase 1)
 * @constitutional C1 — unified F1-F13 enforcement
 */

import { randomUUID } from "node:crypto";
import { checkAll, type Verdict } from "./FloorEnforcer.js";
import type { ActionRequest, FloorContext, ActionCategory, EpistemicTier } from "../types/action-request.js";

// ─── Action category classifier (tool_name → category) ────────────────

/**
 * Classify a tool call into an ActionCategory based on tool name + args.
 * Conservative: defaults to OTHER if unsure (FloorEnforcer will HOLD if needed).
 */
export function classifyAction(toolName: string, args: Record<string, unknown>): ActionCategory {
  const n = toolName.toLowerCase();
  const a = JSON.stringify(args || {}).toLowerCase();

  // VAULT operations
  if (n.includes("vault_seal") || n.includes("seal")) return "VAULT_SEAL";
  if (n.includes("vault_read") || (n.includes("vault") && a.includes("read"))) return "VAULT_READ";

  // Memory operations
  if (n.includes("memory_recall") || n.includes("memory_read")) return "MEMORY_READ";
  if (n.includes("memory_store") || n.includes("memory_write") || n.includes("remember")) return "MEMORY_WRITE";

  // Network operations
  if (n.includes("web_search") || n.includes("sense_observe") || n.includes("fetch")) return "NETWORK_OUT";
  if (n.includes("understand_image") && a.includes("http")) return "NETWORK_OUT";

  // Form / email
  if (n.includes("form_submit")) return "FORM_SUBMIT";
  if (n.includes("email_send")) return "EMAIL_SEND";

  // Database
  if (n.includes("db_write") || n.includes("database_write")) return "DATABASE_WRITE";

  // Financial / production
  if (n.includes("financial") || n.includes("emv") || n.includes("roi")) return "FINANCIAL_TRANSACTION";
  if (n.includes("production") || n.includes("deploy")) return "PRODUCTION_DEPLOY";

  // Executive / compute
  if (n.includes("forge_execute") || n.includes("execute")) return "EXECUTE";
  if (n.includes("kernel_route")) return "EXECUTE";
  if (n.includes("thermodynamic")) return "EXECUTE";

  // Reasoning / analysis — these are OBSERVE-class, not EXECUTE
  if (n.includes("judge_deliberate") || n.includes("mind_reason")) return "READ";
  if (n.includes("heart_critique")) return "READ";
  if (n.includes("sense_observe")) return "READ";

  // Constitution / floor
  if (n.includes("floor") && (a.includes("change") || a.includes("mutate"))) return "CONSTITUTIONAL_FLOOR_CHANGE";

  // Read-only
  if (n.includes("health_check") || n.includes("measure") || n.includes("ops_measure")) return "READ";
  if (n.includes("reply_compose")) return "WRITE";
  if (n.includes("session_init")) return "WRITE";
  if (n.includes("memory")) return "MEMORY_READ";

  return "OTHER";
}

/**
 * Extract target from args (varies by tool).
 */
export function extractTarget(toolName: string, args: Record<string, unknown>): string {
  const a = args as Record<string, unknown>;
  if (typeof a.url === "string") return a.url;
  if (typeof a.path === "string") return a.path;
  if (typeof a.file_path === "string") return a.file_path;
  if (typeof a.target === "string") return a.target;
  if (typeof a.query === "string") return `query:${a.query.slice(0, 100)}`;
  if (typeof a.image_source === "string") return a.image_source;
  if (typeof a.actor_id === "string") return `actor:${a.actor_id}`;
  if (typeof a.content === "string") return `content(${a.content.length} chars)`;
  if (typeof a.grounded_facts === "object" && Array.isArray(a.grounded_facts)) {
    return `facts(${a.grounded_facts.length} items)`;
  }
  return `tool:${toolName}`;
}

/**
 * Build ActionRequest from tool call context.
 */
export function buildActionRequest(
  toolName: string,
  args: Record<string, unknown>,
  callerActor: string,
  callerSession: string,
  tierOverride?: number,
): ActionRequest {
  const a = args as Record<string, unknown>;
  const actor = (typeof a.actor_id === "string" && a.actor_id) || callerActor;
  const session = (typeof a.session_id === "string" && a.session_id) || callerSession;
  const tier = (tierOverride ?? (typeof a.tier === "number" ? a.tier : 3)) as EpistemicTier;

  return {
    action_id: randomUUID(),
    tool_name: toolName,
    action_type: classifyAction(toolName, args),
    target: extractTarget(toolName, args),
    tier,
    actor,
    session_id: session,
    intent: typeof a.intent === "string" && a.intent.length >= 5
      ? a.intent
      : `Invoke ${toolName} via MCP`,
    expected_outcome: typeof a.expected_outcome === "string" && a.expected_outcome.length >= 5
      ? a.expected_outcome
      : "Tool execution completes normally",
    args,
    reversibility_score: 0.8,  // default; specific tools may override
    blast_radius: "service",     // default; specific tools may override
    rollback_plan: typeof a.rollback_plan === "string" ? a.rollback_plan : undefined,
    evidence_count: typeof a.evidence_count === "number" ? a.evidence_count : 1,
    sensitivity: typeof a.sensitivity === "string"
      ? a.sensitivity as any
      : (a.mission && typeof (a.mission as any).outcome?.sensitivity === "string"
          ? ((a.mission as any).outcome.sensitivity as any)
          : undefined),
    metadata: {
      source: "mcp",
      task_context: a.task_context,
      page_context: a.page_context,
    },
  };
}

// ─── Main wrapper helper ──────────────────────────────────────────────

/**
 * Run FloorEnforcer on a tool call. Returns the verdict.
 * If verdict.void or verdict.hold_required, the caller MUST NOT proceed
 * with the tool handler.
 */
export function enforceMcpFloor(
  toolName: string,
  args: Record<string, unknown>,
  callerActor: string = "mcp-anonymous",
  callerSession: string = "mcp-session",
): Verdict {
  const action = buildActionRequest(toolName, args, callerActor, callerSession);
  const ctx: FloorContext = {
    action,
    actor_id: action.actor,
    session_id: action.session_id,
    f13_halt_active: false,
  };
  return checkAll(ctx);
}

/**
 * Convert a Verdict into an MCP error response.
 */
export function floorErrorResponse(verdict: Verdict): {
  content: Array<{ type: "text"; text: string }>;
  isError: boolean;
} {
  const summary = {
    verdict: verdict.final,
    allowed: verdict.allowed,
    hold_required: verdict.hold_required,
    void: verdict.void,
    caution: verdict.caution,
    action_id: verdict.action_id,
    tool_name: verdict.tool_name,
    reason_count: verdict.reasons.length,
    top_reasons: verdict.reasons.slice(0, 5).map((r) => ({
      floor: r.floor,
      code: r.code,
      severity: r.severity,
      message: r.message,
    })),
    checked_at: verdict.checked_at,
  };
  return {
    content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    isError: true,
  };
}

/**
 * Convenience: run enforceMcpFloor, return either error or null.
 * If null, the tool may proceed.
 */
export function gateTool(
  toolName: string,
  args: Record<string, unknown>,
): { allowed: true } | { allowed: false; response: ReturnType<typeof floorErrorResponse> } {
  const verdict = enforceMcpFloor(toolName, args);
  if (verdict.allowed) return { allowed: true };
  return { allowed: false, response: floorErrorResponse(verdict) };
}
