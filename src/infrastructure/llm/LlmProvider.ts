import type { LlmTurnRequest, LlmTurnResponse } from "../../domain/types/agent.js";

/** Callbacks passed alongside the request for streaming/UX hooks */
export interface LlmStreamCallbacks {
  /** Called for each token chunk during streaming */
  onToken?: (token: string) => void;
  /** Called when the LLM starts thinking (spinner trigger) */
  onThinking?: () => void;
  /** Called when the LLM finishes a turn */
  onComplete?: () => void;
}

export interface LlmProvider {
  readonly name: string;
  completeTurn(request: LlmTurnRequest, callbacks?: LlmStreamCallbacks): Promise<LlmTurnResponse>;

  /** If true, this provider supports streaming via onToken callback */
  readonly supportsStreaming?: boolean;
}
