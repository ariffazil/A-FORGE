import type { LlmProvider } from "./LlmProvider.js";
import type {
  AgentMessage,
  LlmTurnRequest,
  LlmTurnResponse,
  ToolCallRequest,
} from "../types/agent.js";

type FetchLike = typeof fetch;

type OpenAIResponsesProviderOptions = {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
};

type OpenAIResponsePayload = {
  id?: string;
  output?: Array<Record<string, unknown>>;
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

export class OpenAIResponsesProvider implements LlmProvider {
  readonly name = "openai-responses";

  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly endpoint: string;

  constructor(private readonly options: OpenAIResponsesProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 120000;
    const baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.endpoint = `${baseUrl}/responses`;
  }

  async completeTurn(request: LlmTurnRequest): Promise<LlmTurnResponse> {
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

      const payload = (await response.json()) as OpenAIResponsePayload;
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
    } finally {
      clearTimeout(timeout);
    }
  }
}

function serializeInputMessages(messages: AgentMessage[]): Array<Record<string, unknown>> {
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

function extractFunctionCalls(items: Array<Record<string, unknown>>): ToolCallRequest[] {
  return items
    .filter((item) => item.type === "function_call")
    .map((item) => ({
      id: String(item.call_id ?? item.id ?? `call_${Date.now()}`),
      toolName: String(item.name ?? ""),
      args: safeParseJson(String(item.arguments ?? "{}")),
    }))
    .filter((call) => call.toolName.length > 0);
}

function countParseFailures(items: Array<Record<string, unknown>>): number {
  let failures = 0;
  for (const item of items) {
    if (item.type === "function_call") {
      try {
        JSON.parse(String(item.arguments ?? "{}"));
      } catch {
        failures += 1;
      }
    }
  }
  return failures;
}

function extractOutputText(items: Array<Record<string, unknown>>): string {
  const chunks: string[] = [];

  for (const item of items) {
    if (item.type === "message" && Array.isArray(item.content)) {
      for (const contentItem of item.content) {
        if (
          typeof contentItem === "object" &&
          contentItem !== null &&
          "text" in contentItem &&
          typeof contentItem.text === "string"
        ) {
          chunks.push(contentItem.text);
        }
      }
    }
  }

  return chunks.join("\n").trim();
}

function safeParseJson(input: string): Record<string, unknown> {
  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function estimateTokens(messages: AgentMessage[]): number {
  return messages.reduce((total, message) => total + Math.ceil(message.content.length / 4), 0);
}
