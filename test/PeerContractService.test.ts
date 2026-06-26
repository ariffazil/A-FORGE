/**
 * PeerContractService tests
 *
 * F1 AMANAH: Non-judge peers must require a lease.
 * F13 SOVEREIGN: Only arifOS may hold judge authority; F13 veto is absolute.
 * F9 ANTI-HANTU: Contract validation fails closed with explicit errors.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PeerContractService, type PeerFederationContract } from '../src/domain/governance/PeerContractService.js';

const VALID_ARIFOS_CONTRACT: PeerFederationContract = {
  contract_version: '1.0.0',
  peer_id: {
    organ: 'arifOS',
    instance_id: '98e0d71e-67c6-4cc4-9347-fe13417f673f',
    did: 'did:arifos:kernel-alpha',
    public_key_fingerprint: 'arifos-f13-rootkey-ed25519-stub',
  },
  authority_class: 'judge',
  capability_card: {
    schema_hash: 'peer-federation-contract-v1',
    tool_manifest_url: 'https://arifos.arif-fazil.com/tools/list',
    allowed_action_classes: ['OBSERVE', 'PREPARE', 'MUTATE', 'ATOMIC'],
    max_risk_tier: 'T5',
  },
  lease_required: false,
  reversibility_score: 0,
  forbidden_actions: ['delegate_f13', 'self_authorize'],
  audit_sink: {
    vault999_endpoint: 'https://vault999.arif-fazil.com/seal',
    receipt_format: 'arifos_vault999_v2',
  },
  human_veto: {
    f13_absolute: true,
    override_paths: [{ channel: 'telegram', endpoint: 'hermes-asi-gateway' }],
  },
};

const VALID_AFORGE_CONTRACT: PeerFederationContract = {
  contract_version: '1.0.0',
  peer_id: {
    organ: 'A-FORGE',
    instance_id: 'ccaca653-c318-453d-8c6f-8f80f8d16be2',
    did: 'did:arifos:a-forge-alpha',
    public_key_fingerprint: 'a-forge-ed25519-stub',
  },
  authority_class: 'execute',
  capability_card: {
    schema_hash: 'peer-federation-contract-v1',
    tool_manifest_url: 'https://forge.arif-fazil.com/.well-known/agent-card.json',
    allowed_action_classes: ['OBSERVE', 'PREPARE', 'MUTATE'],
    max_risk_tier: 'T4',
  },
  lease_required: true,
  reversibility_score: 0.5,
  forbidden_actions: ['self_authorize', 'issue_seal', 'judge'],
  audit_sink: {
    vault999_endpoint: 'https://vault999.arif-fazil.com/seal',
    receipt_format: 'arifos_vault999_v2',
  },
  human_veto: {
    f13_absolute: true,
    override_paths: [{ channel: 'a2a_task', endpoint: 'https://aaa.arif-fazil.com/a2a/tasks' }],
  },
};

describe('PeerContractService', () => {
  const service = new PeerContractService();

  it('validates a correct arifOS judge contract', () => {
    const result = service.validate(VALID_ARIFOS_CONTRACT);
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
  });

  it('validates a correct A-FORGE execute contract', () => {
    const result = service.validate(VALID_AFORGE_CONTRACT);
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
  });

  it('rejects non-arifOS peer claiming judge authority', () => {
    const bad = { ...VALID_AFORGE_CONTRACT, authority_class: 'judge' as const };
    const result = service.validate(bad);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(e => e.includes("judge") && e.includes("arifOS")));
  });

  it('rejects A-FORGE peer with non-execute authority_class', () => {
    const bad = { ...VALID_AFORGE_CONTRACT, authority_class: 'route' as const };
    const result = service.validate(bad);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(e => e.includes("A-FORGE") && e.includes("execute")));
  });

  it('rejects contract with f13_absolute false', () => {
    const bad = {
      ...VALID_AFORGE_CONTRACT,
      human_veto: { f13_absolute: false as const, override_paths: [] },
    };
    const result = service.validate(bad);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(e => e.includes("f13_absolute")));
  });

  it('rejects non-judge contract without lease_required', () => {
    const bad = { ...VALID_AFORGE_CONTRACT, lease_required: false };
    const result = service.validate(bad);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(e => e.includes("lease_required")));
  });

  it('rejects empty forbidden_actions', () => {
    const bad = { ...VALID_AFORGE_CONTRACT, forbidden_actions: [] };
    const result = service.validate(bad);
    assert.equal(result.ok, false);
  });

  it('checks action permission against contract', () => {
    assert.equal(service.isActionPermitted(VALID_AFORGE_CONTRACT, 'MUTATE'), true);
    assert.equal(service.isActionPermitted(VALID_AFORGE_CONTRACT, 'ATOMIC'), false);
  });

  it('checks risk tier ceiling', () => {
    assert.equal(service.isRiskPermitted(VALID_AFORGE_CONTRACT, 'T4'), true);
    assert.equal(service.isRiskPermitted(VALID_AFORGE_CONTRACT, 'T5'), false);
  });

  it('checks forbidden action list', () => {
    assert.equal(service.isForbidden(VALID_AFORGE_CONTRACT, 'judge'), true);
    assert.equal(service.isForbidden(VALID_AFORGE_CONTRACT, 'plan'), false);
  });
});
