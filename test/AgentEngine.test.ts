import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { AgentEngine } from "../src/engine/AgentEngine.js";
import type { LlmProvider } from "../src/llm/LlmProvider.js";
import { MockLlmProvider } from "../src/llm/MockLlmProvider.js";
import { OpenAIResponsesProvider } from "../src/llm/OpenAIResponsesProvider.js";
import { LongTermMemory } from "../src/memory/LongTermMemory.js";
import { buildFixProfile } from "../src/agents/profiles.js";
import { ToolRegistry } from "../src/tools/ToolRegistry.js";
import { ReadFileTool, WriteFileTool } from "../src/tools/FileTools.js";
import { AmanahLockManager } from "../src/governance/index.js";
import { redactForExternalMode } from "../src/engine/redact.js";
import { ForgeScoreboard } from "../src/scoreboard/ForgeScoreboard.js";
import { RunReporter } from "../src/engine/RunReporter.js";
import { NoOpVaultClient } from "../src/vault/index.js";

class ScriptedProvider implements LlmProvider {
  readonly name = "scripted";

  constructor(
    private readonly turns: Array<{
      content: string;
      toolCalls?: Array<{ id: string; toolName: string; args: Record<string, unknown> }>;
      inputTokens?: number;
      outputTokens?: number;
    }>,
  ) {}

  async completeTurn() {
    const next = this.turns.shift();
    if (!next) {
      throw new Error("No scripted turns left.");
    }

    return {
      content: next.content,
      toolCalls: next.toolCalls ?? [],
      usage: {
        inputTokens: next.inputTokens ?? 10,
        outputTokens: next.outputTokens ?? 10,
      },
      stopReason: (next.toolCalls?.length ?? 0) > 0 ? "tool_call" : "completed",
      responseId: `resp_${Date.now()}`,
    } as const;
  }
}

test("agent engine stores task summaries in long-term memory", async () => {
  const root = resolve(tmpdir(), `agent-workbench-${Date.now()}`);
  await mkdir(root, { recursive: true });
  const memoryPath = resolve(root, "memory.json");

  const registry = new ToolRegistry();
  registry.register(new WriteFileTool());

  const engine = new AgentEngine(buildFixProfile("internal_mode"), {
    llmProvider: new MockLlmProvider(),
    toolRegistry: registry,
    longTermMemory: new LongTermMemory(memoryPath),
    vaultClient: new NoOpVaultClient(),
  });

  const result = await engine.run({
    task: "Write a brief fix summary without calling any tool.",
    workingDirectory: root,
  });

  assert.equal(typeof result.finalText, "string");
  const memoryFile = await readFile(memoryPath, "utf8");
  assert.match(memoryFile, /"profile": "fix"/i);
  assert.match(memoryFile, /"brief"/i);
});

test("agent engine supports multi-turn tool execution", async () => {
  const root = resolve(tmpdir(), `agent-workbench-turns-${Date.now()}`);
  await mkdir(root, { recursive: true });
  const memoryPath = resolve(root, "memory.json");
  const targetFile = resolve(root, "note.txt");

  const registry = new ToolRegistry();
  registry.register(new WriteFileTool());
  registry.register(new ReadFileTool());

  const provider = new ScriptedProvider([
    {
      content: "Need to write a file first.",
      toolCalls: [
        {
          id: "call_1",
          toolName: "write_file",
          args: { path: "note.txt", content: "hello from the agent" },
        },
      ],
    },
    {
      content: "Need to read it back.",
      toolCalls: [
        {
          id: "call_2",
          toolName: "read_file",
          args: { path: "note.txt" },
        },
      ],
    },
    {
      content: "Completed after writing and reading the file.",
    },
  ]);

  const engine = new AgentEngine(buildFixProfile("internal_mode"), {
    llmProvider: provider,
    toolRegistry: registry,
    longTermMemory: new LongTermMemory(memoryPath),
    vaultClient: new NoOpVaultClient(),
    toolPolicy: {
      commandTimeoutMs: 1000,
      maxFileBytes: 262144,
      allowedCommandPrefixes: ["npm test"],
      blockedCommandPatterns: ["rm -rf"],
    },
  });

  // Pre-acquire Amanah lock so WriteFileTool can proceed (Seri Kembangan Phase 1)
  const testSessionId = "test-session-turns";
  const lockResult = await AmanahLockManager.getInstance().acquireLock(
    targetFile, "test-agent", "Multi-turn test", testSessionId, 5000
  );
  assert.equal(lockResult.granted, true);

  const result = await engine.run({
    task: "Create and verify a note.",
    workingDirectory: root,
    sessionId: testSessionId,
  });

  // Cleanup lock
  if (lockResult.lock_id) {
    await AmanahLockManager.getInstance().releaseLock(lockResult.lock_id, "test-agent");
  }

  assert.ok(result.finalText.startsWith("Completed after writing and reading the file."));
  const written = await readFile(targetFile, "utf8");
  assert.equal(written, "hello from the agent");
  assert.equal(result.turnCount, 3);
});

test("agent engine aborts when token budget is exceeded", async () => {
  const root = resolve(tmpdir(), `agent-workbench-budget-${Date.now()}`);
  await mkdir(root, { recursive: true });
  const memoryPath = resolve(root, "memory.json");

  const engine = new AgentEngine(
    {
      ...buildFixProfile("internal_mode"),
      budget: {
        tokenCeiling: 5,
        maxTurns: 2,
      },
    },
    {
      llmProvider: new ScriptedProvider([{ content: "too many tokens", inputTokens: 10, outputTokens: 10 }]),
      toolRegistry: new ToolRegistry(),
      longTermMemory: new LongTermMemory(memoryPath),
      vaultClient: new NoOpVaultClient(),
    },
  );

  const result = await engine.run({
    task: "Exceed budget",
    workingDirectory: root,
  });

  assert.equal(result.metrics.completion, false);
  assert.match(result.finalText, /Token ceiling exceeded/i);
  assert.match(result.metrics.errorMessage ?? "", /Token ceiling exceeded/i);
});

test("external safe mode redacts obvious secrets and URLs", () => {
  const input = 'token="sk-abcdef1234567890" url=https://example.com/path';
  const output = redactForExternalMode(input, "external_safe_mode");
  assert.doesNotMatch(output, /sk-abcdef/i);
  assert.doesNotMatch(output, /https:\/\/example.com/i);
  assert.match(output, /\[redacted\]/i);
});

test("long-term memory retrieves relevant past tasks by keyword", async () => {
  const root = resolve(tmpdir(), `agent-workbench-memory-${Date.now()}`);
  await mkdir(root, { recursive: true });
  const memory = new LongTermMemory(resolve(root, "memory.json"));

  await memory.store({
    id: "1",
    summary: "Fixed the TypeScript build issue in the agent engine.",
    keywords: ["typescript", "build", "engine"],
    createdAt: new Date().toISOString(),
  });
  await memory.store({
    id: "2",
    summary: "Documented deployment notes for the VPS.",
    keywords: ["deployment", "vps", "docs"],
    createdAt: new Date().toISOString(),
  });

  const results = await memory.searchRelevant("Investigate the TypeScript engine failure");
  assert.equal(results[0]?.id, "1");
});

test("OpenAI responses provider maps tool calls and text output", async () => {
  let capturedBody = "";
  const provider = new OpenAIResponsesProvider({
    apiKey: "test-key",
    model: "gpt-5",
    fetchImpl: async (_input, init) => {
      capturedBody = String(init?.body ?? "");
      return new Response(
        JSON.stringify({
          id: "resp_123",
          output_text: "Need a tool.",
          output: [
            {
              type: "function_call",
              id: "fc_1",
              call_id: "call_abc",
              name: "read_file",
              arguments: "{\"path\":\"README.md\"}",
            },
          ],
          usage: {
            input_tokens: 20,
            output_tokens: 5,
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    },
  });

  const response = await provider.completeTurn({
    profile: buildFixProfile("internal_mode"),
    messages: [{ role: "user", content: "Inspect README" }],
    tools: [
      {
        name: "read_file",
        description: "Read a file",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "path" },
          },
          required: ["path"],
          additionalProperties: false,
        },
      },
    ],
  });

  assert.equal(response.responseId, "resp_123");
  assert.equal(response.toolCalls[0]?.toolName, "read_file");
  assert.deepEqual(response.toolCalls[0]?.args, { path: "README.md" });
  assert.match(capturedBody, /"model":"gpt-5"/);
  assert.match(capturedBody, /"instructions":/);
});

test("forge scoreboard records runs and summarizes the current week", async () => {
  const root = resolve(tmpdir(), `agent-workbench-scoreboard-${Date.now()}`);
  await mkdir(root, { recursive: true });
  const memoryPath = resolve(root, "memory.json");
  const scoreboardPath = resolve(root, "scoreboard.json");
  const scoreboard = new ForgeScoreboard(scoreboardPath);

  const engine = new AgentEngine(buildFixProfile("internal_mode"), {
    llmProvider: new ScriptedProvider([{ content: "Completed task." }]),
    toolRegistry: new ToolRegistry(),
    longTermMemory: new LongTermMemory(memoryPath),
    runReporter: new RunReporter(scoreboard),
    vaultClient: new NoOpVaultClient(),
    apiPricing: {
      inputCostPerMillionTokens: 1,
      outputCostPerMillionTokens: 2,
    },
  });

  await engine.run({
    task: "Close a bugfix task",
    workingDirectory: root,
    taskId: "task-1",
    taskType: "bugfix",
    taskCommand: "fix",
    humanMinutes: 12,
    lintIssuesDelta: -3,
    testsPassed: true,
    attemptNumber: 1,
    maxAttempts: 3,
  });

  const summary = await scoreboard.summarizeCurrentWeek();
  assert.equal(summary.totalTasks, 1);
  assert.equal(summary.completedTasks, 1);
  assert.equal(summary.passAt1Rate, 1);
  assert.equal(summary.passAtKRate, 1);
});
