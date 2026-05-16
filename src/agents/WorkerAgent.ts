import type { AgentRunResult, WorkerReport, WorkerTask } from "../types/agent.js";
import { AgentEngine } from "../engine/AgentEngine.js";

export class WorkerAgent {
  constructor(private readonly engineFactory: (task: WorkerTask) => AgentEngine) {}

  async run(task: WorkerTask, workingDirectory?: string): Promise<WorkerReport> {
    const result: AgentRunResult = await this.engineFactory(task).run({
      task: `${task.profile.systemPrompt}\n\nAssigned worker task:\n${task.task}`,
      workingDirectory,
    });

    return {
      workerName: task.name,
      summary: result.finalText,
      transcript: result.transcript,
      success: result.metrics.taskSuccess === 1,
      turnsUsed: result.metrics.turnsUsed,
    };
  }
}
