/**
 * Human Expert Escalation Client
 *
 * Dispatches 888_HOLD events to external human reviewers via HTTP webhook.
 * This implements the F13 Sovereign gate as a first-class MCP-adjacent resource.
 */

export type HumanDecision = "APPROVE" | "REJECT" | "MODIFY" | "ASK_MORE";

export interface HumanEscalationRequest {
  sessionId: string;
  holdId?: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  intentModel: "informational" | "advisory" | "execution" | "speculative";
  domain?: string;
  prompt: string;
  planSummary: string;
  floorsTriggered: string[];
  telemetrySnapshot: {
    dS: number;
    peace2: number;
    psi_le: number;
    W3: number;
    G: number;
  };
  timestamp: string;
}

export interface HumanEscalationResponse {
  decision: HumanDecision;
  notes?: string;
  humanId?: string;
  signature?: string;
  respondedAt?: string;
}

export interface HumanEscalationClient {
  escalate(request: HumanEscalationRequest): Promise<HumanEscalationResponse | null>;
}

/**
 * No-op client for environments without human webhook integration.
 */
export class NoOpHumanEscalationClient implements HumanEscalationClient {
  async escalate(_request: HumanEscalationRequest): Promise<null> {
    return null;
  }
}

/**
 * HTTP webhook client for human expert escalation.
 * Posts JSON payload to a configured endpoint.
 */
export class WebhookHumanEscalationClient implements HumanEscalationClient {
  private readonly webhookUrl: string;
  private readonly timeoutMs: number;

  constructor(webhookUrl?: string, timeoutMs = 10000) {
    this.webhookUrl = webhookUrl ?? "http://localhost:7072/human-expert";
    this.timeoutMs = timeoutMs;
  }

  async escalate(request: HumanEscalationRequest): Promise<HumanEscalationResponse | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as HumanEscalationResponse;
      return data;
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }
}
