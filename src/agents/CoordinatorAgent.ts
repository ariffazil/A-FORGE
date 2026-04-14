import type { AgentProfile, ToolDefinitionForModel, WorkerReport, WorkerTask } from "../types/agent.js";
import type { LlmProvider } from "../llm/LlmProvider.js";
import { WorkerAgent } from "./WorkerAgent.js";
import { buildWorkerProfile } from "./profiles.js";
import type { ParallelPlannerContract } from "../planner/ParallelPlannerContract.js";

export class CoordinatorAgent {
  constructor(
    private readonly profile: AgentProfile,
    private readonly workerAgent: WorkerAgent,
    private readonly llmProvider: LlmProvider,
    private readonly plannerContract?: ParallelPlannerContract,
  ) {}

  async coordinate(
    highLevelTask: string,
    workingDirectory?: string,
  ): Promise<{
    summary: string;
    metrics: {
      plannerSubtasks: number;
      workerSuccessRate: number;
      coordinationFailures: number;
      turnsUsed: number;
    };
    planVerdict?: string;
    planReason?: string;
  }> {
    let tasks: WorkerTask[];
    let planVerdict: string | undefined;
    let planReason: string | undefined;

    if (this.plannerContract) {
      const comparison = await this.plannerContract.plan(highLevelTask);
      planVerdict = comparison.verdict;
      planReason = comparison.reason;

      if (comparison.verdict === "HOLD") {
        return {
          summary: `HOLD: ${comparison.reason}`,
          metrics: {
            plannerSubtasks: 0,
            workerSuccessRate: 0,
            coordinationFailures: 0,
            turnsUsed: comparison.candidates.length,
          },
          planVerdict,
          planReason,
        };
      }

      tasks =
        comparison.selectedTasks.length > 0
          ? comparison.selectedTasks
          : await this.planWorkerTasks(highLevelTask);
    } else {
      tasks = await this.planWorkerTasks(highLevelTask);
    }

    // Run all workers in parallel (F-bound by budget, not sequential)
    const reports: WorkerReport[] = await Promise.all(
      tasks.map((task) => this.workerAgent.run(task, workingDirectory)),
    );

    const reportBody = reports
      .map((report) => `Worker ${report.workerName}\n${report.summary}`)
      .join("\n\n");

    const summaryParts = [
      `Coordinator profile: ${this.profile.name}`,
      `Task: ${highLevelTask}`,
    ];
    if (planVerdict) {
      summaryParts.push(`Plan verdict: ${planVerdict} — ${planReason ?? ""}`);
    }
    summaryParts.push("Worker reports:", reportBody);

    return {
      summary: summaryParts.join("\n\n"),
      metrics: {
        plannerSubtasks: tasks.length,
        workerSuccessRate:
          tasks.length === 0 ? 0 : reports.filter((report) => report.success).length / tasks.length,
        coordinationFailures: tasks.length - reports.filter((report) => report.success).length,
        turnsUsed: tasks.length + 1 + reports.reduce((sum, report) => sum + report.turnsUsed, 0),
      },
      planVerdict,
      planReason,
    };
  }

  private async planWorkerTasks(highLevelTask: string): Promise<WorkerTask[]> {
    const planningTools: ToolDefinitionForModel[] = [];
    const response = await this.llmProvider.completeTurn({
      profile: this.profile,
      messages: [
        {
          role: "user",
          content: [
            "Break the following engineering task into 2-4 worker tasks.",
            "Return strict JSON as an array.",
            'Each item must contain: {"name":"worker-name","task":"specific task"}',
            `Task: ${highLevelTask}`,
          ].join("\n"),
        },
      ],
      tools: planningTools,
    });

    const parsed = safeParsePlan(response.content);
    if (parsed.length > 0) {
      return parsed.map((entry) => ({
        name: entry.name,
        task: entry.task,
        profile: buildWorkerProfile(this.profile.modeName),
      }));
    }

    return [
      {
        name: "worker-1",
        task: highLevelTask,
        profile: buildWorkerProfile(this.profile.modeName),
      },
    ];
  }
}

function safeParsePlan(input: string): Array<{ name: string; task: string }> {
  try {
    const parsed = JSON.parse(input) as Array<{ name?: string; task?: string }>;
    return parsed
      .filter((entry) => typeof entry?.name === "string" && typeof entry?.task === "string")
      .map((entry) => ({
        name: String(entry.name),
        task: String(entry.task),
      }));
  } catch {
    return [];
  }
}
