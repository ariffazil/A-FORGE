/**
 * arifOS Core Types — v0.1
 *
 * Fundamental types for the Quantum-Level Intelligence Stack.
 * Aligned to A-FORGE constitutional governance.
 */

export type MetabolicState =
  | "000" // INIT: Bootstrap/Sense
  | "111" // THINK: Problem definition/Constraints
  | "333" // EXPLORE: Search/Proposals
  | "555" // HEART: Maruah/Peace/Impact check
  | "777" // REASON: Trade-off analysis/Selection
  | "888" // AUDIT: Verification/Gate (HOLD)
  | "999"; // SEAL: Commit/Actuate

export type ConstitutionalFloor =
  | "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7"
  | "F8" | "F9" | "F10" | "F11" | "F12" | "F13";

export type Tag =
  | "CLAIM"
  | "PLAUSIBLE"
  | "HYPOTHESIS"
  | "ESTIMATE"
  | "UNKNOWN";

export interface ArifOSTaskContract {
  sessionId: string;
  intent: string;
  riskTier: "low" | "medium" | "high" | "critical";
  metabolicState: MetabolicState;
  activeFloors: ConstitutionalFloor[];
  tags: Tag[];
  context: Record<string, any>;
  thermodynamics: {
    joulesEstimate: number;
    carbonEstimate: number;
    entropyDelta: number;
  };
}

export interface GEOXScenarioContract {
  id: string;
  name: string;
  physicalConstraints: {
    maxExtractionRate: number;
    seismicRiskIndex: number;
    environmentalImpact: number;
  };
  probability: number;
  tag: "ESTIMATE" | "HYPOTHESIS";
  groundingEvidence: string[];
}

export interface WealthAllocationContract {
  id: string;
  scenarioId: string;
  capitalRequired: number; // USD
  computeJoules: number;   // Thermodynamic cost
  expectedROI: {
    financial: number;
    knowledge: number;
    peace: number;
  };
  reversibility: number; // [0, 1]
  maruahScore: number;    // [0, 1]
}

export interface MetabolicTransition {
  from: MetabolicState;
  to: MetabolicState;
  verdict: "PASS" | "HOLD" | "VOID";
  reason?: string;
  timestamp: number;
}



