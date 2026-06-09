/**
 * A-FORGE Containment: Backend Engine
 * ══════════════════════════════════════
 *
 * Translates SandboxPolicy JSON into native Linux sandbox commands.
 * Backends: bwrap (primary), firejail, docker (fallback).
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { spawn, execSync } from 'node:child_process';
import { statSync, realpathSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type {
  SandboxPolicy,
  SandboxBackend,
  FilesystemPolicy,
  NetworkPolicy,
  EnvironmentPolicy,
  ResourceLimits,
} from './SandboxPolicy.js';

// ── Exec Result ───────────────────────────────────────────────
export interface ContainmentResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  backend: SandboxBackend;
  policyName: string;
  sandboxId: string;
  wallTimeMs: number;
  killed: boolean;
}

// ── Backend Detection ─────────────────────────────────────────
function detectBackend(): SandboxBackend {
  try { execSync('bwrap --version', { stdio: 'pipe' }); return 'bwrap'; } catch {}
  try { execSync('firejail --version', { stdio: 'pipe' }); return 'firejail'; } catch {}
  return 'docker';
}

// ── bwrap Args Builder ────────────────────────────────────────
function buildBwrapArgs(policy: SandboxPolicy): string[] {
  const args: string[] = [];

  // User namespace (default: unshare)
  if (policy.user?.unshareUser !== false) {
    args.push('--unshare-user');
  }

  // Network namespace
  if (policy.network?.denyAll || policy.network?.unshareNetwork) {
    args.push('--unshare-net');
  }

  // IPC namespace
  args.push('--unshare-ipc');

  // PID namespace
  args.push('--unshare-pid');

  // UTS namespace
  args.push('--unshare-uts');

  // ── Filesystem Strategy ──────────────────────────────────
  // Layer 1: Bind host root as READ-ONLY base FIRST
  //          (all system files, /bin→/usr/bin symlinks preserved)
  // Layer 2: Override denied paths with --tmpfs
  //          (empty tmpfs masks the read-only base for sensitive dirs)
  // Layer 3: Override read-write paths with --bind
  //          (these make specific dirs writable)

  // Virtual filesystems
  args.push('--proc', '/proc');
  args.push('--dev', '/dev');
  args.push('--tmpfs', '/tmp');

  // Layer 1: read-only base (MUST BE FIRST before any path overrides)
  args.push('--ro-bind', '/', '/');

  // Layer 2: denied paths — override sensitive dirs with empty tmpfs
  // bwrap --tmpfs must target real directories, not symlinks
  for (const denied of policy.filesystem.denied) {
    try {
      const resolved = realpathSync(denied);
      args.push('--tmpfs', resolved);
      // If the original path differs and is NOT a symlink, also mount there
      if (denied !== resolved && !lstatSync(denied).isSymbolicLink()) {
        args.push('--tmpfs', denied);
      }
    } catch {
      // Path doesn't exist on filesystem or cannot resolve — skip silently
    }
  }

  // Layer 3: read-write overrides
  for (const rw of policy.filesystem.readWrite) {
    try {
      const realPath = realpathSync(rw);
      args.push('--bind', rw, rw);
      if (rw !== realPath) {
        args.push('--bind', realPath, realPath);
      }
    } catch {
      // Doesn't exist — create as writable tmpfs so commands can write there
      args.push('--tmpfs', rw);
    }
  }

  // ── User & Capabilities ───────────────────────────────────
  if (policy.user?.unshareUser !== false) {
    args.push('--unshare-user');
  }

  // ── Working Directory ──────────────────────────────────────
  if (policy.filesystem.workingDir) {
    args.push('--chdir', policy.filesystem.workingDir);
  }

  // Environment: clean slate
  if (policy.environment?.cleanEnvironment) {
    args.push('--clearenv');
  }

  // Environment: allowed vars
  for (const envVar of (policy.environment?.allowed || [])) {
    if (process.env[envVar]) {
      args.push('--setenv', envVar, process.env[envVar]!);
    }
  }

  // Environment: explicitly set vars
  if (policy.environment?.set) {
    for (const [key, val] of Object.entries(policy.environment.set)) {
      args.push('--setenv', key, val);
    }
  }

  // Extra bwrap args
  if (policy.bwrapExtraArgs) {
    args.push(...policy.bwrapExtraArgs);
  }

  return args;
}

// ── firejail Args Builder ─────────────────────────────────────
function buildFirejailArgs(policy: SandboxPolicy): string[] {
  const args: string[] = ['--quiet'];

  // Network
  if (policy.network?.denyAll || policy.network?.unshareNetwork) {
    args.push('--net=none');
  }

  // Read-only paths
  for (const ro of policy.filesystem.readOnly) {
    args.push(`--read-only=${ro}`);
  }

  // Read-write paths
  for (const rw of policy.filesystem.readWrite) {
    args.push(`--read-write=${rw}`);
  }

  // Denied paths
  for (const denied of policy.filesystem.denied) {
    args.push(`--blacklist=${denied}`);
  }

  if (policy.filesystem.workingDir) {
    args.push(`--chdir=${policy.filesystem.workingDir}`);
  }

  // Private home
  args.push('--private-tmp');

  // Environment
  if (policy.environment?.cleanEnvironment) {
    args.push('--ignore=shell');
  }

  if (policy.firejailExtraArgs) {
    args.push(...policy.firejailExtraArgs);
  }

  return args;
}

// ── Docker Args Builder ───────────────────────────────────────
function buildDockerArgs(policy: SandboxPolicy): string[] {
  const args: string[] = ['run', '--rm', '-i'];

  if (policy.network?.denyAll) {
    args.push('--network', 'none');
  }

  for (const ro of policy.filesystem.readOnly) {
    args.push('-v', `${ro}:${ro}:ro`);
  }

  for (const rw of policy.filesystem.readWrite) {
    args.push('-v', `${rw}:${rw}`);
  }

  if (policy.filesystem.workingDir) {
    args.push('-w', policy.filesystem.workingDir);
  }

  if (policy.resources?.maxMemoryMB) {
    args.push('--memory', `${policy.resources.maxMemoryMB}m`);
  }

  if (policy.environment?.allowed) {
    for (const envVar of policy.environment.allowed) {
      if (process.env[envVar]) {
        args.push('-e', envVar);
      }
    }
  }

  args.push('node:22-alpine', '/bin/sh', '-c');
  return args;
}

// ── Main Execution ────────────────────────────────────────────
export async function executeInSandbox(
  policy: SandboxPolicy,
  command: string,
): Promise<ContainmentResult> {
  const backend = policy.backend === 'auto' ? detectBackend() : policy.backend;
  const sandboxId = `aforge-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const startTime = Date.now();

  let stdout = '';
  let stderr = '';
  let exitCode: number | null = null;
  let killed = false;

  return new Promise((resolve, reject) => {
    let childProcess;

    switch (backend) {
      case 'bwrap': {
        const bwrapArgs = buildBwrapArgs(policy);
        console.error(`[containment:bwrap] ${sandboxId} policy=${policy.name} backend=bwrap`);
        childProcess = spawn('bwrap', [...bwrapArgs, '--', '/bin/sh', '-c', command], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {},
        });
        break;
      }
      case 'firejail': {
        const fjArgs = buildFirejailArgs(policy);
        console.error(`[containment:firejail] ${sandboxId} policy=${policy.name} backend=firejail`);
        childProcess = spawn('firejail', [...fjArgs, '--', '/bin/sh', '-c', command], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        break;
      }
      case 'docker': {
        const dockerArgs = buildDockerArgs(policy);
        console.error(`[containment:docker] ${sandboxId} policy=${policy.name} backend=docker`);
        childProcess = spawn('docker', [...dockerArgs, command], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        break;
      }
      default:
        reject(new Error(`Unknown backend: ${backend}`));
        return;
    }

    // Timeout
    const timeout = policy.resources?.timeoutSeconds || 300;
    const timer = setTimeout(() => {
      killed = true;
      childProcess.kill('SIGKILL');
    }, timeout * 1000);

    // Stream stdout
    childProcess.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    // Stream stderr
    childProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code) => {
      clearTimeout(timer);
      exitCode = code;
      resolve({
        exitCode,
        stdout,
        stderr,
        backend,
        policyName: policy.name,
        sandboxId,
        wallTimeMs: Date.now() - startTime,
        killed,
      });
    });

    childProcess.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ── Dry-Run (Policy Validation) ───────────────────────────────
export function validatePolicy(policy: SandboxPolicy): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (policy.version !== '1.0.0') {
    errors.push(`Unsupported policy version: ${policy.version}`);
  }

  if (!policy.name) {
    errors.push('Policy name is required');
  }

  // Check that denied paths are not also in readOnly/readWrite (pointless)
  for (const denied of policy.filesystem.denied) {
    if (policy.filesystem.readOnly.includes(denied)) {
      errors.push(`Path "${denied}" is in both denied and readOnly — denied overrides`);
    }
    if (policy.filesystem.readWrite.includes(denied)) {
      errors.push(`Path "${denied}" is in both denied and readWrite — denied overrides (security boundary)`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Quick Test ────────────────────────────────────────────────
export async function testBackend(backend: SandboxBackend): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    switch (backend) {
      case 'bwrap': {
        const result = execSync('bwrap --version', { encoding: 'utf-8' }).trim();
        return { ok: true, version: result };
      }
      case 'firejail': {
        const result = execSync('firejail --version', { encoding: 'utf-8' }).trim();
        return { ok: true, version: result };
      }
      case 'docker': {
        const result = execSync('docker --version', { encoding: 'utf-8' }).trim();
        return { ok: true, version: result };
      }
      default:
        return { ok: false, error: `Unknown backend: ${backend}` };
    }
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
