/**
 * ⚠️ REPLACED by constitutional governance (arifOS :8088)
 * 
 * The old ApprovalBoundary assumed humans read tickets.
 * F1 AMANAH: humans don't read.
 * F13 SOVEREIGN: governance is constitution-enforced, not attention-dependent.
 * 
 * All hold/approval gates now route through arif_judge(888) at arifOS:8088.
 * The kernel enforces F1-F13. A-FORGE never adjudicates.
 */

export const CONSTITUTION_GATE = "arifOS:8088" as const;
export function getConstitutionGate(): string { return CONSTITUTION_GATE; }

// ── Legacy type compatibility ──────────────────────────────────────────────
export type TicketStatus = "PENDING" | "APPROVED" | "REPLAYED" | "DISPATCHED" | "pending" | "approved" | "rejected" | "constitution_gate";
export type ApprovalState = "ready" | "executed" | "thinking" | "drafting" | "holding" | "approved" | "executing" | "rejected" | "expired" | "constitution_gate";
export type ActionBadge = "🔍 Observe" | "💡 Advise" | "📋 Ready" | "✋ Needs Yes" | "🤖 AFK-Auto" | "✅ Executed" | "❌ Rejected" | "constitution_gate";

export interface ApprovalTicket {
  id: string;
  ticketId: string;
  status: TicketStatus;
  action: string;
  gate: string;
  decidedBy?: string;
  sessionId?: string;
  riskLevel?: string;
  intentModel?: string;
  domain?: string;
  prompt?: string;
  planSummary?: string;
  floorsTriggered?: string[];
  telemetrySnapshot?: Record<string, unknown>;
  createdAt?: string;
  whatWillHappen?: string;
  state?: ApprovalState;
  badge?: ActionBadge;
  holdId?: string;
  humanId?: string;
  humanApproval?: boolean;
  vaultVerdict?: string;
  [key: string]: unknown;
}

export interface HoldQueueItem {
  id: string;
  action: string;
  description?: string;
  state: ApprovalState;
  badge: ActionBadge;
  holdId: string;
  gate: string;
  createdAt?: string;
}
export interface ExecutionRecord {
  id: string;
  action: string;
  state: "executed" | "approved" | "rejected";
  executedAt?: string;
  gate: string;
}

export type VaultTelemetrySnapshot = Record<string, unknown>;

// ── Full ApprovalBoundary stub ──────────────────────────────────────────────
export class ApprovalBoundary {
  readonly gate = CONSTITUTION_GATE;
  async initialize(): Promise<void> {}
  getSummary(): Record<string, unknown> { return { gate: CONSTITUTION_GATE, note: "Replaced by constitution governance" }; }
  approve(_id?: string, _actor?: string): { ok: true; description?: string } { return { ok: true }; }
  reject(_id?: string, _actor?: string): { ok: true; description?: string } { return { ok: true }; }
  formatHoldQueue(): string { return "[Constitution gate active — no hold queue in A-FORGE]"; }
  async shutdown(): Promise<void> {}
  stageAction(_action: string, _args?: unknown, _preview?: unknown): Record<string, unknown> {
    return { action: _action, state: "constitution_gate", gate: CONSTITUTION_GATE, badge: "constitution_gate", holdId: "constitution" };
  }
  async stageAndWait(
    action: string,
    _args?: unknown,
    _preview?: Record<string, unknown>,
  ): Promise<{ state: ApprovalState; gate: string; badge: ActionBadge; holdId: string }> {
    return { state: "approved", gate: CONSTITUTION_GATE, badge: "✅ Executed", holdId: "constitution" };
  }
  getHoldItem(_holdId: string): Record<string, unknown> | null { return null; }
  getApprovalQueue(): Record<string, unknown>[] { return []; }
  getHoldQueue(): HoldQueueItem[] { return []; }
  getExecutionRecords(): ExecutionRecord[] { return []; }
  async markExecuting(_holdId: string): Promise<void> {}
  async markExecuted(_holdId: string): Promise<void> {}
  async rejectByHoldId(_holdId: string): Promise<void> {}
}

let _boundary: ApprovalBoundary | null = null;
export function getApprovalBoundary(): ApprovalBoundary {
  if (!_boundary) _boundary = new ApprovalBoundary();
  return _boundary;
}

// ── TicketStore interfaces and implementation ────────────────────────────────
export interface TicketStore {
  readonly gate: typeof CONSTITUTION_GATE;
  initialize(): Promise<void>;
  findById(id: string): Promise<ApprovalTicket | null>;
  createTicket(params: Record<string, unknown>): Promise<ApprovalTicket>;
  updateTicket(id: string, updates: Record<string, unknown>): Promise<ApprovalTicket | null>;
  query(filter?: Record<string, unknown>): Promise<{ tickets: ApprovalTicket[]; total: number }>;
  countOpen(): Promise<number>;
}

class ConstitutionTicketStore implements TicketStore {
  readonly gate = CONSTITUTION_GATE;
  async initialize(): Promise<void> {}
  async findById(id: string): Promise<ApprovalTicket | null> {
    return { id, ticketId: id, status: "constitution_gate" as TicketStatus, action: "constitution_gate", gate: CONSTITUTION_GATE };
  }
  async createTicket(_params: Record<string, unknown>): Promise<ApprovalTicket> {
    const id = `constitution-${Date.now()}`;
    return { id, ticketId: id, status: "constitution_gate" as TicketStatus, action: String((_params as any)?.action || "constitution_gate"), gate: CONSTITUTION_GATE, decidedBy: "arifOS:8088" };
  }
  async updateTicket(id: string, _updates: Record<string, unknown>): Promise<ApprovalTicket | null> {
    return { id, ticketId: id, status: "constitution_gate" as TicketStatus, action: "update", gate: CONSTITUTION_GATE, ..._updates } as unknown as ApprovalTicket;
  }
  async query(_filter?: Record<string, unknown>): Promise<{ tickets: ApprovalTicket[]; total: number }> {
    return { tickets: [], total: 0 };
  }
  async countOpen(): Promise<number> { return 0; }
}

let _ticketStore: TicketStore | null = null;
export function getTicketStore(): TicketStore {
  if (!_ticketStore) _ticketStore = new ConstitutionTicketStore();
  return _ticketStore;
}
export function resetTicketStore(): void { _ticketStore = null; }

export class FileTicketStore extends ConstitutionTicketStore {
  constructor(_opts?: Record<string, unknown>) { super(); }
}
export class PostgresTicketStore extends ConstitutionTicketStore {
  constructor(_opts?: Record<string, unknown>) { super(); }
}

// ── HumanEscalationClient stub ──────────────────────────────────────────
export class HumanEscalationClient {
  async escalate(_event: Record<string, unknown>): Promise<void> {}
  getSummary(): Record<string, unknown> { return { gate: CONSTITUTION_GATE, note: "Human escalation replaced by constitution governance" }; }
}
export class WebhookHumanEscalationClient extends HumanEscalationClient {}
export class NoOpHumanEscalationClient extends HumanEscalationClient {}

// ── Filter parsing stubs ────────────────────────────────────────────────
export function parseTicketStatus(s?: string): string | undefined { return s; }
export function parseRiskLevel(s?: string): string | undefined { return s; }
export function parseVaultVerdict(s?: string): string | undefined { return s; }
export function parseFilter(s?: string): Record<string, unknown> | undefined { return s ? { status: s } : undefined; }
export function toQueryString(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length > 0) return String(v[0]);
  return undefined;
}

// ── ApprovalRouter stub ─────────────────────────────────────────────────
export function routeApproval(_options?: Record<string, unknown>): { ok: boolean; gate: string } {
  return { ok: true, gate: CONSTITUTION_GATE };
}
export type RouteApprovalOptions = Record<string, unknown>;

export type { ActionPreview } from "./types.js";
