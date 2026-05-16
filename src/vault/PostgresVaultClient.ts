import { createHash } from "node:crypto";
import { Pool, type PoolConfig } from "pg";
import type { VaultClient, VaultSealRecord, VaultVerdict } from "./VaultClient.js";

export interface FloorRule {
  floor_id: string;
  code: string;
  name: string;
  type: string;
  description: string;
  seal_threshold: number | string;
  void_threshold: number | string;
  active: boolean;
}

export interface SessionRecord {
  session_id: string;
  agent_id: string;
  constitution_hash: string;
  started_at: string;
  final_verdict?: string;
  final_text?: string;
  turn_count?: number;
  metadata?: Record<string, unknown>;
}

export interface ToolCallRecord {
  run_id?: string;
  session_id: string;
  tool_name: string;
  organ?: string;
  tool_args?: Record<string, unknown>;
  tool_result?: string;
  verdict: string;
  latency_ms?: number;
  floors_triggered: string[];
  called_at?: string;
}

export class PostgresVaultClient implements VaultClient {
  private pool: Pool;
  private initialized = false;
  private readonly actorId: string;

  constructor(connectionString: string, poolConfig?: Omit<PoolConfig, "connectionString">, actorId?: string) {
    this.pool = new Pool({ ...poolConfig, connectionString });
    this.actorId = actorId ?? process.env.ACTOR_ID ?? "ariffazil::agent-civ";
  }

  getPool(): Pool {
    return this.pool;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const client = await this.pool.connect();
    try {
      const tableCheck = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'vault_seals' AND column_name = 'session_id'
        LIMIT 1
      `);
      if (tableCheck.rows.length === 0) {
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
      }
    } catch {
      // vault_seals may already exist with a different schema (from a prior migration).
      // Skip table/index creation and continue — vault_seals is unrelated to arifos.* tables.
    } finally {
      client.release();
    }
    this.initialized = true;
  }

  async seal(record: VaultSealRecord): Promise<void> {
    await this.initialize();

    // Step 1: Write to vault_events (shared schema: Python + A-FORGE both use this)
    const eventType = record.verdict === "SEAL" ? "A_FORGE_SEAL" : `A_FORGE_${record.verdict}`;
    const chainHash = this.computeChainHash(record);
    await this.pool.query(
      `INSERT INTO vault_events
       (event_id, event_type, session_id, actor_id, stage, verdict, payload, risk_tier,
        merkle_leaf, prev_hash, chain_hash, signature, signed_by, sealed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        record.sealId ?? record.record_id,
        eventType,
        record.sessionId,
        this.actorId,
        "A_FORGE_ENGINE",
        record.verdict,
        JSON.stringify({
          task: record.task,
          finalText: record.finalText,
          floors_triggered: record.floors_triggered,
          turnCount: record.turnCount,
          profileName: record.profileName,
          escalation: record.escalation,
        }),
        "medium",
        chainHash.slice(0, 64),
        record.prev_hash ?? "0".repeat(64),
        chainHash,
        `A_FORGE:${this.actorId}`,
        this.actorId,
        record.timestamp,
      ],
    );

    // Step 2: ARCHIVIST — write canon record on every SEAL
    if (record.verdict === "SEAL") {
      await this.writeToCanon(record).catch((err) =>
        console.error(`[Archivist] Failed to write canon: ${err}`),
      );
    }
  }

  private computeChainHash(record: VaultSealRecord): string {
    const content = [
      record.sessionId,
      record.verdict,
      record.hashofinput,
      record.task.slice(0, 80),
      String(record.turnCount),
    ].join("|");
    return createHash("sha256").update(content).digest("hex");
  }

  private async writeToCanon(record: VaultSealRecord): Promise<void> {
    // Basic heuristics to extract ADR-like info if not explicit
    const title = record.task.split("\n")[0].slice(0, 100);
    // Use sealId/record_id prefix if no ADR-ID is found in task
    const adrIdMatch = record.task.match(/ADR-[0-9]+/);
    const identifier = record.record_id ?? record.sealId ?? "UNKNOWN";
    const adrId = adrIdMatch ? adrIdMatch[0] : `AUTO-${identifier.slice(0, 8).toUpperCase()}`;

    await this.pool.query(
      `INSERT INTO arifos.canon_records
       (adr_id, title, decision, rationale, agent_id, session_id, epoch, sealed_by, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (adr_id) DO NOTHING`,
      [
        adrId,
        title,
        record.finalText.slice(0, 500),
        record.task,
        this.actorId,
        record.sessionId,
        record.timestamp,
        this.actorId,
        JSON.stringify(record),
      ],
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

  async queryDb<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<{ rows: T[] }> {
    await this.initialize();
    const result = await this.pool.query(text, params);
    return { rows: result.rows as T[] };
  }

  async loadConstitution(): Promise<FloorRule[]> {
    await this.initialize();
    const result = await this.pool.query<FloorRule>(
      `SELECT floor_id, code, name, type, description, seal_threshold, void_threshold
       FROM arifos.floor_rules
       ORDER BY floor_id`,
    );
    return result.rows;
  }

  async openSession(params: {
    sessionId: string;
    agentId: string;
    constitutionHash: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.initialize();
    await this.pool.query(
      `INSERT INTO arifos.sessions (session_id, agent_id, initiated_at, risk_tier, declared_intent)
       VALUES ($1, $2, NOW(), $3, $4)
       ON CONFLICT (session_id) DO NOTHING`,
      [
        params.sessionId,
        params.agentId,
        (params.metadata?.risk_tier as string) ?? "medium",
        (params.metadata?.declared_intent as string) ?? "",
      ],
    );
  }

  async logToolCall(record: ToolCallRecord): Promise<void> {
    await this.initialize();
    await this.pool.query(
      `INSERT INTO arifos.tool_calls
       (run_id, session_id, tool_name, organ, input_hash, output_hash, duration_ms, floor_triggered, verdict, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        record.run_id ?? null,
        record.session_id,
        record.tool_name,
        record.organ ?? null,
        record.tool_args ? JSON.stringify(record.tool_args) : null,
        record.tool_result ?? null,
        record.latency_ms ?? 0,
        JSON.stringify(record.floors_triggered),
        record.verdict,
        record.called_at ?? new Date().toISOString(),
      ],
    );
  }

  async sealSession(params: {
    sessionId: string;
    finalVerdict: string;
    finalText: string;
    turnCount: number;
  }): Promise<void> {
    await this.initialize();
    await this.pool.query(
      `UPDATE arifos.sessions
       SET final_verdict = $2, closed_at = NOW()
       WHERE session_id = $1`,
      [params.sessionId, params.finalVerdict],
    );
  }
}
