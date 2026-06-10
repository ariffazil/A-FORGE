/**
 * A-FORGE Containment Module
 * ════════════════════════════
 *
 * MXC-pattern containment engine for the arifOS constitutional execution layer.
 * JSON policy → Linux sandbox backend → governed execution → audit trail.
 *
 * This is NOT a replacement for arifOS governance. It is the CONTAINMENT layer
 * (Layer 2 of the agent stack) that enforces filesystem, network, and resource
 * policies AFTER constitutional governance (Layer 4) has approved the action.
 *
 * MXC sits at the same layer. But MXC is Linux-is-secondary, Windows-first,
 * enterprise-fleet-focused. This is YOUR stack — Linux primary, single VPS,
 * bwrap-first, constitutional-governance-aware.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

export { executeInSandbox, validatePolicy, testBackend } from './ContainmentEngine.js';
export type { ContainmentResult } from './ContainmentEngine.js';

export {
  createSandbox,
  runInSandbox,
  deprovisionSandbox,
  governedExecute,
  containmentHealth,
  getActiveSessions,
  getSession,
} from './ExecutionSandbox.js';
export type { SandboxSession } from './ExecutionSandbox.js';

export {
  PRESETS,
  derivePolicyFromVerdict,
} from './SandboxPolicy.js';
export type {
  SandboxPolicy,
  SandboxBackend,
  ConstitutionalVerdict,
  FilesystemPolicy,
  NetworkPolicy,
  EnvironmentPolicy,
  ResourceLimits,
  UserPolicy,
} from './SandboxPolicy.js';
