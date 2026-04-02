#!/usr/bin/env node
import { runCliCommand } from "./cli/commands.js";
import { parseArgs } from "./cli/parseArgs.js";
import { ToolRegistry } from "./tools/ToolRegistry.js";
import { ReadFileTool, WriteFileTool, ListFilesTool } from "./tools/FileTools.js";
import { GrepTextTool } from "./tools/SearchTools.js";
import { RunCommandTool, RunTestsTool } from "./tools/ShellTools.js";
import { LongTermMemory } from "./memory/LongTermMemory.js";
import { createLlmProvider } from "./llm/providerFactory.js";
import { AgentEngine } from "./engine/AgentEngine.js";
import type { AgentProfile } from "./types/agent.js";
import { readRuntimeConfig } from "./config/RuntimeConfig.js";
import { ForgeScoreboard } from "./scoreboard/ForgeScoreboard.js";
import { RunMetricsLogger } from "./scoreboard/RunMetricsLogger.js";

function buildToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(new ReadFileTool());
  registry.register(new WriteFileTool());
  registry.register(new ListFilesTool());
  registry.register(new GrepTextTool());
  registry.register(new RunTestsTool());
  registry.register(new RunCommandTool());
  return registry;
}

function createEngine(profile: AgentProfile): AgentEngine {
  const runtimeConfig = readRuntimeConfig();
  return new AgentEngine(profile, {
    llmProvider: createLlmProvider(runtimeConfig),
    toolRegistry: buildToolRegistry(),
    longTermMemory: new LongTermMemory(runtimeConfig.memoryPath),
    scoreboard: new ForgeScoreboard(runtimeConfig.scoreboardPath),
    runMetricsLogger: new RunMetricsLogger(runtimeConfig.runMetricsDir),
    featureFlags: runtimeConfig.featureFlags,
    toolPolicy: runtimeConfig.toolPolicy,
    apiPricing: runtimeConfig.apiPricing,
  });
}

function createProvider() {
  return createLlmProvider(readRuntimeConfig());
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const runtimeConfig = readRuntimeConfig();
  const text = await runCliCommand(
    parsed.command,
    parsed.options,
    createEngine,
    createProvider,
    runtimeConfig,
  );
  process.stdout.write(`${text}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`agent-workbench failed: ${message}\n`);
  process.exitCode = 1;
});
