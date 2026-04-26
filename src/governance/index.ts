/**
 * arifOS 13 Floors — Governance Enforcement Modules
 *
 * Minimal, correct implementations for missing/upgrade floors.
 * Plugs into A-FORGE distributed enforcement mesh.
 *
 * @module governance
 * @constitutional F1-F13 — Full constitutional coverage
 */

// F3: Input Clarity (NEW)
export { validateInputClarity, type ClarityResult, type ClarityVerdict, type ClarityThresholds } from "./f3InputClarity.js";

// Adaptive Thresholds
export { getAdaptiveThresholds, type AdaptiveThresholds, type IntentModel, type RiskLevel } from "./thresholds.js";

// F4: Entropy (UPGRADE)
export { checkEntropy, calculateRisk, type EntropyResult, type EntropyVerdict } from "./f4Entropy.js";

// F6: Harm/Dignity (NEW)
export { checkHarmDignity, checkToolHarm, type HarmResult, type HarmVerdict } from "./f6HarmDignity.js";

// F7: Confidence (NEW)
export { checkConfidence, computeConfidence, type ConfidenceResult, type ConfidenceVerdict, type ConfidenceThresholds } from "./f7Confidence.js";

// F8: Grounding (UPGRADE)
export { checkGrounding, countEvidence, type GroundingResult, type GroundingVerdict } from "./f8Grounding.js";

// F9: Injection (UPGRADE)
export { checkInjection, redactSecrets, type InjectionResult, type InjectionVerdict } from "./f9Injection.js";

// F11: Coherence (NEW)
export { checkCoherence, checkResponseCoherence, type CoherenceResult, type CoherenceVerdict } from "./f11Coherence.js";

// W0: WELL Readiness (NEW)
export { checkWellReadiness, type WellReadinessResult, type WellVerdict } from "./wellReadiness.js";

// F1: Amanah Lock Manager (SERI_KEMBANGAN_ACCORDS Phase 1)
export { AmanahLockManager, type AmanahLockRecord, type AcquireResult, type ReleaseResult } from "./AmanahLockManager.js";

// F4: Pre-flight Entropy Guard (SERI_KEMBANGAN_ACCORDS Phase 3)
export { runPreflight, type PreflightResult, type PreflightStatus } from "./preflight.js";

// Seal Service
export { SealService, type SealContext, type SealVerdict, type SealStatus, type EpistemicVerdict, type EpistemicThresholds } from "./SealService.js";

// APEX Dials — Eigendecomposition from 13 Floors (K777_APEX §10.4)
export { floorsToDials, calculateGeniusFromFloors, formatApexDisplay, type ApexDials, type ApexGeniusResult, type FloorScores13 } from "./apexDials.js";

// Governance Client abstraction
export {
  LocalGovernanceClient,
  HttpGovernanceClient,
  type GovernanceClient,
  type GovernanceRequest,
  type GovernanceResponse,
  type GovernanceVerdict,
} from "./GovernanceClient.js";

// A-FORGE ↔ arifOS Risk Tier Bridge (T0-T3 classification)
export {
  GovernanceBridge,
  SABARHaltError,
  type RiskTier,
  type RiskClassificationResult,
  type GovernanceBridgeOptions,
} from "./GovernanceBridge.js";

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
// ═══════════════════════════════════════════════════════════════════════════════
// F2, F10, F12 — Minimal hardened implementations (no new files)
// ═══════════════════════════════════════════════════════════════════════════════

export interface TruthResult {
  verdict: "PASS" | "HOLD";
  message?: string;
  ungroundedClaims: number;
  evidenceMarkers: string[];
  certaintyMatches: string[];
  claimReferences: Array<{ claim: string; evidence: boolean }>;
}

export function checkTruth(text: string, evidenceCount: number): TruthResult {
  const certaintyPatterns = /\b(definitely|absolutely|certainly|without a doubt|undeniably|irrefutably|100% sure)\b/gi;
  const evidenceMarkers = /\b(according to|evidence shows|source:|citation|referenced in|as reported by)\b/gi;
  const certaintyMatches = Array.from(text.matchAll(certaintyPatterns)).map((m) => m[0]);
  const evidenceMarkerMatches = Array.from(text.matchAll(evidenceMarkers)).map((m) => m[0]);
  const ungroundedClaims = Math.max(0, certaintyMatches.length - evidenceMarkerMatches.length);
  const claimReferences = certaintyMatches.map((claim) => ({
    claim,
    evidence: evidenceMarkerMatches.length > 0,
  }));
  if (ungroundedClaims > 0 && evidenceCount < 2) {
    return {
      verdict: "HOLD",
      message: `F2 Truth: ${ungroundedClaims} ungrounded claim(s) detected with insufficient evidence (${evidenceCount})`,
      ungroundedClaims,
      evidenceMarkers: evidenceMarkerMatches,
      certaintyMatches,
      claimReferences,
    };
  }
  return {
    verdict: "PASS",
    ungroundedClaims,
    evidenceMarkers: evidenceMarkerMatches,
    certaintyMatches,
    claimReferences,
  };
}

export interface PrivacyResult {
  verdict: "PASS" | "VOID";
  message?: string;
  patternsFound: string[];
  secretClasses: Array<{ class: string; count: number }>;
  redactionRequired: boolean;
  quarantineRecommended: boolean;
}

export function checkPrivacy(text: string): PrivacyResult {
  const patterns: Array<{ name: string; regex: RegExp; secretClass: string; quarantine: boolean }> = [
    { name: "EMAIL", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, secretClass: "contact", quarantine: false },
    { name: "PHONE", regex: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, secretClass: "contact", quarantine: false },
    { name: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g, secretClass: "identity", quarantine: true },
    { name: "CREDIT_CARD", regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, secretClass: "financial", quarantine: true },
  ];
  const found: string[] = [];
  const secretClasses: Array<{ class: string; count: number }> = [];
  let quarantineRecommended = false;
  for (const p of patterns) {
    const matches = Array.from(text.matchAll(p.regex));
    if (matches.length > 0) {
      found.push(p.name);
      const existing = secretClasses.find((s) => s.class === p.secretClass);
      if (existing) {
        existing.count += matches.length;
      } else {
        secretClasses.push({ class: p.secretClass, count: matches.length });
      }
      if (p.quarantine) quarantineRecommended = true;
    }
  }
  if (found.length > 0) {
    return {
      verdict: "VOID",
      message: `F10 Privacy: Potential PII detected (${found.join(", ")})`,
      patternsFound: found,
      secretClasses,
      redactionRequired: true,
      quarantineRecommended,
    };
  }
  return {
    verdict: "PASS",
    patternsFound: [],
    secretClasses: [],
    redactionRequired: false,
    quarantineRecommended: false,
  };
}

export interface StewardshipResult {
  verdict: "PASS" | "HOLD";
  message?: string;
  resourceScore: number;
  metrics: {
    turnPressure: number;
    toolPressure: number;
    blockedPressure: number;
    errorPressure: number;
  };
}

export function checkStewardship(
  turnCount: number,
  toolCallCount: number,
  maxTurns: number,
  blockedCommands: number,
  errorMessage?: string,
): StewardshipResult {
  const turnPressure = turnCount > maxTurns * 0.8 ? 0.4 : 0;
  const toolPressure = toolCallCount > 20 ? 0.3 : 0;
  const blockedPressure = blockedCommands > 0 ? 0.2 : 0;
  const errorPressure = errorMessage ? 0.1 : 0;
  const resourceScore = turnPressure + toolPressure + blockedPressure + errorPressure;
  if (resourceScore > 0.5) {
    return {
      verdict: "HOLD",
      message: `F12 Stewardship: Resource pressure detected (turns=${turnCount}, tools=${toolCallCount}, blocked=${blockedCommands})`,
      resourceScore,
      metrics: { turnPressure, toolPressure, blockedPressure, errorPressure },
    };
  }
  return {
    verdict: "PASS",
    resourceScore,
    metrics: { turnPressure, toolPressure, blockedPressure, errorPressure },
  };
}

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


