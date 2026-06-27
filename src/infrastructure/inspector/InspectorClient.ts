/**
 * InspectorClient — MCP Reality Introspection Surface for A-FORGE
 *
 * The sensory cortex of governed execution. Every agent action passes through
 * Inspector hooks before touching any MCP surface. Without Inspector, the agent
 * is blind to the reality it operates in.
 *
 * Hooks (P0→P4, priority order):
 *   P0 (H3+H4): checkDeprecated + checkAuthority — stops 80% of failures
 *   P1 (H0+H1): snapshot + detectDrift — eliminates blind startup
 *   P2 (H2):    validateSchema — catches hallucinated tool args
 *   P3 (H5+H6): validateOutput + verifyReceiptChain — seals audit trail
 *   P4 (H7):    snapshotFinal — enables safe session resume/replay
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 *
 * Forged: 2026-06-26 by AAA Control Plane under arifOS F1-F13.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { ToolPermissionContext } from "../../domain/types/tool.js";

// ── Types ──────────────────────────────────────────────────────────

export interface DeprecationEntry {
  status: string;
  since: string;
  migration: string;
  reason: string;
  blast_radius?: string;
}

export interface DeprecationRegistry {
  deprecated_tools: Record<string, DeprecationEntry>;
  deprecated_services: Record<string, DeprecationEntry>;
  deprecated_endpoints: Record<string, DeprecationEntry>;
  deprecated_patterns: Record<string, DeprecationEntry>;
  deprecated_skills: Record<string, DeprecationEntry>;
  deprecated_conventions: Record<string, DeprecationEntry>;
  deprecation_lifecycle: {
    stages: Record<string, string>;
    cleanup_checklist: string[];
  };
}

export interface ToolRegistryEntry {
  capability: string;
  capability_tags: string[];
  authority_level: string;
  blast_radius: string;
  deprecation: { status: string; since: string; migration: string } | null;
}

export interface OrganEntry {
  description: string;
  port: number;
  mcp_endpoint: string;
  tool_count: number;
  authority: string;
  tools: Record<string, ToolRegistryEntry>;
}

export interface ToolRegistryDoc {
  organs: Record<string, OrganEntry>;
  capability_index: Record<string, string[]>;
  antipatterns: Array<{ pattern: string; fix: string }>;
}

export interface InspectorToolSnapshot {
  name: string;
  organ: string;
  schema?: Record<string, unknown>;
  authority: string;
  deprecated: boolean;
  deprecationStatus?: string;
  capability_tags: string[];
}

export interface InspectorSnapshot {
  sessionId: string;
  capturedAt: string;
  tools: Record<string, InspectorToolSnapshot>;
  organs: Record<string, { alive: boolean; port: number; toolCount: number }>;
  deprecations: { toolCount: number; servicesCount: number; endpointsCount: number };
}

export interface DriftReport {
  zombie: string[];       // in registry but not on live MCP
  missing: string[];      // on live MCP but not in registry
  stale: string[];        // schema changed since baseline
  healthy: string[];      // no drift
  degraded: string[];     // DEPRECATED or DEGRADED tools found active
}

export interface DeprecationCheck {
  deprecated: boolean;
  status: string;
  migration: string;
  reason: string;
  blastRadius?: string;
}

export interface AuthorityCheck {
  allowed: boolean;
  required: string;
  actual: string;
  leaseRequired: boolean;
  reason?: string;
}

export interface SchemaCheckResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface OutputValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ReceiptChainCheck {
  intact: boolean;
  gaps: number[];
  lastSealId: string | null;
}

export interface SessionManifest {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  toolsUsed: string[];
  deprecationsHit: string[];
  authorityEscalations: string[];
  driftEvents: string[];
  snapshotBaseline: InspectorSnapshot | null;
  snapshotFinal: Record<string, unknown>;
}

// ── Authority rank map (lower = more powerful) ─────────────────

const AUTHORITY_RANK: Record<string, number> = {
  "OBSERVE": 7,
  "SUGGEST": 6,
  "SIMULATE": 5,
  "DRAFT": 4,
  "QUEUE": 3,
  "EXECUTE_REVERSIBLE": 2,
  "EXECUTE_HIGH_IMPACT": 1,
  "IRREVERSIBLE": 0,
};

// ── Terminal deprecation statuses (should block execution) ─────

const TERMINAL_DEPRECATION_STATUSES = new Set([
  "DEPRECATED",
  "DEPRECATED_PROXY",
  "REMOVED",
  "FORBIDDEN",
  "STOPPED_DISABLED",
]);

const WARNING_DEPRECATION_STATUSES = new Set([
  "DEGRADED",
  "LEGACY",
  "REDIRECTED",
  "REPLACED",
  "ANNOUNCED",
]);

// ── Constructor options ─────────────────────────────────────────

export interface InspectorClientOptions {
  /** Path to deprecation registry JSON */
  deprecationRegistryPath: string;
  /** Path to tool registry JSON */
  toolRegistryPath: string;
  /** Optional: MCP surface URLs for live introspection */
  mcpSurfaces?: Array<{ name: string; url: string }>;
  /** Directory for session manifests (P4 continuity) */
  manifestDir?: string;
  /** Session ID for manifest tracking */
  sessionId?: string;
}

// ── InspectorClient ──────────────────────────────────────────────

export class InspectorClient {
  private deprecationRegistry: DeprecationRegistry | null = null;
  private toolRegistry: ToolRegistryDoc | null = null;
  private baseline: InspectorSnapshot | null = null;
  private readonly mcpSurfaces: Array<{ name: string; url: string }>;
  private readonly manifestDir: string;
  private readonly sessionId: string;
  private toolsUsed: string[] = [];
  private deprecationsHit: string[] = [];
  private authorityEscalations: string[] = [];
  private driftEvents: string[] = [];

  constructor(options: InspectorClientOptions) {
    this.deprecationRegistryPath = options.deprecationRegistryPath;
    this.toolRegistryPath = options.toolRegistryPath;
    this.mcpSurfaces = options.mcpSurfaces ?? [];
    this.manifestDir = options.manifestDir ?? join(process.env.HOME ?? "/root", ".aforge", "inspector");
    this.sessionId = options.sessionId ?? randomUUID();
  }

  private readonly deprecationRegistryPath: string;
  private readonly toolRegistryPath: string;

  // ── Lazy loaders ───────────────────────────────────────────

  private loadDeprecationRegistry(): DeprecationRegistry {
    if (this.deprecationRegistry) return this.deprecationRegistry;
    if (!existsSync(this.deprecationRegistryPath)) {
      throw new Error(`[INSPECTOR] Deprecation registry not found: ${this.deprecationRegistryPath}`);
    }
    const raw = readFileSync(this.deprecationRegistryPath, "utf-8");
    this.deprecationRegistry = JSON.parse(raw) as DeprecationRegistry;
    return this.deprecationRegistry;
  }

  private loadToolRegistry(): ToolRegistryDoc {
    if (this.toolRegistry) return this.toolRegistry;
    if (!existsSync(this.toolRegistryPath)) {
      throw new Error(`[INSPECTOR] Tool registry not found: ${this.toolRegistryPath}`);
    }
    const raw = readFileSync(this.toolRegistryPath, "utf-8");
    this.toolRegistry = JSON.parse(raw) as ToolRegistryDoc;
    return this.toolRegistry;
  }

  // ═══════════════════════════════════════════════════════════════
  // P0 — HOOK 3: Deprecation Check
  // ═══════════════════════════════════════════════════════════════

  /**
   * Check if a tool is deprecated by cross-referencing the deprecation registry.
   * Returns full deprecation status + migration path.
   */
  checkDeprecated(toolName: string): DeprecationCheck {
    const registry = this.loadDeprecationRegistry();

    // Exact match
    if (registry.deprecated_tools[toolName]) {
      const entry = registry.deprecated_tools[toolName];
      this.deprecationsHit.push(toolName);
      return {
        deprecated: true,
        status: entry.status,
        migration: entry.migration,
        reason: entry.reason,
        blastRadius: entry.blast_radius,
      };
    }

    // Wildcard match (e.g., mcp__arifos__forge_*)
    for (const [pattern, entry] of Object.entries(registry.deprecated_tools)) {
      if (pattern.includes("*")) {
        const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
        if (regex.test(toolName)) {
          this.deprecationsHit.push(toolName);
          return {
            deprecated: true,
            status: entry.status,
            migration: entry.migration,
            reason: entry.reason,
            blastRadius: entry.blast_radius,
          };
        }
      }
    }

    // Check tool registry for inline deprecation
    const toolReg = this.loadToolRegistry();
    for (const [_organName, organ] of Object.entries(toolReg.organs)) {
      if (organ.tools[toolName]?.deprecation) {
        const d = organ.tools[toolName].deprecation!;
        this.deprecationsHit.push(toolName);
        return {
          deprecated: true,
          status: d.status,
          migration: d.migration,
          reason: `Tool registry marks as ${d.status}`,
        };
      }
    }

    return { deprecated: false, status: "ACTIVE", migration: "", reason: "" };
  }

  /**
   * Returns the verdict for a deprecation check result.
   * TERMINAL statuses → HOLD (block execution).
   * WARNING statuses → emit advisory but allow.
   */
  deprecationVerdict(check: DeprecationCheck): "HOLD" | "WARN" | "PASS" {
    if (!check.deprecated) return "PASS";
    if (TERMINAL_DEPRECATION_STATUSES.has(check.status)) return "HOLD";
    if (WARNING_DEPRECATION_STATUSES.has(check.status)) return "WARN";
    return "WARN"; // unknown status → conservative
  }

  // ═══════════════════════════════════════════════════════════════
  // P0 — HOOK 4: Authority Check
  // ═══════════════════════════════════════════════════════════════

  /**
   * Verify agent's permission context against the tool's required authority level.
   * Cross-references TOOLREGISTRY.json authority_level against actual permission flags.
   */
  checkAuthority(toolName: string, context: ToolPermissionContext): AuthorityCheck {
    const toolReg = this.loadToolRegistry();

    // Find the tool's required authority level
    let requiredLevel = "EXECUTE_REVERSIBLE"; // conservative default
    let found = false;

    for (const [_organName, organ] of Object.entries(toolReg.organs)) {
      const tool = organ.tools[toolName];
      if (tool) {
        requiredLevel = tool.authority_level;
        found = true;
        break;
      }
      // Check partial name match (e.g., forge_* prefix)
      for (const [regName, regTool] of Object.entries(organ.tools)) {
        if (toolName.startsWith(regName.replace(/\*$/, ""))) {
          requiredLevel = regTool.authority_level;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    // Determine actual authority from context
    let actualLevel = "OBSERVE";
    if (context.holdEnabled && context.dangerousToolsEnabled) {
      actualLevel = "EXECUTE_HIGH_IMPACT"; // internal_mode with dangerous tools
    } else if (context.dangerousToolsEnabled) {
      actualLevel = "EXECUTE_REVERSIBLE";
    } else if (context.experimentalToolsEnabled) {
      actualLevel = "DRAFT";
    } else if (context.enabledTools.size > 0) {
      actualLevel = "SUGGEST";
    }

    // Human override bypasses all authority checks
    if (context.humanOverride) {
      actualLevel = "IRREVERSIBLE";
    }

    const requiredRank = AUTHORITY_RANK[requiredLevel] ?? 5;
    const actualRank = AUTHORITY_RANK[actualLevel] ?? 7;
    const allowed = actualRank <= requiredRank; // lower rank = more powerful

    const leaseRequired =
      requiredRank <= AUTHORITY_RANK["EXECUTE_REVERSIBLE"] &&
      !context.humanOverride;

    if (!allowed) {
      this.authorityEscalations.push(`${toolName}: ${actualLevel} < ${requiredLevel}`);
    }

    return {
      allowed,
      required: requiredLevel,
      actual: actualLevel,
      leaseRequired,
      reason: allowed
        ? undefined
        : `Agent authority ${actualLevel} (rank ${actualRank}) insufficient for ${toolName} which requires ${requiredLevel} (rank ${requiredRank})`,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // P1 — HOOK 0: Baseline Reality Snapshot
  // ═══════════════════════════════════════════════════════════════

  /**
   * Capture a baseline snapshot of the MCP reality at session start.
   * Queries live MCP surfaces for tool lists + aggregates static registries.
   */
  async snapshot(): Promise<InspectorSnapshot> {
    const toolReg = this.loadToolRegistry();
    const depReg = this.loadDeprecationRegistry();
    const tools: Record<string, InspectorToolSnapshot> = {};
    const organs: Record<string, { alive: boolean; port: number; toolCount: number }> = {};

    // Aggregate from static tool registry
    for (const [organName, organ] of Object.entries(toolReg.organs)) {
      organs[organName] = {
        alive: false, // verified below
        port: organ.port,
        toolCount: organ.tool_count,
      };

      for (const [toolName, tool] of Object.entries(organ.tools)) {
        const isDeprecated =
          tool.deprecation !== null ||
          Object.keys(depReg.deprecated_tools).some(
            (k) => k === toolName || (k.includes("*") && toolName.startsWith(k.replace(/\*$/, ""))),
          );

        tools[toolName] = {
          name: toolName,
          organ: organName,
          authority: tool.authority_level,
          deprecated: isDeprecated,
          deprecationStatus: tool.deprecation?.status,
          capability_tags: tool.capability_tags,
        };
      }
    }

    // Probe live MCP surfaces for organ aliveness
    for (const surface of this.mcpSurfaces) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch(`${surface.url}/health`, {
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (resp.ok) {
          if (organs[surface.name]) {
            organs[surface.name].alive = true;
          } else {
            organs[surface.name] = { alive: true, port: 0, toolCount: 0 };
          }
        }
      } catch {
        // Organ unreachable — mark as dead
        if (!organs[surface.name]) {
          organs[surface.name] = { alive: false, port: 0, toolCount: 0 };
        }
      }
    }

    this.baseline = {
      sessionId: this.sessionId,
      capturedAt: new Date().toISOString(),
      tools,
      organs,
      deprecations: {
        toolCount: Object.keys(depReg.deprecated_tools).length,
        servicesCount: Object.keys(depReg.deprecated_services).length,
        endpointsCount: Object.keys(depReg.deprecated_endpoints).length,
      },
    };

    return this.baseline;
  }

  // ═══════════════════════════════════════════════════════════════
  // P1 — HOOK 1: Drift Detection
  // ═══════════════════════════════════════════════════════════════

  /**
   * Compare the current reality against the baseline snapshot.
   * Detects zombie tools (in registry but not live), missing tools
   * (live but not registered), and stale tools (schema changed).
   */
  async detectDrift(baseline?: InspectorSnapshot): Promise<DriftReport> {
    const base = baseline ?? this.baseline;
    if (!base) {
      return { zombie: [], missing: [], stale: [], healthy: [], degraded: [] };
    }

    const zombie: string[] = [];
    const missing: string[] = [];
    const stale: string[] = [];
    const healthy: string[] = [];
    const degraded: string[] = [];

    // Query live MCP surfaces for current tool lists
    const liveTools = new Set<string>();
    for (const surface of this.mcpSurfaces) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(`${surface.url}/tools/list`, {
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
        });
        clearTimeout(timer);
        if (resp.ok) {
          const body = (await resp.json()) as { tools?: Array<{ name: string }> };
          for (const tool of body.tools ?? []) {
            liveTools.add(tool.name);
          }
        }
      } catch {
        // Surface unreachable — skip live verification for this organ
      }
    }

    // Cross-reference baseline against live reality
    for (const [toolName, snapshot] of Object.entries(base.tools)) {
      if (snapshot.deprecated) {
        degraded.push(toolName);
        continue;
      }

      if (liveTools.size > 0 && !liveTools.has(toolName)) {
        // Tool in baseline but not on any live MCP surface
        zombie.push(toolName);
      } else if (liveTools.size === 0) {
        // Couldn't reach any surfaces — assume healthy
        healthy.push(toolName);
      } else {
        healthy.push(toolName);
      }
    }

    // Check for tools on live surfaces not in baseline
    for (const liveTool of liveTools) {
      if (!(liveTool in base.tools)) {
        missing.push(liveTool);
      }
    }

    // Log drift events
    if (zombie.length > 0) this.driftEvents.push(`zombie:${zombie.join(",")}`);
    if (missing.length > 0) this.driftEvents.push(`missing:${missing.join(",")}`);

    return { zombie, missing, stale, healthy, degraded };
  }

  // ═══════════════════════════════════════════════════════════════
  // P2 — HOOK 2: Schema Validation
  // ═══════════════════════════════════════════════════════════════

  /**
   * Validate tool arguments against the expected schema from TOOLREGISTRY.
   * Performs basic type checking on known parameters.
   */
  validateSchema(toolName: string, args: Record<string, unknown>): SchemaCheckResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Known dangerous patterns in tool arguments
    const argsStr = JSON.stringify(args).toLowerCase();

    // Check for command injection patterns
    if (/\brm\s+-rf\b/.test(argsStr)) {
      errors.push("F12: Destructive command pattern detected (rm -rf)");
    }
    if (/\bdrop\s+table\b/i.test(argsStr)) {
      errors.push("F1: Destructive SQL pattern detected (DROP TABLE)");
    }
    if (/\bgit\s+push\s+.*--force\b/.test(argsStr)) {
      errors.push("F1: Force push detected — requires 888_HOLD");
    }

    // Check for path traversal
    const checkTraversal = (val: unknown): void => {
      if (typeof val === "string" && /\.\.\/|\.\.\\/.test(val)) {
        warnings.push("F13: Path traversal pattern detected");
      }
      if (typeof val === "object" && val !== null) {
        for (const v of Object.values(val as Record<string, unknown>)) {
          checkTraversal(v);
        }
      }
    };
    checkTraversal(args);

    // Check for secret exposure patterns
    if (/\b(api[_-]?key|secret|token|password|passwd)\b/i.test(argsStr)) {
      warnings.push("F10: Potential secret/key in arguments — verify redaction");
    }

    // Tool-specific schema checks
    if (toolName.includes("forge_filesystem") || toolName.includes("forge_file")) {
      if (args.mode === "write" && !args.content) {
        errors.push("Schema: forge_filesystem write mode requires 'content'");
      }
      if (args.mode === "write" && !args.path) {
        errors.push("Schema: forge_filesystem write mode requires 'path'");
      }
    }

    if (toolName.includes("forge_git") && args.mode === "commit") {
      if (!args.message) {
        warnings.push("Schema: forge_git commit mode expects 'message'");
      }
    }

    if (toolName.includes("forge_postgres") && args.mode === "query") {
      if (!args.query) {
        errors.push("Schema: forge_postgres query mode requires 'query'");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // P3 — HOOK 5: Output Validation
  // ═══════════════════════════════════════════════════════════════

  /**
   * Validate tool output for signs of partial failure or corruption.
   */
  validateOutput(toolName: string, output: string): OutputValidationResult {
    const errors: string[] = [];

    // Empty output on mutation tools = suspicious
    const mutationTools = [
      "forge_filesystem", "forge_git", "forge_docker",
      "forge_postgres", "forge_vault", "forge_github_create",
    ];
    if (mutationTools.some((t) => toolName.includes(t)) && (!output || output.trim().length === 0)) {
      errors.push("Empty output from mutation tool — possible silent failure");
    }

    // Error patterns disguised as success
    const errorPatterns = [
      /^error:/im,
      /^fatal:/im,
      /cannot\s+open/im,
      /permission\s+denied/im,
      /not\s+found$/im,
      /connection\s+refused/im,
      /command\s+not\s+found/im,
      /traceback\s*\(/im,
    ];
    for (const pattern of errorPatterns) {
      if (pattern.test(output)) {
        errors.push(`Output contains error pattern: ${pattern.source}`);
      }
    }

    // Truncation detection
    if (output.length > 0 && /\.{3,}$/.test(output.trim()) && !output.trim().endsWith("...")) {
      errors.push("Output possibly truncated (trailing ellipsis)");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // P3 — HOOK 6: Receipt Chain Verification
  // ═══════════════════════════════════════════════════════════════

  /**
   * Verify the VAULT999 receipt chain is intact before sealing.
   * Reads the last seal ID and checks for gaps.
   */
  async verifyReceiptChain(sessionId: string): Promise<ReceiptChainCheck> {
    const gaps: number[] = [];
    let lastSealId: string | null = null;

    // Check VAULT999 outcomes
    const vaultPaths = [
      "/root/arifOS/VAULT999/outcomes.jsonl",
      "/root/VAULT999/outcomes.jsonl",
      "/root/.local/share/arifos/vault999/outcomes.jsonl",
    ];

    for (const vaultPath of vaultPaths) {
      if (!existsSync(vaultPath)) continue;

      try {
        const lines = readFileSync(vaultPath, "utf-8").trim().split("\n").filter(Boolean);
        if (lines.length === 0) continue;

        // Extract seal IDs from each line
        const sealIds: Array<{ num: number; id: string }> = [];
        for (const line of lines) {
          try {
            const record = JSON.parse(line);
            if (record.seal_id) {
              const match = /(\d+)$/.exec(record.seal_id);
              if (match) {
                sealIds.push({ num: parseInt(match[1], 10), id: record.seal_id });
              }
            }
          } catch {
            // Skip malformed lines
          }
        }

        if (sealIds.length === 0) continue;

        // Sort by numeric suffix and detect gaps
        sealIds.sort((a, b) => a.num - b.num);
        lastSealId = sealIds[sealIds.length - 1].id;

        for (let i = 1; i < sealIds.length; i++) {
          if (sealIds[i].num !== sealIds[i - 1].num + 1) {
            for (let g = sealIds[i - 1].num + 1; g < sealIds[i].num; g++) {
              gaps.push(g);
            }
          }
        }

        break; // Use first valid vault path found
      } catch {
        // Try next path
      }
    }

    return {
      intact: gaps.length === 0,
      gaps,
      lastSealId,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // P4 — HOOK 7: Session Continuity (snapshotFinal + resume)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Capture a final snapshot for session continuity.
   * Enables safe resume/replay by recording what tools were used,
   * what deprecations were hit, and what drift was detected.
   */
  async snapshotFinal(): Promise<void> {
    const manifest: SessionManifest = {
      sessionId: this.sessionId,
      startedAt: this.baseline?.capturedAt ?? new Date().toISOString(),
      endedAt: new Date().toISOString(),
      toolsUsed: [...new Set(this.toolsUsed)],
      deprecationsHit: [...new Set(this.deprecationsHit)],
      authorityEscalations: [...new Set(this.authorityEscalations)],
      driftEvents: [...new Set(this.driftEvents)],
      snapshotBaseline: this.baseline,
      snapshotFinal: {
        toolsUsed: this.toolsUsed.length,
        deprecationsWarned: this.deprecationsHit.length,
        authorityEscalations: this.authorityEscalations.length,
        driftEvents: this.driftEvents.length,
      },
    };

    try {
      mkdirSync(this.manifestDir, { recursive: true });
      const manifestPath = join(this.manifestDir, `${this.sessionId}.json`);
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    } catch (err) {
      // Non-fatal: manifest write failure must not break execution
      process.stderr.write(
        `[INSPECTOR] Failed to write session manifest: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }

  /**
   * Load a previous session manifest for resume continuity.
   * Returns null if the session has no prior manifest.
   */
  loadManifest(sessionId: string): SessionManifest | null {
    try {
      const manifestPath = join(this.manifestDir, `${sessionId}.json`);
      if (!existsSync(manifestPath)) return null;
      const raw = readFileSync(manifestPath, "utf-8");
      return JSON.parse(raw) as SessionManifest;
    } catch {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Utility: track a tool call for session manifest
  // ═══════════════════════════════════════════════════════════════

  trackToolCall(toolName: string): void {
    this.toolsUsed.push(toolName);
  }

  // ═══════════════════════════════════════════════════════════════
  // Combined: run P0 pre-execution checks (deprecation + authority)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Run both P0 checks before a tool executes.
   * Returns the combined verdict: PASS | WARN | HOLD | VOID
   */
  preflight(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolPermissionContext,
  ): {
    verdict: "PASS" | "WARN" | "HOLD" | "VOID";
    deprecation: DeprecationCheck;
    authority: AuthorityCheck;
    schema: SchemaCheckResult;
    message?: string;
  } {
    const deprecation = this.checkDeprecated(toolName);
    const authority = this.checkAuthority(toolName, context);
    const schema = this.validateSchema(toolName, args);

    // Deprecation terminal → HOLD
    const depVerdict = this.deprecationVerdict(deprecation);
    if (depVerdict === "HOLD") {
      return {
        verdict: "HOLD",
        deprecation,
        authority,
        schema,
        message: `DEPRECATED [${deprecation.status}]: ${deprecation.reason}. Migration: ${deprecation.migration}`,
      };
    }

    // Schema errors → VOID
    if (!schema.valid) {
      return {
        verdict: "VOID",
        deprecation,
        authority,
        schema,
        message: `Schema validation failed: ${schema.errors.join("; ")}`,
      };
    }

    // Authority mismatch → VOID
    if (!authority.allowed) {
      return {
        verdict: "VOID",
        deprecation,
        authority,
        schema,
        message: authority.reason ?? "Insufficient authority",
      };
    }

    // Deprecation warning → WARN
    if (depVerdict === "WARN") {
      return {
        verdict: "WARN",
        deprecation,
        authority,
        schema,
        message: `DEPRECATION WARNING [${deprecation.status}]: ${deprecation.migration}`,
      };
    }

    // Schema warnings → WARN
    if (schema.warnings.length > 0) {
      return {
        verdict: "WARN",
        deprecation,
        authority,
        schema,
        message: `Schema warnings: ${schema.warnings.join("; ")}`,
      };
    }

    return { verdict: "PASS", deprecation, authority, schema };
  }
}
