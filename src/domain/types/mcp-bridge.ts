/**
 * MCP Bridge Types — Federation Memory Bridge
 *
 * Defines the protocol translation layer between A-FORGE TypeScript runtime
 * and arifOS / WEALTH / GEOX Python MCP kernels.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

export type MCPNamespace = "arifos" | "wealth" | "geox";

export interface MCPBridgeConfig {
  arifos: string;
  wealth: string;
  geox: string;
}

export interface MCPBridgeResponse {
  ok: boolean;
  result?: unknown;
  error?: {
    type: string;
    message: string;
    floor?: string;
    verdict?: string;
  };
}

/**
 * Tool name mapping: A-FORGE internal → canonical arifOS tool name.
 *
 * The live arifOS MCP surface was measured 2026-10-01 (tools/list on :8088) as
 * exactly eight canonical verbs:
 *   arif_init, arif_observe, arif_think, arif_route,
 *   arif_memory, arif_judge, arif_forge, arif_seal
 *
 * Only add an entry when BOTH the target is on that live surface AND the
 * argument shape is known to match (transformArgs below owns shape). A mapping
 * to a dead name is worse than no mapping: it looks repaired and still fails.
 */
export const TOOL_NAME_MAP: Record<string, string> = {
  apex_judge: "arif_judge",
  // Was "arif_claim_gate" — itself NOT on the live surface, so the one place
  // someone tried to fix drift pointed at the previous ABI generation.
  // Claim-class adjudication is a judge function.
  truth_gate: "arif_judge",
  arif_claim_gate: "arif_judge",
  // 666 HEART pipeline lives inside the canonical judge stage. Verified
  // shape-compatible: heartHandler (core.ts) consumes only `.verdict`, and
  // transformArgs below builds the {mode,candidate} envelope arif_judge takes.
  arif_heart_critique: "arif_judge",

  // ── Measured dead, deliberately UNMAPPED ────────────────────────────────
  // These verbs are called by A-FORGE but have no verified canonical
  // equivalent on the live arifOS surface. They are left unmapped so the
  // bridge raises ABI_DRIFT (correctly attributed) rather than silently
  // calling a guessed verb with an unverified argument shape:
  //   arif_lease_issue, arif_lease_inspect, arif_lease_revoke  (no lease verb
  //     is exposed over MCP; leases are minted by another path)
  //   arif_verify, arif_ops_measure, arif_session_init, arif_vault_seal
  // Call sites: infrastructure/tools/infra/safety.ts:67, interfaces/mcp/client.ts:266,
  //   interfaces/server.ts:597,813, interfaces/mcp/core.ts:1655.
};

/** Namespace routing map: which env var / default URL per namespace */
export const NAMESPACE_DEFAULTS: Record<MCPNamespace, { env: string; default: string }> = {
  arifos: { env: "ARIFOS_MCP_URL", default: "http://localhost:8088" },
  wealth: { env: "WEALTH_MCP_URL", default: "http://localhost:18082" },
  geox: { env: "GEOX_MCP_URL", default: "http://localhost:8081" },
};

/**
 * Special-case argument transformers for tools where A-FORGE's calling
 * convention differs from the kernel's expected parameters.
 */
export function transformArgs(tool: string, args: Record<string, unknown>): Record<string, unknown> {
  if (tool === "apex_judge" || tool === "arif_judge") {
    const { concern, findings, riskLevel, task, ...rest } = args;
    // arif_judge declares no `task` parameter. Its strict pydantic schema
    // rejects the ENTIRE call on one undeclared kwarg — measured 2026-10-01:
    // task='…' returned unexpected_keyword_argument, so the 666 HEART
    // delegation died at argument validation before any adjudication.
    // Fold the legacy key into `candidate`, which IS declared, and leave every
    // other key (including the sovereign-signature fields the bridge injects)
    // exactly as it was.
    return {
      ...rest,
      mode: (rest.mode as string) ?? "judge",
      candidate:
        typeof task === "string" && task.length > 0
          ? task
          : typeof concern === "string"
            ? JSON.stringify({ concern, findings, riskLevel })
            : JSON.stringify(args),
    };
  }
  return args;
}

/**
 * Special-case response transformers for tools where A-FORGE expects
 * a different shape than the kernel returns.
 */
export function transformResponse(tool: string, result: Record<string, unknown>): Record<string, unknown> {
  if (tool === "apex_judge" || tool === "arif_judge") {
    // AgentEngine expects .decision ("HOLD" | "VOID"), kernel returns .verdict
    const verdict = result.verdict ?? result.decision;
    return {
      ...result,
      decision: verdict,
      verdict,
    };
  }
  return result;
}
