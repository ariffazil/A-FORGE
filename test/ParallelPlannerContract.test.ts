import test from "node:test";
import assert from "node:assert/strict";
import type { LlmProvider } from "../src/llm/LlmProvider.js";
import type { LlmTurnRequest, LlmTurnResponse } from "../src/types/agent.js";
import {
  ParallelPlannerContract,
  DEFAULT_STRATEGIES,
} from "../src/planner/ParallelPlannerContract.js";
import { buildCoordinatorProfile } from "../src/agents/profiles.js";

class ScriptedProvider implements LlmProvider {
  readonly name = "scripted";

  constructor(private readonly turns: Array<{ content: string }>) {}

  async completeTurn(_request: LlmTurnRequest): Promise<LlmTurnResponse> {
    const next = this.turns.shift();
    if (!next) {
      throw new Error("No scripted turns left.");
    }
    return {
      content: next.content,
      toolCalls: [],
      usage: { inputTokens: 10, outputTokens: 10 },
      stopReason: "completed",
      responseId: `resp_${Date.now()}`,
    };
  }
}

const PROFILE = buildCoordinatorProfile("internal_mode");

const IDENTICAL_PLAN = JSON.stringify([
  {
    name: "analyze-auth",
    task: "analyze the authentication service for vulnerabilities",
    confidence: 0.9,
    rationale: "understand the problem space",
  },
  {
    name: "fix-auth",
    task: "fix the authentication token handling bug",
    confidence: 0.9,
    rationale: "apply targeted correction",
  },
  {
    name: "test-auth",
    task: "test the authentication service end to end",
    confidence: 0.9,
    rationale: "verify the fix",
  },
]);

const MODERATE_PLAN_A = JSON.stringify([
  {
    name: "analyze-auth",
    task: "analyze the authentication service for vulnerabilities",
    confidence: 0.9,
    rationale: "understand first",
  },
  {
    name: "fix-auth",
    task: "fix the authentication token handling bug",
    confidence: 0.9,
    rationale: "apply fix",
  },
  {
    name: "test-auth",
    task: "test the authentication service end to end",
    confidence: 0.9,
    rationale: "verify",
  },
]);

const MODERATE_PLAN_B = JSON.stringify([
  {
    name: "analyze-auth",
    task: "analyze the authentication service for issues",
    confidence: 0.85,
    rationale: "identify root cause",
  },
  {
    name: "redesign-auth",
    task: "redesign the authentication token architecture for better security",
    confidence: 0.85,
    rationale: "structural improvement",
  },
  {
    name: "test-auth",
    task: "test the authentication service integration",
    confidence: 0.85,
    rationale: "integration check",
  },
]);

const CRITICAL_PLAN_A = JSON.stringify([
  {
    name: "analyze-db",
    task: "analyze the database schema and query performance",
    confidence: 0.9,
    rationale: "understand data layer",
  },
  {
    name: "optimize-db",
    task: "optimize slow database queries with indexes",
    confidence: 0.9,
    rationale: "performance fix",
  },
]);

const CRITICAL_PLAN_B = JSON.stringify([
  {
    name: "review-ui",
    task: "review the frontend components and user interface",
    confidence: 0.9,
    rationale: "assess presentation layer",
  },
  {
    name: "redesign-ui",
    task: "redesign the user interface for better performance",
    confidence: 0.9,
    rationale: "ui overhaul",
  },
]);

test("ParallelPlannerContract — identical plans produce SEAL verdict with zero divergence", async () => {
  const contract = new ParallelPlannerContract(
    PROFILE,
    new ScriptedProvider([{ content: IDENTICAL_PLAN }, { content: IDENTICAL_PLAN }]),
  );

  const result = await contract.plan("fix the authentication bug");

  assert.equal(result.verdict, "SEAL");
  assert.equal(result.candidates.length, 2);
  assert.ok(result.consensusReached, "consensus should be reached");
  assert.ok(
    result.divergenceScore <= 0.3,
    `divergence should be ≤0.3, got ${result.divergenceScore}`,
  );
  assert.ok(result.selectedTasks.length > 0, "should select tasks");
  assert.ok(result.selectedStrategyId !== null, "should select a strategy");
  assert.ok(result.reason.includes("SEAL") || result.reason.includes("converge"), "reason should reflect convergence");
});

test("ParallelPlannerContract — moderately diverging plans produce SABAR verdict", async () => {
  const contract = new ParallelPlannerContract(
    PROFILE,
    new ScriptedProvider([{ content: MODERATE_PLAN_A }, { content: MODERATE_PLAN_B }]),
  );

  const result = await contract.plan("fix the authentication service");

  assert.equal(result.verdict, "SABAR");
  assert.equal(result.candidates.length, 2);
  assert.ok(
    result.divergenceScore > 0.3,
    `divergence should be >0.3, got ${result.divergenceScore}`,
  );
  assert.ok(
    result.divergenceScore <= 0.6,
    `divergence should be ≤0.6, got ${result.divergenceScore}`,
  );
  assert.ok(result.selectedTasks.length > 0, "SABAR should still select lower-risk tasks");
  assert.equal(
    result.selectedStrategyId,
    "physics_first",
    "SABAR should select the lower-risk physics_first strategy",
  );
  assert.ok(result.reason.includes("diverge"), "reason should mention divergence");
});

test("ParallelPlannerContract — critically diverging plans produce HOLD verdict", async () => {
  const contract = new ParallelPlannerContract(
    PROFILE,
    new ScriptedProvider([{ content: CRITICAL_PLAN_A }, { content: CRITICAL_PLAN_B }]),
  );

  const result = await contract.plan("improve system performance");

  assert.equal(result.verdict, "HOLD");
  assert.equal(result.candidates.length, 2);
  assert.ok(!result.consensusReached, "consensus should not be reached on HOLD");
  assert.ok(
    result.divergenceScore > 0.6,
    `divergence should be >0.6, got ${result.divergenceScore}`,
  );
  assert.equal(result.selectedStrategyId, null, "HOLD should not select a strategy");
  assert.deepEqual(result.selectedTasks, [], "HOLD should not select tasks");
  assert.ok(
    result.reason.includes("Human review required"),
    "HOLD reason should require human review",
  );
});

test("ParallelPlannerContract — unparseable LLM responses produce SEAL with empty tasks", async () => {
  const contract = new ParallelPlannerContract(
    PROFILE,
    new ScriptedProvider([
      { content: "I cannot create a plan for this request." },
      { content: "This task is unclear and cannot be decomposed." },
    ]),
  );

  const result = await contract.plan("do something vague");

  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].tasks.length, 0, "first candidate should have no tasks");
  assert.equal(result.candidates[1].tasks.length, 0, "second candidate should have no tasks");
  assert.equal(
    result.divergenceScore,
    0.0,
    "two empty plans have zero divergence",
  );
  assert.equal(result.verdict, "SEAL", "empty plans converge trivially → SEAL");
  assert.equal(result.selectedTasks.length, 0, "selected tasks should be empty");
});

test("ParallelPlannerContract — HOLD verdict exposes all candidate metadata", async () => {
  const contract = new ParallelPlannerContract(
    PROFILE,
    new ScriptedProvider([{ content: CRITICAL_PLAN_A }, { content: CRITICAL_PLAN_B }]),
  );

  const result = await contract.plan("conflicting strategic task");

  assert.equal(result.verdict, "HOLD");
  assert.equal(result.candidates.length, 2);

  const physicsCandidate = result.candidates.find((c) => c.strategyId === "physics_first");
  const pragmaticCandidate = result.candidates.find((c) => c.strategyId === "pragmatic");

  assert.ok(physicsCandidate !== undefined, "physics_first candidate should be present");
  assert.ok(pragmaticCandidate !== undefined, "pragmatic candidate should be present");
  assert.ok(physicsCandidate!.confidence > 0, "confidence should be tracked");
  assert.ok(
    physicsCandidate!.riskScore < pragmaticCandidate!.riskScore,
    "physics_first should have lower risk than pragmatic",
  );
  assert.ok(physicsCandidate!.generatedAt.length > 0, "generatedAt should be set");
});

test("ParallelPlannerContract — DEFAULT_STRATEGIES are orthogonal and ordered by risk", () => {
  assert.equal(DEFAULT_STRATEGIES.length, 2, "should have exactly 2 default strategies");

  const [physicsFirst, pragmatic] = DEFAULT_STRATEGIES;

  assert.equal(physicsFirst.strategyId, "physics_first");
  assert.equal(pragmatic.strategyId, "pragmatic");
  assert.notEqual(
    physicsFirst.strategyId,
    pragmatic.strategyId,
    "strategy IDs must be distinct",
  );
  assert.ok(
    physicsFirst.riskBias < pragmatic.riskBias,
    "physics_first riskBias should be lower than pragmatic",
  );
  assert.ok(
    physicsFirst.systemPromptSuffix !== pragmatic.systemPromptSuffix,
    "strategy prompts must be distinct",
  );
});

test("ParallelPlannerContract — custom W3 threshold of 0.99 forces SABAR on near-identical plans", async () => {
  const contract = new ParallelPlannerContract(
    PROFILE,
    new ScriptedProvider([{ content: IDENTICAL_PLAN }, { content: IDENTICAL_PLAN }]),
    DEFAULT_STRATEGIES,
    0.99,
  );

  const result = await contract.plan("fix the authentication bug");

  assert.equal(result.divergenceScore, 0.0, "identical plans have zero divergence");
  assert.equal(result.consensusReached, true, "1 - 0.0 = 1.0 >= 0.99 so consensus is reached");
  assert.equal(result.verdict, "SEAL", "divergence=0 is below SABAR threshold regardless of W3");
});
