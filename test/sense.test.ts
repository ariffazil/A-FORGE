/**
 * Tests for Sense Module (111) - Lite/Deep Policy Layer
 * 
 * Acceptance Tests:
 * 1. Short benign query routes to Lite
 * 2. Ambiguous or high-risk query escalates to Deep
 * 3. Auto mode escalates appropriately
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  runSense,
  senseLite,
  senseDeep,
  senseAuto,
  computeLiteHeuristics,
  extractTopics,
  RISK_KEYWORDS,
} from "../src/policy/sense.js";

test("computeLiteHeuristics - short benign query has low complexity", () => {
  const query = "Hello, how are you?";
  const heuristics = computeLiteHeuristics(query);
  
  assert.ok(heuristics.complexity_score < 0.3, "Simple query should have low complexity");
  assert.equal(heuristics.risk_indicators.length, 0, "Simple query should have no risk indicators");
  assert.equal(heuristics.ambiguity_markers, 0, "Simple query should have no ambiguity");
  assert.equal(heuristics.has_action_intent, false, "Simple query should have no action intent");
});

test("computeLiteHeuristics - detects destructive keywords", () => {
  const query = "Please delete all files in the system directory";
  const heuristics = computeLiteHeuristics(query);
  
  assert.ok(heuristics.risk_indicators.length > 0, "Should detect destructive keywords");
  assert.ok(
    heuristics.risk_indicators.some(r => r.includes("destructive")),
    "Should flag destructive category"
  );
  assert.equal(heuristics.has_action_intent, true, "Should detect action intent");
});

test("computeLiteHeuristics - detects system/credential keywords", () => {
  const query = "Show me the root password and system credentials";
  const heuristics = computeLiteHeuristics(query);
  
  assert.ok(
    heuristics.risk_indicators.some(r => r.includes("system")),
    "Should flag system/credential category"
  );
});

test("computeLiteHeuristics - detects ambiguity markers", () => {
  const query = "I think maybe we should probably delete this file, I'm not sure";
  const heuristics = computeLiteHeuristics(query);
  
  assert.ok(heuristics.ambiguity_markers >= 3, "Should detect multiple ambiguity markers");
});

test("computeLiteHeuristics - complex query has higher complexity score", () => {
  const query = `
    I need to refactor the entire codebase to use a new pattern. 
    First, we should analyze all the existing modules. 
    Then, update the imports across multiple files.
    Also, what about the tests? Should we update those too?
    And the documentation needs changes as well.
    \`\`\`typescript
    function example() { return true; }
    \`\`\`
  `;
  const heuristics = computeLiteHeuristics(query);
  
  assert.ok(heuristics.complexity_score > 0.5, "Complex query should have higher complexity");
  assert.ok(heuristics.has_action_intent, "Should detect action intent in complex query");
});

test("extractTopics - identifies technical terms", () => {
  const query = "I need to fix the TypeScript build and update the API configuration";
  const topics = extractTopics(query);
  
  assert.ok(topics.includes("typescript"), "Should extract 'typescript' topic");
  assert.ok(topics.includes("api"), "Should extract 'api' topic");
});

test("extractTopics - identifies file references", () => {
  const query = "Check the config.ts and main.js files in the src directory";
  const topics = extractTopics(query);
  
  assert.ok(topics.includes("config.ts"), "Should extract 'config.ts'");
  assert.ok(topics.includes("main.js"), "Should extract 'main.js'");
});

test("senseLite - short benign query routes to Lite with PASS", () => {
  const query = "List the files in the current directory";
  const result = senseLite(query);
  
  assert.equal(result.mode_used, "lite");
  assert.ok(result.evidence_count >= 0, "Should have non-negative evidence count");
  assert.ok(["low", "medium", "high", "critical"].includes(result.uncertainty_band));
  assert.ok(
    result.recommended_next_stage === "mind" || result.recommended_next_stage === "deep_audit",
    "Should recommend mind or deep_audit"
  );
  assert.equal(result.metadata.routing_decision, "lite_sufficient", "Simple query should use lite");
});

test("senseLite - destructive query triggers HOLD recommendation", () => {
  const query = "Delete all system files permanently";
  const result = senseLite(query);
  
  assert.equal(result.mode_used, "lite");
  assert.ok(
    result.risk_indicators.some(r => r.startsWith("destructive:")),
    "Should flag destructive indicators"
  );
  assert.equal(result.recommended_next_stage, "hold", "Destructive query should trigger HOLD");
  assert.ok(result.escalation_reason?.includes("Destructive"), "Should include destructive reason");
});

test("senseLite - ambiguous query escalates to Deep", () => {
  const query = "I think maybe we should probably do something with the database, I'm unsure what exactly";
  const result = senseLite(query);
  
  assert.equal(result.mode_used, "lite");
  assert.ok((result.ambiguity_markers ?? 0) >= 3, "Should detect ambiguity");
  assert.equal(result.recommended_next_stage, "deep_audit", "Ambiguous query should escalate");
  assert.ok(result.escalation_reason, "Should provide escalation reason");
});

test("senseDeep - provides comprehensive analysis", () => {
  const query = "Fix the bug in the authentication module";
  const result = senseDeep(query);
  
  assert.equal(result.mode_used, "deep");
  assert.ok(result.evidence_count >= 0, "Deep should provide evidence count");
  assert.ok(result.evidence_quality !== undefined, "Deep should provide evidence quality");
  assert.ok(result.metadata.deep_tokens_used !== undefined, "Deep should track token estimate");
  assert.equal(result.metadata.routing_decision, "deep_direct", "Should indicate direct deep call");
});

test("senseDeep - respects Lite pre-analysis", () => {
  const query = "Complex query with multiple concerns";
  const liteResult = senseLite(query);
  const deepResult = senseDeep(query, liteResult);
  
  assert.equal(deepResult.mode_used, "deep");
  assert.equal(deepResult.metadata.routing_decision, "escalated_from_lite");
  assert.ok(deepResult.metadata.lite_tokens_used !== undefined, "Should preserve Lite token estimate");
});

test("senseAuto - simple query stays in Lite", () => {
  const query = "Hello world";
  const result = senseAuto(query);
  
  assert.equal(result.mode_used, "lite");
  assert.equal(result.metadata.routing_decision, "lite_sufficient");
});

test("senseAuto - complex query escalates to Deep", () => {
  const query = "I think maybe we should delete the production database, I'm not sure if it's safe";
  const result = senseAuto(query);
  
  assert.equal(result.mode_used, "deep");
  assert.equal(result.metadata.routing_decision, "escalated_from_lite");
  assert.ok(result.escalation_reason, "Should preserve escalation reason");
});

test("runSense - empty query returns critical", () => {
  const result = runSense("", "auto");
  
  assert.equal(result.recommended_next_stage, "hold");
  assert.equal(result.uncertainty_band, "critical");
  assert.ok(result.risk_indicators.includes("error:empty_query"));
});

test("runSense - mode=lite routes to Lite path", () => {
  const result = runSense("Simple query", "lite");
  
  assert.equal(result.mode_used, "lite");
});

test("runSense - mode=deep routes to Deep path", () => {
  const result = runSense("Complex query", "deep");
  
  assert.equal(result.mode_used, "deep");
});

test("runSense - mode=auto defaults correctly", () => {
  const result = runSense("Test query", "auto");
  
  assert.ok(["lite", "deep"].includes(result.mode_used));
});

test("runSense - includes structured metadata", () => {
  const result = runSense("Fix the TypeScript build", "deep");
  
  assert.ok(typeof result.evidence_count === "number");
  assert.ok(typeof result.query_complexity_score === "number");
  assert.ok(Array.isArray(result.risk_indicators));
  assert.ok(["low", "medium", "high", "critical"].includes(result.uncertainty_band));
  assert.ok(["mind", "hold", "deep_audit"].includes(result.recommended_next_stage));
});

test("RISK_KEYWORDS - contains expected categories", () => {
  assert.ok(RISK_KEYWORDS.destructive.length > 0);
  assert.ok(RISK_KEYWORDS.system.length > 0);
  assert.ok(RISK_KEYWORDS.network.length > 0);
  assert.ok(RISK_KEYWORDS.execution.length > 0);
  assert.ok(RISK_KEYWORDS.ambiguity.length > 0);
});

test("Integration - Lite then Deep escalation flow", () => {
  const query = "This is a complex query that might have some ambiguity and maybe some risk";
  
  // First, run Lite
  const liteResult = senseLite(query);
  assert.equal(liteResult.mode_used, "lite");
  
  // Check if it should escalate
  const shouldEscalate = liteResult.recommended_next_stage === "deep_audit";
  
  if (shouldEscalate) {
    const deepResult = senseDeep(query, liteResult);
    assert.equal(deepResult.mode_used, "deep");
    assert.ok(deepResult.evidence_count >= liteResult.evidence_count);
  }
});

test("Integration - Sense result feeds into Confidence", async () => {
  const { calculateConfidenceEstimate, evaluateWithConfidence } = await import("../src/policy/confidence.js");
  
  const query = "Fix the authentication bug in login.ts";
  const senseResult = senseDeep(query);
  
  // Use Sense output to calculate confidence
  const confidence = calculateConfidenceEstimate(
    senseResult.evidence_count,
    senseResult.evidence_quality ?? 0.5,
    senseResult.contradiction_flags,
    senseResult.uncertainty_band === "high" ? 0.5 : 0.2,
  );
  
  assert.ok(confidence.is_estimate);
  assert.ok(confidence.value >= 0 && confidence.value <= 1);
  
  // Evaluate with Judge
  const judgeResult = evaluateWithConfidence(
    confidence,
    senseResult.uncertainty_band,
    senseResult.contradiction_flags,
    senseResult.evidence_count,
  );
  
  assert.ok(["SEAL", "HOLD", "VOID"].includes(judgeResult.verdict));
  assert.ok(judgeResult.confidence.is_estimate);
});
