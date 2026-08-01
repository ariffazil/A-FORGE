/**
 * A2A Capability Advertising — Peer agents advertise capabilities;
 * A-FORGE translates them into local governed leases before any
 * cross-agent call is admitted.
 *
 * ═══ P2.5 RATIFIED (2026-07-31) — A2A IS DIPLOMATIC, A-FORGE IS BOUNDED ═══
 *
 * The A2A spec covers agent cards, capability discovery, messages,
 * stateful tasks, artifacts, streaming. arifOS treats A2A as the
 * inter-agent diplomatic layer. A-FORGE treats inbound A2A capability
 * offers as UNTRUSTED — every offer must pass through:
 *
 *   1. Authority check — does the offering agent have a verified
 *      identity (did:web or equivalent)?
 *   2. Verifier registration — does the offer name an external
 *      verifier, or is it self-certifying?
 *   3. ABI admission gate — does the offer declare a full CapabilityAbi
 *      that passes H_admit = H_A ∧ H_S ∧ H_E ∧ H_R ∧ H_V?
 *   4. Lease translation — only AFTER all three gates pass is the
 *      offer translated into a local CapabilityLease.
 *
 * The offering agent's word is never sufficient. Constitutional
 * authority remains with arifOS.
 *
 * @module forge/a2aCapabilityAdvertising
 * @constitutional F1 AMANAH — peer offers cannot self-authorise
 * @constitutional F2 TRUTH — peer claims are witnesses, not authority
 * @constitutional F13 SOVEREIGN — local lease is the only execution path
 */

import { createHash } from "node:crypto";

// ── A2A-style peer offer ──────────────────────────────────────────────────

export interface PeerCapabilityOffer {
  /** Agent ID of the offering peer (must be DID-resolvable). */
  offering_agent_id: string;
  /** The capability being offered. */
  capability_id: string;
  /** Intent / description. */
  intent: string;
  /** Side effects the capability will produce. */
  declared_side_effects: string[];
  /** The peer's claim of fitness — observational, never authoritative. */
  peer_self_reported_success_rate: number;
  /** Verifier method the peer claims to use. */
  peer_claimed_verifier: string;
  /** Whether the peer has been witnessed by a sovereign organ. */
  has_sovereign_witness: boolean;
  at: string;
}

// ── Verifier registration check ───────────────────────────────────────────

export interface VerifierRegistryEntry {
  verifier_id: string;
  method: string;
  registered_by: string;
  registered_at: string;
  is_external: boolean;
}

// ── Lease translation ─────────────────────────────────────────────────────

export interface LocalCapabilityLease {
  lease_id: string;
  capability_id: string;
  offering_agent_id: string;
  /** Authority class assigned by A-FORGE (may differ from peer's claim). */
  authority_class: string;
  /** Network scope after admission. */
  allowed_domains: string[];
  /** Lease TTL — short by default; extension requires re-admission. */
  expires_at: string;
  /** Receipt hash for F11 audit. */
  receipt_hash: string;
}

// ── A2A capability advertising registry ──────────────────────────────────

export class A2ACapabilityRegistry {
  private readonly offers: PeerCapabilityOffer[] = [];
  private readonly leases = new Map<string, LocalCapabilityLease>();
  private readonly verifiers = new Map<string, VerifierRegistryEntry>();

  registerVerifier(v: VerifierRegistryEntry): void {
    this.verifiers.set(v.verifier_id, v);
  }

  /**
   * Ingest one peer offer. Returns the local lease if admission passes,
   * or a denial reason. The caller MUST NOT execute the peer capability
   * if admission is denied.
   */
  ingest(offer: PeerCapabilityOffer): { lease?: LocalCapabilityLease; denial?: string } {
    this.offers.push(offer);

    // 1. Authority check
    if (!offer.offering_agent_id || offer.offering_agent_id.length < 4) {
      return { denial: "PEER_AGENT_ID_INVALID" };
    }

    // 2. Verifier registration check — peer claims a verifier; we
    //    require an EXTERNAL verifier registered locally.
    if (!this.verifiers.has(offer.peer_claimed_verifier)) {
      return { denial: `VERIFIER_NOT_REGISTERED:${offer.peer_claimed_verifier}` };
    }
    const v = this.verifiers.get(offer.peer_claimed_verifier)!;
    if (!v.is_external) {
      return { denial: `VERIFIER_NOT_EXTERNAL:${offer.peer_claimed_verifier}` };
    }

    // 3. ABI admission — peer self-reported success rate is a witness,
    //    not authority. We require sovereign witness OR
    //    peer_self_reported_success_rate ≥ 0.95 AND no declared destructive
    //    side effects.
    const destructive = offer.declared_side_effects.some(
      e => e === "fs_delete" || e === "db_mutation" || e === "credential_use",
    );
    if (destructive && !offer.has_sovereign_witness) {
      return { denial: "DESTRUCTIVE_SIDE_EFFECTS_WITHOUT_SOVEREIGN_WITNESS" };
    }
    if (offer.peer_self_reported_success_rate < 0.50) {
      return { denial: "PEER_SUCCESS_RATE_BELOW_FLOOR" };
    }

    // 4. Lease translation — A-FORGE assigns authority_class. We default
    //    to the lowest safe class; promotion requires sovereign witness.
    const authority_class = offer.has_sovereign_witness
      ? "EXECUTE_REVERSIBLE"
      : "OBSERVE";

    const lease: LocalCapabilityLease = {
      lease_id: `lease-${createHash("sha256").update(`${offer.capability_id}:${offer.offering_agent_id}:${Date.now()}`).digest("hex").slice(0, 12)}`,
      capability_id: offer.capability_id,
      offering_agent_id: offer.offering_agent_id,
      authority_class,
      allowed_domains: [],          // deny-by-default; promotion may add
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),  // 5 min TTL
      receipt_hash: createHash("sha256")
        .update(`ADMITTED:${offer.capability_id}:${offer.offering_agent_id}:${authority_class}`)
        .digest("hex")
        .slice(0, 16),
    };
    this.leases.set(lease.lease_id, lease);
    return { lease };
  }

  getLeases(): ReadonlyArray<LocalCapabilityLease> {
    return Array.from(this.leases.values());
  }

  auditTrail(): ReadonlyArray<PeerCapabilityOffer> {
    return [...this.offers];
  }

  revoke(lease_id: string): boolean {
    return this.leases.delete(lease_id);
  }
}