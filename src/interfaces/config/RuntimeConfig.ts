import { homedir } from "node:os";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { readFeatureFlags, type FeatureFlags } from "../../interfaces/config/featureFlags.js";
import { modelGateway, type ModelGateway, type GatewayConfig, type ProviderEntry } from "../../infrastructure/llm/ModelGateway.js";

export type LlmProviderConfig = {
  kind: "mock" | "openai_responses" | "ollama" | "sea_lion" | "model_gateway";
  model: string;
  apiKey?: string;
  baseUrl: string;
  timeoutMs: number;
  /**
   * If kind = "model_gateway", the registry provider name from providers.yml
   * (e.g. "mimo", "minimax", "deepseek"). Resolution flow:
   *   1. Use this name to look up in ModelGateway
   *   2. If not found, fall back to providers.yml default
   *   3. If that fails, fall back to env-based provider
   */
  gatewayProviderName?: string;
  /**
   * If true, the runtime will use the gateway's failover_chain on errors.
   */
  useGatewayFailover?: boolean;
};

export type ToolPolicyConfig = {
  commandTimeoutMs: number;
  maxFileBytes: number;
  allowedCommandPrefixes: string[];
  blockedCommandPatterns: string[];
  allowedTools?: string[];
  blockedTools?: string[];
};

export type GatewayResolved = {
  /** The ModelGateway singleton (or a fresh one if the test wants isolation) */
  gateway: ModelGateway;
  /** The resolved provider entry that this config binds to */
  provider: ProviderEntry;
  /** Resolved failover chain (may be empty) */
  failoverChain: string[];
  /** Whether this came from providers.yml (true) or env-var fallback (false) */
  fromRegistry: boolean;
};

export type RuntimeConfig = {
  provider: LlmProviderConfig;
  fallbackProvider?: LlmProviderConfig;
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
  humanEscalationWebhookUrl?: string;
  postgresUrl?: string;
  redisUrl?: string;
  arifosGovernanceUrl?: string;
  arifosMcpUrl?: string;
  wealthMcpUrl?: string;
  geoxMcpUrl?: string;
  operatorApiToken?: string;
  actorId: string;
  judgeBlocking: boolean;
  /**
   * DEP-1 (2026-06-15): providers.yml is now the source of truth for provider
   * identity. This field exposes the gateway config (read-only snapshot).
   * To mutate, use `modelGateway.reload()` or `modelGateway.executeSwap()`.
   * @see /root/A-FORGE/src/infrastructure/llm/ModelGateway.ts
   */
  modelGateway?: {
    config: GatewayConfig;
    resolved: GatewayResolved;
  };
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

/**
 * Resolve a provider from the ModelGateway registry.
 * Order:
 *   1. Explicit gatewayProviderName (e.g. "mimo")
 *   2. Gateway's default provider (e.g. "minimax")
 *   3. Env-var based provider (legacy fallback)
 */
function resolveFromGateway(
  gatewayProviderName: string | undefined
): { gatewayResolved: GatewayResolved; llmConfig: LlmProviderConfig } {
  const explicit = gatewayProviderName ? modelGateway.getProvider(gatewayProviderName) : null;
  const defaultProv = modelGateway.getDefaultProvider();
  // Both explicit and defaultProv are ProviderEntry | null, but defaultProv returns {name, entry}.
  // We use explicit first (which is already ProviderEntry), then unwrap defaultProv.
  const registryProvider: ProviderEntry | null =
    explicit ?? (defaultProv ? defaultProv.entry : null);
  const resolvedName = explicit
    ? gatewayProviderName!
    : defaultProv
      ? defaultProv.name
      : "mock";

  if (registryProvider) {
    const apiKey = process.env[registryProvider.api_key_var] ?? "";
    return {
      gatewayResolved: {
        gateway: modelGateway,
        provider: registryProvider,
        failoverChain: modelGateway.getFailoverChain(resolvedName),
        fromRegistry: true,
      },
      llmConfig: {
        kind: "model_gateway",
        model: registryProvider.models[0] ?? process.env.AGENT_WORKBENCH_MODEL ?? "unknown",
        apiKey,
        baseUrl: registryProvider.base_url,
        timeoutMs: Number(process.env.AGENT_WORKBENCH_LLM_TIMEOUT_MS ?? "120000"),
        gatewayProviderName: resolvedName,
        useGatewayFailover: process.env.AGENT_WORKBENCH_USE_GATEWAY_FAILOVER === "1",
      },
    };
  }

  // Fallback: env-var based
  const providerKind = process.env.AGENT_WORKBENCH_PROVIDER === "openai_responses"
    ? "openai_responses"
    : process.env.AGENT_WORKBENCH_PROVIDER === "ollama"
      ? "ollama"
      : process.env.AGENT_WORKBENCH_PROVIDER === "sea_lion"
        ? "sea_lion"
        : "mock";
  return {
    gatewayResolved: {
      gateway: modelGateway,
      provider: {
        display_name: "env-var fallback",
        enabled: true,
        primary: false,
        api_key_var: providerKind === "sea_lion" ? "SEA_LION_API_KEY" : "OPENAI_API_KEY",
        base_url: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
        models: [process.env.AGENT_WORKBENCH_MODEL ?? "gpt-5"],
        capabilities: [],
        cost_band: "medium",
        status: "not_configured",
      },
      failoverChain: [],
      fromRegistry: false,
    },
    llmConfig: {
      kind: providerKind as "openai_responses" | "ollama" | "sea_lion" | "mock",
      model: process.env.AGENT_WORKBENCH_MODEL ?? (providerKind === "ollama" ? "llama3.2" : providerKind === "sea_lion" ? "aisingapore/Gemma-SEA-LION-v4-27B-IT" : "gpt-5"),
      apiKey:
        providerKind === "sea_lion"
          ? (process.env.SEA_LION_API_KEY ?? process.env.OPENAI_API_KEY)
          : process.env.OPENAI_API_KEY,
      baseUrl:
        providerKind === "ollama"
          ? (process.env.OLLAMA_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "http://localhost:11434")
          : providerKind === "sea_lion"
            ? (process.env.SEA_LION_BASE_URL ?? "https://api.sea-lion.ai/v1")
            : (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"),
      timeoutMs: Number(process.env.AGENT_WORKBENCH_LLM_TIMEOUT_MS ?? "120000"),
    },
  };
}

export function readRuntimeConfig(): RuntimeConfig {
  const trustLocalVps =
    process.env.AGENT_WORKBENCH_TRUST_LOCAL_VPS === "1" ||
    process.env.AGENT_WORKBENCH_TRUST_LOCAL_VPS === "true";

  // DEP-1 (2026-06-15): ModelGateway is the primary source.
  // AGENT_WORKBENCH_PROVIDER can be:
  //   - "model_gateway" — use the default provider from providers.yml
  //   - "model_gateway:mimo" — use a specific provider from registry
  //   - "openai_responses" / "ollama" / "sea_lion" / "mock" — legacy env-only mode
  const providerEnv = process.env.AGENT_WORKBENCH_PROVIDER ?? "";
  const isGatewayMode =
    providerEnv === "model_gateway" ||
    providerEnv.startsWith("model_gateway:") ||
    (!providerEnv && existsSync("/root/.secrets/providers.yml"));
  const gatewayProviderName = providerEnv.startsWith("model_gateway:")
    ? providerEnv.split(":", 2)[1]
    : undefined;

  let provider: LlmProviderConfig;
  let gatewaySnapshot: RuntimeConfig["modelGateway"];

  if (isGatewayMode) {
    const { gatewayResolved, llmConfig } = resolveFromGateway(gatewayProviderName);
    provider = llmConfig;
    gatewaySnapshot = {
      config: gatewayResolved.gateway.getConfig(),
      resolved: gatewayResolved,
    };
  } else {
    const providerKind =
      providerEnv === "openai_responses"
        ? "openai_responses"
        : providerEnv === "ollama"
          ? "ollama"
          : providerEnv === "sea_lion"
            ? "sea_lion"
            : "mock";
    provider = {
      kind: providerKind,
      model: process.env.AGENT_WORKBENCH_MODEL ?? (providerKind === "ollama" ? "llama3.2" : providerKind === "sea_lion" ? "aisingapore/Gemma-SEA-LION-v4-27B-IT" : "gpt-5"),
      apiKey:
        providerKind === "sea_lion"
          ? (process.env.SEA_LION_API_KEY ?? process.env.OPENAI_API_KEY)
          : process.env.OPENAI_API_KEY,
      baseUrl:
        providerKind === "ollama"
          ? (process.env.OLLAMA_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "http://localhost:11434")
          : providerKind === "sea_lion"
            ? (process.env.SEA_LION_BASE_URL ?? "https://api.sea-lion.ai/v1")
            : (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"),
      timeoutMs: Number(process.env.AGENT_WORKBENCH_LLM_TIMEOUT_MS ?? "120000"),
    };
  }

  const fallbackProviderKind = process.env.LLM_FALLBACK_PROVIDER ?? "";
  const fallbackProvider: LlmProviderConfig | undefined =
    fallbackProviderKind === "ollama"
      ? {
          kind: "ollama",
          model: process.env.LLM_FALLBACK_MODEL ?? process.env.AGENT_WORKBENCH_MODEL ?? "llama3.2",
          baseUrl: process.env.OLLAMA_BASE_URL ?? "http://ollama:11434",
          timeoutMs: Number(process.env.AGENT_WORKBENCH_LLM_TIMEOUT_MS ?? "120000"),
        }
      : fallbackProviderKind === "openai_responses"
        ? {
            kind: "openai_responses",
            model: process.env.LLM_FALLBACK_MODEL ?? "gpt-5",
            apiKey: process.env.OPENAI_API_KEY,
            baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
            timeoutMs: Number(process.env.AGENT_WORKBENCH_LLM_TIMEOUT_MS ?? "120000"),
          }
        : undefined;

  const config: RuntimeConfig = {
    provider,
    featureFlags: readFeatureFlags({
      ENABLE_DANGEROUS_TOOLS:
        trustLocalVps ||
        process.env.ENABLE_DANGEROUS_TOOLS === "1" ||
        process.env.ENABLE_DANGEROUS_TOOLS === "true",
      ENABLE_BACKGROUND_JOBS:
        process.env.ENABLE_BACKGROUND_JOBS === "1" ||
        process.env.ENABLE_BACKGROUND_JOBS === "true",
      ENABLE_EXPERIMENTAL_TOOLS:
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
      allowedTools: parseCsvEnv("AGENT_WORKBENCH_ALLOWED_TOOLS", []),
      blockedTools: parseCsvEnv("AGENT_WORKBENCH_BLOCKED_TOOLS", []),
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
    humanEscalationWebhookUrl: process.env.HUMAN_ESCALATION_WEBHOOK_URL,
    postgresUrl: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    arifosGovernanceUrl: process.env.ARIFOS_GOVERNANCE_URL,
    arifosMcpUrl: process.env.ARIFOS_MCP_URL,
    wealthMcpUrl: process.env.WEALTH_MCP_URL,
    geoxMcpUrl: process.env.GEOX_MCP_URL,
    operatorApiToken: process.env.OPERATOR_API_TOKEN,
    actorId: process.env.ACTOR_ID ?? "ariffazil::agent-civ",
    judgeBlocking:
      process.env.FORGE_JUDGE_BLOCKING === "1" ||
      process.env.FORGE_JUDGE_BLOCKING === "true" ||
      process.env.NODE_ENV === "production",
    fallbackProvider,
    ...(gatewaySnapshot ? { modelGateway: gatewaySnapshot } : {}),
  };

  if (config.trustLocalVps) {
    console.error("[WARN] AGENT_WORKBENCH_TRUST_LOCAL_VPS is active — dangerous tools enabled and command prefix filtering disabled. Use only in isolated environments.");
  }

  return config;
}
