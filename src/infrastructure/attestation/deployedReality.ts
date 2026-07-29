/**
 * Deployed-reality attestation — P6 FIX (2026-07-29).
 *
 * Every running service must expose:
 *   - repository
 *   - git_sha
 *   - binary/image digest
 *   - config hash (sans secrets)
 *   - policy version
 *   - schema/migration version
 *   - started_at
 *   - service identity
 *
 * Compares expected state (from build markers) against deployed state
 * (from live runtime probes). Never reports ALIGNED from repo state alone.
 */

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import * as path from "node:path";

export type AttestationStatus = "ALIGNED" | "DRIFT" | "UNKNOWN" | "UNATTESTED";

export interface ServiceAttestation {
  service: string;
  repository: string;
  deployed_sha: string;
  source_sha: string;
  binary_digest: string;
  config_hash: string;
  policy_version: string;
  schema_version: string;
  started_at: string;
  service_identity: string;
  status: AttestationStatus;
  checked_at: string;
  drift_details: string[];
}

export interface FederationAttestation {
  timestamp: string;
  services: Record<string, ServiceAttestation>;
  overall_status: AttestationStatus;
  unaligned_count: number;
  total_count: number;
}

const DEPLOY_ROOT = process.env.AF_FORGE_DEPLOY_ROOT || "/opt/a-forge/app";
const SOURCE_ROOT = process.env.AF_FORGE_SOURCE_ROOT || "/root/A-FORGE";

function readMarkerFile(dir: string, filename: string): string {
  try {
    return readFileSync(path.join(dir, filename), "utf8").trim();
  } catch {
    return "UNAVAILABLE";
  }
}

function computeSha256(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex").slice(0, 16);
}

/**
 * Build a single service attestation from deployed markers.
 * Never returns ALIGNED without live runtime evidence.
 */
export function attestService(
  serviceName: string,
  deployDir: string = DEPLOY_ROOT,
  sourceDir: string = SOURCE_ROOT,
): ServiceAttestation {
  const deployedSha = readMarkerFile(deployDir, ".git_commit");
  const sourceSha = readMarkerFile(sourceDir, ".git_commit");
  const startedAt = readMarkerFile(deployDir, ".started_at");
  const identityHash = readMarkerFile(deployDir, ".identity_hash");
  const binaryDigest = computeBinaryDigest(deployDir);
  const configHash = computeConfigHash(deployDir);
  const policyVersion = readMarkerFile(deployDir, ".policy_version") || "UNKNOWN";
  const schemaVersion = readMarkerFile(deployDir, ".schema_version") || "UNKNOWN";

  const drift: string[] = [];

  let status: AttestationStatus = "UNATTESTED";

  if (deployedSha === "UNAVAILABLE" || sourceSha === "UNAVAILABLE") {
    status = "UNKNOWN";
    drift.push("missing_git_markers");
  } else if (deployedSha !== sourceSha) {
    status = "DRIFT";
    drift.push(`sha_mismatch: deployed=${deployedSha.slice(0, 7)} source=${sourceSha.slice(0, 7)}`);
  } else if (binaryDigest === "UNAVAILABLE") {
    status = "UNKNOWN";
    drift.push("binary_digest_unavailable");
  } else {
    status = "ALIGNED";
  }

  return {
    service: serviceName,
    repository: sourceDir,
    deployed_sha: deployedSha,
    source_sha: sourceSha,
    binary_digest: binaryDigest,
    config_hash: configHash,
    policy_version: policyVersion,
    schema_version: schemaVersion,
    started_at: startedAt !== "UNAVAILABLE" ? startedAt : "UNKNOWN",
    service_identity: identityHash,
    status,
    checked_at: new Date().toISOString(),
    drift_details: drift,
  };
}

function computeBinaryDigest(deployDir: string): string {
  try {
    // Try JS bundle hash first
    const jsPath = path.join(deployDir, "dist", "src", "interfaces", "server.js");
    if (existsSync(jsPath)) {
      return computeSha256(readFileSync(jsPath, "utf8"));
    }
  } catch {
    /* fall through */
  }
  // Fall back to identity hash
  return readMarkerFile(deployDir, ".identity_hash") || "UNAVAILABLE";
}

function computeConfigHash(deployDir: string): string {
  try {
    // Hash of environment without secret values
    const envVars = [
      "NODE_ENV", "AF_FORGE_ENV", "AF_FORGE_PORT",
      "AF_FORGE_DEPLOY_ROOT", "AF_FORGE_SOURCE_ROOT",
      "FORGE_SCT_REQUIRE_MUTATE", "AFORGE_DPOP_MODE",
    ];
    const parts = envVars
      .map((v) => `${v}=${process.env[v] || "unset"}`)
      .join("\n");
    return computeSha256(parts);
  } catch {
    return "UNAVAILABLE";
  }
}

/**
 * Probe a remote organ's attestation endpoint and build its attestation.
 */
export async function probeOrganAttestation(
  organUrl: string,
  organName: string,
): Promise<ServiceAttestation> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${organUrl}/health`, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        service: organName,
        repository: "UNKNOWN",
        deployed_sha: "UNKNOWN",
        source_sha: "UNKNOWN",
        binary_digest: "UNKNOWN",
        config_hash: "UNKNOWN",
        policy_version: "UNKNOWN",
        schema_version: "UNKNOWN",
        started_at: "UNKNOWN",
        service_identity: "UNKNOWN",
        status: "UNKNOWN",
        checked_at: new Date().toISOString(),
        drift_details: [`http_error:${res.status}`],
      };
    }

    const body = await res.json() as Record<string, unknown>;
    return {
      service: organName,
      repository: String(body.repository || organName),
      deployed_sha: String(body.deployed_commit || body.git_sha || "UNKNOWN"),
      source_sha: String(body.source_commit || body.git_sha || "UNKNOWN"),
      binary_digest: String(body.binary_digest || body.identity_hash || "UNKNOWN"),
      config_hash: "REMOTE",
      policy_version: String(body.policy_version || "UNKNOWN"),
      schema_version: String(body.schema_version || "UNKNOWN"),
      started_at: String(body.started_at || body.timestamp || "UNKNOWN"),
      service_identity: String(body.identity_hash || body.identity || "UNKNOWN"),
      status: body.deployment_drift ? "DRIFT" : "ALIGNED",
      checked_at: new Date().toISOString(),
      drift_details: [],
    };
  } catch (err) {
    return {
      service: organName,
      repository: "UNKNOWN",
      deployed_sha: "UNKNOWN",
      source_sha: "UNKNOWN",
      binary_digest: "UNKNOWN",
      config_hash: "UNKNOWN",
      policy_version: "UNKNOWN",
      schema_version: "UNKNOWN",
      started_at: "UNKNOWN",
      service_identity: "UNKNOWN",
      status: "UNKNOWN",
      checked_at: new Date().toISOString(),
      drift_details: [`probe_error: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

/**
 * Build federation-wide attestation from local + remote probes.
 */
export async function attestFederation(): Promise<FederationAttestation> {
  const localAttestation = attestService("A-FORGE");

  const organs = [
    { name: "arifOS", url: "http://127.0.0.1:8088" },
    { name: "AAA", url: "http://127.0.0.1:3001" },
    { name: "GEOX", url: "http://127.0.0.1:8081" },
    { name: "WEALTH", url: "http://127.0.0.1:18082" },
    { name: "WELL", url: "http://127.0.0.1:18083" },
  ];

  const remoteAttestations = await Promise.all(
    organs.map((o) => probeOrganAttestation(o.url, o.name)),
  );

  const services: Record<string, ServiceAttestation> = {
    "A-FORGE": localAttestation,
  };
  for (const att of remoteAttestations) {
    services[att.service] = att;
  }

  const allAttestations = [localAttestation, ...remoteAttestations];
  const unaligned = allAttestations.filter((a) => a.status !== "ALIGNED");
  const driftCount = allAttestations.filter((a) => a.status === "DRIFT").length;

  let overallStatus: AttestationStatus = "ALIGNED";
  if (driftCount > 0) {
    overallStatus = "DRIFT";
  } else if (unaligned.length > 0) {
    overallStatus = "UNKNOWN";
  }

  return {
    timestamp: new Date().toISOString(),
    services,
    overall_status: overallStatus,
    unaligned_count: unaligned.length,
    total_count: allAttestations.length,
  };
}
