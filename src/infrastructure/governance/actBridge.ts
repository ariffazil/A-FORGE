/**
 * ACT Cross-Domain Bridge — arifOS Python kernel ↔ A-FORGE Node.js
 *
 * The federation has ONE canonical ACT issuer: the arifOS Python kernel
 * (`act_token.py::mint_act`). A-FORGE (Node.js) must be able to:
 *
 *   1. VERIFY tokens minted by arifOS — without a Python roundtrip.
 *      (fast-path; arifOS roundtrip remains as fallback for format drift)
 *   2. MINT tokens in the IDENTICAL wire format — so arifOS and other
 *      organs can verify A-FORGE-issued tokens the same way.
 *
 * Canonical wire format (MUST match arifOS act_token.py exactly):
 *   act_v1.<base64url(payload_json, sorted keys, no spaces)>.<hmac_sha256_hex[:16]>
 *
 * Payload claims (MUST match arifOS mint_act exactly):
 *   act_v, sid, actor, auth, av, stage, lane, iat, exp, ttl, nbf, kid,
 *   verdict{state,dominant_reason}, apex{G,C_dark,W3,h}, witness{active,diversity},
 *   allowed[]
 *
 * Signature (MUST match arifOS _sign() exactly):
 *   hmac.new(secret, payload_b64.encode("ascii"), sha256).hexdigest()[:16]
 *
 * DITEMPA BUKAN DIBERI — The bridge is forged to the issuer's format,
 * not the other way around. A-FORGE does not define its own token format;
 * it mirrors the kernel's. When arifOS upgrades (e.g. full 64-char HMAC),
 * the bridge upgrades with it, atomically.
 *
 * P2.1 (2026-08-07): sct_v1.* and arifos.v1.* legacy prefixes remain
 * dual-accepted for verification while tokens minted before the rename
 * are still within TTL. Sunset decision: see MIGRATION_WINDOW note.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

/** Canonical prefixes. arifOS mints act_v1 only. Verify dual-accepts the legacy two. */
export const ACT_PREFIX = "act_v1";
export const LEGACY_SCT_PREFIX = "sct_v1";
export const LEGACY_ARIFOS_PREFIX = "arifos.v1";

/**
 * MIGRATION WINDOW (item 3b, 2026-08-07):
 * sct_v1 / arifos.v1 are still in the live migration window because
 * tokens minted before the 2026-08-07 rename carry those prefixes and
 * have up to 8h TTL remaining. Decision: KEEP dual-accept for verify
 * until 2026-08-08 00:00 UTC (one full TTL cycle), then DELETE the
 * legacy branches in BOTH arifOS verify_sct() and this bridge together.
 * Mint NEVER produces legacy prefixes.
 */
export const SCT_LEGACY_SUNSET_UTC = "2026-08-08T00:00:00Z";

export interface ActClaims {
  act_v: number;
  sid: string;
  actor: string;
  auth: string;
  av: boolean;
  stage: string;
  lane: string;
  iat: number;
  exp: number;
  ttl: number;
  nbf: number;
  kid: string;
  verdict: { state: string; dominant_reason: string | null };
  apex: { G: unknown; C_dark: unknown; W3: unknown; h: unknown };
  witness: { active: number; diversity: string };
  allowed: string[];
}

export interface ActMintOptions {
  sid: string;
  actor: string;
  auth: string;
  av: boolean;
  stage?: string;
  lane?: string;
  ttl?: number;
  kid?: string;
  verdictState?: string;
  apex?: Partial<ActClaims["apex"]>;
  witness?: Partial<ActClaims["witness"]>;
  allowed?: string[];
}

/** Resolve the shared ARIFOS_SESSION_SECRET. Same env contract as arifOS. */
export function resolveActSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.ARIFOS_SESSION_SECRET;
  if (secret && secret.length > 0) return secret;
  // File fallback mirrors arifOS _get_signing_secret() production paths.
  const candidates = [
    env.ARIFOS_SESSION_SECRET_FILE,
    "/opt/arifos/app/.signing_key",
    "/root/.arifos/signing_key",
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try {
      const raw = readFileSync(p, "utf8").trim();
      if (raw) return raw;
    } catch {
      /* try next */
    }
  }
  throw new Error("ARIFOS_SESSION_SECRET not configured — ACT bridge cannot sign");
}

function b64urlEncode(raw: Buffer): string {
  return raw.toString("base64url");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

/** Canonical HMAC signer — MUST mirror arifOS `_sign()` (hexdigest[:16]). */
export function signActPayload(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64, "ascii").digest("hex").slice(0, 16);
}

/**
 * Mint an ACT in the arifOS canonical wire format.
 * This is the ONLY mint path in A-FORGE. Produces act_v1.* only.
 */
export function mintAct(
  opts: ActMintOptions,
  env: NodeJS.ProcessEnv = process.env,
): { token: string; claims: ActClaims } {
  const secret = resolveActSecret(env);
  const now = Math.floor(Date.now() / 1000);
  const ttl = opts.ttl ?? 28800; // 8h — mirrors arifOS DEFAULT_TTL_SECONDS
  const authNorm = (opts.auth || "OBSERVE_ONLY").toUpperCase();

  const claims: ActClaims = {
    act_v: 1,
    sid: opts.sid,
    actor: opts.actor,
    auth: authNorm,
    av: Boolean(opts.av),
    stage: opts.stage || "000",
    lane: opts.lane || "AGI",
    iat: now,
    exp: now + ttl,
    ttl,
    nbf: now,
    kid: opts.kid || "default",
    verdict: {
      state: opts.verdictState || "OK",
      dominant_reason: null,
    },
    apex: {
      G: opts.apex?.G ?? "UNMEASURED",
      C_dark: opts.apex?.C_dark ?? "UNMEASURED",
      W3: opts.apex?.W3 ?? "UNMEASURED",
      h: opts.apex?.h ?? "UNMEASURED",
    },
    witness: {
      active: opts.witness?.active ?? (opts.av ? 1 : 0),
      diversity: opts.witness?.diversity ?? (opts.av ? "PARTIAL" : "NONE"),
    },
    allowed: opts.allowed ?? [],
  };

  // MUST mirror arifOS: json.dumps(claims, sort_keys=True, separators=(",", ":"))
  const dump = JSON.stringify(claims, Object.keys(claims).sort());
  const payloadB64 = b64urlEncode(Buffer.from(dump, "utf8"));
  const sig = signActPayload(payloadB64, secret);
  return { token: `${ACT_PREFIX}.${payloadB64}.${sig}`, claims };
}

export type ActVerifyResult =
  | { ok: true; claims: ActClaims; actor: string; authority: string }
  | { ok: false; error: string; message: string };

/**
 * Verify an ACT against the canonical arifOS format.
 * Prefixes: act_v1 (canonical) + sct_v1 / arifos.v1 (legacy dual-accept).
 * Checks: structure → prefix → HMAC → version → exp/nbf → actor (optional).
 */
export function verifyAct(
  token: string | null | undefined,
  opts: { expectedActor?: string | null; requiredAuthority?: string } = {},
  env: NodeJS.ProcessEnv = process.env,
): ActVerifyResult {
  if (!token || typeof token !== "string") {
    return { ok: false, error: "ACT_MISSING", message: "No ACT provided" };
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { ok: false, error: "ERR_ACT_MALFORMED", message: `Expected <prefix>.<payload>.<sig> (3 segments), got ${parts.length}` };
  }
  const [prefix, payloadB64, sigHex] = parts;
  if (prefix !== ACT_PREFIX && prefix !== LEGACY_SCT_PREFIX && prefix !== LEGACY_ARIFOS_PREFIX) {
    return { ok: false, error: "ERR_ACT_PREFIX", message: `Unknown prefix: ${prefix}` };
  }
  if (!sigHex || sigHex.length < 16) {
    return { ok: false, error: "ERR_ACT_SIGNATURE_SHORT", message: "HMAC signature too short" };
  }

  let secret: string;
  try {
    secret = resolveActSecret(env);
  } catch (e) {
    return { ok: false, error: "ERR_ACT_NO_SECRET", message: e instanceof Error ? e.message : "no secret" };
  }

  const expectedSig = signActPayload(payloadB64, secret);
  const receivedSig = sigHex.slice(0, 16);
  const a = Buffer.from(expectedSig, "ascii");
  const b = Buffer.from(receivedSig, "ascii");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "ERR_ACT_SIGNATURE_INVALID", message: "HMAC-SHA256 signature mismatch" };
  }

  let claims: ActClaims;
  try {
    claims = JSON.parse(b64urlDecode(payloadB64).toString("utf8")) as ActClaims;
  } catch {
    return { ok: false, error: "ERR_ACT_PAYLOAD", message: "payload JSON parse failed" };
  }

  const version = (claims as { sct_v?: number }).sct_v ?? claims.act_v;
  if (version !== 1) {
    return { ok: false, error: "ACT_VERSION", message: `Unsupported ACT version: ${version}` };
  }

  const nowSec = Date.now() / 1000;
  if (typeof claims.exp === "number" && nowSec > claims.exp) {
    return { ok: false, error: "ACT_EXPIRED", message: `Token expired at ${new Date(claims.exp * 1000).toISOString()}` };
  }
  if (typeof claims.nbf === "number" && nowSec < claims.nbf) {
    return { ok: false, error: "ACT_NOT_YET_VALID", message: `Token not valid before ${new Date(claims.nbf * 1000).toISOString()}` };
  }

  const actor = String(claims.actor || "");
  if (opts.expectedActor) {
    const expected = String(opts.expectedActor).trim().toLowerCase();
    if (actor.toLowerCase() !== expected) {
      return { ok: false, error: "ERR_ACT_BINDING_INVALID", message: `ACT actor "${actor}" vs caller "${opts.expectedActor}"` };
    }
  }

  const authority = String(claims.auth || "OBSERVE_ONLY");
  if (opts.requiredAuthority) {
    const RANK = ["OBSERVE_ONLY", "OPERATOR", "LIMITED_MUTATE", "FULL", "SOVEREIGN"];
    const authIdx = RANK.indexOf(authority);
    const reqIdx = RANK.indexOf(opts.requiredAuthority);
    if (authIdx < 0 || reqIdx < 0 || authIdx < reqIdx) {
      return { ok: false, error: "INSUFFICIENT_AUTHORITY", message: `ACT ${authority} < required ${opts.requiredAuthority}` };
    }
  }

  return { ok: true, claims, actor, authority };
}

/** True while legacy prefixes are in the migration window. */
export function sctLegacyInMigrationWindow(nowIso: string = new Date().toISOString()): boolean {
  return nowIso < SCT_LEGACY_SUNSET_UTC;
}
