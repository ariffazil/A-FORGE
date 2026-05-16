/**
 * Sovereign Agent Envelope (Layer 2)
 * 
 * The mandatory reporting format for all AI agents operating within 
 * the GEOX/arifOS universal intelligence framework.
 * Prevents anonymous reasoning and forces epistemic humility.
 */

export type GEOXDimension = 
  | "Well" | "Earth3D" | "Time4D" | "Physics" 
  | "Map" | "Section" | "Prospect" | "Wealth" | "Abstract";

export type OperationType = 
  | "observe" | "interpret" | "compute" | "verify" | "judge" | "audit";

export interface SovereignAgentEnvelope {
  agentId: string;
  dimension: GEOXDimension;
  operationType: OperationType;
  
  // Explicit declarations to prevent hidden narratives
  assumptions: string[];
  
  // Transform Stack: How far is this from raw physical reality?
  // e.g., ["raw_log", "despike_filter", "archie_sw_model", "v_shale_transform"]
  transformStack: string[]; 
  
  uncertainty: {
    uPhys: number;       // Physical measurement uncertainty [0, 1]
    confidence: number;  // Agent's statistical confidence [0, 1]
  };
  
  // Theory of Anomalous Contrast Risk
  // High = The model likely contradicts foundational physics
  acRisk: number; 
  
  // Constraint Supremacy
  constraintCheck: {
    physicsPassed: boolean;
    topologyPassed: boolean;
  };
  
  // Temporal Awareness
  temporalStatus: "static" | "time-evolving" | "paleo-reconstructed";
  
  // The final proposal to the Convergence Engine
  recommendation: {
    action: "PROCEED" | "HOLD" | "VOID";
    rationale: string;
  };
}

export interface ConvergenceResult {
  verdict: "CONVERGED" | "DIVERGED" | "CRITICAL_HOLD";
  divergenceScore: number;
  conflictGraph: string[];
  acRiskMax: number;
}

