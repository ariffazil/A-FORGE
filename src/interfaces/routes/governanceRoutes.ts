import { Router } from "express";
import type { Request, Response } from "express";
import { LocalGovernanceClient } from "../../domain/governance/index.js";
import {
  getAdaptiveThresholds,
  type IntentModel,
  type RiskLevel,
} from "../../domain/governance/thresholds.js";
import { getTicketStore } from "../../application/approval/index.js";

function normalizeRiskLevel(value: unknown): RiskLevel {
  if (typeof value !== "string") {
    return "medium";
  }

  const normalized = value.toLowerCase();
  if (normalized === "safe") {
    return "low";
  }
  if (normalized === "dangerous") {
    return "high";
  }
  if (
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high" ||
    normalized === "critical"
  ) {
    return normalized;
  }
  return "medium";
}

function normalizeIntentModel(value: unknown): IntentModel {
  if (
    value === "informational" ||
    value === "advisory" ||
    value === "execution" ||
    value === "speculative"
  ) {
    return value;
  }
  return "advisory";
}

export function createGovernanceRouter(): Router {
  const router = Router();

  router.post("/governance/evaluate", async (req: Request, res: Response) => {
    try {
      const { task, sessionId, intentModel, riskLevel } = req.body;
      if (!task || typeof task !== "string") {
        res.status(400).json({
          ok: false,
          error: {
            type: "invalid_request",
            message: "task is required and must be a string",
          },
        });
        return;
      }

      const intent = normalizeIntentModel(intentModel);
      const risk = normalizeRiskLevel(riskLevel);
      const adaptive = getAdaptiveThresholds(intent, risk);
      const client = new LocalGovernanceClient({ f3: adaptive.f3 });
      const result = await client.evaluate({
        task,
        sessionId: typeof sessionId === "string" ? sessionId : "anon",
        intentModel: intent,
        riskLevel: risk,
      });

      res.json({ ok: true, ...result });
    } catch (error) {
      console.error("[A-FORGE] /governance/evaluate error:", error);
      res.status(500).json({
        ok: false,
        error: {
          type: "internal_error",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  /**
   * GET /api/governance-status
   * TUI governance panel feed — returns live constitutional floor status.
   *
   * F1 AMANAH: Read-only. No state mutation.
   * F2 TRUTH: Data sourced from live ticket store + floor classifier, not invented.
   * F9 ANTI-HANTU: Provenance (source) and epoch_id on every floor entry.
   */
  router.get("/api/governance-status", async (_req: Request, res: Response) => {
    try {
      // F2 TRUTH: Try to get live hold data; degrade gracefully if store unavailable
      let openTickets: any[] = [];
      let storeSource = "a-forge-advisory";
      try {
        const tickets = getTicketStore();
        const all = await tickets.query();
        openTickets = all.tickets.filter((t: any) => t.status === "PENDING" || t.status === "OPEN");
      } catch (storeErr) {
        // Postgres/SSL unavailable — fall through with empty holds, mark source
        storeSource = "a-forge-advisory-degraded";
        process.stderr.write(`[WARN] governance-status: ticket store unavailable: ${storeErr}\n`);
      }
      const openHolds = openTickets.length;

      const epoch_id = new Date().toISOString();
      const now = Date.now();

      // Static constitutional floors monitored by A-FORGE (advisory only — arifOS is the true judge)
      const FLOOR_DEFS: Array<{ floor: string; name: string }> = [
        { floor: "F1", name: "AMANAH" },
        { floor: "F2", name: "TRUTH" },
        { floor: "F4", name: "CLARITY" },
        { floor: "F6", name: "MARUAH" },
        { floor: "F7", name: "HUMILITY" },
        { floor: "F8", name: "LAW" },
        { floor: "F9", name: "ANTI-HANTU" },
        { floor: "F13", name: "SOVEREIGN" },
      ];

      // Check for active holds that map to floor violations
      const holdsByFloor: Record<string, string> = {};
      for (const t of openTickets) {
        for (const floor of t.floorsTriggered ?? []) {
          holdsByFloor[floor] = t.ticketId;
        }
      }

      const floors = FLOOR_DEFS.map((f) => ({
        floor: f.floor,
        name: f.name,
        status: holdsByFloor[f.floor] ? "violation" : "clear",
        severity: holdsByFloor[f.floor] ? "high" : undefined,
        source: storeSource,
        staleness_seconds: 0,
        epoch_id,
      }));

      res.json({
        ok: true,
        service: "A-FORGE",
        source: storeSource,
        note: "Advisory only. Constitutional verdicts are issued by arifOS kernel only.",
        open_holds: openHolds,
        epoch_id,
        timestamp: new Date().toISOString(),
        floors,
      });
    } catch (error) {
      console.error("[A-FORGE] /api/governance-status error:", error);
      res.status(500).json({
        ok: false,
        error: {
          type: "internal_error",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  return router;
}
