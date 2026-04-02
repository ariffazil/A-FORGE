import type { LlmProvider } from "./LlmProvider.js";
import type { LlmTurnRequest, LlmTurnResponse } from "../types/agent.js";
type FetchLike = typeof fetch;
type OpenAIResponsesProviderOptions = {
    apiKey: string;
    model: string;
    baseUrl?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
};
export declare class OpenAIResponsesProvider implements LlmProvider {
    private readonly options;
    readonly name = "openai-responses";
    private readonly fetchImpl;
    private readonly timeoutMs;
    private readonly endpoint;
    constructor(options: OpenAIResponsesProviderOptions);
    completeTurn(request: LlmTurnRequest): Promise<LlmTurnResponse>;
}
export {};
