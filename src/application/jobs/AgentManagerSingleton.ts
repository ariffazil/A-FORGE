/**
 * AgentManager Singleton — exposes a single AgentManager instance
 * to both the Express server and the TUI data sources.
 *
 * F1 AMANAH: Singleton access is read-only for status queries.
 * Job mutation (enqueue/complete/fail) still requires governance routing.
 *
 * Events: Wraps AgentManager methods to publish SSE events via event-bus.
 * F8 LAW: Events are observations — never commands or gate bypasses.
 */

import { AgentManager, type JobDefinition } from "./AgentManager.js";
import { publish } from "../../infrastructure/tui/adapters/event-bus.js";

let instance: AgentManager | null = null;

function wrapInstance(manager: AgentManager): AgentManager {
  const origEnqueue = manager.enqueue.bind(manager);
  const origComplete = manager.complete.bind(manager);
  const origFail = manager.fail.bind(manager);

  manager.enqueue = (job: Omit<JobDefinition, "id" | "createdAt" | "enqueuedBy">) => {
    const result = origEnqueue(job);
    publish({
      type: "job_enqueued",
      jobId: result.jobId,
      task: job.task,
      priority: job.priority,
      timestamp: new Date().toISOString(),
    });
    return result;
  };

  manager.complete = (jobId: string, summary: string) => {
    origComplete(jobId, summary);
    const run = manager.getRun(jobId);
    publish({
      type: "job_completed",
      jobId,
      turnsUsed: run?.turnsUsed ?? 0,
      timestamp: new Date().toISOString(),
    });
  };

  manager.fail = (jobId: string, error: string) => {
    origFail(jobId, error);
    publish({
      type: "job_failed",
      jobId,
      error,
      timestamp: new Date().toISOString(),
    });
  };

  return manager;
}

export function getAgentManager(): AgentManager {
  if (!instance) {
    const constitutionHash = process.env.CONSTITUTION_HASH ?? "arifos-v1-alpha";
    const manager = new AgentManager({
      agentId: "A-FORGE",
      constitutionHash,
    });
    instance = wrapInstance(manager);
  }
  return instance;
}

export function resetAgentManager(): void {
  instance = null;
}
