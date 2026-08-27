/**
 * forgeTrustTools.ts — MCP registration for Trust Scoring Engine
 *
 * ECOSYSTEM_EXPANSION::v1 Phase 2: TRUST (WIRED)
 * Registers forge_trust_score against A-FORGE MCP core.
 *
 * Constitutional:
 *   F2 TRUTH  — every score call is evidence-backed
 *   F7 HUMILITY — cold-start shrinkage applied by engine
 *   F11 AUDIT — every evaluation logged (engine-side Postgres + VAULT999)
 *   F13 SOVEREIGN — HOLD band results prepared as judgment requests
 *
 * @module mcp/forgeTrustTools
 * @forged 2026-08-20 by 333-AGI under F13 SOVEREIGN directive
 * DITEMPA BUKAN DIBERI
 */

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { forgeTrustScore } from "../../domain/trust/forge_trust_score.js";

/**
 * Register forge_trust_score as an MCP tool.
 */
export function registerTrustTools(server: McpServer): void {
  // Wrap the schema as z.object so the SDK's AnySchema overload matches.
  const inputSchema = z.object({
    mode: z.enum(["score", "evaluate", "list", "history", "verify"])
      .describe("Operation mode"),
    mcp_id: z.string().optional()
      .describe("MCP server identifier (required for score/evaluate/history/verify)"),
    mcp_name: z.string().optional()
      .describe("Human-readable name"),
    endpoint: z.string().optional()
      .describe("MCP endpoint URL or path"),
    transport: z.enum(["stdio", "streamable-http", "sse"]).optional()
      .describe("Transport type"),
    declared_tools: z.array(z.string()).optional()
      .describe("Tools declared by the MCP server"),
    observed_tools: z.array(z.string()).optional()
      .describe("Tools actually observed via probe"),
    observed_uptime_hours: z.number().optional()
      .describe("Hours of observed uptime"),
    observed_total_calls: z.number().optional()
      .describe("Total calls observed"),
    observed_error_count: z.number().optional()
      .describe("Error count observed"),
    has_receipt_support: z.boolean().optional()
      .describe("Whether MCP emits receipts"),
    has_otel_traces: z.boolean().optional()
      .describe("Whether MCP emits OTel traces"),
    identity_verified: z.boolean().optional()
      .describe("Whether identity is cryptographically verified"),
    mutation_class: z.enum(["read-only", "write", "admin", "unknown"]).optional()
      .describe("Mutation risk class"),
    band: z.enum(["ALLOW", "LIMITED", "HOLD", "DENY"]).optional()
      .describe("Filter by band (for list mode)"),
    limit: z.number().optional()
      .describe("Limit history rows returned"),
  });

  (server as any).tool(
    "forge_trust_score",
    "Trust scoring engine for external MCP servers. Scores on 5 dimensions (identity, uptime, auditability, mutation_risk, witnessability), maps to bands (ALLOW/LIMITED/HOLD/DENY), and gates access. Modes: score, evaluate, list, history, verify. Constitutional: F2 TRUTH, F7 HUMILITY, F11 AUDIT, F13 SOVEREIGN.",
    inputSchema.shape,
    async (args: any) => {
      try {
        return await forgeTrustScore(args);
      } catch (err: any) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "ERROR",
              tool: "forge_trust_score",
              error: err?.message ?? String(err),
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
  );
}