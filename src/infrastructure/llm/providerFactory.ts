import type { LlmProvider } from "./LlmProvider.js";
import { MockLlmProvider } from "./MockLlmProvider.js";
import { OpenAIResponsesProvider } from "./OpenAIResponsesProvider.js";
import { OllamaProvider } from "./OllamaProvider.js";
import { SeaLionProvider } from "./SeaLionProvider.js";
import { FallbackProvider } from "./FallbackProvider.js";
import { modelGateway } from "./ModelGateway.js";
import type { RuntimeConfig } from "../../interfaces/config/RuntimeConfig.js";

/**
 * Resolve a provider from the ModelGateway registry.
 * If useGatewayFailover is on, returns a FallbackProvider wrapping
 * the primary + the chain from providers.yml.
 */
function createGatewayBackedProvider(config: RuntimeConfig): LlmProvider {
  if (!config.modelGateway) {
    throw new Error(
      "provider.kind = 'model_gateway' but RuntimeConfig.modelGateway is unset. " +
      "Either AGENT_WORKBENCH_PROVIDER=model_gateway:<name> or the providers.yml registry must exist."
    );
  }

  const entry = config.modelGateway.resolved.provider;
  const apiKey = process.env[entry.api_key_var] ?? config.provider.apiKey ?? "";

  if (!apiKey) {
    throw new Error(
      `ModelGateway: provider '${entry.display_name}' requires env var ${entry.api_key_var} to be set.`
    );
  }

  // The gateway-resolved base URL is the OpenAI-compatible endpoint.
  // For most providers (Xiaomi, DeepSeek, Groq, etc.) this is correct.
  // For Anthropic-native providers, the URL differs — gateway provides anthropic_url.
  const anthropicUrl = (entry as unknown as Record<string, unknown>).anthropic_url as string | undefined;
  const isAnthropicStyle = anthropicUrl && entry.base_url.includes("anthropic.com");
  const useAnthropicStyle = entry.api_key_var === "ANTHROPIC_API_KEY" || isAnthropicStyle;

  if (useAnthropicStyle) {
    // No Anthropic provider class yet — fall back to OpenAIResponsesProvider with anthropicUrl
    // (most Anthropic-compatible providers also accept OpenAI-style calls)
    return new OpenAIResponsesProvider({
      apiKey,
      model: config.provider.model,
      baseUrl: entry.base_url,
      timeoutMs: config.provider.timeoutMs,
    });
  }

  const primary = new OpenAIResponsesProvider({
    apiKey,
    model: config.provider.model,
    baseUrl: entry.base_url,
    timeoutMs: config.provider.timeoutMs,
  });

  // If failover chain is enabled, wrap in FallbackProvider (single fallback supported)
  if (config.provider.useGatewayFailover && config.modelGateway.resolved.failoverChain.length > 0) {
    const chain = config.modelGateway.resolved.failoverChain;
    for (const name of chain) {
      const next = modelGateway.getProvider(name);
      if (!next || !next.enabled) continue;
      const nextKey = process.env[next.api_key_var];
      if (!nextKey) continue;
      const fallback = new OpenAIResponsesProvider({
        apiKey: nextKey,
        model: next.models[0] ?? "unknown",
        baseUrl: next.base_url,
        timeoutMs: Number(process.env.AGENT_WORKBENCH_LLM_TIMEOUT_MS ?? "120000"),
      });
      return new FallbackProvider(primary, fallback);
    }
  }

  return primary;
}

export function createLlmProvider(config: RuntimeConfig): LlmProvider {
  if (config.provider.kind === "model_gateway") {
    return createGatewayBackedProvider(config);
  }

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
