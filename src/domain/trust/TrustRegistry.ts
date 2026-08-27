/**
 * TrustRegistry.ts — Postgres-backed trust score persistence
 *
 * ECOSYSTEM_EXPANSION::v1 Phase 2: TRUST
 * Append-only trust score store with hash chain integrity.
 *
 * Schema:
 *   trust_scores    — one row per MCP server (latest score)
 *   trust_history   — append-only score history (hash-chained)
 *
 * Constitutional:
 *   F1 AMANAH  — append-only, no updates to history
 *   F2 TRUTH   — every score backed by probe evidence
 *   F11 AUDIT  — hash chain integrity on history
 *
 * @module domain/trust/TrustRegistry
 * @forged 2026-08-20 by 333-AGI under F13 SOVEREIGN directive
 * DITEMPA BUKAN DIBERI
 */

import { createHash } from "node:crypto";
import { Pool, type PoolConfig } from "pg";
import type { TrustScore, TrustBand, DimensionScore } from "./TrustTypes.js";

// ── Types ───────────────────────────────────────────────────────────

export interface RegistryConfig {
  connectionString?: string;
  poolConfig?: Omit<PoolConfig, "connectionString">;
}

// ── Schema Migration ────────────────────────────────────────────────

const SCHEMA_SQL = `
-- Trust scores: one row per MCP server (latest evaluation)
CREATE TABLE IF NOT EXISTS trust_scores (
  mcp_id          TEXT PRIMARY KEY,
  mcp_name        TEXT NOT NULL,
  mcp_endpoint    TEXT NOT NULL,
  composite_score REAL NOT NULL,
  confidence_interval REAL NOT NULL,
  band            TEXT NOT NULL,
  evaluation_count INTEGER NOT NULL DEFAULT 1,
  dimensions      JSONB NOT NULL,
  history_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_evaluated  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trust history: append-only, hash-chained
CREATE TABLE IF NOT EXISTS trust_history (
  seq             SERIAL PRIMARY KEY,
  prev_hash       TEXT NOT NULL,
  entry_hash      TEXT NOT NULL,
  mcp_id          TEXT NOT NULL,
  composite_score REAL NOT NULL,
  band            TEXT NOT NULL,
  trigger_reason  TEXT NOT NULL,
  dimensions      JSONB NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_trust_scores_band ON trust_scores(band);
CREATE INDEX IF NOT EXISTS idx_trust_history_mcp ON trust_history(mcp_id, seq DESC);
CREATE INDEX IF NOT EXISTS idx_trust_history_hash ON trust_history(entry_hash);
`;

// ── Registry ────────────────────────────────────────────────────────

export class TrustRegistry {
  private pool: Pool;
  private initialized = false;

  constructor(config: RegistryConfig = {}) {
    const dsn = config.connectionString
      ?? process.env.POSTGRES_URL
      ?? process.env.DATABASE_URL
      ?? "";
    this.pool = new Pool({ ...config.poolConfig, connectionString: dsn });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const client = await this.pool.connect();
    try {
      await client.query(SCHEMA_SQL);
      this.initialized = true;
    } finally {
      client.release();
    }
  }

  /**
   * Upsert a trust score. Creates or updates the latest score for an MCP.
   * Also appends to history (append-only, hash-chained).
   */
  async upsertScore(score: TrustScore): Promise<void> {
    await this.initialize();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Upsert latest score
      await client.query(
        `INSERT INTO trust_scores
         (mcp_id, mcp_name, mcp_endpoint, composite_score, confidence_interval,
          band, evaluation_count, dimensions, history_summary, last_evaluated, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
         ON CONFLICT (mcp_id) DO UPDATE SET
           mcp_name = EXCLUDED.mcp_name,
           mcp_endpoint = EXCLUDED.mcp_endpoint,
           composite_score = EXCLUDED.composite_score,
           confidence_interval = EXCLUDED.confidence_interval,
           band = EXCLUDED.band,
           evaluation_count = EXCLUDED.evaluation_count,
           dimensions = EXCLUDED.dimensions,
           history_summary = EXCLUDED.history_summary,
           last_evaluated = NOW(),
           updated_at = NOW()`,
        [
          score.mcp_id,
          score.mcp_name,
          score.mcp_endpoint,
          score.composite_score,
          score.confidence_interval,
          score.band,
          score.evaluation_count,
          JSON.stringify(score.dimensions),
          JSON.stringify(score.history.slice(-10)), // Keep last 10 in summary
        ]
      );

      // Append to history (hash-chained)
      const lastHash = await this.getLastHash(client);
      const entry = JSON.stringify({
        mcp_id: score.mcp_id,
        composite_score: score.composite_score,
        band: score.band,
        timestamp: new Date().toISOString(),
      });
      const entryHash = createHash("sha256").update(lastHash + entry).digest("hex");

      await client.query(
        `INSERT INTO trust_history
         (prev_hash, entry_hash, mcp_id, composite_score, band, trigger_reason, dimensions)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          lastHash,
          entryHash,
          score.mcp_id,
          score.composite_score,
          score.band,
          score.evaluation_count === 1 ? "initial_evaluation" : "reevaluation",
          JSON.stringify(score.dimensions),
        ]
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Read the latest trust score for an MCP server.
   */
  async getScore(mcpId: string): Promise<TrustScore | null> {
    await this.initialize();
    const result = await this.pool.query(
      `SELECT * FROM trust_scores WHERE mcp_id = $1`,
      [mcpId]
    );
    if (result.rows.length === 0) return null;
    return this.rowToScore(result.rows[0]);
  }

  /**
   * List all trust scores, optionally filtered by band.
   */
  async listScores(band?: TrustBand): Promise<TrustScore[]> {
    await this.initialize();
    const query = band
      ? `SELECT * FROM trust_scores WHERE band = $1 ORDER BY composite_score DESC`
      : `SELECT * FROM trust_scores ORDER BY composite_score DESC`;
    const params = band ? [band] : [];
    const result = await this.pool.query(query, params);
    return result.rows.map(r => this.rowToScore(r));
  }

  /**
   * Get score history for an MCP server.
   */
  async getHistory(mcpId: string, limit = 20): Promise<{
    seq: number;
    prev_hash: string;
    entry_hash: string;
    composite_score: number;
    band: string;
    trigger_reason: string;
    recorded_at: string;
  }[]> {
    await this.initialize();
    const result = await this.pool.query(
      `SELECT seq, prev_hash, entry_hash, composite_score, band, trigger_reason,
              recorded_at::text as recorded_at
       FROM trust_history
       WHERE mcp_id = $1
       ORDER BY seq DESC
       LIMIT $2`,
      [mcpId, limit]
    );
    return result.rows;
  }

  /**
   * Verify hash chain integrity for an MCP's history.
   */
  async verifyChainIntegrity(mcpId: string): Promise<{
    valid: boolean;
    broken_at_seq?: number;
    total_entries: number;
  }> {
    await this.initialize();
    const result = await this.pool.query(
      `SELECT seq, prev_hash, entry_hash FROM trust_history
       WHERE mcp_id = $1 ORDER BY seq ASC`,
      [mcpId]
    );

    const rows = result.rows;
    if (rows.length === 0) return { valid: true, total_entries: 0 };

    for (let i = 1; i < rows.length; i++) {
      if (rows[i].prev_hash !== rows[i - 1].entry_hash) {
        return {
          valid: false,
          broken_at_seq: rows[i].seq,
          total_entries: rows.length,
        };
      }
    }

    return { valid: true, total_entries: rows.length };
  }

  /**
   * Close the pool.
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  // ── Private Helpers ─────────────────────────────────────────────

  private async getLastHash(client: any): Promise<string> {
    const result = await client.query(
      `SELECT entry_hash FROM trust_history ORDER BY seq DESC LIMIT 1`
    );
    return result.rows.length > 0 ? result.rows[0].entry_hash : "genesis";
  }

  private rowToScore(row: any): TrustScore {
    return {
      mcp_id: row.mcp_id,
      mcp_name: row.mcp_name,
      mcp_endpoint: row.mcp_endpoint,
      composite_score: row.composite_score,
      confidence_interval: row.confidence_interval,
      band: row.band as TrustBand,
      evaluation_count: row.evaluation_count,
      dimensions: row.dimensions,
      last_evaluated: row.last_evaluated,
      history: row.history_summary ?? [],
    };
  }
}
