import { MockLlmProvider } from "./MockLlmProvider.js";
import { OpenAIResponsesProvider } from "./OpenAIResponsesProvider.js";
export function createLlmProvider(config) {
    if (config.provider.kind === "openai_responses") {
        if (!config.provider.apiKey) {
            throw new Error("OPENAI_API_KEY is required when AGENT_WORKBENCH_PROVIDER=openai_responses.");
        }
        return new OpenAIResponsesProvider({
            apiKey: config.provider.apiKey,
            model: config.provider.model,
            baseUrl: config.provider.baseUrl,
            timeoutMs: config.provider.timeoutMs,
        });
    }
    return new MockLlmProvider();
}
