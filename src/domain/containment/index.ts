/**
 * A-FORGE Containment Module
 * ════════════════════════════
 *
 * MXC-pattern containment engine for the arifOS constitutional execution layer.
 * JSON policy → Linux sandbox backend → governed execution → audit trail.
 *
 * V2 (2026-07-29): Added overlayfs persistence — pause/resume for long-horizon
 * agentic workflows. Pattern: mount overlay OUTSIDE bwrap → bind merged INTO bwrap.
 * This is Docker overlay2.
 *
 * This is NOT a replacement for arifOS governance. It is the CONTAINMENT layer
 * (Layer 2 of the agent stack) that enforces filesystem, network, and resource
 * policies AFTER constitutional governance (Layer 4) has approved the action.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

export { executeInSandbox, executeInOverlaySandbox, validatePolicy, testBackend } from './ContainmentEngine.js';
export type { ContainmentResult } from './ContainmentEngine.js';

export {
  createSandbox,
  runInSandbox,
  pauseSandbox,
  resumeSandbox,
  deprovisionSandbox,
  governedExecute,
  containmentHealth,
  getActiveSessions,
  getSession,
  listPaused,
  autoEvict,
  createPersistentLoop,
} from './ExecutionSandbox.js';
export type { SandboxSession, SandboxState } from './ExecutionSandbox.js';

export { SandboxStorage } from './SandboxStorage.js';
export type { OverlayLayout, SnapshotMetadata } from './SandboxStorage.js';

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
