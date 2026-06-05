/**
 * ChatCompletionProvider — OpenAI-compatible chat completions API.
 *
 * Works with: DeepSeek, MiniMax (standard endpoint), Ollama, any OpenAI-compatible API.
 * Does NOT use the Responses API — uses /v1/chat/completions.
 *
 * DITEMPA BUKAN DIBERI
 */

import type { LlmProvider } from "./LlmProvider.js";
import type {
  AgentMessage,
  AgentProfile,
  LlmTurnRequest,
  LlmTurnResponse,
  ToolCallRequest,
} from "../types/agent.js";

export type ChatCompletionOptions = {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Provider name for telemetry */
  providerName?: string;
};

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

type ChatCompletionResponse = {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

function serializeMessages(messages: AgentMessage[], systemPrompt: string): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];

  // System prompt goes first
  if (systemPrompt) {
    result.push({ role: "system", content: systemPrompt });
  }

  for (const msg of messages) {
    const oai: OpenAIMessage = {
      role: msg.role as OpenAIMessage["role"],
      content: msg.content || null,
    };

    if (msg.toolCallId) {
      oai.tool_call_id = msg.toolCallId;
    }

    result.push(oai);
  }

  return result;
}

function serializeTools(tools: LlmTurnRequest["tools"]): Array<Record<string, unknown>> {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

function parseToolCalls(
  message: ChatCompletionResponse["choices"][0]["message"],
): ToolCallRequest[] {
  if (!message.tool_calls || message.tool_calls.length === 0) return [];

  return message.tool_calls.map((tc) => {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.function.arguments);
    } catch {
      // Malformed JSON — still return the tool call with empty args
    }

    return {
      id: tc.id,
      toolName: tc.function.name,
      args,
    };
  });
}

function estimateTokens(messages: AgentMessage[]): number {
  return messages.reduce((total, m) => total + Math.ceil((m.content?.length ?? 0) / 4), 0);
}

export class ChatCompletionProvider implements LlmProvider {
  readonly name: string;

  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;

  constructor(options: ChatCompletionOptions) {
    this.name = options.providerName ?? "chat-completion";
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? 120_000;

    const base = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.endpoint = `${base}/chat/completions`;
  }

  async completeTurn(request: LlmTurnRequest): Promise<LlmTurnResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const messages = serializeMessages(request.messages, request.profile.systemPrompt);
      const tools = request.tools?.length
        ? serializeTools(request.tools)
        : undefined;

      const body: Record<string, unknown> = {
        model: this.model,
        messages,
        max_tokens: 4096,
        temperature: 0.3,
      };

      if (tools) {
        body.tools = tools;
        body.tool_choice = "auto";
      }

      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `ChatCompletion API error ${response.status}: ${errorText.slice(0, 500)}`,
        );
      }

      const payload = (await response.json()) as ChatCompletionResponse;
      const choice = payload.choices?.[0];
      if (!choice) {
        throw new Error("No choices in ChatCompletion response");
      }

      const toolCalls = parseToolCalls(choice.message);
      const finishReason = choice.finish_reason;

      return {
        content: choice.message.content ?? "",
        toolCalls,
        usage: {
          inputTokens: payload.usage?.prompt_tokens ?? estimateTokens(request.messages),
          outputTokens: payload.usage?.completion_tokens ?? 0,
        },
        stopReason:
          finishReason === "tool_calls" ? "tool_call"
          : finishReason === "length" ? "max_tokens"
          : "completed",
        responseId: payload.id,
        providerMetrics: {
          toolCallParseFailures: 0,
          resumedWithPreviousResponseId: Boolean(request.previousResponseId),
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
