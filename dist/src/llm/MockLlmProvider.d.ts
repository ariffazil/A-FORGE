import type { LlmProvider } from "./LlmProvider.js";
import type { LlmTurnRequest, LlmTurnResponse } from "../types/agent.js";
export declare class MockLlmProvider implements LlmProvider {
    readonly name = "mock-llm";
    completeTurn(request: LlmTurnRequest): Promise<LlmTurnResponse>;
}
