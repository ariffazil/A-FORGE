/**
 * AF-FORGE HTTP Bridge Server
 * 
 * Exposes Sense and Judge functionality to Python MCP
 * Port: 7071 (configurable via AF_FORGE_PORT)
 * 
 * Endpoints:
 * - POST /sense - Run Sense Lite/Deep + F7 confidence
 * - GET /health - Service health check
 */

import express from "express";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { runSense } from "./policy/sense.js";
import {
  calculateConfidenceEstimate,
  evaluateWithConfidence,
  classifyUncertaintyBand,
} from "./policy/confidence.js";
import { register } from "prom-client";
import { runStage, recordHumanDecision, recordEscalationLatency, setOpenHolds } from "./metrics/prometheus.js";
import type { MetabolicStage } from "./types/aki.js";
import { getTicketStore } from "./approval/index.js";
import { FileVaultClient } from "./vault/index.js";
import { LocalGovernanceClient } from "./governance/index.js";
import { getAdaptiveThresholds } from "./governance/thresholds.js";
import { createOperatorAuthMiddleware } from "./middleware/operatorAuth.js";

const app = express();
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Operator / Human-expert auth middleware
const OPERATOR_API_TOKEN = process.env.OPERATOR_API_TOKEN;
if (!OPERATOR_API_TOKEN) {
  console.error("[WARN] OPERATOR_API_TOKEN is not set; /operator and /human-expert endpoints are unauthenticated");
}

const requireOperatorAuth = createOperatorAuthMiddleware(OPERATOR_API_TOKEN);
app.use("/operator", requireOperatorAuth);
app.use("/human-expert", requireOperatorAuth);

/**
 * POST /sense
 * Run Sense classification with F7 confidence evaluation
 */
app.post("/sense", async (req: Request, res: Response) => {
  try {
    return await runStage("111_SENSE" as MetabolicStage, async () => {
    const { session_id, prompt, context } = req.body;

    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({
        ok: false,
        error: {
          type: "invalid_request",
          message: "prompt is required and must be a string",
        },
      });
      return;
    }

    // Run Sense (111) - Lite/Deep classification
    const sense = runSense(prompt, "auto");

    // Calculate F7 confidence proxy
    const uncertaintyHint =
      sense.uncertainty_band === "low"
        ? 0.2
        : sense.uncertainty_band === "medium"
          ? 0.4
          : sense.uncertainty_band === "high"
            ? 0.6
            : 0.8;

    const confidence = calculateConfidenceEstimate(
      sense.evidence_count,
      sense.evidence_quality ?? 0.5,
      sense.contradiction_flags,
      uncertaintyHint,
    );

    // Run Judge evaluation (888)
    const judge = evaluateWithConfidence(
      confidence,
      sense.uncertainty_band,
      sense.contradiction_flags,
      sense.evidence_count,
    );

    // Log for observability
    console.error(
      `[SENSE 111] session=${session_id ?? "anon"} mode=${sense.mode_used} ` +
        `uncertainty=${sense.uncertainty_band} recommendation=${sense.recommended_next_stage} ` +
        `verdict=${judge.verdict}`,
    );

    const payload = {
      ok: true,
      sense: {
        mode_used: sense.mode_used,
        escalation_reason: sense.escalation_reason,
        evidence_count: sense.evidence_count,
        evidence_quality: sense.evidence_quality,
        uncertainty_band: sense.uncertainty_band,
        recommended_next_stage: sense.recommended_next_stage,
        contradiction_flags: sense.contradiction_flags,
        query_complexity_score: sense.query_complexity_score,
        risk_indicators: sense.risk_indicators,
      },
      judge: {
        verdict: judge.verdict,
        reason: judge.reason,
        confidence: {
          value: judge.confidence.value,
          is_estimate: judge.confidence.is_estimate,
          evidence_count: judge.confidence.evidence_count,
          agreement_score: judge.confidence.agreement_score,
          contradiction_penalty: judge.confidence.contradiction_penalty,
          uncertainty_hint: judge.confidence.uncertainty_hint,
        },
        floors_triggered: judge.floors_triggered,
        human_review_required: judge.human_review_required,
      },
      context: {
        source: "af-forge",
        version: "0.1.0",
        epoch: "2026-04-08",
        received_context: context,
      },
    };
    res.json(payload);
    return payload;
    });
  } catch (error) {
    console.error("[AF-FORGE] /sense error:", error);
    res.status(500).json({
      ok: false,
      error: {
        type: "upstream_error",
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

/**
 * POST /governance/evaluate
 * Constitutional evaluation endpoint — can be called by AgentEngine
 * or by external clients to get a SEAL/HOLD/SABAR/VOID verdict.
 */
app.post("/governance/evaluate", async (req: Request, res: Response) => {
  try {
    const { task, sessionId, intentModel, riskLevel } = req.body;
    if (!task || typeof task !== "string") {
      res.status(400).json({
        ok: false,
        error: { type: "invalid_request", message: "task is required and must be a string" },
      });
      return;
    }

    const adaptive = getAdaptiveThresholds(intentModel ?? "advisory", riskLevel ?? "medium");
    const client = new LocalGovernanceClient({ f3: adaptive.f3 });
    const result = await client.evaluate({
      task,
      sessionId: sessionId ?? "anon",
      intentModel,
      riskLevel,
    });

    res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[AF-FORGE] /governance/evaluate error:", error);
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
 * GET /metrics
 * Prometheus metrics endpoint
 */
app.get("/metrics", async (_req: Request, res: Response) => {
  try {
    const store = getTicketStore();
    await store.initialize();
    const openCount = await store.countOpen();
    setOpenHolds(openCount);
  } catch {
    // best effort
  }
  res.set("Content-Type", register.contentType);
  res.send(await register.metrics());
});

/**
 * GET /health
 * Service health check
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "af-forge-sense",
    status: "healthy",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /ready
 * Readiness probe (for orchestrators)
 */
app.get("/ready", (_req: Request, res: Response) => {
  // Could add dependency checks here (memory, etc.)
  res.json({
    ready: true,
    checks: {
      policy: true,
      sense: true,
      judge: true,
    },
  });
});

/**
 * GET /human-expert/tickets
 * List approval tickets with optional filtering
 */
app.get("/human-expert/tickets", async (req: Request, res: Response) => {
  try {
    const store = getTicketStore();
    await store.initialize();
    const status = req.query.status as string | undefined;
    const sessionId = req.query.sessionId as string | undefined;
    const riskLevel = req.query.riskLevel as string | undefined;
    const tickets = await store.query({
      status: status as any,
      sessionId,
      riskLevel: riskLevel as any,
    });
    res.json({ ok: true, count: tickets.length, tickets });
  } catch (error) {
    console.error("[AF-FORGE] /human-expert/tickets error:", error);
    res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
  }
});

/**
 * GET /human-expert/tickets/:ticketId
 * Get a single approval ticket
 */
app.get("/human-expert/tickets/:ticketId", async (req: Request, res: Response) => {
  try {
    const store = getTicketStore();
    await store.initialize();
    const ticket = await store.findById(req.params.ticketId);
    if (!ticket) {
      res.status(404).json({ ok: false, error: { type: "not_found", message: "Ticket not found" } });
      return;
    }
    res.json({ ok: true, ticket });
  } catch (error) {
    console.error("[AF-FORGE] /human-expert/tickets/:ticketId error:", error);
    res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
  }
});

/**
 * POST /human-expert/decision
 * Submit a human decision for a ticket and seal it to VAULT999
 */
app.post("/human-expert/decision", async (req: Request, res: Response) => {
  try {
    const { ticketId, decision, notes, humanId, signature } = req.body;
    if (!ticketId || !decision) {
      res.status(400).json({ ok: false, error: { type: "invalid_request", message: "ticketId and decision are required" } });
      return;
    }

    const store = getTicketStore();
    await store.initialize();
    const ticket = await store.findById(ticketId);
    if (!ticket) {
      res.status(404).json({ ok: false, error: { type: "not_found", message: "Ticket not found" } });
      return;
    }

    const validDecisions = ["APPROVE", "REJECT", "MODIFY", "ASK_MORE"] as const;
    if (!validDecisions.includes(decision)) {
      res.status(400).json({ ok: false, error: { type: "invalid_request", message: `decision must be one of ${validDecisions.join(", ")}` } });
      return;
    }

    const statusMap = {
      APPROVE: "APPROVED",
      REJECT: "REJECTED",
      MODIFY: "MODIFY_REQUIRED",
      ASK_MORE: "ACKED",
    } as const;

    const updated = await store.updateTicket(ticketId, {
      status: statusMap[decision as keyof typeof statusMap],
      decision,
      decisionNotes: notes,
      humanId,
      signature,
      decidedAt: new Date().toISOString(),
    });

    recordHumanDecision(decision, ticket.domain ?? "unspecified", ticket.riskLevel);
    if (ticket.dispatchedAt && updated?.decidedAt) {
      const latencySec = (new Date(updated.decidedAt).getTime() - new Date(ticket.dispatchedAt).getTime()) / 1000;
      recordEscalationLatency(latencySec, ticket.domain ?? "unspecified");
    }

    // Best-effort VAULT999 seal of the decision
    const vaultClient = new FileVaultClient();
    await vaultClient
      .seal({
        sealId: randomUUID(),
        sessionId: ticket.sessionId,
        verdict: decision === "APPROVE" ? "SEAL" : "HOLD",
        hashofinput: "",
        telemetrysnapshot: ticket.telemetrySnapshot,
        floors_triggered: ticket.floorsTriggered,
        irreversibilityacknowledged: false,
        timestamp: new Date().toISOString(),
        task: ticket.prompt,
        finalText: `Human decision: ${decision}. Notes: ${notes ?? ""}`,
        turnCount: 0,
        profileName: "human-expert",
        escalation: {
          escalated: true,
          humanEndpoint: "webhook",
          humanDecision: decision as any,
          humanId,
          ticketId,
        },
      })
      .catch(() => {});

    res.json({ ok: true, ticket: updated });
  } catch (error) {
    console.error("[AF-FORGE] /human-expert/decision error:", error);
    res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
  }
});

/**
 * POST /human-expert/tickets/:ticketId/replay
 * Mark an approved ticket as replayed and return a replay token
 */
app.post("/human-expert/tickets/:ticketId/replay", async (req: Request, res: Response) => {
  try {
    const store = getTicketStore();
    await store.initialize();
    const ticket = await store.findById(req.params.ticketId);
    if (!ticket) {
      res.status(404).json({ ok: false, error: { type: "not_found", message: "Ticket not found" } });
      return;
    }
    if (ticket.status !== "APPROVED") {
      res.status(409).json({ ok: false, error: { type: "conflict", message: `Ticket status is ${ticket.status}, only APPROVED tickets can be replayed` } });
      return;
    }

    const replayToken = `replay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const updated = await store.updateTicket(req.params.ticketId, {
      status: "REPLAYED",
      replayToken,
      replayedAt: new Date().toISOString(),
    });

    res.json({ ok: true, ticket: updated, replayToken });
  } catch (error) {
    console.error("[AF-FORGE] /human-expert/tickets/:ticketId/replay error:", error);
    res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
  }
});

/**
 * GET /operator/approvals
 * List approval tickets with optional filtering
 */
app.get("/operator/approvals", async (req: Request, res: Response) => {
  try {
    const store = getTicketStore();
    await store.initialize();
    const status = req.query.status as string | undefined;
    const sessionId = req.query.sessionId as string | undefined;
    const riskLevel = req.query.riskLevel as string | undefined;
    const tickets = await store.query({
      status: status as any,
      sessionId,
      riskLevel: riskLevel as any,
    });
    res.json({ ok: true, count: tickets.length, tickets });
  } catch (error) {
    console.error("[AF-FORGE] /operator/approvals error:", error);
    res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
  }
});

/**
 * GET /operator/approvals/:ticketId
 * Get a single approval ticket
 */
app.get("/operator/approvals/:ticketId", async (req: Request, res: Response) => {
  try {
    const store = getTicketStore();
    await store.initialize();
    const ticket = await store.findById(req.params.ticketId);
    if (!ticket) {
      res.status(404).json({ ok: false, error: { type: "not_found", message: "Ticket not found" } });
      return;
    }
    res.json({ ok: true, ticket });
  } catch (error) {
    console.error("[AF-FORGE] /operator/approvals/:ticketId error:", error);
    res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
  }
});

/**
 * GET /operator/vault
 * Search vault seals with optional filtering
 */
app.get("/operator/vault", async (req: Request, res: Response) => {
  try {
    const vaultClient = new FileVaultClient();
    const sessionId = req.query.sessionId as string | undefined;
    const verdict = req.query.verdict as string | undefined;
    const since = req.query.since as string | undefined;
    const until = req.query.until as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const records = await vaultClient.query({
      sessionId,
      verdict: verdict as any,
      since,
      until,
      limit: Number.isFinite(limit as number) ? limit : undefined,
    });
    res.json({ ok: true, count: records.length, records });
  } catch (error) {
    console.error("[AF-FORGE] /operator/vault error:", error);
    res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
  }
});

/**
 * GET /operator/vault/:sealId
 * Get a single vault seal record
 */
app.get("/operator/vault/:sealId", async (req: Request, res: Response) => {
  try {
    const vaultClient = new FileVaultClient();
    const record = await vaultClient.findById(req.params.sealId);
    if (!record) {
      res.status(404).json({ ok: false, error: { type: "not_found", message: "Seal not found" } });
      return;
    }
    res.json({ ok: true, record });
  } catch (error) {
    console.error("[AF-FORGE] /operator/vault/:sealId error:", error);
    res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
  }
});

// Error handling
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error("[AF-FORGE] Unhandled error:", err);
  res.status(500).json({
    ok: false,
    error: {
      type: "internal_error",
      message: err.message,
    },
  });
});

const port = process.env.AF_FORGE_PORT ? parseInt(process.env.AF_FORGE_PORT, 10) : 7071;

app.listen(port, "0.0.0.0", () => {
  console.error(`═══════════════════════════════════════════════════════════`);
  console.error(`  AF-FORGE Sense Bridge Server`);
  console.error(`  Listening on 0.0.0.0:${port}`);
  console.error(`  Endpoints:`);
  console.error(`    POST /sense  - Sense + Judge evaluation`);
  console.error(`    GET  /health - Health check`);
  console.error(`    GET  /ready  - Readiness probe`);
  console.error(`    GET  /operator/approvals - List approval tickets`);
  console.error(`    GET  /operator/vault      - Search vault seals`);
  console.error(`═══════════════════════════════════════════════════════════`);
});
