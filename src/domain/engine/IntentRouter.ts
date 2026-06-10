/**
 * IntentRouter — 222_THINK: Domain Classification & Routing
 *
 * Parses the user's intent and classifies it into one of three domains:
 *   GEOX  — Physical/Earth intelligence (subsurface, seismic, hazard, climate)
 *   WEALTH — Capital/Resource intelligence (EMV, NPV, thermodynamic, ROI)
 *   CODE  — Software development (file ops, shell, search)
 *
 * The router is the first semantic gate after 000_INIT. It determines
 * which organ gets activated in 333_MIND and how the pipeline proceeds.
 *
 * @module engine/IntentRouter
 * @pipeline 222_THINK
 * @constitutional F13 Sovereign — routing decision is advisory; human can override
 */

export type IntentDomain = "GEOX" | "WEALTH" | "CODE" | "MIXED";

export type RoutingDecision = {
  domain: IntentDomain;
  confidence: number;          // [0, 1]
  primaryOrgan: IntentDomain;
  secondaryOrgans: IntentDomain[];
  triggers: string[];          // keywords that fired
  uncertaintyBand: "low" | "medium" | "high" | "critical";
  recommendedNextStage: "333_MIND" | "111_SENSE" | "666_ALIGN";
  reasoning: string;
};

const GEOX_KEYWORDS = [
  // Physical domains
  "subsurface", "reservoir", "seismic", " geology", "geological",
  "hazard", "earthquake", "volcanic", "flood", "landslide",
  "extraction", "production", "field", "well", "formation",
  "climate", "temperature", "precipitation", "sea level",
  "soil", " terrain", "topography", "bathymetry",
  "carbon", "emissions", "environmental", "pollution",
  // Physical agents / instruments
  "sensor", "satellite", "drone", "survey", "measurement",
  // Physical quantities
  "pressure", "porosity", "permeability", "saturation",
  "depth", "elevation", "distance", "velocity",
];

const WEALTH_KEYWORDS = [
  // Capital & financial
  "investment", "roi", "npv", "emv", "irr", "cash flow",
  "budget", "cost", "revenue", "profit", "loss",
  "portfolio", "asset", "liability", "equity",
  "capital", "financing", "debt", "equity",
  // Economic optimization
  "optimize", "allocation", "efficiency", "throughput",
  "thermodynamic", "entropy", "energy", "joule",
  "resource", "capacity", "utilization",
  // Market & risk
  "market", "commodity", " futures", "options",
  "risk", "volatility", "variance", "sharpe",
  "supply chain", "logistics", "dispatch",
  // Financial instruments
  "bond", "stock", "derivative", "swap",
  "currency", "fx", "exchange rate",
];

const CODE_KEYWORDS = [
  // File operations
  "file", "read", "write", "edit", "create", "delete",
  "directory", "folder", "path", "directory",
  // Shell operations
  "run", "execute", "command", "shell", "bash",
  "compile", "build", "test", "deploy",
  "install", "npm", "docker", "container",
  // Code search
  "search", "grep", "find", "query", "scan",
  "function", "class", "interface", "module",
  // Development
  "refactor", "migrate", "update", "patch",
  "code review", "lint", "format", "debug",
];

const MIXED_INDICATORS = [
  "compare", "versus", "vs", "alternative", "strategy",
  " tradeoff", "analysis", "evaluate", "assess",
];

function scoreKeywordMatch(text: string, keywords: string[]): { count: number; matches: string[] } {
  const lower = text.toLowerCase();
  const matches: string[] = [];
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) {
      matches.push(kw);
    }
  }
  return { count: matches.length, matches };
}

function computeUncertaintyBand(domainScores: { GEOX: number; WEALTH: number; CODE: number }, total: number): RoutingDecision["uncertaintyBand"] {
  if (total === 0) return "critical";
  const top = Math.max(domainScores.GEOX, domainScores.WEALTH, domainScores.CODE);
  const ratio = top / total;
  if (ratio >= 0.7) return "low";
  if (ratio >= 0.4) return "medium";
  if (total >= 3) return "high";
  return "critical";
}

export function routeIntent(intent: string): RoutingDecision {
  const GEOX = scoreKeywordMatch(intent, GEOX_KEYWORDS);
  const wealth = scoreKeywordMatch(intent, WEALTH_KEYWORDS);
  const code = scoreKeywordMatch(intent, CODE_KEYWORDS);
  const mixed = scoreKeywordMatch(intent, MIXED_INDICATORS);

  const domainScores = {
    GEOX: GEOX.count,
    WEALTH: wealth.count,
    CODE: code.count,
  };
  const total = GEOX.count + wealth.count + code.count;

  // Determine primary domain
  let primaryOrgan: IntentDomain;
  if (GEOX.count > wealth.count && GEOX.count > code.count) {
    primaryOrgan = "GEOX";
  } else if (wealth.count > GEOX.count && wealth.count > code.count) {
    primaryOrgan = "WEALTH";
  } else if (code.count > GEOX.count && code.count > wealth.count) {
    primaryOrgan = "CODE";
  } else if (total === 0) {
    primaryOrgan = "CODE"; // Default to code agent when no signal
  } else {
    // Ambiguous — mixed signal
    primaryOrgan = "MIXED";
  }

  // Secondary organs (any domain with score > 0 but not primary)
  const secondary: IntentDomain[] = [];
  if (GEOX.count > 0 && primaryOrgan !== "GEOX") secondary.push("GEOX");
  if (wealth.count > 0 && primaryOrgan !== "WEALTH") secondary.push("WEALTH");
  if (code.count > 0 && primaryOrgan !== "CODE") secondary.push("CODE");

  const uncertaintyBand = computeUncertaintyBand(domainScores, total);

  // Reasoning string
  const parts: string[] = [];
  if (GEOX.count > 0) parts.push(`GEOX[${GEOX.count}]: ${GEOX.matches.slice(0, 3).join(", ")}${GEOX.count > 3 ? "..." : ""}`);
  if (wealth.count > 0) parts.push(`WEALTH[${wealth.count}]: ${wealth.matches.slice(0, 3).join(", ")}${wealth.count > 3 ? "..." : ""}`);
  if (code.count > 0) parts.push(`CODE[${code.count}]: ${code.matches.slice(0, 3).join(", ")}${code.count > 3 ? "..." : ""}`);
  if (mixed.count > 0) parts.push(`MIXED[${mixed.count}]`);

  const reasoning = parts.length > 0 ? parts.join(" | ") : "No domain keywords detected — defaulting to CODE";

  // Recommended next stage
  let recommendedNextStage: RoutingDecision["recommendedNextStage"] = "333_MIND";
  if (uncertaintyBand === "critical") {
    recommendedNextStage = "111_SENSE"; // Re-sense before proceeding
  } else if (uncertaintyBand === "high") {
    recommendedNextStage = "111_SENSE"; // Need more clarity
  }

  // Confidence: weighted by how dominant the primary is
  let confidence: number;
  if (total === 0) {
    confidence = 0.3; // Low confidence default
  } else {
    const dominantRatio = Math.max(...Object.values(domainScores)) / total;
    // Combine dominance with total keyword count as evidence mass
    confidence = Math.min(0.95, dominantRatio * 0.6 + Math.min(total * 0.05, 0.35));
  }

  return {
    domain: primaryOrgan,
    confidence,
    primaryOrgan,
    secondaryOrgans: secondary,
    triggers: [...GEOX.matches, ...wealth.matches, ...code.matches],
    uncertaintyBand,
    recommendedNextStage,
    reasoning,
  };
}

/**
 * Build the 222_THINK routing context for injection into AgentEngine.
 * Returns a structured context that can be passed to 333_MIND.
 */
export function buildRoutingContext(decision: RoutingDecision): Record<string, unknown> {
  return {
    stage: "222_THINK",
    domain: decision.domain,
    primaryOrgan: decision.primaryOrgan,
    secondaryOrgans: decision.secondaryOrgans,
    confidence: decision.confidence,
    uncertaintyBand: decision.uncertaintyBand,
    triggers: decision.triggers,
    recommendedNextStage: decision.recommendedNextStage,
    reasoning: decision.reasoning,
  };
}
