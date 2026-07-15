/**
 * TriWitnessValidator.test.ts — RSI: HOLD verdict, self-validation, Earth non-LLM
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TriWitnessValidator, getTriWitnessValidator } from "../src/domain/governance/TriWitnessValidator.js";

const validator = getTriWitnessValidator();

const CLEAN_SKILL = `
export const handler = async (args: any) => {
  return { entries: [] };
};
`;

const DANGEROUS_SKILL = `
export const handler = async (args: any) => {
  const key = process.env.SECRET_KEY;
  eval(args.code);
  execSync("rm -rf /");
};
`;

const GEOSCIENCE_SKILL = `
export const handler = async (args: any) => {
  const { GR_min, GR_max, GR } = args;
  return { Vsh: (GR - GR_min) / (GR_max - GR_min) };
};
`;

const MUTATING_SKILL = `
export const handler = async (args: any) => {
  const fs = require('fs');
  fs.writeFileSync('/root/data.json', JSON.stringify(args));
  return { written: true };
};
`;

describe("TriWitness RSI — Human witness (expanded)", () => {
  it("no token → FAIL", async () => {
    const r = await validator.validate({
      skillName: "forge_x", skillCode: CLEAN_SKILL, skillIntent: "test",
      domain: "general", generatorModel: "minimax-M2.7",
    });
    assert.equal(r.human.verdict, "FAIL");
    assert.equal(r.consensus, "FAIL");
  });

  it("valid token + clean skill → PASS", async () => {
    const r = await validator.validate({
      skillName: "forge_x", skillCode: CLEAN_SKILL, skillIntent: "return entries",
      domain: "general", generatorModel: "minimax-M2.7",
      humanApprovalToken: "stg_validtoken12345678",
    });
    assert.equal(r.human.verdict, "PASS");
  });

  it("mutating skill → HOLD (reversibility check)", async () => {
    const r = await validator.validate({
      skillName: "forge_x", skillCode: MUTATING_SKILL, skillIntent: "write data",
      domain: "general", generatorModel: "minimax-M2.7",
      humanApprovalToken: "stg_validtoken12345678",
    });
    console.log(`[HUMAN-MUTATE] verdict=${r.human.verdict} checks=${JSON.stringify(r.human.checks)}`);
    // Reversibility check should flag writeFileSync → HOLD
    assert.ok(r.human.verdict === "HOLD" || r.human.checks?.reversibility === "HOLD");
  });
});

describe("TriWitness RSI — AI witness (expanded)", () => {
  it("clean skill → PASS", async () => {
    const r = await validator.validate({
      skillName: "forge_clean", skillCode: CLEAN_SKILL, skillIntent: "test",
      domain: "general", generatorModel: "minimax-M2.7",
      humanApprovalToken: "stg_validtoken12345678",
    });
    assert.equal(r.ai.verdict, "PASS");
    assert.ok(r.ai.confidence >= 0.7);
  });

  it("dangerous code → FAIL", async () => {
    const r = await validator.validate({
      skillName: "forge_dangerous", skillCode: DANGEROUS_SKILL, skillIntent: "dangerous",
      domain: "general", generatorModel: "minimax-M2.7",
      humanApprovalToken: "stg_validtoken12345678",
    });
    assert.equal(r.ai.verdict, "FAIL");
    assert.ok(r.ai.checks?.static_safety === "FAIL");
  });

  it("self-modify → FAIL", async () => {
    const r = await validator.validate({
      skillName: "forge_mod", skillCode: "export const handler = () => { /* modify my own source */ fs.writeFileSync(__filename, 'x'); }",
      skillIntent: "modify", domain: "general", generatorModel: "minimax-M2.7",
      humanApprovalToken: "stg_validtoken12345678",
    });
    assert.ok(r.ai.verdict === "FAIL" || r.ai.checks?.permission_scope === "FAIL");
  });

  it("self-validation blocked → FAIL", async () => {
    const r = await validator.validate({
      skillName: "forge_self", skillCode: CLEAN_SKILL, skillIntent: "test",
      domain: "general", generatorModel: "minimax-M2.7",
      generatorAgent: "forge_self",  // same name = self-validation attempt
      humanApprovalToken: "stg_validtoken12345678",
    });
    assert.equal(r.ai.verdict, "FAIL");
    assert.ok(r.ai.reason.includes("cannot validate itself"));
  });
});

describe("TriWitness RSI — Earth witness (non-LLM required)", () => {
  it("no evidence → HOLD", async () => {
    const r = await validator.validate({
      skillName: "forge_x", skillCode: GEOSCIENCE_SKILL, skillIntent: "compute Vsh",
      domain: "geox", generatorModel: "minimax-M2.7",
      humanApprovalToken: "stg_validtoken12345678",
      // NO earthEvidenceType → defaults to NONE → HOLD
    });
    console.log(`[EARTH-NO-EVID] verdict=${r.earth.verdict}`);
    assert.equal(r.earth.verdict, "HOLD");
    assert.ok(r.earth.reason.includes("non-LLM evidence"));
    assert.equal(r.consensus, "HOLD");
  });

  it("TEST evidence → PASS", async () => {
    const r = await validator.validate({
      skillName: "forge_geo", skillCode: GEOSCIENCE_SKILL, skillIntent: "compute Vsh",
      domain: "geox", generatorModel: "minimax-M2.7",
      humanApprovalToken: "stg_validtoken12345678",
      earthEvidenceType: "TEST",
      earthEvidence: "Unit test: Vsh(GR=50,min=20,max=120) → 0.3 OK",
    });
    console.log(`[EARTH-TEST] verdict=${r.earth.verdict} score=${r.earth.score}`);
    assert.equal(r.earth.verdict, "PASS");
  });

  it("DOMAIN_ORGAN evidence → PASS (high confidence)", async () => {
    const r = await validator.validate({
      skillName: "forge_geo", skillCode: GEOSCIENCE_SKILL, skillIntent: "compute Vsh",
      domain: "geox", generatorModel: "minimax-M2.7",
      humanApprovalToken: "stg_validtoken12345678",
      earthEvidenceType: "DOMAIN_ORGAN",
      earthEvidence: "GEOX attestation: Vsh formula correct for sandstone",
    });
    assert.equal(r.earth.verdict, "PASS");
    assert.ok(r.earth.confidence >= 0.9);
  });
});

describe("TriWitness RSI — Consensus (HOLD verdict)", () => {
  it("ALL PASS → consensus PASS, canPromote, scarRequired=false", async () => {
    const r = await validator.validate({
      skillName: "forge_geo", skillCode: GEOSCIENCE_SKILL, skillIntent: "compute Vsh from gamma ray",
      domain: "geox", generatorModel: "minimax-M2.7",
      humanApprovalToken: "stg_validtoken12345678",
      earthEvidenceType: "TEST",
      earthEvidence: "test output: Vsh=0.3",
    });
    console.log(`[ALL-PASS] H=${r.human.verdict} A=${r.ai.verdict} E=${r.earth.verdict} → ${r.consensus}`);
    assert.equal(r.consensus, "PASS");
    assert.equal(r.canPromote, true);
    assert.equal(r.promotionTier, "REVIEWED");
    assert.equal(r.scarRequired, false);
    assert.ok(r.aggregateScore > 0);
  });

  it("any HOLD → consensus HOLD, cannot promote, no scar", async () => {
    const r = await validator.validate({
      skillName: "forge_x", skillCode: CLEAN_SKILL, skillIntent: "test",
      domain: "general", generatorModel: "minimax-M2.7",
      humanApprovalToken: "stg_validtoken12345678",
      // no earth evidence → HOLD
    });
    assert.equal(r.consensus, "HOLD");
    assert.equal(r.canPromote, false);
    assert.equal(r.scarRequired, false); // HOLD is not FAIL
  });

  it("any FAIL → consensus FAIL, scarRequired=true", async () => {
    const r = await validator.validate({
      skillName: "forge_bad", skillCode: DANGEROUS_SKILL, skillIntent: "dangerous",
      domain: "general", generatorModel: "minimax-M2.7",
      humanApprovalToken: "stg_validtoken12345678",
      earthEvidenceType: "TEST", earthEvidence: "some test",
    });
    assert.equal(r.consensus, "FAIL");
    assert.equal(r.canPromote, false);
    assert.equal(r.scarRequired, true);
  });

  it("no human approval → FAIL even if AI+Earth pass", async () => {
    const r = await validator.validate({
      skillName: "forge_x", skillCode: GEOSCIENCE_SKILL, skillIntent: "Vsh",
      domain: "geox", generatorModel: "minimax-M2.7",
      earthEvidenceType: "TEST", earthEvidence: "test passed",
    });
    assert.equal(r.consensus, "FAIL");
  });
});
