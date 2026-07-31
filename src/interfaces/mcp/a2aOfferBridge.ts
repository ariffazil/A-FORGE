/**
 * a2aOfferBridge — P2.4 A2A offer/request translation.
 *
 * Bridges A2A agent-card artifacts (`capability_offer`,
 * `capability_request`) into the local CapabilityMarket + lease
 * system. The bridge never self-promotes; every translation
 * preserves the arifOS seal gate.
 *
 * @module mcp/a2aOfferBridge
 * @constitutional F1 AMANAH · F13 SOVEREIGN
 */
import { PeerContractService } from "../../domain/governance/PeerContractService.js";
import { getCapabilityMarket, type CapabilityOffer, type CapabilityLeaseRequest } from "../../domain/forge/CapabilityMarket.js";

// ── Artifact kinds ────────────────────────────────────────────────────

export interface A2ACapabilityOffer {
  kind: "capability_offer";
  offer: CapabilityOffer;
  requires_arifos_seal: true;
}

export interface A2ACapabilityRequest {
  kind: "capability_request";
  request: CapabilityLeaseRequest;
}

// ── Bridge ────────────────────────────────────────────────────────────

export interface BridgeResult {
  accepted: boolean;
  reason?: string;
  lease?: import("../../domain/forge/CapabilityMarket.js").LocalLease;
  offer?: CapabilityOffer;
}

export class A2ACapabilityOfferBridge {
  constructor(
    private readonly peer: PeerContractService = new PeerContractService(),
    private readonly market = getCapabilityMarket(),
  ) {}

  /**
   * Inbound capability_offer. Validates the peer contract, stores
   * in the market (which requires arifos_seal_id), and surfaces for
   * observation only.
   */
  receiveOffer(artifact: A2ACapabilityOffer, peerContract: unknown): BridgeResult {
    const validation = this.peer.validate(peerContract);
    if (!validation.ok) {
      return { accepted: false, reason: `peer contract invalid: ${validation.errors.join("; ")}` };
    }
    if (artifact.offer.issuer === "peer" && !artifact.offer.arifos_seal_id) {
      // F13: refuse peer offers that lack an arifOS seal. Logged as
      // F11 audit event in the live bridge.
      return { accepted: false, reason: "peer offer missing arifos_seal_id (F13)" };
    }
    const pub = this.market.publishOffer(artifact.offer);
    if (!pub.ok) {
      return { accepted: false, reason: pub.error };
    }
    return { accepted: true, offer: pub.offer };
  }

  /**
   * Outbound capability_request. Returns the request payload that
   * the orchestrator can send via existing `forge_parallel` plumbing.
   */
  buildRequest(capability_id: string, requester_actor: string, duration_ms: number, peer_contract_id?: string): A2ACapabilityRequest {
    return {
      kind: "capability_request",
      request: {
        request_id: `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        requester_actor,
        capability_id,
        duration_ms,
        peer_contract_id,
      },
    };
  }

  /**
   * Inbound capability_request. Translates to a local lease via
   * `CapabilityMarket.subscribe`. Refuses when no matching offer
   * exists or when the offer lacks an arifOS seal.
   */
  receiveRequest(artifact: A2ACapabilityRequest, offer_id: string): BridgeResult {
    const sub = this.market.subscribe(artifact.request, offer_id);
    if (!sub.ok) {
      return { accepted: false, reason: sub.error };
    }
    return { accepted: true, lease: sub.lease };
  }
}
