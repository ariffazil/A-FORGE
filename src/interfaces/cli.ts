#!/usr/bin/env node
import { runCliCommand } from "../infrastructure/cli/commands.js";
import { parseArgs } from "../infrastructure/cli/parseArgs.js";
import { ToolRegistry } from "../infrastructure/tools/ToolRegistry.js";
import { ReadFileTool, WriteFileTool, ListFilesTool } from "../infrastructure/tools/FileTools.js";
import { ApplyPatchesTool } from "../infrastructure/tools/EditorTools.js";
import { GrepTextTool } from "../infrastructure/tools/SearchTools.js";
import { RunCommandTool, RunTestsTool } from "../infrastructure/tools/ShellTools.js";
import { WEALTH_TOOLS } from "../infrastructure/tools/WealthTools.js";
import { MiniMaxWebSearchTool, MiniMaxUnderstandImageTool } from "../infrastructure/tools/MiniMaxTools.js";
import { GEOXLogInterpreterBridge } from "../infrastructure/bridges/geoxBridge.js";
import { LongTermMemory } from "../application/memory/LongTermMemory.js";
import { createLlmProvider } from "../infrastructure/llm/providerFactory.js";
import { AgentEngine } from "../domain/engine/AgentEngine.js";
import type { AgentProfile } from "../domain/types/agent.js";
import { readRuntimeConfig, type RuntimeConfig } from "../interfaces/config/RuntimeConfig.js";
import { ForgeScoreboard } from "../domain/scoreboard/ForgeScoreboard.js";
import { RunMetricsLogger } from "../domain/scoreboard/RunMetricsLogger.js";
import { RunReporter } from "../domain/engine/RunReporter.js";
import { FileVaultClient, PostgresVaultClient } from "../infrastructure/vault/index.js";
import { WebhookHumanEscalationClient, NoOpHumanEscalationClient } from "../application/approval/HumanEscalationClient.js";
import { FileTicketStore, PostgresTicketStore } from "../application/approval/index.js";
import { LocalGovernanceClient, HttpGovernanceClient } from "../domain/governance/index.js";
import { SealService } from "../domain/governance/SealService.js";
import { PlanValidator } from "../domain/planner/PlanValidator.js";

function buildToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(new ReadFileTool());
  registry.register(new WriteFileTool());
  registry.register(new ApplyPatchesTool());
  registry.register(new ListFilesTool());
  registry.register(new GrepTextTool());
  registry.register(new RunTestsTool());
  registry.register(new RunCommandTool());
  registry.register(new GEOXLogInterpreterBridge());
  for (const ToolClass of WEALTH_TOOLS) registry.register(new ToolClass());
  registry.register(new MiniMaxWebSearchTool());
  registry.register(new MiniMaxUnderstandImageTool());
  return registry;
}

function createGovernanceClient(runtimeConfig: RuntimeConfig) {
  const url = process.env.ARIFOS_GOVERNANCE_URL || runtimeConfig.arifosGovernanceUrl;
  if (url) {
    return new HttpGovernanceClient(url);
  }
  return new LocalGovernanceClient();
}

function createVaultClient(runtimeConfig: RuntimeConfig) {
  if (runtimeConfig.postgresUrl) {
    try {
      const client = new PostgresVaultClient(runtimeConfig.postgresUrl, undefined, runtimeConfig.actorId);
      return client;
    } catch (err) {
      throw new Error(`VAULT999: postgres vault configured but unreachable — ${String(err)}. Halting.`);
    }
  }
  const client = new FileVaultClient();
  process.stderr.write("[WARN] VAULT999: no postgresUrl configured; using FileVaultClient (append-only guarantee applies to local JSONL)\n");
  return client;
}

function createTicketStore(runtimeConfig: RuntimeConfig) {
  if (runtimeConfig.postgresUrl) {
    try {
      const store = new PostgresTicketStore(runtimeConfig.postgresUrl);
      return store;
    } catch {
      process.stderr.write("[WARN] Postgres ticket store unavailable; falling back to FileTicketStore\n");
    }
  }
  return new FileTicketStore();
}

function createEngine(profile: AgentProfile): AgentEngine {
  const runtimeConfig = readRuntimeConfig();
  const escalationClient = runtimeConfig.humanEscalationWebhookUrl
    ? new WebhookHumanEscalationClient(runtimeConfig.humanEscalationWebhookUrl)
    : new NoOpHumanEscalationClient();
  const vaultClient = createVaultClient(runtimeConfig);
  const sealService = new SealService(new PlanValidator());

  return new AgentEngine(profile, {
    llmProvider: createLlmProvider(runtimeConfig),
    toolRegistry: buildToolRegistry(),
    longTermMemory: new LongTermMemory(runtimeConfig.memoryPath),
    runReporter: new RunReporter(
      new ForgeScoreboard(runtimeConfig.scoreboardPath),
      new RunMetricsLogger(runtimeConfig.runMetricsDir),
    ),
    vaultClient,
    ticketStore: createTicketStore(runtimeConfig),
    governanceClient: createGovernanceClient(runtimeConfig),
    escalationClient,
    sealService,
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
