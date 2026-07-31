/**
 * a2aOfferBridge.test.ts — P2.4 inbound/outbound translation.
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { A2ACapabilityOfferBridge, type A2ACapabilityOffer, type A2ACapabilityRequest } from "../src/interfaces/mcp/a2aOfferBridge.js";
import { CapabilityMarket } from "../src/domain/forge/CapabilityMarket.js";

const SEALED_OFFER = {
  offer_id: "offer-stub",
  capability_id: "cap.test",
  issuer: "peer" as const,
  sla: { success_rate_min: 0.95, p95_latency_ms: 200, availability: 0.99 },
  price: { unit: "invocation" as const, value: 0.01, currency: "FLAME" as const },
  evidence: { total_invocations: 10, independent_verifier_passes: 2, capability_score: 0.7 },
  arifos_seal_id: "arifos-stub",
};

const validContract = {
  contract_version: "1.0.0" as const,
  peer_id: {
    organ: "GEOX" as const,
    instance_id: "00000000-0000-0000-0000-000000000001",
    did: "did:arifos:geox-stub",
    public_key_fingerprint: "fp-stub-fp-stub-fp-stub-fp",
  },
  authority_class: "evidence" as const,
  capability_card: {
    schema_hash: "schema-hash",
    tool_manifest_url: "https://geox.arif-fazil.com/manifest.json",
    allowed_action_classes: ["OBSERVE" as const],
    max_risk_tier: "T2" as const,
  },
  lease_required: true,
  reversibility_score: 0.9,
  forbidden_actions: ["vault_seal"],
  audit_sink: {
    vault999_endpoint: "https://arifos.arif-fazil.com/vault999",
    receipt_format: "arifos_vault999_v2" as const,
  },
  human_veto: { f13_absolute: true as const, override_paths: [] },
};

describe("A2ACapabilityOfferBridge — inbound offer", () => {
  it("refuses peer offer without arifos_seal_id (F13)", () => {
    const market = new CapabilityMarket();
    const bridge = new A2ACapabilityOfferBridge(undefined, market);
    const artifact: A2ACapabilityOffer = {
      kind: "capability_offer",
      offer: { ...SEALED_OFFER, arifos_seal_id: undefined },
      requires_arifos_seal: true,
    };
    const r = bridge.receiveOffer(artifact, validContract);
    assert.equal(r.accepted, false);
    assert.match(r.reason ?? "", /arifos_seal_id/);
  });

  it("accepts sealed peer offer", () => {
    const market = new CapabilityMarket();
    const bridge = new A2ACapabilityOfferBridge(undefined, market);
    const artifact: A2ACapabilityOffer = {
      kind: "capability_offer",
      offer: SEALED_OFFER,
      requires_arifos_seal: true,
    };
    const r = bridge.receiveOffer(artifact, validContract);
    assert.equal(r.accepted, true);
    assert.ok(r.offer?.offer_id);
  });

  it("refuses when peer contract is invalid", () => {
    const market = new CapabilityMarket();
    const bridge = new A2ACapabilityOfferBridge(undefined, market);
    const artifact: A2ACapabilityOffer = {
      kind: "capability_offer",
      offer: SEALED_OFFER,
      requires_arifos_seal: true,
    };
    const r = bridge.receiveOffer(artifact, { invalid: true });
    assert.equal(r.accepted, false);
    assert.match(r.reason ?? "", /peer contract invalid/);
  });
});

describe("A2ACapabilityOfferBridge — outbound request", () => {
  it("builds a capability_request with peer_contract_id", () => {
    const bridge = new A2ACapabilityOfferBridge();
    const req = bridge.buildRequest("cap.test", "actor", 60_000, "peer-c-1");
    assert.equal(req.kind, "capability_request");
    assert.equal(req.request.capability_id, "cap.test");
    assert.equal(req.request.peer_contract_id, "peer-c-1");
  });
});

describe("A2ACapabilityOfferBridge — inbound request", () => {
  it("translates to a local lease when offer is sealed", () => {
    const market = new CapabilityMarket();
    const bridge = new A2ACapabilityOfferBridge(undefined, market);
    const o = market.publishOffer({ ...SEALED_OFFER, capability_id: "cap.req" });
    assert.equal(o.ok, true);
    const req: A2ACapabilityRequest = {
      kind: "capability_request",
      request: {
        request_id: "r1",
        requester_actor: "a",
        capability_id: "cap.req",
        duration_ms: 60_000,
      },
    };
    const r = bridge.receiveRequest(req, o.offer.offer_id);
    assert.equal(r.accepted, true);
    assert.equal(r.lease?.arifos_seal_id, "arifos-stub");
  });

  it("drops a request whose offer lacks an arifOS seal", () => {
    const market = new CapabilityMarket();
    const bridge = new A2ACapabilityOfferBridge(undefined, market);
    // Manually create an unsealed offer (the public API refuses).
    (market as unknown as { offers: Map<string, unknown> }).offers.set("offer-unsealed", {
      offer_id: "offer-unsealed",
      capability_id: "cap.unsealed",
      issuer: "aforge",
      sla: SEALED_OFFER.sla,
      price: SEALED_OFFER.price,
      evidence: SEALED_OFFER.evidence,
    });
    const req: A2ACapabilityRequest = {
      kind: "capability_request",
      request: { request_id: "r2", requester_actor: "a", capability_id: "cap.unsealed", duration_ms: 1000 },
    };
    const r = bridge.receiveRequest(req, "offer-unsealed");
    assert.equal(r.accepted, false);
    assert.match(r.reason ?? "", /arifos_seal_id/);
  });
});
