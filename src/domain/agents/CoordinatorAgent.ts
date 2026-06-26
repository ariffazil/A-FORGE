import type { AgentProfile, ToolDefinitionForModel, WorkerReport, WorkerTask } from "../types/agent.js";
import type { ILlmProvider } from "../types/ports.js";
import { WorkerAgent } from "./WorkerAgent.js";
import { buildWorkerProfile } from "./profiles.js";
import type { ParallelPlannerContract } from "../planner/ParallelPlannerContract.js";
import {
  classifyTaskRole,
  buildRoleProfile,
  buildRolePrompt,
  type TaskRole,
  type RoutedSubtask,
} from "./roles.js";

export class CoordinatorAgent {
  constructor(
    protected readonly profile: AgentProfile,
    protected readonly workerAgent: WorkerAgent,
    protected readonly llmProvider: ILlmProvider,
    protected readonly plannerContract?: ParallelPlannerContract,
    /** Enable role-based routing. When true, subtasks are classified into
     *  specialized roles (planner/implementer/reviewer/tester/security/release)
     *  instead of using a generic worker profile. */
    protected readonly roleRouting: boolean = false,
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
    /** Per-role breakdown when role routing is enabled */
    roleBreakdown?: Record<TaskRole, { count: number; success: number }>;
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

    // Apply role routing if enabled
    if (this.roleRouting) {
      tasks = this.applyRoleRouting(tasks);
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
    if (this.roleRouting) {
      const roleCounts: Record<string, number> = {};
      for (const t of tasks) {
        const r = t.role ?? "worker";
        roleCounts[r] = (roleCounts[r] ?? 0) + 1;
      }
      summaryParts.push(`Role routing: ${JSON.stringify(roleCounts)}`);
    }
    summaryParts.push("Worker reports:", reportBody);

    // Build role breakdown if routing enabled
    let roleBreakdown: Record<TaskRole, { count: number; success: number }> | undefined;
    if (this.roleRouting) {
      roleBreakdown = {} as Record<TaskRole, { count: number; success: number }>;
      for (let i = 0; i < tasks.length; i++) {
        const role = tasks[i].role ?? ("implementer" as TaskRole);
        if (!roleBreakdown[role]) roleBreakdown[role] = { count: 0, success: 0 };
        roleBreakdown[role].count++;
        if (reports[i]?.success) roleBreakdown[role].success++;
      }
    }

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
      roleBreakdown,
    };
  }

  /**
   * Apply role routing to a set of worker tasks.
   * Classifies each task, assigns a role-specific profile, and reorders
   * by execution sequence (planner first, release last).
   */
  private applyRoleRouting(tasks: WorkerTask[]): WorkerTask[] {
    const routed: RoutedSubtask[] = tasks.map((t, i) => {
      const role = classifyTaskRole(t.task);
      return {
        role,
        task: t.task,
        profile: buildRoleProfile(role, this.profile.modeName),
        order: i,
      };
    });

    // Sort by role priority
    const ROLE_ORDER: Record<TaskRole, number> = {
      planner: 0,
      implementer: 1,
      reviewer: 2,
      tester: 3,
      security: 4,
      release: 5,
    };
    routed.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);

    return routed.map((r) => ({
      name: `${r.role}-${r.order}`,
      task: buildRolePrompt(r),
      profile: r.profile,
      role: r.role,
    }));
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
