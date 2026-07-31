/**
 * Capability Market — Empirical success / cost / latency / scar pressure
 * ledger per capability. Drives Stage 2 of the next-horizon doctrine:
 * U = w_s·S − w_c·C − w_l·L − w_d·D − w_i·I
 *
 * ═══ P2.4 RATIFIED (2026-07-31) — UTILITY IS COMPUTED, NOT CLAIMED ═══════
 *
 * The market records observations from every invocation:
 *   - success / failure
 *   - compute cost (cpu_ms + memory_mb·sec + tokens_in + tokens_out)
 *   - latency
 *   - schema drift (output schema vs declared schema)
 *   - incidents (scar pressure)
 *
 * These feed:
 *   - Stage 2 empirical utility U
 *   - Stage 3 trajectory Θ = EMA(U_t − U_{t−1})
 *   - EvidencePromotionGate thresholds
 *
 * @module forge/capabilityMarket
 * @constitutional F2 TRUTH — utility is computed from observations
 * @constitutional F11 AUDIT — every observation has a receipt
 */

import { createHash } from "node:crypto";

// ── Observation record ────────────────────────────────────────────────────

export interface CapabilityObservation {
  capability_id: string;
  at: string;
  success: boolean;
  compute_cost: {
    cpu_ms: number;
    memory_mb_sec: number;
    tokens_in: number;
    tokens_out: number;
    units: number;       // normalised cost units
  };
  latency_ms: number;
  schema_drift: boolean;
  incident: boolean;
  receipt_hash: string;
}

// ── Market state ──────────────────────────────────────────────────────────

export interface CapabilityMarketEntry {
  capability_id: string;
  observations: number;
  successes: number;
  failures: number;
  total_cost_units: number;
  total_latency_ms: number;
  schema_drifts: number;
  incidents: number;
  /** Stage 2: empirical utility U in [0, 1]. */
  utility: number;
  /** Stage 3: trajectory Θ = EMA(ΔU). */
  trajectory: number;
  /** Last receipt hash for the market state. */
  state_hash: string;
  last_observation_at: string | null;
}

// ── Default weights (Stage 2) ─────────────────────────────────────────────

export const DEFAULT_UTILITY_WEIGHTS = {
  success: 1.0,
  cost: 0.4,
  latency: 0.2,
  drift: 0.5,
  incident: 0.8,
} as const;

export const DEFAULT_TRAJECTORY_ALPHA = 0.3;   // EMA smoothing

// ── Market implementation ────────────────────────────────────────────────

export class CapabilityMarket {
  private readonly entries = new Map<string, CapabilityMarketEntry>();
  private readonly all_obs: CapabilityObservation[] = [];

  constructor(
    private readonly weights: typeof DEFAULT_UTILITY_WEIGHTS = DEFAULT_UTILITY_WEIGHTS,
    private readonly alpha: number = DEFAULT_TRAJECTORY_ALPHA,
  ) {}

  /**
   * Record one observation. Recomputes utility + trajectory for the
   * capability atomically. The state_hash is the merkle-style digest
   * of the new market state.
   */
  record(obs: CapabilityObservation): CapabilityMarketEntry {
    this.all_obs.push(obs);
    const e = this.entries.get(obs.capability_id) ?? this.emptyEntry(obs.capability_id);

    e.observations++;
    if (obs.success) e.successes++;
    else e.failures++;
    e.total_cost_units += obs.compute_cost.units;
    e.total_latency_ms += obs.latency_ms;
    if (obs.schema_drift) e.schema_drifts++;
    if (obs.incident) e.incidents++;
    e.last_observation_at = obs.at;

    // Stage 2 utility U = w_s·S − w_c·C − w_l·L − w_d·D − w_i·I
    const S = e.successes / e.observations;
    const C = Math.min(1, e.total_cost_units / e.observations / 100);
    const L = Math.min(1, e.total_latency_ms / e.observations / 60_000);
    const D = e.schema_drifts / e.observations;
    const I = e.incidents / e.observations;

    const newU =
      this.weights.success * S -
      this.weights.cost * C -
      this.weights.latency * L -
      this.weights.drift * D -
      this.weights.incident * I;

    // Stage 3 trajectory Θ = EMA(U_t − U_{t−1})
    const dU = e.observations > 1 ? newU - e.utility : 0;
    e.trajectory = e.observations > 1
      ? this.alpha * dU + (1 - this.alpha) * e.trajectory
      : 0;
    e.utility = Math.max(0, Math.min(1, newU));

    e.state_hash = createHash("sha256")
      .update(`${e.capability_id}:${e.observations}:${e.utility.toFixed(6)}:${e.trajectory.toFixed(6)}`)
      .digest("hex")
      .slice(0, 16);

    this.entries.set(e.capability_id, e);
    return e;
  }

  state(capability_id: string): CapabilityMarketEntry | undefined {
    return this.entries.get(capability_id);
  }

  auditTrail(): ReadonlyArray<CapabilityObservation> {
    return [...this.all_obs];
  }

  /**
   * Demand signal — count of distinct sessions that called this
   * capability in the window. Demand + success rate drive replacement
   * decisions.
   */
  demand(capability_id: string, window_ms: number): number {
    const cutoff = Date.now() - window_ms;
    const obs = this.all_obs.filter(
      o => o.capability_id === capability_id &&
        new Date(o.at).getTime() >= cutoff,
    );
    return new Set(obs.map(o => o.receipt_hash)).size;
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private emptyEntry(capability_id: string): CapabilityMarketEntry {
    return {
      capability_id,
      observations: 0,
      successes: 0,
      failures: 0,
      total_cost_units: 0,
      total_latency_ms: 0,
      schema_drifts: 0,
      incidents: 0,
      utility: 0,
      trajectory: 0,
      state_hash: "genesis",
      last_observation_at: null,
    };
  }
}