/**
 * CapabilityABI — Canonical typed contract for an ephemeral capability.
 *
 * ═══ P1.1 (2026-07-31) ═══════════════════════════════════════════════════
 * Every capability becomes a first-class typed object. Missions bind
 * to `capability_id`; the engine sizes leases and emits verifier
 * evidence from the contract. Authorisation still flows through
 * arif_judge; A-FORGE never self-promotes.
 *
 * @module forge/capabilityAbi
 * @constitutional F1 AMANAH · F2 TRUTH · F8 GENIUS · F11 AUDIT
 */
import { createHash } from "node:crypto";
import type { ZodTypeAny } from "zod";
import type { VerifierMethod } from "../governance/verifier/VerifierRegistry.js";
import type { SecretRef } from "../../infrastructure/secrets/SecretBroker.js";
import type { TemplateType } from "../../infrastructure/tools/EphemeralGenesis.js";

export type MissionVerb =
  | "Investigate" | "Interpret" | "Decide" | "Choose" | "Monitor" | "Remember";

export type AuthorityBand = "GREEN" | "YELLOW" | "ORANGE" | "RED";

export interface CapabilityABI {
  abi_version: "1.0.0";
  capability_id: string;
  name: string;
  description: string;
  template_type: TemplateType;
  serves: MissionVerb[];
  input_schema: ZodTypeAny;
  output_schema: ZodTypeAny;
  resource_budget: {
    max_runtime_ms: number;
    max_memory_mb: number;
    max_cpu_seconds: number;
    max_file_size_mb: number;
  };
  requires: string[];
  min_authority_band: AuthorityBand;
  verifier_methods_required: VerifierMethod[];
  credential_refs: SecretRef[];
  author: string;
  hash: string;
  arifos_witness_required: boolean;
}

/** Canonicalise an ABI to a stable JSON string for hashing. */
function canonicalize(abi: Omit<CapabilityABI, "hash">): string {
  // Sort keys recursively so the hash is stable across ordering changes.
  const replacer = (_: string, value: unknown): unknown => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(value as Record<string, unknown>).sort()) {
        sorted[k] = (value as Record<string, unknown>)[k];
      }
      return sorted;
    }
    if (Array.isArray(value)) {
      return [...value].map((v) =>
        v && typeof v === "object" ? JSON.parse(JSON.stringify(v, replacer)) : v,
      );
    }
    return value;
  };
  return JSON.stringify(abi, replacer);
}

export function hashCapabilityABI(abi: Omit<CapabilityABI, "hash">): string {
  return createHash("sha256").update(canonicalize(abi)).digest("hex");
}

// ── Cycle detection on `requires` ────────────────────────────────────

/**
 * Detect cycles in the `requires` graph. The ABIs are passed as a flat
 * list keyed by `capability_id`. Returns the cycle path or null.
 */
export function findRequiresCycle(abilities: CapabilityABI[]): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const abi of abilities) {
    adjacency.set(abi.capability_id, abi.requires);
  }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const id of adjacency.keys()) color.set(id, WHITE);
  const stack: string[] = [];
  function dfs(node: string): string[] | null {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) {
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) {
        return [...stack, next];
      }
      if (c === WHITE) {
        const found = dfs(next);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(node, BLACK);
    return null;
  }
  for (const id of adjacency.keys()) {
    if ((color.get(id) ?? WHITE) === WHITE) {
      const cycle = dfs(id);
      if (cycle) return cycle;
    }
  }
  return null;
}

// ── Registry ─────────────────────────────────────────────────────────

export class CapabilityABIRegistry {
  private readonly byId = new Map<string, CapabilityABI>();

  register(abiInput: Omit<CapabilityABI, "hash">): CapabilityABI {
    const hash = hashCapabilityABI(abiInput);
    const abi: CapabilityABI = { ...abiInput, hash };
    this.byId.set(abi.capability_id, abi);
    return abi;
  }

  get(capability_id: string): CapabilityABI | undefined {
    return this.byId.get(capability_id);
  }

  list(): CapabilityABI[] {
    return Array.from(this.byId.values());
  }

  findRequiresCycle(): string[] | null {
    return findRequiresCycle(this.list());
  }
}

let _registry: CapabilityABIRegistry | null = null;
export function getCapabilityABIRegistry(): CapabilityABIRegistry {
  if (!_registry) _registry = new CapabilityABIRegistry();
  return _registry;
}
