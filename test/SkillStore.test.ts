/**
 * SkillStore.test.ts — Persistent Skill Store Integration Tests
 * Sprint 1 Phase 2: Qdrant-backed skill persistence
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SkillStore, getSkillStore, type SkillRecord, type TrustTier } from "../src/infrastructure/skills/SkillStore.js";

const TEST_TOOL = "forge_test_integration_store";
const store = getSkillStore();

describe("SkillStore — Qdrant Persistent Skill Registry", () => {
  before(async () => {
    const healthy = await store.health();
    if (!healthy) {
      console.warn("[SKILLSTORE] Qdrant not reachable — skipping integration tests");
    }
  });

  after(async () => {
    // Cleanup test data
    try { await store.expire(TEST_TOOL); } catch {}
  });

  it("health check → Qdrant collection exists", async () => {
    const h = await store.health();
    console.log(`[HEALTH] Qdrant aforge_skills: ${h ? "OK" : "DOWN"}`);
    assert.equal(h, true, "Qdrant aforge_skills collection must be accessible");
  });

  it("put + get → roundtrip works", async () => {
    const record: SkillRecord = {
      id: randomUUID(),
      tool_name: TEST_TOOL,
      version: "0.1.0",
      generation_depth: 1,
      generation_path: ["forge_skill", TEST_TOOL],
      trust_tier: "STAGED",
      intent: "Test skill for persistence verification",
      code: "export const handler = () => 'test';",
      schema: { type: "object", properties: {} },
      provenance: {
        seed_tool: "forge_skill",
        generated_by: "FORGE-000Omega",
        generated_at: new Date().toISOString(),
        llm_model: "MiniMax-M2.7",
      },
      validations: {},
      scars_referencing: [],
      expires_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await store.put(record);
    const retrieved = await store.get(TEST_TOOL);

    assert.ok(retrieved, "Must retrieve stored skill");
    assert.equal(retrieved!.tool_name, TEST_TOOL);
    assert.equal(retrieved!.version, "0.1.0");
    assert.equal(retrieved!.trust_tier, "STAGED");
    assert.equal(retrieved!.generation_depth, 1);
    console.log(`[PUT+GET] ${TEST_TOOL} v${retrieved!.version} tier=${retrieved!.trust_tier}`);
  });

  it("promote → trust tier advances STAGED → REVIEWED", async () => {
    const promoted = await store.promote(TEST_TOOL, "REVIEWED", "Arif");
    assert.equal(promoted, true, "Promotion must succeed");

    const retrieved = await store.get(TEST_TOOL);
    assert.equal(retrieved!.trust_tier, "REVIEWED");
    assert.equal(retrieved!.validations.human?.reviewer, "Arif");
    console.log(`[PROMOTE] ${TEST_TOOL} → REVIEWED by Arif`);
  });

  it("promote → cannot demote", async () => {
    const demoted = await store.promote(TEST_TOOL, "STAGED", "Attacker");
    assert.equal(demoted, false, "Demotion must be rejected");
    console.log(`[DEMOTE] Attempted demotion correctly rejected`);
  });

  it("list → filter by trust tier", async () => {
    const all = await store.list({ limit: 50 });
    const reviewed = await store.list({ trust_tier: "REVIEWED", limit: 50 });

    assert.ok(all.length > 0, "Must have at least 1 skill stored");
    assert.ok(reviewed.length > 0, "Must find REVIEWED skills");
    console.log(`[LIST] total=${all.length} reviewed=${reviewed.length}`);
  });

  it("expire → sets expires_at, can still retrieve", async () => {
    // Create a fresh record to expire
    const expiringRecord: SkillRecord = {
      id: randomUUID(),
      tool_name: "forge_test_expire",
      version: "0.1.0",
      generation_depth: 1,
      generation_path: ["forge_skill"],
      trust_tier: "STAGED",
      intent: "Test skill for expiry",
      code: "export const x = 1;",
      schema: {},
      provenance: {
        seed_tool: "forge_skill",
        generated_by: "FORGE",
        generated_at: new Date().toISOString(),
      },
      validations: {},
      scars_referencing: [],
      expires_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await store.put(expiringRecord);
    const result = await store.expire("forge_test_expire");
    assert.equal(result.expired, true);

    const retrieved = await store.get("forge_test_expire");
    assert.ok(retrieved!.expires_at, "Must have expires_at set");
    console.log(`[EXPIRE] forge_test_expire expires_at=${retrieved!.expires_at}`);
  });
});
