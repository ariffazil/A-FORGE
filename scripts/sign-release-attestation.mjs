#!/usr/bin/env node
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  canonicalAttestationPayload,
  computeExecutableTreeSha256,
  computeFileSha256,
} from "../dist/src/domain/governance/McpPolicyGate.js";

const KEY_PRIV = process.env.AF_FORGE_ATTESTATION_PRIVKEY || "/etc/aforge/release-attestation.key.pem";
const KEY_PUB = process.env.AF_FORGE_ATTESTATION_PUBKEY || "/etc/aforge/release-attestation.pub.pem";
const ATT_OUT = process.env.AF_FORGE_RELEASE_ATTESTATION || "/var/lib/aforge/release-attestation.json";
const POLICY_PATH = "/root/A-FORGE/config/mcp_policies.json";
const GIT_COMMIT_PATH = "/root/A-FORGE/.git_commit";
const EXEC_DIR = "/root/A-FORGE/src";

mkdirSync(dirname(KEY_PRIV), { recursive: true });
mkdirSync(dirname(ATT_OUT), { recursive: true });

if (!existsSync(KEY_PRIV) || !existsSync(KEY_PUB)) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  writeFileSync(KEY_PRIV, privateKey, { mode: 0o600 });
  chmodSync(KEY_PRIV, 0o600);
  writeFileSync(KEY_PUB, publicKey, { mode: 0o644 });
  chmodSync(KEY_PUB, 0o644);
}

const releaseCommit = readFileSync(GIT_COMMIT_PATH, "utf-8").trim();
const policySha256 = computeFileSha256(POLICY_PATH);
const execSha256 = computeExecutableTreeSha256(EXEC_DIR);
if (!releaseCommit || !policySha256 || !execSha256) {
  throw new Error("Missing release_commit, policy_sha256, or executable_tree_sha256");
}

const body = {
  release_commit: releaseCommit,
  executable_tree_sha256: execSha256,
  policy_sha256: policySha256,
  issued_at: new Date().toISOString(),
  key_id: "ed25519:aforge-release",
};
const payload = canonicalAttestationPayload(body);
const privPem = readFileSync(KEY_PRIV, "utf-8");
const signature = cryptoSign(null, Buffer.from(payload, "utf8"), privPem).toString("base64");

const attestation = { ...body, signature };
writeFileSync(ATT_OUT, JSON.stringify(attestation, null, 2) + "\n", { mode: 0o644 });
chmodSync(ATT_OUT, 0o644);
console.log(JSON.stringify({ ok: true, attestation_path: ATT_OUT, release_commit: releaseCommit.slice(0, 7), policy_sha256: policySha256, executable_tree_sha256: execSha256 }));
