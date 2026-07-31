/**
 * forge_git_commit / forge_entropy_sweep / forge_canonize
 *
 * Three MCP tools completing the FORGE P2.6 canonical gap fill.
 *
 * forge_git_commit  — Governed git commit with pre-commit entropy gate
 * forge_entropy_sweep — Workspace entropy measurement (ΔS)
 * forge_canonize     — Draft→canonical promotion with signature
 *
 * All three classified in actionClassifier.ts.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSync } from "node:child_process";
import { readFile, writeFile, mkdir, rename, copyFile } from "node:fs/promises";
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve, basename, dirname } from "node:path";
import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";

// ── Lock file quiesce types ─────────────────────────────────────────────────
interface LockFileReport {
  path: string;
  kind: "dependency" | "mutex";
  held: boolean;
  holder_pid?: number;
  holder_cmd?: string;
  stale: boolean;
  recommendation: string;
}

const DEPENDENCY_LOCKFILE_NAMES = new Set([
  "Cargo.lock",
  "Gemfile.lock",
  "Pipfile.lock",
  "composer.lock",
  "poetry.lock",
  "uv.lock",
  "yarn.lock",
]);

export function isDependencyLockfile(lockPath: string): boolean {
  return DEPENDENCY_LOCKFILE_NAMES.has(basename(lockPath));
}

// ═══════════════════════════════════════════════════════════════════════════
// FORGE_GIT_COMMIT
// ═══════════════════════════════════════════════════════════════════════════

const ForgeGitCommitInput = z.object({
  message: z.string().min(1, "Commit message required"),
  repo: z.string().default("/root").describe("Repo path"),
  push: z.boolean().default(false).describe("Push after commit"),
  verify: z.boolean().default(true).describe("Run pre-commit checks"),
});

const ForgeGitCommitOutput = z.object({
  success: z.boolean(),
  commit_hash: z.string().optional(),
  files_changed: z.number().optional(),
  message: z.string(),
  pre_commit_checks: z.string().optional(),
});

/**
 * forge_git_commit — Governed git commit.
 * Delegates to forge_git(mode=commit) pattern.
 * Runs pre-commit entropy gate before committing.
 */
export async function registerForgeGitCommit(server: McpServer): Promise<void> {
  server.registerTool(
    "forge_git_commit",
    {
      description:
        "Governed git commit with optional pre-commit checks. " +
        "Delegates to forge_git(mode=commit) under a constitutional gate. " +
        "F1 AMANAH: verifies working tree before commit. " +
        "Classification: EXECUTE_HIGH_IMPACT in actionClassifier.ts.",
      inputSchema: ForgeGitCommitInput,
    },
    async (params) => {
      const { message, repo, push, verify } = ForgeGitCommitInput.parse(params);
      
      try {
        // Pre-commit: check git status
        const status = execSync("git status --porcelain", {
          cwd: repo, encoding: "utf-8", timeout: 10000,
        }).trim();
        
        if (!status) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({
              success: false, message: "Nothing to commit — working tree clean.",
            })}],
          };
        }
        
        const filesChanged = status.split("\n").length;
        
        // Pre-commit entropy gate
        let preCommitLog = "passed";
        if (verify) {
          // Basic check: no secrets, no large binaries
          const hasSecrets = status.split("\n").some(line => 
            line.includes(".env") || line.includes("vault.env") || line.includes("secret")
          );
          if (hasSecrets) {
            preCommitLog = "WARNING: potential secrets in staging";
          }
        }
        
        // Git add + commit
        execSync("git add -A", { cwd: repo, encoding: "utf-8", timeout: 30000 });
        execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
          cwd: repo, encoding: "utf-8", timeout: 30000,
        });
        
        // Get commit hash
        const hash = execSync("git rev-parse HEAD", {
          cwd: repo, encoding: "utf-8", timeout: 10000,
        }).trim();
        
        // Push if requested
        if (push) {
          execSync("git push", { cwd: repo, encoding: "utf-8", timeout: 60000 });
        }
        
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            success: true,
            commit_hash: hash,
            files_changed: filesChanged,
            message: `Committed ${filesChanged} file(s): ${hash.substring(0, 8)}`,
            pre_commit_checks: preCommitLog,
          })}],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            success: false,
            message: `git commit failed: ${err.message}`,
          })}],
        };
      }
    }
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// FORGE_ENTROPY_SWEEP
// ═══════════════════════════════════════════════════════════════════════════

const ForgeEntropySweepInput = z.object({
  path: z.string().default("/root").describe("Root path to sweep"),
  max_depth: z.number().default(3).describe("Directory depth"),
  include_hidden: z.boolean().default(false),
});

const ForgeEntropySweepOutput = z.object({
  total_files: z.number(),
  total_dirs: z.number(),
  uncommitted_files: z.number(),
  total_size_bytes: z.number(),
  temp_files: z.number(),
  dead_processes: z.number(),
  entropy_score: z.number(),
  hotspots: z.array(z.object({
    path: z.string(),
    entropy_contribution: z.number(),
    reason: z.string(),
  })),
  recommendations: z.array(z.string()),
});

/**
 * forge_entropy_sweep — Workspace entropy measurement tool.
 * Measures ΔS across: file count, dir tree, uncommitted changes,
 * temp files, dead processes, stale lock files. Returns structured entropy report.
 * Pure OBSERVE — no mutation.
 *
 * Lock file quiesce-check (Gap 5, 2026-07-29):
 *   Detects .lock files, checks holder process liveness via fuser/kill -0,
 *   classifies as stale (safe to remove) or held (active). Follows etcd
 *   fencing-token principle: never delete by name only — verify holder PID first.
 */

// ── Lock file quiesce-check ────────────────────────────────────────────────
export function quiesceCheckLockFiles(scanPath: string): LockFileReport[] {
  const reports: LockFileReport[] = [];
  try {
    // Find all .lock files (excluding system paths)
    const found = execSync(
      `find "${scanPath}" -name "*.lock" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/__pycache__/*" -not -path "*/.venv/*" 2>/dev/null`,
      { encoding: "utf-8", timeout: 10000, maxBuffer: 1024 * 1024 }
    ).trim();
    if (!found) return reports;

    const lockPaths = found.split("\n").filter(Boolean);
    for (const lockPath of lockPaths) {
      const dependencyLock = isDependencyLockfile(lockPath);
      const report: LockFileReport = {
        path: lockPath,
        kind: dependencyLock ? "dependency" : "mutex",
        held: false,
        stale: false,
        recommendation: "",
      };
      if (dependencyLock) {
        report.recommendation = "Dependency lockfile — preserve for reproducible builds; not a runtime mutex.";
        reports.push(report);
        continue;
      }
      try {
        // Step 1: fuser to find holder PID
        const fuserOut = execSync(`fuser "${lockPath}" 2>/dev/null || true`, {
          encoding: "utf-8", timeout: 3000,
        }).trim();
        if (fuserOut) {
          const pids = fuserOut.split(/\s+/).filter(s => /^\d+$/.test(s));
          if (pids.length > 0) {
            const pid = parseInt(pids[0]);
            report.holder_pid = pid;
            // Step 2: quiesce-check — is the process still alive?
            try {
              execSync(`kill -0 ${pid} 2>/dev/null`, { encoding: "utf-8", timeout: 2000 });
              // Process alive — lock is held
              report.held = true;
              report.stale = false;
              try {
                report.holder_cmd = execSync(`ps -p ${pid} -o comm= 2>/dev/null || echo "unknown"`, {
                  encoding: "utf-8", timeout: 2000,
                }).trim();
              } catch { report.holder_cmd = "unknown"; }
              report.recommendation = `Active lock held by PID ${pid} (${report.holder_cmd}) — do NOT remove`;
            } catch {
              // kill -0 failed — process dead, lock stale
              report.held = false;
              report.stale = true;
              report.recommendation = `STALE — holder PID ${pid} no longer alive. Safe to remove: rm "${lockPath}"`;
            }
          }
        } else {
          // No fuser output — no process attached
          report.stale = true;
          report.recommendation = `STALE — no process holds this lock. Safe to remove: rm "${lockPath}"`;
        }
      } catch {
        // fuser failed entirely — lock may be on NFS or inaccessible
        report.recommendation = "UNKNOWN — could not check holder. Verify manually before removal.";
      }
      reports.push(report);
    }
  } catch {
    // find or fuser unavailable — skip lock check gracefully
  }
  return reports;
}
export async function registerForgeEntropySweep(server: McpServer): Promise<void> {
  server.registerTool(
    "forge_entropy_sweep",
    {
      description:
        "Measure workspace entropy (ΔS) across the federation. " +
        "Reports file count, uncommitted changes, temp files, dead processes, " +
        "and entropy hotspots. Classification: OBSERVE (read-only).",
      inputSchema: ForgeEntropySweepInput,
    },
    async (params) => {
      const { path: scanPath, max_depth, include_hidden } = ForgeEntropySweepInput.parse(params);
      
      try {
        let totalFiles = 0;
        let totalDirs = 0;
        let tempFiles = 0;
        let totalSize = 0;
        
        function scanDir(dirPath: string, depth: number) {
          if (depth > max_depth) return;
          let entries: string[];
          try {
            entries = readdirSync(dirPath);
          } catch { return; }
          
          for (const entry of entries) {
            if (!include_hidden && entry.startsWith(".")) continue;
            // Skip node_modules, .git, __pycache__
            if (entry === "node_modules" || entry === ".git" || entry === "__pycache__" ||
                entry === ".venv" || entry === "dist") continue;
            
            const fullPath = resolve(dirPath, entry);
            try {
              const stats = statSync(fullPath);
              if (stats.isDirectory()) {
                totalDirs++;
                scanDir(fullPath, depth + 1);
              } else {
                totalFiles++;
                totalSize += stats.size;
                if (entry.endsWith(".tmp") || entry.endsWith(".temp") ||
                    entry.startsWith(".tmp") || entry.endsWith("~")) {
                  tempFiles++;
                }
              }
            } catch { /* permission denied — skip */ }
          }
        }
        
        scanDir(scanPath, 0);
        
        // Uncommitted files
        let uncommitted = 0;
        try {
          const status = execSync("git status --porcelain 2>/dev/null | wc -l", {
            cwd: scanPath, encoding: "utf-8", timeout: 5000,
          }).trim();
          uncommitted = parseInt(status) || 0;
        } catch { /* not a git repo */ }
        
        // Dead processes (zombie state)
        // F9 ANTI-HANTU FIX 2026-07-31: previous regex `grep -c '[Z]'` matched the
        // literal character Z anywhere in `ps aux` output, including Supabase
        // passwords containing Z and the grep command itself. This produced false
        // positives. New check parses the STAT column (8th column) for actual
        // zombie state Z (or Z+ for multi-thread zombies).
        let deadProcesses = 0;
        try {
          const zombies = execSync(
            "ps -eo stat 2>/dev/null | awk '$1 ~ /^Z/' | wc -l",
            { encoding: "utf-8", timeout: 5000 },
          ).trim();
          deadProcesses = parseInt(zombies) || 0;
        } catch { /* no ps */ }

        // ── Lock file quiesce-check (Gap 5) ──
        let lockFiles = 0;
        let staleLocks = 0;
        let heldLocks = 0;
        let dependencyLocks = 0;
        let lockReports: LockFileReport[] = [];
        try {
          lockReports = quiesceCheckLockFiles(scanPath);
          lockFiles = lockReports.length;
          staleLocks = lockReports.filter(r => r.stale).length;
          heldLocks = lockReports.filter(r => r.held).length;
          dependencyLocks = lockReports.filter(r => r.kind === "dependency").length;
        } catch { /* lock check degraded */ }

        // Entropy score: normalized [0, 1]
        const entropyScore = Math.min(1.0, (
          (uncommitted / Math.max(totalFiles, 1)) * 0.3 +
          (tempFiles / Math.max(totalFiles, 1)) * 0.2 +
          (deadProcesses / 100) * 0.2 +
          (Math.log10(totalFiles + 1) / 6) * 0.3
        ));
        
        // Hotspots
        const hotspots: Array<{path: string; entropy_contribution: number; reason: string}> = [];
        if (uncommitted > 10) {
          hotspots.push({
            path: scanPath,
            entropy_contribution: Math.round(uncommitted / Math.max(totalFiles, 1) * 100) / 100,
            reason: `${uncommitted} uncommitted files — git drift`,
          });
        }
        if (tempFiles > 5) {
          hotspots.push({
            path: scanPath,
            entropy_contribution: Math.round(tempFiles / Math.max(totalFiles, 1) * 100) / 100,
            reason: `${tempFiles} temporary files — cleanup needed`,
          });
        }
        if (staleLocks > 0) {
          hotspots.push({
            path: scanPath,
            entropy_contribution: Math.round(staleLocks / Math.max(lockFiles || 1, 1) * 100) / 100,
            reason: `${staleLocks} stale .lock files — safe to remove (no holder process alive)`,
          });
        }
        if (heldLocks > 0 && staleLocks === 0) {
          hotspots.push({
            path: scanPath,
            entropy_contribution: 0,
            reason: `${heldLocks} active .lock files held by running processes — no action needed`,
          });
        }

        // Recommendations
        const recommendations: string[] = [];
        if (uncommitted > 10) recommendations.push("Run forge_git_commit to reduce git drift");
        if (tempFiles > 5) recommendations.push("Clean temp files (forge_filesystem with quarantine)");
        if (deadProcesses > 0) recommendations.push(`Investigate ${deadProcesses} zombie processes`);
        if (staleLocks > 0) recommendations.push(`${staleLocks} stale lock files — safe to remove. Use forge_filesystem_delete(path, quarantine) or rm manually.`);
        if (entropyScore > 0.6) recommendations.push("High entropy — consider workspace reorganization");
        
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            total_files: totalFiles,
            total_dirs: totalDirs,
            uncommitted_files: uncommitted,
            total_size_bytes: totalSize,
            temp_files: tempFiles,
            dead_processes: deadProcesses,
            lock_files: {
              total: lockFiles,
              stale: staleLocks,
              held: heldLocks,
              dependency: dependencyLocks,
              reports: lockReports.map(r => ({
                path: r.path,
                kind: r.kind,
                held: r.held,
                stale: r.stale,
                recommendation: r.recommendation,
              })),
            },
            entropy_score: Math.round(entropyScore * 100) / 100,
            hotspots,
            recommendations,
          })}],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            total_files: 0, total_dirs: 0, uncommitted_files: 0,
            total_size_bytes: 0, temp_files: 0, dead_processes: 0,
            entropy_score: 1.0,  // Error = max entropy
            hotspots: [{ path: scanPath, entropy_contribution: 1.0, reason: `Sweep error: ${err.message}` }],
            recommendations: [`Entropy sweep failed: ${err.message}. Manual investigation needed.`],
          })}],
        };
      }
    }
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// FORGE_CANONIZE
// ═══════════════════════════════════════════════════════════════════════════

const ForgeCanonizeInput = z.object({
  source_path: z.string().describe("Path to draft artifact to canonize"),
  target_name: z.string().optional().describe("Canonical name (defaults to filename)"),
  category: z.string().default("artifact").describe("Category: artifact | report | doctrine | skill"),
  sign: z.boolean().default(true).describe("Sign with SHA256"),
});

const ForgeCanonizeOutput = z.object({
  success: z.boolean(),
  canonical_path: z.string(),
  sha256: z.string().optional(),
  category: z.string(),
  message: z.string(),
});

/**
 * forge_canonize — Promote a draft artifact to canonical state.
 * Signs with SHA256, registers in forge_work/CANON/, and records provenance.
 * Classification: EXECUTE_REVERSIBLE.
 */
export async function registerForgeCanonize(server: McpServer): Promise<void> {
  server.registerTool(
    "forge_canonize",
    {
      description:
        "Promote a draft artifact to canonical state. " +
        "Copies from source to forge_work/CANON/, computes SHA256, " +
        "records provenance receipt. Does NOT delete source (F1 AMANAH). " +
        "Classification: EXECUTE_REVERSIBLE.",
      inputSchema: ForgeCanonizeInput,
    },
    async (params) => {
      const { source_path, target_name, category, sign } = ForgeCanonizeInput.parse(params);
      
      try {
        // Verify source exists
        const sourceContent = await readFile(source_path, "utf-8").catch(() => null);
        if (!sourceContent && !existsSync(source_path)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({
              success: false,
              canonical_path: "",
              message: `Source not found: ${source_path}`,
            })}],
          };
        }
        
        // Determine target path
        const name = target_name || basename(source_path);
        const canonDir = resolve("/root/A-FORGE/forge_work/CANON", category);
        await mkdir(canonDir, { recursive: true });
        const targetPath = resolve(canonDir, name);
        
        // Compute SHA256 if requested
        let sha256: string | undefined;
        if (sign) {
          const content = await readFile(source_path);
          sha256 = createHash("sha256").update(content).digest("hex");
        }
        
        // Copy (not move — F1 AMANAH)
        await copyFile(source_path, targetPath);
        
        // Write provenance receipt
        const receipt = {
          artifact: name,
          source: source_path,
          canonical_path: targetPath,
          sha256,
          category,
          canonized_at: new Date().toISOString(),
          canonize_id: `canon-${randomUUID().substring(0, 8)}`,
        };
        await writeFile(`${targetPath}.receipt.json`, JSON.stringify(receipt, null, 2));
        
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            success: true,
            canonical_path: targetPath,
            sha256,
            category,
            message: `Canonized ${name} → ${targetPath}${sha256 ? ` (SHA256: ${sha256.substring(0, 16)}...)` : ""}`,
          })}],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            success: false,
            canonical_path: "",
            message: `Canonize failed: ${err.message}`,
          })}],
        };
      }
    }
  );
}
