/**
 * A-FORGE TUI Health — observable status for AAA cockpit and ARIF Cell
 *
 * TUI writes its state here periodically (via the TUI process).
 * Other agents read it via MCP tool or HTTP endpoint.
 *
 * F9 ANTI-HANTU: Pure observation data. No behavior or authority.
 * F2 TRUTH: All fields are OBSERVED from the running TUI process.
 */

export type TuiHealthStatus =
  | "RUNNING"
  | "STOPPED"
  | "ERROR"
  | "UNKNOWN";

export interface TuiHealthState {
  /** Whether the TUI process is alive and rendering */
  status: TuiHealthStatus;
  /** Number of active SSE subscribers */
  sseSubscribers: number;
  /** When the TUI process last reported in */
  lastHeartbeat: string;
  /** Epistemic: how we know this */
  source: "tui_self_report" | "http_poll" | "unknown";
  /** Number of poll cycles completed */
  pollCycles: number;
  /** Whether the TUI is paused */
  paused: boolean;
  /** Connected to A-FORGE server */
  connected: boolean;
}

const defaults: TuiHealthState = {
  status: "STOPPED",
  sseSubscribers: 0,
  lastHeartbeat: new Date().toISOString(),
  source: "unknown",
  pollCycles: 0,
  paused: false,
  connected: false,
};

let state: TuiHealthState = { ...defaults };

/** Called by the TUI process on each poll cycle */
export function reportTuiHealth(partial: Partial<TuiHealthState>): void {
  state = {
    ...state,
    ...partial,
    lastHeartbeat: new Date().toISOString(),
    source: "tui_self_report",
  };
}

/** Read current TUI health state (called by MCP tools and HTTP) */
export function getTuiHealth(): TuiHealthState {
  // Auto-detect stale: if no heartbeat in 15s, mark as UNKNOWN
  const age = Date.now() - new Date(state.lastHeartbeat).getTime();
  if (age > 15000 && state.status === "RUNNING") {
    state.status = "UNKNOWN";
    state.source = "http_poll";
  }
  return { ...state };
}

/** Reset health state (called on TUI shutdown) */
export function resetTuiHealth(): void {
  state = { ...defaults };
}
