/**
 * arifOS Policy Module - Constitutional Floor Enforcement
 * 
 * Exports:
 * - Sense (111): Lite/Deep mode classification
 * - F7 (Humility): Confidence proxy and overconfidence detection
 * - F11 (Coherence): Contradiction tracking (to be implemented)
 * - F6 (Empathy): Harm detection (to be implemented)
 */

// Sense (111) - Lite/Deep classification
export {
  runSense,
  senseLite,
  senseDeep,
  senseAuto,
  computeLiteHeuristics,
  extractTopics,
  RISK_KEYWORDS,
} from "./sense.js";

// F7 (Humility) - Confidence proxy
export {
  calculateConfidenceEstimate,
  evaluateWithConfidence,
  detectOverconfidenceMismatch,
  classifyUncertaintyBand,
  formatConfidenceDisplay,
  CONFIDENCE_THRESHOLDS,
  UNCERTAINTY_THRESHOLDS,
} from "./confidence.js";

// Types
export type {
  ConfidenceEstimate,
  JudgeResult,
  JudgeVerdict,
  SenseResult,
  SenseMode,
  SessionState,
  SessionClaim,
  EntropyMetrics,
  UncertaintyBand,
} from "../types/session.js";
