export class OpenAIResponsesProvider {
    options;
    name = "openai-responses";
    fetchImpl;
    timeoutMs;
    endpoint;
    constructor(options) {
        this.options = options;
        this.fetchImpl = options.fetchImpl ?? fetch;
        this.timeoutMs = options.timeoutMs ?? 120000;
        const baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
        this.endpoint = `${baseUrl}/responses`;
    }
    async completeTurn(request) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const response = await this.fetchImpl(this.endpoint, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    authorization: `Bearer ${this.options.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.options.model,
                    instructions: request.profile.systemPrompt,
                    previous_response_id: request.previousResponseId,
                    input: serializeInputMessages(request.messages),
                    tools: request.tools.map((tool) => ({
                        type: "function",
                        name: tool.name,
                        description: tool.description,
                        parameters: tool.parameters,
                        strict: true,
                    })),
                    tool_choice: "auto",
                    parallel_tool_calls: true,
                }),
                signal: controller.signal,
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI Responses API error ${response.status}: ${errorText}`);
            }
            const payload = (await response.json());
            const toolCalls = extractFunctionCalls(payload.output ?? []);
            return {
                content: payload.output_text ?? extractOutputText(payload.output ?? []),
                toolCalls,
                usage: {
                    inputTokens: payload.usage?.input_tokens ?? estimateTokens(request.messages),
                    outputTokens: payload.usage?.output_tokens ?? 0,
                },
                stopReason: toolCalls.length > 0 ? "tool_call" : "completed",
                responseId: payload.id,
                providerMetrics: {
                    toolCallParseFailures: countParseFailures(payload.output ?? []),
                    resumedWithPreviousResponseId: Boolean(request.previousResponseId),
                },
            };
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
function serializeInputMessages(messages) {
    return messages.map((message) => {
        if (message.role === "tool") {
            return {
                type: "function_call_output",
                call_id: message.toolCallId,
                output: message.content,
            };
        }
        return {
            type: "message",
            role: message.role,
            content: [
                {
                    type: message.role === "assistant" ? "output_text" : "input_text",
                    text: message.content,
                },
            ],
        };
    });
}
function extractFunctionCalls(items) {
    return items
        .filter((item) => item.type === "function_call")
        .map((item) => ({
        id: String(item.call_id ?? item.id ?? `call_${Date.now()}`),
        toolName: String(item.name ?? ""),
        args: safeParseJson(String(item.arguments ?? "{}")),
    }))
        .filter((call) => call.toolName.length > 0);
}
function countParseFailures(items) {
    let failures = 0;
    for (const item of items) {
        if (item.type === "function_call") {
            try {
                JSON.parse(String(item.arguments ?? "{}"));
            }
            catch {
                failures += 1;
            }
        }
    }
    return failures;
}
function extractOutputText(items) {
    const chunks = [];
    for (const item of items) {
        if (item.type === "message" && Array.isArray(item.content)) {
            for (const contentItem of item.content) {
                if (typeof contentItem === "object" &&
                    contentItem !== null &&
                    "text" in contentItem &&
                    typeof contentItem.text === "string") {
                    chunks.push(contentItem.text);
                }
            }
        }
    }
    return chunks.join("\n").trim();
}
function safeParseJson(input) {
    try {
        return JSON.parse(input);
    }
    catch {
        return {};
    }
}
function estimateTokens(messages) {
    return messages.reduce((total, message) => total + Math.ceil(message.content.length / 4), 0);
}
