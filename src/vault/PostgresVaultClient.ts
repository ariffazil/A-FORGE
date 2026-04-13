import { Pool, type PoolConfig } from "pg";
import type { VaultClient, VaultSealRecord, VaultVerdict } from "./VaultClient.js";

export class PostgresVaultClient implements VaultClient {
  private pool: Pool;
  private initialized = false;

  constructor(connectionString: string, poolConfig?: Omit<PoolConfig, "connectionString">) {
    this.pool = new Pool({ ...poolConfig, connectionString });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS vault_seals (
          seal_id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          verdict TEXT NOT NULL,
          timestamp TIMESTAMPTZ NOT NULL,
          data JSONB NOT NULL
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_vault_session ON vault_seals(session_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_vault_verdict ON vault_seals(verdict)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_vault_timestamp ON vault_seals(timestamp DESC)`);
    } finally {
      client.release();
    }
    this.initialized = true;
  }

  async seal(record: VaultSealRecord): Promise<void> {
    await this.initialize();
    await this.pool.query(
      `INSERT INTO vault_seals (seal_id, session_id, verdict, timestamp, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [record.sealId, record.sessionId, record.verdict, record.timestamp, JSON.stringify(record)],
    );
  }

  async query(options?: {
    sessionId?: string;
    verdict?: VaultVerdict;
    since?: string;
    until?: string;
    limit?: number;
  }): Promise<VaultSealRecord[]> {
    await this.initialize();
    const conditions: string[] = [];
    const values: (string | number)[] = [];
    let idx = 1;

    if (options?.sessionId) {
      conditions.push(`session_id = $${idx++}`);
      values.push(options.sessionId);
    }
    if (options?.verdict) {
      conditions.push(`verdict = $${idx++}`);
      values.push(options.verdict);
    }
    if (options?.since) {
      conditions.push(`timestamp >= $${idx++}`);
      values.push(options.since);
    }
    if (options?.until) {
      conditions.push(`timestamp <= $${idx++}`);
      values.push(options.until);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const limitClause = options?.limit && options.limit > 0 ? `LIMIT $${idx++}` : "";
    if (limitClause) values.push(options!.limit!);

    const result = await this.pool.query(
      `SELECT data FROM vault_seals ${where} ORDER BY timestamp DESC ${limitClause}`,
      values,
    );
    return result.rows.map((r) => r.data as VaultSealRecord);
  }

  async findById(sealId: string): Promise<VaultSealRecord | undefined> {
    await this.initialize();
    const result = await this.pool.query(
      `SELECT data FROM vault_seals WHERE seal_id = $1`,
      [sealId],
    );
    return result.rows[0]?.data as VaultSealRecord | undefined;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
