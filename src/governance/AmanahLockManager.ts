/**
 * AmanahLockManager — F1 Integrity Mutex
 *
 * Distributed mutual exclusion for file and infrastructure mutations.
 * Prevents multi-agent collisions (Tragedy of the Commons) by gating
 * write access behind an Amanah (trust) lock.
 *
 * @constitutional F1 Amanah — no irreversible action without stewardship
 * @protocol SERI_KEMBANGAN_ACCORDS Phase 1
 */

import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export interface AmanahLockRecord {
  lock_id: string;
  resource_id: string;
  session_id?: string;
  actor_id: string;
  status: "HELD" | "RELEASED" | "EXPIRED";
  justification: string;
  acquired_at: string;
  expires_at: string;
  released_at?: string;
  release_reason?: string;
}

export interface AcquireResult {
  granted: boolean;
  lock_id?: string;
  holder?: AmanahLockRecord;
  verdict: "SEAL" | "888-HOLD";
  message: string;
}

export interface ReleaseResult {
  released: boolean;
  verdict: "SEAL" | "VOID";
  message: string;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const VAULT_PATH = process.env.AMANAH_VAULT_PATH ?? "./data/amanah_locks.jsonl";

export class AmanahLockManager {
  private static instance: AmanahLockManager | null = null;
  private pgPool: any = null;
  private initialized = false;

  static getInstance(): AmanahLockManager {
    if (!AmanahLockManager.instance) {
      AmanahLockManager.instance = new AmanahLockManager();
    }
    return AmanahLockManager.instance;
  }

  private constructor() {
    const { POSTGRES_URL, DATABASE_URL } = process.env;
    const dsn = POSTGRES_URL || DATABASE_URL;
    if (dsn) {
      try {
        // Dynamic import pg to avoid hard dependency when unused
        const { Pool } = require("pg");
        this.pgPool = new Pool({ connectionString: dsn });
      } catch {
        this.pgPool = null;
      }
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.pgPool) {
      const client = await this.pgPool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS amanah_locks (
            lock_id TEXT PRIMARY KEY,
            resource_id TEXT NOT NULL,
            session_id TEXT,
            actor_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'HELD',
            justification TEXT,
            acquired_at TIMESTAMPTZ NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            released_at TIMESTAMPTZ,
            release_reason TEXT
          )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_amanah_resource ON amanah_locks(resource_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_amanah_status ON amanah_locks(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_amanah_expires ON amanah_locks(expires_at)`);
      } finally {
        client.release();
      }
    } else {
      await mkdir(dirname(VAULT_PATH), { recursive: true });
    }
    this.initialized = true;
  }

  async acquireLock(
    resourceId: string,
    actorId: string,
    justification: string,
    sessionId?: string,
    ttlMs = DEFAULT_TTL_MS
  ): Promise<AcquireResult> {
    await this.initialize();
    const now = new Date();
    const expires = new Date(now.getTime() + ttlMs);

    // 1. Check existing active lock
    const existing = await this.getActiveLock(resourceId);
    if (existing) {
      // If same actor/session, allow re-entrant lock
      if (existing.actor_id === actorId && existing.session_id === sessionId) {
        return {
          granted: true,
          lock_id: existing.lock_id,
          verdict: "SEAL",
          message: `Re-entrant Amanah lock held by ${actorId}`,
        };
      }
      return {
        granted: false,
        holder: existing,
        verdict: "888-HOLD",
        message: `Resource locked by ${existing.actor_id} (lock ${existing.lock_id})`,
      };
    }

    // 2. Grant new lock
    const lockId = `amanah-${randomBytes(8).toString("hex")}`;
    const record: AmanahLockRecord = {
      lock_id: lockId,
      resource_id: resourceId,
      session_id: sessionId,
      actor_id: actorId,
      status: "HELD",
      justification,
      acquired_at: now.toISOString(),
      expires_at: expires.toISOString(),
    };

    if (this.pgPool) {
      await this.pgPool.query(
        `INSERT INTO amanah_locks (lock_id, resource_id, session_id, actor_id, status, justification, acquired_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [record.lock_id, record.resource_id, record.session_id, record.actor_id, record.status, record.justification, record.acquired_at, record.expires_at]
      );
    } else {
      await this._appendVault(record);
    }

    return {
      granted: true,
      lock_id: lockId,
      verdict: "SEAL",
      message: `Amanah lock ${lockId} granted to ${actorId} on ${resourceId}`,
    };
  }

  async releaseLock(lockId: string, actorId: string, reason?: string): Promise<ReleaseResult> {
    await this.initialize();
    const record = await this.getLockById(lockId);
    if (!record) {
      return { released: false, verdict: "VOID", message: `Lock ${lockId} not found` };
    }
    if (record.actor_id !== actorId) {
      return {
        released: false,
        verdict: "VOID",
        message: `Lock ${lockId} owned by ${record.actor_id}; cannot release by ${actorId}`,
      };
    }
    if (record.status !== "HELD") {
      return { released: false, verdict: "VOID", message: `Lock ${lockId} already ${record.status}` };
    }

    const releasedAt = new Date().toISOString();
    if (this.pgPool) {
      await this.pgPool.query(
        `UPDATE amanah_locks SET status = 'RELEASED', released_at = $1, release_reason = $2 WHERE lock_id = $3`,
        [releasedAt, reason ?? "manual_release", lockId]
      );
    } else {
      record.status = "RELEASED";
      record.released_at = releasedAt;
      record.release_reason = reason ?? "manual_release";
      await this._appendVault(record);
    }

    return {
      released: true,
      verdict: "SEAL",
      message: `Amanah lock ${lockId} released by ${actorId}`,
    };
  }

  async getActiveLock(resourceId: string): Promise<AmanahLockRecord | null> {
    await this.initialize();
    const now = new Date().toISOString();

    if (this.pgPool) {
      const result = await this.pgPool.query(
        `SELECT * FROM amanah_locks WHERE resource_id = $1 AND status = 'HELD' AND expires_at > $2 ORDER BY acquired_at DESC LIMIT 1`,
        [resourceId, now]
      );
      if (result.rows.length > 0) return result.rows[0] as AmanahLockRecord;
      return null;
    }

    // File fallback: scan from end for active lock (dedupe by lock_id, keep latest)
    const locks = await this._readVault();
    const latestById = new Map<string, AmanahLockRecord>();
    for (const l of locks) {
      const existing = latestById.get(l.lock_id);
      if (!existing || new Date(l.acquired_at) >= new Date(existing.acquired_at)) {
        latestById.set(l.lock_id, l);
      }
    }
    return Array.from(latestById.values())
      .filter((l) => l.resource_id === resourceId && l.status === "HELD" && l.expires_at > now)
      .sort((a, b) => new Date(b.acquired_at).getTime() - new Date(a.acquired_at).getTime())[0] ?? null;
  }

  async getLockById(lockId: string): Promise<AmanahLockRecord | null> {
    await this.initialize();
    if (this.pgPool) {
      const result = await this.pgPool.query(`SELECT * FROM amanah_locks WHERE lock_id = $1 LIMIT 1`, [lockId]);
      return result.rows[0] ?? null;
    }
    const locks = await this._readVault();
    return locks
      .filter((l) => l.lock_id === lockId)
      .sort((a, b) => new Date(b.acquired_at).getTime() - new Date(a.acquired_at).getTime())[0] ?? null;
  }

  async isLocked(resourceId: string): Promise<boolean> {
    const lock = await this.getActiveLock(resourceId);
    return lock !== null;
  }

  // ── File fallback helpers ───────────────────────────────────────────────

  private async _readVault(): Promise<AmanahLockRecord[]> {
    try {
      const raw = await readFile(VAULT_PATH, "utf8");
      return raw
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .map((l) => JSON.parse(l));
    } catch {
      return [];
    }
  }

  private async _appendVault(record: AmanahLockRecord): Promise<void> {
    await mkdir(dirname(VAULT_PATH), { recursive: true });
    await writeFile(VAULT_PATH, JSON.stringify(record) + "\n", { flag: "a" });
  }
}
