/**
 * A-FORGE TUI Status Adapter
 *
 * Polls A-FORGE HTTP endpoints and normalises data for the TUI model.
 * Single adapter = single source of truth wiring.
 *
 * F1 AMANAH: Read-only polling. Never writes.
 * F8 LAW: Respects endpoint boundaries.
 */

import type { TuiModel, TuiJob, OrganHealth, MetricsSnapshot, LogEntry } from "../model.js";

const BASE = "http://127.0.0.1:7071";
const POLL_TIMEOUT = 5000;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), POLL_TIMEOUT);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Poll /jobs — returns normalised TuiJob array
 */
export async function pollJobs(): Promise<TuiJob[]> {
  const data = await fetchJson<{ ok: boolean; jobs: any[] }>(`${BASE}/jobs`);
  if (!data?.ok || !data.jobs) return [];
  return data.jobs.map((j: any) => ({
    id: j.id ?? "unknown",
    task: (j.task ?? "").slice(0, 80),
    profile: j.profile ?? "",
    priority: j.priority ?? "medium",
    status: j.status ?? "PENDING",
    createdAt: j.createdAt ?? new Date().toISOString(),
    startedAt: j.startedAt,
    completedAt: j.completedAt,
    turnsUsed: j.turnsUsed,
    workerId: j.workerId,
    errorMessage: j.errorMessage?.slice(0, 100),
    holdTicketId: j.holdTicketId,
  }));
}

/**
 * Poll /api/federation-probe — returns organ health map
 */
export async function pollOrgans(): Promise<Record<string, OrganHealth>> {
  const data = await fetchJson<{ ok: boolean; organs: Record<string, any> }>(`${BASE}/api/federation-probe`);
  if (!data?.ok || !data.organs) return {};
  const result: Record<string, OrganHealth> = {};
  for (const [name, o] of Object.entries(data.organs)) {
    result[name] = {
      status: (o as any).status ?? "down",
      http_status: (o as any).http_status ?? 0,
      latency_ms: (o as any).latency_ms ?? 0,
    };
  }
  return result;
}

/**
 * Poll /jobs/metrics — returns metrics snapshot
 */
export async function pollMetrics(): Promise<MetricsSnapshot | null> {
  const data = await fetchJson<{
    ok: boolean;
    total: number;
    counts: Record<string, number>;
    openHolds: number;
  }>(`${BASE}/jobs/metrics`);
  if (!data?.ok) return null;
  const c = data.counts ?? {};
  return {
    total: data.total ?? 0,
    pending: c.PENDING ?? 0,
    running: c.RUNNING ?? 0,
    completed: c.COMPLETED ?? 0,
    failed: c.FAILED ?? 0,
    cancelled: c.CANCELLED ?? 0,
    openHolds: data.openHolds ?? 0,
  };
}

/**
 * Full poll cycle — returns partial model update
 */
export async function pollAll(): Promise<{
  jobs: TuiJob[];
  organs: Record<string, OrganHealth>;
  metrics: MetricsSnapshot | null;
  timestamp: string;
}> {
  const [jobs, organs, metrics] = await Promise.all([
    pollJobs(),
    pollOrgans(),
    pollMetrics(),
  ]);

  return {
    jobs,
    organs,
    metrics,
    timestamp: new Date().toISOString(),
  };
}
