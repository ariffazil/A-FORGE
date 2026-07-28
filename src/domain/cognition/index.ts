/**
 * COGNITION MODULE — Jacobian-to-AC dual-sensitivity kernel.
 *
 * This module provides the metabolic intelligence layer that makes
 * the arifOS federation metabolic rather than merely reactive.
 *
 * Three engines:
 *   ENCODER     — goal → structured task vector T = [t₁, ..., tₘ]
 *   EMD GATE    — ToAC stabilizer: encode → decode → validate
 *   METABOLIZER — failure → weight adjustment (risk ×1.2, constraint ×1.2)
 *
 * Together they transform the federation from:
 *   "execute tasks"     → "metabolize goals"
 *   "point-to-point"     → "Jacobian sensitivity"
 *   "G = UNMEASURED"    → "G = computable scalar"
 *
 * Architecture:
 *   encodeGoal() → [TaskVectorEntry] → emdPass() → metabolicCycle() → GoalVector
 *
 * @module cognition
 * @constitutional F2 TRUTH — every computation is evidence-labeled
 * @constitutional F4 CLARITY — ΔS ≤ 0 on every encode/decode cycle
 * @constitutional F8 GENIUS — G = A · P · E · X · Φ computable from live state
 */
export {
  type TaskSensitivity,
  type TaskProvenance,
  type TaskVectorEntry,
  type GoalVector,
  type JacobianMatrix,
  type FieldChange,
  type RecomputeResult,
  type OrganTag,
  type TaskDomain,
  ZERO_SENSITIVITY,
  hashGoal,
  generateTaskId,
  generateGoalId,
  needsRecompute,
  computeGFromJacobian,
  computeCDark,
  computeW3Simple,
  buildContinuityHash,
} from "./taskJacobian.js";

export {
  type EncoderOptions,
  encodeGoal,
  splitGoalIntoPhrases,
  recomputeOnFieldChange,
} from "./goalEncoder.js";

export {
  type EncodeState,
  type DecodeResult,
  type AnomalyReport,
  type EmdResult,
  encode,
  decode,
  emdPass,
  applyEmdToGoal,
} from "./emdGate.js";

export {
  type MetabolicResult,
  type MetabolicSummary,
  type MetabolicInput,
  metabolizeTask,
  metabolicCycle,
  updateTaskState,
  FAILURE_RISK_MULTIPLIER,
  FAILURE_CONSTRAINT_MULTIPLIER,
  MAX_METABOLISM_CYCLES,
} from "./metabolicLoop.js";
