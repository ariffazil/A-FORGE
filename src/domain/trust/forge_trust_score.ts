/**
 * forge_trust_score.ts — A-FORGE tool wrapper for Trust Scoring Engine
 *
 * ECOSYSTEM_EXPANSION::v1 Phase 2: TRUST
 * MCP tool: forge_trust_score
 *
 * Modes:
 *   score    — Compute trust score for an MCP server
 *   evaluate — Score + gate decision (ALLOW/LIMITED/HOLD/DENY)
 *   list     — List all scored MCP servers
 *   history  — Get score history for an MCP
 *   verify   — Verify hash chain integrity
 *
 * Constitutional:
 *   F2 TRUTH  — scores backed by probe evidence
 *   F7 HUMILITY — cold-start shrinkage applied
 *   F11 AUDIT — every evaluation logged to Postgres + VAULT999
 *   F13 SOVEREIGN — HOLD band routes to 888-APEX
 *
 * @module domain/trust/forge_trust_score
 * @forged 2026-08-20 by 333-AGI under F13 SOVEREIGN directive
 * DITEMPA BUKAN DIBERI
 */

import { computeTrustScore, reevaluateTrustScore } from "./TrustScoringEngine.js";
import { TrustRegistry } from "./TrustRegistry.js";
import { evaluateTrustGate, prepareJudgmentRequest } from "./TrustGate.js";
import type { McpServerInput, TrustScore, TrustBand } from "./TrustTypes.js";

// ── Singleton Registry ──────────────────────────────────────────────

let registry: TrustRegistry | null = null;

function getRegistry(): TrustRegistry {
  if (!registry) {
    registry = new TrustRegistry();
  }
  return registry;
}

// ── Tool Input Schema ───────────────────────────────────────────────

export interface ForgeTrustScoreInput {
  mode: "score" | "evaluate" | "list" | "history" | "verify";
  /** MCP server input (required for score/evaluate) */
  mcp_id?: string;
  mcp_name?: string;
  endpoint?: string;
  transport?: "stdio" | "streamable-http" | "sse";
  declared_tools?: string[];
  observed_tools?: string[];
  observed_uptime_hours?: number;
  observed_total_calls?: number;
  observed_error_count?: number;
  has_receipt_support?: boolean;
  has_otel_traces?: boolean;
  identity_verified?: boolean;
  mutation_class?: "read-only" | "write" | "admin" | "unknown";
  /** Filter for list mode */
  band?: TrustBand;
  /** Limit for history mode */
  limit?: number;
}

// ── Tool Handler ────────────────────────────────────────────────────

export async function forgeTrustScore(
  input: ForgeTrustScoreInput
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const reg = getRegistry();

  switch (input.mode) {
    case "score": {
      if (!input.mcp_id || !input.endpoint) {
        return {
          content: [{ type: "text", text: "Error: mcp_id and endpoint required for score mode" }],
        };
      }

      const mcpInput: McpServerInput = {
        mcp_id: input.mcp_id,
        mcp_name: input.mcp_name ?? input.mcp_id,
        endpoint: input.endpoint,
        transport: input.transport ?? "streamable-http",
        declared_tools: input.declared_tools,
        observed_tools: input.observed_tools,
        observed_uptime_hours: input.observed_uptime_hours,
        observed_total_calls: input.observed_total_calls,
        observed_error_count: input.observed_error_count,
        has_receipt_support: input.has_receipt_support,
        has_otel_traces: input.has_otel_traces,
        identity_verified: input.identity_verified,
        mutation_class: input.mutation_class,
      };

      // Check for existing score
      const existing = await reg.getScore(input.mcp_id);
      const score = existing
        ? reevaluateTrustScore(existing, mcpInput)
        : computeTrustScore(mcpInput);

      // Persist
      await reg.upsertScore(score);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            mcp_id: score.mcp_id,
            composite_score: score.composite_score,
            band: score.band,
            confidence_interval: score.confidence_interval,
            evaluation_count: score.evaluation_count,
            dimensions: score.dimensions.map(d => ({
              dimension: d.dimension,
              weight: d.weight,
              raw_score: d.raw_score,
              confidence: d.confidence,
              evidence: d.evidence,
            })),
          }, null, 2),
        }],
      };
    }

    case "evaluate": {
      if (!input.mcp_id || !input.endpoint) {
        return {
          content: [{ type: "text", text: "Error: mcp_id and endpoint required for evaluate mode" }],
        };
      }

      const mcpInput: McpServerInput = {
        mcp_id: input.mcp_id,
        mcp_name: input.mcp_name ?? input.mcp_id,
        endpoint: input.endpoint,
        transport: input.transport ?? "streamable-http",
        declared_tools: input.declared_tools,
        observed_tools: input.observed_tools,
        observed_uptime_hours: input.observed_uptime_hours,
        observed_total_calls: input.observed_total_calls,
        observed_error_count: input.observed_error_count,
        has_receipt_support: input.has_receipt_support,
        has_otel_traces: input.has_otel_traces,
        identity_verified: input.identity_verified,
        mutation_class: input.mutation_class,
      };

      const existing = await reg.getScore(input.mcp_id);
      const gateResult = evaluateTrustGate(mcpInput, existing ?? undefined);

      // Persist the score
      const score = existing
        ? reevaluateTrustScore(existing, mcpInput)
        : computeTrustScore(mcpInput);
      await reg.upsertScore(score);

      // Build response
      const response: any = {
        mcp_id: gateResult.mcp_id,
        score: gateResult.score,
        band: gateResult.band,
        action: gateResult.action,
        reason: gateResult.reason,
        requires_888_judgment: gateResult.requires_888_judgment,
      };

      if (gateResult.requires_888_judgment) {
        response.judgment_request = prepareJudgmentRequest(gateResult, score);
      }

      if (gateResult.session_restriction) {
        response.session_restriction = gateResult.session_restriction;
      }

      return {
        content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      };
    }

    case "list": {
      const scores = await reg.listScores(input.band);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            count: scores.length,
            filter: input.band ?? "all",
            scores: scores.map(s => ({
              mcp_id: s.mcp_id,
              mcp_name: s.mcp_name,
              composite_score: s.composite_score,
              band: s.band,
              last_evaluated: s.last_evaluated,
              evaluation_count: s.evaluation_count,
            })),
          }, null, 2),
        }],
      };
    }

    case "history": {
      if (!input.mcp_id) {
        return {
          content: [{ type: "text", text: "Error: mcp_id required for history mode" }],
        };
      }
      const history = await reg.getHistory(input.mcp_id, input.limit ?? 20);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            mcp_id: input.mcp_id,
            entries: history,
          }, null, 2),
        }],
      };
    }

    case "verify": {
      if (!input.mcp_id) {
        // Verify all MCPs
        const all = await reg.listScores();
        const results = await Promise.all(
          all.map(async s => ({
            mcp_id: s.mcp_id,
            ...(await reg.verifyChainIntegrity(s.mcp_id)),
          }))
        );
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ verified: results.length, results }, null, 2),
          }],
        };
      }
      const integrity = await reg.verifyChainIntegrity(input.mcp_id);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ mcp_id: input.mcp_id, ...integrity }, null, 2),
        }],
      };
    }

    default:
      return {
        content: [{ type: "text", text: `Error: unknown mode \${input.mode}. Use: score, evaluate, list, history, verify` }],
      };
  }
}

// ── Tool Definition (for MCP registration) ──────────────────────────

export const FORGE_TRUST_SCORE_DEFINITION = {
  name: "forge_trust_score",
  description: "Trust scoring engine for external MCP servers. Scores on 5 dimensions (identity, uptime, auditability, mutation_risk, witnessability), maps to bands (ALLOW/LIMITED/HOLD/DENY), and gates access. Constitutional: F2 TRUTH, F7 HUMILITY, F11 AUDIT, F13 SOVEREIGN.",
  inputSchema: {
    type: "object" as const,
    properties: {
      mode: {
        type: "string" as const,
        enum: ["score", "evaluate", "list", "history", "verify"],
        description: "Operation mode",
      },
      mcp_id: { type: "string" as const, description: "MCP server identifier" },
      mcp_name: { type: "string" as const, description: "Human-readable name" },
      endpoint: { type: "string" as const, description: "MCP endpoint URL or path" },
      transport: { type: "string" as const, enum: ["stdio", "streamable-http", "sse"] },
      declared_tools: { type: "array" as const, items: { type: "string" as const } },
      observed_tools: { type: "array" as const, items: { type: "string" as const } },
      observed_uptime_hours: { type: "number" as const },
      observed_total_calls: { type: "number" as const },
      observed_error_count: { type: "number" as const },
      has_receipt_support: { type: "boolean" as const },
      has_otel_traces: { type: "boolean" as const },
      identity_verified: { type: "boolean" as const },
      mutation_class: { type: "string" as const, enum: ["read-only", "write", "admin", "unknown"] },
      band: { type: "string" as const, enum: ["ALLOW", "LIMITED", "HOLD", "DENY"] },
      limit: { type: "number" as const },
    },
    required: ["mode"],
  },
};
