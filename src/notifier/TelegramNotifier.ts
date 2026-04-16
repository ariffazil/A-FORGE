/**
 * AF-FORGE Telegram Notifier
 *
 * Sends 888_HOLD alerts and system status messages via Telegram Bot API.
 * Integrated into AgentManager for F13 Sovereign human ratification.
 *
 * Environment:
 *   TELEGRAM_BOT_TOKEN  — Bot token from @BotFather
 *   TELEGRAM_CHAT_ID   — Your Telegram chat ID
 *   TELEGRAM_ALERT_WEBHOOK_URL — Optional: external webhook for Matrix/Slack/etc.
 */

import type { NotifierService } from "../jobs/AgentManager.js";

interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: "MarkdownV2" | "HTML";
  disable_notification?: boolean;
}

export class TelegramNotifier implements NotifierService {
  private readonly token: string;
  private readonly chatId: string;
  private readonly webhookUrl?: string;
  private readonly baseUrl: string;

  constructor(token?: string, chatId?: string, webhookUrl?: string) {
    this.token = token ?? process.env.TELEGRAM_BOT_TOKEN ?? "";
    this.chatId = chatId ?? process.env.TELEGRAM_CHAT_ID ?? "";
    this.webhookUrl = webhookUrl ?? process.env.TELEGRAM_ALERT_WEBHOOK_URL;
    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
  }

  get isConfigured(): boolean {
    return this.token.length > 0 && this.chatId.length > 0;
  }

  async sendHold(payload: {
    jobId: string;
    task: string;
    priority: string;
    profile: string;
    sessionId?: string;
  }): Promise<void> {
    if (!this.isConfigured) {
      process.stderr.write(
        `[TelegramNotifier] 888_HOLD not sent — TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured\n`,
      );
      return;
    }

    const lines = [
      `🔴 *888\\_HOLD — Human Ratification Required*`,
      ``,
      `*Job:* \`${payload.jobId}\``,
      `*Priority:* ${payload.priority.toUpperCase()}`,
      `*Profile:* \`${payload.profile}\``,
      `*Session:* \`${payload.sessionId ?? "N/A"}\``,
      ``,
      `*Task:*`,
      `${payload.task.slice(0, 200)}${payload.task.length > 200 ? "..." : ""}`,
      ``,
      `DITEMPA BUKAN DIBERI`,
    ];

    await this.sendRaw({
      chat_id: this.chatId,
      text: lines.join("\n"),
      parse_mode: "MarkdownV2",
      disable_notification: false,
    });

    process.stderr.write(`[TelegramNotifier] 888_HOLD sent for job=${payload.jobId}\n`);
  }

  async sendAlert(payload: { severity: "info" | "warn" | "critical"; message: string }): Promise<void> {
    if (!this.isConfigured) return;

    const emoji = payload.severity === "critical" ? "🚨" : payload.severity === "warn" ? "⚠️" : "ℹ️";
    const text = `${emoji} *AF-FORGE*\n${payload.message}`;

    await this.sendRaw({
      chat_id: this.chatId,
      text,
      parse_mode: "MarkdownV2",
      disable_notification: payload.severity === "info",
    });
  }

  private async sendRaw(msg: TelegramMessage): Promise<void> {
    if (!this.token) return;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msg),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) {
        const body = await response.text();
        process.stderr.write(`[TelegramNotifier] send failed: ${response.status} ${body}\n`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[TelegramNotifier] send error: ${msg}\n`);
    }
  }
}

export function createTelegramNotifier(): NotifierService {
  return new TelegramNotifier();
}
