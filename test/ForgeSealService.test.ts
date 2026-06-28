/**
 * ForgeSealService.test.ts — VAULT999 Skill Binding (Sprint 4)
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { ForgeSealService, getForgeSealService } from "../src/domain/governance/ForgeSealService.js";
import { getSkillStore } from "../src/infrastructure/skills/SkillStore.js";
import { getTriWitnessValidator } from "../src/domain/governance/TriWitnessValidator.js";
import type { SkillRecord } from "../src/infrastructure/skills/SkillStore.js";
import { randomUUID } from "node:crypto";

const sealer = getForgeSealService();
const store = getSkillStore();
const validator = getTriWitnessValidator();

const TEST_SKILL = "forge_seal_test_skill";
const CLEAN_CODE = `
export const handler = async (args: any) => {
  return { Vsh: (args.GR - args.GR_min) / (args.GR_max - args.GR_min) };
};
`;

async function createReviewableSkill(): Promise<void> {
  const record: SkillRecord = {
    id: randomUUID(),
    tool_name: TEST_SKILL,
    version: "0.1.0",
    generation_depth: 1,
    generation_path: ["forge_skill", TEST_SKILL],
    trust_tier: "REVIEWED",
    intent: "Compute Vsh from gamma ray log",
    code: CLEAN_CODE,
    schema: { type: "object" },
    provenance: {
      seed_tool: "forge_skill",
      generated_by: "FORGE",
      generated_at: new Date().toISOString(),
      llm_model: "minimax-M2.7",
    },
    validations: {},
    scars_referencing: [],
    expires_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await store.put(record);
}

async function getPassingTriWitness(): Promise<any> {
  return validator.validate({
    skillName: TEST_SKILL,
    skillCode: CLEAN_CODE,
    skillIntent: "Compute Vsh from gamma ray log",
    domain: "geox",
    generatorModel: "minimax-M2.7",
    humanApprovalToken: "stg_sealtesttoken12345",
    earthEvidenceType: "TEST",
    earthEvidence: "Unit test: Vsh(GR=50,min=20,max=120) → 0.3 OK",
  });
}

describe("ForgeSealService — VAULT999 skill binding", () => {
  before(async () => {
    await createReviewableSkill();
  });

  it("seal REVIEWED skill with Tri-Witness PASS → SEALED", async () => {
    const triWitness = await getPassingTriWitness();
    const result = await sealer.seal(TEST_SKILL, triWitness, "FORGE", "stg_sealtesttoken12345");

    console.log(`[SEAL] status=${result.status} seal_id=${result.receipt?.seal_id}`);
    assert.equal(result.status, "SEALED");
    assert.ok(result.receipt);
    assert.ok(result.receipt!.seal_id.startsWith("VAULT999-SEAL-"));
    assert.equal(result.receipt!.trust_tier, "TRUSTED");
    assert.equal(result.receipt!.irreversible, true);
  });

  it("sealed skill → ALREADY_SEALED on second attempt", async () => {
    const triWitness = await getPassingTriWitness();
    const result = await sealer.seal(TEST_SKILL, triWitness, "FORGE", "stg_sealtesttoken12345");
    assert.equal(result.status, "ALREADY_SEALED");
    assert.ok(result.receipt);
  });

  it("sealed skill → verify returns true", async () => {
    const v = await sealer.verify(TEST_SKILL);
    assert.equal(v.sealed, true);
    assert.ok(v.seals.length >= 1);
    console.log(`[VERIFY] seals: ${v.seals.join(", ")}`);
  });

  it("sealed skill → scar-protected (has VAULT999 reference)", async () => {
    const skill = await store.get(TEST_SKILL);
    assert.ok(skill);
    assert.ok(skill!.scars_referencing.length >= 1);
    assert.ok(skill!.scars_referencing[0].startsWith("VAULT999-SEAL-"));
    assert.equal(skill!.trust_tier, "TRUSTED");
  });

  it("not found skill → NOT_FOUND", async () => {
    const triWitness = await getPassingTriWitness();
    const result = await sealer.seal("forge_nonexistent", triWitness, "FORGE", "stg_token1234567890");
    assert.equal(result.status, "NOT_FOUND");
  });

  it("STAGED skill → NOT_REVIEWED", async () => {
    // Create a STAGED skill
    const stagedRecord: SkillRecord = {
      id: randomUUID(),
      tool_name: "forge_staged_seal_test",
      version: "0.1.0",
      generation_depth: 1,
      generation_path: ["forge_skill"],
      trust_tier: "STAGED",
      intent: "Test staged",
      code: "export const x = 1;",
      schema: {},
      provenance: { seed_tool: "forge_skill", generated_by: "FORGE", generated_at: new Date().toISOString() },
      validations: {},
      scars_referencing: [],
      expires_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await store.put(stagedRecord);

    const triWitness = await getPassingTriWitness();
    const result = await sealer.seal("forge_staged_seal_test", triWitness, "FORGE", "stg_token1234567890");
    assert.equal(result.status, "NOT_REVIEWED");
  });

  it("Tri-Witness FAIL → TRI_WITNESS_FAILED", async () => {
    // Create fresh REVIEWED skill
    const freshRecord: SkillRecord = {
      id: randomUUID(),
      tool_name: "forge_fresh_seal_test",
      version: "0.1.0",
      generation_depth: 1,
      generation_path: ["forge_skill"],
      trust_tier: "REVIEWED",
      intent: "Test fresh",
      code: CLEAN_CODE,
      schema: {},
      provenance: { seed_tool: "forge_skill", generated_by: "FORGE", generated_at: new Date().toISOString() },
      validations: {},
      scars_referencing: [],
      expires_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await store.put(freshRecord);

    // Tri-Witness without human approval = FAIL
    const failWitness = await validator.validate({
      skillName: "forge_fresh_seal_test",
      skillCode: CLEAN_CODE,
      skillIntent: "Test",
      domain: "general",
      generatorModel: "minimax-M2.7",
      // NO humanApprovalToken → FAIL
    });

    const result = await sealer.seal("forge_fresh_seal_test", failWitness, "FORGE", "bad_token");
    assert.equal(result.status, "TRI_WITNESS_FAILED");
  });
});
