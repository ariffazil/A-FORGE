export type PlanNodeStatus = 'pending' | 'authorized' | 'executing' | 'completed' | 'failed';
export type RiskTier = 'safe' | 'guarded' | 'dangerous';

export interface EpistemicState {
  confidence: number;      // 0.0 - 1.0
  assumptions: Array<{
    statement: string;
    critical: boolean;
    grounded: boolean;
  }>;
  unknowns: string[];
  riskTier: RiskTier;
  evidenceCount: number;   // Number of grounding sources/references
  lastValidatedAt?: string; // ISO timestamp
}

export interface PlanNode {
  id: string;
  goal: string;
  dependencies: string[]; // Node IDs that this node depends on (must be completed before this node can start)
  status: PlanNodeStatus;
  epistemic: EpistemicState;
  metadata?: Record<string, any>;
}

export interface PlanDAG {
  id: string;
  rootId: string; // The "final" node that represents the completion of the overall goal
  nodes: Map<string, PlanNode>;
  version: number;
  createdAt: string;
}

export interface StructuralValidationResult {
  isValid: boolean;
  isAcyclic: boolean;
  rootIntegrity: boolean;
  dependenciesValid: boolean;
  reachability: number; // 0.0 - 1.0 (Percentage of nodes reachable from root via dependency resolution)
  maxDepth: number;
  maxBranchingFactor: number;
  complexityScore: number;
  errors: string[];
}
