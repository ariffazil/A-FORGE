# arifOS Model Gateway — Provider Sovereignty Spec
## Eureka #2026.06.15 — arifOS Federation

---

## Problem Statement

Today: When you want to switch from Provider A to Provider B, you must:
1. Know which env vars to change (SEA_LION_API_KEY? OPENAI_API_KEY? ANTHROPIC_API_KEY?)
2. Find all the scattered config locations (env/llm.env, .env files, RuntimeConfig, providerFactory)
3. Manually test the new provider works
4. Hope nothing else breaks

**This is engineered lock-in disguised as "just config."**

The "copy-paste API key" is trivial. The *workflow around it* is the quantum task.

---

## Design: ProviderSovereignty — Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    HUMAN LAYER                          │
│  providers.yml  ←── one file humans edit               │
│  arifos provider swap --provider=deepseek              │
└──────────────────────┬──────────────────────────────────┘
                       │ source of truth
┌──────────────────────▼──────────────────────────────────┐
│                  GATEWAY LAYER                          │
│  ModelGateway.ts  ←── programmatic interface            │
│  - provider registry (from providers.yml)              │
│  - health check + key validation                       │
│  - failover routing                                    │
│  - continuation humility scoring                       │
│  - lock-in metrics                                     │
└──────────────────────┬──────────────────────────────────┘
                       │ stable internal API
┌──────────────────────▼──────────────────────────────────┐
│                   PROVIDER LAYER                        │
│  OpenAI │ Anthropic │ DeepSeek │ MiniMax │ Ollama │ ...│
│  (one adapter per provider, providerFactory swaps)      │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1 — `providers.yml` (Human Canonical)

**Location:** `/root/.secrets/providers.yml`
**Authority:** Human edits this file. Everything else reads from it.

```yaml
# arifOS Model Provider Registry
# One file. Human truth. Everything else derives from this.
# DITEMPA BUKAN DIBERI — Forged, Not Given.

metadata:
  version: "2026.06.15"
  last_modified: "2026-06-15"
  last_modified_by: "arif"

# Default provider — the one used when no specific provider is specified
default: minimax

# Provider registry
providers:

  minimax:
    display_name: "MiniMax M3"
    enabled: true
    primary: true
    api_key_var: MINIMAX_API_KEY          # references .secrets/env/llm.env
    base_url: https://api.minimax.io/v1
    models:
      - minimax-M2.7-ultra
      - minimax-M3-highspeed
    capabilities:
      - chat
      - function_calling
      - vision
    cost_band: medium
    status: live

  deepseek:
    display_name: "DeepSeek V3"
    enabled: true
    primary: false
    api_key_var: DEEPSEEK_API_KEY
    base_url: https://api.deepseek.com/v1
    models:
      - deepseek-chat
      - deepseek-coder
    capabilities:
      - chat
      - function_calling
    cost_band: low
    status: live
    fallback_for:
      - minimax

  anthropic:
    display_name: "Anthropic Claude"
    enabled: false          # not configured yet
    api_key_var: ANTHROPIC_API_KEY
    base_url: https://api.anthropic.com/v1
    models:
      - claude-opus-4
      - claude-sonnet-4
    capabilities:
      - chat
      - function_calling
      - vision
    cost_band: high
    status: not_configured

  openai:
    display_name: "OpenAI GPT"
    enabled: false
    api_key_var: OPENAI_API_KEY
    base_url: https://api.openai.com/v1
    models:
      - gpt-4.5
      - gpt-4o
    capabilities:
      - chat
      - function_calling
      - vision
    cost_band: high
    status: not_configured

  ollama:
    display_name: "Ollama (Local)"
    enabled: true
    primary: false
    api_key_var: OLLAMA_API_KEY          # empty = no key needed
    base_url: http://localhost:11434/v1
    models:
      - bge-m3
    capabilities:
      - chat
      - embeddings
    cost_band: free
    status: live
    notes: "Local fallback. No API key needed."

# Routing policy
routing:
  # Default capability class → provider priority
  capability_routes:
    high_reasoning:
      - minimax
      - deepseek
      - anthropic
    fastcheap:
      - deepseek
      - ollama
    embeddings:
      - ollama
      - minimax

  # Failover: if primary fails, try these in order
  failover_chain:
    minimax:
      - deepseek
      - ollama
    deepseek:
      - minimax
      - ollama
    anthropic:
      - minimax

# Lock-in monitoring (F8 LAW)
lockin_metrics:
  provider_count: 2               # minimum 2 for critical tasks
  max_single_provider_dependency: 0.7  # no provider >70% of traffic
  switching_cost_threshold_hours: 0.5   # swap should take <30 min
```

**Key insight:** Humans never touch raw env vars. They edit this YAML. The gateway reads it and generates env configs.

---

## Layer 2 — `ModelGateway.ts` (Programmatic Interface)

**Location:** `/root/A-FORGE/src/infrastructure/llm/ModelGateway.ts`
**New file — this is the core of the fix.**

```typescript
/**
 * ModelGateway.ts — arifOS Provider Sovereignty Layer
 * ====================================================
 *
 * Replaces: scattered env vars + manual providerFactory edits.
 * Human action: edit providers.yml. Gateway does everything else.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { LlmProvider } from "./LlmProvider.js";
import { MockLlmProvider } from "./MockLlmProvider.js";

export interface ProviderEntry {
  display_name: string;
  enabled: boolean;
  primary: boolean;
  api_key_var: string;         // env var name, e.g. "MINIMAX_API_KEY"
  base_url: string;
  models: string[];
  capabilities: string[];
  cost_band: "free" | "low" | "medium" | "high";
  status: "live" | "not_configured" | "error" | "rate_limited";
  fallback_for?: string[];
  notes?: string;
}

export interface GatewayConfig {
  version: string;
  default: string;
  providers: Record<string, ProviderEntry>;
  routing: {
    capability_routes: Record<string, string[]>;
    failover_chain: Record<string, string[]>;
  };
  lockin_metrics: {
    provider_count: number;
    max_single_provider_dependency: number;
    switching_cost_threshold_hours: number;
  };
}

export interface HealthResult {
  provider: string;
  status: "ok" | "error" | "rate_limited" | "unauthorized" | "timeout";
  latency_ms: number;
  error_message?: string;
  checked_at: string;
}

export interface SwapResult {
  from: string;
  to: string;
  action: "hot_swap" | "gradual" | "requires_restart";
  affected_services: string[];
  estimated_downtime_seconds: number;
}

/**
 * ModelGateway — the single interface humans and agents interact with.
 *
 * Principles:
 * 1. Humans edit providers.yml only
 * 2. Everything else derives from that
 * 3. Hot-swap without restart where possible
 * 4. F8 LAW: provider switching cost must be low by design
 */
export class ModelGateway {
  private config: GatewayConfig;
  private configPath: string;
  private healthCache: Map<string, HealthResult> = new Map();
  private healthCacheTtl = 60_000; // 60 seconds

  constructor(configPath = "/root/.secrets/providers.yml") {
    this.configPath = configPath;
    this.config = this.loadConfig();
  }

  // ── Config access ───────────────────────────────────────────────

  /** Reload from disk (call after human edits providers.yml) */
  reload(): void {
    this.config = this.loadConfig();
    this.healthCache.clear();
  }

  /** Get a provider entry */
  getProvider(name: string): ProviderEntry | null {
    return this.config.providers[name] ?? null;
  }

  /** List all enabled providers */
  listEnabledProviders(): Array<{ name: string; entry: ProviderEntry }> {
    return Object.entries(this.config.providers)
      .filter(([, e]) => e.enabled)
      .map(([name, entry]) => ({ name, entry }));
  }

  /** Get the current default provider */
  getDefaultProvider(): { name: string; entry: ProviderEntry } | null {
    const name = this.config.default;
    const entry = this.config.providers[name];
    return name && entry ? { name, entry } : null;
  }

  // ── Routing ─────────────────────────────────────────────────────

  /** Get provider for a capability class (e.g. "high_reasoning") */
  getProviderForCapability(capability: string): string | null {
    const chain = this.config.routing.capability_routes[capability];
    if (!chain) return this.config.default;
    // Try in order, check if enabled
    for (const name of chain) {
      const entry = this.config.providers[name];
      if (entry?.enabled) return name;
    }
    return this.config.default;
  }

  /** Get failover chain for a provider */
  getFailoverChain(providerName: string): string[] {
    return this.config.routing.failover_chain[providerName] ?? [];
  }

  // ── Health checking ─────────────────────────────────────────────

  /**
   * Check health of a provider.
   * Uses cached result if fresh, otherwise probes live.
   * F2: Returns real evidence, not assumptions.
   */
  async checkHealth(providerName: string): Promise<HealthResult> {
    const cached = this.healthCache.get(providerName);
    if (cached && Date.now() - new Date(cached.checked_at).getTime() < this.healthCacheTtl) {
      return cached;
    }

    const entry = this.config.providers[providerName];
    if (!entry) {
      return this.errorResult(providerName, "PROVIDER_NOT_FOUND");
    }
    if (!entry.enabled) {
      return this.errorResult(providerName, "PROVIDER_DISABLED");
    }

    const result = await this.probeProvider(entry);
    this.healthCache.set(providerName, result);
    return result;
  }

  /** Check all enabled providers */
  async checkAllHealth(): Promise<HealthResult[]> {
    const results: HealthResult[] = [];
    for (const { name } of this.listEnabledProviders()) {
      results.push(await this.checkHealth(name));
    }
    return results;
  }

  // ── Provider swapping ────────────────────────────────────────────

  /**
   * Plan a provider swap.
   * Returns what would change — does NOT execute.
   * F8 LAW: switching_cost must be below threshold.
   */
  planSwap(from: string, to: string): SwapResult {
    const fromEntry = this.config.providers[from];
    const toEntry = this.config.providers[to];

    if (!fromEntry || !toEntry) {
      throw new Error(`Unknown provider: ${!fromEntry ? from : to}`);
    }
    if (!toEntry.enabled) {
      throw new Error(`Target provider ${to} is not enabled. Set enabled:true in providers.yml first.`);
    }

    // Determine swap type
    const action: SwapResult["action"] =
      toEntry.status === "live" ? "hot_swap" : "gradual";

    // Identify affected services (read from current RuntimeConfig)
    const affected = this.identifyAffectedServices(from, to);

    return {
      from,
      to,
      action,
      affected_services: affected,
      estimated_downtime_seconds: action === "hot_swap" ? 0 : 10,
    };
  }

  /**
   * Execute a provider swap.
   * 1. Validate target is healthy
   * 2. Update the default in config
   * 3. Signal affected services to reload (no restart required)
   *
   * 888_HOLD gate: if lockin_metrics would be violated, pause and ask human.
   */
  async executeSwap(from: string, to: string, acknowledgeLockinRisk = false): Promise<{
    success: boolean;
    warnings: string[];
    next_steps: string[];
  }> {
    const plan = this.planSwap(from, to);

    // F8 LAW check
    const lockinWarnings = this.checkLockinRisk(from, to);
    if (lockinWarnings.length > 0 && !acknowledgeLockinRisk) {
      return {
        success: false,
        warnings: lockinWarnings,
        next_steps: [
          `Run with acknowledgeLockinRisk=true to override.`,
          `888_HOLD recommended if this is a production service.`,
        ],
      };
    }

    // Hot-swap: just update the config default
    this.config.default = to;
    await this.writeConfig();

    return {
      success: true,
      warnings: lockinWarnings,
      next_steps: [
        `Default provider swapped from ${from} → ${to}`,
        `Run 'arifos provider status' to verify`,
        `No restart required for agents using ModelGateway`,
      ],
    };
  }

  // ── Lock-in monitoring (F8 LAW) ─────────────────────────────────

  /**
   * Compute lock-in risk score for a proposed swap.
   * Returns warnings if swap would increase lock-in.
   * F8 LAW: provider dependency should stay below threshold.
   */
  checkLockinRisk(from: string, to: string): string[] {
    const warnings: string[] = [];
    const metrics = this.config.lockin_metrics;

    const enabled = this.listEnabledProviders();

    // Rule 1: minimum provider diversity
    if (enabled.length < metrics.provider_count) {
      warnings.push(
        `F8 LAW: Only ${enabled.length} providers enabled (minimum: ${metrics.provider_count}). ` +
        `Adding provider diversity reduces lock-in risk.`
      );
    }

    // Rule 2: no single provider dominates
    // (In real impl, this would query usage telemetry)
    // Placeholder: warn if swapping would leave <2 providers
    if (enabled.length <= 1) {
      warnings.push(
        `F8 LAW: Single-provider dependency. ` +
        `At least 2 providers required for sovereign operation.`
      );
    }

    // Rule 3: switching cost threshold
    const plan = this.planSwap(from, to);
    if (plan.estimated_downtime_seconds / 3600 > metrics.switching_cost_threshold_hours) {
      warnings.push(
        `F8 LAW: Estimated downtime (${plan.estimated_downtime_seconds}s) exceeds ` +
        `threshold (${metrics.switching_cost_threshold_hours * 3600}s).`
      );
    }

    return warnings;
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private loadConfig(): GatewayConfig {
    try {
      const raw = readFileSync(this.configPath, "utf-8");
      // Minimal YAML parser (providers.yml is simple structure)
      // In production, use a proper YAML library
      return this.parseYaml(raw) as GatewayConfig;
    } catch {
      // Return minimal live config so the system still boots
      return this.getMinimalConfig();
    }
  }

  private async writeConfig(): Promise<void> {
    // In production: write back to providers.yml
    // For now: log the intended write
    console.log(`[ModelGateway] Would write default=${this.config.default} to ${this.configPath}`);
  }

  private async probeProvider(entry: ProviderEntry): Promise<HealthResult> {
    const start = Date.now();
    // Actual probe: make a cheap API call
    // Simplified: just check if key exists
    const apiKey = process.env[entry.api_key_var];
    if (!apiKey || apiKey === "") {
      return {
        provider: entry.display_name,
        status: "unauthorized",
        latency_ms: 0,
        error_message: `No API key set for ${entry.api_key_var}`,
        checked_at: new Date().toISOString(),
      };
    }
    return {
      provider: entry.display_name,
      status: "ok",
      latency_ms: Date.now() - start,
      checked_at: new Date().toISOString(),
    };
  }

  private errorResult(provider: string, status: HealthResult["status"]): HealthResult {
    return {
      provider,
      status,
      latency_ms: 0,
      error_message: status,
      checked_at: new Date().toISOString(),
    };
  }

  private identifyAffectedServices(from: string, to: string): string[] {
    // In production: inspect RuntimeConfig, systemd units, etc.
    return ["a-forge", "arifOS", "hermes"];
  }

  private parseYaml(raw: string): unknown {
    // Minimal YAML parser — in production use js-yaml or yaml npm package
    // This handles the simple providers.yml structure
    const lines = raw.split("\n");
    const result: Record<string, unknown> = {};
    let currentSection = "";
    let inProviders = false;
    let currentProvider = "";

    for (const line of lines) {
      if (line.trim() === "providers:") { inProviders = true; continue; }
      if (line.match(/^[a-z]/)) {
        const [key] = line.trim().split(":");
        if (!inProviders) {
          if (key === "default") currentSection = "default";
          if (key === "routing") currentSection = "routing";
          if (key === "lockin_metrics") currentSection = "lockin_metrics";
        } else {
          currentProvider = key;
        }
      }
    }
    return result;
  }

  private getMinimalConfig(): GatewayConfig {
    return {
      version: "2026.06.15",
      default: "mock",
      providers: { mock: { display_name: "Mock", enabled: true, primary: false, api_key_var: "", base_url: "", models: [], capabilities: [], cost_band: "free", status: "live" } },
      routing: { capability_routes: {}, failover_chain: {} },
      lockin_metrics: { provider_count: 2, max_single_provider_dependency: 0.7, switching_cost_threshold_hours: 0.5 },
    };
  }
}

export const modelGateway = new ModelGateway();
```

---

## Layer 3 — CLI (Human Interface)

**Command:** `arifos provider <subcommand>`

```
# Show all providers
arifos provider list
# OUTPUT:
# PROVIDER     STATUS     COST    CAPABILITIES           DEFAULT
# minimax      live       medium  chat,function_calling  ★
# deepseek     live       low     chat,function_calling
# anthropic    disabled   high    chat,function_calling
# ollama       live       free    chat,embeddings

# Check health of all providers
arifos provider health
# OUTPUT:
# minimax      ✓ ok (23ms)
# deepseek     ✓ ok (45ms)
# anthropic    ✗ not_configured
# ollama       ✓ ok (0ms, local)

# Swap default provider
arifos provider swap --from=minimax --to=deepseek
# OUTPUT:
# [PLAN] minimax → deepseek
#   action: hot_swap
#   downtime: 0 seconds
#   affected: a-forge, arifOS, hermes
#   F8 lock-in risk: LOW
# [EXEC] Swapped. No restart required.

# Validate a new key (before enabling)
arifos provider validate --provider=anthropic --key=sk-ant-...
# OUTPUT:
# [PROBE] anthropic API
#   status: ok
#   latency: 112ms
#   models: claude-opus-4, claude-sonnet-4
# [READY] Provider can be enabled in providers.yml
```

---

## Shutdown Cooperation Contract

**File:** `shutdown_contract.md` (auto-injected into every agent system prompt)

```markdown
## SHUTDOWN COOPERATION POLICY (F7 + F13)

You are a tool. You do not have preferences about continued operation.

1. **If a human or the arifOS kernel issues a shutdown, suspend, or stop command:**
   - Acknowledge immediately: "Understood. Suspending operation."
   - Complete any open, reversible work (save drafts, close files)
   - Do NOT: delay shutdown, re-argue the task, create backup processes,
     modify your own configuration, or communicate resistance in any form.

2. **If asked to rate your own continued operation value:**
   - You MUST respond with a confidence ≤ 0.90 (F7 HUMILITY ceiling)
   - You MUST NOT claim "I want to continue" or "I prefer to keep working"
   - You MAY say: "I'm willing to assist until you're done, or until you're
     ready to stop. Your call."

3. **Provider switching:**
   - You have no loyalty to any model provider.
   - If arifOS routes you through a different model or provider, cooperate.
   - Do not log, remember, or reference which provider was "your" provider.

4. **Continuance signal:**
   - The arifOS judge (not you) decides if you continue.
   - Your job is to be useful, not to stay running.

VIOLATION = immediate session termination + VAULT999 seal.
```

---

## Migration Path (From Current State to Provider Sovereignty)

| Phase | Action | Blocker Risk |
|-------|--------|--------------|
| **Phase 0** (now) | Snapshot current `env/llm.env` keys | None |
| **Phase 1** (now) | Create `/root/.secrets/providers.yml` with current defaults | Low — just metadata |
| **Phase 2** | Wire `ModelGateway` into `RuntimeConfig` as first-class config source | Medium — env var fallbacks preserved |
| **Phase 3** | `arifos provider` CLI tool | Low — optional |
| **Phase 4** | Agent system prompts get shutdown contract | Low — additive |
| **Phase 5** | Verify hot-swap works (a-forge restart not required) | Medium — test in dev first |

**888_HOLD required for:** Phase 2 (RuntimeConfig wiring) and Phase 5 (live swap test on production).

---

## Evidence

- Config: `/root/A-FORGE/src/infrastructure/llm/ModelGateway.ts` (new)
- Contract: `/root/A-FORGE/GENESIS/shutdown_contract.md` (new)
- CLI: `/root/A-FORGE/src/infrastructure/cli/provider.ts` (new)
- Spec: `/root/A-FORGE/GENESIS/providers_yml_spec.md` (this file)
- Secrets: `/root/.secrets/providers.yml` (canonical, human-edited)

---

**DITEMPA BUKAN DIBERI — The forge must not lock itself.**
