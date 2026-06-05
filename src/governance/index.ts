/**
 * arifOS 13 Floors — Governance Enforcement Modules
 *
 * Minimal, correct implementations for missing/upgrade floors.
 * Plugs into A-FORGE distributed enforcement mesh.
 *
 * @module governance
 * @constitutional F1-F13 — Full constitutional coverage
 */

// F3: Witness (NEW)
export { checkWitness, type WitnessResult, type WitnessVerdict, type WitnessThresholds } from "./f3Witness.js";

// Adaptive Thresholds
export { getAdaptiveThresholds, type AdaptiveThresholds, type IntentModel, type RiskLevel } from "./thresholds.js";

// F4: Clarity (UPGRADE)
export { checkClarity, calculateRisk, type ClarityResult, type ClarityVerdict } from "./f4Clarity.js";

// F6: Empathy (NEW)
export { checkEmpathy, checkToolHarm, type EmpathyResult, type EmpathyVerdict } from "./f6Empathy.js";

// F7: Humility (NEW)
export { checkHumility, computeHumility, type HumilityResult, type HumilityVerdict, type HumilityThresholds } from "./f7Humility.js";

// F8: Genius (UPGRADE)
export { checkGenius, countEvidence, type GeniusResult, type GeniusVerdict } from "./f8Genius.js";

// F9: Anti-Hantu (UPGRADE)
export { checkAntiHantu, redactSecrets, type AntiHantuResult, type AntiHantuVerdict } from "./f9AntiHantu.js";

// F11: Coherence (honest names — no auth alias)
export {
  checkCoherence,
  checkResponseCoherence,
  checkToolOutputCoherence,
  type CoherenceResult,
  type CoherenceVerdict,
} from "./f11Coherence.js";

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

// Advisory-only risk assessments (F2, F10, F12 downgraded per PHOENIX-99)
export {
  adviseTruth,
  advisePrivacy,
  adviseStewardship,
  type AdvisoryResult,
} from "../governance/governanceAdvisory.js";
