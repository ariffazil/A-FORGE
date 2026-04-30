import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { TaskMemoryRecord } from "../types/memory.js";

const QDRANT_URL = process.env.QDRANT_URL ?? "http://qdrant:6333";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "bge-m3";
const FEDERATION_COLLECTION = "federation_shared";

interface FederationRecord {
  id: string;
  summary: string;
  keywords: string[];
  createdAt: string;
  metadata?: Record<string, unknown>;
  writer_bot: string;
}

async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text }),
  });
  if (!response.ok) throw new Error(`Ollama embedding failed: ${response.statusText}`);
  const data = (await response.json()) as { embedding: number[] };
  return data.embedding;
}

async function federationUpsert(id: string, vector: number[], payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${QDRANT_URL}/collections/${FEDERATION_COLLECTION}/points`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        points: [{ id, vector, payload }],
      }),
    });
  } catch (e) {
    console.warn("[LongTermMemory] Federation upsert failed (non-fatal):", e);
  }
}

async function federationSearch(queryVector: number[], limit = 5): Promise<FederationRecord[]> {
  try {
    const response = await fetch(`${QDRANT_URL}/collections/${FEDERATION_COLLECTION}/points/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: queryVector,
        limit,
        with_payload: true,
      }),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { result: { id: string; payload: Record<string, unknown>; score: number }[] };
    return data.result.map((p) => ({
      id: p.id,
      summary: (p.payload.summary as string) ?? (p.payload.text as string) ?? "",
      keywords: (p.payload.keywords as string[]) ?? [],
      createdAt: (p.payload.createdAt as string) ?? new Date().toISOString(),
      metadata: p.payload.metadata as Record<string, unknown> | undefined,
      writer_bot: (p.payload.writer_bot as string) ?? "unknown",
    }));
  } catch (e) {
    console.warn("[LongTermMemory] Federation search failed (non-fatal):", e);
    return [];
  }
}

export class LongTermMemory {
  constructor(private readonly filePath: string) {}

  async store(record: TaskMemoryRecord): Promise<void> {
    // Keep local file write for A-FORGE internal use
    const records = await this.readAll();
    records.push(record);
    await this.writeAll(records);

    // Dual-write to federation_shared so the other bot can read it
    try {
      const vector = await getEmbedding(record.summary);
      await federationUpsert(record.id, vector, {
        summary: record.summary,
        keywords: record.keywords,
        createdAt: record.createdAt,
        metadata: record.metadata,
        writer_bot: "A-FORGE",
      });
    } catch (e) {
      console.warn("[LongTermMemory] Federation store failed (non-fatal):", e);
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

    // Federation semantic search — also retrieve cross-bot memory
    try {
      const queryVector = await getEmbedding(task);
      const fedRecords = await federationSearch(queryVector, limit);
      for (const fed of fedRecords) {
        // Skip A-FORGE's own records (already in local file)
        if (fed.writer_bot === "A-FORGE") continue;
        const taskRecord: TaskMemoryRecord = {
          id: fed.id,
          summary: fed.summary,
          keywords: fed.keywords,
          createdAt: fed.createdAt,
          metadata: { ...fed.metadata, writer_bot: fed.writer_bot, source: "federation_shared" },
        };
        // Don't double-count if already in local
        if (!scored.has(fed.id)) {
          scored.set(fed.id, { score: fed.keywords.length * 0.5, record: taskRecord, fromFederation: true });
        }
      }
    } catch (e) {
      console.warn("[LongTermMemory] Federation search failed (non-fatal):", e);
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
