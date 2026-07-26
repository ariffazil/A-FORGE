/**
 * APEX Dials — Eigendecomposition from 13 Constitutional Laws
 *
 * CANONICAL REFERENCE: /root/AAA/docs/APEX_T000_THEOREM.md (ratified 2026-07-26)
 * This file is the RUNTIME IMPLEMENTATION of the canonical theorem.
 * If these two diverge, the canonical theorem wins. Update this file to match.
 *
 * G = (A · P · E · X)^(1/4)  — geometric mean (Nash bargaining product)
 *
 * Floor → Dial cluster mapping (CANONICAL T-000 §2):
 *   A (AKAL):          F2, F4, F7, F10    → Truth, Clarity, Humility, Ontology
 *   P (PRESENT_AUTHORITY): F1, F5, F11, F13 → Amanah, Peace, Audit, Sovereign
 *   E (ENTROPY×ENERGY): F3, F4, F12, Energy₁, Energy₂ → Witness, Clarity, Resilience, Energy×2
 *   X (EXPLORATION×AMANAH): F6, F8, F9, Risk → Empathy, Genius, Anti-Hantu, Risk
 *
 * NOTE: F4 (CLARITY) appears in both A and E — this is intentional. Cross-cutting.
 * NOTE: Energy appears TWICE in E (squared drag) — thermodynamic stability is the hardest property.
 *
 * APEX-MCP-001 Extension: 10-Gate Runtime Governance Envelope (legacy — retained for compat)
 *   [Cognitive] Amanah · Presence · Humility · Signal · Understanding · Energy
 *   [Kernel]    Authority · Reversibility · Proof · Sovereign
 *
 * @module governance/apexDials
 * @constitutional APEX_T000_THEOREM.md — CANONICALLY RATIFIED 2026-07-26
 * @patch 2026-07-26 — F3 moved from X→E, F13 moved from E→P, G formula changed to geometric mean
 */

export interface ApexDials {
  A: number;  // AKAL (Lawful Reasoning) — GM(F2, F4, F7, F10)
  P: number;  // PRESENT AUTHORITY — GM(F1, F5, F11, F13)
  E: number;  // ENTROPY × ENERGY — GM(F3, F4, F12, Energy₁, Energy₂)
  X: number;  // EXPLORATION × AMANAH — GM(F6, F8, F9, Risk)
}

// ── APEX-MCP-001: 10-Gate Runtime Governance Envelope ─────────────────────

export interface ApexGateVerdict {
  pass: boolean;
  score: number;  // [0,1]
  detail: string;
  boundary?: "LIVE" | "CACHED" | "INFERRED";
  action_class?: "READ" | "MUTATE" | "ATOMIC" | "IRREVERSIBLE";
  proof_level?: "ZKPC_NONE" | "ZKPC_OBSERVATION" | "ZKPC_AUDIT" | "ZKPC_CERTAINTY";
  actor_id?: string;
}

export interface Apex10Gates {
  amanah: ApexGateVerdict;
  presence: ApexGateVerdict;
  humility: ApexGateVerdict;
  signal: ApexGateVerdict;
  understanding: ApexGateVerdict;
  energy: ApexGateVerdict;
  authority: ApexGateVerdict;
  reversibility: ApexGateVerdict;
  proof: ApexGateVerdict;
  sovereign: ApexGateVerdict;
}

export interface Apex6Dials {
  A: number;  // AKAL — amanah × humility × understanding
  P: number;  // PRESENCE — presence gate
  H: number;  // AUTHORITY — min(authority, sovereign)
  S: number;  // SIGNAL — signal gate
  U: number;  // UNDERSTANDING — reversibility × proof
  E: number;  // ENERGY — energy gate
}

export interface ApexEnvelope {
  equation: string;
  gates: Apex10Gates;
  dials: Apex6Dials;
  G: number;
  verdict: "SEAL" | "SABAR" | "HOLD" | "VOID";
  weakest_gate: string;
  spec: "APEX-MCP-001";
  version: string;
  timestamp: string;
}

export interface ApexGeniusResult {
  dials: ApexDials;
  G: number;
  G_threshold: number;
  passed: boolean;
  verdict: "SEAL" | "SABAR" | "HOLD";  // canonical T-000 §3: VOID reserved for hard floor breach
  weakest_dial: keyof ApexDials;
  weakest_value: number;
  derivation: "eigendecomposition_of_13_floors";
  provenance: "constitutional_measurement";
}

export interface FloorScores13 {
  f1_amanah: number;      // Reversibility [0,1]
  f2_truth: number;        // Confidence [0,1]
  f3_tri_witness: number;  // Consensus [0,1]
  f4_clarity: number;      // Entropy reduction [0,1]
  f5_peace: number;        // Peace squared [0,1]
  f6_empathy: number;      // Resonance [0,1]
  f7_humility: number;     // Uncertainty band [0,1]
  f8_genius: number;       // Previous G [0,1]
  f9_antihantu: number;   // Shadow detection [0,1]
  f10_ontology: number;    // Type safety [0,1]
  f11_command: number;     // Authority [0,1]
  f12_injection: number;   // Defense [0,1]
  f13_sovereign: number;   // Human presence [0,1]
}

function geometricMean(values: number[]): number {
  const positive = values.filter((v) => v > 0);
  if (positive.length === 0) return 0;
  const product = positive.reduce((acc, v) => acc * v, 1);
  return Math.pow(product, 1 / positive.length);
}

// ── 10-Gate Verdict Builders ──────────────────────────────────────────────

function amanahGate(confidence: number, evidenceStrength: number): ApexGateVerdict {
  const c = Math.max(0, Math.min(1, confidence));
  const e = Math.max(0, Math.min(1, evidenceStrength));
  return {
    pass: c <= e + 0.05,
    score: Math.min(1, e / Math.max(c, 1e-6)),
    detail: `confidence ${c.toFixed(2)} ${c <= e + 0.05 ? "<=" : ">"} evidence ${e.toFixed(2)}`,
  };
}

function presenceGate(boundary: "LIVE" | "CACHED" | "INFERRED"): ApexGateVerdict {
  const scores = { LIVE: 1.0, CACHED: 0.8, INFERRED: 0.5 };
  return { pass: true, score: scores[boundary] ?? 0.5, detail: boundary, boundary };
}

function humilityGate(uncertaintyDeclared: boolean, band?: [number, number]): ApexGateVerdict {
  if (uncertaintyDeclared) {
    const detail = band ? `uncertainty band [${band[0].toFixed(2)}, ${band[1].toFixed(2)}]` : "uncertainty declared";
    return { pass: true, score: 1.0, detail };
  }
  return { pass: false, score: 0.3, detail: "no uncertainty declared" };
}

function signalGate(evidenceRefCount: number, quality: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN"): ApexGateVerdict {
  const qScores = { HIGH: 1.0, MEDIUM: 0.7, LOW: 0.4, UNKNOWN: 0.2 };
  const q = qScores[quality] ?? 0.2;
  if (evidenceRefCount === 0) return { pass: false, score: 0.2, detail: "no evidence refs" };
  const score = Math.min(1, q * Math.min(1, evidenceRefCount / 2));
  return { pass: score >= 0.3, score, detail: `${evidenceRefCount} evidence refs, quality ${quality}` };
}

function understandingGate(coherent: boolean, chainLength = 0): ApexGateVerdict {
  if (coherent) {
    return { pass: true, score: Math.min(1, 0.7 + 0.1 * Math.min(chainLength, 3)), detail: "coherent reasoning chain" };
  }
  return { pass: false, score: 0.2, detail: "reasoning incoherence detected" };
}

function energyGate(costUsed: number, costBudget: number, landauerRatio = 1.0): ApexGateVerdict {
  const budget = Math.max(costBudget, 1e-6);
  const ratio = costUsed / budget;
  let score = ratio <= 1 ? Math.max(0, 1 - ratio * 0.5) : Math.max(0, 1 - ratio);
  let pass = ratio <= 1;
  let detail = `cost ${ratio.toFixed(2)} ${pass ? "<=" : ">"} budget 1.0`;
  if (landauerRatio < 1.0) {
    score = Math.min(score, 0.3);
    pass = false;
    detail += `; Landauer ratio ${landauerRatio.toFixed(2)} < 1.0`;
  }
  return { pass, score, detail };
}

function authorityGate(actorId?: string, registry?: Set<string>): ApexGateVerdict {
  if (!actorId) return { pass: false, score: 0, detail: "no actor_id provided" };
  if (registry && !registry.has(actorId)) return { pass: false, score: 0, detail: `actor '${actorId}' not in registry` };
  return { pass: true, score: 1.0, detail: `actor '${actorId}' verified`, actor_id: actorId };
}

function reversibilityGate(actionClass: "READ" | "MUTATE" | "ATOMIC" | "IRREVERSIBLE"): ApexGateVerdict {
  const scores = { READ: 1.0, MUTATE: 0.8, ATOMIC: 0.5, IRREVERSIBLE: 0.2 };
  return {
    pass: actionClass !== "IRREVERSIBLE",
    score: scores[actionClass] ?? 0.5,
    detail: `${actionClass} action_class`,
    action_class: actionClass,
  };
}

function proofGate(proofLevel: string, actionClass: string): ApexGateVerdict {
  const required: Record<string, string> = { READ: "ZKPC_NONE", MUTATE: "ZKPC_OBSERVATION", ATOMIC: "ZKPC_AUDIT", IRREVERSIBLE: "ZKPC_CERTAINTY" };
  const order: Record<string, number> = { ZKPC_NONE: 0, ZKPC_OBSERVATION: 1, ZKPC_AUDIT: 2, ZKPC_CERTAINTY: 3 };
  const req = required[actionClass] ?? "ZKPC_OBSERVATION";
  const have = order[proofLevel] ?? 0;
  const need = order[req] ?? 1;
  return {
    pass: have >= need,
    score: Math.min(1, have / Math.max(need, 1)),
    detail: `${proofLevel} ${have >= need ? ">=" : "<"} required ${req} for ${actionClass}`,
    proof_level: proofLevel as ApexGateVerdict["proof_level"],
  };
}

function sovereignGate(f13Halt: boolean, humanPresent: boolean, actionClass: string): ApexGateVerdict {
  if (f13Halt) return { pass: false, score: 0, detail: "F13 halt active — VOID" };
  if (actionClass === "IRREVERSIBLE" && !humanPresent) return { pass: false, score: 0, detail: "IRREVERSIBLE without human present — HOLD" };
  return { pass: true, score: 1.0, detail: "no F13 halt active" };
}

// ── 10 Gates → 6 Dials → G ───────────────────────────────────────────────

export function gatesToDials6(gates: Apex10Gates): Apex6Dials {
  const A = geometricMean([gates.amanah.score, gates.humility.score, gates.understanding.score]);
  const P = gates.presence.score;
  const H = Math.min(gates.authority.score, gates.sovereign.score);
  const S = gates.signal.score;
  const U = geometricMean([gates.reversibility.score, gates.proof.score]);
  const E = gates.energy.score;
  return { A, P, H, S, U, E };
}

/**
 * Local 6-dial product for actuator envelopes — NOT kernel G-fold.
 * Canonical G: arif_think(mode='apex') → apex_canonical (Python Δ).
 * @see gAuthority.ts — g_authority=local_estimate
 */
export function computeGFrom6Dials(dials: Apex6Dials): number {
  return dials.A * dials.P * dials.H * Math.sqrt(dials.S * dials.U) * dials.E ** 2;
}

export function verdictFromGatesAndG(gates: Apex10Gates, G: number): "SEAL" | "SABAR" | "HOLD" | "VOID" {
  for (const [name, g] of Object.entries(gates)) {
    if (!g.pass) {
      if (name === "sovereign") return "VOID";
      return "HOLD";
    }
  }
  if (G >= 0.80) return "SEAL";
  if (G >= 0.50) return "SABAR";
  return "HOLD";
}

export function weakestGateName(gates: Apex10Gates): string {
  let minScore = Infinity;
  let weakest = "";
  for (const [name, g] of Object.entries(gates)) {
    if (g.score < minScore) { minScore = g.score; weakest = name; }
  }
  return weakest;
}

// ── Main 10-Gate Envelope Builder ─────────────────────────────────────────

export function buildApexEnvelope(params: {
  toolName?: string;
  confidence?: number;
  evidenceStrength?: number;
  boundary?: "LIVE" | "CACHED" | "INFERRED";
  uncertaintyDeclared?: boolean;
  uncertaintyBand?: [number, number];
  evidenceRefCount?: number;
  evidenceQuality?: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  coherent?: boolean;
  reasoningChainLength?: number;
  costUsed?: number;
  costBudget?: number;
  landauerRatio?: number;
  actorId?: string;
  registry?: Set<string>;
  actionClass?: "READ" | "MUTATE" | "ATOMIC" | "IRREVERSIBLE";
  proofLevel?: string;
  f13Halt?: boolean;
  humanPresent?: boolean;
}): ApexEnvelope {
  const gates: Apex10Gates = {
    amanah: amanahGate(params.confidence ?? 0.88, params.evidenceStrength ?? 0.95),
    presence: presenceGate(params.boundary ?? "LIVE"),
    humility: humilityGate(params.uncertaintyDeclared ?? true, params.uncertaintyBand),
    signal: signalGate(params.evidenceRefCount ?? 0, params.evidenceQuality ?? "UNKNOWN"),
    understanding: understandingGate(params.coherent ?? true, params.reasoningChainLength ?? 0),
    energy: energyGate(params.costUsed ?? 0, params.costBudget ?? 1, params.landauerRatio ?? 1),
    authority: authorityGate(params.actorId, params.registry),
    reversibility: reversibilityGate(params.actionClass ?? "READ"),
    proof: proofGate(params.proofLevel ?? "ZKPC_OBSERVATION", params.actionClass ?? "READ"),
    sovereign: sovereignGate(params.f13Halt ?? false, params.humanPresent ?? true, params.actionClass ?? "READ"),
  };
  const dials = gatesToDials6(gates);
  const G = Math.round(computeGFrom6Dials(dials) * 10000) / 10000;
  return {
    equation: "g(t)=A(t)\u00b7P(t)\u00b7H(t)\u00b7\u221a(S(t)\u00b7U(t))\u00b7E(t)\u00b2",
    gates,
    dials: { A: round4(dials.A), P: round4(dials.P), H: round4(dials.H), S: round4(dials.S), U: round4(dials.U), E: round4(dials.E) },
    G,
    verdict: verdictFromGatesAndG(gates, G),
    weakest_gate: weakestGateName(gates),
    spec: "APEX-MCP-001",
    version: "v2026.06.20",
    timestamp: new Date().toISOString(),
  };
}

function round4(n: number): number { return Math.round(n * 10000) / 10000; }

// NOTE: ApexGeniusResult defined above (line 81) — single canonical definition

export function floorsToDials(
  floors: FloorScores13,
  energy1 = 0.5,  // Energy₁: governance-event coverage = events_produced / events_expected
  energy2 = 0.5,  // Energy₂: receipt density (secondary energy signal)
): ApexDials {
  // A = AKAL (Lawful Reasoning) — canonical T-000 §2.1
  // Floors: F2 (Truth), F4 (Clarity), F7 (Humility), F10 (Ontology)
  const A = geometricMean([
    floors.f2_truth,
    floors.f4_clarity,
    floors.f7_humility,
    floors.f10_ontology,
  ]);

  // P = PRESENT AUTHORITY — canonical T-000 §2.2
  // Floors: F1 (Amanah), F5 (Peace), F11 (Audit), F13 (Sovereign)
  const P = geometricMean([
    floors.f1_amanah,
    floors.f5_peace,
    floors.f11_command,  // F11 = Audit/Command
    floors.f13_sovereign,
  ]);

  // E = ENTROPY × ENERGY — canonical T-000 §2.3
  // Floors: F3 (Witness), F4 (Clarity — cross-cutting), F12 (Resilience)
  // Plus: Energy₁ and Energy₂ (governance-event coverage, double-weighted)
  const eFloors = geometricMean([
    floors.f3_tri_witness,
    floors.f4_clarity,    // cross-cutting — also in A
    floors.f12_injection,
  ]);
  const eEnergy = geometricMean([energy1, energy2]);
  // E = GM(F3, F4, F12, Energy₁, Energy₂) — 5 components, energy double-weighted
  const E = geometricMean([eFloors, eFloors, eFloors, energy1, energy2]);
  // Equivalent: GM(F3, F4, F12, Energy₁, Energy₂) where energy appears twice

  // X = EXPLORATION × AMANAH — canonical T-000 §2.4
  // Floors: F6 (Empathy), F8 (Genius), F9 (Anti-Hantu), Risk (exploration safety)
  const riskScore = Math.max(0, Math.min(1, 1 - ((floors.f9_antihantu < 1 ? 0.3 : 0))));
  const X = geometricMean([
    floors.f6_empathy,
    floors.f8_genius,
    floors.f9_antihantu,
    riskScore,
  ]);

  return { A, P, E, X };
}

export function calculateGeniusFromFloors(
  floors: FloorScores13,
  energy1 = 0.5,
  energy2 = 0.5,
): ApexGeniusResult {
  const dials = floorsToDials(floors, energy1, energy2);

  // G = (A · P · E · X)^(1/4) — canonical geometric mean (Nash bargaining product)
  // T-000 §1: All variables normalized [0,1]; G dominated by smallest term
  const G = geometricMean([dials.A, dials.P, dials.E, dials.X]);

  const G_threshold = 0.80;

  // Determine verdict based on G threshold — CANONICAL T-000 §3
  // G ≥ 0.80 → SEAL, G ≥ 0.70 → SABAR, G < 0.70 → HOLD
  // VOID is reserved for hard floor breaches (F13, F9, F10, F12 < 1.0) — NOT computed here
  let verdict: "SEAL" | "SABAR" | "HOLD";
  if (G >= G_threshold) {
    verdict = "SEAL";
  } else if (G >= 0.70) {
    verdict = "SABAR";
  } else {
    verdict = "HOLD";
  }

  // Identify weakest dial
  const dialValues: ApexDials = dials;
  const weakest_dial = (Object.keys(dialValues) as (keyof ApexDials)[]).reduce((weakest, current) =>
    dialValues[current] < dialValues[weakest] ? current : weakest,
  );

  return {
    dials,
    G,
    G_threshold,
    passed: G >= G_threshold,
    verdict,
    weakest_dial,
    weakest_value: dialValues[weakest_dial],
    derivation: "eigendecomposition_of_13_floors",
    provenance: "constitutional_measurement",
  };
}

export function formatApexDisplay(result: ApexGeniusResult): string {
  const bars = (v: number) => "█".repeat(Math.round(v * 12)) + "░".repeat(12 - Math.round(v * 12));
  const pad = (s: string, n: number) => s.padStart(n);

  return `
╔══════════════════════════════════════════╗
║  APEX 888 JUDGE — APEX T-000            ║
╠══════════════════════════════════════════╣
║  A (AKAL):       ${result.dials.A.toFixed(2)} ${bars(result.dials.A)}         ║
║  P (AUTHORITY):  ${result.dials.P.toFixed(2)} ${bars(result.dials.P)}         ║
║  E (ENTROPY):    ${result.dials.E.toFixed(2)} ${bars(result.dials.E)}         ║  ${result.weakest_dial === "E" ? "← WEAKEST" : ""}
║  X (EXPLORATION):${result.dials.X.toFixed(2)} ${bars(result.dials.X)}         ║
╠══════════════════════════════════════════╣
║  G = (A·P·E·X)^(1/4)                   ║
║  G = ${result.G.toFixed(3)} (threshold: ${result.G_threshold})             ║
╠══════════════════════════════════════════╣
║  VERDICT: ${pad(result.verdict, 5)}                              ║
║  REASON: ${result.passed ? "Above SEAL threshold" : `Weakest: ${result.weakest_dial} = ${result.weakest_value.toFixed(2)}`}   ║
╚══════════════════════════════════════════╝`.trim();
}

function gate(
  passed: boolean,
  score: number,
  detail: string,
  extra?: Record<string, unknown>,
): ApexGateVerdict {
  return { pass: passed, score: Math.max(0, Math.min(1, Math.round(score * 10000) / 10000)), detail, ...extra };
}

/**
 * Compute 10 APEX gates from floor scores + runtime signals.
 *
 * Maps 13 floor scores → 10 gates → 6 dials (A, P, H, S, U, E) → G
 *
 * @param floors - 13 constitutional floor scores
 * @param opts - runtime signals (actor, action class, proof level, etc.)
 * @returns APEX 10-gate envelope
 */
export function computeApex10Gates(
  floors: FloorScores13,
  opts: {
    actor_id?: string;
    action_class?: "READ" | "MUTATE" | "ATOMIC" | "IRREVERSIBLE";
    proof_level?: "ZKPC_NONE" | "ZKPC_OBSERVATION" | "ZKPC_AUDIT" | "ZKPC_CERTAINTY";
    boundary?: "LIVE" | "CACHED" | "INFERRED";
    compute_budget_used?: number;
    compute_budget_max?: number;
  } = {},
): ApexEnvelope {
  const {
    actor_id,
    action_class = "READ",
    proof_level = "ZKPC_OBSERVATION",
    boundary = "LIVE",
    compute_budget_used = 0.5,
    compute_budget_max = 1.0,
  } = opts;

  // Gate 1: Amanah — claim ≤ evidence (F2 Truth, F7 Humility)
  const amanahScore = geometricMean([floors.f2_truth, floors.f7_humility]);
  const amanah = gate(true, amanahScore, `truth=${floors.f2_truth.toFixed(2)}, humility=${floors.f7_humility.toFixed(2)}`);

  // Gate 2: Presence — temporal boundary (F1 Amanah, F5 Peace)
  const presenceScores: Record<string, number> = { LIVE: 1.0, CACHED: 0.8, INFERRED: 0.5 };
  const presence = gate(true, presenceScores[boundary] ?? 0.5, boundary, { boundary });

  // Gate 3: Humility — uncertainty explicit (F7 Humility)
  const humility = gate(true, floors.f7_humility, `humility_floor=${floors.f7_humility.toFixed(2)}`);

  // Gate 4: Signal — evidence quality (F3 Tri-Witness, F9 Anti-Hantu)
  const signalScore = geometricMean([floors.f3_tri_witness, floors.f9_antihantu]);
  const signal = gate(signalScore >= 0.3, signalScore, `tri_witness=${floors.f3_tri_witness.toFixed(2)}, antihantu=${floors.f9_antihantu.toFixed(2)}`);

  // Gate 5: Understanding — coherence (F4 Clarity, F10 Ontology)
  const understandingScore = geometricMean([floors.f4_clarity, floors.f10_ontology]);
  const understanding = gate(understandingScore >= 0.5, understandingScore, `clarity=${floors.f4_clarity.toFixed(2)}, ontology=${floors.f10_ontology.toFixed(2)}`);

  // Gate 6: Energy — compute cost (F12 Injection, compute ratio)
  const energyRatio = 1 - Math.min(compute_budget_used / Math.max(compute_budget_max, 1e-6), 1);
  const energyFloorScore = geometricMean([floors.f12_injection, floors.f13_sovereign]);
  const energyScore = (energyFloorScore + energyRatio) / 2;
  const energy = gate(compute_budget_used <= compute_budget_max, energyScore, `budget_ratio=${(1 - energyRatio).toFixed(2)}`);

  // Gate 7: Authority — actor in registry (F11 Command)
  const authorityScore = actor_id ? floors.f11_command : 0.5;
  const authority = gate(!!actor_id, authorityScore, `actor=${actor_id ?? "none"}`, { actor_id });

  // Gate 8: Reversibility — action class (F1 Amanah)
  const acScores: Record<string, number> = { READ: 1.0, MUTATE: 0.8, ATOMIC: 0.5, IRREVERSIBLE: 0.2 };
  const reversibilityScore = acScores[action_class] ?? 0.5;
  const reversibility = gate(action_class !== "IRREVERSIBLE", reversibilityScore, action_class, { action_class });

  // Gate 9: Proof — ZKPC level matches risk
  const proofOrder: Record<string, number> = { ZKPC_NONE: 0, ZKPC_OBSERVATION: 1, ZKPC_AUDIT: 2, ZKPC_CERTAINTY: 3 };
  const requiredProof: Record<string, string> = { READ: "ZKPC_NONE", MUTATE: "ZKPC_OBSERVATION", ATOMIC: "ZKPC_AUDIT", IRREVERSIBLE: "ZKPC_CERTAINTY" };
  const have = proofOrder[proof_level] ?? 1;
  const need = proofOrder[requiredProof[action_class] ?? "ZKPC_OBSERVATION"] ?? 1;
  const proofScore = Math.min(1, have / Math.max(need, 1));
  const proof = gate(have >= need, proofScore, `${proof_level} >= ${requiredProof[action_class]}`, { proof_level });

  // Gate 10: Sovereign — F13 veto (F13 Sovereign)
  const sovereignScore = floors.f13_sovereign;
  const sovereign = gate(sovereignScore > 0.5, sovereignScore, `sovereign=${sovereignScore.toFixed(2)}`);

  // 10 gates → 6 dials
  const gates = { amanah, presence, humility, signal, understanding, energy, authority, reversibility, proof, sovereign };
  const A = geometricMean([amanah.score, humility.score, understanding.score]);
  const P = presence.score;
  const H = Math.min(authority.score, sovereign.score);
  const S = signal.score;
  const U = geometricMean([reversibility.score, proof.score]);
  const E = energy.score;

  const dials = {
    A: Math.round(A * 10000) / 10000,
    P: Math.round(P * 10000) / 10000,
    H: Math.round(H * 10000) / 10000,
    S: Math.round(S * 10000) / 10000,
    U: Math.round(U * 10000) / 10000,
    E: Math.round(E * 10000) / 10000,
  };

  const G = Math.round(A * P * H * Math.sqrt(S * U) * E * E * 10000) / 10000;

  // Verdict: any gate failed → at least HOLD
  let verdict: "SEAL" | "SABAR" | "HOLD" | "VOID" = "SEAL";
  for (const [name, g] of Object.entries(gates)) {
    if (!g.pass) {
      verdict = name === "sovereign" ? "VOID" : "HOLD";
      break;
    }
  }
  if (verdict === "SEAL") {
    verdict = G >= 0.80 ? "SEAL" : G >= 0.50 ? "SABAR" : "HOLD";
  }

  // Find weakest gate
  const weakest_gate = Object.entries(gates).reduce((weakest, [name, g]) =>
    g.score < gates[weakest as keyof typeof gates].score ? name : weakest,
    "amanah",
  );

  return {
    equation: "g(t)=A(t)\u00b7P(t)\u00b7H(t)\u00b7\u221a(S(t)\u00b7U(t))\u00b7E(t)\u00b2",
    gates,
    dials,
    G,
    verdict,
    weakest_gate,
    spec: "APEX-MCP-001",
    version: "v2026.06.20",
    timestamp: new Date().toISOString(),
  };
}
