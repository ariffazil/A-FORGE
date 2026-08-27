/**
 * arifFlowBridge.ts — P1-5 Receipt Federation wiring (A-FORGE → arifFlow :7073).
 *
 * Emits FlowReceipts to the arifFlow daemon after governed shell execution
 * (Execute) and seal verification (Verify). Mirrors the canonical Python
 * client (/root/arifFlow/src/py/arifflow/client.py) — POST /ingest.
 *
 * Live daemon contract (probed 2026-08-25): GET /health, POST /ingest,
 * POST /check, POST /release, POST /enforce, POST /flow. The observatory's
 * declared /receipt/emit endpoint list is aspirational — /ingest is real.
 *
 * Protocol (arifFlow AGENTS.md): /check before execute, /ingest after
 * execute, /ingest Verify after verify. This wiring ships the receipt half
 * (P1-5f canary); the blocking /check gate is a deliberate follow-up.
 *
 * FAIL-OPEN by design: a receipt failure must NEVER block or fail a shell
 * execution. Set ARIFFLOW_URL=off to disable emission entirely.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { randomUUID } from "node:crypto";

export type FlowStepType =
  | "Execute"
  | "Verify"
  | "Cool"
  | "Seal"
  | "Barrier"
  | "Merge"
  | "Route";

export type FlowEpistemicLabel =
  | "Observation"
  | "Derivation"
  | "Interpretation"
  | "Specification"
  | "Seal";

export type FlowFloorVerdict = "Pass" | "Caution" | "Hold" | "Void";

export interface FlowReceiptInput {
  step_type: FlowStepType;
  actor_id: string;
  session_id: string;
  cost_ns: number;
  epistemic_label?: FlowEpistemicLabel;
  floor_verdict?: FlowFloorVerdict;
  cooling_decision?: string;
  payload?: Record<string, unknown>;
  intent_reason?: string;
  expected_outcome?: string;
  step_number?: number;
}

export interface FlowIngestResult {
  ok: boolean;
  status: string;
  error?: string;
}

const DEFAULT_URL = "http://127.0.0.1:7073";
let warnedOnce = false;

export function arifFlowEnabled(): boolean {
  return (process.env.ARIFFLOW_URL || DEFAULT_URL) !== "off";
}

function baseUrl(): string {
  return (process.env.ARIFFLOW_URL || DEFAULT_URL).replace(/\/+$/, "");
}

/**
 * Emit a FlowReceipt to arifFlow POST /ingest.
 * Fire-and-forget safe: resolves (never rejects) — errors are logged
 * once per process and swallowed. Fail-open per P1-5 canary doctrine.
 */
export async function emitFlowReceipt(
  input: FlowReceiptInput
): Promise<FlowIngestResult> {
  if (!arifFlowEnabled()) {
    return { ok: false, status: "disabled" };
  }

  const receipt: Record<string, unknown> = {
    receipt_id: randomUUID(),
    actor_id: input.actor_id,
    session_id: input.session_id,
    step_type: input.step_type,
    epistemic_label: input.epistemic_label ?? "Observation",
    cost_ns: Math.max(0, Math.round(input.cost_ns)),
    step_number: input.step_number ?? 1,
    created_at: new Date().toISOString(),
    floor_verdict: input.floor_verdict ?? "Pass",
    cooling_decision: input.cooling_decision ?? "None",
  };
  if (input.payload !== undefined) receipt.payload = input.payload;
  if (input.intent_reason) receipt.intent_reason = input.intent_reason;
  if (input.expected_outcome) receipt.expected_outcome = input.expected_outcome;

  try {
    const res = await fetch(`${baseUrl()}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(receipt),
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) {
      warnOnce(`arifFlow /ingest HTTP ${res.status}`);
      return { ok: false, status: `http_${res.status}` };
    }
    return { ok: true, status: "ingested" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    warnOnce(`arifFlow unreachable: ${msg}`);
    return { ok: false, status: "error", error: msg };
  }
}

function warnOnce(msg: string): void {
  if (warnedOnce) return;
  warnedOnce = true;
  console.error(`[arifFlowBridge] ${msg} (fail-open; further warnings suppressed)`);
}
