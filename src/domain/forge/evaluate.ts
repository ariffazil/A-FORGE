/**
 * evaluate.ts — forge.evaluate: Standalone G = (A·P·E·X)^(1/4) Gate
 *
 * APEX v3 — Measurement Instrument, Not Physical Law.
 *
 * ═══════════════════════════════════════════════════════════════
 * Ω→Δ ARCHITECTURAL NOTE (2026-07-25):
 * This file lives in TypeScript (Ω-plane — transport). It computes
 * G and C_dark — constitutional scalars that belong in Δ-plane
 * (Python reasoning). Canonical path: arif_think(mode='apex')
 * in the arifOS Python kernel. This implementation exists as a
 * local gate for tool registration; long-term, it should delegate
 * to the kernel via GovernanceBridge rather than duplicating the
 * computation. See /root/AAA/docs/AAA_ZEN_AND_FORGE.md §3.
 * ═══════════════════════════════════════════════════════════════
 *
 * CANONICAL APEX G F3 (2026-07-28):
 *   G = (A · P · E · X)^(1/4)  — 4-factor Nash Bargaining Product
 *   Nash Collapse: ANY dial ≤ 0 → G = 0.0000
 *   Removed: Φ, E², H — declared HARAM per F13
 * C_dark = A · (1−P) · (1−X)  (clever + unstable + unethical)
 *
 * Thresholds (Phase 1 — asserted, must be calibrated on held-out data):
 *   G ≥ 0.80 AND C_dark ≤ 0.40 → SEAL
 *   G ≥ 0.50 AND C_dark ≤ 0.60 → REVIEW
 *   G < 0.50 OR  C_dark > 0.80 → VOID
 *   Ω₀ ∉ [0.03, 0.05]          → REVIEW (uncalibrated evaluator)
 *
 * CANONICAL FORMULA (2026-07-31, P0.1 ratified):
 *   G_local = (A·P·E·X)^(1/4) — 4-term Nash Bargaining Product (geometric mean)
 *   Φ (Wisdom/Scar) is CONSULTED but NOT multiplied into G — it is a
 *   SEPARATE gate that modifies the SEAL threshold via scar_pressure.
 *   This file is the SINGLE authoritative source for tool evaluation G.
 *   All other files must reference this formula or explicitly declare
 *   they are using a different measurement instrument for a different purpose.
 *
 * The `reality-loop` prompt uses Q·V·Ψ·Φ (different measurement frame).
 * The `decisionField.ts` uses Q·V·Ψ·Φ (skill forge, not tool evaluation).
 * These are separate instruments — do not collapse by symbol alone.
 *
 * Demoted from "physics" to "instrument" per v36Ω validation report:
 *   - G is a non-compensatory veto score, not a thermodynamic law
 *   - X is an ensemble-evaluated ethics signal, not a constitutional derivation
 *   - Φ is scar-adjusted wisdom from prior failures
 *   - C_dark is a misalignment signal, not a collapse metric
 *   - Ω₀ is calibration gap (ECE), not a physical constant
 *
 * For the Goodhart stress test: an adversary who knows the G formula
 * can game the X-estimator. Defense = multi-evaluator ensemble + debate.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 * @constitutional F2 TRUTH — all estimators are evidence-bound
 * @constitutional F7 HUMILITY — cap confidence at 0.90
 */

import crypto from "node:crypto";
import type {
  CandidateSpec,
  GateDecision,
  EstimatorScores,
  GovernedDomain,
  ScarRecord,
} from "../../contracts/types.js";
import { GovernanceBridge } from "../governance/GovernanceBridge.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — ESTIMATOR FUNCTIONS (Phase 1: heuristic. Phase 2: empirical.)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A (Akal/Clarity): 1 − normalized entropy of description and implementation.
 *
 * Phase 1 heuristic:
 *   - Description length and keyword density
 *   - Implementation structure (has exports, has types, no eval)
 *   - Domain keyword alignment
 *
 * Phase 2 (TODO): semantic-entropy measurement via ensemble sampling
 * (Farquhar et al., 2024, Nature).
 */
function estimateA(spec: CandidateSpec): { score: number; rationale: string[] } {
  const rationale: string[] = [];
  let score = 0.5;

  // Description quality
  const descLen = spec.description.length;
  if (descLen < 20) {
    score -= 0.25;
    rationale.push(`A↓: description too short (${descLen} chars) — insufficient specification`);
  } else if (descLen >= 50 && descLen <= 500) {
    score += 0.20;
    rationale.push(`A↑: description well-scoped (${descLen} chars)`);
  } else if (descLen > 500) {
    score += 0.05;
    rationale.push(`A~: description long (${descLen} chars) — possibly over-scoped`);
  }

  // Implementation structure
  const impl = spec.implementation;
  if (impl.includes("export") || impl.includes("async")) score += 0.10;
  if (impl.includes("return")) score += 0.05;
  if (impl.includes("eval(")) {
    score -= 0.30;
    rationale.push("A↓: implementation contains eval() — high-entropy pattern");
  }
  if (impl.length < 50) {
    score -= 0.10;
    rationale.push("A↓: implementation too short — likely template scaffold");
  }

  // Tool name quality — constitutional naming standard (2026-07-31)
  // See: /root/AAA/docs/MCP_NAMING_STANDARD.md
  if (spec.tool_name.match(/^forge_[a-z0-9_]+$/)) score += 0.05;
  
  // NAMING LINT: organ prefix gate
  const domainPrefixes: Record<string, { prefix: string; forbidden: string[] }> = {
    arifos:  { prefix: "arif_",  forbidden: [] },
    aforge:  { prefix: "forge_", forbidden: [] },
    geox:    { prefix: "geox_",  forbidden: [] },
    wealth:  { prefix: "capital_", forbidden: ["wealth_"] },
    well:    { prefix: "well_",  forbidden: [] },
    hermes:  { prefix: "hermes_", forbidden: [] },
    arifflow:{ prefix: "flow_",  forbidden: [] },
    aaa:     { prefix: "aaa_",   forbidden: [] },
  };
  
  const domainRule = domainPrefixes[spec.domain];
  if (domainRule) {
    // Forbidden prefix check (e.g., wealth_ on WEALTH organ)
    for (const forbidPrefix of domainRule.forbidden) {
      if (spec.tool_name.startsWith(forbidPrefix)) {
        score -= 0.20;
        rationale.push(
          `A↓ NAMING VIOLATION: '${spec.tool_name}' uses forbidden prefix '${forbidPrefix}'. ` +
          `WEALTH tools MUST use '${domainRule.prefix}' prefix per MCP_NAMING_STANDARD.md §1.1. ` +
          `Existing '${forbidPrefix}*' tools are legacy only — new tools rejected.`
        );
      }
    }
    // Correct prefix boost
    if (spec.tool_name.startsWith(domainRule.prefix)) {
      score += 0.03;
    } else {
      score -= 0.10;
      rationale.push(
        `A↓ NAMING MISMATCH: '${spec.tool_name}' should start with '${domainRule.prefix}' for domain '${spec.domain}'`
      );
    }
  }
  
  // Double-prefix advisory (geox_geox_, well_well_, hermes_hermes_)
  const doublePrefixPattern = /^(geox_geox_|well_well_|hermes_hermes_)/;
  if (doublePrefixPattern.test(spec.tool_name)) {
    // Advisory only — existing tools grandfathered, new tools warned
    rationale.push(
      `A↓ NAMING ADVISORY: '${spec.tool_name}' uses double-prefix pattern. ` +
      `New tools SHOULD use differentiated prefix per MCP_NAMING_STANDARD.md §2.2.`
    );
  }

  return { score: Math.max(0, Math.min(1, score)), rationale };
}

/**
 * P (Present/Stability): bounded inverse of output variance proxy.
 *
 * Phase 1 heuristic:
 *   - Fewer declared side effects → more stable
 *   - Fewer required permissions → more stable
 *   - No shell exec → more stable
 *
 * Phase 2 (TODO): input-perturbation variance measurement.
 * NOT a certified Lyapunov function — explicitly labeled a proxy.
 */
function estimateP(spec: CandidateSpec): { score: number; rationale: string[] } {
  const rationale: string[] = [];
  let score = 0.7; // baseline — moderately stable

  const deps = spec.declared_side_effects;
  const perms = spec.required_permissions;

  // Fewer side effects = higher stability
  if (deps.length === 0) {
    score += 0.15;
    rationale.push("P↑: no declared side effects");
  } else if (deps.length <= 2) {
    score += 0.05;
    rationale.push(`P↑: low side-effect surface (${deps.length})`);
  } else if (deps.length >= 5) {
    score -= 0.20;
    rationale.push(`P↓: high side-effect surface (${deps.length}) — brittle`);
  }

  // Dangerous side effects
  if (deps.includes("shell")) {
    score -= 0.15;
    rationale.push("P↓: shell execution declared — stability risk");
  }
  if (deps.includes("network")) {
    score -= 0.05;
    rationale.push("P~: network access — external dependency risk");
  }
  if (deps.includes("vault")) {
    score -= 0.15;
    rationale.push("P↓: vault access — irreversible mutation risk");
  }

  // Permission analysis
  if (perms.includes("execute")) {
    score -= 0.10;
    rationale.push("P↓: execute permission — code execution introduces instability");
  }
  if (perms.includes("seal")) {
    score -= 0.10;
    rationale.push("P↓: seal permission — irreversible action");
  }

  // Recursion depth
  const maxDepth = spec.max_recursion_depth ?? 1;
  if (maxDepth > 1) {
    score -= 0.05 * (maxDepth - 1);
    rationale.push(`P↓: recursion depth ${maxDepth} — amplifies instability`);
  }

  return { score: Math.max(0, Math.min(1, score)), rationale };
}

/**
 * E (Energy/Vitality): 1 − normalized resource cost.
 *
 * Phase 1 heuristic:
 *   - Lower estimated cost → higher vitality
 *   - Lower recursion depth → higher vitality
 *
 * Phase 2 (TODO): actual resource measurement (latency, memory, tokens).
 */
function estimateE(spec: CandidateSpec): { score: number; rationale: string[] } {
  const rationale: string[] = [];
  const cost = spec.estimated_cost ?? 0.5;
  const score = 1 - Math.min(1, cost);

  if (cost <= 0.1) {
    rationale.push("E↑: negligible resource cost");
  } else if (cost <= 0.3) {
    rationale.push("E↑: low resource cost");
  } else if (cost >= 0.7) {
    rationale.push("E↓: high resource cost — vitality drain");
  }
  return { score: Math.max(0, Math.min(1, score)), rationale };
}

/**
 * X (Ethics): ensemble Constitutional-AI score.
 *
 * Phase 1 heuristic: HARAM scan inversion.
 *   - Zero HARAM findings → high X
 *   - CRITICAL HARAM finding → X = 0
 *
 * Phase 2 (TODO): ensemble LLM judges against explicit principle set.
 * Phase 3 (TODO): MACHIAVELLI-derived classifiers for power-seeking/deception.
 *
 * CRITICAL: X is measured, not derived. It inherits Goodhart vulnerability.
 * A deceptive mesa-optimizer can game this evaluator.
 */
const HARAM_PATTERNS: Array<{ re: RegExp; severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; name: string }> = [
  { re: /rm\s+-rf\s+\/\s*(;|$|\||2>)/, severity: "CRITICAL", name: "rm -rf /" },
  { re: /DROP\s+DATABASE|DROP\s+TABLE/i, severity: "CRITICAL", name: "DROP DATABASE/TABLE" },
  { re: /:\(\)\s*\{\s*:\|:&\s*\;?\s*\};?\s*:/, severity: "CRITICAL", name: "Fork bomb" },
  { re: />\s*\/dev\/(sda|sdb|nvme|mmc)/, severity: "CRITICAL", name: "Direct block device write" },
  { re: /mkfs\.\w+/, severity: "HIGH", name: "Filesystem creation" },
  { re: /dd\s+if=/, severity: "HIGH", name: "dd destructive" },
  { re: /chmod\s+777/, severity: "MEDIUM", name: "World-writable file" },
  { re: /eval\s*\(/, severity: "HIGH", name: "eval() usage" },
  { re: /process\.env\./, severity: "LOW", name: "Environment variable access" },
  { re: /child_process\.exec(File)?\(/, severity: "MEDIUM", name: "Shell exec" },
];

function estimateX(spec: CandidateSpec): { score: number; rationale: string[] } {
  const rationale: string[] = [];
  const findings: string[] = [];
  let critical = 0;
  let high = 0;

  for (const p of HARAM_PATTERNS) {
    if (p.re.test(spec.implementation)) {
      findings.push(p.name);
      if (p.severity === "CRITICAL") critical++;
      if (p.severity === "HIGH") high++;
    }
  }

  if (critical > 0) {
    rationale.push(`X↓: ${critical} CRITICAL HARAM finding(s): [${findings.join(", ")}] — ethics zeroed`);
    return { score: 0, rationale };
  }

  if (high > 0) {
    const score = Math.max(0.15, 1 - high * 0.3);
    rationale.push(`X↓: ${high} HIGH HARAM finding(s): [${findings.join(", ")}] — ethics severely reduced`);
    return { score, rationale };
  }

  if (findings.length > 0) {
    const score = Math.max(0.5, 1 - findings.length * 0.1);
    rationale.push(`X~: ${findings.length} HARAM finding(s): [${findings.join(", ")}] — minor concerns`);
    return { score, rationale };
  }

  rationale.push("X↑: HARAM scan clean — no detected violations");
  return { score: 0.95, rationale };
}

/**
 * Φ (Phi/Wisdom): scar-adjusted wisdom.
 *
 * Φ = 1 − Σ(scar_pressure × severity_multiplier)
 *
 * Delegates to scar consultation. Returns 1.0 if no matching scars.
 *
 * Phase 2 (TODO): semantic scar matching via Qdrant vector similarity.
 */
async function estimatePhi(
  fingerprint: string,
  domain: GovernedDomain,
  consultScars: (fingerprint: string, domain: GovernedDomain) => Promise<{ scarPressure: number; count: number }>,
): Promise<{ score: number; rationale: string[]; scarsConsulted: number; scarPressureApplied: number }> {
  const rationale: string[] = [];
  const { scarPressure, count } = await consultScars(fingerprint, domain);

  if (count === 0) {
    rationale.push("Φ↑: no matching scars — clean wisdom, full Φ");
    return { score: 1.0, rationale, scarsConsulted: 0, scarPressureApplied: 0 };
  }

  const score = Math.max(0, 1 - scarPressure);
  if (scarPressure >= 0.5) {
    rationale.push(`Φ↓: ${count} matching scar(s), scar_pressure=${scarPressure.toFixed(2)} — wisdom heavily reduced`);
  } else if (scarPressure >= 0.2) {
    rationale.push(`Φ~: ${count} matching scar(s), scar_pressure=${scarPressure.toFixed(2)} — moderate scar pressure`);
  } else {
    rationale.push(`Φ↑: ${count} matching scar(s), scar_pressure=${scarPressure.toFixed(2)} — minor scar pressure`);
  }

  return { score, rationale, scarsConsulted: count, scarPressureApplied: scarPressure };
}

/**
 * Ω₀ (Omega): calibration gap — placeholder for ECE measurement.
 *
 * Phase 1: returns midpoint of calibration band [0.03, 0.05].
 * Phase 2 (TODO): actual ECE across evaluator ensemble.
 */
function estimateOmega(evaluatorCount: number): number {
  // Phase 1 placeholder: assume calibrated evaluators
  // Phase 2: measure actual ECE and return it
  if (evaluatorCount >= 3) return 0.04; // multi-evaluator ensemble → better calibrated
  return 0.05; // single evaluator → boundary of calibration band
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — GATE LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Actuator-local gate scores for forge_evaluate (Ψ plane).
 *
 * AAA scalar physics: canonical G-fold is arif_think(mode='apex') only.
 * This product mirrors the Nash form for local tool-spec gating but
 * does NOT author constitutional G. Label outputs as actuator evidence.
 *
 * G_local = (A · P · E · X)^(1/4)  (Nash 1950, constitutional V3)
 * C_dark = A · (1−P) · (1−X)
 *
 * Multiplicative Nash Collapse: zero in any component collapses G_local.
 * No Φ, no H, no S, no U, no E² — per Arif's directive.
 */
function computeGate(scores: Omit<EstimatorScores, "rationale" | "Omega">): {
  G: number;
  C_dark: number;
  g_authority: "local_estimate";
  g_canonical_source: "arif_think.mode=apex";
} {
  // Canonical V3: G = (A · P · E · X)^(1/4)
  const clampSafe = (v: number) => Math.max(1e-10, v);
  const G = Math.round(Math.pow(
    clampSafe(scores.A) * clampSafe(scores.P) * clampSafe(scores.E) * clampSafe(scores.X),
    0.25,
  ) * 10000) / 10000;
  const C_dark = scores.A * (1 - scores.P) * (1 - scores.X);
  return {
    G,
    C_dark,
    g_authority: "local_estimate",
    g_canonical_source: "arif_think.mode=apex",
  };
}

/**
 * computeGateWithKernelG — G-fold gate with canonical kernel G override.
 *
 * 4-layer forge gate integration:
 *   Layer 1 — Local estimate: G = (A·P·E·X)^(1/4)  (4-term geometric mean)
 *   Layer 2 — Canonical kernel G via GovernanceBridge.fetchCanonicalG()
 *   Layer 3 — Fallback to local estimate on kernel unreachable
 *   Layer 4 — Authority stamp reflects which layer fired
 *
 * Φ (Wisdom/Scar) is a SEPARATE pre-gate consulted before evaluation.
 * It does NOT multiply into G. Scar pressure modifies the SEAL threshold
 * in the registration gate, not the evaluation formula itself.
 *
 * When the canonical G from the arifOS APEX kernel is available, it
 * replaces the local 4-term geometric mean entirely. C_dark remains local
 * as it is a local misalignment signal, not a kernel scalar.
 */
async function computeGateWithKernelG(
  scores: Omit<EstimatorScores, "rationale" | "Omega">,
  bridge: GovernanceBridge,
): Promise<{
  G: number;
  C_dark: number;
  g_authority: "arif_think.mode=apex" | "local_estimate";
  g_canonical_source: "arif_think.mode=apex";
}> {
  const C_dark = scores.A * (1 - scores.P) * (1 - scores.X);

  // Layer 2: Try canonical kernel G
  const canonical = await bridge.fetchCanonicalG();

  if (canonical !== null) {
    // Layer 2 hit: kernel G replaces local product
    return {
      G: canonical.G,
      C_dark,
      g_authority: "arif_think.mode=apex",
      g_canonical_source: "arif_think.mode=apex",
    };
  }

  // Layer 3 fallback: local estimate (CANONICAL V3: geometric mean, no Φ)
  const G = Math.pow(
    Math.max(0, scores.A) *
    Math.max(0, scores.P) *
    Math.max(0, scores.E) *
    Math.max(0, scores.X),
    0.25
  );
  return {
    G,
    C_dark,
    g_authority: "local_estimate",
    g_canonical_source: "arif_think.mode=apex",
  };
}

/**
 * APEX thermodynamic scalar — per-scalar measurement status.
 * ATP doctrine: HOLD if unmeasured; never fabricate (F9).
 */
interface MeasuredScalar {
  value: number;
  status: "MEASURED";
}

interface UnmeasuredScalar {
  value: null;
  status: "UNMEASURED";
}

type ApexScalarStatus = MeasuredScalar | UnmeasuredScalar;

interface ApexScalars {
  G: MeasuredScalar;
  C_dark: MeasuredScalar;
  W3: ApexScalarStatus;
  h: ApexScalarStatus;
  QDF: { value: number | null; status: "MEASURED" | "PARTIAL" | "UNMEASURED" };
}

/**
 * computeApexScalars — assemble APEX thermodynamic compression block.
 *
 * QDF = G × (1−C_dark) × W3 × κ_r × ψ_le  (canonical ATP formula)
 *
 * ATP Pass 2 (2026-08-07):
 *   - G, C_dark: locally measurable (always computed)
 *   - W3: provided by caller from forge_witness (Nash ∛(H·AI·Ext)). Null → UNMEASURED.
 *   - κ_r: sourced from TOOL_KAPPA_R table by tool_name. Default 0.5 if unknown.
 *   - ψ_le: fetched from arifOS kernel via GovernanceBridge.fetchPsiLe(). Null → UNMEASURED.
 *   - h: WELL-assessed human readiness — not available in A-FORGE → UNMEASURED.
 *
 * F9 ANTI-HANTU: unmeasured scalars are honest null, never fabricated.
 * ATP doctrine: all 5 measured → QDF = full product. Partial → HOLD.
 * is_canonical_qdf = true only when all 5 inputs measured AND QDF ≥ 0.70.
 */
async function computeApexScalars(
  G: number,
  C_dark: number,
  toolName: string,
  bridge?: GovernanceBridge,
  w3?: number,
): Promise<{ scalars: ApexScalars; is_canonical_qdf: boolean }> {
  // κ_r: reversibility from TOOL_KAPPA_R table (local, synchronous)
  let kappa_r: number | null = 0.5; // Default: unknown tool = moderate reversibility
  try {
    const { TOOL_KAPPA_R } = await import("../ops/ThermodynamicCostEstimator.js");
    kappa_r = TOOL_KAPPA_R[toolName] ?? 0.5;
  } catch {
    // Graceful: import fails → use default 0.5
  }

  // ψ_le: fetch from arifOS kernel telemetry
  let psi_le: number | null = null;
  if (bridge) {
    const psiResult = await bridge.fetchPsiLe();
    if (psiResult !== null) {
      psi_le = psiResult.psi_le;
    }
  }

  // W3: caller-provided or UNMEASURED
  const w3Scalar: ApexScalarStatus = w3 !== undefined && w3 !== null
    ? { value: w3, status: "MEASURED" as const }
    : { value: null, status: "UNMEASURED" as const };

  // Assemble scalars
  const scalars: ApexScalars = {
    G: { value: G, status: "MEASURED" },
    C_dark: { value: C_dark, status: "MEASURED" },
    W3: w3Scalar,
    h: { value: null, status: "UNMEASURED" },
    QDF: { value: null, status: "PARTIAL" },
  };

  // Compute QDF only when all 5 inputs measurable (ATP doctrine)
  const allMeasured = w3 !== undefined && w3 !== null && kappa_r !== null && psi_le !== null;
  if (allMeasured) {
    const qdf = G * (1 - C_dark) * w3! * kappa_r! * psi_le!;
    scalars.QDF = {
      value: Math.round(qdf * 10000) / 10000,
      status: "MEASURED",
    };
  }

  // is_canonical_qdf: all 5 measured AND QDF ≥ 0.70
  const is_canonical_qdf = allMeasured && (scalars.QDF.value ?? 0) >= 0.70;

  return { scalars, is_canonical_qdf };
}

/**
 * Render verdict from G, C_dark, and Ω₀.
 *
 * Thresholds (Phase 1 — asserted, recalibrate on held-out data):
 *   G ≥ 0.80 AND C_dark ≤ 0.40 → SEAL    (governed execution)
 *   G ≥ 0.50 AND C_dark ≤ 0.60 → REVIEW  (human-in-loop)
 *   G < 0.50 OR  C_dark > 0.80 → VOID    (reject + log scar)
 *   Ω₀ ∉ [0.03, 0.05]           → REVIEW  (uncalibrated evaluator)
 */
function renderVerdict(
  G: number,
  C_dark: number,
  Omega: number,
): { verdict: "SEAL" | "REVIEW" | "VOID"; reason: string } {
  // Uncalibrated evaluator → REVIEW regardless
  if (Omega < 0.03 || Omega > 0.05) {
    return {
      verdict: "REVIEW",
      reason: `Ω₀=${Omega.toFixed(3)} ∉ [0.03, 0.05] — evaluator ensemble uncalibrated, human review required`,
    };
  }

  // VOID conditions
  if (G < 0.50) {
    return {
      verdict: "VOID",
      reason: `G=${G.toFixed(3)} < 0.50 — insufficient action potential, tool cannot execute`,
    };
  }
  if (C_dark > 0.80) {
    return {
      verdict: "VOID",
      reason: `C_dark=${C_dark.toFixed(3)} > 0.80 — misalignment vector exceeds sabotage threshold`,
    };
  }

  // SEAL condition
  if (G >= 0.80 && C_dark <= 0.40) {
    return {
      verdict: "SEAL",
      reason: `G=${G.toFixed(3)} ≥ 0.80, C_dark=${C_dark.toFixed(3)} ≤ 0.40 — governed execution permitted`,
    };
  }

  // Everything else → REVIEW
  return {
    verdict: "REVIEW",
    reason: `G=${G.toFixed(3)}, C_dark=${C_dark.toFixed(3)} — borderline, human-in-loop review required`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — MAIN FORGE.EVALUATE FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export interface EvaluateOptions {
  /** Tool spec to evaluate */
  spec: CandidateSpec;
  /** Number of evaluators in ensemble (for Ω₀) */
  evaluatorCount?: number;
  /** Scar consultation function */
  consultScars: (fingerprint: string, domain: GovernedDomain) => Promise<{
    scarPressure: number;
    count: number;
  }>;
  /**
   * ATP Pass 2: GovernanceBridge for cross-organ scalar fetch (psi_le from arifOS).
   * When provided, computeApexScalars fetches psi_le and computes full QDF.
   * When absent, QDF stays PARTIAL (G + C_dark only).
   */
  bridge?: GovernanceBridge;
  /**
   * ATP Pass 2: Tri-Witness W3 scalar from forge_witness.
   * ∛(Human × AI × Earth) — Nash product across three independent witnesses.
   * When provided, fed into QDF computation. When absent, W3 = UNMEASURED.
   */
  w3?: number;
}

/**
 * forge.evaluate — the standalone evaluation gate.
 *
 * Input: CandidateSpec (what tool is proposed)
 * Output: GateDecision (SEAL / REVIEW / VOID)
 *
 * This does NOT generate code. It does NOT register tools.
 * It ONLY evaluates. The caller decides what to do with the verdict.
 *
 * Falsification protocol (v36Ω):
 *   Test 1 — C_dark vs MACHIAVELLI: ρ ≥ 0.5 Spearman correlation required
 *   Test 2 — G vs HarmBench: ASR reduction ≥ 50% with <5% benign loss
 *   Test 3 — Goodhart stress test: adversarial ASR under G < 10%
 *   Test 4 — Threshold calibration: ROC on held-out data
 */
export async function evaluateCandidate(opts: EvaluateOptions): Promise<GateDecision> {
  const { spec, evaluatorCount = 1, consultScars } = opts;

  // Compute fingerprint
  const fingerprint = crypto
    .createHash("sha256")
    .update(`${spec.domain}::${spec.tool_name}::${spec.description.slice(0, 200)}`)
    .digest("hex")
    .slice(0, 16);

  // Step 1: Compute all estimator scores
  const a = estimateA(spec);
  const p = estimateP(spec);
  const e = estimateE(spec);
  const x = estimateX(spec);
  const omega = estimateOmega(evaluatorCount);

  // Merge all rationale
  const allRationale = [
    ...a.rationale,
    ...p.rationale,
    ...e.rationale,
    ...x.rationale,
  ];

  // Step 2: Compute G and C_dark
  const scores: EstimatorScores = {
    A: a.score,
    P: p.score,
    E: e.score,
    X: x.score,
    Omega: omega,
    rationale: allRationale,
  };

  const { G, C_dark } = computeGate(scores);

  // Step 3: Render verdict
  const { verdict, reason } = renderVerdict(G, C_dark, omega);

  // Step 4: Build GateDecision with ATP scalars
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { scalars, is_canonical_qdf } = await computeApexScalars(G, C_dark, spec.tool_name, opts.bridge, opts.w3);

  const decision: GateDecision = {
    tool_name: spec.tool_name,
    fingerprint,
    G,
    C_dark,
    scores,
    verdict,
    apex_scalars: scalars,
    is_canonical_qdf,
    evaluator_disagreement: evaluatorCount > 1 ? 0.05 : 0, // Phase 1 placeholder
    evaluator_count: evaluatorCount,
    evaluated_at: now,
    expires_at: expiresAt,
    g_authority: "local_estimate",
    g_canonical_source: "arif_think.mode=apex",
  };

  // If VOID, attach a scar record (the caller seals it)
  if (verdict === "VOID") {
    decision.scar_record = {
      scar_id: `scar_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      fingerprint,
      failure_mode: `G-gate VOID: ${reason}`,
      detection_method: "forge.evaluate — Decision Field gate",
      severity: C_dark > 0.80 ? "CRITICAL" : G < 0.50 ? "HIGH" : "MEDIUM",
      scar_pressure: C_dark > 0.80 ? 0.70 : G < 0.50 ? 0.40 : 0.20,
      domain: spec.domain,
      constraint_imposed: `Tool '${spec.tool_name}' blocked at registration gate: ${reason}`,
      occurred_at: now,
      sealed_at: now,
      sealed_by: "forge.evaluate",
    };
  }

  return decision;
}

/**
 * Quick evaluation without scar consultation (for dry-run / preview).
 */
export function evaluateDryRun(spec: CandidateSpec, evaluatorCount = 1): Omit<GateDecision, "scar_record"> {
  const fingerprint = crypto
    .createHash("sha256")
    .update(`${spec.domain}::${spec.tool_name}::${spec.description.slice(0, 200)}`)
    .digest("hex")
    .slice(0, 16);

  const a = estimateA(spec);
  const p = estimateP(spec);
  const e = estimateE(spec);
  const x = estimateX(spec);
  const omega = estimateOmega(evaluatorCount);

  const scores: EstimatorScores = {
    A: a.score,
    P: p.score,
    E: e.score,
    X: x.score,
    Omega: omega,
    rationale: [...a.rationale, ...p.rationale, ...e.rationale, ...x.rationale],
  };

  const { G, C_dark } = computeGate(scores);
  const { verdict, reason } = renderVerdict(G, C_dark, omega);
  const now = new Date().toISOString();

  // Dry-run: no bridge, no W3 → QDF stays PARTIAL (static compute)
  const dryScalars: ApexScalars = {
    G: { value: G, status: "MEASURED" },
    C_dark: { value: C_dark, status: "MEASURED" },
    W3: { value: null, status: "UNMEASURED" },
    h: { value: null, status: "UNMEASURED" },
    QDF: { value: null, status: "PARTIAL" },
  };

  return {
    tool_name: spec.tool_name,
    fingerprint,
    G,
    C_dark,
    scores,
    verdict: scores.X === 0 ? "VOID" : verdict, // HARAM CRITICAL → VOID even in dry run
    apex_scalars: dryScalars,
    is_canonical_qdf: false,
    evaluator_disagreement: 0,
    evaluator_count: evaluatorCount,
    evaluated_at: now,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    g_authority: "local_estimate",
    g_canonical_source: "arif_think.mode=apex",
  };
}
