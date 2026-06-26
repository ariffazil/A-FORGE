/**
 * WEALTH Tools — Capital Intelligence Runtime (Proxy)
 *
 * This module contains proxy delegates that forward economic truth logic
 * to the remote WEALTH Truth Lane. A-FORGE is the execution shell; all
 * capital computation lives in the WEALTH organ (port 18082).
 *
 * No local financial computation is performed here. If WEALTH is unreachable,
 * the tool returns the upstream error so the caller knows the truth lane failed.
 *
 * @module tools/WealthTools
 * @organ WEALTH (Capital Intelligence)
 * @constitutional F6 Maruah — delegation enforced
 */

import { DelegatedTruthTool } from "./DelegatedTruthTool.js";
import type { ToolResult, ToolExecutionContext } from "../../domain/types/tool.js";

const WEALTH_TRUTH_LANE_URL = process.env.WEALTH_TRUTH_LANE_URL || "https://wealth.arif-fazil.com";

// ─────────────────────────────────────────────────────────────────────────────
// wealth_evaluate_ROI
// ─────────────────────────────────────────────────────────────────────────────

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
      discountRate: { type: "number" as const, description: "Discount rate (e.g. 0.1 for 10%)" },
      scenario: { type: "string" as const, description: "Scenario tag (baseline|extraction|code)" },
      domain: { type: "string" as const, description: "Domain tag (GENERAL|GEOX|CODE)" },
      joulesEstimate: { type: "number" as const, description: "Estimated energy/ops cost in joules" },
    },
    required: ["capitalRequired"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    return this.delegate("wealth_evaluate_ROI", args);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// wealth_compute_EMV
// ─────────────────────────────────────────────────────────────────────────────

export class WealthComputeEMVTool extends DelegatedTruthTool {
  readonly name = "wealth_compute_EMV";
  readonly description = "Compute Expected Monetary Value (EMV). Delegated to WEALTH Truth Lane.";
  readonly riskLevel = "guarded" as const;
  readonly laneBaseUrl = WEALTH_TRUTH_LANE_URL;

  readonly parameters = {
    type: "object" as const,
    properties: {
      outcomes: { type: "array" as const, items: { type: "number" as const }, description: "Monetary outcomes" },
      probabilities: { type: "array" as const, items: { type: "number" as const }, description: "Probabilities matching outcomes" },
    },
    required: ["outcomes", "probabilities"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    return this.delegate("wealth_compute_EMV", args);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// wealth_thermodynamic_scan
// ─────────────────────────────────────────────────────────────────────────────

export class WealthThermodynamicScanTool extends DelegatedTruthTool {
  readonly name = "wealth_thermodynamic_scan";
  readonly description = "Scan actions for thermodynamic/entropy cost. Delegated to WEALTH Truth Lane.";
  readonly riskLevel = "guarded" as const;
  readonly laneBaseUrl = WEALTH_TRUTH_LANE_URL;

  readonly parameters = {
    type: "object" as const,
    properties: {
      actions: { type: "array" as const, items: { type: "string" as const }, description: "Action descriptions to score" },
    },
    required: ["actions"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    return this.delegate("wealth_thermodynamic_scan", args);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// wealth_portfolio_optimize
// ─────────────────────────────────────────────────────────────────────────────

export class WealthPortfolioOptimizeTool extends DelegatedTruthTool {
  readonly name = "wealth_portfolio_optimize";
  readonly description = "Optimize capital allocation across assets. Delegated to WEALTH Truth Lane.";
  readonly riskLevel = "guarded" as const;
  readonly laneBaseUrl = WEALTH_TRUTH_LANE_URL;

  readonly parameters = {
    type: "object" as const,
    properties: {
      assets: { type: "array" as const, items: { type: "object" as const, properties: { name: { type: "string" as const }, expectedReturn: { type: "number" as const }, risk: { type: "number" as const } } }, description: "Assets with expected return and risk" },
      totalBudget: { type: "number" as const, description: "Total capital to allocate" },
    },
    required: ["assets", "totalBudget"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    return this.delegate("wealth_portfolio_optimize", args);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// wealth_entropy_budget
// ─────────────────────────────────────────────────────────────────────────────

export class WealthEntropyBudgetTool extends DelegatedTruthTool {
  readonly name = "wealth_entropy_budget";
  readonly description = "Track cumulative entropy delta for a session. Delegated to WEALTH Truth Lane.";
  readonly riskLevel = "guarded" as const;
  readonly laneBaseUrl = WEALTH_TRUTH_LANE_URL;

  readonly parameters = {
    type: "object" as const,
    properties: {
      sessionId: { type: "string" as const, description: "Session identifier" },
      reset: { type: "boolean" as const, description: "Reset the budget" },
    },
    required: ["sessionId"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    return this.delegate("wealth_entropy_budget", args);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// wealth_objective_compute
// ─────────────────────────────────────────────────────────────────────────────

export class WealthObjectiveComputeTool extends DelegatedTruthTool {
  readonly name = "wealth_objective_compute";
  readonly description = "Compute the WEALTH objective function. Delegated to WEALTH Truth Lane.";
  readonly riskLevel = "guarded" as const;
  readonly laneBaseUrl = WEALTH_TRUTH_LANE_URL;

  readonly parameters = {
    type: "object" as const,
    properties: {
      peace: { type: "number" as const, description: "Peace/maruah term 0–1" },
      deltaKnowledge: { type: "number" as const, description: "Knowledge gain" },
      deltaEntropy: { type: "number" as const, description: "Entropy cost (non-zero)" },
      deltaCapital: { type: "number" as const, description: "Capital delta (non-zero)" },
    },
    required: ["peace", "deltaKnowledge", "deltaEntropy", "deltaCapital"],
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
  WealthObjectiveComputeTool,
];
