export class WorkerAgent {
    engineFactory;
    constructor(engineFactory) {
        this.engineFactory = engineFactory;
    }
    async run(task, workingDirectory) {
        const result = await this.engineFactory(task).run({
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
