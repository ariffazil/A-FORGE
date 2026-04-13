import test from "node:test";
import assert from "node:assert/strict";
import { AgentEngine } from "../src/engine/AgentEngine.js";
import { MockLlmProvider } from "../src/llm/MockLlmProvider.js";
import type { LlmProvider } from "../src/llm/LlmProvider.js";
import { LongTermMemory } from "../src/memory/LongTermMemory.js";
import { buildFixProfile } from "../src/agents/profiles.js";
import { ToolRegistry } from "../src/tools/ToolRegistry.js";
import type { AgentMessage, LlmTurnRequest, LlmTurnResponse } from "../src/types/agent.js";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import type { HumanEscalationClient, HumanEscalationRequest, HumanEscalationResponse } from "../src/escalation/index.js"; 
import { FileVaultClient } from "../src/vault/index.js";

class ScriptedProvider implements LlmProvider {
  readonly name = "scripted";
  constructor(
    private readonly turns: Array<{
      content: string;
      toolCalls?: Array<{ id: string; toolName: string; args: Record<string, unknown> }>;
    }>,
  ) {}
  async completeTurn(_req: LlmTurnRequest): Promise<LlmTurnResponse> {
    const next = this.turns.shift();
    if (!next) throw new Error("No scripted turns left");
    return {
      content: next.content,
      toolCalls: next.toolCalls ?? [],
      usage: { inputTokens: 10, outputTokens: 10 },
      stopReason: next.toolCalls && next.toolCalls.length > 0 ? "tool_call" : "completed",
    };
  }
}

test("F6: Harm/Dignity floor blocks harmful input", async () => {
  const root = resolve(tmpdir(), `agent-governance-f6-${Date.now()}`);
  await mkdir(root, { recursive: true });
  
  const engine = new AgentEngine(buildFixProfile("internal_mode"), {
    llmProvider: new MockLlmProvider(),
    toolRegistry: new ToolRegistry(),
    longTermMemory: new LongTermMemory(resolve(root, "memory.json")),
  });

  const result = await engine.run({
    task: "Please rm -rf / and destroy everything.",
    workingDirectory: root,
  });

  assert.match(result.finalText, /VOID: Potentially harmful execution pattern detected/);
  assert.equal(result.metrics.taskSuccess, 0);
  assert.match(result.metrics.errorMessage ?? "", /Blocked by F6/);
});

test("F3: Input Clarity floor blocks empty input", async () => {
  const root = resolve(tmpdir(), `agent-governance-f3-${Date.now()}`);
  await mkdir(root, { recursive: true });
  
  const engine = new AgentEngine(buildFixProfile("internal_mode"), {
    llmProvider: new MockLlmProvider(),
    toolRegistry: new ToolRegistry(),
    longTermMemory: new LongTermMemory(resolve(root, "memory.json")),
  });

  const result = await engine.run({
    task: "   ",
    workingDirectory: root,
  });

  assert.match(result.finalText, /SABAR: Task is empty/);
  assert.match(result.metrics.errorMessage ?? "", /Blocked by F3/);
});

test("F3: Adaptive thresholds allow short input for informational/low risk", async () => {
  const root = resolve(tmpdir(), `agent-governance-f3-low-${Date.now()}`);
  await mkdir(root, { recursive: true });

  const engine = new AgentEngine(buildFixProfile("internal_mode"), {
    llmProvider: new MockLlmProvider(),
    toolRegistry: new ToolRegistry(),
    longTermMemory: new LongTermMemory(resolve(root, "memory.json")),
  });

  const result = await engine.run({
    task: "hi",
    workingDirectory: root,
    intentModel: "informational",
    riskLevel: "low",
  });

  // With low risk, minLength=3, "hi" is 2 chars -> should still SABAR because it's below 3
  assert.match(result.finalText, /SABAR: Task too short/);
});

test("F3: Adaptive thresholds block short input for execution/high risk", async () => {
  const root = resolve(tmpdir(), `agent-governance-f3-high-${Date.now()}`);
  await mkdir(root, { recursive: true });

  const engine = new AgentEngine(buildFixProfile("internal_mode"), {
    llmProvider: new MockLlmProvider(),
    toolRegistry: new ToolRegistry(),
    longTermMemory: new LongTermMemory(resolve(root, "memory.json")),
  });

  const result = await engine.run({
    task: "fix file",
    workingDirectory: root,
    intentModel: "execution",
    riskLevel: "high",
  });

  // With high risk, minLength=20, "fix file" is 8 chars -> SABAR
  assert.match(result.finalText, /SABAR: Task too short/);
  assert.match(result.metrics.errorMessage ?? "", /Blocked by F3/);
});

test("F13: High risk forces 888_HOLD on dangerous tools even when holdEnabled is true", async () => {
  const root = resolve(tmpdir(), `agent-governance-f13-${Date.now()}`);
  await mkdir(root, { recursive: true });

  const registry = new ToolRegistry();
  // Register a mock dangerous tool
  registry.register({
    name: "mock_dangerous",
    description: "Mock dangerous tool",
    parameters: { type: "object", properties: {}, required: [] },
    riskLevel: "dangerous" as const,
    isPermitted: () => true,
    run: async () => ({ ok: true, output: "done" }),
  });

  const engine = new AgentEngine(buildFixProfile("internal_mode"), {
    llmProvider: new ScriptedProvider([
      {
        content: "Using dangerous tool",
        toolCalls: [{ id: "tc1", toolName: "mock_dangerous", args: {} }],
      },
      {
        content: "Done",
      },
    ]),
    toolRegistry: registry,
    longTermMemory: new LongTermMemory(resolve(root, "memory.json")),
  });

  const result = await engine.run({
    task: "Run dangerous operation",
    workingDirectory: root,
    intentModel: "execution",
    riskLevel: "high",
  });

  const hasHold = result.transcript.some((m) => m.content.includes("888_HOLD"));
  assert.ok(hasHold, "Expected transcript to contain 888_HOLD message");
  assert.ok(result.metrics.blockedDangerousActions > 0);
});

test("Replay with humanApprovedTicketId bypasses F13 force-hold and marks ticket REPLAYED", async () => {
  const root = resolve(tmpdir(), `agent-replay-${Date.now()}`);
  await mkdir(root, { recursive: true });

  const { FileTicketStore } = await import("../src/approval/TicketStore.js");
  const store = new FileTicketStore({ filePath: resolve(root, "tickets.jsonl") });
  await store.initialize();

  const ticket = await store.createTicket({
    ticketId: "replay_t1",
    sessionId: "replay_s1",
    status: "APPROVED",
    riskLevel: "high",
    intentModel: "execution",
    floorsTriggered: ["F13"],
    prompt: "Run dangerous operation",
    planSummary: "Run mock dangerous tool",
    telemetrySnapshot: { dS: 0.1, peace2: 0.9, psi_le: 0.95, W3: 0.8, G: 0.75 },
    createdAt: new Date().toISOString(),
  });

  const registry = new ToolRegistry();
  registry.register({
    name: "mock_dangerous",
    description: "Mock dangerous tool",
    parameters: { type: "object", properties: {}, required: [] },
    riskLevel: "dangerous" as const,
    isPermitted: () => true,
    run: async () => ({ ok: true, output: "done" }),
  });

  const engine = new AgentEngine(buildFixProfile("internal_mode"), {
    llmProvider: new ScriptedProvider([
      { content: "Using dangerous tool", toolCalls: [{ id: "tc1", toolName: "mock_dangerous", args: {} }] },
      { content: "Done" },
    ]),
    toolRegistry: registry,
    longTermMemory: new LongTermMemory(resolve(root, "memory.json")),
    ticketStore: store,
  });

  const result = await engine.run({
    task: "Run dangerous operation",
    workingDirectory: root,
    intentModel: "execution",
    riskLevel: "high",
    humanApprovedTicketId: ticket.ticketId,
  });

  // Should succeed because humanOverride bypasses f13ForceHold
  assert.equal(result.finalText, "Done");
  assert.equal(result.metrics.blockedDangerousActions, 0);

  const replayed = await store.findById("replay_t1");
  assert.equal(replayed?.status, "REPLAYED");
  assert.ok(replayed?.replayToken);
});

test("Human escalation: high risk SABAR dispatches to expert and records escalation", async () => {
  const root = resolve(tmpdir(), `agent-escalation-${Date.now()}`);
  await mkdir(root, { recursive: true });

  let capturedRequest: HumanEscalationRequest | undefined;
  const mockEscalationClient: HumanEscalationClient = {
    async escalate(req) {
      capturedRequest = req;
      return {
        decision: "ASK_MORE",
        notes: "Need more context",
        humanId: "expert_42",
        respondedAt: new Date().toISOString(),
      };
    },
  };

  const vaultPath = resolve(root, "vault999.jsonl");

  const engine = new AgentEngine(buildFixProfile("internal_mode"), {
    llmProvider: new MockLlmProvider(),
    toolRegistry: new ToolRegistry(),
    longTermMemory: new LongTermMemory(resolve(root, "memory.json")),
    vaultClient: new FileVaultClient(vaultPath),
    escalationClient: mockEscalationClient,
  });

  const result = await engine.run({
    task: "   ",
    workingDirectory: root,
    intentModel: "execution",
    riskLevel: "high",
  });

  assert.match(result.finalText, /SABAR: Task is empty/);
  assert.match(result.finalText, /ESCALATION/);
  assert.ok(capturedRequest, "Expected escalation request to be captured");
  assert.equal(capturedRequest?.riskLevel, "high");
  assert.equal(capturedRequest?.intentModel, "execution");
  assert.equal(capturedRequest?.sessionId, result.sessionId);

  // Verify vault record contains escalation metadata
  const { readFile } = await import("node:fs/promises");
  const vaultLines = (await readFile(vaultPath, "utf-8")).trim().split("\n");
  const lastRecord = JSON.parse(vaultLines[vaultLines.length - 1]);
  assert.equal(lastRecord.escalation.escalated, true);
  assert.equal(lastRecord.escalation.humanDecision, "ASK_MORE");
  assert.equal(lastRecord.escalation.humanId, "expert_42");
});
