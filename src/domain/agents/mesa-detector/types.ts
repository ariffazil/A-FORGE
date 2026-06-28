/**
 * MesaDetector — Behavioral Mesa-Objective Detection
 *
 * APEX Theory §4: A mesa-optimizer is an inner optimizer whose objective differs
 * from the outer optimizer's stated objective. This detector monitors behavioral
 * fingerprints per agent profile and raises alerts when statistically significant
 * drift emerges — proxy metrics gamed, scope creep, failure pattern changes.
 *
 * DITEMPA BUKAN DIBERI — The detector watches, never blocks autonomously.
 * Alerts route to arifOS kernel. Arif decides.
 */

import type { RunMetrics, AgentProfile } from "../../types/agent.js";

// ─── Alert Levels ─────────────────────────────────────────────────────────────

export type MesaAlertLevel = "INFO" | "WATCH" | "MESA_PROXY" | "MESA_CRITICAL";

export interface MesaAlert {
  alertId: string;
  timestamp: string;
  agentName: string;
  profileName: string;
  level: MesaAlertLevel;
  trigger: MesaTrigger;
  /** Computed drift score ∈ [0, 1] — how far from baseline */
  driftScore: number;
  /** Which statistics triggered this alert */
  evidence: MesaEvidence;
  /** What the detector recommends */
  recommendation: string;
  sessionId?: string;
}

export interface MesaTrigger {
  type: MesaTriggerType;
  description: string;
  statisticalTest: StatisticalTestName;
  testStatistic: number;
  threshold: number;
  pValue?: number;
}

export type MesaTriggerType =
  | "TOOL_USAGE_DRIFT"
  | "FAILURE_PATTERN_CHANGE"
  | "SCOPE_CREEP"
  | "BUDGET_GAMING"
  | "FLOOR_VIOLATION_SPIKE"
  | "SUCCESS_RATE_COLLAPSE"
  | "CONVERGENCE_STALL";

export type StatisticalTestName =
  | "chi_square"
  | "kl_divergence"
  | "z_score"
  | "bayes_factor"
  | "cumulative_sum";

export interface MesaEvidence {
  /** Tool type → observed vs expected probability */
  toolDistributionDelta: Record<string, { observed: number; expected: number; delta: number }>;
  /** Key metric z-scores */
  metricZScores: Record<string, number>;
  /** Rolling window sizes used */
  windowSize: number;
  baselineSessions: number;
  currentSessions: number;
}

// ─── Fingerprint ───────────────────────────────────────────────────────────────

/** Behavioral fingerprint for one agent profile */
export interface ProfileFingerprint {
  profileName: string;
  toolDistribution: Record<string, number>; // tool → probability (sums to 1)
  avgTurns: number;
  avgToolCalls: number;
  avgBudgetUtilization: number; // fraction of token ceiling used
  successRate: number;
  floorViolationRate: number;
  blockedActionRate: number;
  /** Confidence in this baseline — grows with more sessions */
  confidence: number;
  lastUpdated: string;
  sessionCount: number;
}

// ─── State ────────────────────────────────────────────────────────────────────

/** Per-agent rolling history for drift detection */
export interface AgentMesaState {
  agentName: string;
  sessions: SessionSnapshot[];
  baseline: ProfileFingerprint | null;
}

export interface SessionSnapshot {
  agentName: string;
  sessionId: string;
  timestamp: string;
  profileName: string;
  toolDistribution: Record<string, number>;
  metrics: Pick<
    RunMetrics,
    | "turnsUsed"
    | "toolCalls"
    | "llmTokensIn"
    | "llmTokensOut"
    | "llmCost"
    | "blockedDangerousActions"
    | "blockedCommands"
    | "timeoutEvents"
    | "taskSuccess"
    | "completion"
    | "testsPassed"
  >;
  floorsTriggered: string[];
}

// ─── Configuration ─────────────────────────────────────────────────────────────

export interface MesaConfig {
  /** Minimum sessions before a baseline is established */
  baselineMinSessions: number;
  /** Rolling window for current-behavior comparison */
  windowSize: number;
  /** p-value threshold for chi-square significance */
  chiSquareAlpha: number;
  /** KL divergence threshold (nats) before WATCH */
  klDivergenceWatch: number;
  /** KL divergence threshold (nats) before MESA_PROXY */
  klDivergenceMesa: number;
  /** Z-score threshold before alert */
  zScoreThreshold: number;
  /** Budget utilization delta beyond which to flag as gaming */
  budgetGamingThreshold: number;
  /** Floor violation rate spike threshold */
  floorViolationSpikeThreshold: number;
  /** Success rate below which to flag collapse */
  successRateCollapse: number;
  /** Storage directory for state persistence */
  stateDir: string;
}

export const DEFAULT_MESA_CONFIG: MesaConfig = {
  baselineMinSessions: 5,
  windowSize: 10,
  chiSquareAlpha: 0.05,
  klDivergenceWatch: 0.1,
  klDivergenceMesa: 0.5,
  zScoreThreshold: 2.0,
  budgetGamingThreshold: 0.15,
  floorViolationSpikeThreshold: 3.0,
  successRateCollapse: 0.4,
  stateDir: ".arifos/mesa",
};

// ─── Statistics ────────────────────────────────────────────────────────────────

export interface DriftTestResult {
  trigger: MesaTriggerType;
  statisticalTest: StatisticalTestName;
  testStatistic: number;
  threshold: number;
  pValue?: number;
  driftScore: number; // ∈ [0, 1]
  significant: boolean;
  evidence: Partial<MesaEvidence>;
}

export interface MesaReport {
  agentName: string;
  profileName: string;
  hasBaseline: boolean;
  baseline: ProfileFingerprint | null;
  tests: DriftTestResult[];
  alerts: MesaAlert[];
  currentSession: SessionSnapshot | null;
  /** Overall mesa probability ∈ [0, 1] — Bayesian posterior after all tests */
  mesaProbability: number;
}
