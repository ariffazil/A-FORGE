/**
 * CoolingGate.ts — SABAR Cooldown Protocol (Machine Layer)
 * ═══════════════════════════════════════════════════
 *
 * Internal hardening module for A-FORGE. No new MCP tools.
 * No "phoenix" in any export or log message.
 *
 * The machine-side SABAR cooldown protocol:
 *   - Every build artifact enters cooling band before permanent registry
 *   - Resource budget (disk/memory/compute) tracked per entry
 *   - Budget exhaustion → forced VOID
 *   - 72h default window (configurable per risk tier)
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { aaaMemoryGate } from "../aaa/AaaMemoryLinkage.js";

// ═══════════════════════════════════════════════════════════
// Persistence
// ═══════════════════════════════════════════════════════════

function getCoolingStatePath(): string {
  return process.env.COOLING_STATE_PATH ?? "/root/AAA/registries/cooling_state.json";
}

const AUTONOMOUS_KERNEL_SESSION = "SEAL-c001c0ffeec001d0";

// ═══════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════

const COOLDOWN_DEFAULT_HOURS = 72;
const COOLDOWN_MIN_HOURS = 24;
const COOLDOWN_MAX_HOURS = 720; // 30 days

const RISK_TIER_HOURS: Record<string, number> = {
  low: 24,
  medium: 72,
  high: 168,
  critical: 720,
};

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export type RiskTier = "low" | "medium" | "high" | "critical";
export type CoolingVerdict = "SABAR" | "SEAL" | "VOID";
export type WitnessType = "human" | "ai_audit" | "reality_check";

export interface TriWitness {
  human: boolean;
  ai_audit: boolean;
  reality_check: boolean;
}

export interface SabarResourceBudget {
  disk_bytes_allocated: number;
  disk_bytes_peak: number;
  compute_seconds: number;
  memory_mb_seconds: number;
  token_count: number;
  disk_limit_bytes: number;
  compute_limit_seconds: number;
  memory_limit_mb_seconds: number;
  token_limit: number;
}

export interface CoolingEntry {
  entry_id: string;
  artifact_ref: string | null;
  description: string;
  risk_tier: RiskTier;
  proposed_at: string; // ISO 8601
  cooldown_expiry: string; // ISO 8601
  cooldown_hours: number;
  verdict: CoolingVerdict;
  tri_witness: TriWitness;
  resource_budget: SabarResourceBudget;
  sealed_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
}

export interface CoolingVitals {
  active_count: number;
  sealed_count: number;
  voided_count: number;
  total_entries: number;
  oldest_remaining_hours: number | null;
  budget_exhausted_any: boolean;
  active_entries: Array<{
    entry_id: string;
    description: string;
    remaining_hours: number;
    witness_count: number;
    risk_tier: string;
    verdict: string;
  }>;
}

export interface DeployGateResult {
  allowed: boolean;
  verdict: CoolingVerdict;
  reason: string;
  remaining_hours: number | null;
  cooldown_entry_id: string | null;
}

// ═══════════════════════════════════════════════════════════
// Default Budgets
// ═══════════════════════════════════════════════════════════

function defaultBudget(): SabarResourceBudget {
  return {
    disk_bytes_allocated: 0,
    disk_bytes_peak: 0,
    compute_seconds: 0,
    memory_mb_seconds: 0,
    token_count: 0,
    disk_limit_bytes: 50_000_000_000, // 50 GB
    compute_limit_seconds: 3_600, // 1 hour
    memory_limit_mb_seconds: 1_000_000, // ~16GB * 60s
    token_limit: 1_000_000,
  };
}

// ═══════════════════════════════════════════════════════════
// CoolingGate
// ═══════════════════════════════════════════════════════════

export class CoolingGate {
  private entries: Map<string, CoolingEntry> = new Map();
  private sealedCount = 0;
  private voidedCount = 0;
  private persistenceLoaded = false;

  // ── Persistence ──────────────────────────────────────────────────

  private async ensureLoaded(): Promise<void> {
    if (this.persistenceLoaded) return;
    try {
      const raw = await readFile(getCoolingStatePath(), "utf8");
      this.loadFromJson(raw);
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") console.error("[CoolingGate] Load failed:", err);
    }
    this.persistenceLoaded = true;
  }

  private ensureLoadedSync(): void {
    if (this.persistenceLoaded) return;
    try {
      const raw = readFileSync(getCoolingStatePath(), "utf8");
      this.loadFromJson(raw);
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") console.error("[CoolingGate] Sync load failed:", err);
    }
    this.persistenceLoaded = true;
  }

  private loadFromJson(raw: string): void {
    const data = JSON.parse(raw);
    this.entries.clear();
    for (const e of data.entries ?? []) {
      this.entries.set(e.entry_id, e as CoolingEntry);
    }
    this.sealedCount = data.sealedCount ?? 0;
    this.voidedCount = data.voidedCount ?? 0;
  }

  private async persist(): Promise<void> {
    const statePath = getCoolingStatePath();
    try {
      await mkdir(dirname(statePath), { recursive: true });
      const data = {
        entries: [...this.entries.values()],
        sealedCount: this.sealedCount,
        voidedCount: this.voidedCount,
        persistedAt: new Date().toISOString(),
      };
      await writeFile(statePath, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      // Non-fatal in CI/test — persistence path may not exist
      if (process.env.CI || process.env.FORGE_TEST_MODE) return;
      throw err;
    }
  }

  // ── Core Operations ──

  async propose(opts: {
    artifact_ref?: string;
    description?: string;
    risk_tier?: RiskTier;
    cooldown_hours?: number;
  }): Promise<CoolingEntry> {
    await this.ensureLoaded();
    const now = new Date();
    const tier: RiskTier = opts.risk_tier ?? "medium";
    const hours =
      opts.cooldown_hours ??
      RISK_TIER_HOURS[tier] ??
      COOLDOWN_DEFAULT_HOURS;
    const clampedHours = Math.max(
      COOLDOWN_MIN_HOURS,
      Math.min(hours, COOLDOWN_MAX_HOURS),
    );
    const expiry = new Date(now.getTime() + clampedHours * 3600_000);

    const entry: CoolingEntry = {
      entry_id: randomUUID().slice(0, 12),
      artifact_ref: opts.artifact_ref ?? null,
      description: opts.description ?? "",
      risk_tier: tier,
      proposed_at: now.toISOString(),
      cooldown_expiry: expiry.toISOString(),
      cooldown_hours: clampedHours,
      verdict: "SABAR",
      tri_witness: { human: false, ai_audit: false, reality_check: false },
      resource_budget: defaultBudget(),
      sealed_at: null,
      voided_at: null,
      void_reason: null,
    };

    this.entries.set(entry.entry_id, entry);

    // AAA Gate: cooling entry = governed memory write → 555-ASI
    try {
      const gate = await aaaMemoryGate({
        action: "memory:write",
        actorId: "a-forge::cooling-gate",
        sessionId: AUTONOMOUS_KERNEL_SESSION,
        content: entry.description,
        memoryId: entry.entry_id,
        toolName: "CoolingGate.propose",
        description: `Propose cooling entry: ${entry.description.slice(0, 80)}`,
      });
      if (!gate.allowed) {
        console.error(`[AAA-MEM] CoolingGate.propose blocked: ${gate.reason}`);
      }
    } catch (e) {
      console.error("[CoolingGate] AAA gate failed (non-blocking):", e);
    }

    await this.persist();
    return entry;
  }

  async check(entry_id: string): Promise<CoolingEntry | null> {
    await this.ensureLoaded();
    const entry = this.entries.get(entry_id);
    if (!entry) return null;
    if (entry.verdict === "SEAL" || entry.verdict === "VOID") return entry;

    // Auto-VOID on expiry
    if (this.isExpired(entry)) {
      await this.void(entry, "cooldown expired (auto-VOID)");
      return entry;
    }

    // Auto-VOID on budget exhaustion
    if (this.isBudgetExhausted(entry)) {
      await this.void(entry, "resource budget exhausted");
      return entry;
    }

    return entry;
  }

  witness(entry_id: string, type: WitnessType, value = true): boolean {
    const entry = this.entries.get(entry_id);
    if (!entry) return false;
    if (entry.verdict !== "SABAR") return false;

    entry.tri_witness[type] = value;
    return true;
  }

  async seal(entry_id: string): Promise<{ ok: boolean; reason: string }> {
    await this.ensureLoaded();

    const entry = this.entries.get(entry_id);
    if (!entry) return { ok: false, reason: "entry not found" };
    if (entry.verdict !== "SABAR")
      return { ok: false, reason: `already resolved: ${entry.verdict}` };

    // AAA Gate: seal = memory:seal, requires A-ARCHIVE + F13 approval
    try {
      const gate = await aaaMemoryGate({
        action: "memory:seal",
        actorId: "a-forge::cooling-gate",
        sessionId: AUTONOMOUS_KERNEL_SESSION,
        memoryId: entry_id,
        content: entry.description,
        toolName: "CoolingGate.seal",
        description: `Seal cooling entry: ${entry.description.slice(0, 80)}`,
      });
      if (!gate.allowed) {
        return { ok: false, reason: `AAA gate: ${gate.reason}` };
      }
    } catch (e) {
      return { ok: false, reason: `AAA gate error: ${e instanceof Error ? e.message : String(e)}` };
    }

    // Run check first (auto-VOID on expiry/budget)
    const checked = await this.check(entry_id);
    if (!checked) return { ok: false, reason: "entry vanished" };
    if (checked.verdict !== "SABAR")
      return { ok: false, reason: `auto-resolved: ${checked.verdict}` };

    if (this.isExpired(entry))
      return { ok: false, reason: "cooldown expired" };

    const { human, ai_audit, reality_check } = entry.tri_witness;
    const count = [human, ai_audit, reality_check].filter(Boolean).length;
    if (count < 3)
      return { ok: false, reason: `tri-witness incomplete (${count}/3)` };

    if (this.isBudgetExhausted(entry))
      return { ok: false, reason: "resource budget exhausted" };

    entry.verdict = "SEAL";
    entry.sealed_at = new Date().toISOString();
    this.sealedCount++;
    await this.persist();

    // P1-5d: Forward cooling seal receipt to arifFLOW — fire-and-forget
    setImmediate(() => {
      this._forwardToArifFlow({ action: "seal", entry_id, description: entry.description, risk_tier: entry.risk_tier }).catch(() => {});
    });

    return { ok: true, reason: "sealed" };
  }

  async resolve(entry_id: string): Promise<CoolingEntry | null> {
    const entry = this.entries.get(entry_id);
    if (!entry) return null;
    if (entry.verdict !== "SABAR") return entry;

    const result = await this.seal(entry_id);
    if (!result.ok) {
      await this.void(entry, `resolve failed: ${result.reason}`);
    }
    return entry;
  }

  // ── Deploy Gate ──

  async deployGate(artifact_ref: string): Promise<DeployGateResult> {
    // Find any active cooldown entries for this artifact
    for (const entry of this.entries.values()) {
      if (entry.artifact_ref === artifact_ref && entry.verdict === "SABAR") {
        return {
          allowed: false,
          verdict: "SABAR",
          reason: `artifact in SABAR cooldown — ${this.remainingHours(entry).toFixed(1)}h remaining`,
          remaining_hours: this.remainingHours(entry),
          cooldown_entry_id: entry.entry_id,
        };
      }
    }

    // Auto-register if not found — enters cooling band
    const entry = await this.propose({
      artifact_ref,
      description: `auto-registered deploy: ${artifact_ref}`,
      risk_tier: "medium",
    });

    return {
      allowed: true,
      verdict: "SABAR",
      reason: `registered in SABAR cooldown band (${entry.cooldown_hours}h) — deploy allowed but tracked`,
      remaining_hours: entry.cooldown_hours,
      cooldown_entry_id: entry.entry_id,
    };
  }

  // ── Housekeeping ──

  async expireAll(): Promise<number> {
    let count = 0;
    for (const entry of this.entries.values()) {
      if (entry.verdict === "SABAR" && this.isExpired(entry)) {
        await this.void(entry, "batch expiry");
        count++;
      }
    }
    return count;
  }

  pruneVoided(): number {
    let count = 0;
    for (const [id, entry] of this.entries) {
      if (entry.verdict === "VOID") {
        this.entries.delete(id);
        count++;
      }
    }
    return count;
  }

  // ── Queries ──

  vitals(): CoolingVitals {
    this.ensureLoadedSync();
    const active = [...this.entries.values()].filter(
      (e) => e.verdict === "SABAR",
    );
    const remaining = active.map((e) => this.remainingHours(e));
    const oldest =
      remaining.length > 0 ? Math.min(...remaining) : null;

    return {
      active_count: active.length,
      sealed_count: this.sealedCount,
      voided_count: this.voidedCount,
      total_entries: this.entries.size,
      oldest_remaining_hours: oldest !== null ? Math.round(oldest * 10) / 10 : null,
      budget_exhausted_any: active.some((e) => this.isBudgetExhausted(e)),
      active_entries: active.slice(0, 10).map((e) => ({
        entry_id: e.entry_id,
        description: e.description.slice(0, 60),
        remaining_hours: Math.round(this.remainingHours(e) * 10) / 10,
        witness_count: [e.tri_witness.human, e.tri_witness.ai_audit, e.tri_witness.reality_check].filter(Boolean).length,
        risk_tier: e.risk_tier,
        verdict: e.verdict,
      })),
    };
  }

  getEntry(entry_id: string): CoolingEntry | undefined {
    this.ensureLoadedSync();
    return this.entries.get(entry_id);
  }

  // ── Internal ──

  /**
   * P1-5d: Forward cooling receipt to arifFLOW :7073/receipt/emit.
   * Fire-and-forget — failure is silent, local persist + AAA gate are primary.
   * DEPRECATED P1-7: will be replaced by arifFLOW client import post-extraction.
   */
  private async _forwardToArifFlow(opts: {
    action: string;
    entry_id: string;
    description: string;
    risk_tier: string;
  }): Promise<void> {
    try {
      await fetch("http://127.0.0.1:7073/receipt/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organ: "A-FORGE",
          producer: "CoolingGate",
          action: `cooling:${opts.action}`,
          scope: `entry:${opts.entry_id}`,
          risk: opts.risk_tier === "critical" || opts.risk_tier === "high"
            ? "CONSEQUENTIAL" : "OPERATIONAL",
          epistemic_label: "OBS",
          confidence: 0.85,
          verdict: opts.action === "seal" ? "SEAL" : "SABAR",
          metadata: {
            entry_id: opts.entry_id,
            description: opts.description.slice(0, 100),
            risk_tier: opts.risk_tier,
          },
        }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // arifFLOW unreachable — local persistence + AAA gate are primary
    }
  }

  private async void(entry: CoolingEntry, reason: string): Promise<void> {
    entry.verdict = "VOID";
    entry.voided_at = new Date().toISOString();
    entry.void_reason = reason;
    this.voidedCount++;
    await this.persist().catch(e => console.error("[CoolingGate] Persist after void failed:", e));
  }

  private isExpired(entry: CoolingEntry): boolean {
    return new Date() > new Date(entry.cooldown_expiry);
  }

  private isBudgetExhausted(entry: CoolingEntry): boolean {
    const b = entry.resource_budget;
    return (
      b.disk_bytes_allocated > b.disk_limit_bytes ||
      b.compute_seconds > b.compute_limit_seconds ||
      b.memory_mb_seconds > b.memory_limit_mb_seconds ||
      b.token_count > b.token_limit
    );
  }

  private remainingHours(entry: CoolingEntry): number {
    const expiry = new Date(entry.cooldown_expiry).getTime();
    const now = Date.now();
    return Math.max(0, (expiry - now) / 3600_000);
  }
}

// ═══════════════════════════════════════════════════════════
// Module-level singleton
// ═══════════════════════════════════════════════════════════

let _instance: CoolingGate | null = null;

export function getCoolingGate(): CoolingGate {
  if (!_instance) {
    _instance = new CoolingGate();
  }
  return _instance;
}

export function resetCoolingGate(): void {
  _instance = null;
}
