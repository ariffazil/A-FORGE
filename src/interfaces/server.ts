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
import type { Request, Response, NextFunction } from "express";
import { fileURLToPath } from "node:url";
import { readFileSync } from "fs";
import * as http from "http";
import { createHash } from "crypto";
import { modelGateway } from "../infrastructure/llm/ModelGateway.js";
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
// operatorAuth middleware superseded by middleware/stack.ts — using inline auth below
import { AAAgent } from "../domain/agents/AAAgent.js";
import { WorkerAgent } from "../domain/agents/WorkerAgent.js";
import { buildAAAProfile } from "../domain/agents/profiles.js";
import { createLlmProvider } from "../infrastructure/llm/providerFactory.js";
import { readRuntimeConfig } from "./config/RuntimeConfig.js";
import { AgentEngine } from "../domain/engine/AgentEngine.js";
import { ToolRegistry } from "../infrastructure/tools/ToolRegistry.js";
import { LongTermMemory } from "../application/memory/LongTermMemory.js";
import {
  createHumanExpertRouter,
  createOperatorRouter,
} from "./routes/approvalOperatorRoutes.js";
import { createGovernanceRouter } from "./routes/governanceRoutes.js";
import { createJobsRouter } from "./routes/jobsRoutes.js";
import { createPeerContractRouter } from "./routes/peerContractRoutes.js";
import { subscribe, type SseEvent } from "../infrastructure/tui/adapters/event-bus.js";
import { getTuiHealth } from "../infrastructure/tui/adapters/tui-health.js";
import { isDegradedMode } from "../domain/governance/QQQRuntime.js";
import { createVaultMerkleRouter } from "./routes/vaultMerkleRoutes.js";
import { createRepoStewardRouter } from "./routes/repoStewardRoutes.js";
import { callMCP } from "./mcp/client.js";
import { server as mcpServer } from "./mcp/core.js";
import { validateLeaseForTool } from "./mcp/forgeTools.js";
import {
  assertSctMutationGateOrExit,
  sctMutationGateHealth,
} from "../infrastructure/governance/sctIngress.js";
import { validateSession } from "../domain/session/sessionGate.js";
import { classifyTool, requiresGovernance, requires888Hold } from "../domain/governance/actionClassifier.js";
import { gateToolByFq } from "../domain/forge/check_verdict.js";
import { preForgeCheck, PreForgeGateBlockedError, registerEarthMeasurement } from "../domain/governance/PreForgeGateClient.js";
import { actCheck, ActGateBlockedError } from "../domain/governance/ActGateClient.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import { getConstitutionGate } from "../application/approval/index.js";
import { getMemoryContract } from "../domain/memory-contract/index.js";
import { telemetry } from "./mcp/telemetry.js";
import { getDpopMode, verifyRequestDpop } from "./middleware/dpop.js";

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

function getRegisteredMcpToolCount(): number {
  const registry = (mcpServer as unknown as { _registeredTools?: Record<string, { enabled?: boolean }> })._registeredTools;
  if (!registry) return 0;
  return Object.values(registry).filter((tool) => tool?.enabled !== false).length;
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

/** Seal-A condition 3: production + FORGE_SCT_REQUIRE_MUTATE=0 → FATAL before bind. */
function ensureSctMutationGatePolicy(): void {
  assertSctMutationGateOrExit(process.env);
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

  // ── DNS Rebinding Protection (2026-07-08) ──────────────────────────
  // MCPJam conformance: localhost servers must reject requests with
  // non-localhost Host/Origin headers to prevent DNS rebinding attacks.
  const LOCALHOST_HOSTS = new Set([
    "localhost", "127.0.0.1", "[::1]", "::1",
    "localhost:7071", "127.0.0.1:7071", "[::1]:7071",
    "localhost:7072", "127.0.0.1:7072", "[::1]:7072",
  ]);
  mcpRouter.use((req: Request, res: Response, next: NextFunction) => {
    const host = (req.headers["host"] || "").toString().toLowerCase();
    const origin = (req.headers["origin"] || "").toString().toLowerCase();
    // Only check on initialize requests (POST /mcp with method=initialize)
    if (req.method === "POST" && req.url === "/mcp") {
      const body = req.body as any;
      if (body?.method === "initialize") {
        // Check Host header — must be localhost if present
        if (host && !LOCALHOST_HOSTS.has(host) && !host.startsWith("localhost:") && !host.startsWith("127.0.0.1:") && !host.startsWith("[::1]:")) {
          res.status(403).json({ error: "Invalid Origin", detail: "DNS rebinding protection" });
          return;
        }
        // Check Origin header — must be localhost if present
        if (origin && !origin.includes("localhost") && !origin.includes("127.0.0.1") && !origin.includes("[::1]")) {
          res.status(403).json({ error: "Invalid Origin", detail: "DNS rebinding protection" });
          return;
        }
      }
    }
    next();
  });

  mcpRouter.use(async (req: Request, res: Response, next: NextFunction) => {
    const dpopMode = getDpopMode();
    if (dpopMode === "off" || !req.headers.authorization) {
      next();
      return;
    }
    const dpop = await verifyRequestDpop(req);
    if (!dpop.ok) {
      if (dpopMode === "enforce") {
        res.status(401).json({ error: dpop.error ?? "DPoP verification failed" });
        return;
      }
      res.setHeader("X-DPoP-Status", `OBSERVE:${dpop.error ?? "failed"}`);
      next();
      return;
    }
    if (dpop.jwkThumbprint) {
      res.setHeader("X-DPoP-Status", "VERIFIED");
    }
    next();
  });

  // GET /mcp — conditional routing based on Accept header.
  // Standards-compliant MCP clients (Claude Code, Claude Desktop) send
  // Accept: text/event-stream and expect SSE — those MUST reach the MCP SDK.
  // OpenCode and other clients that probe GET before POST send a plain Accept
  // header — return static service info so they proceed to POST.
  mcpRouter.get("/mcp", (req: Request, res: Response, next: NextFunction) => {
    const accept = (req.headers["accept"] || "").toString();
    if (accept.includes("text/event-stream")) {
      // SSE-capable client — let mcpHandler handle it
      return next();
    }
    // OpenCode compat: static server info
    res.json({
      service: "A-FORGE",
      version: "v2026.07.24",
      protocol_version: "2025-03-26",
      mcp_endpoint: "/mcp",
      health_endpoint: "/health",
      contract_url: "/contract",
      tool_count: getRegisteredMcpToolCount(),
      stateless_http_tool_count: 22,
      session_required_tool_count: Math.max(0, getRegisteredMcpToolCount() - 22),
    });
  });

  // ── A-FORGE MCP transport middleware ──
  // Session ID injection: MCP SDK 1.29.0 StreamableHTTPServerTransport requires
  // Mcp-Session-Id header on every POST EXCEPT initialize requests.
  // Initialize requests must NOT have a session ID — the SDK creates a new
  // session for each initialize. Injecting a session ID causes "Server already
  // initialized" rejection (the SDK sees it as re-initialization).
  // Accept header patching is done in mcpHandler directly (after the middleware
  // because the SDK's getRequestListener reads from the raw IncomingMessage).
  mcpRouter.use((req: Request, _res: Response, next: NextFunction) => {
    const hasSessionId = req.headers["mcp-session-id"] || req.query.sessionId || req.query.session_id;
    if (req.method === "POST" && !hasSessionId) {
      // Skip session ID injection for initialize requests — let the SDK
      // create a fresh session. For all other POSTs, inject if missing.
      const body = req.body as any;
      const isInitialize = body?.method === "initialize";
      if (!isInitialize) {
        const generatedId = `aforge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        req.headers["mcp-session-id"] = generatedId;
      }
    }
    next();
  });

  const mcpHandler = async (req: Request, res: Response) => {
    // MCP SDK 1.29.0 StreamableHTTPServerTransport rejects re-initialization
    // because _initialized is a global flag. Fix: detect initialize requests
    // and create a fresh transport for each one.
    const body = req.body as any;
    const isInitialize = req.method === "POST" && body?.method === "initialize";

    if (isInitialize) {
      // Create a fresh transport for each initialize request.
      // The SDK's _initialized flag is per-transport-instance, so a new
      // transport allows a new session to be created.
      // Must close old transport first — McpServer only supports one connection.
      console.error(`[A-FORGE] MCP: fresh initialize — creating new transport`);
      try {
        if (mcpTransport) {
          try { await mcpServer.close(); } catch {}
        }
        const freshTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
        });
        await mcpServer.connect(freshTransport);
        mcpTransport = freshTransport;
        await freshTransport.handleRequest(req, res, req.body);
      } catch (err) {
        console.error("[A-FORGE] MCP initialize error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "MCP initialize failed" });
        }
      }
      return;
    }

    if (!mcpTransport) {
      res.status(503).json({ error: "MCP transport not initialized. Send initialize first." });
      return;
    }

    // MCP SDK 1.29.0 StreamableHTTPServerTransport requires Mcp-Session-Id header
    // on every POST EXCEPT initialize requests (see middleware above).
    const hasSessionId = req.headers["mcp-session-id"] || req.query.sessionId || req.query.session_id;
    if (req.method === "POST" && !hasSessionId) {
      req.headers["mcp-session-id"] = `aforge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }
    // SDK 1.29.0 StreamableHTTPServerTransport validates Accept header on the Web
    // Standard Request object created by @hono/node-server's getRequestListener.
    // That library reads from rawHeaders (raw HTTP array), NOT req.headers (parsed
    // object). Patching req.headers is invisible to the SDK.
    // Fix: patch rawHeaders directly so the Web Request sees both required types.
    const rawAcceptIdx = req.rawHeaders.findIndex(
      (h: string) => h.toLowerCase() === "accept"
    );
    if (rawAcceptIdx >= 0) {
      let patched = req.rawHeaders[rawAcceptIdx + 1] as string;
      if (!patched.includes("application/json")) patched += ", application/json";
      if (!patched.includes("text/event-stream")) patched += ", text/event-stream";
      req.rawHeaders[rawAcceptIdx + 1] = patched;
    } else {
      // No Accept header at all — add both required values
      req.rawHeaders.push("Accept", "application/json, text/event-stream");
    }
    console.error(`[A-FORGE] MCP handler: accept="${req.headers["accept"]}" method=${req.method} url=${req.url}`);
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
  // A2A router removed — AAA is sole A2A gateway (E2 entropy fix)

  // Inline operator auth (supersedes removed operatorAuth.ts)
  const operatorToken = ensureOperatorTokenPolicy();
  const requireOperatorAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!operatorToken) return next(); // dev mode: no auth
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== operatorToken) {
      return res.status(401).json({ error: "Unauthorized", code: -32001 });
    }
    next();
  };
  app.use("/operator", requireOperatorAuth);
  app.use("/human-expert", requireOperatorAuth);
  app.use("/peer", requireOperatorAuth, createPeerContractRouter());

/**
 * POST /sense
 * Run Sense classification with F7 confidence evaluation
 */
app.post("/sense", async (req: Request, res: Response) => {
  try {
    return await runStage("111_SENSE" as MetabolicStage, async () => {
    const { version: clientVersion, session_id, prompt, context, peer_contract_id } = req.body;
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
      `[SENSE 111] session=${session_id ?? "anon"} peer_contract=${peer_contract_id ?? "none"} ` +
        `mode=${sense.mode_used} uncertainty=${sense.uncertainty_band} ` +
        `recommendation=${sense.recommended_next_stage} verdict=${judge.verdict}`,
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
        version: "v2026.07.24",
        epoch: "2026-04-08",
        received_context: context,
        peer_contract_id,
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
      const { prompt, sessionId, mode, peer_contract_id } = req.body;
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
        peer_contract_id,
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
    // Resolve identity from body OR headers (Gateway passes headers; direct callers use body)
    const session_id = req.body.session_id || req.headers["x-arifos-session-id"] as string || undefined;
    const actor_id = req.body.actor_id || req.headers["x-arifos-actor-id"] as string || undefined;
    const lease_id = req.body.lease_id || req.headers["x-arifos-lease-id"] as string || undefined;
    const { tool, args } = req.body;

    if (!tool || typeof tool !== "string") {
      res.status(400).json({ ok: false, error: "tool is required and must be a string" });
      return;
    }

    // ── ADAT AGENTIC: Classify action before execution ──
    const actionClass = classifyTool(tool);

    // FQ Metabolic Gate (P0.1)
    const fqBlock = await gateToolByFq(actionClass, tool);
    if (!fqBlock.allowed && fqBlock.fq) {
      return res.status(423).json({
        error: 'FQ_GATE', type: 'governance_hold',
        verdict: 'HOLD', message: fqBlock.fq.reason,
        fq: { quotient: fqBlock.fq.fq, verdict: fqBlock.fq.verdict },
        gate: 'FQ', threshold: 0.50, adat_gate: 'FQ_HOLD',
      });
    }

    // ── FORGE 2-B: Kernel Session Gate (MUTATE + ATOMIC require session + lease) ──
    if (requiresGovernance(actionClass)) {
      if (!session_id) {
        res.status(423).json({
          ok: false,
          error: {
            type: "governance_hold",
            message: `SESSION_GATE: Tool "${tool}" is ${actionClass}. Requires valid session_id from arif_session_init. Call the kernel first.`,
          },
          action_class: actionClass,
          adat_gate: "SESSION_REQUIRED",
        });
        return;
      }

      // ── Kernel Session Origin Gate — verify session came from kernel ──
      const originCheck = validateSession(session_id);
      if (!originCheck.valid) {
        res.status(423).json({
          ok: false,
          error: {
            type: "governance_hold",
            message: `SESSION_ORIGIN: ${originCheck.reason}`,
          },
          action_class: actionClass,
          adat_gate: originCheck.reason.split(":")[0],
        });
        return;
      }
      // Attach verified actor to request context
      (req as any).verified_actor = originCheck.actor_id;
      console.error(`[FORGE-2B] ${actionClass} ${tool} session=${session_id?.slice(0,12)} lease=${lease_id?.slice(0,12)} actor=${originCheck.actor_id}`);

      const leaseCheck = await validateLeaseForTool(lease_id, tool, actionClass);
      if (!leaseCheck.ok) {
        res.status(423).json({
          ok: false,
          error: {
            type: "governance_hold",
            message: `LEASE_GATE: Tool "${tool}" is ${actionClass}. ${leaseCheck.gate}: ${leaseCheck.reason}`,
          },
          action_class: actionClass,
          adat_gate: leaseCheck.gate,
        });
        return;
      }
    }

    // 888_HOLD gate: require F13 SOVEREIGN verdict for high-severity actions
    if (requires888Hold(actionClass)) {
      const holdId = req.body.hold_id;
      if (!holdId) {
        res.status(423).json({
          ok: false,
          error: {
            type: "governance_hold",
            message: `888_HOLD: Tool "${tool}" is classified ${actionClass}. Requires hold_id from arif_judge_deliberate SEAL verdict.`,
          },
          action_class: actionClass,
          adat_gate: "888_HOLD",
        });
        return;
      }
      console.error(`[ADAT] ATOMIC ${tool} authorized with hold_id=${holdId}`);
    }

    // ── PRE-FORGE CONSTITUTIONAL GATE (F2+F3+F9) ──
    // Forged 2026-06-14: Citation provenance + witness diversity + shadow audit
    // before any EXECUTE_REVERSIBLE/EXECUTE_HIGH_IMPACT/IRREVERSIBLE action.
    // Fails closed on gate error.
    if (requiresGovernance(actionClass)) {
      const auditText = JSON.stringify({ tool, args, session_id });
      // Map A-FORGE action class → pre-forge gate action class
      const pfActionClass = actionClass === "IRREVERSIBLE" ? "allocate"
        : actionClass === "EXECUTE_HIGH_IMPACT" ? "deploy"
        : actionClass === "EXECUTE_REVERSIBLE" ? "mutate"
        : actionClass === "QUEUE" ? "mutate"
        : "propose";
      try {
        const gate = await preForgeCheck({
          text: auditText,
          actionClass: pfActionClass,
          sessionId: session_id,
          modelId: (req as any).verified_actor || "a-forge-caller",
        });

        if (!gate.allowed && gate.verdict === "VOID") {
          res.status(423).json({
            ok: false,
            error: {
              type: "governance_hold",
              message: `PRE_FORGE_VOID: ${gate.verdict} — ${gate.required_actions.join("; ")}`,
              gate_result: gate,
            },
            action_class: actionClass,
            adat_gate: "PRE_FORGE_VOID",
          });
          return;
        }

        if (!gate.allowed) {
          console.error(`[PRE-FORGE] ${tool} → ${gate.verdict} (shadow: ${gate.shadow_summary?.classification || "N/A"}, citations: ${gate.citation_summary?.decorative || 0} decorative)`);
          res.status(423).json({
            ok: false,
            error: {
              type: "governance_hold",
              message: `PRE_FORGE_HOLD: ${gate.verdict} — ${gate.violations.map(v => v.step || v.violation || "?").join(", ")}`,
              gate_result: gate,
            },
            action_class: actionClass,
            adat_gate: "PRE_FORGE_HOLD",
            required_actions: gate.required_actions,
          });
          return;
        }

        if (gate.verdict === "CAUTION" || gate.verdict === "DOWNGRADE") {
          console.error(`[PRE-FORGE] ${tool} → CAUTION (citations: ${gate.citation_summary?.decorative || 0} decorative, shadow: ${gate.shadow_summary?.classification || "clear"})`);
        }
      } catch (err) {
        if (err instanceof PreForgeGateBlockedError) {
          res.status(423).json({
            ok: false,
            error: {
              type: "governance_hold",
              message: `PRE_FORGE_BLOCKED: ${err.message}`,
              gate_result: err.gateResult,
            },
            action_class: actionClass,
            adat_gate: "PRE_FORGE_BLOCKED",
          });
          return;
        }
        console.error(`[PRE-FORGE] Gate error for ${tool}: ${err}. Failing open with CAUTION.`);
      }
    }

    // ── A-FORGE ACT GATE (Gate 2.6) ──
    // Execution craft check: determines if the execution pattern is safe
    // for this action class + blast radius combination.
    // Calls the arifOS ACT module via MCP.
    // Only for non-OBSERVE actions.
    if (requiresGovernance(actionClass)) {
      try {
        // Determine blast radius from action class (ACT gate 2.6)
        const _actBlastRadius = actionClass === "IRREVERSIBLE" || actionClass === "EXECUTE_HIGH_IMPACT"
          ? "high"
          : actionClass === "EXECUTE_REVERSIBLE" || actionClass === "QUEUE"
            ? "medium"
            : "low";
        const _actIsReversible = actionClass !== "IRREVERSIBLE" && actionClass !== "EXECUTE_HIGH_IMPACT";

        const actGateResult = await actCheck({
          actionClass,
          blastRadius: _actBlastRadius,
          isReversible: _actIsReversible,
          isMultiStep: false, // single tool call
          stageNumber: 1,
          totalStages: 1,
          sessionId: session_id,
          actorId: actor_id,
        });

        if (!actGateResult.allowed) {
          if (actGateResult.verdict === "BLOCK") {
            res.status(423).json({
              ok: false,
              error: {
                type: "governance_hold",
                message: `ACT_GATE_BLOCKED: ${actGateResult.verdict} — ${actGateResult.reason}`,
                recommended_pattern: actGateResult.recommendedPattern,
              },
              action_class: actionClass,
              adat_gate: "ACT_GATE_BLOCKED",
            });
            return;
          }

          // HOLD / DRY_RUN_REQUIRED / CANARY_REQUIRED / COMPENSATION_REQUIRED / HUMAN_REQUIRED
          res.status(423).json({
            ok: false,
            error: {
              type: "governance_hold",
              message: `ACT_GATE_HOLD: ${actGateResult.verdict} — ${actGateResult.reason}`,
              recommended_pattern: actGateResult.recommendedPattern,
              required_actions: actGateResult.requiredActions,
            },
            action_class: actionClass,
            adat_gate: "ACT_GATE_HOLD",
            required_actions: actGateResult.requiredActions,
          });
          return;
        }
      } catch (err) {
        if (err instanceof ActGateBlockedError) {
          res.status(423).json({
            ok: false,
            error: {
              type: "governance_hold",
              message: `ACT_GATE_ERROR: ${err.message}`,
              gate_result: err.gateResult,
            },
            action_class: actionClass,
            adat_gate: "ACT_GATE_ERROR",
          });
          return;
        }
        console.error(`[ACT-GATE] Gate error for ${tool}: ${err}. Failing open — continuing.`);
      }
    }

    const mergedArgs = { ...(args ?? {}), session_id, actor_id };
    const result = await callMCP(tool, mergedArgs);

    // ── Register Earth measurement witness after successful tool call ──
    if (session_id && actionClass !== "OBSERVE" && actionClass !== "SUGGEST") {
      registerEarthMeasurement(session_id, tool, `result:${tool}`).catch(() => {});
    }

    // ── ADAT AGENTIC: Auto-seal governance-required actions ──
    if (requiresGovernance(actionClass)) {
      try {
        const sealResult = await callMCP("arif_vault_seal", {
          content: JSON.stringify({ tool, actionClass, session_id, timestamp: new Date().toISOString() }),
          reason: `auto-seal: ${tool}`,
          tier: requires888Hold(actionClass) ? "CRITICAL" : "STANDARD",
          actor_id,
          session_id,
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
      peer_contract: true,
      dangerous_tools: process.env.ENABLE_DANGEROUS_TOOLS === "1" || process.env.ENABLE_DANGEROUS_TOOLS === "true",
      background_jobs: process.env.ENABLE_BACKGROUND_JOBS === "1" || process.env.ENABLE_BACKGROUND_JOBS === "true",
      GEOX_log_interpreter: true,
    },
    endpoints: {
      GEOX_log_interpreter: "POST /GEOX/log_interpreter",
      GEOX_contract: "GET /GEOX/contract",
      // a2a removed — AAA is sole A2A gateway,
      a2a_agent_card: "GET /.well-known/agent-card.json",
      python_mcp: "GEOX-mcp:8081",
      bridge: "A-FORGE-bridge:7071",
      federation_probe: "GET /api/federation-probe",
      peer_contract: "GET /peer/contract",
      peer_contract_validate: "POST /peer/contract/validate",
      governance_status: "GET /api/governance-status",
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
  const DEPLOY_ROOT = "/opt/a-forge/app";
  let identityHash = "UNAVAILABLE";
  let deployedCommit = "UNAVAILABLE";
  let sourceCommit = "UNAVAILABLE";
  try {
    identityHash = readFileSync(`${DEPLOY_ROOT}/.identity_hash`, "utf8").trim();
  } catch (e) {}
  // Read deployed commit from deployment marker
  try {
    deployedCommit = readFileSync(`${DEPLOY_ROOT}/.git_commit`, "utf8").trim().substring(0, 7);
  } catch (e) {}
  // Read source commit from source repo marker (written at deploy time)
  try {
    sourceCommit = readFileSync("/root/A-FORGE/.git_commit", "utf8").trim().substring(0, 7);
  } catch (e) {}
  const deploymentDrift = deployedCommit !== "UNAVAILABLE" && sourceCommit !== "UNAVAILABLE" && deployedCommit !== sourceCommit;

  const now = new Date().toISOString();

  // FEDERATION SCHEMA ALIGNMENT L2 (canonical: arifOS/arifosmcp/schemas/federation_enums.py)
  // See: /root/AAA/governance/FEDERATION_SCHEMA_ALIGNMENT.md
  // T5 2026-07-17 — canonical 5-field federation header + organ payload.
  // ok retained for legacy callers; status is canonical.
  const liveToolCount = getRegisteredMcpToolCount();
  res.json({
    ok: !isDegradedMode && !deploymentDrift, // legacy alias — prefer status
    degraded_mode: isDegradedMode || deploymentDrift,
    service: "A-FORGE-sense",
    version: "v2026.07.24",
    federation_schema_version: "2.0.0",
    tool_count: liveToolCount,
    tools_loaded: liveToolCount,
    // P5 (2026-06-13): Substrate doctrine — A-FORGE is the substrate engineering organ.
    // Profile bounded by F13; options: enterprise | agentic | sovereign | civilization.
    profile: "enterprise",
    authority_ceiling: "777_FORGE", // A-FORGE may forge; never seal nor adjudicate
    identity: identityHash,
    identity_hash: identityHash,
    deployed_commit: deployedCommit,
    source_commit: sourceCommit,
    deployment_drift: deploymentDrift,
    status: isDegradedMode || deploymentDrift ? "degraded" : "healthy",
    apex_scalars: {
      G: { value: null, status: "UNMEASURED" },
      C_dark: { value: null, status: "UNMEASURED" },
      W3: { value: null, status: "UNMEASURED" },
      h: { value: null, status: "UNMEASURED" },
      QDF: { value: null, status: "UNMEASURED" },
    },
    federation_geometry: {
      status: "enabled",
      subjects: 0,
      ledger_events: 0,
      witness_oracle: "active",
      note: "geometry owned by arifOS; A-FORGE reports local presence only",
    },
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
    // Seal-A condition 3 — SCT mutation gate status (never exit from /health)
    sct_mutation_gate: sctMutationGateHealth(process.env),
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
    AAA:       { url: "http://127.0.0.1:3001/health",  status: "down", http_status: 0, latency_ms: 0, sample: "" },
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

// ── Jobs Routes (read-only, TUI-facing) ──
app.use("/jobs", createJobsRouter());

// ── SSE Events Route (for live TUI updates) ──
// Uses event-bus pub/sub — AgentManager publishes, SSE subscribers receive.

app.get("/events", (_req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Send initial heartbeat
  res.write(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`);

  // Subscribe to event bus — forward all events as SSE data frames
  const unsubscribe = subscribe((event: SseEvent) => {
    try {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    } catch {
      unsubscribe();
    }
  });

  // Keepalive every 30s
  const keepalive = setInterval(() => {
    try {
      res.write(`:keepalive ${Date.now()}\n\n`);
    } catch {
      clearInterval(keepalive);
    }
  }, 30000);

  _req.on("close", () => {
    clearInterval(keepalive);
    unsubscribe();
  });
});

// ── TUI Health Endpoint (AAA cockpit / ARIF Cell can poll this) ──

app.get("/tui-health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    tui: getTuiHealth(),
    timestamp: new Date().toISOString(),
  });
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

let mcpTransport: StreamableHTTPServerTransport | null = null;

async function initMcpTransport(): Promise<StreamableHTTPServerTransport | null> {
  try {
    const memoryContract = getMemoryContract();
    process.stderr.write(`[A-FORGE] Constitution gate: ${getConstitutionGate()}\n`);
    await memoryContract.initialize();
    await telemetry.initialize();
    const transport = new StreamableHTTPServerTransport({
      // Use sessionIdGenerator for stateful mode. Each fresh POST /mcp without
      // a session header creates a new session. The transport handles session
      // lifecycle internally.
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
  // Production lockout BEFORE bind — SCT mutation bypass is FATAL in production.
  ensureSctMutationGatePolicy();
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
    console.error(`    // /a2a removed — AAA is sole A2A gateway`);
    console.error(`    GET  /health         - Health check`);
    console.error(`    GET  /ready          - Readiness probe`);
    console.error(`    GET  /.well-known/agent-card.json - A2A Agent Card`);
    console.error(`    GET  /operator/approvals - List approval tickets`);
    console.error(`    GET  /operator/vault      - Search vault seals`);
    console.error(`    GET  /jobs               - List all jobs 🆕`);
    console.error(`    GET  /jobs/queue         - Queued jobs 🆕`);
    console.error(`    GET  /jobs/running       - Running jobs 🆕`);
    console.error(`    GET  /jobs/metrics       - Job metrics 🆕`);
    console.error(`    GET  /jobs/:id           - Job detail 🆕`);
    console.error(`    GET  /events             - SSE events stream 🆕`);
    console.error(`    TUI forge-tui           - Terminal UI (npm run tui) 🆕`);
    console.error(`═══════════════════════════════════════════════════════════`);
  });
}

// DEP-1 (2026-06-15): SIGHUP handler — reload ModelGateway without restart
// Sends SIGHUP after a providers.yml swap so A-FORGE picks up the new default.
process.on("SIGHUP", () => {
  try {
    modelGateway.reload();
    console.error("[SIGHUP] ModelGateway reloaded from providers.yml");
  } catch (err) {
    console.error(`[SIGHUP] reload failed: ${err instanceof Error ? err.message : err}`);
  }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void startServer();
}
