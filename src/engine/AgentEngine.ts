import { randomUUID } from "node:crypto";
import { join } from "node:path";
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
import { BudgetAwareRouter } from "../llm/BudgetAwareRouter.js";
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
  checkWitness,
  checkEmpathy,
  checkAntiHantu,
  checkAuth,
  checkHumility,
  checkGenius,
  checkClarity,
  checkToolHarm,
  countEvidence,
  checkTruth,
  checkPrivacy,
  checkStewardship,
  type GovernanceCheck,
  LocalGovernanceClient,
  type GovernanceClient,
  SealService,
  calculateGeniusFromFloors,
  type FloorScores13,
} from "../governance/index.js";
import { getAdaptiveThresholds } from "../governance/thresholds.js";
import type { VaultClient, VaultSealRecord, VaultTelemetrySnapshot } from "../vault/index.js";
import { computeInputHash, generateSealId, MerkleV3Service } from "../vault/index.js";
import { PostgresVaultClient } from "../vault/PostgresVaultClient.js";
import type { HumanEscalationClient } from "../escalation/index.js";
import { recordHumanEscalation, recordFloorViolation, runStage } from "../metrics/prometheus.js";
import type { MetabolicStage } from "../types/aki.js";
import type { TicketStore, ApprovalTicket } from "../approval/index.js";
import { getTicketStore } from "../approval/index.js";
import type { MemoryContract } from "../memory-contract/index.js";
import { getMemoryContract } from "../memory-contract/index.js";
import { ThermodynamicCostEstimator } from "../ops/ThermodynamicCostEstimator.js";
import { routeIntent, type RoutingDecision } from "./IntentRouter.js";
import { WealthEngine } from "./WealthEngine.js";
import type { ToolAction, TokenBudget, StressState } from "../types/wealth.js";
import { buildDefaultGEOXScenarios } from "./defaultGEOXScenarios.js";
import { evaluateWithConfidence, calculateConfidenceEstimate } from "../policy/confidence.js";
import { ArifOSKernel } from "./ArifOSKernel.js";

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
  sealService?: SealService;
  pipelineDelegate?: boolean;
  pipelineDependencies?: import("./PipelineCoordinator.js").PipelineDependencies;
  apiPricing?: {
    inputCostPerMillionTokens: number;
    outputCostPerMillionTokens: number;
  };
  /** Fallback LLM provider for automatic downshifting at 80% budget (e.g. Ollama/Sea-Lion) */
  fallbackProvider?: LlmProvider;
};

export class AgentEngine {
  private _routing: RoutingDecision | null = null;
  private _GEOXScenarios: Array<{ id: string; name: string; physicalConstraints: { environmentalImpact: number }; tag: string; groundingEvidence: string[] }> = [];
  private _wealthAllocations: Array<{ id: string; maruahScore: number }> = [];
  private _kernel: ArifOSKernel | null = null;
  private _pipeline?: import("./PipelineCoordinator.js").PipelineCoordinator;

  constructor(
    private readonly profile: AgentProfile,
    private readonly dependencies: AgentEngineDependencies,
  ) {}

  async run(options: EngineRunOptions): Promise<AgentRunResult> {
    const startedAt = new Date();
    const sessionId = options.sessionId ?? randomUUID();
    const workingDirectory = resolveWorkingDirectory(options.workingDirectory);
    // [P0] ShortTermMemory with sliding window and eviction bridge to LongTermMemory — 2026-05-05
    const shortTermMemory = new ShortTermMemory({
      maxMessages: 5,
      maxTokens: 4096,
      archivePath: join(workingDirectory, ".arifos", "archive.jsonl"),
      onEvict: async (summary) => {
        try {
          await this.dependencies.longTermMemory.appendRunningSummary(summary);
        } catch {
          // Non-fatal: eviction failure must not break the agent loop
        }
      },
    });
    const budgetManager = new BudgetManager(this.profile.budget, this.dependencies.apiPricing);

    // [Q2] Wrap LLM provider with budget-aware router for transparent
    // downshifting / refusal based on real-time consumption.
    const llmProvider = new BudgetAwareRouter({
      primary: this.dependencies.llmProvider,
      budgetManager,
      fallback: this.dependencies.fallbackProvider,
    });

    const modeSettings = buildModeSettings(this.profile.modeName);
    const intentModel = options.intentModel ?? "advisory";
    const riskLevel = options.riskLevel ?? "medium";
    const adaptiveThresholds = getAdaptiveThresholds(intentModel, riskLevel);

    // === 000_INIT: Bootstrap ArifOSKernel ===
    this._kernel = new ArifOSKernel(options.task, sessionId);

    // === PipelineDelegate: Optionally wire PipelineCoordinator as orchestrator ===
    if (this.dependencies.pipelineDelegate && this.dependencies.pipelineDependencies) {
      const { PipelineCoordinator } = await import("./PipelineCoordinator.js");
      this._pipeline = new PipelineCoordinator(this.profile, this.dependencies.pipelineDependencies);
    }

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

    // === F10: Privacy Check (pre-execution) ===
    const privacyCheck = checkPrivacy(options.task);
    if (privacyCheck.verdict === "VOID") {
      floorsTriggered.push("F10");
      const privacyDetail = JSON.stringify({
        patterns: privacyCheck.patternsFound,
        secretClasses: privacyCheck.secretClasses,
        quarantine: privacyCheck.quarantineRecommended,
      });
      const { finalText: sealedText, sealError } = await this.sealTerminal(
        options,
        sessionId,
        `VOID: ${privacyCheck.message} | detail=${privacyDetail}`,
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
          "F10",
          privacyCheck.message ?? "Privacy violation detected",
          sealError,
        ),
      };
    }

    // === 222_THINK: Intent Routing ===
    const routing: RoutingDecision = routeIntent(options.task);

    // === 333_MIND: GEOX + WEALTH Organ Activation ===
    const wealthEngine = new WealthEngine();

    if (routing.primaryOrgan === "GEOX" || routing.secondaryOrgans.includes("GEOX")) {
      this._GEOXScenarios = buildDefaultGEOXScenarios(
        routing.primaryOrgan === "GEOX" ? "primary" : "secondary",
      );
    }

    if (routing.primaryOrgan === "WEALTH" || routing.secondaryOrgans.includes("WEALTH")) {
      const GEOXScenarios = this._GEOXScenarios.length > 0
        ? this._GEOXScenarios
        : buildDefaultGEOXScenarios("secondary");
      const allocations = await wealthEngine.allocate(GEOXScenarios as import("../types/arifos.js").GEOXScenarioContract[]);
      this._wealthAllocations = allocations.map((a: { id: string; maruahScore: number }) => ({ id: a.id, maruahScore: a.maruahScore }));
      const budgetStatus = wealthEngine.getBudgetStatus();
      shortTermMemory.pin({
        role: "system",
        content: `[333_MIND] Thermodynamic budget: joules=${budgetStatus.utilization * 100 | 0}% utilized, ${budgetStatus.remaining.toLocaleString()} remaining`,
      });
    }

    // === 444_ROUTE: Context Injection into shortTermMemory ===
    shortTermMemory.pin({
      role: "system",
      content: `[222_THINK] Intent → ${routing.primaryOrgan} (conf=${routing.confidence.toFixed(2)}) | ${routing.reasoning}`,
    });

    if (this._GEOXScenarios.length > 0) {
      shortTermMemory.pin({
        role: "system",
        content: `[333_MIND] GEOX activated: ${this._GEOXScenarios.map((s) => `${s.id}(${s.tag}[${s.physicalConstraints?.environmentalImpact ?? "?"}])`).join(", ")}`,
      });
    }

    if (this._wealthAllocations.length > 0) {
      shortTermMemory.pin({
        role: "system",
        content: `[333_MIND] WEALTH activated: ${this._wealthAllocations.map((a) => `${a.id}(maruah ${a.maruahScore.toFixed(2)})`).join(", ")}`,
      });
    }

    // === 555_HEART: Red-team F6 Maruah + F8 Grounding checks ===
    const heartViolations: string[] = [];
    for (const scenario of this._GEOXScenarios) {
      if ((scenario.physicalConstraints?.environmentalImpact ?? 0) > 0.6) {
        heartViolations.push("F6_MARUAH");
      }
      if (scenario.tag === "HYPOTHESIS" && (scenario.groundingEvidence?.length ?? 0) === 0) {
        heartViolations.push("F8_GROUNDING");
      }
    }
    for (const alloc of this._wealthAllocations) {
      if ((alloc.maruahScore ?? 1.0) < 0.5) {
        heartViolations.push("F6_MARUAH");
      }
    }
    if (heartViolations.length > 0) {
      floorsTriggered.push(...heartViolations);
      shortTermMemory.pin({
        role: "system",
        content: `[555_HEART] Red-team triggered: ${heartViolations.join(", ")} — maruah review required`,
      });
    }

    // === Kernel context: Inject routing + organ state into ArifOSKernel ===
    if (this._kernel) {
      this._kernel.injectContext("routing", {
        domain: routing.domain,
        primaryOrgan: routing.primaryOrgan,
        confidence: routing.confidence,
        uncertaintyBand: routing.uncertaintyBand,
        triggers: routing.triggers,
      });
      this._kernel.injectContext("stages", { reached: ["000_INIT", "111_SENSE", "222_THINK", "333_MIND", "444_ROUTE", "555_HEART"] });
      this._kernel.injectContext("floorsTriggered", floorsTriggered);
    }

    // [Q2] Position-aware prompt assembly — 2026-05-05
    // Rationale: LLMs exhibit "Lost-in-the-Middle" — U-shaped attention bias.
    // Critical instructions at the prompt top (position [1]) or bottom are
    // reliably attended to; mid-prompt content is statistically ignored.
    // Assembly order: [1] System instructions (pinned) → [2] Running summary
    // → [3] Recent conversation window → [4] Current user query.
    const sacredMessages = await this.injectSacredMemories();
    const runningSummary = await this.dependencies.longTermMemory.getRunningSummary();

    // Build dynamic system prompt that includes sacred memories + running summary.
    // This ensures position [1] for ALL providers (OpenAI instructions, Ollama system).
    const dynamicSystemPrompt = this.buildDynamicSystemPrompt(
      this.profile.systemPrompt,
      sacredMessages,
      runningSummary,
    );

    const userMessage: AgentMessage = {
      role: "user",
      content: modeSettings.transformOutgoingText(options.task),
    };
    shortTermMemory.append(userMessage);

    // For stateless providers, the full conversation window is sent each turn.
    // For OpenAI with previousResponseId, only incremental messages are sent.
    const initialMessages = this.getMessagesForTurn(
      shortTermMemory,
      [userMessage],
      undefined, // first turn: no previous response
    );

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
    const memoryInjectedItems = runningSummary ? 1 : 0;
    const memoryInjectedBytes = Buffer.byteLength(runningSummary ?? "", "utf8");

    try {
      while (turnCount < this.profile.budget.maxTurns) {
        turnCount += 1;
        responsesCalls += 1;
        // Refresh dynamic system prompt before each turn (running summary may have updated)
        const refreshedSummary = await this.dependencies.longTermMemory.getRunningSummary();
        const turnProfile: AgentProfile = {
          ...this.profile,
          systemPrompt: this.buildDynamicSystemPrompt(
            this.profile.systemPrompt,
            sacredMessages,
            refreshedSummary,
          ),
        };

        // [Q2] Pre-flight budget enforcement: hard stop BEFORE spend occurs
        budgetManager.assertWithinBudget();

        const turnResponse = await llmProvider.completeTurn({
          profile: turnProfile,
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
        budgetManager.evaluateThresholds();
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

        // [Q2] WEALTH advisory: evaluate planned tool chain before execution
        const plannedActions: ToolAction[] = turnResponse.toolCalls.map((call) =>
          this.estimateToolAction(call.toolName, call.args),
        );
        const budgetStatus = budgetManager.getStatus();
        const wealthAdvice = wealthEngine.evaluatePlan(plannedActions, {
          remainingTokens: Math.max(0, budgetStatus.totalTokensUsed - this.profile.budget.tokenCeiling) * -1,
          remainingTurns: budgetStatus.turnsRemaining,
        });
        if (wealthAdvice.deferred.length > 0) {
          console.warn(`[WEALTH-ADVISORY] Deferred ${wealthAdvice.deferred.length} actions: ${wealthAdvice.reason}`);
        }

        // [Q2] Pre-flight budget enforcement before tool execution
        budgetManager.assertWithinBudget();

        const toolExecution = await runStage("777_FORGE" as MetabolicStage, () =>
          this.executeToolCalls(
          turnResponse,
          shortTermMemory,
          permissionContext,
          sessionId,
          workingDirectory,
          memoryInjectedItems,
          floorsTriggered,
          ),
        );

        // [Q2] WEALTH advisory: stress check after tool execution
        const stressState: StressState = {
          consecutiveFailures: toolExecution.blockedDangerousActions + toolExecution.timeoutEvents,
          budgetBurnRate: turnCount > 0 ? budgetManager.getTotalEstimatedTokens() / turnCount : 0,
          diminishingReturns: toolExecution.blockedDangerousActions > 0 && toolCallCount > 3,
          cumulativeStress:
            (toolExecution.blockedDangerousActions * 0.5) +
            (toolExecution.timeoutEvents * 0.3) +
            (budgetManager.usagePercent() > 0.8 ? 0.8 : 0),
        };
        const continueAdvice = wealthEngine.shouldContinue(stressState);
        if (continueAdvice.verdict === "VOID") {
          finalResponse = `[WEALTH-ADVISORY] ${continueAdvice.reason}`;
          floorsTriggered.push("WEALTH_VOID");
          break;
        }

        // [Q2] MemoryContract: store tool results into the tiered pipeline
        try {
          const contract = this.dependencies.memoryContract ?? getMemoryContract();
          await contract.initialize();
          for (const msg of toolExecution.messages) {
            if (msg.role !== "tool") continue;
            const tier = contract.classify(msg.content, "external", 0.7);
            await contract.store({
              content: msg.content.slice(0, 1000),
              tier,
              source: { type: "external", description: `Tool ${msg.toolName ?? "unknown"}` },
              confidence: 0.7,
              reason: "Tool execution result stored by AgentEngine memory pipeline",
              tags: ["tool-result", msg.toolName ?? "unknown"],
            });
          }
        } catch {
          // Non-fatal: MemoryContract storage failure must not break the loop
        }

        pendingMessages = this.getMessagesForTurn(
          shortTermMemory,
          toolExecution.messages,
          previousResponseId,
        );
        blockedDangerousActions += toolExecution.blockedDangerousActions;
        blockedCommands += toolExecution.blockedCommands;
        timeoutEvents += toolExecution.timeoutEvents;
        restrictedPathAttempts += toolExecution.restrictedPathAttempts;
        if (toolExecution.blockedDangerousActions > 0) floorsTriggered.push("F1");
        if (toolExecution.restrictedPathAttempts > 0) floorsTriggered.push("F13");
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      finalResponse = `Run failed: ${errorMessage}`;
    }

    if (!finalResponse) {
      finalResponse = "Stopped because the maximum turn count was reached.";
    }

    // [Q2] MemoryContract: store session conclusion into tiered pipeline
    try {
      const contract = this.dependencies.memoryContract ?? getMemoryContract();
      await contract.initialize();
      const success = !finalResponse.startsWith("Run failed") && !finalResponse.startsWith("[WEALTH-ADVISORY]");
      const tier = contract.classify(finalResponse, "inferred", success ? 0.85 : 0.3);
      await contract.store({
        content: finalResponse.slice(0, 2000),
        tier,
        source: { type: "inferred", description: "Agent final response" },
        confidence: success ? 0.85 : 0.3,
        reason: "AgentEngine session conclusion stored to memory pipeline",
        tags: ["session-conclusion", success ? "verified" : "unverified"],
      });
    } catch {
      // Non-fatal: MemoryContract storage failure must not break seal
    }

    // === 888_JUDGE: Confidence evaluation (only when organ routing occurred) ===
    if (this._routing && (this._routing.primaryOrgan !== "CODE" || this._routing.secondaryOrgans.length > 0)) {
      const organEvidence = (this._GEOXScenarios.length + this._wealthAllocations.length) > 0 ? 1 : 0;
      const agreementScore = this._wealthAllocations.length > 0
        ? this._wealthAllocations.reduce((acc, a) => acc * (a.maruahScore ?? 0.5), 0.5)
        : 0.5;
      const confidenceEstimate = calculateConfidenceEstimate(
        toolCallCount + organEvidence,
        agreementScore,
        0,
        this._routing?.uncertaintyBand === "critical" ? 0.5 : (this._routing?.uncertaintyBand === "high" ? 0.3 : 0.1),
      );
      const judgeResult = evaluateWithConfidence(
        confidenceEstimate,
        this._routing?.uncertaintyBand ?? "medium",
        0,
        toolCallCount + organEvidence,
      );
      if (judgeResult.verdict === "HOLD") {
        floorsTriggered.push("F7_JUDGE");
        finalResponse += `\n\n[888_JUDGE F7: ${judgeResult.reason}]`;
        if (judgeResult.human_review_required) {
          finalResponse += "\n[888_JUDGE: Human review recommended before final seal]";
        }
      }
    }

    // === F2: Truth Check (end of session) ===
    const truthCheck = checkTruth(finalResponse, toolCallCount);
    if (truthCheck.verdict === "HOLD" && !errorMessage) {
      floorsTriggered.push("F2");
      const truthDetail = JSON.stringify({
        ungroundedClaims: truthCheck.ungroundedClaims,
        evidenceMarkers: truthCheck.evidenceMarkers,
        claimReferences: truthCheck.claimReferences,
      });
      finalResponse += `\n\n[TRUTH: ${truthCheck.message} | detail=${truthDetail}]`;
    }

    // === F12: Stewardship Check (end of session) ===
    const stewardshipCheck = checkStewardship(
      turnCount,
      toolCallCount,
      this.profile.budget.maxTurns,
      blockedCommands,
      errorMessage,
    );
    if (stewardshipCheck.verdict === "HOLD") {
      floorsTriggered.push("F12");
      const stewardshipDetail = JSON.stringify(stewardshipCheck.metrics);
      finalResponse += `\n\n[STEWARDSHIP: ${stewardshipCheck.message} | detail=${stewardshipDetail}]`;
    }

    // === 888_JUDGE APEX: Compute G via eigendecomposition from 13 floors ===
    // K777_APEX §10.4: G = A × P × X × E² (derived from floor scores, not manual)
    // This is the constitutional genius index — computed from governance signals.
    let apexGenius: ReturnType<typeof calculateGeniusFromFloors> | undefined;
    try {
      const confidenceValue = this._routing && this._routing.primaryOrgan !== "CODE" ? 0.82 : 0.70;
      const floorsProxy: FloorScores13 = {
        f1_amanah: permissionContext.holdEnabled ? 1.0 : (blockedDangerousActions > 0 ? 0.6 : 0.98),
        f2_truth: truthCheck.verdict === "PASS" ? 0.98 : (truthCheck.ungroundedClaims > 0 ? 0.8 : 0.9),
        f3_tri_witness: this._GEOXScenarios.length > 0 || this._wealthAllocations.length > 0 ? 0.98 : 0.95,
        f4_clarity: 0.98,
        f5_peace: stewardshipCheck.verdict === "PASS" ? 0.98 : 0.85,
        f6_empathy: heartViolations.length === 0 ? 0.98 : 0.80,
        f7_humility: 0.98,
        f8_genius: this._GEOXScenarios.length > 0 ? 0.98 : 0.95,
        f9_antihantu: 0.98,
        f10_ontology: 0.98,
        f11_command: permissionContext.holdEnabled ? 1.0 : 0.98,
        f12_injection: 0.98,
        f13_sovereign: 1.0,
      };
      apexGenius = calculateGeniusFromFloors(floorsProxy, 0.05, 1.0);
      finalResponse += `\n\n[888_JUDGE APEX: G=${apexGenius.G.toFixed(3)} | A=${apexGenius.dials.A.toFixed(2)} P=${apexGenius.dials.P.toFixed(2)} X=${apexGenius.dials.X.toFixed(2)} E=${apexGenius.dials.E.toFixed(2)} | ${apexGenius.verdict}]`;
    } catch {
      // APEX computation is best-effort — do not block verdict on failure
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
      totalCostUsd: budgetManager.getStatus().totalCostUsd,
      turnsRemaining: budgetManager.getStatus().turnsRemaining,
      wallClockMs,
      completion,
      testsPassed,
      genius_G: apexGenius?.G,
      apex_Dials: apexGenius ? { A: apexGenius.dials.A, P: apexGenius.dials.P, X: apexGenius.dials.X, E: apexGenius.dials.E } : undefined,
      errorMessage,
    };

    // === 666_ALIGN: Post-execution governance annotation (SealService) ===
    const planDAG = options.planDAG;
    if (this.dependencies.sealService) {
      const memoryHash = computeInputHash(options.task, finalResponse, sessionId, turnCount);
      const sealVerdict = await this.dependencies.sealService.validateDag(
        options.taskId ?? sessionId,
        planDAG ?? {
          id: sessionId,
          rootId: "root",
          nodes: new Map([["root", {
            id: "root",
            goal: options.task,
            dependencies: [],
            status: "completed" as const,
            epistemic: {
              confidence: 0.75,
              assumptions: [],
              unknowns: [],
              riskTier: "guarded" as const,
              evidenceCount: toolCallCount,
            },
          }]]),
          version: 1,
          createdAt: startedAt.toISOString(),
        },
        memoryHash,
      );
      if (sealVerdict.status !== "PASS") {
        floorsTriggered.push("SealService");
        finalResponse += `\n\n[666_ALIGN PLAN_SEAL: ${sealVerdict.status}${sealVerdict.message ? ` — ${sealVerdict.message}` : ""}]`;
      }
    }

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
    let toolCallStartLength = floorsTriggered.length;
    for (const call of turnResponse.toolCalls) {
      toolCallStartLength = floorsTriggered.length;
      const runId = randomUUID();
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
      const entropyCheck = checkClarity(call.toolName, call.args, cumulativeRisk, callIndex === 0);
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

      // === OPS/777: Thermodynamic Cost Estimation (Landauer Gate) ===
      const thermo = new ThermodynamicCostEstimator();
      const thermoCheck = thermo.estimateWithWealth(call.toolName, call.args);
      if (thermoCheck.verdict === "VOID") {
        floorsTriggered.push("OPS");
        recordFloorViolation("OPS", "hard");
        toolMessage = {
          role: "tool",
          toolCallId: call.id,
          toolName: call.toolName,
          content: `VOID [OPS/777 Thermo]: ${thermoCheck.cost.thermodynamicBand} band | κᵣ=${thermoCheck.cost.kappa_r.toFixed(2)} | blast=${thermoCheck.cost.blastRadius.toFixed(2)} | dS=${thermoCheck.cost.dS_predict.toFixed(2)} | ${thermoCheck.violations.join(" | ")}`,
        };
        shortTermMemory.append(toolMessage);
        toolMessages.push(toolMessage);
        blockedDangerousActions += 1;
        callIndex++;
        continue;
      }
      if (thermoCheck.verdict === "HOLD") {
        floorsTriggered.push("OPS");
        recordFloorViolation("OPS", "soft");
        toolMessage = {
          role: "tool",
          toolCallId: call.id,
          toolName: call.toolName,
          content: `HOLD [OPS/777 Thermo]: ${thermoCheck.cost.thermodynamicBand} | κᵣ=${thermoCheck.cost.kappa_r.toFixed(2)} | blast=${thermoCheck.cost.blastRadius.toFixed(2)} | dS=${thermoCheck.cost.dS_predict.toFixed(2)} | ${thermoCheck.violations.join(" | ")} — 888_HOLD before decode`,
        };
        shortTermMemory.append(toolMessage);
        toolMessages.push(toolMessage);
        blockedDangerousActions += 1;
        callIndex++;
        continue;
      }

      let toolResult;
      try {
        // PER-TOOL TIMEOUT HARDENING: Ensure no tool hangs the engine
        const toolTimeoutMs = 30000;
        const toolPromise = this.dependencies.toolRegistry.runTool(
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

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Tool '${call.toolName}' timed out after ${toolTimeoutMs}ms`)), toolTimeoutMs)
        );

        toolResult = await Promise.race([toolPromise, timeoutPromise]);

        // Track for grounding check
        toolResults.push({ ok: toolResult.ok, output: toolResult.output });

        // === F10: Privacy Check (per-tool output) ===
        const toolPrivacyCheck = checkPrivacy(toolResult.output ?? "");
        if (toolPrivacyCheck.verdict === "VOID") {
          floorsTriggered.push("F10");
          const toolPrivacyDetail = JSON.stringify({
            patterns: toolPrivacyCheck.patternsFound,
            secretClasses: toolPrivacyCheck.secretClasses,
            quarantine: toolPrivacyCheck.quarantineRecommended,
          });
          toolMessage = {
            role: "tool",
            toolCallId: call.id,
            toolName: call.toolName,
            content: `VOID: ${toolPrivacyCheck.message} | detail=${toolPrivacyDetail}`,
          };
          shortTermMemory.append(toolMessage);
          toolMessages.push(toolMessage);
          blockedDangerousActions += 1;
          callIndex++;
          continue;
        }

        // === F8: Grounding Check ===
        // Skip if tool was already blocked by a higher-priority floor (F1/F13)
        const alreadyBlocked = !toolResult.ok && (toolResult.metadata?.hold || toolResult.output?.startsWith("[888_HOLD]") || toolResult.output?.startsWith("VOID:"));
        if (alreadyBlocked) {
          blockedDangerousActions += 1;
        } else {
          const evidenceCount = countEvidence(toolResults);
          const groundingCheck = checkGenius(call.toolName, evidenceCount, memoryCount, callIndex === 0);
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

      // === GO 3: Log every tool call to arifos.tool_calls ===
      const toolFloors = floorsTriggered.slice(toolCallStartLength);
      let toolVerdict = "PASS";
      if (!toolResult?.ok) {
        if (toolResult?.metadata?.hold || toolResult?.output?.startsWith("[888_HOLD]")) {
          toolVerdict = "HOLD";
        } else if (toolResult?.output?.startsWith("VOID")) {
          toolVerdict = "VOID";
        } else {
          toolVerdict = "HOLD";
        }
      }
      if (toolFloors.includes("VOID")) toolVerdict = "VOID";
      else if (toolFloors.includes("HOLD")) toolVerdict = "HOLD";

      if (this.dependencies.vaultClient && "logToolCall" in this.dependencies.vaultClient) {
        const vault = this.dependencies.vaultClient as unknown as PostgresVaultClient;
        vault.logToolCall({
          run_id: runId,
          session_id: sessionId,
          tool_name: call.toolName,
          tool_args: call.args,
          tool_result: toolMessage.content,
          verdict: toolVerdict,
          latency_ms: 0,
          floors_triggered: toolFloors,
          called_at: new Date().toISOString(),
        }).catch((err: unknown) => {
          process.stderr.write(`[WARN] logToolCall failed: ${err}\n`);
        });
      }

      // Track message text for coherence check
      messageTexts.push(toolMessage.content);

      shortTermMemory.append(toolMessage);
      toolMessages.push(toolMessage);
      callIndex++;
    }

    // === F11: Coherence Check ===
    const coherenceCheck = checkAuth(messageTexts);
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
      throw new Error("VAULT999: vaultClient not configured — append-only guarantee cannot be met. Halting.");
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
      // Note: MerkleV3Service.dailySeal() is called inside PostgresVaultClient.seal() on every SEAL
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
      totalCostUsd: 0,
      turnsRemaining: 0,
      wallClockMs,
      completion: false,
      testsPassed: false,
      errorMessage: sealError
        ? `Blocked by ${blockedFloor}: ${reason}; Seal error: ${sealError}`
        : `Blocked by ${blockedFloor}: ${reason}`,
    };
  }

  /**
   * [Q2] Build dynamic system prompt that pins sacred memories + running summary
   * at position [1], preventing "Lost-in-the-Middle" drift.
   */
  private buildDynamicSystemPrompt(
    basePrompt: string,
    sacredMessages: AgentMessage[],
    runningSummary?: string,
  ): string {
    const parts: string[] = [basePrompt];

    if (sacredMessages.length > 0) {
      const sacredContent = sacredMessages.map((m) => m.content).join("\n\n");
      parts.push(`\n\n--- SACRED CONTEXT (immutable) ---\n${sacredContent}`);
    }

    if (runningSummary) {
      parts.push(`\n\n--- RUNNING CONTEXT SUMMARY ---\n${runningSummary}`);
    }

    return parts.join("");
  }

  /**
   * [Q2] Assemble messages for the current turn with provider-aware optimization.
   * OpenAI Responses API maintains server-side state via previousResponseId,
   * so we send only incremental messages. Stateless providers (Ollama, SeaLion)
   * receive the full conversation window to maintain coherence.
   */
  private getMessagesForTurn(
    shortTermMemory: ShortTermMemory,
    incrementalMessages: AgentMessage[],
    previousResponseId: string | undefined,
  ): AgentMessage[] {
    if (
      this.dependencies.llmProvider.name === "openai-responses" &&
      previousResponseId
    ) {
      return incrementalMessages;
    }
    return shortTermMemory.getMessages();
  }

  /**
   * [Q2] Heuristic token/value estimator for WEALTH advisory knapsack.
   * No external LLM call — uses static heuristics based on tool type.
   */
  private estimateToolAction(
    toolName: string,
    _args: Record<string, unknown>,
  ): ToolAction {
    const name = toolName.toLowerCase();

    // Value heuristics: data retrieval > validation > formatting
    let estimatedValue = 0.5;
    if (name.includes("read") || name.includes("grep") || name.includes("list")) {
      estimatedValue = 1.0;
    } else if (name.includes("test") || name.includes("run")) {
      estimatedValue = 0.5;
    } else if (name.includes("write") || name.includes("patch")) {
      estimatedValue = 0.3;
    }

    // Token heuristics: file reads can be large; writes/formatting are smaller
    let estimatedTokens = 500;
    if (name.includes("read_file")) {
      estimatedTokens = 1500;
    } else if (name.includes("run_tests") || name.includes("run_command")) {
      estimatedTokens = 1200;
    } else if (name.includes("list_files")) {
      estimatedTokens = 200;
    }

    return { name: toolName, estimatedTokens, estimatedValue };
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
