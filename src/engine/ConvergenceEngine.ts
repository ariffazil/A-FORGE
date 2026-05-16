import { 
  SovereignAgentEnvelope, 
  ConvergenceResult 
} from "../types/sovereign.js";

/**
 * Convergence Engine (Layer 3)
 * 
 * Implements the Multi-Agent Convergence Threshold (MACT).
 * Enforces cross-dimensional consistency before 888_JUDGE.
 * Prevents brittle specialists from collapsing system truth.
 */
export class ConvergenceEngine {
  // AC_Risk Threshold: If any agent reports AC_Risk > 0.7, system HOLDs.
  private readonly AC_RISK_THRESHOLD = 0.7;
  
  // Divergence Threshold: How much disagreement is tolerated before HOLD.
  private readonly DIVERGENCE_THRESHOLD = 0.3;

  /**
   * Evaluates an array of sovereign agent envelopes to arbitrate consensus.
   * Calculates structural, temporal, and physical divergence.
   */
  public evaluate(envelopes: SovereignAgentEnvelope[]): ConvergenceResult {
    let acRiskMax = 0;
    let holds = 0;
    let proceeds = 0;
    let voids = 0;
    
    const conflicts: string[] = [];
    const temporalStates = new Set<string>();

    for (const env of envelopes) {
      // 1. Audit AC_Risk
      if (env.acRisk > acRiskMax) acRiskMax = env.acRisk;

      // 2. Tally Recommendations
      if (env.recommendation.action === "HOLD") holds++;
      else if (env.recommendation.action === "PROCEED") proceeds++;
      else if (env.recommendation.action === "VOID") voids++;

      // 3. Enforce Constraint Supremacy
      if (!env.constraintCheck.physicsPassed) {
        conflicts.push(`[${env.agentId} | ${env.dimension}] Physics constraint FAILED.`);
      }
      if (!env.constraintCheck.topologyPassed) {
        conflicts.push(`[${env.agentId} | ${env.dimension}] Topology validation FAILED.`);
      }

      // 4. Audit Transform Depth (Hallucination Vector Check)
      if (env.transformStack.length > 5) {
         conflicts.push(`[${env.agentId}] High transform depth (${env.transformStack.length}). Severe hallucination risk.`);
      }

      temporalStates.add(env.temporalStatus);
    }

    // 5. Enforce Temporal Coherence (TCR)
    // If agents are operating under different time paradigms, the scene is causally fractured.
    if (temporalStates.size > 1) {
       conflicts.push(`Temporal fracture detected. Agents disagree on time state: ${Array.from(temporalStates).join(", ")}`);
    }

    // -- ARBITRATION --

    if (voids > 0 || acRiskMax >= this.AC_RISK_THRESHOLD || conflicts.length > 0) {
      return {
        verdict: "CRITICAL_HOLD",
        divergenceScore: 1.0,
        conflictGraph: [...conflicts, `Maximum AC_Risk (${acRiskMax.toFixed(2)}) threshold evaluated.`],
        acRiskMax
      };
    }

    // Calculate Divergence: if agents disagree on PROCEED vs HOLD
    const total = envelopes.length;
    const majority = Math.max(holds, proceeds);
    const divergenceScore = 1.0 - (majority / total);

    if (divergenceScore > this.DIVERGENCE_THRESHOLD) {
       return {
        verdict: "DIVERGED",
        divergenceScore,
        conflictGraph: [...conflicts, `Agents failed to reach consensus. Divergence Score: ${divergenceScore.toFixed(2)}`],
        acRiskMax
      };
    }

    return {
      verdict: "CONVERGED",
      divergenceScore,
      conflictGraph: conflicts,
      acRiskMax
    };
  }
}
