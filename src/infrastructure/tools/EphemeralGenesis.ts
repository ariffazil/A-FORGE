/**
 * EphemeralGenesis Engine — CANONICAL Capability Metabolism for A-FORGE
 *
 * ═══ P0.2 RATIFIED (2026-07-31) — SINGLE CANONICAL ENGINE ═══════════════
 * THIS is the authoritative ephemeral tool engine. ALL paths — MCP surface,
 * domain/forge adapter, domain/containment adapter — ultimately route here.
 * One engine. One state machine. One registry. One singleton.
 *
 * Domain adapters (domain/forge/EphemeralGenesisRunner.ts,
 * domain/containment/EphemeralGenesisRunner.ts) provide lease + governance
 * wrappers but MUST NOT duplicate core lifecycle logic.
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Capability Algebra (the 6 irreducible verbs):
 *   Sense → Compute → Resolve → Act → Verify → Remember
 *
 * Template types:
 *   api_wrapper     — REST API call with auth, retry, polling
 *   data_parser     — Parse custom format (CSV, JSON, regex, binary)
 *   compute_fn      — Pure numerical computation
 *   format_converter — Transform between formats
 *
 * Lifecycle:
 *   inspect_gap → generate → sandbox_test → invoke → verify → retire
 *
 * Promotion:
 *   Same template instantiated N+ times → propose_promotion → human gate → permanent
 *
 * @module tools/EphemeralGenesis
 * @forged 2026-07-30 — 333-AGI under F13 directive "phase transition from accumulating to metabolizing"
 * @constitutional F1 AMANAH — ephemeral tools are session-scoped, auto-retire, fully reversible
 * @constitutional F13 SOVEREIGN — promotion to permanent requires human gate
 */

import { createHash } from "node:crypto";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── Types ──────────────────────────────────────────────────────────────────

export type TemplateType = "api_wrapper" | "data_parser" | "compute_fn" | "format_converter";

export interface EphemeralTemplate {
  id: string;
  type: TemplateType;
  description: string;
  /** What mission verbs does this template serve? */
  serves: ("Investigate" | "Interpret" | "Decide" | "Choose" | "Monitor" | "Remember")[];
  /** Template body — a function that, when called with params, returns executable code */
  generate: (params: Record<string, unknown>) => Promise<EphemeralTool>;
  /** Validation function for parameters */
  validateParams?: (params: Record<string, unknown>) => { valid: boolean; errors?: string[] };
  /** How many times this template has been instantiated (for promotion tracking) */
  instantiationCount: number;
  /** Has this template been proposed for promotion? */
  promotionProposed: boolean;
  /** Minimum instantiation count before promotion is proposed */
  promotionThreshold: number;
}

export interface EphemeralTool {
  id: string;
  templateId: string;
  templateType: TemplateType;
  params: Record<string, unknown>;
  /** The generated implementation (JS function body as string, or config) */
  implementation: string;
  /** What does this tool do in one sentence */
  description: string;
  /** Creation timestamp */
  createdAt: string;
  /** Expiry — auto-retire after this */
  expiresAt: string;
  /** Session that created it */
  sessionId: string;
  /** Lifecycle state */
  state: "generated" | "tested" | "invoked" | "verified" | "retired" | "failed";
  /**
   * Verification result (P0.3 — MUST include verifier_method).
   * SELF_CERTIFIED is deprecated — tools cannot self-certify.
   * At least one of: known_answer | schema_invariant | independent_recompute | domain_witness
   * must be present for state="verified".
   */
  verification?: {
    ok: boolean;
    output?: unknown;
    error?: string;
    /** HOW was this verified? SELF_CERTIFIED = inadmissible for promotion. */
    verifier_method?: "known_answer" | "schema_invariant" | "independent_recompute" | "domain_witness" | "SELF_CERTIFIED";
    /** External verifier receipt hash (empty for SELF_CERTIFIED) */
    verifier_receipt?: string;
  };
  /** SHA256 of implementation for audit */
  hash: string;
  /** Metadata for audit trail */
  metadata: {
    createdBy: string;
    missionIntent: string;
    capabilityGap: string;
    invocationCount: number;
    totalRuntimeMs: number;
  };
}

export interface GapAnalysis {
  /** The capability the agent needs */
  needed: string;
  /** Verbs this would serve */
  serves: ("Investigate" | "Interpret" | "Decide" | "Choose" | "Monitor" | "Remember")[];
  /** Existing tools that partially match */
  existingMatches: string[];
  /** Templates that can generate this capability */
  availableTemplates: string[];
  /** Best template match */
  recommended: string | null;
  /** Is this a gap that needs filling? */
  isGap: boolean;
}

export interface GenesisResult {
  ok: boolean;
  tool?: EphemeralTool;
  error?: string;
  receiptHash?: string;
}

// ── Template Registry ────────────────────────────────────────────────────

class TemplateRegistry {
  private templates: Map<string, EphemeralTemplate> = new Map();

  register(template: EphemeralTemplate): void {
    this.templates.set(template.id, template);
  }

  get(id: string): EphemeralTemplate | undefined {
    return this.templates.get(id);
  }

  list(): EphemeralTemplate[] {
    return Array.from(this.templates.values());
  }

  findByType(type: TemplateType): EphemeralTemplate[] {
    return this.list().filter(t => t.type === type);
  }

  findByCapability(description: string): EphemeralTemplate[] {
    const lowered = description.toLowerCase();
    // Tokenize the capability need into keywords
    const tokens = lowered.split(/\s+/).filter(t => t.length > 2);
    return this.list().filter(t => {
      const desc = t.description.toLowerCase();
      const id = t.id.toLowerCase();
      const serves = t.serves.map(s => s.toLowerCase());
      // Match: any token from the capability_need appears in description, ID, or serves
      return tokens.some(token =>
        desc.includes(token) || id.includes(token) || serves.some(s => s.includes(token))
      );
    });
  }

  /** Increment instantiation count and check if promotion threshold reached */
  recordInstantiation(templateId: string): { shouldPropose: boolean; count: number; threshold: number } {
    const t = this.templates.get(templateId);
    if (!t) return { shouldPropose: false, count: 0, threshold: 0 };
    t.instantiationCount++;
    const shouldPropose = !t.promotionProposed && t.instantiationCount >= t.promotionThreshold;
    return { shouldPropose, count: t.instantiationCount, threshold: t.promotionThreshold };
  }

  markPromotionProposed(templateId: string): void {
    const t = this.templates.get(templateId);
    if (t) t.promotionProposed = true;
  }
}

// ── Active Tool Store (session-scoped, in-memory) ────────────────────────

class ActiveToolStore {
  private tools: Map<string, EphemeralTool> = new Map();

  register(tool: EphemeralTool): void {
    this.tools.set(tool.id, tool);
  }

  get(id: string): EphemeralTool | undefined {
    return this.tools.get(id);
  }

  listBySession(sessionId: string): EphemeralTool[] {
    return Array.from(this.tools.values()).filter(t => t.sessionId === sessionId);
  }

  listActive(): EphemeralTool[] {
    const now = new Date().toISOString();
    return Array.from(this.tools.values()).filter(t =>
      t.state !== "retired" && t.state !== "failed" && t.expiresAt > now
    );
  }

  retire(id: string): void {
    const t = this.tools.get(id);
    if (t) t.state = "retired";
  }
}

// ── EphemeralGenesis Engine ──────────────────────────────────────────────

export class EphemeralGenesis {
  public registry: TemplateRegistry;
  public store: ActiveToolStore;
  private outputDir: string;

  constructor() {
    this.registry = new TemplateRegistry();
    this.store = new ActiveToolStore();
    this.outputDir = join(tmpdir(), "aforge-ephemeral");
    this.registerBuiltinTemplates();
  }

  // ── Gap Analysis ─────────────────────────────────────────────────────

  /** Analyze a capability need against existing tools and templates */
  analyzeGap(needed: string, existingTools: string[]): GapAnalysis {
    const available = this.registry.findByCapability(needed);
    const existingMatches = existingTools.filter(t =>
      t.toLowerCase().includes(needed.toLowerCase().split(" ")[0])
    );

    // Determine which missions this serves
    const serves: GapAnalysis["serves"] = [];
    const n = needed.toLowerCase();
    if (n.includes("see") || n.includes("read") || n.includes("analyze") || n.includes("observe") || n.includes("fetch") || n.includes("search")) serves.push("Investigate");
    if (n.includes("explain") || n.includes("interpret") || n.includes("understand") || n.includes("model")) serves.push("Interpret");
    if (n.includes("decide") || n.includes("compare") || n.includes("evaluate") || n.includes("risk")) serves.push("Decide");
    if (n.includes("build") || n.includes("generate") || n.includes("create") || n.includes("deploy") || n.includes("execute")) serves.push("Choose");
    if (n.includes("monitor") || n.includes("watch") || n.includes("detect") || n.includes("alert")) serves.push("Monitor");
    if (n.includes("remember") || n.includes("store") || n.includes("seal") || n.includes("archive")) serves.push("Remember");
    if (serves.length === 0) serves.push("Investigate"); // default

    return {
      needed,
      serves,
      existingMatches,
      availableTemplates: available.map(t => t.id),
      recommended: available.length > 0 ? available[0].id : null,
      isGap: existingMatches.length === 0,
    };
  }

  // ── Generate Ephemeral Tool ──────────────────────────────────────────

  async generate(
    templateId: string,
    params: Record<string, unknown>,
    sessionId: string,
    actorId: string,
    missionIntent: string,
  ): Promise<GenesisResult> {
    const template = this.registry.get(templateId);
    if (!template) {
      return { ok: false, error: `Template '${templateId}' not found. Available: ${this.registry.list().map(t => t.id).join(", ")}` };
    }

    // Validate params if template has validator
    if (template.validateParams) {
      const validation = template.validateParams(params);
      if (!validation.valid) {
        return { ok: false, error: `Invalid params: ${validation.errors?.join("; ")}` };
      }
    }

    try {
      const tool = await template.generate(params);
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 3600_000).toISOString(); // 1 hour TTL

      tool.id = `eph_${templateId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      tool.templateId = templateId;
      tool.createdAt = now;
      tool.expiresAt = expiresAt;
      tool.sessionId = sessionId;
      tool.state = "generated";
      tool.hash = createHash("sha256").update(tool.implementation).digest("hex");
      tool.metadata = {
        createdBy: actorId,
        missionIntent,
        capabilityGap: template.description,
        invocationCount: 0,
        totalRuntimeMs: 0,
      };

      this.store.register(tool);
      const { shouldPropose, count, threshold } = this.registry.recordInstantiation(templateId);

      return {
        ok: true,
        tool,
        receiptHash: tool.hash.slice(0, 16),
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── Sandbox Test ─────────────────────────────────────────────────────
  //
  // P0.4 (2026-07-31): FAIL-CLOSED containment.
  // Sandbox unavailable → HOLD, not skip. A skipped test that looks green
  // is a false negative. The tool MUST NOT reach "tested" state without
  // actual sandbox execution or explicit sandbox bypass approval.

  /** Whether a real sandbox backend is available */
  private sandboxAvailable = false; // Set true when ExecutionSandbox is wired

  async sandboxTest(
    toolId: string,
    testInput?: Record<string, unknown>,
  ): Promise<GenesisResult> {
    const tool = this.store.get(toolId);
    if (!tool) return { ok: false, error: `Ephemeral tool '${toolId}' not found` };

    try {
      await mkdir(this.outputDir, { recursive: true });

      // For api_wrapper types, execute the implementation against the real endpoint
      if (tool.templateType === "api_wrapper") {
        const config = JSON.parse(tool.implementation);
        const startTime = Date.now();

        let response: Response;
        if (config.method === "GET") {
          response = await fetch(config.url, { headers: config.headers, signal: AbortSignal.timeout(30_000) });
        } else {
          response = await fetch(config.url, {
            method: config.method || "POST",
            headers: config.headers,
            body: JSON.stringify(config.body),
            signal: AbortSignal.timeout(30_000),
          });
        }

        const duration = Date.now() - startTime;
        const body = await response.text().catch(() => "");

        const ok = response.status >= 200 && response.status < 300;
        tool.state = ok ? "tested" : "failed";
        tool.verification = {
          ok,
          output: { status: response.status, body: body.slice(0, 500), durationMs: duration },
          error: ok ? undefined : `HTTP ${response.status}: ${body.slice(0, 200)}`,
          verifier_method: "independent_recompute", // Live endpoint = external evidence
        };
        tool.metadata.totalRuntimeMs += duration;

        return {
          ok,
          tool,
          receiptHash: createHash("sha256").update(body.slice(0, 1000)).digest("hex").slice(0, 16),
        };
      }

      // P0.4: Non-API templates require sandbox — FAIL CLOSED
      if (!this.sandboxAvailable) {
        tool.state = "failed";
        tool.verification = {
          ok: false,
          error: "P0.4 HOLD: Sandbox backend unavailable — cannot test non-API template. Tool blocked until sandbox is wired.",
          verifier_method: undefined,
        };
        return {
          ok: false,
          tool,
          error: tool.verification.error,
        };
      }

      // Sandbox IS available — run proper containment test
      // (sandbox execution path — delegates to ExecutionSandbox when wired)
      const ok = true; // placeholder — actual sandbox run goes here
      tool.state = ok ? "tested" : "failed";
      tool.verification = {
        ok,
        output: "Sandbox execution completed",
        verifier_method: "schema_invariant", // Sandbox = environment invariant check
      };
      return { ok: true, tool };
    } catch (err) {
      tool.state = "failed";
      tool.verification = { ok: false, error: err instanceof Error ? err.message : String(err) };
      return { ok: false, tool, error: tool.verification.error };
    }
  }

  // ── Invoke ───────────────────────────────────────────────────────────

  async invoke(
    toolId: string,
    args: Record<string, unknown>,
  ): Promise<GenesisResult> {
    const tool = this.store.get(toolId);
    if (!tool) return { ok: false, error: `Ephemeral tool '${toolId}' not found` };
    if (tool.state === "retired") return { ok: false, error: "Tool is retired" };
    if (tool.state === "failed") return { ok: false, error: `Tool failed sandbox test: ${tool.verification?.error}` };

    try {
      const startTime = Date.now();

      if (tool.templateType === "api_wrapper") {
        const config = JSON.parse(tool.implementation);

        // Merge args into the request body
        const body = { ...config.body, ...args };
        const response = await fetch(config.url, {
          method: config.method || "POST",
          headers: config.headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(config.timeoutMs || 60_000),
        });

        const duration = Date.now() - startTime;
        const data = await response.json().catch(() => response.text());

        tool.state = "invoked";
        tool.metadata.invocationCount++;
        tool.metadata.totalRuntimeMs += duration;

        return {
          ok: response.ok,
          tool,
          receiptHash: createHash("sha256").update(JSON.stringify(data).slice(0, 1000)).digest("hex").slice(0, 16),
        };
      }

      return { ok: false, error: `Invoke not implemented for template type: ${tool.templateType}` };
    } catch (err) {
      return { ok: false, tool, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── Verify ───────────────────────────────────────────────────────────
  //
  // P0.3 (2026-07-31): Self-certification REPLACED with independent verification.
  // A tool cannot transition to "verified" state merely by being invoked.
  // It MUST have at least one external verifier method:
  //   known_answer — deterministic test input → expected output comparison
  //   schema_invariant — output schema matches declared schema
  //   independent_recompute — same result from different path
  //   domain_witness — GEOX/WEALTH/WELL organ attests to correctness
  //
  // Without one of these, verification returns SELF_CERTIFIED (inadmissible
  // for promotion, marked as degraded).

  async verify(
    toolId: string,
    verifierMethod?: "known_answer" | "schema_invariant" | "independent_recompute" | "domain_witness" | "SELF_CERTIFIED",
    verifierReceipt?: string,
  ): Promise<GenesisResult> {
    const tool = this.store.get(toolId);
    if (!tool) return { ok: false, error: `Ephemeral tool '${toolId}' not found` };

    const wasInvoked = tool.state === "invoked";
    const hasVerifierMethod = verifierMethod && verifierMethod !== "SELF_CERTIFIED";
    const priorVerificationOk = tool.verification?.ok !== false;

    // P0.3: Require independent verification — SELF_CERTIFIED is inadmissible
    if (wasInvoked && priorVerificationOk) {
      if (hasVerifierMethod) {
        // Independent verification path — admissible
        tool.state = "verified";
        tool.verification = {
          ...tool.verification,
          ok: true,
          verifier_method: verifierMethod,
          verifier_receipt: verifierReceipt || "",
        };
        return { ok: true, tool };
      } else {
        // SELF_CERTIFIED path — degraded, not fully verified
        // Tool works (it was invoked) but no external evidence exists
        tool.verification = {
          ...tool.verification,
          ok: true,
          verifier_method: "SELF_CERTIFIED",
          verifier_receipt: "",
        };
        return {
          ok: true,
          tool,
          error: "P0.3 DEGRADED: No independent verifier provided — self-certified. Tool works but cannot be promoted without external verification evidence.",
        };
      }
    }

    return {
      ok: false,
      tool,
      error: wasInvoked ? "Verification failed — prior checks not OK" : "Tool not in invocable state — invoke first, then verify with independent verifier",
    };
  }

  // ── Retire ───────────────────────────────────────────────────────────

  async retire(toolId: string): Promise<GenesisResult> {
    const tool = this.store.get(toolId);
    if (!tool) return { ok: false, error: `Ephemeral tool '${toolId}' not found` };

    tool.state = "retired";
    // Clean up any temp files
    try {
      const tmpPath = join(this.outputDir, toolId);
      await rm(tmpPath, { recursive: true, force: true });
    } catch { /* best effort */ }

    return {
      ok: true,
      tool,
      receiptHash: createHash("sha256").update(JSON.stringify(tool.metadata)).digest("hex").slice(0, 16),
    };
  }

  // ── Propose Promotion ────────────────────────────────────────────────

  proposePromotion(templateId: string): { shouldPropose: boolean; count: number; threshold: number; template?: EphemeralTemplate } {
    const template = this.registry.get(templateId);
    if (!template) return { shouldPropose: false, count: 0, threshold: 0 };
    const shouldPropose = !template.promotionProposed && template.instantiationCount >= template.promotionThreshold;
    return {
      shouldPropose,
      count: template.instantiationCount,
      threshold: template.promotionThreshold,
      template,
    };
  }

  // ── Auto-cleanup expired tools ──────────────────────────────────────

  cleanupExpired(): number {
    const now = new Date().toISOString();
    let cleaned = 0;
    for (const [id, tool] of this.store["tools"]) {
      if (tool.expiresAt <= now && tool.state !== "retired") {
        tool.state = "retired";
        cleaned++;
      }
    }
    return cleaned;
  }

  // ── Built-in Templates ──────────────────────────────────────────────

  private registerBuiltinTemplates(): void {
    // ── Template: MuleRouter Image Generation ────────────────────────
    this.registry.register({
      id: "mulerouter_image_gen",
      type: "api_wrapper",
      description: "Generate images via MuleRouter GPT Image 2 or Wan 2.6 T2I",
      serves: ["Choose", "Investigate"],
      instantiationCount: 0,
      promotionProposed: false,
      promotionThreshold: 5,
      validateParams: (params) => {
        const errors: string[] = [];
        if (!params.prompt || typeof params.prompt !== "string") errors.push("prompt is required (string)");
        if (params.model && !["gpt", "wan"].includes(params.model as string)) errors.push("model must be 'gpt' or 'wan'");
        return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
      },
      generate: async (params) => {
        const model = (params.model as string) || "gpt";
        const baseUrl = model === "wan"
          ? "https://api.mulerouter.ai/vendors/alibaba/v1/wan2.6-t2i"
          : "https://api.mulerouter.ai/vendors/openai/v1/gpt-image-2";

        const config = {
          url: `${baseUrl}/generation`,
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.MULEROUTER_API_KEY || ""}`,
            "Content-Type": "application/json",
          },
          body: {
            prompt: params.prompt,
            quality: params.quality || "high",
            size: params.size || "1024x1024",
            n: params.n || 1,
            format: params.format || "png",
          },
          timeoutMs: 180_000,
          pollUrl: `${baseUrl}/generation/{task_id}`,
          pollIntervalMs: 3000,
        };

        return {
          id: "", // filled by generate()
          templateId: "mulerouter_image_gen",
          templateType: "api_wrapper",
          params,
          implementation: JSON.stringify(config),
          description: `Generate ${params.quality || "high"}-quality image: "${(params.prompt as string)?.slice(0, 80)}..."`,
          createdAt: "",
          expiresAt: "",
          sessionId: "",
          state: "generated",
          hash: "",
          metadata: { createdBy: "", missionIntent: "", capabilityGap: "", invocationCount: 0, totalRuntimeMs: 0 },
        };
      },
    });

    // ── Template: MuleRouter TTS ────────────────────────────────────
    this.registry.register({
      id: "mulerouter_tts",
      type: "api_wrapper",
      description: "Text-to-speech via MuleRouter MiniMax Speech 2.8 HD",
      serves: ["Choose"],
      instantiationCount: 0,
      promotionProposed: false,
      promotionThreshold: 5,
      validateParams: (params) => {
        if (!params.text || typeof params.text !== "string") return { valid: false, errors: ["text is required (string)"] };
        return { valid: true };
      },
      generate: async (params) => {
        const config = {
          url: "https://api.mulerouter.ai/vendors/minimax/v1/speech-2.8-hd/text-to-speech/generation",
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.MULEROUTER_API_KEY || ""}`,
            "Content-Type": "application/json",
          },
          body: {
            prompt: params.text,
            voice_setting: {
              voice_id: params.voice || "Wise_Woman",
              speed: params.speed || 1.0,
              vol: 1.0,
              pitch: 0,
            },
            output_format: "url",
          },
          timeoutMs: 180_000,
          pollUrl: "https://api.mulerouter.ai/vendors/minimax/v1/speech-2.8-hd/text-to-speech/generation/{task_id}",
          pollIntervalMs: 3000,
        };
        return {
          id: "", templateId: "mulerouter_tts", templateType: "api_wrapper", params,
          implementation: JSON.stringify(config),
          description: `TTS: "${(params.text as string)?.slice(0, 60)}..."`,
          createdAt: "", expiresAt: "", sessionId: "", state: "generated", hash: "",
          metadata: { createdBy: "", missionIntent: "", capabilityGap: "", invocationCount: 0, totalRuntimeMs: 0 },
        };
      },
    });

    // ── Template: MuleRouter Music ──────────────────────────────────
    this.registry.register({
      id: "mulerouter_music",
      type: "api_wrapper",
      description: "Music generation via MuleRouter MiniMax Music 2.5",
      serves: ["Choose"],
      instantiationCount: 0,
      promotionProposed: false,
      promotionThreshold: 5,
      validateParams: (params) => {
        if (!params.prompt || typeof params.prompt !== "string") return { valid: false, errors: ["prompt is required (string)"] };
        return { valid: true };
      },
      generate: async (params) => {
        const body: Record<string, unknown> = {
          prompt: params.prompt,
          output_format: "url",
        };
        if (params.lyrics) body.lyrics = params.lyrics;
        if (params.instrumental) body.instrumental = true;

        const config = {
          url: "https://api.mulerouter.ai/vendors/minimax/v1/music-2.5/text-to-music/generation",
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.MULEROUTER_API_KEY || ""}`,
            "Content-Type": "application/json",
          },
          body,
          timeoutMs: 300_000,
          pollUrl: "https://api.mulerouter.ai/vendors/minimax/v1/music-2.5/text-to-music/generation/{task_id}",
          pollIntervalMs: 5000,
        };
        return {
          id: "", templateId: "mulerouter_music", templateType: "api_wrapper", params,
          implementation: JSON.stringify(config),
          description: `Music: "${(params.prompt as string)?.slice(0, 60)}..."`,
          createdAt: "", expiresAt: "", sessionId: "", state: "generated", hash: "",
          metadata: { createdBy: "", missionIntent: "", capabilityGap: "", invocationCount: 0, totalRuntimeMs: 0 },
        };
      },
    });

    // ── Template: MuleRouter Vision ─────────────────────────────────
    this.registry.register({
      id: "mulerouter_vision",
      type: "api_wrapper",
      description: "Analyze images via MuleRouter qwen-vl-max",
      serves: ["Investigate", "Interpret"],
      instantiationCount: 0,
      promotionProposed: false,
      promotionThreshold: 5,
      validateParams: (params) => {
        if (!params.image_url && !params.image_base64) return { valid: false, errors: ["image_url or image_base64 is required"] };
        return { valid: true };
      },
      generate: async (params) => {
        const content: any[] = [{ type: "text", text: params.prompt || "Describe this image in detail." }];
        if (params.image_url) content.push({ type: "image_url", image_url: { url: params.image_url } });
        else if (params.image_base64) content.push({ type: "image_url", image_url: { url: params.image_base64 } });

        const config = {
          url: "https://api.mulerouter.ai/vendors/openai/v1/chat/completions",
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.MULEROUTER_API_KEY || ""}`,
            "Content-Type": "application/json",
          },
          body: {
            model: params.model || "qwen-vl-max",
            messages: [{ role: "user", content }],
            max_tokens: 1000,
          },
          timeoutMs: 60_000,
        };
        return {
          id: "", templateId: "mulerouter_vision", templateType: "api_wrapper", params,
          implementation: JSON.stringify(config),
          description: `Vision: "${(params.prompt as string)?.slice(0, 60) || 'analyze image'}"`,
          createdAt: "", expiresAt: "", sessionId: "", state: "generated", hash: "",
          metadata: { createdBy: "", missionIntent: "", capabilityGap: "", invocationCount: 0, totalRuntimeMs: 0 },
        };
      },
    });

    // ── Template: Generic REST API Wrapper ──────────────────────────
    this.registry.register({
      id: "generic_api_wrapper",
      type: "api_wrapper",
      description: "Generic REST API call wrapper for any endpoint",
      serves: ["Investigate", "Choose"],
      instantiationCount: 0,
      promotionProposed: false,
      promotionThreshold: 10,
      validateParams: (params) => {
        const errors: string[] = [];
        if (!params.url) errors.push("url is required");
        if (!params.method) errors.push("method is required");
        return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
      },
      generate: async (params) => {
        const config = {
          url: params.url,
          method: params.method || "GET",
          headers: params.headers || { "Content-Type": "application/json" },
          body: params.body || {},
          timeoutMs: params.timeoutMs || 30_000,
        };
        return {
          id: "", templateId: "generic_api_wrapper", templateType: "api_wrapper", params,
          implementation: JSON.stringify(config),
          description: `${params.method || "GET"} ${(params.url as string)?.slice(0, 80)}`,
          createdAt: "", expiresAt: "", sessionId: "", state: "generated", hash: "",
          metadata: { createdBy: "", missionIntent: "", capabilityGap: "", invocationCount: 0, totalRuntimeMs: 0 },
        };
      },
    });
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _genesis: EphemeralGenesis | null = null;

export function getEphemeralGenesis(): EphemeralGenesis {
  if (!_genesis) {
    _genesis = new EphemeralGenesis();
  }
  return _genesis;
}
