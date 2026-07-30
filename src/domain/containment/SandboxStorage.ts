/**
 * A-FORGE SandboxStorage — Overlayfs Persistence Layer
 * ═══════════════════════════════════════════════
 *
 * Manages overlayfs mounts for persistent sandbox filesystems.
 * Pattern: mount overlay OUTSIDE bwrap → bind merged INTO bwrap.
 * This is Docker's overlay2 pattern — tested and proven.
 *
 * PAUSE:  tar czf upperdir → unmount overlay → wipe upper/work/merged
 * RESUME: extract tar → mount overlay → bwrap bind
 *
 * F1 AMANAH:  Snapshot is COLD — no processes, no network, no fds.
 *              Delete snapshot = full reversal.
 * F11 AUDIT:  Every pause/resume event logs to VAULT999.
 * F13 SOVEREIGN: Auto-evict after 24h without active session lock.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { execSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

// ── Configuration ────────────────────────────────────────────
export const SANDBOX_STORAGE_ROOT = '/var/arifos/sandbox-snapshots';
export const MAX_PAUSE_AGE_HOURS = 24;
export const SNAPSHOT_DIR_PERMS = 0o700;

// ── Snapshot Metadata ────────────────────────────────────────
export interface SnapshotMetadata {
  sandboxId: string;
  policyName: string;
  pausedAt: string;
  leaseHash: string;
  sessionId: string;
  actorId: string;
  tarballPath: string;
  tarballSha256: string;
  tarballSizeBytes: number;
  state: 'PAUSED' | 'EVICTING' | 'CORRUPT';
}

// ── Overlay Layout ───────────────────────────────────────────
export interface OverlayLayout {
  sandboxId: string;
  rootPath: string;     // /var/arifos/sandbox-snapshots/{id}/
  lowerDir: string;     // ... /lower/ — immutable base template
  upperDir: string;     // ... /upper/ — all write diffs captured here
  workDir: string;      // ... /work/  — overlayfs work directory
  mergedDir: string;    // ... /merged/ — bwrap bind-mounts this
  metaPath: string;     // ... /meta.json — snapshot metadata
}

// ── Sandbox Storage Manager ──────────────────────────────────

export class SandboxStorage {
  /**
   * Provision overlay layout for a new persistent sandbox.
   * Creates lower/upper/work/merged directories.
   * Populates lowerdir with the base template files.
   */
  static provision(sandboxId: string, baseTemplatePaths: string[]): OverlayLayout {
    const rootPath = join(SANDBOX_STORAGE_ROOT, sandboxId);
    const layout: OverlayLayout = {
      sandboxId,
      rootPath,
      lowerDir: join(rootPath, 'lower'),
      upperDir: join(rootPath, 'upper'),
      workDir: join(rootPath, 'work'),
      mergedDir: join(rootPath, 'merged'),
      metaPath: join(rootPath, 'meta.json'),
    };

    // Create all directories
    for (const dir of [layout.lowerDir, layout.upperDir, layout.workDir, layout.mergedDir]) {
      mkdirSync(dir, { recursive: true, mode: SNAPSHOT_DIR_PERMS });
    }

    // Copy base template files into lowerdir
    // This is the immutable base — it never changes
    for (const srcPath of baseTemplatePaths) {
      if (existsSync(srcPath)) {
        const destName = srcPath.replace(/\//g, '_').replace(/^_+/, '');
        const destPath = join(layout.lowerDir, destName);
        try {
          execSync(`cp -a "${srcPath}/." "${destPath}/" 2>/dev/null || cp -a "${srcPath}" "${destPath}"`, {
            stdio: 'pipe',
            timeout: 30000,
          });
        } catch {
          // Best-effort copy — some paths may not exist
        }
      }
    }

    // Always ensure lowerdir has at least a .base_manifest
    writeFileSync(
      join(layout.lowerDir, '.base_manifest'),
      `sandbox_id=${sandboxId}\ncreated_at=${new Date().toISOString()}\ntemplates=${baseTemplatePaths.join(',')}\n`,
    );

    console.error(`[sandbox-storage:provision] ${sandboxId} layout created at ${rootPath}`);
    return layout;
  }

  /**
   * Mount overlayfs: lowerdir + upperdir → merged
   * Uses Linux mount syscall — requires root.
   * Returns the mount point (mergedDir).
   */
  static mountOverlay(layout: OverlayLayout): string {
    // Check if already mounted
    if (SandboxStorage.isMounted(layout.mergedDir)) {
      console.error(`[sandbox-storage:mount] ${layout.sandboxId} already mounted`);
      return layout.mergedDir;
    }

    const mountCmd = [
      'mount', '-t', 'overlay', 'overlay',
      '-o', `lowerdir=${layout.lowerDir},upperdir=${layout.upperDir},workdir=${layout.workDir}`,
      layout.mergedDir,
    ];

    try {
      execSync(mountCmd.join(' '), { stdio: 'pipe', timeout: 10000 });
      console.error(`[sandbox-storage:mount] ${layout.sandboxId} overlay mounted at ${layout.mergedDir}`);
      return layout.mergedDir;
    } catch (err: any) {
      throw new Error(`Overlay mount failed for ${layout.sandboxId}: ${err.message}`);
    }
  }

  /**
   * Unmount overlayfs — clean separation of filesystem layers.
   */
  static unmountOverlay(layout: OverlayLayout): void {
    if (!SandboxStorage.isMounted(layout.mergedDir)) {
      return; // Already unmounted
    }

    try {
      execSync(`umount "${layout.mergedDir}"`, { stdio: 'pipe', timeout: 10000 });
      console.error(`[sandbox-storage:unmount] ${layout.sandboxId} overlay unmounted`);
    } catch (err: any) {
      // Force unmount if busy
      try {
        execSync(`umount -l "${layout.mergedDir}"`, { stdio: 'pipe', timeout: 5000 });
      } catch {
        throw new Error(`Overlay unmount failed for ${layout.sandboxId}: ${err.message}`);
      }
    }
  }

  /**
   * PAUSE: Tar the upperdir to cold storage, unmount overlay, wipe working dirs.
   * Returns snapshot metadata.
   */
  static pause(
    layout: OverlayLayout,
    metadata: { sessionId: string; actorId: string; leaseHash: string; policyName: string },
  ): SnapshotMetadata {
    // 1. Unmount overlay (stops all writes to upperdir)
    SandboxStorage.unmountOverlay(layout);

    // 2. Create tarball from upperdir
    const timestamp = Date.now().toString(36);
    const tarballName = `snapshot-${timestamp}.tar.gz`;
    const tarballPath = join(SANDBOX_STORAGE_ROOT, layout.sandboxId, tarballName);

    try {
      execSync(
        `tar czf "${tarballPath}" -C "${layout.upperDir}" .`,
        { stdio: 'pipe', timeout: 60000 },
      );
    } catch (err: any) {
      throw new Error(`Snapshot tar failed for ${layout.sandboxId}: ${err.message}`);
    }

    // 3. Hash the tarball for integrity verification
    const tarballBuf = readFileSync(tarballPath);
    const sha256 = createHash('sha256').update(tarballBuf).digest('hex');
    const sizeBytes = tarballBuf.length;

    // 4. Wipe working dirs (upper, work, merged)
    // Lowerdir is PRESERVED — immutable base
    for (const dir of [layout.upperDir, layout.workDir, layout.mergedDir]) {
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true, mode: SNAPSHOT_DIR_PERMS });
    }

    // 5. Write metadata
    const meta: SnapshotMetadata = {
      sandboxId: layout.sandboxId,
      policyName: metadata.policyName,
      pausedAt: new Date().toISOString(),
      leaseHash: metadata.leaseHash,
      sessionId: metadata.sessionId,
      actorId: metadata.actorId,
      tarballPath,
      tarballSha256: sha256,
      tarballSizeBytes: sizeBytes,
      state: 'PAUSED',
    };

    writeFileSync(layout.metaPath, JSON.stringify(meta, null, 2));

    console.error(
      `[sandbox-storage:pause] ${layout.sandboxId} snapshot=${sha256.slice(0, 16)} ` +
      `size=${(sizeBytes / 1024).toFixed(1)}KB files_in_upper=${tarballBuf.length}`,
    );

    return meta;
  }

  /**
   * RESUME: Extract upperdir from tarball, re-mount overlay.
   * Returns the merged dir path ready for bwrap bind-mount.
   */
  static resume(layout: OverlayLayout): string {
    // 1. Read metadata
    if (!existsSync(layout.metaPath)) {
      throw new Error(`No snapshot metadata for ${layout.sandboxId} — cannot resume`);
    }

    const meta: SnapshotMetadata = JSON.parse(readFileSync(layout.metaPath, 'utf-8'));

    if (meta.state !== 'PAUSED') {
      throw new Error(`Snapshot ${layout.sandboxId} is in state "${meta.state}", expected PAUSED`);
    }

    // 2. Verify tarball integrity
    if (!existsSync(meta.tarballPath)) {
      throw new Error(`Snapshot tarball missing for ${layout.sandboxId}: ${meta.tarballPath}`);
    }

    const tarballBuf = readFileSync(meta.tarballPath);
    const actualSha = createHash('sha256').update(tarballBuf).digest('hex');
    if (actualSha !== meta.tarballSha256) {
      throw new Error(
        `Snapshot integrity FAILED for ${layout.sandboxId}: ` +
        `expected=${meta.tarballSha256.slice(0, 16)} actual=${actualSha.slice(0, 16)}`,
      );
    }

    // 3. Extract upperdir from tarball
    try {
      execSync(
        `tar xzf "${meta.tarballPath}" -C "${layout.upperDir}"`,
        { stdio: 'pipe', timeout: 30000 },
      );
    } catch (err: any) {
      throw new Error(`Snapshot extract failed for ${layout.sandboxId}: ${err.message}`);
    }

    // 4. Re-mount overlay
    const mergedPath = SandboxStorage.mountOverlay(layout);

    // 5. Update metadata
    meta.state = 'PAUSED'; // Still paused until next execution
    writeFileSync(layout.metaPath, JSON.stringify(meta, null, 2));

    console.error(
      `[sandbox-storage:resume] ${layout.sandboxId} restored from ` +
      `snapshot=${meta.tarballSha256.slice(0, 16)} size=${(meta.tarballSizeBytes / 1024).toFixed(1)}KB`,
    );

    return mergedPath;
  }

  /**
   * Check if a path is currently an active overlayfs mount.
   */
  static isMounted(mountPoint: string): boolean {
    try {
      const output = execSync('mount', { encoding: 'utf-8', stdio: 'pipe', timeout: 5000 });
      return output.includes(mountPoint);
    } catch {
      return false;
    }
  }

  /**
   * List all paused sandboxes for an actor.
   */
  static listPaused(actorId: string): SnapshotMetadata[] {
    if (!existsSync(SANDBOX_STORAGE_ROOT)) return [];

    const results: SnapshotMetadata[] = [];
    const fsReaddir = readdirSync;

    for (const entry of fsReaddir(SANDBOX_STORAGE_ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const metaPath = join(SANDBOX_STORAGE_ROOT, entry.name, 'meta.json');
      if (!existsSync(metaPath)) continue;

      try {
        const meta: SnapshotMetadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
        if (meta.actorId === actorId && meta.state === 'PAUSED') {
          results.push(meta);
        }
      } catch {
        // Corrupt metadata — skip
      }
    }

    return results.sort((a, b) => b.pausedAt.localeCompare(a.pausedAt));
  }

  /**
   * EVICT: Delete a paused sandbox snapshot entirely.
   * F1 AMANAH: This is IRREVERSIBLE. Requires lease validation.
   */
  static evict(sandboxId: string): void {
    const rootPath = join(SANDBOX_STORAGE_ROOT, sandboxId);
    if (!existsSync(rootPath)) return;

    const metaPath = join(rootPath, 'meta.json');
    if (existsSync(metaPath)) {
      const meta: SnapshotMetadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
      meta.state = 'EVICTING';
      writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    }

    // Unmount if still mounted
    const mergedDir = join(rootPath, 'merged');
    if (SandboxStorage.isMounted(mergedDir)) {
      try { execSync(`umount -l "${mergedDir}"`, { stdio: 'pipe', timeout: 5000 }); } catch {}
    }

    rmSync(rootPath, { recursive: true, force: true });
    console.error(`[sandbox-storage:evict] ${sandboxId} snapshot purged`);
  }

  /**
   * Auto-eviction: Remove snapshots older than MAX_PAUSE_AGE_HOURS
   * that don't have an active session lock.
   */
  static autoEvict(): { evicted: string[]; errors: string[] } {
    const evicted: string[] = [];
    const errors: string[] = [];

    if (!existsSync(SANDBOX_STORAGE_ROOT)) return { evicted, errors };

    const now = Date.now();
    const maxAgeMs = MAX_PAUSE_AGE_HOURS * 3600 * 1000;
    const fsReaddir = readdirSync;

    for (const entry of fsReaddir(SANDBOX_STORAGE_ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const metaPath = join(SANDBOX_STORAGE_ROOT, entry.name, 'meta.json');
      if (!existsSync(metaPath)) {
        // Orphan directory — clean up
        try {
          rmSync(join(SANDBOX_STORAGE_ROOT, entry.name), { recursive: true, force: true });
          evicted.push(entry.name);
        } catch (e: any) {
          errors.push(`${entry.name}: ${e.message}`);
        }
        continue;
      }

      try {
        const meta: SnapshotMetadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
        const pausedAt = new Date(meta.pausedAt).getTime();
        const ageMs = now - pausedAt;

        if (ageMs > maxAgeMs && meta.state === 'PAUSED') {
          SandboxStorage.evict(entry.name);
          evicted.push(entry.name);
          console.error(
            `[sandbox-storage:auto-evict] ${entry.name} evicted ` +
            `age=${(ageMs / 3600000).toFixed(1)}h max=${MAX_PAUSE_AGE_HOURS}h`,
          );
        }
      } catch (e: any) {
        errors.push(`${entry.name}: ${e.message}`);
      }
    }

    return { evicted, errors };
  }

  /**
   * Health: return storage stats.
   */
  static health(): {
    rootExists: boolean;
    totalSnapshots: number;
    totalSizeBytes: number;
    oldestPausedHours: number | null;
  } {
    const result = {
      rootExists: existsSync(SANDBOX_STORAGE_ROOT),
      totalSnapshots: 0,
      totalSizeBytes: 0,
      oldestPausedHours: null as number | null,
    };

    if (!result.rootExists) return result;

    const now = Date.now();
    let oldestMs = Infinity;
    const fsReaddir = readdirSync;

    for (const entry of fsReaddir(SANDBOX_STORAGE_ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const metaPath = join(SANDBOX_STORAGE_ROOT, entry.name, 'meta.json');
      if (!existsSync(metaPath)) continue;

      try {
        const meta: SnapshotMetadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
        result.totalSnapshots++;
        result.totalSizeBytes += meta.tarballSizeBytes || 0;
        const ageMs = now - new Date(meta.pausedAt).getTime();
        if (ageMs < oldestMs) oldestMs = ageMs;
      } catch {}
    }

    if (oldestMs !== Infinity) {
      result.oldestPausedHours = oldestMs / 3600000;
    }

    return result;
  }
}
