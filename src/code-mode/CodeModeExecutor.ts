/**
 * src/code-mode/CodeModeExecutor.ts — Code Mode Orchestrator
 *
 * F12 Injection Defense + F4 Clarity: Central executor that validates,
 * schedules, and runs user-submitted code inside the sovereign sandbox.
 * Integrates SecurityScanner (static analysis), NodeSandbox (isolated
 * execution), and MCP gateway bindings (minimal-context tool access).
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { SecurityScanner } from "./sandbox/SecurityScanner.js";
import { NodeSandbox } from "./sandbox/NodeSandbox.js";
import {
  GovernanceBridge,
  SABARHaltError,
  type RiskClassificationResult,
} from "../governance/GovernanceBridge.js";
import { ThermodynamicCostEstimator } from "../ops/ThermodynamicCostEstimator.js";
import type {
  SecurityAnalysis,
  ScriptResult,
  ExecutionContext,
  McpGatewayBinding,
  SandboxOptions,
} from "./types.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface CodeModeExecutorOptions {
  /** Pre-registered MCP gateways available to the sandbox */
  gateways: McpGatewayBinding[];
  /** Default timeout per script execution (ms) */
  defaultTimeoutMs?: number;
  /** Default memory limit per script (MB) */
  defaultMemoryLimitMb?: number;
  /** Network hosts the sandbox may reach (empty = none) */
  allowedNetworkHosts?: string[];
  /** arifOS governance bridge base URL (e.g., http://localhost:8080) */
  governanceBridgeUrl?: string;
  /** If true, T3 actions require an explicit hold flag to proceed */
  holdEnabled?: boolean;
}

export interface CodeModeExecutionRequest {
  script: string;
  expectedReturnType?: "object" | "array" | "string" | "number" | "boolean";
  context: ExecutionContext;
}

// ── Canonical Error Types ───────────────────────────────────────────────────

export class CodeModeSecurityError extends Error {
  readonly floorsTriggered = ["F12"];
  readonly analysis: SecurityAnalysis;

  constructor(message: string, analysis: SecurityAnalysis) {
    super(`[F12|VOID] ${message}`);
    this.name = "CodeModeSecurityError";
    this.analysis = analysis;
  }
}

export class CodeModeResourceError extends Error {
  readonly floorsTriggered = ["F4", "OPS"];

  constructor(message: string) {
    super(`[F4|OPS|HOLD] ${message}`);
    this.name = "CodeModeResourceError";
  }
}

// ── Executor ────────────────────────────────────────────────────────────────

export class CodeModeExecutor {
  private readonly scanner = SecurityScanner;
  private readonly sandbox: NodeSandbox;
  private readonly gateways: Map<string, McpGatewayBinding>;
  private readonly allowedNetworkHosts: string[];
  private readonly governanceBridge: GovernanceBridge | null;
  private readonly holdEnabled: boolean;

  constructor(options: CodeModeExecutorOptions) {
    this.sandbox = new NodeSandbox({
      timeoutMs: options.defaultTimeoutMs,
      memoryLimitMb: options.defaultMemoryLimitMb,
    });
    this.gateways = new Map(options.gateways.map((g) => [g.name, g]));
    this.allowedNetworkHosts = options.allowedNetworkHosts ?? [];
    this.holdEnabled = options.holdEnabled ?? false;
    this.governanceBridge = options.governanceBridgeUrl
      ? new GovernanceBridge({ baseUrl: options.governanceBridgeUrl, fallbackOnFailure: true })
      : null;
  }

  /**
   * Analyze a script for security violations without executing it.
   *
   * F12 Defense: Two-pass analysis — quick regex rejection for obvious
   * threats, then full tokenization for subtle injection vectors.
   */
  analyzeScript(script: string): SecurityAnalysis {
    // Fast path: reject obviously dangerous payloads
    const quick = this.scanner.quickReject(script);
    if (quick.rejected) {
      return {
        riskLevel: "dangerous",
        disallowedImports: [quick.reason ?? "quick_reject"],
        networkCalls: [],
        fileSystemAccess: [],
        shellCommands: [],
        recommendedFloors: ["F12"],
        rawFlags: ["QUICK_REJECT"],
      };
    }

    // Deep path: full tokenization + AST heuristic analysis
    return this.scanner.analyze(script);
  }

  /**
   * Build the minimal MCP client bindings injected into the sandbox.
   *
   * F4 Clarity: Instead of 50K tokens of JSON schemas, we inject ~300
   * tokens of typed client stubs. The LLM writes imperative code that
   * calls these stubs; data is filtered inside the sandbox before
   * returning to the LLM context window.
   */
  private buildMcpBindings(
    gatewayNames: string[],
  ): Record<string, unknown> {
    const bindings: Record<string, unknown> = {};

    for (const name of gatewayNames) {
      const gateway = this.gateways.get(name);
      if (!gateway) {
        continue;
      }

      // Create a minimal proxy that routes calls back to the parent process
      // In production, this proxy serializes calls to the actual MCP client
      const clientProxy = {
        _gatewayName: name,
        _toolNames: gateway.toolNames,
        _resourceUris: gateway.resourceUris,

        /**
         * Invoke an MCP tool by name with the given parameters.
         * Returns a Promise resolving to the tool result.
         */
        async call(toolName: string, params: Record<string, unknown>): Promise<unknown> {
          // Placeholder: in production, this posts to the parent via
          // a structured message port or worker message channel.
          return {
            _note: "MCP tool call stub",
            gateway: name,
            tool: toolName,
            params,
            status: "not_yet_implemented",
          };
        },

        /**
         * List available resources on this gateway.
         */
        async listResources(): Promise<string[]> {
          return gateway.resourceUris;
        },

        /**
         * Read a resource by its canonical URI.
         */
        async readResource(uri: string): Promise<unknown> {
          // Placeholder: production implementation routes to MCP resource layer
          return {
            _note: "MCP resource read stub",
            gateway: name,
            uri,
            status: "not_yet_implemented",
          };
        },
      };

      bindings[name] = clientProxy;
    }

    // Also expose a unified `mcp` namespace for convenience
    bindings["mcp"] = Object.fromEntries(
      gatewayNames
        .filter((n) => this.gateways.has(n))
        .map((n) => [n, bindings[n]]),
    );

    return bindings;
  }

  /**
   * Execute a user script inside the sovereign sandbox.
   *
   * Pipeline:
   *   1. F12 Security Analysis (static)
   *   2. F4 Clarity / OPS Thermodynamic Cost Check (placeholder)
   *   3. MCP Binding Injection (minimal context)
   *   4. NodeSandbox Execution (isolated worker)
   *   5. Result Sanitization + Token Cap
   */
  async executeScript(
    request: CodeModeExecutionRequest,
  ): Promise<ScriptResult> {
    const { script, context } = request;

    // ── Stage 1: F12 Injection Defense ──────────────────────────────────
    const analysis = this.analyzeScript(script);
    if (analysis.riskLevel === "dangerous") {
      throw new CodeModeSecurityError(
        `Dangerous patterns detected: ${analysis.rawFlags.join("; ")}`,
        analysis,
      );
    }

    if (analysis.riskLevel === "caution") {
      // Caution does not block, but annotate the result for audit
      // In strict mode, this could be upgraded to HOLD
    }

    // ── Stage 1b: T0-T3 Risk Tier Classification (A-FORGE Bridge) ───────
    let riskClassification: RiskClassificationResult | undefined;
    if (this.governanceBridge) {
      try {
        riskClassification = await this.governanceBridge.classifyScript(
          script,
          this.holdEnabled,
        );
      } catch (err) {
        if (err instanceof SABARHaltError) {
          throw err; // Propagate SABAR_HALT immediately
        }
        // Bridge failure: log and continue with F12 analysis only
        process.stderr.write(`[WARN] GovernanceBridge unreachable: ${err instanceof Error ? err.message : String(err)}\n`);
      }
    }

    // ── Stage 2: Thermodynamic Budget Gate (OPS/777) ────────────────────
    const thermo = new ThermodynamicCostEstimator();
    const thermoScan = thermo.estimate("run_command", { command: script.slice(0, 500) });

    // Map thermodynamic band to output token cap:
    // CRITICAL → block execution (blast radius too high)
    // HIGH → tight cap (2K) | MEDIUM → moderate cap (4K) | LOW → generous cap (8K)
    let estimatedOutputTokens = 8_000;
    if (thermoScan.thermodynamicBand === "CRITICAL") {
      throw new CodeModeSecurityError(
        `Thermodynamic VOID: band=${thermoScan.thermodynamicBand} blastRadius=${thermoScan.blastRadius.toFixed(2)} dS=${thermoScan.dS_predict.toFixed(2)} — script blocked before execution`,
        {
          riskLevel: "dangerous",
          rawFlags: ["OPS/777", "CRITICAL_BAND", `blastRadius=${thermoScan.blastRadius.toFixed(2)}`],
          recommendedFloors: ["F1", "F4", "OPS"],
          disallowedImports: [],
          networkCalls: [],
          fileSystemAccess: [],
          shellCommands: [],
        },
      );
    } else if (thermoScan.thermodynamicBand === "HIGH") {
      estimatedOutputTokens = 2_000;
    } else if (thermoScan.thermodynamicBand === "MEDIUM") {
      estimatedOutputTokens = 4_000;
    }

    // ── Stage 3: MCP Binding Injection ──────────────────────────────────
    const bindings = this.buildMcpBindings(context.allowedGateways);

    // ── Stage 4: Sandbox Execution ──────────────────────────────────────
    const sandboxOptions: SandboxOptions = {
      script,
      bindings,
      workingDirectory: context.workingDirectory,
      allowedNetworkHosts: this.allowedNetworkHosts,
      timeoutMs: 30_000,
      memoryLimitMb: 128,
    };

    const rawResult = await this.sandbox.execute(sandboxOptions);

    // ── Stage 5: Result Sanitization (F4 Clarity) ───────────────────────
    const sanitized = this.sanitizeResult(rawResult, estimatedOutputTokens);

    // Append constitutional annotations
    const floorsTriggered: string[] = [...analysis.recommendedFloors];
    if (rawResult.exitCode !== 0) {
      floorsTriggered.push("F8");
    }

    return {
      ...sanitized,
      floorsTriggered: [...new Set(floorsTriggered)],
      riskTier: riskClassification?.tier,
    };
  }

  /**
   * Sanitize and cap the returned payload to prevent context window
   * entropy injection (F4 Clarity).
   *
   * Hard cap: 8,000 tokens ≈ 32,000 bytes of JSON (conservative).
   */
  private sanitizeResult(
    raw: ScriptResult,
    tokenBudget: number,
  ): ScriptResult {
    const byteBudget = tokenBudget * 4; // rough heuristic: 1 token ≈ 4 bytes

    let output = raw.output;
    let stdout = raw.stdout;
    let stderr = raw.stderr;

    // Serialize output to string for measurement
    let outputString: string;
    try {
      outputString = JSON.stringify(output);
    } catch {
      outputString = String(output);
    }

    const totalBytes =
      Buffer.byteLength(outputString, "utf8") +
      Buffer.byteLength(stdout, "utf8") +
      Buffer.byteLength(stderr, "utf8");

    if (totalBytes > byteBudget) {
      const ratio = byteBudget / totalBytes;
      const outputBudget = Math.floor(byteBudget * 0.6);
      const stdoutBudget = Math.floor(byteBudget * 0.3);
      const stderrBudget = Math.floor(byteBudget * 0.1);

      outputString = this.truncateBytes(outputString, outputBudget);
      stdout = this.truncateBytes(stdout, stdoutBudget);
      stderr = this.truncateBytes(stderr, stderrBudget);

      try {
        output = JSON.parse(outputString);
      } catch {
        output = outputString;
      }

      stdout += "\n[F4|CLARITY] Output truncated by CodeModeExecutor to stay within token budget.";
    }

    return {
      ...raw,
      output,
      stdout,
      stderr,
      tokensConsumed: Math.ceil(totalBytes / 4),
    };
  }

  private truncateBytes(text: string, maxBytes: number): string {
    const buf = Buffer.from(text, "utf8");
    if (buf.length <= maxBytes) return text;
    return buf.subarray(0, maxBytes).toString("utf8") + "…[truncated]";
  }

  /**
   * Generate the tool schema for `execute_code_mode`.
   *
   * This is the ONLY tool definition injected into the LLM context
   * when Code Mode is active — replacing thousands of individual
   * MCP tool schemas.
   */
  static getToolSchema(gatewayNames: string[]) {
    return {
      name: "execute_code_mode",
      description:
        `Execute TypeScript in a sandboxed environment with access to MCP gateways. ` +
        `Use this for multi-step data retrieval, filtering, or transformation. ` +
        `Available gateways: ${gatewayNames.join(", ")}. ` +
        `Scripts are subject to F12 constitutional injection scans and F4 entropy caps.`,
      parameters: {
        type: "object" as const,
        properties: {
          script: {
            type: "string" as const,
            description:
              `TypeScript code to execute. Use 'await mcp.<gateway>.call(toolName, params)' ` +
              `to invoke tools. Use 'await mcp.<gateway>.readResource(uri)' to fetch data. ` +
              `Only safe builtins (Math, JSON, Array, Object, etc.) are available. ` +
              `No require, no fs, no network, no eval.`,
          },
          expectedReturnType: {
            type: "string" as const,
            enum: ["object", "array", "string", "number", "boolean"],
            description: "Expected return type for basic validation",
          },
        },
        required: ["script"],
      },
    };
  }
}
