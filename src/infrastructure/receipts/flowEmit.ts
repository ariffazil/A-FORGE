/**
 * P1-5 — A-FORGE → arifFLOW receipt emission with LOCAL FALLBACK.
 *
 * Doctrine (P1, sealed): no delete · no silent drop · local fallback
 * preserved · arifFLOW is receipt authority, not judge.
 *
 * Every emission attempt that fails (arifFLOW down, chain reject, network)
 * is APPENDED to the fallback JSONL — never silently dropped. The P1-7
 * sweeper (`flowFallbackSweeper.ts`) replays that backlog, triggered by the
 * event that proves the plane is back — a successful emission — so no timer
 * or cron is involved (G-13 closed 2026-09-20).
 *
 * Wired 2026-09-09 under F13 "go" (NEXT MUTATION GATE: P1-5f canary).
 * DITEMPA BUKAN DIBERI.
 */

import { appendFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import {
  emitReceipt,
  getClient,
  type EmitReceiptParams,
  type IngestResponse,
} from "./arifflowClient.js";
import { maybeSweep } from "./flowFallbackSweeper.js";

const FALLBACK_PATH =
  process.env.AF_FLOW_FALLBACK_PATH ??
  resolve(homedir(), ".agent-workbench", "aforge-flow-fallback.jsonl");

export interface FlowEmitResult {
  ok: boolean;
  receipt_id?: string;
  fallback_written?: boolean;
  error?: string;
}

async function writeFallback(entry: Record<string, unknown>): Promise<void> {
  try {
    await mkdir(dirname(FALLBACK_PATH), { recursive: true });
    await appendFile(
      FALLBACK_PATH,
      JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n",
      "utf-8",
    );
  } catch {
    // journald-visible last resort: the audit JSONL in telemetry.ts remains
    // the primary local sink for tool events; this catch means even the
    // fallback disk is unwritable (disk full / perms).
    process.stderr.write(
      JSON.stringify({ level: "error", component: "flowEmit", msg: "fallback unwritable", path: FALLBACK_PATH }) + "\n",
    );
  }
}

/**
 * Emit an A-FORGE receipt to arifFLOW :7073/ingest.
 * Fire-safe: caller may await (canary/executor) or fire-and-forget.
 * On failure → local fallback line (no silent drop).
 */
export async function emitAForgeReceipt(
  params: Omit<EmitReceiptParams, "organ"> & { organ?: string },
): Promise<FlowEmitResult> {
  try {
    const resp: IngestResponse = await emitReceipt({
      organ: "A-FORGE",
      ...params,
    });
    // G-13 closure (2026-09-20, FI-003): a successful emission IS the
    // "plane is back" event — drain whatever the fallback collected while
    // arifFLOW was unreachable. Fire-safe: the caller is not blocked, the
    // sweep is single-flight, and a failed replay re-queues its lines.
    void maybeSweep("emit-success");
    return { ok: true, receipt_id: undefined, error: undefined, ...(resp as object) } as FlowEmitResult;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeFallback({
      kind: "flow_receipt_fallback",
      actor_id: params.actor_id,
      session_id: params.session_id,
      summary: params.summary,
      step_type: params.step_type || "Execute",
      error: message,
      params,
    });
    return { ok: false, fallback_written: true, error: message };
  }
}

/**
 * P1-5f Executor receipt canary helper — mint one Execute + one Verify
 * receipt pair for a synthetic canary session, proving the
 * A-FORGE → arifFLOW path end-to-end (including daemon-side VAULT999
 * sealing on each accepted ingest).
 */
export async function runExecutorCanary(
  actor = "a-forge",
  session = `P1-5f-canary-${new Date().toISOString().slice(0, 10)}`,
): Promise<{ execute: FlowEmitResult; verify: FlowEmitResult }> {
  const execute = await emitAForgeReceipt({
    actor_id: actor,
    session_id: session,
    step_type: "Execute",
    summary: "P1-5f executor canary — execute step",
    epistemic_label: "OBS",
    floor_verdict: "PASS",
    details: { canary: "P1-5f", wiring: "A-FORGE->arifFLOW /ingest" },
  });
  const verify = await emitAForgeReceipt({
    actor_id: actor,
    session_id: session,
    step_type: "Verify",
    summary: "P1-5f executor canary — verify step (terminal state)",
    epistemic_label: "OBS",
    floor_verdict: "PASS",
    details: { canary: "P1-5f", verifies: "execute step of this session" },
  });
  return { execute, verify };
}

export { getClient as getArifFlowClient, FALLBACK_PATH };
