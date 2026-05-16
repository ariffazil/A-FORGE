/**
 * Approval Ticket Store
 *
 * Persistent, append-only JSONL store for human decision lifecycle.
 * Tracks states from PENDING → DISPATCHED → [APPROVED|REJECTED|MODIFY_REQUIRED|EXPIRED] → REPLAYED.
 */

import { homedir } from "node:os";
import { resolve, dirname } from "node:path";
import { appendFile, readFile, mkdir } from "node:fs/promises";
import { PostgresTicketStore } from "./PostgresTicketStore.js";

export type TicketStatus =
  | "PENDING"
  | "DISPATCHED"
  | "ACKED"
  | "APPROVED"
  | "REJECTED"
  | "MODIFY_REQUIRED"
  | "EXPIRED"
  | "REPLAYED";

export interface ApprovalTicket {
  ticketId: string;
  holdId?: string;
  sessionId: string;
  sealId?: string;
  status: TicketStatus;
  riskLevel: "low" | "medium" | "high" | "critical";
  intentModel: "informational" | "advisory" | "execution" | "speculative";
  domain?: string;
  floorsTriggered: string[];
  prompt: string;
  planSummary: string;
  telemetrySnapshot: {
    dS: number;
    peace2: number;
    psi_le: number;
    W3: number;
    G: number;
  };
  createdAt: string;
  dispatchedAt?: string;
  decidedAt?: string;
  expiresAt?: string;
  decision?: "APPROVE" | "REJECT" | "MODIFY" | "ASK_MORE";
  decisionNotes?: string;
  humanId?: string;
  signature?: string;
  replayToken?: string;
  replayedAt?: string;
  previousTicketId?: string;
}

export interface TicketStore {
  initialize(): Promise<void>;
  createTicket(ticket: ApprovalTicket): Promise<ApprovalTicket>;
  findById(ticketId: string): Promise<ApprovalTicket | undefined>;
  findLatestBySessionId(sessionId: string): Promise<ApprovalTicket | undefined>;
  query(options?: {
    status?: TicketStatus;
    sessionId?: string;
    riskLevel?: ApprovalTicket["riskLevel"];
  }): Promise<ApprovalTicket[]>;
  updateTicket(
    ticketId: string,
    patch: Partial<Omit<ApprovalTicket, "ticketId">>,
  ): Promise<ApprovalTicket | undefined>;
  countOpen(): Promise<number>;
}

export class FileTicketStore implements TicketStore {
  private readonly filePath: string;
  private readonly defaultExpiryHours: number;
  private initialized = false;

  constructor(options?: { filePath?: string; defaultExpiryHours?: number }) {
    this.filePath = options?.filePath ?? resolve(homedir(), ".arifos", "tickets.jsonl");
    this.defaultExpiryHours = options?.defaultExpiryHours ?? 24;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await mkdir(dirname(this.filePath), { recursive: true });
    this.initialized = true;
  }

  async createTicket(ticket: ApprovalTicket): Promise<ApprovalTicket> {
    await this.initialize();
    if (!ticket.expiresAt) {
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + this.defaultExpiryHours);
      ticket.expiresAt = expiry.toISOString();
    }
    const line = JSON.stringify(ticket) + "\n";
    await appendFile(this.filePath, line, "utf-8");
    return ticket;
  }

  async *readAll(): AsyncIterable<ApprovalTicket> {
    await this.initialize();
    let text: string;
    try {
      text = await readFile(this.filePath, "utf-8");
    } catch {
      return;
    }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        yield JSON.parse(line) as ApprovalTicket;
      } catch {
        // skip corrupted line
      }
    }
  }

  async findById(ticketId: string): Promise<ApprovalTicket | undefined> {
    let latest: ApprovalTicket | undefined;
    for await (const ticket of this.readAll()) {
      if (ticket.ticketId === ticketId) {
        latest = ticket;
      }
    }
    return latest;
  }

  async findLatestBySessionId(sessionId: string): Promise<ApprovalTicket | undefined> {
    let latest: ApprovalTicket | undefined;
    for await (const ticket of this.readAll()) {
      if (ticket.sessionId === sessionId) {
        if (!latest || new Date(ticket.createdAt) > new Date(latest.createdAt)) {
          latest = ticket;
        }
      }
    }
    return latest;
  }

  async query(options?: {
    status?: TicketStatus;
    sessionId?: string;
    riskLevel?: ApprovalTicket["riskLevel"];
  }): Promise<ApprovalTicket[]> {
    const byId = new Map<string, ApprovalTicket>();
    for await (const ticket of this.readAll()) {
      byId.set(ticket.ticketId, ticket);
    }
    const results: ApprovalTicket[] = [];
    for (const ticket of byId.values()) {
      if (options?.status && ticket.status !== options.status) continue;
      if (options?.sessionId && ticket.sessionId !== options.sessionId) continue;
      if (options?.riskLevel && ticket.riskLevel !== options.riskLevel) continue;
      results.push(ticket);
    }
    // newest first
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return results;
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
    const byId = new Map<string, ApprovalTicket>();
    for await (const ticket of this.readAll()) {
      byId.set(ticket.ticketId, ticket);
    }
    let count = 0;
    for (const ticket of byId.values()) {
      if (ticket.status === "PENDING" || ticket.status === "DISPATCHED" || ticket.status === "ACKED") {
        count++;
      }
    }
    return count;
  }
}

let globalStore: TicketStore | null = null;

export function getTicketStore(): TicketStore {
  if (!globalStore) {
    const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (postgresUrl) {
      try {
        globalStore = new PostgresTicketStore(postgresUrl);
        return globalStore;
      } catch {
        process.stderr.write("[WARN] Postgres ticket store unavailable; falling back to FileTicketStore\n");
      }
    }
    globalStore = new FileTicketStore();
  }
  return globalStore;
}

export function resetTicketStore(): void {
  globalStore = null;
}
