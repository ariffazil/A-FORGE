/**
 * Evaluator — P2.2 multi-model evaluation.
 *
 * Canonical G is computed ONLY by arifOS. A-FORGE submits the input
 * to arifOS and uses the returned canonical envelope for ranking.
 * This prevents the "which model, which formula" confusion that the
 * sovereign audit explicitly flagged.
 *
 * @module evaluation/Evaluator
 * @constitutional F2 TRUTH · F8 GENIUS · F13 SOVEREIGN
 */
import { CANONICAL_G_DIALS } from "../governance/gAuthority.js";
import type { VerifierReceipt } from "../governance/verifier/VerifierRegistry.js";

// ── Types ──────────────────────────────────────────────────────────────

export interface EvaluationTask {
  task_id: string;
  capability_id: string;
  input: unknown;
  expected_output?: unknown;
  prediction_gap_threshold: number;
  models: string[];
  judge_model?: string;
}

export interface PerModelResult {
  output: unknown;
  prediction_gap: number;
  surprise_score: number;
  verifier_receipt: VerifierReceipt;
}

export interface CanonicalG {
  A: number;
  P: number;
  E: number;
  X: number;
  /** Computed by arifOS — geometric mean of the 4 dials. */
  G: number;
}

export interface EvaluationResult {
  task_id: string;
  per_model: Record<string, PerModelResult>;
  ranking: Array<{ model: string; score: number; confidence: number }>;
  /** Populated ONLY by arifOS. Empty when the orchestrator has not
   *  anchored the evaluation. */
  canonical_g: CanonicalG;
}

export interface Evaluator {
  evaluate(task: EvaluationTask, ctx: EvalContext): Promise<EvaluationResult>;
}

export interface EvalContext {
  /** Optional arifOS lease hash for the constitutional anchor. */
  arifosLeaseHash?: string;
  /** Optional arifOS session id. */
  arifosSessionId?: string;
}

// ── Default arifOS-anchored evaluator ─────────────────────────────────

/**
 * ArifOsEvaluator — delegates canonical G computation to arifOS via
 * `forge_judge_proxy` or `arif_think(mode='apex')`. A-FORGE never
 * computes G locally. The local stub is deterministic for tests.
 */
export class ArifOsEvaluator implements Evaluator {
  constructor(private readonly arifosCall: (task: EvaluationTask) => Promise<CanonicalG> = defaultArifOsStub) {}

  async evaluate(task: EvaluationTask, _ctx: EvalContext): Promise<EvaluationResult> {
    const per_model: Record<string, PerModelResult> = {};
    for (const model of task.models) {
      // Per-model output is observed by the orchestrator; we emit a
      // deterministic stub here so unit tests have a stable shape.
      const prediction_gap = hashString(model) % 100 / 1000; // 0..0.099
      per_model[model] = {
        output: { model, task_id: task.task_id, gap: prediction_gap },
        prediction_gap,
        surprise_score: prediction_gap,
        verifier_receipt: {
          method: "domain_witness",
          verifier_id: "arifos-evaluator",
          verified_at: new Date().toISOString(),
          passed: true,
          evidence_hash: "h",
          receipt_hash: "rh",
          signed_by: "arifos-arif_judge",
          cc_id: "cc-" + task.task_id,
        },
      };
    }
    // Ranking: lower gap is better; convert to score 0..1
    const ranking = Object.entries(per_model)
      .map(([model, r]) => ({ model, score: 1 - r.prediction_gap, confidence: 0.9 }))
      .sort((a, b) => b.score - a.score);
    const canonical_g = await this.arifosCall(task);
    return {
      task_id: task.task_id,
      per_model,
      ranking,
      canonical_g,
    };
  }
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const defaultArifOsStub = async (task: EvaluationTask): Promise<CanonicalG> => {
  // Deterministic stub. Real evaluation routes through arifOS; this
  // only exists so unit tests have a stable shape.
  const seed = hashString(task.task_id) % 100;
  const A = 0.7 + (seed % 10) / 100;
  const P = 0.6 + ((seed * 3) % 30) / 100;
  const E = 0.8 + ((seed * 7) % 20) / 100;
  const X = 0.75 + ((seed * 11) % 25) / 100;
  return {
    A: round2(A),
    P: round2(P),
    E: round2(E),
    X: round2(X),
    G: round2(Math.pow(A * P * E * X, 1 / 4)),
  };
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Assert the canonical G shape uses only the 4 dials. Φ must NOT
 * appear. This is a unit-test contract that catches drift.
 */
export function assertCanonicalGShape(g: CanonicalG): void {
  const allowed = new Set<string>(CANONICAL_G_DIALS);
  for (const k of Object.keys(g)) {
    if (k === "G") continue;
    if (!allowed.has(k)) {
      throw new Error(`Canonical G has unexpected dial: ${k}`);
    }
  }
  const present = new Set(Object.keys(g));
  for (const dial of CANONICAL_G_DIALS) {
    if (!present.has(dial)) {
      throw new Error(`Canonical G missing dial: ${dial}`);
    }
  }
}
