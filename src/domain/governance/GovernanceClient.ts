/**
 * Governance Client
 *
 * Abstracts constitutional evaluation so the Agent plane can ask
 * the Governance plane for permission before executing.
 *
 * Design:
 * - LocalGovernanceClient runs floors in-process (default/fallback)
 * - HttpGovernanceClient delegates to an external arifOS governance service
 */

import {
  checkWitness,
  checkEmpathy,
  checkAntiHantu,
  type WitnessThresholds,
} from "./index.js";

export type GovernanceVerdict = "SEAL" | "HOLD" | "SABAR" | "VOID";

export type GovernanceRequest = {
  task: string;
  sessionId: string;
  intentModel?: string;
  riskLevel?: string;
  context?: Record<string, unknown>;
};

export type GovernanceResponse = {
  verdict: GovernanceVerdict;
  floorsTriggered: string[];
  message?: string;
};

export interface GovernanceClient {
  evaluate(request: GovernanceRequest): Promise<GovernanceResponse>;
}

export class LocalGovernanceClient implements GovernanceClient {
  constructor(private readonly thresholds?: { f3?: WitnessThresholds }) {}

  async evaluate(request: GovernanceRequest): Promise<GovernanceResponse> {
    const floorsTriggered: string[] = [];

    // F3: Witness — skip short tasks that F6 will likely block anyway
    const harmCheck = checkEmpathy(request.task);
    const isLikelyHarm = harmCheck.verdict === "VOID";
    const clarity = isLikelyHarm ? { verdict: "PASS" as const } : checkWitness(request.task, this.thresholds?.f3);
    if (clarity.verdict === "SABAR") {
      // Only SABAR if F6 didn't catch it first
      floorsTriggered.push("F3");
      return { verdict: "SABAR", floorsTriggered, message: clarity.message };
    }

    // F6: Empathy
    const harm = checkEmpathy(request.task);
    if (harm.verdict === "VOID") {
      floorsTriggered.push("F6");
      return { verdict: "VOID", floorsTriggered, message: harm.message };
    }

    // F9: Anti-Hantu
    const injection = checkAntiHantu(request.task, {
      sessionId: request.sessionId,
      hasTelemetry: !!request.context?.hasTelemetry,
      pipelineStage: request.context?.pipelineStage as string | undefined,
    });
    if (injection.verdict === "VOID") {
      floorsTriggered.push("F9");
      return { verdict: "VOID", floorsTriggered, message: injection.message };
    }

    return { verdict: "SEAL", floorsTriggered };
  }
}

export class HttpGovernanceClient implements GovernanceClient {
  constructor(private readonly baseUrl: string, private readonly timeoutMs = 5000) {}

  async evaluate(request: GovernanceRequest): Promise<GovernanceResponse> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/governance/evaluate`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`Governance service returned ${response.status}`);
      }

      const body = (await response.json()) as GovernanceResponse;
      return {
        verdict: body.verdict ?? "HOLD",
        floorsTriggered: body.floorsTriggered ?? [],
        message: body.message,
      };
    } catch (error) {
      clearTimeout(timer);
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[WARN] Governance service unreachable (${message}); failing closed to HOLD\n`);
      return {
        verdict: "HOLD",
        floorsTriggered: ["F1"],
        message: `Governance service unreachable: ${message}`,
      };
    }
  }
}
