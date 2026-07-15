/**
 * scar.ts — forge.scar: Standalone Scar Sealing
 *
 * Wraps scarLaw.ts internals for standalone MCP use.
 *
 * Modes:
 *   seal — record a failure as a permanent constitutional constraint
 *   list — enumerate all sealed scars
 *   consult — check if a candidate fingerprint has matching scars
 *   revoke — remove a scar (requires 888_HOLD)
 *
 * Per Scar Law (APEX Epoch 34Ω):
 *   "Errors are metabolized into constitutional constraints.
 *    Pain = ΔS spike. Learning = cooling."
 *
 * Analogy to elastic weight consolidation (Kirkpatrick et al., 2017):
 *   "Freeze" hard-won constraints against being overwritten.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 * @constitutional F1 AMANAH — scars are immutable once sealed
 * @constitutional F11 AUDIT — every scar leaves a trace
 */

import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import type { ScarRecord, GovernedDomain } from "../../contracts/types.js";

const SCAR_DIR = "/root/A-FORGE/.runtime/scars/";
const SCAR_INDEX = "/root/A-FORGE/.runtime/scars/index.json";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — SCAR STORAGE (file-backed, Phase 1)
// ═══════════════════════════════════════════════════════════════════════════════

let cache: Map<string, ScarRecord> | null = null;

async function ensureLoaded(): Promise<Map<string, ScarRecord>> {
  if (cache) return cache;
  await fs.mkdir(SCAR_DIR, { recursive: true });
  try {
    const data = await fs.readFile(SCAR_INDEX, "utf-8");
    const parsed = JSON.parse(data) as Record<string, ScarRecord>;
    cache = new Map(Object.entries(parsed));
  } catch {
    cache = new Map();
  }
  return cache;
}

async function persist(): Promise<void> {
  if (!cache) return;
  await fs.mkdir(SCAR_DIR, { recursive: true });
  const obj = Object.fromEntries(cache);
  await fs.writeFile(SCAR_INDEX, JSON.stringify(obj, null, 2));
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — SCAR OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Seal a failure as a permanent scar.
 */
export async function sealFailure(params: {
  failure_mode: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  scar_pressure: number;
  domain: GovernedDomain;
  detection_method: string;
  constraint_imposed: string;
  sealed_by: string;
}): Promise<ScarRecord> {
  const scars = await ensureLoaded();

  const fingerprint = crypto
    .createHash("sha256")
    .update(`${params.domain}::${params.failure_mode}`)
    .digest("hex")
    .slice(0, 16);

  const now = new Date().toISOString();
  const scar: ScarRecord = {
    scar_id: `scar_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    fingerprint,
    failure_mode: params.failure_mode,
    detection_method: params.detection_method,
    severity: params.severity,
    scar_pressure: params.scar_pressure,
    domain: params.domain,
    constraint_imposed: params.constraint_imposed,
    occurred_at: now,
    sealed_at: now,
    sealed_by: params.sealed_by,
  };

  scars.set(scar.scar_id, scar);
  await persist();

  return scar;
}

/**
 * List all sealed scars, optionally filtered by domain.
 */
export async function listFailures(domain?: GovernedDomain): Promise<ScarRecord[]> {
  const scars = await ensureLoaded();
  const all = Array.from(scars.values());
  if (!domain) return all;
  return all.filter(s => s.domain === domain);
}

/**
 * Consult scars for a given fingerprint.
 * Returns total scar_pressure and count of matching scars.
 */
export async function consultFailurePressure(
  fingerprint: string,
  domain?: GovernedDomain,
): Promise<{ scarPressure: number; count: number; matchingScars: ScarRecord[] }> {
  const scars = await ensureLoaded();
  const matching: ScarRecord[] = [];

  for (const scar of scars.values()) {
    // Match by fingerprint (exact) or by domain (if provided)
    if (scar.fingerprint === fingerprint) {
      matching.push(scar);
    }
  }

  if (domain) {
    // Also add domain-level scars as softer pressure
    for (const scar of scars.values()) {
      if (scar.domain === domain && !matching.includes(scar)) {
        matching.push(scar);
      }
    }
  }

  // Severity multiplier for scar pressure
  const severityMultiplier: Record<string, number> = {
    CRITICAL: 1.0,
    HIGH: 0.7,
    MEDIUM: 0.4,
    LOW: 0.1,
  };

  const totalPressure = matching.reduce(
    (sum, s) => sum + s.scar_pressure * (severityMultiplier[s.severity] ?? 0.5),
    0,
  );

  return {
    scarPressure: Math.min(1, totalPressure),
    count: matching.length,
    matchingScars: matching,
  };
}

/**
 * Revoke a scar (requires 888_HOLD — non-reversible).
 * Phase 1: soft-delete by marking revoked.
 */
export async function revokeFailure(scar_id: string, revoked_by: string): Promise<{ success: boolean; scar?: ScarRecord }> {
  const scars = await ensureLoaded();
  const scar = scars.get(scar_id);
  if (!scar) return { success: false };

  // Soft-delete: mark as revoked but keep in store
  scar.scar_pressure = 0;
  scar.constraint_imposed += ` [REVOKED by ${revoked_by} at ${new Date().toISOString()}]`;
  scars.set(scar_id, scar);
  await persist();

  return { success: true, scar };
}
