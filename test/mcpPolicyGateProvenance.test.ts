import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  McpPolicyGate,
  canonicalAttestationPayload,
  computeExecutableTreeSha256,
  computeFileSha256,
} from "../src/domain/governance/McpPolicyGate.js";
import { NonceStore } from "../src/domain/governance/nonceStore.js";

function setupFixture() {
  const dir = mkdtempSync(join(tmpdir(), "aforge-prov-"));
  const srcDir = join(dir, "src");
  mkdirSync(srcDir, { recursive: true });
  writeFileSync(join(srcDir, "index.ts"), "export const ok = true;\n");

  const policyPath = join(dir, "mcp_policies.json");
  writeFileSync(policyPath, JSON.stringify({ policies: [], pinned_commit: "stale000" }, null, 2));

  const gitCommitPath = join(dir, ".git_commit");
  writeFileSync(gitCommitPath, "abc1234567890\n");

  const attestationPath = join(dir, "release-attestation.json");
  const auditLogPath = join(dir, "audit.log");

  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  const signAttestation = (overrides: Record<string, string> = {}, priv = privateKey) => {
    const body = {
      release_commit: overrides.release_commit ?? "abc1234567890",
      executable_tree_sha256: overrides.executable_tree_sha256 ?? computeExecutableTreeSha256(srcDir)!,
      policy_sha256: overrides.policy_sha256 ?? computeFileSha256(policyPath)!,
      issued_at: overrides.issued_at ?? "2026-11-20T02:00:00Z",
      key_id: overrides.key_id ?? "ed25519:test",
    };
    const sig = cryptoSign(null, Buffer.from(canonicalAttestationPayload(body), "utf8"), priv).toString("base64");
    writeFileSync(attestationPath, JSON.stringify({ ...body, signature: sig }, null, 2));
  };

  return { dir, srcDir, policyPath, gitCommitPath, attestationPath, auditLogPath, publicKey, signAttestation };
}

test("1. Policy-only commit with newly signed attestation -> PASS", () => {
  const f = setupFixture();
  try {
    // Update policy only (no executable change), update release commit, sign external attestation
    writeFileSync(f.policyPath, JSON.stringify({ policies: [{ policy_id: "p1", actor_id: "*", role: "op", description: "d", allow_by_default: false, denied_mcp_servers: [], allowed_mcp_servers: {} }] }));
    writeFileSync(f.gitCommitPath, "def5678901234\n");
    f.signAttestation({ release_commit: "def5678901234" });

    const gate = new McpPolicyGate(new NonceStore(), {
      policyPath: f.policyPath,
      gitCommitPath: f.gitCommitPath,
      executableDir: f.srcDir,
      attestationPath: f.attestationPath,
      publicKeyPem: f.publicKey,
      auditLogPath: f.auditLogPath,
    });
    const st = gate.getPinStatus();
    assert.equal(st.pin_violated, false);
    assert.equal(st.posture, "PINNED");
    assert.equal(st.signature_valid, true);
    assert.equal(st.policy_alignment, true);
    assert.equal(st.executable_alignment, true);
    assert.equal(st.release_alignment, true);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test("2. Policy changed without new attestation -> FAIL CLOSED", () => {
  const f = setupFixture();
  try {
    f.signAttestation();
    writeFileSync(f.policyPath, JSON.stringify({ policies: [], tampered: true }));
    const gate = new McpPolicyGate(new NonceStore(), {
      policyPath: f.policyPath,
      gitCommitPath: f.gitCommitPath,
      executableDir: f.srcDir,
      attestationPath: f.attestationPath,
      publicKeyPem: f.publicKey,
      auditLogPath: f.auditLogPath,
    });
    const st = gate.getPinStatus();
    assert.equal(st.pin_violated, true);
    assert.equal(st.posture, "FAIL_CLOSED_PIN_VIOLATION");
    assert.equal(st.policy_alignment, false);
    assert.equal(st.allow_by_default, false);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test("3. Executable source changed -> FAIL CLOSED", () => {
  const f = setupFixture();
  try {
    f.signAttestation();
    writeFileSync(join(f.srcDir, "index.ts"), "export const ok = false;\n");
    const gate = new McpPolicyGate(new NonceStore(), {
      policyPath: f.policyPath,
      gitCommitPath: f.gitCommitPath,
      executableDir: f.srcDir,
      attestationPath: f.attestationPath,
      publicKeyPem: f.publicKey,
      auditLogPath: f.auditLogPath,
    });
    const st = gate.getPinStatus();
    assert.equal(st.pin_violated, true);
    assert.equal(st.executable_alignment, false);
    assert.equal(st.allow_by_default, false);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test("4. .git_commit tampered -> FAIL CLOSED", () => {
  const f = setupFixture();
  try {
    f.signAttestation();
    writeFileSync(f.gitCommitPath, "9999999999999\n");
    const gate = new McpPolicyGate(new NonceStore(), {
      policyPath: f.policyPath,
      gitCommitPath: f.gitCommitPath,
      executableDir: f.srcDir,
      attestationPath: f.attestationPath,
      publicKeyPem: f.publicKey,
      auditLogPath: f.auditLogPath,
    });
    const st = gate.getPinStatus();
    assert.equal(st.pin_violated, true);
    assert.equal(st.release_alignment, false);
    assert.equal(st.allow_by_default, false);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test("5. Manifest signature invalid / wrong key -> FAIL CLOSED", () => {
  const f = setupFixture();
  try {
    const other = generateKeyPairSync("ed25519", {
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    f.signAttestation({}, other.privateKey);
    const gate = new McpPolicyGate(new NonceStore(), {
      policyPath: f.policyPath,
      gitCommitPath: f.gitCommitPath,
      executableDir: f.srcDir,
      attestationPath: f.attestationPath,
      publicKeyPem: f.publicKey,
      auditLogPath: f.auditLogPath,
    });
    const st = gate.getPinStatus();
    assert.equal(st.pin_violated, true);
    assert.equal(st.signature_valid, false);
    assert.equal(st.allow_by_default, false);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test("6. Attestation missing -> FAIL CLOSED, never fall back to allow_by_default", () => {
  const f = setupFixture();
  try {
    const gate = new McpPolicyGate(new NonceStore(), {
      policyPath: f.policyPath,
      gitCommitPath: f.gitCommitPath,
      executableDir: f.srcDir,
      attestationPath: join(f.dir, "does-not-exist.json"),
      publicKeyPem: f.publicKey,
      auditLogPath: f.auditLogPath,
    });
    const st = gate.getPinStatus();
    assert.equal(st.pin_violated, true);
    assert.equal(st.posture, "FAIL_CLOSED_PIN_VIOLATION");
    assert.equal(st.effective_policy, "fail_closed:constraint_pin_violation");
    assert.equal(st.allow_by_default, false);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});
