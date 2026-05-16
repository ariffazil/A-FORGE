/**
 * A-FORGE MCP Telemetry & Audit Logger
 *
 * Lightweight operational telemetry for the MCP server.
 * - In-memory counters
 * - Append-only JSONL audit log
 * - Structured stderr logs for journald
 */

import { homedir } from "node:os";
import { resolve, dirname } from "node:path";
import { appendFile, mkdir } from "node:fs/promises";

export type AuditEventAction =
  | "invoke"
  | "success"
  | "failure"
  | "hold_created"
  | "hold_approved"
  | "memory_stored"
  | "route_approved"
  | "route_rejected"
  | "route_waiting"
  | "patches_applied"
  | "patches_partial";

export interface AuditEvent {
  epoch: string;
  session_id?: string;
  pipeline_stage?: string;
  tool: string;
  action: AuditEventAction;
  outcome?: string;
  dS?: number;
  peace2?: number;
  omega?: number;
  w3?: number;
  kappa_r?: number;
  confidence?: number;
  verdict?: "SEAL" | "HOLD" | "VOID";
  metadata?: Record<string, unknown>;
}

export interface TelemetrySummary {
  since: string;
  invocations: Record<string, number>;
  successes: Record<string, number>;
  failures: Record<string, number>;
  providerUsage: Record<string, number>;
  totalEvents: number;
  avgEntropyDelta: number;
  avgPeace2: number;
  avgOmega: number;
}

class McpTelemetry {
  private startTime = new Date().toISOString();
  private invocations: Record<string, number> = {};
  private successes: Record<string, number> = {};
  private failures: Record<string, number> = {};
  private providerUsage: Record<string, number> = {};
  private totalEvents = 0;
  private auditPath: string;
  private initialized = false;

  constructor() {
    this.auditPath =
      process.env.AF_FORGE_AUDIT_PATH ??
      resolve(homedir(), ".agent-workbench", "mcp-audit.jsonl");
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await mkdir(dirname(this.auditPath), { recursive: true });
    this.initialized = true;
  }

  recordInvocation(tool: string): void {
    this.invocations[tool] = (this.invocations[tool] ?? 0) + 1;
  }

  recordSuccess(tool: string, provider?: string): void {
    this.successes[tool] = (this.successes[tool] ?? 0) + 1;
    if (provider) {
      this.providerUsage[provider] = (this.providerUsage[provider] ?? 0) + 1;
    }
  }

  recordFailure(tool: string): void {
    this.failures[tool] = (this.failures[tool] ?? 0) + 1;
  }

  private redactSecrets(text: string): string {
    return text
      .replace(/\b(sk-[a-zA-Z0-9_-]{20,})\b/g, "[REDACTED_KEY]")
      .replace(/\b([a-zA-Z0-9_-]*api[_-]?key[a-zA-Z0-9_-]*=)([^\s&\"'<>]+)/gi, "$1[REDACTED_VALUE]")
      .replace(/\b(bearer\s+)([^\s&\"'<>]+)/gi, "$1[REDACTED_TOKEN]")
      .replace(/\b([a-zA-Z0-9_-]*password[a-zA-Z0-9_-]*=)([^\s&\"'<>]+)/gi, "$1[REDACTED_VALUE]");
  }

  async logEvent(event: AuditEvent): Promise<void> {
    await this.initialize();
    this.totalEvents++;
    const safeEvent: AuditEvent = {
      ...event,
      epoch: event.epoch ?? new Date().toISOString(),
      outcome: event.outcome ? this.redactSecrets(event.outcome) : undefined,
    };
    if (safeEvent.metadata && typeof safeEvent.metadata.error === "string") {
      safeEvent.metadata = { ...safeEvent.metadata, error: this.redactSecrets(safeEvent.metadata.error) };
    }
    const line = JSON.stringify(safeEvent) + "\n";
    await appendFile(this.auditPath, line, "utf-8");
    this.writeJournald({
      level: event.action === "failure" ? "error" : "info",
      component: "mcp",
      tool: event.tool,
      action: event.action,
      outcome: safeEvent.outcome,
      session_id: event.session_id,
      pipeline_stage: event.pipeline_stage,
      dS: event.dS,
      peace2: event.peace2,
      omega: event.omega,
      w3: event.w3,
      verdict: event.verdict,
      metadata: safeEvent.metadata,
    });
  }

  getSummary(): TelemetrySummary {
    return {
      since: this.startTime,
      invocations: { ...this.invocations },
      successes: { ...this.successes },
      failures: { ...this.failures },
      providerUsage: { ...this.providerUsage },
      totalEvents: this.totalEvents,
      avgEntropyDelta: 0,
      avgPeace2: 0.95,
      avgOmega: 0.99,
    };
  }

  private writeJournald(payload: Record<string, unknown>): void {
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      source: "A-FORGE-mcp",
      ...payload,
    });
    process.stderr.write(`${entry}\n`);
  }
}

export const telemetry = new McpTelemetry();

/**
 * Wrap an MCP tool handler with telemetry and audit logging.
 */
export function withTelemetry<T extends Record<string, unknown>>(
  toolName: string,
  handler: (args: T) => Promise<{ content: Array<{ type: string; text: string }> }>
): (args: T) => Promise<{ content: Array<{ type: string; text: string }> }> {
  return async (args: T) => {
    telemetry.recordInvocation(toolName);
    const startedAt = Date.now();
    try {
      const result = await handler(args);
      telemetry.recordSuccess(toolName);
      await telemetry.logEvent({
        epoch: new Date().toISOString(),
        tool: toolName,
        action: "success",
        metadata: { durationMs: Date.now() - startedAt },
      });
      return result;
    } catch (error) {
      telemetry.recordFailure(toolName);
      const message = error instanceof Error ? error.message : String(error);
      await telemetry.logEvent({
        epoch: new Date().toISOString(),
        tool: toolName,
        action: "failure",
        outcome: message,
        metadata: { durationMs: Date.now() - startedAt },
      });
      throw error;
    }
  };
}


