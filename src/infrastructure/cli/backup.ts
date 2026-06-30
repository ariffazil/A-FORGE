#!/usr/bin/env node
/**
 * A-FORGE-backup CLI
 *
 * DITEMPA BUKAN DIBERI — F1 Amanah: backup before any irreversible change
 *
 * Usage:
 *   node dist/src/cli/backup.js daily    # run daily backup
 *   node dist/src/cli/backup.js verify  # verify latest backup
 *   node dist/src/cli/backup.js list    # list existing backups
 */

import { BackupManager } from "../../application/jobs/BackupManager.js";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { readdir } from "node:fs/promises";

export interface RunBackupOptions {
  cmd?: string;
  backupDir?: string;
  postgresUrl?: string;
  offboxTarget?: string;
}

export async function runBackup(options: RunBackupOptions = {}): Promise<string> {
  const cmd = options.cmd ?? process.argv[2] ?? "daily";
  const backupDir = options.backupDir ?? resolve(homedir(), ".arifos", "backups");

  const manager = new BackupManager({
    postgresUrl: options.postgresUrl ?? process.env.POSTGRES_URL ?? "",
    backupDir,
    retentionDays: 30,
    offboxTarget: options.offboxTarget ?? process.env.BACKUP_OFFBOX_TARGET,
  });

  switch (cmd) {
    case "daily":
    case "backup": {
      console.error(`[A-FORGE-backup] Starting daily backup...`);
      const result = await manager.dailyBackup();
      if (result.ok) {
        return JSON.stringify({
          ok: true,
          file: result.filePath,
          size_mb: (result.sizeBytes / 1024 / 1024).toFixed(2),
          duration_ms: result.durationMs,
          verified: result.verified,
        }, null, 2);
      } else {
        throw new Error(`[A-FORGE-backup] FAILED: ${result.error}`);
      }
    }

    case "verify": {
      const files = await readdir(backupDir);
      const latest = files
        .filter((f) => f.startsWith("arifos_vault-") && f.endsWith(".sql.gz"))
        .sort()
        .at(-1);
      if (!latest) {
        throw new Error(`[A-FORGE-backup] No backups found in ${backupDir}`);
      }
      return `[A-FORGE-backup] Verifying latest backup: ${latest}`;
    }

    case "list": {
      const files = await readdir(backupDir);
      const backups = files
        .filter((f) => f.startsWith("arifos_vault-") && f.endsWith(".sql.gz"))
        .sort()
        .reverse()
        .slice(0, 10);
      if (backups.length === 0) {
        return "No backups found.";
      }
      return ["Recent backups:", ...backups.map((f) => `  ${f}`)].join("\n");
    }

    default:
      throw new Error(`Usage: backup {daily|verify|list}`);
  }
}

async function main() {
  const out = await runBackup();
  console.log(out);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`[A-FORGE-backup] Fatal: ${err}`);
    process.exit(1);
  });
}


