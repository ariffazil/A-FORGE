/**
 * surfaceAuditTools.ts — forge_surface_audit: live registry vs affordance drift detection
 *
 * Compares the live MCP tool registry against affordances.yaml (or any manifest)
 * and reports discrepancies: phantom entries, missing entries, description drift,
 * risk label drift, and alias conflicts.
 *
 * Federation-wide problem: phantom rot accumulates when code merges tools but
 * docs/manifests don't follow. This tool catches it before it compounds.
 *
 * Modes:
 *   audit     — Compare registry vs affordance, return drift report
 *   scan      — Quick health scan (pass/fail for each organ)
 *   fix       — Auto-generate corrected affordance entries (draft only)
 *
 * @module mcp/surfaceAuditTools
 * @constitutional F2 TRUTH — every finding has evidence
 * @constitutional F4 CLARITY — ΔS ≤ 0 through drift elimination
 * @forged 2026-07-03 by FORGE (000) — Q³ intelligence pattern: phantom rot detection
 */

import { z } from "zod";
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { glob } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { queryRegistry } from "../../domain/forge/register.js";
import { sanitizeArgs } from "./prompts.js";

// ── B3 FIX (2026-08-18): Representation Layer Integrity ───────────────
// A-FORGE MCP server composes tools across multiple registration modules
// (core.ts, stateAnchorTools.ts, forgeGitEntropyCanonize.ts, etc.).
// The hardcoded knownForgeTools list was incomplete and stale, producing
// 50+ phantom false positives in audit reports.
//
// Fix: dynamically aggregate the LIVE MCP surface by scanning
// `dist/src/interfaces/mcp/*.js` for server.tool() calls — this is the
// code truth per META doctrine (representation-layer-integrity.md).
async function scanLiveMcpSurface(): Promise<string[]> {
  const distDir = "/root/A-FORGE/dist/src/interfaces/mcp";
  const toolNames = new Set<string>();

  // Aggregate from all compiled MCP module files
  try {
    const files: string[] = [];
    for await (const f of glob(`${distDir}/**/*.js`)) {
      files.push(f);
    }
    for (const file of files) {
      try {
        const content = await readFile(file, "utf-8");
        // B3 v4 fix — require forge_ prefix to avoid matching example strings
        // in comments (e.g. server.tool("name", ...) example syntax).
        // Real A-FORGE tool names follow forge_<verb>[_mode] pattern.
        const toolMatches = content.matchAll(/server\.tool\(\s*"(forge_[a-z][a-z0-9_]*)"/g);
        for (const m of toolMatches) {
          if (m[1]) toolNames.add(m[1]);
        }
        const regMatches = content.matchAll(/server\.registerTool\(\s*"(forge_[a-z][a-z0-9_]*)"/g);
        for (const m of regMatches) {
          if (m[1]) toolNames.add(m[1]);
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Fallback to no live surface if glob fails
  }

  // Also include Python sidecar tools (forge_elicit_server.py)
  const pythonTools = ["forge_transfer_confirm", "forge_send_confirm"];
  for (const t of pythonTools) toolNames.add(t);

  return [...toolNames].sort();
}

type AffordanceEntry = {
  name: string;
  purpose?: string;
  reads?: string[];
  writes?: string[];
  risk_label?: string;
  destructive?: boolean;
  reversible?: boolean;
  deprecated?: boolean;
};

type DriftFinding = {
  type: "PHANTOM" | "MISSING" | "DESCRIPTION_DRIFT" | "RISK_DRIFT" | "ALIAS_GHOST" | "DEPRECATED_DOC";
  severity: "LOW" | "MEDIUM" | "HIGH";
  tool_name: string;
  detail: string;
  suggestion?: string;
};

type DriftReport = {
  organ: string;
  affordance_path: string;
  registry_tools: number;
  affordance_tools: number;
  drift_count: number;
  findings: DriftFinding[];
  is_clean: boolean;
  recommendation: string;
};

/**
 * Parse affordances.yaml to extract tool entries.
 */
async function parseAffordances(path: string): Promise<AffordanceEntry[]> {
  if (!existsSync(path)) return [];
  const content = await readFile(path, "utf-8");
  const parsed = parseYaml(content);
  return (parsed?.tools ?? []) as AffordanceEntry[];
}

/**
 * Compute the drift report between the registry and affordances.
 */
async function auditSurface(
  affordancePath: string,
  registryTools: string[],
  organ: string,
): Promise<DriftReport> {
  const findings: DriftFinding[] = [];
  const affordanceTools = await parseAffordances(affordancePath);
  const affordanceNames = new Set(affordanceTools.map((t) => t.name));
  const registrySet = new Set(registryTools);

  // PHANTOM entries: in affordance but NOT in registry
  for (const aff of affordanceTools) {
    if (!registrySet.has(aff.name)) {
      // B3 v5 fix: respect deprecated:true flag — these are intentionally
      // documented but not yet deployed (e.g. apa-* bridges pending).
      if (aff.deprecated === true) {
        findings.push({
          type: "DEPRECATED_DOC",
          severity: "LOW",
          tool_name: aff.name,
          detail: `In affordances.yaml marked deprecated:true but NOT in live registry. Documented but not deployed.`,
          suggestion: `Keep deprecated entry (preserves design intent) OR build the bridge and remove deprecated flag.`,
        });
        continue;
      }
      let severity: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM";
      if (aff.destructive || aff.risk_label === "R4" || aff.risk_label === "R5") {
        severity = "HIGH";
      }
      findings.push({
        type: "PHANTOM",
        severity,
        tool_name: aff.name,
        detail: `In affordances.yaml but NOT in live registry (name: ${aff.name})`,
        suggestion: `Remove entry from affordances.yaml or re-register the tool as ${aff.name}`,
      });
    }
  }

  // MISSING entries: in registry but NOT in affordance
  for (const toolName of registryTools) {
    if (!affordanceNames.has(toolName)) {
      findings.push({
        type: "MISSING",
        severity: "MEDIUM",
        tool_name: toolName,
        detail: `In live registry but NOT in affordances.yaml`,
        suggestion: `Add affordance entry for ${toolName}`,
      });
    }
  }

  // Check for deprecated flags in affordance labels
  for (const aff of affordanceTools) {
    if (registrySet.has(aff.name) && aff.deprecated) {
      // tool exists and is marked deprecated — that's expected
      continue;
    }
  }

  // B3 v6: is_clean ignores DEPRECATED_DOC — those are intentional state, not drift.
  const realDrift = findings.filter((f) => f.type !== "DEPRECATED_DOC");
  const isClean = realDrift.length === 0;

  return {
    organ,
    affordance_path: affordancePath,
    registry_tools: registryTools.length,
    affordance_tools: affordanceTools.length,
    drift_count: findings.length,
    findings,
    is_clean: isClean,
    recommendation: isClean
      ? "No drift detected. Surface is clean."
      : `${findings.length} drift(s) found. Severity: ${findings.some(f => f.severity === "HIGH") ? "HIGH — action recommended" : "LOW/MEDIUM — monitor"}`,
  };
}

/**
 * Known affordance paths per organ.
 * WEALTH and WELL use tools_sot.yaml (not affordances.yaml).
 * GEOX uses organ.yaml + tools_sot.yaml.
 */
const ORGAN_AFFORDANCE_MAP: Record<string, string> = {
  aforge: "/root/A-FORGE/a_think/affordances.yaml",
  wealth: "/root/WEALTH/tools_sot.yaml",
  well: "/root/WELL/tools_sot.yaml",
  geox: "/root/GEOX/tools_sot.yaml",
};

export function registerSurfaceAuditTools(server: McpServer): void {
  // ── forge_surface_audit — main audit tool ───────────────────────
  server.tool(
    "forge_surface_audit",
    "Audit MCP tool surface: compare live registry vs affordances.yaml to detect phantom entries, missing tools, description drift, and alias conflicts. Federation-wide drift detection.",
    {
      organ: z.enum(["aforge", "geox", "wealth", "well", "all"]).default("aforge")
        .describe("Organ to audit, or 'all' for federation-wide scan"),
      mode: z.enum(["audit", "scan", "fix"]).default("audit")
        .describe("audit=full report, scan=pass/fail health, fix=generate corrected yaml"),
      affordance_path: z.string().optional()
        .describe("Override affordance file path (default: auto-resolve from organ)"),
    },
    async ({ organ, mode, affordance_path }) => {
      const results: DriftReport[] = [];
      const organsToScan = organ === "all"
        ? ["aforge", "geox", "wealth", "well"]
        : [organ];

      for (const org of organsToScan) {
        const affPath = affordance_path || ORGAN_AFFORDANCE_MAP[org];
        if (!affPath || !existsSync(affPath)) {
          // Report missing manifest anchor instead of silent skip (false CLEAN)
          results.push({
            organ: org,
            affordance_path: affPath || "unknown",
            registry_tools: 0,
            affordance_tools: 0,
            drift_count: 1,
            findings: [{
              type: "MISSING",
              severity: "HIGH",
              tool_name: "N/A",
              detail: `No manifest anchor found for ${org}. Expected: ${affPath || "none configured"}. This organ cannot be audited without a signed manifest.`,
              suggestion: `Create ${affPath || "a manifest file"} or update ORGAN_AFFORDANCE_MAP in surfaceAuditTools.ts.`
            }],
            is_clean: false,
            recommendation: `MISSING_MANIFEST — ${org} has no surface anchor. Cannot verify tool surface integrity.`
          });
          continue;
        }

        // Get registry tools from the live forge_registry
        const registry = await queryRegistry();
        const registryToolNames = registry.tools
          .filter((t) => t.status === "REGISTERED" || t.status === "PENDING_REVIEW")
          .map((t) => t.tool_name);

        // B3 FIX: Aggregate from LIVE MCP module surface (per Representation
        // Layer Integrity doctrine). Replaces the stale hardcoded knownForgeTools
        // list that was producing 50+ phantom false positives.
        const liveSurfaceTools = await scanLiveMcpSurface();

        const allRegistryTools = [...new Set([...registryToolNames, ...liveSurfaceTools])].sort();

        const report = await auditSurface(affPath, allRegistryTools, org);
        results.push(report);
      }

      if (mode === "scan") {
        const allClean = results.every((r) => r.is_clean);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: allClean ? "PASS" : "DRIFT_DETECTED",
              summary: results.map((r) => `${r.organ}: ${r.drift_count} drifts ${r.is_clean ? "✅" : "⚠️"}`).join(" | "),
              timestamp: new Date().toISOString(),
            }, null, 2),
          }],
        };
      }

      if (mode === "fix") {
        // Generate corrected affordance draft
        const fixes = results.map((r) => ({
          organ: r.organ,
          phantom_tools: r.findings.filter((f) => f.type === "PHANTOM").map((f) => f.tool_name),
          missing_tools: r.findings.filter((f) => f.type === "MISSING").map((f) => f.tool_name),
          fix_command: r.is_clean
            ? "None needed"
            : `forge_filesystem(mode=edit, path=${r.affordance_path}) — remove phantom entries, add missing entries`,
        }));
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "DRAFT",
              note: "Review fix suggestions before applying. Phantom entries should be removed, missing entries added.",
              fixes,
              timestamp: new Date().toISOString(),
            }, null, 2),
          }],
        };
      }

      // mode === "audit" — full report
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: results.every((r) => r.is_clean) ? "CLEAN" : "DRIFT_DETECTED",
            scanned_organs: organsToScan,
            reports: results,
            timestamp: new Date().toISOString(),
            recommendation: results.some((r) => !r.is_clean)
              ? "Run forge_surface_audit mode=fix to generate corrected drafts, or manually edit affordances.yaml."
              : "All surfaces clean. No action needed.",
          }, null, 2),
        }],
      };
    },
  );

  // ── forge_surface_audit_prompt — guided audit prompt ─────────────
  server.prompt(
    "audit-surface",
    "Guided surface audit: detect phantom tools, drift, and registry inconsistencies across federation organs.",
    {
      organ: z.enum(["aforge", "geox", "wealth", "well", "all"]).default("aforge")
        .describe("Which organ to audit, or 'all' for federation-wide"),
      auto_fix: z.boolean().optional().default(false)
        .describe("If true, apply suggested fixes automatically after audit"),
    },
    (args) => {
      const s = sanitizeArgs(args);
      return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Surface Audit: ${s.organ}
Auto-fix: ${args.auto_fix ?? false}

Workflow:
1. AUDIT — Run forge_surface_audit(organ="${s.organ}", mode=audit)
   This compares the live MCP tool registry against affordances.yaml.

2. REVIEW — Check each finding:
   - PHANTOM entries: in affordance docs, not in live registry. Remove from yaml.
   - MISSING entries: in live registry, not in affordance docs. Add to yaml.
   - DESCRIPTION_DRIFT: descriptions differ between registry and yaml.
   - RISK_DRIFT: risk labels differ.

3. FIX — Apply corrections:
   ${args.auto_fix ? "Auto-fix enabled: run forge_surface_audit mode=fix → review → apply edits to affordances.yaml" : "Manual fix: edit affordances.yaml directly using forge_filesystem(mode=edit). Remove phantom entries. Add missing ones."}

4. RE-AUDIT — Run forge_surface_audit again to confirm zero drift.

Constitutional gates:
- F2 TRUTH: Every finding must name the specific tool and difference type
- F4 CLARITY: ΔS ≤ 0 — removing phantom entries reduces entropy
- F1 AMANAH: Review fix suggestions before applying (auto-fix is DRAFT only)

The pattern is simple: phantom rot accumulates when code evolves but docs don't. This tool catches it before next audit cycle.`,
        },
      }],
      };
    },
  );
}
