import { homedir } from "node:os";
import { resolve } from "node:path";
import { readFeatureFlags, type FeatureFlags } from "../flags/featureFlags.js";

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

function parseCsvEnv(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function readRuntimeConfig(): RuntimeConfig {
  const trustLocalVps =
    process.env.AGENT_WORKBENCH_TRUST_LOCAL_VPS === "1" ||
    process.env.AGENT_WORKBENCH_TRUST_LOCAL_VPS === "true";
  const providerKind =
    process.env.AGENT_WORKBENCH_PROVIDER === "openai_responses"
      ? "openai_responses"
      : "mock";

  return {
    provider: {
      kind: providerKind,
      model: process.env.AGENT_WORKBENCH_MODEL ?? "gpt-5",
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      timeoutMs: Number(process.env.AGENT_WORKBENCH_LLM_TIMEOUT_MS ?? "120000"),
    },
    featureFlags: readFeatureFlags({
      ENABLE_DANGEROUS_TOOLS:
        trustLocalVps ||
        process.env.ENABLE_DANGEROUS_TOOLS === "1" ||
        process.env.ENABLE_DANGEROUS_TOOLS === "true",
      ENABLE_BACKGROUND_JOBS:
        trustLocalVps ||
        process.env.ENABLE_BACKGROUND_JOBS === "1" ||
        process.env.ENABLE_BACKGROUND_JOBS === "true",
      ENABLE_EXPERIMENTAL_TOOLS:
        trustLocalVps ||
        process.env.ENABLE_EXPERIMENTAL_TOOLS === "1" ||
        process.env.ENABLE_EXPERIMENTAL_TOOLS === "true",
    }),
    toolPolicy: {
      commandTimeoutMs: Number(process.env.AGENT_WORKBENCH_COMMAND_TIMEOUT_MS ?? "30000"),
      maxFileBytes: Number(process.env.AGENT_WORKBENCH_MAX_FILE_BYTES ?? "262144"),
      allowedCommandPrefixes: trustLocalVps
        ? ["*"]
        : parseCsvEnv("AGENT_WORKBENCH_ALLOWED_COMMAND_PREFIXES", [
            "npm test",
            "npm run test",
            "pnpm test",
            "pnpm run test",
            "bun test",
            "node --test",
            "vitest",
            "jest",
          ]),
      blockedCommandPatterns: parseCsvEnv("AGENT_WORKBENCH_BLOCKED_COMMAND_PATTERNS", [
        "rm -rf",
        "shutdown",
        "reboot",
        "mkfs",
        "dd ",
        "git reset --hard",
        "curl ",
        "wget ",
        ">:",
      ]),
    },
    apiPricing: {
      inputCostPerMillionTokens: Number(
        process.env.AGENT_WORKBENCH_INPUT_COST_PER_MILLION_TOKENS ?? "0",
      ),
      outputCostPerMillionTokens: Number(
        process.env.AGENT_WORKBENCH_OUTPUT_COST_PER_MILLION_TOKENS ?? "0",
      ),
    },
    memoryPath:
      process.env.AGENT_WORKBENCH_MEMORY_PATH ??
      resolve(homedir(), ".agent-workbench", "memory.json"),
    scoreboardPath:
      process.env.AGENT_WORKBENCH_SCOREBOARD_PATH ??
      resolve(homedir(), ".agent-workbench", "scoreboard.json"),
    runMetricsDir:
      process.env.AGENT_WORKBENCH_RUN_METRICS_DIR ??
      resolve(homedir(), ".agent-workbench", "metrics"),
    trustLocalVps,
    defaultMode:
      process.env.AGENT_WORKBENCH_DEFAULT_MODE === "external"
        ? "external_safe_mode"
        : trustLocalVps
          ? "internal_mode"
          : "external_safe_mode",
  };
}
