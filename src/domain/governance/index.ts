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
} from "./governanceAdvisory.js";

// F11: Auth (migrated from legacy index)
export { checkAuth, checkResponseAuth, type AuthResult, type AuthVerdict } from "./f11Auth.js";

// ══════════════════════════════════════════════════════════════════
// WORLD MODEL — Action→Observation Instrumentation (forged 2026-07-21)
// ══════════════════════════════════════════════════════════════════

// worldModel.ts — types, priority classifier, entropy, hashing
export {
  classifyWmPriority,
  isWmEligible,
  hashAction,
  hashObservation,
  observationEntropyProxy,
  computeSurpriseScore,
  computePredictionGap,
  buildWmMetadata,
  isHighEntropyAction,
  isUncertainAction,
  serializeWmLine,
  TOOL_PRIORITY_MAP,
  WM_TRAJECTORY_LOG_PATH,
  WM_PREDICTION_LOG_PATH,
  WM_LAMBDA_DEFAULT,
  WM_LAMBDA_RANGE,
  WM_MIN_OBSERVATION_LENGTH,
  WM_EXCLUDED_TOOLS,
  type WmPriority,
  type WmMetadata,
  type WmMetadataInput,
  type PredictionRecord,
} from "./worldModel.js";

// worldModelLogger.ts — append-only JSONL trajectory ledger
export {
  initWorldModelLogger,
  logTrajectory,
  logPrediction,
  getWmStats,
  type TrajectoryLogEntry,
  type WmStats,
} from "./worldModelLogger.js";

// observationPredictor.ts — predict→verify→gap scoring pipeline
export {
  predictObservation,
  verifyPrediction,
  formatPredictionForTool,
  getGapSummary,
  checkGapAlert,
  type PredictionRequest,
  type PredictionResult,
  type GapResult,
  type GapSummary,
  type GapAlert,
} from "./observationPredictor.js";

// wmAnalytics.ts — dashboard, alerts, quality reports, Phase 2 readiness
export {
  generateDashboard,
  emitGapAlert,
  emitPendingAlerts,
  generateQualityReport,
  getPhase2Readiness,
  runCli,
  type WmToolStats,
  type WmTrendPoint,
  type WmDashboardSnapshot,
  type QualityReport,
  type Phase2Readiness,
} from "./wmAnalytics.js";

// grpo.ts — Group Relative Policy Optimization (Phase 2 RL training)
export {
  computeGroupAdvantages,
  computeTokenWeights,
  computeGRPOLoss,
  estimateKLDivergence,
  grpoStep,
  computeDynamicEchoLambda,
  validateRolloutGroup,
  testAdvantageSanity,
  createMetricsAccumulator,
  accumulateMetrics,
  DEFAULT_GRPO_CONFIG,
  type TokenRole,
  type TokenEntry,
  type Rollout,
  type RolloutGroup,
  type GRPOConfig,
  type TokenWeights,
  type GRPOStepResult,
  type GRPOMetrics,
} from "./grpo.js";

// faultFixFlow.ts — unified detect→classify→fix→verify→seal pipeline
export {
  classifyFault,
  selectFixStrategy,
  executeFix,
  runFaultFixCycle,
  isAutoRecoverable,
  needsHumanAttention,
  faultBlastRadius,
  type FaultSource,
  type FixStrategy,
  type FixVerdict,
  type BlastRadius,
  type FaultReport,
  type FixAction,
  type FixResult,
  type FaultFixCycle,
  type ExecutorContext,
} from "./faultFixFlow.js";
