import { getAutonomousForgeGate } from '../src/domain/governance/AutonomousForgeGate.js';
import { randomUUID } from 'node:crypto';

const gate = getAutonomousForgeGate();

const proposal = {
  proposal_id: randomUUID(),
  target_organ: 'geox' as const,
  intent: 'Add Vsh computation from gamma ray log. Read-only. No mutation.',
  skill_code: `export const handler = async (args: any) => {
  const { GR, GR_min, GR_max } = args;
  const IGR = (GR - GR_min) / (GR_max - GR_min);
  return { Vsh: IGR < 0.5 ? IGR : 0.5 * IGR + 0.5 };
};`,
  proposed_by: 'FORGE',
  human_approval_token: 'stg_TEST_TOKEN_PLACEHOLDER', // fake token for local gate debug only
  earth_evidence_type: 'TEST' as const,
  earth_evidence: 'Unit test: Vsh(50,20,120) → 0.3 OK',
  depth: 1,
};

const result = await gate.process(proposal);
console.log(JSON.stringify({
  status: result.status,
  tier: result.trust_tier,
  blocked_at: result.blocked_at,
  block_reason: result.block_reason,
  apex_receipt: result.apex_receipt ? {
    G: result.apex_receipt.G,
    C_dark: result.apex_receipt.C_dark,
    verdict: result.apex_receipt.verdict
  } : null,
  tri_witness: result.tri_witness ? {
    consensus: result.tri_witness.consensus,
    human: result.tri_witness.human?.verdict,
    ai: result.tri_witness.ai?.verdict,
    earth: result.tri_witness.earth?.verdict,
    earth_checks: result.tri_witness.earth?.checks,
    earth_reason: result.tri_witness.earth?.reason,
  } : null,
}, null, 2));
