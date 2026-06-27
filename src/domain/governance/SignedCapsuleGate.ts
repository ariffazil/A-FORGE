import { createHash, verify as verifyDetached } from "node:crypto";
import { readFileSync } from "node:fs";

export interface SignedVerdictCapsulePayload {
  did: string;
  ts: number;
  verdict: string;
  artifact_path: string;
  capsule_hash: string;
  actor: string;
  authority: string;
  meta?: Record<string, unknown>;
}

export interface SignedVerdictCapsule extends SignedVerdictCapsulePayload {
  sig_alg: "Ed25519";
  sig: string; // base64
}

export interface SignedCapsuleVerification {
  ok: boolean;
  reason?: string;
  did?: string;
  verdict?: string;
  capsule_hash?: string;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stable);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stable(v)]),
    );
  }
  return value;
}

function canonicalJson(data: Record<string, unknown>): Buffer {
  return Buffer.from(JSON.stringify(stable(data)));
}

function sha256File(filePath: string): string {
  const buf = readFileSync(filePath);
  return `sha256:${createHash("sha256").update(buf).digest("hex")}`;
}

export function verifySignedCapsule(
  capsule: SignedVerdictCapsule,
  publicKeyRaw: Buffer,
): SignedCapsuleVerification {
  if (capsule.sig_alg !== "Ed25519") {
    return { ok: false, reason: `unsupported sig_alg ${capsule.sig_alg}` };
  }

  const { sig, sig_alg, ...payload } = capsule;
  const msg = canonicalJson(payload as Record<string, unknown>);
  const ok = verifyDetached(null, msg, {
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      publicKeyRaw,
    ]),
    format: "der",
    type: "spki",
  }, Buffer.from(sig, "base64"));

  if (!ok) {
    return { ok: false, reason: "signature verification failed" };
  }

  const observedHash = sha256File(capsule.artifact_path);
  if (observedHash !== capsule.capsule_hash) {
    return {
      ok: false,
      reason: `capsule hash mismatch expected=${capsule.capsule_hash} observed=${observedHash}`,
    };
  }

  return {
    ok: true,
    did: capsule.did,
    verdict: capsule.verdict,
    capsule_hash: capsule.capsule_hash,
  };
}

export function requireSignedExecutionCapsule(
  capsule: SignedVerdictCapsule | null | undefined,
  publicKeyRaw: Buffer,
): { ok: true } | { ok: false; code: "UNSIGNED_EXECUTION" | "INVALID_SIGNATURE"; reason: string } {
  if (!capsule) {
    return {
      ok: false,
      code: "UNSIGNED_EXECUTION",
      reason: "execution payload missing signed verdict capsule",
    };
  }

  const verdict = verifySignedCapsule(capsule, publicKeyRaw);
  if (!verdict.ok) {
    return {
      ok: false,
      code: "INVALID_SIGNATURE",
      reason: verdict.reason ?? "signature verification failed",
    };
  }

  return { ok: true };
}
