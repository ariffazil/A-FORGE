/**
 * A-FORGE Containment: Sandbox Policy Schema
 * ═══════════════════════════════════════════
 *
 * MXC-pattern inspired: JSON policy → sandbox backend → execute
 * Adapted for the arifOS constitutional execution layer.
 *
 * This is the CONTAINMENT layer (Layer 2), NOT the governance layer (Layer 4).
 * Governance (L01-L13, 888_HOLD) happens in arifOS before this policy is applied.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

// ── Backend Types ──────────────────────────────────────────────
export type SandboxBackend = 'bwrap' | 'firejail' | 'docker' | 'auto';

// ── Filesystem Policy ─────────────────────────────────────────
export interface FilesystemPolicy {
  /** Paths the sandboxed process can READ from */
  readOnly: string[];
  /** Paths the sandboxed process can READ and WRITE to */
  readWrite: string[];
  /** Paths explicitly DENIED (overrides readOnly/readWrite) */
  denied: string[];
  /** Working directory inside the sandbox */
  workingDir?: string;
  /** Mount host root as read-only base (bwrap: --ro-bind / /) */
  mountHostRootReadOnly?: boolean;
}

// ── Network Policy ────────────────────────────────────────────
export interface NetworkPolicy {
  /** If true, NO network access at all */
  denyAll: boolean;
  /** Allowed outbound domains (only if denyAll is false) */
  allowedDomains?: string[];
  /** Allowed outbound IPs/ports (only if denyAll is false) */
  allowedEndpoints?: string[];
  /** Disable network entirely (bwrap: --unshare-net) */
  unshareNetwork?: boolean;
}

// ── Environment Policy ────────────────────────────────────────
export interface EnvironmentPolicy {
  /** Environment variables to pass through to sandbox */
  allowed: string[];
  /** Environment variables to explicitly set */
  set?: Record<string, string>;
  /** Clear all env and only pass what's in 'allowed' */
  cleanEnvironment?: boolean;
}

// ── Resource Limits ───────────────────────────────────────────
export interface ResourceLimits {
  /** Max memory in MB */
  maxMemoryMB?: number;
  /** Max CPU time in seconds */
  maxCPUSeconds?: number;
  /** Max wall-clock time in seconds */
  timeoutSeconds?: number;
  /** Max file size in MB */
  maxFileSizeMB?: number;
  /** Max number of processes */
  maxProcesses?: number;
}

// ── User Policy ───────────────────────────────────────────────
export interface UserPolicy {
  /** Run sandbox as this UID (default: current user) */
  uid?: number;
  /** Run sandbox as this GID (default: current group) */
  gid?: number;
  /** Create new user namespace (bwrap: --unshare-user) */
  unshareUser?: boolean;
}

// ── Top-Level Sandbox Policy ──────────────────────────────────
export interface SandboxPolicy {
  /** Schema version */
  version: '1.0.0';
  /** Policy name for audit trail */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Which backend to use (auto = try bwrap, fallback docker) */
  backend: SandboxBackend;
  /** Filesystem access rules */
  filesystem: FilesystemPolicy;
  /** Network access rules */
  network: NetworkPolicy;
  /** Environment variable rules */
  environment?: EnvironmentPolicy;
  /** Resource limits */
  resources?: ResourceLimits;
  /** User/identity rules */
  user?: UserPolicy;
  /** Additional bwrap-specific flags */
  bwrapExtraArgs?: string[];
  /** Additional firejail-specific flags */
  firejailExtraArgs?: string[];
  /** VAULT999 audit metadata */
  audit?: {
    sessionId?: string;
    actorId?: string;
    toolName?: string;
    verdictHash?: string;
  };
}

// ── Presets ───────────────────────────────────────────────────
export const PRESETS: Record<string, SandboxPolicy> = {
  /** READ-ONLY: can read project files, cannot write anywhere except /tmp */
  READONLY_BUILD: {
    version: '1.0.0',
    name: 'READONLY_BUILD',
    description: 'Read project files, write to /tmp only. No network. Used for lint/typecheck/test.',
    backend: 'auto',
    filesystem: {
      readOnly: ['/root/A-FORGE', '/root/arifOS', '/root/AAA'],
      readWrite: ['/tmp'],
      denied: ['/root/.secrets', '/root/VAULT999', '/root/.ssh', '/etc'],
      workingDir: '/root/A-FORGE',
    },
    network: { denyAll: true, unshareNetwork: true },
    environment: {
      allowed: ['HOME', 'PATH', 'USER', 'LANG', 'NODE_ENV'],
      cleanEnvironment: true,
    },
    resources: { maxMemoryMB: 2048, timeoutSeconds: 300 },
    user: { unshareUser: true },
  },

  /** NETWORKED: can read project, write to /tmp, access specific domains. Used for API calls, web research. */
  NETWORKED_READ: {
    version: '1.0.0',
    name: 'NETWORKED_READ',
    description: 'Read project files, network access for API calls. Write to /tmp only.',
    backend: 'auto',
    filesystem: {
      readOnly: ['/root/A-FORGE', '/root/arifOS'],
      readWrite: ['/tmp'],
      denied: ['/root/.secrets', '/root/VAULT999', '/root/.ssh'],
      workingDir: '/root/A-FORGE',
    },
    network: {
      denyAll: false,
      allowedDomains: ['api.github.com', 'api.minimax.io', 'api.anthropic.com', 'modelcontextprotocol.io', 'a2a-protocol.org'],
    },
    environment: {
      allowed: ['HOME', 'PATH', 'USER', 'LANG', 'NODE_ENV', 'MINIMAX_API_KEY', 'ANTHROPIC_API_KEY'],
      cleanEnvironment: true,
    },
    resources: { maxMemoryMB: 4096, timeoutSeconds: 600 },
    user: { unshareUser: true },
  },

  /** FULL: trusted execution after arif_judge_deliberate SEAL. Writes allowed to project dirs. Network allowed. */
  FULL_TRUSTED: {
    version: '1.0.0',
    name: 'FULL_TRUSTED',
    description: 'Full access after constitutional SEAL. Write to project dirs. Network access. Used for deploy, push, forge.',
    backend: 'auto',
    filesystem: {
      readOnly: [],
      readWrite: ['/root/A-FORGE', '/root/arifOS', '/root/AAA', '/root/GEOX', '/root/WEALTH', '/root/WELL', '/tmp'],
      denied: ['/root/.secrets', '/root/.ssh/id_*'],
      workingDir: '/root/A-FORGE',
    },
    network: { denyAll: false, allowedDomains: [] },
    environment: {
      allowed: ['HOME', 'PATH', 'USER', 'LANG', 'NODE_ENV'],
      cleanEnvironment: false,
    },
    resources: { maxMemoryMB: 8192, timeoutSeconds: 1800 },
    user: { unshareUser: true },
  },
};

// ── Policy Derivation from Constitutional Verdict ─────────────
export type ConstitutionalVerdict = 'SEAL' | 'HOLD' | 'VOID' | 'SABAR';

/**
 * Derive a sandbox policy from the constitutional verdict.
 * SEAL → FULL_TRUSTED (governance approved it)
 * HOLD → READONLY_BUILD (can still run but limited)
 * VOID → blocked (no execution allowed)
 * SABAR → READONLY_BUILD with extra restrictions
 */
export function derivePolicyFromVerdict(verdict: ConstitutionalVerdict): SandboxPolicy | null {
  switch (verdict) {
    case 'SEAL':
      return { ...PRESETS.FULL_TRUSTED };
    case 'SABAR':
      return { ...PRESETS.READONLY_BUILD };
    case 'HOLD':
      return { ...PRESETS.READONLY_BUILD, resources: { ...PRESETS.READONLY_BUILD.resources, timeoutSeconds: 60 } };
    case 'VOID':
      return null; // No execution
    default:
      return { ...PRESETS.READONLY_BUILD };
  }
}
