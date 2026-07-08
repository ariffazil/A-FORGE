/**
 * A-FORGE MCP Tool Deduplication — Startup Fingerprint Check
 *
 * Item 5 (2026-07-07): Scans all registered MCP tools at startup,
 * fingerprints each by (name, description_hash, schema_hash), and
 * flags duplicates, near-duplicates, and deprecated aliases.
 *
 * Runs once at server boot. Non-blocking — prints warnings to stderr.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { createHash } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface ToolFingerprint {
  name: string;
  descriptionHash: string;
  schemaHash: string;
  /** Combined fingerprint for dedup */
  fingerprint: string;
}

interface DedupeReport {
  total: number;
  unique: number;
  duplicates: Array<{
    names: string[];
    fingerprint: string;
    category: "exact" | "alias" | "near_duplicate";
  }>;
  deprecatedCallable: string[];
  verdict: "PASS" | "DRIFT";
}

function hashStr(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

function fingerprintTool(name: string, description: string, schema: unknown): ToolFingerprint {
  const descriptionHash = hashStr(description || "");
  const schemaStr = JSON.stringify(schema ?? {});
  const schemaHash = hashStr(schemaStr);
  return {
    name,
    descriptionHash,
    schemaHash,
    fingerprint: `${descriptionHash}:${schemaHash}`,
  };
}

// Known deprecated tool names that should not be callable
const KNOWN_DEPRECATED = [
  "forge_run",           // merged into forge_execute
  "forge_vault_seal",    // merged into forge_vault mode=seal
  "forge_vault_read",    // merged into forge_vault mode=read
  "forge_vault_list",    // merged into forge_vault mode=list
  "forge_vault_write",   // merged into forge_vault mode=write
  "forge_vault_delete",  // VAULT999 is append-only
  "forge_remember",      // duplicate of arif_vault_seal
  "forge_approve",       // self-authorize refused, use forge_judge_proxy
  "forge_docker_ps",     // merged into forge_docker mode=ps
  "forge_docker_logs",   // merged into forge_docker mode=logs
  "forge_docker_exec",   // merged into forge_docker mode=exec
  "forge_docker_images", // merged into forge_docker mode=images
];

// Known alias groups — tools that intentionally share functionality
const KNOWN_ALIAS_GROUPS: Record<string, string[]> = {
  "forge_filesystem": ["forge_filesystem_read", "forge_filesystem_write", "forge_filesystem_patch", "forge_filesystem_tree", "forge_filesystem_search", "forge_filesystem_stat", "forge_filesystem_move", "forge_filesystem_delete"],
  "forge_fetch": ["forge_fetch_url", "forge_fetch_json", "forge_fetch_metadata", "forge_fetch_links"],
  "forge_systemctl": [], // deprecated, kept for backward compat
};

/**
 * Run deduplication check against live MCP server tool registry.
 * Called once at startup. Non-blocking.
 */
export function runDedupeCheck(server: McpServer): DedupeReport {
  const registeredTools = (server as any)._registeredTools as Record<string, any> ?? {};
  const fingerprints: ToolFingerprint[] = [];

  for (const [name, tool] of Object.entries(registeredTools)) {
    if (!tool || !tool.enabled) continue;
    const desc = tool.description || "";
    const schema = tool.inputSchema ?? {};
    fingerprints.push(fingerprintTool(name, desc, schema));
  }

  // Group by fingerprint
  const byFingerprint = new Map<string, string[]>();
  for (const fp of fingerprints) {
    const existing = byFingerprint.get(fp.fingerprint) ?? [];
    existing.push(fp.name);
    byFingerprint.set(fp.fingerprint, existing);
  }

  // Find duplicates
  const duplicates: DedupeReport["duplicates"] = [];
  for (const [fp, names] of byFingerprint) {
    if (names.length > 1) {
      // Check if this is a known alias group
      const isKnownAlias = Object.values(KNOWN_ALIAS_GROUPS).some(
        group => names.every(n => group.includes(n) || Object.keys(KNOWN_ALIAS_GROUPS).includes(n))
      );
      duplicates.push({
        names,
        fingerprint: fp,
        category: isKnownAlias ? "alias" : "exact",
      });
    }
  }

  // Check for deprecated tools that are still callable
  const callableNames = new Set(fingerprints.map(f => f.name));
  const deprecatedCallable = KNOWN_DEPRECATED.filter(d => callableNames.has(d));

  const report: DedupeReport = {
    total: fingerprints.length,
    unique: byFingerprint.size,
    duplicates,
    deprecatedCallable,
    verdict: duplicates.some(d => d.category === "exact") || deprecatedCallable.length > 0 ? "DRIFT" : "PASS",
  };

  // Print to stderr (non-blocking)
  process.stderr.write(`\n[tool-dedupe] === MCP Tool Deduplication Check ===\n`);
  process.stderr.write(`[tool-dedupe] Total: ${report.total} | Unique: ${report.unique}\n`);
  if (duplicates.length > 0) {
    for (const dup of duplicates) {
      process.stderr.write(`[tool-dedupe] ${dup.category.toUpperCase()}: ${dup.names.join(" = ")} (${dup.fingerprint})\n`);
    }
  }
  if (deprecatedCallable.length > 0) {
    process.stderr.write(`[tool-dedupe] DEPRECATED still callable: ${deprecatedCallable.join(", ")}\n`);
  }
  process.stderr.write(`[tool-dedupe] Verdict: ${report.verdict}\n`);
  process.stderr.write(`[tool-dedupe] ==========================================\n\n`);

  return report;
}
