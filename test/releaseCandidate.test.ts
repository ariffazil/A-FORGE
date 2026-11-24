import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { computeExecutableTreeSha256, computeFileSha256, canonicalAttestationPayload } from "../src/domain/governance/McpPolicyGate.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(join(__dirname, "..", ".."));

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function setupTempRepo(): { tempDir: string; cleanup: () => void } {
  const tempDir = mkdtempSync(join(tmpdir(), "aforge-rc-test-"));
  const srcDir = join(tempDir, "src");
  const configDir = join(tempDir, "config");
  mkdirSync(srcDir, { recursive: true });
  mkdirSync(configDir, { recursive: true });

  // Initialize git repo
  execSync("git init", { cwd: tempDir, stdio: "ignore" });
  execSync("git config user.email 'test@test.com'", { cwd: tempDir, stdio: "ignore" });
  execSync("git config user.name 'Test User'", { cwd: tempDir, stdio: "ignore" });

  // Create initial source file
  writeFileSync(join(srcDir, "index.ts"), "export const version = '1.0.0';\n");

  // Create policy file
  writeFileSync(
    join(configDir, "mcp_policies.json"),
    JSON.stringify({ policies: [], pinned_commit: "initial" }, null, 2)
  );

  // Initial commit
  execSync("git add .", { cwd: tempDir, stdio: "ignore" });
  execSync("git commit -m 'Initial commit'", { cwd: tempDir, stdio: "ignore" });

  // Create .git_commit file (simulating the build process)
  const headCommit = execSync("git rev-parse HEAD", { cwd: tempDir, encoding: "utf-8" }).trim();
  writeFileSync(join(tempDir, ".git_commit"), headCommit + "\n");

  // Create baseline attestation file (simulating /var/lib/aforge/release-attestation.json)
  const attestationDir = join(tempDir, "var", "lib", "aforge");
  mkdirSync(attestationDir, { recursive: true });
  const policySha256 = computeFileSha256(join(configDir, "mcp_policies.json"))!;
  const execSha256 = computeExecutableTreeSha256(srcDir)!;
  const attestationBody = {
    release_commit: headCommit,
    executable_tree_sha256: execSha256,
    policy_sha256: policySha256,
    issued_at: new Date().toISOString(),
    key_id: "ed25519:test",
  };
  const payload = canonicalAttestationPayload(attestationBody);
  // Use a dummy signature
  const attestation = { ...attestationBody, signature: "dummy-signature" };
  writeFileSync(join(attestationDir, "release-attestation.json"), JSON.stringify(attestation, null, 2));

  const cleanup = () => rmSync(tempDir, { recursive: true, force: true });
  return { tempDir, cleanup };
}

function runBuilder(tempDir: string, env: Record<string, string> = {}): { manifest: any; digest: string } {
  const builderScript = join(REPO_ROOT, "scripts", "build_release_candidate.mjs");
  const output = execSync(`node ${builderScript}`, {
    cwd: tempDir,
    encoding: "utf-8",
    env: {
      ...process.env,
      ...env,
      AF_FORGE_REPO_ROOT: tempDir,
      AF_FORGE_SRC_DIR: join(tempDir, "src"),
      AF_FORGE_POLICY_PATH: join(tempDir, "config", "mcp_policies.json"),
      AF_FORGE_RELEASE_ATTESTATION: join(tempDir, "var", "lib", "aforge", "release-attestation.json"),
      AF_FORGE_OUTPUT_DIR: join(tempDir, "dist", "release-candidate"),
    },
  }).trim();

  // Find the generated manifest file
  const outputDir = join(tempDir, "dist", "release-candidate");
  const files = readdirSync(outputDir);
  // Select the manifest by matching the digest printed on stdout. files[0] and
  // mtime-newest both flake: readdir order is arbitrary across builds and fs
  // mtime granularity can tie, so a stale manifest masked every change.
  const printedDigest = output.split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? "";
  const hit = files.find((f) => JSON.parse(readFileSync(join(outputDir, f), "utf-8")).candidate_manifest_sha256 === printedDigest);
  if (!hit) throw new Error(`no manifest matches printed digest ${printedDigest}`);
  const manifestPath = join(outputDir, hit);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

  return { manifest, digest: output };
}

test("release candidate generation — basic generation succeeds", async () => {
  const { tempDir, cleanup } = setupTempRepo();
  try {
    const { manifest, digest } = runBuilder(tempDir);

    assert.ok(manifest.candidate_id, "candidate_id present");
    assert.ok(manifest.release_commit, "release_commit present");
    // parent_commit may be empty for initial commits (no HEAD~1)
    assert.ok(typeof manifest.parent_commit === "string", "parent_commit is string");
    assert.ok(manifest.policy_sha256, "policy_sha256 present");
    assert.ok(manifest.executable_tree_sha256, "executable_tree_sha256 present");
    assert.ok(manifest.baseline_attestation_sha256, "baseline_attestation_sha256 present");
    assert.ok(Array.isArray(manifest.changed_files), "changed_files is array");
    assert.ok(Array.isArray(manifest.test_receipt_refs), "test_receipt_refs is array");
    assert.ok(manifest.builder_identity, "builder_identity present");
    assert.ok(manifest.build_timestamp, "build_timestamp present");
    assert.ok(manifest.requested_service_scope, "requested_service_scope present");
    assert.ok(manifest.rollback_target, "rollback_target present");
    assert.ok(manifest.candidate_manifest_sha256, "candidate_manifest_sha256 present");

    // Verify digest matches
    assert.equal(digest, manifest.candidate_manifest_sha256, "printed digest matches manifest");

    // Verify manifest file exists
    const outputDir = join(tempDir, "dist", "release-candidate");
    const files = readdirSync(outputDir);
    assert.equal(files.length, 1, "exactly one manifest file created");
    assert.ok(files[0].startsWith(manifest.candidate_id), "filename matches candidate_id");
  } finally {
    cleanup();
  }
});

test("release candidate generation — source change invalidates candidate", async () => {
  const { tempDir, cleanup } = setupTempRepo();
  try {
    // Generate first manifest
    const { manifest: manifest1 } = runBuilder(tempDir);

    // Modify a source file
    const srcDir = join(tempDir, "src");
    writeFileSync(join(srcDir, "index.ts"), "export const version = '2.0.0';\n");

    // Generate second manifest
    const { manifest: manifest2 } = runBuilder(tempDir);

    // Candidate manifest SHA should differ
    assert.notEqual(
      manifest1.candidate_manifest_sha256,
      manifest2.candidate_manifest_sha256,
      "source change should produce different manifest digest"
    );

    // executable_tree_sha256 should differ
    assert.notEqual(
      manifest1.executable_tree_sha256,
      manifest2.executable_tree_sha256,
      "executable tree hash should change"
    );

    // release_commit should be same (no new commit)
    assert.equal(
      manifest1.release_commit,
      manifest2.release_commit,
      "release_commit unchanged (no new commit)"
    );
  } finally {
    cleanup();
  }
});

test("release candidate generation — policy change invalidates candidate", async () => {
  const { tempDir, cleanup } = setupTempRepo();
  try {
    const { manifest: manifest1 } = runBuilder(tempDir);

    // Modify policy file
    const configDir = join(tempDir, "config");
    const policyPath = join(configDir, "mcp_policies.json");
    const newPolicy = { policies: [{ policy_id: "test", actor_id: "*", role: "op", description: "d", allow_by_default: false, allowed_mcp_servers: {} }] };
    writeFileSync(policyPath, JSON.stringify(newPolicy, null, 2));
    console.error(`[DEBUG] Policy file after write: ${readFileSync(policyPath, "utf-8")}`);

    const { manifest: manifest2 } = runBuilder(tempDir);

    console.error(`[DEBUG] manifest1.policy_sha256: ${manifest1.policy_sha256}`);
    console.error(`[DEBUG] manifest2.policy_sha256: ${manifest2.policy_sha256}`);
    console.error(`[DEBUG] manifest1.candidate_manifest_sha256: ${manifest1.candidate_manifest_sha256}`);
    console.error(`[DEBUG] manifest2.candidate_manifest_sha256: ${manifest2.candidate_manifest_sha256}`);

    assert.notEqual(
      manifest1.candidate_manifest_sha256,
      manifest2.candidate_manifest_sha256,
      "policy change should produce different manifest digest"
    );

    assert.notEqual(
      manifest1.policy_sha256,
      manifest2.policy_sha256,
      "policy hash should change"
    );
  } finally {
    cleanup();
  }
});

test("release candidate generation — executable tree change invalidates candidate", async () => {
  const { tempDir, cleanup } = setupTempRepo();
  try {
    const { manifest: manifest1 } = runBuilder(tempDir);

    // Add a new source file
    const srcDir = join(tempDir, "src");
    writeFileSync(join(srcDir, "new-file.ts"), "export const added = true;\n");

    const { manifest: manifest2 } = runBuilder(tempDir);

    assert.notEqual(
      manifest1.candidate_manifest_sha256,
      manifest2.candidate_manifest_sha256,
      "executable tree change should produce different manifest digest"
    );

    assert.notEqual(
      manifest1.executable_tree_sha256,
      manifest2.executable_tree_sha256,
      "executable tree hash should change"
    );
  } finally {
    cleanup();
  }
});

test("release candidate generation — manifest mutation invalidates verification", async () => {
  const { tempDir, cleanup } = setupTempRepo();
  try {
    const { manifest: manifest1 } = runBuilder(tempDir);
    const outputDir = join(tempDir, "dist", "release-candidate");
    const files = readdirSync(outputDir);
    // Read the NEWEST manifest: each build writes a new candidate file (unique candidate_id),
    // so files[0] would return the first run's manifest and mask every change.
    const newest = files.map((f) => ({ f, m: statSync(join(outputDir, f)).mtimeMs })).sort((a, b) => b.m - a.m)[0].f;
    const manifestPath = join(outputDir, newest);

    // Mutate the manifest file (change a field)
    const mutated = { ...manifest1, policy_sha256: "mutated" };
    writeFileSync(manifestPath, JSON.stringify(mutated, null, 2));

    // Run verifier - should detect drift
    const verifierScript = join(REPO_ROOT, "scripts", "verify_release_candidate.mjs");
    let verification;
    try {
      const result = execSync(`node ${verifierScript} ${manifestPath}`, {
        cwd: tempDir,
        encoding: "utf-8",
        env: {
          ...process.env,
          AF_FORGE_REPO_ROOT: tempDir,
          AF_FORGE_SRC_DIR: join(tempDir, "src"),
          AF_FORGE_POLICY_PATH: join(tempDir, "config", "mcp_policies.json"),
          AF_FORGE_RELEASE_ATTESTATION: join(tempDir, "var", "lib", "aforge", "release-attestation.json"),
        },
      }).trim();
      verification = JSON.parse(result);
    } catch (err: unknown) {
      // execSync throws on non-zero exit; verifier exits 1 when valid=false
      const error = err as { stdout?: Buffer; output?: (Buffer | null)[] };
      const stdout = error.stdout?.toString() || error.output?.[1]?.toString() || "";
      verification = JSON.parse(stdout.trim());
    }
    assert.equal(verification.valid, false, "mutated manifest should fail verification");
    assert.ok(verification.drift.length > 0, "drift should be reported");
    assert.ok(verification.drift.some((d: string) => d.includes("policy_sha256")), "policy_sha256 drift detected");
  } finally {
    cleanup();
  }
});

test("release candidate generation — builder source contains no key path references", async () => {
  const builderScript = join(REPO_ROOT, "scripts", "build_release_candidate.mjs");
  const content = readFileSync(builderScript, "utf-8");

  // Assert no references to private key paths
  assert.ok(!content.includes("/etc/aforge/release-attestation.key.pem"), "no private key path");
  assert.ok(!content.includes("release-attestation.key"), "no private key filename");
  assert.ok(!content.includes("privateKey"), "no private key variable");
  // Check for actual signing operations, not just the word "sign" in comments
  assert.ok(!content.includes("crypto.sign"), "no crypto.sign call");
  assert.ok(!content.includes("generateKeyPairSync"), "no key generation");
  assert.ok(!content.includes("sign("), "no sign function call");
  assert.ok(!content.includes(".sign"), "no .sign method call");
});

test("release candidate generation — ordinary build path cannot call signer", async () => {
  const builderScript = join(REPO_ROOT, "scripts", "build_release_candidate.mjs");
  const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf-8"));

  const buildScript = packageJson.scripts.build;
  const builderContent = readFileSync(builderScript, "utf-8");

  // Build script should not invoke sign-release-attestation
  assert.ok(!buildScript.includes("sign-release-attestation"), "build script does not call signer");

  // Builder script should not invoke sign-release-attestation
  assert.ok(!builderContent.includes("sign-release-attestation"), "builder script does not call signer");
});

test("release candidate generation — provenance does not create release authorization", async () => {
  const { tempDir, cleanup } = setupTempRepo();
  try {
    const { manifest } = runBuilder(tempDir);

    // Manifest should not have authorization field
    assert.ok(!("authorization" in manifest), "manifest has no authorization field");
    assert.ok(!("grant" in manifest), "manifest has no grant field");
    assert.ok(!("signature" in manifest), "manifest has no signature field");

    // candidate_manifest_sha256 is a digest, not an authorization
    assert.ok(typeof manifest.candidate_manifest_sha256 === "string", "candidate_manifest_sha256 is a digest");
    assert.equal(manifest.candidate_manifest_sha256.length, 64, "candidate_manifest_sha256 is 64-char hex");
  } finally {
    cleanup();
  }
});

test("release candidate generation — determinism (same inputs = same digest, exempting build_timestamp)", async () => {
  const { tempDir, cleanup } = setupTempRepo();
  try {
    // Generate two manifests in quick succession without changes
    const { manifest: manifest1, digest: digest1 } = runBuilder(tempDir);
    const { manifest: manifest2, digest: digest2 } = runBuilder(tempDir);

    // Digests should be identical (build_timestamp is exempted from hash)
    assert.equal(digest1, digest2, "deterministic: same inputs produce same digest");
    assert.equal(manifest1.candidate_manifest_sha256, manifest2.candidate_manifest_sha256, "manifest digest identical");

    // But build_timestamp may differ (it's exempted)
    // The manifests should be identical except for build_timestamp
    const { build_timestamp: _, ...manifest1ForCompare } = manifest1;
    const { build_timestamp: __, ...manifest2ForCompare } = manifest2;
    assert.deepEqual(manifest1ForCompare, manifest2ForCompare, "manifests identical except build_timestamp");
  } finally {
    cleanup();
  }
});