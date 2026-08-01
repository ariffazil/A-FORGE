/**
 * Canary Deployment — Route a small percentage of traffic to a
 * candidate capability, monitor key metrics, and auto-rollback on
 * regression.
 *
 * ═══ P2.2 RATIFIED (2026-07-31) — CANARY BEFORE FULL TRAFFIC ═════════════
 *
 * Lifecycle:
 *   1. Enroll candidate with initial_canary_pct (default 5%).
 *   2. For each canary-window (default 5 min), track:
 *      - error rate (target: ≤ incumbent + CANARY_ERROR_BUDGET)
 *      - latency p95 (target: ≤ incumbent * CANARY_LATENCY_BUDGET)
 *      - scar pressure (target: ≤ CANARY_SCAR_BUDGET)
 *   3. If any metric exceeds budget → auto-rollback.
 *   4. If all windows pass → promote to full traffic.
 *
 * Rollback strategy: drain the candidate (stop sending traffic),
 * revoke its lease, seal a SCAR receipt for the rollback.
 *
 * @module forge/canary
 * @constitutional F1 AMANAH — rollback is automatic, never gated
 * @constitutional F2 TRUTH — windows are observable per-call
 * @constitutional F5 PEACE² — never destructive on rollback
 */

import { createHash } from "node:crypto";

const CANARY_ERROR_BUDGET = 0.02;       // +2% absolute error rate
const CANARY_LATENCY_BUDGET = 1.20;     // +20% relative latency p95
const CANARY_SCAR_BUDGET = 0.05;       // max 5% scar pressure

export interface CanaryRollbackReceipt {
  capability_id: string;
  reason: "error_rate" | "latency_p95" | "scar_pressure" | "manual" | "lease_expired";
  observed_value: number;
  budget_value: number;
  rolled_back_at: string;
  receipt_hash: string;
}

export interface CanaryState {
  capability_id: string;
  pct: number;                  // current traffic percentage (0–100)
  status: "monitoring" | "promoting" | "rolled_back" | "promoted";
  enrolled_at: string;
  last_window_at: string | null;
  windows_passed: number;
  windows_failed: number;
  rollback?: CanaryRollbackReceipt;
}

export interface WindowMetrics {
  /** Calls sampled in this window. */
  calls: number;
  /** Error rate (failed/total). */
  error_rate: number;
  /** Latency p95 (ms). */
  latency_p95_ms: number;
  /** Scar pressure (incidents/calls). */
  scar_pressure: number;
}

export class CanaryDeployer {
  private readonly candidates = new Map<string, CanaryState>();
  private readonly windows = new Map<string, WindowMetrics[]>();

  enroll(
    capability_id: string,
    initial_pct: number = 5,
  ): CanaryState {
    const existing = this.candidates.get(capability_id);
    if (existing) return existing;
    const state: CanaryState = {
      capability_id,
      pct: initial_pct,
      status: "monitoring",
      enrolled_at: new Date().toISOString(),
      last_window_at: null,
      windows_passed: 0,
      windows_failed: 0,
    };
    this.candidates.set(capability_id, state);
    this.windows.set(capability_id, []);
    return state;
  }

  /**
   * Decide if a request should route to the candidate given the
   * canary percentage. Deterministic hash-based routing — same caller
   * always gets the same lane.
   */
  shouldRoute(capability_id: string, caller_id: string): boolean {
    const c = this.candidates.get(capability_id);
    if (!c || c.status === "rolled_back" || c.status === "promoted") return false;
    const h = createHash("sha256")
      .update(`${capability_id}:${caller_id}`)
      .digest();
    const bucket = h[0] / 256;          // [0, 1)
    return bucket < c.pct / 100;
  }

  /**
   * Record a window's metrics. Returns null on pass, or a rollback
   * receipt on fail. The caller MUST apply the rollback if a
   * receipt is returned.
   */
  recordWindow(
    capability_id: string,
    metrics: WindowMetrics,
    incumbent_baseline: WindowMetrics,
  ): CanaryRollbackReceipt | null {
    const c = this.candidates.get(capability_id);
    if (!c || c.status === "rolled_back" || c.status === "promoted") return null;
    const windows = this.windows.get(capability_id) ?? [];
    windows.push(metrics);
    this.windows.set(capability_id, windows);
    c.last_window_at = new Date().toISOString();

    // Error rate check
    if (metrics.error_rate > incumbent_baseline.error_rate + CANARY_ERROR_BUDGET) {
      return this.rollback(c, "error_rate", metrics.error_rate,
        incumbent_baseline.error_rate + CANARY_ERROR_BUDGET);
    }
    // Latency p95 check
    if (metrics.latency_p95_ms > incumbent_baseline.latency_p95_ms * CANARY_LATENCY_BUDGET) {
      return this.rollback(c, "latency_p95", metrics.latency_p95_ms,
        incumbent_baseline.latency_p95_ms * CANARY_LATENCY_BUDGET);
    }
    // Scar pressure check
    if (metrics.scar_pressure > CANARY_SCAR_BUDGET) {
      return this.rollback(c, "scar_pressure", metrics.scar_pressure, CANARY_SCAR_BUDGET);
    }

    c.windows_passed++;
    return null;
  }

  /**
   * Step canary forward. Called after sustained windows_passed.
   * Doubles pct until 100% (full traffic), then marks "promoted".
   */
  step(capability_id: string): CanaryState | undefined {
    const c = this.candidates.get(capability_id);
    if (!c || c.status !== "monitoring") return c ?? undefined;
    c.pct = Math.min(100, c.pct * 2);
    if (c.pct >= 100) c.status = "promoted";
    return c;
  }

  state(capability_id: string): CanaryState | undefined {
    return this.candidates.get(capability_id);
  }

  auditTrail(capability_id: string): ReadonlyArray<WindowMetrics> {
    return [...(this.windows.get(capability_id) ?? [])];
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private rollback(
    c: CanaryState,
    reason: CanaryRollbackReceipt["reason"],
    observed: number,
    budget: number,
  ): CanaryRollbackReceipt {
    const receipt: CanaryRollbackReceipt = {
      capability_id: c.capability_id,
      reason,
      observed_value: observed,
      budget_value: budget,
      rolled_back_at: new Date().toISOString(),
      receipt_hash: createHash("sha256")
        .update(`${c.capability_id}:${reason}:${observed}:${budget}`)
        .digest("hex")
        .slice(0, 16),
    };
    c.status = "rolled_back";
    c.pct = 0;
    c.rollback = receipt;
    c.windows_failed++;
    return receipt;
  }
}