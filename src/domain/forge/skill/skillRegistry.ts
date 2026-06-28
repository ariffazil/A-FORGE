/**
 * skillRegistry.ts — Dynamic tool registry with Θ tracker
 *
 * Phase 1: in-memory + JSON file persistence + Θ (theta) trajectory
 *
 * Θ = dΦ/dt — wisdom trajectory
 * Per APEX THEORY: APEX PRIME judges snapshots.
 * With Θ, it judges trajectories.
 */

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import { computeTheta } from "./decisionField.js";
import type { ForgeRegistryQuery, SkillManifest, SkillStatus, WisdomTrajectory } from "./types.js";

const REGISTRY_DIR = "/root/A-FORGE/.runtime/skills/";
const REGISTRY_PATH = `${REGISTRY_DIR}registry.json`;
const SAMPLES_DIR = `${REGISTRY_DIR}theta_samples/`;

let cache: Map<string, SkillManifest> | null = null;

async function ensureLoaded(): Promise<Map<string, SkillManifest>> {
  if (cache) return cache;
  await fs.mkdir(REGISTRY_DIR, { recursive: true });
  await fs.mkdir(SAMPLES_DIR, { recursive: true });
  try {
    const data = await fs.readFile(REGISTRY_PATH, "utf-8");
    const parsed = JSON.parse(data) as Record<string, SkillManifest>;
    cache = new Map(Object.entries(parsed));
  } catch {
    cache = new Map();
  }
  await pruneExpired();
  return cache;
}

async function pruneExpired(): Promise<void> {
  if (!cache) return;
  const now = Date.now();
  let pruned = 0;
  for (const [name, manifest] of cache.entries()) {
    if (new Date(manifest.expires_at).getTime() < now && manifest.status === "REGISTERED") {
      manifest.status = "EXPIRED";
      pruned++;
    }
  }
  if (pruned > 0) await persist();
}

async function persist(): Promise<void> {
  if (!cache) return;
  await fs.mkdir(REGISTRY_DIR, { recursive: true });
  const obj = Object.fromEntries(cache);
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(obj, null, 2));
}

const PROTECTED_NAMES = new Set([
  "forge_skill",
  "forge_execute",
  "forge_registry",
  "forge_probe",
  "forge_judge",
  "forge_approve",
  "forge_vault",
  "forge_seal",
  "forge_status",
  "forge_abort",
  "forge_scan",
  "arif_judge",
  "arif_seal",
  "arif_init",
]);

export class SkillRegistry {
  private skills: Map<string, SkillManifest> | null = null;

  private async getMap(): Promise<Map<string, SkillManifest>> {
    if (!this.skills) await this.load();
    return this.skills!;
  }

  async load(): Promise<void> {
    this.skills = await ensureLoaded();
  }

  async register(manifest: SkillManifest): Promise<{ accepted: boolean; reason?: string }> {
    const map = await this.getMap();
    if (PROTECTED_NAMES.has(manifest.tool_name)) {
      return { accepted: false, reason: `Cannot forge protected meta-tool: ${manifest.tool_name}` };
    }
    if (map.has(manifest.tool_name)) {
      return { accepted: false, reason: `Tool name already registered: ${manifest.tool_name}` };
    }
    map.set(manifest.tool_name, manifest);
    await persist();
    return { accepted: true };
  }

  async update(manifest: SkillManifest): Promise<void> {
    const map = await this.getMap();
    map.set(manifest.tool_name, manifest);
    await persist();
  }

  async revoke(tool_name: string): Promise<boolean> {
    const map = await this.getMap();
    const m = map.get(tool_name);
    if (!m) return false;
    m.status = "REVOKED";
    await persist();
    return true;
  }

  async recordExecution(tool_name: string): Promise<void> {
    const map = await this.getMap();
    const m = map.get(tool_name);
    if (!m) return;
    m.execution_count++;
    m.last_executed_at = new Date().toISOString();
    // Record Φ sample for Θ tracking
    await this.recordPhiSample(tool_name, m.decision_field.Phi, m.scar_pressure_applied);
    await persist();
  }

  private async recordPhiSample(tool_name: string, phi: number, scar_pressure: number): Promise<void> {
    const samplePath = `${SAMPLES_DIR}${tool_name}.jsonl`;
    const line = JSON.stringify({ timestamp: new Date().toISOString(), phi, scar_pressure }) + "\n";
    await fs.appendFile(samplePath, line);
  }

  async query(q: ForgeRegistryQuery = {}): Promise<{
    total: number;
    tools: Array<SkillManifest & { theta?: WisdomTrajectory["theta"]; theta_verdict?: WisdomTrajectory["theta_verdict"] }>;
  }> {
    const map = await this.getMap();
    let items = Array.from(map.values());
    if (q.domain) items = items.filter(m => m.domain === q.domain);
    if (q.status) items = items.filter(m => m.status === q.status);

    const tools = await Promise.all(
      items.map(async m => {
        if (!q.include_theta) return m;
        const traj = await this.getTheta(m.tool_name);
        return { ...m, theta: traj.theta, theta_verdict: traj.theta_verdict };
      }),
    );

    return { total: tools.length, tools };
  }

  async getTheta(tool_name: string): Promise<WisdomTrajectory> {
    const samplePath = `${SAMPLES_DIR}${tool_name}.jsonl`;
    const samples: Array<{ timestamp: string; phi: number; scar_pressure: number }> = [];
    try {
      const data = await fs.readFile(samplePath, "utf-8");
      for (const line of data.split("\n")) {
        if (!line.trim()) continue;
        try {
          samples.push(JSON.parse(line));
        } catch {
          // skip malformed
        }
      }
    } catch {
      // no samples yet
    }
    const { theta, verdict } = computeTheta(samples);
    return { tool_name, samples, theta, theta_verdict: verdict };
  }

  async fingerprint(): Promise<string> {
    const map = await this.getMap();
    const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    const data = sorted.map(([name, m]) => `${name}:${m.fingerprint}:${m.status}`).join("\n");
    return crypto.createHash("sha256").update(data).digest("hex").slice(0, 16);
  }
}

let _instance: SkillRegistry | null = null;

export function getSkillRegistry(): SkillRegistry {
  if (!_instance) _instance = new SkillRegistry();
  return _instance;
}

export function _resetCache(): void {
  _instance = null;
  cache = null;
}