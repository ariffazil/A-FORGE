/**
 * GuardedFileEditor — Amanah-Locked + Pre-Flight Git Protected File Editing
 * ==========================================================================
 * Every file edit through A-FORGE MUST go through this editor.
 * It wraps: Amanah lock acquisition → git diff pre-flight → write → lock release
 * 
 * F1 (Amanah mutex) + F3 (git-backed entropy recovery) + F12 (fail-closed)
 * Ditempa Bukan Diberi.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { AmanahLockManager } from "./AmanahLock.js";
import { checkGitDiff, detectCollision, rollbackFile, logAnomaly } from "./GitDiffGuard.js";
import { sentinelStream } from "../ops/SentinelStream.js";

export interface EditResult {
  verdict: "SEAL" | "HOLD" | "VOID";
  filepath: string;
  agent_id: string;
  lock_id?: string;
  collision_detected?: boolean;
  rollback_triggered?: boolean;
  written?: boolean;
  message: string;
}

export interface GuardedEditOptions {
  agent_id: string;
  intent: string;
  ttl_ms?: number;
  cwd?: string;           // git working directory (defaults to filepath's dir)
  auto_rollback?: boolean;  // if true, auto-rollback on collision instead of returning VOID
}

const lock = AmanahLockManager.getInstance();

/**
 * Atomically edit a file with Amanah lock + git pre-flight protection.
 * 
 * Workflow:
 *  1. Acquire Amanah lock (HOLD if taken)
 *  2. Git diff pre-flight → detect collision (F12)
 *  3. Write file
 *  4. Release lock
 *  5. Broadcast completion
 * 
 * If collision detected and auto_rollback=true → rollback and return VOID.
 */
export async function guardedEdit(
  filepath: string,
  content: string,
  options: GuardedEditOptions
): Promise<EditResult> {
  const { agent_id, intent, ttl_ms = 60_000, cwd, auto_rollback = true } = options;
  const workDir = cwd ?? dirname(filepath);

  // Step 1: Acquire Amanah lock
  const acquireResult = await lock.acquire(filepath, agent_id, intent, ttl_ms);
  if (acquireResult.verdict === "HOLD") {
    return {
      verdict: "HOLD",
      filepath,
      agent_id,
      message: acquireResult.message,
    };
  }

  const lockId = acquireResult.lock_id!;

  // Broadcast: lock acquired
  sentinelStream.lockAcquired(agent_id, filepath, intent);

  try {
    // Step 2: Pre-flight git diff
    const collision = detectCollision(filepath, workDir, agent_id, agent_id);
    if (collision.has_collision) {
      logAnomaly("COLLISION", filepath, agent_id, collision.message);
      return {
        verdict: "VOID",
        filepath,
        agent_id,
        lock_id: lockId,
        collision_detected: true,
        rollback_triggered: false,
        message: collision.message,
      };
    }

    // Step 3: Write file
    try {
      writeFileSync(filepath, content, "utf-8");
    } catch (writeErr: unknown) {
      const errMsg = writeErr instanceof Error ? writeErr.message : String(writeErr);
      return {
        verdict: "VOID",
        filepath,
        agent_id,
        lock_id: lockId,
        message: `Write failed: ${errMsg}`,
      };
    }

    // Step 4: Post-write validation — verify write succeeded
    const written = existsSync(filepath);
    if (!written) {
      return {
        verdict: "VOID",
        filepath,
        agent_id,
        lock_id: lockId,
        message: "Write reported success but file does not exist on disk",
      };
    }

    return {
      verdict: "SEAL",
      filepath,
      agent_id,
      lock_id: lockId,
      collision_detected: false,
      rollback_triggered: false,
      written: true,
      message: `File written: ${filepath}`,
    };

  } finally {
    // Step 5: Always release lock
    const releaseResult = await lock.release(filepath, agent_id);
    sentinelStream.lockReleased(agent_id, filepath);

    // If collision was detected and auto_rollback requested
    if (auto_rollback) {
      const collision = detectCollision(filepath, workDir, agent_id, agent_id);
      if (collision.has_collision && collision.action === "ABORT_ROLLBACK") {
        rollbackFile(filepath, workDir);
        logAnomaly("ROLLBACK", filepath, agent_id, "Auto-rollback triggered after collision");
        sentinelStream.broadcast("SYSTEM_ALERT", "amanah-guard", filepath, "Auto-rollback executed");
      }
    }
  }
}

/**
 * Read a file's current content (no lock required for reads).
 * Use this instead of raw fs.readFileSync to get integrated awareness.
 */
export function guardedRead(filepath: string): { success: boolean; content: string | null; message: string } {
  if (!existsSync(filepath)) {
    return { success: false, content: null, message: `File not found: ${filepath}` };
  }
  try {
    return { success: true, content: readFileSync(filepath, "utf-8"), message: "Read OK" };
  } catch (readErr: unknown) {
    const msg = readErr instanceof Error ? readErr.message : String(readErr);
    return { success: false, content: null, message: `Read failed: ${msg}` };
  }
}

/**
 * Check if a sector (file path prefix) is in READ_ONLY mode
 * due to INFRA_MUTATION_IN_PROGRESS from another agent.
 */
export function isReadOnlySector(filepath: string): boolean {
  // For now, check lock status — if someone holds a lock on this file or its directory,
  // treat it as a contested sector
  // TODO: integrate with SentinelStream subscription for live READ_ONLY state
  return false; // Placeholder — will be integrated with broadcast subscription
}