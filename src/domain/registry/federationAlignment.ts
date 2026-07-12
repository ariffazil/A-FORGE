/**
 * A-FORGE Federation Alignment Registry loader.
 *
 * Doctrine (locked 2026-07-08):
 *   Kernel Verbs = constitutional primitives (arifOS law)
 *   A-FORGE tools = execution actuators (hands)
 *   MCP "tools"   = transport envelope only
 *
 * Access: AAA agents have unrestricted logical access to the full actuator
 * surface. Execution is denied only by SESSION / LEASE / GATE / SEAL —
 * never by hiding tools from tools/list.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface ActuatorGates {
  requires_session: boolean;
  requires_lease: boolean;
  requires_gate: boolean;
  requires_seal: boolean;
  requires_human_approval: boolean;
  min_mode: string;
  risk_label: string;
}

export interface ActuatorEntry {
  name: string;
  status: string;
  affordance_class: string;
  capability_surface: string;
  kernel_verb: string;
  kernel_wire?: string;
  mutation_class: string;
  gates: ActuatorGates;
  purpose: string;
  description_canonical?: string;
  access_policy?: string;
  redirect_to?: string;
}

export interface FederationAlignmentRegistry {
  schema: string;
  generated_at: string;
  doctrine: Record<string, string>;
  tool_count: number;
  tools: ActuatorEntry[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Candidate paths for the generated registry (dev + deploy). */
function registryPaths(): string[] {
  return [
    resolve(__dirname, "../../../../a_think/federation_alignment_registry.json"),
    resolve(process.cwd(), "a_think/federation_alignment_registry.json"),
    "/root/A-FORGE/a_think/federation_alignment_registry.json",
  ];
}

let _cache: Map<string, ActuatorEntry> | null = null;
let _loadedFrom: string | null = null;

export function loadFederationAlignment(): Map<string, ActuatorEntry> {
  if (_cache) return _cache;
  const map = new Map<string, ActuatorEntry>();
  for (const p of registryPaths()) {
    try {
      if (!existsSync(p)) continue;
      const raw = readFileSync(p, "utf-8");
      const reg = JSON.parse(raw) as FederationAlignmentRegistry;
      for (const t of reg.tools ?? []) {
        if (t?.name) map.set(t.name, t);
      }
      _loadedFrom = p;
      process.stderr.write(
        `[FED-ALIGN] Loaded ${map.size} actuator cards from ${p}\n`,
      );
      break;
    } catch (e) {
      process.stderr.write(`[FED-ALIGN] skip ${p}: ${(e as Error).message}\n`);
    }
  }
  if (map.size === 0) {
    process.stderr.write("[FED-ALIGN] WARN: no registry loaded — descriptions unenriched\n");
  }
  _cache = map;
  return map;
}

export function getActuator(name: string): ActuatorEntry | undefined {
  return loadFederationAlignment().get(name);
}

/**
 * Rewrite MCP tool description as ACTUATOR contrast.
 * Zen v2026-07-12: stripped boilerplate. Format:
 *   ACTUATOR • <affordance> • <mutation>. <canonical|base> Use when: <purpose>.
 */
/** Strip old-format ACTUATOR boilerplate prefixes from description strings */
function stripActuatorPrefix(text: string): string {
  return text
    .replace(/^ACTUATOR\s*[·•]\s*\w+\s*[·•]\s*\w+(\s*[·•]\s*kernel-supervised by[^.]*\.\s*)?/i, "")
    .replace(/^ACTUATOR\s*\[[^\]]*\]\s*supervised by kernel\s*\w+[.\s]*/i, "")
    .replace(/^ACTUATOR\s*[·•]\s*\w+\s*[·•]\s*\w+\s*[·•]\s*/i, "")
    .replace(/^\.\s*/, "")  // clean leading period after strip
    .trim();
}

export function enrichActuatorDescription(
  name: string,
  originalDescription: string | undefined,
): string {
  const entry = getActuator(name);
  let base = stripActuatorPrefix(originalDescription ?? "");
  let trigger = "";
  if (entry?.purpose) {
    const clean = stripActuatorPrefix(entry.purpose).replace(/\.+$/, "").trim();
    // Only add trigger if purpose is different from base (many registry entries duplicate them)
    if (clean && !base.toLowerCase().startsWith(clean.toLowerCase().slice(0, 30))) {
      trigger = ` Use when: ${clean}.`;
    }
  }
  if (!entry) {
    return `${base}${trigger}`.trim();
  }
  if (entry.status === "DEPRECATED" && entry.redirect_to) {
    return (
      `ACTUATOR [DEPRECATED] → use ${entry.redirect_to}. ` +
      `${entry.affordance_class} · ${entry.capability_surface}. ${base}${trigger}`
    ).trim();
  }
  if (entry.description_canonical && !entry.description_canonical.includes("Not a plugin")) {
    const cleanCanon = stripActuatorPrefix(entry.description_canonical);
    if (cleanCanon) return `${cleanCanon}${trigger}`;
  }
  return (
    `ACTUATOR · ${entry.affordance_class} · ${entry.mutation_class}. ` +
    base + trigger
  ).trim();
}

export function federationAlignmentMeta(name: string): Record<string, unknown> | null {
  const e = getActuator(name);
  if (!e) return null;
  return {
    affordance_class: e.affordance_class,
    capability_surface: e.capability_surface,
    kernel_verb: e.kernel_verb,
    kernel_wire: e.kernel_wire,
    mutation_class: e.mutation_class,
    gates: e.gates,
    access_policy: e.access_policy ?? "AAA_UNRESTRICTED_LOGICAL",
  };
}
