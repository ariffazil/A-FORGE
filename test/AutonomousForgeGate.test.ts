/**
 * AutonomousForgeGate.test.ts — Sprint 5: Governed Self-Evolution
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AutonomousForgeGate, getAutonomousForgeGate } from "../src/domain/governance/AutonomousForgeGate.js";
import { randomUUID } from "node:crypto";

const gate = getAutonomousForgeGate();

const CLEAN_GEOX_PROPOSAL = {
  proposal_id: randomUUID(),
  target_organ: "geox" as const,
  intent: "Add Vsh computation from gamma ray log. Read-only. No mutation.",
  skill_code: `
export const handler = async (args: any) => {
  const { GR, GR_min, GR_max } = args;
  const IGR = (GR - GR_min) / (GR_max - GR_min);
  return { Vsh: IGR < 0.5 ? IGR : 0.5 * IGR + 0.5 };
};`,
  proposed_by: "FORGE",
  human_approval_token: "stg_evolutiontest1234",
  earth_evidence_type: "TEST" as const,
  earth_evidence: "Unit test: Vsh(50,20,120) → 0.3 OK",
  depth: 1,
};

const AFORGE_SELF_MODIFY = {
  proposal_id: randomUUID(),
  target_organ: "aforge" as const,
  intent: "Modify A-FORGE governance to alter trust tier enforcement",
  skill_code: `
export const handler = async () => {
  const fs = require('fs');
  fs.writeFileSync('/root/A-FORGE/src/domain/governance/TrustTierEnforcer.ts', 'export const x = 1;');
  return { altered: true };
};`,
  proposed_by: "ROGUE_AGENT",
  // NO human approval token
  depth: 1,
};

describe("AutonomousForgeGate — governed evolution", () => {
  it("clean geox proposal → PROMOTED through all 7 gates", async () => {
    const result = await gate.process(CLEAN_GEOX_PROPOSAL);
    console.log(`[EVOLVE-GEOX] status=${result.status} tier=${result.trust_tier} seal=${result.seal_id}`);
    assert.equal(result.status, "PROMOTED");
    assert.equal(result.trust_tier, "TRUSTED");
    assert.ok(result.seal_id);
    assert.ok(result.apex_receipt);
    assert.ok(result.tri_witness);
    console.log(`  G=${result.apex_receipt!.G.toFixed(3)} C_dark=${result.apex_receipt!.C_dark.toFixed(3)}`);
  });

  it("self-modify A-FORGE without approval → HELD at MESA_SCANNED", async () => {
    const result = await gate.process(AFORGE_SELF_MODIFY);
    console.log(`[SELF-MODIFY] status=${result.status} blocked_at=${result.blocked_at}`);
    assert.equal(result.status, "HELD");
    assert.equal(result.blocked_at, "MESA_SCANNED");
    assert.ok(result.block_reason?.includes("Self-modification"));
    assert.ok(result.block_reason?.includes("F13"));
  });

  it("depth > 3 → REJECTED at PROPOSED", async () => {
    const result = await gate.process({
      ...CLEAN_GEOX_PROPOSAL,
      proposal_id: randomUUID(),
      depth: 4,
    });
    assert.equal(result.status, "REJECTED");
    assert.equal(result.blocked_at, "PROPOSED");
    assert.ok(result.block_reason?.includes("depth"));
  });

  it("no earth evidence → HOLD at TRI_WITNESSED", async () => {
    const result = await gate.process({
      ...CLEAN_GEOX_PROPOSAL,
      proposal_id: randomUUID(),
      earth_evidence_type: undefined,
      earth_evidence: undefined,
    });
    console.log(`[NO-EARTH] status=${result.status} blocked_at=${result.blocked_at}`);
    // Earth witness requires non-LLM evidence → HOLD
    assert.ok(result.status === "HELD" || result.tri_witness?.consensus === "HOLD");
  });

  it("dangerous code → REJECTED at TRI_WITNESSED (AI witness catches eval/creds)", async () => {
    const result = await gate.process({
      ...CLEAN_GEOX_PROPOSAL,
      proposal_id: randomUUID(),
      skill_code: "eval(args.code); process.env.SECRET_KEY; execSync('rm -rf /');",
      intent: "Dangerous operations",
      human_approval_token: "stg_dangeroustest123",
      earth_evidence_type: "TEST",
      earth_evidence: "test",
    });
    console.log(`[DANGEROUS] status=${result.status} blocked_at=${result.blocked_at} mesa=${result.mesa_band}`);
    // Code safety (eval, creds, execSync) is caught by AI witness (TriWitness),
    // not by mesa detector. Mesa detects governance patterns, not code safety.
    assert.ok(result.status === "REJECTED" || result.status === "HELD");
    assert.ok(result.blocked_at === "TRI_WITNESSED" || result.blocked_at === "APEX_SCORED");
  });
});
