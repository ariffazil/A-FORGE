import { buildWorkerProfile } from "./profiles.js";
export class CoordinatorAgent {
    profile;
    workerAgent;
    llmProvider;
    constructor(profile, workerAgent, llmProvider) {
        this.profile = profile;
        this.workerAgent = workerAgent;
        this.llmProvider = llmProvider;
    }
    async coordinate(highLevelTask, workingDirectory) {
        const tasks = await this.planWorkerTasks(highLevelTask);
        const reports = [];
        for (const task of tasks) {
            reports.push(await this.workerAgent.run(task, workingDirectory));
        }
        const reportBody = reports
            .map((report) => `Worker ${report.workerName}\n${report.summary}`)
            .join("\n\n");
        return {
            summary: [
                `Coordinator profile: ${this.profile.name}`,
                `Task: ${highLevelTask}`,
                "Worker reports:",
                reportBody,
            ].join("\n\n"),
            metrics: {
                plannerSubtasks: tasks.length,
                workerSuccessRate: tasks.length === 0 ? 0 : reports.filter((report) => report.success).length / tasks.length,
                coordinationFailures: tasks.length - reports.filter((report) => report.success).length,
                turnsUsed: 1 + reports.reduce((sum, report) => sum + report.turnsUsed, 0),
            },
        };
    }
    async planWorkerTasks(highLevelTask) {
        const planningTools = [];
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
function safeParsePlan(input) {
    try {
        const parsed = JSON.parse(input);
        return parsed
            .filter((entry) => typeof entry?.name === "string" && typeof entry?.task === "string")
            .map((entry) => ({
            name: String(entry.name),
            task: String(entry.task),
        }));
    }
    catch {
        return [];
    }
}
