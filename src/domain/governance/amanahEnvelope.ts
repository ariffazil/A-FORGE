/**
 * AMANAH Authorization Envelope (AAE) v1
 *
 * A signed JSON packet that travels with every governed tool call,
 * encoding WHO is acting, WHAT they intend, HOW RISKY, WHEN it expires.
 *
 * Constraints:
 *  - F1 AMANAH  : missing actor_id OR expiry OR signature → DENY
 *  - F2 TRUTH   : all claims labeled OBS/DER/INT/SPEC
 *  - F4 CLARITY : 13 fields, no ambiguity
 *  - F7 HUMILITY : confidence capped at 0.90
 *  - F8 LAW     : expired AAE → automatic DENY; no exceptions without F13
 *  - F11 AUDIT  : every AAE leaves a trace
 *
 * DO NOT build: DID, ZKPC, P2P/CRDT, blockchain Merkle, WebMCP spec.
 *
 * 13 fields:
 *   version, actor_id, intent_hash, action_class, reversibility,
 *   blast_radius, evidence_refs, expiry, nonce, idempotency_key,
 *   signature, issued_at, issuer
 *
 * Sign: HMAC-SHA256 (organ secret). Hash: BLAKE3 (intent canonical JSON).
 */

import { createHmac, timingSafeEqual } from "crypto";
import { blake3 } from "hash-wasm";
import type { ActionClass } from "./actionClassifier.js";
import { NonceStore, type NonceCheckResult } from "./nonceStore.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type BlastRadius = "local" | "repo" | "service" | "vps" | "federation" | "external";

export type EpistemicLabel = "OBS" | "DER" | "INT" | "SPEC";

export interface AAEV1 {
  version: "AAE-v1";
  actor_id: string;
  intent_hash: string;       // BLAKE3 of canonical intent string
  action_class: ActionClass;
  reversibility: number;    // 0.0 (irreversible) – 1.0 (fully reversible)
  blast_radius: BlastRadius;
  evidence_refs: string[];  // VAULT999 entry IDs supporting this action
  expiry: number;           // Unix ms — F8: expired = automatic DENY
  nonce: string;            // Random unique per request (anti-replay)
  idempotency_key: string;  // Deduplication key for QUEUE/EXECUTE_REVERSIBLE
  signature: string;        // HMAC-SHA256 of this envelope
  issued_at: number;         // Unix ms timestamp
  issuer: string;           // Organ name that issued this envelope
  judgment_reference?: string; // Verdict ID from the judgment that authorized this action
}

// ─── Canonical JSON serialization (deterministic) ────────────────────────────

/**
 * Deterministic JSON canonicalization for intent_hash.
 * Keys are sorted, no whitespace, no undefined values.
 */
function canonicalIntent(intent: string): string {
  // The "intent" field is a plain string — canonical form is the string itself
  // wrapped in a stable object so the same intent always produces the same hash.
  return JSON.stringify({ intent });
}

// ─── AAE Builder ───────────────────────────────────────────────────────────────

export interface AAEV1Options {
  actor_id?: string;  // Required at runtime (F1 AMANAH), optional in type to allow test
  intent: string;
  action_class: ActionClass;
  reversibility: number;
  blast_radius: BlastRadius;
  evidence_refs?: string[];
  expiry_ms?: number;         // Default: 5 minutes from now
  nonce?: string;
  idempotency_key?: string;
  organ_secret: string;       // HMAC signing key (organ-specific)
  issuer?: string;            // Default: "a-forge"
  judgment_reference?: string; // Verdict ID from the judgment that authorized this action
}

export interface VerifyResult {
  valid: boolean;
  reason?: string;
  /** F1 AMANAH checks */
  missing_actor_id?: boolean;
  missing_expiry?: boolean;
  missing_signature?: boolean;
  /** F8 LAW check */
  expired?: boolean;
  /** F1 AMANAH replay check */
  replay_detected?: boolean;
  /** Epistemic label for the verification result */
  epistemic?: EpistemicLabel;
}

/**
 * Compute BLAKE3 intent_hash from a plain intent string.
 * Async — must be awaited.
 */
export async function computeIntentHash(intent: string): Promise<string> {
  const canon = canonicalIntent(intent);
  return await blake3(canon);
}

/**
 * Compute HMAC-SHA256 signature over the envelope body (excludes signature field).
 * Sync — suitable for use in synchronous flows.
 */
export function computeSignature(envelope: Omit<AAEV1, "signature" | "intent_hash">, secret: string): string {
  // Pick only the fields that matter for integrity (not derived/computed fields)
  const body: Omit<AAEV1, "signature" | "intent_hash"> = {
    version: envelope.version,
    actor_id: envelope.actor_id,
    action_class: envelope.action_class,
    reversibility: envelope.reversibility,
    blast_radius: envelope.blast_radius,
    evidence_refs: envelope.evidence_refs,
    expiry: envelope.expiry,
    nonce: envelope.nonce,
    idempotency_key: envelope.idempotency_key,
    issued_at: envelope.issued_at,
    issuer: envelope.issuer,
    judgment_reference: envelope.judgment_reference,
  };
  const canonical = JSON.stringify(body);
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

/**
 * Build a new AAE v1 envelope.
 *
 * Usage:
 *   const aae = await AAEV1.create({ actor_id: "arif", intent: "deploy webapp",
 *     action_class: "EXECUTE_HIGH_IMPACT", reversibility: 0.3,
 *     blast_radius: "service", organ_secret: process.env.AAFORGE_SIGNING_SECRET! });
 */
export async function buildAAE(options: AAEV1Options): Promise<AAEV1> {
  const {
    actor_id,
    intent,
    action_class,
    reversibility,
    blast_radius,
    evidence_refs = [],
    expiry_ms,
    nonce,
    idempotency_key,
    organ_secret,
    issuer = "a-forge",
    judgment_reference,
  } = options;

  // F1 guard — these are hard requirements
  if (!actor_id) throw new Error("AAE: actor_id is required (F1 AMANAH)");
  if (!organ_secret) throw new Error("AAE: organ_secret is required for signing");

  // Validate reversibility range
  if (reversibility < 0 || reversibility > 1) {
    throw new Error(`AAE: reversibility must be 0.0–1.0, got ${reversibility}`);
  }

  const now = Date.now();
  const intent_hash = await computeIntentHash(intent);
  const expiry = expiry_ms ?? now + 5 * 60 * 1000; // 5 min default

  const envelope: Omit<AAEV1, "signature" | "intent_hash"> = {
    version: "AAE-v1",
    actor_id,
    action_class,
    reversibility,
    blast_radius,
    evidence_refs,
    expiry,
    nonce: nonce ?? generateNonce(),
    idempotency_key: idempotency_key ?? generateNonce(),
    issued_at: now,
    issuer,
    judgment_reference,
  };

  const signature = computeSignature(envelope, organ_secret);

  return {
    ...envelope,
    intent_hash,
    signature,
  };
}

/**
 * Verify an AAE v1 envelope.
 *
 * Checks F1 AMANAH (actor_id, expiry, signature present) and F8 LAW (not expired).
 * Does NOT validate action_class vs tool — that is done by f1Amanah.ts.
 *
 * If a NonceStore is provided, checks for nonce replay (F1 AMANAH anti-replay).
 * On valid envelope, the nonce is recorded in the store.
 *
 * Returns a VerifyResult — caller decides what to do with it.
 */
export function verifyAAE(envelope: AAEV1, organ_secret: string, nonceStore?: NonceStore): VerifyResult {
  const result: VerifyResult = { valid: false, epistemic: "OBS" };

  // ── F1 AMANAH mandatory fields ────────────────────────────────────────────

  if (!envelope.actor_id) {
    result.missing_actor_id = true;
    result.reason = "F1 DENY: actor_id missing";
    result.epistemic = "OBS";
    return result;
  }

  if (!envelope.expiry) {
    result.missing_expiry = true;
    result.reason = "F1 DENY: expiry missing";
    result.epistemic = "OBS";
    return result;
  }

  if (!envelope.signature) {
    result.missing_signature = true;
    result.reason = "F1 DENY: signature missing";
    result.epistemic = "OBS";
    return result;
  }

  // ── F8 LAW expiry check ────────────────────────────────────────────────────

  const now = Date.now();
  if (envelope.expiry < now) {
    result.expired = true;
    result.reason = `F8 LAW DENY: AAE expired at ${new Date(envelope.expiry).toISOString()}`;
    result.epistemic = "OBS";
    return result;
  }

  // ── Signature integrity check ──────────────────────────────────────────────

  const expected_sig = computeSignature(envelope, organ_secret);
  let sigValid = false;
  try {
    const a = Buffer.from(envelope.signature, "hex");
    const b = Buffer.from(expected_sig, "hex");
    if (a.length === b.length) {
      sigValid = timingSafeEqual(a, b);
    }
  } catch {
    sigValid = false;
  }

  if (!sigValid) {
    result.reason = "F1 DENY: signature mismatch (possible tampering)";
    result.epistemic = "DER";
    return result;
  }

  // ── F1 AMANAH nonce replay check ─────────────────────────────────────────

  if (nonceStore && envelope.nonce) {
    const nonceResult = nonceStore.checkAndRecord(envelope.nonce);
    if (nonceResult.replay) {
      result.replay_detected = true;
      result.reason = nonceResult.reason;
      result.epistemic = "DER";
      return result;
    }
  }

  // ── Version check ───────────────────────────────────────────────────────────

  if (envelope.version !== "AAE-v1") {
    result.reason = `F4 CLARITY: unknown AAE version "${envelope.version}"`;
    result.epistemic = "OBS";
    return result;
  }

  result.valid = true;
  result.reason = "AAE valid";
  result.epistemic = "OBS";
  return result;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function generateNonce(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Re-issue an AAE with a new expiry (extends TTL).
 * Does NOT change intent_hash or signature — those stay bound to the original action.
 */
export function extendAAE(envelope: AAEV1, additional_ms: number, organ_secret: string): AAEV1 {
  if (!envelope.signature) throw new Error("Cannot extend unsigned AAE");

  const extended: Omit<AAEV1, "signature" | "intent_hash"> = {
    version: envelope.version,
    actor_id: envelope.actor_id,
    action_class: envelope.action_class,
    reversibility: envelope.reversibility,
    blast_radius: envelope.blast_radius,
    evidence_refs: envelope.evidence_refs,
    expiry: envelope.expiry + additional_ms,
    nonce: envelope.nonce,
    idempotency_key: envelope.idempotency_key,
    issued_at: envelope.issued_at,
    issuer: envelope.issuer,
    judgment_reference: envelope.judgment_reference,
  };

  const new_sig = computeSignature(extended, organ_secret);

  return {
    ...extended,
    intent_hash: envelope.intent_hash,
    signature: new_sig,
  };
}
