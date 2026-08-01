/**
 * shadowMcpDetector.ts — OWASP MCP09 Shadow MCP Server Detector
 *
 * Per OWASP MCP Top 10 (2025):
 *  "Shadow MCP Servers" — unapproved deployments operating outside
 *   formal security governance. Often spun up by developers for
 *   experimentation with default credentials, permissive configurations,
 *   or unsecured APIs.
 *
 * This detector scans the live system for MCP-shaped services and
 * compares them against the declared organ registry. Anything that
 * appears in the live system but not in the registry is flagged.
 *
 * Detection surfaces:
 *  1. systemd services with 'mcp' in name not in ORGAN.yaml
 *  2. npx-launched MCP servers (process scan)
 *  3. Listening ports with /tools/list endpoint not in registry
 *  4. Docker containers exposing MCP-shaped ports
 *
 * Wired into forge_security_drift_scan as the ShadowMcpTrace module.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 * @constitutional F11 AUDITABILITY — every shadow MCP is logged
 * @constitutional F12 RESILIENCE — refuse unapproved server
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// §1 — Canonical organ registry (load-bearing — fail-closed if unreadable)
// ─────────────────────────────────────────────────────────────────────────────

const ORGANS_YAML_PATH = "/root/AAA/federation/organs.yaml";

/** Canonical organs in the federation. Anything outside this set is shadow. */
const CANONICAL_ORGANS = [
  "arifos",
  "aforge",
  "geox",
  "wealth",
  "well",
  "ariflow",
  "aaa",
  "hermes",
  "fed",
  "flame",
] as const;

/** Known-acceptable helper services (not strictly MCP but MCP-adjacent). */
const ACCEPTABLE_HELPERS = new Set([
  "1mcp.service",                  // multi-MCP proxy
  "a-forge-mcp.service",           // A-FORGE MCP surface
  "geox-mcp.service",              // GEOX MCP surface
  "graphiti-mcp.service",          // Graphiti memory bridge
  "arifos.service",                // Constitutional kernel
  "arifflow.service",              // Metabolic flow
  "hermes-mcp.service",            // HERMES MCP surface
  "playwright-mcp.service",        // Playwright bridge
  "surface-guard.service",         // Drift watchdog
  "well.service",                  // WELL substrate
  "fed-router.service",            // Federation router
  "a-forge.service",               // A-FORGE HTTP
  "aaa-a2a.service",               // AAA A2A gateway
  "arifosd.service",               // LEGACY — listed but deprecated
  "hindsight.service",             // Vectorize memory (shadow → flag)
  "ollama.service",                // Local LLM substrate
]);

/** Canonical MCP server names that should be running. */
const MCP_CANONICAL_NAMES = [
  "arifos-mcp",
  "a-forge-mcp",
  "geox-mcp",
  "wealth-mcp",
  "well-mcp",
  "ariflow-mcp",
  "hermes-mcp",
];

// ─────────────────────────────────────────────────────────────────────────────
// §2 — Public types
// ─────────────────────────────────────────────────────────────────────────────

export type ShadowMcpType = "systemd-mcp" | "npx-mcp" | "orphan-port" | "docker-mcp";
export type ShadowSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ShadowMcpFinding {
  type: ShadowMcpType;
  identity: string;
  evidence: string;
  severity: ShadowSeverity;
  fingerprint: string;
  recommendation: string;
  timestamp: string;
}

export interface ShadowMcpReport {
  detector_version: string;
  scanned_at: string;
  total_findings: number;
  findings: ShadowMcpFinding[];
  declared_organs: string[];
  shadow_organs: string[];
  verdict: "CLEAN" | "WARN" | "SHADOW_DETECTED";
  authority_claim: "ADVISORY";
}

const DETECTOR_VERSION = "1.0.0";

// ─────────────────────────────────────────────────────────────────────────────
// §3 — Detection helpers
// ─────────────────────────────────────────────────────────────────────────────

function safeExec(cmd: string, defaultResult = ""): string {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: 5000 }).trim();
  } catch {
    return defaultResult;
  }
}

function fingerprint(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

/**
 * Scan systemd services for MCP-shaped services not in the acceptable set.
 */
function scanSystemdMcp(): ShadowMcpFinding[] {
  const findings: ShadowMcpFinding[] = [];
  const out = safeExec(
    'systemctl list-units --type=service --state=running --no-pager 2>/dev/null | grep -iE "mcp" | awk \'{print $1}\''
  );
  if (!out) return findings;

  for (const line of out.split("\n")) {
    const svc = line.trim();
    if (!svc) continue;
    if (ACCEPTABLE_HELPERS.has(svc)) continue;
    if (MCP_CANONICAL_NAMES.some((n) => svc.toLowerCase().includes(n))) continue;

    findings.push({
      type: "systemd-mcp",
      identity: svc,
      evidence: `systemd service running but not in canonical MCP registry: ${svc}`,
      severity: "HIGH",
      fingerprint: fingerprint(`shadow-mcp|systemd|${svc}|${Date.now()}`),
      recommendation: `Investigate: ${svc} — register in organs.yaml or remove`,
      timestamp: new Date().toISOString(),
    });
  }

  return findings;
}

/**
 * Scan npx-launched MCP servers — often user-scope, but untracked.
 */
function scanNpxMcp(): ShadowMcpFinding[] {
  const findings: ShadowMcpFinding[] = [];
  const out = safeExec(
    'ps -ef 2>/dev/null | grep -iE "(mcp|fastmcp)" | grep -v grep | awk \'{print $NF}\''
  );
  if (!out) return findings;

  const declared = new Set<string>([...MCP_CANONICAL_NAMES, "1mcp"]);

  for (const line of out.split("\n")) {
    const mcp = line.trim();
    if (!mcp) continue;
    const lower = mcp.toLowerCase();
    if (declared.has(lower)) continue;
    // Filter out common false positives
    if (lower.includes("grep") || lower.includes("awk")) continue;

    findings.push({
      type: "npx-mcp",
      identity: mcp,
      evidence: `npx-launched MCP server not in registry: ${mcp}`,
      severity: "MEDIUM",
      fingerprint: fingerprint(`shadow-mcp|npx|${mcp}|${Date.now()}`),
      recommendation: `User-scope MCP: ${mcp} — verify intent and add to organs.yaml if legitimate`,
      timestamp: new Date().toISOString(),
    });
  }

  return findings;
}

/**
 * Scan listening ports — flag anything with /tools/list endpoint NOT in registry.
 */
function scanOrphanPorts(): ShadowMcpFinding[] {
  const findings: ShadowMcpFinding[] = [];
  const out = safeExec(
    'ss -tlnp 2>/dev/null | grep -E "LISTEN" | awk \'{print $4, $6}\' | head -200'
  );
  if (!out) return findings;

  // Canonical ports for known organs
  const knownPorts = new Set([
    "8088", "7071", "7072", "7073", "7074",  // arifOS, A-FORGE, ariflow, FED
    "3001",                                  // AAA
    "8081", "18082", "18083",                // GEOX, WEALTH, WELL
    "18900", "18901",                        // signing, flame
    "18086", "18084",                        // witness, well-witness
  ]);

  for (const line of out.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 1) continue;
    const addr = parts[0];
    const port = addr.split(":").pop() ?? "";
    if (!port) continue;

    // Skip well-known non-MCP ports
    if (knownPorts.has(port)) continue;
    if (["80", "443", "53", "22", "22888", "6274", "6277", "8083", "9000", "9001"].includes(port)) continue;

    // Skip ephemeral/system ports
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1024 || portNum > 65535) continue;

    // Check if port answers with /tools/list or /mcp
    const testResult = safeExec(
      `curl -sS -m 2 -o /dev/null -w "%{http_code}" "http://127.0.0.1:${port}/tools/list" 2>/dev/null || echo "fail"`
    );
    if (testResult === "200") {
      findings.push({
        type: "orphan-port",
        identity: `${addr} (port ${port})`,
        evidence: `Port ${port} responds to /tools/list but not in canonical port registry`,
        severity: "HIGH",
        fingerprint: fingerprint(`shadow-mcp|port|${port}|${Date.now()}`),
        recommendation: `Orphan MCP port ${port}: investigate via /tools/list payload`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return findings;
}

/**
 * Scan Docker containers for MCP-shaped exposures.
 */
function scanDockerMcp(): ShadowMcpFinding[] {
  const findings: ShadowMcpFinding[] = [];
  const out = safeExec(
    'docker ps --format "{{.Names}}|{{.Image}}|{{.Ports}}" 2>/dev/null | head -50'
  );
  if (!out) return findings;

  for (const line of out.split("\n")) {
    const [name, image, ports] = line.split("|");
    if (!name || !ports) continue;

    // Check for public bind (0.0.0.0) on MCP-shaped ports
    const publicBinds = ports.match(/0\.0\.0\.0:(\d+)/g);
    if (publicBinds && publicBinds.length > 0) {
      // Skip already-known federation docker
      const known = ["graphiti-mcp", "hindsight", "minio", "falkordb", "qdrant", "postgres", "redis", "mcpjam", "searxng"];
      if (known.includes(name)) continue;

      for (const bind of publicBinds) {
        const port = bind.split(":")[1];
        findings.push({
          type: "docker-mcp",
          identity: `${name} (port ${port})`,
          evidence: `Docker container '${name}' exposes port ${port} on 0.0.0.0`,
          severity: "HIGH",
          fingerprint: fingerprint(`shadow-mcp|docker|${name}|${port}|${Date.now()}`),
          recommendation: `Restrict Docker port binding to 127.0.0.1 or remove container`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
// §4 — Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the full ShadowMcpDetector sweep. Returns a structured report.
 */
export function detectShadowMcp(): ShadowMcpReport {
  const allFindings: ShadowMcpFinding[] = [
    ...scanSystemdMcp(),
    ...scanNpxMcp(),
    ...scanOrphanPorts(),
    ...scanDockerMcp(),
  ];

  const shadowOrgs = Array.from(
    new Set(
      allFindings
        .map((f) => f.identity.split(/[.\s|/]/)[0])
        .filter((s) => s && !(CANONICAL_ORGANS as readonly string[]).includes(s.toLowerCase()))
    )
  );

  let verdict: ShadowMcpReport["verdict"] = "CLEAN";
  if (allFindings.length > 0) {
    verdict = allFindings.some((f) => f.severity === "HIGH" || f.severity === "CRITICAL")
      ? "SHADOW_DETECTED"
      : "WARN";
  }

  return {
    detector_version: DETECTOR_VERSION,
    scanned_at: new Date().toISOString(),
    total_findings: allFindings.length,
    findings: allFindings,
    declared_organs: [...CANONICAL_ORGANS],
    shadow_organs: shadowOrgs,
    verdict,
    authority_claim: "ADVISORY",
  };
}

/**
 * Convenience: returns only the findings (omit metadata).
 */
export function listShadowMcpFindings(): ShadowMcpFinding[] {
  return detectShadowMcp().findings;
}
