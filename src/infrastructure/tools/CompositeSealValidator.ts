/**
 * @file CompositeSealValidator.ts — VAULT999 Composite Seal Validator
 * @description Pre-seal gate that proves composite_hash correctness and
 *              all witnesses passed before anything can be sealed to VAULT999.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 *
 * INVARIANTS:
 *   I1: verdict must be "SEALED_DEPLOY"
 *   I2: w1.verdict, w2.verdict, w3.verdict must all be "PASS"
 *   I3: All witness hashes must match /^[a-f0-9]{64}$/
 *   I4: Recomputed composite_hash === provided composite_hash (tampering detection)
 *   I5: W3 must have actor_id and timestamp (sovereign identity required)
 *
 * CONSTITUTIONAL BASIS:
 *   F1  AMANAH  — Cannot self-grant seal. Only after validator passes.
 *   F2  TRUTH   — SHA256 recomputation proves integrity, not assertion.
 *   F3  WITNESS — W³ tri-witness bound to composite_hash.
 *   F11 AUDIT   — Every seal attempt logged with rejection reason.
 *
 * @author arifOS Federation
 * @version 1.0.0
 * @constitutional true
 */

import { createHash } from "node:crypto";
import { z } from "zod";

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const WitnessVerdictEnum = z.enum(["PASS", "HOLD", "FAIL", "PENDING"]);
export type WitnessVerdictEnum = z.infer<typeof WitnessVerdictEnum>;

export const WitnessEntry = z.object({
  verdict: WitnessVerdictEnum,
  hash: z.string().regex(/^[a-f0-9]{64}$/, "Must be 64-char lowercase hex (SHA-256)"),
  score: z.number().optional(),
  actor_id: z.string().optional(),
  timestamp: z.string().optional(), // ISO8601
});
export type WitnessEntry = z.infer<typeof WitnessEntry>;

export const TriWitnessSealInput = z.object({
  w1: WitnessEntry,
  w2: WitnessEntry,
  w3: WitnessEntry,
  verdict: z.string(),
  composite_hash: z.string(),
});
export type TriWitnessSealInput = z.infer<typeof TriWitnessSealInput>;

export const SealResult = z.object({
  verdict: z.enum(["SEALED", "REJECTED"]),
  sealed: z.boolean(),
  vault_seq: z.number(),
});
export type SealResult = z.infer<typeof SealResult>;

// ============================================================================
// SHA256 RECOMPUTATION
// ============================================================================

/**
 * Compute composite_hash = SHA256(w1.hash + w2.hash + w3.hash + verdict)
 *
 * Exact concatenation — no separators. This must produce the SAME bytes
 * as the original computation at seal time.
 *
 * F2 TRUTH: Cryptographic proof of tri-witness consensus binding.
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
// VALIDATION ERROR TYPES
// ============================================================================

export type RejectionReason =
  | "INVALID_VERDICT"
  | "WITNESS_NOT_PASS"
  | "INVALID_HASH_FORMAT"
  | "COMPOSITE_HASH_TAMPERED"
  | "W3_MISSING_ACTOR_ID"
  | "W3_MISSING_TIMESTAMP"
  | "ZOD_VALIDATION_FAILED";

export interface ValidationError {
  reason: RejectionReason;
  detail: string;
}

// ============================================================================
// COMPOSITE SEAL VALIDATOR
// ============================================================================

/**
 * Validate composite seal — the pre-seal gate that runs BEFORE arif_seal.
 *
 * Returns { verdict: "SEALED", sealed: true, vault_seq: N } only when ALL
 * 5 checks pass. Otherwise REJECTS with a specific error reason.
 *
 * On acceptance, calls vault999Append to persist the seal record.
 */
export async function validateCompositeSeal(
  input: unknown,
  deps: {
    vault999Append: (record: unknown) => Promise<{ seq: number }>;
  },
): Promise<{ result: SealResult; error?: ValidationError }> {
  // ── Zod parse ────────────────────────────────────────────────
  const parsed = TriWitnessSealInput.safeParse(input);
  if (!parsed.success) {
    return {
      result: { verdict: "REJECTED", sealed: false, vault_seq: -1 },
      error: {
        reason: "ZOD_VALIDATION_FAILED",
        detail: parsed.error.issues.map(i => i.message).join("; "),
      },
    };
  }

  const { w1, w2, w3, verdict, composite_hash } = parsed.data;

  // ── CHECK 1: verdict must be "SEALED_DEPLOY" ─────────────────
  if (verdict !== "SEALED_DEPLOY") {
    return {
      result: { verdict: "REJECTED", sealed: false, vault_seq: -1 },
      error: {
        reason: "INVALID_VERDICT",
        detail: `verdict is "${verdict}", must be "SEALED_DEPLOY"`,
      },
    };
  }

  // ── CHECK 2: All witnesses must be "PASS" ────────────────────
  for (const [label, witness] of [["w1", w1], ["w2", w2], ["w3", w3]] as const) {
    if (witness.verdict !== "PASS") {
      return {
        result: { verdict: "REJECTED", sealed: false, vault_seq: -1 },
        error: {
          reason: "WITNESS_NOT_PASS",
          detail: `${label}.verdict is "${witness.verdict}", must be "PASS"`,
        },
      };
    }
  }

  // ── CHECK 3: All witness hashes must be valid SHA-256 hex ────
  const sha256Pattern = /^[a-f0-9]{64}$/;
  for (const [label, witness] of [["w1", w1], ["w2", w2], ["w3", w3]] as const) {
    if (!sha256Pattern.test(witness.hash)) {
      return {
        result: { verdict: "REJECTED", sealed: false, vault_seq: -1 },
        error: {
          reason: "INVALID_HASH_FORMAT",
          detail: `${label}.hash "${witness.hash}" does not match /^[a-f0-9]{64}$/`,
        },
      };
    }
  }

  // ── CHECK 4: Recomputed composite_hash must match ────────────
  const recomputed = computeCompositeHash(w1.hash, w2.hash, w3.hash, verdict);
  if (recomputed !== composite_hash) {
    return {
      result: { verdict: "REJECTED", sealed: false, vault_seq: -1 },
      error: {
        reason: "COMPOSITE_HASH_TAMPERED",
        detail: `recomputed=${recomputed}, provided=${composite_hash}`,
      },
    };
  }

  // ── CHECK 5: W3 must have actor_id and timestamp ─────────────
  if (!w3.actor_id) {
    return {
      result: { verdict: "REJECTED", sealed: false, vault_seq: -1 },
      error: {
        reason: "W3_MISSING_ACTOR_ID",
        detail: "W3 must have actor_id (sovereign identity required)",
      },
    };
  }
  if (!w3.timestamp) {
    return {
      result: { verdict: "REJECTED", sealed: false, vault_seq: -1 },
      error: {
        reason: "W3_MISSING_TIMESTAMP",
        detail: "W3 must have timestamp (ISO8601 required)",
      },
    };
  }

  // ── ALL CHECKS PASSED → append to VAULT999 ──────────────────
  const vaultRecord = {
    type: "COMPOSITE_SEAL",
    composite_hash,
    verdict,
    w1_verdict: w1.verdict,
    w2_verdict: w2.verdict,
    w3_verdict: w3.verdict,
    w3_actor_id: w3.actor_id,
    w3_timestamp: w3.timestamp,
    sealed_at: new Date().toISOString(),
  };

  const appendResult = await deps.vault999Append(vaultRecord);

  return {
    result: {
      verdict: "SEALED",
      sealed: true,
      vault_seq: appendResult.seq,
    },
  };
}
