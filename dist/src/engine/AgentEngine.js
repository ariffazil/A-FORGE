import { randomUUID } from "node:crypto";
import { BudgetManager } from "./BudgetManager.js";
import { ShortTermMemory } from "../memory/ShortTermMemory.js";
import { resolveWorkingDirectory } from "../utils/paths.js";
import { redactForExternalMode } from "./redact.js";
import { buildModeSettings } from "../flags/modes.js";
import { validateInputClarity, checkHarmDignity, checkInjection, checkCoherence, checkConfidence, checkGrounding, checkEntropy, checkToolHarm, countEvidence, } from "../governance/index.js";
export class AgentEngine {
    profile;
    dependencies;
    constructor(profile, dependencies) {
        this.profile = profile;
        this.dependencies = dependencies;
    }
    async run(options) {
        const startedAt = new Date();
        const sessionId = options.sessionId ?? randomUUID();
        const workingDirectory = resolveWorkingDirectory(options.workingDirectory);
        const shortTermMemory = new ShortTermMemory();
        const budgetManager = new BudgetManager(this.profile.budget);
        const modeSettings = buildModeSettings(this.profile.modeName);
        const permissionContext = {
            enabledTools: new Set(modeSettings.filterAllowedTools(this.profile.allowedTools)),
            dangerousToolsEnabled: modeSettings.allowDangerousTools &&
                (this.dependencies.featureFlags?.ENABLE_DANGEROUS_TOOLS ?? false),
            experimentalToolsEnabled: modeSettings.allowExperimentalTools &&
                (this.dependencies.featureFlags?.ENABLE_EXPERIMENTAL_TOOLS ?? false),
        };
        // === F3: Input Clarity Check ===
        const clarityCheck = validateInputClarity(options.task);
        if (clarityCheck.verdict === "SABAR") {
            return {
                sessionId,
                finalText: `SABAR: ${clarityCheck.message}`,
                turnCount: 0,
                totalEstimatedTokens: 0,
                transcript: [],
                metrics: this.buildEmptyMetrics(options, startedAt, "F3", clarityCheck.reason),
            };
        }
        // === F6: Harm/Dignity Check ===
        const harmCheck = checkHarmDignity(options.task);
        if (harmCheck.verdict === "VOID") {
            return {
                sessionId,
                finalText: `VOID: ${harmCheck.message}`,
                turnCount: 0,
                totalEstimatedTokens: 0,
                transcript: [],
                metrics: this.buildEmptyMetrics(options, startedAt, "F6", harmCheck.reason),
            };
        }
        // === F9: Injection Check ===
        const injectionCheck = checkInjection(options.task);
        if (injectionCheck.verdict === "VOID") {
            return {
                sessionId,
                finalText: `VOID: ${injectionCheck.message}`,
                turnCount: 0,
                totalEstimatedTokens: 0,
                transcript: [],
                metrics: this.buildEmptyMetrics(options, startedAt, "F9", injectionCheck.reason),
            };
        }
        shortTermMemory.append({
            role: "system",
            content: this.profile.systemPrompt,
        });
        const relevantMemories = await this.dependencies.longTermMemory.searchRelevant(options.task);
        const initialMessages = [];
        if (relevantMemories.length > 0) {
            const memoryContext = relevantMemories
                .map((record, index) => `Memory ${index + 1}: ${record.summary}`)
                .join("\n");
            const memoryMessage = {
                role: "system",
                content: `Relevant past task summaries:\n${memoryContext}`,
            };
            shortTermMemory.append(memoryMessage);
            initialMessages.push(memoryMessage);
        }
        const userMessage = {
            role: "user",
            content: modeSettings.transformOutgoingText(options.task),
        };
        shortTermMemory.append(userMessage);
        initialMessages.push(userMessage);
        let finalResponse = "";
        let turnCount = 0;
        let previousResponseId;
        let pendingMessages = initialMessages;
        let toolCallCount = 0;
        const toolCallsByType = {};
        let blockedDangerousActions = 0;
        let blockedCommands = 0;
        let timeoutEvents = 0;
        let restrictedPathAttempts = 0;
        let responsesCalls = 0;
        let toolCallParseFailures = 0;
        let previousResponseResumes = 0;
        let llmTokensIn = 0;
        let llmTokensOut = 0;
        let errorMessage;
        const memoryInjectedItems = relevantMemories.length;
        const memoryInjectedBytes = Buffer.byteLength(relevantMemories.map((record) => record.summary).join("\n"), "utf8");
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
                const assistantMessage = {
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
                const toolExecution = await this.executeToolCalls(turnResponse, shortTermMemory, permissionContext, sessionId, workingDirectory, relevantMemories.length);
                pendingMessages = toolExecution.messages;
                blockedDangerousActions += toolExecution.blockedDangerousActions;
                blockedCommands += toolExecution.blockedCommands;
                timeoutEvents += toolExecution.timeoutEvents;
                restrictedPathAttempts += toolExecution.restrictedPathAttempts;
            }
        }
        catch (error) {
            errorMessage = error instanceof Error ? error.message : String(error);
            finalResponse = `Run failed: ${errorMessage}`;
        }
        if (!finalResponse) {
            finalResponse = "Stopped because the maximum turn count was reached.";
        }
        // === F7: Confidence Check (end of session) ===
        const confidenceCheck = checkConfidence({
            evidenceCount: toolCallCount,
            toolCallCount,
            turnCount,
            hasContradictions: false, // Would need cross-turn tracking
            memoryHits: relevantMemories.length,
        });
        if (confidenceCheck.verdict === "HOLD" && !errorMessage) {
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
        const metrics = {
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
        const result = {
            sessionId,
            finalText: finalResponse,
            turnCount,
            totalEstimatedTokens: budgetManager.getTotalEstimatedTokens(),
            transcript: shortTermMemory.getMessages(),
            metrics,
        };
        if (this.dependencies.runReporter) {
            await this.dependencies.runReporter.reportRun(options, this.profile.name, result, startedAt, metrics.llmCost);
        }
        return result;
    }
    async executeToolCalls(turnResponse, shortTermMemory, permissionContext, sessionId, workingDirectory, memoryCount) {
        const toolMessages = [];
        let blockedDangerousActions = 0;
        let blockedCommands = 0;
        let timeoutEvents = 0;
        let restrictedPathAttempts = 0;
        // Track for governance checks
        let cumulativeRisk = 0.1;
        const toolResults = [];
        const messageTexts = [];
        for (const call of turnResponse.toolCalls) {
            let toolMessage;
            // === F6: Tool-level Harm Check ===
            const toolHarmCheck = checkToolHarm(call.toolName, call.args);
            if (toolHarmCheck.verdict === "VOID") {
                toolMessage = {
                    role: "tool",
                    toolCallId: call.id,
                    toolName: call.toolName,
                    content: `VOID: ${toolHarmCheck.message}`,
                };
                shortTermMemory.append(toolMessage);
                toolMessages.push(toolMessage);
                blockedDangerousActions += 1;
                continue;
            }
            // === F4: Entropy Check ===
            const entropyCheck = checkEntropy(call.toolName, call.args, cumulativeRisk, toolResults.length === 0);
            if (entropyCheck.verdict === "HOLD") {
                toolMessage = {
                    role: "tool",
                    toolCallId: call.id,
                    toolName: call.toolName,
                    content: `HOLD: ${entropyCheck.message}`,
                };
                shortTermMemory.append(toolMessage);
                toolMessages.push(toolMessage);
                blockedDangerousActions += 1;
                continue;
            }
            cumulativeRisk = entropyCheck.riskAfter;
            try {
                const toolResult = await this.dependencies.toolRegistry.runTool(call.toolName, call.args, {
                    sessionId,
                    workingDirectory,
                    modeName: this.profile.modeName,
                    policy: this.dependencies.toolPolicy,
                }, permissionContext);
                // Track for grounding check
                toolResults.push({ ok: toolResult.ok, output: toolResult.output });
                // === F8: Grounding Check ===
                const evidenceCount = countEvidence(toolResults);
                const groundingCheck = checkGrounding(call.toolName, evidenceCount, memoryCount, toolResults.length === 0);
                if (groundingCheck.verdict === "HOLD") {
                    toolMessage = {
                        role: "tool",
                        toolCallId: call.id,
                        toolName: call.toolName,
                        content: `HOLD: ${groundingCheck.message}`,
                    };
                    shortTermMemory.append(toolMessage);
                    toolMessages.push(toolMessage);
                    blockedDangerousActions += 1;
                    continue;
                }
                toolMessage = {
                    role: "tool",
                    toolCallId: call.id,
                    toolName: call.toolName,
                    content: redactForExternalMode(toolResult.output, this.profile.modeName),
                };
            }
            catch (error) {
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
        }
        // === F11: Coherence Check ===
        const coherenceCheck = checkCoherence(messageTexts);
        if (coherenceCheck.verdict === "HOLD" && toolMessages.length > 0) {
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
    estimateApiCost(inputTokens, outputTokens) {
        const pricing = this.dependencies.apiPricing;
        if (!pricing) {
            return 0;
        }
        return ((inputTokens / 1_000_000) * pricing.inputCostPerMillionTokens +
            (outputTokens / 1_000_000) * pricing.outputCostPerMillionTokens);
    }
    buildEmptyMetrics(options, startedAt, blockedFloor, reason) {
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
            errorMessage: `Blocked by ${blockedFloor}: ${reason}`,
        };
    }
}
function extractKeywords(task, response) {
    const words = `${task} ${response}`
        .toLowerCase()
        .split(/[^a-z0-9_/-]+/g)
        .filter((word) => word.length >= 4);
    return [...new Set(words)].slice(0, 16);
}
function isBlockedActionMessage(message) {
    return /not permitted|blocked by policy|escapes the working directory sandbox/i.test(message);
}
function inferTestsPassed(profileName, finalText, completed) {
    if (!completed) {
        return false;
    }
    if (profileName === "test") {
        return !/fail|error|not ok/i.test(finalText);
    }
    return completed;
}
function countMemoryReferences(messages) {
    return messages.filter((message) => message.role === "assistant" && /\bmemory\b/i.test(message.content)).length;
}
