/**
 * domain/web/federation.ts — WEBO-Ω v0.1 Web Exploration Federation kernel
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Math + physics layer for the A-FORGE web exploration plane.
 * Design doc: docs/WEBO-OMEGA-web-exploration-federation.md
 *
 * Contents:
 *   1. Ω12 Hysteresis — persistent circuit-breaker state (non-volatile hysteron)
 *   2. G_fed — Nash bargaining product over (A, P, E, X)  [canon G construction,
 *      APEX_MATH_CANON.md; A1–A8 axioms preserved — dials re-bound, aggregator sealed]
 *   3. C_dark — exploration dark debt  [COINED, EMD-style thresholds]
 *   4. V_web — QG-style health vector with fail-closed geometric rank [canon rank]
 *   5. timeToFrontier — Black–Cox moving-barrier first passage [canon math,
 *      new domain binding; returns UNMEASURED until calibrated]
 *
 * F2 honesty: only G's aggregator and Rank are canon; dials and equations are
 * declared bindings (see doc §6). INV-6 honored: never present these as the
 * constitutional G — forge_evaluate remains sole owner of that.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ── Types ────────────────────────────────────────────────────────────────────

export type WebIntent = "discovery" | "verification" | "extraction" | "research";

export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  openUntil: number;
}

export interface ProviderRuntime {
  circuit: CircuitBreakerState;
  lastSuccessAt: number;
  successCount: number;
  failureCount: number;
}

export interface FederationSnapshot {
  providers: Record<string, ProviderRuntime>;
  /** LFD preference state (method: LFD 2610.17246 port) */
  lfd?: Record<string, ProviderStats>;
  updatedAt: string;
  restartCount: number;
}

export interface MetricsWindow {
  calls: number;
  successes: number;
  empties: number;
  failures: number;
  receipts: number;
}

export interface GFedDials {
  /** lane availability |{p: a_p=1}| / |P| */
  A: number;
  /** provenance integrity receipts/calls (≈1 by construction) */
  P: number;
  /** evidence yield successes/calls */
  E: number;
  /** provider independence 1 − max pairwise Jaccard overlap */
  X: number;
}

export type HealthVerdict = "HEALTHY" | "DEGRADED" | "AVOID_AUTONOMY";

export interface GFedResult {
  value: number;
  dials: GFedDials;
  verdict: HealthVerdict;
  is_canonical_g: false; // INV-6: this is NOT forge_evaluate's constitutional G
}

export interface CDarkResult {
  value: number;
  verdict: "PROCEED" | "CAUTION" | "HOLD" | "VOID_EXPLORATION";
}

export interface FrontierInput {
  uncertaintyNow: number; // V > 0
  uncertaintyTarget: number; // B ∈ (0, V)
  discoveryRate: number; // μ ≥ 0
  decayRate: number; // λ ≥ 0 (should include governance floor)
}

export type FrontierResult =
  | { status: "MEASURED"; T: number; survival: boolean }
  | { status: "UNMEASURED"; reason: string };

// ── 1. Ω12 Hysteresis — persistent hysteron ─────────────────────────────────
// Elementary relay: open at CONSECUTIVE_FAILURE_THRESHOLD failures, half-open
// after COOLDOWN_MS. Persisted to disk so restarts do NOT forget provider
// failures (the pre-WEBO defect: volatile circuit state).

export const CONSECUTIVE_FAILURE_THRESHOLD = 3;
export const COOLDOWN_MS = 60_000;

export class Hysteron {
  private state: Record<string, ProviderRuntime> = {};
  private lfd: Record<string, ProviderStats> = {};
  private readonly filePath: string;
  private restartCount = 0;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.load();
  }

  private load(): void {
    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as FederationSnapshot;
      this.state = parsed.providers ?? {};
      this.lfd = parsed.lfd ?? {};
      this.restartCount = (parsed.restartCount ?? 0) + 1;
    } catch {
      // First boot or unreadable — start clean, count the boot.
      this.state = {};
      this.lfd = {};
      this.restartCount = 1;
    }
  }

  /** Atomic persist: write tmp then rename (crash-safe). */
  persist(): void {
    const snapshot: FederationSnapshot = {
      providers: this.state,
      lfd: this.lfd,
      updatedAt: new Date().toISOString(),
      restartCount: this.restartCount,
    };
    const tmp = `${this.filePath}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), "utf8");
      fs.renameSync(tmp, this.filePath);
    } catch {
      // Persistence is best-effort; never break search for a disk error.
    }
  }

  private ensure(provider: string): ProviderRuntime {
    if (!this.state[provider]) {
      this.state[provider] = {
        circuit: { failures: 0, lastFailure: 0, openUntil: 0 },
        lastSuccessAt: 0,
        successCount: 0,
        failureCount: 0,
      };
    }
    return this.state[provider];
  }

  /** Ω12 gate: is the provider currently skipped? Half-open admits one try. */
  isOpen(provider: string, now = Date.now()): boolean {
    const rt = this.state[provider];
    if (!rt) return false;
    const c = rt.circuit;
    if (c.failures < CONSECUTIVE_FAILURE_THRESHOLD) return false;
    if (now < c.openUntil) return true;
    // Cooldown expired — half-open: allow exactly one trial.
    c.failures = CONSECUTIVE_FAILURE_THRESHOLD - 1;
    return false;
  }

  recordSuccess(provider: string): void {
    const rt = this.ensure(provider);
    rt.circuit = { failures: 0, lastFailure: 0, openUntil: 0 };
    rt.lastSuccessAt = Date.now();
    rt.successCount += 1;
    this.persist();
  }

  recordFailure(provider: string): void {
    const rt = this.ensure(provider);
    const failures = rt.circuit.failures + 1;
    rt.circuit = {
      failures,
      lastFailure: Date.now(),
      openUntil:
        failures >= CONSECUTIVE_FAILURE_THRESHOLD ? Date.now() + COOLDOWN_MS : 0,
    };
    rt.failureCount += 1;
    this.persist();
  }

  /** Ω08 field: availability vector + dead-lane ratio. */
  field(providers: string[]): { availability: number[]; deadLaneRatio: number; alive: number } {
    const availability = providers.map((p) => {
      const rt = this.state[p];
      if (!rt) return 1; // untested = assumed up (probe-before-panic: don't declare dead)
      return rt.failureCount > 0 && rt.successCount === 0 ? 0 : this.isOpen(p) ? 0 : 1;
    });
    const alive = availability.filter((a) => a === 1).length;
    return { availability, deadLaneRatio: 1 - alive / Math.max(1, providers.length), alive };
  }

  stats(provider: string): ProviderRuntime | undefined {
    return this.state[provider];
  }

  // ── LFD preference ledger (persistent, shared state file) ────────────────

  lfdGet(provider: string): ProviderStats | undefined {
    return this.lfd[provider];
  }

  /** Record one outcome as a preference step (winner=1/loser=0) + persist. */
  lfdRecord(provider: string, d: Difficulty, outcome: 1 | 0): ProviderStats {
    if (!this.lfd[provider]) this.lfd[provider] = DEFAULT_STATS();
    const updated = preferenceUpdate(this.lfd[provider], d, outcome);
    this.lfd[provider] = updated;
    this.persist();
    return updated;
  }

  restarts(): number {
    return this.restartCount;
  }
}

// ── 2. G_fed — Nash bargaining product [canon aggregator, new dials] ─────────

export function computeGFed(dials: GFedDials): GFedResult {
  const values = [dials.A, dials.P, dials.E, dials.X];
  // Axiom A1 — Nash collapse: any dial ≤ EPSILON → 0.
  const EPSILON = 1e-6;
  let value = 0;
  if (values.every((d) => d > EPSILON)) {
    value = Math.pow(dials.A * dials.P * dials.E * dials.X, 1 / 4);
  }
  const verdict: HealthVerdict = value >= 0.8 ? "HEALTHY" : value >= 0.5 ? "DEGRADED" : "AVOID_AUTONOMY";
  return { value, dials: { ...dials }, verdict, is_canonical_g: false };
}

/** Independence dial: 1 − max pairwise Jaccard overlap of result-URL sets. */
export function independenceFromResults(resultSets: string[][]): number {
  if (resultSets.length < 2) return 1;
  let maxOverlap = 0;
  for (let i = 0; i < resultSets.length; i++) {
    for (let j = i + 1; j < resultSets.length; j++) {
      const a = new Set(resultSets[i]);
      const b = new Set(resultSets[j]);
      const intersection = [...a].filter((u) => b.has(u)).length;
      const union = new Set([...a, ...b]).size;
      const jaccard = union === 0 ? 0 : intersection / union;
      if (jaccard > maxOverlap) maxOverlap = jaccard;
    }
  }
  return 1 - maxOverlap;
}

// ── 3. C_dark — exploration dark debt [COINED] ──────────────────────────────

export function computeCDark(w: MetricsWindow & { deadLaneRatio: number; staleRatio: number }): CDarkResult {
  const total = Math.max(1, w.calls);
  const emptyRate = w.empties / total;
  const value = Math.min(1, 0.4 * emptyRate + 0.3 * w.deadLaneRatio + 0.3 * w.staleRatio);
  const verdict: CDarkResult["verdict"] =
    value >= 0.5 ? "VOID_EXPLORATION" : value >= 0.3 ? "HOLD" : value >= 0.15 ? "CAUTION" : "PROCEED";
  return { value, verdict };
}

// ── 4. V_web — QG-style vector with fail-closed rank [canon rank formula] ────

export interface VWeb {
  gFed: number;
  cDark: number;
  /** ΔS = −I + ε; positive = disorder increasing (F4 violation direction) */
  deltaS: number;
  /** FQ_exp = verify/execute on the search family */
  fqExp: number;
  /** freshness degradation multiplier in (0,1] */
  hEff: number;
  /** novelty signal Ω₀ */
  omega0: number;
}

/** h_eff = h · 2^(−τ/τ½) — canonical freshness decay from QG spec. */
export function freshnessDecay(h: number, tauCycles: number, halfLifeCycles: number): number {
  return h * Math.pow(2, -tauCycles / halfLifeCycles);
}

/** Rank = (∏ hᵢ^wᵢ)^(1/Σwᵢ) — weighted geometric mean, fail-closed (INV-5). */
export function vectorRank(hs: number[], weights?: number[]): number {
  const w = weights ?? hs.map(() => 1);
  const sumW = w.reduce((a, b) => a + b, 0);
  if (sumW <= 0) return 0;
  if (hs.some((h) => h <= 0)) return 0; // fail-closed
  const logSum = hs.reduce((acc, h, i) => acc + w[i] * Math.log(h), 0);
  return Math.exp(logSum / sumW);
}

/** FQ band per QG spec: triangular, peak 1.0. */
export function fqBand(fq: number): number {
  if (fq < 0.1) return fq / 0.1 * 0.2; // BURNING
  if (fq < 0.5) return 0.2 + (fq - 0.1) / 0.4 * 0.6; // STUCK → rising
  if (fq <= 2.0) return 0.8 + (1 - Math.abs(fq - 1) / 1) * 0.2; // HEALTHY peak 1.0
  return Math.max(0, 1 - (fq - 2) / 3); // OVER-CHECK → decays
}

// ── 5. timeToFrontier — Black–Cox first passage [canon math, new binding] ───
//
// Canon T-SCORE (barrier-growth form): T = ln(V/B)/(λ−μ), survival ⇔ μ > λ.
// Exploration binding flips the roles: uncertainty DECAYS toward target B at net
// rate ν = μ − λ (discovery yield minus noise/regrowth). First passage of a
// geometric decay process: T = ln(V/B)/ν, survival ⇔ ν > 0 ⇔ μ > λ.
// Same first-passage identity; sign convention declared (doc §3.4).

export function timeToFrontier(input: FrontierInput): FrontierResult {
  const { uncertaintyNow: V, uncertaintyTarget: B, discoveryRate: mu, decayRate: lambda } = input;
  if (!(V > 0) || !(B > 0) || B >= V) {
    return { status: "UNMEASURED", reason: "require 0 < B < V" };
  }
  const nu = mu - lambda;
  if (nu <= 0) {
    // No survival: uncertainty never reaches the frontier → STAGNATION.
    return { status: "MEASURED", T: Infinity, survival: false };
  }
  const T = Math.log(V / B) / nu;
  return { status: "MEASURED", T, survival: true };
}

// ── Intent classifier (kills hardcoded "discovery" — F3) ────────────────────

export function classifyIntent(source: string, toolHint?: string): WebIntent {
  if (source === "research") return "research";
  if (toolHint === "fetch" || toolHint === "extract") return "extraction";
  if (toolHint === "verify" || source === "verify") return "verification";
  return "discovery";
}

// ── 6. LFD kernel — capability-conditioned curriculum + preference weights ──
// Methodology ported from "LLM-to-Flow Distillation" (arxiv 2610.17246):
//   LFD: LLM generates progressively harder sub-goals matched to what the
//   generator can currently produce, then preference-trains it (DPO) instead
//   of optimizing a scalar reward function (unreliable in discovery settings).
//   Ours: the router assigns query difficulty classes matched to what each
//   provider has DEMONSTRATED it can handle, and updates routing weights from
//   outcome preference pairs (win/lose) via multiplicative weights — the
//   discrete DPO-analog. No scalar reward to Goodhart; the order self-corrects
//   from live evidence (dead lanes fall, healthy lanes rise) — fallback order
//   becomes EMERGENT, not hardcoded. [COINED binding, method = LFD]

export type Difficulty = "easy" | "medium" | "hard";

/** Query difficulty classes (the sub-goal ladder). */
export function classifyDifficulty(query: string): Difficulty {
  const q = query.trim();
  const words = q.split(/\s+/).length;
  const operators = (q.match(/site:|lang:|after:|before:|-"|"/g) ?? []).length;
  if (operators >= 2 || words > 12) return "hard";
  if (operators >= 1 || words > 5) return "medium";
  return "easy";
}

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];

export interface ProviderStats {
  /** multiplicative weight per difficulty class (routing prior × learned) */
  weights: Record<Difficulty, number>;
  /** successes per class (curriculum evidence) */
  wins: Record<Difficulty, number>;
  losses: Record<Difficulty, number>;
}

const DEFAULT_STATS = (): ProviderStats => ({
  weights: { easy: 1, medium: 1, hard: 1 },
  wins: { easy: 0, medium: 0, hard: 0 },
  losses: { easy: 0, medium: 0, hard: 0 },
});

/** Curriculum gate: a provider is eligible for class c only after K wins in c-1. */
export const CURRICULUM_K = 3;

export function isEligible(stats: ProviderStats, d: Difficulty): boolean {
  const idx = DIFFICULTY_ORDER.indexOf(d);
  if (idx <= 0) return true;
  return stats.wins[DIFFICULTY_ORDER[idx - 1]] >= CURRICULUM_K;
}

/**
 * Preference update (DPO-analog): winner gains, losers decay — multiplicative
 * weights with clipping. eta = learning rate; outcome ∈ {1 win, 0 loss}.
 */
export function preferenceUpdate(
  stats: ProviderStats,
  d: Difficulty,
  outcome: 1 | 0,
  eta = 0.2,
): ProviderStats {
  const w = stats.weights[d];
  const next = outcome === 1 ? w * Math.exp(eta) : w * Math.exp(-eta);
  stats.weights[d] = Math.min(3.0, Math.max(0.1, next));
  if (outcome === 1) stats.wins[d] += 1;
  else stats.losses[d] += 1;
  return stats;
}

/**
 * LFD routing score: static capability prior × learned weight, curriculum-gated.
 * Providers not yet eligible for class d are not proposed for it (sub-goal
 * matched to demonstrated capability — the LFD core).
 */
export function curriculumScore(
  capPrior: number,
  stats: ProviderStats | undefined,
  d: Difficulty,
): number {
  const s = stats ?? DEFAULT_STATS();
  if (!isEligible(s, d)) return 0;
  return capPrior * s.weights[d];
}

export { DEFAULT_STATS };
