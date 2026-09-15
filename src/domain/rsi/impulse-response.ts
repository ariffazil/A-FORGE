/**
 * domain/rsi/impulse-response.ts — P0 Impulse-Response Measurement Engine
 *
 * Measures how long a single event (888_HOLD, scar seal, tool failure)
 * remains causally active in subsequent routing, tool selection, and
 * budget allocation.
 *
 * This is the first empirical characterization of h(t) for A-FORGE.
 *
 * Method:
 *   1. Read experience traces (JSONL) to identify impulse events
 *   2. For each impulse, track subsequent tool calls in the same tool family
 *   3. Measure "influence" as deviation from baseline tool-call frequency
 *   4. Compute causal half-life: sessions until influence drops below 50%
 *
 * Constitutional:
 *   F1 AMANAH — read-only measurement, never mutates traces
 *   F2 TRUTH — all measurements are OBS label, never DER/INT/SPEC
 *   R ∉ S — measurement engine is not in the decision path it measures
 *
 * @see /root/forge_work/2026-09-15-AF-RSI-state-vector.md §4
 * @authority ARIF / F13 SOVEREIGN
 * @date 2026-09-15
 * @forged FI-003 (Qwen Code)
 */

import { readFile, existsSync } from "node:fs";
import { promisify } from "node:util";

const readFileAsync = promisify(readFile);

// ── Paths ───────────────────────────────────────────────────────────────────

const EXPERIENCE_TRACE_LOG = "/root/.local/share/arifos/world-model/experience_traces.jsonl";

// ── Types ───────────────────────────────────────────────────────────────────

interface TraceRecord {
  trace_id: string;
  seq: number;
  ts: string;
  session_id: string;
  agent_id: string;
  action: { tool: string; input_hash: string };
  observation: { output_hash: string; success: boolean; success_basis?: string; success_verified?: boolean };
  feedback: { self?: string; environmental?: string; constitutional?: string };
  experience_delta: { capability_change?: number; confidence_change?: number; new_scar?: string | null; new_skill?: string | null };
  prev_hash: string;
  hash: string;
}

export type ImpulseEventType =
  | "888_HOLD"
  | "scar_seal"
  | "tool_failure"
  | "fix_deployment";

export interface ImpulseEvent {
  event_type: ImpulseEventType;
  event_ref: string;
  tool_name: string;
  tool_family: string;
  session_id: string;
  ts: string;
  trace_id: string;
}

export interface ImpulseResponseSample {
  measurement_id: string;
  event_type: ImpulseEventType;
  event_ref: string;
  origin_session_id: string;
  impulse_at: string;
  tool_family: string;
  sessions_observed: number;
  sessions_with_same_tool: number;
  calls_in_influenced_sessions: number;
  baseline_calls_per_session: number;
  influence_ratio: number;
  causal_half_life_sessions: number | null;
  still_active: boolean;
  last_influence_at: string | null;
  measured_at: string;
}

export interface ImpulseResponseReport {
  window_start: string;
  window_end: string;
  total_impulse_events: number;
  samples_with_influence: number;
  mean_half_life_sessions: number | null;
  median_half_life_sessions: number | null;
  by_event_type: Array<{
    event_type: ImpulseEventType;
    count: number;
    mean_half_life: number | null;
    still_active_count: number;
  }>;
  h_characterized: boolean;
  computed_at: string;
}

// ── Tool family mapping ─────────────────────────────────────────────────────

/**
 * Map tool names to families for impulse-response tracking.
 * Tools in the same family are considered interchangeable for routing influence.
 */
const TOOL_FAMILIES: Record<string, string> = {
  // Shell execution family
  forge_shell: "shell",
  forge_shell_dryrun: "shell",
  forge_shell_alert_history: "shell",
  // Git family
  forge_git: "git",
  forge_git_commit: "git",
  forge_github: "git",
  forge_github_create_issue: "git",
  forge_github_create_or_update_file: "git",
  forge_github_get_file: "git",
  // Search family
  forge_search: "search",
  forge_fetch: "search",
  forge_research: "search",
  forge_minimax_search: "search",
  // Filesystem family
  forge_filesystem: "fs",
  // Vault family
  forge_vault: "vault",
  forge_seal: "vault",
  forge_scar: "vault",
  forge_scar_scan: "vault",
  // Governance family
  forge_evaluate: "governance",
  forge_witness: "governance",
  forge_heart_critique: "governance",
  forge_check_governance: "governance",
  // Docker family
  forge_docker: "docker",
  // Execute family
  forge_execute: "execute",
  forge_execute_sealed: "execute",
  forge_pipeline_run: "execute",
  forge_compose: "execute",
  // Probe family
  forge_probe: "probe",
  forge_probe_site: "probe",
  forge_scan: "probe",
  forge_security_drift_scan: "probe",
  forge_surface_audit: "probe",
  // Registry family
  forge_registry: "registry",
  forge_registry_status: "registry",
  forge_status: "registry",
  forge_register: "registry",
  // Experience/memory family
  forge_experience_trace: "experience",
  forge_experience_query: "experience",
  forge_memory: "memory",
  // Health family
  forge_health_check: "health",
  forge_netdata_alarms: "health",
  forge_netdata_metrics: "health",
  // Browser family
  forge_browser_navigate: "browser",
  forge_browser_click: "browser",
  forge_browser_type: "browser",
  forge_browser_screenshot: "browser",
  forge_browser_extract_text: "browser",
  forge_browser_evaluate_js: "browser",
};

function getToolFamily(toolName: string): string {
  return TOOL_FAMILIES[toolName] ?? toolName;
}

// ── Trace loading ───────────────────────────────────────────────────────────

async function loadTraces(): Promise<TraceRecord[]> {
  if (!existsSync(EXPERIENCE_TRACE_LOG)) return [];
  const content = await readFileAsync(EXPERIENCE_TRACE_LOG, "utf-8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        const t = JSON.parse(line) as Partial<TraceRecord>;
        return {
          trace_id: t.trace_id ?? "",
          seq: t.seq ?? 0,
          ts: t.ts ?? "",
          session_id: t.session_id ?? "",
          agent_id: t.agent_id ?? "",
          action: t.action ?? { tool: "unknown", input_hash: "" },
          observation: t.observation ?? { output_hash: "", success: false },
          feedback: t.feedback ?? {},
          experience_delta: t.experience_delta ?? {},
          prev_hash: t.prev_hash ?? "",
          hash: t.hash ?? "",
        } as TraceRecord;
      } catch {
        return null;
      }
    })
    .filter((t): t is TraceRecord => t !== null);
}

// ── Impulse event detection ─────────────────────────────────────────────────

/**
 * Detect impulse events from experience traces.
 * An impulse event is a trace entry that indicates a significant
 * governance intervention (HOLD, failure, scar).
 */
function detectImpulseEvents(traces: TraceRecord[]): ImpulseEvent[] {
  const events: ImpulseEvent[] = [];

  for (const trace of traces) {
    // 888_HOLD: tool call refused with constitutional hold
    if (
      trace.feedback.constitutional?.includes("888_HOLD") ||
      trace.feedback.self?.includes("888_HOLD") ||
      trace.feedback.environmental?.includes("HOLD")
    ) {
      events.push({
        event_type: "888_HOLD",
        event_ref: trace.trace_id,
        tool_name: trace.action.tool,
        tool_family: getToolFamily(trace.action.tool),
        session_id: trace.session_id,
        ts: trace.ts,
        trace_id: trace.trace_id,
      });
    }

    // Scar seal: new scar created
    if (trace.experience_delta.new_scar) {
      events.push({
        event_type: "scar_seal",
        event_ref: trace.experience_delta.new_scar,
        tool_name: trace.action.tool,
        tool_family: getToolFamily(trace.action.tool),
        session_id: trace.session_id,
        ts: trace.ts,
        trace_id: trace.trace_id,
      });
    }

    // Tool failure: observation.success = false (only when verified)
    if (
      !trace.observation.success &&
      trace.observation.success_basis === "execution_cleanliness"
    ) {
      events.push({
        event_type: "tool_failure",
        event_ref: trace.trace_id,
        tool_name: trace.action.tool,
        tool_family: getToolFamily(trace.action.tool),
        session_id: trace.session_id,
        ts: trace.ts,
        trace_id: trace.trace_id,
      });
    }
  }

  return events;
}

// ── Impulse-response measurement ────────────────────────────────────────────

/**
 * Measure impulse response for a single event.
 *
 * For each impulse event:
 *   1. Find all sessions after the impulse
 *   2. Count how many sessions have tool calls in the same family
 *   3. Compare against baseline frequency (sessions before the impulse)
 *   4. Compute causal half-life
 */
function measureSingleImpulse(
  impulse: ImpulseEvent,
  allTraces: TraceRecord[],
): ImpulseResponseSample {
  const impulseTime = new Date(impulse.ts).getTime();

  // Baseline: how often was this tool family used before the impulse?
  const beforeTraces = allTraces.filter(
    (t) => new Date(t.ts).getTime() < impulseTime,
  );
  const beforeSessions = new Set(beforeTraces.map((t) => t.session_id));
  const beforeSessionsWithFamily = new Set(
    beforeTraces
      .filter((t) => getToolFamily(t.action.tool) === impulse.tool_family)
      .map((t) => t.session_id),
  );
  const baselineRate =
    beforeSessions.size > 0
      ? beforeSessionsWithFamily.size / beforeSessions.size
      : 0;

  // After: track sessions after the impulse
  const afterTraces = allTraces.filter(
    (t) => new Date(t.ts).getTime() >= impulseTime,
  );
  const afterSessionIds = [...new Set(afterTraces.map((t) => t.session_id))];

  let sessionsWithSameTool = 0;
  let callsInInfluencedSessions = 0;
  let lastInfluenceAt: string | null = null;
  let halfLife: number | null = null;
  let stillActive = false;

  for (const sessionId of afterSessionIds) {
    const sessionTraces = afterTraces.filter((t) => t.session_id === sessionId);
    const familyTraces = sessionTraces.filter(
      (t) => getToolFamily(t.action.tool) === impulse.tool_family,
    );

    if (familyTraces.length > 0) {
      sessionsWithSameTool++;
      callsInInfluencedSessions += familyTraces.length;
      lastInfluenceAt =
        familyTraces[familyTraces.length - 1].ts ?? lastInfluenceAt;
    }
  }

  // Compute causal half-life
  // Half-life = number of sessions until the tool-family usage rate drops
  // below 50% of baseline. If it never drops, it's still active.
  if (baselineRate > 0 && afterSessionIds.length > 0) {
    let cumulativeInfluence = 0;
    let decayedBelowHalf = false;

    for (let i = 0; i < afterSessionIds.length; i++) {
      const sessionId = afterSessionIds[i];
      const sessionTraces = afterTraces.filter((t) => t.session_id === sessionId);
      const familyTraces = sessionTraces.filter(
        (t) => getToolFamily(t.action.tool) === impulse.tool_family,
      );
      const sessionRate = familyTraces.length > 0 ? 1 : 0;

      // Exponential moving average of influence
      cumulativeInfluence =
        i === 0
          ? sessionRate
          : 0.7 * cumulativeInfluence + 0.3 * sessionRate;

      if (cumulativeInfluence < baselineRate * 0.5 && !decayedBelowHalf) {
        halfLife = i + 1;
        decayedBelowHalf = true;
      }
    }

    stillActive = !decayedBelowHalf && sessionsWithSameTool > 0;
  }

  const influenceRatio =
    baselineRate > 0 && afterSessionIds.length > 0
      ? (sessionsWithSameTool / afterSessionIds.length) / baselineRate
      : 0;

  return {
    measurement_id: `ir-${impulse.trace_id}-${Date.now()}`,
    event_type: impulse.event_type,
    event_ref: impulse.event_ref,
    origin_session_id: impulse.session_id,
    impulse_at: impulse.ts,
    tool_family: impulse.tool_family,
    sessions_observed: afterSessionIds.length,
    sessions_with_same_tool: sessionsWithSameTool,
    calls_in_influenced_sessions: callsInInfluencedSessions,
    baseline_calls_per_session: baselineRate,
    influence_ratio: influenceRatio,
    causal_half_life_sessions: halfLife,
    still_active: stillActive,
    last_influence_at: lastInfluenceAt,
    measured_at: new Date().toISOString(),
  };
}

// ── Aggregate report ────────────────────────────────────────────────────────

/**
 * Compute the full impulse-response report.
 *
 * This is the P0 measurement target from the RSI state-vector draft.
 * Measures how long 888_HOLD events remain causally active in
 * subsequent routing and tool selection.
 *
 * @param windowDays — lookback window in days (default: 30)
 * @returns ImpulseResponseReport
 */
export async function computeImpulseResponseReport(
  windowDays: number = 30,
): Promise<ImpulseResponseReport> {
  const traces = await loadTraces();

  if (traces.length === 0) {
    return {
      window_start: new Date().toISOString(),
      window_end: new Date().toISOString(),
      total_impulse_events: 0,
      samples_with_influence: 0,
      mean_half_life_sessions: null,
      median_half_life_sessions: null,
      by_event_type: [],
      h_characterized: false,
      computed_at: new Date().toISOString(),
    };
  }

  const now = Date.now();
  const windowStart = now - windowDays * 24 * 60 * 60 * 1000;

  // Filter traces to window
  const windowTraces = traces.filter(
    (t) => new Date(t.ts).getTime() >= windowStart,
  );

  // Detect impulse events
  const impulses = detectImpulseEvents(windowTraces);

  // Measure each impulse
  const samples = impulses.map((imp) => measureSingleImpulse(imp, traces));

  // Aggregate statistics
  const halfLives = samples
    .map((s) => s.causal_half_life_sessions)
    .filter((h): h is number => h !== null);

  const samplesWithInfluence = samples.filter(
    (s) => s.sessions_with_same_tool > 0,
  ).length;

  // Per-event-type breakdown
  const eventTypes = [...new Set(impulses.map((i) => i.event_type))];
  const byEventType = eventTypes.map((et) => {
    const etSamples = samples.filter((s) => s.event_type === et);
    const etHalfLives = etSamples
      .map((s) => s.causal_half_life_sessions)
      .filter((h): h is number => h !== null);

    return {
      event_type: et,
      count: etSamples.length,
      mean_half_life:
        etHalfLives.length > 0
          ? etHalfLives.reduce((a, b) => a + b, 0) / etHalfLives.length
          : null,
      still_active_count: etSamples.filter((s) => s.still_active).length,
    };
  });

  return {
    window_start: new Date(windowStart).toISOString(),
    window_end: new Date(now).toISOString(),
    total_impulse_events: impulses.length,
    samples_with_influence: samplesWithInfluence,
    mean_half_life_sessions:
      halfLives.length > 0
        ? halfLives.reduce((a, b) => a + b, 0) / halfLives.length
        : null,
    median_half_life_sessions:
      halfLives.length > 0
        ? halfLives.sort((a, b) => a - b)[Math.floor(halfLives.length / 2)]
        : null,
    by_event_type: byEventType,
    h_characterized: halfLives.length >= 5,
    computed_at: new Date().toISOString(),
  };
}
