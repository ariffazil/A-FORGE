/**
 * HumanInteractionGuard
 * ═══════════════════════
 *
 * Pre-interaction dignity guard for A-FORGE.
 * Uses existing arifOS canonical tools with mode="deepnshadow".
 * No new MCP surface. No new skill.
 *
 * Called before sensitive human interactions to:
 * 1. Encode observed behaviour
 * 2. Generate shadow hypotheses
 * 3. Check dignity boundaries
 * 4. Produce safe actions
 *
 * DITEMPA BUKAN DIBERI
 */

import type {
  DeepnShadowReport,
  BehaviourObservation,
  ShadowHypothesis,
  ScarVector,
  SafeAction,
  DignityStatus,
  InferenceMode,
  MetabolizedAction,
} from "../protocols/deepnshadow.js";

export interface ArifOSClient {
  callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export interface HumanInteractionGuardOptions {
  arifOSBaseUrl?: string;
  sessionId: string;
  actorId?: string;
  timeoutMs?: number;
}

export interface GuardResult {
  verdict: "SEAL" | "SABAR" | "HOLD" | "VOID";
  report?: DeepnShadowReport;
  safeAction?: string;
  dignityStatus: DignityStatus;
  notes: string[];
}

export class HumanInteractionGuard {
  private readonly baseUrl: string;
  private readonly sessionId: string;
  private readonly actorId: string;
  private readonly timeoutMs: number;

  constructor(options: HumanInteractionGuardOptions) {
    this.baseUrl = (options.arifOSBaseUrl ?? "http://localhost:8088").replace(/\/$/, "");  // live VPS port; override for Docker dev on 8080
    this.sessionId = options.sessionId;
    this.actorId = options.actorId ?? "a-forge";
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  /**
   * Run full DeepnShadow pipeline before a human interaction.
   */
  async guard(
    observations: Array<{ description: string; context?: string; evidenceClass?: string }>,
    hypotheses: Array<{ text: string; confidence?: number; evidenceClass?: string }>,
    mode: InferenceMode = "other",
  ): Promise<GuardResult> {
    const notes: string[] = [];

    // DS-111: Encode behaviours
    const encodedObs: BehaviourObservation[] = [];
    for (const obs of observations) {
      const result = await this._callTool("arif_sense_observe", {
        mode: "deepnshadow",
        query: obs.description,
        session_id: this.sessionId,
        actor_id: this.actorId,
      });
      if (result.observation) {
        encodedObs.push(result.observation as BehaviourObservation);
      }
    }

    // DS-333: Generate hypotheses
    const encodedHyps: ShadowHypothesis[] = [];
    for (const hyp of hypotheses) {
      const planId = crypto.randomUUID();
      const result = await this._callTool("arif_mind_reason", {
        mode: "deepnshadow",
        query: hyp.text,
        plan_id: planId,
        session_id: this.sessionId,
        actor_id: this.actorId,
      });
      if (result.hypothesis) {
        encodedHyps.push(result.hypothesis as ShadowHypothesis);
      }
      if (result.dignity_status === "hold") {
        notes.push(`HOLD: dignity violation in hypothesis "${hyp.text}"`);
      }
    }

    // DS-555: Check boundaries (use first scar-vector if provided)
    let scar: ScarVector | undefined;
    if (encodedHyps.length > 0) {
      const result = await this._callTool("arif_heart_critique", {
        mode: "deepnshadow",
        target: encodedHyps[0].trigger_vector ?? "uncertainty",
        session_id: this.sessionId,
        actor_id: this.actorId,
      });
      if (result.scar_vector) {
        scar = result.scar_vector as ScarVector;
      }
    }

    // DS-777: Metabolize safe action
    let safeAction: SafeAction | undefined;
    if (encodedHyps.length > 0) {
      const result = await this._callTool("arif_reply_compose", {
        mode: "deepnshadow",
        message: `Clarify scope and acceptance criteria for: ${encodedHyps[0].hypothesis_text}`,
        style: "neutral",
        session_id: this.sessionId,
        actor_id: this.actorId,
      });
      if (result.metabolized_action) {
        const meta = result.metabolized_action as MetabolizedAction;
        safeAction = meta.action;
      }
    }

    // Determine overall dignity
    let dignityStatus: DignityStatus = "safe";
    if (encodedHyps.some((h) => h.dignity_status === "hold")) {
      dignityStatus = "hold";
    } else if (encodedHyps.some((h) => h.dignity_status === "guarded")) {
      dignityStatus = "guarded";
    }

    const verdict = dignityStatus === "hold" ? "HOLD" : dignityStatus === "guarded" ? "SABAR" : "SEAL";

    const report: DeepnShadowReport = {
      report_id: crypto.randomUUID(),
      session_id: this.sessionId,
      mode,
      observations: encodedObs,
      patterns: [],
      hypotheses: encodedHyps,
      alternative_explanations: encodedHyps.flatMap((h) => h.alternative_explanations ?? []),
      projection_mirrors: [],
      scar_vectors: scar ? [scar] : [],
      safe_actions: safeAction ? [safeAction] : [],
      metabolized_actions: [],
      team_patterns: [],
      overall_dignity_status: dignityStatus,
      overall_confidence: encodedHyps.length
        ? encodedHyps.reduce((s, h) => s + h.confidence, 0) / encodedHyps.length
        : 0,
      verdict,
      constitutional_notes: [
        "F02: All hypotheses are hypotheses, not truths.",
        "F05: Shadow maps are for Arif's private navigation only.",
        "F06: No human was reduced to a label in this report.",
        "F13: Arif retains veto over any safe action.",
      ],
    };

    return {
      verdict,
      report,
      safeAction: safeAction?.action_text,
      dignityStatus,
      notes,
    };
  }

  private async _callTool(
    tool: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/mcp/v1/tools/${tool}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tool,
          arguments: args,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        return { status: "HOLD", error: `HTTP ${response.status}` };
      }
      const payload = (await response.json()) as Record<string, unknown>;
      const content = Array.isArray(payload.content) ? (payload.content as Array<Record<string, unknown>>) : [];
      return (content[0]?.json ?? payload.result ?? payload) as Record<string, unknown>;
    } catch (err) {
      return { status: "HOLD", error: String(err) };
    } finally {
      clearTimeout(timeout);
    }
  }
}
