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

/** Tool name mapping: A-FORGE internal → canonical arifOS tool name */
export const TOOL_NAME_MAP: Record<string, string> = {
  apex_judge: "arif_judge",
  truth_gate: "arif_claim_gate",
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
    const { concern, findings, riskLevel, ...rest } = args;
    return {
      ...rest,
      mode: "judge",
      candidate:
        typeof concern === "string"
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
