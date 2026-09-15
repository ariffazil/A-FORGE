/**
 * domain/rsi/dual-rate-fq.ts — Dual-Rate FQ Signal Calculator
 *
 * FQ (Flow Quotient = verify/execute) sampled at arifFlow's cron rate (~daily)
 * aliases the weekly governance cycle. This module computes both rates:
 *   - daily_fq: cockpit telemetry (observational only)
 *   - governance_fq: 7-day rolling window (constitutional decisions)
 *
 * Constitutional:
 *   F1 AMANAH — read-only computation, never mutates receipts
 *   F2 TRUTH — dual-rate is OBS label; governance_fq is DER (derived from observed)
 *   Aliasing warning: daily_fq is NOT suitable for constitutional decisions
 *
 * @see /root/forge_work/2026-09-15-AF-RSI-state-vector.md §3
 * @authority ARIF / F13 SOVEREIGN
 * @date 2026-09-15
 * @forged FI-003 (Qwen Code)
 */

import { readFile, existsSync } from "node:fs";
import { promisify } from "node:util";

const readFileAsync = promisify(readFile);

// ── Paths ───────────────────────────────────────────────────────────────────

const RECEIPTS_LOG = "/var/lib/arifflow/receipts.jsonl";

// ── Types ───────────────────────────────────────────────────────────────────

interface FlowReceipt {
  receipt_id?: string;
  ts?: string;
  /** Live arifFlow writer emits `created_at`, not `ts`. Both are accepted —
   *  reading only `ts` made the governance FQ window permanently empty
   *  (count = 0) while the tool still reported status OK. A dead instrument
   *  that looks alive is worse than a missing one.
   *  Measured 2026-09-15: 29,696 live receipts, every one carrying created_at. */
  created_at?: string;
  step_type?: string;
  actor_id?: string;
  session_id?: string;
  [key: string]: unknown;
}

export interface DualRateFQ {
  daily_fq: number;
  governance_fq: number;
  governance_window_count: number;
  governance_window_sufficient: boolean;
  governance_window_min_samples: number;
  computed_at: string;
}

// ── Receipt loading ─────────────────────────────────────────────────────────

async function loadReceipts(): Promise<FlowReceipt[]> {
  if (!existsSync(RECEIPTS_LOG)) return [];
  const content = await readFileAsync(RECEIPTS_LOG, "utf-8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as FlowReceipt;
      } catch {
        return null;
      }
    })
    .filter((r): r is FlowReceipt => r !== null);
}

// ── FQ computation ──────────────────────────────────────────────────────────

/**
 * Compute FQ for a set of receipts.
 * FQ = verify_count / execute_count
 * Returns 0 if no executions (prevents division by zero).
 */
function computeFQ(receipts: FlowReceipt[]): number {
  const execute = receipts.filter(
    (r) => r.step_type === "Execute" || r.step_type === "execute",
  ).length;
  const verify = receipts.filter(
    (r) => r.step_type === "Verify" || r.step_type === "verify",
  ).length;

  return execute > 0 ? verify / execute : 0;
}

/**
 * Compute dual-rate FQ signal.
 *
 * Returns both daily (cockpit) and7-day rolling (governance) FQ values.
 * The governance window requires a minimum sample count for reliability.
 *
 * @param minGovernanceSamples — minimum receipts in7-day window for reliable signal (default: 10)
 * @returns DualRateFQ
 */
export async function computeDualRateFQ(
  minGovernanceSamples: number = 10,
): Promise<DualRateFQ> {
  const receipts = await loadReceipts();

  if (receipts.length === 0) {
    return {
      daily_fq: 0,
      governance_fq: 0,
      governance_window_count: 0,
      governance_window_sufficient: false,
      governance_window_min_samples: minGovernanceSamples,
      computed_at: new Date().toISOString(),
    };
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Live writer emits `created_at`; older/synthetic receipts may carry `ts`.
  const stampOf = (r: FlowReceipt): number => {
    const raw = r.created_at ?? r.ts;
    if (!raw) return NaN;
    return new Date(String(raw)).getTime();
  };

  // Daily FQ: last 24 hours
  const dailyReceipts = receipts.filter((r) => {
    const t = stampOf(r);
    return Number.isFinite(t) && now - t < dayMs;
  });

  // Governance FQ: last 7 days
  const governanceReceipts = receipts.filter((r) => {
    const t = stampOf(r);
    return Number.isFinite(t) && now - t < 7 * dayMs;
  });

  return {
    daily_fq: computeFQ(dailyReceipts),
    governance_fq: computeFQ(governanceReceipts),
    governance_window_count: governanceReceipts.length,
    governance_window_sufficient:
      governanceReceipts.length >= minGovernanceSamples,
    governance_window_min_samples: minGovernanceSamples,
    computed_at: new Date().toISOString(),
  };
}
