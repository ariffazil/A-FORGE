/**
 * Causal trace context — W3C traceparent-aligned span propagation.
 *
 * P5 FIX (2026-07-29): Implements parent-child span continuity across the
 * federation: AAA → arifOS → A-FORGE → VAULT999.
 *
 * Every call chain:
 *   1. Root ingress creates trace_id + root span_id (if absent)
 *   2. Every child hop inherits trace_id, generates new span_id,
 *      sets parent_span_id to the caller's span_id
 *   3. Consequential calls that replace an existing trace_id without
 *      an explicit boundary reason are rejected
 *
 * Compatible with W3C traceparent header propagation.
 */

import { randomUUID } from "node:crypto";

const TRACEPARENT_RE = /^00-([0-9a-f]{32})-([0-9a-f]{16})-0[0-9a-f]$/i;

export interface TraceSpan {
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  is_root: boolean;
}

export interface TraceContext {
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  baggage: Record<string, string>;
  created_at: string;
}

/**
 * Create a root trace span for a new ingress call.
 * Generates a new trace_id and root span_id.
 */
export function createRootTrace(caller?: string): TraceContext {
  const trace_id = randomUUID().replace(/-/g, "");
  const span_id = randomUUID().replace(/-/g, "").slice(0, 16);
  return {
    trace_id,
    span_id,
    parent_span_id: null,
    baggage: caller ? { caller } : {},
    created_at: new Date().toISOString(),
  };
}

/**
 * Create a child span inheriting the parent's trace_id.
 * The child gets a new span_id and records the parent's span_id.
 * Rejects if the parent has no span_id.
 */
export function createChildSpan(
  parent: TraceContext,
  childLabel?: string,
): TraceContext | { error: string } {
  if (!parent.span_id) {
    return { error: "PARENT_SPAN_MISSING: Cannot create child span without parent span_id" };
  }
  if (!parent.trace_id) {
    return { error: "PARENT_TRACE_MISSING: Cannot create child span without parent trace_id" };
  }
  const span_id = randomUUID().replace(/-/g, "").slice(0, 16);
  return {
    trace_id: parent.trace_id,
    span_id,
    parent_span_id: parent.span_id,
    baggage: {
      ...parent.baggage,
      ...(childLabel ? { child_label: childLabel } : {}),
    },
    created_at: new Date().toISOString(),
  };
}

/**
 * Parse W3C traceparent header into TraceContext.
 * Format: 00-<trace_id(32hex)>-<span_id(16hex)>-<flags>
 */
export function parseTraceparent(header: string): TraceContext | null {
  const match = TRACEPARENT_RE.exec(header.trim());
  if (!match) return null;
  return {
    trace_id: match[1],
    span_id: match[2],
    parent_span_id: null, // traceparent doesn't carry parent_span_id — the receiver sets it
    baggage: {},
    created_at: new Date().toISOString(),
  };
}

/**
 * Format TraceContext as W3C traceparent header value.
 */
export function formatTraceparent(ctx: TraceContext): string {
  return `00-${ctx.trace_id}-${ctx.span_id}-01`;
}

/**
 * Validate that a TraceContext is well-formed for a consequential call.
 * Rejects if trace_id is missing or span_id is missing where required.
 */
export function validateTraceForCall(
  ctx: TraceContext | null | undefined,
  requireSpan: boolean = true,
): { ok: boolean; error?: string } {
  if (!ctx) {
    if (requireSpan) return { ok: false, error: "TRACE_MISSING: Trace context required for this call" };
    return { ok: true };
  }
  if (!ctx.trace_id || ctx.trace_id.length < 32) {
    return { ok: false, error: "INVALID_TRACE_ID" };
  }
  if (requireSpan && (!ctx.span_id || ctx.span_id.length < 16)) {
    return { ok: false, error: "INVALID_SPAN_ID" };
  }
  return { ok: true };
}

/**
 * Extract or create trace context from call arguments and headers.
 * Priority: explicit traceparent header > _meta.trace > new root.
 */
export function resolveTraceContext(
  args?: Record<string, unknown> | null,
  headers?: Record<string, string> | null,
): TraceContext {
  // 1. Check for W3C traceparent header
  const tp = headers?.["traceparent"] || headers?.["Traceparent"];
  if (tp && typeof tp === "string") {
    const parsed = parseTraceparent(tp);
    if (parsed) return parsed;
  }

  // 2. Check _meta for existing trace context
  const meta = args?._meta as Record<string, unknown> | undefined;
  if (meta?.trace_id && typeof meta.trace_id === "string") {
    const existing: TraceContext = {
      trace_id: meta.trace_id as string,
      span_id: (meta.span_id as string) || "",
      parent_span_id: (meta.parent_span_id as string) || null,
      baggage: (meta.baggage as Record<string, string>) || {},
      created_at: (meta.created_at as string) || new Date().toISOString(),
    };
    return existing;
  }

  // 3. Create root trace (new ingress)
  return createRootTrace();
}

/**
 * Inject trace context into MCP/A2A metadata for downstream propagation.
 */
export function injectTraceIntoMeta(
  ctx: TraceContext,
  target: Record<string, unknown>,
): void {
  target._trace = {
    trace_id: ctx.trace_id,
    span_id: ctx.span_id,
    parent_span_id: ctx.parent_span_id,
    baggage: ctx.baggage,
    created_at: ctx.created_at,
  };
}
