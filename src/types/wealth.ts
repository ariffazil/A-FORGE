/**
 * WEALTH — Capital Intelligence Types
 *
 * Financial domain types for thermodynamic cost estimation.
 * Mirrors GEOX physics-first pattern applied to capital decisions.
 *
 * EMV  = Σ (probability_i × outcome_i)
 * NPV  = Σ (cash_flow_t / (1 + r)^t) − initial_investment
 * κᵣ   = reversibility coefficient [0, 1] — 1 = fully reversible
 * blast_radius = maximum adverse outcome if action fails
 */

export interface WealthMetrics {
  emv: number;
  npv: number;
  kappa_r: number;
  blastRadius: number;
  dS_predict: number;
}

export interface CashFlow {
  period: number;
  amount: number;
  probability: number;
}

export interface WealthScenario {
  name: string;
  cashFlows: CashFlow[];
  initialInvestment: number;
  discountRate: number;
  riskFreeRate: number;
}

export interface EMVResult {
  emv: number;
  expectedValue: number;
  weightedOutcomes: number;
  scenarios: number;
  reason: string;
}

export interface NPVResult {
  npv: number;
  presentValues: number[];
  discountRate: number;
  initialInvestment: number;
  reason: string;
}

export interface WealthVerdict {
  verdict: "SEAL" | "HOLD" | "VOID";
  emvPass: boolean;
  npvPass: boolean;
  reversibilityPass: boolean;
  blastRadiusPass: boolean;
  thermodynamicPass: boolean;
  reason: string;
}

export type WealthDecision =
  | "PROCEED"
  | "HOLD"
  | "VOID"
  | "REQUIRE_HUMAN_APPROVAL";

export interface ThermodynamicCost {
  toolName: string;
  landauerCost: number;
  kappa_r: number;
  blastRadius: number;
  dS_predict: number;
  emv: number;
  npv: number;
  isReversible: boolean;
  isExpensive: boolean;
  thermodynamicBand: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface ThermodynamicVerdict {
  verdict: "PASS" | "HOLD" | "VOID";
  cost: ThermodynamicCost;
  violations: string[];
  landauerReason: string;
  reversibilityReason: string;
  blastRadiusReason: string;
  wealthReason: string;
}

export const KAPPA_R_THRESHOLD = 0.7;
export const BLAST_RADIUS_THRESHOLD = 0.8;
export const LANDAUER_COST_THRESHOLD = 0.7;
export const DS_PREDICT_THRESHOLD = 0.4;
export const NPV_MIN = 0;
export const EMV_MIN = 0;
