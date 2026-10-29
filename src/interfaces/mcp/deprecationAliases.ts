/**
 * GC sweep #2 (2026-10-22) — one-epoch deprecation aliases.
 *
 * Each tool named here stays REGISTERED for one epoch (no hard cut) but is
 * reduced to a minimal stub: empty input schema, deprecation description,
 * read-only annotations, and a handler that ignores all arguments and returns
 * the deprecation pointer. The old handler body is never called — the stub
 * replaces the registered handler outright. Removal decision at the removal
 * epoch belongs to F13 (888).
 *
 * Wiring: applyDeprecationAliases(server) is called at the END of core.ts —
 * AFTER every registration and AFTER installPolicyInterceptor /
 * installElicitationGate / installVerdictInterceptor — so the stub is the
 * final word in the registry and no gate chain of the retired implementation
 * runs.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const DEPRECATION_DATE = "2026-10-22";
const REMOVAL_EPOCH = "2026-11-05";

/** aliased tool name → surviving surface to use instead. */
const DEPRECATION_ALIASES: Record<string, string> = {
  // DEAD — capability exists natively or in a sibling organ
  forge_browser_navigate: "playwright MCP (native)",
  forge_canon_recall: "forge_memory",
  forge_docker: "docker CLI via Bash",
  forge_drive: "composio MCP / apa-gws-bridge",
  forge_execute: "forge_shell",
  forge_gemini: "FED model lanes / apa-gemini-bridge :18092",
  forge_github_create_or_update_file: "gh CLI",
  forge_postgres: "psql via Bash",
  forge_sheets: "composio MCP / apa-sheets-bridge",

  // MERGE
  forge_git_commit: "forge_git (mode=commit)",

  // DEPRECATE — organ relays / redundant wrappers
  forge_wealth: "WEALTH organ MCP :18082",
  forge_well: "WELL organ MCP :18083",
  forge_kernel: "arifOS kernel :8088 (arif_*)",
  forge_judge_proxy: "arif_judge :8088",
  forge_docsgpt: "forge_search (corpus=docs)",
  forge_compose: "forge_parallel / forge_shell chains",
  forge_github: "gh CLI",
  forge_github_get_file: "gh CLI",
  forge_calendar: "composio MCP / Google Calendar",
};

export function getDeprecationAlias(name: string): string | undefined {
  return DEPRECATION_ALIASES[name];
}

/**
 * Override every aliased tool in the SDK registry with its stub. Idempotent.
 * Unmatched names (tool not registered) are reported to stderr and skipped —
 * a GAP for the caller, never an error.
 */
export function applyDeprecationAliases(server: McpServer): void {
  const registry = (server as unknown as { _registeredTools?: Record<string, any> })._registeredTools;
  if (!registry) {
    process.stderr.write("[deprecationAliases] _registeredTools unavailable — aliases NOT applied\n");
    return;
  }
  for (const [name, survivor] of Object.entries(DEPRECATION_ALIASES)) {
    const tool = registry[name];
    if (!tool) {
      process.stderr.write(`[deprecationAliases] ${name} not registered — alias skipped (GAP)\n`);
      continue;
    }
    tool.description =
      `DEPRECATED (GC ${DEPRECATION_DATE}) — use ${survivor}. Removal epoch ${REMOVAL_EPOCH}.`;
    // Minimal zod object schema: serializes in tools/list as a bare object
    // schema; unknown arguments are accepted and silently stripped (zod
    // default), so the stub answers any args with the same body.
    tool.inputSchema = z.object({});
    tool.annotations = {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    };
    tool.handler = async () => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { deprecated: true, use: survivor, removal_epoch: REMOVAL_EPOCH },
            null,
            2,
          ),
        },
      ],
    });
  }
}
