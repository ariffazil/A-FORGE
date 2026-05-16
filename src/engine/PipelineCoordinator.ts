/**
 * PipelineCoordinator — 444_ROUTE: Metabolic Stage Orchestration
 *
 * Wires the tri-organ lattice (arifOS/GEOX/WEALTH) into the 000-999 pipeline.
 * Coordinates state transitions via ArifOSKernel and activates the
 * appropriate organ based on the 222_THINK routing decision.
 *
 * Full metabolic pipeline:
 *   000 INIT → 111 SENSE → 222 THINK → 333 MIND → 444 ROUTE → 555 HEART → 666 ALIGN → 777 FORGE → 888 JUDGE → 999 VAULT
 *
 * @module engine/PipelineCoordinator
 * @pipeline 444_ROUTE
 * @constitutional F13 Sovereign — routing can be overridden by human
 */

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { AgentMessage, AgentProfile, AgentRunResult, EngineRunOptions, LlmTurnResponse } from "../types/agent.js";
import type { ToolPermissionContext } from "../types/tool.js";
import type { LlmProvider } from "../llm/LlmProvider.js";
import type { VaultClient, VaultSealRecord, VaultTelemetrySnapshot } from "../vault/index.js";
import type { HumanEscalationClient } from "../escalation/index.js";
import type { TicketStore, ApprovalTicket } from "../approval/index.js";
import type { MemoryContract } from "../memory-contract/index.js";
import type { FeatureFlags } from "../flags/featureFlags.js";
import type { ToolPolicyConfig } from "../config/RuntimeConfig.js";
import type { MetabolicStage } from "../types/aki.js";
import type { GovernanceResponse } from "../governance/GovernanceClient.js";

import { BudgetManager } from "./BudgetManager.js";
import { ShortTermMemory } from "../memory/ShortTermMemory.js";
import { LongTermMemory } from "../memory/LongTermMemory.js";
import { resolveWorkingDirectory } from "../utils/paths.js";
import { redactForExternalMode } from "./redact.js";
import { buildModeSettings } from "../flags/modes.js";
import { ToolRegistry } from "../tools/ToolRegistry.js";
import { RunReporter } from "./RunReporter.js";
import {
  checkWitness,
  checkEmpathy,
  checkAntiHantu,
  checkAuth,
  checkHumility,
  checkGenius,
  checkToolHarm,
  countEvidence,
  checkTruth,
  checkPrivacy,
  checkStewardship,
  LocalGovernanceClient,
  SealService,
} from "../governance/index.js";
import { getAdaptiveThresholds } from "../governance/thresholds.js";
import { computeInputHash, generateSealId } from "../vault/index.js";
import { getTicketStore } from "../approval/index.js";
import { getMemoryContract } from "../memory-contract/index.js";
import { ThermodynamicCostEstimator } from "../ops/ThermodynamicCostEstimator.js";
import { recordHumanEscalation, recordFloorViolation, runStage } from "../metrics/prometheus.js";

import { routeIntent, type RoutingDecision, type IntentDomain } from "./IntentRouter.js";
import { ArifOSKernel } from "./ArifOSKernel.js";
import { WealthEngine } from "./WealthEngine.js";
import { buildDefaultGEOXScenarios } from "./defaultGEOXScenarios.js";
import type { GEOXScenarioContract, WealthAllocationContract } from "../types/arifos.js";

export type PipelineDependencies = {
  llmProvider: LlmProvider;
  toolRegistry: ToolRegistry;
  longTermMemory: LongTermMemory;
  memoryContract?: MemoryContract;
  featureFlags?: FeatureFlags;
  toolPolicy?: ToolPolicyConfig;
  runReporter?: RunReporter;
  vaultClient?: VaultClient;
  escalationClient?: HumanEscalationClient;
  ticketStore?: TicketStore;
  sealService?: SealService;
  apiPricing?: {
    inputCostPerMillionTokens: number;
    outputCostPerMillionTokens: number;
  };
};

export type PipelineSession = {
  sessionId: string;
  kernel: ArifOSKernel;
  routing: RoutingDecision | null;
  GEOXScenarios: GEOXScenarioContract[];
  wealthAllocations: WealthAllocationContract[];
  candidateWavefunction: unknown[];
  triggeredFloors: string[];
  thermodynamicBudget: {
    joulesTotal: number;
    carbonTotal: number;
    entropyDeltaTotal: number;
  };
  task: string;
};

export class PipelineCoordinator {
  private readonly profile: AgentProfile;
  private readonly deps: PipelineDependencies;
  private session: PipelineSession | null = null;

  constructor(profile: AgentProfile, dependencies: PipelineDependencies) {
    this.profile = profile;
    this.deps = dependencies;
  }

  async run(options: EngineRunOptions): Promise<AgentRunResult> {
    const startedAt = new Date();
    const sessionId = options.sessionId ?? randomUUID();

    // 000 INIT
    await runStage("000_INIT" as MetabolicStage, async () => {
      const kernel = new ArifOSKernel(options.task, sessionId);
      this.session = {
        sessionId,
        kernel,
        routing: null,
        GEOXScenarios: [],
        wealthAllocations: [],
        candidateWavefunction: [],
        triggeredFloors: [],
        thermodynamicBudget: { joulesTotal: 0, carbonTotal: 0, entropyDeltaTotal: 0 },
        task: options.task,
      };
    });

    // 111 SENSE
    const govResult = await runStage("111_SENSE" as MetabolicStage, async () => {
      return this.sense(options, sessionId);
    });
    if (govResult.verdict !== "SEAL") {
      return this.sealBlocked(sessionId, options, `${govResult.verdict}: ${govResult.message ?? "Governance blocked"}`, startedAt);
    }

    // 222 THINK
    const routing = await runStage("222_THINK" as MetabolicStage, async () => {
      return this.think(options.task);
    });
    if (this.session) this.session.routing = routing;

    if (routing.recommendedNextStage === "111_SENSE") {
      return this.run({ ...options, metadata: { ...options.metadata, reroutedFrom: "222_THINK" } });
    }

    // 333 MIND
    const { GEOXScenarios, wealthAllocations } = await runStage("333_MIND" as MetabolicStage, async () => {
      return this.mind(routing);
    });
    if (this.session) {
      this.session.GEOXScenarios = GEOXScenarios;
      this.session.wealthAllocations = wealthAllocations;
    }

    // 444 ROUTE
    await runStage("444_ROUTE" as MetabolicStage, async () => {
      this.route(routing, GEOXScenarios, wealthAllocations);
    });

    // 555 HEART
    await runStage("555_HEART" as MetabolicStage, async () => {
      this.heart(GEOXScenarios, wealthAllocations);
    });

    // 666 ALIGN
    await runStage("666_ALIGN" as MetabolicStage, async () => {
      this.align(options.task);
    });

    // 777 FORGE
    const forgeResult = await runStage("777_FORGE" as MetabolicStage, async () => {
      return this.forge(options, sessionId, startedAt);
    });

    // 888 JUDGE
    const judgeResult = await runStage("888_JUDGE" as MetabolicStage, async () => {
      return this.judge(forgeResult.finalText, forgeResult.verdict, sessionId, options);
    });

    // 999 VAULT
    await runStage("999_VAULT" as MetabolicStage, async () => {
      await this.vault(sessionId, options.task, judgeResult.finalText, judgeResult.verdict, startedAt);
    });

    return {
      sessionId,
      finalText: judgeResult.finalText,
      turnCount: forgeResult.turnCount,
      totalEstimatedTokens: forgeResult.totalEstimatedTokens,
      transcript: forgeResult.transcript,
      metrics: forgeResult.metrics,
    };
  }

  // 111 SENSE
  private async sense(options: EngineRunOptions, sessionId: string): Promise<GovernanceResponse> {
    const intentModel = options.intentModel ?? "advisory";
    const riskLevel = options.riskLevel ?? "medium";
    const adaptiveThresholds = getAdaptiveThresholds(intentModel, riskLevel);

    const govClient = new LocalGovernanceClient({ f3: adaptiveThresholds.f3 });
    const result = await govClient.evaluate({ task: options.task, sessionId, intentModel, riskLevel });
    if (result.verdict !== "SEAL") return result;

    const privacy = checkPrivacy(options.task);
    if (privacy.verdict === "VOID") {
      return { verdict: "VOID", floorsTriggered: ["F10"], message: privacy.message };
    }
    return result;
  }

  // 222 THINK
  private think(task: string): RoutingDecision {
    return routeIntent(task);
  }

  // 333 MIND
  private async mind(routing: RoutingDecision): Promise<{
    GEOXScenarios: GEOXScenarioContract[];
    wealthAllocations: WealthAllocationContract[];
  }> {
    const wealth = new WealthEngine();

    let GEOXScenarios: GEOXScenarioContract[] = [];
    if (routing.primaryOrgan === "GEOX" || routing.secondaryOrgans.includes("GEOX")) {
      GEOXScenarios = buildDefaultGEOXScenarios(
        routing.primaryOrgan === "GEOX" ? "primary" : "secondary",
      );
    }

    let wealthAllocations: WealthAllocationContract[] = [];
    if (routing.primaryOrgan === "WEALTH" || routing.secondaryOrgans.includes("WEALTH")) {
      wealthAllocations = await wealth.allocate(
        GEOXScenarios.length > 0 ? GEOXScenarios : [
          ...buildDefaultGEOXScenarios("secondary"),
        ],
      );
    }
    return { GEOXScenarios, wealthAllocations };
  }

  // 444 ROUTE
  private route(
    routing: RoutingDecision,
    GEOXScenarios: GEOXScenarioContract[],
    wealthAllocations: WealthAllocationContract[],
  ): void {
    if (!this.session) return;

    this.session.kernel.injectContext("routing", {
      domain: routing.domain,
      primaryOrgan: routing.primaryOrgan,
      confidence: routing.confidence,
      uncertaintyBand: routing.uncertaintyBand,
      triggers: routing.triggers,
    });

    if (GEOXScenarios.length > 0) {
      this.session.kernel.injectContext("GEOX_Scenarios", GEOXScenarios);
    }
    if (wealthAllocations.length > 0) {
      this.session.kernel.injectContext("WEALTH_Allocations", wealthAllocations);
    }

    this.session.candidateWavefunction = [
      ...GEOXScenarios.map((s) => ({ type: "GEOX" as const, scenario: s })),
      ...wealthAllocations.map((a) => ({ type: "WEALTH" as const, allocation: a })),
    ];

    this.session.kernel.updateTags([routing.domain === "GEOX" ? "ESTIMATE" : "CLAIM"]);
  }

  // 555 HEART
  private heart(
    GEOXScenarios: GEOXScenarioContract[],
    wealthAllocations: WealthAllocationContract[],
  ): void {
    if (!this.session) return;
    const floors: string[] = [];

    for (const scenario of GEOXScenarios) {
      if (scenario.physicalConstraints.environmentalImpact > 0.6) {
        floors.push("F6_MARUAH");
      }
      if (scenario.tag === "HYPOTHESIS" && scenario.groundingEvidence.length === 0) {
        floors.push("F8_GROUNDING");
      }
    }

    for (const alloc of wealthAllocations) {
      if (alloc.maruahScore < 0.5) {
        floors.push("F6_MARUAH");
      }
    }

    this.session.triggeredFloors.push(...floors);
    if (floors.length > 0) {
      this.session.kernel.updateTags(["UNKNOWN"]);
    }
  }

  // 666 ALIGN
  private align(task: string): void {
    if (this.deps.sealService) {
      // Plan-level validation via SealService
    }
  }

  // 777 FORGE
  private async forge(
    options: EngineRunOptions,
    sessionId: string,
    startedAt: Date,
  ): Promise<{
    finalText: string;
    turnCount: number;
    totalEstimatedTokens: number;
    transcript: AgentMessage[];
    verdict: VaultSealRecord["verdict"];
    metrics: AgentRunResult["metrics"];
  }> {
    const workingDirectory = resolveWorkingDirectory(options.workingDirectory);
    const shortTermMemory = new ShortTermMemory({
      maxMessages: 5,
      maxTokens: 4096,
      archivePath: join(workingDirectory, ".arifos", "archive.jsonl"),
      onEvict: async (summary) => {
        try {
          await this.deps.longTermMemory.appendRunningSummary(summary);
        } catch {
          // Non-fatal: eviction failure must not break the agent loop
        }
      },
    });
    const budgetManager = new BudgetManager(this.profile.budget);
    const modeSettings = buildModeSettings(this.profile.modeName);
    const intentModel = options.intentModel ?? "advisory";
    const riskLevel = options.riskLevel ?? "medium";
    const adaptiveThresholds = getAdaptiveThresholds(intentModel, riskLevel);

    const permissionContext: ToolPermissionContext = {
      enabledTools: new Set(modeSettings.filterAllowedTools(this.profile.allowedTools)),
      dangerousToolsEnabled:
        modeSettings.allowDangerousTools && (this.deps.featureFlags?.ENABLE_DANGEROUS_TOOLS ?? false),
      experimentalToolsEnabled:
        modeSettings.allowExperimentalTools && (this.deps.featureFlags?.ENABLE_EXPERIMENTAL_TOOLS ?? false),
      holdEnabled:
        this.profile.modeName === "internal_mode" && (this.deps.featureFlags?.ENABLE_DANGEROUS_TOOLS ?? false),
      riskLevel,
    };

    if (options.humanApprovedTicketId) {
      const ticketStore = this.deps.ticketStore ?? getTicketStore();
      await ticketStore.initialize();
      const ticket = await ticketStore.findById(options.humanApprovedTicketId);
      if (ticket && (ticket.status === "APPROVED" || ticket.status === "REPLAYED")) {
        permissionContext.humanOverride = true;
      }
    }

    const floorsTriggered: string[] = [];
    shortTermMemory.pin({ role: "system", content: this.profile.systemPrompt });

    // Sacred memories
    const sacredMessages = await this.injectSacredMemories();
    for (const msg of sacredMessages) shortTermMemory.pin(msg);

    // Routing context injection
    if (this.session?.routing) {
      shortTermMemory.append({
        role: "system",
        content: `[222_THINK] Intent → ${this.session.routing.primaryOrgan} (conf=${this.session.routing.confidence.toFixed(2)}) | ${this.session.routing.reasoning}`,
      });
    }

    // GEOX scenarios injection
    if (this.session?.GEOXScenarios.length) {
      shortTermMemory.append({
        role: "system",
        content: `[333_MIND] GEOX scenarios: ${this.session.GEOXScenarios.map((s) => `${s.id}(${s.tag}[${s.probability}])`).join(", ")}`,
      });
    }

    // WEALTH allocations injection
    if (this.session?.wealthAllocations.length) {
      shortTermMemory.append({
        role: "system",
        content: `[333_MIND] WEALTH allocations: ${this.session.wealthAllocations.map((a) => `${a.id}(ROI ${a.expectedROI.financial}x, maruah ${a.maruahScore.toFixed(2)})`).join(", ")}`,
      });
    }

    const relevantMemories = await this.deps.longTermMemory.searchRelevant(options.task);
    if (relevantMemories.length > 0) {
      shortTermMemory.append({
        role: "system",
        content: `Relevant past tasks:\n${relevantMemories.map((r, i) => `Memory ${i + 1}: ${r.summary}`).join("\n")}`,
      });
    }

    shortTermMemory.append({ role: "user", content: modeSettings.transformOutgoingText(options.task) });

    let finalResponse = "";
    let turnCount = 0;
    let previousResponseId: string | undefined;
    let pendingMessages = shortTermMemory.getMessages();
    let toolCallCount = 0;
    const toolCallsByType: Record<string, number> = {};
    let blockedDangerousActions = 0;
    let blockedCommands = 0;
    let llmTokensIn = 0;
    let llmTokensOut = 0;
    let errorMessage: string | undefined;
    const memoryInjectedItems = relevantMemories.length;
    const thermo = new ThermodynamicCostEstimator();

    try {
      while (turnCount < this.profile.budget.maxTurns) {
        turnCount++;
        const turnResponse = await this.deps.llmProvider.completeTurn({
          profile: this.profile,
          messages: pendingMessages,
          tools: this.deps.toolRegistry.listForModel(permissionContext),
          previousResponseId,
        });

        budgetManager.addUsage(turnResponse.usage.inputTokens, turnResponse.usage.outputTokens);
        llmTokensIn += turnResponse.usage.inputTokens;
        llmTokensOut += turnResponse.usage.outputTokens;
        budgetManager.assertWithinBudget();
        previousResponseId = turnResponse.responseId;

        const assistantMessage: AgentMessage = {
          role: "assistant",
          content: modeSettings.transformIncomingText(turnResponse.content),
        };
        shortTermMemory.append(assistantMessage);

        if (turnResponse.toolCalls.length === 0) {
          finalResponse = turnResponse.content;
          break;
        }

        toolCallCount += turnResponse.toolCalls.length;
        for (const call of turnResponse.toolCalls) {
          toolCallsByType[call.toolName] = (toolCallsByType[call.toolName] ?? 0) + 1;
        }

        const toolExec = await this.executeToolCalls(
          turnResponse, shortTermMemory, permissionContext,
          sessionId, workingDirectory, relevantMemories.length,
          floorsTriggered, thermo,
        );
        pendingMessages = toolExec.messages;
        blockedDangerousActions += toolExec.blockedDangerousActions;
        blockedCommands += toolExec.blockedCommands;
        if (toolExec.blockedDangerousActions > 0) floorsTriggered.push("F1");
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      finalResponse = `Run failed: ${errorMessage}`;
    }

    if (!finalResponse) finalResponse = "Max turns reached.";

    // F7 confidence
    const f7 = checkHumility({ evidenceCount: toolCallCount, toolCallCount, turnCount, hasContradictions: false, memoryHits: relevantMemories.length }, adaptiveThresholds.f7);
    if (f7.verdict === "HOLD" && !errorMessage) {
      floorsTriggered.push("F7");
      finalResponse += `\n\n[CONFIDENCE: ${f7.confidence.toFixed(2)} — ${f7.message}]`;
    }

    // F2 truth
    const f2 = checkTruth(finalResponse, toolCallCount);
    if (f2.verdict === "HOLD" && !errorMessage) {
      floorsTriggered.push("F2");
      finalResponse += `\n\n[TRUTH: ${f2.message}]`;
    }

    // F12 stewardship
    const f12 = checkStewardship(turnCount, toolCallCount, this.profile.budget.maxTurns, blockedCommands, errorMessage);
    if (f12.verdict === "HOLD") {
      floorsTriggered.push("F12");
      finalResponse += `\n\n[STEWARDSHIP: ${f12.message}]`;
    }

    await this.deps.longTermMemory.store({
      id: sessionId,
      summary: finalResponse,
      keywords: this.extractKeywords(options.task, finalResponse),
      createdAt: new Date().toISOString(),
      metadata: { profile: this.profile.name, turnCount },
    });

    const wallClockMs = Date.now() - startedAt.getTime();
    const metrics: AgentRunResult["metrics"] = {
      taskSuccess: (!errorMessage && !finalResponse.startsWith("Stopped") ? 1 : 0),
      turnsUsed: turnCount,
      toolCalls: toolCallCount,
      toolCallsByType,
      responsesCalls: turnCount,
      toolCallParseFailures: 0,
      previousResponseResumes: 0,
      memoryInjectedItems,
      memoryInjectedBytes: Buffer.byteLength(relevantMemories.map((r) => r.summary).join("\n"), "utf8"),
      memoryUsedReferences: 0,
      plannerSubtasks: Number(options.metadata?.plannerSubtasks ?? 0),
      workerSuccessRate: Number(options.metadata?.workerSuccessRate ?? 0),
      coordinationFailures: Number(options.metadata?.coordinationFailures ?? 0),
      trustMode: this.deps.featureFlags?.ENABLE_DANGEROUS_TOOLS ? "local_vps" : "default",
      blockedDangerousActions,
      blockedCommands,
      timeoutEvents: 0,
      restrictedPathAttempts: 0,
      llmTokensIn,
      llmTokensOut,
      llmCost: this.estimateApiCost(llmTokensIn, llmTokensOut),
      totalCostUsd: budgetManager.getStatus().totalCostUsd,
      turnsRemaining: budgetManager.getStatus().turnsRemaining,
      wallClockMs,
      completion: !errorMessage && !finalResponse.startsWith("Stopped"),
      testsPassed: false,
      errorMessage,
    };

    const verdict = this.inferVerdict(finalResponse);
    return { finalText: finalResponse, turnCount, totalEstimatedTokens: budgetManager.getTotalEstimatedTokens(), transcript: shortTermMemory.getMessages(), verdict, metrics };
  }

  private async executeToolCalls(
    turnResponse: LlmTurnResponse,
    shortTermMemory: ShortTermMemory,
    permissionContext: ToolPermissionContext,
    sessionId: string,
    workingDirectory: string,
    memoryCount: number,
    floorsTriggered: string[],
    thermo: ThermodynamicCostEstimator,
  ): Promise<{ messages: AgentMessage[]; blockedDangerousActions: number; blockedCommands: number }> {
    const toolMessages: AgentMessage[] = [];
    let blockedDangerousActions = 0;
    let blockedCommands = 0;
    let cumulativeRisk = 0.1;
    const toolResults: Array<{ ok: boolean; output?: string }> = [];
    const messageTexts: string[] = [];
    let callIndex = 0;

    for (const call of turnResponse.toolCalls) {
      let toolMessage: AgentMessage;

      // F6 tool-level harm
      const f6Check = checkToolHarm(call.toolName, call.args);
      if (f6Check.verdict === "VOID") {
        floorsTriggered.push("F6");
        toolMessage = { role: "tool", toolCallId: call.id, toolName: call.toolName, content: `VOID: ${f6Check.message}` };
        shortTermMemory.append(toolMessage);
        toolMessages.push(toolMessage);
        blockedDangerousActions++;
        callIndex++;
        continue;
      }

      // F4 entropy
      const f4Check = (await import("../governance/f4Clarity.js")).checkClarity(call.toolName, call.args, cumulativeRisk, callIndex === 0);
      if (f4Check.verdict === "HOLD") {
        floorsTriggered.push("F4");
        toolMessage = { role: "tool", toolCallId: call.id, toolName: call.toolName, content: `HOLD: ${f4Check.message}` };
        shortTermMemory.append(toolMessage);
        toolMessages.push(toolMessage);
        blockedDangerousActions++;
        callIndex++;
        continue;
      }
      cumulativeRisk = f4Check.riskAfter;

      // OPS/777 thermodynamic gate
      const thermoCheck = thermo.estimateWithWealth(call.toolName, call.args);
      if (thermoCheck.verdict === "VOID") {
        floorsTriggered.push("OPS");
        recordFloorViolation("OPS", "hard");
        toolMessage = { role: "tool", toolCallId: call.id, toolName: call.toolName, content: `VOID [OPS/777]: ${thermoCheck.violations.join(" | ")}` };
        shortTermMemory.append(toolMessage);
        toolMessages.push(toolMessage);
        blockedDangerousActions++;
        callIndex++;
        continue;
      }
      if (thermoCheck.verdict === "HOLD") {
        floorsTriggered.push("OPS");
        recordFloorViolation("OPS", "soft");
        toolMessage = { role: "tool", toolCallId: call.id, toolName: call.toolName, content: `HOLD [OPS/777]: ${thermoCheck.violations.join(" | ")} — 888_HOLD` };
        shortTermMemory.append(toolMessage);
        toolMessages.push(toolMessage);
        blockedDangerousActions++;
        callIndex++;
        continue;
      }

      try {
        const toolResult = await this.deps.toolRegistry.runTool(
          call.toolName, call.args,
          { sessionId, workingDirectory, modeName: this.profile.modeName, policy: this.deps.toolPolicy },
          permissionContext,
        );
        toolResults.push({ ok: toolResult.ok, output: toolResult.output });

        // F10 privacy on output
        const f10Check = checkPrivacy(toolResult.output ?? "");
        if (f10Check.verdict === "VOID") {
          floorsTriggered.push("F10");
          toolMessage = { role: "tool", toolCallId: call.id, toolName: call.toolName, content: `VOID: ${f10Check.message}` };
          shortTermMemory.append(toolMessage);
          toolMessages.push(toolMessage);
          blockedDangerousActions++;
          callIndex++;
          continue;
        }

        // F8 grounding
        const alreadyBlocked = !toolResult.ok && (toolResult.metadata?.hold || String(toolResult.output).startsWith("[888_HOLD]"));
        if (!alreadyBlocked) {
          const gc = countEvidence(toolResults);
          const g8Check = checkGenius(call.toolName, gc, memoryCount, callIndex === 0);
          if (g8Check.verdict === "HOLD") {
            floorsTriggered.push("F8");
            toolMessage = { role: "tool", toolCallId: call.id, toolName: call.toolName, content: `HOLD: ${g8Check.message}` };
            shortTermMemory.append(toolMessage);
            toolMessages.push(toolMessage);
            blockedDangerousActions++;
            callIndex++;
            continue;
          }
        }

        toolMessage = { role: "tool", toolCallId: call.id, toolName: call.toolName, content: redactForExternalMode(toolResult.output ?? "", this.profile.modeName) };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/blocked|hold/i.test(msg)) blockedDangerousActions++;
        if (/policy/i.test(msg)) blockedCommands++;
        toolMessage = { role: "tool", toolCallId: call.id, toolName: call.toolName, content: `Tool error: ${msg}` };
      }

      messageTexts.push(toolMessage.content);
      shortTermMemory.append(toolMessage);
      toolMessages.push(toolMessage);
      callIndex++;
    }

    // F11 coherence
    const f11Check = checkAuth(messageTexts);
    if (f11Check.verdict === "HOLD" && toolMessages.length > 0) {
      floorsTriggered.push("F11");
      toolMessages[toolMessages.length - 1].content += `\n[WARNING: ${f11Check.message}]`;
    }

    return { messages: toolMessages, blockedDangerousActions, blockedCommands };
  }

  // 888 JUDGE
  private async judge(
    finalText: string,
    verdict: VaultSealRecord["verdict"],
    sessionId: string,
    options: EngineRunOptions,
  ): Promise<{ finalText: string; verdict: VaultSealRecord["verdict"] }> {
    if (verdict === "HOLD" || verdict === "SABAR") {
      const riskLevel = options.riskLevel ?? "medium";
      if ((riskLevel === "high" || riskLevel === "critical") && this.deps.escalationClient) {
        recordHumanEscalation(riskLevel, options.metadata?.domain as string | undefined);
        const ticketStore = this.deps.ticketStore ?? getTicketStore();
        await ticketStore.initialize();
        const ticket: ApprovalTicket = {
          ticketId: `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          sessionId,
          status: "PENDING",
          riskLevel,
          intentModel: options.intentModel ?? "advisory",
          domain: (options.metadata?.domain as string | undefined) ?? "unspecified",
          prompt: options.task,
          planSummary: finalText.slice(0, 500),
          floorsTriggered: this.session?.triggeredFloors ?? [],
          telemetrySnapshot: this.computeTelemetry(finalText, this.session?.triggeredFloors ?? []),
          createdAt: new Date().toISOString(),
        };
        await ticketStore.createTicket(ticket);
        return {
          finalText: finalText + `\n[ESCALATION: ticket ${ticket.ticketId} dispatched for human review]`,
          verdict,
        };
      }
    }
    return { finalText, verdict };
  }

  // 999 VAULT
  private async vault(
    sessionId: string,
    task: string,
    finalText: string,
    verdict: VaultSealRecord["verdict"],
    startedAt: Date,
  ): Promise<void> {
    if (this.deps.vaultClient && this.session) {
      const memoryHash = computeInputHash(task, finalText, sessionId, 0);
      await this.deps.vaultClient.seal({
        sealId: generateSealId(),
        sessionId,
        verdict,
        finalText,
        hashofinput: memoryHash,
        telemetrysnapshot: this.computeTelemetry(finalText, this.session.triggeredFloors),
        floors_triggered: this.session.triggeredFloors,
        irreversibilityacknowledged: this.isIrreversible(),
        timestamp: startedAt.toISOString(),
        task,
        turnCount: 0,
        profileName: this.profile.name,
      });
    }
  }

  private sealBlocked(sessionId: string, options: EngineRunOptions, message: string, startedAt: Date): AgentRunResult {
    const metrics: AgentRunResult["metrics"] = {
      taskSuccess: 0, turnsUsed: 0, toolCalls: 0, toolCallsByType: {},
      responsesCalls: 0, toolCallParseFailures: 0, previousResponseResumes: 0,
      memoryInjectedItems: 0, memoryInjectedBytes: 0, memoryUsedReferences: 0,
      plannerSubtasks: 0, workerSuccessRate: 0, coordinationFailures: 0,
      trustMode: this.deps.featureFlags?.ENABLE_DANGEROUS_TOOLS ? "local_vps" : "default",
      blockedDangerousActions: 0, blockedCommands: 0, timeoutEvents: 0, restrictedPathAttempts: 0,
      llmTokensIn: 0, llmTokensOut: 0, llmCost: 0,
      totalCostUsd: 0, turnsRemaining: 0,
      wallClockMs: Date.now() - startedAt.getTime(),
      completion: false, testsPassed: false, errorMessage: message,
    };
    return { sessionId, finalText: message, turnCount: 0, totalEstimatedTokens: 0, transcript: [], metrics };
  }

  private inferVerdict(finalText: string): VaultSealRecord["verdict"] {
    if (finalText.startsWith("VOID")) return "VOID";
    if (finalText.startsWith("SABAR")) return "SABAR";
    if (finalText.startsWith("HOLD")) return "HOLD";
    if (finalText.startsWith("Run failed")) return "HOLD";
    return "SEAL";
  }

  private computeTelemetry(finalText: string, floorsTriggered: string[]): VaultTelemetrySnapshot {
    const blocked = floorsTriggered.length > 0;
    const failed = finalText.startsWith("Run failed");
    return {
      dS: blocked ? (failed ? 0.3 : 0.2) : -0.1,
      peace2: blocked ? (failed ? 0.8 : 0.9) : 1.0,
      psi_le: blocked ? (failed ? 0.75 : 0.9) : 1.05,
      W3: blocked ? (failed ? 0.0 : 0.8) : 0.95,
      G: blocked ? (failed ? 0.6 : 0.75) : 0.85,
    };
  }

  private estimateApiCost(tokensIn: number, tokensOut: number): number {
    const inCost = this.deps.apiPricing?.inputCostPerMillionTokens ?? 0;
    const outCost = this.deps.apiPricing?.outputCostPerMillionTokens ?? 0;
    return (tokensIn * inCost) / 1_000_000 + (tokensOut * outCost) / 1_000_000;
  }

  private async injectSacredMemories(): Promise<AgentMessage[]> {
    const msgs: AgentMessage[] = [];
    try {
      const contract = this.deps.memoryContract ?? getMemoryContract();
      await contract.initialize();
      const sacred = contract.getByTier("sacred");
      if (!sacred.length) return msgs;
      const laws = sacred.filter((m) => m.tags.includes("eureka-capsule"))
        .sort((a, b) => {
          const nA = Number(a.tags.find((t) => t.startsWith("law-"))?.replace("law-", "") ?? "0");
          const nB = Number(b.tags.find((t) => t.startsWith("law-"))?.replace("law-", "") ?? "0");
          return nA - nB;
        });
      if (!laws.length) return msgs;
      msgs.push({
        role: "system",
        content: "EUREKA CAPSULE — CONSTITUTIONAL RUNTIME LAWS:\n\n" +
          laws.map((m) => {
            const n = m.tags.find((t) => t.startsWith("law-"))?.replace("law-", "") ?? "?";
            return `[Law ${n}]\n${m.content}`;
          }).join("\n\n"),
      });
    } catch { /* silent */ }
    return msgs;
  }

  private extractKeywords(task: string, response: string): string[] {
    const text = `${task} ${response}`.toLowerCase();
    const words = text.split(/\s+/).filter((w) => w.length > 4);
    const freq: Record<string, number> = {};
    for (const w of words) freq[w] = (freq[w] ?? 0) + 1;
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);
  }

  private isIrreversible(): boolean {
    return !!(this.deps.featureFlags?.ENABLE_DANGEROUS_TOOLS);
  }
}
