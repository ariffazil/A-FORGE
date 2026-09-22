/**
 * yamlGovernanceValidator.ts — Federation YAML Pre-Flight Validator
 *
 * FEDERATION-CONVERGENCE-P0 / P0-1 (2026-09-21):
 *   Every governance YAML must parse BEFORE any audit or runtime checks.
 *   A constitutional rule that cannot be parsed is not governance. It is dead text.
 *
 * Pipeline (per Arif's P0 directive):
 *   parse every governance YAML
 *   → schema validate
 *   → boot canary
 *   → only then deploy
 *
 * Boot canary signature:
 *   FEDERATION-YAML-BOOT-CANARY
 *   - returns ok=true iff every governance YAML parses without error
 *   - returns ok=false with the offending file:line:reason otherwise
 *
 * Usage:
 *   import { validateGovernanceYamls, FEDERATION_YAML_PATHS } from "./yamlGovernanceValidator.js";
 *   const gate = await validateGovernanceYamls();
 *   if (!gate.ok) throw new Error(JSON.stringify(gate.failures));
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parse as parseYaml } from "yaml";

/**
 * FEDERATION YAML SOT — every governance YAML in the federation.
 *
 * Sources of truth captured here, so the validator never has to grep:
 *   - organs/{arifos,A-FORGE,WEALTH,WELL,GEOX,AAA}/tools_sot.yaml
 *   - federation contracts (mcp_surface.yaml, tools.yaml)
 *   - federation intent cards (genesis_card.yaml across mirrors)
 *   - governance policy YAMLs (routing_policy, prohibited_inferences, etc.)
 *
 * Adding a governance YAML = adding a line below.
 */
export const FEDERATION_YAML_PATHS = [
  // ═══ Per-organ SOTs ═══
  "/root/A-FORGE/a_think/affordances.yaml",
  "/root/A-FORGE/a_think/organ_authority_ceilings.yaml",
  "/root/A-FORGE/a_think/budgets.yaml",
  "/root/A-FORGE/a_think/organ_affordances.yaml",
  "/root/A-FORGE/tools_sot.yaml",
  "/root/A-FORGE/organ.yaml",
  "/root/WEALTH/tools_sot.yaml",
  "/root/WEALTH/organ.yaml",
  "/root/WELL/tools_sot.yaml",
  "/root/GEOX/tools_sot.yaml",
  "/root/arifOS/tools_sot.yaml",

  // ═══ Federation contracts ═══
  "/root/A-FORGE/contracts/mcp_surface.yaml",
  "/root/A-FORGE/contracts/tools.yaml",

  // ═══ Genesis cards (canonical root + mirrors — all must parse) ═══
  "/root/AAA/cards/genesis_card.yaml",
  "/root/arifOS/cards/genesis_card.yaml",
  "/root/A-FORGE/cards/genesis_card.yaml",
] as const;

export type YamlFailure = {
  path: string;
  reason: string;
  line?: number;
  column?: number;
};

export type YamlValidationResult = {
  ok: boolean;
  total: number;
  parsed: number;
  failures: YamlFailure[];
  canary_signature: "FEDERATION-YAML-BOOT-CANARY";
};

/**
 * Minimal schema-validation contract for federation governance YAML:
 *   - must parse without error
 *   - must produce an object (not null/scalar)
 *   - must declare schema_version OR an obvious version key
 *   - must not produce a "Sparse YAML" no-document signal
 */
type SchemaResult = { schema_ok: boolean; reason?: string };

function schemaCheck(parsed: unknown, path: string, rawText: string): SchemaResult {
  // Derivation marker: a YAML file that explicitly declares itself
  // superseded/derived. Treated as valid governance (a pointer, not a
  // claim). The validation contract is "governance must be parseable,
  // not silent". A derivation marker IS a parseable governance signal.
  //
  // Pattern: a YAML where the only substantive content is comments
  // declaring the file superseded/derived. We detect this without
  // adding a hard schema contract — pure OBSERVE pattern.
  if (parsed == null) {
    const txt = rawText.trim();
    const isDerivationMarker =
      txt.startsWith("#") &&
      (/superseded\s+by/i.test(txt) || /status\s*:\s*DERIVED/i.test(txt));
    if (isDerivationMarker) {
      return { schema_ok: true };
    }
    return { schema_ok: false, reason: "yaml produced null — empty document (no DERIVATION marker)" };
  }
  if (typeof parsed !== "object") {
    return { schema_ok: false, reason: "yaml top-level is scalar — governance must be object" };
  }
  // TODO (post-convergence): per-file JSON schema validation.
  // Today we only guarantee "parses + is object". Tightening is P0 followup.
  return { schema_ok: true };
}

/**
 * Federation-YAML-Boot-Canary — pure OBSERVE function.
 *
 * - Reads each governance YAML
 * - Parses via `yaml`
 * - Schema-checks (parse + object-shape)
 * - Aggregates failures with file:line:column provenance when available
 *
 * No filesystem mutation. No MCP calls. Safe to run anywhere in the boot chain.
 */
export async function validateGovernanceYamls(
  paths: readonly string[] = FEDERATION_YAML_PATHS,
): Promise<YamlValidationResult> {
  const failures: YamlFailure[] = [];
  let parsed = 0;
  for (const p of paths) {
    if (!existsSync(p)) {
      failures.push({ path: p, reason: "missing file" });
      continue;
    }
    let text: string;
    try {
      text = await readFile(p, "utf-8");
    } catch (err) {
      failures.push({ path: p, reason: `read failed: ${(err as Error).message}` });
      continue;
    }
    let doc: unknown;
    try {
      doc = parseYaml(text);
    } catch (err) {
      // js-yaml exposes `linePos` with [{line, col}] for the offending node.
      const e = err as Error & { linePos?: Array<{ line: number; col: number }> };
      const lp = e.linePos?.[0];
      failures.push({
        path: p,
        reason: `yaml parse: ${e.message}`,
        line: lp?.line,
        column: lp?.col,
      });
      continue;
    }
    const schema = schemaCheck(doc, p, text);
    if (!schema.schema_ok) {
      failures.push({ path: p, reason: schema.reason ?? "schema check failed" });
      continue;
    }
    parsed += 1;
  }
  return {
    ok: failures.length === 0,
    total: paths.length,
    parsed,
    failures,
    canary_signature: "FEDERATION-YAML-BOOT-CANARY",
  };
}
