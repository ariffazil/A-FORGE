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

  // ── Core Operations ──

  propose(opts: {
    artifact_ref?: string;
    description?: string;
    risk_tier?: RiskTier;
    cooldown_hours?: number;
  }): CoolingEntry {
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
    return entry;
  }

  check(entry_id: string): CoolingEntry | null {
    const entry = this.entries.get(entry_id);
    if (!entry) return null;
    if (entry.verdict === "SEAL" || entry.verdict === "VOID") return entry;

    // Auto-VOID on expiry
    if (this.isExpired(entry)) {
      this.void(entry, "cooldown expired (auto-VOID)");
      return entry;
    }

    // Auto-VOID on budget exhaustion
    if (this.isBudgetExhausted(entry)) {
      this.void(entry, "resource budget exhausted");
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

  seal(entry_id: string): { ok: boolean; reason: string } {
    const entry = this.entries.get(entry_id);
    if (!entry) return { ok: false, reason: "entry not found" };
    if (entry.verdict !== "SABAR")
      return { ok: false, reason: `already resolved: ${entry.verdict}` };

    // Run check first (auto-VOID on expiry/budget)
    const checked = this.check(entry_id);
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
    return { ok: true, reason: "sealed" };
  }

  resolve(entry_id: string): CoolingEntry | null {
    const entry = this.entries.get(entry_id);
    if (!entry) return null;
    if (entry.verdict !== "SABAR") return entry;

    const result = this.seal(entry_id);
    if (!result.ok) {
      this.void(entry, `resolve failed: ${result.reason}`);
    }
    return entry;
  }

  // ── Deploy Gate ──

  deployGate(artifact_ref: string): DeployGateResult {
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
    const entry = this.propose({
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

  expireAll(): number {
    let count = 0;
    for (const entry of this.entries.values()) {
      if (entry.verdict === "SABAR" && this.isExpired(entry)) {
        this.void(entry, "batch expiry");
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
    return this.entries.get(entry_id);
  }

  // ── Internal ──

  private void(entry: CoolingEntry, reason: string): void {
    entry.verdict = "VOID";
    entry.voided_at = new Date().toISOString();
    entry.void_reason = reason;
    this.voidedCount++;
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
