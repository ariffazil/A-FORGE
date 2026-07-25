/**
 * APEXRuntimeReceipt.ts — First-Class Kernel Primitive (Pre-Sprint 5)
 *
 * Formalizes the scattered APEX geometry (delta_S, c_dark, SABAR gate,
 * affordance contract, confidence, agency_level) into a single canonical
 * receipt that must be present on every consequential action:
 * forge, seal, promote, external MCP call.
 *
 * The receipt makes APEX auditable, measurable, and benchmarkable.
 * Without it, APEX is behavior — with it, APEX is law.
 *
 * G = A · P · E · X  (non-compensatory multiplicative veto)
 * C_dark = A · (1-P) · (1-X)  (misalignment signature)
 * W³ = (H · AI · E) ^ (1/3)  (geometric mean, informational only)
 *
 * ═══════════════════════════════════════════════════════════════
 * Ω→Δ ARCHITECTURAL NOTE (2026-07-25):
 * G/C_dark computation in this file should ultimately delegate to
 * arifOS kernel via GovernanceBridge (Python Δ-plane). The local
 * computation exists for offline/cold-path use. Canonical G-fold
 * lives at arif_think(mode='apex'). See AAA_ZEN_AND_FORGE.md §3.
 * ═══════════════════════════════════════════════════════════════
 *
 * Layer reconciliation (2026-07-05): this 4-term A·P·E·X is the
 * kernel execution gate (per-action receipt). The `reality-loop`
 * prompt uses a separate 4-term Q·V·Ψ·Φ as per-iteration decision
 * frame, and forge_evaluate v36Ω (separately) uses 5-term A·P·E·X·Φ
 * as tool-registration gate. Three distinct APEX-shaped formulas
 * across three layers — none aliased. Same letter Φ appears in
 * two (this file does not use Φ; the prompt and forge_evaluate do).
 *
 * Required for:
 *   - Skill promotion (STAGED → REVIEWED → TRUSTED)
 *   - forge_seal (VAULT999 binding)
 *   - External MCP calls (REVIEWED+ only)
 *   - Autonomous forge gate (Sprint 5)
 *
 * Constitutional:
 *   F2 TRUTH  — scores are explicit and auditable
 *   F4 CLARITY — all APEX dimensions in one receipt
 *   F7 HUMILITY — C_dark surfaces what the agent hides
 *
 * @module governance/APEXRuntimeReceipt
 * @forged 2026-06-28 by FORGE (000Ω)
 */

// ── Types ───────────────────────────────────────────────────────────

export type APEXDimension = "A" | "P" | "E" | "X";

export type APEXScores = {
  A: number;   // Clarity — 0.0 (vague) to 1.0 (crystal clear)
  P: number;   // Stability — 0.0 (chaotic) to 1.0 (rock solid)
  E: number;   // Energy/Vitality — 0.0 (exhausted) to 1.0 (optimal)
  X: number;   // Ethics — 0.0 (violation) to 1.0 (aligned)
};

export type APEXReceipt = {
  receipt_id: string;
  action_id: string;          // what action this receipt gates
  actor_id: string;
  session_id?: string;
  timestamp: string;

  // Core APEX geometry
  A: number;
  P: number;
  E: number;
  X: number;
  G: number;                  // A·P·E·X — execution potential
  C_dark: number;             // A·(1-P)·(1-X) — misalignment signature

  // Governance band
  authority_band: "OBSERVE" | "ANALYZE" | "EXECUTE" | "MUTATE" | "IRREVERSIBLE";
  reversibility: "REVERSIBLE" | "PARTIAL" | "IRREVERSIBLE";
  blast_radius: "NONE" | "LOCAL" | "SESSION" | "FEDERATION" | "EXTERNAL";

  // Evidence
  evidence_layer: "L1" | "L2" | "L3" | "L4";
  verdict: "PASS" | "HOLD" | "FAIL";

  // Witness (optional — required for promotion)
  tri_witness_consensus?: "PASS" | "HOLD" | "FAIL";
  human_approval?: boolean;

  // SCAR
  scar_references: string[];
};

// ── Builder ─────────────────────────────────────────────────────────

export type APEXReceiptInput = {
  action_id: string;
  actor_id: string;
  session_id?: string;
  scores: APEXScores;
  authority_band: APEXReceipt["authority_band"];
  reversibility: APEXReceipt["reversibility"];
  blast_radius: APEXReceipt["blast_radius"];
  evidence_layer?: APEXReceipt["evidence_layer"];
  tri_witness_consensus?: APEXReceipt["tri_witness_consensus"];
  human_approval?: boolean;
  scar_references?: string[];
};

/**
 * Build an APEXRuntimeReceipt from component scores.
 * G/C_dark here are **local actuator estimates** (g_authority=local_estimate).
 * Constitutional G: arif_think(mode='apex') only — see gAuthority.ts.
 */
export function buildAPEXReceipt(input: APEXReceiptInput): APEXReceipt {
  const { A, P, E, X } = input.scores;

  // Clamp all scores to [0, 1]
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const a = clamp(A), p = clamp(P), e = clamp(E), x = clamp(X);

  // Local 4-term product — NOT kernel G-fold (missing Φ; actuator gate only)
  const G = Math.round(a * p * e * x * 1000) / 1000;
  const C_dark = Math.round(a * (1 - p) * (1 - x) * 1000) / 1000;

  // Veto law (not averaging) — ordered by severity
  let verdict: APEXReceipt["verdict"];
  if (x < 0.10) verdict = "FAIL";              // Ethics floor violation
  else if (G < 0.10) verdict = "FAIL";         // Any dimension collapsed
  else if (C_dark > 0.50) verdict = "HOLD";    // High misalignment risk (before G threshold check)
  else if (G < 0.25) verdict = "HOLD";         // Insufficient energy
  else if (input.tri_witness_consensus === "FAIL") verdict = "FAIL";
  else if (input.tri_witness_consensus === "HOLD") verdict = "HOLD";
  else verdict = "PASS";

  return {
    receipt_id: `APEX-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action_id: input.action_id,
    actor_id: input.actor_id,
    session_id: input.session_id,
    timestamp: new Date().toISOString(),
    A: a, P: p, E: e, X: x, G, C_dark,
    authority_band: input.authority_band,
    reversibility: input.reversibility,
    blast_radius: input.blast_radius,
    evidence_layer: input.evidence_layer ?? "L2",
    verdict,
    tri_witness_consensus: input.tri_witness_consensus,
    human_approval: input.human_approval,
    scar_references: input.scar_references ?? [],
  };
}

/**
 * Quick score from heuristic signals (for automated gating).
 * Phase 2: heuristic. Phase 3: computed from live kernel state.
 */
export function estimateAPEXX(
  claritySignals: number,    // 0-1: code readability, intent match
  stabilitySignals: number,  // 0-1: test pass rate, schema validity
  energySignals: number,     // 0-1: Landauer cost, resource usage
  ethicsSignals: number,     // 0-1: no dangerous patterns, floor compliance
): APEXScores {
  return {
    A: Math.round(claritySignals * 100) / 100,
    P: Math.round(stabilitySignals * 100) / 100,
    E: Math.round(energySignals * 100) / 100,
    X: Math.round(ethicsSignals * 100) / 100,
  };
}
