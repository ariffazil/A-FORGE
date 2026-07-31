/**
 * Shadow Mode — Capability candidates run in parallel alongside the
 * incumbent. Outcomes are compared but the candidate NEVER affects
 * production traffic until promoted.
 *
 * ═══ P2.1 RATIFIED (2026-07-31) — SHADOW BEFORE TRUST ═════════════════════
 *
 * Lifecycle:
 *   1. Enroll candidate capability into shadow lane (get or create run).
 *   2. For each production invocation, mirror the same call into the
 *      candidate under identical args. Capture the candidate's output.
 *   3. After N matches, evaluate agreement rate (output schema match
 *      + JSON-shape equivalence). If ≥ AGREE_THRESHOLD, propose
 *      promotion via EvidencePromotionGate.
 *
 * Safety: the candidate NEVER writes to any shared resource, NEVER
 * resolves a side-effectful capability, NEVER returns to the caller.
 * Its output is captured but discarded at the shadow boundary. The
 * caller only sees the incumbent's output.
 *
 * @module forge/shadowMode
 * @constitutional F1 AMANAH — shadow lane is read-only with respect to prod
 * @constitutional F2 TRUTH — agreement metric is auditable per call
 * @constitutional F11 AUDIT — every shadow invocation leaves a receipt
 */

import { createHash } from "node:crypto";

export interface ShadowCandidate {
  capability_id: string;
  enrolled_at: string;
  matches: number;
  agreements: number;
  disagreements: number;
  last_invocation_at: string | null;
  status: "shadowing" | "agreed" | "disagreed" | "promoted" | "rejected";
}

export interface ShadowRun {
  /** Inputs the incumbent was called with. */
  incumbent_input: Record<string, unknown>;
  /** Incumbent output. */
  incumbent_output: unknown;
  /** Candidate output. */
  candidate_output: unknown;
  /** True iff outputs are deep-equal (or schema-compatible). */
  agreed: boolean;
  /** ISO timestamp. */
  at: string;
  /** Receipt hash for F11 audit. */
  receipt_hash: string;
}

const AGREE_THRESHOLD = 0.95;
const MIN_MATCHES = 20;

export class ShadowMode {
  private readonly candidates = new Map<string, ShadowCandidate>();
  private readonly runs: ShadowRun[] = [];

  enroll(capability_id: string): ShadowCandidate {
    const existing = this.candidates.get(capability_id);
    if (existing) return existing;
    const c: ShadowCandidate = {
      capability_id,
      enrolled_at: new Date().toISOString(),
      matches: 0,
      agreements: 0,
      disagreements: 0,
      last_invocation_at: null,
      status: "shadowing",
    };
    this.candidates.set(capability_id, c);
    return c;
  }

  /**
   * Record one shadow match. The caller must invoke the candidate
   * with the same input as the incumbent and capture the output.
   * Returns the receipt hash.
   */
  record(
    capability_id: string,
    incumbent_input: Record<string, unknown>,
    incumbent_output: unknown,
    candidate_output: unknown,
  ): string {
    const c = this.enroll(capability_id);
    const agreed = deepEqual(incumbent_output, candidate_output);
    const at = new Date().toISOString();
    c.matches++;
    c.last_invocation_at = at;
    if (agreed) {
      c.agreements++;
    } else {
      c.disagreements++;
    }
    const agreeRate = c.agreements / c.matches;
    c.status =
      c.matches >= MIN_MATCHES && agreeRate >= AGREE_THRESHOLD
        ? "agreed"
        : c.matches >= MIN_MATCHES && agreeRate < AGREE_THRESHOLD
          ? "disagreed"
          : "shadowing";

    const receipt_hash = createHash("sha256")
      .update(`${capability_id}:${at}:${agreed ? "AGREE" : "DISAGREE"}`)
      .digest("hex")
      .slice(0, 16);

    this.runs.push({
      incumbent_input,
      incumbent_output,
      candidate_output,
      agreed,
      at,
      receipt_hash,
    });

    return receipt_hash;
  }

  /** Get the current shadow state for a capability. */
  state(capability_id: string): ShadowCandidate | undefined {
    return this.candidates.get(capability_id);
  }

  /** All shadow runs for F11 replay. */
  auditTrail(): ReadonlyArray<ShadowRun> {
    return [...this.runs];
  }

  /**
   * Promotion predicate. True iff the candidate has met the agree
   * threshold and is ready to be proposed to EvidencePromotionGate.
   */
  readyForPromotion(capability_id: string): boolean {
    const c = this.candidates.get(capability_id);
    if (!c) return false;
    return c.status === "agreed";
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    return ka.every(k =>
      deepEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
    );
  }
  return false;
}