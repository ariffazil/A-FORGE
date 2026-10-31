/**
 * GeneralizationGate.ts — Harness Adaptation Gap gate (G_t).
 *
 * FAILURE CLASS PREVENTED
 *   A harness/skill revision is promoted on dev/feedback traces while held-out
 *   performance stays flat or regresses. Dev gains then overstate the value of
 *   the revision, and cost-cutting revisions stealthily degrade competence.
 *
 * EVIDENCE (not this module's opinion)
 *   arXiv:2610.30499 — "Can LLMs Improve Their Own Harness? A Controlled Study
 *   on ARC-AGI-3" (Lehmann & Vahdati, submitted 21 Oct 2026, 25 pp., 27
 *   lineages). Two autonomous harness revisions moved mean held-out RHAE by
 *   only +2.80 points, 95% interval [-1.44, 7.35] — indistinguishable from
 *   zero — while development gains overstated the improvement and inference
 *   cost reductions came at the expense of task performance.
 *
 * LAW
 *   G_t = ΔJ_dev − ΔJ_test.
 *   A revision is promotable only when the held-out gain is POSITIVE at the
 *   lower confidence bound, pre-registered before adaptation, decontaminated,
 *   and not purchased by a cost cut that erases competence.
 *   "Not obviously negative" is not evidence. The paper's own headline interval
 *   straddles zero; the correct verdict for that result is UNPROVEN, not PASS.
 *
 * CONSUMERS (named, per the no-orphan-registry law)
 *   - forge_skill(tool) with revision_kind="harness_revision"
 *   - src/cli/harnessGapGate.ts — any self-improvement loop or pre-deploy check
 *   - future: EvidencePromotionGate / CapabilityMarket.review(). That tree is
 *     frozen (chattr +i, registered 2026-10-25); merging this dimension there is
 *     an F13 decision, not a unilateral thaw.
 *
 * DOES NOT
 *   - run evaluations (it judges supplied measurements, it never invents them)
 *   - grant authority: promotable=true is a PROPOSAL, not a seal
 *   - replace human/AI judgment about whether a revision is desirable
 *
 * @module governance/GeneralizationGate
 * @constitutional F1 AMANAH · F2 TRUTH · F7 HUMILITY · F12 AUTHORITY
 */

// ── Types ──────────────────────────────────────────────────────────────

export type GeneralizationVerdict =
  | "GENERALIZES"          // held-out gain positive at CI floor, gap bounded
  | "UNPROVEN"             // interval straddles zero, or too few held-out items
  | "OVERFIT"              // dev gain materially exceeds held-out gain
  | "REGRESSION"           // held-out performance was lost
  | "COST_CUT_REGRESSION"  // cheaper, but competence did not improve
  | "UNMEASURED";          // fail-closed: no valid, pre-registered held-out evidence

export interface GeneralizationEvidence {
  /** Per-item task scores on the dev/feedback set BEFORE revision (0–1 or points). */
  dev_scores_before: number[];
  /** Per-item task scores on the dev/feedback set AFTER revision. Same order/items. */
  dev_scores_after: number[];
  /** Per-item scores on the held-out set BEFORE revision. Never used for adaptation. */
  heldout_scores_before: number[];
  /** Per-item scores on the held-out set AFTER revision. Same order/items. */
  heldout_scores_after: number[];
  /** Optional dollar-denominated inference cost per task (C_run). */
  run_cost_before?: number;
  run_cost_after?: number;
  /** Optional dollar-denominated compile/adaptation cost (C_outer). */
  outer_cost_before?: number;
  outer_cost_after?: number;
  /** sha256 of the frozen (thresholds + held-out manifest) commitment, taken BEFORE adaptation. */
  preregistration_sha256?: string;
  /** Where the held-out items live + their sha256 + decontamination receipt. */
  heldout_provenance?: string;
  /** Bootstrap seed. Recorded in the receipt so the interval is reproducible. */
  bootstrap_seed?: number;
}

export interface GeneralizationThresholds {
  /** Max tolerable ΔJ_dev − ΔJ_test before the revision is called overfit. */
  maxGap: number;
  /** Required lower bound of the held-out CI (must exceed this). */
  heldoutCiMin: number;
  /** Held-out regression beyond this magnitude is a capability loss. */
  regressionTolerance: number;
  /** Relative C_run reduction that triggers the cost-cut suspicion check. */
  costCutTolerance: number;
  /** Below this many held-out items the interval is noise. */
  minHeldoutItems: number;
  /** Bootstrap resamples. */
  bootstrapResamples: number;
  /** Confidence level for the held-out interval. */
  ciConfidence: number;
}

export interface CostBlock {
  run_before: number | null;
  run_after: number | null;
  outer_before: number | null;
  outer_after: number | null;
  /** Positive = cheaper after the revision. */
  run_reduction_fraction: number | null;
}

export interface GeneralizationAssessment {
  verdict: GeneralizationVerdict;
  promotable: boolean;
  dev_delta: number | null;
  heldout_delta: number | null;
  gap: number | null;
  heldout_ci: [number, number] | null;
  dev_items: number;
  heldout_items: number;
  ci_confidence: number;
  bootstrap_seed: number;
  resamples: number;
  cost: CostBlock | null;
  reasons: string[];
  thresholds: GeneralizationThresholds;
}

// ── Thresholds ─────────────────────────────────────────────────────────

/**
 * Defaults are POLICY, not measurement. They are env-overridable so the
 * federation can tighten them without a code change (Banda Haram Hardcode).
 */
const DEFAULT_THRESHOLDS: GeneralizationThresholds = {
  maxGap: 0.15,
  heldoutCiMin: 0,
  regressionTolerance: 0.02,
  costCutTolerance: 0.25,
  minHeldoutItems: 10,
  bootstrapResamples: 2000,
  ciConfidence: 0.95,
};

function readEnvFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const v = Number.parseFloat(raw);
  return Number.isFinite(v) ? v : fallback;
}

function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const v = Number.parseInt(raw, 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export function loadDefaultGeneralizationThresholds(): GeneralizationThresholds {
  return {
    maxGap: readEnvFloat("AFORGE_GAP_MAX", DEFAULT_THRESHOLDS.maxGap),
    heldoutCiMin: readEnvFloat("AFORGE_HELDOUT_CI_MIN", DEFAULT_THRESHOLDS.heldoutCiMin),
    regressionTolerance: readEnvFloat("AFORGE_REGRESSION_TOLERANCE", DEFAULT_THRESHOLDS.regressionTolerance),
    costCutTolerance: readEnvFloat("AFORGE_COST_CUT_TOLERANCE", DEFAULT_THRESHOLDS.costCutTolerance),
    minHeldoutItems: readEnvInt("AFORGE_MIN_HELDOUT_ITEMS", DEFAULT_THRESHOLDS.minHeldoutItems),
    bootstrapResamples: readEnvInt("AFORGE_BOOTSTRAP_RESAMPLES", DEFAULT_THRESHOLDS.bootstrapResamples),
    ciConfidence: readEnvFloat("AFORGE_CI_CONFIDENCE", DEFAULT_THRESHOLDS.ciConfidence),
  };
}

// ── Math (deterministic, dependency-free) ──────────────────────────────

const DEFAULT_SEED = 20261025; // paper submission date — stable, documented

function mean(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function pairedDeltas(before: readonly number[], after: readonly number[]): number[] | null {
  if (before.length === 0 || before.length !== after.length) return null;
  const out = new Array<number>(before.length);
  for (let i = 0; i < before.length; i++) out[i] = after[i] - before[i];
  return out;
}

/** mulberry32 — small, seedable PRNG so bootstrap intervals are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function bootstrapMeanCi(
  deltas: readonly number[],
  resamples: number,
  confidence: number,
  seed: number,
): [number, number] {
  const rnd = mulberry32(seed);
  const n = deltas.length;
  const means = new Array<number>(resamples);
  for (let r = 0; r < resamples; r++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += deltas[Math.floor(rnd() * n)];
    means[r] = s / n;
  }
  means.sort((a, b) => a - b);
  const alpha = (1 - confidence) / 2;
  return [percentile(means, alpha), percentile(means, 1 - alpha)];
}

// ── Helpers ────────────────────────────────────────────────────────────

function costBlock(evidence: GeneralizationEvidence): CostBlock | null {
  const runBefore = evidence.run_cost_before ?? null;
  const runAfter = evidence.run_cost_after ?? null;
  const outerBefore = evidence.outer_cost_before ?? null;
  const outerAfter = evidence.outer_cost_after ?? null;
  if (runBefore === null && runAfter === null && outerBefore === null && outerAfter === null) {
    return null;
  }
  const reduction =
    runBefore !== null && runAfter !== null && runBefore > 0
      ? (runBefore - runAfter) / runBefore
      : null;
  return {
    run_before: runBefore,
    run_after: runAfter,
    outer_before: outerBefore,
    outer_after: outerAfter,
    run_reduction_fraction: reduction,
  };
}

function isHex64(s: string | undefined): boolean {
  return typeof s === "string" && /^[a-f0-9]{64}$/i.test(s.trim());
}

/** Build a fail-closed assessment when no usable evidence was supplied. */
export function unmeasuredAssessment(
  reason: string,
  thresholds: GeneralizationThresholds = loadDefaultGeneralizationThresholds(),
  seed: number = DEFAULT_SEED,
): GeneralizationAssessment {
  return {
    verdict: "UNMEASURED",
    promotable: false,
    dev_delta: null,
    heldout_delta: null,
    gap: null,
    heldout_ci: null,
    dev_items: 0,
    heldout_items: 0,
    ci_confidence: thresholds.ciConfidence,
    bootstrap_seed: seed,
    resamples: thresholds.bootstrapResamples,
    cost: null,
    reasons: [reason],
    thresholds,
  };
}

// ── Gate ───────────────────────────────────────────────────────────────

/**
 * Judge a harness revision against held-out evidence.
 *
 * Order of checks (specific diagnostic before general one):
 *   1. UNMEASURED    — arrays missing/unpaired, or no pre-registration/provenance
 *   2. UNPROVEN      — too few held-out items
 *   3. COST_CUT_REGRESSION — materially cheaper AND no held-out gain
 *   4. OVERFIT       — ΔJ_dev − ΔJ_test exceeds maxGap
 *   5. REGRESSION    — held-out capability lost
 *   6. UNPROVEN      — CI lower bound does not clear heldoutCiMin
 *   7. GENERALIZES   — otherwise
 */
export function evaluateGeneralization(
  evidence: GeneralizationEvidence,
  thresholds: GeneralizationThresholds = loadDefaultGeneralizationThresholds(),
): GeneralizationAssessment {
  const seed =
    typeof evidence.bootstrap_seed === "number" && Number.isFinite(evidence.bootstrap_seed)
      ? evidence.bootstrap_seed
      : DEFAULT_SEED;

  const devDeltas = pairedDeltas(evidence.dev_scores_before, evidence.dev_scores_after);
  const heldDeltas = pairedDeltas(evidence.heldout_scores_before, evidence.heldout_scores_after);

  if (!devDeltas) {
    return unmeasuredAssessment(
      "dev scores missing, empty, or unpaired — ΔJ_dev is undefined",
      thresholds,
      seed,
    );
  }
  if (!heldDeltas) {
    return unmeasuredAssessment(
      "held-out scores missing, empty, or unpaired — ΔJ_test is undefined",
      thresholds,
      seed,
    );
  }
  if (!isHex64(evidence.preregistration_sha256)) {
    return unmeasuredAssessment(
      "no pre-registration sha256 (HOLDOUT R7) — the held-out set may have influenced adaptation",
      thresholds,
      seed,
    );
  }
  if (typeof evidence.heldout_provenance !== "string" || evidence.heldout_provenance.trim().length < 8) {
    return unmeasuredAssessment(
      "held-out provenance missing (HOLDOUT R8) — cannot tell which sealed set produced this number",
      thresholds,
      seed,
    );
  }

  const devDelta = mean(devDeltas);
  const heldDelta = mean(heldDeltas);
  const gap = devDelta - heldDelta;
  const cost = costBlock(evidence);
  const reasons: string[] = [];
  const base = {
    dev_delta: devDelta,
    heldout_delta: heldDelta,
    gap,
    dev_items: devDeltas.length,
    heldout_items: heldDeltas.length,
    ci_confidence: thresholds.ciConfidence,
    bootstrap_seed: seed,
    resamples: thresholds.bootstrapResamples,
    cost,
    thresholds,
  };

  if (heldDeltas.length < thresholds.minHeldoutItems) {
    reasons.push(
      `only ${heldDeltas.length} held-out items; minimum is ${thresholds.minHeldoutItems} — interval would be noise`,
    );
    return { ...base, verdict: "UNPROVEN", promotable: false, heldout_ci: null, reasons };
  }

  const ci = bootstrapMeanCi(
    heldDeltas,
    thresholds.bootstrapResamples,
    thresholds.ciConfidence,
    seed,
  );

  if (
    cost &&
    cost.run_reduction_fraction !== null &&
    cost.run_reduction_fraction >= thresholds.costCutTolerance &&
    heldDelta <= 0
  ) {
    reasons.push(
      `inference cost fell ${(cost.run_reduction_fraction * 100).toFixed(1)}% while held-out gain was ${heldDelta.toFixed(4)} — cheaper but not more competent`,
    );
    return { ...base, verdict: "COST_CUT_REGRESSION", promotable: false, heldout_ci: ci, reasons };
  }

  if (gap > thresholds.maxGap) {
    reasons.push(
      `ΔJ_dev ${devDelta.toFixed(4)} exceeds ΔJ_test ${heldDelta.toFixed(4)} by ${gap.toFixed(4)} (> ${thresholds.maxGap}) — dev traces overstate the revision`,
    );
    return { ...base, verdict: "OVERFIT", promotable: false, heldout_ci: ci, reasons };
  }

  if (heldDelta < -thresholds.regressionTolerance) {
    reasons.push(
      `held-out performance fell ${(heldDelta * 100).toFixed(2)} points — the revision lost existing capability`,
    );
    return { ...base, verdict: "REGRESSION", promotable: false, heldout_ci: ci, reasons };
  }

  if (ci[0] <= thresholds.heldoutCiMin) {
    reasons.push(
      `held-out ${(thresholds.ciConfidence * 100).toFixed(0)}% interval [${ci[0].toFixed(4)}, ${ci[1].toFixed(4)}] includes the floor ${thresholds.heldoutCiMin} — indistinguishable from no improvement`,
    );
    return { ...base, verdict: "UNPROVEN", promotable: false, heldout_ci: ci, reasons };
  }

  reasons.push(
    `held-out ${(thresholds.ciConfidence * 100).toFixed(0)}% interval [${ci[0].toFixed(4)}, ${ci[1].toFixed(4)}] clears ${thresholds.heldoutCiMin}; gap ${gap.toFixed(4)} within ${thresholds.maxGap}`,
  );
  return { ...base, verdict: "GENERALIZES", promotable: true, heldout_ci: ci, reasons };
}
