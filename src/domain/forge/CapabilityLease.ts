/**
 * CapabilityLease — Temporary Permit for Ephemeral Tool Execution
 * ================================================================
 *
 * Agent boleh mencipta CODE di dalam lease. Ia TIDAK BOLEH meluaskan lease itu.
 *
 * A lease is a scoped, time-bounded, resource-limited permit that grants
 * an agent temporary capability. The lease is the ONLY path from sandbox
 * generation to invocation. No lease → no execution.
 *
 * Iron rule: Agent creates CAPABILITY. Agent NEVER creates AUTHORITY.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 * @constitutional F1 AMANAH — all leases are temporary and reversible
 * @constitutional F11 AUDIT — every lease leaves an audit trace
 * @constitutional F13 SOVEREIGN — lease cannot grant constitutional authority
 */

import crypto from "node:crypto";

// ── Lease Types ──────────────────────────────────────────────────

export type LeaseOperation =
  | "read_transform"   // Read input, transform, write output — no network
  | "compute_only"     // CPU/memory only — no filesystem, no network
  | "read_api"         // Read-only external API — network allowlist required
  | "read_repo"        // Read approved repository paths
  | "process_userdata";// Process user-provided temporary data

export type AuthorityBand = "GREEN" | "YELLOW" | "ORANGE" | "RED";

export interface LeaseFilesystemScope {
  read: string[];       // Paths the tool can READ
  write: string[];      // Paths the tool can WRITE
  deny: string[];       // Paths explicitly DENIED (overrides read/write)
}

export interface LeaseNetworkScope {
  allow: boolean;           // false = DENY ALL
  allowedDomains?: string[];// Only if allow = true
  allowedPorts?: number[];  // Only if allow = true
}

export interface LeaseResourceLimits {
  cpuLimit: number;         // Max CPU cores
  memoryMB: number;         // Max memory in MB
  timeoutSeconds: number;   // Max wall-clock time
  maxFileSizeMB: number;    // Max output file size
  maxProcesses: number;     // Max child processes
}

export interface CapabilityLease {
  leaseId: string;
  purpose: string;                  // Single sentence: what this tool does
  allowedOperation: LeaseOperation;
  authorityBand: AuthorityBand;
  filesystem: LeaseFilesystemScope;
  network: LeaseNetworkScope;
  resources: LeaseResourceLimits;
  credentials: "NONE" | "SCOPED";   // "NONE" for GREEN/YELLOW
  credentialScope?: string[];       // Only if SCOPED
  persistentRegistration: false;    // ALWAYS false for ephemeral
  selfPromotion: false;             // ALWAYS false — human gate only
  issuedAt: string;
  expiresAt: string;                // Max 24h from issue
  issuedBy: string;                 // actor_id that requested
  toolHash: string;                 // SHA256 of the generated tool code
  leaseHash: string;                // SHA256 of the entire lease
  state: LeaseState;
}

export type LeaseState =
  | "ISSUED"
  | "ACTIVE"
  | "EXPIRED"
  | "REVOKED"
  | "VIOLATED";

// ── Lease Validation Result ──────────────────────────────────────

export interface LeaseValidation {
  valid: boolean;
  reason: string;
  violations: string[];
}

// ── Default Green Lease (most restrictive safe defaults) ─────────

export function createGreenLease(params: {
  purpose: string;
  issuedBy: string;
  toolCode: string;
  timeoutSeconds?: number;
}): CapabilityLease {
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h max
  const toolHash = crypto.createHash("sha256").update(params.toolCode).digest("hex");

  const lease: Omit<CapabilityLease, "leaseHash"> = {
    leaseId: `caplease-${crypto.randomUUID().slice(0, 12)}`,
    purpose: params.purpose,
    allowedOperation: "compute_only",
    authorityBand: "GREEN",
    filesystem: {
      read: ["/tmp/forge8/staging"],
      write: ["/tmp/forge8/output"],
      deny: [
        "/root/.secrets",
        "/root/.ssh",
        "/root/VAULT999",
        "/etc",
        "/opt",
        "/var/lib",
      ],
    },
    network: { allow: false },
    resources: {
      cpuLimit: 1,
      memoryMB: 512,
      timeoutSeconds: params.timeoutSeconds || 120,
      maxFileSizeMB: 10,
      maxProcesses: 4,
    },
    credentials: "NONE",
    persistentRegistration: false,
    selfPromotion: false,
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    issuedBy: params.issuedBy,
    toolHash,
    state: "ISSUED",
  };

  const leaseHash = computeLeaseHash(lease as CapabilityLease);
  return { ...lease, leaseHash } as CapabilityLease;
}

// ── Yellow Lease (scoped read + network) ─────────────────────────

export function createYellowLease(params: {
  purpose: string;
  issuedBy: string;
  toolCode: string;
  allowedDomains: string[];
  readPaths?: string[];
  timeoutSeconds?: number;
}): CapabilityLease {
  const green = createGreenLease({
    purpose: params.purpose,
    issuedBy: params.issuedBy,
    toolCode: params.toolCode,
    timeoutSeconds: params.timeoutSeconds || 300,
  });

  return {
    ...green,
    leaseId: `caplease-${crypto.randomUUID().slice(0, 12)}`,
    allowedOperation: "read_api",
    authorityBand: "YELLOW",
    filesystem: {
      ...green.filesystem,
      read: [...green.filesystem.read, ...(params.readPaths || [])],
    },
    network: {
      allow: true,
      allowedDomains: params.allowedDomains,
      allowedPorts: [443, 80],
    },
  };
}

// ── Lease Hash ──────────────────────────────────────────────────

export function computeLeaseHash(lease: CapabilityLease): string {
  const canonical = JSON.stringify({
    leaseId: lease.leaseId,
    purpose: lease.purpose,
    allowedOperation: lease.allowedOperation,
    authorityBand: lease.authorityBand,
    filesystem: lease.filesystem,
    network: lease.network,
    resources: lease.resources,
    credentials: lease.credentials,
    persistentRegistration: lease.persistentRegistration,
    selfPromotion: lease.selfPromotion,
    issuedAt: lease.issuedAt,
    expiresAt: lease.expiresAt,
    toolHash: lease.toolHash,
  }, Object.keys(lease).sort());
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

// ── Lease Enforcement ────────────────────────────────────────────

export function validateLease(lease: CapabilityLease): LeaseValidation {
  const violations: string[] = [];

  // 1. Lease must not be expired
  if (new Date(lease.expiresAt) <= new Date()) {
    violations.push("Lease has expired");
  }

  // 2. Lease must not be revoked or violated
  if (lease.state === "REVOKED") {
    violations.push("Lease has been revoked");
  }
  if (lease.state === "VIOLATED") {
    violations.push("Lease was violated — permanently blocked");
  }

  // 3. No persistent registration (IRON RULE)
  if (lease.persistentRegistration !== false) {
    violations.push("Ephemeral lease cannot permit persistent registration");
  }

  // 4. No self-promotion (IRON RULE)
  if (lease.selfPromotion !== false) {
    violations.push("Ephemeral lease cannot permit self-promotion");
  }

  // 5. GREEN/YELLOW must have NONE credentials
  if ((lease.authorityBand === "GREEN" || lease.authorityBand === "YELLOW") && lease.credentials !== "NONE") {
    violations.push(`${lease.authorityBand} band requires credentials=NONE`);
  }

  // 6. GREEN must have network DENY
  if (lease.authorityBand === "GREEN" && lease.network.allow) {
    violations.push("GREEN band requires network DENY");
  }

  // 7. Resource limits must be bounded
  if (lease.resources.timeoutSeconds > 3600) {
    violations.push("Max timeout is 3600 seconds");
  }
  if (lease.resources.memoryMB > 4096) {
    violations.push("Max memory is 4096 MB");
  }
  if (lease.resources.cpuLimit > 4) {
    violations.push("Max CPU is 4 cores");
  }

  // 8. Deny list must include secrets
  const denyRequired = ["/root/.secrets", "/root/.ssh"];
  for (const path of denyRequired) {
    if (!lease.filesystem.deny.some(d => d.startsWith(path))) {
      violations.push(`Deny list must include ${path}`);
    }
  }

  // 9. Lease hash must match
  const computedHash = computeLeaseHash(lease);
  if (computedHash !== lease.leaseHash) {
    violations.push("Lease hash mismatch — lease has been tampered with");
  }

  return {
    valid: violations.length === 0,
    reason: violations.length === 0 ? "Lease valid" : violations.join("; "),
    violations,
  };
}

// ── Lease Expiry Check ──────────────────────────────────────────

export function isLeaseExpired(lease: CapabilityLease): boolean {
  return new Date(lease.expiresAt) <= new Date();
}

export function isLeaseActive(lease: CapabilityLease): boolean {
  return (
    lease.state === "ISSUED" || lease.state === "ACTIVE"
  ) && !isLeaseExpired(lease);
}

// ── Scope Check: Does requested operation fit within lease? ─────

export function checkOperationScope(
  lease: CapabilityLease,
  requestedReads: string[],
  requestedWrites: string[],
  requestedNetwork: boolean,
): LeaseValidation {
  const violations: string[] = [];

  for (const path of requestedReads) {
    const allowed = lease.filesystem.read.some(r => path.startsWith(r));
    const denied = lease.filesystem.deny.some(d => path.startsWith(d));
    if (!allowed || denied) {
      violations.push(`Read path not in lease scope: ${path}`);
    }
  }

  for (const path of requestedWrites) {
    const allowed = lease.filesystem.write.some(w => path.startsWith(w));
    const denied = lease.filesystem.deny.some(d => path.startsWith(d));
    if (!allowed || denied) {
      violations.push(`Write path not in lease scope: ${path}`);
    }
  }

  if (requestedNetwork && !lease.network.allow) {
    violations.push("Network access not permitted by lease");
  }

  return {
    valid: violations.length === 0,
    reason: violations.length === 0 ? "Operation within lease scope" : violations.join("; "),
    violations,
  };
}
