import type { LlmProvider } from "./LlmProvider.js";
import type { LlmTurnRequest, LlmTurnResponse } from "../types/agent.js";

export class FallbackProvider implements LlmProvider {
  readonly name = "fallback";

  constructor(
    private readonly primary: LlmProvider,
    private readonly fallback: LlmProvider,
  ) {}

  async completeTurn(request: LlmTurnRequest): Promise<LlmTurnResponse> {
    try {
      const result = await this.primary.completeTurn(request);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[FallbackProvider] Primary provider "${this.primary.name}" failed: ${msg}. Falling back to "${this.fallback.name}".`,
      );
      return this.fallback.completeTurn(request);
    }
  }
}
