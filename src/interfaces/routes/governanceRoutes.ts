import { Router } from "express";
import type { Request, Response } from "express";
import { LocalGovernanceClient } from "../../domain/governance/index.js";
import {
  getAdaptiveThresholds,
  type IntentModel,
  type RiskLevel,
} from "../../domain/governance/thresholds.js";

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

  return router;
}
