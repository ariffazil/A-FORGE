import type { LlmProvider } from "./LlmProvider.js";
import type {
  AgentMessage,
  LlmTurnRequest,
  LlmTurnResponse,
  ToolCallRequest,
} from "../types/agent.js";

type FetchLike = typeof fetch;

export type OllamaProviderOptions = {
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
};

// Ollama /api/chat response shape
type OllamaChatResponse = {
  message?: {
    role?: string;
    content?: string;
    tool_calls?: Array<{
      function?: {
        name?: string;
        arguments?: Record<string, unknown> | string;
      };
    }>;
  };
  prompt_eval_count?: number;
  eval_count?: number;
  done?: boolean;
  done_reason?: string;
};

export class OllamaProvider implements LlmProvider {
  readonly name = "ollama";

  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly endpoint: string;

  constructor(private readonly options: OllamaProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    const base = (options.baseUrl ?? "http://localhost:11434").replace(/\/$/, "");
    this.endpoint = `${base}/api/chat`;
  }

  async completeTurn(request: LlmTurnRequest): Promise<LlmTurnResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const messages = buildOllamaMessages(request.profile.systemPrompt, request.messages);
      const tools =
        request.tools.length > 0
          ? request.tools.map((t) => ({
              type: "function",
              function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              },
            }))
          : undefined;

      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: this.options.model,
          messages,
          ...(tools ? { tools } : {}),
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error ${response.status}: ${errorText}`);
      }

      const payload = (await response.json()) as OllamaChatResponse;
      const content = payload.message?.content ?? "";
      const toolCalls = extractToolCalls(payload.message?.tool_calls ?? []);
      const inputTokens = payload.prompt_eval_count ?? estimateTokens(request.messages);
      const outputTokens = payload.eval_count ?? 0;

      return {
        content,
        toolCalls,
        usage: { inputTokens, outputTokens },
        stopReason: toolCalls.length > 0 ? "tool_call" : "completed",
        providerMetrics: {
          toolCallParseFailures: 0,
          resumedWithPreviousResponseId: false,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildOllamaMessages(
  systemPrompt: string,
  messages: AgentMessage[],
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [
    { role: "system", content: systemPrompt },
  ];

  for (const msg of messages) {
    if (msg.role === "system") {
      // Already injected system prompt; skip or append extra system context
      result.push({ role: "system", content: msg.content });
    } else if (msg.role === "tool") {
      result.push({
        role: "tool",
        content: msg.content,
        // Ollama expects tool response tied to call id
        ...(msg.toolCallId ? { tool_call_id: msg.toolCallId } : {}),
      });
    } else {
      result.push({ role: msg.role, content: msg.content });
    }
  }

  return result;
}

function extractToolCalls(
  calls: Array<{ function?: { name?: string; arguments?: Record<string, unknown> | string } }>,
): ToolCallRequest[] {
  return calls
    .map((call, index) => ({
      id: `ollama_call_${Date.now()}_${index}`,
      toolName: call.function?.name ?? "",
      args: normalizeArgs(call.function?.arguments),
    }))
    .filter((c) => c.toolName.length > 0);
}

function normalizeArgs(args: Record<string, unknown> | string | undefined): Record<string, unknown> {
  if (!args) return {};
  if (typeof args === "string") {
    try {
      return JSON.parse(args) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return args;
}

function estimateTokens(messages: AgentMessage[]): number {
  return messages.reduce((total, msg) => total + Math.ceil(msg.content.length / 4), 0);
}
