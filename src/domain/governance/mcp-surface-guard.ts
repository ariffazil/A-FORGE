/**
 * MCP Surface Guard — Schema Fingerprinting & Drift Detection
 * 
 * Q3: Detects MCP tools/list drift before it breaks the federation.
 * Hash-pins tool schemas at session init, re-verifies on every call.
 * Schema delta = 888_HOLD.
 * 
 * Constitutional alignment:
 *   F1 AMANAH — pinned schemas are reversible evidence
 *   F2 TRUTH — drift is OBSERVED, not assumed
 *   F8 LAW — schema boundary is constitutional
 *   F11 AUDIT — every drift event logged
 * 
 * FORGED: 2026-07-03
 * VERDICT: PROCEED_TO_SURFACE_GUARD_BUILD
 */

import * as crypto from 'crypto';

// ─── Types ─────────────────────────────────────────────────────────

export interface ToolFingerprint {
  name: string;
  schema_hash: string;
  description_hash: string;
  pinned_at: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface OrganSurfaceSnapshot {
  organ_id: string;
  organ_url: string;
  tools: Map<string, ToolFingerprint>;
  snapshot_at: string;
  tool_count: number;
  list_changed_capable: boolean;
  /** SEP-2549: TTL hint from tools/list response. 0 = immediately stale. */
  ttl_ms: number;
  /** SEP-2549: "public" (any client can cache) or "private" (requesting client only). */
  cache_scope: 'public' | 'private';
}

export interface DriftEvent {
  organ_id: string;
  tool_name: string;
  drift_type: 'SCHEMA_CHANGE' | 'DESCRIPTION_CHANGE' | 'TOOL_ADDED' | 'TOOL_REMOVED' | 'TOOL_RENAMED';
  old_hash: string | null;
  new_hash: string | null;
  detected_at: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface DriftVerdict {
  status: 'PASS' | 'DRIFT_DETECTED' | 'HOLD';
  drifts: DriftEvent[];
  organs_checked: number;
  organs_passed: number;
  organs_drifted: string[];
  checked_at: string;
}

export interface SurfaceGuardConfig {
  /** How often to check (ms) */
  check_interval_ms: number;
  /** Which organs to monitor */
  organs: Array<{ id: string; url: string }>;
  /** TTL for cached snapshots (ms) — after this, force re-check */
  snapshot_ttl_ms: number;
  /** Whether to enforce HOLD on drift */
  enforce_hold: boolean;
  /** Drift events older than this are archived (ms) */
  drift_archive_age_ms: number;
}

// ─── Defaults ──────────────────────────────────────────────────────

export const DEFAULT_CONFIG: SurfaceGuardConfig = {
  check_interval_ms: 60_000,
  organs: [
    { id: 'arifos', url: 'http://localhost:8088' },
    { id: 'aforge', url: 'http://localhost:7072' },
    { id: 'geox', url: 'http://localhost:8081' },
    { id: 'wealth', url: 'http://localhost:18082' },
    { id: 'well', url: 'http://localhost:18083' },
    { id: 'aaa', url: 'http://localhost:3001' },
  ],
  snapshot_ttl_ms: 300_000, // 5 minutes
  enforce_hold: true,
  drift_archive_age_ms: 86_400_000, // 24 hours
};

// ─── Fingerprinting ────────────────────────────────────────────────

/**
 * Compute a stable SHA-256 hash of a tool's schema.
 * Deep-canonical: recursively sorts all keys at every nesting level.
 */
export function fingerprintSchema(schema: Record<string, unknown> | undefined): string {
  if (!schema) return 'no_schema';
  // Deep canonical: recursive sort at every level
  const canonical = JSON.stringify(schema, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value).sort().reduce((sorted: Record<string, unknown>, k) => {
        sorted[k] = (value as Record<string, unknown>)[k];
        return sorted;
      }, {});
    }
    return value;
  });
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

export function fingerprintDescription(description: string | undefined): string {
  if (!description) return 'no_description';
  return crypto.createHash('sha256').update(description).digest('hex').slice(0, 16);
}

export function fingerprintTool(tool: {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}): ToolFingerprint {
  return {
    name: tool.name,
    schema_hash: fingerprintSchema(tool.inputSchema),
    description_hash: fingerprintDescription(tool.description),
    pinned_at: new Date().toISOString(),
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
  };
}

// ─── Snapshot Operations ───────────────────────────────────────────

export interface MCPToolFromList {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export function createSnapshot(
  organId: string,
  organUrl: string,
  tools: MCPToolFromList[],
  listChangedCapable: boolean,
  ttlMs: number = 0,
  cacheScope: 'public' | 'private' = 'public'
): OrganSurfaceSnapshot {
  const toolMap = new Map<string, ToolFingerprint>();
  for (const tool of tools) {
    toolMap.set(tool.name, fingerprintTool(tool));
  }
  return {
    organ_id: organId,
    organ_url: organUrl,
    tools: toolMap,
    snapshot_at: new Date().toISOString(),
    tool_count: tools.length,
    list_changed_capable: listChangedCapable,
    ttl_ms: ttlMs,
    cache_scope: cacheScope,
  };
}

// ─── Drift Detection ───────────────────────────────────────────────

/**
 * Compare two snapshots and return all detected drift events.
 */
export function detectDrift(
  previous: OrganSurfaceSnapshot,
  current: OrganSurfaceSnapshot
): DriftEvent[] {
  const drifts: DriftEvent[] = [];
  const now = new Date().toISOString();

  // Check for removed or changed tools
  for (const [name, oldFp] of previous.tools) {
    const newFp = current.tools.get(name);

    if (!newFp) {
      drifts.push({
        organ_id: current.organ_id,
        tool_name: name,
        drift_type: 'TOOL_REMOVED',
        old_hash: oldFp.schema_hash,
        new_hash: null,
        detected_at: now,
        severity: 'CRITICAL',
      });
      continue;
    }

    // Schema changed
    if (oldFp.schema_hash !== newFp.schema_hash) {
      drifts.push({
        organ_id: current.organ_id,
        tool_name: name,
        drift_type: 'SCHEMA_CHANGE',
        old_hash: oldFp.schema_hash,
        new_hash: newFp.schema_hash,
        detected_at: now,
        severity: 'HIGH',
      });
    }

    // Description changed (lower severity — may be cosmetic)
    if (oldFp.description_hash !== newFp.description_hash) {
      drifts.push({
        organ_id: current.organ_id,
        tool_name: name,
        drift_type: 'DESCRIPTION_CHANGE',
        old_hash: oldFp.description_hash,
        new_hash: newFp.description_hash,
        detected_at: now,
        severity: 'LOW',
      });
    }
  }

  // Check for added tools
  for (const [name] of current.tools) {
    if (!previous.tools.has(name)) {
      drifts.push({
        organ_id: current.organ_id,
        tool_name: name,
        drift_type: 'TOOL_ADDED',
        old_hash: null,
        new_hash: current.tools.get(name)!.schema_hash,
        detected_at: now,
        severity: 'MEDIUM',
      });
    }
  }

  return drifts;
}

/**
 * Check a single tool call against its pinned fingerprint.
 * Returns null if no drift, DriftEvent if schema changed.
 */
export function checkToolCall(
  pinned: ToolFingerprint,
  currentTool: MCPToolFromList
): DriftEvent | null {
  const currentHash = fingerprintSchema(currentTool.inputSchema);
  if (pinned.schema_hash !== currentHash) {
    return {
      organ_id: '', // Caller fills in
      tool_name: pinned.name,
      drift_type: 'SCHEMA_CHANGE',
      old_hash: pinned.schema_hash,
      new_hash: currentHash,
      detected_at: new Date().toISOString(),
      severity: 'HIGH',
    };
  }
  return null;
}

// ─── Surface Guard Store ───────────────────────────────────────────

/**
 * In-memory store for surface guard state.
 * Production: persist to /root/A-FORGE/config/surface-snapshots.json
 */
export class SurfaceGuardStore {
  private snapshots = new Map<string, OrganSurfaceSnapshot>();
  private driftLog: DriftEvent[] = [];
  private config: SurfaceGuardConfig;

  constructor(config: Partial<SurfaceGuardConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Pin a snapshot for an organ */
  pin(organId: string, snapshot: OrganSurfaceSnapshot): void {
    this.snapshots.set(organId, snapshot);
  }

  /** Get pinned snapshot */
  getPinned(organId: string): OrganSurfaceSnapshot | undefined {
    return this.snapshots.get(organId);
  }

  /** Check if snapshot is still fresh (respecting SEP-2549 TTL when available) */
  isFresh(organId: string): boolean {
    const snap = this.snapshots.get(organId);
    if (!snap) return false;
    const age = Date.now() - new Date(snap.snapshot_at).getTime();
    // SEP-2549: use organ's ttl_ms if > 0, else fall back to config TTL
    const effectiveTtl = snap.ttl_ms > 0 ? snap.ttl_ms : this.config.snapshot_ttl_ms;
    return age < effectiveTtl;
  }

  /** Run drift detection for one organ against its pinned snapshot */
  checkOrgan(
    organId: string,
    currentTools: MCPToolFromList[],
    listChangedCapable: boolean,
    ttlMs: number = 0,
    cacheScope: 'public' | 'private' = 'public'
  ): DriftEvent[] {
    const pinned = this.snapshots.get(organId);
    if (!pinned) {
      // First time — pin and return no drift
      const url = this.config.organs.find(o => o.id === organId)?.url ?? '';
      this.pin(organId, createSnapshot(organId, url, currentTools, listChangedCapable, ttlMs, cacheScope));
      return [];
    }

    const current = createSnapshot(organId, pinned.organ_url, currentTools, listChangedCapable, ttlMs, cacheScope);
    const drifts = detectDrift(pinned, current);

    if (drifts.length > 0) {
      this.driftLog.push(...drifts);
      // Update pinned snapshot to current state (the drift is logged)
      this.pin(organId, current);
    }

    return drifts;
  }

  /** Full federation check — returns verdict */
  checkAll(
    organTools: Map<string, { tools: MCPToolFromList[]; listChangedCapable: boolean }>
  ): DriftVerdict {
    const allDrifts: DriftEvent[] = [];
    const organsDrifted: string[] = [];
    let organsPassed = 0;

    for (const [organId, data] of organTools) {
      const drifts = this.checkOrgan(organId, data.tools, data.listChangedCapable);
      if (drifts.length > 0) {
        organsDrifted.push(organId);
        allDrifts.push(...drifts);
      } else {
        organsPassed++;
      }
    }

    const hasBlocking = allDrifts.some(
      d => d.severity === 'CRITICAL' || d.severity === 'HIGH'
    );

    return {
      status: hasBlocking && this.config.enforce_hold
        ? 'HOLD'
        : allDrifts.length > 0
          ? 'DRIFT_DETECTED'
          : 'PASS',
      drifts: allDrifts,
      organs_checked: organTools.size,
      organs_passed: organsPassed,
      organs_drifted: organsDrifted,
      checked_at: new Date().toISOString(),
    };
  }

  /** Get all drift events (for audit) */
  getDriftLog(): DriftEvent[] {
    return [...this.driftLog];
  }

  /**
   * SEP-2549: Invalidate cache for an organ on listChanged notification.
   * When a server pushes notifications/tools/list_changed, call this
   * to force re-fetch on next check regardless of remaining TTL.
   */
  invalidateCache(organId: string): void {
    const snap = this.snapshots.get(organId);
    if (snap) {
      // Set snapshot_at to epoch so isFresh returns false
      snap.snapshot_at = '1970-01-01T00:00:00.000Z';
      this.snapshots.set(organId, snap);
    }
  }

  /** Get config */
  getConfig(): SurfaceGuardConfig {
    return { ...this.config };
  }
}

// ─── Federation Drift Runner ───────────────────────────────────────

export interface OrganDriftReport {
  organ_id: string;
  status: 'OK' | 'DRIFT' | 'DOWN' | 'MISSING_REQUIRED';
  tool_count: number;
  required_tools_present: string[];
  required_tools_missing: string[];
  drift_events: DriftEvent[];
  latency_ms: number;
  checked_at: string;
}

export interface FederationDriftReport {
  status: 'PASS' | 'DRIFT_DETECTED' | 'HOLD';
  organs: OrganDriftReport[];
  total_drifts: number;
  total_missing_required: number;
  checked_at: string;
  verdict_reason?: string;
}

export interface OrganConfig {
  id: string;
  url: string;
  required_tools?: string[];
}

export interface MCPToolFromListResponse {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface MCPListResponse {
  tools: MCPToolFromListResponse[];
  [key: string]: unknown;
}

/**
 * Fetch tools/list from an MCP organ via Streamable HTTP.
 * Sends JSON-RPC 2.0 initialize + tools/list.
 */
async function fetchOrganTools(
  organUrl: string,
  timeoutMs: number = 10_000
): Promise<{ tools: MCPToolFromListResponse[]; latency_ms: number; list_changed_capable: boolean }> {
  const start = Date.now();

  // Step 1: Initialize
  const initBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'surface-guard', version: '1.0.0' },
    },
  };

  const mcpUrl = organUrl.endsWith('/mcp') ? organUrl : `${organUrl}/mcp`;

  const initRes = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-11-25',
    },
    body: JSON.stringify(initBody),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!initRes.ok) {
    throw new Error(`Initialize failed: HTTP ${initRes.status}`);
  }

  // Parse response — handle both JSON and SSE
  const initText = await initRes.text();
  let sessionId: string | undefined;
  let listChangedCapable = false;

  if (initText.includes('event:')) {
    // SSE format
    const dataMatch = initText.match(/data:\s*(\{[\s\S]*?\})\s*(?:\n\n|$)/);
    if (dataMatch) {
      const initData = JSON.parse(dataMatch[1]);
      listChangedCapable = !!initData.result?.capabilities?.tools?.listChanged;
    }
  } else {
    const initData = JSON.parse(initText);
    listChangedCapable = !!initData.result?.capabilities?.tools?.listChanged;
  }

  // Extract session from Mcp-Session header
  sessionId = initRes.headers.get('mcp-session-id') ?? undefined;

  // Step 2: tools/list
  const listBody = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {},
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': '2025-11-25',
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  const listRes = await fetch(mcpUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(listBody),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!listRes.ok) {
    throw new Error(`tools/list failed: HTTP ${listRes.status}`);
  }

  const listText = await listRes.text();
  let tools: MCPToolFromListResponse[] = [];

  if (listText.includes('event:')) {
    const dataMatch = listText.match(/data:\s*(\{[\s\S]*?\})\s*(?:\n\n|$)/);
    if (dataMatch) {
      const listData = JSON.parse(dataMatch[1]);
      tools = listData.result?.tools ?? [];
    }
  } else {
    const listData = JSON.parse(listText);
    tools = listData.result?.tools ?? [];
  }

  return {
    tools,
    latency_ms: Date.now() - start,
    list_changed_capable: listChangedCapable,
  };
}

/**
 * Federation Drift Runner — the actual watcher.
 * Fetches tools/list from all organs, compares against pinned snapshots,
 * checks required tools are present, returns federation-wide drift verdict.
 */
export class SurfaceGuardRunner {
  private store: SurfaceGuardStore;
  private organs: OrganConfig[];
  private onDrift: ((report: FederationDriftReport) => void) | null = null;

  constructor(
    store: SurfaceGuardStore,
    organs: OrganConfig[],
    onDrift?: (report: FederationDriftReport) => void
  ) {
    this.store = store;
    this.organs = organs;
    this.onDrift = onDrift ?? null;
  }

  /** Run a single drift check across all organs */
  async check(): Promise<FederationDriftReport> {
    const organReports: OrganDriftReport[] = [];
    let totalDrifts = 0;
    let totalMissingRequired = 0;

    for (const organ of this.organs) {
      const report: OrganDriftReport = {
        organ_id: organ.id,
        status: 'OK',
        tool_count: 0,
        required_tools_present: [],
        required_tools_missing: [],
        drift_events: [],
        latency_ms: 0,
        checked_at: new Date().toISOString(),
      };

      try {
        const result = await fetchOrganTools(organ.url);
        report.tool_count = result.tools.length;
        report.latency_ms = result.latency_ms;

        // Check required tools
        const toolNames = new Set(result.tools.map(t => t.name));
        for (const req of organ.required_tools ?? []) {
          if (toolNames.has(req)) {
            report.required_tools_present.push(req);
          } else {
            report.required_tools_missing.push(req);
            totalMissingRequired++;
          }
        }

        // Run drift detection against pinned snapshot
        const drifts = this.store.checkOrgan(
          organ.id,
          result.tools.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
            outputSchema: t.outputSchema,
          })),
          result.list_changed_capable
        );

        report.drift_events = drifts;
        totalDrifts += drifts.length;

        if (report.required_tools_missing.length > 0) {
          report.status = 'MISSING_REQUIRED';
        } else if (drifts.length > 0) {
          report.status = 'DRIFT';
        } else {
          report.status = 'OK';
        }
      } catch (err) {
        report.status = 'DOWN';
        report.drift_events = [{
          organ_id: organ.id,
          tool_name: '*',
          drift_type: 'TOOL_REMOVED',
          old_hash: null,
          new_hash: null,
          detected_at: new Date().toISOString(),
          severity: 'CRITICAL',
        }];
        totalDrifts++;
      }

      organReports.push(report);
    }

    const hasBlocking = organReports.some(
      r => r.status === 'DOWN' || r.status === 'MISSING_REQUIRED' || r.status === 'DRIFT'
    );

    const report: FederationDriftReport = {
      status: hasBlocking ? 'HOLD' : totalDrifts > 0 ? 'DRIFT_DETECTED' : 'PASS',
      organs: organReports,
      total_drifts: totalDrifts,
      total_missing_required: totalMissingRequired,
      checked_at: new Date().toISOString(),
      verdict_reason: hasBlocking
        ? `MCP_TOOL_SURFACE_DRIFT: ${totalDrifts} drifts, ${totalMissingRequired} missing required tools`
        : undefined,
    };

    if (hasBlocking && this.onDrift) {
      this.onDrift(report);
    }

    // P1-5g: Forward drift report to arifFLOW — fire-and-forget
    setImmediate(() => {
      _forwardDriftToArifFlow(report).catch(() => {});
    });

    return report;
  }

  /** Run continuous checking at configured interval */
  start(intervalMs: number = 60_000): NodeJS.Timeout {
    return setInterval(() => {
      this.check().catch(err => {
        process.stderr.write(`[SurfaceGuard] Check failed: ${err}\n`);
      });
    }, intervalMs);
  }
}

// ── P1-5g: arifFlow drift report forwarding ────────────────────────────────

/**
 * P1-5g: Forward federation drift report to arifFLOW :7073/receipt/emit.
 * Fire-and-forget — failure is silent, local drift report is canonical.
 * DEPRECATED P1-7: will be replaced by arifFLOW client import post-extraction.
 */
async function _forwardDriftToArifFlow(report: FederationDriftReport): Promise<void> {
  try {
    await fetch("http://127.0.0.1:7073/receipt/emit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organ: "A-FORGE",
        producer: "SurfaceGuard",
        action: "drift_report",
        scope: `federation:${report.organs.length}_organs`,
        risk: report.status === "HOLD" ? "CONSEQUENTIAL" : "OPERATIONAL",
        epistemic_label: "OBS",
        confidence: 0.85,
        verdict: report.status === "PASS" ? "SEAL"
          : report.status === "HOLD" ? "HOLD" : "VOID",
        metadata: {
          status: report.status,
          total_drifts: report.total_drifts,
          total_missing_required: report.total_missing_required,
          organs_down: report.organs.filter(o => o.status === "DOWN").map(o => o.organ_id),
          organs_drift: report.organs.filter(o => o.status === "DRIFT").map(o => o.organ_id),
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // arifFLOW unreachable — local drift report is canonical
  }
}

// ─── Singleton (for federation-wide use) ───────────────────────────

let _store: SurfaceGuardStore | null = null;

export function getSurfaceGuardStore(config?: Partial<SurfaceGuardConfig>): SurfaceGuardStore {
  if (!_store) {
    _store = new SurfaceGuardStore(config);
  }
  return _store;
}

export function resetSurfaceGuardStore(): void {
  _store = null;
}
