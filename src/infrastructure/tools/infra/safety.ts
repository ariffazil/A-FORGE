import { execFile } from "node:child_process";
import * as path from "node:path";
import { promisify } from "node:util";

export const execFileAsync = promisify(execFile);

export interface GateResult {
  allowed: boolean;
  error?: string;
}

const UNIT_NAME_RE =
  /^[A-Za-z0-9_.@:+-]+\.(service|socket|timer|target|path|mount|automount|slice|scope|device|swap)$/;
const UNIT_PATTERN_RE =
  /^[A-Za-z0-9_.@:+\*\?-]+\.(service|socket|timer|target|path|mount|automount|slice|scope|device|swap)$/;
const DOCKER_REF_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const JOURNAL_SINCE_RE = /^[A-Za-z0-9: T+_.-]{1,64}$/;

export function assertSystemdUnitName(service: string): string {
  if (!UNIT_NAME_RE.test(service)) {
    throw new Error(`Invalid systemd unit name: ${service}`);
  }
  return service;
}

export function assertSystemdUnitPattern(pattern: string): string {
  if (!UNIT_PATTERN_RE.test(pattern)) {
    throw new Error(`Invalid systemd unit filter: ${pattern}`);
  }
  return pattern;
}

export function assertDockerRef(ref: string): string {
  if (!DOCKER_REF_RE.test(ref)) {
    throw new Error(`Invalid docker container reference: ${ref}`);
  }
  return ref;
}

export function assertJournalSince(since: string): string {
  if (!JOURNAL_SINCE_RE.test(since)) {
    throw new Error(`Invalid journal --since value: ${since}`);
  }
  return since;
}

export function clampLines(lines: number, max = 500): number {
  if (!Number.isFinite(lines)) return 100;
  return Math.max(1, Math.min(Math.trunc(lines), max));
}

/**
 * Verify a mutation against the arifOS canonical lease registry.
 * A-FORGE never self-authorizes: it only presents kernel-issued leases.
 * Fail-closed if the kernel is unreachable or the lease is invalid.
 */
export async function requireMutationApproval(action: string, target: string, lease_id?: string): Promise<GateResult> {
  if (!lease_id) {
    return {
      allowed: false,
      error: `888_HOLD: ${action} on ${target} requires a kernel-issued lease_id. Acknowledgement is not authorization.`,
    };
  }

  // MEASURED 2026-10-27 (forge_surface_audit outbound-ABI): arifOS exposes NO
  // lease verbs on its canonical MCP surface — leases are internal-only and
  // authority bootstraps via arif_init ACT. The A-FORGE registry holds the
  // leases bound from kernel-signed ACTs (source=kernel_act, registered at
  // session init). Validate against it: provenance + expiry + revocation.
  // Presentation of an id is never authorization.
  const { getRegisteredLease } = await import("../../../interfaces/mcp/forgeTools.js");
  const lease = getRegisteredLease(lease_id);
  if (!lease) {
    return {
      allowed: false,
      error: `888_HOLD: ${action} on ${target} — lease '${lease_id}' not registered in the A-FORGE lease registry (kernel lease store is internal-only; authority = arif_init ACT).`,
    };
  }
  if (lease.source !== "kernel_act") {
    return {
      allowed: false,
      error: `888_HOLD: ${action} on ${target} — lease '${lease_id}' provenance '${lease.source ?? "unmarked"}' is not kernel_act; presentation is not authorization.`,
    };
  }
  if (lease.revoked === true) {
    return {
      allowed: false,
      error: `888_HOLD: ${action} on ${target} — lease '${lease_id}' revoked.`,
    };
  }
  if (Date.now() > lease.expires_at) {
    return {
      allowed: false,
      error: `888_HOLD: ${action} on ${target} — lease '${lease_id}' expired.`,
    };
  }
  return { allowed: true };
}

export function resolveWorkspacePath(filePath: string, workspaceRoot = "/root"): string {
  const resolved = path.resolve(filePath);
  const root = path.resolve(workspaceRoot);
  const relative = path.relative(root, resolved);
  const insideRoot = resolved === root || (relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative));
  if (!insideRoot) {
    throw new Error(`Path outside workspace: ${filePath}. Must be within ${root}.`);
  }

  const parts = relative.split(path.sep).filter(Boolean);
  if (parts.includes(".secrets") || parts.includes(".ssh") || parts.some((part) => part === ".env" || part.endsWith(".env"))) {
    throw new Error(`Path blocked by protected workspace boundary: ${filePath}`);
  }
  return resolved;
}
