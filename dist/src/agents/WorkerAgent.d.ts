import type { WorkerReport, WorkerTask } from "../types/agent.js";
import { AgentEngine } from "../engine/AgentEngine.js";
export declare class WorkerAgent {
    private readonly engineFactory;
    constructor(engineFactory: (task: WorkerTask) => AgentEngine);
    run(task: WorkerTask, workingDirectory?: string): Promise<WorkerReport>;
}
