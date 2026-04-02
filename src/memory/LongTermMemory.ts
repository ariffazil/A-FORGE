import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { TaskMemoryRecord } from "../types/memory.js";

export class LongTermMemory {
  constructor(private readonly filePath: string) {}

  async store(record: TaskMemoryRecord): Promise<void> {
    const records = await this.readAll();
    records.push(record);
    await this.writeAll(records);
  }

  async searchByKeyword(keyword: string): Promise<TaskMemoryRecord[]> {
    const normalized = keyword.toLowerCase();
    const records = await this.readAll();
    return records.filter((record) =>
      record.keywords.some((entry) => entry.toLowerCase().includes(normalized)) ||
      record.summary.toLowerCase().includes(normalized),
    );
  }

  async searchRelevant(task: string, limit = 3): Promise<TaskMemoryRecord[]> {
    const terms = [...new Set(task.toLowerCase().split(/[^a-z0-9_/-]+/g).filter((term) => term.length >= 4))];
    const scored = new Map<string, { score: number; record: TaskMemoryRecord }>();

    for (const term of terms) {
      for (const record of await this.searchByKeyword(term)) {
        const current = scored.get(record.id);
        const nextScore = (current?.score ?? 0) + 1;
        scored.set(record.id, { score: nextScore, record });
      }
    }

    return [...scored.values()]
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((entry) => entry.record);
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
