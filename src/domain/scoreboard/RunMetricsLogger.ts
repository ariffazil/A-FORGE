import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { RunMetrics } from "../types/agent.js";

export class RunMetricsLogger {
  constructor(private readonly directoryPath: string) {}

  async log(taskId: string, payload: Record<string, unknown>): Promise<string> {
    await mkdir(this.directoryPath, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = join(this.directoryPath, `agent-workbench-run-${stamp}-${taskId}.json`);
    await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
    return filePath;
  }
}
