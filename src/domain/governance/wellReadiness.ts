/**
 * WELL Readiness / Human Substrate Gate
 *
 * Implements the Operator-State Modulation required by the A-FORGE 2.0 Blue Map.
 * Reads the telemetry mirrored by WELL and imposes caution or high scrutiny
 * if the operator is fatigued.
 *
 * @module governance/wellReadiness
 * @constitutional W0 — Operator sovereignty invariant (modulates pace, does not command)
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type WellVerdict = "PASS" | "SABAR" | "HOLD";

export interface WellReadinessResult {
  verdict: WellVerdict;
  score: number;
  fatigue: number;
  floors_violated: string[];
  message: string;
}

export async function checkWellReadiness(riskLevel: "low" | "medium" | "high" | "critical" = "high"): Promise<WellReadinessResult> {
  const statePath = resolve(process.cwd(), "WELL", "state.json");
  
  let state: any;
  try {
    const data = await readFile(statePath, "utf-8");
    state = JSON.parse(data);
  } catch (error) {
    // If WELL is unavailable, fail open but log. The Human Substrate defaults to PASS if unmonitored.
    return {
      verdict: "PASS",
      score: 100,
      fatigue: 0,
      floors_violated: [],
      message: "WELL telemetry unavailable — assuming nominal operator readiness.",
    };
  }

  const score = state.well_score ?? 100;
  const violations = state.floors_violated ?? [];
  const fatigue = state.metrics?.cognitive?.decision_fatigue ?? 0;

  // Decision logic based on Operator State and Task Risk
  let verdict: WellVerdict = "PASS";
  const messages: string[] = [];

  if (violations.length > 0) {
    if (riskLevel === "high" || riskLevel === "critical") {
      verdict = "HOLD";
      messages.push(`HOLD: Substrate flagging ${violations.join(", ")}. High-risk execution blocked until operator rests.`);
    } else {
      verdict = "SABAR";
      messages.push(`SABAR: Substrate flagging ${violations.join(", ")}. Strategic bandwidth restricted.`);
    }
  } else if (score < 60 || fatigue > 7) {
    if (riskLevel === "critical") {
      verdict = "HOLD";
      messages.push(`HOLD: Operator fatigue critical (Score ${score}, Fatigue ${fatigue}). Critical execution blocked.`);
    } else {
      verdict = "SABAR";
      messages.push(`SABAR: Operator capacity low (Score ${score}). Caution mode engaged.`);
    }
  } else if (score < 80 || fatigue > 4) {
    if (riskLevel === "critical" || riskLevel === "high") {
      verdict = "SABAR";
      messages.push(`SABAR: Elevated operator load. Higher scrutiny required for wealth/capital decisions.`);
    } else {
      messages.push(`PASS: Substrate functional. Normal execution permitted.`);
    }
  } else {
    messages.push(`PASS: Substrate optimal. Full forge bandwidth available.`);
  }

  return {
    verdict,
    score,
    fatigue,
    floors_violated: violations,
    message: messages.join(" | "),
  };
}


