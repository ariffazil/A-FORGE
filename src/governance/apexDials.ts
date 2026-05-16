/**
 * APEX Dials — Eigendecomposition from 13 Constitutional Floors
 *
 * K777_APEX §10.4: The 4 APEX dials (A/P/X/E) are NOT independent inputs.
 * They are principal components derived from the 13 floor scores via geometric mean clusters.
 *
 * G = A × P × X × E²
 *
 * Floor → Dial cluster mapping:
 *   A (Akal/Mind):    F2, F4, F7, F10    → Truth, Clarity, Humility, Ontology
 *   P (Present/Peace): F1, F5, F11        → Amanah, Peace, Command
 *   X (eXplore):       F3, F6, F8, F9      → Tri-Witness, Empathy, Genius, Anti-Hantu
 *   E (Energy):       F12, F13            → Injection, Sovereign
 *
 * @module governance/apexDials
 * @constitutional K777_APEX §10.4 — Eigendecomposition
 */

export interface ApexDials {
  A: number;  // Akal (Mind/Intellect) — geometric mean of F2×F4×F7×F10
  P: number;  // Present (Peace/Stability) — geometric mean of F1×F5×F11
  X: number;  // eXplore (Curiosity/Navigation) — geometric mean of F3×F6×F8×F9
  E: number;  // Energy (Vitality/Endurance) — F12×F13 + compute ratio
}

export interface ApexGeniusResult {
  dials: ApexDials;
  G: number;
  G_threshold: number;
  passed: boolean;
  verdict: "SEAL" | "SABAR" | "VOID";
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

export function floorsToDials(
  floors: FloorScores13,
  computeBudgetUsed = 0.5,
  computeBudgetMax = 1.0,
): ApexDials {
  // A = AKAL (Mind/Clarity) — geometric mean of truth cluster
  // Floors: F2 (Truth), F4 (Clarity), F7 (Humility), F10 (Ontology)
  const A = geometricMean([
    floors.f2_truth,
    floors.f4_clarity,
    floors.f7_humility,
    floors.f10_ontology,
  ]);

  // P = PRESENT (Stability) — geometric mean of trust cluster
  // Floors: F1 (Amanah), F5 (Peace), F11 (Command)
  const P = geometricMean([
    floors.f1_amanah,
    floors.f5_peace,
    floors.f11_command,
  ]);

  // X = EXPLORATION (Navigation) — geometric mean of heart cluster
  // Floors: F3 (Tri-Witness), F6 (Empathy), F8 (Genius), F9 (Anti-Hantu)
  const X = geometricMean([
    floors.f3_tri_witness,
    floors.f6_empathy,
    floors.f8_genius,
    floors.f9_antihantu,
  ]);

  // E = ENERGY (Vitality) — system resources + boundary floors
  // Floors: F12 (Injection defense), F13 (Sovereign)
  // Plus: thermodynamic energy ratio
  const energyFromFloors = geometricMean([
    floors.f12_injection,
    floors.f13_sovereign,
  ]);
  const energyRatio = 1 - Math.min(computeBudgetUsed / Math.max(computeBudgetMax, 1e-6), 1);
  const E = (energyFromFloors + energyRatio) / 2;

  return { A, P, X, E };
}

export function calculateGeniusFromFloors(
  floors: FloorScores13,
  computeBudgetUsed = 0.5,
  computeBudgetMax = 1.0,
): ApexGeniusResult {
  const dials = floorsToDials(floors, computeBudgetUsed, computeBudgetMax);

  // Calculate G using the constitutional formula: G = A × P × X × E²
  const E_squared = dials.E ** 2;
  const G = dials.A * dials.P * dials.X * E_squared;

  const G_threshold = 0.80;

  // Determine verdict based on G threshold
  let verdict: "SEAL" | "SABAR" | "VOID";
  if (G >= G_threshold) {
    verdict = "SEAL";
  } else if (G >= 0.60) {
    verdict = "SABAR";
  } else {
    verdict = "VOID";
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
║  APEX 888 JUDGE — GENIUS INDEX           ║
╠══════════════════════════════════════════╣
║  A (Mind):    ${result.dials.A.toFixed(2)} ${bars(result.dials.A)}         ║
║  P (Peace):   ${result.dials.P.toFixed(2)} ${bars(result.dials.P)}         ║
║  X (Explore): ${result.dials.X.toFixed(2)} ${bars(result.dials.X)}         ║  ${result.weakest_dial === "X" ? "← WEAKEST" : ""}
║  E (Energy):  ${result.dials.E.toFixed(2)} ${bars(result.dials.E)}         ║
╠══════════════════════════════════════════╣
║  G = ${result.dials.A.toFixed(2)} × ${result.dials.P.toFixed(2)} × ${result.dials.X.toFixed(2)} × ${result.dials.E.toFixed(2)}²          ║
║  G = ${result.G.toFixed(3)} (threshold: ${result.G_threshold})             ║
╠══════════════════════════════════════════╣
║  VERDICT: ${pad(result.verdict, 5)}                              ║
║  REASON: ${result.passed ? "All floors passed" : `Weakest: ${result.weakest_dial} = ${result.weakest_value.toFixed(2)}`}   ║
╚══════════════════════════════════════════╝`.trim();
}
