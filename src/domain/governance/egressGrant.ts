/**
 * HUMAN_RASA G1 — per-message egress grant verification (2026-11-01).
 *
 * A sent message cannot be recalled. The 2026-10-18 F13 lane lets gmail send
 * ride a STANDING authorization (cc_id F13_EMAIL_SEND); this module adds the
 * missing per-message binding, gated behind AFORGE_EGRESS_PER_MESSAGE_GRANT
 * (default "0" — NOT flipped here; flipping revokes the standing lane and is
 * a sovereign decision).
 *
 * SCOPE: verification only. Grant issuance is NOT built here — the caller
 * supplies a record (grant_record) or points at one (grant_path). If no grant
 * record can be read, that is UNKNOWN → HOLD (fail-closed, F2/F9).
 *
 * A grant record binds exactly:
 *   { grant_id, recipient, payload_sha256 = sha256(subject + body),
 *     expires_at, issued_by }
 *
 * Every mismatch → HOLD with a reason code. No grant record store, no issuance
 * policy, no clock source beyond Date — those belong to whoever builds issuance.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/** Env flag name only — never read or write .env files. */
export const EGRESS_PER_MESSAGE_GRANT_FLAG = "AFORGE_EGRESS_PER_MESSAGE_GRANT";

/**
 * Per-message grant enforcement is OFF unless the flag is exactly "1".
 * Unset / "0" / any other value → off (existing lanes behave as before).
 */
export function perMessageGrantEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env[EGRESS_PER_MESSAGE_GRANT_FLAG] ?? "0").trim() === "1";
}

/** SHA-256 hex digest of a UTF-8 string. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** The stored record a grant_id must bind to. Verification-only contract. */
export interface EgressGrantRecord {
  grant_id: string;
  recipient: string;
  payload_sha256: string;
  expires_at: string;
  issued_by: string;
}

export type EgressGrantVerdict =
  | { hold: false; skipped?: boolean }
  | { hold: true; code: string; reason: string };

export interface EgressGrantCheckParams {
  /** grant_id the caller claims authorizes this exact send. */
  grantId?: unknown;
  /** The stored grant record, supplied inline by the caller. */
  grantRecord?: unknown;
  /** Path to a JSON grant record the caller points at (alternative to grantRecord). */
  grantPath?: string;
  /** Actual recipient of THIS send (chat_id / to) — bound into the grant. */
  recipient: string;
  /** Actual subject of THIS send ("" for Telegram — it has no subject). */
  subject: string;
  /** Actual body/text of THIS send. */
  body: string;
  /** Test seam; defaults to process.env. */
  env?: NodeJS.ProcessEnv;
}

/**
 * Verify a per-message egress grant. Fail-closed:
 *  - flag off            → { hold: false, skipped: true } (behaviour unchanged)
 *  - no grant_id         → HOLD GRANT_REQUIRED
 *  - no readable record  → HOLD GRANT_RECORD_UNKNOWN (UNKNOWN ≠ valid)
 *  - any binding mismatch→ HOLD with the specific code
 *  - all bindings match  → { hold: false }
 */
export function checkEgressGrant(params: EgressGrantCheckParams): EgressGrantVerdict {
  const env = params.env ?? process.env;
  if (!perMessageGrantEnabled(env)) return { hold: false, skipped: true };

  const grantId = typeof params.grantId === "string" ? params.grantId.trim() : "";
  if (!grantId) {
    return {
      hold: true,
      code: "GRANT_REQUIRED",
      reason: "AFORGE_EGRESS_PER_MESSAGE_GRANT=1 requires a grant_id for egress send; none supplied",
    };
  }

  // Resolve the record the caller supplies or points at. Anything unreadable
  // or unparseable is UNKNOWN — never silently treated as absent-but-fine.
  let record: EgressGrantRecord | null = null;
  if (params.grantRecord !== undefined && params.grantRecord !== null) {
    if (typeof params.grantRecord === "object" && !Array.isArray(params.grantRecord)) {
      record = params.grantRecord as EgressGrantRecord;
    }
  } else if (typeof params.grantPath === "string" && params.grantPath.trim() !== "") {
    try {
      const parsed: unknown = JSON.parse(readFileSync(params.grantPath, "utf8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        record = parsed as EgressGrantRecord;
      }
    } catch {
      record = null;
    }
  }
  if (!record) {
    return {
      hold: true,
      code: "GRANT_RECORD_UNKNOWN",
      reason:
        "no grant record could be read (grant_record missing/unreadable or grant_path unreadable) — UNKNOWN is fail-closed HOLD, not PASS",
    };
  }

  if (record.grant_id !== grantId) {
    return {
      hold: true,
      code: "GRANT_ID_MISMATCH",
      reason: `grant record is bound to a different grant_id (supplied ${grantId}, record ${String(record.grant_id)})`,
    };
  }
  if (record.recipient !== params.recipient) {
    return {
      hold: true,
      code: "GRANT_RECIPIENT_MISMATCH",
      reason: `grant binds a different recipient (supplied ${params.recipient}, record ${String(record.recipient)})`,
    };
  }
  const expected = sha256Hex(params.subject + params.body);
  if (record.payload_sha256 !== expected) {
    return {
      hold: true,
      code: "GRANT_PAYLOAD_MISMATCH",
      reason: "grant payload hash does not match sha256(subject+body) of this send — subject/body tampered or wrong grant",
    };
  }
  const expiresAt = Date.parse(String(record.expires_at));
  if (Number.isNaN(expiresAt)) {
    return {
      hold: true,
      code: "GRANT_EXPIRY_INVALID",
      reason: `grant expires_at is missing or unparseable (${String(record.expires_at)}) — cannot verify validity window`,
    };
  }
  if (Date.now() >= expiresAt) {
    return {
      hold: true,
      code: "GRANT_EXPIRED",
      reason: `grant expired at ${record.expires_at}`,
    };
  }
  if (typeof record.issued_by !== "string" || record.issued_by.trim() === "") {
    return {
      hold: true,
      code: "GRANT_ISSUER_MISSING",
      reason: "grant record carries no issued_by — issuer binding is mandatory",
    };
  }

  return { hold: false };
}
