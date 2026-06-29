/**
 * WELL Readiness / Human Substrate Gate
 *
 * Reads the live WELL health surface and converts reflective substrate
 * signals into local execution pacing for A-FORGE. WELL remains
 * REFLECT_ONLY; A-FORGE decides whether to pause execution.
 *
 * @module governance/wellReadiness
 * @constitutional W0 — Operator sovereignty invariant (modulates pace, does not command)
 */

export type WellVerdict = "PASS" | "SABAR" | "HOLD";

export interface WellReadinessResult {
  verdict: WellVerdict;
  score: number;
  fatigue: number;
  floors_violated: string[];
  message: string;
  source: string;
  signal: string | null;
  truthStatus: string | null;
  freshnessBand: string | null;
  hasVerifiedTelemetry: boolean;
  stateAgeHours: number | null;
}

type RiskLevel = "low" | "medium" | "high" | "critical";

type WellHealthPayload = {
  identity?: string;
  authority?: string;
  well_signal?: string;
  well_score?: number | null;
  floors_violated?: string[];
  truth_status?: string | null;
  has_metrics?: boolean;
  has_verified_telemetry?: boolean;
  clarity?: number | null;
  freshness_band?: string | null;
  state_age_hours?: number | null;
  freshness?: {
    status?: string | null;
  };
  metrics?: {
    cognitive?: {
      decision_fatigue?: number | null;
    };
  };
};

function blockedTelemetryResult(
  riskLevel: RiskLevel,
  message: string,
  source: string,
): WellReadinessResult {
  return {
    verdict: riskLevel === "low" || riskLevel === "medium" ? "SABAR" : "HOLD",
    score: 0,
    fatigue: 0,
    floors_violated: [],
    message,
    source,
    signal: null,
    truthStatus: null,
    freshnessBand: null,
    hasVerifiedTelemetry: false,
    stateAgeHours: null,
  };
}

export async function checkWellReadiness(riskLevel: RiskLevel = "high"): Promise<WellReadinessResult> {
  const healthUrl = process.env.WELL_HEALTH_URL ?? "http://127.0.0.1:18083/health";

  let state: WellHealthPayload;
  try {
    const response = await fetch(healthUrl, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      return blockedTelemetryResult(
        riskLevel,
        `WELL health probe failed (${response.status}). High-impact execution requires live substrate telemetry.`,
        healthUrl,
      );
    }
    state = (await response.json()) as WellHealthPayload;
  } catch {
    return blockedTelemetryResult(
      riskLevel,
      "WELL telemetry unavailable. High-impact execution requires a live substrate signal before proceeding.",
      healthUrl,
    );
  }

  const score = typeof state.well_score === "number" ? state.well_score : 0;
  const violations = state.floors_violated ?? [];
  const fatigue = typeof state.metrics?.cognitive?.decision_fatigue === "number"
    ? state.metrics.cognitive.decision_fatigue
    : 0;
  const truthStatus = state.truth_status ?? null;
  const freshnessBand = state.freshness?.status ?? state.freshness_band ?? null;
  const signal = state.well_signal ?? null;
  const clarity = typeof state.clarity === "number" ? state.clarity : null;
  const stateAgeHours = typeof state.state_age_hours === "number" ? state.state_age_hours : null;
  const hasVerifiedTelemetry = state.has_verified_telemetry === true;
  const hasMetrics = state.has_metrics === true;

  let verdict: WellVerdict = "PASS";
  const messages: string[] = [];

  if (state.identity !== "WELL" || state.authority !== "REFLECT_ONLY") {
    verdict = "HOLD";
    messages.push("HOLD: WELL identity or authority invariant failed. Substrate signal cannot be trusted for execution gating.");
  } else if (!hasMetrics || !hasVerifiedTelemetry) {
    verdict = riskLevel === "critical" ? "HOLD" : "SABAR";
    messages.push("SABAR: WELL reports insufficient verified telemetry. Refresh human injection before consequential execution.");
  } else if (freshnessBand === "stale" || freshnessBand === "expired") {
    verdict = riskLevel === "critical" || riskLevel === "high" ? "HOLD" : "SABAR";
    messages.push(`HOLD: WELL telemetry freshness is ${freshnessBand}. Inject fresh biometric state before consequential execution.`);
  } else if (truthStatus === "INSUFFICIENT_DATA" || truthStatus === "UNVERIFIED") {
    verdict = riskLevel === "critical" ? "HOLD" : "SABAR";
    messages.push(`SABAR: WELL truth status is ${truthStatus}. Execution intensity must wait for stronger substrate evidence.`);
  } else if (signal?.includes("HOLD")) {
    verdict = riskLevel === "low" ? "SABAR" : "HOLD";
    messages.push(`HOLD: WELL signalled ${signal}. High-impact execution paused until substrate condition clears.`);
  } else if (violations.length > 0) {
    if (riskLevel === "high" || riskLevel === "critical") {
      verdict = "HOLD";
      messages.push(`HOLD: Substrate flagging ${violations.join(", ")}. High-risk execution blocked until operator state recovers.`);
    } else {
      verdict = "SABAR";
      messages.push(`SABAR: Substrate flagging ${violations.join(", ")}. Strategic bandwidth restricted.`);
    }
  } else if (score < 60 || fatigue > 7 || (clarity !== null && clarity < 40)) {
    if (riskLevel === "critical" || riskLevel === "high") {
      verdict = "HOLD";
      messages.push(`HOLD: Operator load critical (score=${score}, fatigue=${fatigue}, clarity=${clarity ?? "unknown"}).`);
    } else {
      verdict = "SABAR";
      messages.push(`SABAR: Operator capacity low (score=${score}, fatigue=${fatigue}). Caution mode engaged.`);
    }
  } else if (score < 80 || fatigue > 4 || (clarity !== null && clarity < 65)) {
    if (riskLevel === "critical" || riskLevel === "high") {
      verdict = "SABAR";
      messages.push(`SABAR: Elevated operator load (score=${score}, fatigue=${fatigue}, clarity=${clarity ?? "unknown"}). Higher scrutiny required.`);
    } else {
      messages.push("PASS: Substrate functional. Normal execution permitted.");
    }
  } else {
    messages.push("PASS: Substrate nominal. Full forge bandwidth available.");
  }

  return {
    verdict,
    score,
    fatigue,
    floors_violated: violations,
    message: messages.join(" | "),
    source: healthUrl,
    signal,
    truthStatus,
    freshnessBand,
    hasVerifiedTelemetry,
    stateAgeHours,
  };
}

