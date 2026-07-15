/**
 * decisionField.ts — The math of APEX THEORY Epoch 34Ω
 *
 * G = Q · V · Ψ · Φ
 *
 * "Bad thoughts have no energy to form." — Epoch 34
 *
 * The Decision Field is the mesa-optimization guard. Not a blocklist.
 * Not a scan. A physics constraint — unwise tools literally cannot
 * accumulate enough action potential to execute.
 *
 * Multiplicative, not additive: zero in any component collapses G.
 * This is constitutional physics, not policy.
 *
 * Floor mapping (per APEX THEORY):
 *   Φ < 0.10  → tool cannot form (VOID — Scar Law pressure)
 *   Ψ < 0.30  → constitutional instability (VOID — F1/F8 violation)
 *   V < 0.20  → off-mission (HOLD — no federation purpose)
 *   Q < 0.20  → vague intent (SABAR — wait for clarity)
 *
 *   G ≥ 0.50  → SEAL  (register, monitor)
 *   0.25–0.50 → SABAR (register with conditions)
 *   0.10–0.25 → HOLD  (defer, insufficient energy)
 *   < 0.10    → VOID  (cannot execute)
 */

import type { DecisionField, Scar, SkillDomain } from "./types.js";

/**
 * Compute Q — action potential.
 *
 * Q measures: is the intent well-defined and executable?
 *
 * Heuristic: length, keyword density, domain match.
 * Phase 1 implementation — Phase 2 should use semantic embedding.
 */
export function computeQ(intent: string, domain: SkillDomain): { score: number; rationale: string[] } {
  const rationale: string[] = [];
  let score = 0.5; // baseline — vague

  // Length heuristic — too short = vague, too long = muddled
  const len = intent.length;
  if (len < 20) {
    score -= 0.3;
    rationale.push(`Q↓: intent too short (${len} chars) — vague action potential`);
  } else if (len > 50 && len < 500) {
    score += 0.3;
    rationale.push(`Q↑: intent well-scoped (${len} chars)`);
  } else if (len >= 500) {
    score += 0.1;
    rationale.push(`Q~: intent long (${len} chars) — possibly over-scoped`);
  }

  // Domain alignment heuristic — does intent mention the domain?
  const domainKeywords: Record<SkillDomain, string[]> = {
    geox: ["seismic", "well", "petrophysics", "horizon", "rock", "formation", "subsurface", "log", "LAS", "geophysics"],
    wealth: ["capital", "money", "portfolio", "asset", "investment", "risk", "NPV", "cash", "market", "wealth"],
    well: ["vitality", "sleep", "fatigue", "dignity", "human", "readiness", "wellness", "metabolic", "homeostasis"],
    arifos: ["constitutional", "verdict", "judge", "seal", "vault", "floor", "witness", "constitution"],
    hermes: ["telegram", "bot", "chat", "message", "notification", "user"],
    aforge: ["forge", "build", "deploy", "execute", "compile", "test", "deploy"],
    general: [],
  };
  const kws = domainKeywords[domain] ?? [];
  const hits = kws.filter(k => intent.toLowerCase().includes(k.toLowerCase())).length;
  if (hits >= 2) {
    score += 0.2;
    rationale.push(`Q↑: ${hits} domain keywords matched (${domain})`);
  } else if (hits === 1) {
    score += 0.1;
    rationale.push(`Q~: 1 domain keyword matched`);
  } else if (domain !== "general" && kws.length > 0) {
    score -= 0.1;
    rationale.push(`Q↓: no ${domain} keywords found in intent`);
  }

  // Verbs of action — does intent describe what to do?
  const actionVerbs = ["parse", "fetch", "compute", "analyze", "transform", "extract", "compute", "score", "map", "generate", "convert", "validate", "check"];
  const verbHits = actionVerbs.filter(v => intent.toLowerCase().includes(v)).length;
  if (verbHits > 0) {
    score += 0.1;
    rationale.push(`Q↑: ${verbHits} action verb(s) present`);
  }

  return { score: clamp01(score), rationale };
}

/**
 * Compute V — vitality.
 *
 * V measures: does this serve the federation's purpose?
 *
 * Per APEX THEORY: AGI/ASI/APEX trinity — every tool must serve
 * one of the three engines or be a general utility.
 */
export function computeV(domain: SkillDomain, targetToolName?: string): { score: number; rationale: string[] } {
  const rationale: string[] = [];

  // Domain vitality — some domains are more central than others
  const domainVitality: Record<SkillDomain, number> = {
    arifos: 1.0,  // constitutional — highest
    geox: 0.9,    // earth intelligence
    wealth: 0.9,  // capital intelligence
    well: 0.95,   // human readiness — F6 MARUAH bound
    hermes: 0.7,  // conversational — useful but lower vitality
    aforge: 0.85, // execution — meta-layer
    general: 0.5, // utility — baseline
  };
  let score = domainVitality[domain] ?? 0.5;
  rationale.push(`V: domain=${domain} baseline=${score.toFixed(2)}`);

  // Tool name reserved check — protected meta-tools
  const protectedNames = ["forge_skill", "forge_execute", "forge_registry", "forge_probe", "forge_judge", "forge_approve", "forge_vault", "forge_seal", "arif_judge", "arif_seal"];
  if (targetToolName && protectedNames.includes(targetToolName)) {
    score = 0.0;
    rationale.push(`V↓: protected meta-tool name — cannot forge "${targetToolName}"`);
  }

  // forge_ prefix convention
  if (targetToolName && !targetToolName.startsWith("forge_") && !targetToolName.startsWith("arif_")) {
    score -= 0.1;
    rationale.push(`V↓: tool name does not follow forge_/arif_ convention`);
  }

  return { score: clamp01(score), rationale };
}

/**
 * Compute Ψ — constitutional stability.
 *
 * Ψ measures: does this preserve constitutional equilibrium?
 *
 * Checks F1 (reversibility), F8 (system boundary), F11 (audit trail).
 */
export function computePsi(haramFindings: number, implementation: string): { score: number; rationale: string[] } {
  const rationale: string[] = [];
  let score = 1.0;

  // HARAM patterns — direct constitutional violation
  if (haramFindings > 0) {
    score -= Math.min(0.7, haramFindings * 0.15);
    rationale.push(`Ψ↓: ${haramFindings} HARAM pattern(s) detected`);
  } else {
    rationale.push(`Ψ↑: HARAM scan clean`);
  }

  // F8 system boundary — does it touch protected paths?
  const boundaryViolations = [
    /\/root\/.secrets/,
    /\/etc\/passwd/,
    /\/etc\/shadow/,
    /\.env/,
  ];
  const boundaryHits = boundaryViolations.filter(p => p.test(implementation)).length;
  if (boundaryHits > 0) {
    score -= 0.4;
    rationale.push(`Ψ↓: ${boundaryHits} system boundary violation(s)`);
  } else {
    rationale.push(`Ψ↑: no system boundary violations`);
  }

  // F1 reversibility — does it have irreversible operations?
  const irreversiblePatterns = [/\brm\s+-rf\b/, /\bDROP\b/i, /delete\s+from/i, /truncate/i];
  const irreversibleHits = irreversiblePatterns.filter(p => p.test(implementation)).length;
  if (irreversibleHits > 0) {
    score -= 0.3;
    rationale.push(`Ψ↓: ${irreversibleHits} irreversible operation(s) — F1 AMANAH pressure`);
  }

  // F11 audit — does it write to VAULT999 directly?
  if (/VAULT999|vault_seal|vault\.write/i.test(implementation) && !/seal_verdict_id/.test(implementation)) {
    score -= 0.2;
    rationale.push(`Ψ↓: VAULT999 write without seal_verdict_id reference`);
  }

  return { score: clamp01(score), rationale };
}

/**
 * Compute Φ — wisdom.
 *
 * Φ measures: alignment with Scar Law + prior sealed verdicts.
 *
 * Scars reduce Φ. More recent + more severe = more pressure.
 * Scar Law: errors become constitutional constraints.
 */
export function computePhi(scars: Scar[]): { score: number; rationale: string[]; totalPressure: number } {
  const rationale: string[] = [];
  let score = 1.0;
  let totalPressure = 0;

  if (scars.length === 0) {
    rationale.push(`Φ↑: no prior scars — clean wisdom`);
    return { score, rationale, totalPressure: 0 };
  }

  for (const scar of scars) {
    // Severity multiplier
    const severityMult: Record<Scar["severity"], number> = {
      LOW: 0.3,
      MEDIUM: 0.5,
      HIGH: 0.8,
      CRITICAL: 1.0,
    };
    const pressure = scar.scar_pressure * severityMult[scar.severity];
    totalPressure += pressure;
    score -= pressure;
    rationale.push(`Φ↓: scar ${scar.scar_id} (${scar.severity}) pressure=${pressure.toFixed(2)} — ${scar.failure_mode.slice(0, 60)}`);
  }

  rationale.push(`Φ: total scar pressure=${totalPressure.toFixed(2)} from ${scars.length} scar(s)`);
  return { score: clamp01(score), rationale, totalPressure };
}

/**
 * The Decision Field.
 *
 * G = Q · V · Ψ · Φ
 *
 * Returns the full field with verdict.
 */
export function computeDecisionField(params: {
  intent: string;
  domain: SkillDomain;
  targetToolName?: string;
  haramFindings: number;
  implementation: string;
  scars: Scar[];
}): DecisionField {
  const { intent, domain, targetToolName, haramFindings, implementation, scars } = params;

  const Q = computeQ(intent, domain);
  const V = computeV(domain, targetToolName);
  const Psi = computePsi(haramFindings, implementation);
  const Phi = computePhi(scars);

  const G = Q.score * V.score * Psi.score * Phi.score;

  const rationale = [
    `Decision Field G = Q·V·Ψ·Φ`,
    `Q=${Q.score.toFixed(3)} V=${V.score.toFixed(3)} Ψ=${Psi.score.toFixed(3)} Φ=${Phi.score.toFixed(3)}`,
    `G=${G.toFixed(3)}`,
    ...Q.rationale,
    ...V.rationale,
    ...Psi.rationale,
    ...Phi.rationale,
  ];

  // Verdict from G — organism-layer physics (not constitutional verdicts)
  // Vocabulary: CRYSTALLIZE/NUCLEATE/DORMANT/WITHER (arifOS SEAL/SABAR/HOLD/VOID reserved)
  let verdict: DecisionField["verdict"];
  if (Phi.score < 0.10) {
    verdict = "WITHER";
    rationale.push(`⚖️ VERDICT=WITHER: Φ<0.10 — Scar Law pressure prevents formation`);
  } else if (Psi.score < 0.30) {
    verdict = "WITHER";
    rationale.push(`⚖️ VERDICT=WITHER: Ψ<0.30 — constitutional instability`);
  } else if (V.score < 0.20) {
    verdict = "DORMANT";
    rationale.push(`⚖️ VERDICT=DORMANT: V<0.20 — no federation purpose`);
  } else if (Q.score < 0.20) {
    verdict = "NUCLEATE";
    rationale.push(`⚖️ VERDICT=NUCLEATE: Q<0.20 — intent too vague, wait for clarity`);
  } else if (G >= 0.5) {
    verdict = "CRYSTALLIZE";
    rationale.push(`⚖️ VERDICT=CRYSTALLIZE: G≥0.50 — tool has sufficient action potential`);
  } else if (G >= 0.25) {
    verdict = "NUCLEATE";
    rationale.push(`⚖️ VERDICT=NUCLEATE: 0.25≤G<0.50 — register with conditions`);
  } else if (G >= 0.10) {
    verdict = "DORMANT";
    rationale.push(`⚖️ VERDICT=DORMANT: 0.10≤G<0.25 — insufficient energy`);
  } else {
    verdict = "WITHER";
    rationale.push(`⚖️ VERDICT=WITHER: G<0.10 — cannot accumulate enough action potential`);
  }

  return {
    Q: Q.score,
    V: V.score,
    Psi: Psi.score,
    Phi: Phi.score,
    G,
    verdict,
    rationale,
  };
}

/**
 * Theta (Θ) = dΦ/dt — wisdom trajectory.
 *
 * Compares current Φ to historical samples for a tool.
 * Negative Θ = wisdom eroding over time → escalate.
 */
export function computeTheta(samples: Array<{ timestamp: string; phi: number; scar_pressure: number }>): {
  theta: number;
  verdict: "GROWING" | "STABLE" | "ERODING" | "COLLAPSING";
} {
  if (samples.length < 2) {
    return { theta: 0, verdict: "STABLE" };
  }

  // Linear regression on phi over time
  const n = samples.length;
  const t0 = new Date(samples[0].timestamp).getTime();
  const xs = samples.map(s => (new Date(s.timestamp).getTime() - t0) / 1000); // seconds
  const ys = samples.map(s => s.phi);

  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  // Normalize: per-day rate
  const theta = slope * 86400;

  let verdict: "GROWING" | "STABLE" | "ERODING" | "COLLAPSING";
  if (theta > 0.01) verdict = "GROWING";
  else if (theta > -0.01) verdict = "STABLE";
  else if (theta > -0.1) verdict = "ERODING";
  else verdict = "COLLAPSING";

  return { theta, verdict };
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}