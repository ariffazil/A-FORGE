import { Pool, type PoolConfig } from "pg";
import type { ApprovalTicket, TicketStatus, TicketStore } from "./TicketStore.js";

export class PostgresTicketStore implements TicketStore {
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
        CREATE TABLE IF NOT EXISTS approval_tickets (
          ticket_id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          status TEXT NOT NULL,
          risk_level TEXT NOT NULL,
          intent_model TEXT NOT NULL,
          domain TEXT,
          created_at TIMESTAMPTZ NOT NULL,
          data JSONB NOT NULL
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_tickets_session_id ON approval_tickets(session_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_tickets_status ON approval_tickets(status)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_tickets_risk_level ON approval_tickets(risk_level)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON approval_tickets(created_at DESC)`);
    } finally {
      client.release();
    }
    this.initialized = true;
  }

  async createTicket(ticket: ApprovalTicket): Promise<ApprovalTicket> {
    await this.initialize();
    const t = { ...ticket };
    if (!t.expiresAt) {
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 24);
      t.expiresAt = expiry.toISOString();
    }
    await this.pool.query(
      `INSERT INTO approval_tickets (ticket_id, session_id, status, risk_level, intent_model, domain, created_at, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (ticket_id) DO UPDATE SET
         session_id = EXCLUDED.session_id,
         status = EXCLUDED.status,
         risk_level = EXCLUDED.risk_level,
         intent_model = EXCLUDED.intent_model,
         domain = EXCLUDED.domain,
         created_at = EXCLUDED.created_at,
         data = EXCLUDED.data`,
      [t.ticketId, t.sessionId, t.status, t.riskLevel, t.intentModel, t.domain ?? null, t.createdAt, JSON.stringify(t)],
    );
    return t;
  }

  async findById(ticketId: string): Promise<ApprovalTicket | undefined> {
    await this.initialize();
    const result = await this.pool.query(
      `SELECT data FROM approval_tickets WHERE ticket_id = $1`,
      [ticketId],
    );
    return result.rows[0]?.data as ApprovalTicket | undefined;
  }

  async findLatestBySessionId(sessionId: string): Promise<ApprovalTicket | undefined> {
    await this.initialize();
    const result = await this.pool.query(
      `SELECT data FROM approval_tickets WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [sessionId],
    );
    return result.rows[0]?.data as ApprovalTicket | undefined;
  }

  async query(options?: {
    status?: TicketStatus;
    sessionId?: string;
    riskLevel?: ApprovalTicket["riskLevel"];
  }): Promise<ApprovalTicket[]> {
    await this.initialize();
    const conditions: string[] = [];
    const values: (string | null)[] = [];
    let idx = 1;

    if (options?.status) {
      conditions.push(`status = $${idx++}`);
      values.push(options.status);
    }
    if (options?.sessionId) {
      conditions.push(`session_id = $${idx++}`);
      values.push(options.sessionId);
    }
    if (options?.riskLevel) {
      conditions.push(`risk_level = $${idx++}`);
      values.push(options.riskLevel);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await this.pool.query(
      `SELECT data FROM approval_tickets ${where} ORDER BY created_at DESC`,
      values,
    );
    return result.rows.map((r) => r.data as ApprovalTicket);
  }

  async updateTicket(
    ticketId: string,
    patch: Partial<Omit<ApprovalTicket, "ticketId">>,
  ): Promise<ApprovalTicket | undefined> {
    const existing = await this.findById(ticketId);
    if (!existing) return undefined;
    const updated: ApprovalTicket = { ...existing, ...patch };
    await this.createTicket(updated);
    return updated;
  }

  async countOpen(): Promise<number> {
    await this.initialize();
    const result = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM approval_tickets WHERE status IN ('PENDING', 'DISPATCHED', 'ACKED')`,
    );
    return result.rows[0]?.count ?? 0;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
