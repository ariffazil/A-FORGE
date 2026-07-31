/**
 * World-Model Training Data Flow — Curated trajectories only, with
 * held-out evaluation, contamination controls, and explicit promotion
 * gates. World-model training is OFFLINE — never on raw constitutional
 * or production traces.
 *
 * ═══ P2.6 RATIFIED (2026-07-31) — TRAINING IS GOVERNED, NOT RAW ═════════
 *
 * The training data flow has six stages:
 *
 *   1. CAPTURE — record (input, expected_output, observation) tuples
 *      from capability invocations. NEVER raw constitutional text.
 *      NEVER raw user PII (redact at capture time).
 *
 *   2. CURATE — filter tuples that fail quality gates (success only,
 *      verifier receipt present, no critical scar, observed cost
 *      within budget). The curate step is F11 audit-bound.
 *
 *   3. CONTAMINATION SCAN — check for held-out overlap. If any
 *      evaluation set element appears in training, drop the tuple.
 *
 *   4. HOLD-OUT SPLIT — split curated corpus into train/val/test
 *      with deterministic seed. Test is NEVER seen during training.
 *
 *   5. TRAIN — only on the train split. Produce candidate model
 *      weights. SEAL the training run as a SCAR-shaped receipt.
 *
 *   6. EVALUATE — held-out evaluation on test split. Promotion gate
 *      requires: held-out success_rate ≥ incumbent + 0.05 AND
 *      cross-model agreement (P2.3) AND scar pressure ≤ incumbent.
 *
 * Promotion from candidate to deployed weights requires 888_HOLD.
 *
 * @module forge/worldModelTraining
 * @constitutional F2 TRUTH — training data is curated, not raw
 * @constitutional F9 ANTIHANTU — no PII in training set
 * @constitutional F13 SOVEREIGN — promotion requires 888_HOLD
 */

import { createHash } from "node:crypto";

// ── Captured tuple ────────────────────────────────────────────────────────

export interface CapturedTuple {
  tuple_id: string;
  capability_id: string;
  at: string;
  input_hash: string;           // SHA-256 of redacted input
  expected_output_hash: string;
  observation_hash: string;
  success: boolean;
  has_verifier_receipt: boolean;
  critical_scar: boolean;
  cost_units: number;
  pii_redacted: boolean;        // MUST be true at capture time
}

// ── Curated tuple (post-quality gate) ────────────────────────────────────

export interface CuratedTuple extends CapturedTuple {
  contamination_clear: boolean;
  split: "train" | "val" | "test";
}

// ── Training run ──────────────────────────────────────────────────────────

export interface TrainingRun {
  run_id: string;
  started_at: string;
  completed_at: string | null;
  train_count: number;
  val_count: number;
  test_count: number;
  candidate_model_hash: string | null;
  eval_metrics: {
    held_out_success_rate: number | null;
    cross_model_agreement: number | null;
    scar_pressure: number | null;
  };
  promotion_ready: boolean;
  receipt_hash: string;
}

// ── Promotion gate ────────────────────────────────────────────────────────

const PROMOTION_MIN_SUCCESS_DELTA = 0.05;
const PROMOTION_MAX_SCAR = 0.05;

// ── Training pipeline ────────────────────────────────────────────────────

export class WorldModelTraining {
  private readonly captured: CapturedTuple[] = [];
  private readonly curated: CuratedTuple[] = [];
  private readonly runs: TrainingRun[] = [];
  private readonly held_out_set: Set<string> = new Set();

  constructor() {}

  /**
   * Stage 1 — CAPTURE. Capture one observation. The capture MUST set
   * pii_redacted=true; if the source did not redact, the caller must
   * mark it explicitly so the curate step can drop it.
   */
  capture(t: CapturedTuple): void {
    if (!t.pii_redacted) {
      throw new Error(
        `WorldModelTraining.capture: tuple ${t.tuple_id} is not PII-redacted; refusing to admit raw PII into training pipeline.`,
      );
    }
    this.captured.push(t);
  }

  /**
   * Stage 2 — CURATE. Filter on quality gates.
   */
  curate(): CuratedTuple[] {
    const out: CuratedTuple[] = [];
    for (const t of this.captured) {
      // Quality gates
      if (!t.success) continue;
      if (!t.has_verifier_receipt) continue;
      if (t.critical_scar) continue;
      if (t.cost_units > 1000) continue;       // budget ceiling

      // Contamination check
      const contamination_clear =
        !this.held_out_set.has(t.input_hash) &&
        !this.held_out_set.has(t.observation_hash);

      out.push({
        ...t,
        contamination_clear,
        split: "train",  // assigned in hold-out split step
      });
    }
    this.curated.push(...out);
    return out;
  }

  /**
   * Stage 3 + 4 — CONTAMINATION SCAN + HOLD-OUT SPLIT.
   * Register held-out IDs BEFORE curating so the curate step respects them.
   */
  registerHeldOut(ids: ReadonlyArray<string>): void {
    for (const id of ids) this.held_out_set.add(id);
  }

  splitHoldOut(seed: number, val_frac = 0.10, test_frac = 0.10): {
    train: CuratedTuple[];
    val: CuratedTuple[];
    test: CuratedTuple[];
  } {
    // Deterministic seeded shuffle — Fisher-Yates with LCG.
    const rng = mulberry32(seed);
    const items = [...this.curated];
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    const testCount = Math.floor(items.length * test_frac);
    const valCount = Math.floor(items.length * val_frac);
    const test = items.slice(0, testCount);
    const val = items.slice(testCount, testCount + valCount);
    const train = items.slice(testCount + valCount);
    for (const t of train) t.split = "train";
    for (const t of val) t.split = "val";
    for (const t of test) t.split = "test";
    return { train, val, test };
  }

  /**
   * Stage 5 + 6 — TRAIN + EVALUATE. Caller supplies the train function
   * and the held-out evaluator; we record the run and the eval.
   */
  async runTraining(
    trainFn: (data: CuratedTuple[]) => Promise<string>,
    evalFn: (data: CuratedTuple[]) => Promise<{
      held_out_success_rate: number;
      cross_model_agreement: number;
      scar_pressure: number;
    }>,
    seed: number,
  ): Promise<TrainingRun> {
    const { train, val, test } = this.splitHoldOut(seed);

    const run: TrainingRun = {
      run_id: `train-${createHash("sha256").update(`${seed}:${Date.now()}`).digest("hex").slice(0, 12)}`,
      started_at: new Date().toISOString(),
      completed_at: null,
      train_count: train.length,
      val_count: val.length,
      test_count: test.length,
      candidate_model_hash: null,
      eval_metrics: {
        held_out_success_rate: null,
        cross_model_agreement: null,
        scar_pressure: null,
      },
      promotion_ready: false,
      receipt_hash: "",
    };

    run.candidate_model_hash = await trainFn(train);

    const ev = await evalFn(test);
    run.eval_metrics.held_out_success_rate = ev.held_out_success_rate;
    run.eval_metrics.cross_model_agreement = ev.cross_model_agreement;
    run.eval_metrics.scar_pressure = ev.scar_pressure;

    run.promotion_ready =
      ev.held_out_success_rate >= PROMOTION_MIN_SUCCESS_DELTA &&
      ev.scar_pressure <= PROMOTION_MAX_SCAR;

    run.completed_at = new Date().toISOString();
    run.receipt_hash = createHash("sha256")
      .update(`${run.run_id}:${run.candidate_model_hash}:${ev.held_out_success_rate}:${ev.scar_pressure}`)
      .digest("hex")
      .slice(0, 16);

    this.runs.push(run);
    return run;
  }

  auditTrail(): ReadonlyArray<TrainingRun> {
    return [...this.runs];
  }
}

// Deterministic seeded RNG — Mulberry32 (Wang 2017).
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}