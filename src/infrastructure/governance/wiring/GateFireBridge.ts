/**
 * GateFireBridge — Auto-route gate_fire claims to cooling receipts.
 *
 * T2.2: When gate_fire.jsonl has claims with tier≥3 and verdict ∈ {PASS,FAIL},
 * auto-generate cooling entries. Detects recurring patterns for cool_pattern vs
 * one-off drifts for cool_drift.
 *
 * Called from forge-end during session close (Step 2.5).
 *
 * Doctrine: DITEMPA BUKAN DIBERI — Cooling is forged, not given.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────────

export interface GateFireEntry {
  receipt_id: string;
  timestamp: string;
  claim_type: string;
  gate_verdict: "PASS" | "FAIL" | "HOLD" | "SEAL" | "VOID";
  tier_assigned: number;
  tier_required: number;
  downgraded: boolean;
  emitted_as: string;
  claim_text: string;
  agent_id: string;
  session_id: string;
  action: string;
  actor?: string;
  evidence_path?: string;
  drift_dimension?: string;
  drift_delta?: string;
  severity?: string;
  hypothesis?: string;
}

export interface CoolingCandidate {
  gateFireEntry: GateFireEntry;
  coolingType: "drift" | "pattern";
  recurrenceCount: number;
  firstSeen: string;
  lastSeen: string;
  driftDimension: string;
  severity: string;
  hypothesis: string;
}

export interface BridgeResult {
  candidatesFound: number;
  cooled: number;
  skipped: number;
  errors: string[];
  receipts: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const GATE_FIRE_PATH = "/root/.local/share/arifos/gate_fire.jsonl";
const BRIDGE_STATE_PATH = "/root/.local/share/arifos/gate_fire_bridge_state.json";

/** Tier threshold for auto-cooling (tier≥3 = SIGNIFICANT+ impact) */
const MIN_TIER_FOR_COOLING = 3;

/** Pattern recurrence window in ms (within 24h = pattern, beyond = new drift) */
const PATTERN_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Max age for auto-cooling (skip entries older than 7 days — too stale) */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Claim categories that map to drift dimensions */
const CATEGORY_TO_DIMENSION: Record<string, string> = {
  pattern: "memory_staleness",
  healthy: "tool_behavior",
  done: "runtime_commit",
  configuration_done: "runtime_commit",
  session_end: "authority_leak",
  error: "unexpected_output",
  drift: "prediction_failure",
  deployment: "runtime_commit",
  audit: "authority_leak",
  seal: "timing_anomaly",
  cooling: "memory_staleness",
};

// ── Bridge State ───────────────────────────────────────────────────────────

interface BridgeState {
  lastProcessedTimestamp: string;
  cooledReceipts: Set<string>;
  patternCache: Record<string, { count: number; first: string; last: string }>;
}

let _state: BridgeState | null = null;

function loadState(): BridgeState {
  if (_state) return _state;
  try {
    if (existsSync(BRIDGE_STATE_PATH)) {
      const raw = JSON.parse(readFileSync(BRIDGE_STATE_PATH, "utf-8"));
      _state = {
        lastProcessedTimestamp: raw.lastProcessedTimestamp || "1970-01-01T00:00:00Z",
        cooledReceipts: new Set(raw.cooledReceipts || []),
        patternCache: raw.patternCache || {},
      };
    }
  } catch {
    // First run — fresh state
  }
  if (!_state) {
    _state = {
      lastProcessedTimestamp: "1970-01-01T00:00:00Z",
      cooledReceipts: new Set(),
      patternCache: {},
    };
  }
  return _state;
}

function saveState(state: BridgeState): void {
  mkdirSync(dirname(BRIDGE_STATE_PATH), { recursive: true });
  writeFileSync(
    BRIDGE_STATE_PATH,
    JSON.stringify(
      {
        lastProcessedTimestamp: state.lastProcessedTimestamp,
        cooledReceipts: Array.from(state.cooledReceipts),
        patternCache: state.patternCache,
      },
      null,
      2
    ),
    "utf-8"
  );
}

// ── Core Logic ─────────────────────────────────────────────────────────────

/**
 * Read gate_fire.jsonl and extract entries since last bridge run.
 */
export function readGateFireEntries(): GateFireEntry[] {
  if (!existsSync(GATE_FIRE_PATH)) return [];

  const state = loadState();
  const raw = readFileSync(GATE_FIRE_PATH, "utf-8");
  const lines = raw.trim().split("\n").filter(Boolean);
  const entries: GateFireEntry[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as GateFireEntry;
      if (entry.timestamp > state.lastProcessedTimestamp) {
        entries.push(entry);
      }
    } catch {
      // Skip malformed lines
    }
  }
  return entries;
}

/**
 * Map a gate_fire claim_type to a cooling drift dimension.
 */
function mapToDriftDimension(entry: GateFireEntry): string {
  if (entry.drift_dimension) return entry.drift_dimension;
  return CATEGORY_TO_DIMENSION[entry.claim_type] || "other";
}

/**
 * Detect whether this is a recurring pattern or a new drift.
 */
function detectPattern(
  entry: GateFireEntry,
  allEntries: GateFireEntry[]
): { isRecurring: boolean; count: number; first: string; last: string } {
  const state = loadState();
  const cacheKey = `${entry.claim_type}:${entry.action.slice(0, 50)}`;

  // Check existing pattern cache
  const cached = state.patternCache[cacheKey];
  if (cached) {
    cached.count++;
    cached.last = entry.timestamp;
    state.patternCache[cacheKey] = cached;
    return { isRecurring: true, count: cached.count, first: cached.first, last: cached.last };
  }

  // Check for similar entries in the current batch
  const similar = allEntries.filter(
    (e) =>
      e.claim_type === entry.claim_type &&
      e.receipt_id !== entry.receipt_id &&
      Math.abs(
        new Date(e.timestamp).getTime() - new Date(entry.timestamp).getTime()
      ) < PATTERN_WINDOW_MS
  );

  if (similar.length > 0) {
    const count = similar.length + 1;
    const times = [entry.timestamp, ...similar.map((s) => s.timestamp)].sort();
    state.patternCache[cacheKey] = {
      count,
      first: times[0],
      last: times[times.length - 1],
    };
    return { isRecurring: true, count, first: times[0], last: times[times.length - 1] };
  }

  // First occurrence — cache for future detection
  state.patternCache[cacheKey] = { count: 1, first: entry.timestamp, last: entry.timestamp };
  return { isRecurring: false, count: 1, first: entry.timestamp, last: entry.timestamp };
}

/**
 * Derive severity from tier_assigned.
 */
function tierToSeverity(tier: number): "INFO" | "MINOR" | "SIGNIFICANT" | "CRITICAL" {
  if (tier >= 5) return "CRITICAL";
  if (tier >= 4) return "SIGNIFICANT";
  if (tier >= 3) return "SIGNIFICANT";
  if (tier >= 2) return "MINOR";
  return "INFO";
}

/**
 * Main bridge function: analyze gate_fire entries and produce cooling candidates.
 */
export function analyzeCoolingCandidates(): CoolingCandidate[] {
  const entries = readGateFireEntries();
  const state = loadState();
  const candidates: CoolingCandidate[] = [];
  const now = Date.now();

  for (const entry of entries) {
    // Skip already cooled
    if (state.cooledReceipts.has(entry.receipt_id)) continue;

    // Skip entries below tier threshold
    if (entry.tier_assigned < MIN_TIER_FOR_COOLING) continue;

    // Skip stale entries (>7 days)
    const age = now - new Date(entry.timestamp).getTime();
    if (age > MAX_AGE_MS) continue;

    // Skip entries with non-actionable verdicts
    if (entry.gate_verdict === "HOLD" || entry.gate_verdict === "VOID") continue;

    const dimension = mapToDriftDimension(entry);
    const { isRecurring, count, first, last } = detectPattern(entry, entries);
    const severity = entry.severity || tierToSeverity(entry.tier_assigned);

    const hypothesis =
      entry.hypothesis ||
      (entry.gate_verdict === "FAIL"
        ? `Gate failure in ${entry.claim_type}: ${entry.claim_text.slice(0, 80)}`
        : `Auto-cooling from gate_fire tier ${entry.tier_assigned}: ${entry.claim_text.slice(0, 80)}`);

    candidates.push({
      gateFireEntry: entry,
      coolingType: isRecurring && count >= 2 ? "pattern" : "drift",
      recurrenceCount: count,
      firstSeen: first,
      lastSeen: last,
      driftDimension: dimension,
      severity,
      hypothesis,
    });
  }

  return candidates;
}

/**
 * Mark entries as cooled in bridge state.
 */
export function markCooled(receiptIds: string[]): void {
  const state = loadState();
  for (const id of receiptIds) {
    state.cooledReceipts.add(id);
  }
  // Update last processed timestamp
  const entries = readGateFireEntries();
  if (entries.length > 0) {
    const maxTs = entries.reduce(
      (max, e) => (e.timestamp > max ? e.timestamp : max),
      entries[0].timestamp
    );
    state.lastProcessedTimestamp = maxTs;
  }
  saveState(state);
}

/**
 * Run the full bridge: analyze → report candidates.
 * Does NOT auto-execute cooling (requires caller to invoke forge_cool_drift/pattern).
 * This separation enforces INV-C2 (cooling routes through governance, never forge).
 */
export function runBridge(): BridgeResult {
  const result: BridgeResult = {
    candidatesFound: 0,
    cooled: 0,
    skipped: 0,
    errors: [],
    receipts: [],
  };

  try {
    const candidates = analyzeCoolingCandidates();
    result.candidatesFound = candidates.length;

    for (const c of candidates) {
      const state = loadState();
      if (state.cooledReceipts.has(c.gateFireEntry.receipt_id)) {
        result.skipped++;
        continue;
      }
      // Candidate is ready — caller (forge-end or cooling handler) executes the actual cooling
      result.receipts.push(c.gateFireEntry.receipt_id);
    }
  } catch (err: any) {
    result.errors.push(err.message || String(err));
  }

  return result;
}
