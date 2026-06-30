/**
 * LongTermMemory — A-FORGE internal memory store.
 *
 * FEDERATION MEMORY ADOPTION — 2026-06-03
 * Per FEDERATION_MEMORY_CONTRACT.md R1:
 *   "All organs write memory through arif_memory(mode='store').
 *    No organ writes directly to Qdrant, Supabase, or Graphiti."
 *
 * This module USED TO write directly to Qdrant collection `federation_shared`.
 * That is now FORBIDDEN. All cross-organ memory writes route through
 * arifOS MCP via ArifOSMemoryClient.
 *
 * L5 Graphiti status: ADVISORY ONLY (worker neutralized; 888 injects Cypher).
 * Local file write retained as A-FORGE internal cache (non-federation).
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { TaskMemoryRecord } from "../../domain/types/memory.js";
import { arifosStore, arifosSearch } from "./ArifOSMemoryClient.js";
import { logFederationFailure } from "./LongTermMemoryFailureLog.js";
import { aaaMemoryGate, type MemoryReceipt } from "../../domain/aaa/AaaMemoryLinkage.js";

const AUTONOMOUS_KERNEL_SESSION = "SEAL-17a17a17a17a17a1";

interface FederationRecord {
  id: string;
  summary: string;
  keywords: string[];
  createdAt: string;
  metadata?: Record<string, unknown>;
  writer_bot: string;
}

export class LongTermMemory {
  constructor(private readonly filePath: string) {}

  /**
   * Append a summary fragment to the running summary log.
   * [P0|Q2] Sliding window eviction bridge with token cap — 2026-05-05
   *
   * AAA: governed. Gate runs BEFORE local file write. If gate fails,
   * the operation is blocked entirely — no local fallback write.
   *
   * FEDERATION: local file write retained; cross-organ upsert via arifOS MCP.
   */
  async appendRunningSummary(
    summary: string,
    maxSummaryTokens = 2048,
    opts?: { actorId?: string; sessionId?: string },
  ): Promise<void> {
    const actorId = opts?.actorId ?? "a-forge::long-term-memory";
    const sessionId = opts?.sessionId ?? AUTONOMOUS_KERNEL_SESSION;

    // AAA Gate FIRST — BEFORE any file write
    const gate = await aaaMemoryGate({
      action: "memory:write",
      actorId,
      sessionId,
      content: summary,
      toolName: "LongTermMemory.appendRunningSummary",
      description: "Append running summary from STM eviction",
    });

    if (!gate.allowed) {
      console.error(`[AAA-MEM] LongTermMemory.appendRunningSummary blocked: ${gate.reason}`);
      return; // Do NOT write locally if gate fails
    }

    const records = await this.readAll();
    const existingIndex = records.findIndex((r) => r.id === "running-summary");

    if (existingIndex >= 0) {
      records[existingIndex].summary += "\n---\n" + summary;
      records[existingIndex].createdAt = new Date().toISOString();
    } else {
      records.push({
        id: "running-summary",
        summary,
        keywords: ["running-summary", "context", "evicted"],
        createdAt: new Date().toISOString(),
        metadata: { source: "ShortTermMemory eviction" },
      });
    }

    // [Q2-CORRECTION] Cap running summary to prevent unbounded growth
    const running = records[existingIndex >= 0 ? existingIndex : records.length - 1];
    const fragments = running.summary.split("\n---\n");
    while (
      Math.ceil(running.summary.length / 4) > maxSummaryTokens &&
      fragments.length > 1
    ) {
      fragments.shift();
      running.summary = fragments.join("\n---\n");
    }

    await this.writeAll(records);

    // FEDERATION: write through arifOS (L3 + L4 + L5 advisory).
    // Local file write above is the A-FORGE internal cache.
    // arifOS is the canonical cross-organ substrate.
    const latestChunk = running.summary.slice(-500);
    const arifosResult = await arifosStore({
      content: `[A-FORGE running-summary] ${latestChunk}`,
      tags: ["a-forge", "running-summary", "context", "federation_adoption"],
      tier: "session",
      session_id: sessionId,
      summary: "A-FORGE running summary eviction",
      context: "normal",
      metadata: {
        writer_bot: "A-FORGE",
        federation_leg: "via_arifos_mcp",
        record_id: "running-summary",
        aaa_receipt_id: gate.receipt?.receiptId, // AAA: traceable receipt lineage
      },
    });
    if (!arifosResult.stored) {
      logFederationFailure("arifos_running_summary_not_stored", {
        verdict: arifosResult.verdict,
        error: arifosResult.error,
        degraded: arifosResult._degraded,
      });
    }
  }

  /**
   * Retrieve the current running summary, if any.
   */
  async getRunningSummary(): Promise<string | undefined> {
    const records = await this.readAll();
    const record = records.find((r) => r.id === "running-summary");
    return record?.summary;
  }

  /**
   * Persist a task memory record. Local file is internal cache;
   * cross-organ substrate is arifOS MCP.
   *
   * AAA: governed. Gate runs BEFORE local file write.
   */
  async store(record: TaskMemoryRecord, opts?: { actorId?: string; sessionId?: string }): Promise<void> {
    const actorId = opts?.actorId ?? "a-forge::long-term-memory";
    const sessionId = opts?.sessionId ?? AUTONOMOUS_KERNEL_SESSION;

    // AAA Gate FIRST — BEFORE any file write
    const gate = await aaaMemoryGate({
      action: "memory:write",
      actorId,
      sessionId,
      content: record.summary,
      memoryId: record.id,
      toolName: "LongTermMemory.store",
      description: `Store task memory: ${record.id}`,
    });

    if (!gate.allowed) {
      console.error(`[AAA-MEM] LongTermMemory.store blocked: ${gate.reason}`);
      return; // Do NOT write locally if gate fails
    }

    // Local file write — A-FORGE internal cache
    const records = await this.readAll();
    records.push(record);
    await this.writeAll(records);

    // FEDERATION: write through arifOS MCP (L3 + L4 + L5 advisory)
    const arifosResult = await arifosStore({
      content: `[A-FORGE:${record.id}] ${record.summary}`,
      tags: ["a-forge", ...(record.keywords ?? []), "federation_adoption"],
      tier: "canon",
      session_id: sessionId,
      summary: record.summary,
      context: "normal",
      metadata: {
        writer_bot: "A-FORGE",
        federation_leg: "via_arifos_mcp",
        record_id: record.id,
        record_metadata: record.metadata ?? {},
        aaa_receipt_id: gate.receipt?.receiptId, // AAA: traceable receipt lineage
      },
    });
    if (!arifosResult.stored) {
      logFederationFailure("arifos_store_not_stored", {
        verdict: arifosResult.verdict,
        error: arifosResult.error,
        degraded: arifosResult._degraded,
        record_id: record.id,
      });
    }
  }

  async searchByKeyword(keyword: string): Promise<TaskMemoryRecord[]> {
    const normalized = keyword.toLowerCase();
    const records = await this.readAll();
    return records.filter(
      (record) =>
        record.keywords.some((entry) => entry.toLowerCase().includes(normalized)) ||
        record.summary.toLowerCase().includes(normalized),
    );
  }

  async searchRelevant(task: string, limit = 3): Promise<TaskMemoryRecord[]> {
    const terms = [
      ...new Set(task.toLowerCase().split(/[^a-z0-9_/-]+/g).filter((term) => term.length >= 4)),
    ];
    const scored = new Map<string, { score: number; record: TaskMemoryRecord; fromFederation: boolean }>();

    // Local keyword search
    for (const term of terms) {
      for (const record of await this.searchByKeyword(term)) {
        const current = scored.get(record.id);
        const nextScore = (current?.score ?? 0) + 1;
        scored.set(record.id, { score: nextScore, record, fromFederation: false });
      }
    }

    // FEDERATION: cross-organ semantic search via arifOS MCP
    try {
      const fedResp = await arifosSearch({
        query: task,
        session_id: "a-forge-search",
        limit,
        context: "normal",
      });
      if (fedResp.status === "ok" && Array.isArray(fedResp.results)) {
        for (const r of fedResp.results) {
          const fed = r as Record<string, unknown>;
          const fedWriter = (fed.tags as string[] | undefined)?.includes("a-forge")
            ? "A-FORGE"
            : "other-organ";
          // Skip A-FORGE's own records (already in local file)
          if (fedWriter === "A-FORGE") continue;
          const taskRecord: TaskMemoryRecord = {
            id: (fed.memory_id as string) ?? (fed.id as string) ?? "federation-unknown",
            summary: (fed.summary as string) ?? "",
            keywords: (fed.tags as string[]) ?? [],
            createdAt: (fed.created_at as string) ?? new Date().toISOString(),
            metadata: {
              ...((fed.metadata as Record<string, unknown>) ?? {}),
              writer_bot: fedWriter,
              source: "arifos_mcp",
            },
          };
          if (!scored.has(taskRecord.id)) {
            scored.set(taskRecord.id, {
              score: taskRecord.keywords.length * 0.5,
              record: taskRecord,
              fromFederation: true,
            });
          }
        }
      } else {
        logFederationFailure("arifos_search_not_ok", {
          status: fedResp.status,
          degraded: fedResp._degraded,
        });
      }
    } catch (e) {
      logFederationFailure("arifos_search_exception", {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    const scoredKeys = Array.from(scored.keys());
    return scoredKeys
      .sort((left, right) => scored.get(left)!.score - scored.get(right)!.score)
      .reverse()
      .slice(0, limit)
      .map((key) => scored.get(key)!.record);
  }

  private async readAll(): Promise<TaskMemoryRecord[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      if (!raw.trim()) return [];
      return JSON.parse(raw) as TaskMemoryRecord[];
    } catch (error) {
      const typedError = error as NodeJS.ErrnoException;
      if (typedError.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  private async writeAll(records: TaskMemoryRecord[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(records, null, 2), "utf8");
  }
}
