/**
 * src/governance/GovernanceBridge.ts — A-FORGE ↔ arifOS Risk Tier Bridge
 *
 * Enables TypeScript CodeModeExecutor to send scripts to Python risk_tiers.py
 * for T0–T3 classification. T3 without holdEnabled triggers SABAR_HALT.
 *
 * Transport: HTTP POST to arifOS /governance/risk-classify endpoint.
 * Fallback: Local heuristic classifier when bridge is unreachable.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

export type RiskTier = "T0_INERT" | "T1_REVERSIBLE" | "T2_CONTROLLED" | "T3_IRREVERSIBLE";

export interface RiskClassificationResult {
  tier: RiskTier;
  requiresApproval: boolean;
  requiresF13: boolean;
  emitsReceipt: boolean;
  snapshotRequired: boolean;
  toolName: string;
}

export class SABARHaltError extends Error {
  readonly floorsTriggered = ["F13", "T3_HALT"];
  readonly tier: RiskTier = "T3_IRREVERSIBLE";
  constructor(message: string) {
    super(`[SABAR_HALT] ${message}`);
    this.name = "SABARHaltError";
  }
}

export interface ScalarReplica {
  value: number;
  status: "REPLICATED";
  source: "arifos.health";
  replicated_at: string;
  /**
   * KX-010 (VD-888-KX010-APEX-MEASUREMENT-CONTRACT-2026-10-27): verbatim
   * arifOS measurement_contract, replicated as-is when the kernel attached
   * one. Never interpreted or rewritten here — passthrough only.
   */
  measurement_contract?: Record<string, unknown>;
  /**
   * KX-010: surfaced INSTEAD of measurement_contract when arifOS shipped the
   * scalar without one. Legacy records are never retroactively promoted.
   */
  legacy?: "LEGACY_UNCONTRACTED";
}

export interface ApexScalarReplicaSet {
  G: ScalarReplica | null;
  C_dark: ScalarReplica | null;
  W3: ScalarReplica | null;
  h: ScalarReplica | null;
  QDF: ScalarReplica | null;
  source: string;
  fetched_at: string;
}

export interface GovernanceBridgeOptions {
  /** Base URL of the arifOS MCP runtime (e.g., http://localhost:8088) — live VPS port; use http://localhost:8080 for Docker dev */
  baseUrl: string;
  /** Request timeout in ms */
  timeoutMs?: number;
  /** When true, local fallback is used even if HTTP fails */
  fallbackOnFailure?: boolean;
}

/** Local heuristic mirror of Python risk_tiers.py TOOL_RISK_MAP + SCOPE_ESCALATIONS */
const LOCAL_TOOL_RISK_MAP: Record<string, RiskTier> = {
  // T0 INERT — read-only
  arif_session_init: "T0_INERT",
  arif_observe: "T0_INERT",
  arif_critique: "T0_INERT",
  arif_ops_measure: "T0_INERT",
  arif_mind_reason: "T0_INERT",
  arif_memory_recall: "T0_INERT",
  arif_reply_compose: "T0_INERT",
  arif_repo_read: "T0_INERT",
  // T1 REVERSIBLE
  arif_vault_seal: "T1_REVERSIBLE",
  arif_forge_execute: "T1_REVERSIBLE",
  arif_gateway_connect: "T1_REVERSIBLE",
  arif_kernel_route: "T1_REVERSIBLE",
  arif_judge_deliberate: "T1_REVERSIBLE",
  arif_plan_create: "T1_REVERSIBLE",
  arif_repo_seal: "T1_REVERSIBLE",
  // T2 CONTROLLED
  arif_diag_substrate: "T2_CONTROLLED",
  wealth_brent_score: "T2_CONTROLLED",
  wealth_npv_reward: "T2_CONTROLLED",
  wealth_irr_yield: "T2_CONTROLLED",
  wealth_dscr_leverage: "T2_CONTROLLED",
};

function localClassify(toolName: string, script: string): RiskClassificationResult {
  let tier: RiskTier = LOCAL_TOOL_RISK_MAP[toolName] ?? "T2_CONTROLLED";

  // Scope escalation heuristics from script content
  const lowered = script.toLowerCase();
  if (
    lowered.includes(".env") ||
    lowered.includes("fs.write") ||
    lowered.includes("writefile") ||
    lowered.includes("shell.exec") ||
    lowered.includes("spawn") ||
    lowered.includes("net.post") ||
    lowered.includes("fetch(")
  ) {
    tier = "T3_IRREVERSIBLE";
  }

  const requiresF13 = tier === "T3_IRREVERSIBLE";
  const requiresApproval = tier === "T2_CONTROLLED" || tier === "T3_IRREVERSIBLE";
  const emitsReceipt = tier !== "T0_INERT";
  const snapshotRequired = tier !== "T0_INERT";

  return {
    tier,
    requiresApproval,
    requiresF13,
    emitsReceipt,
    snapshotRequired,
    toolName,
  };
}

export class GovernanceBridge {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fallbackOnFailure: boolean;

  constructor(options: GovernanceBridgeOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.fallbackOnFailure = options.fallbackOnFailure ?? false;
  }

  /**
   * Classify a script via the arifOS Python risk_tiers classifier.
   *
   * @param script       The TypeScript code to classify
   * @param holdEnabled  If false and tier is T3, throws SABAR_HALT
   * @returns            RiskClassificationResult
   * @throws SABARHaltError when T3 and holdEnabled is false
   */
  async classifyScript(script: string, holdEnabled = false): Promise<RiskClassificationResult> {
    const httpResult = await this._httpClassify(script);
    const result = httpResult ?? localClassify(this._deriveToolName(script), script);

    if (result.tier === "T3_IRREVERSIBLE" && !holdEnabled) {
      throw new SABARHaltError(
        `T3_IRREVERSIBLE action blocked: holdEnabled=false. ` +
          `Tool=${result.toolName}. F13 sovereign approval required.`
      );
    }

    return result;
  }

  /**
   * Classify a known tool call (when tool name is already known).
   */
  async classifyTool(
    toolName: string,
    arguments_: Record<string, unknown>,
    holdEnabled = false,
  ): Promise<RiskClassificationResult> {
    const httpResult = await this._httpClassifyTool(toolName, arguments_);
    const result = httpResult ?? localClassify(toolName, JSON.stringify(arguments_));

    if (result.tier === "T3_IRREVERSIBLE" && !holdEnabled) {
      throw new SABARHaltError(
        `T3_IRREVERSIBLE action blocked: holdEnabled=false. ` +
          `Tool=${result.toolName}. F13 sovereign approval required.`
      );
    }

    return result;
  }

  /**
   * Fetch canonical G-fold from the arifOS APEX verification pipeline.
   *
   * Calls GET {baseUrl}/health and extracts apex_scalars.G.value.
   * Timeout 2s. Returns null on failure (graceful degradation).
   *
   * Layer 2 of the 4-layer forge gate: the canonical kernel G replaces
   * the local G = (A·P·E·X)^(1/4) estimate when available.
   */
  async fetchCanonicalG(): Promise<{ G: number; source: string } | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) return null;
      const body = (await response.json()) as Record<string, unknown>;

      // Navigate: body.apex_scalars.G.value
      const apexScalars = body.apex_scalars as Record<string, unknown> | undefined;
      if (!apexScalars) return null;
      const gField = apexScalars.G as Record<string, unknown> | undefined;
      if (!gField || typeof gField.value !== "number") return null;

      return { G: gField.value, source: `${this.baseUrl}/health` };
    } catch {
      return null;
    }
  }

  private async _httpClassify(script: string): Promise<RiskClassificationResult | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const response = await fetch(`${this.baseUrl}/governance/risk-classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, tool_name: this._deriveToolName(script) }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) return null;
      const body = (await response.json()) as Record<string, unknown>;
      return this._parseBody(body);
    } catch {
      return null;
    }
  }

  private async _httpClassifyTool(
    toolName: string,
    arguments_: Record<string, unknown>,
  ): Promise<RiskClassificationResult | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const response = await fetch(`${this.baseUrl}/governance/risk-classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool_name: toolName, arguments: arguments_ }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) return null;
      const body = (await response.json()) as Record<string, unknown>;
      return this._parseBody(body);
    } catch {
      return null;
    }
  }

  private _parseBody(body: Record<string, unknown>): RiskClassificationResult | null {
    if (typeof body.tier !== "string") return null;
    return {
      tier: body.tier as RiskTier,
      requiresApproval: Boolean(body.requires_approval ?? body.requiresApproval),
      requiresF13: Boolean(body.requires_f13 ?? body.requiresF13),
      emitsReceipt: Boolean(body.emits_receipt ?? body.emitsReceipt),
      snapshotRequired: Boolean(body.snapshot_required ?? body.snapshotRequired),
      toolName: String(body.tool_name ?? body.toolName ?? "unknown"),
    };
  }

  /**
   * Fetch psi_le (Life/Entropy Index) from arifOS kernel telemetry.
   *
   * Calls GET {baseUrl}/health and extracts governance.psi_vitality.
   * Timeout 2s. Returns null on failure (graceful degradation).
   *
   * ATP Pass 2: psi_le is the thermodynamic vitality scalar — it measures
   * the time-integration of honest memory (chain_length × seal_rate).
   * When unreachable, QDF stays PARTIAL (ATP HOLD, not VOID).
   */
  async fetchPsiLe(): Promise<{ psi_le: number; source: string } | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) return null;
      const body = (await response.json()) as Record<string, unknown>;

      // Navigate: body.governance.psi_vitality
      const governance = body.governance as Record<string, unknown> | undefined;
      if (!governance) return null;
      const psiVitality = governance.psi_vitality;
      if (typeof psiVitality !== "number") return null;

      return { psi_le: psiVitality, source: `${this.baseUrl}/health#governance.psi_vitality` };
    } catch {
      return null;
    }
  }

  /**
   * Replicate ALL apex scalars from arifOS /health.
   *
   * Calls GET {baseUrl}/health and extracts every scalar in apex_scalars.
   * Timeout 3s. Returns null for the entire result on total failure (graceful
   * degradation). Individual scalars that arifOS hasn't measured are returned
   * as null entries — partial responses are supported.
   *
   * F2 TRUTH: status is "REPLICATED", never "MEASURED" — A-FORGE did not
   * measure these values.
   * F7 HUMILITY: no false claims of measurement provenance.
   */
  async fetchApexScalars(): Promise<ApexScalarReplicaSet | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) return null;
      const body = (await response.json()) as Record<string, unknown>;

      const apexScalars = body.apex_scalars as Record<string, Record<string, unknown>> | undefined;
      if (!apexScalars) return null;

      const extractScalar = (key: string): ScalarReplica | null => {
        const field = apexScalars[key];
        if (!field || typeof field.value !== "number") return null;
        const replica: ScalarReplica = {
          value: field.value,
          status: "REPLICATED",
          source: "arifos.health",
          replicated_at: new Date().toISOString(),
        };
        // KX-010 passthrough: contract rides verbatim; its absence is named
        // LEGACY_UNCONTRACTED beside the value (never silently dropped, never
        // promoted). Consumers read .measurement_contract / .legacy.
        if (
          field.measurement_contract &&
          typeof field.measurement_contract === "object" &&
          !Array.isArray(field.measurement_contract)
        ) {
          replica.measurement_contract = field.measurement_contract as Record<string, unknown>;
        } else {
          replica.legacy = "LEGACY_UNCONTRACTED";
        }
        return replica;
      };

      return {
        G: extractScalar("G"),
        C_dark: extractScalar("C_dark"),
        W3: extractScalar("W3"),
        h: extractScalar("h"),
        QDF: extractScalar("QDF"),
        source: "arifos.health",
        fetched_at: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  private _deriveToolName(script: string): string {
    const lowered = script.toLowerCase();
    if (lowered.includes("writefile") || lowered.includes("fs.write")) return "arif_forge_execute";
    if (lowered.includes("exec(") || lowered.includes("shell") || lowered.includes("spawn")) {
      return "arif_diag_substrate";
    }
    if (lowered.includes("fetch(") || lowered.includes("post(") || lowered.includes("http")) {
      return "arif_gateway_connect";
    }
    if (lowered.includes("memory") && (lowered.includes("write") || lowered.includes("store"))) {
      return "arif_memory_recall";
    }
    return "arif_observe";
  }
}

// ── KX-010 consumer-side guards (A3 iii/v) ──────────────────────────────────
// Fail-closed consumption assertions for replicated apex scalars. These are
// pure functions on ScalarReplica so any consumer (server.ts, evaluate.ts,
// future gates) can gate arithmetic and scope-scoped reads without trusting
// the wire. Both THROW on violation — a violation is a caller bug, not a
// value of 0 (HOLD, not zero; 05-CONTRACT-SCHEMA fail_closed_rule).

/** Returns the declared unit string, or null when the replica carries no usable contract. */
function _declaredUnit(replica: ScalarReplica): string | null {
  const c = replica.measurement_contract;
  if (!c || typeof c !== "object") return null;
  const unit = (c as { unit?: unknown }).unit;
  return typeof unit === "string" && unit.length > 0 ? unit : null;
}

/**
 * A3(iii) — cross-unit arithmetic gate.
 * Both replicas must carry a measurement_contract declaring the SAME unit
 * before any arithmetic may combine them. A LEGACY_UNCONTRACTED replica (no
 * contract) is never unit-provable and is rejected — fail closed.
 *
 * @throws Error on missing contract or unit mismatch.
 */
export function assertSameUnit(a: ScalarReplica, b: ScalarReplica): void {
  const ua = _declaredUnit(a);
  const ub = _declaredUnit(b);
  if (ua === null || ub === null) {
    throw new Error(
      `KX010_UNIT_UNPROVABLE: cannot combine scalars without declared units ` +
        `(legacy=${ua === null ? "yes" : "no"}/${ub === null ? "yes" : "no"}). ` +
        `LEGACY_UNCONTRACTED values are never retroactively promoted.`
    );
  }
  if (ua !== ub) {
    throw new Error(`KX010_UNIT_MISMATCH: cannot combine unit='${ua}' with unit='${ub}'`);
  }
}

/**
 * A3(v) — scope-matched consumption gate.
 * Reading a replica for a NAMED consumer scope requires a contract whose
 * scope matches exactly. Unscoped or LEGACY_UNCONTRACTED replicas fail the
 * assertion (a named-scope read must be provably in scope; "no scope
 * declared" is not evidence of scope). Bare scalars without scope contracts
 * must be consumed without a scope requirement.
 *
 * @throws Error on missing contract/scope or scope mismatch.
 */
export function assertScopeAllows(replica: ScalarReplica, requiredScope: string): void {
  const c = replica.measurement_contract;
  const scope =
    c && typeof c === "object" && typeof (c as { scope?: unknown }).scope === "string"
      ? (c as { scope: string }).scope
      : null;
  if (scope === null) {
    throw new Error(
      `KX010_SCOPE_UNDECLARED: scope-gated read '${requiredScope}' needs a ` +
        `contract that declares scope; replica is LEGACY_UNCONTRACTED or unscoped`
    );
  }
  if (scope !== requiredScope) {
    throw new Error(
      `KX010_SCOPE_MISMATCH: contract scope='${scope}' does not authorize ` +
        `consumer scope='${requiredScope}'`
    );
  }
}

/**
 * A3(i/ii/iv/i-staleness) — decision-eligibility resolution for a replica.
 * Returns the contract's decision_eligibility when the contract is present,
 * fresh, and in range; otherwise "NONE" (fail closed, never zero/pass).
 *
 * Staleness policy (declared per A3): a contract is stale when
 * `valid_until` has elapsed OR when `observed_at` is older than
 * KX010_DEFAULT_MAX_AGE_MS (one documented default — 7 days, matching the
 * apex metrics window in apex_primitives.compute_apex_from_metrics). No
 * per-metric ad-hoc windows.
 *
 * expected_range: when the contract declares [low, high] and the value falls
 * outside, eligibility degrades to NONE. Composite components: when the
 * contract declares `components` and any named component is null/absent on
 * `components_present`, eligibility is NONE.
 */
export const KX010_DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function resolveDecisionEligibility(
  replica: ScalarReplica,
  now: Date = new Date()
): "DISPLAY_ONLY" | "ADVISORY" | "ROUTING" | "THRESHOLD_ALERT" | "HOLD_TRIGGER" | "AUTHORIZATION_INPUT" | "MUTATION_GATE" | "NONE" {
  const c = replica.measurement_contract;
  if (!c || typeof c !== "object") return "NONE"; // LEGACY_UNCONTRACTED
  const rec = c as {
    decision_eligibility?: unknown;
    valid_until?: unknown;
    observed_at?: unknown;
    expected_range?: unknown;
    components?: unknown;
    components_present?: unknown;
  };
  const declared = typeof rec.decision_eligibility === "string" ? rec.decision_eligibility : null;
  if (declared === null) return "NONE";
  if (declared === "NONE") return "NONE";
  // Staleness: valid_until elapsed -> NONE
  if (typeof rec.valid_until === "string") {
    const until = Date.parse(rec.valid_until);
    if (!Number.isNaN(until) && now.getTime() > until) return "NONE";
  }
  // Staleness: observed_at older than the one default max_age -> NONE
  if (typeof rec.observed_at === "string") {
    const at = Date.parse(rec.observed_at);
    if (!Number.isNaN(at) && now.getTime() - at > KX010_DEFAULT_MAX_AGE_MS) return "NONE";
  }
  // expected_range: out of range -> NONE
  if (
    Array.isArray(rec.expected_range) &&
    rec.expected_range.length === 2 &&
    typeof rec.expected_range[0] === "number" &&
    typeof rec.expected_range[1] === "number"
  ) {
    const [lo, hi] = rec.expected_range as [number, number];
    if (replica.value < lo || replica.value > hi) return "NONE";
  }
  // Composite null component -> NONE
  if (Array.isArray(rec.components) && rec.components.length > 0) {
    const present = rec.components_present;
    if (!present || typeof present !== "object") return "NONE";
    for (const name of rec.components as string[]) {
      const v = (present as Record<string, unknown>)[name];
      if (v === null || v === undefined) return "NONE";
    }
  }
  return declared as ReturnType<typeof resolveDecisionEligibility>;
}
