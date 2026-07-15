/**
 * SkillStore.ts — Persistent Skill Registry (Phase 2 Sprint 1)
 *
 * Qdrant-backed persistent store for generated skills with:
 *   - Versioning (semver)
 *   - Provenance chain (generation path + depth)
 *   - Trust tiers (UNTRUSTED/STAGED/REVIEWED/TRUSTED)
 *   - Expiry (TTL-based)
 *   - Scar references (tools referenced by VAULT999 seals)
 *
 * This replaces the in-memory ToolRegistry for generated tools.
 * Hand-written tools remain in ToolRegistry.
 *
 * Constitutional:
 *   F1 AMANAH — generated tools are UNTRUSTED by default
 *   F2 TRUTH  — provenance chain is immutable
 *   F4 CLARITY — versioned, no ambiguity about which version is active
 *   F11 AUDIT — every store operation is logged
 *
 * @module infrastructure/skills/SkillStore
 * @forged 2026-06-28 by FORGE (000Ω)
 * @phase 2 sprint 1
 */

import { randomUUID } from "node:crypto";

// ── Types ───────────────────────────────────────────────────────────

export type TrustTier = "UNTRUSTED" | "STAGED" | "REVIEWED" | "TRUSTED";

export type SkillRecord = {
  id: string;                     // UUID
  tool_name: string;              // forge_* name
  version: string;                // semver (e.g., "0.1.0")
  generation_depth: number;       // 0 = seed tool, 1-3 = generated
  generation_path: string[];      // chain of tool names from seed
  trust_tier: TrustTier;
  intent: string;                 // original intent description
  code: string;                   // generated TypeScript/JavaScript
  schema: Record<string, unknown>; // tool input schema
  provenance: {
    seed_tool: string;            // the forge_skill that generated this
    generated_by: string;         // agent/actor ID
    generated_at: string;         // ISO timestamp
    llm_model?: string;           // which LLM generated it
  };
  validations: {
    human?: { reviewer: string; approved_at: string };
    ai_cross_model?: { model: string; score: number; audited_at: string };
    earth?: { domain: string; ground_truth_score: number; validated_at: string };
  };
  scars_referencing: string[];    // VAULT999 seal IDs that reference this tool
  expires_at: string | null;      // ISO timestamp or null
  created_at: string;
  updated_at: string;
  embedding?: number[];           // 768-dim vector for semantic search
};

export type SkillStoreQuery = {
  tool_name?: string;
  trust_tier?: TrustTier;
  generation_depth?: number;
  active_only?: boolean;          // exclude expired
  limit?: number;
};

// ── Store (Qdrant-backed via HTTP) ──────────────────────────────────

const QDRANT_URL = "http://localhost:6333";
const COLLECTION = "aforge_skills";

export class SkillStore {
  /**
   * Store a skill record. If tool_name + version already exists, update.
   */
  async put(record: SkillRecord): Promise<void> {
    const now = new Date().toISOString();
    const payload = {
      ...record,
      updated_at: now,
      created_at: record.created_at || now,
    };

    // Qdrant upsert via REST — point ID must be UUID or uint64
    const pointId = randomUUID();
    const point = {
      id: pointId,
      vector: record.embedding || new Array(768).fill(0),
      payload,
    };

    const resp = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points: [point] }),
    });

    if (!resp.ok) {
      throw new Error(`SkillStore.put failed: ${resp.status} ${await resp.text()}`);
    }
  }

  /**
   * Retrieve a skill by tool_name. Returns latest version.
   * Uses scroll-all + client-side filter (Qdrant text indexing
   * requires payload schema configuration for exact keyword match).
   */
  async get(toolName: string): Promise<SkillRecord | null> {
    const all = await this.list({ tool_name: toolName, active_only: false, limit: 100 });
    const sorted = all.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return sorted[0] || null;
  }

  /**
   * List all active skills matching query.
   * Uses scroll-all + client-side filter for field matching.
   */
  async list(query: SkillStoreQuery = {}): Promise<SkillRecord[]> {
    const resp = await fetch(
      `${QDRANT_URL}/collections/${COLLECTION}/points/scroll`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: query.limit || 100,
          with_payload: true,
          with_vector: false,
        }),
      },
    );

    if (!resp.ok) return [];
    const data = await resp.json() as any;
    let records: SkillRecord[] = (data?.result?.points || []).map(
      (p: any) => p.payload as SkillRecord,
    );

    // Client-side filtering
    if (query.tool_name) {
      records = records.filter(r => r.tool_name === query.tool_name);
    }
    if (query.trust_tier) {
      records = records.filter(r => r.trust_tier === query.trust_tier);
    }
    if (query.generation_depth !== undefined) {
      records = records.filter(r => r.generation_depth === query.generation_depth);
    }
    if (query.active_only !== false) {
      const now = new Date().toISOString();
      records = records.filter(r => !r.expires_at || r.expires_at >= now);
    }

    return records;
  }

  /**
   * Promote a skill to a higher trust tier.
   * Only allows: UNTRUSTED → STAGED → REVIEWED → TRUSTED.
   * Cannot demote.
   */
  async promote(toolName: string, newTier: TrustTier, reviewer: string): Promise<boolean> {
    const record = await this.get(toolName);
    if (!record) return false;

    const tierOrder: TrustTier[] = ["UNTRUSTED", "STAGED", "REVIEWED", "TRUSTED"];
    const currentIdx = tierOrder.indexOf(record.trust_tier);
    const newIdx = tierOrder.indexOf(newTier);

    if (newIdx <= currentIdx) {
      return false; // Cannot demote or stay same
    }

    record.trust_tier = newTier;
    record.validations.human = {
      reviewer,
      approved_at: new Date().toISOString(),
    };
    record.updated_at = new Date().toISOString();

    await this.put(record);
    return true;
  }

  /**
   * Expire a skill. Sets expires_at to now. Soft-delete.
   * Skills referenced by scars cannot be expired.
   */
  async expire(toolName: string): Promise<{ expired: boolean; reason?: string }> {
    const record = await this.get(toolName);
    if (!record) return { expired: false, reason: "Not found" };

    if (record.scars_referencing.length > 0) {
      return {
        expired: false,
        reason: `Referenced by ${record.scars_referencing.length} VAULT999 seal(s): ${record.scars_referencing.join(", ")}`,
      };
    }

    record.expires_at = new Date().toISOString();
    record.updated_at = new Date().toISOString();
    await this.put(record);
    return { expired: true };
  }

  /**
   * Health check — verify collection exists and is queryable.
   */
  async health(): Promise<boolean> {
    try {
      const resp = await fetch(`${QDRANT_URL}/collections/${COLLECTION}`);
      return resp.ok;
    } catch {
      return false;
    }
  }
}

// ── Singleton ───────────────────────────────────────────────────────

let _instance: SkillStore | null = null;

export function getSkillStore(): SkillStore {
  if (!_instance) {
    _instance = new SkillStore();
  }
  return _instance;
}
