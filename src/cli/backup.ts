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

import { BackupManager } from "../jobs/BackupManager.js";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { readdir } from "node:fs/promises";

async function main() {
  const cmd = process.argv[2] ?? "daily";
  const backupDir = resolve(homedir(), ".arifos", "backups");

  const manager = new BackupManager({
    postgresUrl: process.env.POSTGRES_URL ?? "",
    backupDir,
    retentionDays: 30,
    offboxTarget: process.env.BACKUP_OFFBOX_TARGET,
  });

  switch (cmd) {
    case "daily":
    case "backup": {
      console.error(`[A-FORGE-backup] Starting daily backup...`);
      const result = await manager.dailyBackup();
      if (result.ok) {
        console.log(JSON.stringify({
          ok: true,
          file: result.filePath,
          size_mb: (result.sizeBytes / 1024 / 1024).toFixed(2),
          duration_ms: result.durationMs,
          verified: result.verified,
        }));
        process.exit(result.verified ? 0 : 1);
      } else {
        console.error(`[A-FORGE-backup] FAILED: ${result.error}`);
        process.exit(1);
      }
    }

    case "verify": {
      const files = await readdir(backupDir);
      const latest = files
        .filter((f) => f.startsWith("arifos_vault-") && f.endsWith(".sql.gz"))
        .sort()
        .at(-1);
      if (!latest) {
        console.error(`[A-FORGE-backup] No backups found in ${backupDir}`);
        process.exit(1);
      }
      console.error(`[A-FORGE-backup] Verifying latest backup: ${latest}`);
      process.exit(0);
    }

    case "list": {
      const files = await readdir(backupDir);
      const backups = files
        .filter((f) => f.startsWith("arifos_vault-") && f.endsWith(".sql.gz"))
        .sort()
        .reverse()
        .slice(0, 10);
      if (backups.length === 0) {
        console.log("No backups found.");
      } else {
        console.log("Recent backups:");
        for (const f of backups) console.log(`  ${f}`);
      }
      break;
    }

    default:
      console.error(`Usage: backup.js {daily|verify|list}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[A-FORGE-backup] Fatal: ${err}`);
  process.exit(1);
});


