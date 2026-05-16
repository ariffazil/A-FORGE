/**
 * WEALTH Tools — Capital Intelligence Runtime (Proxy)
 *
 * This module contains proxy delegates that forward economic truth logic
 * to the remote WEALTH Truth Lane.
 *
 * @module tools/WealthTools
 * @organ WEALTH (Capital Intelligence)
 * @constitutional F6 Maruah — delegation enforced
 */

import { DelegatedTruthTool } from "./DelegatedTruthTool.js";
import type { ToolResult, ToolExecutionContext } from "../types/tool.js";

const WEALTH_TRUTH_LANE_URL = process.env.WEALTH_TRUTH_LANE_URL || "https://wealth.arif-fazil.com";

function isJsonPayload(output: unknown): output is string {
  if (typeof output !== "string") {
    return false;
  }

  const trimmed = output.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return false;
  }

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildRoiFallback(args: Record<string, unknown>): ToolResult {
  const capitalRequired = typeof args.capitalRequired === "number" ? args.capitalRequired : 0;
  const expectedReturn = typeof args.expectedReturn === "number" ? args.expectedReturn : capitalRequired * 1.12;
  const discountRate = typeof args.discountRate === "number" ? args.discountRate : 0.1;
  const scenario = typeof args.scenario === "string" ? args.scenario.toLowerCase() : "baseline";
  const domain = typeof args.domain === "string" ? args.domain.toUpperCase() : "GENERAL";
  const joulesEstimate = typeof args.joulesEstimate === "number" ? args.joulesEstimate : Math.max(2000, capitalRequired * 0.01);

  const emv = expectedReturn - capitalRequired;
  const npv = (expectedReturn / (1 + discountRate)) - capitalRequired;

  let maruahScore = 0.92;
  if (scenario === "extraction") maruahScore -= 0.22;
  if (domain === "GEOX") maruahScore -= 0.18;
  if (domain === "CODE") maruahScore = Math.max(maruahScore, 0.96);
  maruahScore = Number(clamp(maruahScore, 0.2, 0.98).toFixed(3));

  const thermodynamicBand =
    joulesEstimate >= 50000 ? "CRITICAL" :
    joulesEstimate >= 10000 ? "HIGH" :
    joulesEstimate >= 5000 ? "MEDIUM" :
    "LOW";
  const uncertaintyTag = scenario === "extraction" || typeof args.expectedReturn !== "number" ? "HYPOTHESIS" : "ESTIMATE";
  const knowledgeDelta = Number((domain === "GEOX" ? 0.72 : domain === "CODE" ? 0.58 : 0.5).toFixed(3));
  const entropyDelta = Number(Math.max(1, joulesEstimate / 1000).toFixed(3));
  const capitalDelta = Number(Math.max(capitalRequired, 1).toFixed(3));
  const peaceSquared = Number((maruahScore ** 2).toFixed(6));
  const objectiveScore = Number(((peaceSquared * knowledgeDelta) / (entropyDelta * capitalDelta)).toFixed(9));

  const violations: string[] = [];
  if (emv < 0) violations.push(`EMV negative: ${emv.toFixed(2)}`);
  if (npv < 0) violations.push(`NPV negative: ${npv.toFixed(2)}`);
  if (maruahScore < 0.5) violations.push(`F6 maruah too low: ${maruahScore.toFixed(2)}`);
  if (thermodynamicBand === "CRITICAL") violations.push("OPS/777 thermodynamic band CRITICAL");

  const wealthVerdict =
    maruahScore < 0.5 || thermodynamicBand === "CRITICAL"
      ? "VOID"
      : emv < 0 || npv < 0
        ? "HOLD"
        : "PROCEED";

  const result = {
    wealthVerdict,
    emv: Number(emv.toFixed(2)),
    npv: Number(npv.toFixed(2)),
    maruahScore,
    thermodynamicBand,
    uncertaintyTag,
    knowledgeDelta,
    entropyDelta,
    capitalDelta,
    peaceSquared,
    objectiveScore,
    violations,
    reasoning: `EMV=${emv.toFixed(2)} | NPV=${npv.toFixed(2)} | Objective=${objectiveScore.toFixed(9)} | Maruah=${maruahScore.toFixed(2)} | Thermo=${thermodynamicBand}`,
  };

  return {
    ok: true,
    output: JSON.stringify(result),
    metadata: {
      delegated: false,
      fallback: "local-roi-model",
    },
  };
}

/**
 * wealth_evaluate_ROI
 */
export class WealthEvaluateROITool extends DelegatedTruthTool {
  readonly name = "wealth_evaluate_ROI";
  readonly description = "Evaluate return on investment for a capital deployment. Delegated to WEALTH Truth Lane.";
  readonly riskLevel = "guarded" as const;
  readonly laneBaseUrl = WEALTH_TRUTH_LANE_URL;

  readonly parameters = {
    type: "object" as const,
    properties: {
      capitalRequired: { type: "number" as const, description: "Capital required in USD" },
      expectedReturn: { type: "number" as const, description: "Expected total return in USD" },
      discountRate: { type: "number" as const },
      scenario: { type: "string" as const },
      domain: { type: "string" as const },
      joulesEstimate: { type: "number" as const },
    },
    required: ["capitalRequired"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    const delegated = await this.delegate("wealth_evaluate_ROI", args);
    if (delegated.ok && isJsonPayload(delegated.output)) {
      return delegated;
    }
    return buildRoiFallback(args);
  }
}

/**
 * wealth_compute_EMV
 */
export class WealthComputeEMVTool extends DelegatedTruthTool {
  readonly name = "wealth_compute_EMV";
  readonly description = "Compute Expected Monetary Value (EMV). Delegated to WEALTH Truth Lane.";
  readonly riskLevel = "guarded" as const;
  readonly laneBaseUrl = WEALTH_TRUTH_LANE_URL;

  readonly parameters = {
    type: "object" as const,
    properties: {
      initial_investment: { type: "number" as const },
      scenarios: { type: "array" as const, items: { type: "object" as const } },
    },
    required: ["initial_investment", "scenarios"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    return this.delegate("wealth_compute_EMV", args);
  }
}

/**
 * wealth_thermodynamic_scan
 */
export class WealthThermodynamicScanTool extends DelegatedTruthTool {
  readonly name = "wealth_thermodynamic_scan";
  readonly description = "Scan actions for thermodynamic cost. Delegated to WEALTH Truth Lane.";
  readonly riskLevel = "guarded" as const;
  readonly laneBaseUrl = WEALTH_TRUTH_LANE_URL;

  readonly parameters = {
    type: "object" as const,
    properties: {
      actions: { type: "array" as const, items: { type: "object" as const } },
    },
    required: ["actions"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    return this.delegate("wealth_thermodynamic_scan", args);
  }
}

/**
 * wealth_portfolio_optimize
 */
export class WealthPortfolioOptimizeTool extends DelegatedTruthTool {
  readonly name = "wealth_portfolio_optimize";
  readonly description = "Optimize capital allocation across assets. Delegated to WEALTH Truth Lane.";
  readonly riskLevel = "guarded" as const;
  readonly laneBaseUrl = WEALTH_TRUTH_LANE_URL;

  readonly parameters = {
    type: "object" as const,
    properties: {
      assets: { type: "array" as const, items: { type: "object" as const } },
      totalBudget: { type: "number" as const },
    },
    required: ["assets", "totalBudget"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    return this.delegate("wealth_portfolio_optimize", args);
  }
}

/**
 * wealth_entropy_budget
 */
export class WealthEntropyBudgetTool extends DelegatedTruthTool {
  readonly name = "wealth_entropy_budget";
  readonly description = "Track cumulative entropy delta. Delegated to WEALTH Truth Lane.";
  readonly riskLevel = "guarded" as const;
  readonly laneBaseUrl = WEALTH_TRUTH_LANE_URL;

  readonly parameters = {
    type: "object" as const,
    properties: {
      sessionId: { type: "string" as const },
      reset: { type: "boolean" as const },
    },
    required: ["sessionId"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    return this.delegate("wealth_entropy_budget", args);
  }
}

/**
 * wealth_objective_compute
 */
export class WealthObjectiveComputeTool extends DelegatedTruthTool {
  readonly name = "wealth_objective_compute";
  readonly description = "Compute the WEALTH objective function. Delegated to WEALTH Truth Lane.";
  readonly riskLevel = "guarded" as const;
  readonly laneBaseUrl = WEALTH_TRUTH_LANE_URL;

  readonly parameters = {
    type: "object" as const,
    properties: {
      peace: { type: "number" as const },
      deltaKnowledge: { type: "number" as const },
      deltaEntropy: { type: "number" as const },
      deltaCapital: { type: "number" as const },
    },
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    return this.delegate("wealth_objective_compute", args);
  }
}

export const WEALTH_TOOLS = [
  WealthEvaluateROITool,
  WealthComputeEMVTool,
  WealthThermodynamicScanTool,
  WealthPortfolioOptimizeTool,
  WealthEntropyBudgetTool,
  WealthObjectiveComputeTool
];

