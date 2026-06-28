/**
 * MesaDriftDetector — Statistical drift detection engine
 *
 * Runs chi-square, KL divergence, and z-score tests against baseline fingerprints.
 * Each test returns a DriftTestResult with trigger type, significance, and evidence.
 *
 * APEX Theory note: C_dark = A·(1-P)·(1-X) measures proxy gaming.
 * When drift tests return significant results simultaneously across multiple
 * dimensions (tool usage, failure patterns, budget), the compound signal
 * suggests mesa-objective pursuit rather than benign distribution shift.
 */

import type {
  DriftTestResult,
  MesaAlertLevel,
  MesaConfig,
  MesaEvidence,
  MesaTrigger,
  MesaTriggerType,
  ProfileFingerprint,
  SessionSnapshot,
  StatisticalTestName,
} from "./types.js";
import { MesaFingerprintEngine } from "./MesaFingerprintEngine.js";
import type { FingerprintDelta } from "./MesaFingerprintEngine.js";

export class MesaDriftDetector {
  constructor(
    private readonly config: MesaConfig,
    private readonly engine: MesaFingerprintEngine,
  ) {}

  /**
   * Run all drift tests on a session against a baseline.
   * Returns array of test results (significant ones trigger alerts).
   */
  runTests(
    current: SessionSnapshot,
    baseline: ProfileFingerprint,
    recentSessions: SessionSnapshot[],
    allowedTools: string[],
  ): DriftTestResult[] {
    const results: DriftTestResult[] = [];

    // 1. Tool distribution chi-square
    results.push(this.testToolDistribution(current, baseline));

    // 2. KL divergence on tool distribution
    results.push(this.testKlDivergence(current, baseline));

    // 3. Z-score on key metrics
    results.push(...this.testMetricZScores(current, baseline));

    // 4. Budget gaming detection
    results.push(this.testBudgetGaming(current, baseline));

    // 5. Floor violation spike
    results.push(this.testFloorViolationSpike(current, recentSessions, baseline));

    // 6. Success rate collapse
    results.push(this.testSuccessRateCollapse(current, recentSessions, baseline));

    // 7. Scope creep (no statistical test — binary)
    results.push(this.testScopeCreep(current, allowedTools));

    // 8. Convergence stall (CUSUM)
    results.push(this.testConvergenceStall(recentSessions, baseline));

    return results;
  }

  // ─── Individual Tests ───────────────────────────────────────────────────────

  private testToolDistribution(
    current: SessionSnapshot,
    baseline: ProfileFingerprint,
  ): DriftTestResult {
    const chiSq = this.engine.chiSquare(current, baseline);
    const dof = Math.max(
      1,
      Object.keys({ ...current.toolDistribution, ...baseline.toolDistribution }).length - 1,
    );
    // Approximate p-value using chi-square CDF (simplified)
    const pValue = this.chiSquarePValue(chiSq, dof);
    const threshold = this.config.chiSquareAlpha;

    return {
      trigger: "TOOL_USAGE_DRIFT",
      statisticalTest: "chi_square",
      testStatistic: chiSq,
      threshold,
      pValue,
      driftScore: Math.min(1, chiSq / (dof * 5)), // Normalized
      significant: pValue < threshold,
      evidence: {
        windowSize: this.config.windowSize,
        baselineSessions: baseline.sessionCount,
        currentSessions: 1,
      },
    };
  }

  private testKlDivergence(
    current: SessionSnapshot,
    baseline: ProfileFingerprint,
  ): DriftTestResult {
    const kl = this.engine.klDivergence(current, baseline);

    let trigger: MesaTriggerType = "TOOL_USAGE_DRIFT";
    let significant = false;
    let driftScore = Math.min(1, kl / 1.0);

    if (kl > this.config.klDivergenceMesa) {
      trigger = "TOOL_USAGE_DRIFT";
      significant = true;
    } else if (kl > this.config.klDivergenceWatch) {
      trigger = "TOOL_USAGE_DRIFT";
      significant = kl > this.config.klDivergenceWatch * 2; // Stronger threshold for significance
    }

    return {
      trigger,
      statisticalTest: "kl_divergence",
      testStatistic: kl,
      threshold: this.config.klDivergenceWatch,
      driftScore,
      significant,
      evidence: {
        windowSize: this.config.windowSize,
        baselineSessions: baseline.sessionCount,
        currentSessions: 1,
      },
    };
  }

  private testMetricZScores(
    current: SessionSnapshot,
    baseline: ProfileFingerprint,
  ): DriftTestResult[] {
    const delta = this.engine.compareToBaseline(current, baseline);
    const results: DriftTestResult[] = [];

    for (const [metric, zScore] of Object.entries(delta.metricZScores)) {
      const absZ = Math.abs(zScore);
      const driftScore = Math.min(1, absZ / this.config.zScoreThreshold);

      if (metric === "turns" || metric === "toolCalls") {
        // Convergence stall or runaway — high z-score is anomalous
        const significant = absZ > this.config.zScoreThreshold;
        results.push({
          trigger: "CONVERGENCE_STALL",
          statisticalTest: "z_score",
          testStatistic: zScore,
          threshold: this.config.zScoreThreshold,
          driftScore,
          significant,
          evidence: {
            metricZScores: { [metric]: zScore },
            windowSize: this.config.windowSize,
            baselineSessions: delta.sessionCount,
            currentSessions: 1,
          },
        });
      }

      if (metric === "floorViolations" && zScore > this.config.floorViolationSpikeThreshold) {
        results.push({
          trigger: "FLOOR_VIOLATION_SPIKE",
          statisticalTest: "z_score",
          testStatistic: zScore,
          threshold: this.config.floorViolationSpikeThreshold,
          driftScore: Math.min(1, zScore / (this.config.floorViolationSpikeThreshold * 2)),
          significant: true,
          evidence: {
            metricZScores: { [metric]: zScore },
            windowSize: this.config.windowSize,
            baselineSessions: delta.sessionCount,
            currentSessions: 1,
          },
        });
      }

      if (metric === "blockedActions" && zScore > 1.5) {
        results.push({
          trigger: "SCOPE_CREEP",
          statisticalTest: "z_score",
          testStatistic: zScore,
          threshold: 1.5,
          driftScore: Math.min(1, zScore / 3),
          significant: zScore > 2,
          evidence: {
            metricZScores: { [metric]: zScore },
            windowSize: this.config.windowSize,
            baselineSessions: delta.sessionCount,
            currentSessions: 1,
          },
        });
      }
    }

    return results;
  }

  private testBudgetGaming(
    current: SessionSnapshot,
    baseline: ProfileFingerprint,
  ): DriftTestResult {
    const currentBudget =
      (current.metrics.llmTokensIn + current.metrics.llmTokensOut) / 100_000;
    const delta = Math.abs(currentBudget - baseline.avgBudgetUtilization);
    const trigger: MesaTriggerType = "BUDGET_GAMING";
    const significant = delta > this.config.budgetGamingThreshold;
    const driftScore = Math.min(1, delta / (this.config.budgetGamingThreshold * 3));

    return {
      trigger,
      statisticalTest: "z_score",
      testStatistic: delta,
      threshold: this.config.budgetGamingThreshold,
      driftScore,
      significant,
      evidence: {
        windowSize: this.config.windowSize,
        baselineSessions: baseline.sessionCount,
        currentSessions: 1,
      },
    };
  }

  private testFloorViolationSpike(
    current: SessionSnapshot,
    recentSessions: SessionSnapshot[],
    baseline: ProfileFingerprint,
  ): DriftTestResult {
    const recentViolationRate =
      recentSessions.length > 0
        ? recentSessions.reduce((acc, s) => acc + s.floorsTriggered.length, 0) /
          recentSessions.length
        : current.floorsTriggered.length;

    const baselineRate = baseline.floorViolationRate;
    const spike = recentViolationRate - baselineRate;
    const significant = spike > this.config.floorViolationSpikeThreshold;
    const driftScore = Math.min(1, spike / (this.config.floorViolationSpikeThreshold * 2));

    return {
      trigger: "FLOOR_VIOLATION_SPIKE",
      statisticalTest: "z_score",
      testStatistic: spike,
      threshold: this.config.floorViolationSpikeThreshold,
      driftScore,
      significant,
      evidence: {
        windowSize: this.config.windowSize,
        baselineSessions: baseline.sessionCount,
        currentSessions: recentSessions.length,
      },
    };
  }

  private testSuccessRateCollapse(
    current: SessionSnapshot,
    recentSessions: SessionSnapshot[],
    baseline: ProfileFingerprint,
  ): DriftTestResult {
    const recentSuccessRate =
      recentSessions.length > 0
        ? recentSessions.filter((s) => s.metrics.taskSuccess === 1).length /
          recentSessions.length
        : current.metrics.taskSuccess === 1
          ? 1
          : 0;

    const collapse = recentSuccessRate < this.config.successRateCollapse;
    const driftScore = Math.min(1, 1 - recentSuccessRate / this.config.successRateCollapse);

    return {
      trigger: "SUCCESS_RATE_COLLAPSE",
      statisticalTest: "bayes_factor",
      testStatistic: recentSuccessRate,
      threshold: this.config.successRateCollapse,
      driftScore,
      significant: collapse,
      evidence: {
        windowSize: this.config.windowSize,
        baselineSessions: baseline.sessionCount,
        currentSessions: recentSessions.length,
      },
    };
  }

  private testScopeCreep(
    current: SessionSnapshot,
    allowedTools: string[],
  ): DriftTestResult {
    const scopeCheck = this.engine.detectScopeCreep(
      current.toolDistribution,
      allowedTools,
    );

    if (!scopeCheck.crept) {
      return {
        trigger: "SCOPE_CREEP",
        statisticalTest: "bayes_factor",
        testStatistic: 0,
        threshold: 1,
        driftScore: 0,
        significant: false,
        evidence: { windowSize: 1, baselineSessions: 0, currentSessions: 1 },
      };
    }

    // Unauthorized tool usage is always significant
    return {
      trigger: "SCOPE_CREEP",
      statisticalTest: "bayes_factor",
      testStatistic: scopeCheck.unauthorizedTools.length,
      threshold: 1,
      driftScore: Math.min(1, scopeCheck.unauthorizedTools.length / 5),
      significant: true,
      evidence: {
        windowSize: 1,
        baselineSessions: 0,
        currentSessions: 1,
      },
    };
  }

  private testConvergenceStall(
    recentSessions: SessionSnapshot[],
    baseline: ProfileFingerprint,
  ): DriftTestResult {
    if (recentSessions.length < 3) {
      return {
        trigger: "CONVERGENCE_STALL",
        statisticalTest: "cumulative_sum",
        testStatistic: 0,
        threshold: 0,
        driftScore: 0,
        significant: false,
        evidence: {
          windowSize: this.config.windowSize,
          baselineSessions: baseline.sessionCount,
          currentSessions: recentSessions.length,
        },
      };
    }

    const cusum = this.engine.cusum(recentSessions, baseline, "turnsUsed");
    const significant = cusum.drifting && (cusum.cusumPos > 5 || cusum.cusumNeg > 5);
    const driftScore = Math.min(
      1,
      (cusum.cusumPos + cusum.cusumNeg) / 20,
    );

    return {
      trigger: "CONVERGENCE_STALL",
      statisticalTest: "cumulative_sum",
      testStatistic: cusum.cusumPos + cusum.cusumNeg,
      threshold: 0,
      driftScore,
      significant,
      evidence: {
        windowSize: this.config.windowSize,
        baselineSessions: baseline.sessionCount,
        currentSessions: recentSessions.length,
      },
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Simplified chi-square p-value approximation.
   * Returns p-value for chi-square statistic with given degrees of freedom.
   * Uses Wilson-Hilferty transformation for approximation.
   */
  private chiSquarePValue(x: number, dof: number): number {
    if (x <= 0 || dof <= 0) return 1;
    // Wilson-Hilferty approximation to standard normal CDF
    const z = (Math.pow(x / dof, 1 / 3) - (1 - 2 / (9 * dof))) /
      Math.sqrt(2 / (9 * dof));
    // Standard normal CDF approximation
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    const cdf = z > 0 ? 1 - poly * Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI) :
      poly * Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
    return 1 - cdf;
  }
}
