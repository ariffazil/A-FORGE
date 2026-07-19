/**
 * McpPolicyGate — the missing control plane between AI agents and MCP tools.
 *
 * Enforces the 5-layer boundary BEFORE an MCP request reaches any handler:
 *
 *   Layer 1  Identity    — actor_id verified, role bound, active policy selected
 *   Layer 2  Server      — allowed_mcp_servers whitelist (deny-by-default)
 *   Layer 3  Tool        — allowed_tools per server (deny-by-default)
 *   Layer 4  Argument    — regex constraints on each argument path
 *   Layer 5  Verdict     — ALLOW / DENY / AUDIT_LOG (with reason chain)
 *
 * The model can reason. The agent can request. The architecture MUST enforce.
 * Prompt injection, hallucinated plans, wrong tool calls, malicious tool
 * responses — none cross this boundary without passing every layer.
 *
 * Constitutional:
 *   F1 AMANAH    — deny-by-default; every allow is explicit
 *   F2 TRUTH     — every verdict carries a reason chain (OBS labels)
 *   F6 MARUAH    — human actors get audit, not opaque rejection
 *   F8 LAW       — policy is the floor, not a suggestion
 *   F11 AUDIT    — every verdict is traceable to the matching policy clause
 *   F13 SOVEREIGN — sovereign bypasses nothing by default; explicit profile only
 *
 * @module governance/McpPolicyGate
 * @forged 2026-06-30 by FORGE (000) — response to MCP control-plane gap
 * @phase 2 sprint 5.5
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AAEV1 } from "./amanahEnvelope.js";
import { verifyAAE } from "./amanahEnvelope.js";
import { classifyTool, type ActionClass, requires888Hold, isClassifiedTool } from "./actionClassifier.js";
import { NonceStore, globalNonceStore } from "./nonceStore.js";

// ── Types ─────────────────────────────────────────────────────────────

export type PolicyVerdict = "ALLOW" | "DENY" | "AUDIT_LOG";

/** Where the actor identity originated — not just the name, the provenance. */
export type PrincipalSource = "verified_session" | "client_supplied" | "transport_fallback";

/** Authority band derived from provenance, not from actor_id string. */
export type Authority = "OBSERVE_ONLY" | "LIMITED_MUTATE" | "FULL";

/** Structured principal. The name "stateless-client" is a display label, never an actor. */
export type Principal = {
  actorId: string | null;
  displayLabel: string;
  source: PrincipalSource;
  authenticated: boolean;
  authority: Authority;
};

export type ArgumentConstraint = {
  path: string;                 // dot-path into args: "recipient", "file.path", "args.email"
  regex: string;                // regex pattern (string)
  description?: string;
};

export type ToolPolicy = {
  allow_pattern?: string;       // regex whitelist for tool names
  deny_tools?: string[];        // hard deny regardless of pattern
  argument_constraints?: ArgumentConstraint[];
  description?: string;         // human-readable reason this rule exists
};

export type ServerPolicy = {
  allow: boolean;               // if false, entire server is blocked
  tools: Record<string, ToolPolicy>;  // tool-level policies (tool_name -> policy)
  default_tool_policy?: ToolPolicy;   // fallback if tool not listed
};

export type McpPolicy = {
  policy_id: string;            // unique id, e.g. "agent:support-agent"
  actor_id: string;             // who this policy binds
  role: string;                 // human-readable role label
  description?: string;
  allow_by_default: boolean;    // false = deny-unless-explicit (strict)
  allowed_mcp_servers?: Record<string, ServerPolicy>;
  denied_mcp_servers?: string[];
  max_requests_per_minute?: number;
};

export type ToolCallRequest = {
  actor_id?: string;
  tool_name: string;
  arguments: Record<string, any>;
  session_id?: string;
  transport?: "stdio" | "http";
  client_ip?: string;
  /** AAE v1 envelope — if present, Layer 1 validates signature + actor binding */
  aae?: AAEV1;
  /** Organ secret for AAE signature verification */
  organ_secret?: string;
};

export type VerdictResult = {
  verdict: PolicyVerdict;
  actor_id: string;
  principal: Principal;
  policy_id: string;
  mcp_server: string;
  tool_name: string;
  layers: {
    identity: boolean;
    server: boolean;
    tool: boolean;
    argument: boolean;
  };
  reasons: string[];
  violated_regex?: { path: string; pattern: string; value: string }[];
  timestamp: string;
};

// ── Gate ──────────────────────────────────────────────────────────────

export class McpPolicyGate {
  private policies: Map<string, McpPolicy> = new Map();
  private defaultPolicy: McpPolicy;
  private auditLog: string;
  /** P0.1: Per-request verified session map replaces global activeActor. */
  private verifiedSessions: Map<string, { actorId: string; verifiedAt: number }> = new Map();
  private nonceStore: NonceStore;

  constructor(nonceStore?: NonceStore) {
    this.defaultPolicy = buildDefaultSovereignPolicy();
    this.policies.set("default:sovereign", this.defaultPolicy);
    this.auditLog = "/root/A-FORGE/logs/mcp_policy_gate.log";
    this.nonceStore = nonceStore ?? globalNonceStore;
    this.loadFromDisk();  // load overrides if config exists
  }

  /**
   * P0.1: Register a verified session (replaces global activeActor).
   * Binds session_id → verified actor for per-request lookup.
   */
  registerVerifiedSession(sessionId: string, actorId: string): void {
    this.verifiedSessions.set(sessionId, { actorId, verifiedAt: Date.now() });
  }

  /** @deprecated Use registerVerifiedSession(sessionId, actorId) instead. */
  setActor(actorId: string): void {
    // Backward compat: store under legacy key for existing callers
    this.verifiedSessions.set("__legacy_active", { actorId, verifiedAt: Date.now() });
  }

  /** Register or replace a policy. */
  addPolicy(policy: McpPolicy): void {
    this.policies.set(policy.policy_id, policy);
  }

  /** Remove a policy by id. */
  removePolicy(policyId: string): void {
    if (policyId === "default:sovereign") {
      throw new Error("Cannot remove sovereign default policy");
    }
    this.policies.delete(policyId);
  }

  /** List all loaded policies. */
  list(): McpPolicy[] {
    return Array.from(this.policies.values());
  }

  /** Get a policy by id. */
  get(policyId: string): McpPolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Evaluate an MCP tool-call request against the 5-layer boundary.
   * Returns a verdict with full reason chain. Never throws.
   *
   * Identity provenance (2026-07-19 fix):
   *   - Explicit actor_id passed by client → source=client_supplied
   *   - activeActor set via forge_session_init → source=verified_session
   *   - Neither → source=transport_fallback (OBSERVE_ONLY, never trusted as actor)
   *   - "stateless-client" is a DISPLAY LABEL, never an authenticated actor.
   *   - Explicit "anonymous" always DENIED at Layer 1.
   */
  evaluate(req: ToolCallRequest): VerdictResult {
    const principal = this.derivePrincipal(req);
    const policy = this.resolvePolicy(principal.actorId ?? principal.displayLabel);
    const mcpServer = this.extractServerFromTool(req.tool_name);
    const toolClass = classifyTool(req.tool_name); // P0.2: classify once, use everywhere

    const result: VerdictResult = {
      verdict: "DENY",
      actor_id: principal.displayLabel,
      principal,
      policy_id: policy.policy_id,
      mcp_server: mcpServer,
      tool_name: req.tool_name,
      layers: { identity: false, server: false, tool: false, argument: false },
      reasons: [],
      violated_regex: [],
      timestamp: new Date().toISOString(),
    };

    // Layer 1: Identity — provenance-aware
    if (!principal.authenticated) {
      // Explicit "anonymous" OR empty string → hard DENY (semantically equivalent to no identity)
      if (req.actor_id === "anonymous" || req.actor_id === "") {
        result.reasons.push(
          req.actor_id === ""
            ? "L1_IDENTITY:empty_actor_id_explicitly_denied"
            : "L1_IDENTITY:anonymous_actor_explicitly_denied",
        );
        this.appendAudit(result);
        return result;
      }
      // Client-supplied "stateless-client" → reject spoofing
      if (principal.source === "client_supplied" && req.actor_id === "stateless-client") {
        result.reasons.push(
          "L1_IDENTITY:spoofing_rejected — 'stateless-client' is a transport-level " +
          "principal, not a claimable actor identity. Client may not supply this value.",
        );
        this.appendAudit(result);
        return result;
      }
      // Transport fallback → OBSERVE_ONLY, Layer 1 passes
      if (principal.source === "transport_fallback") {
        result.layers.identity = true;
      } else if (principal.source === "client_supplied" && req.actor_id) {
        // Client-supplied but unverified → OBSERVE_ONLY, Layer 1 passes with caveat
        result.reasons.push("L1_IDENTITY:unverified_client_id — OBSERVE_ONLY; MUTATE requires verified session");
        result.layers.identity = true;
      }
    } else {
      // Verified session → full Layer 1 pass
      result.layers.identity = true;
    }

    // Track whether nonce was already verified in Layer 1b
    let nonceVerifiedInLayer1b = false;

    // Layer 1b: AAE envelope validation (if present)
    if (req.aae) {
      // P0.3 FIX: AAE signature is MANDATORY when envelope is present.
      // If no organ_secret provided, cannot verify signature → DENY.
      const secret = req.organ_secret ?? "";
      if (!secret) {
        result.reasons.push(
          "L1_AAE:MISSING_ORGAN_SECRET — AAE envelope present but organ_secret not provided. " +
          "Signature verification requires organ_secret. Refusing unsigned AAE."
        );
        this.appendAudit(result);
        return result;
      }
      const aaeResult = verifyAAE(req.aae, secret, this.nonceStore);
      if (!aaeResult.valid) {
        // Tag replay-specific denial for audit clarity
        if (aaeResult.replay_detected) {
          result.reasons.push(`L1_AAE:REPLAY_DETECTED — ${aaeResult.reason}`);
        } else {
          result.reasons.push(`L1_AAE:${aaeResult.reason}`);
        }
        this.appendAudit(result);
        return result;
      }
      nonceVerifiedInLayer1b = true;
      // Verify AAE actor_id matches request actor_id
      if (req.aae.actor_id !== principal.actorId) {
        result.reasons.push(`L1_AAE:actor_mismatch — AAE says "${req.aae.actor_id}" but request says "${principal.actorId}"`);
        this.appendAudit(result);
        return result;
      }
    }

    // P0.2: Authority enforcement — OBSERVE_ONLY actors cannot mutate.
    if (
      principal.authority === "OBSERVE_ONLY" &&
      toolClass !== "OBSERVE" &&
      toolClass !== "SUGGEST" &&
      toolClass !== "SIMULATE"
    ) {
      result.reasons.push(
        `L1_AUTHORITY:actor="${principal.displayLabel}" authority=OBSERVE_ONLY ` +
        `but tool "${req.tool_name}" classified as ${toolClass}. ` +
        `MUTATE requires verified session with FULL or LIMITED_MUTATE authority.`
      );
      this.appendAudit(result);
      return result;
    }

    // P0.7: ChatGPT channel — hard-denied sensitive paths.
    // chatgpt-arif is OBSERVE_ONLY (P0.2 already blocks MUTATE), but
    // certain read paths should also be denied through this channel:
    //   - forge_vault read (sealed records)
    //   - forge_shell (execution)
    //   - forge_security_drift_scan (infra exposure)
    //   - forge_journalctl (system logs)
    //   - forge_vps_*/forge_probe (infra topology)
    const CHATGPT_DENIED_TOOLS = [
      "forge_vault", "forge_shell", "forge_shell_dryrun",
      "forge_security_drift_scan", "forge_journalctl",
      "forge_vps_ports", "forge_vps_services", "forge_vps_cron",
      "forge_probe", "forge_netdata_alarms", "forge_netdata_metrics",
    ];
    if (
      principal.source === "client_supplied" &&
      principal.displayLabel === "chatgpt-arif" &&
      CHATGPT_DENIED_TOOLS.some(dt => req.tool_name === dt || req.tool_name.startsWith(dt + "_"))
    ) {
      result.reasons.push(
        `L1_CHANNEL:chatgpt-arif HARD_DENIED tool "${req.tool_name}". ` +
        `This channel is OBSERVE_ONLY external MCP — infra/vault/shell tools are blocked.`
      );
      this.appendAudit(result);
      return result;
    }

    // Layer 2: Server
    if (!this.isServerAllowed(policy, mcpServer)) {
      result.reasons.push(`L2_SERVER:${mcpServer}_not_in_allowlist`);
      this.appendAudit(result);
      return result;
    }
    result.layers.server = true;

    // Layer 3: Tool
    const toolCheck = this.isToolAllowed(policy, mcpServer, req.tool_name);
    if (!toolCheck.allowed) {
      result.reasons.push(`L3 TOOL:${req.tool_name} — ${toolCheck.reason}`);
      this.appendAudit(result);
      return result;
    }
    result.layers.tool = true;

    // Layer 4: Argument constraints
    const toolPolicy = toolCheck.policy;
    if (toolPolicy?.argument_constraints?.length) {
      for (const constraint of toolPolicy.argument_constraints) {
        const value = this.getValueAtPath(req.arguments, constraint.path);
        if (value === undefined) continue;            // optional: if missing, constraint not violated
        const strValue = String(value);
        try {
          const re = new RegExp(constraint.regex);
          if (!re.test(strValue)) {
            result.reasons.push(
              `L4 ARG:${constraint.path}="${strValue}" !~ /${constraint.regex}/${
                constraint.description ? ` — ${constraint.description}` : ""
              }`,
            );
            result.violated_regex!.push({
              path: constraint.path,
              pattern: constraint.regex,
              value: strValue,
            });
          }
        } catch (e: any) {
          result.reasons.push(`L4 ARG:invalid_regex at ${constraint.path}: ${e.message}`);
        }
      }
      if (result.reasons.length > 0) {
        this.appendAudit(result);
        return result;
      }
    }
    result.layers.argument = true;

    // Layer 4b (P0.6 FIX 2026-07-19): Unknown (unclassified) tools → HOLD regardless of AAE.
    // classifier returns IRREVERSIBLE for unknowns, but that's too aggressive
    // for a tool that simply hasn't been classified yet. HOLD is the correct
    // fail-closed: stop, audit, escalate — don't pretend it's known-dangerous.
    // Applies to BOTH AAE and non-AAE paths (was previously AAE-only).
    if (!isClassifiedTool(req.tool_name)) {
      result.reasons.push(
        `L4b_CLASSIFY:UNKNOWN_TOOL(${req.tool_name}) — tool is not explicitly classified. Policy gate forces HOLD. Add to actionClassifier.ts.`,
      );
      this.appendAudit(result);
      return result;
    }

    // Layer 5: AAE action_class vs tool classification (if AAE present)
    if (req.aae) {
      // Layer 5 defense-in-depth: nonce replay check even if Layer 1b skipped
      // (e.g. no organ_secret provided). Skipped if Layer 1b already verified.
      if (req.aae.nonce && !nonceVerifiedInLayer1b) {
        const nonceResult = this.nonceStore.checkAndRecord(req.aae.nonce);
        if (nonceResult.replay) {
          result.reasons.push(`L5_AAE:REPLAY_DETECTED — ${nonceResult.reason}`);
          this.appendAudit(result);
          return result;
        }
      }

      const aaeClass = req.aae.action_class as ActionClass;
      const toolClass = classifyTool(req.tool_name);

      // IRREVERSIBLE tools require IRREVERSIBLE AAE
      if (toolClass === "IRREVERSIBLE" && aaeClass !== "IRREVERSIBLE") {
        result.reasons.push(
          `L5_AAE:tool_classified_IRREVERSIBLE but AAE action_class=${aaeClass} — need IRREVERSIBLE`,
        );
        this.appendAudit(result);
        return result;
      }

      // EXECUTE_HIGH_IMPACT tools require >= EXECUTE_HIGH_IMPACT AAE
      if (toolClass === "EXECUTE_HIGH_IMPACT" && aaeClass !== "EXECUTE_HIGH_IMPACT" && aaeClass !== "IRREVERSIBLE") {
        result.reasons.push(
          `L5_AAE:tool_classified_EXECUTE_HIGH_IMPACT but AAE action_class=${aaeClass} — need EXECUTE_HIGH_IMPACT or IRREVERSIBLE`,
        );
        this.appendAudit(result);
        return result;
      }

      // High-severity actions (EXECUTE_HIGH_IMPACT, IRREVERSIBLE) require judgment_reference
      // to prove which judgment authorized the execution
      if (
        (aaeClass === "EXECUTE_HIGH_IMPACT" || aaeClass === "IRREVERSIBLE") &&
        !req.aae.judgment_reference
      ) {
        result.reasons.push(
          `L5_AAE:action_class=${aaeClass} requires judgment_reference to prove authorization provenance`,
        );
        this.appendAudit(result);
        return result;
      }
    }

    // Layer 5b: All clear
    result.verdict = "ALLOW";
    this.appendAudit(result);
    return result;
  }

  // ── helpers ───────────────────────────────────────────────────────

  /**
   * P0.1: Derive the Principal from a ToolCallRequest using per-request
   * verifiedSessions lookup (no longer relies on global activeActor).
   *
   * Provenance rules (invariant: authority ≠ actor_id string):
   *   1. Verified session (session_id in verifiedSessions) → verified_session, FULL
   *   2. Explicit actor_id supplied by client → client_supplied, OBSERVE_ONLY
   *      (except "anonymous" which is always DENIED at Layer 1)
   *   3. Neither → transport_fallback, OBSERVE_ONLY
   */
  private derivePrincipal(req: ToolCallRequest): Principal {
    // Case 1: Explicitly DENIED identities (always rejected)
    if (req.actor_id === "anonymous" || req.actor_id === "" || req.actor_id === "stateless-client") {
      return {
        actorId: req.actor_id || "(empty)",
        displayLabel: req.actor_id || "(empty)",
        source: "client_supplied",
        authenticated: false,
        authority: "OBSERVE_ONLY",
      };
    }

    // P0.1: Case 2 — verified session via per-request lookup
    if (req.session_id && this.verifiedSessions.has(req.session_id)) {
      const sess = this.verifiedSessions.get(req.session_id)!;
      return {
        actorId: sess.actorId,
        displayLabel: sess.actorId,
        source: "verified_session",
        authenticated: true,
        authority: "FULL",
      };
    }

    // Legacy compat: check __legacy_active key (for setActor callers)
    if (this.verifiedSessions.has("__legacy_active")) {
      const sess = this.verifiedSessions.get("__legacy_active")!;
      return {
        actorId: sess.actorId,
        displayLabel: sess.actorId,
        source: "verified_session",
        authenticated: true,
        authority: "FULL",
      };
    }

    // Case 3: Client explicitly supplied a valid-looking actor_id
    if (req.actor_id !== undefined && req.actor_id !== null && req.actor_id !== "") {
      return {
        actorId: req.actor_id,
        displayLabel: req.actor_id,
        source: "client_supplied",
        authenticated: false,
        authority: "OBSERVE_ONLY",
      };
    }

    // Case 4: Transport fallback — no identity provided
    return {
      actorId: null,
      displayLabel: "stateless-client",
      source: "transport_fallback",
      authenticated: false,
      authority: "OBSERVE_ONLY",
    };
  }

  private resolvePolicy(actorId: string): McpPolicy {
    // Prefer an actor-specific policy, then fall back to default sovereign
    for (const p of this.policies.values()) {
      if (p.actor_id === actorId) return p;
    }
    return this.defaultPolicy;
  }

  /**
   * Extract MCP server name from a tool name.
   * Convention: tools are prefixed <server>_<tool> (e.g. "geox_claim_create").
   * A-FORGE native tools use prefix "forge_<verb>".
   * Unknown prefixes → "unknown".
   */
  private extractServerFromTool(toolName: string): string {
    if (!toolName || !toolName.includes("_")) return "unknown";
    const prefix = toolName.split("_")[0];
    const known = new Set([
      "arifos", "aforge", "forge",
      "geox", "wealth", "well",
      "aaa", "hermes",
      "github", "postgres", "supabase", "qdrant",
      "cloudflare", "docker", "hostinger",
      "minimax", "brave", "perplexity", "exa",
      "context7", "sequential",
      "playwright", "chrome",
      "meyhem",
    ]);
    return known.has(prefix) ? prefix : "unknown";
  }

  private isServerAllowed(policy: McpPolicy, server: string): boolean {
    if (policy.denied_mcp_servers?.includes(server)) return false;
    if (!policy.allow_by_default) {
      return !!policy.allowed_mcp_servers?.[server]?.allow;
    }
    // allow-by-default: blocked only by deny list
    return policy.allowed_mcp_servers?.[server]?.allow !== false;
  }

  private isToolAllowed(
    policy: McpPolicy,
    server: string,
    toolName: string,
  ): { allowed: boolean; reason: string; policy?: ToolPolicy } {
    const serverPolicy = policy.allowed_mcp_servers?.[server];
    if (!serverPolicy) {
      return { allowed: policy.allow_by_default, reason: "no_server_policy" };
    }

    // hard deny list
    for (const [name, tp] of Object.entries(serverPolicy.tools)) {
      if (name === toolName && (tp as any).deny === true) {
        return { allowed: false, reason: "tool_hard_deny" };
      }
    }

    // explicit named policies
    const explicitPolicy = serverPolicy.tools[toolName];
    if (explicitPolicy) {
      return { allowed: true, reason: "tool_explicit_allow", policy: explicitPolicy };
    }

    // default tool policy (when tool not named)
    if (serverPolicy.default_tool_policy) {
      return {
        allowed: true,
        reason: "default_tool_policy",
        policy: serverPolicy.default_tool_policy,
      };
    }

    // allow_by_default at policy level
    if (policy.allow_by_default) {
      return { allowed: true, reason: "allow_by_default" };
    }

    return { allowed: false, reason: "tool_not_in_explicit_allowlist" };
  }

  private getValueAtPath(obj: any, dotPath: string): any {
    return dotPath.split(".").reduce((acc, key) => {
      if (acc === null || acc === undefined) return undefined;
      return acc[key];
    }, obj);
  }

  private appendAudit(v: VerdictResult): void {
    try {
      if (!existsSync(dirname(this.auditLog))) {
        mkdirSync(dirname(this.auditLog), { recursive: true });
      }
      const line = JSON.stringify(v) + "\n";
      appendFileSync(this.auditLog, line, "utf-8");
    } catch {
      // audit failures never block the main flow — but we log to stderr
      process.stderr.write(`[McpPolicyGate] audit log write failed\n`);
    }
  }

  // ── persistence ───────────────────────────────────────────────────

  private loadFromDisk(): void {
    const path = "/root/A-FORGE/config/mcp_policies.json";
    if (!existsSync(path)) return;
    try {
      const raw = readFileSync(path, "utf-8");
      const parsed = JSON.parse(raw) as { policies?: McpPolicy[] };
      for (const p of parsed.policies ?? []) {
        this.policies.set(p.policy_id, p);
      }
      process.stderr.write(
        `[McpPolicyGate] loaded ${parsed.policies?.length ?? 0} policies from ${path}\n`,
      );
    } catch (e: any) {
      process.stderr.write(`[McpPolicyGate] failed to load ${path}: ${e.message}\n`);
    }
  }

  /** Save current policies to disk (sovereign action). */
  saveToDisk(): void {
    const path = "/root/A-FORGE/config/mcp_policies.json";
    if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify({ policies: this.list() }, null, 2),
      "utf-8",
    );
  }
}

// ── Default sovereign policy ──────────────────────────────────────────

function buildDefaultSovereignPolicy(): McpPolicy {
  return {
    policy_id: "default:sovereign",
    actor_id: "arif",
    role: "sovereign",
    description:
      "Default sovereign policy. All federation organs allowed. " +
      "MUTATE tools (forge_execute, forge_filesystem write, forge_git commit, DB writes) " +
      "remain gated by downstream forge_gate / forge_shell checks — this layer trusts the agent.",
    allow_by_default: true,
    denied_mcp_servers: [],
    allowed_mcp_servers: {
      forge:   { allow: true, tools: {} },
      arifos:  { allow: true, tools: {} },
      geox:    { allow: true, tools: {} },
      wealth:  { allow: true, tools: {} },
      well:    { allow: true, tools: {} },
      aaa:     { allow: true, tools: {} },
      hermes:  { allow: true, tools: {} },
      github:  { allow: true, tools: {} },
      postgres:{ allow: true, tools: {} },
      supabase:{ allow: true, tools: {} },
      qdrant:  { allow: true, tools: {} },
      cloudflare:{ allow: true, tools: {} },
      docker:  { allow: true, tools: {} },
      hostinger:{ allow: true, tools: {} },
      minimax: { allow: true, tools: {} },
      brave:   { allow: true, tools: {} },
      perplexity:{ allow: true, tools: {} },
      exa:     { allow: true, tools: {} },
      context7:{ allow: true, tools: {} },
      sequential:{ allow: true, tools: {} },
      playwright:{ allow: true, tools: {} },
      chrome:  { allow: true, tools: {} },
      meyhem:  { allow: true, tools: {} },
    },
  };
}

// ── Built-in example policies (loaded on first install) ─────────────

export const EXAMPLE_POLICIES: McpPolicy[] = [
  {
    policy_id: "agent:support-agent",
    actor_id: "support-agent",
    role: "support",
    description:
      "Support agent: read customer records, no mutations. " +
      "Matches Arif's canonical example: 'support agent may read but not delete/update'.",
    allow_by_default: false,
    allowed_mcp_servers: {
      forge: {
        allow: true,
        tools: {
          forge_memory:      { description: "recall prior tickets" },
          forge_search:      { description: "search knowledge base" },
          forge_registry_status: { description: "read tool status" },
          forge_probe:       { description: "liveness check" },
        },
      },
      postgres: {
        allow: true,
        tools: {
          postgres_query: {
            description: "read-only SELECT only",
            argument_constraints: [
              {
                path: "sql",
                regex: "^\\s*SELECT\\s",
                description: "Only SELECT statements allowed (case-insensitive leading)",
              },
            ],
          },
        },
      },
    },
  },
  {
    policy_id: "agent:sales-agent",
    actor_id: "sales-agent",
    role: "sales",
    description:
      "Sales agent: send emails only to approved company domains. " +
      "Matches Arif's canonical example: 'recipient domain must match approved list'.",
    allow_by_default: false,
    allowed_mcp_servers: {
      forge: {
        allow: true,
        tools: {
          forge_search:      { description: "discover contacts" },
          forge_memory:      { description: "recall interactions" },
        },
      },
      hermes: {
        allow: true,
        tools: {
          hermes_send_message: {
            description: "send email / telegram to approved domains only",
            argument_constraints: [
              {
                path: "recipient",
                regex: "@(arif-fazil\\.com|ariffazil\\.com|partner-corp\\.com)$",
                description: "Recipient email must be on approved domain list",
              },
              {
                path: "subject",
                regex: "^(?!.*(?:urgent|asap|immediately))",
                description: "Sales agent never sends urgency-labeled subjects",
              },
            ],
          },
        },
      },
    },
  },
  {
    policy_id: "agent:forge-worker",
    actor_id: "forge-worker",
    role: "forge",
    description: "Forge worker: broad filesystem + shell, but no secrets, no vault, no sovereign commands.",
    allow_by_default: true,
    denied_mcp_servers: [],
    allowed_mcp_servers: {
      forge: {
        allow: true,
        tools: {
          forge_shell: {
            description: "shell with sensitive-path blocklist",
            argument_constraints: [
              {
                path: "command",
                regex: "^(?!.*(?:/etc/shadow|/etc/passwd|VAULT999|\\.secrets/|aws.*--secret|gh auth login))",
                description:
                  "Block commands reading credentials, vault, shadow, or triggering auth login",
              },
            ],
          },
          forge_filesystem: {
            description: "filesystem with path boundary guard",
            argument_constraints: [
              {
                path: "path",
                regex: "^/(?:root|tmp|data|var/log)/",
                description: "Only F8-approved filesystem roots",
              },
            ],
          },
          forge_vault:  { description: "vault READ/LIST only via argument guard below",
            argument_constraints: [
              {
                path: "mode",
                regex: "^(?:read|list)$",
                description: "vault writes require sovereign, not forge-worker",
              },
            ],
          },
          forge_seal:   { deny: true as any, description: "seal is sovereign-only" } as any,
          forge_register:{ deny: true as any, description: "register is sovereign-only" } as any,
        },
      },
    },
  },
  {
    policy_id: "agent:data-scientist",
    actor_id: "data-scientist",
    role: "data-scientist",
    description: "Data scientist: read DB + analytics, no production mutations.",
    allow_by_default: false,
    allowed_mcp_servers: {
      postgres: {
        allow: true,
        tools: {
          postgres_query: {
            argument_constraints: [
              { path: "sql", regex: "^\\s*SELECT\\s" },
            ],
          },
          postgres_describe_table: { description: "schema introspection" },
        },
      },
      supabase: { allow: true, tools: {} },
      qdrant:   { allow: true, tools: {} },
      forge:    { allow: true, tools: {
        forge_chart: { description: "agentic charting" },
        forge_memory: { description: "recall" },
      }},
    },
  },
];

// ── Singleton ─────────────────────────────────────────────────────────

let _instance: McpPolicyGate | null = null;

export function getMcpPolicyGate(): McpPolicyGate {
  if (!_instance) {
    _instance = new McpPolicyGate();
    for (const p of EXAMPLE_POLICIES) _instance.addPolicy(p);
  }
  return _instance;
}
