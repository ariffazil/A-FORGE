/**
 * scarLaw.ts — Scar Law implementation
 *
 * "Errors are metabolized into constitutional constraints.
 * Pain = ΔS spike. Learning = cooling." — APEX THEORY Epoch 34Ω
 *
 * A scar is a sealed failure. Future generations with similar
 * fingerprints inherit scar pressure, reducing Φ until the
 * failure pattern is no longer reachable.
 *
 * Phase 1 implementation: file-backed JSON store.
 * Phase 2: VAULT999 + scar_proof chain.
 * Phase 3: Qdrant vector similarity for semantic scar retrieval.
 */

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import type { Scar, SkillDomain } from "./types.js";

const SCAR_DIR = "/root/A-FORGE/.runtime/scars/";
const SCAR_INDEX = "/root/A-FORGE/.runtime/scars/index.json";

let cache: Map<string, Scar> | null = null;

async function ensureLoaded(): Promise<Map<string, Scar>> {
  if (cache) return cache;
  await fs.mkdir(SCAR_DIR, { recursive: true });
  try {
    const data = await fs.readFile(SCAR_INDEX, "utf-8");
    const parsed = JSON.parse(data) as Record<string, Scar>;
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

/**
 * Compute the fingerprint of an intent for scar matching.
 * Same intent + same domain = same scar pressure.
 */
export function fingerprintIntent(intent: string, domain: SkillDomain): string {
  const normalized = intent.toLowerCase().replace(/\s+/g, " ").trim();
  return crypto.createHash("sha256").update(`${domain}::${normalized}`).digest("hex").slice(0, 16);
}

/**
 * Seal a scar.
 *
 * After this, any future generation with the same fingerprint
 * will have its Φ reduced by scar_pressure × severity_multiplier.
 */
export async function sealScar(params: {
  intent: string;
  domain: SkillDomain;
  failure_mode: string;
  severity: Scar["severity"];
  scar_pressure?: number; // default 0.5
}): Promise<Scar> {
  const scars = await ensureLoaded();
  const fingerprint = fingerprintIntent(params.intent, params.domain);

  const scar: Scar = {
    scar_id: `scar_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    fingerprint,
    failure_mode: params.failure_mode,
    severity: params.severity,
    sealed_at: new Date().toISOString(),
    scar_pressure: params.scar_pressure ?? 0.5,
  };

  scars.set(scar.scar_id, scar);
  await persist();
  return scar;
}

/**
 * Consult scars matching an intent.
 *
 * Returns all scars whose fingerprint matches the current intent.
 * These will reduce Φ in the Decision Field.
 */
export async function consultScars(intent: string, domain: SkillDomain): Promise<Scar[]> {
  const scars = await ensureLoaded();
  const fingerprint = fingerprintIntent(intent, domain);
  const matching: Scar[] = [];
  for (const scar of scars.values()) {
    if (scar.fingerprint === fingerprint) {
      matching.push(scar);
    }
  }
  // Sort by sealed_at descending — most recent first
  matching.sort((a, b) => b.sealed_at.localeCompare(a.sealed_at));
  return matching;
}

/**
 * List all sealed scars (read-only).
 */
export async function listScars(): Promise<Scar[]> {
  const scars = await ensureLoaded();
  return Array.from(scars.values()).sort((a, b) => b.sealed_at.localeCompare(a.sealed_at));
}

/**
 * Revoke a scar (admin only — usually never done).
 */
export async function revokeScar(scar_id: string): Promise<boolean> {
  const scars = await ensureLoaded();
  const deleted = scars.delete(scar_id);
  if (deleted) await persist();
  return deleted;
}

/**
 * Clear cache (for tests).
 */
export function _resetCache(): void {
  cache = null;
}