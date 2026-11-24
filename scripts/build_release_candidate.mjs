#!/usr/bin/env node
/**
 * build_release_candidate.mjs
 *
 * Release Candidate Manifest Builder — NO SIGNING, NO KEY ACCESS
 *
 * Computes a deterministic candidate manifest over a DECLARED input set:
 *   - Tracked source under src/
 *   - config/mcp_policies.json
 *   - The current git commit (HEAD)
 *
 * Output: dist/release-candidate/<candidate_id>.json
 * Prints: candidate_manifest_sha256 digest
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import {
  computeExecutableTreeSha256,
  computeFileSha256,
  canonicalAttestationPayload,
} from "../dist/src/domain/governance/McpPolicyGate.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_REPO_ROOT = resolve(__dirname, "..");
const REPO_ROOT = process.env.AF_FORGE_REPO_ROOT || DEFAULT_REPO_ROOT;
const SRC_DIR = process.env.AF_FORGE_SRC_DIR || join(REPO_ROOT, "src");
const POLICY_PATH = process.env.AF_FORGE_POLICY_PATH || join(REPO_ROOT, "config", "mcp_policies.json");
const ATTESTATION_PATH = process.env.AF_FORGE_RELEASE_ATTESTATION || "/var/lib/aforge/release-attestation.json";
const OUTPUT_DIR = process.env.AF_FORGE_OUTPUT_DIR || join(REPO_ROOT, "dist", "release-candidate");

/**
 * Compute SHA256 hash of a string/buffer
 */
function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Get git commit hash (HEAD)
 */
function getGitCommit() {
  try {
    return execSync("git rev-parse HEAD", { cwd: REPO_ROOT, encoding: "utf-8" }).trim();
  } catch {
    throw new Error("Failed to get git commit (HEAD)");
  }
}

/**
 * Get parent commit hash (HEAD~1)
 */
function getParentCommit() {
  try {
    return execSync("git rev-parse HEAD~1", { cwd: REPO_ROOT, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    // If no parent (initial commit), return empty string
    return "";
  }
}

/**
 * Get changed files: git diff --name-only HEAD~1..HEAD plus working-tree status of tracked files
 */
function getChangedFiles() {
  try {
    // Tracked files changed between HEAD~1 and HEAD
    const diffOutput = execSync("git diff --name-only HEAD~1..HEAD", {
      cwd: REPO_ROOT,
      encoding: "utf-8",
    }).trim();

    const changed = diffOutput ? diffOutput.split("\n").filter(Boolean) : [];

    // Working tree status of tracked files (modified but uncommitted)
    const statusOutput = execSync("git status --porcelain", {
      cwd: REPO_ROOT,
      encoding: "utf-8",
    }).trim();

    if (statusOutput) {
      const statusLines = statusOutput.split("\n").filter(Boolean);
      for (const line of statusLines) {
        // Format: "XY path" where XY are status codes
        const path = line.slice(3).trim();
        if (path && !changed.includes(path)) {
          changed.push(path);
        }
      }
    }

    return changed.sort();
  } catch {
    return [];
  }
}

/**
 * Read baseline attestation SHA256 (hash of file CONTENTS, not the signature field)
 * Returns null if not readable
 */
function getBaselineAttestationSha256() {
  try {
    if (!existsSync(ATTESTATION_PATH)) {
      return null;
    }
    const content = readFileSync(ATTESTATION_PATH, "utf-8").trim();
    return sha256(content);
  } catch {
    return null;
  }
}

/**
 * Build the candidate manifest
 */
function buildCandidateManifest() {
  const releaseCommit = getGitCommit();
  const parentCommit = getParentCommit();
  const policySha256 = computeFileSha256(POLICY_PATH);
  const executableTreeSha256 = computeExecutableTreeSha256(SRC_DIR);
  const baselineAttestationSha256 = getBaselineAttestationSha256();
  const changedFiles = getChangedFiles();
  const builderIdentity = process.env.USER || process.env.USERNAME || "unknown";
  const buildTimestamp = new Date().toISOString(); // EXEMPT from hash input (documented)
  const requestedServiceScope = "aforge-release"; // Default scope; could be made configurable

  // Candidate ID: deterministic identity over the declared core (commit +
  // policy + tree). Same inputs = same candidate. build_timestamp stays the
  // only per-build field and is exempt from candidate_manifest_sha256.
  const candidateIdInput = `${releaseCommit}:${policySha256}:${executableTreeSha256}`;
  const candidateId = sha256(candidateIdInput).slice(0, 16);

  // Rollback target = parent_commit. Single-commit repo: no prior state exists,
  // so the rollback target is the release commit itself (re-apply same commit).
  const rollbackTarget = parentCommit || releaseCommit;

  // Test receipt refs - placeholder for now (could be populated from test runs)
  const testReceiptRefs = [];

  // Build the manifest object (without candidate_manifest_sha256 yet)
  const manifest = {
    candidate_id: candidateId,
    release_commit: releaseCommit,
    parent_commit: parentCommit,
    policy_sha256: policySha256,
    executable_tree_sha256: executableTreeSha256,
    baseline_attestation_sha256: baselineAttestationSha256,
    changed_files: changedFiles,
    test_receipt_refs: testReceiptRefs,
    builder_identity: builderIdentity,
    build_timestamp: buildTimestamp, // EXEMPT from candidate_manifest_sha256 computation
    requested_service_scope: requestedServiceScope,
    rollback_target: rollbackTarget,
  };

  // Compute candidate_manifest_sha256 over ALL fields EXCEPT build_timestamp
  // This ensures determinism: same declared inputs -> same manifest_sha256
  // build_timestamp AND candidate_id are build-instance-unique (both derived
  // from the clock) and are EXEMPT from candidate_manifest_sha256. The digest
  // must depend ONLY on the declared input set: release/parent commit, policy
  // hash, executable-tree hash, changed files, scope, rollback target.
  // Same inputs -> same digest, even across a second boundary.
  const { build_timestamp: _t, candidate_id: _c, ...manifestForHash } = manifest;
  const canonicalManifest = canonicalAttestationPayload(manifestForHash);
  const candidateManifestSha256 = sha256(canonicalManifest);

  // Add the hash to the manifest
  manifest.candidate_manifest_sha256 = candidateManifestSha256;

  return manifest;
}

/**
 * Main entry point
 */
function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const manifest = buildCandidateManifest();

  const outputPath = join(OUTPUT_DIR, `${manifest.candidate_id}.json`);
  writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o644 });

  console.log(manifest.candidate_manifest_sha256);
}

main();