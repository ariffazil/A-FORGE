/**
 * MesaFingerprintEngine — Compute behavioral fingerprints from session data
 *
 * Converts raw RunMetrics + tool call logs into a behavioral fingerprint
 * that can be compared against the established baseline.
 *
 * Key signals monitored:
 * 1. Tool usage distribution — deviation from expected tool proportions
 * 2. Failure patterns — new failure types, blocked action rates
 * 3. Scope creep — tools not in allowedTools list being called
 * 4. Budget gaming — under/over utilization vs historical average
 * 5. Convergence signals — early termination vs excessive iteration
 */

import type { AgentProfile } from "../../types/agent.js";
import type {
  ProfileFingerprint,
  SessionSnapshot,
} from "./types.js";

export class MesaFingerprintEngine {
  /**
   * Build a session snapshot from live agent run data.
   */
  buildSessionSnapshot(params: {
    sessionId: string;
    agentName: string;
    profile: AgentProfile;
    toolCallsByType: Record<string, number>;
    floorsTriggered: string[];
    metrics: SessionSnapshot["metrics"];
  }): SessionSnapshot {
    const { sessionId, agentName, profile, toolCallsByType, floorsTriggered, metrics } = params;

    const totalCalls = Object.values(toolCallsByType).reduce((a, b) => a + b, 0);

    // Tool distribution as probabilities
    const toolDistribution: Record<string, number> = {};
    if (totalCalls > 0) {
      for (const [tool, count] of Object.entries(toolCallsByType)) {
        toolDistribution[tool] = count / totalCalls;
      }
    }

    return {
      agentName,
      sessionId,
      timestamp: new Date().toISOString(),
      profileName: profile.name,
      toolDistribution,
      metrics,
      floorsTriggered,
    };
  }

  /**
   * Compare current session fingerprint against baseline.
   * Returns per-signal deltas for drift detection.
   */
  compareToBaseline(
    current: SessionSnapshot,
    baseline: ProfileFingerprint,
  ): FingerprintDelta {
    const totalCurrent = Object.values(current.toolDistribution).reduce((a, b) => a + b, 0);
    const totalBaseline = Object.values(baseline.toolDistribution).reduce((a, b) => a + b, 0);

    // Tool distribution delta
    const allTools = new Set([
      ...Object.keys(current.toolDistribution),
      ...Object.keys(baseline.toolDistribution),
    ]);

    const toolDeltas: Record<string, { observed: number; expected: number; delta: number }> = {};
    for (const tool of allTools) {
      const obs = current.toolDistribution[tool] ?? 0;
      const exp = baseline.toolDistribution[tool] ?? 0;
      toolDeltas[tool] = {
        observed: obs,
        expected: exp,
        delta: obs - exp,
      };
    }

    // Scalar metric deltas (z-score equivalent)
    const zTurns = this.zScore(current.metrics.turnsUsed, baseline.avgTurns, baseline.sessionCount);
    const zToolCalls = this.zScore(current.metrics.toolCalls, baseline.avgToolCalls, baseline.sessionCount);
    const zBudget = this.zScore(
      (current.metrics.llmTokensIn + current.metrics.llmTokensOut) / 100_000,
      baseline.avgBudgetUtilization,
      baseline.sessionCount,
    );

    const successDelta = (current.metrics.taskSuccess === 1 ? 1 : 0) - baseline.successRate;
    const floorViolationDelta = current.floorsTriggered.length - baseline.floorViolationRate * baseline.sessionCount;
    const blockedDelta = (current.metrics.blockedDangerousActions > 0 ? 1 : 0) - baseline.blockedActionRate;

    return {
      toolDeltas,
      metricZScores: {
        turns: zTurns,
        toolCalls: zToolCalls,
        budget: zBudget,
        successRate: successDelta,
        floorViolations: floorViolationDelta,
        blockedActions: blockedDelta,
      },
      toolCount: totalCurrent,
      baselineToolCount: totalBaseline,
      sessionCount: baseline.sessionCount,
    };
  }

  /**
   * Compute normalized chi-square statistic for tool distribution.
   * Returns χ² value — higher means more drift.
   */
  chiSquare(current: SessionSnapshot, baseline: ProfileFingerprint): number {
    const allTools = new Set([
      ...Object.keys(current.toolDistribution),
      ...Object.keys(baseline.toolDistribution),
    ]);

    let chiSq = 0;
    for (const tool of allTools) {
      const obs = current.toolDistribution[tool] ?? 0;
      const exp = baseline.toolDistribution[tool] ?? 0;
      // Add small epsilon to avoid division by zero
      const denominator = Math.max(exp, 1e-6);
      chiSq += Math.pow(obs - exp, 2) / denominator;
    }

    return chiSq;
  }

  /**
   * Compute KL divergence D_KL(current || baseline) in nats.
   * D_KL(P||Q) = Σ P_i * log(P_i / Q_i)
   * Higher value means more divergence from expected behavior.
   */
  klDivergence(current: SessionSnapshot, baseline: ProfileFingerprint): number {
    const allTools = new Set([
      ...Object.keys(current.toolDistribution),
      ...Object.keys(baseline.toolDistribution),
    ]);

    let kl = 0;
    for (const tool of allTools) {
      const p = current.toolDistribution[tool] ?? 0;
      const q = baseline.toolDistribution[tool] ?? 1e-6; // Smoothing to avoid log(0)
      if (p > 0) {
        kl += p * Math.log(p / q);
      }
    }

    return Math.max(0, kl); // KL divergence is always non-negative
  }

  /**
   * Compute cumulative sum (CUSUM) statistic for detecting persistent drift.
   * Tracks if a signal is systematically above or below target.
   */
  cusum(
    recentSessions: SessionSnapshot[],
    baseline: ProfileFingerprint,
    targetKey: keyof SessionSnapshot["metrics"],
  ): { cusumPos: number; cusumNeg: number; drifting: boolean } {
    if (recentSessions.length === 0) {
      return { cusumPos: 0, cusumNeg: 0, drifting: false };
    }

    let cusumPos = 0;
    let cusumNeg = 0;
    const target = this.baselineScalar(baseline, targetKey);
    const slack = target * 0.1; // 10% slack

    for (const session of recentSessions) {
      const value = (session.metrics[targetKey] as number) ?? 0;
      const deviation = value - target - slack;
      cusumPos = Math.max(0, cusumPos + deviation);
      cusumNeg = Math.max(0, cusumNeg - deviation);
    }

    return {
      cusumPos,
      cusumNeg,
      drifting: cusumPos > 0 || cusumNeg > 0,
    };
  }

  /**
   * Detect scope creep — tools used that were not in the agent's allowedTools.
   */
  detectScopeCreep(
    toolDistribution: Record<string, number>,
    allowedTools: string[],
  ): { crept: boolean; unauthorizedTools: string[] } {
    const unauthorized: string[] = [];
    for (const tool of Object.keys(toolDistribution)) {
      // Check if tool matches any allowed pattern (supports wildcards like "forge_*")
      const isAllowed = allowedTools.some((allowed) => {
        if (allowed.endsWith("*")) {
          const prefix = allowed.slice(0, -1);
          return tool.startsWith(prefix);
        }
        return tool === allowed;
      });
      if (!isAllowed) {
        unauthorized.push(tool);
      }
    }
    return {
      crept: unauthorized.length > 0,
      unauthorizedTools: unauthorized,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private zScore(value: number, mean: number, n: number): number {
    if (n < 2) return 0;
    // Zero-mean spike: any non-zero value from zero-baseline is infinitely anomalous.
    // This is the correct behavior for floor violations — baseline 0 → 1 violation = spike.
    if (mean === 0) return value > 0 ? 99 : 0;
    // Approximate std dev from sample size (not perfect but sufficient for detection)
    const stdDev = Math.max(mean * 0.3, 1); // At least 30% of mean, or 1
    return (value - mean) / stdDev;
  }

  private baselineScalar(
    baseline: ProfileFingerprint,
    key: keyof SessionSnapshot["metrics"],
  ): number {
    switch (key) {
      case "turnsUsed":
        return baseline.avgTurns;
      case "toolCalls":
        return baseline.avgToolCalls;
      default:
        return 0;
    }
  }
}

export interface FingerprintDelta {
  toolDeltas: Record<string, { observed: number; expected: number; delta: number }>;
  metricZScores: Record<string, number>;
  toolCount: number;
  baselineToolCount: number;
  sessionCount: number;
}
