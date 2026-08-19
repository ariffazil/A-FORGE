/**
 * surfaceGuardTools.ts — MCP Surface Guard tool registration
 *
 * Exposes the MCP Surface Guard (schema fingerprinting + drift detection)
 * as a federation MCP tool. Agents can check drift status, pin snapshots,
 * and run full federation drift checks.
 *
 * Constitutional:
 *   F1 AMANAH  — pinned schemas are reversible evidence
 *   F2 TRUTH   — drift is OBSERVED, not assumed
 *   F8 LAW     — schema boundary is constitutional
 *   F11 AUDIT  — every drift event logged
 *
 * @module mcp/surfaceGuardTools
 * @forged 2026-07-03 by FORGE (000Ω)
 */

import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getSurfaceGuardStore,
  SurfaceGuardRunner,
  DEFAULT_CONFIG,
  type FederationDriftReport,
  type DriftEvent,
} from "../../domain/governance/mcp-surface-guard.js";

const PROTOCOL_VERSION = process.env.MCP_PROTOCOL_VERSION || "2025-06-18";

/**
 * Register the forge_surface_guard MCP tool.
 */
export function registerSurfaceGuardTools(server: McpServer): void {
  server.tool(
    "forge_surface_guard",
    "MCP Surface Guard — schema fingerprinting + drift detection. Modes: check (run federation drift check), status (get cached drift log), pin (snapshot current tool surface), config (show guard config). F1 AMANAH + F2 TRUTH + F8 LAW + F11 AUDIT.",
    {
      mode: z
        .enum(["check", "status", "pin", "config"])
        .default("status")
        .describe("Surface guard operation mode"),
      organ_id: z
        .string()
        .optional()
        .describe("Specific organ to check (omit for all)"),
    },
    async ({ mode, organ_id }) => {
      const store = getSurfaceGuardStore();

      if (mode === "config") {
        const config = store.getConfig();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  config,
                  organs: config.organs.map((o) => o.id),
                  check_interval_ms: config.check_interval_ms,
                  snapshot_ttl_ms: config.snapshot_ttl_ms,
                  enforce_hold: config.enforce_hold,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (mode === "status") {
        const driftLog = store.getDriftLog();
        const recentDrifts = driftLog.slice(-20);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  total_drift_events: driftLog.length,
                  recent_drifts: recentDrifts,
                  has_blocking: driftLog.some(
                    (d) =>
                      d.severity === "CRITICAL" || d.severity === "HIGH"
                  ),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (mode === "pin") {
        // Pin snapshots for all organs or a specific one
        const organs = organ_id
          ? DEFAULT_CONFIG.organs.filter((o) => o.id === organ_id)
          : DEFAULT_CONFIG.organs;

        if (organs.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    status: "ERROR",
                    reason: `Organ '${organ_id}' not found in config`,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        const results: Array<{
          organ: string;
          status: string;
          tool_count?: number;
        }> = [];

        for (const organ of organs) {
          try {
            const url = organ.url.endsWith("/mcp")
              ? organ.url
              : `${organ.url}/mcp`;
            const initRes = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json, text/event-stream",
                "MCP-Protocol-Version": PROTOCOL_VERSION,
              },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: {
                  protocolVersion: PROTOCOL_VERSION,
                  capabilities: {},
                  clientInfo: { name: "surface-guard-pin", version: "1.0.0" },
                },
              }),
              signal: AbortSignal.timeout(10_000),
            });

            if (!initRes.ok) {
              results.push({
                organ: organ.id,
                status: `DOWN (HTTP ${initRes.status})`,
              });
              continue;
            }

            const sessionId =
              initRes.headers.get("mcp-session-id") ?? undefined;
            const initText = await initRes.text();
            let listChangedCapable = false;

            if (initText.includes("event:")) {
              const dataMatch = initText.match(
                /data:\s*(\{[\s\S]*?\})\s*(?:\n\n|$)/
              );
              if (dataMatch) {
                const initData = JSON.parse(dataMatch[1]);
                listChangedCapable =
                  !!initData.result?.capabilities?.tools?.listChanged;
              }
            } else {
              const initData = JSON.parse(initText);
              listChangedCapable =
                !!initData.result?.capabilities?.tools?.listChanged;
            }

            const headers: Record<string, string> = {
              "Content-Type": "application/json",
              Accept: "application/json, text/event-stream",
              "MCP-Protocol-Version": PROTOCOL_VERSION,
            };
            if (sessionId) headers["Mcp-Session-Id"] = sessionId;

            const listRes = await fetch(url, {
              method: "POST",
              headers,
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 2,
                method: "tools/list",
                params: {},
              }),
              signal: AbortSignal.timeout(10_000),
            });

            if (!listRes.ok) {
              results.push({
                organ: organ.id,
                status: `tools/list failed (HTTP ${listRes.status})`,
              });
              continue;
            }

            const listText = await listRes.text();
            let tools: Array<{
              name: string;
              description?: string;
              inputSchema?: Record<string, unknown>;
            }> = [];

            if (listText.includes("event:")) {
              const dataMatch = listText.match(
                /data:\s*(\{[\s\S]*?\})\s*(?:\n\n|$)/
              );
              if (dataMatch) {
                const listData = JSON.parse(dataMatch[1]);
                tools = listData.result?.tools ?? [];
              }
            } else {
              const listData = JSON.parse(listText);
              tools = listData.result?.tools ?? [];
            }

            const { createSnapshot } = await import(
              "../../domain/governance/mcp-surface-guard.js"
            );
            const snapshot = createSnapshot(
              organ.id,
              organ.url,
              tools,
              listChangedCapable
            );
            store.pin(organ.id, snapshot);

            results.push({
              organ: organ.id,
              status: "PINNED",
              tool_count: tools.length,
            });
          } catch (err) {
            results.push({
              organ: organ.id,
              status: `ERROR: ${(err as Error).message}`,
            });
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  action: "pin",
                  results,
                  pinned_count: results.filter((r) => r.status === "PINNED")
                    .length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (mode === "check") {
        const organs = organ_id
          ? DEFAULT_CONFIG.organs.filter((o) => o.id === organ_id)
          : DEFAULT_CONFIG.organs;

        if (organs.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    status: "ERROR",
                    reason: `Organ '${organ_id}' not found in config`,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        const runner = new SurfaceGuardRunner(store, organs);
        const report = await runner.check();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(report, null, 2),
            },
          ],
          ...(report.status === "HOLD" ? { isError: true } : {}),
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Unknown mode: ${mode}`,
          },
        ],
        isError: true,
      };
    }
  );
}
