import { type FeatureFlags } from "../flags/featureFlags.js";
export type LlmProviderConfig = {
    kind: "mock" | "openai_responses";
    model: string;
    apiKey?: string;
    baseUrl: string;
    timeoutMs: number;
};
export type ToolPolicyConfig = {
    commandTimeoutMs: number;
    maxFileBytes: number;
    allowedCommandPrefixes: string[];
    blockedCommandPatterns: string[];
};
export type RuntimeConfig = {
    provider: LlmProviderConfig;
    featureFlags: FeatureFlags;
    toolPolicy: ToolPolicyConfig;
    apiPricing: {
        inputCostPerMillionTokens: number;
        outputCostPerMillionTokens: number;
    };
    memoryPath: string;
    scoreboardPath: string;
    runMetricsDir: string;
    trustLocalVps: boolean;
    defaultMode: "internal_mode" | "external_safe_mode";
};
export declare function readRuntimeConfig(): RuntimeConfig;
