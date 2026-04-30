/**
 * A-FORGE HTTP Bridge Server
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
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { runSense } from "./policy/sense.js";
import {
  calculateConfidenceEstimate,
  evaluateWithConfidence,
  classifyUncertaintyBand,
} from "./policy/confidence.js";
import { register } from "prom-client";
import { runStage, recordHumanDecision, recordEscalationLatency, setOpenHolds, recordBridgeContractMismatch } from "./metrics/prometheus.js";
import type { MetabolicStage } from "./types/aki.js";
import { getTicketStore } from "./approval/index.js";
import { FileVaultClient } from "./vault/index.js";
import { getPostgresVaultClient, type FloorRule, MerkleV3Service } from "./vault/index.js";
import { LocalGovernanceClient } from "./governance/index.js";
import { getAdaptiveThresholds } from "./governance/thresholds.js";
import { SealService } from "./governance/SealService.js";
import { PlanValidator } from "./planner/PlanValidator.js";
import { createOperatorAuthMiddleware } from "./middleware/operatorAuth.js";
import { AAAgent } from "./agents/AAAgent.js";
import { WorkerAgent } from "./agents/WorkerAgent.js";
import { buildAAAProfile } from "./agents/profiles.js";
import { createLlmProvider } from "./llm/providerFactory.js";
import { readRuntimeConfig } from "./config/RuntimeConfig.js";
import { AgentEngine } from "./engine/AgentEngine.js";
import { ToolRegistry } from "./tools/ToolRegistry.js";
import { LongTermMemory } from "./memory/LongTermMemory.js";
import { createA2ARouter } from "./a2a/index.js";

let cachedConstitution: FloorRule[] = [];

async function loadConstitution(): Promise<void> {
  const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!postgresUrl) {
    console.error("[WARN] No POSTGRES_URL — constitution loaded from static defaults");
    return;
  }
  try {
    const vault = getPostgresVaultClient(postgresUrl);
    cachedConstitution = await vault.loadConstitution();
    const count = cachedConstitution.length;
    console.error(`[INIT] Constitution loaded from VAULT999: ${count} floor rules`);
    if (count === 13) {
      const f13 = cachedConstitution.find((f) => f.floor_id === "F13");
      if (f13) console.error(`[INIT] F13 seal_threshold=${f13.seal_threshold}`);
    }
  } catch (err) {
    console.error(`[WARN] Failed to load constitution from vault: ${err} — using static defaults`);
  }
}

export function getConstitution(): FloorRule[] {
  return cachedConstitution;
}

function ensureOperatorTokenPolicy(): string | undefined {
  const operatorApiToken = process.env.OPERATOR_API_TOKEN;
  const isProduction = process.env.NODE_ENV === "production" || process.env.AF_FORGE_ENV === "production";
  if (!operatorApiToken) {
    if (isProduction) {
      console.error("[FATAL] OPERATOR_API_TOKEN is required in production mode; /operator and /human-expert endpoints cannot be exposed without authentication");
      process.exit(1);
    }
    console.error("[WARN] OPERATOR_API_TOKEN is not set; /operator and /human-expert endpoints are unauthenticated");
  }
  return operatorApiToken;
}

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  // Request logging
  app.use((req, _res, next) => {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  app.use(createA2ARouter());

  const requireOperatorAuth = createOperatorAuthMiddleware(ensureOperatorTokenPolicy());
  app.use("/operator", requireOperatorAuth);
  app.use("/human-expert", requireOperatorAuth);

/**
 * POST /sense
 * Run Sense classification with F7 confidence evaluation
 */
app.post("/sense", async (req: Request, res: Response) => {
  try {
    return await runStage("111_SENSE" as MetabolicStage, async () => {
    const { version: clientVersion, session_id, prompt, context } = req.body;
    if (clientVersion && clientVersion !== "0.1.0" && clientVersion !== "1") {
      recordBridgeContractMismatch(`client_version_${clientVersion}`);
    }

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
        source: "A-FORGE",
        version: "0.1.0",
        epoch: "2026-04-08",
        received_context: context,
      },
    };
    res.json(payload);
    return payload;
    });
  } catch (error) {
    console.error("[A-FORGE] /sense error:", error);
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
 * POST /route
 * Federal Coordinator Routing — AAA-Agent (ASI)
 * Routes tasks to GEOX, WEALTH, AUDITOR, etc.
 */
app.post("/route", async (req: Request, res: Response) => {
  try {
    return await runStage("333_MIND" as MetabolicStage, async () => {
      const { prompt, sessionId, mode } = req.body;
      if (!prompt) {
        res.status(400).json({ ok: false, error: "prompt is required" });
        return;
      }

      const config = readRuntimeConfig();
      const llmProvider = createLlmProvider(config);
      const aaaProfile = buildAAAProfile(mode === "internal" ? "internal_mode" : "external_safe_mode");
      const sealService = new SealService(new PlanValidator());
      const workerAgent = new WorkerAgent((t) => new AgentEngine(t.profile, {
        llmProvider,
        toolRegistry: new ToolRegistry(),
        longTermMemory: new LongTermMemory(config.memoryPath),
        sealService,
      }));
      const aaaAgent = new AAAgent(aaaProfile, workerAgent, llmProvider);

      const decision = await aaaAgent.route(prompt);

      res.json({
        ok: true,
        routing_decision: decision,
        agent_id: decision === "888_HOLD" ? null : decision,
        is_hold: decision === "888_HOLD",
        session_id: sessionId ?? "anon",
        coordinator: "AAA-Agent",
      });
    });
  } catch (error) {
    console.error("[A-FORGE] /route error:", error);
    res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
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

    const riskLevelMap: Record<string, string> = {
      low: "low", medium: "medium", high: "high", critical: "critical",
      dangerous: "high", safe: "low",
    };
    const risk = riskLevelMap[riskLevel ?? "medium"] ?? "medium";
    const adaptive = getAdaptiveThresholds(intentModel ?? "advisory", risk as any);
    const client = new LocalGovernanceClient({ f3: adaptive.f3 });
    const result = await client.evaluate({
      task,
      sessionId: sessionId ?? "anon",
      intentModel,
      riskLevel,
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
 * GET /contract
 * Runtime contract for arifOS bridge negotiation
 */
app.get("/contract", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    api_version: "0.1.0",
    min_compatible_client: "0.1.0",
    service: "A-FORGE",
    governance_surface: "HTTP bridge + MCP stdio",
    capabilities: {
      sense: true,
      judge: true,
      governance_evaluate: true,
      a2a: true,
      operator_console: true,
      human_expert: true,
      seal_service: true,
      dangerous_tools: process.env.ENABLE_DANGEROUS_TOOLS === "1" || process.env.ENABLE_DANGEROUS_TOOLS === "true",
      background_jobs: process.env.ENABLE_BACKGROUND_JOBS === "1" || process.env.ENABLE_BACKGROUND_JOBS === "true",
      GEOX_log_interpreter: true,
    },
    endpoints: {
      GEOX_log_interpreter: "POST /GEOX/log_interpreter",
      GEOX_contract: "GET /GEOX/contract",
      a2a: "POST /a2a",
      a2a_agent_card: "GET /.well-known/agent-card.json",
      python_mcp: "GEOX-mcp:8765",
      bridge: "A-FORGE-bridge:7071",
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /GEOX/contract
 * GEOX capabilities manifest — exposes A-FORGE GEOX tools to external callers
 * including the GEOX Python MCP and well-desk app.
 */
app.get("/GEOX/contract", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "A-FORGE-GEOX",
    version: "0.1.0",
    namespace: "GEOX",
    tools: [
      {
        name: "GEOX_log_interpreter",
        description: "Interpret triple-combo wireline logs (GR, RT, RHOB, NPHI, SP, DT, CAL) → Vsh, PHIE, SW, fluid type, lithology. Anomalous contrast theory.",
        domain: "geophysics",
        pipeline_stage: "333_MIND",
        required_logs: ["GR", "RHOB", "NPHI"],
        optional_logs: ["RT", "SP", "DT", "CAL", "depth"],
        output: ["Vsh", "PHIE", "SW", "BVW", "anomalyScore", "fluidFlag", "lithology", "quality", "anomalyContrast"],
        uncertainty_tag: ["ESTIMATE", "HYPOTHESIS", "UNKNOWN"],
        risk_level: "guarded",
        gates: ["F8_Grounding", "F7_Confidence"],
      },
      {
        name: "GEOX_check_hazard",
        description: "Assess physical hazard (seismic, volcanic, flood, slope, anthropogenic) at a location",
        domain: "geophysics",
        pipeline_stage: "333_MIND",
        risk_level: "guarded",
      },
      {
        name: "GEOX_subsurface_model",
        description: "Generate 3D subsurface geological model with structural framework and property volumes",
        domain: "geophysics",
        pipeline_stage: "333_MIND",
        risk_level: "guarded",
      },
      {
        name: "GEOX_seismic_interpret",
        description: "Structural and stratigraphic interpretation of seismic data",
        domain: "geophysics",
        pipeline_stage: "333_MIND",
        risk_level: "guarded",
      },
      {
        name: "GEOX_prospect_score",
        description: "Compute composite prospect score (PP, TR, CHARGE) with uncertainty",
        domain: "geophysics",
        pipeline_stage: "333_MIND",
        risk_level: "guarded",
      },
      {
        name: "GEOX_physical_constraint",
        description: "Apply physical constraints (pressure, temperature, stress, porosity) to scenario",
        domain: "geophysics",
        pipeline_stage: "333_MIND",
        risk_level: "guarded",
      },
      {
        name: "GEOX_uncertainty_tag",
        description: "Assign ESTIMATE/HYPOTHESIS/UNKNOWN tag to observation based on evidence quality",
        domain: "geophysics",
        pipeline_stage: "333_MIND",
        risk_level: "guarded",
      },
      {
        name: "GEOX_witness_triad",
        description: "W³ — Triple-witness check: three independent methods confirm observation",
        domain: "geophysics",
        pipeline_stage: "333_MIND",
        risk_level: "guarded",
      },
      {
        name: "GEOX_ground_truth",
        description: "Cross-validate observation against ground truth (analog, test, simulation)",
        domain: "geophysics",
        pipeline_stage: "333_MIND",
        risk_level: "guarded",
      },
      {
        name: "GEOX_maraoh_impact",
        description: "Assess community dignity and cultural heritage impact (F6 maruah)",
        domain: "geophysics",
        pipeline_stage: "333_MIND",
        risk_level: "guarded",
      },
      {
        name: "GEOX_extraction_limits",
        description: "Compute maximum safe extraction rate and cumulative production limits",
        domain: "geophysics",
        pipeline_stage: "333_MIND",
        risk_level: "guarded",
      },
      {
        name: "GEOX_climate_bounds",
        description: "Compute climate envelope (CO2 storage, water production) for operation",
        domain: "geophysics",
        pipeline_stage: "333_MIND",
        risk_level: "guarded",
      },
    ],
    python_mcp_route: "GEOX-mcp:8765",
    bridge_route: "A-FORGE-bridge:7071/GEOX/*",
    note: "GEOX_log_interpreter is executed by A-FORGE TypeScript runtime; Python MCP GEOX_well_compute_petrophysics is a separate sibling service",
  });
});

/**
 * POST /GEOX/log_interpreter
 * Execute GEOXLogInterpreterTool — triple-combo anomalous contrast decoder.
 * Accessible to Python MCP via internal HTTP call.
 */
app.post("/GEOX/log_interpreter", async (req: Request, res: Response) => {
  try {
    return await runStage("333_MIND" as MetabolicStage, async () => {
      const { GEOXLogInterpreterTool } = await import("./domains/geophysics/logInterpreter.js");
      const tool = new GEOXLogInterpreterTool();
      const result = await tool.run(req.body, { sessionId: "GEOX-bridge", workingDirectory: "/tmp", modeName: "internal_mode" });
      if (!result.ok) {
        res.status(400).json({ ok: false, error: result.output });
        return;
      }
      res.json({ ok: true, result: JSON.parse(result.output as string) });
    });
  } catch (error) {
    console.error("[A-FORGE] /GEOX/log_interpreter error:", error);
    res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
  }
});

/**
 * GET /health
 * Service health check
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "A-FORGE-sense",
    status: "healthy",
    version: "0.1.0",
    contract_url: "/contract",
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
      contract: true,
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
    console.error("[A-FORGE] /human-expert/tickets error:", error);
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
    console.error("[A-FORGE] /human-expert/tickets/:ticketId error:", error);
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
    console.error("[A-FORGE] /human-expert/decision error:", error);
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
    console.error("[A-FORGE] /human-expert/tickets/:ticketId/replay error:", error);
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
    console.error("[A-FORGE] /operator/approvals error:", error);
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
    console.error("[A-FORGE] /operator/approvals/:ticketId error:", error);
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
    console.error("[A-FORGE] /operator/vault error:", error);
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
    console.error("[A-FORGE] /operator/vault/:sealId error:", error);
    res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
  }
});

/**
 * GET /vault/merkle/verify
 * Verify the Merkle v3 chain for a given date (defaults to today).
 * Returns: { valid, brokenAt, storedRoot, computedRoot, rowCount }
 */
app.get("/vault/merkle/verify", async (req: Request, res: Response) => {
  try {
    const dateStr = req.query.date as string | undefined;
    const date = dateStr ? new Date(dateStr) : new Date();
    const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!postgresUrl) {
      res.status(503).json({ ok: false, error: { type: "unavailable", message: "No database connection" } });
      return;
    }
    const vault = getPostgresVaultClient(postgresUrl);
    const merkle = new MerkleV3Service(vault);
    const result = await merkle.verifyChain(date);
    res.json({ ok: true, ...result, date: date.toISOString().split("T")[0] });
  } catch (error) {
    console.error("[A-FORGE] /vault/merkle/verify error:", error);
    res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
  }
});

/**
 * POST /vault/merkle/seal
 * Run daily Merkle seal: build chain + anchor root + verify.
 * Triggers F1/F11 tamper-evidence checkpoint.
 */
app.post("/vault/merkle/seal", async (req: Request, res: Response) => {
  try {
    const dateStr = (req.body as { date?: string }).date;
    const date = dateStr ? new Date(dateStr) : new Date();
    const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!postgresUrl) {
      res.status(503).json({ ok: false, error: { type: "unavailable", message: "No database connection" } });
      return;
    }
    const vault = getPostgresVaultClient(postgresUrl);
    const merkle = new MerkleV3Service(vault);
    const result = await merkle.dailySeal(date);
    console.error(`[MerkleV3] dailySeal ${date.toISOString().split("T")[0]}: valid=${result.valid} rows=${result.rowCount}`);
    res.json({ ok: true, ...result, date: date.toISOString().split("T")[0] });
  } catch (error) {
    console.error("[A-FORGE] /vault/merkle/seal error:", error);
    res.status(500).json({ ok: false, error: { type: "internal_error", message: String(error) } });
  }
});

// Error handling
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error("[A-FORGE] Unhandled error:", err);
  res.status(500).json({
    ok: false,
    error: {
      type: "internal_error",
      message: err.message,
    },
  });
});

  return app;
}

export const app = createApp();

const port = process.env.AF_FORGE_PORT ? parseInt(process.env.AF_FORGE_PORT, 10) : 7071;

export async function startServer(): Promise<void> {
  await loadConstitution();
  app.listen(port, "0.0.0.0", async () => {
    console.error(`═══════════════════════════════════════════════════════════`);
    console.error(`  A-FORGE Sense Bridge Server`);
    console.error(`  Listening on 0.0.0.0:${port}`);
    console.error(`  Endpoints:`);
    console.error(`    POST /sense  - Sense + Judge evaluation`);
    console.error(`    POST /a2a    - A2A JSON-RPC gateway`);
    console.error(`    GET  /health - Health check`);
    console.error(`    GET  /ready  - Readiness probe`);
    console.error(`    GET  /.well-known/agent-card.json - A2A Agent Card`);
    console.error(`    GET  /operator/approvals - List approval tickets`);
    console.error(`    GET  /operator/vault      - Search vault seals`);
    console.error(`═══════════════════════════════════════════════════════════`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void startServer();
}



