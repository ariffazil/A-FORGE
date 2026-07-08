/**
 * A-FORGE MCP Elicitation — Human-in-the-loop confirmation for trades/sends
 *
 * Item 2 fix: Wires MCP elicitation/create (2025-11-25 spec) into A-FORGE
 * tool handlers that involve irreversible or sensitive operations.
 *
 * Protocol: elicitation/create with -32042 (UrlElicitationRequired) fallback
 * Framework: MCP SDK v1.29.0 Server.elicitInput()
 *
 * Two modes:
 *   FORM  — structured confirmation with typed fields (trades, transfers)
 *   URL   — out-of-band redirect for sensitive credentials (API keys, tokens)
 *
 * Constitutional alignment:
 *   F1  AMANAH  — elicitation IS the sovereign ack for irreversible actions
 *   F13 SOVEREIGN — human veto is exercised through accept/decline/cancel
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

// ── Types ─────────────────────────────────────────────────────────────────

import type { ElicitResult } from "@modelcontextprotocol/sdk/types.js";

// Re-export the SDK's types for backward compat
export type { ElicitResult };

/**
 * Type alias for the SDK's ElicitRequestFormParams — used by elicitUser wrapper.
 */
export type ElicitFormRequest = import("@modelcontextprotocol/sdk/types.js").ElicitRequestFormParams;

/**
 * Type alias for the SDK's ElicitRequestURLParams — used by elicitUser wrapper.
 */
export type ElicitURLRequest = import("@modelcontextprotocol/sdk/types.js").ElicitRequestURLParams;

/**
 * Union type matching SDK's ElicitRequestParams.
 */
export type ElicitRequest = ElicitFormRequest | ElicitURLRequest;

// ── Elicitation Wrapper ───────────────────────────────────────────────────

/**
 * Send an elicitation/create request to the MCP client.
 * Returns the user's response (accept/decline/cancel).
 *
 * If the client doesn't support elicitation, throws McpError(-32042)
 * which the MCP SDK propagates as UrlElicitationRequired.
 *
 * @param serverInstance - The underlying MCP Server instance (server.server)
 * @param request - Elicitation parameters (form or URL mode)
 * @returns ElicitResult with action + content
 */
export async function elicitUser(
  serverInstance: Server,
  request: ElicitRequest,
): Promise<ElicitResult> {
  try {
    const result = await serverInstance.elicitInput(request) as ElicitResult;
    return result;
  } catch (err: unknown) {
    // If the client doesn't support elicitation, the SDK throws.
    // Convert to a structured HOLD response rather than crashing.
    if (err instanceof Error && err.message.includes("does not support")) {
      return {
        action: "cancel",
        content: {
          _elicitation_unavailable: true,
          reason: err.message,
          fallback: "Client does not support MCP elicitation. Manual confirmation required.",
        },
      };
    }
    throw err;
  }
}

// ── Pre-built Elicitation Schemas ─────────────────────────────────────────

/**
 * Trade/Transfer confirmation schema — form mode.
 * Used by forge_execute, forge_judge_proxy when action involves
 * capital movement, data transmission, or irreversible mutation.
 */
export function tradeConfirmationSchema(description: string): ElicitFormRequest {
  return {
    mode: "form",
    message: `⚠️ CONFIRM IRREVERSIBLE ACTION\n\n${description}\n\nThis action requires explicit human authorization before execution.`,
    requestedSchema: {
      type: "object",
      properties: {
        authorized: {
          type: "boolean",
          title: "I authorize this action",
          description: "Must be true to proceed",
        },
        confirmation_text: {
          type: "string",
          title: "Type CONFIRM to proceed",
          description: "Type the word CONFIRM to double-verify intent",
        },
        notes: {
          type: "string",
          title: "Approval notes (optional)",
        },
      },
      required: ["authorized", "confirmation_text"],
    },
  };
}

/**
 * Send/Publish confirmation schema — form mode.
 * Used when data is being transmitted to external systems.
 */
export function sendConfirmationSchema(
  destination: string,
  payload_summary: string,
): ElicitFormRequest {
  return {
    mode: "form",
    message: `📡 CONFIRM DATA TRANSMISSION\n\nDestination: ${destination}\nPayload: ${payload_summary}\n\nOutbound data transmission requires explicit authorization.`,
    requestedSchema: {
      type: "object",
      properties: {
        authorized: {
          type: "boolean",
          title: "I authorize this transmission",
        },
        notes: {
          type: "string",
          title: "Transmission notes (optional)",
        },
      },
      required: ["authorized"],
    },
  };
}

/**
 * URL-mode elicitation for sensitive operations.
 * Redirects user to out-of-band page for credential entry.
 * Returns the -32042 error if client doesn't support URL elicitation.
 */
export function sensitiveOperationURL(
  elicitationId: string,
  operationDescription: string,
  callbackUrl: string,
): ElicitURLRequest {
  return {
    mode: "url",
    message: `🔐 SENSITIVE OPERATION\n\n${operationDescription}\n\nYou will be redirected to complete authorization out-of-band.`,
    elicitationId,
    url: callbackUrl,
  };
}

// ── Validation Helpers ────────────────────────────────────────────────────

/**
 * Validate that an elicitation result represents genuine authorization.
 * Checks both the action flag and the confirmation text.
 */
export function isGenuineAuthorization(result: ElicitResult): {
  authorized: boolean;
  reason: string;
} {
  if (result.action !== "accept") {
    return {
      authorized: false,
      reason: result.action === "decline"
        ? "User explicitly declined the action."
        : "User cancelled or dismissed the confirmation.",
    };
  }

  const content = result.content ?? {};

  // Check boolean authorization
  if (content.authorized !== true) {
    return {
      authorized: false,
      reason: "Authorization field was not set to true.",
    };
  }

  // Check confirmation text if present (defense-in-depth)
  const confirmText = content.confirmation_text;
  if (confirmText !== undefined && confirmText !== "CONFIRM") {
    return {
      authorized: false,
      reason: `Confirmation text '${confirmText}' does not match 'CONFIRM'.`,
    };
  }

  return { authorized: true, reason: "Human authorized via elicitation." };
}
