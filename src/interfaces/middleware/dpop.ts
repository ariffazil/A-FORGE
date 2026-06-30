import { createHash } from "node:crypto";
import type { Request } from "express";
import { calculateJwkThumbprint, decodeJwt, decodeProtectedHeader, importJWK, jwtVerify, type JWK } from "jose";

export type DPoPMode = "off" | "observe" | "enforce";

export interface DPoPVerificationResult {
  ok: boolean;
  error?: string;
  jwkThumbprint?: string;
}

const ALLOWED_ALGORITHMS = new Set(["RS256", "ES256", "EdDSA"]);
const CLOCK_SKEW_SECONDS = Number.parseInt(process.env.AFORGE_DPOP_CLOCK_SKEW_MAX ?? "300", 10);
const REPLAY_TTL_MS = Number.parseInt(process.env.AFORGE_DPOP_REPLAY_TTL_MS ?? "300000", 10);
const replayCache = new Map<string, number>();

function base64UrlSha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

function cleanupReplayCache(now: number): void {
  for (const [jti, expiry] of replayCache.entries()) {
    if (expiry <= now) replayCache.delete(jti);
  }
}

function consumeJti(jti: string): boolean {
  const now = Date.now();
  cleanupReplayCache(now);
  const existing = replayCache.get(jti);
  if (existing && existing > now) return false;
  replayCache.set(jti, now + REPLAY_TTL_MS);
  return true;
}

export function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  if (!header.toLowerCase().startsWith("bearer ")) return undefined;
  return header.slice(7).trim();
}

export function extractTokenCnfJkt(token: string): string | undefined {
  try {
    const claims = decodeJwt(token);
    const cnf = claims.cnf;
    if (cnf && typeof cnf === "object" && "jkt" in cnf && typeof cnf.jkt === "string") {
      return cnf.jkt;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function requestUrl(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() || req.protocol || "http";
  const host = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim()
    || req.get("host")
    || "localhost";
  const path = req.originalUrl || req.url;
  return `${proto}://${host}${path}`;
}

export async function verifyDpopProof(input: {
  proof: string;
  method: string;
  url: string;
  accessToken: string;
  accessTokenCnfJkt?: string;
}): Promise<DPoPVerificationResult> {
  const { proof, method, url, accessToken, accessTokenCnfJkt } = input;
  if (!proof.trim()) return { ok: false, error: "missing_dpop_proof" };
  if (!accessToken.trim()) return { ok: false, error: "missing_bearer_token" };

  let header;
  try {
    header = decodeProtectedHeader(proof);
  } catch (error) {
    return { ok: false, error: `malformed_dpop_header: ${String(error)}` };
  }

  if (String(header.typ || "").toLowerCase() !== "dpop+jwt") {
    return { ok: false, error: "invalid_dpop_typ" };
  }
  if (typeof header.alg !== "string" || !ALLOWED_ALGORITHMS.has(header.alg)) {
    return { ok: false, error: `unsupported_dpop_alg: ${String(header.alg || "missing")}` };
  }
  if (!header.jwk || typeof header.jwk !== "object") {
    return { ok: false, error: "missing_dpop_jwk" };
  }

  const jwk = header.jwk as JWK;
  let thumbprint: string;
  try {
    thumbprint = await calculateJwkThumbprint(jwk, "sha256");
  } catch (error) {
    return { ok: false, error: `invalid_dpop_jwk: ${String(error)}` };
  }

  try {
    const key = await importJWK(jwk, header.alg);
    const verified = await jwtVerify(proof, key, {
      algorithms: [header.alg],
      typ: "dpop+jwt",
      clockTolerance: CLOCK_SKEW_SECONDS,
    });
    const claims = verified.payload;

    if (String(claims.htm || "").toUpperCase() !== method.toUpperCase()) {
      return { ok: false, error: "dpop_htm_mismatch" };
    }
    if (String(claims.htu || "") !== url) {
      return { ok: false, error: "dpop_htu_mismatch" };
    }
    if (typeof claims.iat !== "number" || Math.abs(Math.floor(Date.now() / 1000) - claims.iat) > CLOCK_SKEW_SECONDS) {
      return { ok: false, error: "dpop_iat_out_of_window" };
    }
    if (typeof claims.jti !== "string" || !claims.jti) {
      return { ok: false, error: "missing_dpop_jti" };
    }
    if (!consumeJti(claims.jti)) {
      return { ok: false, error: "dpop_replay_detected" };
    }
    if (typeof claims.ath !== "string" || !claims.ath) {
      return { ok: false, error: "missing_dpop_ath" };
    }
    if (claims.ath !== base64UrlSha256(accessToken)) {
      return { ok: false, error: "dpop_ath_mismatch" };
    }
    if (accessTokenCnfJkt && thumbprint !== accessTokenCnfJkt) {
      return { ok: false, error: "dpop_cnf_jkt_mismatch" };
    }
    return { ok: true, jwkThumbprint: thumbprint };
  } catch (error) {
    return { ok: false, error: `dpop_signature_verification_failed: ${String(error)}` };
  }
}

export async function verifyRequestDpop(req: Request): Promise<DPoPVerificationResult> {
  const accessToken = extractBearerToken(req);
  if (!accessToken) return { ok: true };
  const proof = req.headers.dpop;
  if (typeof proof !== "string" || !proof.trim()) {
    return { ok: false, error: "missing_dpop_proof" };
  }
  return verifyDpopProof({
    proof,
    method: req.method,
    url: requestUrl(req),
    accessToken,
    accessTokenCnfJkt: extractTokenCnfJkt(accessToken),
  });
}

export function getDpopMode(): DPoPMode {
  const raw = (process.env.AFORGE_DPOP_MODE ?? "observe").trim().toLowerCase();
  if (raw === "off" || raw === "observe" || raw === "enforce") return raw;
  return "observe";
}
