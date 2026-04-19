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

export interface GovernanceBridgeOptions {
  /** Base URL of the arifOS MCP runtime (e.g., http://localhost:8080) */
  baseUrl: string;
  /** Request timeout in ms */
  timeoutMs?: number;
  /** When true, local fallback is used even if HTTP fails */
  fallbackOnFailure?: boolean;
}

/** Local heuristic mirror of Python risk_tiers.py TOOL_RISK_MAP + SCOPE_ESCALATIONS */
const LOCAL_TOOL_RISK_MAP: Record<string, RiskTier> = {
  // T0 INERT — read-only
  arifos_init: "T0_INERT",
  arifos_sense: "T0_INERT",
  arifos_heart: "T0_INERT",
  arifos_ops: "T0_INERT",
  arifos_mind: "T0_INERT",
  arifos_memory: "T0_INERT",
  arifos_probe: "T0_INERT",
  arifos_reply: "T0_INERT",
  arifos_repo_read: "T0_INERT",
  // T1 REVERSIBLE
  arifos_vault: "T1_REVERSIBLE",
  arifos_forge: "T1_REVERSIBLE",
  arifos_gateway: "T1_REVERSIBLE",
  arifos_kernel: "T1_REVERSIBLE",
  arifos_judge: "T1_REVERSIBLE",
  arifos_plan: "T1_REVERSIBLE",
  arifos_repo_seal: "T1_REVERSIBLE",
  // T2 CONTROLLED
  arifos_diag_substrate: "T2_CONTROLLED",
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
    this.fallbackOnFailure = options.fallbackOnFailure ?? true;
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

  private _deriveToolName(script: string): string {
    const lowered = script.toLowerCase();
    if (lowered.includes("writefile") || lowered.includes("fs.write")) return "arifos_forge";
    if (lowered.includes("exec(") || lowered.includes("shell") || lowered.includes("spawn")) {
      return "arifos_diag_substrate";
    }
    if (lowered.includes("fetch(") || lowered.includes("post(") || lowered.includes("http")) {
      return "arifos_gateway";
    }
    if (lowered.includes("memory") && (lowered.includes("write") || lowered.includes("store"))) {
      return "arifos_memory";
    }
    return "arifos_sense";
  }
}
