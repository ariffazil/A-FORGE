/**
 * invocationLog — canonical federation invocation telemetry (Tuas 2) for A-FORGE.
 *
 * CONTRACT SOURCE (frozen — do NOT fork the format):
 *   /root/AAA/lib/invocation_log.py :: log_invocation()
 *   One JSON object, one line, appended to
 *   /var/lib/arifos/metrics/tool_invocations.jsonl
 *   Keys, in this order:
 *     ts, organ, tool, actor_id, ok, duration_ms, session_id, epoch, host
 *   Optional additive keys: error (<=200 chars), extra (counters only).
 *
 * WHY DIRECT WRITE FROM TS (not a Python subprocess):
 *   A subprocess per tool call would add ~20-40 ms and a fork to every
 *   dispatch inside the execution organ. The line is produced here with the
 *   same key set, same compact JSON separators, same UTC-second `ts`, same
 *   float `epoch`, so the Python reader (exercise_count / readback) parses it
 *   identically. Verified by the readback, not by assertion.
 *
 * PRIVACY BOUNDARY (hard rule): tool NAME and actor id only.
 *   Never arguments, never payloads, never tool output. Errors are recorded as
 *   a CLASS LABEL (`Error`, `TOOL_RESULT_IS_ERROR`), never the message — a
 *   message can carry a payload by accident.
 *
 * FAIL-SOFT (hard rule): a telemetry failure must never break the call it
 *   measures. Every path is wrapped; nothing here throws and nothing waits on
 *   a lock or the network. Rotation (>64 MB) is left to the Python writers,
 *   which compact the shared file on their next append — A-FORGE deliberately
 *   does not race them over the same rename, so the sink is re-opened per call
 *   (never a cached fd, which would keep writing into a rotated .1 inode).
 *
 * WRITE MODE (measured, not assumed): one atomic O_APPEND open/write/close per
 *   receipt — 7.43 us/call on /var/lib/arifos/metrics (n=20000). This is the
 *   same synchronous semantics as the frozen Python contract, and it is
 *   deliberate: an async fire-and-forget append was tried first and LOST the
 *   receipt of a call that completed just before a short-lived process exited
 *   (observed at the stdio dispatch exit). A receipt that can vanish is not a
 *   measurement, so the write is synchronous and lockless.
 *
 * @module infrastructure/metrics/invocationLog
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { hostname } from "node:os";
import { dirname } from "node:path";

/** Sink. Matches LOG_PATH in invocation_log.py. Env override = tests only. */
export const INVOCATION_LOG_PATH = "/var/lib/arifos/metrics/tool_invocations.jsonl";
const PATH_ENV = "AFORGE_INVOCATION_LOG_PATH";

/** Organ identity as the federation readback counts it. */
export const ORGAN = "A-FORGE";

export interface InvocationOptions {
  actorId?: string | null;
  ok?: boolean;
  durationMs?: number | null;
  sessionId?: string | null;
  error?: string | null;
  extra?: Record<string, number | string | boolean> | null;
}

let _host: string | null = null;
function host(): string {
  if (_host === null) {
    try {
      _host = hostname();
    } catch {
      _host = "unknown";
    }
  }
  return _host;
}

function sinkPath(): string {
  try {
    const override = process.env[PATH_ENV];
    return override && override.trim() ? override.trim() : INVOCATION_LOG_PATH;
  } catch {
    return INVOCATION_LOG_PATH;
  }
}

const _ensuredDirs = new Set<string>();

function ensureDir(file: string): void {
  const dir = dirname(file);
  if (_ensuredDirs.has(dir)) return;
  try {
    mkdirSync(dir, { recursive: true });
    _ensuredDirs.add(dir);
  } catch {
    /* unwritable parent — the append below fails soft and is swallowed */
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Build the record exactly as invocation_log.py builds it. */
export function buildInvocationRecord(tool: string, opts: InvocationOptions = {}): Record<string, unknown> {
  const now = Date.now();
  const rec: Record<string, unknown> = {
    ts: new Date(now).toISOString().slice(0, 19) + "Z",
    organ: ORGAN,
    tool,
    actor_id: opts.actorId ?? null,
    ok: opts.ok !== false,
    duration_ms: opts.durationMs === null || opts.durationMs === undefined ? null : round3(opts.durationMs),
    session_id: opts.sessionId ?? null,
    epoch: now / 1000,
    host: host(),
  };
  if (opts.error) rec.error = String(opts.error).slice(0, 200);
  if (opts.extra) {
    const counters: Record<string, number | string | boolean> = {};
    for (const [k, v] of Object.entries(opts.extra)) {
      if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") counters[k] = v;
    }
    if (Object.keys(counters).length > 0) rec.extra = counters;
  }
  return rec;
}

/**
 * Append ONE invocation line. Returns true if the write succeeded.
 * Never throws. One lockless, atomic O_APPEND of a small line (~7 us).
 */
export function logInvocation(tool: string, opts: InvocationOptions = {}): boolean {
  try {
    const target = sinkPath();
    const line = JSON.stringify(buildInvocationRecord(tool, opts)) + "\n";
    ensureDir(target);
    appendFileSync(target, line, { encoding: "utf-8", flag: "a" });
    return true;
  } catch {
    return false;
  }
}

/** Identity extraction — MAP only. Reads nothing but the two identity fields. */
function readActor(args: unknown): string | null {
  try {
    const a = args as Record<string, unknown> | null;
    if (!a || typeof a !== "object") return null;
    if (typeof a.actor_id === "string") return a.actor_id;
    if (typeof a.actorId === "string") return a.actorId;
    return null;
  } catch {
    return null;
  }
}

function readSession(args: unknown): string | null {
  try {
    const a = args as Record<string, unknown> | null;
    if (!a || typeof a !== "object") return null;
    if (typeof a.session_id === "string") return a.session_id;
    if (typeof a.sessionId === "string") return a.sessionId;
    return null;
  } catch {
    return null;
  }
}

/**
 * Wrap a dispatched tool handler so every call leaves exactly one line.
 *
 * Applied at tool REGISTRATION in interfaces/mcp/core.ts, which is the
 * narrowest point common to all three dispatch transports (stdio,
 * http:7072 gated, http:7071 in-process) — all of them end at the handler
 * stored in the SDK tool registry.
 *
 * Semantics preserved: the result is returned untouched, thrown errors are
 * re-thrown untouched, and the log runs in `finally` so denials and failures
 * are receipted too. `ok` is false when the dispatch threw or when the
 * handler returned an isError result.
 */
export function withInvocationLog<A = unknown, R = unknown>(
  toolName: string,
  handler: (args: A, ctx: any) => Promise<R> | R,
): (args: A, ctx?: any) => Promise<R> {
  return async (args: A, ctx?: any): Promise<R> => {
    const startedAt = Date.now();
    let ok = true;
    let errorLabel: string | null = null;
    try {
      const result = await handler(args, ctx);
      if (result && typeof result === "object" && (result as { isError?: unknown }).isError === true) {
        ok = false;
        errorLabel = "TOOL_RESULT_IS_ERROR";
      }
      return result;
    } catch (err) {
      ok = false;
      // Class label only — an error message can carry a payload by accident.
      errorLabel = (err as { name?: string })?.name ?? "Error";
      throw err;
    } finally {
      logInvocation(toolName, {
        actorId: readActor(args),
        sessionId: readSession(args),
        ok,
        durationMs: Date.now() - startedAt,
        error: errorLabel,
      });
    }
  };
}
