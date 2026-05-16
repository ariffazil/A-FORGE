import type { LlmTurnRequest, LlmTurnResponse } from "../types/agent.js";

export interface LlmProvider {
  readonly name: string;
  completeTurn(request: LlmTurnRequest): Promise<LlmTurnResponse>;
}
