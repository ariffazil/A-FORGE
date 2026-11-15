/**
 * Reality Loop — Engine (state ledger)
 *
 * State-tracking ledger for the 7-stage intent loop
 * (MEANING → OBSERVE → ENCODE → IMPROVE → VERIFY → SEAL → RETURN).
 * The agent orchestrates stages; the engine remembers state, evidence,
 * hypotheses, actions, entropy, scars.
 *
 * The loop does NOT decide. The loop PRESENTS at STAGE 6 (RETURN)
 * and waits for human judgment. No autonomous self-modification.
 *
 * @module reality-loop/engine
 * @constitutional F1-F13 — all floors enforced at every stage
 * @constitutional F4 CLARITY — each iteration must reduce entropy
 */

import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  REALITY_STAGES,
  STAGE_PROMPT_MAP,
  type RealityStage,
  type RealityLoopState,
  type RealityLoopConfig,
  type ThresholdValidation,
  type Hypothesis,
  type QuantumAxes,
  type QuantumEvaluation,
  type EvidenceEntry,
  type ActionRecord,
  type EntropyEntry,
  type ModificationRecord,
  type ScarRecord,
  type FloorViolation,
  DEFAULT_CONFIG,
} from "./types.js";

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_ACTIVE_LOOPS = 50;
const LOOP_TTL_MS = 24 * 60 * 60 * 1000; // 24h auto-expiry
const VALID_EVIDENCE_LABELS = ["OBS", "DER", "INT", "SPEC"] as const;
const MAX_CONFIDENCE = 0.9; // F7 HUMILITY cap
const VAULT_BASE = "/root/VAULT999/reality-loop";

// ── State Management ────────────────────────────────────────────────────────

const activeLoops = new Map<string, RealityLoopState>();
const loopTimestamps = new Map<string, number>(); // session_id → last_activity_ms

// Periodic GC — evict stale loops every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of loopTimestamps) {
    if (now - ts > LOOP_TTL_MS) {
      activeLoops.delete(id);
      loopTimestamps.delete(id);
    }
  }
}, 10 * 60 * 1000).unref();

function touchLoop(session_id: string): void {
  loopTimestamps.set(session_id, Date.now());
}

/**
 * Validate a single threshold against engine acceptance rules.
 *
 *   - undefined / null               → use default, status="ok" (caller
 *                                       intentionally did not set this)
 *   - finite number in [0, 1]        → use as-is, status="ok"
 *   - finite number outside [0, 1]  → clamp to boundary, status="clamped"
 *   - anything not a finite number   → use default, status="invalid_default_used"
 *
 * PHASE 1 HEURISTIC: the default 0.70 values are NOT calibrated on
 * held-out SEAL/REJECT data. Calibrate via ROC before promoting
 * them to enforceable gates. Calibration is a separate concern.
 */
export function normalizeThreshold(
  raw: unknown,
  defaultValue: number,
  fieldName: string,
): ThresholdValidation {
  if (raw === undefined || raw === null) {
    return {
      status: "ok",
      effective_value: defaultValue,
      requested_value: null,
      reason: `${fieldName}: not provided; using default ${defaultValue}`,
    };
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return {
      status: "invalid_default_used",
      effective_value: defaultValue,
      requested_value: null,
      reason: `${fieldName}: not a finite number; using default ${defaultValue}`,
    };
  }
  if (raw < 0 || raw > 1) {
    const clamped = raw < 0 ? 0 : 1;
    return {
      status: "clamped",
      effective_value: clamped,
      requested_value: raw,
      reason: `${fieldName}: ${raw} outside [0, 1]; clamped to ${clamped}`,
    };
  }
  return {
    status: "ok",
    effective_value: raw,
    requested_value: raw,
    reason: null,
  };
}

export function createLoop(
  session_id: string,
  config?: Partial<RealityLoopConfig>,
): RealityLoopState {
  // Evict oldest if at capacity
  if (activeLoops.size >= MAX_ACTIVE_LOOPS) {
    const oldest = Array.from(loopTimestamps.entries())
      .sort(([, a], [, b]) => a - b)[0];
    if (oldest) {
      activeLoops.delete(oldest[0]);
      loopTimestamps.delete(oldest[0]);
    }
  }

  // Wire the prompt-side thresholds into the engine surface. This
  // closes the schema-to-runtime gap: a config override now changes
  // what the engine enforces at STAGE 2/4 gates, not just a label
  // the prompt reads.
  const cfgRecord = (config ?? {}) as Record<string, unknown>;
  const rawG = cfgRecord.min_g_score;
  const rawW = cfgRecord.min_witness;
  const rawA = cfgRecord.axis_floor;
  const minG = normalizeThreshold(rawG, DEFAULT_CONFIG.min_g_score, "min_g_score");
  const minW = normalizeThreshold(rawW, DEFAULT_CONFIG.min_witness, "min_witness");
  const minA = normalizeThreshold(rawA, DEFAULT_CONFIG.axis_floor, "axis_floor");

  const cfg = {
    ...DEFAULT_CONFIG,
    ...config,
    min_g_score: minG.effective_value,
    min_witness: minW.effective_value,
    axis_floor: minA.effective_value,
  };

  const state: RealityLoopState = {
    iteration: 0,
    current_stage: "OBSERVE",
    session_id,
    started_at: new Date().toISOString(),
    evidence_base: [],
    active_hypotheses: [],
    last_quantum_evaluation: null,
    last_action: null,
    entropy_history: [],
    self_modifications: [],
    scars: [],
    floor_violations: [],
    system_health: {},
    // Anti-sink initial state
    reality_contacts: [],
    idle_streak: 0,
    last_external_contact_at: null,
    roles: { proposer_id: "", critic_id: "", verifier_id: "", role_history: [] },
    champion_id: null,
    challenger_id: null,
    last_promotion_eval: null,
    retired: false,
    retirement_reason: null,
    // Threshold gate config (PHASE 1 HEURISTIC, calibration pending)
    effective_config: cfg,
    threshold_validation: {
      min_g_score: minG,
      min_witness: minW,
      axis_floor: minA,
    },
  };
  activeLoops.set(session_id, state);
  touchLoop(session_id);
  return state;
}

export function getLoop(session_id: string): RealityLoopState | undefined {
  touchLoop(session_id);
  return activeLoops.get(session_id);
}

export function destroyLoop(session_id: string): boolean {
  loopTimestamps.delete(session_id);
  return activeLoops.delete(session_id);
}

export function listActiveLoops(): Array<{
  session_id: string;
  iteration: number;
  current_stage: RealityStage;
  started_at: string;
}> {
  // Prune expired before listing
  const now = Date.now();
  for (const [id, ts] of loopTimestamps) {
    if (now - ts > LOOP_TTL_MS) {
      activeLoops.delete(id);
      loopTimestamps.delete(id);
    }
  }
  return Array.from(activeLoops.entries()).map(([id, s]) => ({
    session_id: id,
    iteration: s.iteration,
    current_stage: s.current_stage,
    started_at: s.started_at,
  }));
}

// ── Stage Transitions ───────────────────────────────────────────────────────

/**
 * Canonical 7-stage order matching the skill's operator interface.
 * RECURSE folded into VERIFY; MEANING and RETURN bookend the loop.
 * RETURN is terminal — forge_reality_loop mode="advance" stops there.
 * Human must call destroy or re-start to break the terminal.
 */
const STAGE_ORDER: RealityStage[] = [
  "MEANING",
  "OBSERVE",
  "ENCODE",
  "IMPROVE",
  "VERIFY",
  "SEAL",
  "RETURN",
];

export function nextStage(current: RealityStage): RealityStage {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return "OBSERVE"; // loop back after RETURN
  return STAGE_ORDER[idx + 1];
}

export function advanceStage(state: RealityLoopState): RealityStage {
  const next = nextStage(state.current_stage);
  state.current_stage = next;
  // If we just completed SEAL, increment iteration and land on RETURN
  if (next === "RETURN") {
    state.iteration++;
    // Telemetry provenance fix (2026-11-15): a closed iteration must not leak
    // its collapse evaluation into the next cycle.
    state.last_quantum_evaluation = null;
  }
  // If we looped back to OBSERVE (from RETURN or explicit restart)
  if (next === "OBSERVE" && state.iteration === 0) {
    state.iteration++;
  }
  return state.current_stage;
}

// ── Stage Action Builders ────────────────────────────────────────────────────
// These build the structured prompt arguments for each stage.
// The agent consuming this output calls prompts/get with these args.
// Aligned to the canonical 7-stage model: MEANING→OBSERVE→ENCODE→IMPROVE→VERIFY→SEAL→RETURN.

export function buildMeaningArgs(state: RealityLoopState) {
  return {
    stage: "MEANING",
    iteration: state.iteration,
    evidence_count: state.evidence_base.length,
    scar_count: state.scars.length,
    intent: `Iteration ${state.iteration}: Frame intent. What does the human want? What would make this loop unnecessary?`,
  };
}

export function buildObserveArgs(state: RealityLoopState, config: RealityLoopConfig) {
  const prompts = STAGE_PROMPT_MAP.OBSERVE;
  return {
    stage: "OBSERVE",
    iteration: state.iteration,
    available_prompts: prompts,
    evidence_count: state.evidence_base.length,
    scar_count: state.scars.length,
    system_health: state.system_health,
    depth: config.iteration_depth,
    intent: `Iteration ${state.iteration}: Observe current reality. Use cross-organ-query to route, research-topic to gather evidence, audit-code to scan, fix-bug to address known issues.`,
  };
}

export function buildEncodeArgs(state: RealityLoopState, config: RealityLoopConfig) {
  return {
    stage: "ENCODE",
    iteration: state.iteration,
    sub_skills: ["quantum-frame", "apex-reason", "godel-metabolize"],
    situation: `Based on ${state.evidence_base.length} evidence entries from iteration ${state.iteration}, generate ${config.max_hypotheses} mutually-exclusive hypotheses. Evaluate each via G = Q·V·Ψ·Φ (PHASE 1 HEURISTIC, min_g_score=${config.min_g_score}). Collapse to the best hypothesis.`,
    hypothesis_count: String(config.max_hypotheses),
    prior_evidence: state.evidence_base.slice(-10).map((e) => `[${e.epistemic_label}] ${e.claim}`),
    min_g_score: config.min_g_score,
  };
}

export function buildImproveArgs(state: RealityLoopState) {
  return {
    stage: "IMPROVE",
    iteration: state.iteration,
    sub_skills: ["reality-engineer", "refactor-module", "deploy-service"],
    collapsed_hypothesis: state.active_hypotheses
      .filter((h) => h.collapsed && h.collapsed_to)
      .map((h) => h.statement)
      .join("; ") || `Proceed with iteration ${state.iteration} plan`,
    target: "system",
    nature: "transform",
    prior_actions: state.last_action
      ? `Last action: ${state.last_action.description} (${state.last_action.success ? "success" : "failed"})`
      : "No prior action",
  };
}

export function buildVerifyArgs(state: RealityLoopState, config: RealityLoopConfig) {
  return {
    stage: "VERIFY",
    iteration: state.iteration,
    sub_skills: ["godel-metabolize", "thermodynamic-zen", "recursive-self-improve"],
    system: `Reality loop iteration ${state.iteration}`,
    action_budget: String(config.action_budget),
    prior_entropy: state.entropy_history.length > 0
      ? state.entropy_history[state.entropy_history.length - 1].entropy_after
      : 0.5,
    min_witness: config.min_witness,
    session_summary: `Completed iteration ${state.iteration}. Evidence: ${state.evidence_base.length} entries. Self-mods applied: ${state.self_modifications.filter((m) => m.applied).length}.`,
    capability: "reasoning",
  };
}

export function buildReturnArgs(state: RealityLoopState) {
  return {
    stage: "RETURN",
    iteration: state.iteration,
    session_summary: `Iteration ${state.iteration} complete. Evidence: ${state.evidence_base.length} entries. Scars: ${state.scars.length}. Entropy Δ: ${state.entropy_history.length > 0 ? state.entropy_history[state.entropy_history.length - 1].delta_S : "N/A"}.`,
    instruction: "Present findings to Arif. Await human decision: 'jalan terus' (continue), 'hold' (pause), 'sudah' (close). Terminal stage — loop does not auto-advance.",
  };
}

// ── State Mutators ──────────────────────────────────────────────────────────
// These are called by the agent after each stage completes.

export function recordEvidence(
  state: RealityLoopState,
  entry: Omit<EvidenceEntry, "iteration" | "captured_at">,
): EvidenceEntry {
  const full: EvidenceEntry = {
    ...entry,
    iteration: state.iteration,
    captured_at: new Date().toISOString(),
  };
  state.evidence_base.push(full);
  return full;
}

export function setHypotheses(
  state: RealityLoopState,
  hypotheses: Omit<Hypothesis, "id" | "probability_amplitude">[],
): Hypothesis[] {
  const n = hypotheses.length;
  // Typed ingestion boundary (P0 2026-11-15): if axes are supplied they must
  // be valid; if absent they are stored as null and the hypothesis can never
  // collapse (the gate refuses unbound axes). No invented values.
  for (const h of hypotheses) {
    if (h.axes != null) {
      const check = validateQuantumAxes(h.axes);
      if (!check.ok) {
        throw new QuantumAxesError(
          `invalid quantum axes on ingestion: ${check.failed.join(",")}`,
          check.failed,
        );
      }
    }
  }
  state.active_hypotheses = hypotheses.map((h, i) => ({
    ...h,
    axes: h.axes ?? null,
    id: `H${state.iteration}-${i + 1}`,
    probability_amplitude: 1 / n,
  }));
  return state.active_hypotheses;
}

// ── Quantum collapse gate (P0 slice 2026-11-15) ──────────────────────────────
// Typed ingestion + deterministic evaluation + pre-mutation choke point.
// INPUT_BINDING_GAP (probe 2026-11-15): the ENCODE prompt NAMES G=Q·V·Ψ·Φ but
// the model→engine boundary does not carry structured axes. Absent axes fail
// closed. Caller-supplied booleans can no longer collapse a hypothesis.

export type QuantumAxesValidation =
  | { ok: true }
  | { ok: false; failed: string[] };

export class QuantumAxesError extends Error {
  readonly axesFailure: string[];
  constructor(message: string, axesFailure: string[] = []) {
    super(message);
    this.name = "QuantumAxesError";
    this.axesFailure = axesFailure;
  }
}

const QUANTUM_AXIS_KEYS = ["q", "v", "psi", "phi"] as const;

/** Fail-closed validation: finite numbers in [0,1], all four present. No clamp. */
export function validateQuantumAxes(axes: unknown): QuantumAxesValidation {
  const failed: string[] = [];
  if (!axes || typeof axes !== "object") {
    return { ok: false, failed: [...QUANTUM_AXIS_KEYS] };
  }
  const rec = axes as Record<string, unknown>;
  for (const k of QUANTUM_AXIS_KEYS) {
    const value = rec[k];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
      failed.push(k);
    }
  }
  return failed.length === 0 ? { ok: true } : { ok: false, failed };
}

/** Canonical hash of the exact inputs an evaluation attests to.
 *  Binds BOTH named floors: axis floor (`floor`) and product floor. */
export function quantumAxesHash(
  hypothesisId: string,
  axes: QuantumAxes,
  floor: number,
  productFloor: number | null = null,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        hypothesisId,
        axes: { q: axes.q, v: axes.v, psi: axes.psi, phi: axes.phi },
        floor,
        productFloor,
      }),
    )
    .digest("hex");
}

/** Pure deterministic evaluator. Invalid input fails closed (throws);
 *  a below-floor axis yields ineligible, not an error. Immutable result. */
export function evaluateQuantumCandidate(input: {
  hypothesisId: string;
  axes: QuantumAxes;
  /** Per-axis admissibility floor (axis_floor key). */
  floor: number;
  iteration: number;
  /** Product-G floor (min_g_score). Omit ONLY for axis-only legacy evaluations
   *  (productFloor=null); live collapse paths must always bind it. */
  productFloor?: number;
}): QuantumEvaluation {
  const check = validateQuantumAxes(input.axes);
  if (!check.ok) {
    throw new QuantumAxesError(
      `invalid axes for ${input.hypothesisId}: ${check.failed.join(",")}`,
      check.failed,
    );
  }
  if (!Number.isFinite(input.floor) || input.floor < 0 || input.floor > 1) {
    throw new QuantumAxesError(`invalid floor: ${String(input.floor)}`, ["floor"]);
  }
  const { q, v, psi, phi } = input.axes;
  const productFloor = input.productFloor ?? null;
  if (productFloor !== null && (!Number.isFinite(productFloor) || productFloor < 0 || productFloor > 1)) {
    throw new QuantumAxesError(`invalid productFloor: ${String(productFloor)}`, ["productFloor"]);
  }
  const score = q * v * psi * phi;
  const scoreGatePassed = productFloor === null ? true : score >= productFloor;
  const failedAxes = QUANTUM_AXIS_KEYS.filter((k) => input.axes[k] < input.floor);
  const evaluation: QuantumEvaluation = Object.freeze({
    hypothesisId: input.hypothesisId,
    axes: Object.freeze({ q, v, psi, phi }),
    score,
    minAxis: Math.min(q, v, psi, phi),
    floor: input.floor,
    failedAxes,
    productFloor,
    scoreGatePassed,
    eligible: failedAxes.length === 0 && scoreGatePassed,
    evaluatorVersion: "quantum-evaluator-v1" as const,
    inputHash: quantumAxesHash(input.hypothesisId, { q, v, psi, phi }, input.floor, productFloor),
    iteration: input.iteration,
    evaluatedAt: new Date().toISOString(),
  });
  return evaluation;
}

export type CollapseResult =
  | { status: "COLLAPSED"; hypothesis: Hypothesis; evaluation: QuantumEvaluation }
  | { status: "REFUSED"; reason: string; failed: string[] };

/** Guarded collapse choke point. The only mutation path to collapsed=true.
 *  A caller-supplied boolean or any forged object is refused. */
export function collapseHypothesis(
  state: RealityLoopState,
  hypothesis_id: string,
  evaluation: QuantumEvaluation,
): CollapseResult {
  const refuse = (reason: string, failed?: string[]): CollapseResult => ({
    status: "REFUSED",
    reason,
    failed: failed ?? [reason],
  });
  if (
    !evaluation ||
    typeof evaluation !== "object" ||
    (evaluation as QuantumEvaluation).evaluatorVersion !== "quantum-evaluator-v1"
  ) {
    return refuse("evaluation_required: caller-supplied booleans cannot collapse");
  }
  const h = state.active_hypotheses.find((x) => x.id === hypothesis_id);
  if (!h) return refuse("hypothesis_not_found");
  if (evaluation.hypothesisId !== hypothesis_id) return refuse("id_mismatch");
  if (!h.axes) {
    return refuse("axes_unbound: INPUT_BINDING_GAP — hypothesis carries no structured axes");
  }
  const expected = quantumAxesHash(hypothesis_id, h.axes, evaluation.floor, evaluation.productFloor);
  if (expected !== evaluation.inputHash) return refuse("input_hash_mismatch");
  const axisFloor = state.effective_config.axis_floor ?? DEFAULT_CONFIG.axis_floor;
  if (evaluation.floor !== axisFloor) {
    return refuse("floor_mismatch: evaluation axis floor != effective config axis_floor");
  }
  const productFloor = state.effective_config.min_g_score;
  if (evaluation.productFloor === null || evaluation.productFloor === undefined) {
    return refuse("product_floor_unbound: evaluation must bind the product floor (min_g_score)");
  }
  if (evaluation.productFloor !== productFloor) {
    return refuse("product_floor_mismatch: evaluation product floor != effective config min_g_score");
  }
  if (evaluation.iteration !== state.iteration) return refuse("stale_evaluation");
  if (!evaluation.eligible) return refuse("ineligible", evaluation.failedAxes.map(String));
  h.collapsed = true;
  h.collapsed_to = true;
  h.collapsed_at = new Date().toISOString();
  state.last_quantum_evaluation = evaluation;
  return { status: "COLLAPSED", hypothesis: h, evaluation };
}

export type SelectionResult =
  | { status: "HOLD"; reason: "no_admissible_candidate" }
  | { status: "SELECTED"; evaluation: QuantumEvaluation };

/** Phase-4 selection over evaluations: admissible set only, argmax score,
 *  deterministic tie-break (score desc, then hypothesisId asc). */
export function selectAdmissible(
  evaluations: readonly QuantumEvaluation[],
): SelectionResult {
  const admissible = evaluations.filter((e) => e.eligible);
  if (admissible.length === 0) {
    return { status: "HOLD", reason: "no_admissible_candidate" };
  }
  const sorted = [...admissible].sort(
    (a, b) =>
      b.score - a.score ||
      (a.hypothesisId < b.hypothesisId ? -1 : a.hypothesisId > b.hypothesisId ? 1 : 0),
  );
  return { status: "SELECTED", evaluation: sorted[0] };
}

export function recordAction(
  state: RealityLoopState,
  action: ActionRecord,
): ActionRecord {
  state.last_action = action;
  return action;
}

export function recordEntropy(
  state: RealityLoopState,
  entry: Omit<EntropyEntry, "iteration">,
): EntropyEntry {
  const full: EntropyEntry = {
    ...entry,
    iteration: state.iteration,
  };
  state.entropy_history.push(full);
  return full;
}

export function recordModification(
  state: RealityLoopState,
  mod: Omit<ModificationRecord, "iteration">,
): ModificationRecord {
  const full: ModificationRecord = {
    ...mod,
    iteration: state.iteration,
  };
  state.self_modifications.push(full);
  return full;
}

export function recordScar(
  state: RealityLoopState,
  scar: Omit<ScarRecord, "iteration">,
): ScarRecord {
  const full: ScarRecord = {
    ...scar,
    iteration: state.iteration,
  };
  state.scars.push(full);
  return full;
}

export function recordFloorViolation(
  state: RealityLoopState,
  violation: Omit<FloorViolation, "iteration">,
) {
  state.floor_violations.push({
    ...violation,
    iteration: state.iteration,
  });
}

export function updateSystemHealth(
  state: RealityLoopState,
  health: Record<string, boolean>,
) {
  state.system_health = { ...state.system_health, ...health };
}

// ── Loop Intelligence ────────────────────────────────────────────────────────

export function getLoopMetrics(state: RealityLoopState) {
  const totalActions = state.entropy_history.reduce(
    (sum, e) => sum + e.actions_used,
    0,
  );
  const avgDeltaS =
    state.entropy_history.length > 0
      ? state.entropy_history.reduce((sum, e) => sum + e.delta_S, 0) /
        state.entropy_history.length
      : 0;

  return {
    iterations_completed: state.iteration,
    total_evidence_collected: state.evidence_base.length,
    total_hypotheses_generated: state.active_hypotheses.length,
    total_actions_taken: state.last_action ? 1 : 0,
    total_self_modifications: state.self_modifications.filter((m) => m.applied).length,
    total_scars: state.scars.length,
    total_floor_violations: state.floor_violations.length,
    total_actions_across_history: totalActions,
    avg_entropy_delta: avgDeltaS,
    system_healthy: Object.values(state.system_health).every((v) => v === true),
    current_stage: state.current_stage,
    running_since: state.started_at,
  };
}

export function getLoopReport(state: RealityLoopState): string {
  const m = getLoopMetrics(state);
  const entropyTrend =
    m.avg_entropy_delta <= 0
      ? `✅ DECREASING (ΔS = ${m.avg_entropy_delta.toFixed(4)})`
      : `⚠️ INCREASING (ΔS = ${m.avg_entropy_delta.toFixed(4)})`;

  return [
    `╔══════════════════════════════════════════════╗`,
    `║        REALITY LOOP — ITERATION ${String(state.iteration).padStart(3, " ")}        ║`,
    `╚══════════════════════════════════════════════╝`,
    ``,
    `Stage:        ${state.current_stage}`,
    `Running:      ${state.started_at}`,
    `Evidence:     ${m.total_evidence_collected} entries`,
    `Hypotheses:   ${m.total_hypotheses_generated} active`,
    `Actions:      ${m.total_actions_taken}`,
    `Self-mods:    ${m.total_self_modifications}`,
    `Scars:        ${m.total_scars}`,
    `Violations:   ${m.total_floor_violations}`,
    `Entropy:      ${entropyTrend}`,
    `System:       ${m.system_healthy ? "✅ ALL HEALTHY" : "⚠️ DEGRADED"}`,
    ``,
    `Active hypotheses:`,
    ...state.active_hypotheses.map(
      (h) =>
        `  ${h.collapsed ? (h.collapsed_to ? "✅" : "❌") : "⚛️"} ${h.id}: ${h.statement.slice(0, 60)}`,
    ),
    ``,
    state.last_action
      ? `Last action: ${state.last_action.description} (${state.last_action.success ? "✅" : "❌"})`
      : "No action yet",
    ``,
    `Next: ${nextStage(state.current_stage)}`,
  ].join("\n");
}

// ── VAULT999 Seal ────────────────────────────────────────────────────────────

export async function sealIteration(state: RealityLoopState): Promise<string> {
  const vaultDir = resolve(VAULT_BASE, state.session_id);
  await mkdir(vaultDir, { recursive: true });

  const sealId = `${state.session_id}-iter-${state.iteration}-${Date.now()}`;
  const payload = JSON.stringify({
    seal_id: sealId,
    session_id: state.session_id,
    iteration: state.iteration,
    sealed_at: new Date().toISOString(),
    evidence_count: state.evidence_base.length,
    hypotheses: state.active_hypotheses.map((h) => ({
      id: h.id,
      statement: h.statement,
      collapsed: h.collapsed,
      collapsed_to: h.collapsed_to,
    })),
    last_action: state.last_action,
    entropy_history: state.entropy_history,
    modifications: state.self_modifications.filter((m) => m.applied),
    scars: state.scars,
    floor_violations: state.floor_violations,
    system_health: state.system_health,
    // Threshold gates persisted per iteration (PHASE 1 HEURISTIC)
    effective_thresholds: {
      min_g_score: state.effective_config.min_g_score,
      min_witness: state.effective_config.min_witness,
    },
    threshold_validation: state.threshold_validation,
    calibration_required: true,
    // Quantum collapse provenance (G directive): telemetry is produced ONLY by
    // the deterministic evaluator — never from prompt text or model-reported scores.
    quantum_g_score: state.last_quantum_evaluation?.score ?? null,
    quantum_evaluation: state.last_quantum_evaluation,
  }, null, 2);

  const vaultPath = resolve(vaultDir, `iter-${state.iteration}.json`);
  await writeFile(vaultPath, payload, "utf-8");
  return sealId;
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validateEvidenceEntry(value: unknown): value is Omit<EvidenceEntry, "iteration" | "captured_at"> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.claim !== "string" || v.claim.length === 0) return false;
  if (!VALID_EVIDENCE_LABELS.includes(v.epistemic_label as typeof VALID_EVIDENCE_LABELS[number])) return false;
  if (typeof v.confidence !== "number" || v.confidence < 0 || v.confidence > 1) return false;
  if (typeof v.source_stage !== "string") return false;
  if (typeof v.source_prompt !== "string") return false;
  return true;
}

export function safeJsonParse(str: string | undefined, fallback: unknown = {}): unknown {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export { VALID_EVIDENCE_LABELS, MAX_CONFIDENCE, MAX_ACTIVE_LOOPS, LOOP_TTL_MS };
