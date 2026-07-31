/**
 * CapabilityMarket — P2.3 empirical capability market.
 *
 * The market never creates authority. `publishOffer` requires an
 * arifOS seal; `subscribe()` returns a local lease via the existing
 * `registerLocalLease` path. A-FORGE never promotes a capability to
 * permanent on its own.
 *
 * @module forge/CapabilityMarket
 * @constitutional F1 AMANAH · F13 SOVEREIGN
 */
import { randomUUID } from "node:crypto";
import { getEvidencePromotionGate } from "./EvidencePromotionGate.js";
import type { EvidencePromotionEvidence } from "./EvidencePromotionGate.js";

// ── Types ──────────────────────────────────────────────────────────────

export interface CapabilityOffer {
  offer_id: string;
  capability_id: string;
  issuer: "aforge" | "peer";
  sla: {
    success_rate_min: number;
    p95_latency_ms: number;
    availability: number;
  };
  price: {
    unit: "invocation" | "ms" | "byte";
    value: number;
    currency: "FLAME" | "USD-CENTS";
  };
  evidence: {
    total_invocations: number;
    independent_verifier_passes: number;
    capability_score: number;
  };
  arifos_seal_id?: string;
}

export interface CapabilityLeaseRequest {
  request_id: string;
  requester_actor: string;
  capability_id: string;
  duration_ms: number;
  peer_contract_id?: string;
}

export interface LocalLease {
  lease_id: string;
  request_id: string;
  capability_id: string;
  duration_ms: number;
  requester_actor: string;
  arifos_seal_id?: string;
}

// ── Market ────────────────────────────────────────────────────────────

export class CapabilityMarket {
  private readonly offers = new Map<string, CapabilityOffer>();

  /**
   * Publish an offer. REQUIRES `arifos_seal_id` (F13 gate).
   */
  publishOffer(input: Omit<CapabilityOffer, "offer_id" | "evidence"> & { evidence: CapabilityOffer["evidence"] }): { ok: true; offer: CapabilityOffer } | { ok: false; error: string } {
    if (!input.arifos_seal_id) {
      return { ok: false, error: "publishOffer requires arifos_seal_id (F13 SOVEREIGN)" };
    }
    const offer: CapabilityOffer = { ...input, offer_id: `offer-${randomUUID()}` };
    this.offers.set(offer.offer_id, offer);
    return { ok: true, offer };
  }

  list(): CapabilityOffer[] {
    return Array.from(this.offers.values());
  }

  get(offer_id: string): CapabilityOffer | undefined {
    return this.offers.get(offer_id);
  }

  /**
   * Best-fit match. Returns the offer with the highest
   * `capability_score` for the requested capability. The match is
   * advisory only — A-FORGE never creates federation-wide effects
   * without arif_judge SEAL.
   */
  match(capability_id: string): CapabilityOffer | null {
    let best: CapabilityOffer | null = null;
    for (const offer of this.offers.values()) {
      if (offer.capability_id !== capability_id) continue;
      if (!best || offer.evidence.capability_score > best.evidence.capability_score) {
        best = offer;
      }
    }
    return best;
  }

  /**
   * Subscribe a requester to an offer. Returns a local lease.
   * Caller is responsible for passing the lease to arifOS via
   * `registerLocalLease` (F1 AMANAH).
   */
  subscribe(req: CapabilityLeaseRequest, offer_id: string): { ok: true; lease: LocalLease } | { ok: false; error: string } {
    const offer = this.offers.get(offer_id);
    if (!offer) return { ok: false, error: `offer ${offer_id} not found` };
    if (offer.capability_id !== req.capability_id) {
      return { ok: false, error: `offer ${offer_id} is for ${offer.capability_id}, request asked for ${req.capability_id}` };
    }
    if (!offer.arifos_seal_id) {
      return { ok: false, error: `offer ${offer_id} has no arifos_seal_id — bridge refuses to translate` };
    }
    const lease: LocalLease = {
      lease_id: `lcl-${randomUUID()}`,
      request_id: req.request_id,
      capability_id: offer.capability_id,
      duration_ms: req.duration_ms,
      requester_actor: req.requester_actor,
      arifos_seal_id: offer.arifos_seal_id,
    };
    return { ok: true, lease };
  }

  /**
   * Review a published offer against the EvidencePromotionGate. A
   * returned `ok_to_propose=true` is then routed to arif_judge
   * (caller responsibility).
   */
  review(template_id: string, evidence: EvidencePromotionEvidence): ReturnType<ReturnType<typeof getEvidencePromotionGate>["evaluate"]> {
    return getEvidencePromotionGate().evaluate(template_id, evidence);
  }
}

let _market: CapabilityMarket | null = null;
export function getCapabilityMarket(): CapabilityMarket {
  if (!_market) _market = new CapabilityMarket();
  return _market;
}
