/**
 * TrustTypes.ts — Trust Scoring Engine type definitions
 *
 * ECOSYSTEM_EXPANSION::v1 Phase 2: TRUST
 * Scores external MCP servers on 5 constitutional dimensions.
 *
 * Constitutional:
 *   F2 TRUTH  — scores backed by evidence, not assertion
 *   F7 HUMILITY — uncertainty quantified, cold-start handled
 *   F11 AUDIT — every score change logged
 *
 * @module domain/trust/TrustTypes
 * @forged 2026-08-20 by 333-AGI under F13 SOVEREIGN directive
 * DITEMPA BUKAN DIBERI
 */

// ── Trust Dimensions ────────────────────────────────────────────────

export type TrustDimension = 
  | "identity"        // Who is this? Verified identity?
  | "uptime"          // Reliability history. MTBF.
  | "auditability"    // Can actions be traced? Receipt support?
  | "mutation_risk"   // What can this MCP change? Read-only=low
  | "witnessability"; // Can actions be witnessed? OTel? Logs?

export const DIMENSION_WEIGHTS: Record<TrustDimension, number> = {
  identity:        0.25,
  uptime:          0.15,
  auditability:    0.25,
  mutation_risk:   0.20,
  witnessability:  0.15,
};

// ── Score Bands ─────────────────────────────────────────────────────

export type TrustBand = "ALLOW" | "LIMITED" | "HOLD" | "DENY";

export const SCORE_BANDS: { band: TrustBand; min: number; max: number; action: string }[] = [
  { band: "ALLOW",   min: 0.8, max: 1.0, action: "full access" },
  { band: "LIMITED", min: 0.6, max: 0.8, action: "read-only, monitored" },
  { band: "HOLD",    min: 0.4, max: 0.6, action: "needs 888 judgment" },
  { band: "DENY",    min: 0.0, max: 0.4, action: "untrusted, blocked" },
];

export function scoreToBand(score: number): TrustBand {
  for (const { band, min, max } of SCORE_BANDS) {
    if (score >= min && score <= max) return band;
  }
  return "DENY";
}

// ── Dimension Score ─────────────────────────────────────────────────

export interface DimensionScore {
  dimension: TrustDimension;
  weight: number;
  raw_score: number;        // 0.0 - 1.0 (observed)
  confidence: number;       // 0.0 - 1.0 (how sure are we)
  evidence: string;         // OBS/DER/INT label + source
  last_probed: string;      // ISO-8601 UTC
}

// ── Trust Score ─────────────────────────────────────────────────────

export interface TrustScore {
  mcp_id: string;           // Canonical MCP identifier
  mcp_name: string;         // Human-readable name
  mcp_endpoint: string;     // URL or stdio path
  dimensions: DimensionScore[];
  composite_score: number;  // Weighted sum
  confidence_interval: number; // Width of CI (uncertainty)
  band: TrustBand;
  last_evaluated: string;   // ISO-8601 UTC
  evaluation_count: number;
  history: ScoreSnapshot[]; // Last N evaluations
}

export interface ScoreSnapshot {
  timestamp: string;
  composite_score: number;
  band: TrustBand;
  trigger: string;          // What caused this evaluation
}

// ── MCP Server Input ────────────────────────────────────────────────

export interface McpServerInput {
  mcp_id: string;
  mcp_name: string;
  endpoint: string;
  transport: "stdio" | "streamable-http" | "sse";
  declared_capabilities?: string[];
  declared_tools?: string[];
  declared_resources?: string[];
  observed_tools?: string[];
  observed_uptime_hours?: number;
  observed_total_calls?: number;
  observed_error_count?: number;
  has_receipt_support?: boolean;
  has_otel_traces?: boolean;
  identity_verified?: boolean;
  mutation_class?: "read-only" | "write" | "admin" | "unknown";
}

// ── Gate Output ─────────────────────────────────────────────────────

export interface TrustGateResult {
  mcp_id: string;
  score: number;
  band: TrustBand;
  action: "ALLOW" | "LIMITED" | "HOLD" | "DENY";
  reason: string;
  requires_888_judgment: boolean;
  session_restriction?: string;
}
