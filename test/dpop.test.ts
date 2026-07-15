import { describe, it } from "node:test";
import assert from "node:assert";
import { createHash } from "node:crypto";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { extractTokenCnfJkt, verifyDpopProof } from "../src/interfaces/middleware/dpop.js";

function base64UrlSha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

async function makeProof(url: string, accessToken: string, privateKey: any, publicJwk: JWK, jti = "jti-1") {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    htu: url,
    htm: "POST",
    iat: now,
    jti,
    ath: base64UrlSha256(accessToken),
  })
    .setProtectedHeader({ alg: "ES256", typ: "dpop+jwt", jwk: publicJwk })
    .sign(privateKey);
}

describe("DPoP middleware", () => {
  it("accepts valid proof bound to bearer and cnf.jkt", async () => {
    const { publicKey, privateKey } = await generateKeyPair("ES256");
    const publicJwk = await exportJWK(publicKey);
    const thumbprintResult = await verifyDpopProof({
      proof: await makeProof("https://forge.arif-fazil.com/mcp", "bootstrap-token", privateKey, publicJwk, "bootstrap-jti"),
      method: "POST",
      url: "https://forge.arif-fazil.com/mcp",
      accessToken: "bootstrap-token",
    });
    const jkt = thumbprintResult.jwkThumbprint!;
    const accessToken = [
      Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"),
      Buffer.from(JSON.stringify({ sub: "arif", cnf: { jkt } })).toString("base64url"),
      "",
    ].join(".");
    const proof = await makeProof("https://forge.arif-fazil.com/mcp", accessToken, privateKey, publicJwk, "valid-jti");

    const result = await verifyDpopProof({
      proof,
      method: "POST",
      url: "https://forge.arif-fazil.com/mcp",
      accessToken,
      accessTokenCnfJkt: extractTokenCnfJkt(accessToken),
    });

    assert.equal(result.ok, true);
    assert.equal(result.jwkThumbprint, jkt);
  });

  it("rejects replayed jti", async () => {
    const { publicKey, privateKey } = await generateKeyPair("ES256");
    const publicJwk = await exportJWK(publicKey);
    const accessToken = "opaque-bearer";
    const proof = await makeProof("https://forge.arif-fazil.com/mcp", accessToken, privateKey, publicJwk, "same-jti");

    const first = await verifyDpopProof({
      proof,
      method: "POST",
      url: "https://forge.arif-fazil.com/mcp",
      accessToken,
    });
    const second = await verifyDpopProof({
      proof,
      method: "POST",
      url: "https://forge.arif-fazil.com/mcp",
      accessToken,
    });

    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    assert.equal(second.error, "dpop_replay_detected");
  });
});
