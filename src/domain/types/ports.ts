/**
 * arifOS Federation — A-FORGE Port Interfaces
 *
 * Hexagonal Architecture: These are the PORTS that domain/application
 * layers depend on. Infrastructure adapters IMPLEMENT these ports.
 *
 * Dependency rule: Domain → Ports ← Infrastructure
 * Domain NEVER imports from infrastructure. Domain imports from here.
 *
 * Forged: 2026-06-10 — Phase 1 of Hexagonal refactor
 * Reference: Sairyss/domain-driven-hexagon (Ports & Adapters pattern)
 */

import type { LlmTurnRequest, LlmTurnResponse } from "./agent.js";
import type { VaultVerdict } from "./sovereign.js";
import type { ToolSchema } from "./tool.js";
import type { GEOXScenarioContract, WealthAllocationContract } from "./arifos.js";

// ── LLM Provider Port ────────────────────────────────────────────

export interface ILlmStreamCallbacks {
  onToken?: (token: string) => void;
  onThinking?: () => void;
  onComplete?: () => void;
}

/**
 * Port: LLM Provider
 * Implemented by: infrastructure/llm/ (SeaLionProvider, OllamaProvider, etc.)
 * Used by: domain/engine/, domain/planner/, domain/agents/
 */
export interface ILlmProvider {
  readonly name: string;
  completeTurn(request: LlmTurnRequest, callbacks?: ILlmStreamCallbacks): Promise<LlmTurnResponse>;
  readonly supportsStreaming?: boolean;
}

// ── Vault Client Port ────────────────────────────────────────────

export interface IVaultTelemetrySnapshot {
  dS: number;
  peace2: number;
  psi_le: number;
  W3: number;
  G: number;
}

export interface IVaultSealRecord {
  record_id?: string;
  prev_hash?: string;
  sealId?: string;
  sessionId: string;
  verdict: VaultVerdict;
  hashofinput: string;
  telemetrysnapshot: IVaultTelemetrySnapshot;
  floors_triggered: string[];
  irreversibilityacknowledged: boolean;
  timestamp: string;
  task: string;
  finalText: string;
  turnCount: number;
  profileName: string;
  escalation?: {
    escalated: boolean;
    humanEndpoint?: string;
    humanDecision?: "APPROVE" | "REJECT" | "MODIFY" | "ASK_MORE";
    humanId?: string;
    signature?: string;
    ticketId?: string;
  };
}

/**
 * Port: Vault Client
 * Implemented by: infrastructure/vault/ (PostgresVaultClient, SupabaseVaultClient)
 * Used by: domain/engine/
 */
export interface IVaultClient {
  readonly writerMode: "read" | "write" | "fanout";
  seal(record: IVaultSealRecord): Promise<void>;
  query?(options?: {
    sessionId?: string;
    verdict?: VaultVerdict;
    since?: string;
    until?: string;
    limit?: number;
  }): Promise<IVaultSealRecord[]>;
  findById?(sealId: string): Promise<IVaultSealRecord | undefined>;
  /** Log a tool call for audit trail (optional, PostgresVaultClient-specific) */
  logToolCall?(params: {
    run_id: string;
    session_id: string;
    tool_name: string;
    tool_args: Record<string, unknown>;
    tool_result: string;
    verdict: string;
    latency_ms: number;
    floors_triggered: string[];
    called_at: string;
  }): Promise<void>;
}

// ── Organ Bridge Port ─────────────────────────────────────────────

export interface IOrganBridge {
  readonly organName: string;
  isHealthy(): Promise<boolean>;
}

export interface IWealthBridge extends IOrganBridge {
  evaluateAllocation(params: WealthAllocationContract): Promise<{ verdict: string; confidence: number }>;
  getScenarios(): Promise<GEOXScenarioContract[]>;
}

// ── Metrics Client Port ───────────────────────────────────────────

export interface IMetricsClient {
  recordHumanEscalation(ticketId: string): void;
  recordFloorViolation(floor: string): void;
  runStage(stage: string): () => void;
}
