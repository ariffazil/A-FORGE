/**
 * @file ForgeVisualQASeal.ts — VAULT999 Composite Seal Validator
 * @description Validates tri-witness composite hash and seals into VAULT999.
 *              No seal without W³ and correct composite_hash.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 *
 * INVARIANTS:
 *   I1: No seal unless verdict === "SEALED_DEPLOY"
 *   I2: No seal unless w1.verdict = w2.verdict = w3.verdict = "PASS"
 *   I3: No seal unless recomputed_hash === composite_hash
 *   I4: VAULT999 only stores composite_hash, never raw witness hashes
 *   I5: Any mismatch → REJECTED, never partial seal
 *
 * CONSTITUTIONAL BASIS:
 *   F1  AMANAH  — Irreversible seal requires sovereign ack
 *   F2  TRUTH   — Composite hash is cryptographic proof, not assertion
 *   F3  WITNESS — W³ = SHA256(w1.hash ‖ w2.hash ‖ w3.hash ‖ verdict)
 *   F11 AUDIT   — Every seal leaves a trace in VAULT999
 *
 * @author arifOS Federation
 * @version 1.0.0
 * @constitutional true
 */

import { createHash } from "node:crypto";
import { z } from "zod";

// ============================================================================
// TYPES
// ============================================================================

export const WitnessVerdict = z.enum(["PASS", "HOLD", "FAIL"]);
export type WitnessVerdict = z.infer<typeof WitnessVerdict>;

export const WitnessEntry = z.object({
  verdict: WitnessVerdict,
  hash: z.string().regex(/^[a-f0-9]{64}$/, "Must be SHA-256 hex"),
  score: z.number().optional(),
  actor_id: z.string().optional(),
  timestamp: z.string().optional(),  // ISO8601
});
export type WitnessEntry = z.infer<typeof WitnessEntry>;

export const TriWitnessLedgerInput = z.object({
  w1: WitnessEntry,
  w2: WitnessEntry,
  w3: WitnessEntry,
  composite_hash: z.string().regex(/^[a-f0-9]{64}$/, "Must be SHA-256 hex"),
});
export type TriWitnessLedgerInput = z.infer<typeof TriWitnessLedgerInput>;

export const SealVisualInput = z.object({
  tri_witness_ledger: TriWitnessLedgerInput,
  verdict: z.enum(["PASS_CANDIDATE", "SEALED_DEPLOY"]),
});
export type SealVisualInput = z.infer<typeof SealVisualInput>;

export const SealVisualOutput = z.object({
  verdict: z.enum(["SEALED", "REJECTED"]),
  sealed: z.boolean(),
  vault_seq: z.number(),
  error: z.string(),
  composite_hash: z.string(),
  rejection_reason: z.string().optional(),
});
export type SealVisualOutput = z.infer<typeof SealVisualOutput>;

// ============================================================================
// COMPOSITE HASH COMPUTATION
// ============================================================================

/**
 * Compute composite hash: SHA256(w1.hash ‖ w2.hash ‖ w3.hash ‖ verdict)
 *
 * F2 TRUTH: This is cryptographic proof of tri-witness consensus.
 * The composite hash binds all three witnesses to the verdict.
 * Any change in any witness or the verdict invalidates the seal.
 */
export function computeCompositeHash(
  w1Hash: string,
  w2Hash: string,
  w3Hash: string,
  verdict: string,
): string {
  const payload = `${w1Hash}${w2Hash}${w3Hash}${verdict}`;
  return createHash("sha256").update(payload).digest("hex");
}

// ============================================================================
// SEAL VALIDATOR
// ============================================================================

/**
 * Validate tri-witness composite hash and seal into VAULT999.
 *
 * INVARIANTS (all must pass or seal is REJECTED):
 *   I1: verdict === "SEALED_DEPLOY"
 *   I2: w1.verdict = w2.verdict = w3.verdict = "PASS"
 *   I3: recomputed_hash === composite_hash
 *   I4: VAULT999 only stores composite_hash (never raw witness hashes)
 *   I5: Any mismatch → REJECTED (never partial seal)
 */
export function validateSealComposite(
  input: SealVisualInput,
): { valid: true } | { valid: false; error: string } {
  const { tri_witness_ledger, verdict } = input;

  // I1: No seal unless verdict === "SEALED_DEPLOY"
  if (verdict !== "SEALED_DEPLOY") {
    return {
      valid: false,
      error: `I1_VIOLATION: verdict is "${verdict}", must be "SEALED_DEPLOY"`,
    };
  }

  // I2: No seal unless all witnesses PASS
  if (tri_witness_ledger.w1.verdict !== "PASS") {
    return {
      valid: false,
      error: `I2_VIOLATION: w1.verdict is "${tri_witness_ledger.w1.verdict}", must be "PASS"`,
    };
  }
  if (tri_witness_ledger.w2.verdict !== "PASS") {
    return {
      valid: false,
      error: `I2_VIOLATION: w2.verdict is "${tri_witness_ledger.w2.verdict}", must be "PASS"`,
    };
  }
  if (tri_witness_ledger.w3.verdict !== "PASS") {
    return {
      valid: false,
      error: `I2_VIOLATION: w3.verdict is "${tri_witness_ledger.w3.verdict}", must be "PASS"`,
    };
  }

  // I3: Recompute composite hash and compare
  const recomputed = computeCompositeHash(
    tri_witness_ledger.w1.hash,
    tri_witness_ledger.w2.hash,
    tri_witness_ledger.w3.hash,
    verdict,
  );

  if (recomputed !== tri_witness_ledger.composite_hash) {
    return {
      valid: false,
      error: `I3_VIOLATION: composite_hash mismatch. recomputed=${recomputed}, provided=${tri_witness_ledger.composite_hash}`,
    };
  }

  return { valid: true };
}

// ============================================================================
// SEAL EXECUTOR
// ============================================================================

export interface Vault999AppendResult {
  seq: number;
  receipt_id: string;
}

/**
 * Full seal execution: validate → append to VAULT999 → return receipt.
 *
 * F1 AMANAH: This is irreversible. Once sealed, it cannot be unsealed.
 * F11 AUDIT: Every seal leaves a trace.
 */
export async function sealVisualComposite(
  input: SealVisualInput,
  deps: {
    vaultAppend: (record: unknown) => Promise<Vault999AppendResult>;
  },
): Promise<SealVisualOutput> {
  const validation = validateSealComposite(input);

  if (!validation.valid) {
    return {
      verdict: "REJECTED",
      sealed: false,
      vault_seq: -1,
      error: validation.error,
      composite_hash: input.tri_witness_ledger.composite_hash,
      rejection_reason: validation.error,
    };
  }

  // I4: VAULT999 only stores composite_hash, never raw witness hashes
  const vaultRecord = {
    type: "VISUAL_SEAL",
    composite_hash: input.tri_witness_ledger.composite_hash,
    verdict: input.verdict,
    // Raw hashes are NOT stored — only composite
    w1_verdict: input.tri_witness_ledger.w1.verdict,
    w2_verdict: input.tri_witness_ledger.w2.verdict,
    w3_verdict: input.tri_witness_ledger.w3.verdict,
    w3_actor_id: input.tri_witness_ledger.w3.actor_id,
    w3_timestamp: input.tri_witness_ledger.w3.timestamp,
    sealed_at: new Date().toISOString(),
  };

  try {
    const result = await deps.vaultAppend(vaultRecord);

    return {
      verdict: "SEALED",
      sealed: true,
      vault_seq: result.seq,
      error: "",
      composite_hash: input.tri_witness_ledger.composite_hash,
    };
  } catch (err) {
    // I5: Any mismatch → REJECTED, never partial seal
    return {
      verdict: "REJECTED",
      sealed: false,
      vault_seq: -1,
      error: `VAULT_APPEND_FAILED: ${err instanceof Error ? err.message : String(err)}`,
      composite_hash: input.tri_witness_ledger.composite_hash,
      rejection_reason: "VAULT999 append failed — seal aborted, no partial state",
    };
  }
}

// ============================================================================
// HERMES ROUTING RULE — W³ Gate
// ============================================================================

/**
 * Pre-seal routing check for Hermes.
 *
 * No call to sealVisualComposite is allowed unless:
 *   1. W³ is fully populated (all three witnesses present)
 *   2. All three witness hashes are valid SHA-256
 *   3. Composite hash is present and valid
 *   4. Entropy gate has already passed (caller must attest)
 *   5. Verdict is either PASS_CANDIDATE or SEALED_DEPLOY
 *
 * This is the Hermes routing guard — it blocks premature seal attempts.
 */
export function routingGuardPreSeal(input: {
  tri_witness_ledger?: TriWitnessLedgerInput | null;
  entropy_gate_passed?: boolean;
  verdict?: string;
}): { kind: "allowed" } | { kind: "blocked"; reason: string } {
  // Gate 1: W³ must be fully populated
  if (!input.tri_witness_ledger) {
    return { kind: "blocked", reason: "W³_NOT_POPULATED: tri_witness_ledger is missing" };
  }

  const { w1, w2, w3, composite_hash } = input.tri_witness_ledger;

  // Gate 2: All witness hashes must be valid SHA-256
  const sha256Pattern = /^[a-f0-9]{64}$/;
  if (!sha256Pattern.test(w1.hash)) {
    return { kind: "blocked", reason: "W1_HASH_INVALID: w1.hash is not SHA-256" };
  }
  if (!sha256Pattern.test(w2.hash)) {
    return { kind: "blocked", reason: "W2_HASH_INVALID: w2.hash is not SHA-256" };
  }
  if (!sha256Pattern.test(w3.hash)) {
    return { kind: "blocked", reason: "W3_HASH_INVALID: w3.hash is not SHA-256" };
  }

  // Gate 3: Composite hash must be present and valid
  if (!sha256Pattern.test(composite_hash)) {
    return { kind: "blocked", reason: "COMPOSITE_HASH_INVALID: not SHA-256" };
  }

  // Gate 4: Entropy gate must have passed
  if (input.entropy_gate_passed !== true) {
    return { kind: "blocked", reason: "ENTROPY_GATE_NOT_PASSED: ΔS gate must pass before seal" };
  }

  // Gate 5: Verdict must be sealable
  if (input.verdict !== "PASS_CANDIDATE" && input.verdict !== "SEALED_DEPLOY") {
    return {
      kind: "blocked",
      reason: `VERDICT_NOT_SEALABLE: "${input.verdict}" cannot proceed to seal`,
    };
  }

  return { kind: "allowed" };
}
