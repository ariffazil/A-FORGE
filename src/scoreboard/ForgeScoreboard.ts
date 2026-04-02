import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ForgeTaskRecord, ForgeWeeklySummary } from "../types/scoreboard.js";

export class ForgeScoreboard {
  constructor(private readonly filePath: string) {}

  async append(record: ForgeTaskRecord): Promise<void> {
    const records = await this.readAll();
    records.push(record);
    await this.writeAll(records);
  }

  async readAll(): Promise<ForgeTaskRecord[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as ForgeTaskRecord[];
    } catch (error) {
      const typed = error as NodeJS.ErrnoException;
      if (typed.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async summarizeCurrentWeek(
    now = new Date(),
    filters?: { taskCommand?: string; trustMode?: "local_vps" | "default" },
  ): Promise<ForgeWeeklySummary> {
    const weekStart = startOfWeek(now);
    const records = (await this.readAll()).filter((record) => {
      if (new Date(record.completedAt) < weekStart) {
        return false;
      }
      if (filters?.taskCommand && record.taskCommand !== filters.taskCommand) {
        return false;
      }
      if (filters?.trustMode && record.trustMode !== filters.trustMode) {
        return false;
      }
      return true;
    });

    const totalTasks = records.length;
    const completedTasks = records.filter((record) => record.taskCompletion === 1).length;
    const passAt1Count = records.filter((record) => record.passAt1 === 1).length;
    const passAtKCount = records.filter((record) => record.passAtK === 1).length;
    const errors = records.filter((record) => record.errorMessage).length;

    return {
      weekStart: weekStart.toISOString(),
      groupBy: {
        taskCommand: filters?.taskCommand ?? "all",
        trustMode: filters?.trustMode ?? "all",
      },
      totalTasks,
      completedTasks,
      meanTaskSuccess: ratio(completedTasks, totalTasks),
      completionRate: ratio(completedTasks, totalTasks),
      passAt1Rate: ratio(passAt1Count, totalTasks),
      passAtKRate: ratio(passAtKCount, totalTasks),
      averageHumanMinutes: average(records.map((record) => record.humanMinutes)),
      medianTurnsUsed: median(records.map((record) => record.codexTurns)),
      meanToolCalls: average(records.map((record) => record.toolCalls)),
      meanLlmCost: average(records.map((record) => record.codexApiCost)),
      averageCostPerTask: average(records.map((record) => record.codexApiCost)),
      averageTurnsPerTask: average(records.map((record) => record.codexTurns)),
      averageToolCallsPerTask: average(records.map((record) => record.toolCalls)),
      errorRate: ratio(errors, totalTasks),
    };
  }

  private async writeAll(records: ForgeTaskRecord[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(records, null, 2), "utf8");
  }
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  result.setUTCDate(result.getUTCDate() + offset);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}
