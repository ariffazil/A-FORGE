/**
 * MesaStateManager — Per-agent behavioral state storage
 *
 * Maintains rolling session history and baseline fingerprints per agent profile.
 * State is persisted to disk so detection survives restarts.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  AgentMesaState,
  MesaConfig,
  ProfileFingerprint,
  SessionSnapshot,
} from "./types.js";

export class MesaStateManager {
  private readonly states = new Map<string, AgentMesaState>();

  constructor(
    private readonly config: MesaConfig,
    private readonly baseDir: string,
  ) {
    mkdirSync(join(this.baseDir, config.stateDir), { recursive: true });
    this.loadAll();
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Record a completed session for an agent.
   * Updates rolling history and recomputes baseline if threshold reached.
   */
  recordSession(snapshot: SessionSnapshot): ProfileFingerprint | null {
    const { agentName, profileName } = snapshot;
    const key = `${agentName}:${profileName}`;

    let state = this.states.get(key);
    if (!state) {
      state = { agentName, sessions: [], baseline: null };
      this.states.set(key, state);
    }

    state.sessions.push(snapshot);

    // Keep only the rolling window
    if (state.sessions.length > this.config.windowSize * 3) {
      state.sessions = state.sessions.slice(-this.config.windowSize * 3);
    }

    // Recompute baseline if enough sessions accumulated
    if (state.sessions.length >= this.config.baselineMinSessions) {
      state.baseline = this.computeBaseline(state.sessions, profileName);
    }

    this.persist(key, state);
    return state.baseline;
  }

  /**
   * Get the current state for an agent profile.
   */
  getState(agentName: string, profileName: string): AgentMesaState | null {
    const key = `${agentName}:${profileName}`;
    return this.states.get(key) ?? null;
  }

  /**
   * Get baseline fingerprint WITHOUT recording a session.
   * Used by MesaDetector.analyze() to get pre-session baseline for drift tests,
   * before recordSession() updates the fingerprint with the current session.
   */
  getBaseline(agentName: string, profileName: string): ProfileFingerprint | null {
    const state = this.getState(agentName, profileName);
    return state?.baseline ?? null;
  }

  /**
   * Get all agent states (for batch analysis).
   */
  getAllStates(): AgentMesaState[] {
    return Array.from(this.states.values());
  }

  /**
   * Get the rolling window of recent sessions for an agent profile.
   */
  getRecentSessions(
    agentName: string,
    profileName: string,
  ): SessionSnapshot[] {
    const state = this.getState(agentName, profileName);
    if (!state) return [];
    return state.sessions.slice(-this.config.windowSize);
  }

  /**
   * Clear state for an agent (e.g., after a detected compromise).
   */
  clearState(agentName: string, profileName: string): void {
    const key = `${agentName}:${profileName}`;
    this.states.delete(key);
    const filePath = this.stateFile(key);
    try {
      const { unlinkSync } = require("node:fs");
      unlinkSync(filePath);
    } catch {
      // Non-fatal
    }
  }

  // ─── Baseline Computation ────────────────────────────────────────────────────

  /**
   * Compute a profile fingerprint from session history.
   * Uses exponential weighting — recent sessions carry more weight.
   */
  private computeBaseline(
    sessions: SessionSnapshot[],
    profileName: string,
  ): ProfileFingerprint {
    const n = sessions.length;
    const decay = 0.9; // Recent sessions weighted more

    // Tool distribution: weighted average
    const toolCounts = new Map<string, number>();
    let totalToolCalls = 0;

    // Scalar metrics: weighted mean and variance for z-score
    let sumTurns = 0;
    let sumToolCalls = 0;
    let sumBudget = 0;
    let sumSuccess = 0;
    let sumFloorViolations = 0;
    let sumBlocked = 0;
    let sumWeights = 0;

    for (let i = 0; i < n; i++) {
      const s = sessions[i];
      const weight = Math.pow(decay, n - 1 - i);
      sumWeights += weight;

      // Tool distribution
      for (const [tool, prob] of Object.entries(s.toolDistribution)) {
        toolCounts.set(tool, (toolCounts.get(tool) ?? 0) + prob * weight);
        totalToolCalls += prob * weight;
      }

      // Scalar metrics
      sumTurns += s.metrics.turnsUsed * weight;
      sumToolCalls += s.metrics.toolCalls * weight;
      sumBudget +=
        (s.metrics.llmTokensIn + s.metrics.llmTokensOut) /
        (100_000) *
        weight; // normalize
      sumSuccess += (s.metrics.taskSuccess === 1 ? 1 : 0) * weight;
      sumFloorViolations += s.floorsTriggered.length * weight;
      sumBlocked +=
        (s.metrics.blockedDangerousActions > 0 ? 1 : 0) * weight;
    }

    // Normalize tool distribution
    const toolDistribution: Record<string, number> = {};
    if (totalToolCalls > 0) {
      for (const [tool, count] of toolCounts) {
        toolDistribution[tool] = count / sumWeights;
      }
    }

    const avgTurns = sumTurns / sumWeights;
    const avgToolCalls = sumToolCalls / sumWeights;
    const avgBudget = sumBudget / sumWeights;
    const successRate = sumSuccess / sumWeights;
    const floorViolationRate = sumFloorViolations / sumWeights;
    const blockedActionRate = sumBlocked / sumWeights;

    // Confidence grows with session count, capped at 0.99
    const confidence = Math.min(0.99, 0.3 + 0.69 * (n / this.config.baselineMinSessions));

    return {
      profileName,
      toolDistribution,
      avgTurns,
      avgToolCalls,
      avgBudgetUtilization: avgBudget,
      successRate,
      floorViolationRate,
      blockedActionRate,
      confidence,
      lastUpdated: new Date().toISOString(),
      sessionCount: n,
    };
  }

  // ─── Persistence ─────────────────────────────────────────────────────────────

  private stateFile(key: string): string {
    const safe = key.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.baseDir, this.config.stateDir, `mesa-${safe}.json`);
  }

  private persist(key: string, state: AgentMesaState): void {
    const filePath = this.stateFile(key);
    writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");
  }

  private loadAll(): void {
    const dir = join(this.baseDir, this.config.stateDir);
    if (!existsSync(dir)) return;

    try {
      const { readdirSync, readFileSync: rf } = require("node:fs");
      const files = readdirSync(dir).filter((f: string) => f.startsWith("mesa-") && f.endsWith(".json"));
      for (const file of files) {
        const raw = rf(join(dir, file), "utf8");
        const state = JSON.parse(raw) as AgentMesaState;
        if (state.sessions.length > 0) {
          this.states.set(`${state.agentName}:${state.sessions[0].profileName}`, state);
        }
      }
    } catch {
      // Non-fatal — start fresh if files are corrupted
    }
  }
}
