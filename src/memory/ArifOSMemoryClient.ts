/**
 * ArifOSMemoryClient — Federation Memory Bridge for A-FORGE
 *
 * Single-write surface contract: every organ (including A-FORGE) writes memory
 * through arifOS `arif_memory_recall(mode="store")`. This module is the
 * TypeScript bridge for that contract.
 *
 * Per FEDERATION_MEMORY_CONTRACT.md (arifOS/docs):
 *   R1 — Single write surface
 *   R2 — Mandatory provenance (actor_id, session_id)
 *   R3 — Tier discipline (sacred|canon|session|ephemeral)
 *   R4 — Read-with-context for SEAL/SABAR/VOID decisions
 *
 * Behaviour:
 *   - Fire-and-forget by default (organ tool never blocks on memory)
 *   - JSON-RPC 2.0 over HTTP to arifOS MCP endpoint
 *   - Auto-initialises MCP session on first call (5min TTL)
 *   - Surfaces F11 HOLD with explicit non-fatal log
 *   - L5 Graphiti status is ADVISORY ONLY (worker neutralized by 888)
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { logFederationFailure } from "./LongTermMemoryFailureLog.js";

const ARIFOS_MCP_URL = process.env.ARIFOS_MCP_URL ?? "http://localhost:8088";
const ACTOR_ID = "a-forge";
const EMBED_TIMEOUT_MS = 5_000;
const CALL_TIMEOUT_MS = 30_000;

interface ArifosStoreResult {
  stored: boolean;
  memory_id?: string;
  point_id?: string;
  pg_id?: string;
  pg_ok?: boolean;
  l5_status?: string;
  backends?: { qdrant?: boolean; postgres?: boolean; graphiti?: string };
  verdict?: string;
  reasons?: string[];
  failed_floors?: string[];
  error?: string;
  _degraded?: string;
}

let _sessionId: string | null = null;
let _sessionTs = 0;
const SESSION_TTL_MS = 5 * 60 * 1000;

async function ensureSession(): Promise<string | null> {
  const now = Date.now();
  if (_sessionId && now - _sessionTs < SESSION_TTL_MS) return _sessionId;
  try {
    const r = await fetch(`${ARIFOS_MCP_URL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "A-FORGE", version: "0.1" },
        },
      }),
    });
    const sid = r.headers.get("mcp-session-id");
    if (sid) {
      _sessionId = sid;
      _sessionTs = now;
      return sid;
    }
  } catch (e) {
    logFederationFailure("arifos_session_init", {
      error: e instanceof Error ? e.message : String(e),
      mcpUrl: ARIFOS_MCP_URL,
    });
  }
  return null;
}

/**
 * Store a memory through arifOS MCP. This is the canonical federation write.
 *
 * @param params - content, tags, tier, session_id, etc.
 * @returns FederationStoreResult — NEVER throws (F2 truth: graceful degradation)
 */
export async function arifosStore(params: {
  content: string;
  tags?: string[];
  tier?: "sacred" | "canon" | "session" | "ephemeral";
  session_id?: string;
  summary?: string;
  context?: "normal" | "high_stakes" | "canon";
  metadata?: Record<string, unknown>;
}): Promise<ArifosStoreResult> {
  const tier = params.tier ?? "session";
  const session_id = params.session_id ?? "a-forge-default-session";
  const ctx = params.context ?? "normal";

  try {
    const sid = await ensureSession();
    if (!sid) {
      return {
        stored: false,
        error: "session_unavailable",
        _degraded: "arifOS MCP session init failed; local file write retained",
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
    try {
      const r = await fetch(`${ARIFOS_MCP_URL}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "mcp-session-id": sid,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Math.floor(Math.random() * 1_000_000),
          method: "tools/call",
          params: {
            name: "arif_memory_recall",
            arguments: {
              mode: "store",
              metadata: {
                content: params.content,
                tags: params.tags ?? [],
                summary: params.summary,
                context: ctx,
                ...(params.metadata ?? {}),
              },
              actor_id: ACTOR_ID,
              session_id,
              tier,
            },
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      // SSE response: parse "data: {...}" lines
      const text = await r.text();
      const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) {
        return { stored: false, error: "no_data_in_response" };
      }
      const payload = JSON.parse(dataLine.slice(6));
      const sc = payload?.result?.structuredContent;
      if (!sc) {
        return { stored: false, error: "no_structured_content" };
      }

      // F11 HOLD / VOID / SABAR — explicit, non-fatal
      if (sc.verdict && sc.verdict !== "SEAL") {
        logFederationFailure("arifos_floor_hold", {
          verdict: sc.verdict,
          reasons: sc.reasons,
          failed_floors: sc.failed_floors,
          content_excerpt: params.content.slice(0, 200),
        });
        return {
          stored: false,
          verdict: sc.verdict,
          reasons: sc.reasons,
          failed_floors: sc.failed_floors,
          _degraded: `arifOS returned ${sc.verdict}; local file write retained`,
        };
      }

      return {
        stored: true,
        memory_id: sc.memory_id,
        point_id: sc.point_id,
        pg_id: sc.pg_id,
        pg_ok: sc.pg_ok,
        l5_status: sc.l5_status,
        backends: sc.backends,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    logFederationFailure("arifos_store_exception", {
      error: e instanceof Error ? e.message : String(e),
      content_excerpt: params.content.slice(0, 200),
    });
    return {
      stored: false,
      error: e instanceof Error ? e.message : String(e),
      _degraded: "arifOS MCP call failed; local file write retained",
    };
  }
}

/**
 * Search memory through arifOS MCP. Cross-organ semantic search.
 */
export async function arifosSearch(params: {
  query: string;
  session_id?: string;
  limit?: number;
  context?: "normal" | "high_stakes" | "canon";
}): Promise<{ status: string; results?: unknown[]; _degraded?: string }> {
  const sid = await ensureSession();
  if (!sid) {
    return { status: "session_unavailable", _degraded: "arifOS MCP unreachable" };
  }
  try {
    const r = await fetch(`${ARIFOS_MCP_URL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sid,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Math.floor(Math.random() * 1_000_000),
        method: "tools/call",
        params: {
          name: "arif_memory_recall",
          arguments: {
            mode: "search",
            query: params.query,
            session_id: params.session_id ?? "a-forge-default-session",
            actor_id: ACTOR_ID,
            limit: params.limit ?? 5,
            context: params.context ?? "normal",
          },
        },
      }),
    });
    const text = await r.text();
    const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
    if (!dataLine) return { status: "no_data" };
    const payload = JSON.parse(dataLine.slice(6));
    const sc = payload?.result?.structuredContent;
    if (!sc) return { status: "no_structured_content" };
    return {
      status: "ok",
      results: sc.results ?? [],
    };
  } catch (e) {
    return {
      status: "exception",
      _degraded: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Get the canonical federation contract surface this client targets.
 */
export function getArifosContractSurface(): {
  mcpUrl: string;
  actor: string;
  contract: string;
  l5_status: string;
} {
  return {
    mcpUrl: ARIFOS_MCP_URL,
    actor: ACTOR_ID,
    contract: "FEDERATION_MEMORY_CONTRACT.md (R1: single write surface)",
    l5_status: "advisory_only (worker neutralized; 888 injects via raw Cypher)",
  };
}
