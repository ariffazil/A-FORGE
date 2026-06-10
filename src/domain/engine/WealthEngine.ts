import { WealthAllocationContract, GEOXScenarioContract } from "../types/arifos.js";
import type {
  ToolAction,
  TokenBudget,
  WealthAdvice,
  StressState,
  ContinueAdvice,
} from "../types/wealth.js";

export interface ThermodynamicBudget {
  joulesTotal: number;
  carbonTotal: number;
  entropyDeltaTotal: number;
}

/**
 * WealthEngine — Resource Allocation & Thermodynamic Optimizer
 *
 * [Q2] Advisory mode: local knapsack solver + 9-harness stress scan.
 * Provides cost-aware action selection and loop-termination advice.
 * Will be replaced by WEALTH MCP calls in Q3.
 * 2026-05-05
 */
export class WealthEngine {
  private _budget: ThermodynamicBudget = {
    joulesTotal: 0,
    carbonTotal: 0,
    entropyDeltaTotal: 0,
  };

  public async allocate(
    scenarios: GEOXScenarioContract[],
  ): Promise<WealthAllocationContract[]> {
    return scenarios.map((scenario) => {
      const riskMultiplier =
        scenario.physicalConstraints.seismicRiskIndex > 0.3 ? 1.5 : 1.0;
      const maruahPenalty =
        scenario.physicalConstraints.environmentalImpact > 0.5 ? 0.4 : 0.0;
      const computeJoules = Math.round(10000 * riskMultiplier);
      this._budget.joulesTotal += computeJoules;
      this._budget.entropyDeltaTotal += computeJoules * 0.001;
      this._budget.carbonTotal += computeJoules * 0.0001;

      return {
        id: `wealth-alloc-${scenario.id}`,
        scenarioId: scenario.id,
        capitalRequired: 5000000 * riskMultiplier,
        computeJoules,
        expectedROI: {
          financial: 12.5 / riskMultiplier,
          knowledge: scenario.tag === "HYPOTHESIS" ? 0.9 : 0.4,
          peace:
            1.0 -
            scenario.physicalConstraints.environmentalImpact -
            maruahPenalty,
        },
        reversibility: 1.0 - scenario.physicalConstraints.environmentalImpact / 2,
        maruahScore: 1.0 - maruahPenalty,
      };
    });
  }

  public trackBudget(joules: number, carbon: number, entropyDelta: number): void {
    this._budget.joulesTotal += joules;
    this._budget.carbonTotal += carbon;
    this._budget.entropyDeltaTotal += entropyDelta;
  }

  public getBudget(): ThermodynamicBudget {
    return { ...this._budget };
  }

  public getBudgetStatus(): { remaining: number; utilization: number } {
    const BUDGET_LIMIT = 1000000;
    return {
      remaining: Math.max(0, BUDGET_LIMIT - this._budget.joulesTotal),
      utilization: Math.min(1, this._budget.joulesTotal / BUDGET_LIMIT),
    };
  }

  /**
   * [Q2] Greedy knapsack solver: maximize total value within remaining
   * token budget. Sorts actions by efficiency (value / cost) and selects
   * until budget is exhausted.
   */
  evaluatePlan(plan: ToolAction[], remainingBudget: TokenBudget): WealthAdvice {
    const feasible = plan
      .map((action) => ({
        ...action,
        efficiency: action.estimatedValue / Math.max(action.estimatedTokens, 1),
      }))
      .filter((action) => action.estimatedTokens <= remainingBudget.remainingTokens)
      .sort((a, b) => b.efficiency - a.efficiency);

    const approved: ToolAction[] = [];
    let tokensLeft = remainingBudget.remainingTokens;
    let turnsLeft = remainingBudget.remainingTurns;

    for (const action of feasible) {
      if (action.estimatedTokens <= tokensLeft && turnsLeft > 0) {
        approved.push(action);
        tokensLeft -= action.estimatedTokens;
        turnsLeft -= 1;
      }
    }

    const approvedNames = new Set(approved.map((a) => a.name));
    const deferred = plan.filter((a) => !approvedNames.has(a.name));

    const reason =
      deferred.length === 0
        ? `All ${plan.length} actions approved within budget (${remainingBudget.remainingTokens} tokens, ${remainingBudget.remainingTurns} turns remaining).`
        : `Approved ${approved.length}/${plan.length} actions. Deferred ${deferred.length} low-efficiency or over-budget actions.`;

    console.log(`[WEALTH-ADVISORY] evaluatePlan: ${reason}`);

    return { approved, deferred, reason };
  }

  /**
   * [Q2] Simplified 9-harness stress check. If cumulative stress > 2.0,
   * recommend VOID to prevent runaway loops.
   */
  shouldContinue(stressMetrics: StressState): ContinueAdvice {
    const {
      consecutiveFailures,
      budgetBurnRate,
      diminishingReturns,
      cumulativeStress,
    } = stressMetrics;

    const stressFactors = [
      consecutiveFailures * 0.3,
      budgetBurnRate > 5000 ? 0.5 : 0,
      diminishingReturns ? 0.4 : 0,
      cumulativeStress,
    ];

    const totalStress = stressFactors.reduce((sum, v) => sum + v, 0);

    if (totalStress > 2.0) {
      const reason = `Cumulative stress ${totalStress.toFixed(2)} exceeds 2.0 threshold (failures=${consecutiveFailures}, burnRate=${budgetBurnRate}, diminishing=${diminishingReturns}). Recommend VOID.`;
      console.warn(`[WEALTH-ADVISORY] shouldContinue: VOID — ${reason}`);
      return { verdict: "VOID", reason };
    }

    const reason = `Stress ${totalStress.toFixed(2)} within safe band. Proceed.`;
    console.log(`[WEALTH-ADVISORY] shouldContinue: PROCEED — ${reason}`);
    return { verdict: "PROCEED", reason };
  }
}
