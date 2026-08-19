/**
 * OtelToolWrapper.ts — Instrumented tool call wrapper
 *
 * ECOSYSTEM_EXPANSION::v1 Phase 3: OBSERVABILITY
 * Wraps every forge_* call with an OTel span.
 *
 * Usage:
 *   const result = await instrumentedToolCall("forge_shell", {command: "ls"}, handler);
 *
 * Constitutional:
 *   F2 TRUTH  — span attributes are evidence, not assertion
 *   F11 AUDIT — every span end triggers receipt bridge
 *
 * @module domain/observability/OtelToolWrapper
 * @forged 2026-08-20 by 333-AGI under F13 SOVEREIGN directive
 * DITEMPA BUKAN DIBERI
 */

import { getTracer } from "./OtelBootstrap.js";
import type { ArifOSSpanAttributes } from "./OtelTypes.js";

// ── Types ───────────────────────────────────────────────────────────

export type ToolHandler<T = any> = (args: Record<string, any>) => Promise<T>;

export interface ToolCallResult<T = any> {
  result: T;
  trace_id: string;
  span_id: string;
  duration_ms: number;
  status: "OK" | "ERROR";
}

// ── Instrumented Tool Call ──────────────────────────────────────────

/**
 * Execute a tool call with OTel span instrumentation.
 * Creates a span, executes the handler, records status, and ends the span.
 *
 * The span carries arifOS-specific attributes:
 *   - arifos.session_id
 *   - arifos.actor_id
 *   - arifos.fq_at_time
 *   - arifos.floor_verdict
 *   - arifos.organ
 *   - arifos.mcp_server
 */
export async function instrumentedToolCall<T = any>(
  toolName: string,
  args: Record<string, any>,
  handler: ToolHandler<T>,
  attributes?: Partial<ArifOSSpanAttributes>
): Promise<ToolCallResult<T>> {
  const tracer = getTracer();
  const startTime = Date.now();
  const traceId = generateTraceId();
  const spanId = generateSpanId();

  // Build span attributes
  const spanAttrs: Record<string, any> = {
    "mcp.method.name": "tools/call",
    "gen_ai.tool.name": toolName,
    "gen_ai.operation.name": "execute_tool",
    "mcp.protocol.version": "2025-11-25",
    ...attributes,
  };

  // Record span start
  const spanStart = {
    trace_id: traceId,
    span_id: spanId,
    name: `tools/call ${toolName}`,
    kind: "SERVER",
    attributes: spanAttrs,
    start_time: new Date().toISOString(),
  };

  tracer.spans.push(spanStart);

  try {
    const result = await handler(args);
    const duration = Date.now() - startTime;

    // Record span end
    tracer.spans.push({
      trace_id: traceId,
      span_id: spanId,
      end_time: new Date().toISOString(),
      status: "OK",
      duration_ms: duration,
    });

    return {
      result,
      trace_id: traceId,
      span_id: spanId,
      duration_ms: duration,
      status: "OK",
    };
  } catch (err: any) {
    const duration = Date.now() - startTime;

    // Record span end with error
    tracer.spans.push({
      trace_id: traceId,
      span_id: spanId,
      end_time: new Date().toISOString(),
      status: "ERROR",
      error: err.message ?? String(err),
      duration_ms: duration,
    });

    throw err;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function generateTraceId(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateSpanId(): string {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Get recent spans from the tracer (for debugging/testing).
 */
export function getRecentSpans(limit = 10): any[] {
  const tracer = getTracer();
  return tracer.spans.slice(-limit);
}
