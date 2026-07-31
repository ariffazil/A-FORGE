/**
 * Multi-Model Evaluation Harness — Run candidate capabilities across
 * multiple model providers so fitness is not defined by a single
 * model's preferences.
 *
 * ═══ P2.3 RATIFIED (2026-07-31) — FITNESS IS MODEL-AGNOSTIC ═══════════════
 *
 * For each candidate capability:
 *   1. For each registered model provider (MiniMax, OpenAI, Anthropic, …)
 *   2. Run N=20 known-answer test cases
 *   3. Record per-model success rate, latency, scar pressure
 *   4. Compute cross-model agreement: σ(success_rate) must be ≤ 0.10
 *      for the capability to be promoted
 *
 * A capability that ONLY works on one model is a model-bias artifact,
 * not a real capability. The cross-model check filters these out.
 *
 * @module forge/multiModelEvaluator
 * @constitutional F2 TRUTH — fitness must survive model swap
 * @constitutional F11 AUDIT — per-model results are logged
 */

import { createHash } from "node:crypto";

export interface ModelProvider {
  model_id: string;
  provider: string;
  is_available: () => Promise<boolean>;
  invoke: (
    input: Record<string, unknown>,
    timeout_ms: number,
  ) => Promise<unknown>;
}

export interface PerModelResult {
  model_id: string;
  calls: number;
  successes: number;
  success_rate: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  scar_pressure: number;
  at: string;
}

export interface MultiModelEvaluation {
  capability_id: string;
  per_model: PerModelResult[];
  cross_model: {
    mean_success_rate: number;
    stddev_success_rate: number;
    agreement_ok: boolean;
    models_evaluated: number;
    models_skipped: number;
  };
  at: string;
  receipt_hash: string;
}

const N_CASES = 20;
const STDDEV_THRESHOLD = 0.10;       // σ ≤ 0.10 ⇒ fitness is model-agnostic

export class MultiModelEvaluator {
  private readonly registry = new Map<string, ModelProvider>();

  register(provider: ModelProvider): void {
    this.registry.set(provider.model_id, provider);
  }

  /**
   * Evaluate a candidate capability across all registered models.
   * Returns the multi-model evaluation with cross-model agreement check.
   *
   * `cases` is the known-answer test vector. Same input goes to every
   * model. Success is asserted by `assertResult`.
   */
  async evaluate(
    capability_id: string,
    cases: Array<{ input: Record<string, unknown>; expected: unknown }>,
    assertResult: (actual: unknown, expected: unknown) => boolean,
  ): Promise<MultiModelEvaluation> {
    if (cases.length < N_CASES) {
      throw new Error(`MultiModelEvaluator: need at least ${N_CASES} cases, got ${cases.length}`);
    }

    const providers = Array.from(this.registry.values());
    const per_model: PerModelResult[] = [];
    let models_skipped = 0;

    for (const provider of providers) {
      if (!(await provider.is_available())) {
        models_skipped++;
        continue;
      }
      const r = await this.evaluateOneProvider(capability_id, provider, cases, assertResult);
      per_model.push(r);
    }

    const success_rates = per_model.map(r => r.success_rate);
    const mean = success_rates.reduce((s, v) => s + v, 0) / (success_rates.length || 1);
    const variance =
      success_rates.reduce((s, v) => s + (v - mean) ** 2, 0) / (success_rates.length || 1);
    const stddev = Math.sqrt(variance);

    const at = new Date().toISOString();
    const evaluation: MultiModelEvaluation = {
      capability_id,
      per_model,
      cross_model: {
        mean_success_rate: mean,
        stddev_success_rate: stddev,
        agreement_ok: stddev <= STDDEV_THRESHOLD,
        models_evaluated: per_model.length,
        models_skipped,
      },
      at,
      receipt_hash: createHash("sha256")
        .update(`${capability_id}:${at}:${stddev}`)
        .digest("hex")
        .slice(0, 16),
    };

    return evaluation;
  }

  /**
   * Promotion predicate. True iff cross-model agreement holds AND
   * mean success rate clears the empirical floor.
   */
  readyForPromotion(evaluation: MultiModelEvaluation, mean_floor = 0.80): boolean {
    return evaluation.cross_model.agreement_ok &&
      evaluation.cross_model.mean_success_rate >= mean_floor;
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private async evaluateOneProvider(
    capability_id: string,
    provider: ModelProvider,
    cases: Array<{ input: Record<string, unknown>; expected: unknown }>,
    assertResult: (actual: unknown, expected: unknown) => boolean,
  ): Promise<PerModelResult> {
    let successes = 0;
    const latencies: number[] = [];
    let scar_pressure = 0;

    for (const c of cases) {
      const t0 = Date.now();
      try {
        const actual = await provider.invoke(c.input, 30_000);
        const dt = Date.now() - t0;
        latencies.push(dt);
        if (assertResult(actual, c.expected)) successes++;
      } catch {
        scar_pressure++;
      }
    }

    latencies.sort((a, b) => a - b);
    const p = (q: number) => latencies[Math.floor(latencies.length * q)] ?? 0;

    return {
      model_id: provider.model_id,
      calls: cases.length,
      successes,
      success_rate: successes / cases.length,
      latency_p50_ms: p(0.5),
      latency_p95_ms: p(0.95),
      scar_pressure: scar_pressure / cases.length,
      at: new Date().toISOString(),
    };
  }
}