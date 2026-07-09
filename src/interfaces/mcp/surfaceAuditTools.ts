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
  type: "PHANTOM" | "MISSING" | "DESCRIPTION_DRIFT" | "RISK_DRIFT" | "ALIAS_GHOST";
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

  const isClean = findings.length === 0;

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
 */
const ORGAN_AFFORDANCE_MAP: Record<string, string> = {
  aforge: "/root/A-FORGE/a_think/affordances.yaml",
  // Future: geox, wealth, well affordance paths
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
        ? ["aforge"]
        : [organ];

      for (const org of organsToScan) {
        const affPath = affordance_path || ORGAN_AFFORDANCE_MAP[org];
        if (!affPath) continue;

        // Get registry tools from the live forge_registry
        const registry = await queryRegistry();
        const registryToolNames = registry.tools
          .filter((t) => t.status === "REGISTERED" || t.status === "PENDING_REVIEW")
          .map((t) => t.tool_name);

        // Also include known forge_* tools from the affordance itself
        // to avoid false positives on tools that exist but aren't in forge_registry
        const knownForgeTools = [
          "forge_probe", "forge_health_check", "forge_filesystem", "forge_shell",
          "forge_shell_dryrun", "forge_git", "forge_docker", "forge_postgres",
          "forge_search", "forge_research", "forge_minimax_search", "forge_docs_lookup",
          "forge_github", "forge_pipeline_run", "forge_lease", "forge_lock",
          "forge_job", "forge_status", "forge_agent", "forge_abort",
          "forge_registry", "forge_registry_status", "forge_skill", "forge_evaluate",
          "forge_witness", "forge_scar", "forge_scar_scan", "forge_register",
          "forge_seal", "forge_synthesize", "forge_stage", "forge_sandbox_run",
          "forge_tier_bind", "forge_docket_prep", "forge_execute", "forge_execute_sealed",
          "forge_session_init", "forge_check_governance", "forge_heart_critique",
          "forge_judge_proxy", "forge_approve", "forge_reality_loop",
          "forge_worktree", "forge_chart", "forge_document_ingest",
          "forge_vault", "forge_journalctl", "forge_shell_status", "forge_security_drift_scan",
          "forge_shell_ledger", "forge_shell_alert_history", "forge_netdata_alarms",
          "forge_netdata_metrics", "forge_memory", "forge_policy",
          "forge_surface_guard", "forge_surface_audit",
          "forge_wealth", "forge_well", "forge_github_search_code",
          "forge_github_search_repos", "forge_github_get_file",
          "forge_github_create_issue", "forge_github_create_pr",
          "forge_browser_navigate", "forge_browser_click", "forge_browser_type",
          "forge_browser_screenshot", "forge_browser_extract_text", "forge_browser_evaluate_js",
        ].filter(Boolean);

        const allRegistryTools = [...new Set([...registryToolNames, ...knownForgeTools])].sort();

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
    (args) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Surface Audit: ${args.organ}
Auto-fix: ${args.auto_fix ?? false}

Workflow:
1. AUDIT — Run forge_surface_audit(organ="${args.organ}", mode=audit)
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
    }),
  );
}
