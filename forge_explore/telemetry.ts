/**
 * forge_explore — OTel Span Emitter (MODULE 2)
 * ==============================================
 * forge_id: FE-{2026.08.10}-001
 * module:   TELEMETRY (audit)
 *
 * Every node transition (SEARCH/FETCH/EXTRACT_LINKS/SCORE/SELECT/FOLLOW)
 * emits one span, per OWASP Agent Observability Standard + OTel GenAI
 * semantic conventions.
 *
 * SPAN HIERARCHY:
 *   session_span
 *     └── exploration_step_span
 *           ├── tool_call_span (forge_search, forge_fetch, etc.)
 *           └── llm_call_span  (synthesize, critic reasoning)
 *
 * SPAN ATTRIBUTES (MUST include full telemetry JSON):
 *   { epoch, dS, peace2, kappaR, shadow, confidence, psiLe, verdict,
 *     witness: { human, ai, earth }, qdf }
 *
 * Constitutional gates:
 *   F8  — this IS the audit trail; do not skip
 *   F11 — every transition logged, attributable, inspectable
 *
 * USAGE:
 *   import { emitSpan } from './telemetry.ts';
 *   @emitSpan('SEARCH')
 *   async function searchNode(state) { ... }
 *
 * Phase 1: Decorator prints telemetry to stdout + logs to forge_work/.
 * Phase 2: Wire to real OTel SDK (OpenTelemetry JS) + Langfuse/Grafana.
 *
 * @author 333-AGI Δ MIND
 * @since  2026-08-10
 * @phase  Phase 1 scaffold — stdout + file logs. Real OTel SDK deferred.
 */

import type { ExplorationState, Telemetry } from './state.ts';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ===========================================================================
// Span Types
// ===========================================================================

export type SpanKind = 'NODE' | 'TOOL_CALL' | 'LLM_CALL' | 'SENTINEL';

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export interface Span {
  name: string;
  kind: SpanKind;
  context: SpanContext;
  startTime: number;
  endTime?: number;
  attributes: Record<string, unknown>;
  telemetry: Telemetry;
  status: 'OK' | 'ERROR' | 'HOLD';
}

// ===========================================================================
// Span Registry
// ===========================================================================

const _spanLog: Span[] = [];
let _traceIdCounter = 0;
let _spanIdCounter = 0;

function generateTraceId(): string {
  return `trace-${Date.now()}-${++_traceIdCounter}`;
}

function generateSpanId(): string {
  return `span-${++_spanIdCounter}`;
}

// ===========================================================================
// Core: emitSpan
// ===========================================================================

/**
 * Emits an OTel-compatible span for a node transition.
 *
 * Records:
 *   - span name (node name, e.g. "SEARCH", "FETCH")
 *   - telemetry snapshot from current state
 *   - start/end timestamps
 *   - status (OK / ERROR / HOLD)
 *
 * Phase 1: Logs to forge_work/explore_spans.jsonl AND stdout.
 * Phase 2: Replace with @opentelemetry/sdk-trace-node.
 */
export function emitSpan(
  nodeName: string,
  kind: SpanKind = 'NODE',
): MethodDecorator {
  return function (
    _target: unknown,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const state: ExplorationState | undefined = args[0] as ExplorationState | undefined;
      const telemetry: Telemetry = state?.telemetry ?? ({} as Telemetry);

      const span: Span = {
        name: nodeName,
        kind,
        context: {
          traceId: generateTraceId(),
          spanId: generateSpanId(),
        },
        startTime: Date.now(),
        attributes: {
          node: nodeName,
          module: 'forge_explore',
          forgeId: 'FE-{2026.08.10}-001',
        },
        telemetry: { ...telemetry },
        status: 'OK',
      };

      let result: unknown;
      try {
        result = await originalMethod.apply(this, args);
      } catch (err) {
        span.status = 'ERROR';
        span.attributes = {
          ...span.attributes,
          error: String(err),
        };
        throw err;
      } finally {
        span.endTime = Date.now();
        _spanLog.push(span);

        // Phase 1: stdout + file log
        const logLine = JSON.stringify({
          ...span,
          durationMs: span.endTime - span.startTime,
        });
        console.log(`[forge_explore:telemetry] ${logLine}`);

        // Append to forge_work/explore_spans.jsonl
        try {
          const logPath = path.join(
            process.env.HOME ?? '/root',
            'forge_work',
            'explore_spans.jsonl',
          );
          fs.mkdirSync(path.dirname(logPath), { recursive: true });
          fs.appendFileSync(logPath, logLine + '\n');
        } catch {
          // Non-fatal: span logging failure should not crash exploration
        }
      }

      return result;
    };

    return descriptor;
  } as PropertyDescriptor;
}

// ===========================================================================
// Sentinel span: interoceptive gate decisions
// ===========================================================================

/**
 * Emits a sentinel span recording an interoceptive gate decision.
 * Called from interoceptive_gate.ts when a gate fires (pass/hold/reduce).
 *
 * The sentinel span MUST carry the full telemetry snapshot so that
 * audit can reconstruct WHY a FETCH was held or allowed.
 */
export function emitGateSpan(
  decision: 'PASS' | 'HOLD' | 'REDUCE' | 'F13_HOLD',
  reason: string,
  telemetry: Telemetry,
): Span {
  const span: Span = {
    name: `GATE_${decision}`,
    kind: 'SENTINEL',
    context: {
      traceId: generateTraceId(),
      spanId: generateSpanId(),
    },
    startTime: Date.now(),
    endTime: Date.now(),
    attributes: {
      decision,
      reason,
      module: 'forge_explore:interoceptive_gate',
    },
    telemetry: { ...telemetry },
    status: decision === 'PASS' ? 'OK' : 'HOLD',
  };

  _spanLog.push(span);

  const logLine = JSON.stringify(span);
  console.log(`[forge_explore:gate] ${logLine}`);

  try {
    const logPath = path.join(
      process.env.HOME ?? '/root',
      'forge_work',
      'explore_spans.jsonl',
    );
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, logLine + '\n');
  } catch {
    // Non-fatal
  }

  return span;
}

// ===========================================================================
// Utility: get all spans (for integration test assertions)
// ===========================================================================

/** Returns all recorded spans (for test assertions). */
export function getSpanLog(): ReadonlyArray<Span> {
  return _spanLog;
}

/** Clears span log between tests. */
export function clearSpanLog(): void {
  _spanLog.length = 0;
}
