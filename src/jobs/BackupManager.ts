/**
 * AF-FORGE Backup Manager
 *
 * Manages VAULT999 PostgreSQL backups via pg_dump.
 * F1 Amanah compliant: all backups are to local disk first, then optionally
 * pushed to off-box storage (S3, rsync, etc.).
 *
 * Environment:
 *   POSTGRES_URL     — postgresql://arifos_admin:PASS@host:5432/arifos_vault
 *   BACKUP_DIR       — Local backup directory (default: ~/.arifos/backups)
 *   BACKUP_RETENTION — Days to keep local backups (default: 30)
 *   OFFBOX_TARGET    — Optional: rsync/s3 target for off-box replication
 *
 * Constitution-aligned:
 *   - pg_dump runs before any irreversible schema change (F1)
 *   - Backup verification via pg_restore --dry-run (F8)
 *   - All backup events logged to VAULT999 telemetry (F11)
 */

import { spawn } from "node:child_process";
import { appendFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { getPostgresVaultClient } from "../vault/index.js";
import type { VaultVerdict } from "../vault/VaultClient.js";

export interface BackupResult {
  ok: boolean;
  filePath: string;
  sizeBytes: number;
  durationMs: number;
  verified: boolean;
  error?: string;
}

export interface BackupManagerConfig {
  postgresUrl: string;
  backupDir?: string;
  retentionDays?: number;
  offboxTarget?: string;
}

export class BackupManager {
  private readonly backupDir: string;
  private readonly retentionDays: number;
  private readonly offboxTarget?: string;
  private readonly pgUrl: string;

  constructor(config: BackupManagerConfig) {
    this.pgUrl = config.postgresUrl ?? process.env.POSTGRES_URL ?? "";
    this.backupDir = config.backupDir ?? resolve(homedir(), ".arifos", "backups");
    this.retentionDays = config.retentionDays ?? 30;
    this.offboxTarget = config.offboxTarget ?? process.env.BACKUP_OFFBOX_TARGET;
  }

  async dailyBackup(): Promise<BackupResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `arifos_vault-${timestamp}.sql.gz`;
    const filePath = join(this.backupDir, fileName);
    const start = Date.now();

    await mkdir(this.backupDir, { recursive: true });

    const result = await this.pgDump(filePath);
    const durationMs = Date.now() - start;

    if (!result.ok) {
      await this.logBackupEvent({ ok: false, filePath, sizeBytes: 0, durationMs, verified: false, error: result.error });
      return { ok: false, filePath, sizeBytes: 0, durationMs, verified: false, error: result.error };
    }

    let sizeBytes = 0;
    try {
      const st = await stat(filePath);
      sizeBytes = Number(st.size);
    } catch { /* best effort */ }

    const verified = await this.verifyBackup(filePath);

    await this.logBackupEvent({
      ok: true,
      filePath,
      sizeBytes,
      durationMs,
      verified,
    });

    await this.cleanupOldBackups();

    if (this.offboxTarget && verified) {
      await this.pushOffbox(filePath).catch((err) =>
        process.stderr.write(`[BackupManager] offbox push failed: ${err}\n`),
      );
    }

    process.stderr.write(
      `[BackupManager] backup complete: ${fileName} ${(sizeBytes / 1024 / 1024).toFixed(1)}MB ${durationMs}ms verified=${verified}\n`,
    );

    return { ok: true, filePath, sizeBytes, durationMs, verified };
  }

  private async pgDump(outputPath: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.pgUrl) return { ok: false, error: "POSTGRES_URL not configured" };

    const url = new URL(this.pgUrl);
    const env = {
      ...process.env,
      PGPASSWORD: url.password,
    };
    const host = url.hostname;
    const port = url.port || "5432";
    const user = url.username;
    const db = url.pathname.replace("/", "") || "arifos_vault";

    return new Promise((resolve) => {
      const proc = spawn(
        "pg_dump",
        ["-h", host, "-p", port, "-U", user, "-d", db, "-Fc", "-f", outputPath],
        { env, shell: false },
      );
      let stderr = "";
      proc.on("error", (err) => resolve({ ok: false, error: String(err) }));
      proc.on("close", (code) => {
        if (code === 0) resolve({ ok: true });
        else resolve({ ok: false, error: `pg_dump exited ${code}: ${stderr}` });
      });
      proc.stderr?.on("data", (d) => { stderr += d.toString(); });
    });
  }

  private async verifyBackup(dumpPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("pg_restore", ["--dry-run", "--schema-only", "-Fc", dumpPath], {
        env: { ...process.env, PGPASSWORD: new URL(this.pgUrl).password },
        shell: false,
      });
      let stderr = "";
      proc.on("error", () => resolve(false));
      proc.on("close", (code) => {
        if (code === 0) { resolve(true); }
        else {
          process.stderr.write(`[BackupManager] verify failed: ${stderr}\n`);
          resolve(false);
        }
      });
      proc.stderr?.on("data", (d) => { stderr += d.toString(); });
    });
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const files = await readdir(this.backupDir);
      const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
      for (const file of files) {
        if (!file.startsWith("arifos_vault-") || !file.endsWith(".sql.gz")) continue;
        const st = await stat(join(this.backupDir, file));
        if (st.mtimeMs < cutoff) {
          await rm(join(this.backupDir, file));
          process.stderr.write(`[BackupManager] deleted old backup: ${file}\n`);
        }
      }
    } catch (err) {
      process.stderr.write(`[BackupManager] cleanup error: ${err}\n`);
    }
  }

  private async pushOffbox(_localPath: string): Promise<void> {
    if (!this.offboxTarget) return;
    // Placeholder: rsync or S3 sync
    // rsync -avz --progress {localPath} {offboxTarget}/
    // or: aws s3 cp {localPath} s3://{bucket}/backups/
    process.stderr.write(`[BackupManager] offbox push to ${this.offboxTarget} — not implemented yet\n`);
  }

  private async logBackupEvent(result: BackupResult): Promise<void> {
    try {
      const vault = getPostgresVaultClient();
      const verdict: VaultVerdict = result.ok ? "SEAL" : result.verified ? "HOLD" : "VOID";
      await vault.seal({
        sealId: `BACKUP-${Date.now()}`,
        sessionId: "BACKUP-MANAGER",
        verdict,
        hashofinput: "",
        telemetrysnapshot: {
          dS: result.ok ? 0 : 0.3,
          peace2: result.ok ? 1.0 : 0.7,
          psi_le: result.verified ? 1.0 : 0.5,
          W3: 0.9,
          G: 0.85,
        },
        floors_triggered: ["F1"],
        irreversibilityacknowledged: true,
        timestamp: new Date().toISOString(),
        task: `pg_dump backup: ${result.ok ? "SUCCESS" : "FAILED"} ${result.error ?? ""}`,
        finalText: result.ok
          ? `Backup verified=${result.verified} size=${result.sizeBytes} bytes`
          : `Backup failed: ${result.error}`,
        turnCount: 0,
        profileName: "backup-manager",
      });
    } catch { /* best effort */ }
  }
}
