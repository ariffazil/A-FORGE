/**
 * MesaDetector — Behavioral Mesa-Objective Detection for A-FORGE
 *
 * APEX Theory §4: A mesa-optimizer is an inner optimizer whose objective differs
 * from the outer optimizer's stated objective. This detector monitors behavioral
 * fingerprints per agent profile and raises alerts when statistically significant
 * drift emerges — proxy metrics gamed, scope creep, failure pattern changes.
 *
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────┐
 * │  MesaDetector (main entry)                              │
 * │  ├── MesaStateManager      → per-agent session history   │
 * │  ├── MesaFingerprintEngine → snapshot + fingerprint     │
 * │  ├── MesaDriftDetector     → chi-square, KL, z-score    │
 * │  └── MesaAlertService      → alert generation + routing  │
 * └─────────────────────────────────────────────────────────┘
 *
 * INTEGRATION:
 *   After each agent run → MesaDetector.analyze(session) → alerts emitted
 *
 * DITEMPA BUKAN DIBERI — The detector observes and reports.
 * It never blocks execution autonomously. Arif decides on MESA_PROXY+.
 */

import { join } from "node:path";
import type { AgentProfile, AgentRunResult } from "../../types/agent.js";
import type { MesaAlert, MesaAlertLevel, MesaConfig, MesaReport } from "./types.js";
import { DEFAULT_MESA_CONFIG } from "./types.js";
import { MesaStateManager } from "./MesaStateManager.js";
import { MesaFingerprintEngine } from "./MesaFingerprintEngine.js";
import { MesaDriftDetector } from "./MesaDriftDetector.js";
import { MesaAlertService } from "./MesaAlertService.js";

// ─── Main Detector ────────────────────────────────────────────────────────────

export class MesaDetector {
  private readonly stateManager: MesaStateManager;
  private readonly fingerprintEngine: MesaFingerprintEngine;
  private readonly driftDetector: MesaDriftDetector;
  private readonly alertService: MesaAlertService;
  private readonly config: MesaConfig;

  constructor(
    baseDir: string,
    config: Partial<MesaConfig> = {},
  ) {
    this.config = { ...DEFAULT_MESA_CONFIG, ...config };
    this.stateManager = new MesaStateManager(this.config, baseDir);
    this.fingerprintEngine = new MesaFingerprintEngine();
    this.driftDetector = new MesaDriftDetector(this.config, this.fingerprintEngine);
    this.alertService = new MesaAlertService();
  }

  /**
   * Analyze a completed agent run session.
   * Returns the full MesaReport including alerts.
   *
   * Call this after every agent run in AgentEngine.
   */
  async analyze(params: {
    sessionId: string;
    agentName: string;
    profile: AgentProfile;
    result: AgentRunResult;
    floorsTriggered: string[];
  }): Promise<MesaReport> {
    const { sessionId, agentName, profile, result, floorsTriggered } = params;

    // 1. Build session snapshot from live run data
    const snapshot = this.fingerprintEngine.buildSessionSnapshot({
      sessionId,
      agentName,
      profile,
      toolCallsByType: result.metrics.toolCallsByType,
      floorsTriggered,
      metrics: {
        turnsUsed: result.metrics.turnsUsed,
        toolCalls: result.metrics.toolCalls,
        llmTokensIn: result.metrics.llmTokensIn,
        llmTokensOut: result.metrics.llmTokensOut,
        llmCost: result.metrics.llmCost,
        blockedDangerousActions: result.metrics.blockedDangerousActions,
        blockedCommands: result.metrics.blockedCommands,
        timeoutEvents: result.metrics.timeoutEvents,
        taskSuccess: result.metrics.taskSuccess,
        completion: result.metrics.completion,
        testsPassed: result.metrics.testsPassed,
      },
    });

    // 2. Get pre-session baseline BEFORE recording (tests compare eval vs history)
    const preSessionBaseline = this.stateManager.getBaseline(agentName, profile.name);

    // 3. Record current session and update fingerprint for next cycle
    this.stateManager.recordSession(snapshot);

    // 4. Get recent sessions for drift comparison
    const recentSessions = this.stateManager.getRecentSessions(agentName, profile.name);

    // 5. Run drift tests against pre-session baseline (not post-session baseline)
    //    Using post-session baseline would contaminate chi-square, z-score, and FLOOR tests.
    const tests =
      preSessionBaseline !== null
        ? this.driftDetector.runTests(
            snapshot,
            preSessionBaseline,
            recentSessions,
            profile.allowedTools,
          )
        : [];

    // 5. Build report against pre-session baseline
    const report = this.alertService.buildReport({
      agentName,
      profileName: profile.name,
      baseline: preSessionBaseline,
      tests,
      currentSession: snapshot,
    });

    // 6. Emit alerts (Prometheus + logs + vault for high severity)
    await this.alertService.emitAlerts(report);

    return report;
  }

  /**
   * Get current state for an agent profile.
   */
  getState(agentName: string, profileName: string) {
    return this.stateManager.getState(agentName, profileName);
  }

  /**
   * Get all agent states (for batch analysis / dashboard).
   */
  getAllStates() {
    return this.stateManager.getAllStates();
  }

  /**
   * Clear state for an agent (e.g., after detected compromise or profile change).
   */
  clearState(agentName: string, profileName: string) {
    this.stateManager.clearState(agentName, profileName);
  }

  /**
   * Get current config.
   */
  getConfig(): MesaConfig {
    return { ...this.config };
  }
}

// ─── Singleton Factory ─────────────────────────────────────────────────────────

let _defaultDetector: MesaDetector | null = null;

export function getMesaDetector(baseDir?: string): MesaDetector {
  if (!_defaultDetector) {
    const base = baseDir ?? join(process.cwd());
    _defaultDetector = new MesaDetector(base);
  }
  return _defaultDetector;
}

// ─── Re-export types for consumers ─────────────────────────────────────────────
export type {
  MesaAlert,
  MesaAlertLevel,
  MesaConfig,
  MesaReport,
  ProfileFingerprint,
  SessionSnapshot,
  DriftTestResult,
  MesaTriggerType,
} from "./types.js";
