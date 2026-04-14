import { randomUUID } from "node:crypto";
import type {
  AgentMessage,
  AgentProfile,
  AgentRunResult,
  EngineRunOptions,
  LlmTurnResponse,
} from "../types/agent.js";
import type { ToolPermissionContext } from "../types/tool.js";
import type { LlmProvider } from "../llm/LlmProvider.js";
import { BudgetManager } from "./BudgetManager.js";
import { ShortTermMemory } from "../memory/ShortTermMemory.js";
import { LongTermMemory } from "../memory/LongTermMemory.js";
import { resolveWorkingDirectory } from "../utils/paths.js";
import { redactForExternalMode } from "./redact.js";
import { buildModeSettings } from "../flags/modes.js";
import { ToolRegistry } from "../tools/ToolRegistry.js";
import type { FeatureFlags } from "../flags/featureFlags.js";
import type { ToolPolicyConfig } from "../config/RuntimeConfig.js";
import { RunReporter } from "./RunReporter.js";
import {
  validateInputClarity,
  checkHarmDignity,
  checkInjection,
  checkCoherence,
  checkConfidence,
  checkGrounding,
  checkEntropy,
  checkToolHarm,
  countEvidence,
  type GovernanceCheck,
  LocalGovernanceClient,
  type GovernanceClient,
} from "../governance/index.js";
import { getAdaptiveThresholds } from "../governance/thresholds.js";
import type { VaultClient, VaultSealRecord, VaultTelemetrySnapshot } from "../vault/index.js";
import { computeInputHash, generateSealId } from "../vault/index.js";
import type { HumanEscalationClient } from "../escalation/index.js";
import { recordHumanEscalation } from "../metrics/prometheus.js";
import type { TicketStore, ApprovalTicket } from "../approval/index.js";
import { getTicketStore } from "../approval/index.js";
import type { MemoryContract } from "../memory-contract/index.js";
import { getMemoryContract } from "../memory-contract/index.js";

export type AgentEngineDependencies = {
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
  governanceClient?: GovernanceClient;
  apiPricing?: {
    inputCostPerMillionTokens: number;
    outputCostPerMillionTokens: number;
  };
};

export class AgentEngine {
  constructor(
    private readonly profile: AgentProfile,
    private readonly dependencies: AgentEngineDependencies,
  ) {}

  async run(options: EngineRunOptions): Promise<AgentRunResult> {
    const startedAt = new Date();
    const sessionId = options.sessionId ?? randomUUID();
    const workingDirectory = resolveWorkingDirectory(options.workingDirectory);
    const shortTermMemory = new ShortTermMemory();
    const budgetManager = new BudgetManager(this.profile.budget);
    const modeSettings = buildModeSettings(this.profile.modeName);
    const intentModel = options.intentModel ?? "advisory";
    const riskLevel = options.riskLevel ?? "medium";
    const adaptiveThresholds = getAdaptiveThresholds(intentModel, riskLevel);

    const permissionContext: ToolPermissionContext = {
      enabledTools: new Set(modeSettings.filterAllowedTools(this.profile.allowedTools)),
      dangerousToolsEnabled:
        modeSettings.allowDangerousTools &&
        (this.dependencies.featureFlags?.ENABLE_DANGEROUS_TOOLS ?? false),
      experimentalToolsEnabled:
        modeSettings.allowExperimentalTools &&
        (this.dependencies.featureFlags?.ENABLE_EXPERIMENTAL_TOOLS ?? false),
      // F13 Sovereign: 888_HOLD is lifted only in internal_mode with dangerous tools enabled
      holdEnabled:
        this.profile.modeName === "internal_mode" &&
        (this.dependencies.featureFlags?.ENABLE_DANGEROUS_TOOLS ?? false),
      riskLevel,
    };

    // === Human override replay path ===
    if (options.humanApprovedTicketId) {
      const ticketStore = this.dependencies.ticketStore ?? getTicketStore();
      await ticketStore.initialize();
      const ticket = await ticketStore.findById(options.humanApprovedTicketId);
      if (ticket && (ticket.status === "APPROVED" || ticket.status === "REPLAYED")) {
        permissionContext.humanOverride = true;
        if (ticket.status === "APPROVED") {
          await ticketStore.updateTicket(ticket.ticketId, {
            status: "REPLAYED",
            replayedAt: new Date().toISOString(),
            replayToken: `replay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          });
        }
      }
    }

    const floorsTriggered: string[] = [];

    // === Pre-execution Governance Check (F3/F6/F9) ===
    // Ask the Governance plane for permission before executing.
    // If no external governance client is wired, fall back to local floors.
    const governanceClient =
      this.dependencies.governanceClient ??
      new LocalGovernanceClient({ f3: adaptiveThresholds.f3 });

    const governanceResult = await governanceClient.evaluate({
      task: options.task,
      sessionId,
      intentModel,
      riskLevel,
    });

    if (governanceResult.verdict !== "SEAL") {
      floorsTriggered.push(...governanceResult.floorsTriggered);
      const { finalText: sealedText, sealError } = await this.sealTerminal(
        options,
        sessionId,
        `${governanceResult.verdict}: ${governanceResult.message ?? "Governance check blocked execution"}`,
        0,
        this.profile.name,
        floorsTriggered,
        permissionContext,
        1,
        startedAt,
      );
      return {
        sessionId,
        finalText: sealedText,
        turnCount: 0,
        totalEstimatedTokens: 0,
        transcript: [],
        metrics: this.buildEmptyMetrics(
          options,
          startedAt,
          governanceResult.floorsTriggered[0] ?? "F1",
          governanceResult.message ?? "Blocked by governance",
          sealError,
        ),
      };
    }

    shortTermMemory.append({
      role: "system",
      content: this.profile.systemPrompt,
    });

    const sacredMessages = await this.injectSacredMemories();
    for (const msg of sacredMessages) {
      shortTermMemory.append(msg);
    }
    const initialMessages: AgentMessage[] = [...sacredMessages];

    const relevantMemories = await this.dependencies.longTermMemory.searchRelevant(options.task);
    if (relevantMemories.length > 0) {
      const memoryContext = relevantMemories
        .map((record, index) => `Memory ${index + 1}: ${record.summary}`)
        .join("\n");

      const memoryMessage: AgentMessage = {
        role: "system",
        content: `Relevant past task summaries:\n${memoryContext}`,
      };
      shortTermMemory.append(memoryMessage);
      initialMessages.push(memoryMessage);
    }

    const userMessage: AgentMessage = {
      role: "user",
      content: modeSettings.transformOutgoingText(options.task),
    };
    shortTermMemory.append(userMessage);
    initialMessages.push(userMessage);

    let finalResponse = "";
    let turnCount = 0;
    let previousResponseId: string | undefined;
    let pendingMessages = initialMessages;
    let toolCallCount = 0;
    const toolCallsByType: Record<string, number> = {};
    let blockedDangerousActions = 0;
    let blockedCommands = 0;
    let timeoutEvents = 0;
    let restrictedPathAttempts = 0;
    let responsesCalls = 0;
    let toolCallParseFailures = 0;
    let previousResponseResumes = 0;
    let llmTokensIn = 0;
    let llmTokensOut = 0;
    let errorMessage: string | undefined;
    const memoryInjectedItems = relevantMemories.length;
    const memoryInjectedBytes = Buffer.byteLength(
      relevantMemories.map((record) => record.summary).join("\n"),
      "utf8",
    );

    try {
      while (turnCount < this.profile.budget.maxTurns) {
        turnCount += 1;
        responsesCalls += 1;
        const turnResponse = await this.dependencies.llmProvider.completeTurn({
          profile: this.profile,
          messages: pendingMessages,
          tools: this.dependencies.toolRegistry.listForModel(permissionContext),
          previousResponseId,
        });

        budgetManager.addUsage(turnResponse.usage.inputTokens, turnResponse.usage.outputTokens);
        llmTokensIn += turnResponse.usage.inputTokens;
        llmTokensOut += turnResponse.usage.outputTokens;
        toolCallParseFailures += turnResponse.providerMetrics?.toolCallParseFailures ?? 0;
        previousResponseResumes += turnResponse.providerMetrics?.resumedWithPreviousResponseId ? 1 : 0;
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
        const toolExecution = await this.executeToolCalls(
          turnResponse,
          shortTermMemory,
          permissionContext,
          sessionId,
          workingDirectory,
          relevantMemories.length,
          floorsTriggered,
        );
        pendingMessages = toolExecution.messages;
        blockedDangerousActions += toolExecution.blockedDangerousActions;
        blockedCommands += toolExecution.blockedCommands;
        timeoutEvents += toolExecution.timeoutEvents;
        restrictedPathAttempts += toolExecution.restrictedPathAttempts;
        if (toolExecution.blockedDangerousActions > 0) floorsTriggered.push("F1");
        if (toolExecution.blockedCommands > 0) floorsTriggered.push("F12");
        if (toolExecution.restrictedPathAttempts > 0) floorsTriggered.push("F13");
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      floorsTriggered.push("F12");
      finalResponse = `Run failed: ${errorMessage}`;
    }

    if (!finalResponse) {
      finalResponse = "Stopped because the maximum turn count was reached.";
    }

    // === F7: Confidence Check (end of session) ===
    const confidenceCheck = checkConfidence(
      {
        evidenceCount: toolCallCount,
        toolCallCount,
        turnCount,
        hasContradictions: false, // Would need cross-turn tracking
        memoryHits: relevantMemories.length,
      },
      adaptiveThresholds.f7,
    );
    if (confidenceCheck.verdict === "HOLD" && !errorMessage) {
      floorsTriggered.push("F7");
      // Append confidence warning to response but don't block
      finalResponse += `\n\n[CONFIDENCE: ${confidenceCheck.confidence.toFixed(2)} - ${confidenceCheck.message}]`;
    }

    await this.dependencies.longTermMemory.store({
      id: sessionId,
      summary: finalResponse,
      keywords: extractKeywords(options.task, finalResponse),
      createdAt: new Date().toISOString(),
      metadata: {
        profile: this.profile.name,
        turnCount,
      },
    });

    const testsPassed = options.testsPassed ?? inferTestsPassed(this.profile.name, finalResponse, !errorMessage);
    const completion = !errorMessage && !finalResponse.startsWith("Stopped because");
    const wallClockMs = Date.now() - startedAt.getTime();
    const metrics: AgentRunResult["metrics"] = {
      taskSuccess: completion && testsPassed ? 1 : 0,
      turnsUsed: turnCount,
      toolCalls: toolCallCount,
      toolCallsByType,
      responsesCalls,
      toolCallParseFailures,
      previousResponseResumes,
      memoryInjectedItems,
      memoryInjectedBytes,
      memoryUsedReferences: countMemoryReferences(shortTermMemory.getMessages()),
      plannerSubtasks: Number(options.metadata?.plannerSubtasks ?? 0),
      workerSuccessRate: Number(options.metadata?.workerSuccessRate ?? 0),
      coordinationFailures: Number(options.metadata?.coordinationFailures ?? 0),
      trustMode: this.dependencies.featureFlags?.ENABLE_DANGEROUS_TOOLS ? "local_vps" : "default",
      blockedDangerousActions,
      blockedCommands,
      timeoutEvents,
      restrictedPathAttempts,
      llmTokensIn,
      llmTokensOut,
      llmCost: this.estimateApiCost(llmTokensIn, llmTokensOut),
      wallClockMs,
      completion,
      testsPassed,
      errorMessage,
    };

    // === 999 VAULT: Seal terminal verdict ===
    const sealResult = await this.sealTerminal(
      options,
      sessionId,
      finalResponse,
      turnCount,
      this.profile.name,
      floorsTriggered,
      permissionContext,
      metrics.blockedDangerousActions,
      startedAt,
    );
    if (sealResult.sealError && sealResult.finalText !== finalResponse) {
      finalResponse = sealResult.finalText;
      metrics.completion = false;
      metrics.errorMessage = sealResult.sealError;
    }

    const result: AgentRunResult = {
      sessionId,
      finalText: finalResponse,
      turnCount,
      totalEstimatedTokens: budgetManager.getTotalEstimatedTokens(),
      transcript: shortTermMemory.getMessages(),
      metrics,
    };

    if (this.dependencies.runReporter) {
      await this.dependencies.runReporter.reportRun(
        options,
        this.profile.name,
        result,
        startedAt,
        metrics.llmCost,
      );
    }

    return result;
  }

  private async injectSacredMemories(): Promise<AgentMessage[]> {
    const messages: AgentMessage[] = [];
    try {
      const contract = this.dependencies.memoryContract ?? getMemoryContract();
      await contract.initialize();
      const sacred = contract.getByTier("sacred");
      if (sacred.length === 0) return messages;

      const lawEntries = sacred
        .filter((m) => m.tags.includes("eureka-capsule"))
        .sort((a, b) => {
          const lawA = Number(a.tags.find((t) => t.startsWith("law-"))?.replace("law-", "") ?? "0");
          const lawB = Number(b.tags.find((t) => t.startsWith("law-"))?.replace("law-", "") ?? "0");
          return lawA - lawB;
        });

      if (lawEntries.length === 0) return messages;

      const content =
        "EUREKA CAPSULE — CONSTITUTIONAL RUNTIME LAWS (sacred, immutable):\n\n" +
        lawEntries
          .map((m) => {
            const lawNum = m.tags.find((t) => t.startsWith("law-"))?.replace("law-", "") ?? "?";
            const titleMatch = m.content.match(/LAW \d+: ([^\]]+)/);
            const title = titleMatch ? titleMatch[1] : `Law ${lawNum}`;
            return `[${title}]\n${m.content}`;
          })
          .join("\n\n");

      const msg: AgentMessage = {
        role: "system",
        content,
      };
      messages.push(msg);
    } catch {
      // MemoryContract is optional — silently skip if unavailable
    }
    return messages;
  }

  private async executeToolCalls(
    turnResponse: LlmTurnResponse,
    shortTermMemory: ShortTermMemory,
    permissionContext: ToolPermissionContext,
    sessionId: string,
    workingDirectory: string,
    memoryCount: number,
    floorsTriggered: string[],
  ): Promise<{
    messages: AgentMessage[];
    blockedDangerousActions: number;
    blockedCommands: number;
    timeoutEvents: number;
    restrictedPathAttempts: number;
  }> {
    const toolMessages: AgentMessage[] = [];
    let blockedDangerousActions = 0;
    let blockedCommands = 0;
    let timeoutEvents = 0;
    let restrictedPathAttempts = 0;

    // Track for governance checks
    let cumulativeRisk = 0.1;
    const toolResults: Array<{ ok: boolean; output?: string }> = [];
    const messageTexts: string[] = [];

    let callIndex = 0;
    for (const call of turnResponse.toolCalls) {
      let toolMessage: AgentMessage;

      // === F6: Tool-level Harm Check ===
      const toolHarmCheck = checkToolHarm(call.toolName, call.args);
      if (toolHarmCheck.verdict === "VOID") {
        floorsTriggered.push("F6");
        toolMessage = {
          role: "tool",
          toolCallId: call.id,
          toolName: call.toolName,
          content: `VOID: ${toolHarmCheck.message}`,
        };
        shortTermMemory.append(toolMessage);
        toolMessages.push(toolMessage);
        blockedDangerousActions += 1;
        callIndex++;
        continue;
      }

      // === F4: Entropy Check ===
      const entropyCheck = checkEntropy(call.toolName, call.args, cumulativeRisk, callIndex === 0);
      if (entropyCheck.verdict === "HOLD") {
        floorsTriggered.push("F4");
        toolMessage = {
          role: "tool",
          toolCallId: call.id,
          toolName: call.toolName,
          content: `HOLD: ${entropyCheck.message}`,
        };
        shortTermMemory.append(toolMessage);
        toolMessages.push(toolMessage);
        blockedDangerousActions += 1;
        callIndex++;
        continue;
      }
      cumulativeRisk = entropyCheck.riskAfter;

      try {
        const toolResult = await this.dependencies.toolRegistry.runTool(
          call.toolName,
          call.args,
          {
            sessionId,
            workingDirectory,
            modeName: this.profile.modeName,
            policy: this.dependencies.toolPolicy,
          },
          permissionContext,
        );

        // Track for grounding check
        toolResults.push({ ok: toolResult.ok, output: toolResult.output });

        // === F8: Grounding Check ===
        // Skip if tool was already blocked by a higher-priority floor (F1/F13)
        const alreadyBlocked = !toolResult.ok && (toolResult.metadata?.hold || toolResult.output?.startsWith("[888_HOLD]") || toolResult.output?.startsWith("VOID:"));
        if (alreadyBlocked) {
          blockedDangerousActions += 1;
        } else {
          const evidenceCount = countEvidence(toolResults);
          const groundingCheck = checkGrounding(call.toolName, evidenceCount, memoryCount, callIndex === 0);
          if (groundingCheck.verdict === "HOLD") {
            floorsTriggered.push("F8");
            toolMessage = {
              role: "tool",
              toolCallId: call.id,
              toolName: call.toolName,
              content: `HOLD: ${groundingCheck.message}`,
            };
            shortTermMemory.append(toolMessage);
            toolMessages.push(toolMessage);
            blockedDangerousActions += 1;
            callIndex++;
            continue;
          }
        }

        toolMessage = {
          role: "tool",
          toolCallId: call.id,
          toolName: call.toolName,
          content: redactForExternalMode(toolResult.output, this.profile.modeName),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isBlockedActionMessage(message)) {
          blockedDangerousActions += 1;
        }
        if (/blocked by policy/i.test(message)) {
          blockedCommands += 1;
        }
        if (/timed? out|timeout/i.test(message)) {
          timeoutEvents += 1;
        }
        if (/escapes the working directory sandbox/i.test(message)) {
          restrictedPathAttempts += 1;
        }
        toolMessage = {
          role: "tool",
          toolCallId: call.id,
          toolName: call.toolName,
          content: `Tool error: ${message}`,
        };
      }

      // Track message text for coherence check
      messageTexts.push(toolMessage.content);

      shortTermMemory.append(toolMessage);
      toolMessages.push(toolMessage);
      callIndex++;
    }

    // === F11: Coherence Check ===
    const coherenceCheck = checkCoherence(messageTexts);
    if (coherenceCheck.verdict === "HOLD" && toolMessages.length > 0) {
      floorsTriggered.push("F11");
      // Append coherence warning to last message
      const lastMsg = toolMessages[toolMessages.length - 1];
      lastMsg.content += `\n[WARNING: ${coherenceCheck.message}]`;
    }

    return {
      messages: toolMessages,
      blockedDangerousActions,
      blockedCommands,
      timeoutEvents,
      restrictedPathAttempts,
    };
  }

  private inferVerdict(finalText: string): VaultSealRecord["verdict"] {
    if (finalText.startsWith("VOID")) return "VOID";
    if (finalText.startsWith("SABAR")) return "SABAR";
    if (finalText.startsWith("HOLD")) return "HOLD";
    if (finalText.startsWith("Run failed")) return "HOLD";
    return "SEAL";
  }

  private computeTelemetry(
    finalText: string,
    floorsTriggered: string[],
    intentModel?: string,
    riskLevel?: string,
  ): VaultTelemetrySnapshot {
    const blocked = floorsTriggered.length > 0;
    const failed = finalText.startsWith("Run failed");
    const strict = riskLevel === "high" || riskLevel === "critical" || intentModel === "execution";
    const dS = blocked ? (strict ? 0.3 : 0.2) : (strict ? -0.15 : -0.1);
    const peace2 = blocked ? (failed ? 0.8 : 0.9) : 1.0;
    const psi_le = blocked ? (failed ? (strict ? 0.75 : 0.85) : (strict ? 0.9 : 0.95)) : (strict ? 1.02 : 1.05);
    const W3 = blocked ? (failed ? 0.0 : 0.8) : 0.95;
    const G = blocked ? (failed ? 0.6 : 0.75) : 0.85;
    return { dS, peace2, psi_le, W3, G };
  }

  private isIrreversible(
    permissionContext: ToolPermissionContext,
    floorsTriggered: string[],
    turnCount: number,
    blockedDangerousActions: number,
  ): boolean {
    if (permissionContext.dangerousToolsEnabled && turnCount > 0) return true;
    if (blockedDangerousActions > 0) return true;
    if (floorsTriggered.includes("F1")) return true;
    return false;
  }

  private async maybeEscalate(
    options: EngineRunOptions,
    sessionId: string,
    finalText: string,
    floorsTriggered: string[],
  ): Promise<{ escalated: boolean; ticketId?: string; decision?: string; humanId?: string; finalText: string }> {
    const riskLevel = options.riskLevel ?? "medium";
    const shouldEscalate =
      this.dependencies.escalationClient &&
      (riskLevel === "high" || riskLevel === "critical") &&
      (finalText.startsWith("HOLD") || finalText.startsWith("SABAR") || finalText.startsWith("VOID"));

    if (!shouldEscalate) {
      return { escalated: false, finalText };
    }

    recordHumanEscalation(riskLevel, options.metadata?.domain as string | undefined);

    const telemetrysnapshot = this.computeTelemetry(finalText, floorsTriggered, options.intentModel, options.riskLevel);
    const ticketStore = this.dependencies.ticketStore ?? getTicketStore();
    const ticket: ApprovalTicket = {
      ticketId: `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      sessionId,
      status: "PENDING",
      riskLevel,
      intentModel: options.intentModel ?? "advisory",
      domain: (options.metadata?.domain as string | undefined) ?? "unspecified",
      prompt: options.task,
      planSummary: finalText.slice(0, 500),
      floorsTriggered,
      telemetrySnapshot: telemetrysnapshot,
      createdAt: new Date().toISOString(),
    };
    await ticketStore.createTicket(ticket);

    const request = {
      sessionId,
      riskLevel,
      intentModel: options.intentModel ?? "advisory",
      domain: (options.metadata?.domain as string | undefined) ?? "unspecified",
      prompt: options.task,
      planSummary: finalText.slice(0, 500),
      floorsTriggered,
      telemetrySnapshot: telemetrysnapshot,
      timestamp: new Date().toISOString(),
    };

    const response = await this.dependencies.escalationClient!.escalate(request);
    if (!response) {
      await ticketStore.updateTicket(ticket.ticketId, { status: "DISPATCHED", dispatchedAt: new Date().toISOString() });
      const updatedText = `${finalText}\n[ESCALATION: Dispatched to human expert (ticket ${ticket.ticketId}), but webhook unreachable. Awaiting manual review.]`;
      return { escalated: true, ticketId: ticket.ticketId, finalText: updatedText };
    }

    await ticketStore.updateTicket(ticket.ticketId, {
      status: "DISPATCHED",
      dispatchedAt: new Date().toISOString(),
    });

    const decisionText = `[ESCALATION: Human expert (${response.humanId ?? "unknown"}) responded with ${response.decision} on ticket ${ticket.ticketId}. ${response.notes ?? ""}]`;

    return { escalated: true, ticketId: ticket.ticketId, decision: response.decision, humanId: response.humanId, finalText: `${finalText}\n${decisionText}` };
  }

  private async sealTerminal(
    options: EngineRunOptions,
    sessionId: string,
    finalText: string,
    turnCount: number,
    profileName: string,
    floorsTriggered: string[],
    permissionContext: ToolPermissionContext,
    blockedDangerousActions: number,
    startedAt: Date,
  ): Promise<{ finalText: string; sealError?: string }> {
    if (!this.dependencies.vaultClient) {
      return { finalText };
    }
    const verdict = this.inferVerdict(finalText);
    const hashofinput = computeInputHash(options.task, finalText, sessionId, turnCount);
    const telemetrysnapshot = this.computeTelemetry(finalText, floorsTriggered, options.intentModel, options.riskLevel);
    const irreversibilityacknowledged = this.isIrreversible(
      permissionContext,
      floorsTriggered,
      turnCount,
      blockedDangerousActions,
    );

    // 888_HOLD → human expert escalation for high/critical risk
    const escalation = await this.maybeEscalate(options, sessionId, finalText, floorsTriggered);
    const sealedFinalText = escalation.finalText;

    const record: VaultSealRecord = {
      sealId: generateSealId(),
      sessionId,
      verdict,
      hashofinput,
      telemetrysnapshot,
      floors_triggered: floorsTriggered,
      irreversibilityacknowledged,
      timestamp: new Date().toISOString(),
      task: options.task,
      finalText: sealedFinalText,
      turnCount,
      profileName,
      escalation: escalation.escalated
        ? {
            escalated: true,
            humanEndpoint: this.dependencies.escalationClient ? "webhook" : undefined,
            humanDecision: escalation.decision as "APPROVE" | "REJECT" | "MODIFY" | "ASK_MORE" | undefined,
            humanId: escalation.humanId,
            ticketId: escalation.ticketId,
          }
        : undefined,
    };
    try {
      await this.dependencies.vaultClient.seal(record);
      return { finalText: sealedFinalText };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isExecutionPath = irreversibilityacknowledged || turnCount > 0;
      if (isExecutionPath && verdict === "SEAL") {
        const holdText = `HOLD: VAULT999 seal failed (${message}). Execution record could not be persisted.`;
        // Attempt to seal the HOLD downgrade (best effort)
        await this.dependencies.vaultClient
          .seal({ ...record, verdict: "HOLD", finalText: holdText })
          .catch(() => {});
        return { finalText: holdText, sealError: message };
      }
      return { finalText: sealedFinalText, sealError: message };
    }
  }

  private estimateApiCost(inputTokens: number, outputTokens: number): number {
    const pricing = this.dependencies.apiPricing;
    if (!pricing) {
      return 0;
    }

    return (
      (inputTokens / 1_000_000) * pricing.inputCostPerMillionTokens +
      (outputTokens / 1_000_000) * pricing.outputCostPerMillionTokens
    );
  }

  private buildEmptyMetrics(
    options: EngineRunOptions,
    startedAt: Date,
    blockedFloor: string,
    reason?: string,
    sealError?: string,
  ): AgentRunResult["metrics"] {
    const wallClockMs = Date.now() - startedAt.getTime();
    return {
      taskSuccess: 0,
      turnsUsed: 0,
      toolCalls: 0,
      toolCallsByType: {},
      responsesCalls: 0,
      toolCallParseFailures: 0,
      previousResponseResumes: 0,
      memoryInjectedItems: 0,
      memoryInjectedBytes: 0,
      memoryUsedReferences: 0,
      plannerSubtasks: Number(options.metadata?.plannerSubtasks ?? 0),
      workerSuccessRate: Number(options.metadata?.workerSuccessRate ?? 0),
      coordinationFailures: Number(options.metadata?.coordinationFailures ?? 0),
      trustMode: this.dependencies.featureFlags?.ENABLE_DANGEROUS_TOOLS ? "local_vps" : "default",
      blockedDangerousActions: 1,
      blockedCommands: 0,
      timeoutEvents: 0,
      restrictedPathAttempts: 0,
      llmTokensIn: 0,
      llmTokensOut: 0,
      llmCost: 0,
      wallClockMs,
      completion: false,
      testsPassed: false,
      errorMessage: sealError
        ? `Blocked by ${blockedFloor}: ${reason}; Seal error: ${sealError}`
        : `Blocked by ${blockedFloor}: ${reason}`,
    };
  }
}

function extractKeywords(task: string, response: string): string[] {
  const words = `${task} ${response}`
    .toLowerCase()
    .split(/[^a-z0-9_/-]+/g)
    .filter((word) => word.length >= 4);

  return [...new Set(words)].slice(0, 16);
}

function isBlockedActionMessage(message: string): boolean {
  return /not permitted|blocked by policy|escapes the working directory sandbox/i.test(message);
}

function inferTestsPassed(profileName: string, finalText: string, completed: boolean): boolean {
  if (!completed) {
    return false;
  }

  if (profileName === "test") {
    return !/fail|error|not ok/i.test(finalText);
  }

  return completed;
}

function countMemoryReferences(messages: AgentMessage[]): number {
  return messages.filter(
    (message) => message.role === "assistant" && /\bmemory\b/i.test(message.content),
  ).length;
}
