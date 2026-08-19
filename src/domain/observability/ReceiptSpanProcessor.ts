/**
 * ReceiptSpanProcessor.ts — Bridges OTel spans to arifFlow receipts
 *
 * ECOSYSTEM_EXPANSION::v1 Phase 3: OBSERVABILITY
 * When a span ends, mints an arifFlow receipt for metabolic tracking.
 *
 * Flow:
 *   Span End -> Receipt Mint -> arifFlow /ingest -> FQ updated
 *
 * Constitutional:
 *   F2 TRUTH  — receipts are evidence of execution
 *   F4 CLARITY — verify/execute ratio drives FQ
 *   F11 AUDIT — every receipt is hash-chained
 *
 * @module domain/observability/ReceiptSpanProcessor
 * @forged 2026-08-20 by 333-AGI under F13 SOVEREIGN directive
 * DITEMPA BUKAN DIBERI
 */

import type { SpanReceiptBridge, ArifOSSpanAttributes } from "./OtelTypes.js";

// ── Types ───────────────────────────────────────────────────────────

export interface SpanRecord {
  trace_id: string;
  span_id: string;
  name: string;
  status: string;
  duration_ms: number;
  attributes: Record<string, any>;
  start_time: string;
  end_time: string;
}

export interface FlowReceipt {
  trace_id: string;
  span_id: string;
  step_type: string;
  cost_ns: number;
  epistemic_label: string;
  floor_verdict: string;
  witness_organs: string[];
  actor_id: string;
  session_id: string;
}

// ── Receipt Span Processor ──────────────────────────────────────────

/**
 * Process an ended span and mint an arifFlow receipt.
 * Determines step_type based on tool name patterns.
 */
export function processSpanToReceipt(span: SpanRecord): FlowReceipt | null {
  // Only process tool call spans
  if (!span.name?.startsWith("tools/call ")) return null;

  const toolName = span.attributes?.["gen_ai.tool.name"] ?? "unknown";
  const arifos = extractArifosAttributes(span.attributes);

  // Determine step_type from tool name patterns
  const stepType = classifyStepType(toolName, span.status);

  // Determine epistemic label from tool category
  const epistemicLabel = classifyEpistemic(toolName);

  // Determine floor verdict from span status
  const floorVerdict = span.status === "ERROR" ? "Void" : "Pass";

  // Cost in nanoseconds
  const costNs = span.duration_ms * 1_000_000;

  return {
    trace_id: span.trace_id,
    span_id: span.span_id,
    step_type: stepType,
    cost_ns: costNs,
    epistemic_label: epistemicLabel,
    floor_verdict: floorVerdict,
    witness_organs: [arifos.organ ?? "aforge"],
    actor_id: arifos.actor_id ?? "unknown",
    session_id: arifos.session_id ?? "unknown",
  };
}

/**
 * Batch-process multiple spans into receipts.
 */
export function processSpansToReceipts(spans: SpanRecord[]): FlowReceipt[] {
  const receipts: FlowReceipt[] = [];
  for (const span of spans) {
    const receipt = processSpanToReceipt(span);
    if (receipt) receipts.push(receipt);
  }
  return receipts;
}

// ── Classification Helpers ──────────────────────────────────────────

function classifyStepType(toolName: string, status: string): string {
  // Verify patterns
  if (toolName.includes("check") || toolName.includes("verify") || toolName.includes("probe")) {
    return "Verify";
  }
  // Seal patterns
  if (toolName.includes("seal") || toolName.includes("vault")) {
    return "Seal";
  }
  // Route patterns
  if (toolName.includes("route") || toolName.includes("dispatch")) {
    return "Route";
  }
  // Default: Execute
  return "Execute";
}

function classifyEpistemic(toolName: string): string {
  // Observation tools
  if (toolName.includes("probe") || toolName.includes("health") || toolName.includes("status")) {
    return "Observation";
  }
  // Derivation tools
  if (toolName.includes("compute") || toolName.includes("score") || toolName.includes("evaluate")) {
    return "Derivation";
  }
  // Interpretation tools
  if (toolName.includes("analyze") || toolName.includes("reason") || toolName.includes("think")) {
    return "Interpretation";
  }
  // Default: Derivation
  return "Derivation";
}

function extractArifosAttributes(attrs: Record<string, any>): {
  session_id?: string;
  actor_id?: string;
  organ?: string;
  fq_at_time?: number;
  floor_verdict?: string;
} {
  return {
    session_id: attrs?.["arifos.session_id"],
    actor_id: attrs?.["arifos.actor_id"],
    organ: attrs?.["arifos.organ"],
    fq_at_time: attrs?.["arifos.fq_at_time"],
    floor_verdict: attrs?.["arifos.floor_verdict"],
  };
}
