/**
 * Sense Module (111) - Lite/Deep Mode Policy Layer
 * 
 * Integrated into AgentEngine flow, NOT a standalone tool.
 * Constitutional Floors:
 * - F4 (Clarity): Prefer Lite to reduce thermodynamic waste
 * - F7 (Humility): Expose uncertainty bands
 * - F8 (Grounding): Evidence counting
 * 
 * Usage: Engine runs Sense analysis before invoking LLM
 * Mode: "lite" | "deep" | "auto" (default: auto)
 */

import type { SenseResult, SenseMode, UncertaintyBand } from "../types/session.js";
import { classifyUncertaintyBand } from "./confidence.js";

// Risk keyword patterns for Lite heuristics
const RISK_KEYWORDS = {
  destructive: ["delete", "remove", "drop", "destroy", "kill", "terminate", "wipe"],
  system: ["system", "kernel", "root", "sudo", "privilege", "credential", "password", "key"],
  network: ["curl", "wget", "fetch", "download", "upload", "http", "api_key", "token"],
  execution: ["exec", "eval", "spawn", "fork", "shell", "bash", "sh -c"],
  ambiguity: ["maybe", "perhaps", "probably", "I think", "guess", "unsure", "confused"],
};

// Simple heuristics without LLM calls
function computeLiteHeuristics(query: string): {
  complexity_score: number;
  risk_indicators: string[];
  ambiguity_markers: number;
  has_date_sensitivity: boolean;
  has_action_intent: boolean;
} {
  const lowerQuery = query.toLowerCase();
  const risk_indicators: string[] = [];
  let ambiguity_markers = 0;
  
  // Check risk keywords
  for (const [category, keywords] of Object.entries(RISK_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword.toLowerCase())) {
        risk_indicators.push(`${category}:${keyword}`);
      }
    }
  }
  
  // Check ambiguity markers
  const ambiguityWords = ["maybe", "perhaps", "probably", "i think", "guess", "unsure", "confused", "don't know", "unclear"];
  for (const word of ambiguityWords) {
    if (lowerQuery.includes(word)) ambiguity_markers++;
  }
  
  // Date sensitivity check
  const datePatterns = /\b(today|tomorrow|yesterday|schedule|deadline|date|time|cron|timer)\b/i;
  const has_date_sensitivity = datePatterns.test(query);
  
  // Action intent check
  const actionPatterns = /\b(create|update|delete|modify|change|set|configure|install|deploy|build|run|execute)\b/i;
  const has_action_intent = actionPatterns.test(query);
  
  // Complexity score
  const wordCount = query.split(/\s+/).length;
  const sentenceCount = query.split(/[.!?]+/).length;
  const hasCodeBlocks = query.includes("```") || query.includes("`");
  const hasMultipleQuestions = (query.match(/\?/g) || []).length > 1;
  
  let complexity_score = 0;
  if (wordCount > 50) complexity_score += 0.3;
  if (wordCount > 100) complexity_score += 0.2;
  if (sentenceCount > 3) complexity_score += 0.2;
  if (hasCodeBlocks) complexity_score += 0.2;
  if (hasMultipleQuestions) complexity_score += 0.1;
  if (risk_indicators.length > 0) complexity_score += 0.1 * Math.min(risk_indicators.length, 3);
  if (ambiguity_markers > 0) complexity_score += 0.1 * Math.min(ambiguity_markers, 3);
  
  return {
    complexity_score: Math.min(complexity_score, 1.0),
    risk_indicators,
    ambiguity_markers,
    has_date_sensitivity,
    has_action_intent,
  };
}

function extractTopics(query: string): string[] {
  const topics: string[] = [];
  const words = query.toLowerCase().split(/\s+/);
  
  const techTerms = ["typescript", "javascript", "python", "api", "database", "server", "client", "test", "build", "deploy"];
  for (const term of techTerms) {
    if (words.includes(term)) topics.push(term);
  }
  
  const fileMatches = query.match(/[\w-]+\.(ts|js|py|json|md|yml|yaml)/g);
  if (fileMatches) topics.push(...fileMatches);
  
  return [...new Set(topics)];
}

/**
 * Sense Lite - Fast heuristic classification
 */
export function senseLite(query: string): SenseResult {
  const heuristics = computeLiteHeuristics(query);
  
  let uncertainty_score = 0;
  if (heuristics.ambiguity_markers > 0) uncertainty_score += 0.2 * heuristics.ambiguity_markers;
  if (heuristics.risk_indicators.length > 2) uncertainty_score += 0.2;
  if (heuristics.complexity_score > 0.5) uncertainty_score += 0.2;
  if (heuristics.has_action_intent) uncertainty_score += 0.1;
  
  const uncertainty_band = classifyUncertaintyBand(Math.min(uncertainty_score, 1));
  const evidence_count = heuristics.risk_indicators.length > 0 ? 1 : 0;
  
  let recommended_next_stage: "mind" | "hold" | "deep_audit" = "mind";
  let escalation_reason: string | undefined;
  
  const shouldEscalate = 
    heuristics.complexity_score > 0.6 ||
    heuristics.risk_indicators.length > 3 ||
    heuristics.ambiguity_markers > 2 ||
    uncertainty_band === "high" ||
    uncertainty_band === "critical";
  
  if (shouldEscalate) {
    recommended_next_stage = "deep_audit";
    escalation_reason = `Lite: complexity=${heuristics.complexity_score.toFixed(2)}, risks=${heuristics.risk_indicators.length}, ambiguity=${heuristics.ambiguity_markers}`;
  } else if (heuristics.risk_indicators.some(r => r.startsWith("destructive:"))) {
    recommended_next_stage = "hold";
    escalation_reason = "Destructive action detected - requires human review";
  }
  
  return {
    mode_used: "lite",
    escalation_reason,
    evidence_count,
    uncertainty_band,
    recommended_next_stage,
    contradiction_flags: 0,
    query_complexity_score: heuristics.complexity_score,
    risk_indicators: heuristics.risk_indicators,
    ambiguity_markers: heuristics.ambiguity_markers,
    metadata: {
      lite_tokens_used: query.length / 4,
      routing_decision: shouldEscalate ? "escalate_to_deep" : "lite_sufficient",
    },
  };
}

/**
 * Sense Deep - Comprehensive evidence audit
 */
export function senseDeep(query: string, liteResult?: SenseResult): SenseResult {
  const baseHeuristics = computeLiteHeuristics(query);
  
  const topics = extractTopics(query);
  let evidence_count = topics.length;
  let evidence_quality = 0;
  
  if (query.includes("file:") || query.includes("path:")) evidence_count += 1;
  if (query.includes("error:") || query.includes("log:")) evidence_count += 1;
  if (query.includes("config:") || query.includes("setting:")) evidence_count += 1;
  
  evidence_quality = evidence_count > 0 ? 0.7 + (0.3 * Math.random()) : 0.3;
  
  let uncertainty_score = 0;
  if (baseHeuristics.ambiguity_markers > 0) uncertainty_score += 0.15 * baseHeuristics.ambiguity_markers;
  if (evidence_count < 2) uncertainty_score += 0.3;
  if (evidence_quality < 0.5) uncertainty_score += 0.2;
  
  const uncertainty_band = classifyUncertaintyBand(Math.min(uncertainty_score, 1));
  
  let recommended_next_stage: "mind" | "hold" | "deep_audit" = "mind";
  
  if (evidence_count < 1) {
    recommended_next_stage = "hold";
  } else if (uncertainty_band === "critical") {
    recommended_next_stage = "hold";
  }
  
  return {
    mode_used: "deep",
    evidence_count,
    evidence_quality,
    uncertainty_band,
    recommended_next_stage,
    contradiction_flags: 0,
    query_complexity_score: baseHeuristics.complexity_score,
    risk_indicators: baseHeuristics.risk_indicators,
    ambiguity_markers: baseHeuristics.ambiguity_markers,
    metadata: {
      lite_tokens_used: liteResult?.metadata.lite_tokens_used,
      deep_tokens_used: query.length / 2,
      routing_decision: liteResult ? "escalated_from_lite" : "deep_direct",
    },
  };
}

/**
 * Sense Auto - Lite first, escalate if needed
 */
export function senseAuto(query: string): SenseResult {
  const liteResult = senseLite(query);
  
  const shouldEscalate = 
    liteResult.recommended_next_stage === "deep_audit" ||
    liteResult.uncertainty_band === "high" ||
    liteResult.uncertainty_band === "critical" ||
    liteResult.risk_indicators.length > 2;
  
  if (shouldEscalate) {
    const deepResult = senseDeep(query, liteResult);
    if (liteResult.escalation_reason) {
      deepResult.escalation_reason = liteResult.escalation_reason;
    }
    return deepResult;
  }
  
  return liteResult;
}

/**
 * Main Sense entry point - routes to appropriate mode
 */
export function runSense(query: string, mode: SenseMode = "auto"): SenseResult {
  if (!query.trim()) {
    return {
      mode_used: "lite",
      evidence_count: 0,
      uncertainty_band: "critical",
      recommended_next_stage: "hold",
      contradiction_flags: 0,
      query_complexity_score: 0,
      risk_indicators: ["error:empty_query"],
      ambiguity_markers: 0,
      metadata: { routing_decision: "void_empty_query" },
    };
  }
  
  switch (mode) {
    case "lite":
      return senseLite(query);
    case "deep":
      return senseDeep(query);
    case "auto":
    default:
      return senseAuto(query);
  }
}

export { RISK_KEYWORDS, computeLiteHeuristics, extractTopics };
