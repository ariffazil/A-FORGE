/**
 * ActGateClient — TypeScript client for the arifOS ACT Gate (Gate 2.6).
 * ============================================================================
 *
 * Calls the arifOS ACT module via MCP to enforce execution craft patterns:
 *   - Stage verification (can't proceed to N+1 if N failed)
 *   - Dry-run requirement for irreversible + high blast
 *   - Canary requirement for high blast
 *   - Human coordination for irreversible + high blast
 *   - Compensation plan requirement for irreversible
 *
 * This is the HOW layer, called AFTER ART (what tool) and Kernel (is it lawful).
 * Every A-FORGE execution that exceeds OBSERVE passes through this gate.
 *
 * Usage:
 *   import { actCheck, ActGateBlockedError } from "./ActGateClient.js";
 *
 *   const gate = await actCheck({
 *     actionClass: "IRREVERSIBLE",
 *     blastRadius: "infrastructure",
 *     isReversible: false,
 *     sessionId: req.session_id,
 *   });
 *
 *   if (!gate.allowed) {
 *     throw new ActGateBlockedError(gate);
 *   }
 *
 * Forged: 2026-06-21 — ACT layer, sibling of ART
 * DITEMPA BUKAN DIBERI — Execution craft is forged, not given
 */

// ACT gate calls the arifOS pre_execution_gate which has ACT wired as Gate 2.6.
// We use the same MCP call path as other governance checks.
const ARIFOS_MCP_URL = process.env.ARIFOS_MCP_URL || "http://127.0.0.1:8088";
const ACT_GATE_TIMEOUT_MS = parseInt(process.env.ACT_GATE_TIMEOUT_MS || "5000", 10);

export interface ActGateRequest {
  actionClass: string;
  blastRadius?: string;
  isReversible?: boolean;
  isMultiStep?: boolean;
  stageNumber?: number;
  totalStages?: number;
  hasDryRun?: boolean;
  hasCompensation?: boolean;
  humanAcknowledged?: boolean;
  previousStageVerified?: boolean;
  sessionId?: string;
  actorId?: string;
}

export interface ActGateResult {
  allowed: boolean;
  verdict: "PROCEED" | "HOLD" | "BLOCK" | "DRY_RUN_REQUIRED" | "CANARY_REQUIRED" | "COMPENSATION_REQUIRED" | "HUMAN_REQUIRED";
  reason: string;
  recommendedPattern?: string;
  requiredActions: string[];
}

export class ActGateBlockedError extends Error {
  public gateResult: ActGateResult;
  constructor(gateResult: ActGateResult) {
    super(`ACT Gate blocked: ${gateResult.verdict} — ${gateResult.reason}`);
    this.name = "ActGateBlockedError";
    this.gateResult = gateResult;
  }
}

/**
 * Convert A-FORGE action class to ACT blast radius string.
 */
function actionClassToBlastRadius(actionClass: string): string {
  switch (actionClass) {
    case "OBSERVE":
    case "SUGGEST":
    case "SIMULATE":
    case "DRAFT":
      return "low";
    case "QUEUE":
    case "EXECUTE_REVERSIBLE":
      return "medium";
    case "EXECUTE_HIGH_IMPACT":
      return "high";
    case "IRREVERSIBLE":
      return "high";
    default:
      return "unknown";
  }
}

/**
 * Check if an action is reversible based on its class.
 */
function actionClassIsReversible(actionClass: string): boolean {
  switch (actionClass) {
    case "OBSERVE":
    case "SUGGEST":
    case "SIMULATE":
    case "DRAFT":
    case "QUEUE":
    case "EXECUTE_REVERSIBLE":
      return true;
    case "EXECUTE_HIGH_IMPACT":
    case "IRREVERSIBLE":
      return false;
    default:
      return true;
  }
}

/**
 * Call the arifOS ACT Gate (Gate 2.6) via MCP.
 *
 * Falls back to local determination if the arifOS MCP is unreachable.
 * This ensures ACT gates are never a single point of failure.
 */
export async function actCheck(request: ActGateRequest): Promise<ActGateResult> {
  const {
    actionClass,
    blastRadius,
    isReversible,
    isMultiStep = false,
    stageNumber = 1,
    totalStages = 1,
    hasDryRun = false,
    hasCompensation = false,
    humanAcknowledged = false,
    previousStageVerified = true,
    sessionId,
  } = request;

  const radius = blastRadius || actionClassToBlastRadius(actionClass);
  const reversible = isReversible !== undefined ? isReversible : actionClassIsReversible(actionClass);

  // Try to call arifOS MCP for the ACT gate verdict
  try {
    const url = `${ARIFOS_MCP_URL}/mcp`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ACT_GATE_TIMEOUT_MS);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "arif_act_check",
          arguments: {
            action_class: actionClass.toLowerCase(),
            blast_radius: radius,
            is_reversible: reversible,
            is_multi_step: isMultiStep,
            stage_number: stageNumber,
            total_stages: totalStages,
            has_dry_run: hasDryRun,
            has_compensation: hasCompensation,
            human_acknowledged: humanAcknowledged,
            previous_stage_verified: previousStageVerified,
          },
        },
        id: "act-gate-" + Date.now(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`ACT gate HTTP ${response.status}`);
    }

    const data = await response.json() as any;
    const content = data?.result?.content?.[0]?.text;
    if (content) {
      const parsed = JSON.parse(content);
      return {
        allowed: parsed.verdict === "proceed",
        verdict: mapActVerdict(parsed.verdict),
        reason: parsed.reason || "ACT gate processed",
        recommendedPattern: parsed.recommended_pattern,
        requiredActions: buildRequiredActions(parsed.verdict, parsed.reason),
      };
    }
  } catch (err) {
    console.error(`[ACT-GATE] MCP call failed (${err}) — falling back to local check`);
  }

  // ── Fallback: local ACT gate logic ──
  return localActCheck(actionClass, radius, reversible, isMultiStep, humanAcknowledged);
}

/**
 * Fallback ACT gate — runs locally if MCP is unreachable.
 * Mirrors the Python act.py logic.
 */
function localActCheck(
  actionClass: string,
  blastRadius: string,
  isReversible: boolean,
  isMultiStep: boolean,
  humanAcknowledged: boolean,
): ActGateResult {
  // HIGH blast + irreversible → needs dry run
  if (blastRadius === "high" && !isReversible) {
    return {
      allowed: false,
      verdict: "DRY_RUN_REQUIRED",
      reason: `HIGH blast radius + irreversible — dry run required before live execution`,
      recommendedPattern: "dry_run_then_live",
      requiredActions: ["Run forge_dry_run first", "Get human acknowledgment"],
    };
  }

  // HIGH blast → needs canary or staging
  if (blastRadius === "high") {
    return {
      allowed: false,
      verdict: "CANARY_REQUIRED",
      reason: `HIGH blast radius — canary deployment required`,
      recommendedPattern: "canary_then_all",
      requiredActions: ["Deploy to 1% first", "Verify health", "Then full rollout"],
    };
  }

  // MEDIUM blast + irreversible → needs dry run
  if ((blastRadius === "medium" || blastRadius === "unknown") && !isReversible) {
    return {
      allowed: false,
      verdict: "DRY_RUN_REQUIRED",
      reason: `${blastRadius} blast radius + irreversible — dry run required`,
      recommendedPattern: "dry_run_then_live",
      requiredActions: ["Run forge_dry_run first"],
    };
  }

  // Multi-step → needs staging
  if (isMultiStep) {
    return {
      allowed: false,
      verdict: "HOLD",
      reason: `Multi-step program — explicit staging pattern required`,
      recommendedPattern: "staged_rollout",
      requiredActions: ["Define stages", "Add checkpoints between stages"],
    };
  }

  // LOW blast + reversible → proceed
  return {
    allowed: true,
    verdict: "PROCEED",
    reason: `All checks passed — safe to execute`,
    recommendedPattern: "single_shot",
    requiredActions: [],
  };
}

/**
 * Map ACT Python verdict string to TypeScript enum.
 */
function mapActVerdict(verdict: string): ActGateResult["verdict"] {
  switch (verdict) {
    case "proceed": return "PROCEED";
    case "hold": return "HOLD";
    case "block": return "BLOCK";
    case "dry_run_required": return "DRY_RUN_REQUIRED";
    case "canary_required": return "CANARY_REQUIRED";
    case "compensation_required": return "COMPENSATION_REQUIRED";
    case "human_required": return "HUMAN_REQUIRED";
    default: return "HOLD";
  }
}

/**
 * Build required actions list from ACT verdict.
 */
function buildRequiredActions(verdict: string, reason: string): string[] {
  switch (verdict) {
    case "dry_run_required":
      return ["Run forge_dry_run first"];
    case "canary_required":
      return ["Deploy to 1% first", "Verify health", "Then full rollout"];
    case "compensation_required":
      return ["Define compensation plan"];
    case "human_required":
      return ["Get human acknowledgment"];
    case "block":
      return ["Redesign execution plan"];
    default:
      return [];
  }
}
