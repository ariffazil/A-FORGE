// [P0|Q2] Bounded STM with batch eviction, pinning, archive fallback, and governance-aware summarization — 2026-05-05

import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { AgentMessage } from "../types/agent.js";

export interface ShortTermMemoryOptions {
  maxMessages?: number;
  maxTokens?: number;
  onEvict?: (summary: string) => void | Promise<void>;
  archivePath?: string;
}

export class ShortTermMemory {
  private readonly transcript: AgentMessage[] = [];
  private readonly pinned: AgentMessage[] = [];
  private readonly maxMessages: number;
  private readonly maxTokens: number;
  private readonly onEvict?: (summary: string) => void | Promise<void>;
  private readonly archivePath?: string;

  constructor(options?: ShortTermMemoryOptions) {
    this.maxMessages = options?.maxMessages ?? 5;
    this.maxTokens = options?.maxTokens ?? 4096;
    this.onEvict = options?.onEvict;
    this.archivePath = options?.archivePath;
  }

  append(message: AgentMessage): void {
    this.transcript.push(message);
    this.enforceLimits();
  }

  appendMany(messages: AgentMessage[]): void {
    for (const message of messages) {
      this.transcript.push(message);
    }
    this.enforceLimits();
  }

  /**
   * Pin a sacred/system message so it is never evicted.
   * Pinned messages always appear first in getMessages().
   */
  pin(message: AgentMessage): void {
    this.pinned.push(message);
  }

  getMessages(): AgentMessage[] {
    return [...this.pinned, ...this.transcript];
  }

  clear(): void {
    this.transcript.length = 0;
    this.pinned.length = 0;
  }

  /**
   * Returns the number of non-pinned messages currently held.
   */
  get length(): number {
    return this.transcript.length;
  }

  /**
   * Returns the number of pinned messages.
   */
  get pinnedCount(): number {
    return this.pinned.length;
  }

  /**
   * Returns whether the memory window is at capacity.
   */
  isFull(): boolean {
    return (
      this.transcript.length >= this.maxMessages ||
      this.estimateTokens() >= this.maxTokens
    );
  }

  private enforceLimits(): void {
    const evicted: AgentMessage[] = [];

    while (
      this.transcript.length > this.maxMessages ||
      this.estimateTokens() > this.maxTokens
    ) {
      if (this.transcript.length === 0) {
        // Pinned messages alone exceed maxTokens; cannot evict further.
        console.error(
          "[CONTEXT] FATAL: Pinned messages exceed token ceiling. " +
            "Raise maxTokens or reduce pinned content."
        );
        break;
      }
      evicted.push(this.transcript.shift()!);
    }

    if (evicted.length === 0) return;

    // [Q2-CORRECTION] G2: Archive fallback — write raw messages BEFORE eviction
    this.archiveRaw(evicted).catch((err) =>
      console.error("[CONTEXT] Archive write failed:", err)
    );

    // [Q2-CORRECTION] Gap 2: Batch summarize once, one eviction callback
    const summary = this.summarize(evicted);

    // [Q2-CORRECTION] G1: Log compression ratio warning if >90%
    const originalLen = evicted.reduce((sum, m) => sum + m.content.length, 0);
    const ratio = originalLen > 0 ? (1 - summary.length / originalLen) : 0;
    if (ratio > 0.9) {
      console.warn(
        `[CONTEXT] WARNING: Compression ratio ${(ratio * 100).toFixed(1)}%. ` +
          `Critical info may be lost. Original: ${originalLen} chars, Summary: ${summary.length} chars.`
      );
    }

    if (this.onEvict) {
      try {
        const result = this.onEvict(summary);
        if (result instanceof Promise) {
          result.catch((err) =>
            console.error("[CONTEXT] Async eviction write failed:", err)
          );
        }
      } catch (err) {
        console.error("[CONTEXT] Sync eviction callback failed:", err);
      }
    }
  }

  private async archiveRaw(messages: AgentMessage[]): Promise<void> {
    if (!this.archivePath) return;
    await mkdir(dirname(this.archivePath), { recursive: true });
    const lines = messages.map((m) =>
      JSON.stringify({
        timestamp: new Date().toISOString(),
        role: m.role,
        content: m.content,
        toolName: m.toolName,
      })
    );
    await appendFile(this.archivePath, lines.join("\n") + "\n", "utf8");
  }

  private estimateTokens(): number {
    const all = [...this.pinned, ...this.transcript];
    return all.reduce(
      (sum, msg) => sum + Math.ceil(msg.content.length / 4),
      0
    );
  }

  /**
   * Extractive summarizer: keeps goals, decisions, tool results;
   * drops filler and chitchat. No external LLM call.
   *
   * [Q2-CORRECTION] Gap 6: Expanded governance vocabulary so
   * SEAL, VOID, HOLD, SABAR, budget, risk, and other constitutional
   * tokens are always retained in the summary.
   */
  private summarize(messages: AgentMessage[]): string {
    const extracts: string[] = [];

    for (const msg of messages) {
      const text = msg.content.trim();
      if (text.length === 0) continue;

      // Tool results: keep first line + tool name
      if (msg.role === "tool" && msg.toolName) {
        const firstLine = text.split("\n")[0].slice(0, 200);
        extracts.push(`[${msg.toolName}]: ${firstLine}`);
        continue;
      }

      // Assistant: keep sentences with actionable or decisive language
      if (msg.role === "assistant") {
        const significant = text
          .split(/[.!?]/)
          .map((s) => s.trim())
          .filter(
            (s) =>
              s.length > 10 &&
              /\b(tool|call|decide|select|result|conclusion|plan|will|need|using|invoke|VOID|SEAL|HOLD|SABAR|budget|risk|breach|token|cost|ceiling|threshold|degrade|refuse|governance|advisory|constraint|limit)\b/i.test(
                s
              )
          )
          .slice(0, 2);
        if (significant.length > 0) {
          extracts.push(significant.join(". "));
        }
        continue;
      }

      // User: keep concise goal statements; truncate long queries
      // [Q2-CORRECTION] Gap 7: Increase truncation to 500 chars (first 300 + last 150)
      if (msg.role === "user") {
        const truncated =
          text.length > 500
            ? text.slice(0, 300) + "..." + text.slice(-150)
            : text;
        extracts.push(`[User]: ${truncated}`);
        continue;
      }

      // System: keep if short and policy-like
      if (msg.role === "system" && text.length < 300) {
        extracts.push(`[Policy]: ${text.slice(0, 200)}`);
      }
    }

    // [Q2-CORRECTION] G3: Tag each summary fragment with eviction timestamp
    const tag = `[evicted: ${new Date().toISOString()}]`;
    const body = extracts.join(" | ") || "[Context summary unavailable]";
    return `${tag} ${body}`;
  }
}
