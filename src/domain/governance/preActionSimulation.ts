/**
 * PRE-ACTION SIMULATION — Wire organ predictions into execution pipeline.
 *
 * Before irreversible actions, route to relevant organ for consequence prediction.
 * GEOX predicts earth consequences. WEALTH predicts capital consequences.
 * WELL predicts human readiness.
 *
 * This is the missing "world model" module — not built from scratch,
 * but extracted from existing organ capabilities and wired into the actor.
 *
 * Sovereign directive: "Wire existing predictions ke actor — sebelum forge_execute,
 * run relevant organ prediction."
 *
 * @module domain/governance/preActionSimulation
 * @constitutional F2 TRUTH — predictions are DER/SPEC, never OBS
 * @constitutional F7 HUMILITY — prediction does NOT guarantee outcomes
 */

import { createHash } from "node:crypto";

// ── Types ───────────────────────────────────────────────────────────────────

export type PredictionDomain = "earth" | "capital" | "human" | "general";

export interface PredictionResult {
  domain: PredictionDomain;
  organ: string;
  tool: string;
  prediction: Record<string, unknown> | null;
  epistemic: "OBS" | "DER" | "INT" | "SPEC" | "UNKNOWN";
  confidence: number;
  g_score?: number;
  c_dark?: number;
  consequences: string[];
  risks: string[];
  recommendation: "PROCEED" | "CAUTION" | "BLOCK";
  timestamp: string;
  receipt_id: string;
}

export interface SimulationRequest {
  action_class: "OBSERVE" | "EXECUTE_REVERSIBLE" | "EXECUTE_IRREVERSIBLE" | "EXTERNAL_SIDE_EFFECT";
  target: string;
  intent: string;
  tool_name: string;
  metadata?: Record<string, unknown>;
}

// ── Domain Classification ───────────────────────────────────────────────────

const EARTH_SIGNALS = [
  "basin", "seismic", "well", "reservoir", "petrophysics", "stratigraphy",
  "porosity", "permeability", "saturation", "formation", "lithology",
  "geox", "prospect", "claim", "evidence",
];

const CAPITAL_SIGNALS = [
  "invest", "portfolio", "capital", "npv", "irr", "cashflow", "budget",
  "wealth", "emv", "risk", "return", "valuation", "fiscal", "dividend",
];

const HUMAN_SIGNALS = [
  "sleep", "fatigue", "vitality", "readiness", "health", "wellness",
  "well", "dignity", "homeostasis", "metabolic",
];

/**
 * Classify which organ's world model should predict consequences.
 */
export function classifyPredictionDomain(request: SimulationRequest): PredictionDomain {
  const haystack = `${request.target} ${request.intent} ${request.tool_name}`.toLowerCase();

  const earthScore = EARTH_SIGNALS.filter(s => haystack.includes(s)).length;
  const capitalScore = CAPITAL_SIGNALS.filter(s => haystack.includes(s)).length;
  const humanScore = HUMAN_SIGNALS.filter(s => haystack.includes(s)).length;

  const max = Math.max(earthScore, capitalScore, humanScore);
  if (max === 0) return "general";
  if (earthScore === max) return "earth";
  if (capitalScore === max) return "capital";
  return "human";
}

// ── Prediction Routing ──────────────────────────────────────────────────────

/**
 * Route to the relevant organ for consequence prediction.
 *
 * This is the "world model" integration — existing organ prediction
 * capabilities wired into the execution pipeline.
 *
 * Returns a PredictionResult with consequences, risks, and recommendation.
 */
export async function predictConsequences(
  request: SimulationRequest,
  callOrgan: (organ: string, tool: string, args: Record<string, unknown>) => Promise<unknown>,
): Promise<PredictionResult> {
  const domain = classifyPredictionDomain(request);
  const receiptId = `sim_${Date.now()}_${createHash("sha256").update(`${request.tool_name}:${request.target}:${Date.now()}`).digest("hex").slice(0, 8)}`;

  const base: Omit<PredictionResult, "prediction" | "consequences" | "risks" | "recommendation"> = {
    domain,
    organ: domain === "earth" ? "geox" : domain === "capital" ? "wealth" : domain === "human" ? "well" : "none",
    tool: "",
    epistemic: "UNKNOWN",
    confidence: 0,
    timestamp: new Date().toISOString(),
    receipt_id: receiptId,
  };

  switch (domain) {
    case "earth":
      return predictEarthConsequences(request, callOrgan, base);
    case "capital":
      return predictCapitalConsequences(request, callOrgan, base);
    case "human":
      return predictHumanConsequences(request, callOrgan, base);
    case "general":
      return {
        ...base,
        prediction: null,
        consequences: ["No organ-specific prediction available for this domain"],
        risks: ["Unknown consequences — proceed with caution"],
        recommendation: "CAUTION",
      };
  }
}

// ── Earth Prediction (GEOX) ─────────────────────────────────────────────────

async function predictEarthConsequences(
  request: SimulationRequest,
  callOrgan: (organ: string, tool: string, args: Record<string, unknown>) => Promise<unknown>,
  base: Omit<PredictionResult, "prediction" | "consequences" | "risks" | "recommendation">,
): Promise<PredictionResult> {
  try {
    const result = await callOrgan("geox", "geox_model", {
      mode: "basin",
      arguments: { scenario: request.intent, target: request.target },
    }) as Record<string, unknown>;

    const prediction = result ?? {};
    const consequences: string[] = [];
    const risks: string[] = [];

    // Extract consequences from GEOX prediction
    if (prediction.accommodation) consequences.push(`Accommodation: ${JSON.stringify(prediction.accommodation).slice(0, 100)}`);
    if (prediction.sediment_supply) consequences.push(`Sediment supply: ${JSON.stringify(prediction.sediment_supply).slice(0, 100)}`);

    // Assess risk from prediction confidence
    const confidence = typeof prediction.confidence === "number" ? prediction.confidence : 0.5;
    if (confidence < 0.6) risks.push("Low confidence prediction — geological uncertainty high");
    if (prediction.contradictions) risks.push("Contradictions detected in geological model");

    return {
      ...base,
      tool: "geox_model(mode=basin)",
      prediction,
      epistemic: "INT",
      confidence,
      consequences,
      risks,
      recommendation: confidence >= 0.7 ? "PROCEED" : confidence >= 0.5 ? "CAUTION" : "BLOCK",
    };
  } catch (err: any) {
    return {
      ...base,
      tool: "geox_model(mode=basin)",
      prediction: null,
      epistemic: "UNKNOWN",
      confidence: 0,
      consequences: [],
      risks: [`GEOX prediction failed: ${err.message?.slice(0, 200)}`],
      recommendation: "CAUTION",
    };
  }
}

// ── Capital Prediction (WEALTH) ─────────────────────────────────────────────

async function predictCapitalConsequences(
  request: SimulationRequest,
  callOrgan: (organ: string, tool: string, args: Record<string, unknown>) => Promise<unknown>,
  base: Omit<PredictionResult, "prediction" | "consequences" | "risks" | "recommendation">,
): Promise<PredictionResult> {
  try {
    const meta = request.metadata ?? {};
    // Prefer EVOI when prior/posterior/cost/value provided (per pre-action-prediction skill)
    let result: Record<string, unknown>;
    if (meta.prior_pos !== undefined && meta.posterior_pos !== undefined && meta.well_cost_musd !== undefined && meta.p50_value_musd !== undefined) {
      result = await callOrgan("wealth", "wealth_compute_evoi", {
        prior_pos: meta.prior_pos,
        posterior_pos: meta.posterior_pos,
        well_cost_musd: meta.well_cost_musd,
        p50_value_musd: meta.p50_value_musd,
        discount_rate: meta.discount_rate ?? 0.1,
      }) as Record<string, unknown>;
    } else {
      result = await callOrgan("wealth", "wealth_monte_carlo_simulate", {
        initial_value: typeof meta.value === "number" ? meta.value : 100,
        growth_rate: typeof meta.growth === "number" ? meta.growth : 0.05,
        volatility: typeof meta.volatility === "number" ? meta.volatility : 0.15,
        periods: 12,
        simulations: 1000,
      }) as Record<string, unknown>;
    }

    const prediction = result ?? {};
    const consequences: string[] = [];
    const risks: string[] = [];

    // Extract Monte Carlo results
    if (prediction.percentiles) {
      const p = prediction.percentiles as Record<string, number>;
      consequences.push(`P10: ${p.p10 ?? "N/A"}, P50: ${p.p50 ?? "N/A"}, P90: ${p.p90 ?? "N/A"}`);
    }
    if (prediction.probability_of_loss) {
      const pol = prediction.probability_of_loss as number;
      if (pol > 0.3) risks.push(`High probability of loss: ${(pol * 100).toFixed(1)}%`);
    }

    const confidence = 0.7; // Monte Carlo is DER-level

    return {
      ...base,
      tool: "wealth_monte_carlo_simulate",
      prediction,
      epistemic: "DER",
      confidence,
      consequences,
      risks,
      recommendation: risks.length === 0 ? "PROCEED" : "CAUTION",
    };
  } catch (err: any) {
    return {
      ...base,
      tool: "wealth_monte_carlo_simulate",
      prediction: null,
      epistemic: "UNKNOWN",
      confidence: 0,
      consequences: [],
      risks: [`WEALTH prediction failed: ${err.message?.slice(0, 200)}`],
      recommendation: "CAUTION",
    };
  }
}

// ── Human Prediction (WELL) ─────────────────────────────────────────────────

async function predictHumanConsequences(
  request: SimulationRequest,
  callOrgan: (organ: string, tool: string, args: Record<string, unknown>) => Promise<unknown>,
  base: Omit<PredictionResult, "prediction" | "consequences" | "risks" | "recommendation">,
): Promise<PredictionResult> {
  try {
    const result = await callOrgan("well", "well_assess_homeostasis", {
      mode: "sleep",
    }) as Record<string, unknown>;

    const prediction = result ?? {};
    const consequences: string[] = [];
    const risks: string[] = [];

    // Extract readiness signals
    if (prediction.verdict) consequences.push(`Readiness: ${prediction.verdict}`);
    if (prediction.score !== undefined) {
      const score = prediction.score as number;
      if (score < 50) risks.push("Low readiness — operator may need rest");
    }

    const confidence = 0.6; // Human state is INT-level

    return {
      ...base,
      tool: "well_assess_homeostasis",
      prediction,
      epistemic: "INT",
      confidence,
      consequences,
      risks,
      recommendation: risks.length === 0 ? "PROCEED" : "CAUTION",
    };
  } catch (err: any) {
    return {
      ...base,
      tool: "well_assess_homeostasis",
      prediction: null,
      epistemic: "UNKNOWN",
      confidence: 0,
      consequences: [],
      risks: [`WELL prediction failed: ${err.message?.slice(0, 200)}`],
      recommendation: "CAUTION",
    };
  }
}

// ── Simulation Gate ─────────────────────────────────────────────────────────

/**
 * Check if an action requires pre-action simulation.
 *
 * Rule: Irreversible actions ALWAYS require simulation.
 * Reversible actions: recommended but not mandatory.
 */
export function requiresSimulation(request: SimulationRequest): boolean {
  return request.action_class === "EXECUTE_IRREVERSIBLE" || request.action_class === "EXTERNAL_SIDE_EFFECT";
}

/**
 * Build a simulation gate verdict based on prediction results.
 */
export function simulationGateVerdict(prediction: PredictionResult): {
  proceed: boolean;
  verdict: "SEAL_CANDIDATE" | "HOLD_PREDICTION" | "VOID_RISK";
  reason: string;
} {
  if (prediction.recommendation === "BLOCK") {
    return {
      proceed: false,
      verdict: "VOID_RISK",
      reason: `Prediction blocked: ${prediction.risks.join("; ")}`,
    };
  }
  if (prediction.recommendation === "CAUTION") {
    return {
      proceed: false,
      verdict: "HOLD_PREDICTION",
      reason: `Prediction caution: ${prediction.risks.join("; ")}. Proceed with sovereign ack.`,
    };
  }
  return {
    proceed: true,
    verdict: "SEAL_CANDIDATE",
    reason: `Prediction favorable. Confidence: ${prediction.confidence.toFixed(2)}. Domain: ${prediction.domain}.`,
  };
}
