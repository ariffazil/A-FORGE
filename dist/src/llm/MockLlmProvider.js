function estimateTokens(messages) {
    return messages.reduce((total, message) => total + Math.ceil(message.content.length / 4), 0);
}
function parseTaggedToolCall(userInput) {
    const match = userInput.match(/\[\[tool:(.+?)\s+({[\s\S]+})\]\]/);
    if (!match) {
        return [];
    }
    const [, toolName, rawArgs] = match;
    try {
        const parsed = JSON.parse(rawArgs);
        return [{ id: `call_${Date.now()}`, toolName, args: parsed }];
    }
    catch {
        return [];
    }
}
export class MockLlmProvider {
    name = "mock-llm";
    async completeTurn(request) {
        const lastMessage = request.messages[request.messages.length - 1];
        const planningResponse = maybeBuildPlan(lastMessage?.content ?? "");
        if (planningResponse) {
            return {
                content: planningResponse,
                toolCalls: [],
                usage: {
                    inputTokens: estimateTokens(request.messages),
                    outputTokens: Math.ceil(planningResponse.length / 4),
                },
                stopReason: "completed",
                providerMetrics: {
                    toolCallParseFailures: 0,
                    resumedWithPreviousResponseId: Boolean(request.previousResponseId),
                },
            };
        }
        const toolCalls = lastMessage ? parseTaggedToolCall(lastMessage.content) : [];
        const usage = {
            inputTokens: estimateTokens(request.messages),
            outputTokens: 64,
        };
        if (toolCalls.length > 0) {
            return {
                content: "Requesting tool execution.",
                toolCalls,
                usage,
                stopReason: "tool_call",
            };
        }
        return {
            content: [
                `Profile: ${request.profile.name}`,
                `Tools visible: ${request.tools.map((tool) => tool.name).join(", ") || "none"}`,
                "Mock provider completed the task without additional tool calls.",
            ].join("\n"),
            toolCalls: [],
            usage,
            stopReason: "completed",
            providerMetrics: {
                toolCallParseFailures: 0,
                resumedWithPreviousResponseId: Boolean(request.previousResponseId),
            },
        };
    }
}
function maybeBuildPlan(content) {
    if (!content.includes("Return strict JSON as an array.")) {
        return null;
    }
    return JSON.stringify([
        {
            name: "worker-recon",
            task: "Inspect the codebase structure and identify the files most relevant to the requested goal.",
        },
        {
            name: "worker-validation",
            task: "Check the likely execution and verification paths for the requested goal and summarize risks.",
        },
    ], null, 2);
}
