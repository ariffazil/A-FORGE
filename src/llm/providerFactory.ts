import type { LlmProvider } from "./LlmProvider.js";
import { MockLlmProvider } from "./MockLlmProvider.js";
import { OpenAIResponsesProvider } from "./OpenAIResponsesProvider.js";
import { OllamaProvider } from "./OllamaProvider.js";
import { SeaLionProvider } from "./SeaLionProvider.js";
import { FallbackProvider } from "./FallbackProvider.js";
import type { RuntimeConfig } from "../config/RuntimeConfig.js";

export function createLlmProvider(config: RuntimeConfig): LlmProvider {
  if (config.provider.kind === "openai_responses") {
    if (!config.provider.apiKey) {
      throw new Error(
        "OPENAI_API_KEY is required when AGENT_WORKBENCH_PROVIDER=openai_responses.",
      );
    }

    return new OpenAIResponsesProvider({
      apiKey: config.provider.apiKey,
      model: config.provider.model,
      baseUrl: config.provider.baseUrl,
      timeoutMs: config.provider.timeoutMs,
    });
  }

  if (config.provider.kind === "ollama") {
    return new OllamaProvider({
      model: config.provider.model,
      baseUrl: config.provider.baseUrl,
      timeoutMs: config.provider.timeoutMs,
    });
  }

  if (config.provider.kind === "sea_lion") {
    if (!config.provider.apiKey) {
      throw new Error(
        "SEA_LION_API_KEY is required when AGENT_WORKBENCH_PROVIDER=sea_lion.",
      );
    }
    const primary = new SeaLionProvider({
      apiKey: config.provider.apiKey,
      model: config.provider.model,
      baseUrl: config.provider.baseUrl,
      timeoutMs: config.provider.timeoutMs,
    });
    if (config.fallbackProvider) {
      if (config.fallbackProvider.kind === "ollama") {
        const fallback = new OllamaProvider({
          model: config.fallbackProvider.model,
          baseUrl: config.fallbackProvider.baseUrl,
          timeoutMs: config.fallbackProvider.timeoutMs,
        });
        return new FallbackProvider(primary, fallback);
      }
      if (config.fallbackProvider.kind === "openai_responses") {
        const fallback = new OpenAIResponsesProvider({
          apiKey: config.fallbackProvider.apiKey ?? "",
          model: config.fallbackProvider.model,
          baseUrl: config.fallbackProvider.baseUrl,
          timeoutMs: config.fallbackProvider.timeoutMs,
        });
        return new FallbackProvider(primary, fallback);
      }
    }
    return primary;
  }

  return new MockLlmProvider();
}
