/**
 * forge_web_zen — Thin OBSERVE wrapper around the web_zen CLI.
 *
 * Does NOT invent authority. Modes map 1:1 to scripts/web-zen/web_zen.py.
 * GREEN: sense | verify | doctor | caddy-reload-hint | ephemeral
 * YELLOW: orphan (dry-run only)
 *
 * Humans use /missions. Agents call this instead of re-inventing deploy paths.
 *
 * @module mcp/webZenTools
 * @forged 2026-07-30 — forge-next slice
 * @constitutional F1 AMANAH — no rsync --delete apply; orphan is preview only
 * @constitutional F2 TRUTH — content-truth crawl, not status-only
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spawn } from "node:child_process";
import { telemetry } from "./telemetry.js";

const WEB_ZEN_CLI =
  process.env.WEB_ZEN_CLI ||
  "/root/arif-fazil.com/scripts/web-zen/web_zen.py";

const ALLOWED_MODES = [
  "sense",
  "verify",
  "orphan",
  "ephemeral",
  "doctor",
  "caddy-reload-hint",
] as const;

type Mode = (typeof ALLOWED_MODES)[number];

const telemetryInvoke = (tool: string) => {
  try {
    telemetry.recordInvocation(tool);
  } catch {
    /* best effort */
  }
};

function runWebZen(
  mode: Mode,
  extraArgs: string[] = [],
  timeoutMs = 120_000,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const args = [WEB_ZEN_CLI, mode, "--json", "--no-receipt", ...extraArgs];
    const child = spawn("python3", args, {
      env: {
        ...process.env,
        PYTHONDONTWRITEBYTECODE: "1",
      },
      timeout: timeoutMs,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      resolve({ code: 1, stdout, stderr: err.message });
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
    // Hard kill if still running past timeout (spawn timeout is soft on some Node)
    setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    }, timeoutMs + 1000).unref?.();
  });
}

export function registerWebZenTools(server: McpServer): void {
  server.tool(
    "forge_web_zen",
    "ACTUATOR · web · OBSERVE. Thin wrapper around web_zen CLI — agentic site sense/verify/orphan/ephemeral/doctor. Humans use six missions at /missions; agents call this instead of inventing deploy paths. Modes: sense, verify, orphan (dry-run only), ephemeral, doctor, caddy-reload-hint. No production rsync --delete. No Caddy authority self-grant. USE WHEN: site audit, missions 404, vitals proxies, SPA deploy check, ephemeral site parser.",
    {
      mode: z
        .enum(ALLOWED_MODES)
        .default("doctor")
        .describe("web_zen mode"),
      // orphan
      src: z.string().optional().describe("orphan: source dir"),
      dest: z.string().optional().describe("orphan: dest dir"),
      allow_deletes: z
        .boolean()
        .optional()
        .describe("orphan: do not fail when deletes listed (still dry-run)"),
      // ephemeral
      task: z.string().optional().describe("ephemeral: why this tool is needed"),
      code_file: z.string().optional().describe("ephemeral: path to python tool"),
      keep: z.boolean().optional().describe("ephemeral: keep workdir (debug)"),
      // verify
      url: z.string().optional().describe("verify: single URL"),
      timeout_sec: z.number().optional().describe("timeout seconds for verify/doctor"),
      session_id: z.string().optional(),
      actor_id: z.string().optional(),
    },
    async (args) => {
      await telemetryInvoke("forge_web_zen");
      const mode = (args.mode || "doctor") as Mode;
      if (!ALLOWED_MODES.includes(mode)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                ok: false,
                error: `mode not allowed: ${mode}`,
                allowed: ALLOWED_MODES,
              }),
            },
          ],
          isError: true,
        };
      }

      const extra: string[] = [];
      if (mode === "orphan") {
        if (!args.src || !args.dest) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  ok: false,
                  error: "orphan requires src and dest",
                }),
              },
            ],
            isError: true,
          };
        }
        extra.push("--src", args.src, "--dest", args.dest);
        if (args.allow_deletes) extra.push("--allow-deletes");
      }
      if (mode === "ephemeral") {
        if (!args.task) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  ok: false,
                  error: "ephemeral requires task (mission gap reason)",
                }),
              },
            ],
            isError: true,
          };
        }
        extra.push("--task", args.task);
        if (args.code_file) extra.push("--code-file", args.code_file);
        if (args.keep) extra.push("--keep");
      }
      if (mode === "verify" && args.url) {
        extra.push("--url", args.url);
      }
      if (
        (mode === "verify" || mode === "doctor" || mode === "ephemeral") &&
        args.timeout_sec
      ) {
        extra.push("--timeout", String(args.timeout_sec));
      }

      const { code, stdout, stderr } = await runWebZen(mode, extra);
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        parsed = { raw: stdout.slice(0, 8000) };
      }

      const ok =
        code === 0 &&
        typeof parsed === "object" &&
        parsed !== null &&
        (parsed as { ok?: boolean }).ok !== false;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                ok,
                mode,
                exit_code: code,
                result: parsed,
                stderr: stderr.slice(0, 2000) || undefined,
                doctrine:
                  "capability≠authority · missions not tool menus · ephemeral dies",
                human_cockpit: "https://arif-fazil.com/missions",
                cli: WEB_ZEN_CLI,
              },
              null,
              2,
            ),
          },
        ],
        isError: !ok,
      };
    },
  );
}
