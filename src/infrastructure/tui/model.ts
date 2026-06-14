/**
 * A-FORGE TUI Model — Single Source of Truth (MVU / Elm architecture)
 *
 * F2 TRUTH: All state changes flow through update() — no direct mutation.
 * F1 AMANAH: No write/mutate operations exposed from this model.
 * F9 ANTI-HANTU: Pure data structure, no behavior. Governance state carries
 *     provenance (source + staleness) to prevent local inference of floor verdicts.
 * F8 LAW: All data entering TUI state passes through Zod validation at adapter boundary.
 */

import { z } from "zod";

// ── Zod Schemas (F9 ANTI-HANTU gate at adapter boundary) ─────────────

export const TuiJobSchema = z.object({
  id: z.string(),
  task: z.string(),
  profile: z.string(),
  priority: z.string(),
  status: z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  turnsUsed: z.number().optional(),
  workerId: z.string().optional(),
  errorMessage: z.string().optional(),
  holdTicketId: z.string().optional(),
});

export const OrganHealthSchema = z.object({
  status: z.enum(["up", "down"]),
  http_status: z.number(),
  latency_ms: z.number(),
});

export const GovernanceStateSchema = z.object({
  floor: z.string(),
  name: z.string(),
  status: z.enum(["clear", "violation", "unknown"]),
  severity: z.string().optional(),
  // F2 TRUTH: provenance tracking — prevents local inference of floor verdicts
  source: z.string().default("unknown"),
  staleness_seconds: z.number().default(0),
  epoch_id: z.string().optional(),
});

export const MetricsSnapshotSchema = z.object({
  total: z.number(),
  pending: z.number(),
  running: z.number(),
  completed: z.number(),
  failed: z.number(),
  cancelled: z.number(),
  openHolds: z.number(),
});

export const LogEntrySchema = z.object({
  timestamp: z.string(),
  level: z.enum(["info", "warn", "error", "debug"]),
  message: z.string(),
});

// ── TypeScript Types (inferred from Zod) ──────────────────────────────

export type TuiJob = z.infer<typeof TuiJobSchema>;
export type OrganHealth = z.infer<typeof OrganHealthSchema>;
export type GovernanceState = z.infer<typeof GovernanceStateSchema>;
export type MetricsSnapshot = z.infer<typeof MetricsSnapshotSchema>;
export type LogEntry = z.infer<typeof LogEntrySchema>;
export type TuiJobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type TuiMode = "MONITOR" | "OPERATOR";

export interface TuiModel {
  // Data
  jobs: TuiJob[];
  organs: Record<string, OrganHealth>;
  governance: GovernanceState[];
  metrics: MetricsSnapshot;
  logs: LogEntry[];

  // UI State
  selectedJobId: string | null;
  selectedPanel: "jobs" | "gov" | "log";
  filterStatus: TuiJobStatus | "ALL";
  paused: boolean;
  lastUpdate: string;

  // Connection
  connected: boolean;
  error: string | null;

  // Constitutional
  lastMutationEpoch: string;
  uiMode: TuiMode;
}

// ── Defaults ──────────────────────────────────────────────────────────

export const INITIAL_GOVERNANCE: GovernanceState[] = [
  { floor: "F1", name: "AMANAH", status: "clear", source: "constitution", staleness_seconds: 0 },
  { floor: "F2", name: "TRUTH", status: "clear", source: "constitution", staleness_seconds: 0 },
  { floor: "F4", name: "CLARITY", status: "clear", source: "constitution", staleness_seconds: 0 },
  { floor: "F6", name: "MARUAH", status: "clear", source: "constitution", staleness_seconds: 0 },
  { floor: "F7", name: "HUMILITY", status: "clear", source: "constitution", staleness_seconds: 0 },
  { floor: "F8", name: "LAW", status: "clear", source: "constitution", staleness_seconds: 0 },
  { floor: "F9", name: "ANTI-HANTU", status: "clear", source: "constitution", staleness_seconds: 0 },
  { floor: "F13", name: "SOVEREIGN", status: "clear", source: "constitution", staleness_seconds: 0 },
];

export const INITIAL_METRICS: MetricsSnapshot = {
  total: 0, pending: 0, running: 0,
  completed: 0, failed: 0, cancelled: 0,
  openHolds: 0,
};

export const INITIAL_MODEL: TuiModel = {
  jobs: [],
  organs: {},
  governance: INITIAL_GOVERNANCE,
  metrics: INITIAL_METRICS,
  logs: [],
  selectedJobId: null,
  selectedPanel: "jobs",
  filterStatus: "ALL",
  paused: false,
  lastUpdate: new Date().toISOString(),
  connected: false,
  error: null,
  lastMutationEpoch: new Date().toISOString(),
  uiMode: "MONITOR",
};

// ── Messages (MVU: the only way to change state) ──────────────────────

export type TuiMessage =
  | { type: "JOBS_UPDATED"; jobs: TuiJob[] }
  | { type: "ORGANS_UPDATED"; organs: Record<string, OrganHealth> }
  | { type: "GOVERNANCE_UPDATED"; governance: GovernanceState[] }
  | { type: "METRICS_UPDATED"; metrics: MetricsSnapshot }
  | { type: "LOG_ADDED"; entry: LogEntry }
  | { type: "LOG_CLEAR" }
  | { type: "SELECT_JOB"; jobId: string | null }
  | { type: "SELECT_PANEL"; panel: "jobs" | "gov" | "log" }
  | { type: "FILTER_STATUS"; status: TuiJobStatus | "ALL" }
  | { type: "PAUSE_TOGGLE" }
  | { type: "CONNECTED"; connected: boolean }
  | { type: "ERROR"; error: string | null }
  | { type: "TICK"; timestamp: string }
  | { type: "MODE_CHANGE"; mode: TuiMode };

// ── Update function (pure, no side effects) ───────────────────────────

export function update(model: TuiModel, msg: TuiMessage): TuiModel {
  // F1 AMANAH: Never mutate — always return new model
  // F7/F13 constitutional guard: In MONITOR mode, reject any message that
  // would attempt to mutate execution state. Only UI-only messages pass through.
  const mutationMessages = new Set<TuiMessage["type"]>([
    // Reserved for future OPERATOR mode — currently no mutation messages exist
  ]);
  if (model.uiMode === "MONITOR" && mutationMessages.has(msg.type)) {
    console.error(`[TUI] CONSTITUTIONAL HOLD: ${msg.type} rejected in MONITOR mode`);
    return model;
  }

  switch (msg.type) {
    case "JOBS_UPDATED":
      return { ...model, jobs: msg.jobs, lastUpdate: new Date().toISOString() };

    case "ORGANS_UPDATED":
      return { ...model, organs: msg.organs, lastUpdate: new Date().toISOString() };

    case "GOVERNANCE_UPDATED":
      return { ...model, governance: msg.governance, lastUpdate: new Date().toISOString() };

    case "METRICS_UPDATED":
      return { ...model, metrics: msg.metrics, lastUpdate: new Date().toISOString() };

    case "LOG_ADDED": {
      const logs = [...model.logs, msg.entry].slice(-500); // keep last 500
      return { ...model, logs };
    }

    case "LOG_CLEAR":
      return { ...model, logs: [] };

    case "SELECT_JOB":
      return { ...model, selectedJobId: msg.jobId };

    case "SELECT_PANEL":
      return { ...model, selectedPanel: msg.panel };

    case "FILTER_STATUS":
      return { ...model, filterStatus: msg.status };

    case "PAUSE_TOGGLE":
      return { ...model, paused: !model.paused };

    case "CONNECTED":
      return { ...model, connected: msg.connected };

    case "ERROR":
      return { ...model, error: msg.error };

    case "TICK":
      return { ...model, lastUpdate: msg.timestamp };

    case "MODE_CHANGE":
      const epoch = new Date().toISOString();
      return { ...model, uiMode: msg.mode, lastMutationEpoch: epoch };

    default:
      return model;
  }
}

// ── Selectors (derived state) ─────────────────────────────────────────

export function getFilteredJobs(model: TuiModel): TuiJob[] {
  if (model.filterStatus === "ALL") return model.jobs;
  return model.jobs.filter((j) => j.status === model.filterStatus);
}

export function getRunningJobCount(model: TuiModel): number {
  return model.jobs.filter((j) => j.status === "RUNNING").length;
}

export function getQueuedJobCount(model: TuiModel): number {
  return model.jobs.filter((j) => j.status === "PENDING").length;
}

export function getFailedJobCount(model: TuiModel): number {
  return model.jobs.filter((j) => j.status === "FAILED").length;
}

export function getOrganSummary(model: TuiModel): { up: number; total: number; verdict: "GREEN" | "YELLOW" | "RED" } {
  const names = Object.keys(model.organs);
  const up = names.filter((n) => model.organs[n].status === "up").length;
  const total = names.length;
  const down = total - up;
  const verdict = down >= 2 ? "RED" : down === 1 ? "YELLOW" : "GREEN";
  return { up, total, verdict };
}
