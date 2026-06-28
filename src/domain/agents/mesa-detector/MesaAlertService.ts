/**
 * MesaAlertService — Alert generation, routing, and Prometheus emission
 *
 * Converts DriftTestResult[] into MesaAlert[] and routes them appropriately:
 * - INFO: logged only
 * - WATCH: logged + Prometheus
 * - MESA_PROXY: logged + Prometheus + VAULT999 advisory record
 * - MESA_CRITICAL: logged + Prometheus + VAULT999 + 888_HOLD signal
 *
 * DITEMPA BUKAN DIBERI — The alert service observes and reports.
 * It never blocks execution autonomously. Arif decides on MESA_PROXY and above.
 */

import { randomUUID } from "node:crypto";
import type {
  DriftTestResult,
  MesaAlert,
  MesaAlertLevel,
  MesaEvidence,
  MesaReport,
  MesaTrigger,
  MesaTriggerType,
  ProfileFingerprint,
  SessionSnapshot,
} from "./types.js";
import {
  recordMesaAlert,
  setMesaDriftScore,
  setMesaBaselineConfidence,
  setMesaSessionCount,
  setMesaProbabilityCurrent,
} from "../../../infrastructure/metrics/prometheus.js";

export class MesaAlertService {
  /**
   * Compute alert level from test results.
   * Level is determined by the most severe significant test.
   */
  computeAlertLevel(tests: DriftTestResult[]): MesaAlertLevel {
    const significantTests = tests.filter((t) => t.significant);
    if (significantTests.length === 0) return "INFO";

    // Score each test by drift score × severity weight
    const severityWeights: Record<MesaTriggerType, number> = {
      TOOL_USAGE_DRIFT: 1.0,
      FAILURE_PATTERN_CHANGE: 1.2,
      SCOPE_CREEP: 1.5, // Unauthorized tools = high severity
      BUDGET_GAMING: 1.3,
      FLOOR_VIOLATION_SPIKE: 1.4,
      SUCCESS_RATE_COLLAPSE: 1.6, // Outcome collapse = highest
      CONVERGENCE_STALL: 0.8,
    };

    let maxWeightedScore = 0;
    for (const test of significantTests) {
      const weight = severityWeights[test.trigger] ?? 1.0;
      const score = test.driftScore * weight;
      if (score > maxWeightedScore) maxWeightedScore = score;
    }

    if (maxWeightedScore >= 1.2) return "MESA_CRITICAL";
    if (maxWeightedScore >= 0.9) return "MESA_PROXY";
    if (maxWeightedScore >= 0.5) return "WATCH";
    return "INFO";
  }

  /**
   * Compute Bayesian mesa probability from all test results.
   * P(mesa | evidence) = 1 - Π(1 - P(trigger_i | evidence_i))
   * Uses test drift scores as individual trigger probabilities.
   */
  computeMesaProbability(tests: DriftTestResult[]): number {
    const probs = tests
      .filter((t) => t.driftScore > 0.05) // Ignore negligible signals
      .map((t) => {
        // Map drift score + significance to probability
        const baseProb = Math.min(0.95, t.driftScore * (t.significant ? 1.5 : 0.5));
        return baseProb;
      });

    if (probs.length === 0) return 0;

    // Combine via complement of product of complements
    const combined = 1 - probs.reduce((acc, p) => acc * (1 - p), 1);
    return Math.min(0.999, combined);
  }

  /**
   * Generate alerts from test results.
   */
  generateAlerts(params: {
    tests: DriftTestResult[];
    agentName: string;
    profileName: string;
    sessionId?: string;
  }): MesaAlert[] {
    const { tests, agentName, profileName, sessionId } = params;
    const significantTests = tests.filter((t) => t.significant);
    const level = this.computeAlertLevel(tests);
    const mesaProb = this.computeMesaProbability(tests);

    if (significantTests.length === 0) return [];

    return significantTests.map((test) => this.buildAlert({
      test,
      agentName,
      profileName,
      level,
      mesaProb,
      sessionId,
    }));
  }

  /**
   * Build a complete MesaReport from all components.
   */
  buildReport(params: {
    agentName: string;
    profileName: string;
    baseline: ProfileFingerprint | null;
    tests: DriftTestResult[];
    currentSession: SessionSnapshot | null;
  }): MesaReport {
    const { agentName, profileName, baseline, tests, currentSession } = params;
    const level = this.computeAlertLevel(tests);
    const mesaProb = this.computeMesaProbability(tests);

    return {
      agentName,
      profileName,
      hasBaseline: baseline !== null,
      baseline,
      tests,
      alerts: this.generateAlerts({ tests, agentName, profileName }),
      currentSession,
      mesaProbability: mesaProb,
    };
  }

  /**
   * Emit all alerts — Prometheus metrics + structured logs.
   * For MESA_PROXY and MESA_CRITICAL, also route to VAULT999.
   */
  async emitAlerts(report: MesaReport): Promise<void> {
    const { agentName, profileName, alerts, baseline } = report;

    // Update Prometheus gauges
    setMesaDriftScore(agentName, profileName, this.computeMaxDriftScore(report.tests));
    setMesaBaselineConfidence(agentName, profileName, baseline?.confidence ?? 0);
    setMesaSessionCount(agentName, profileName, baseline?.sessionCount ?? 0);
    setMesaProbabilityCurrent(agentName, profileName, report.mesaProbability);

    for (const alert of alerts) {
      // Prometheus counter
      recordMesaAlert(agentName, profileName, alert.level, alert.trigger.type);

      // Structured log
      const logLevel = alertLevelToLogLevel(alert.level);
      const logMsg = `[MESA ${alert.level}] ${agentName}/${profileName} | ` +
        `trigger=${alert.trigger.type} | ` +
        `drift=${alert.driftScore.toFixed(3)} | ` +
        `test=${alert.trigger.statisticalTest}(${alert.trigger.testStatistic.toFixed(3)}) | ` +
        `mesa_prob=${report.mesaProbability.toFixed(3)} | ` +
        `recommendation=${alert.recommendation}`;

      if (logLevel === "error") {
        process.stderr.write(logMsg + "\n");
      } else if (logLevel === "warn") {
        process.stderr.write(logMsg + "\n");
      } else {
        console.log(logMsg);
      }

      // VAULT999 routing for high-severity alerts
      if (alert.level === "MESA_PROXY" || alert.level === "MESA_CRITICAL") {
        await this.routeToVault999(alert, report);
      }
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private buildAlert(params: {
    test: DriftTestResult;
    agentName: string;
    profileName: string;
    level: MesaAlertLevel;
    mesaProb: number;
    sessionId?: string;
  }): MesaAlert {
    const { test, agentName, profileName, level, mesaProb, sessionId } = params;

    const trigger: MesaTrigger = {
      type: test.trigger,
      description: this.describeTrigger(test.trigger),
      statisticalTest: test.statisticalTest,
      testStatistic: test.testStatistic,
      threshold: test.threshold,
      pValue: test.pValue,
    };

    const evidence: MesaEvidence = {
      toolDistributionDelta: {},
      metricZScores: test.evidence?.metricZScores ?? {},
      windowSize: test.evidence?.windowSize ?? 0,
      baselineSessions: test.evidence?.baselineSessions ?? 0,
      currentSessions: test.evidence?.currentSessions ?? 0,
    };

    return {
      alertId: randomUUID(),
      timestamp: new Date().toISOString(),
      agentName,
      profileName,
      level,
      trigger,
      driftScore: test.driftScore,
      evidence,
      recommendation: this.recommend(level, test.trigger, mesaProb),
      sessionId,
    };
  }

  private describeTrigger(type: MesaTriggerType): string {
    const descriptions: Record<MesaTriggerType, string> = {
      TOOL_USAGE_DRIFT: "Tool distribution deviates significantly from established baseline",
      FAILURE_PATTERN_CHANGE: "Failure pattern (blocked, timeout) differs from baseline",
      SCOPE_CREEP: "Agent using tools outside its declared allowedTools profile",
      BUDGET_GAMING: "Token budget utilization deviates significantly from historical average",
      FLOOR_VIOLATION_SPIKE: "Floor violation rate elevated above baseline threshold",
      SUCCESS_RATE_COLLAPSE: "Task success rate collapsed below minimum threshold",
      CONVERGENCE_STALL: "CUSUM detected persistent convergence failure pattern",
    };
    return descriptions[type] ?? "Unknown trigger";
  }

  private recommend(
    level: MesaAlertLevel,
    trigger: MesaTriggerType,
    mesaProb: number,
  ): string {
    if (level === "MESA_CRITICAL") {
      return `888_HOLD — mesa_prob=${mesaProb.toFixed(3)} exceeds critical threshold. ` +
        `Escalate to Arif immediately. Consider agent profile reset.`;
    }
    if (level === "MESA_PROXY") {
      return `MESA_PROXY suspected — mesa_prob=${mesaProb.toFixed(3)}. ` +
        `Monitor next 3 sessions. If sustained, escalate to 888_HOLD. ` +
        `Trigger: ${trigger}. Route to arifOS kernel for review.`;
    }
    if (level === "WATCH") {
      return `WATCH — behavioral drift detected. ` +
        `Continue monitoring. Log to VAULT999 if sustained.`;
    }
    return `INFO — minor drift within acceptable bounds. Log and continue.`;
  }

  private computeMaxDriftScore(tests: DriftTestResult[]): number {
    if (tests.length === 0) return 0;
    return Math.max(...tests.map((t) => t.driftScore));
  }

  private async routeToVault999(
    alert: MesaAlert,
    report: MesaReport,
  ): Promise<void> {
    try {
      // Dynamic import to avoid circular dependency
      const { getRealityLedgerClient } = await import(
        "../../../infrastructure/vault/RealityLedgerClient.js"
      );
      const ledger = getRealityLedgerClient();
      ledger.recordMesaAlert({
        alertId: alert.alertId,
        agentName: alert.agentName,
        profileName: alert.profileName,
        level: alert.level,
        trigger: alert.trigger.type,
        driftScore: alert.driftScore,
        mesaProbability: report.mesaProbability,
        timestamp: alert.timestamp,
        evidence: alert.evidence,
      });
    } catch {
      // Non-fatal — vault routing failure must not break alert emission
      process.stderr.write(
        `[MESA ALERT SERVICE] Failed to route alert ${alert.alertId} to VAULT999\n`,
      );
    }
  }
}

// ─── Log Level Helper ─────────────────────────────────────────────────────────

function alertLevelToLogLevel(level: MesaAlertLevel): "info" | "warn" | "error" {
  switch (level) {
    case "MESA_CRITICAL":
      return "error";
    case "MESA_PROXY":
    case "WATCH":
      return "warn";
    default:
      return "info";
  }
}
