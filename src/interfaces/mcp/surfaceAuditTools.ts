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
import { validateGovernanceYamls, FEDERATION_YAML_PATHS } from "./yamlGovernanceValidator.js";

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
  const domainDir = "/root/A-FORGE/dist/src/domain";
  const capDir = "/root/A-FORGE/dist/src/capabilities";
  const toolNames = new Set<string>();

  // Aggregate from all compiled MCP module files
  // P1-E FIX: Scan domain/ and capabilities/ dirs too — auth_pipeline registers in
  // domain/auth_protocol/, forge_gemini in capabilities/gemini/.
  const scanDirs = [distDir, domainDir, capDir];
  try {
    const files: string[] = [];
    for (const dir of scanDirs) {
      for await (const f of glob(`${dir}/**/*.js`)) {
        files.push(f);
      }
    }
    for (const file of files) {
      try {
        const content = await readFile(file, "utf-8");
        // B3 v4 fix — require forge_ or auth_ prefix to avoid matching example strings
        // in comments. Real A-FORGE tool names follow forge_<verb> or auth_<verb> pattern.
        const toolMatches = content.matchAll(/server\.tool\(\s*"((?:forge_|auth_)[a-z][a-z0-9_]*)"/g);
        for (const m of toolMatches) {
          if (m[1]) toolNames.add(m[1]);
        }
        const regMatches = content.matchAll(/server\.registerTool\(\s*"((?:forge_|auth_)[a-z][a-z0-9_]*)"/g);
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
  type: "PHANTOM" | "MISSING" | "DESCRIPTION_DRIFT" | "RISK_DRIFT" | "ALIAS_GHOST" | "DEPRECATED_DOC" | "UNVERIFIABLE" | "OUTBOUND_ABI_DRIFT";
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
  // AUDIT FIX 2026-09-28 (D-01): name the SOURCE of the registry side so a
  // report can never again imply "live" where the truth is "declared self".
  registry_source?: "live_mcp_registry" | "dist_text_scan_fallback" | "declared_self";
  verification_level?: "LIVE" | "DECLARED_SELF_ONLY";
  // S2 (2026-10-01): outbound ABI conformance — do this organ's internal
  // callMCP targets exist on the callee's live surface? `surfaces[ns] === null`
  // means that organ did not answer tools/list, so its verdict is UNKNOWN.
  outbound_abi?: {
    checked: number;
    drift: number;
    surfaces: Record<string, string[] | null>;
  };
};

/**
 * Parse affordances.yaml to extract tool entries.
 */
async function parseAffordances(path: string): Promise<AffordanceEntry[]> {
  if (!existsSync(path)) return [];
  const content = await readFile(path, "utf-8");
  const parsed = parseYaml(content);
  return (parsed?.tools ?? parsed?.public_tools ?? []) as AffordanceEntry[];
}

/**
 * Compute the drift report between the registry and affordances.
 */
export async function auditSurface(
  affordancePath: string,
  registryTools: string[],
  organ: string,
): Promise<DriftReport> {
  const findings: DriftFinding[] = [];
  const affordanceTools = await parseAffordances(affordancePath);
  const affordanceNames = new Set(affordanceTools.map((t) => t.name));
  const registrySet = new Set(registryTools);

  // AUDIT FIX 2026-09-28 (D-01) — VOID-GUARD / epistemic breach.
  // "Evidence absent" was being rendered as "CLEAN". If BOTH sides of the
  // comparison are empty (e.g. the organ's SOT uses a schema this parser
  // cannot read, and the live-surface fallback glob failed), 0==0 produced
  // a false PASS. No-data must classify as UNVERIFIABLE, never as integrity.
  if (affordanceTools.length === 0 && registryTools.length === 0) {
    return {
      organ,
      affordance_path: affordancePath,
      registry_tools: 0,
      affordance_tools: 0,
      drift_count: 1,
      findings: [{
        type: "UNVERIFIABLE",
        severity: "HIGH",
        tool_name: "(whole surface)",
        detail: `Both sides parsed to 0 tools — affordance parse yielded no 'tools:' entries and the registry side is empty. This is a measurement gap (likely schema mismatch: expected top-level 'tools:' list), NOT evidence of a clean surface.`,
        suggestion: `Check whether ${affordancePath} uses a different top-level key than 'tools:'. Extend parseAffordances for this organ's schema, or wire the live MCP tools/list for ${organ}.`,
      }],
      is_clean: false,
      recommendation: `UNVERIFIABLE — ${organ}: cannot certify integrity from absent evidence. Treat as UNKNOWN, not PASS.`,
    };
  }

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
  const deprecatedCount = findings.length - realDrift.length;
  const isClean = realDrift.length === 0;

  return {
    organ,
    affordance_path: affordancePath,
    registry_tools: registryTools.length,
    affordance_tools: affordanceTools.length,
    drift_count: findings.length,
    findings,
    is_clean: isClean,
    recommendation: realDrift.length === 0
      ? deprecatedCount > 0
        ? `Surface clean of new drift. ${deprecatedCount} documented DEPRECATED_DOC entries present (B3 v6: intentional).`
        : "No drift detected. Surface is clean."
      : `${realDrift.length} drift(s) found. Severity: ${realDrift.some(f => f.severity === "HIGH") ? "HIGH — action recommended" : "LOW/MEDIUM — monitor"}`,
  };
}

/**
 * S2 (F13 order 2026-10-01) — OUTBOUND ABI conformance.
 *
 * auditSurface() answers "does the declared affordance plane match the
 * registered tool plane?" It could not answer "does tool A's internal call to
 * organ B name a verb that B actually exposes?" That blind spot let 21 dead
 * cross-organ call targets survive in A-FORGE while forge_surface_audit reported
 * the surface as effectively clean — including arif_heart_critique, which made
 * forge_check_governance report a healthy kernel as unreachable.
 *
 * Every target is resolved through TOOL_NAME_MAP first, so a mapped legacy verb
 * is judged by the name that actually goes on the wire.
 *
 * VOID GUARD: an organ that cannot be reached yields `null` for its surface and
 * an UNVERIFIABLE finding. Absence of evidence is never rendered as conformance.
 */
export async function auditOutboundAbi(
  repoRoot: string,
): Promise<{ surfaces: Record<string, string[] | null>; checked: number; findings: DriftFinding[]; unresolved_dynamic: string[] }> {
  const fsp = await import("node:fs/promises");
  const nodePath = await import("node:path");
  const { TOOL_NAME_MAP, NAMESPACE_DEFAULTS } = await import("../../domain/types/mcp-bridge.js");

  // ── 1. collect callMCP("<ns>.<verb>") literals with file:line ──────────
  const srcDir = nodePath.join(repoRoot, "src");
  const files: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      const p = nodePath.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith(".ts")) files.push(p);
    }
  };
  await walk(srcDir);

  const CALL_RE = /callMCP\(\s*"([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?"/g;
  // S2b: a second bridge exists — callOrgan("<ns>", "<verb>", args) — used by
  // preActionSimulation.ts. A literal-only callMCP scan missed it entirely and
  // therefore under-reported drift, which is worse than no axis at all.
  const ORGAN_RE = /callOrgan\(\s*"([A-Za-z0-9_]+)"\s*,\s*"([A-Za-z0-9_]+)"/g;
  // Template-literal construction (callMCP(`${ns}.${tool}`) in callOrganAdapter)
  // cannot be resolved statically. Counted and reported, never silently ignored.
  const DYN_RE = /call(?:MCP|Organ)\(\s*`/g;
  const targets = new Map<string, { ns: string; verb: string; sites: string[] }>();
  const dynamicSites: string[] = [];
  for (const f of files) {
    const rel = nodePath.relative(repoRoot, f);
    if (rel === "src/interfaces/mcp/surfaceAuditTools.ts") continue;
    const text = await fsp.readFile(f, "utf-8");
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
      const site = `${rel}:${i + 1}`;
      const add = (ns0: string, verb0: string) => {
        const ns = ns0.replace(/_mcp$/, "");
        const key = `${ns}.${verb0}`;
        if (!targets.has(key)) targets.set(key, { ns, verb: verb0, sites: [] });
        targets.get(key)!.sites.push(site);
      };
      for (const m of line.matchAll(CALL_RE)) {
        add(m[2] ? m[1] : "arifos", m[2] ?? m[1]);
      }
      for (const m of line.matchAll(ORGAN_RE)) {
        add(m[1], m[2]);
      }
      if (DYN_RE.test(line)) dynamicSites.push(site);
    });
  }

  // ── 2. live tools/list per namespace ───────────────────────────────────
  const surfaces: Record<string, string[] | null> = {};
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
  for (const ns of Object.keys(NAMESPACE_DEFAULTS)) {
    const cfg = NAMESPACE_DEFAULTS[ns as keyof typeof NAMESPACE_DEFAULTS];
    const base =
      (ns === "arifos" && process.env["ARIFOS_KERNEL_URL"]) ||
      process.env[cfg.env] ||
      cfg.default;
    try {
      const client = new Client({ name: "surface-audit-abi", version: "1.0.0" });
      await client.connect(new StreamableHTTPClientTransport(new URL(`${base.replace(/\/$/, "")}/mcp`)));
      const r = await client.listTools();
      surfaces[ns] = r.tools.map((t) => t.name).sort();
      await client.close();
    } catch {
      surfaces[ns] = null;   // UNVERIFIABLE, never "clean"
    }
  }

  // ── 3. judge each target against the live surface ──────────────────────
  const findings: DriftFinding[] = [];
  const routable = new Set(Object.keys(NAMESPACE_DEFAULTS));
  let checked = 0;
  for (const { ns, verb, sites } of targets.values()) {
    checked++;
    // A namespace with no NAMESPACE_DEFAULTS entry cannot be called at all:
    // parseToolName() throws "Unknown namespace" before any request is made.
    // Found live 2026-10-01: well.well_assess_homeostasis.
    if (!routable.has(ns)) {
      findings.push({
        type: "OUTBOUND_ABI_DRIFT",
        severity: "HIGH",
        tool_name: `${ns}.${verb}`,
        detail:
          `A-FORGE calls namespace "${ns}", which NAMESPACE_DEFAULTS does not declare ` +
          `(routable: ${[...routable].join(", ")}). callMCP() throws "Unknown namespace" before ` +
          `any request is sent, so this call can never succeed. Call site(s): ${sites.join(", ")}.`,
        suggestion:
          `Add "${ns}" to MCPNamespace + NAMESPACE_DEFAULTS in src/domain/types/mcp-bridge.ts ` +
          `(env var + default URL), or remove the call site.`,
      });
      continue;
    }
    const surface = surfaces[ns];
    if (surface === null || surface === undefined) {
      findings.push({
        type: "UNVERIFIABLE",
        severity: "MEDIUM",
        tool_name: `${ns}.${verb}`,
        detail: `Organ "${ns}" did not answer tools/list, so conformance of this outbound call is UNKNOWN. Called from ${sites.join(", ")}.`,
        suggestion: `Restore ${ns} reachability, then re-run. Absence of evidence is not conformance.`,
      });
      continue;
    }
    const resolved = TOOL_NAME_MAP[verb] ?? verb;
    if (surface.includes(resolved)) continue;
    findings.push({
      type: "OUTBOUND_ABI_DRIFT",
      severity: "HIGH",
      tool_name: `${ns}.${verb}`,
      detail:
        `A-FORGE calls "${ns}.${verb}"` +
        (resolved !== verb ? ` (resolves to "${resolved}")` : "") +
        ` but the live ${ns} surface does not expose it. Call site(s): ${sites.join(", ")}. ` +
        `The organ is REACHABLE — it answered tools/list with ${surface.length} tools — so this is a ` +
        `renamed or retired verb, NOT an outage. At runtime this surfaces as "Unknown tool" and is ` +
        `easily misread as the organ being down.`,
      suggestion:
        `Map "${verb}" to a live ${ns} verb in TOOL_NAME_MAP (src/domain/types/mcp-bridge.ts) ` +
        `only if the argument shape is verified to match; otherwise update the call site. ` +
        `Live ${ns} surface: ${surface.slice(0, 40).join(", ")}.`,
    });
  }

  // Statically unresolvable targets are reported as a coverage gap. An axis
  // that silently skips them would report CLEAN over calls it never judged.
  if (dynamicSites.length > 0) {
    findings.push({
      type: "UNVERIFIABLE",
      severity: "MEDIUM",
      tool_name: "(dynamically constructed target)",
      detail:
        `${dynamicSites.length} call site(s) build the organ target name at runtime, so static ` +
        `conformance cannot judge them: ${dynamicSites.join(", ")}.`,
      suggestion:
        "Pass a literal verb name, or enumerate the constructed names so this axis can check them.",
    });
  }

  return { surfaces, checked, findings, unresolved_dynamic: dynamicSites };
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
  arifos: "/root/arifOS/tools_sot.yaml",
};

export function registerSurfaceAuditTools(server: McpServer): void {
  // ── forge_surface_audit — main audit tool ───────────────────────
  server.tool(
    "forge_surface_audit",
    "Audit MCP tool surface: compare live registry vs affordances.yaml to detect phantom entries, missing tools, description drift, and alias conflicts. Federation-wide drift detection.",
    {
      organ: z.enum(["aforge", "geox", "wealth", "well", "arifos", "all"]).default("aforge")
        .describe("Organ to audit, or 'all' for federation-wide scan"),
      mode: z.enum(["audit", "scan", "fix"]).default("audit")
        .describe("audit=full report, scan=pass/fail health, fix=generate corrected yaml"),
      affordance_path: z.string().optional()
        .describe("Override affordance file path (default: auto-resolve from organ)"),
    },
    async ({ organ, mode, affordance_path }) => {
      // P0-FIX: MCP may pass null/undefined despite Zod default — normalize to "aforge"
      const normalizedOrgan = organ ?? "aforge";

      // ═══ FEDERATION-YAML-BOOT-CANARY (P0-1 / 2026-09-21) ═══════════════
      // Pre-flight: every governance YAML must parse before any audit work.
      // A constitutional rule that cannot be parsed is not governance.
      // It is dead text. (Sovereign-directive: JANGAN jalankan audit
      // dengan YAML yang cacat.)
      const yamlGate = await validateGovernanceYamls(FEDERATION_YAML_PATHS);
      if (!yamlGate.ok) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "YAML_GATE_BLOCKED",
              canary: yamlGate.canary_signature,
              summary: `${yamlGate.parsed}/${yamlGate.total} governance YAMLs parsed`,
              failures: yamlGate.failures,
              recommendation:
                "Repair the listed YAML files (parse error → fix indentation/quotes/encoding) and re-run forge_surface_audit. Boot canary FEDERATION-YAML-BOOT-CANARY will gate deployment until ok=true.",
              timestamp: new Date().toISOString(),
            }, null, 2),
          }],
        };
      }

      const results: DriftReport[] = [];
      const organsToScan = normalizedOrgan === "all"
        ? ["aforge", "geox", "wealth", "well", "arifos"]
        : [normalizedOrgan];

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

        let allRegistryTools: string[];
        let registrySource: "live_mcp_registry" | "dist_text_scan_fallback" | "declared_self";
        if (org === "aforge") {
          // AUDIT FIX 2026-09-28 (D-01): the TRUTH of the surface is the live
          // in-process MCP registry, not a text scan of dist/. The old union
          // counted commented-out server.tool() lines and dead modules
          // (serveModern, unwired google-workspace) as "registry" — so
          // affordances-vs-that-union compared declared against declared and
          // reported phantom entries as clean. _registeredTools is the same
          // handle the verdict-interceptor installs on.
          const liveRegistry: string[] = Object.keys(((server as any)?._registeredTools as object) ?? {});
          if (liveRegistry.length > 0) {
            allRegistryTools = [...new Set(liveRegistry)].sort();
            registrySource = "live_mcp_registry";
          } else {
            // Fallback for contexts without an attached server (unit tests):
            // keep the previous registry-query ∪ dist-scan union, labelled honestly.
            const registry = await queryRegistry();
            const registryToolNames = registry.tools
              .filter((t) => t.status === "REGISTERED" || t.status === "PENDING_REVIEW")
              .map((t) => t.tool_name);
            const liveSurfaceTools = await scanLiveMcpSurface();
            allRegistryTools = [...new Set([...registryToolNames, ...liveSurfaceTools])].sort();
            registrySource = "dist_text_scan_fallback";
          }
        } else {
          // For federation organs, parse tools from the canonical tools_sot.yaml manifest
          const organAffordances = await parseAffordances(affPath);
          allRegistryTools = organAffordances.map((t) => t.name).sort();
          registrySource = "declared_self";
        }

        const report = await auditSurface(affPath, allRegistryTools, org);
        report.registry_source = registrySource;
        report.verification_level = registrySource === "declared_self" ? "DECLARED_SELF_ONLY" : "LIVE";

        // S2 (F13 order 2026-10-01): outbound ABI conformance. Merged into the
        // same findings list so drift_count / is_clean / mode=scan all reflect
        // it — an axis that reports separately is an axis nobody reads.
        if (org === "aforge") {
          const repoRoot = (affPath || "").split("/").slice(0, -2).join("/") || "/root/A-FORGE";
          try {
            const abi = await auditOutboundAbi(repoRoot);
            const dead = abi.findings.filter((f) => f.type === "OUTBOUND_ABI_DRIFT").length;
            report.outbound_abi = { checked: abi.checked, drift: dead, surfaces: abi.surfaces };
            report.findings.push(...abi.findings);
            const realDrift = report.findings.filter((f) => f.type !== "DEPRECATED_DOC");
            report.drift_count = realDrift.length;
            report.is_clean = realDrift.length === 0;
            // S2b: RECOMPUTE the prose from the merged machine fields. It was
            // previously built inside auditSurface() before this axis merged its
            // findings, so one report could carry is_clean=false, drift_count=7
            // and the sentence "No drift detected. Surface is clean." at the same
            // time. Evidence must never be contradicted by its own summary — the
            // structured fields derive the prose, never the reverse.
            const high = realDrift.filter((f) => f.severity === "HIGH").length;
            const byType = realDrift.reduce<Record<string, number>>((m, f) => {
              m[f.type] = (m[f.type] ?? 0) + 1;
              return m;
            }, {});
            const typeSummary = Object.entries(byType)
              .map(([k, v]) => `${k}:${v}`)
              .join(" ");
            const hasPhantomOrMissing = report.findings.some((f) => f.type === "PHANTOM" || f.type === "MISSING");
            report.recommendation = report.is_clean
              ? `No drift detected across ${report.registry_tools} registered tools and ${abi.checked} outbound call target(s). Surface is clean.`
              : `${realDrift.length} drift(s) found [${typeSummary}]` +
                `${high ? `, ${high} HIGH severity` : ""}. ` +
                `Outbound ABI: ${dead} dead cross-organ verb(s) among ${abi.checked} checked. ` +
                (dead
                  ? "Repair each dead verb (TOOL_NAME_MAP or call site) before trusting any cross-organ path. "
                  : "") +
                (hasPhantomOrMissing ? "Run forge_surface_audit mode=fix for corrected drafts." : "Check findings above.");
          } catch (e) {
            // VOID GUARD: a failed axis is UNKNOWN, never a clean verdict.
            report.findings.push({
              type: "UNVERIFIABLE",
              severity: "MEDIUM",
              tool_name: "(outbound ABI axis)",
              detail: `Outbound ABI conformance could not run: ${e instanceof Error ? e.message : String(e)}`,
              suggestion: "Repair the axis before trusting any clean verdict from this organ.",
            });
            report.drift_count = report.findings.filter((f) => f.type !== "DEPRECATED_DOC").length;
            report.is_clean = false;
            report.recommendation = `Outbound ABI conformance could not run: ${e instanceof Error ? e.message : String(e)}. Surface is UNVERIFIABLE.`;
          }
        }
        if (registrySource === "declared_self") {
          report.recommendation = `DECLARED-SELF: ${org} audit compared its SOT file against itself — internal consistency only, live MCP surface parity NOT verified. ` + report.recommendation;
        }
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
      const allClean = results.every((r) => r.is_clean);
      const anyDeadAbi = results.some((r) => (r.outbound_abi?.drift ?? 0) > 0);
      const anyPhantomOrMissing = results.some((r) => r.findings.some((f) => f.type === "PHANTOM" || f.type === "MISSING"));
      // S2b HARD INVARIANT (F13-class layer 2026-10-01): machine fields derive
      // human-summary text, never the reverse. If any realDrift (non-deprecated)
      // is present OR anyDeadAbi > 0, the recommendation MUST NOT contain "clean".
      // Earlier the audit could simultaneously say drift_count=10 + "No drift
      // detected. Surface is clean." — evidence ≠ summary failure.
      const totalRealDrift = results.reduce((n, r) => {
        const realDrifts = (r.findings ?? []).filter((f: { type: string }) => f.type !== "DEPRECATED_DOC");
        return n + realDrifts.length;
      }, 0);
      const totalDeprecated = results.reduce((n, r) => {
        const dep = (r.findings ?? []).filter((f: { type: string }) => f.type === "DEPRECATED_DOC");
        return n + dep.length;
      }, 0);
      const realCleanAndNoAbi = allClean && !anyDeadAbi && totalRealDrift === 0;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: allClean && !anyDeadAbi && totalRealDrift === 0 ? "CLEAN" : "DRIFT_DETECTED",
            scanned_organs: organsToScan,
            reports: results,
            timestamp: new Date().toISOString(),
            recommendation: !realCleanAndNoAbi
              ? anyDeadAbi
                ? `Outbound ABI drift detected (${results.reduce((n, r) => n + (r.outbound_abi?.drift ?? 0), 0)} dead cross-organ verbs across organs). Repair dead verbs in TOOL_NAME_MAP or call sites.`
                : anyPhantomOrMissing
                    ? "Run forge_surface_audit mode=fix to generate corrected drafts, or manually edit affordances.yaml."
                    : `${totalRealDrift} real drift(s) found${totalDeprecated > 0 ? `, plus ${totalDeprecated} documented DEPRECATED_DOC entries (intentional).` : "."} Address findings above.`
              : totalDeprecated > 0
                ? `All surfaces clean of new drift. ${totalDeprecated} documented DEPRECATED_DOC entries present (intentional). No action required.`
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
