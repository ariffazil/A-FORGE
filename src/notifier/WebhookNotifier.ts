/**
 * A-FORGE Webhook Notifier
 * 
 * Sends 888_HOLD alerts to an external or local webhook (e.g., the notifier sidecar).
 */

import type { NotifierService } from "../jobs/AgentManager.js";
import type { JobPriority } from "../jobs/AgentManager.js";

export class WebhookNotifier implements NotifierService {
  private readonly webhookUrl: string;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl ?? process.env.HUMAN_ESCALATION_WEBHOOK_URL ?? "http://localhost:9001";
  }

  async sendHold(payload: {
    jobId: string;
    task: string;
    priority: JobPriority;
    profile: string;
    sessionId?: string;
  }): Promise<void> {
    console.error(`[WebhookNotifier] Sending 888_HOLD to ${this.webhookUrl} for job ${payload.jobId}`);
    
    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "888_HOLD",
          ...payload,
          timestamp: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        console.error(`[WebhookNotifier] Failed to send webhook: ${response.statusText}`);
      } else {
        const decision = await response.json();
        console.error(`[WebhookNotifier] Received decision from webhook: ${JSON.stringify(decision)}`);
      }
    } catch (err) {
      console.error(`[WebhookNotifier] Error sending webhook: ${err}`);
    }
  }

  async sendAlert(payload: { severity: "info" | "warn" | "critical"; message: string }): Promise<void> {
    try {
      await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "ALERT",
          ...payload,
          timestamp: new Date().toISOString()
        }),
      });
    } catch (err) {
      console.error(`[WebhookNotifier] Error sending alert webhook: ${err}`);
    }
  }
}


