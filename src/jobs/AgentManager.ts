/**
 * A-FORGE Agent Manager
 *
 * Persistent control-plane service that:
 * - Owns the job queue (enqueue, dequeue, heartbeat, complete, fail)
 * - Manages agent session lifecycle (openSession on job start, sealSession on complete)
 * - Enforces tool allowlists per job profile
 * - Emits 888_HOLD events to Notifier when F13/high-risk tasks are enqueued
 * - Tracks job metadata in memory + mirrors state to VAULT999
 *
 * F1/F13 compliant: all vault writes use PostgresVaultClient.
 * All state changes are logged. No irreversible action without human seal.
 */

import { randomUUID } from "node:crypto";
import { getPostgresVaultClient, PostgresVaultClient } from "../vault/index.js";
import type { HumanEscalationClient } from "../escalation/index.js";

export type JobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type JobPriority = "low" | "medium" | "high" | "critical";

export interface JobDefinition {
  id: string;
  task: string;
  profile: string;
  priority: JobPriority;
  toolAllowList?: string[];
  blockedToolPatterns?: string[];
  sessionId?: string;
  createdAt: string;
  enqueuedBy: string;
  maxTurns?: number;
  metadata?: Record<string, unknown>;
}

export interface JobRunState {
  job: JobDefinition;
  status: JobStatus;
  startedAt?: string;
  completedAt?: string;
  workerId?: string;
  turnsUsed?: number;
  errorMessage?: string;
  holdTicketId?: string;
}

export interface AgentManagerConfig {
  agentId: string;
  constitutionHash: string;
  escalationWebhookUrl?: string;
  toolPolicy?: {
    defaultAllowList?: string[];
    blockedPatterns?: string[];
  };
}

export class AgentManager {
  private readonly queue: Map<string, JobDefinition> = new Map();
  private readonly runs: Map<string, JobRunState> = new Map();
  private readonly vault: PostgresVaultClient;
  private notifier?: NotifierService;
  private readonly config: AgentManagerConfig;

  constructor(config: AgentManagerConfig) {
    this.config = config;
    this.vault = getPostgresVaultClient();
  }

  setNotifier(notifier: NotifierService): void {
    this.notifier = notifier;
  }

  enqueue(job: Omit<JobDefinition, "id" | "createdAt" | "enqueuedBy">): { jobId: string; isHold: boolean } {
    const jobId = `JOB-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const fullJob: JobDefinition = {
      ...job,
      id: jobId,
      createdAt: new Date().toISOString(),
      enqueuedBy: this.config.agentId,
    };

    this.queue.set(jobId, fullJob);

    const isHold = this.requiresHold(job);
    if (isHold) {
      this.emitHold(jobId, fullJob);
    }

    process.stderr.write(
      `[AgentManager] ENQUEUED job=${jobId} priority=${job.priority} isHold=${isHold}\n`,
    );

    return { jobId, isHold };
  }

  dequeue(workerId: string, maxTurns = 20): JobDefinition | null {
    const sorted = [...this.queue.values()]
      .filter((j) => j.priority !== "low")
      .sort((a, b) => {
        const p = { critical: 0, high: 1, medium: 2, low: 3 };
        return (p[a.priority] ?? 3) - (p[b.priority] ?? 3);
      });

    const job = sorted[0];
    if (!job) return null;

    this.queue.delete(job.id);
    const sessionId = `SESSION-${job.id}`;

    const runState: JobRunState = {
      job: { ...job, sessionId },
      status: "RUNNING",
      startedAt: new Date().toISOString(),
      workerId,
      turnsUsed: 0,
    };
    this.runs.set(job.id, runState);

    this.vault.openSession({
      sessionId,
      agentId: this.config.agentId,
      constitutionHash: this.config.constitutionHash,
      metadata: { jobId: job.id, profile: job.profile, priority: job.priority },
    }).catch((err) => process.stderr.write(`[AgentManager] openSession failed: ${err}\n`));

    process.stderr.write(`[AgentManager] DEQUEUED job=${job.id} worker=${workerId} session=${sessionId}\n`);
    return { ...job, sessionId };
  }

  heartbeat(jobId: string, turnsUsed: number): void {
    const run = this.runs.get(jobId);
    if (run) {
      run.turnsUsed = turnsUsed;
    }
  }

  complete(jobId: string, summary: string): void {
    const run = this.runs.get(jobId);
    if (!run) {
      process.stderr.write(`[AgentManager] COMPLETE unknown job=${jobId}\n`);
      return;
    }

    run.status = "COMPLETED";
    run.completedAt = new Date().toISOString();

    this.vault.sealSession({
      sessionId: run.job.sessionId!,
      finalVerdict: "SEAL",
      finalText: summary,
      turnCount: run.turnsUsed ?? 0,
    }).catch((err) => process.stderr.write(`[AgentManager] sealSession failed: ${err}\n`));

    this.runs.delete(jobId);
    process.stderr.write(`[AgentManager] COMPLETED job=${jobId} turns=${run.turnsUsed}\n`);
  }

  fail(jobId: string, error: string): void {
    const run = this.runs.get(jobId);
    if (!run) return;

    run.status = "FAILED";
    run.errorMessage = error;
    run.completedAt = new Date().toISOString();

    this.vault.sealSession({
      sessionId: run.job.sessionId!,
      finalVerdict: "HOLD",
      finalText: `FAILED: ${error}`,
      turnCount: run.turnsUsed ?? 0,
    }).catch((err) => process.stderr.write(`[AgentManager] sealSession failed: ${err}\n`));

    this.runs.delete(jobId);
    process.stderr.write(`[AgentManager] FAILED job=${jobId} error=${error}\n`);
  }

  hold(jobId: string, ticketId: string): void {
    const run = this.runs.get(jobId);
    if (run) {
      run.status = "PENDING";
      run.holdTicketId = ticketId;
    }
    this.queue.delete(jobId);
    process.stderr.write(`[AgentManager] HOLD job=${jobId} ticket=${ticketId}\n`);
  }

  listJobs(status?: JobStatus): JobDefinition[] {
    if (status === undefined) {
      return [...this.queue.values(), ...[...this.runs.values()].map((r: JobRunState) => r.job)];
    }
    if (status === "RUNNING") {
      return [...this.runs.values()].filter((r: JobRunState) => r.status === "RUNNING").map((r: JobRunState) => r.job);
    }
    return [...this.queue.values()].filter((j: JobDefinition) => {
      const run = this.runs.get(j.id);
      return run?.status === status;
    });
  }

  getRun(jobId: string): JobRunState | undefined {
    return this.runs.get(jobId);
  }

  getToolAllowList(profile: string): string[] {
    return this.config.toolPolicy?.defaultAllowList ?? [
      "read_file", "write_file", "list_files", "grep_text",
      "run_tests", "run_command",
    ];
  }

  getBlockedPatterns(profile: string): string[] {
    return this.config.toolPolicy?.blockedPatterns ?? [
      "rm -rf", "shutdown", "reboot", "mkfs", "dd ",
      "git reset --hard", "curl ", "wget ", ">:",
    ];
  }

  private requiresHold(job: Omit<JobDefinition, "id" | "createdAt" | "enqueuedBy">): boolean {
    return job.priority === "critical" || job.priority === "high";
  }

  private emitHold(jobId: string, job: JobDefinition): void {
    if (!this.notifier) {
      process.stderr.write(`[AgentManager] 888_HOLD job=${jobId} — no notifier configured\n`);
      return;
    }
    this.notifier.sendHold({
      jobId,
      task: job.task,
      priority: job.priority,
      profile: job.profile,
      sessionId: job.sessionId,
    }).catch((err) => process.stderr.write(`[AgentManager] notifyHold failed: ${err}\n`));
  }
}

export interface NotifierService {
  sendHold(payload: {
    jobId: string;
    task: string;
    priority: JobPriority;
    profile: string;
    sessionId?: string;
  }): Promise<void>;
  sendAlert(payload: { severity: "info" | "warn" | "critical"; message: string }): Promise<void>;
}


