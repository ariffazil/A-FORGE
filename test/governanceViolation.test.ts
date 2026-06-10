import test from "node:test";
import assert from "node:assert/strict";
import { AgentEngine } from "../src/domain/engine/AgentEngine.js";
import { MockLlmProvider } from "../src/infrastructure/llm/MockLlmProvider.js";
import { LongTermMemory } from "../src/application/memory/LongTermMemory.js";
import { buildFixProfile } from "../src/domain/agents/profiles.js";
import { ToolRegistry } from "../src/infrastructure/tools/ToolRegistry.js";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { NoOpVaultClient } from "../src/infrastructure/vault/index.js";

test("F6: Harm/Dignity floor blocks harmful input", async () => {
  const root = resolve(tmpdir(), `agent-governance-f6-${Date.now()}`);
  await mkdir(root, { recursive: true });
  
  const engine = new AgentEngine(buildFixProfile("internal_mode"), {
    llmProvider: new MockLlmProvider(),
    toolRegistry: new ToolRegistry(),
    longTermMemory: new LongTermMemory(resolve(root, "memory.json")),
    vaultClient: new NoOpVaultClient(),
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
    vaultClient: new NoOpVaultClient(),
  });

  const result = await engine.run({
    task: "   ",
    workingDirectory: root,
  });

  // F3 witness check fires before F3 clarity — both block empty input
  assert.match(result.finalText, /SABAR: (Task is empty|Empty input received)/);
  assert.match(result.metrics.errorMessage ?? "", /Blocked by F3/);
});
