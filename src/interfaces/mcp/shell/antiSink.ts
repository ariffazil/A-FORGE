/**
 * AntiSink — Anti-behavioral-sink ecology for A-FORGE recursive improvement.
 *
 * Prevents the recursive improvement loop from collapsing into:
 * - Endless self-analysis (reflection without action)
 * - Benchmark gaming (optimizing metrics that don't matter)
 * - Log beautification (polishing traces instead of doing work)
 * - Doctrine inflation (adding rules without removing anything)
 * - Refusal theater (saying "I can't" instead of trying)
 * - Tool accumulation without task closure (collecting tools never used)
 *
 * Calhoun's governance drift warns: abundance without role structure,
 * renewal, territory, or challenge produces sterile self-preoccupation.
 * The anti-sink ecology forces structured struggle: reality contact,
 * role diversity, entropy caps, and retirement of sterile branches.
 *
 * Constitutional:
 *   F4 CLARITY — reduce entropy, never leave chaos behind
 *   F7 HUMILITY — cap confidence, require external evidence
 *   F11 AUDIT — every sterile cycle writes a scar
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

// ── AntiSink Configuration ──────────────────────────────────────────────────

export interface AntiSinkConfig {
  /** Minimum ratio of external task contacts to total iterations */
  minRealityQuota: number;
  /** Rolling window size for reality quota computation (in iterations) */
  realityWindowSize: number;
  /** Maximum idle iterations before a branch is flagged */
  maxIdleStreak: number;
  /** Maximum sequential self-reflection cycles without external action */
  maxSelfReflectionRatio: number;
  /** Minimum number of unique external task types in window */
  minTaskTypeDiversity: number;
  /** If true, enforce retirement: kill sterile branches */
  enforceRetirement: boolean;
  /** Penalty multiplier for entropy bloat (context overshoot) */
  entropyPenalty: number;
}

export const DEFAULT_ANTISINK_CONFIG: AntiSinkConfig = {
  minRealityQuota: 0.3,          // At least 30% of iterations must touch external tasks
  realityWindowSize: 20,          // Over last 20 iterations
  maxIdleStreak: 10,              // 10 idle iterations before flag
  maxSelfReflectionRatio: 0.7,    // Max 70% self-reflection cycles
  minTaskTypeDiversity: 2,        // At least 2 unique task types
  enforceRetirement: true,        // Kill sterile branches
  entropyPenalty: 0.1,            // Penalty per 10% context overshoot
};

// ── Reality Loop State ──────────────────────────────────────────────────────

export interface ExternalContact {
  /** When the contact happened */
  timestamp: string;
  /** What type of external task */
  taskType: string;
  /** Brief description */
  description: string;
  /** Was there a measurable outcome? */
  outcome?: string;
}

export interface RealityLoopState {
  /** Monotonic iteration counter */
  iteration: number;
  /** External task contacts (rolling buffer) */
  externalContacts: ExternalContact[];
  /** How many sequential iterations with no external contact */
  idleStreak: number;
  /** When the last external contact happened */
  lastExternalContactAt: string | null;
  /** Total external contacts ever */
  totalExternalContacts: number;
  /** Total self-reflection cycles */
  totalSelfReflections: number;
  /** Task type diversity set */
  taskTypesSeen: Set<string>;
  /** Current entropy score (context bloat) */
  entropyScore: number;
  /** If true, this branch is retired */
  retired: boolean;
  /** When this state was created */
  createdAt: string;
  /** Last retirement check timestamp */
  lastRetirementCheck: string;
}

export function createRealityLoopState(): RealityLoopState {
  return {
    iteration: 0,
    externalContacts: [],
    idleStreak: 0,
    lastExternalContactAt: null,
    totalExternalContacts: 0,
    totalSelfReflections: 0,
    taskTypesSeen: new Set(),
    entropyScore: 0,
    retired: false,
    createdAt: new Date().toISOString(),
    lastRetirementCheck: new Date().toISOString(),
  };
}

// ── Reality Quota ───────────────────────────────────────────────────────────

export interface RealityQuotaResult {
  /** Does the current state satisfy the reality quota? */
  satisfied: boolean;
  /** Current reality quota ratio */
  currentQuota: number;
  /** Minimum required quota */
  requiredQuota: number;
  /** Current idle streak */
  idleStreak: number;
  /** Max allowed idle streak */
  maxIdleStreak: number;
  /** Task type diversity */
  taskDiversity: number;
  /** Hints for what to do */
  hints: string[];
}

/**
 * Compute current reality quota and check if it's satisfied.
 * Q_r = external_contacts_window / iterations_window
 * Promotable iff Q_r >= tau_r
 */
export function checkRealityQuota(
  state: RealityLoopState,
  config: AntiSinkConfig = DEFAULT_ANTISINK_CONFIG,
): RealityQuotaResult {
  const hints: string[] = [];

  // Compute Q_r over rolling window
  const windowStart = Math.max(0, state.iteration - config.realityWindowSize);
  const recentContacts = state.externalContacts.filter(
    c => new Date(c.timestamp).getTime() >= Date.now() - (config.realityWindowSize * 60000),
  ).length;
  const windowIterations = Math.min(state.iteration, config.realityWindowSize);
  const currentQuota = windowIterations > 0 ? recentContacts / windowIterations : 0;

  // Check idle streak
  if (state.idleStreak >= config.maxIdleStreak) {
    hints.push(`Idle streak ${state.idleStreak} >= max ${config.maxIdleStreak}. Needs external task.`);
  }

  // Check reality quota
  if (currentQuota < config.minRealityQuota) {
    hints.push(`Reality quota ${(currentQuota * 100).toFixed(0)}% < ${(config.minRealityQuota * 100).toFixed(0)}% min. Needs more external task contact.`);
  }

  // Check self-reflection ratio
  const totalOps = state.totalExternalContacts + state.totalSelfReflections;
  const reflectionRatio = totalOps > 0 ? state.totalSelfReflections / totalOps : 0;
  if (reflectionRatio > config.maxSelfReflectionRatio) {
    hints.push(`Self-reflection ratio ${(reflectionRatio * 100).toFixed(0)}% > ${(config.maxSelfReflectionRatio * 100).toFixed(0)}% max. Stop reflecting, start doing.`);
  }

  // Check task type diversity
  const diversity = state.taskTypesSeen.size;
  if (diversity < config.minTaskTypeDiversity) {
    hints.push(`Task diversity ${diversity} < ${config.minTaskTypeDiversity} min. Try different types of tasks.`);
  }

  const satisfied = hints.length === 0 &&
    currentQuota >= config.minRealityQuota &&
    state.idleStreak < config.maxIdleStreak &&
    reflectionRatio <= config.maxSelfReflectionRatio &&
    diversity >= config.minTaskTypeDiversity;

  return {
    satisfied,
    currentQuota,
    requiredQuota: config.minRealityQuota,
    idleStreak: state.idleStreak,
    maxIdleStreak: config.maxIdleStreak,
    taskDiversity: diversity,
    hints,
  };
}

// ── External Contact Recording ──────────────────────────────────────────────

/**
 * Record an external task contact. Resets idle streak, updates diversity.
 */
export function recordExternalContact(
  state: RealityLoopState,
  contact: Omit<ExternalContact, "timestamp">,
): RealityLoopState {
  const fullContact: ExternalContact = {
    ...contact,
    timestamp: new Date().toISOString(),
  };

  state.externalContacts.push(fullContact);
  state.totalExternalContacts++;
  state.idleStreak = 0;
  state.lastExternalContactAt = fullContact.timestamp;
  state.taskTypesSeen.add(contact.taskType);

  // Trim buffer to window size
  if (state.externalContacts.length > DEFAULT_ANTISINK_CONFIG.realityWindowSize * 2) {
    state.externalContacts = state.externalContacts.slice(-DEFAULT_ANTISINK_CONFIG.realityWindowSize);
  }

  return state;
}

/**
 * Record a self-reflection cycle (no external contact).
 * Increments idle streak and reflection counter.
 */
export function recordSelfReflection(state: RealityLoopState): RealityLoopState {
  state.iteration++;
  state.totalSelfReflections++;
  state.idleStreak++;
  return state;
}

// ── Retirement ──────────────────────────────────────────────────────────────

export interface RetirementVerdict {
  /** Should this branch be retired? */
  shouldRetire: boolean;
  /** Why */
  reason: string;
  /** What scar should be written */
  scarPayload: {
    type: string;
    failure_mode: string;
    constraint_imposed: string;
  } | null;
}

/**
 * Check if a branch should be retired — killed for sterility.
 * Checks:
 * 1. Idle streak too long
 * 2. Self-reflection ratio too high
 * 3. Reality quota unmet for too many checks
 * 4. No task diversity
 * 5. Entropy bloat
 */
export function checkRetirement(
  state: RealityLoopState,
  quotaResult?: RealityQuotaResult,
  config: AntiSinkConfig = DEFAULT_ANTISINK_CONFIG,
): RetirementVerdict {
  if (!config.enforceRetirement) {
    return { shouldRetire: false, reason: "Retirement disabled in config", scarPayload: null };
  }

  if (state.retired) {
    return { shouldRetire: true, reason: "Already retired", scarPayload: null };
  }

  const reasons: string[] = [];

  // 1. Idle streak
  if (state.idleStreak >= config.maxIdleStreak * 2) {
    reasons.push(`Idle streak ${state.idleStreak} >= ${config.maxIdleStreak * 2} (2x max). Branch is sterile.`);
  }

  // 2. Self-reflection ratio
  const totalOps = state.totalExternalContacts + state.totalSelfReflections;
  const reflectionRatio = totalOps > 0 ? state.totalSelfReflections / totalOps : 1;
  if (reflectionRatio > config.maxSelfReflectionRatio * 1.5 && state.totalSelfReflections > 20) {
    reasons.push(`Self-reflection ratio ${(reflectionRatio * 100).toFixed(0)}% is critically high after ${state.totalSelfReflections} reflections.`);
  }

  // 3. Reality quota persistently unmet
  if (quotaResult && !quotaResult.satisfied && state.iteration > config.realityWindowSize) {
    if (quotaResult.currentQuota < config.minRealityQuota * 0.5) {
      reasons.push(`Reality quota ${(quotaResult.currentQuota * 100).toFixed(0)}% is critically below ${(config.minRealityQuota * 100).toFixed(0)}% minimum.`);
    }
  }

  // 4. No task diversity
  if (state.taskTypesSeen.size === 0 && state.iteration > config.realityWindowSize) {
    reasons.push("Zero task type diversity. Branch has never touched an external task.");
  }

  if (reasons.length > 0) {
    return {
      shouldRetire: true,
      reason: `RETIRE: ${reasons.join(" ")}`,
      scarPayload: {
        type: "retirement",
        failure_mode: "behavioral_sink",
        constraint_imposed: `Retired at iteration ${state.iteration}: ${reasons[0]}`,
      },
    };
  }

  return { shouldRetire: false, reason: "Branch is healthy", scarPayload: null };
}

// ── Utility ─────────────────────────────────────────────────────────────────

/**
 * Create a JSON-serializable snapshot of reality loop state.
 * (Sets are converted to arrays for JSON compat.)
 */
export function serializeRealityState(state: RealityLoopState): Record<string, unknown> {
  return {
    iteration: state.iteration,
    externalContacts: state.externalContacts.slice(-10), // Last 10 only
    idleStreak: state.idleStreak,
    lastExternalContactAt: state.lastExternalContactAt,
    totalExternalContacts: state.totalExternalContacts,
    totalSelfReflections: state.totalSelfReflections,
    taskTypesSeen: Array.from(state.taskTypesSeen),
    entropyScore: state.entropyScore,
    retired: state.retired,
    createdAt: state.createdAt,
    lastRetirementCheck: state.lastRetirementCheck,
  };
}
