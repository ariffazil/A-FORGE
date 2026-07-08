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
 * Rewrite MCP tool description as ACTUATOR contrast (not plugin, not kernel verb).
 * Keeps original detail after the constitutional header.
 */
export function enrichActuatorDescription(
  name: string,
  originalDescription: string | undefined,
): string {
  const entry = getActuator(name);
  const base = (originalDescription ?? "").trim();
  if (!entry) {
    // Still mark unknown tools as actuators so they never read as plugins.
    return `ACTUATOR · A-FORGE hands · supervised by kernel 777_FORGE (arif_forge). Not a plugin. Not a kernel verb. ${base}`.trim();
  }
  if (entry.status === "DEPRECATED" && entry.redirect_to) {
    return (
      `ACTUATOR [DEPRECATED] → use ${entry.redirect_to}. ` +
      `class=${entry.affordance_class} · surface=${entry.capability_surface}. ${base}`
    ).trim();
  }
  if (entry.description_canonical && entry.description_canonical.length > 40) {
    return entry.description_canonical;
  }
  const g = entry.gates;
  return (
    `ACTUATOR · ${entry.affordance_class} · ${entry.mutation_class} · ` +
    `kernel-supervised by ${entry.kernel_verb}` +
    (entry.kernel_wire ? ` (${entry.kernel_wire})` : "") +
    `. Not a plugin. Not a kernel verb. A-FORGE hands only. ` +
    `Gates: session=${g.requires_session ? "Y" : "N"} ` +
    `lease=${g.requires_lease ? "Y" : "N"} gate=Y ` +
    `seal=${g.requires_seal ? "Y" : "N"} ` +
    `approval=${g.requires_human_approval ? "Y" : "N"}. ` +
    base
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
