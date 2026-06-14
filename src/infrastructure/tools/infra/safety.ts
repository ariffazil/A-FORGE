import { execFile } from "node:child_process";
import * as path from "node:path";
import { promisify } from "node:util";

export const execFileAsync = promisify(execFile);

export interface ApprovalLease {
  leaseId?: string;
  approvalId?: string;
  approved?: boolean;
  verdict?: "SEAL" | "APPROVED" | "888_HOLD" | "HOLD" | "VOID" | string;
  expiresAt?: string;
  scope?: string;
}

export interface GateResult {
  allowed: boolean;
  error?: string;
}

const UNIT_NAME_RE =
  /^[A-Za-z0-9_.@:+-]+\.(service|socket|timer|target|path|mount|automount|slice|scope|device|swap)$/;
const UNIT_PATTERN_RE =
  /^[A-Za-z0-9_.@:+*?-]+\.(service|socket|timer|target|path|mount|automount|slice|scope|device|swap)$/;
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

export function requireMutationApproval(action: string, target: string, lease?: ApprovalLease): GateResult {
  const approved = lease?.approved === true || lease?.verdict === "SEAL" || lease?.verdict === "APPROVED";
  const id = lease?.leaseId ?? lease?.approvalId;
  if (!approved || !id) {
    return {
      allowed: false,
      error: `888_HOLD: ${action} on ${target} requires an approved scoped lease. Acknowledgement is not authorization.`,
    };
  }
  if (lease.expiresAt && Date.parse(lease.expiresAt) <= Date.now()) {
    return {
      allowed: false,
      error: `888_HOLD: approval lease expired for ${action} on ${target}.`,
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
