/**
 * Pre-Flight Git Diff Checker — Seri Kembangan Phase 2
 * ===================================================
 * Collision Detection: Before any MCP file edit, run git diff.
 * If the file has uncommitted changes NOT by the current lock-holder,
 * treat it as a breach and trigger rollback.
 *
 * F12 Fail-Closed: Abort → git checkout HEAD → log to vault999.jsonl
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

export interface DiffResult {
  clean: boolean;
  modified: boolean;
  modified_by_current_agent: boolean;
  changed_files: string[];
  message: string;
}

export interface CollisionDetection {
  has_collision: boolean;
  breaching_agent: string | null;
  action: "PROCEED" | "ABORT_ROLLBACK";
  message: string;
}

const VAULT_PATH = process.env.AF_FORGE_VAULT ?? "/root/A-FORGE/data/vault999.jsonl";

function execGit(cwd: string, args: string[]): string {
  try {
    return execSync(`git ${args.join(" ")}`, {
      cwd,
      encoding: "utf-8",
      timeout: 10_000,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("not a git repository")) return "";
    if (msg.includes("ambiguous argument")) return "";
    throw e;
  }
}

function gitAuthor(filepath: string, cwd: string): string {
  try {
    const out = execGit(cwd, [
      "log", "-1", "--format=%ae", "--", filepath,
    ]);
    return out.trim();
  } catch {
    return "unknown";
  }
}

export function checkGitDiff(filepath: string, cwd: string): DiffResult {
  if (!existsSync(join(cwd, ".git"))) {
    return { clean: true, modified: false, modified_by_current_agent: false, changed_files: [], message: "Not a git repo — skipping diff check" };
  }

  const statusOut = execGit(cwd, ["status", "--porcelain", "--", filepath]).trim();
  const diffOut = execGit(cwd, ["diff", "--name-only", filepath]).trim();

  if (!statusOut && !diffOut) {
    return { clean: true, modified: false, modified_by_current_agent: false, changed_files: [], message: "No uncommitted changes — file clean" };
  }

  const changedFiles = diffOut ? diffOut.split("\n").filter(Boolean) : [];

  // File was modified — check if it's our own agent (we are the lock holder)
  return {
    clean: false,
    modified: true,
    modified_by_current_agent: changedFiles.includes(filepath),
    changed_files: changedFiles,
    message: changedFiles.length
      ? `Uncommitted changes detected: ${changedFiles.join(", ")}`
      : `File modified but not in diff — possible race condition`,
  };
}

/**
 * Detect collision: if file has uncommitted changes NOT authored by the current agent,
 * it's a rogue breach → FAIL-CLOSED (F12).
 */
export function detectCollision(
  filepath: string,
  cwd: string,
  currentAgent: string,
  lockAgent: string,   // the agent that holds the Amanah lock
): CollisionDetection {
  const diff = checkGitDiff(filepath, cwd);

  if (diff.clean || diff.modified_by_current_agent) {
    return { has_collision: false, breaching_agent: null, action: "PROCEED", message: "Proceed — file is clean or modified by lock holder" };
  }

  // Collision: file modified by someone else while we hold the lock
  const lastAuthor = gitAuthor(filepath, cwd);
  const breach = lastAuthor !== currentAgent;

  if (breach) {
    return {
      has_collision: true,
      breaching_agent: lastAuthor,
      action: "ABORT_ROLLBACK",
      message: `F12 FAIL-CLOSED: ${filepath} modified by ${lastAuthor} while ${lockAgent} holds Amanah lock. Rolling back.`,
    };
  }

  return { has_collision: false, breaching_agent: null, action: "PROCEED", message: "Proceed" };
}

/** Rollback: git checkout HEAD -- <filepath> */
export function rollbackFile(filepath: string, cwd: string): { success: boolean; message: string } {
  try {
    execGit(cwd, ["checkout", "HEAD", "--", filepath]);
    return { success: true, message: `Rolled back ${filepath} to HEAD` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, message: `Rollback failed for ${filepath}: ${msg}` };
  }
}

/** Log anomaly to vault999.jsonl */
export function logAnomaly(
  type: "COLLISION" | "ROLLBACK" | "BREACH",
  filepath: string,
  agent: string,
  detail: string
): void {
  const entry = {
    epoch: new Date().toISOString(),
    type,
    filepath,
    agent,
    detail,
    verdict: "SEAL",
    subsystem: "AmanahLock",
  };
  const line = JSON.stringify(entry) + "\n";
  try {
    const { appendFileSync } = require("fs");
    appendFileSync(VAULT_PATH, line);
  } catch {
    // vault not available — skip
  }
}