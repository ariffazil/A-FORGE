import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Request, Response } from "express";
import {
  parseRiskLevel,
  parseTicketStatus,
  parseVaultVerdict,
  toQueryString,
} from "../../application/approval/filterParsing.js";
import { getTicketStore } from "../../application/approval/index.js";
import { recordEscalationLatency, recordHumanDecision } from "../../infrastructure/metrics/prometheus.js";
import { FileVaultClient } from "../../infrastructure/vault/index.js";
import type { VaultVerdict } from "../../domain/types/sovereign.js";
import type { VaultTelemetrySnapshot } from "../../infrastructure/vault/VaultClient.js";

export function createHumanExpertRouter(): Router {
  const router = Router();

  router.get("/tickets", async (req: Request, res: Response) => {
    try {
      const store = getTicketStore();
      await store.initialize();
      const status = parseTicketStatus(toQueryString(req.query.status));
      const sessionId = toQueryString(req.query.sessionId);
      const riskLevel = parseRiskLevel(toQueryString(req.query.riskLevel));
      const { tickets: ticketList } = await store.query({
        status,
        sessionId,
        riskLevel,
      });
      res.json({ ok: true, count: ticketList.length, tickets: ticketList });
    } catch (error) {
      console.error("[A-FORGE] /human-expert/tickets error:", error);
      res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
    }
  });

  router.get("/tickets/:ticketId", async (req: Request, res: Response) => {
    try {
      const store = getTicketStore();
      await store.initialize();
      const ticket = await store.findById(String(req.params.ticketId));
      if (!ticket) {
        res.status(404).json({ ok: false, error: { type: "not_found", message: "Ticket not found" } });
        return;
      }
      res.json({ ok: true, ticket });
    } catch (error) {
      console.error("[A-FORGE] /human-expert/tickets/:ticketId error:", error);
      res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
    }
  });

  router.post("/decision", async (req: Request, res: Response) => {
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
      const parsedDecision = decision as (typeof validDecisions)[number];

      const statusMap = {
        APPROVE: "APPROVED",
        REJECT: "REJECTED",
        MODIFY: "MODIFY_REQUIRED",
        ASK_MORE: "ACKED",
      } as const;

      const updated = await store.updateTicket(ticketId, {
        status: statusMap[parsedDecision],
        decision: parsedDecision,
        decisionNotes: notes,
        humanId,
        signature,
        decidedAt: new Date().toISOString(),
      });

      recordHumanDecision(parsedDecision, ticket.domain ?? "unspecified", ticket.riskLevel);
      const dispatchedAt = (ticket as Record<string, unknown>).dispatchedAt;
      const decidedAt = (updated as Record<string, unknown>)?.decidedAt;
      if (dispatchedAt && decidedAt) {
        const latencySec = (new Date(String(dispatchedAt)).getTime() - new Date(String(decidedAt)).getTime()) / 1000;
        recordEscalationLatency(latencySec, ticket.domain ?? "unspecified");
      }

      // Best-effort VAULT999 seal of the decision
      try {
        const vaultClient = new FileVaultClient();
        await vaultClient.seal({
          sealId: randomUUID(),
          sessionId: ticket.sessionId ?? "unknown",
          verdict: (parsedDecision === "APPROVE" ? "SEAL" : "HOLD") as VaultVerdict,
          hashofinput: "",
          telemetrysnapshot: (ticket.telemetrySnapshot ?? { dS: 0, peace2: 0, psi_le: 0, W3: 0, G: 0 }) as VaultTelemetrySnapshot,
          floors_triggered: ticket.floorsTriggered ?? [],
          irreversibilityacknowledged: false,
          timestamp: new Date().toISOString(),
          task: ticket.prompt ?? "human_decision",
          finalText: `Human decision: ${parsedDecision}. Notes: ${notes ?? ""}`,
          turnCount: 0,
          profileName: "human-expert",
          escalation: {
            escalated: true,
            humanEndpoint: "webhook",
            humanDecision: parsedDecision,
            humanId: humanId as string | undefined,
            ticketId,
          },
        });
      } catch {
        // Best-effort — non-critical vault write failure
      }

      res.json({ ok: true, ticket: updated });
    } catch (error) {
      console.error("[A-FORGE] /human-expert/decision error:", error);
      res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
    }
  });

  router.post("/tickets/:ticketId/replay", async (req: Request, res: Response) => {
    try {
      const store = getTicketStore();
      await store.initialize();
      const ticket = await store.findById(String(req.params.ticketId));
      if (!ticket) {
        res.status(404).json({ ok: false, error: { type: "not_found", message: "Ticket not found" } });
        return;
      }
      if (ticket.status !== "APPROVED") {
        res.status(409).json({ ok: false, error: { type: "conflict", message: `Ticket status is ${ticket.status}, only APPROVED tickets can be replayed` } });
        return;
      }

      const replayToken = `replay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const updated = await store.updateTicket(String(req.params.ticketId), {
        status: "REPLAYED",
        replayToken,
        replayedAt: new Date().toISOString(),
      });

      res.json({ ok: true, ticket: updated, replayToken });
    } catch (error) {
      console.error("[A-FORGE] /human-expert/tickets/:ticketId/replay error:", error);
      res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
    }
  });

  return router;
}

export function createOperatorRouter(): Router {
  const router = Router();

  router.get("/approvals", async (req: Request, res: Response) => {
    try {
      const store = getTicketStore();
      await store.initialize();
      const status = parseTicketStatus(toQueryString(req.query.status));
      const sessionId = toQueryString(req.query.sessionId);
      const riskLevel = parseRiskLevel(toQueryString(req.query.riskLevel));
      const { tickets: ticketList } = await store.query({
        status,
        sessionId,
        riskLevel,
      });
      res.json({ ok: true, count: ticketList.length, tickets: ticketList });
    } catch (error) {
      console.error("[A-FORGE] /operator/approvals error:", error);
      res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
    }
  });

  router.get("/approvals/:ticketId", async (req: Request, res: Response) => {
    try {
      const store = getTicketStore();
      await store.initialize();
      const ticket = await store.findById(String(req.params.ticketId));
      if (!ticket) {
        res.status(404).json({ ok: false, error: { type: "not_found", message: "Ticket not found" } });
        return;
      }
      res.json({ ok: true, ticket });
    } catch (error) {
      console.error("[A-FORGE] /operator/approvals/:ticketId error:", error);
      res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
    }
  });

  router.get("/vault", async (req: Request, res: Response) => {
    try {
      const vaultClient = new FileVaultClient();
      const sessionId = toQueryString(req.query.sessionId);
      const verdict = parseVaultVerdict(toQueryString(req.query.verdict)) as VaultVerdict | undefined;
      const since = toQueryString(req.query.since);
      const until = toQueryString(req.query.until);
      const limitRaw = toQueryString(req.query.limit);
      const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
      const records = await vaultClient.query({
        sessionId,
        verdict,
        since,
        until,
        limit: typeof limit === "number" && Number.isFinite(limit) ? limit : undefined,
      });
      res.json({ ok: true, count: records.length, records });
    } catch (error) {
      console.error("[A-FORGE] /operator/vault error:", error);
      res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
    }
  });

  router.get("/vault/:sealId", async (req: Request, res: Response) => {
    try {
      const vaultClient = new FileVaultClient();
      const record = await vaultClient.findById(String(req.params.sealId));
      if (!record) {
        res.status(404).json({ ok: false, error: { type: "not_found", message: "Seal not found" } });
        return;
      }
      res.json({ ok: true, record });
    } catch (error) {
      console.error("[A-FORGE] /operator/vault/:sealId error:", error);
      res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
    }
  });

  return router;
}

