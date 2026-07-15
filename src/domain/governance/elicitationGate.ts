/**
 * ELICITATION GATE — External client approval for governed actions.
 *
 * Bridges the gap between:
 * - Internal federation: arif_judge → 888_HOLD → Telegram ack → proceed
 * - External MCP clients: elicitation/create → client form → user confirms → proceed
 *
 * When an external client (Claude Desktop, Cursor, Zed) calls a governed tool
 * (forge_filesystem write, forge_shell, forge_execute), this gate:
 * 1. Detects if the client supports MCP elicitation
 * 2. If yes: sends elicitation/create request → blocks until user responds
 * 3. If no: returns structured HOLD response with confirmation requirements
 *
 * @module governance/elicitationGate
 * @constitutional F1 AMANAH — reversible actions only proceed with intent
 * @constitutional F13 SOVEREIGN — human authority for irreversible actions
 */

import { createHash } from "node:crypto";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ElicitationRequest {
  /** Human-readable message explaining what needs approval */
  message: string;
  /** JSON Schema for the confirmation form */
  schema: {
    type: "object";
    properties: Record<string, { type: string; title?: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
  /** Action class for audit trail */
  action_class: "OBSERVE" | "EXECUTE_REVERSIBLE" | "EXECUTE_IRREVERSIBLE" | "EXTERNAL_SIDE_EFFECT";
  /** Tool name for logging */
  tool_name: string;
  /** Target path/resource for logging */
  target: string;
  /** Transport type — determines gate behavior */
  transport: "stdio" | "http";
  /** Session ID if available */
  session_id?: string;
  /** Actor ID if available */
  actor_id?: string;
}

export interface ElicitationResult {
  /** Whether the action is approved */
  approved: boolean;
  /** Source of approval */
  source: "elicitation" | "structured_hold" | "auto_approve" | "auto_deny";
  /** User's response if elicitation was used */
  user_response?: Record<string, unknown>;
  /** Reason for denial if not approved */
  denial_reason?: string;
  /** Receipt ID for audit trail */
  receipt_id: string;
  /** Timestamp */
  timestamp: string;
}

export interface GateConfig {
  /** Auto-approve OBSERVE actions on external clients */
  auto_approve_observe: boolean;
  /** Auto-deny IRREVERSIBLE actions on external clients */
  auto_deny_irreversible: boolean;
  /** Enable elicitation for external clients */
  enable_elicitation: boolean;
  /** Timeout for elicitation response (ms) */
  elicitation_timeout_ms: number;
}

const DEFAULT_CONFIG: GateConfig = {
  auto_approve_observe: true,
  auto_deny_irreversible: true,
  enable_elicitation: true,
  elicitation_timeout_ms: 120_000, // 2 minutes
};

// ── Elicitation Gate ────────────────────────────────────────────────────────

/**
 * Evaluate whether an action needs external client approval.
 *
 * Decision matrix:
 * | Transport | Action Class           | Behavior                          |
 * |-----------|------------------------|-----------------------------------|
 * | stdio     | any                    | Pass through (arifOS handles)     |
 * | http      | OBSERVE                | Auto-approve                      |
 * | http      | EXECUTE_REVERSIBLE     | Elicitation or structured HOLD    |
 * | http      | EXECUTE_IRREVERSIBLE   | Auto-deny (no sovereign ack)      |
 * | http      | EXTERNAL_SIDE_EFFECT   | Elicitation or structured HOLD    |
 */
export function evaluateElicitationGate(
  request: ElicitationRequest,
  config: Partial<GateConfig> = {},
): ElicitationResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const receiptId = `elc_${Date.now()}_${createHash("sha256").update(`${request.tool_name}:${request.target}:${Date.now()}`).digest("hex").slice(0, 8)}`;
  const timestamp = new Date().toISOString();

  // ── Internal federation (stdio) → pass through ────────────────────────
  if (request.transport === "stdio") {
    return {
      approved: true,
      source: "auto_approve",
      receipt_id: receiptId,
      timestamp,
    };
  }

  // ── External client (http) → gate logic ───────────────────────────────

  // OBSERVE-class: auto-approve (reads are safe)
  if (request.action_class === "OBSERVE" && cfg.auto_approve_observe) {
    return {
      approved: true,
      source: "auto_approve",
      receipt_id: receiptId,
      timestamp,
    };
  }

  // IRREVERSIBLE: auto-deny (external clients cannot perform irreversible ops)
  if (request.action_class === "EXECUTE_IRREVERSIBLE" && cfg.auto_deny_irreversible) {
    return {
      approved: false,
      source: "auto_deny",
      denial_reason: "Irreversible actions require sovereign ack (F13). Use internal federation path via arifOS.",
      receipt_id: receiptId,
      timestamp,
    };
  }

  // EXECUTE_REVERSIBLE / EXTERNAL_SIDE_EFFECT: needs elicitation
  if (cfg.enable_elicitation) {
    // Return a structured elicitation request — the MCP server handler
    // will send this as an elicitation/create to the client
    return {
      approved: false, // Not yet approved — pending elicitation
      source: "elicitation",
      denial_reason: "PENDING_ELICITATION",
      receipt_id: receiptId,
      timestamp,
    };
  }

  // Fallback: structured HOLD response
  return {
    approved: false,
    source: "structured_hold",
    denial_reason: `Action requires approval. Tool: ${request.tool_name}, Target: ${request.target}, Class: ${request.action_class}. Re-submit with confirmation parameter.`,
    receipt_id: receiptId,
    timestamp,
  };
}

/**
 * Build the elicitation schema for a given action type.
 * This is what gets sent to the MCP client as the elicitation/create form.
 */
export function buildElicitationSchema(request: ElicitationRequest): {
  message: string;
  schema: ElicitationRequest["schema"];
} {
  const baseSchema: ElicitationRequest["schema"] = {
    type: "object",
    properties: {
      confirm: {
        type: "boolean",
        title: "Confirm action",
        description: `Authorize ${request.action_class} on ${request.target}`,
      },
      reason: {
        type: "string",
        title: "Reason (optional)",
        description: "Why this action is being taken",
      },
    },
    required: ["confirm"],
  };

  const messages: Record<string, string> = {
    EXECUTE_REVERSIBLE: `⚠️ Governed Write\n\nTool: ${request.tool_name}\nTarget: ${request.target}\nClass: Reversible\n\nThis action will modify files and can be rolled back. Confirm?`,
    EXTERNAL_SIDE_EFFECT: `⚠️ Side Effect\n\nTool: ${request.tool_name}\nTarget: ${request.target}\nClass: External side effect\n\nThis action has effects outside the sandbox. Confirm?`,
  };

  return {
    message: messages[request.action_class] || `Confirm: ${request.tool_name} → ${request.target}`,
    schema: baseSchema,
  };
}

/**
 * Build a structured HOLD response for clients that don't support elicitation.
 * Returns a tool result that tells the LLM to ask the user for confirmation.
 */
export function buildStructuredHoldResponse(request: ElicitationRequest, result: ElicitationResult): {
  content: Array<{ type: string; text: string }>;
  isError: boolean;
} {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        status: "HOLD",
        gate: "elicitation",
        action_class: request.action_class,
        tool: request.tool_name,
        target: request.target,
        message: `This action requires human approval. Ask the user: "Should I proceed with ${request.action_class} on ${request.target}?" If they confirm, re-submit the tool call with confirm=true.`,
        receipt_id: result.receipt_id,
        instruction: "DO NOT proceed without explicit user confirmation. This is a governance gate.",
      }, null, 2),
    }],
    isError: false,
  };
}

/**
 * Generate EUREKA-3 elicitation — the 6 eureka capabilities from FastMCP/MCP-Fetch.
 * Maps elicitation to A-FORGE's888_HOLD externalization.
 */
export const ELICITATION_MAPPING = {
  // What arifOS does internally
  internal: "arif_judge → 888_HOLD → Telegram ack → proceed",
  // What FastMCP elicitation does externally
  external: "ctx.request_user_input() → MCP client form → user confirms → proceed",
  // What A-FORGE should do
  aforge: "elicitationGate → detect transport → route to appropriate approval path",
} as const;
