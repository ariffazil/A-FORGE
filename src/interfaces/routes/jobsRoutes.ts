/**
 * A-FORGE Jobs Routes
 *
 * Read-only status endpoints for the job queue and active runs.
 * Used by the TUI dashboard and external monitoring.
 *
 * F1 AMANAH: All routes are GET/read-only. No mutation.
 * F8 LAW: Respects organ boundaries — job state is owned by AgentManager.
 *
 * Endpoints:
 *   GET /jobs           — List all jobs (queued + running)
 *   GET /jobs/queue     — List queued jobs only
 *   GET /jobs/running   — List running jobs only
 *   GET /jobs/:id       — Single job detail
 *   GET /jobs/metrics   — Aggregate job metrics
 *   GET /events         — SSE stream for live TUI updates
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { getAgentManager } from "../../application/jobs/AgentManagerSingleton.js";

export function createJobsRouter(): Router {
  const router = Router();

  /**
   * GET /jobs — List all jobs (queued + running)
   */
  router.get("/", (_req: Request, res: Response) => {
    try {
      const manager = getAgentManager();
      const all = manager.listJobs();
      const runs = ["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"].flatMap((s) =>
        manager.listJobs(s as any).map((j) => {
          const run = manager.getRun(j.id);
          return {
            ...j,
            status: run?.status ?? "PENDING",
            startedAt: run?.startedAt,
            completedAt: run?.completedAt,
            workerId: run?.workerId,
            turnsUsed: run?.turnsUsed,
            errorMessage: run?.errorMessage,
            holdTicketId: run?.holdTicketId,
          };
        }),
      );

      res.json({
        ok: true,
        count: runs.length,
        jobs: runs,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[A-FORGE] /jobs error:", error);
      res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
    }
  });

  /**
   * GET /jobs/queue — List queued jobs only
   */
  router.get("/queue", (_req: Request, res: Response) => {
    try {
      const manager = getAgentManager();
      const queue = manager.listJobs("PENDING");
      res.json({
        ok: true,
        count: queue.length,
        jobs: queue,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[A-FORGE] /jobs/queue error:", error);
      res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
    }
  });

  /**
   * GET /jobs/running — List running jobs only
   */
  router.get("/running", (_req: Request, res: Response) => {
    try {
      const manager = getAgentManager();
      const running = manager.listJobs("RUNNING").map((j) => {
        const run = manager.getRun(j.id);
        return {
          ...j,
          startedAt: run?.startedAt,
          turnsUsed: run?.turnsUsed,
          workerId: run?.workerId,
        };
      });
      res.json({
        ok: true,
        count: running.length,
        jobs: running,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[A-FORGE] /jobs/running error:", error);
      res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
    }
  });

  /**
   * GET /jobs/metrics — Aggregate job metrics
   */
  router.get("/metrics", async (_req: Request, res: Response) => {
    try {
      const manager = getAgentManager();
      const all = manager.listJobs();
      const counts: Record<string, number> = {
        PENDING: 0,
        RUNNING: 0,
        COMPLETED: 0,
        FAILED: 0,
        CANCELLED: 0,
      };
      for (const j of all) {
        const s = manager.getRun(j.id)?.status ?? "PENDING";
        counts[s] = (counts[s] ?? 0) + 1;
      }

      // Count open holds from escalation ticket store (best-effort)
      let openHolds = 0;
      try {
        const { getTicketStore } = await import("../../application/approval/index.js");
        const store = getTicketStore();
        await store.initialize();
        openHolds = await store.countOpen();
      } catch {
        // best effort
      }

      res.json({
        ok: true,
        total: all.length,
        counts,
        openHolds,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[A-FORGE] /jobs/metrics error:", error);
      res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
    }
  });

  /**
   * GET /jobs/:id — Single job detail
   */
  router.get("/:id", (req: Request, res: Response) => {
    try {
      const manager = getAgentManager();
      const jobId = String(req.params.id);
      const all = manager.listJobs();
      const job = all.find((j) => j.id === jobId);
      if (!job) {
        res.status(404).json({ ok: false, error: { type: "not_found", message: `Job ${jobId} not found` } });
        return;
      }
      const run = manager.getRun(jobId);
      res.json({
        ok: true,
        job: {
          ...job,
          status: run?.status ?? "PENDING",
          startedAt: run?.startedAt,
          completedAt: run?.completedAt,
          workerId: run?.workerId,
          turnsUsed: run?.turnsUsed,
          errorMessage: run?.errorMessage,
          holdTicketId: run?.holdTicketId,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[A-FORGE] /jobs/:id error:", error);
      res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
    }
  });

  return router;
}

/**
 * SSE Event Types for TUI consumption
 */
export type TUISSEEvent =
  | { type: "job_update"; jobId: string; status: string; progress?: number }
  | { type: "job_created"; jobId: string; task: string; priority: string }
  | { type: "job_completed"; jobId: string; turnsUsed: number }
  | { type: "job_failed"; jobId: string; error: string }
  | { type: "health_update"; organs: Record<string, string> }
  | { type: "governance_update"; floor: string; status: "violation" | "clear" }
  | { type: "metrics"; data: Record<string, number> }
  | { type: "log"; message: string };
