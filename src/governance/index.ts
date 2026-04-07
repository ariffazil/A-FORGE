/**
 * arifOS 13 Floors — Governance Enforcement Modules
 *
 * Minimal, correct implementations for missing/upgrade floors.
 * Plugs into AF-FORGE distributed enforcement mesh.
 *
 * @module governance
 * @constitutional F1-F13 — Full constitutional coverage
 */

// F3: Input Clarity (NEW)
export { validateInputClarity, type ClarityResult, type ClarityVerdict } from "./f3InputClarity.js";

// F4: Entropy (UPGRADE)
export { checkEntropy, calculateRisk, type EntropyResult, type EntropyVerdict } from "./f4Entropy.js";

// F6: Harm/Dignity (NEW)
export { checkHarmDignity, checkToolHarm, type HarmResult, type HarmVerdict } from "./f6HarmDignity.js";

// F7: Confidence (NEW)
export { checkConfidence, computeConfidence, type ConfidenceResult, type ConfidenceVerdict } from "./f7Confidence.js";

// F8: Grounding (UPGRADE)
export { checkGrounding, countEvidence, type GroundingResult, type GroundingVerdict } from "./f8Grounding.js";

// F9: Injection (UPGRADE)
export { checkInjection, redactSecrets, type InjectionResult, type InjectionVerdict } from "./f9Injection.js";

// F11: Coherence (NEW)
export { checkCoherence, checkResponseCoherence, type CoherenceResult, type CoherenceVerdict } from "./f11Coherence.js";

/**
 * Unified governance check — runs all applicable floors.
 * Returns first non-PASS verdict or PASS if all clear.
 */
import type { ClarityResult } from "./f3InputClarity.js";
import type { HarmResult } from "./f6HarmDignity.js";
import type { InjectionResult } from "./f9Injection.js";
import type { GroundingResult } from "./f8Grounding.js";
import type { ConfidenceResult } from "./f7Confidence.js";
import type { CoherenceResult } from "./f11Coherence.js";
import type { EntropyResult } from "./f4Entropy.js";

export type GovernanceCheck =
  | { floor: "F3"; result: ClarityResult }
  | { floor: "F4"; result: EntropyResult }
  | { floor: "F6"; result: HarmResult }
  | { floor: "F7"; result: ConfidenceResult }
  | { floor: "F8"; result: GroundingResult }
  | { floor: "F9"; result: InjectionResult }
  | { floor: "F11"; result: CoherenceResult };

export type FloorVerdict = "PASS" | "SABAR" | "HOLD" | "VOID";

export interface GovernanceSummary {
  finalVerdict: FloorVerdict;
  checks: GovernanceCheck[];
  blockingFloor?: string;
  message?: string;
}

/**
 * Get unified verdict from all checks.
 */
export function summarizeGovernance(checks: GovernanceCheck[]): GovernanceSummary {
  const priority: FloorVerdict[] = ["VOID", "HOLD", "SABAR", "PASS"];

  for (const verdict of priority) {
    const blocking = checks.find((c) => c.result.verdict === verdict);
    if (blocking) {
      return {
        finalVerdict: verdict,
        checks,
        blockingFloor: blocking.floor,
        message: blocking.result.message,
      };
    }
  }

  return {
    finalVerdict: "PASS",
    checks,
  };
}
