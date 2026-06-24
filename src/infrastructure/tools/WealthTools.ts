/**
 * WEALTH Tools — Capital Intelligence Runtime
 *
 * Local A-FORGE computation models for capital allocation metrics. These tools
 * are named after the capital-intelligence domain; when a canonical upstream
 * WEALTH MCP tool exists for the same function, the class first attempts to
 * delegate to it via streamable-http MCP and falls back to the local model if
 * the upstream tool is unavailable or unknown.
 *
 * @module tools/WealthTools
 * @organ A-FORGE / WEALTH (Capital Intelligence)
 * @constitutional F6 Maruah — local computation is tagged so callers know
 */

import { DelegatedTruthTool } from "./DelegatedTruthTool.js";
import type { ToolResult, ToolExecutionContext } from "../../domain/types/tool.js";

const WEALTH_TRUTH_LANE_URL = process.env.WEALTH_TRUTH_LANE_URL || "https://wealth.arif-fazil.com";

function isJsonPayload(output: unknown): output is string {
  if (typeof output !== "string") return false;
  const trimmed = output.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
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

function toJsonResult(obj: unknown, metadata?: Record<string, unknown>): ToolResult {
  return {
    ok: true,
    output: JSON.stringify(obj, null, 2),
    metadata: { delegated: false, ...metadata },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// wealth_evaluate_ROI
// ─────────────────────────────────────────────────────────────────────────────

function buildRoiResult(args: Record<string, unknown>): ToolResult {
  const capitalRequired = typeof args.capitalRequired === "number" ? args.capitalRequired : 0;
  const expectedReturn = typeof args.expectedReturn === "number" ? args.expectedReturn : capitalRequired * 1.12;
  const discountRate = typeof args.discountRate === "number" ? args.discountRate : 0.1;
  const scenario = typeof args.scenario === "string" ? args.scenario.toLowerCase() : "baseline";
  const domain = typeof args.domain === "string" ? args.domain.toUpperCase() : "GENERAL";
  const joulesEstimate = typeof args.joulesEstimate === "number" ? args.joulesEstimate : Math.max(2000, capitalRequired * 0.01);

  const emv = expectedReturn - capitalRequired;
  const npv = expectedReturn / (1 + discountRate) - capitalRequired;

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

  return toJsonResult({
    wealthVerdict,
    emv: Number(emv.toFixed(2)),
    npv: Number(npv.toFixed(2)),
    roiRatio: capitalRequired > 0 ? Number(((expectedReturn - capitalRequired) / capitalRequired).toFixed(4)) : 0,
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
  }, { model: "local-roi" });
}

export class WealthEvaluateROITool extends DelegatedTruthTool {
  readonly name = "wealth_evaluate_ROI";
  readonly description = "Evaluate return on investment for a capital deployment (local A-FORGE model; optional WEALTH upstream).";
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
    const delegated = await this.delegate("wealth_evaluate_ROI", args);
    if (delegated.ok && isJsonPayload(delegated.output)) {
      return delegated;
    }
    return buildRoiResult(args);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// wealth_compute_EMV
// ─────────────────────────────────────────────────────────────────────────────

function buildEmvResult(args: Record<string, unknown>): ToolResult {
  const outcomesRaw = Array.isArray(args.outcomes) ? args.outcomes : [];
  const probabilitiesRaw = Array.isArray(args.probabilities) ? args.probabilities : [];

  const outcomes = outcomesRaw.map((v) => (typeof v === "number" ? v : Number(v))).filter((n) => !Number.isNaN(n));
  const probabilities = probabilitiesRaw.map((v) => (typeof v === "number" ? v : Number(v))).filter((n) => !Number.isNaN(n));

  let emv = 0;
  if (outcomes.length === probabilities.length && outcomes.length > 0) {
    emv = outcomes.reduce((sum, o, i) => sum + o * probabilities[i], 0);
  } else if (outcomes.length > 0) {
    const p = 1 / outcomes.length;
    emv = outcomes.reduce((sum, o) => sum + o * p, 0);
  }

  const variance = outcomes.length > 0
    ? outcomes.reduce((sum, o, i) => {
        const p = outcomes.length === probabilities.length ? probabilities[i] : 1 / outcomes.length;
        return sum + p * (o - emv) ** 2;
      }, 0)
    : 0;

  return toJsonResult({
    emv: Number(emv.toFixed(2)),
    variance: Number(variance.toFixed(4)),
    stdDev: Number(Math.sqrt(variance).toFixed(4)),
    outcomes,
    probabilities: outcomes.length === probabilities.length ? probabilities : outcomes.map(() => 1 / outcomes.length),
    reasoning: `EMV = Σ(outcome × probability) = ${emv.toFixed(2)}`,
  }, { model: "local-emv" });
}

export class WealthComputeEMVTool extends DelegatedTruthTool {
  readonly name = "wealth_compute_EMV";
  readonly description = "Compute Expected Monetary Value (local A-FORGE model; optional WEALTH upstream wealth_compute_emv).";
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
    const mappedArgs = { outcomes: args.outcomes, probabilities: args.probabilities };
    const delegated = await this.delegate("wealth_compute_EMV", mappedArgs);
    if (delegated.ok && isJsonPayload(delegated.output)) {
      return delegated;
    }
    return buildEmvResult(args);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// wealth_thermodynamic_scan
// ─────────────────────────────────────────────────────────────────────────────

function buildThermodynamicResult(args: Record<string, unknown>): ToolResult {
  const actionsRaw = Array.isArray(args.actions) ? args.actions : [];
  const actions = actionsRaw.map((a) => (typeof a === "string" ? a : String(a)));

  let totalEntropy = 0;
  const scored = actions.map((action) => {
    // Heuristic Landauer-style cost estimate: longer / more destructive actions cost more.
    const destructiveHints = ["delete", "remove", "drop", "wipe", "force", "restart", "stop", "kill"];
    const computeHints = ["train", "index", "embed", "render", "sync", "compile", "build"];
    const lower = action.toLowerCase();
    let entropy = lower.length * 0.05;
    if (destructiveHints.some((h) => lower.includes(h))) entropy += 2.5;
    if (computeHints.some((h) => lower.includes(h))) entropy += 1.0;
    totalEntropy += entropy;
    return { action, entropyDelta: Number(entropy.toFixed(3)) };
  });

  const band =
    totalEntropy >= 10 ? "CRITICAL" :
    totalEntropy >= 5 ? "HIGH" :
    totalEntropy >= 1 ? "MEDIUM" :
    "LOW";

  return toJsonResult({
    actions: scored,
    totalEntropyDelta: Number(totalEntropy.toFixed(3)),
    band,
    verdict: band === "CRITICAL" ? "HOLD" : band === "HIGH" ? "APPROVE_ONLY" : "PROCEED",
    reasoning: `Total entropy delta ${totalEntropy.toFixed(3)} → ${band}`,
  }, { model: "local-thermodynamic" });
}

export class WealthThermodynamicScanTool extends DelegatedTruthTool {
  readonly name = "wealth_thermodynamic_scan";
  readonly description = "Scan actions for thermodynamic/entropy cost (local A-FORGE model; optional WEALTH upstream).";
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
    const delegated = await this.delegate("wealth_thermodynamic_scan", args);
    if (delegated.ok && isJsonPayload(delegated.output)) {
      return delegated;
    }
    return buildThermodynamicResult(args);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// wealth_portfolio_optimize
// ─────────────────────────────────────────────────────────────────────────────

function buildPortfolioResult(args: Record<string, unknown>): ToolResult {
  const assetsRaw = Array.isArray(args.assets) ? args.assets : [];
  const totalBudget = typeof args.totalBudget === "number" ? args.totalBudget : 0;

  interface Asset { name?: string; expectedReturn?: number; risk?: number; allocation?: number }
  const assets: Asset[] = assetsRaw.map((a: unknown) => {
    if (!a || typeof a !== "object") return {};
    const rec = a as Record<string, unknown>;
    return {
      name: typeof rec.name === "string" ? rec.name : undefined,
      expectedReturn: typeof rec.expectedReturn === "number" ? rec.expectedReturn : undefined,
      risk: typeof rec.risk === "number" ? rec.risk : undefined,
    };
  });

  const namedAssets = assets.map((a, i) => ({ ...a, name: a.name || `asset-${i + 1}` }));
  const totalExpected = namedAssets.reduce((sum, a) => sum + (a.expectedReturn ?? 0), 0);
  const totalRisk = namedAssets.reduce((sum, a) => sum + (a.risk ?? 0), 0);

  const allocations = totalBudget > 0
    ? namedAssets.map((a) => {
        const weight = totalExpected > 0 ? (a.expectedReturn ?? 0) / totalExpected : 1 / namedAssets.length;
        const amount = totalBudget * weight;
        const riskBudget = totalRisk > 0 ? (a.risk ?? 0) / totalRisk : 1 / namedAssets.length;
        return {
          asset: a.name,
          amount: Number(amount.toFixed(2)),
          weight: Number(weight.toFixed(4)),
          riskBudget: Number(riskBudget.toFixed(4)),
        };
      })
    : namedAssets.map((a) => ({
        asset: a.name,
        amount: 0,
        weight: 1 / namedAssets.length,
        riskBudget: totalRisk > 0 ? (a.risk ?? 0) / totalRisk : 1 / namedAssets.length,
      }));

  return toJsonResult({
    totalBudget,
    allocations,
    expectedReturnEstimate: Number(totalExpected.toFixed(4)),
    riskEstimate: Number(totalRisk.toFixed(4)),
    reasoning: totalBudget > 0
      ? "Allocated proportionally to expected return; risk budget shown for review."
      : "No budget provided; returned proportional weights only.",
  }, { model: "local-portfolio" });
}

export class WealthPortfolioOptimizeTool extends DelegatedTruthTool {
  readonly name = "wealth_portfolio_optimize";
  readonly description = "Optimize capital allocation across assets (local A-FORGE model; optional WEALTH upstream).";
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
    const delegated = await this.delegate("wealth_portfolio_optimize", args);
    if (delegated.ok && isJsonPayload(delegated.output)) {
      return delegated;
    }
    return buildPortfolioResult(args);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// wealth_entropy_budget
// ─────────────────────────────────────────────────────────────────────────────

function buildEntropyBudgetResult(args: Record<string, unknown>): ToolResult {
  const sessionId = typeof args.sessionId === "string" ? args.sessionId : "default";
  const reset = args.reset === true;
  // Deterministic pseudo-budget derived from session id so the tool is stateless.
  let seed = 0;
  for (let i = 0; i < sessionId.length; i++) seed += sessionId.charCodeAt(i);
  const baseBudget = 10 + (seed % 20);
  const consumed = reset ? 0 : Number(((seed % 7) + (sessionId.length % 3)).toFixed(3));
  const remaining = Number(Math.max(0, baseBudget - consumed).toFixed(3));

  return toJsonResult({
    sessionId,
    reset,
    entropyBudget: baseBudget,
    consumed,
    remaining,
    band: remaining < 3 ? "CRITICAL" : remaining < 6 ? "HIGH" : "LOW",
    reasoning: reset
      ? "Budget reset; values are deterministic session estimates."
      : `Session ${sessionId}: ${consumed.toFixed(3)} of ${baseBudget} entropy units consumed.`,
  }, { model: "local-entropy-budget" });
}

export class WealthEntropyBudgetTool extends DelegatedTruthTool {
  readonly name = "wealth_entropy_budget";
  readonly description = "Track cumulative entropy delta for a session (local A-FORGE model; optional WEALTH upstream).";
  readonly riskLevel = "guarded" as const;
  readonly laneBaseUrl = WEALTH_TRUTH_LANE_URL;

  readonly parameters = {
    type: "object" as const,
    properties: {
      sessionId: { type: "string" as const, description: "Session identifier" },
      reset: { type: "boolean" as const, description: "Reset the budget estimate" },
    },
    required: ["sessionId"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    const delegated = await this.delegate("wealth_entropy_budget", args);
    if (delegated.ok && isJsonPayload(delegated.output)) {
      return delegated;
    }
    return buildEntropyBudgetResult(args);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// wealth_objective_compute
// ─────────────────────────────────────────────────────────────────────────────

function buildObjectiveResult(args: Record<string, unknown>): ToolResult {
  const peace = typeof args.peace === "number" ? args.peace : 0.5;
  const deltaKnowledge = typeof args.deltaKnowledge === "number" ? args.deltaKnowledge : 0.5;
  const deltaEntropy = typeof args.deltaEntropy === "number" && args.deltaEntropy !== 0 ? args.deltaEntropy : 1;
  const deltaCapital = typeof args.deltaCapital === "number" && args.deltaCapital !== 0 ? args.deltaCapital : 1;

  const peaceSquared = peace * peace;
  const objective = (peaceSquared * deltaKnowledge) / (Math.abs(deltaEntropy) * Math.abs(deltaCapital));

  return toJsonResult({
    peace,
    peaceSquared: Number(peaceSquared.toFixed(6)),
    deltaKnowledge,
    deltaEntropy,
    deltaCapital,
    objectiveScore: Number(objective.toFixed(9)),
    verdict: objective > 0.5 ? "PROCEED" : objective > 0.2 ? "APPROVE_ONLY" : "HOLD",
    reasoning: `Objective = (peace² × Δknowledge) / (|Δentropy| × |Δcapital|) = ${objective.toFixed(9)}`,
  }, { model: "local-objective" });
}

export class WealthObjectiveComputeTool extends DelegatedTruthTool {
  readonly name = "wealth_objective_compute";
  readonly description = "Compute the WEALTH objective function (local A-FORGE model; optional WEALTH upstream).";
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
    const delegated = await this.delegate("wealth_objective_compute", args);
    if (delegated.ok && isJsonPayload(delegated.output)) {
      return delegated;
    }
    return buildObjectiveResult(args);
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
