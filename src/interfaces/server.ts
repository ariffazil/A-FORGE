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
import { readFileSync } from "fs";
import * as http from "http";
import { createHash } from "crypto";
import { runSense } from "../domain/policy/sense.js";
import {
  calculateConfidenceEstimate,
  evaluateWithConfidence,
  classifyUncertaintyBand,
} from "../domain/policy/confidence.js";
import { register } from "prom-client";
import { runStage, setOpenHolds, recordBridgeContractMismatch } from "../infrastructure/metrics/prometheus.js";
import type { MetabolicStage } from "../domain/types/aki.js";
import { getTicketStore } from "../application/approval/index.js";
import { getPostgresVaultClient, type FloorRule } from "../infrastructure/vault/index.js";
import { SealService } from "../domain/governance/SealService.js";
import { getCoolingGate } from "../domain/governance/CoolingGate.js";
import { PlanValidator } from "../domain/planner/PlanValidator.js";
import { createOperatorAuthMiddleware } from "./middleware/operatorAuth.js";
import { AAAgent } from "../domain/agents/AAAgent.js";
import { WorkerAgent } from "../domain/agents/WorkerAgent.js";
import { buildAAAProfile } from "../domain/agents/profiles.js";
import { createLlmProvider } from "../infrastructure/llm/providerFactory.js";
import { readRuntimeConfig } from "./config/RuntimeConfig.js";
import { AgentEngine } from "../domain/engine/AgentEngine.js";
import { ToolRegistry } from "../infrastructure/tools/ToolRegistry.js";
import { LongTermMemory } from "../application/memory/LongTermMemory.js";
import { createA2ARouter } from "../application/a2a/index.js";
import {
  createHumanExpertRouter,
  createOperatorRouter,
} from "./routes/approvalOperatorRoutes.js";
import { createGovernanceRouter } from "./routes/governanceRoutes.js";
import { createVaultMerkleRouter } from "./routes/vaultMerkleRoutes.js";
import { createRepoStewardRouter } from "./routes/repoStewardRoutes.js";
import { callMCP } from "./mcp/client.js";
import { server as mcpServer } from "./mcp/core.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import { getApprovalBoundary } from "../application/approval/index.js";
import { getMemoryContract } from "../domain/memory-contract/index.js";
import { telemetry } from "./mcp/telemetry.js";

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

  // ── MCP Routes: Streamable HTTP transport on /mcp ──
  // req.body already parsed by app.use(express.json()) above.
  const mcpRouter = express.Router();
  const mcpHandler = async (req: Request, res: Response) => {
    if (!mcpTransport) {
      res.status(503).json({ error: "MCP transport not initialized" });
      return;
    }
    try {
      await mcpTransport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("[A-FORGE] MCP transport error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "MCP transport error" });
      }
    }
  };
  mcpRouter.all("/mcp", mcpHandler);
  mcpRouter.all("/GEOX/mcp", mcpHandler);
  mcpRouter.all("/wealth/mcp", mcpHandler);
  app.use(mcpRouter);

  // Rest of Express app (existing routes)
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
 * POST /execute
 * Federation MCP proxy — execute any MCP tool on any kernel.
 * Body: { tool: string, args: object, session_id?: string, actor_id?: string }
 *
 * 🔒 ADAT AGENTIC PreToolUse Enforcer (forged 2026-06-14):
 *   Before every tool call, classifies action → gates ATOMIC → auto-seals MUTATE.
 *   F1-F13 enforcement is architectural, not prompt-based.
 */
app.post("/execute", async (req: Request, res: Response) => {
  try {
    const { tool, args, session_id, actor_id } = req.body;
    if (!tool || typeof tool !== "string") {
      res.status(400).json({ ok: false, error: "tool is required and must be a string" });
      return;
    }

    // ── ADAT AGENTIC: Classify action before execution ──
    const ATOMIC_TOOLS = new Set([
      "arif_vault_seal", "forge_approve", "arif_forge_execute",
      "docker_container_remove", "docker_volume_remove",
      "systemctl_stop", "systemctl_restart",
      "git_push_force", "git_hard_reset",
      "hostinger_vps_restart", "hostinger_vps_stop",
    ]);
    const MUTATE_TOOLS = new Set([
      "forge_dry_run", "arif_systemctl", "arif_sudo", "arif_run",
      "write", "edit", "bash",
      "docker_container_start", "docker_container_restart",
      "git_push", "git_commit",
    ]);
    const actionClass = ATOMIC_TOOLS.has(tool) ? "ATOMIC" : MUTATE_TOOLS.has(tool) ? "MUTATE" : "OBSERVE";

    // ATOMIC gate: require F13 888_HOLD
    if (actionClass === "ATOMIC") {
      const holdId = req.body.hold_id;
      if (!holdId) {
        res.status(423).json({
          ok: false,
          error: {
            type: "governance_hold",
            message: `888_HOLD: Tool "${tool}" is classified ATOMIC. Requires hold_id from arif_judge_deliberate SEAL verdict.`,
          },
          action_class: "ATOMIC",
          adat_gate: "888_HOLD",
        });
        return;
      }
      console.error(`[ADAT] ATOMIC ${tool} authorized with hold_id=${holdId}`);
    }

    const mergedArgs = { ...(args ?? {}), session_id, actor_id };
    const result = await callMCP(tool, mergedArgs);

    // ── ADAT AGENTIC: Auto-seal MUTATE/ATOMIC actions ──
    if (actionClass === "MUTATE" || actionClass === "ATOMIC") {
      try {
        const sealResult = await callMCP("arif_vault_seal", {
          content: JSON.stringify({ tool, actionClass, session_id, timestamp: new Date().toISOString() }),
          reason: `auto-seal: ${tool}`,
          tier: actionClass === "ATOMIC" ? "CRITICAL" : "STANDARD",
        });
        console.error(`[ADAT] Auto-sealed ${tool} (${actionClass}) → vault`);
      } catch (sealErr) {
        console.error(`[ADAT] Auto-seal failed (non-blocking): ${sealErr}`);
        // Non-blocking: action succeeded, seal failure is logged but doesn't roll back
      }
    }

    res.json({
      ok: true,
      tool,
      result,
      action_class: actionClass,
      adat_enforced: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[A-FORGE] /execute error:", error);
    const message = error instanceof Error ? error.message : String(error);
    const isHold = message.includes("888_HOLD") || message.includes("HOLD");
    // Determine action class from tool name in error context
    const toolForError = req.body?.tool ?? "unknown";
    const isAtomicErr = ["arif_vault_seal","forge_approve","arif_forge_execute","hostinger_vps_restart"].some(t => toolForError.includes(t));
    const actionClassErr = isAtomicErr ? "ATOMIC" : "MUTATE";
    res.status(isHold ? 423 : 500).json({
      ok: false,
      error: {
        type: isHold ? "governance_hold" : "execution_error",
        message,
      },
      action_class: actionClassErr,
      adat_enforced: true,
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
      python_mcp: "GEOX-mcp:8081",
      bridge: "A-FORGE-bridge:7071",
      federation_probe: "GET /api/federation-probe",
      repo_steward: "GET /api/repo-steward/{sot-validator,registry-trinity,repo-entropy,steward-suggest}",
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
        description: "Bridge to GEOX organ for wireline log interpretation. Routes to geox_mcp.well_compute_petrophysics.",
        domain: "geophysics",
        pipeline_stage: "333_MIND",
        required_logs: ["GR", "RHOB", "NPHI"],
        optional_logs: ["RT", "SP", "DT", "CAL", "depth"],
        output: ["estimates", "anomalyScore", "fluidFlag", "lithology", "quality", "anomalyContrast"],
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
    python_mcp_route: "GEOX-mcp:8081",
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
      const { GEOXLogInterpreterBridge } = await import("../infrastructure/bridges/geoxBridge.js");
      const tool = new GEOXLogInterpreterBridge();
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
  let identityHash = "UNAVAILABLE";
  try {
    identityHash = readFileSync("/root/A-FORGE/.identity_hash", "utf8").trim();
  } catch (e) {}

  const now = new Date().toISOString();

  res.json({
    ok: true,
    service: "A-FORGE-sense",
    status: "healthy",
    version: "0.1.0",
    // P5 (2026-06-13): Substrate doctrine — A-FORGE is the substrate engineering organ.
    // Profile bounded by F13; options: enterprise | agentic | sovereign | civilization.
    profile: "enterprise",
    authority_ceiling: "777_FORGE", // A-FORGE may forge; never seal nor adjudicate
    identity_hash: identityHash,
    contract_url: "/contract",
    timestamp: now,
    // Phase 2 hardening: freshness + owner summary
    freshness: {
      status: "fresh", // A-FORGE is stateless; always fresh when healthy
      checked_at_utc: now,
      source_timestamp_utc: now,
      age_seconds: 0,
      max_fresh_age_seconds: 60,
      stale_after_seconds: 300,
      expired_after_seconds: 3600,
    },
    owner_summary: {
      color: identityHash !== "UNAVAILABLE" ? "GREEN" : "YELLOW",
      reasons:
        identityHash !== "UNAVAILABLE"
          ? ["identity_present", "service_healthy"]
          : ["identity_missing"],
    },
    // Canonical 7-field health schema (federation convention).
    // A-FORGE does not adjudicate; final authority is always ARIF.
    final_authority: "ARIF",
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
 * GET /api/federation-probe
 * Pings all 9 federation organs (arifOS, arifosd, WEALTH, WELL, GEOX, A-FORGE, APEX, OpenClaw, cn-organ)
 * and returns per-organ status, latency, and overall verdict.
 *
 * Returns 200 always (verdict encoded in body). Pure read-only observation.
 * Used by cn-organ /audit, A-FORGE self-monitoring, and federation dashboards.
 */
app.get("/api/federation-probe", (_req: Request, res: Response) => {
  const TIMEOUT_MS = 3000;
  const SAMPLE_LEN = 200;

  interface OrganStatus {
    status: "up" | "down";
    http_status: number;
    latency_ms: number;
    sample: string;
  }
  const organs: Record<string, OrganStatus & { url: string }> = {
    arifOS:    { url: "http://127.0.0.1:8088/health",  status: "down", http_status: 0, latency_ms: 0, sample: "" },
    arifosd:   { url: "http://127.0.0.1:18081/health", status: "down", http_status: 0, latency_ms: 0, sample: "" },
    WEALTH:    { url: "http://127.0.0.1:18082/health", status: "down", http_status: 0, latency_ms: 0, sample: "" },
    WELL:      { url: "http://127.0.0.1:18083/health", status: "down", http_status: 0, latency_ms: 0, sample: "" },
    GEOX:      { url: "http://127.0.0.1:8081/health",  status: "down", http_status: 0, latency_ms: 0, sample: "" },
    "A-FORGE": { url: "http://127.0.0.1:7071/health",  status: "down", http_status: 0, latency_ms: 0, sample: "" },
    APEX:      { url: "http://127.0.0.1:3002/health",  status: "down", http_status: 0, latency_ms: 0, sample: "" },
    OpenClaw:  { url: "http://127.0.0.1:18789/health", status: "down", http_status: 0, latency_ms: 0, sample: "" },
    "cn-organ":{ url: "http://127.0.0.1:18795/health", status: "down", http_status: 0, latency_ms: 0, sample: "" },
  };

  const probe = (name: keyof typeof organs): Promise<void> =>
    new Promise<void>((resolve) => {
      const target = organs[name];
      const start = Date.now();
      let settled = false;
      const finish = (status: "up" | "down", code: number, body: string) => {
        if (settled) return;
        settled = true;
        target.status = status;
        target.http_status = code;
        target.latency_ms = Date.now() - start;
        target.sample = body.slice(0, SAMPLE_LEN);
        resolve();
      };
      try {
        const req = http.get(target.url, { timeout: TIMEOUT_MS }, (r) => {
          let buf = "";
          r.setEncoding("utf8");
          r.on("data", (c) => (buf += c));
          r.on("end", () => finish(r.statusCode && r.statusCode < 500 ? "up" : "down", r.statusCode ?? 0, buf));
        });
        req.on("timeout", () => { req.destroy(new Error("timeout")); });
        req.on("error", () => finish("down", 0, ""));
        req.setTimeout(TIMEOUT_MS);
      } catch {
        finish("down", 0, "");
      }
    });

  const names = Object.keys(organs) as (keyof typeof organs)[];
  Promise.all(names.map((n) => probe(n))).then(() => {
    const up = names.filter((n) => organs[n].status === "up").length;
    const total = names.length;
    const down = total - up;
    const verdict = down >= 2 ? "RED" : down === 1 ? "YELLOW" : "GREEN";
    res.json({
      ok: up === total,
      service: "A-FORGE",
      timestamp: new Date().toISOString(),
      organs,
      summary: { up, total, verdict },
    });
  });
});

/**
 * GET /sabar/cooldown
 * SABAR Cooldown Protocol vitals — machine cooling state
 */
app.get("/sabar/cooldown", (_req: Request, res: Response) => {
  const gate = getCoolingGate();
  const vitals = gate.vitals();
  res.json({
    protocol: "SABAR",
    window_hours: 72,
    vitals,
  });
});

// Extracted approval and operator surfaces into dedicated routers
// to keep server.ts focused on composition and core routes.
app.use("/human-expert", createHumanExpertRouter());
app.use("/operator", createOperatorRouter());
app.use("/vault/merkle", createVaultMerkleRouter());
// Repo steward (4 read-only endpoints: sot-validator, registry-trinity, repo-entropy, steward-suggest)
// Forged 2026-06-07 by Ω — observes only, never adjudicates.
app.use("/api/repo-steward", createRepoStewardRouter());
app.use(createGovernanceRouter());

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

let mcpTransport: StreamableHTTPServerTransport | null = null;

async function initMcpTransport(): Promise<StreamableHTTPServerTransport | null> {
  try {
    const approvalBoundary = getApprovalBoundary();
    const memoryContract = getMemoryContract();
    await approvalBoundary.initialize();
    await memoryContract.initialize();
    await telemetry.initialize();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true, // Direct JSON (not SSE) — arifOS parity. Required for OpenCode MCP client compat.
    });
    await mcpServer.connect(transport);
    console.error("[A-FORGE] MCP transport initialized — tools exposed on /mcp");
    return transport;
  } catch (err) {
    console.error("[A-FORGE] MCP init failed (non-fatal):", err);
    return null;
  }
}

export async function startServer(): Promise<void> {
  await loadConstitution();
  mcpTransport = await initMcpTransport();

  app.listen(port, "127.0.0.1", () => {
    console.error(`═══════════════════════════════════════════════════════════`);
    console.error(`  A-FORGE Bridge + MCP Server`);
    console.error(`  Listening on 127.0.0.1:${port}`);
    console.error(`  Endpoints:`);
    console.error(`    MCP  /mcp           - MCP Streamable HTTP (OpenCode/Claude) 🆕`);
    console.error(`    POST /sense          - Sense + Judge evaluation`);
    console.error(`    POST /route          - Federal Coordinator Routing`);
    console.error(`    POST /execute        - Federation MCP proxy`);
    console.error(`    POST /a2a            - A2A JSON-RPC gateway`);
    console.error(`    GET  /health         - Health check`);
    console.error(`    GET  /ready          - Readiness probe`);
    console.error(`    GET  /.well-known/agent-card.json - A2A Agent Card`);
    console.error(`    GET  /operator/approvals - List approval tickets`);
    console.error(`    GET  /operator/vault      - Search vault seals`);
    console.error(`═══════════════════════════════════════════════════════════`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void startServer();
}
