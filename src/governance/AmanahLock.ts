/**
 * Amanah Lock Manager — F1 Mutual Exclusion Ledger
 * ================================================
 * File-based distributed mutex for multi-agent coordination.
 * Implements the Amanah Lock Protocol from the Seri Kembangan Accords.
 *
 * Usage:
 *   const lock = AmanahLockManager.getInstance();
 *   const result = await lock.acquire(filepath, agentId, intent);
 *   if (result.verdict === "HOLD") { /* wait or abort */ }
 *   // ... do work ...
 *   await lock.release(filepath, agentId);
 *
 * Ditempa Bukan Diberi.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

export interface LockEntry {
  lock_id: string;
  filepath: string;
  agent_id: string;
  intent: string;
  acquired_at: string;   // ISO timestamp
  expires_at: string;    // ISO timestamp
  ttl_ms: number;
}

export interface AcquireResult {
  verdict: "SEAL" | "HOLD";
  lock_id?: string;
  held_by?: string;
  intent?: string;
  retry_after_ms?: number;
  message: string;
}

export interface ReleaseResult {
  verdict: "SEAL" | "VOID";
  message: string;
}

const DEFAULT_TTL_MS = 60_000;  // 60 seconds default
const LOCK_DIR = join(process.env.AF_FORGE_DATA ?? "/root/A-FORGE/data", "locks");
const LOCK_FILE = join(LOCK_DIR, "amanah-locks.jsonl");

function now(): string {
  return new Date().toISOString();
}

function msUntilExpiry(entry: LockEntry): number {
  return new Date(entry.expires_at).getTime() - Date.now();
}

export class AmanahLockManager {
  private static _instance: AmanahLockManager | null = null;

  private constructor() {
    // Ensure lock directory exists
    if (!existsSync(LOCK_DIR)) {
      mkdirSync(LOCK_DIR, { recursive: true });
    }
  }

  static getInstance(): AmanahLockManager {
    if (!AmanahLockManager._instance) {
      AmanahLockManager._instance = new AmanahLockManager();
    }
    return AmanahLockManager._instance;
  }

  /** Read all active (non-expired) locks from the ledger */
  private readLocks(): LockEntry[] {
    if (!existsSync(LOCK_FILE)) return [];
    try {
      const raw = readFileSync(LOCK_FILE, "utf-8");
      const lines = raw.split("\n").filter(l => l.trim());
      return lines
        .map(line => {
          try { return JSON.parse(line) as LockEntry; }
          catch { return null; }
        })
        .filter((e): e is LockEntry => e !== null && msUntilExpiry(e) > 0);
    } catch {
      return [];
    }
  }

  /** Append a new lock entry to the ledger */
  private appendLock(entry: LockEntry): void {
    const line = JSON.stringify(entry) + "\n";
    writeFileSync(LOCK_FILE, line, { flag: "a" });
  }

  /** Rewrite the ledger with only non-expired locks */
  private compactLocks(activeLocks: LockEntry[]): void {
    const lines = activeLocks.map(e => JSON.stringify(e)).join("\n") + "\n";
    writeFileSync(LOCK_FILE, lines);
  }

  /**
   * Attempt to acquire the Amanah lock for a filepath.
   * If already locked by another agent, return HOLD with retry guidance.
   */
  async acquire(
    filepath: string,
    agent_id: string,
    intent: string,
    ttl_ms: number = DEFAULT_TTL_MS,
  ): Promise<AcquireResult> {
    const locks = this.readLocks();
    const now_ts = now();

    // Check if this agent already holds the lock
    const existing = locks.find(
      l => l.filepath === filepath && l.agent_id === agent_id && msUntilExpiry(l) > 0
    );
    if (existing) {
      return {
        verdict: "SEAL",
        lock_id: existing.lock_id,
        message: `Lock already held by ${agent_id} on ${filepath}. Intent: ${existing.intent}`,
      };
    }

    // Check if another agent holds the lock
    const conflicting = locks.find(
      l => l.filepath === filepath && l.agent_id !== agent_id && msUntilExpiry(l) > 0
    );

    if (conflicting) {
      const retry_after = msUntilExpiry(conflicting);
      return {
        verdict: "HOLD",
        held_by: conflicting.agent_id,
        intent: conflicting.intent,
        retry_after_ms: Math.max(retry_after, 5_000), // minimum 5s wait
        message: `Resource locked by ${conflicting.agent_id}. Intent: ${conflicting.intent}. Retry after ${Math.ceil(retry_after / 1000)}s.`,
      };
    }

    // Grant the lock
    const entry: LockEntry = {
      lock_id: randomUUID(),
      filepath,
      agent_id,
      intent,
      acquired_at: now_ts,
      expires_at: new Date(Date.now() + ttl_ms).toISOString(),
      ttl_ms,
    };

    this.appendLock(entry);

    return {
      verdict: "SEAL",
      lock_id: entry.lock_id,
      message: `Amanah lock acquired for ${filepath} by ${agent_id}. Expires in ${ttl_ms}ms.`,
    };
  }

  /**
   * Release the Amanah lock for a filepath.
   * Verifies the calling agent actually holds the lock.
   */
  async release(filepath: string, agent_id: string): Promise<ReleaseResult> {
    const locks = this.readLocks();
    const stillHeld = locks.find(
      l => l.filepath === filepath && l.agent_id === agent_id && msUntilExpiry(l) > 0
    );

    if (!stillHeld) {
      return {
        verdict: "VOID",
        message: `No active lock held by ${agent_id} on ${filepath}. Already released or expired.`,
      };
    }

    // Remove the lock entry (compact the file)
    const remaining = locks.filter(
      l => !(l.filepath === filepath && l.agent_id === agent_id && msUntilExpiry(l) > 0)
    );
    this.compactLocks(remaining);

    return {
      verdict: "SEAL",
      message: `Amanah lock released for ${filepath} by ${agent_id}.`,
    };
  }

  /** Force-release any lock on a filepath (sovereign override) */
  async forceRelease(filepath: string, authorized_by: string): Promise<ReleaseResult> {
    const locks = this.readLocks();
    const remaining = locks.filter(l => l.filepath !== filepath || msUntilExpiry(l) <= 0);
    this.compactLocks(remaining);

    return {
      verdict: "SEAL",
      message: `Sovereign override: all locks on ${filepath} cleared by ${authorized_by}.`,
    };
  }

  /** Inspect current lock state for a filepath */
  async status(filepath: string): Promise<{
    locked: boolean;
    held_by: string | null;
    intent: string | null;
    expires_at: string | null;
    ms_remaining: number;
  }> {
    const locks = this.readLocks();
    const active = locks.find(l => l.filepath === filepath && msUntilExpiry(l) > 0);

    if (!active) {
      return { locked: false, held_by: null, intent: null, expires_at: null, ms_remaining: 0 };
    }

    return {
      locked: true,
      held_by: active.agent_id,
      intent: active.intent,
      expires_at: active.expires_at,
      ms_remaining: msUntilExpiry(active),
    };
  }

  /** List all active locks (for auditing) */
  async listLocks(): Promise<LockEntry[]> {
    return this.readLocks();
  }
}

// Singleton export
export const amanahLock = AmanahLockManager.getInstance();