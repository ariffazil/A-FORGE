/**
 * OtelTypes.ts — OpenTelemetry type definitions for A-FORGE
 *
 * ECOSYSTEM_EXPANSION::v1 Phase 3: OBSERVABILITY
 * Wraps every forge_* call with OTel spans, feeds traces to arifFlow.
 *
 * Trace schema per directive:
 *   trace_id, span_id, operation, mcp_server, tool,
 *   session_id, actor_id, fq_at_time, floor_verdict
 *
 * Constitutional:
 *   F2 TRUTH  — traces are evidence, not assertion
 *   F11 AUDIT — every span sealed to VAULT999 via receipts
 *
 * @module domain/observability/OtelTypes
 * @forged 2026-08-20 by 333-AGI under F13 SOVEREIGN directive
 * DITEMPA BUKAN DIBERI
 */

// ── Span Attributes (arifOS custom) ─────────────────────────────────

export interface ArifOSSpanAttributes {
  "arifos.session_id": string;
  "arifos.actor_id": string;
  "arifos.fq_at_time": number;
  "arifos.floor_verdict": string;
  "arifos.organ": string;
  "arifos.mcp_server": string;
}

// ── Receipt-Span Bridge ─────────────────────────────────────────────

export interface SpanReceiptBridge {
  trace_id: string;
  span_id: string;
  step_type: "Execute" | "Verify" | "Cool" | "Seal" | "Barrier" | "Merge" | "Route";
  cost_ns: number;
  epistemic_label: "Observation" | "Derivation" | "Interpretation" | "Specification" | "Seal";
  floor_verdict: "Pass" | "Caution" | "Hold" | "Void";
  witness_organs: string[];
  tool_name: string;
  session_id: string;
  actor_id: string;
}

// ── OTel Config ─────────────────────────────────────────────────────

export interface OtelConfig {
  serviceName: string;
  serviceVersion: string;
  otlpEndpoint: string;
  organName: string;
  enableReceiptBridge: boolean;
}

export const DEFAULT_OTEL_CONFIG: OtelConfig = {
  serviceName: "aforge-organ",
  serviceVersion: "2.0.0",
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318/v1/traces",
  organName: "aforge",
  enableReceiptBridge: true,
};
