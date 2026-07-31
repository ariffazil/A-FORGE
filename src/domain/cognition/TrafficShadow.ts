/**
 * TrafficShadow — P2.1 deterministic canary routing + rollback.
 *
 * Routes a fraction of traffic to a candidate capability, compares the
 * candidate outcome to the primary, and emits a rolling-window
 * rollback decision. Default `sample_rate=0.0` preserves existing
 * behaviour; promotion to `sample_rate>0` requires an arifOS SEAL
 * (the orchestrator must populate `policy.arifos_seal_id`).
 *
 * @module cognition/TrafficShadow
 * @constitutional F1 AMANAH · F2 TRUTH · F11 AUDIT
 */

import { createHash } from "node:crypto";

// ── Types ──────────────────────────────────────────────────────────────

export type DeploymentTier = "shadow" | "canary" | "active" | "deprecated" | "retired";

export interface Outcome {
  ok: boolean;
  /** wall-clock duration in ms. */
  wallTimeMs: number;
  /** Optional error code/message. */
  error?: string;
}

export interface ShadowPolicy {
  capability_id: string;
  tier: DeploymentTier;
  shadow: { sample_rate: number; compare_to: "primary" | "golden"; record_diffs: boolean };
  canary: { traffic_fraction: number; max_failures: number; window_minutes: number };
  rollback: { trigger: "fail_rate" | "variance" | "manual"; threshold: number };
  arifos_seal_id?: string;
}

export interface RollbackDecision {
  capability_id: string;
  should_rollback: boolean;
  fail_rate: number;
  variance: number;
  window_samples: number;
  reason: string;
}

interface Sample {
  ts: number;
  primary: Outcome;
  shadow?: Outcome;
}

// ── Hash-based deterministic sampling ─────────────────────────────────

function hashRequest(capabilityId: string, requestId: string): number {
  const h = createHash("sha256")
    .update(`${capabilityId}|${requestId}`)
    .digest("hex");
  // Take first 8 hex chars → 32-bit int
  return parseInt(h.slice(0, 8), 16);
}

export function shouldSample(
  capabilityId: string,
  requestId: string,
  sampleRate: number,
): boolean {
  if (sampleRate <= 0) return false;
  if (sampleRate >= 1) return true;
  const r = hashRequest(capabilityId, requestId) / 0xffffffff;
  return r < sampleRate;
}

// ── Shadow policy + sample window ─────────────────────────────────────

export class TrafficShadow {
  private readonly policy: ShadowPolicy;
  private readonly samples: Sample[] = [];
  private readonly now: () => number;

  constructor(policy: ShadowPolicy, opts?: { clock?: () => number }) {
    this.policy = policy;
    this.now = opts?.clock ?? Date.now;
  }

  getPolicy(): ShadowPolicy { return { ...this.policy }; }

  /** Record one (primary, shadow?) outcome pair. */
  record(primary: Outcome, shadow?: Outcome): void {
    this.samples.push({ ts: this.now(), primary, shadow });
    // Cap to the last 1000 samples to avoid unbounded growth.
    if (this.samples.length > 1000) this.samples.splice(0, this.samples.length - 1000);
  }

  /** Canary routing decision. */
  canaryTraffic(requestId: string): boolean {
    if (this.policy.tier !== "canary" && this.policy.tier !== "active") return false;
    return shouldSample(this.policy.capability_id, requestId, this.policy.canary.traffic_fraction);
  }

  /** Rollback decision over a rolling window. */
  shouldRollback(now: number = this.now()): RollbackDecision {
    const windowMs = this.policy.canary.window_minutes * 60_000;
    const cutoff = now - windowMs;
    const inWindow = this.samples.filter((s) => s.ts >= cutoff);
    const total = inWindow.length;
    const failures = inWindow.filter((s) => !s.primary.ok).length;
    const failRate = total > 0 ? failures / total : 0;

    const durations = inWindow.map((s) => s.primary.wallTimeMs);
    const mean = durations.reduce((a, b) => a + b, 0) / Math.max(1, durations.length);
    const variance = durations.length > 0
      ? Math.sqrt(durations.reduce((a, d) => a + (d - mean) ** 2, 0) / durations.length) / Math.max(1, mean)
      : 0;

    let should_rollback = false;
    let reason = "stable";
    if (total > 0 && this.policy.rollback.trigger === "fail_rate" && failRate > this.policy.rollback.threshold) {
      should_rollback = true;
      reason = `fail_rate ${failRate.toFixed(3)} > ${this.policy.rollback.threshold}`;
    } else if (this.policy.rollback.trigger === "variance" && variance > this.policy.rollback.threshold) {
      should_rollback = true;
      reason = `variance ${variance.toFixed(3)} > ${this.policy.rollback.threshold}`;
    }
    return {
      capability_id: this.policy.capability_id,
      should_rollback,
      fail_rate: failRate,
      variance,
      window_samples: total,
      reason,
    };
  }

  /** Promotion to canary requires arifOS seal. */
  static canPromoteToCanary(policy: ShadowPolicy): boolean {
    if (policy.tier === "canary" || policy.tier === "active") {
      return Boolean(policy.arifos_seal_id);
    }
    return true;
  }
}
