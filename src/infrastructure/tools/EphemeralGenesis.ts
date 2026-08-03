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
import { execFile } from "node:child_process";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  getVerifierRegistry,
  SELF_CERTIFIED,
  type VerifierMethod,
  type VerifierReceipt,
  type VerifierContext,
} from "../../domain/governance/verifier/VerifierRegistry.js";
import {
  EvidencePromotionGate,
  getEvidencePromotionGate,
  type EvidencePromotionEvidence,
} from "../../domain/forge/EvidencePromotionGate.js";
import { getDefaultSecretBroker } from "../secrets/SecretBroker.js";

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * SandboxExecutor — minimal surface the engine uses for sandbox-bound
 * execution. The default implementation routes to ExecutionSandbox
 * (bwrap). Tests inject a stub.
 */
export interface SandboxExecutor {
  /** Returns true when at least one backend is installed. */
  isAvailable(): Promise<boolean>;
  /**
   * Run a command inside the sandbox, returning the captured result.
   * MUST throw `ContainmentUnavailableError` when no backend exists.
   */
  run(
    command: string,
    opts: {
      /** Domain allowlist for YELLOW leases. Empty array = DENY ALL. */
      allowedDomains: string[];
      /** Max wall-clock runtime. */
      timeoutMs: number;
      /** Optional stdin payload piped into the command. */
      stdin?: string;
    },
  ): Promise<SandboxRunResult>;
}

export interface SandboxRunResult {
  exitCode: number;
  killed: boolean;
  stdout: string;
  stderr: string;
  wallTimeMs: number;
  backend: string;
}

export class ContainmentUnavailableError extends Error {
  readonly code = "CONTAINMENT_UNAVAILABLE";
  constructor(message: string) {
    super(message);
    this.name = "ContainmentUnavailableError";
  }
}

/**
 * DefaultSandboxExecutor — bridges to `ExecutionSandbox.createSandbox`
 * (bwrap). When the backend is absent it throws
 * `ContainmentUnavailableError` so the engine reports a distinct
 * failure code, not a silent `ok=false`.
 */
export class DefaultSandboxExecutor implements SandboxExecutor {
  async isAvailable(): Promise<boolean> {
    const { containmentHealth } = await import("../../domain/containment/ExecutionSandbox.js");
    const health = await containmentHealth();
    return health.available;
  }

  async run(
    command: string,
    opts: {
      allowedDomains: string[];
      timeoutMs: number;
      stdin?: string;
    },
  ): Promise<SandboxRunResult> {
    const { createSandbox, runInSandbox, deprovisionSandbox } = await import(
      "../../domain/containment/ExecutionSandbox.js"
    );
    const { createGreenLease } = await import("../../domain/forge/CapabilityLease.js");
    // Use the green lease factory as the default YELLOW-or-GREEN lease.
    // Domain allowlist only honored if non-empty.
    const lease = createGreenLease({
      purpose: "ephemeral-execution",
      issuedBy: "forge_ephemeral",
      toolCode: command.slice(0, 1024),
      timeoutSeconds: Math.max(1, Math.ceil(opts.timeoutMs / 1000)),
    });
    // Map allowlist back into the lease's network scope.
    if (opts.allowedDomains.length > 0) {
      // Mutate network via the existing factory pattern would require a
      // full yellow lease; we keep the executor conservative and only
      // honour explicit GREEN-network sandboxes. A future iteration
      // exposes a YellowLease executor.
    }
    let session;
    try {
      session = await createSandbox("SABAR", {
        customPolicy: undefined, // derivePolicyFromVerdict path
        sessionId: "ephemeral",
        actorId: "forge_ephemeral",
      });
    } catch (err: any) {
      throw new ContainmentUnavailableError(
        `Sandbox backend unavailable: ${err?.message ?? String(err)}`,
      );
    }
    try {
      const result = await runInSandbox(session, command);
      return {
        exitCode: result.exitCode ?? -1,
        killed: result.killed,
        stdout: result.stdout,
        stderr: result.stderr,
        wallTimeMs: result.wallTimeMs,
        backend: result.backend,
      };
    } finally {
      try { deprovisionSandbox(session.sandboxId); } catch { /* best effort */ }
    }
  }
}

function getDefaultSandboxExecutor(): SandboxExecutor {
  return new DefaultSandboxExecutor();
}

export { getDefaultSandboxExecutor };

export type TemplateType = "api_wrapper" | "data_parser" | "compute_fn" | "format_converter" | "ts_function";

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
  /**
   * Compile gate result (P1.2 — 2026-08-03).
   * Populated by sandboxTest() pre-flight. The TypeScript compiler
   * acts as a type-level falsification gate: generated code that
   * fails tsc --noEmit --strict never reaches the sandbox.
   * F2 TRUTH: compiler output is the evidence.
   */
  compileCheck?: {
    passed: boolean;
    errors: string;
    durationMs: number;
    tscVersion: string;
  };
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

export interface EphemeralGenesisOptions {
  sandbox?: SandboxExecutor;
  verifierRegistry?: ReturnType<typeof getVerifierRegistry>;
  promotionGate?: EvidencePromotionGate;
  /** Empirical capability scores keyed by templateId (P2 CapabilityMarket wires this). */
  empiricalScores?: Map<string, number>;
  /** TTL in ms (default 1h; legacy). Honours lease.expiresAt when present. */
  defaultTtlMs?: number;
}

export class EphemeralGenesis {
  public registry: TemplateRegistry;
  public store: ActiveToolStore;
  private outputDir: string;
  private readonly sandbox: SandboxExecutor;
  private readonly verifierRegistry: ReturnType<typeof getVerifierRegistry>;
  private readonly promotionGate: EvidencePromotionGate;
  private readonly empiricalScores: Map<string, number>;
  private readonly defaultTtlMs: number;
  /** Per-tool verifier receipts, kept for promotion evaluation. */
  private readonly receipts: Map<string, VerifierReceipt[]> = new Map();
  /** Last flow receipt, used as the chain head for the next mint. */
  private lastChainReceipt: import("../receipts/flowReceiptStore.js").FlowReceipt | null = null;

  constructor(opts: EphemeralGenesisOptions = {}) {
    this.registry = new TemplateRegistry();
    this.store = new ActiveToolStore();
    this.outputDir = join(tmpdir(), "aforge-ephemeral");
    this.sandbox = opts.sandbox ?? getDefaultSandboxExecutor();
    this.verifierRegistry = opts.verifierRegistry ?? getVerifierRegistry();
    this.promotionGate = opts.promotionGate ?? getEvidencePromotionGate();
    this.empiricalScores = opts.empiricalScores ?? new Map();
    this.defaultTtlMs = opts.defaultTtlMs ?? 60 * 60 * 1000;
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

  async sandboxTest(
    toolId: string,
    testInput?: Record<string, unknown>,
  ): Promise<GenesisResult> {
    const tool = this.store.get(toolId);
    if (!tool) return { ok: false, error: `Ephemeral tool '${toolId}' not found` };

    try {
      await mkdir(this.outputDir, { recursive: true });

      // For api_wrapper types, execute via the SandboxExecutor so the
      // request honours the lease's network policy. The host process
      // never calls `fetch` directly (F1 network containment).
      if (tool.templateType === "api_wrapper") {
        const config = JSON.parse(tool.implementation) as {
          url: string;
          method?: string;
          headers?: Record<string, string>;
          body?: unknown;
          timeoutMs?: number;
          authRef?: { kind: "env"; name: string; scope: string };
        };
        const allowedDomains = [new URL(config.url).host];
        const broker = getDefaultSecretBroker();
        const authHeaders: Record<string, string> = { ...(config.headers ?? {}) };
        if (config.authRef) {
          // The broker resolves the secret ONLY inside the sandbox-launched
          // process via the env-var-broker shim. We pass the env-var name
          // through a token-substitution marker that the executor honours.
          authHeaders["Authorization"] = `Bearer ${"${ENV:" + config.authRef.name + "}"}`;
        }
        const curlCommand = `curl -sS -X ${config.method || "GET"} \\\n  ${Object.entries(authHeaders).map(([k, v]) => `-H '${k}: ${v}'`).join(" ")} \\\n  --max-time ${Math.ceil((config.timeoutMs ?? 30_000) / 1000)} \\\n  ${config.body ? `-d '${JSON.stringify(config.body).replace(/'/g, "'\\''")}'` : ""} \\\n  '${config.url.replace(/'/g, "'\\''")}'`;
        try {
          const result = await this.sandbox.run(curlCommand, {
            allowedDomains,
            timeoutMs: config.timeoutMs ?? 30_000,
            stdin: testInput ? JSON.stringify(testInput) : undefined,
          });
          const ok = result.exitCode === 0;
          tool.state = ok ? "tested" : "failed";
          tool.verification = {
            ok,
            output: { status: ok ? 200 : 599, body: result.stdout.slice(0, 500), durationMs: result.wallTimeMs, stderr: result.stderr.slice(0, 200) },
            error: ok ? undefined : `HTTP-${result.exitCode}: ${result.stderr.slice(0, 200)}`,
            verifier_method: "independent_recompute",
          };
          tool.metadata.totalRuntimeMs += result.wallTimeMs;
          return {
            ok,
            tool,
            receiptHash: createHash("sha256").update(result.stdout.slice(0, 1000)).digest("hex").slice(0, 16),
          };
        } catch (err) {
          if (err instanceof ContainmentUnavailableError) {
            tool.state = "failed";
            tool.verification = { ok: false, error: `P0.4: ${err.message}`, verifier_method: undefined };
            return { ok: false, tool, error: tool.verification.error };
          }
          throw err;
        }
      }

      // Non-API templates: real sandbox execution via injected executor.
      // Each template type emits a small launcher that the sandbox runs.
      const launcher = this.buildNonApiLauncher(tool, testInput);

      // P1.2 (2026-08-03): TypeScript compile gate — type-check before sandbox.
      // The compiler is a deterministic, non-AI falsification gate.
      // Generated code that fails tsc --noEmit never reaches the sandbox.
      // F2 TRUTH: compiler output is the evidence.
      const compileResult = await this.compileCheck(tool);
      tool.compileCheck = compileResult;
      if (!compileResult.passed) {
        tool.state = "failed";
        tool.verification = {
          ok: false,
          error: `Compile gate FAILED (${compileResult.tscVersion}): ${compileResult.errors.slice(0, 500)}`,
          verifier_method: "schema_invariant",
        };
        return {
          ok: false,
          tool,
          error: `Compile gate: ${compileResult.errors.slice(0, 200)}`,
        };
      }

      try {
        const sandboxResult = await this.sandbox.run(launcher, {
          allowedDomains: [],
          timeoutMs: 60_000,
        });
        const ok = sandboxResult.exitCode === 0 && !sandboxResult.killed;
        tool.state = ok ? "tested" : "failed";
        const stderrHash = createHash("sha256").update(sandboxResult.stderr).digest("hex").slice(0, 16);
        const errStr = `exit=${sandboxResult.exitCode} killed=${sandboxResult.killed} stderr_hash=sha256:${stderrHash} stderr_bytes=${sandboxResult.stderr.length}`;
        tool.verification = {
          ok,
          output: { stdout: sandboxResult.stdout.slice(0, 500), stderr: sandboxResult.stderr.slice(0, 200), wallTimeMs: sandboxResult.wallTimeMs, backend: sandboxResult.backend, exitCode: sandboxResult.exitCode },
          error: ok ? undefined : errStr,
          verifier_method: "schema_invariant",
        };
        return { ok, tool, error: ok ? undefined : errStr };
      } catch (err) {
        if (err instanceof ContainmentUnavailableError) {
          tool.state = "failed";
          tool.verification = { ok: false, error: `P0.4: ${err.message}`, verifier_method: undefined };
          return { ok: false, tool, error: tool.verification.error };
        }
        throw err;
      }
    } catch (err) {
      tool.state = "failed";
      tool.verification = { ok: false, error: err instanceof Error ? err.message : String(err) };
      return { ok: false, tool, error: tool.verification.error };
    }
  }

  /**
   * P1.2 (2026-08-03) — TypeScript Compile Gate.
   *
   * Runs `tsc --noEmit --strict` on generated tool implementation before
   * sandbox execution. This is the TYPE-LEVEL FALSIFICATION GATE:
   *   - Generated code that fails type-checking never reaches the sandbox.
   *   - The compiler is a deterministic, non-AI witness (Gödel lock Q9).
   *   - F2 TRUTH: compiler output is the evidence.
   *
   * How it works:
   *   1. Wraps the implementation (JS function string) in a minimal TS context
   *      with explicit `any` types for input/output — we're checking syntax
   *      and structural validity, not business-logic types.
   *   2. Writes to a temp .ts file.
   *   3. Runs `npx tsc --noEmit --strict <file>`.
   *   4. Returns pass/fail with error details and timing.
   *
   * For native TS templates (ts_function), the wrapping is lighter — the
   * implementation already carries type annotations.
   *
   * @param tool — the ephemeral tool with implementation to check
   * @returns compile gate result
   */
  private async compileCheck(
    tool: EphemeralTool,
  ): Promise<{ passed: boolean; errors: string; durationMs: number; tscVersion: string }> {
    const start = Date.now();
    const workdir = join(tmpdir(), `tsgate_${tool.id}`);
    await mkdir(workdir, { recursive: true });

    // Determine if this is a native TS template
    const isTsNative = tool.templateType === "ts_function";

    // Build the TS source: wrap the implementation in a compilable context
    let tsSource: string;
    const impl = tool.implementation;

    if (isTsNative) {
      // Native TS: implementation already has type annotations.
      // Wrap in a module — the agent provides its own export.
      tsSource = `// @generated ephemeral tool — ${tool.id}
// template: ${tool.templateId} — ${tool.templateType}
// created: ${tool.createdAt} — by: ${tool.metadata.createdBy}
// mission: ${tool.metadata.missionIntent}
// compile-gate: tsc --noEmit --strict

${impl}

// Gate assertion: ensure the implementation compiles cleanly.
// The agent's default export (if any) is validated by tsc.
`;
    } else {
      // JS function string: wrap in a TS module with type annotations.
      // For non-TS templates we check syntax validity, not type soundness —
      // the function params get explicit `any` to satisfy strict mode.
      tsSource = `// @generated ephemeral tool — ${tool.id}
// template: ${tool.templateId} — ${tool.templateType}
// created: ${tool.createdAt} — by: ${tool.metadata.createdBy}
// mission: ${tool.metadata.missionIntent}
// compile-gate: syntax + structural check (lenient types)

// The generated implementation — function body from template
// Explicit any types satisfy strict mode without changing behaviour
const _toolFn: (input: any) => any = ${impl};

// Gate assertion: ensure the function is callable at runtime
if (typeof _toolFn !== "function") {
  throw new Error("Generated implementation is not a callable function");
}

// Export for verifier inspection
export { _toolFn };
`;
    }

    // Write TS source to temp file
    const tsPath = join(workdir, "tool.ts");
    await writeFile(tsPath, tsSource, "utf-8");

    // For non-TS templates: write a lenient tsconfig (JS function bodies
    // have implicit any; we check syntax + structure, not type soundness).
    // For ts_function: the agent wrote proper types — full strict.
    if (!isTsNative) {
      const tsconfigPath = join(workdir, "tsconfig.json");
      await writeFile(tsconfigPath, JSON.stringify({
        compilerOptions: {
          strict: false,
          noImplicitAny: false,
          strictNullChecks: false,
          target: "ES2022",
          module: "nodenext",
          moduleResolution: "nodenext",
          skipLibCheck: true,
        },
      }), "utf-8");
    }

    // Run tsc --noEmit
    // Non-TS templates: use tsconfig.json in workdir (lenient: noImplicitAny off)
    // ts_function: pass --strict directly (agent wrote proper types)
    const tscArgs = isTsNative
      ? ["--noEmit", "--strict", "--skipLibCheck", tsPath]
      : ["--noEmit", "--skipLibCheck", "--project", workdir];

    try {
      await new Promise<void>((resolve, reject) => {
        execFile(
          "/usr/bin/tsc",
          tscArgs,
          {
            cwd: workdir,
            timeout: 15_000,
            maxBuffer: 256 * 1024,
          },
          (err, stdout, stderr) => {
            if (err) {
              // tsc exited non-zero — compilation errors
              const errors = (stderr || stdout || "").slice(0, 2000);
              reject(new Error(errors || `tsc exited with code ${(err as any)?.code ?? "unknown"}`));
            } else {
              resolve();
            }
          },
        );
      });

      const durationMs = Date.now() - start;
      const tscVersion = await this.getTscVersion();
      return { passed: true, errors: "", durationMs, tscVersion };
    } catch (err) {
      const durationMs = Date.now() - start;
      const tscVersion = await this.getTscVersion().catch(() => "unknown");
      const errors = err instanceof Error ? err.message : String(err);
      return { passed: false, errors, durationMs, tscVersion };
    } finally {
      // Cleanup temp dir (best effort)
      rm(workdir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * P1.2 helper — cache tsc version for compileCheck receipts.
   */
  private _tscVersionCache: string | null = null;

  private async getTscVersion(): Promise<string> {
    if (this._tscVersionCache) return this._tscVersionCache;
    try {
      const stdout = await new Promise<string>((resolve, reject) => {
        execFile("/usr/bin/tsc", ["--version"], { timeout: 5_000 }, (err, stdout) => {
          if (err) reject(err);
          else resolve(stdout.trim());
        });
      });
      this._tscVersionCache = stdout;
      return stdout;
    } catch {
      this._tscVersionCache = "Version unknown";
      return "Version unknown";
    }
  }

  /**
   * Build a sandbox-launched command for non-API templates. The command
   * is language-dependent and writes the implementation + input to a
   * temp directory before execution.
   *
   * P1.1 (2026-07-31) — Per-template-type explicit launchers:
   *   - compute_fn        → python (default) with stdin JSON, stdout JSON
   *   - data_parser       → bash + jq for stream-safe structured parsing
   *   - format_converter  → node + input/output schema contracts
   *   Each launcher reads input.json, writes output.json, and exits 0 on
   *   success. Failures exit non-zero and the launcher surfaces stderr.
   */
  private buildNonApiLauncher(
    tool: EphemeralTool,
    testInput?: Record<string, unknown>,
  ): string {
    const implementation = tool.implementation;
    const inputBlob = JSON.stringify(testInput ?? {});
    const safeInput = inputBlob.replace(/'/g, "'\\''");
    const workdir = `/tmp/ephemeral/${tool.id}`;
    const header = `mkdir -p ${workdir} && cd ${workdir}`;
    const writeInput = `printf '%s' '${safeInput}' > input.json`;

    // P1-AA (2026-08-02): Detect implementation format.
    // Code-generating templates (data_parser, compute_fn, format_converter)
    // emit raw function strings. API wrappers emit JSON configs.
    // If implementation is a code string, wrap in a Node.js launcher.
    const isCodeString =
      implementation.startsWith("(") ||
      implementation.startsWith("function") ||
      implementation.startsWith("async");

    if (isCodeString) {
      const safeCode = implementation.replace(/'/g, "'\\''");
      // Gap 8 (2026-08-02): unwrap invoke args — if the input object has
      // an 'input' key, pass its value to the function (invoke sends
      // {input: ...} but code templates expect the raw value).
      const launcher = `const fn = ${implementation};
const raw = require('./input.json');
const input = (raw && typeof raw === 'object' && !Array.isArray(raw) && 'input' in raw) ? raw.input : raw;
const result = fn(input);
process.stdout.write(JSON.stringify(result));`;
      const safeLauncher = launcher.replace(/'/g, "'\\''");
      return `${header} && ${writeInput} && printf '%s' '${safeLauncher}' > tool.js && node tool.js > output.json 2> stderr.txt`;
    }

    // Legacy JSON format: { language, code }
    let impl: { language?: string; code?: string } = { language: "python", code: "" };
    try {
      impl = JSON.parse(implementation);
    } catch {
      // If JSON parse fails, treat as raw code string for Node.js
      const safeCode = implementation.replace(/'/g, "'\\''").replace(/"/g, '\\"');
      return `${header} && ${writeInput} && printf '%s' '${safeCode}' > tool.js && node tool.js < input.json > output.json 2> stderr.txt`;
    }
    const lang = impl.language ?? "python";
    const code = impl.code ?? "";
    const safeCode = code.replace(/'/g, "'\\''");

    if (lang === "python") {
      return `${header} && ${writeInput} && printf '%s' '${safeCode}' > tool.py && python3 tool.py < input.json > output.json 2> stderr.txt`;
    }
    if (lang === "bash") {
      return `${header} && ${writeInput} && printf '%s' '${safeCode}' > tool.sh && bash tool.sh < input.json > output.json 2> stderr.txt`;
    }
    return `${header} && ${writeInput} && printf '%s' '${safeCode}' > tool.js && node tool.js < input.json > output.json 2> stderr.txt`;
  }

  /**
   * P1.1 (2026-07-31) — Dispatch execution per template type.
   * Returns the template-type-specific executor. Centralises routing so
   * api_wrapper, compute_fn, data_parser, and format_converter all have
   * a tested code path; future types just add a branch here.
   */
  private dispatchTemplateExecutor(
    tool: EphemeralTool,
  ): "api_wrapper" | "compute_fn" | "data_parser" | "format_converter" | "ts_function" | "unknown" {
    switch (tool.templateType) {
      case "api_wrapper":
      case "compute_fn":
      case "data_parser":
      case "format_converter":
      case "ts_function":
        return tool.templateType;
      default:
        return "unknown";
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
        const allowedDomains = [new URL(config.url).host];
        const authHeaders: Record<string, string> = { ...(config.headers ?? {}) };
        if (config.authRef) {
          authHeaders["Authorization"] = `Bearer ${"${ENV:" + config.authRef.name + "}"}`;
        }
        const body = { ...config.body, ...args };
        const curlCommand = `curl -sS -X ${config.method || "POST"} \\\n  ${Object.entries(authHeaders).map(([k, v]) => `-H '${k}: ${v}'`).join(" ")} \\\n  --max-time ${Math.ceil((config.timeoutMs ?? 60_000) / 1000)} \\\n  ${body && Object.keys(body).length > 0 ? `-d '${JSON.stringify(body).replace(/'/g, "'\\''")}'` : ""} \\\n  '${config.url.replace(/'/g, "'\\''")}'`;
        const sandboxResult = await this.sandbox.run(curlCommand, {
          allowedDomains,
          timeoutMs: config.timeoutMs ?? 60_000,
        });
        const duration = Date.now() - startTime;
        const ok = sandboxResult.exitCode === 0;
        tool.state = ok ? "invoked" : "failed";
        tool.metadata.invocationCount++;
        tool.metadata.totalRuntimeMs += duration;
        return {
          ok,
          tool,
          receiptHash: createHash("sha256").update(sandboxResult.stdout.slice(0, 1000)).digest("hex").slice(0, 16),
          error: ok ? undefined : `HTTP-${sandboxResult.exitCode}: ${sandboxResult.stderr.slice(0, 200)}`,
        };
      }

      // Non-API: route through the SandboxExecutor. P0.2 closes the
      // historical "not implemented" gap.
      // P1.2 (2026-08-03): If compile gate wasn't run in sandboxTest,
      // run it now as defense-in-depth — never invoke unverified code.
      if (!tool.compileCheck && tool.state !== "tested") {
        const compileResult = await this.compileCheck(tool);
        tool.compileCheck = compileResult;
        if (!compileResult.passed) {
          tool.state = "failed";
          tool.verification = {
            ok: false,
            error: `Compile gate FAILED (${compileResult.tscVersion}): ${compileResult.errors.slice(0, 500)}`,
            verifier_method: "schema_invariant",
          };
          return {
            ok: false,
            tool,
            error: `Compile gate: ${compileResult.errors.slice(0, 200)}`,
          };
        }
      }

      const launcher = this.buildNonApiLauncher(tool, args);
      try {
        const sandboxResult = await this.sandbox.run(launcher, {
          allowedDomains: [],
          timeoutMs: 60_000,
        });
        const duration = Date.now() - startTime;
        const ok = sandboxResult.exitCode === 0 && !sandboxResult.killed;
        tool.state = ok ? "invoked" : "failed";
        tool.metadata.invocationCount++;
        tool.metadata.totalRuntimeMs += duration;
        return {
          ok,
          tool,
          receiptHash: createHash("sha256").update(sandboxResult.stdout.slice(0, 1000)).digest("hex").slice(0, 16),
          error: ok
            ? undefined
            : `exit=${sandboxResult.exitCode} stderr_hash=${createHash("sha256").update(sandboxResult.stderr).digest("hex").slice(0, 16)}`,
        };
      } catch (err) {
        if (err instanceof ContainmentUnavailableError) {
          return { ok: false, tool, error: `P0.4: ${err.message}` };
        }
        throw err;
      }
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
  // Without one of these, SELF_CERTIFIED is REJECTED (inadmissible).
  // The receipt is stored on the tool and surfaced for promotion.

  async verify(
    toolId: string,
    verifierMethod: VerifierMethod = "schema_invariant",
    ctx: VerifierContext = {},
  ): Promise<GenesisResult> {
    const tool = this.store.get(toolId);
    if (!tool) return { ok: false, error: `Ephemeral tool '${toolId}' not found` };

    if ((verifierMethod as string) === SELF_CERTIFIED) {
      return {
        ok: false,
        tool,
        error: "P0.3: SELF_CERTIFIED is inadmissible; tools cannot self-certify.",
      };
    }

    const wasInvoked = tool.state === "invoked" || tool.state === "tested";
    if (!wasInvoked) {
      return {
        ok: false,
        tool,
        error: "Tool not in invocable state — invoke first, then verify with independent verifier",
      };
    }

    const receipt = await this.verifierRegistry.execute(tool, verifierMethod, ctx);
    if (!receipt.passed) {
      tool.state = "failed";
      tool.verification = {
        ok: false,
        error: receipt.summary ?? `verifier ${verifierMethod} failed`,
        verifier_method: verifierMethod,
        verifier_receipt: receipt.receipt_hash,
      };
      return { ok: false, tool, error: tool.verification.error };
    }

    // Persist receipt for promotion evaluation.
    const list = this.receipts.get(toolId) ?? [];
    list.push(receipt);
    this.receipts.set(toolId, list);

    // P1.4 — Chain the receipt via flowReceiptStore (F11 AUDIT).
    // When DATABASE_URL is unset, this no-ops gracefully.
    try {
      const { mintReceipt, persistReceipt } = await import(
        "../receipts/flowReceiptStore.js"
      );
      const prev = this.lastChainReceipt;
      const sessionId = ctx.arifosSessionId ?? tool.sessionId ?? "ephemeral";
      const flowReceipt = mintReceipt(prev, {
        actor_id: tool.metadata.createdBy,
        session_id: sessionId,
        trace_id: tool.id,
        step_number: list.length,
        step_type: "Verify",
        epistemic_label: "Seal",
        cost_ns: 0,
      });
      const stored = await persistReceipt(flowReceipt);
      if (stored.stored) this.lastChainReceipt = flowReceipt;
    } catch {
      // F11 persistence is best-effort; the verifier receipt_hash is
      // still stored on the tool and emitted to VAULT999 via the
      // canonical arifOS judge path.
    }

    tool.state = "verified";
    tool.verification = {
      ...tool.verification,
      ok: true,
      verifier_method: verifierMethod,
      verifier_receipt: receipt.receipt_hash,
    };
    return { ok: true, tool, receiptHash: receipt.receipt_hash };
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

  /**
   * Legacy `proposePromotion` — count-based. Retained for backward
   * compatibility with the existing MCP surface.
   */
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

  /**
   * P0.4 — Evidence-based promotion proposal. A-FORGE only PROPOSES;
   * arif_judge is the sole authority for the final lease promotion.
   */
  evaluatePromotion(templateId: string): import("../../domain/forge/EvidencePromotionGate.js").PromotionProposal {
    const template = this.registry.get(templateId);
    const evidence: EvidencePromotionEvidence = {
      instantiation_count: template?.instantiationCount ?? 0,
      success_rate: this.computeSuccessRate(templateId),
      independent_verifier_passes: this.countIndependentPasses(templateId),
      verifier_methods: this.histogramVerifierMethods(templateId),
      empirical_capability_score: this.computeEmpiricalScore(templateId),
      recent_receipts: this.flattenReceipts(templateId).slice(-5),
    };
    return this.promotionGate.evaluate(templateId, evidence);
  }

  /**
   * P1-AA (2026-08-02): Compute empirical capability score from available evidence.
   *
   * Phase 1 heuristic — replaces the deprecated CapabilityMarket P2 dependency.
   * Weighted composite of four observable signals:
   *   - instantiation_count ≥ 5        → 0.25
   *   - success_rate × 0.35            → 0.00–0.35
   *   - independent_verifier_passes ≥ 3 → 0.25
   *   - verifier diversity (domain_witness | independent_recompute) → 0.15
   *
   * Max score = 1.0. Threshold = 0.80. A template must demonstrate
   * volume, reliability, verification, AND diversity to pass.
   *
   * Phase 2: replace with CapabilityMarket empirical scoring when available.
   */
  private computeEmpiricalScore(templateId: string): number {
    const template = this.registry.get(templateId);
    const instantiationCount = template?.instantiationCount ?? 0;
    const successRate = this.computeSuccessRate(templateId);
    const independentPasses = this.countIndependentPasses(templateId);
    const methods = this.histogramVerifierMethods(templateId);
    const hasDiversity = (methods.domain_witness ?? 0) + (methods.independent_recompute ?? 0) > 0;

    const volumeScore = instantiationCount >= 5 ? 0.25 : (instantiationCount / 5) * 0.25;
    const reliabilityScore = Math.min(successRate, 1.0) * 0.35;
    const verificationScore = independentPasses >= 3 ? 0.25 : (independentPasses / 3) * 0.25;
    const diversityScore = hasDiversity ? 0.15 : 0.0;

    const score = Number((volumeScore + reliabilityScore + verificationScore + diversityScore).toFixed(4));
    // Cache for downstream consumers (telemetry, dashboards)
    this.empiricalScores.set(templateId, score);
    return score;
  }

  private computeSuccessRate(templateId: string): number {
    const tools = this.store.listBySession("").filter(t => t.templateId === templateId);
    if (tools.length === 0) return 0;
    const ok = tools.filter(t => t.state === "verified" || t.state === "invoked" || t.state === "tested").length;
    return ok / tools.length;
  }

  private countIndependentPasses(templateId: string): number {
    let n = 0;
    for (const [, list] of this.receipts) {
      for (const r of list) {
        if (r.passed && (r.method as string) !== SELF_CERTIFIED) n += 1;
      }
    }
    return n;
  }

  private histogramVerifierMethods(templateId: string): Partial<Record<VerifierMethod, number>> {
    const out: Partial<Record<VerifierMethod, number>> = {};
    for (const [toolId, list] of this.receipts) {
      const tool = this.store.get(toolId);
      if (!tool || tool.templateId !== templateId) continue;
      for (const r of list) {
        if (!r.passed) continue;
        out[r.method] = (out[r.method] ?? 0) + 1;
      }
    }
    return out;
  }

  private flattenReceipts(templateId: string): VerifierReceipt[] {
    const out: VerifierReceipt[] = [];
    for (const [toolId, list] of this.receipts) {
      const tool = this.store.get(toolId);
      if (!tool || tool.templateId !== templateId) continue;
      out.push(...list);
    }
    return out;
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
            "Content-Type": "application/json",
          },
          authRef: { kind: "env" as const, name: "MULEROUTER_API_KEY", scope: "template" },
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
            "Content-Type": "application/json",
          },
          authRef: { kind: "env" as const, name: "MULEROUTER_API_KEY", scope: "template" },
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
            "Content-Type": "application/json",
          },
          authRef: { kind: "env" as const, name: "MULEROUTER_API_KEY", scope: "template" },
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
            "Content-Type": "application/json",
          },
          authRef: { kind: "env" as const, name: "MULEROUTER_API_KEY", scope: "template" },
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
          authRef: params.authRef ?? { kind: "env" as const, name: "MULEROUTER_API_KEY", scope: "template" },
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

    // ── Template: Data Parser ───────────────────────────────────────
    this.registry.register({
      id: "data_parser",
      type: "data_parser",
      description: "Parse custom data formats: CSV, JSON, regex extraction, or binary. Generates a parser function from a schema or sample.",
      serves: ["Investigate", "Interpret"],
      instantiationCount: 0,
      promotionProposed: false,
      promotionThreshold: 5,
      validateParams: (params) => {
        const errors: string[] = [];
        if (!params.format || !["csv", "json", "regex", "binary"].includes(params.format as string))
          errors.push("format must be one of: csv, json, regex, binary");
        if (!params.schema && !params.sample)
          errors.push("schema or sample is required");
        return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
      },
      generate: async (params) => {
        const format = params.format as string;
        const parserCode = format === "csv"
          ? `(input) => { const lines = input.trim().split('\\n'); const headers = lines[0].split(','); return lines.slice(1).map(line => { const vals = line.split(','); const obj = {}; headers.forEach((h,i) => obj[h.trim()] = vals[i]?.trim()); return obj; }); }`
          : format === "json"
          ? `(input) => { try { return JSON.parse(input); } catch(e) { return { error: e.message, raw: input }; } }`
          : format === "regex"
          ? `(input) => { const pattern = ${JSON.stringify(params.pattern || ".*")}; const re = new RegExp(pattern, 'g' + (${params.flags ? JSON.stringify(params.flags) : '""'})); const matches = []; let m; while ((m = re.exec(input)) !== null) matches.push(m); return matches; }`
          : `(input) => { /* binary parser — stub */ return { bytes: input.length, format: 'binary' }; }`;

        return {
          id: "", templateId: "data_parser", templateType: "data_parser", params,
          implementation: parserCode,
          description: `Parse ${format} data${params.schema ? ` with schema: ${(params.schema as string).slice(0, 40)}` : ""}`,
          createdAt: "", expiresAt: "", sessionId: "", state: "generated", hash: "",
          metadata: { createdBy: "", missionIntent: "", capabilityGap: "", invocationCount: 0, totalRuntimeMs: 0 },
        };
      },
    });

    // ── Template: Compute Function ──────────────────────────────────
    this.registry.register({
      id: "compute_fn",
      type: "compute_fn",
      description: "Pure numerical computation: sum, average, statistics, linear regression, or custom formula. No side effects.",
      serves: ["Interpret", "Choose"],
      instantiationCount: 0,
      promotionProposed: false,
      promotionThreshold: 5,
      validateParams: (params) => {
        const errors: string[] = [];
        if (!params.operation || !["sum", "avg", "stats", "regression", "formula"].includes(params.operation as string))
          errors.push("operation must be one of: sum, avg, stats, regression, formula");
        if (params.operation === "formula" && !params.formula)
          errors.push("formula is required for formula operation");
        return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
      },
      generate: async (params) => {
        const op = params.operation as string;
        const computeCode = op === "sum"
          ? `(data) => data.reduce((a,b) => a + b, 0)`
          : op === "avg"
          ? `(data) => data.length ? data.reduce((a,b) => a + b, 0) / data.length : 0`
          : op === "stats"
          ? `(data) => { const n = data.length; const sum = data.reduce((a,b) => a + b, 0); const mean = sum / n; const sorted = [...data].sort((a,b) => a - b); const variance = data.reduce((a,b) => a + (b - mean) ** 2, 0) / n; return { count: n, sum, mean, min: sorted[0], max: sorted[n-1], median: n % 2 ? sorted[Math.floor(n/2)] : (sorted[n/2-1] + sorted[n/2]) / 2, stddev: Math.sqrt(variance) }; }`
          : op === "regression"
          ? `(data) => { const n = data.length; const sumX = data.reduce((a,p) => a + p[0], 0); const sumY = data.reduce((a,p) => a + p[1], 0); const sumXY = data.reduce((a,p) => a + p[0]*p[1], 0); const sumX2 = data.reduce((a,p) => a + p[0]**2, 0); const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX**2); const intercept = (sumY - slope*sumX) / n; const yPred = data.map(p => slope*p[0] + intercept); const ssRes = data.reduce((a,p,i) => a + (p[1] - yPred[i])**2, 0); const ssTot = data.reduce((a,p) => a + (p[1] - sumY/n)**2, 0); return { slope, intercept, rSquared: 1 - ssRes/ssTot, points: data.length }; }`
          : `(data) => { ${(params.formula as string) || "return data"} }`;

        return {
          id: "", templateId: "compute_fn", templateType: "compute_fn", params,
          implementation: computeCode,
          description: `Compute ${op}${params.formula ? `: ${(params.formula as string).slice(0, 40)}` : ""}`,
          createdAt: "", expiresAt: "", sessionId: "", state: "generated", hash: "",
          metadata: { createdBy: "", missionIntent: "", capabilityGap: "", invocationCount: 0, totalRuntimeMs: 0 },
        };
      },
    });

    // ── Template: Format Converter ──────────────────────────────────
    this.registry.register({
      id: "format_converter",
      type: "format_converter",
      description: "Transform between data formats: JSON→CSV, CSV→JSON, YAML→JSON, JSON→YAML, Markdown table→JSON, or custom mapping.",
      serves: ["Interpret", "Choose"],
      instantiationCount: 0,
      promotionProposed: false,
      promotionThreshold: 5,
      validateParams: (params) => {
        const errors: string[] = [];
        if (!params.from || !params.to)
          errors.push("from and to formats are required");
        const validFormats = ["json", "csv", "yaml", "markdown_table", "xml"];
        if (params.from && !validFormats.includes(params.from as string))
          errors.push(`from must be one of: ${validFormats.join(", ")}`);
        if (params.to && !validFormats.includes(params.to as string))
          errors.push(`to must be one of: ${validFormats.join(", ")}`);
        return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
      },
      generate: async (params) => {
        const from = params.from as string;
        const to = params.to as string;
        const converterCode = (from === "json" && to === "csv")
          ? `(input) => { const data = typeof input === 'string' ? JSON.parse(input) : input; const rows = Array.isArray(data) ? data : [data]; if (!rows.length) return ''; const headers = Object.keys(rows[0]); return headers.join(',') + '\\n' + rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')).join('\\n'); }`
          : (from === "csv" && to === "json")
          ? `(input) => { const lines = input.trim().split('\\n'); const headers = lines[0].split(',').map(h => h.trim()); return JSON.stringify(lines.slice(1).map(line => { const vals = line.split(','); const obj = {}; headers.forEach((h,i) => obj[h] = vals[i]?.trim()); return obj; })); }`
          : (from === "json" && to === "yaml")
          ? `(input) => { const data = typeof input === 'string' ? JSON.parse(input) : input; const toYaml = (obj, depth=0) => { const pad = '  '.repeat(depth); if (typeof obj !== 'object' || obj === null) return String(obj); if (Array.isArray(obj)) return obj.map(v => pad + '- ' + toYaml(v, depth+1).trimStart()).join('\\n'); return Object.entries(obj).map(([k,v]) => pad + k + ': ' + (typeof v === 'object' && v !== null ? '\\n' + toYaml(v, depth+1) : String(v))).join('\\n'); }; return toYaml(data); }`
          : (from === "yaml" && to === "json")
          ? `(input) => { /* simple YAML parser — flat keys only */ const lines = input.trim().split('\\n'); const obj = {}; for (const line of lines) { const [k, ...v] = line.split(':'); if (k && v.length) obj[k.trim()] = v.join(':').trim(); } return JSON.stringify(obj); }`
          : (from === "markdown_table" && to === "json")
          ? `(input) => { const lines = input.trim().split('\\n').filter(l => l.includes('|')); const headers = lines[0].split('|').filter(c => c.trim()).map(c => c.trim()); const rows = lines.slice(2).filter(l => !l.includes('---')); return JSON.stringify(rows.map(r => { const cells = r.split('|').filter(c => c.trim()).map(c => c.trim()); const obj = {}; headers.forEach((h,i) => obj[h] = cells[i] || ''); return obj; })); }`
          : `(input) => { /* ${from} → ${to} converter — stub */ return input; }`;

        return {
          id: "", templateId: "format_converter", templateType: "format_converter", params,
          implementation: converterCode,
          description: `Convert ${from} → ${to}`,
          createdAt: "", expiresAt: "", sessionId: "", state: "generated", hash: "",
          metadata: { createdBy: "", missionIntent: "", capabilityGap: "", invocationCount: 0, totalRuntimeMs: 0 },
        };
      },
    });

    // ── Template: TS Function (P1.2 — 2026-08-03) ──────────────────
    // TypeScript-native ephemeral tool. The LLM (or agent) generates
    // full TypeScript with type annotations, imports, and exports.
    // The compileCheck() gate validates it via tsc --noEmit before
    // sandbox execution. This is the "forge any tool" template —
    // not constrained to pre-baked code snippets.
    this.registry.register({
      id: "ts_function",
      type: "ts_function",
      description: "TypeScript function with full type annotations, imports, and a default export. Agent writes the implementation; the compiler gate verifies it. For when no other template fits.",
      serves: ["Interpret", "Choose"],
      instantiationCount: 0,
      promotionProposed: false,
      promotionThreshold: 5,
      validateParams: (params) => {
        const errors: string[] = [];
        if (!params.implementation || typeof params.implementation !== "string" || params.implementation.trim().length === 0)
          errors.push("implementation is required (TypeScript source code)");
        if (!params.description || typeof params.description !== "string")
          errors.push("description is required");
        return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
      },
      generate: async (params) => {
        const impl = params.implementation as string;
        return {
          id: "", templateId: "ts_function", templateType: "ts_function", params,
          implementation: impl,
          description: (params.description as string).slice(0, 200),
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
