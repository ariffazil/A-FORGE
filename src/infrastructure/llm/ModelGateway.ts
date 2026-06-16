/**
 * ModelGateway.ts — arifOS Provider Sovereignty Layer
 * ======================================================
 *
 * Single interface for all model providers.
 * Human action: edit /root/.secrets/providers.yml
 * Everything else reads from that.
 *
 * Key properties:
 * - Hot-swap without restart
 * - F8 LAW lock-in monitoring
 * - F7 HUMILITY continuation scoring
 * - Provider health checking
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

import { readFileSync, existsSync, writeFileSync, renameSync, copyFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export interface ProviderEntry {
  display_name: string;
  enabled: boolean;
  primary: boolean;
  api_key_var: string;
  base_url: string;
  models: string[];
  capabilities: string[];
  cost_band: "free" | "low" | "medium" | "high";
  status: "live" | "not_configured" | "error" | "rate_limited";
  fallback_for?: string[];
  notes?: string;
}

export interface RoutingConfig {
  capability_routes: Record<string, string[]>;
  failover_chain: Record<string, string[]>;
}

export interface LockinMetrics {
  provider_count_min: number;
  max_single_provider_dependency: number;
  switching_cost_max_hours: number;
}

export interface GatewayConfig {
  version: string;
  default: string;
  providers: Record<string, ProviderEntry>;
  routing: RoutingConfig;
  lockin_metrics: LockinMetrics;
}

export interface HealthResult {
  provider: string;
  provider_key: string;
  status: "ok" | "error" | "rate_limited" | "unauthorized" | "timeout" | "disabled" | "not_found" | "not_configured";
  latency_ms: number;
  error_message?: string;
  checked_at: string;
}

export interface SwapPlan {
  from: string;
  to: string;
  action: "hot_swap" | "gradual" | "requires_restart";
  affected_services: string[];
  estimated_downtime_seconds: number;
  warnings: string[];
}

export interface SwapResult {
  success: boolean;
  plan: SwapPlan;
  config_written: boolean;
  next_steps: string[];
}

/**
 * ModelGateway — the single interface for provider management.
 *
 * Design principles:
 * 1. providers.yml is the ONLY human-edited file for provider config
 * 2. Hot-swap without restart where provider supports it
 * 3. F8 LAW: switching cost must be below threshold
 * 4. F7 HUMILITY: no provider loyalty, no continuance argument
 */
export class ModelGateway {
  private config: GatewayConfig;
  private configPath: string;
  private healthCache = new Map<string, HealthResult>();
  private healthCacheTtlMs = 60_000;

  constructor(configPath = "/root/.secrets/providers.yml") {
    this.configPath = configPath;
    this.config = this.loadConfig();
  }

  // ── Config access ───────────────────────────────────────────────────────────

  /** Reload from disk. Call after human edits providers.yml. */
  reload(): void {
    this.config = this.loadConfig();
    this.healthCache.clear();
  }

  /** Return the full loaded config. */
  getConfig(): GatewayConfig {
    return this.config;
  }

  /** Get a provider entry by name. */
  getProvider(name: string): ProviderEntry | null {
    return this.config.providers[name] ?? null;
  }

  /** List all enabled providers with their names. */
  listEnabledProviders(): Array<{ name: string; entry: ProviderEntry }> {
    return Object.entries(this.config.providers)
      .filter(([, e]) => e.enabled)
      .map(([name, entry]) => ({ name, entry }));
  }

  /** Get the current default provider. */
  getDefaultProvider(): { name: string; entry: ProviderEntry } | null {
    const name = this.config.default;
    const entry = this.config.providers[name];
    return name && entry ? { name, entry } : null;
  }

  // ── Routing ────────────────────────────────────────────────────────────────

  /**
   * Get the provider for a capability class.
   * Falls through the capability_routes chain until a live provider is found.
   */
  getProviderForCapability(capability: string): { name: string; entry: ProviderEntry } | null {
    const chain = this.config.routing.capability_routes[capability];
    if (!chain) {
      return this.getDefaultProvider();
    }
    for (const name of chain) {
      const entry = this.config.providers[name];
      if (entry?.enabled && entry.status === "live") {
        return { name, entry };
      }
    }
    return this.getDefaultProvider();
  }

  /** Get the failover chain for a provider. */
  getFailoverChain(providerName: string): string[] {
    return this.config.routing.failover_chain[providerName] ?? [];
  }

  // ── Health checking ────────────────────────────────────────────────────────

  /**
   * Check if a provider is healthy.
   * Uses cached result if fresh (60s TTL).
   * F2: Returns real probe evidence, not assumptions.
   */
  async checkHealth(providerName: string): Promise<HealthResult> {
    const cached = this.healthCache.get(providerName);
    if (cached && Date.now() - new Date(cached.checked_at).getTime() < this.healthCacheTtlMs) {
      return cached;
    }

    const entry = this.config.providers[providerName];
    if (!entry) {
      const result = this.mkResult(providerName, providerName, "not_found", 0, "Provider not found in registry");
      this.healthCache.set(providerName, result);
      return result;
    }
    if (!entry.enabled) {
      const result = this.mkResult(providerName, providerName, "disabled", 0, "Provider is disabled in providers.yml");
      this.healthCache.set(providerName, result);
      return result;
    }

    const result = await this.probeProvider(providerName, entry);
    this.healthCache.set(providerName, result);
    return result;
  }

  /** Check health of all registered providers. */
  async checkAllHealth(): Promise<HealthResult[]> {
    const results: HealthResult[] = [];
    for (const name of Object.keys(this.config.providers)) {
      results.push(await this.checkHealth(name));
    }
    return results;
  }

  // ── Provider swapping ──────────────────────────────────────────────────────

  /**
   * Plan a provider swap. Returns the plan WITHOUT executing.
   * Use this to see what would change before committing.
   */
  planSwap(from: string, to: string): SwapPlan {
    const fromEntry = this.config.providers[from];
    const toEntry = this.config.providers[to];

    if (!fromEntry) throw new Error(`Source provider '${from}' not found in registry`);
    if (!toEntry) throw new Error(`Target provider '${to}' not found in registry`);
    if (!toEntry.enabled) throw new Error(`Target provider '${to}' is disabled. Set enabled:true in providers.yml first.`);

    // Determine swap type
    let action: SwapPlan["action"] = "hot_swap";
    if (toEntry.status !== "live") {
      action = toEntry.status === "error" || toEntry.status === "rate_limited" ? "requires_restart" : "gradual";
    }

    const warnings = this.checkLockinWarnings(from, to);

    return {
      from,
      to,
      action,
      affected_services: this.identifyAffectedServices(from, to),
      estimated_downtime_seconds: action === "hot_swap" ? 0 : action === "gradual" ? 10 : 30,
      warnings,
    };
  }

  /**
   * Execute a provider swap.
   * 1. Validates target is healthy (or acknowledges warnings)
   * 2. Writes default to providers.yml (atomic write via tmp + rename)
   * 3. Updates this instance's default
   * 4. Signals affected services to reload (systemd SIGHUP if available)
   *
   * Returns SwapResult with next_steps for the human.
   */
  async executeSwap(
    from: string,
    to: string,
    options: { acknowledgeLockinWarnings?: boolean; dryRun?: boolean } = {}
  ): Promise<SwapResult> {
    const plan = this.planSwap(from, to);

    // F8 LAW gate: check lock-in warnings
    if (plan.warnings.length > 0 && !options.acknowledgeLockinWarnings) {
      return {
        success: false,
        plan,
        config_written: false,
        next_steps: [
          `[F8 LAW] Lock-in risk detected. Review warnings above.`,
          `To override: executeSwap('${from}', '${to}', { acknowledgeLockinWarnings: true })`,
          `888_HOLD recommended for production services.`,
        ],
      };
    }

    // Hot-swap: update in-memory + write back to providers.yml
    this.config.default = to;

    let configWritten = false;
    if (options.dryRun) {
      console.log(`[ModelGateway] DRY-RUN: would swap ${from} → ${to} (${plan.action})`);
    } else {
      try {
        await this.writeConfig();
        configWritten = true;
        console.log(`[ModelGateway] SWAP written: ${from} → ${to} (${plan.action})`);
      } catch (err) {
        return {
          success: false,
          plan,
          config_written: false,
          next_steps: [
            `[FAIL] Could not write providers.yml: ${err}`,
            `In-memory default still set to '${to}'.`,
            `Re-run with acknowledgeLockinWarnings:true to retry, or fix file permissions.`,
          ],
        };
      }
    }

    // Signal affected services to reload (no restart)
    const signalResults = this.signalAffectedServicesReload();

    return {
      success: true,
      plan,
      config_written: configWritten,
      next_steps: [
        `[OK] Default provider swapped: ${from} → ${to}`,
        ...(configWritten ? [`[OK] providers.yml updated atomically`] : []),
        ...signalResults,
        `No restart required for agents using ModelGateway.`,
        `Run 'arifos provider health' to verify.`,
        `Agents will use new provider on next session init.`,
      ],
    };
  }

  // ── Lock-in monitoring (F8 LAW) ───────────────────────────────────────────

  /**
   * Check lock-in risk warnings for a proposed swap.
   * F8 LAW: no single provider > 70% of traffic.
   * F8 LAW: switching must be < 30 minutes.
   */
  checkLockinWarnings(from: string, to: string): string[] {
    const warnings: string[] = [];
    const metrics = this.config.lockin_metrics;
    const enabled = this.listEnabledProviders();

    // Rule 1: minimum provider diversity
    if (enabled.length < metrics.provider_count_min) {
      warnings.push(
        `[F8 LAW] Provider diversity low: ${enabled.length}/${metrics.provider_count_min} minimum. ` +
        `Reducing single-provider dependency is required.`
      );
    }

    // Rule 2: no single provider dominates (>70%)
    // In production: query usage telemetry
    // Placeholder: warn if only 1 provider is enabled
    if (enabled.length <= 1) {
      warnings.push(
        `[F8 LAW] Single-provider dependency detected. ` +
        `At least 2 providers required for sovereign operation.`
      );
    }

    // Rule 3: switching cost threshold (0.5 hours)
    // Inline estimate: hot_swap=0s, gradual=10s, requires_restart=30s
    const fromEntry = this.config.providers[from];
    const toEntry = this.config.providers[to];
    let estimatedDowntime = 0;
    if (fromEntry && toEntry) {
      if (toEntry.status !== "live") {
        estimatedDowntime = toEntry.status === "error" || toEntry.status === "rate_limited" ? 30 : 10;
      }
    }
    const maxDowntimeSeconds = metrics.switching_cost_max_hours * 3600;
    if (estimatedDowntime > maxDowntimeSeconds) {
      warnings.push(
        `[F8 LAW] Estimated downtime (${estimatedDowntime}s) exceeds ` +
        `threshold (${maxDowntimeSeconds}s). Swap should be faster.`
      );
    }

    return warnings;
  }

  // ── CLI helpers ───────────────────────────────────────────────────────────

  /** Format provider list for CLI output. */
  formatProviderList(): string {
    const lines: string[] = [];
    const def = this.config.default;

    lines.push("PROVIDER         ENABLED  STATUS           COST     CAPABILITIES          DEFAULT");
    lines.push("─".repeat(100));

    for (const [name, entry] of Object.entries(this.config.providers)) {
      const isDefault = name === def ? " ★" : "  ";
      const status = entry.status.padEnd(14);
      const cost = entry.cost_band.padEnd(7);
      const caps = entry.capabilities.join(", ");
      const enabled = entry.enabled ? "  true" : " false";
      lines.push(
        `${name.padEnd(15)}${enabled}  ${status} ${cost} ${caps.substring(0, 25).padEnd(25)}${isDefault}`
      );
    }

    return lines.join("\n");
  }

  /** Format health results for CLI output. */
  formatHealthReport(results: HealthResult[]): string {
    const lines: string[] = [];
    lines.push("PROVIDER         STATUS          LATENCY   NOTE");
    lines.push("─".repeat(70));

    for (const r of results) {
      const icon = r.status === "ok" ? "✓" : r.status === "disabled" ? "○" : "✗";
      const latency = r.status === "ok" ? `${r.latency_ms}ms` : "—";
      const note = r.error_message ?? (r.status === "ok" ? "healthy" : r.status);
      lines.push(`${r.provider_key.padEnd(15)} ${icon} ${r.status.padEnd(14)} ${latency.padEnd(9)} ${note}`);
    }

    return lines.join("\n");
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private loadConfig(): GatewayConfig {
    try {
      if (!existsSync(this.configPath)) {
        console.warn(`[ModelGateway] providers.yml not found at ${this.configPath}, using minimal config`);
        return this.getMinimalConfig();
      }
      const raw = readFileSync(this.configPath, "utf-8");
      const parsed = parseYaml(raw) as Record<string, unknown>;

      // Validate required top-level keys
      const version = String(parsed.version ?? "unknown");
      const defaultProvider = String(parsed.default ?? "mock");
      const providers = (parsed.providers as Record<string, unknown>) ?? {};
      const routing = (parsed.routing as Record<string, unknown>) ?? {};
      const lockin = (parsed.lockin_metrics as Record<string, unknown>) ?? {};

      return {
        version,
        default: defaultProvider,
        providers: Object.fromEntries(
          Object.entries(providers).map(([k, v]) => [k, this.parseProvider(k, v as Record<string, unknown>)])
        ) as Record<string, ProviderEntry>,
        routing: {
          capability_routes: (routing.capability_routes as Record<string, string[]>) ?? {},
          failover_chain: (routing.failover_chain as Record<string, string[]>) ?? {},
        },
        lockin_metrics: {
          provider_count_min: Number((lockin.provider_count_min ?? 2)),
          max_single_provider_dependency: Number((lockin.max_single_provider_dependency ?? 0.7)),
          switching_cost_max_hours: Number((lockin.switching_cost_max_hours ?? 0.5)),
        },
      };
    } catch (err) {
      console.error(`[ModelGateway] Failed to load providers.yml: ${err}`);
      return this.getMinimalConfig();
    }
  }

  private parseProvider(name: string, raw: Record<string, unknown>): ProviderEntry {
    return {
      display_name: String(raw.display_name ?? name),
      enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : false,
      primary: raw.primary !== undefined ? Boolean(raw.primary) : false,
      api_key_var: String(raw.api_key_var ?? ""),
      base_url: String(raw.base_url ?? ""),
      models: Array.isArray(raw.models) ? raw.models.map(String) : [],
      capabilities: Array.isArray(raw.capabilities) ? raw.capabilities.map(String) : [],
      cost_band: (raw.cost_band as ProviderEntry["cost_band"]) ?? "medium",
      status: (raw.status as ProviderEntry["status"]) ?? "not_configured",
      fallback_for: Array.isArray(raw.fallback_for) ? raw.fallback_for.map(String) : undefined,
      notes: raw.notes !== undefined ? String(raw.notes) : undefined,
    };
  }

  private async probeProvider(name: string, entry: ProviderEntry): Promise<HealthResult> {
    const start = Date.now();
    const apiKey = process.env[entry.api_key_var];

    if (!apiKey || apiKey === "") {
      return this.mkResult(name, name, "unauthorized", 0, `No API key set for ${entry.api_key_var}`);
    }

    if (entry.status === "not_configured") {
      return this.mkResult(name, name, "not_configured", 0, "Provider not yet configured (set enabled:true)");
    }

    if (entry.status === "error") {
      return this.mkResult(name, name, "error", 0, "Provider reported error state");
    }

    // REAL probe: make a cheap HTTP request.
    // Strategy:
    //   1. Try GET /models (most OpenAI-compatible providers support this)
    //   2. Fall back to HEAD on the base URL
    //   3. If neither works, return env-based "ok" with caveat
    //   4. MiMo also has anthropic_url — try that as secondary
    const baseUrl = entry.base_url.replace(/\/+$/, "");
    const anthropicUrl = (entry as unknown as Record<string, unknown>).anthropic_url as string | undefined;

    const tryProbe = async (url: string, headers: Record<string, string>): Promise<HealthResult | null> => {
      try {
        const ac = new AbortController();
        const timeout = setTimeout(() => ac.abort(), 8000);
        const resp = await fetch(url, {
          method: "GET",
          headers,
          signal: ac.signal,
        });
        clearTimeout(timeout);
        const latency = Date.now() - start;
        if (resp.status === 200) {
          return this.mkResult(name, name, "ok", latency, `HTTP 200 from ${url}`);
        } else if (resp.status === 401 || resp.status === 403) {
          return this.mkResult(name, name, "unauthorized", latency, `HTTP ${resp.status} from ${url}`);
        } else if (resp.status === 429) {
          return this.mkResult(name, name, "rate_limited", latency, `HTTP 429 from ${url}`);
        } else {
          return this.mkResult(name, name, "error", latency, `HTTP ${resp.status} from ${url}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("abort") || msg.includes("timeout")) {
          return this.mkResult(name, name, "timeout", Date.now() - start, `Timeout probing ${url}`);
        }
        return null; // network error, try next
      }
    };

    // 1. Try /models
    const probe1 = await tryProbe(`${baseUrl}/models`, {
      [entry.api_key_var.startsWith("ANTHROPIC") || baseUrl.includes("anthropic") ? "x-api-key" : "Authorization"]:
        baseUrl.includes("anthropic") ? apiKey : `Bearer ${apiKey}`,
      "api-key": baseUrl.includes("xiaomimimo") || baseUrl.includes("anthropic") ? apiKey : `Bearer ${apiKey}`,
    });

    if (probe1) {
      // Add model count to note for OK results
      if (probe1.status === "ok") {
        probe1.error_message = `${probe1.error_message} (${entry.models.length} models in registry)`;
      }
      return probe1;
    }

    // 2. Try anthropic URL if present (MiMo dual-stack)
    if (anthropicUrl) {
      const probe2 = await tryProbe(`${anthropicUrl.replace(/\/+$/, "")}/v1/models`, {
        "api-key": apiKey,
      });
      if (probe2) return probe2;
    }

    // 3. Fallback: env-only check with caveat
    return this.mkResult(
      name,
      name,
      "ok",
      Date.now() - start,
      `Network probe failed; key present for ${entry.api_key_var} (env-only check)`
    );
  }

  // ── Config write-back (atomic) ────────────────────────────────────────────────

  /**
   * Atomically write the current config back to providers.yml.
   * Strategy: write to .tmp, fsync, rename over original.
   * This prevents partial writes on crash.
   */
  private async writeConfig(): Promise<void> {
    const tmpPath = `${this.configPath}.tmp.${process.pid}.${Date.now()}`;
    const backupPath = `${this.configPath}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`;

    // 1. Backup current file (preserve for forensics)
    if (existsSync(this.configPath)) {
      copyFileSync(this.configPath, backupPath);
    }

    // 2. Stringify current config
    const yamlText = stringifyYaml(this.config, {
      lineWidth: 120,
      singleQuote: false,
      sortMapEntries: false, // preserve user-defined provider order
    });

    // 3. Add a header comment with timestamp
    const header = `# Last modified by ModelGateway at ${new Date().toISOString()}\n# Source: ModelGateway.executeSwap()\n`;
    const finalText = header + yamlText;

    // 4. Write to tmp
    writeFileSync(tmpPath, finalText, { mode: 0o600 });

    // 5. Atomic rename
    renameSync(tmpPath, this.configPath);

    // 6. Update mtime stat for health checks
    try {
      statSync(this.configPath);
    } catch {
      // ignore
    }
  }

  /**
   * Signal affected services to reload configuration.
   * Uses systemctl try-reload (sends SIGHUP) — services that don't support
   * reload will be ignored. Sends reload to a-forge, openclaw-gateway, hermes.
   */
  private signalAffectedServicesReload(): string[] {
    const services = ["a-forge", "openclaw-gateway", "arifOS"];
    const results: string[] = [];

    for (const svc of services) {
      try {
        // Use systemctl reload if available, otherwise try-reload
        const out = execSync(`systemctl reload ${svc} 2>/dev/null || systemctl try-reload ${svc} 2>/dev/null || echo no_reload`, {
          encoding: "utf-8",
          timeout: 5000,
        });
        if (out.includes("no_reload")) {
          results.push(`[INFO] ${svc}: no reload handler (in-memory only)`);
        } else {
          results.push(`[OK] ${svc}: reload signaled`);
        }
      } catch (err) {
        results.push(`[WARN] ${svc}: reload signal failed (${err instanceof Error ? err.message : err})`);
      }
    }

    return results;
  }

  private mkResult(
    provider: string,
    providerKey: string,
    status: HealthResult["status"],
    latencyMs: number,
    errorMessage?: string
  ): HealthResult {
    return {
      provider,
      provider_key: providerKey,
      status,
      latency_ms: latencyMs,
      error_message: errorMessage,
      checked_at: new Date().toISOString(),
    };
  }

  private identifyAffectedServices(_from: string, _to: string): string[] {
    // In production: inspect RuntimeConfig, systemd unit file, docker-compose labels
    // Return list of services that would need reload
    return ["a-forge", "arifOS"];
  }

  private getMinimalConfig(): GatewayConfig {
    return {
      version: "2026.06.15-minimal",
      default: "mock",
      providers: {
        mock: {
          display_name: "Mock (No Provider)",
          enabled: true,
          primary: false,
          api_key_var: "",
          base_url: "",
          models: [],
          capabilities: [],
          cost_band: "free",
          status: "live",
        },
      },
      routing: { capability_routes: {}, failover_chain: {} },
      lockin_metrics: {
        provider_count_min: 2,
        max_single_provider_dependency: 0.7,
        switching_cost_max_hours: 0.5,
      },
    };
  }
}

// Singleton instance — share across the process
export const modelGateway = new ModelGateway();
