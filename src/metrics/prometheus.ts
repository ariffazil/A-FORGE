import { Counter, Gauge, Histogram } from "prom-client";
import type { MetabolicStage } from "../types/aki.js";

const metabolicStageDuration = new Histogram({
  name: "arifos_metabolic_stage_duration_seconds",
  help: "Duration of A-FORGE runtime stages in seconds.",
  labelNames: ["stage"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
});

const floorViolationTotal = new Counter({
  name: "arifos_floor_violation_total",
  help: "Count of governance floor violations.",
  labelNames: ["floor", "severity"],
});

const humanEscalationTotal = new Counter({
  name: "arifos_human_escalation_total",
  help: "Count of human escalation events.",
  labelNames: ["risk_level", "domain"],
});

const humanDecisionTotal = new Counter({
  name: "arifos_human_decision_total",
  help: "Count of human decisions recorded for escalation tickets.",
  labelNames: ["decision", "domain", "risk_level"],
});

const humanEscalationLatencySeconds = new Histogram({
  name: "arifos_human_escalation_latency_seconds",
  help: "Latency between escalation dispatch and human decision in seconds.",
  labelNames: ["domain"],
  buckets: [1, 5, 10, 30, 60, 300, 900, 1800, 3600, 14400, 86400],
});

const holdOpenTotal = new Gauge({
  name: "arifos_hold_open_total",
  help: "Current number of open approval holds.",
});

const bridgeContractMismatchTotal = new Counter({
  name: "arifos_bridge_contract_mismatch_total",
  help: "Count of A-FORGE / arifOS bridge contract mismatches.",
  labelNames: ["reason"],
});

export async function runStage<T>(stage: MetabolicStage, fn: () => Promise<T>): Promise<T> {
  const end = metabolicStageDuration.startTimer({ stage });
  try {
    return await fn();
  } finally {
    end();
  }
}

export function recordFloorViolation(floor: string, severity: string): void {
  floorViolationTotal.inc({ floor, severity });
}

export function recordHumanEscalation(riskLevel: string, domain?: string): void {
  humanEscalationTotal.inc({ risk_level: riskLevel, domain: domain ?? "unspecified" });
}

export function recordHumanDecision(
  decision: string,
  domain: string,
  riskLevel?: string,
): void {
  humanDecisionTotal.inc({
    decision,
    domain,
    risk_level: riskLevel ?? "unspecified",
  });
}

export function recordEscalationLatency(seconds: number, domain: string): void {
  humanEscalationLatencySeconds.observe({ domain }, seconds);
}

export function setOpenHolds(count: number): void {
  holdOpenTotal.set(count);
}

export function recordBridgeContractMismatch(reason: string): void {
  bridgeContractMismatchTotal.inc({ reason });
}


