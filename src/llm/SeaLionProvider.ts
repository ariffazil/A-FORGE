import type { LlmProvider } from "./LlmProvider.js";
import type {
  AgentMessage,
  LlmTurnRequest,
  LlmTurnResponse,
  ToolCallRequest,
} from "../types/agent.js";

type FetchLike = typeof fetch;

export type SeaLionProviderOptions = {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
};

type SeaLionToolCall = {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
};

type SeaLionChoice = {
  message?: {
    role?: string;
    content?: string | null;
    tool_calls?: SeaLionToolCall[];
  };
  finish_reason?: string;
};

type SeaLionChatResponse = {
  id?: string;
  choices?: SeaLionChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

function buildChatMessages(
  systemPrompt: string,
  messages: AgentMessage[],
): Array<{ role: string; content: string; name?: string }> {
  const out: Array<{ role: string; content: string; name?: string }> = [
    { role: "system", content: systemPrompt },
  ];
  for (const m of messages) {
    if (m.role === "tool") {
      out.push({ role: "tool", content: m.content, name: m.toolName ?? "tool" });
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return out;
}

function extractToolCalls(choice: SeaLionChoice | undefined): ToolCallRequest[] {
  const calls = choice?.message?.tool_calls ?? [];
  return calls
    .filter((c: SeaLionToolCall) => c.type === "function" && c.function)
    .map((c: SeaLionToolCall) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(c.function!.arguments ?? "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }
      return {
        id: c.id ?? `call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        toolName: c.function!.name ?? "unknown",
        args,
      };
    });
}

export class SeaLionProvider implements LlmProvider {
  readonly name = "sea-lion";

  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly endpoint: string;

  constructor(private readonly options: SeaLionProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    const base = (options.baseUrl ?? "https://api.sea-lion.ai/v1").replace(/\/$/, "");
    this.endpoint = `${base}/chat/completions`;
  }

  async completeTurn(request: LlmTurnRequest): Promise<LlmTurnResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const tools =
        request.tools.length > 0
          ? request.tools.map((t) => ({
              type: "function" as const,
              function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              },
            }))
          : undefined;

      const body: Record<string, unknown> = {
        model: this.options.model,
        messages: buildChatMessages(request.profile.systemPrompt, request.messages),
        temperature: 0.3,
      };

      if (tools && tools.length > 0) {
        body.tools = tools;
        body.tool_choice = "auto";
      }

      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SEA-LION API error ${response.status}: ${errorText}`);
      }

      const payload = (await response.json()) as SeaLionChatResponse;
      const choices = payload.choices ?? [];
      const choice = choices.length > 0 ? choices[0] : undefined;
      const toolCalls = extractToolCalls(choice);
      const finishReason = choice?.finish_reason ?? "stop";

      return {
        content: choice?.message?.content ?? "",
        toolCalls,
        usage: {
          inputTokens: payload.usage?.prompt_tokens ?? 0,
          outputTokens: payload.usage?.completion_tokens ?? 0,
        },
        stopReason:
          finishReason === "tool_calls"
            ? "tool_call"
            : finishReason === "length"
              ? "max_tokens"
              : "completed",
        responseId: payload.id,
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
