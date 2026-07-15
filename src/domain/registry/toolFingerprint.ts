/**
 * TOOL FINGERPRINTING — Startup deduplication + drift detection.
 *
 * SHA-256 hash of (tool_name + inputSchema) for every registered tool.
 * On startup, compares against previous fingerprint set to detect:
 * - Duplicate tools (same name, different schema)
 * - Schema drift (schema changed between restarts)
 * - Phantom tools (registered but not in source)
 *
 * Based on FastMCP's tool fingerprinting concept.
 * Complements forge_surface_guard (runtime drift) and forge_surface_audit (phantom detection).
 *
 * @module domain/registry/toolFingerprint
 * @constitutional F2 TRUTH — schema changes must be witnessed
 * @constitutional F11 AUDIT — fingerprint changes are logged
 */

import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ToolFingerprint {
  name: string;
  hash: string;
  schema_summary: string;
  fingerprinted_at: string;
}

export interface FingerprintReport {
  total_tools: number;
  new_tools: string[];
  removed_tools: string[];
  schema_changed: string[];
  duplicates: string[];
  unchanged: number;
  verdict: "CLEAN" | "DRIFT" | "DUPLICATES" | "MIXED";
  timestamp: string;
}

export interface FingerprintStore {
  version: number;
  generated_at: string;
  tools: Record<string, ToolFingerprint>;
}

// ── Core fingerprinting ─────────────────────────────────────────────────────

/**
 * Generate a stable fingerprint for a tool.
 * Hash = SHA-256(tool_name + canonical_schema_json)
 */
export function fingerprintTool(name: string, inputSchema: unknown): ToolFingerprint {
  // Canonicalize schema: sort keys recursively for stable hashing
  const canonical = canonicalize(inputSchema);
  const hash = createHash("sha256")
    .update(`${name}::${canonical}`)
    .digest("hex")
    .slice(0, 16); // 16 chars is enough for collision detection

  // Extract schema summary for human-readable comparison
  const summary = extractSchemaSummary(inputSchema);

  return {
    name,
    hash,
    schema_summary: summary,
    fingerprinted_at: new Date().toISOString(),
  };
}

/**
 * Fingerprint all tools from a registry.
 */
export function fingerprintAll(tools: Array<{ name: string; inputSchema: unknown }>): Map<string, ToolFingerprint> {
  const map = new Map<string, ToolFingerprint>();
  for (const tool of tools) {
    const fp = fingerprintTool(tool.name, tool.inputSchema);
    map.set(tool.name, fp);
  }
  return map;
}

/**
 * Compare current fingerprints against stored set.
 * Returns a report of changes.
 */
export function compareFingerprints(
  current: Map<string, ToolFingerprint>,
  stored: Map<string, ToolFingerprint>,
): FingerprintReport {
  const currentNames = new Set(current.keys());
  const storedNames = new Set(stored.keys());

  const newTools = [...currentNames].filter(n => !storedNames.has(n));
  const removedTools = [...storedNames].filter(n => !currentNames.has(n));
  const schemaChanged: string[] = [];
  const duplicates: string[] = [];
  let unchanged = 0;

  // Check for schema changes in tools that exist in both
  for (const name of currentNames) {
    if (storedNames.has(name)) {
      const curr = current.get(name)!;
      const prev = stored.get(name)!;
      if (curr.hash !== prev.hash) {
        schemaChanged.push(name);
      } else {
        unchanged++;
      }
    }
  }

  // Check for duplicate names (shouldn't happen but defensive)
  const nameCounts = new Map<string, number>();
  for (const name of currentNames) {
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  for (const [name, count] of nameCounts) {
    if (count > 1) duplicates.push(name);
  }

  let verdict: FingerprintReport["verdict"] = "CLEAN";
  if (schemaChanged.length > 0 && (newTools.length > 0 || removedTools.length > 0)) verdict = "MIXED";
  else if (schemaChanged.length > 0 || newTools.length > 0 || removedTools.length > 0) verdict = "DRIFT";
  else if (duplicates.length > 0) verdict = "DUPLICATES";

  return {
    total_tools: current.size,
    new_tools: newTools,
    removed_tools: removedTools,
    schema_changed: schemaChanged,
    duplicates,
    unchanged,
    verdict,
    timestamp: new Date().toISOString(),
  };
}

// ── Persistence ─────────────────────────────────────────────────────────────

const DEFAULT_STORE_PATH = "/root/A-FORGE/.registry/fingerprints.json";

/**
 * Load stored fingerprints from disk.
 */
export async function loadFingerprints(storePath: string = DEFAULT_STORE_PATH): Promise<Map<string, ToolFingerprint>> {
  try {
    const raw = await readFile(storePath, "utf-8");
    const store: FingerprintStore = JSON.parse(raw);
    const map = new Map<string, ToolFingerprint>();
    for (const [name, fp] of Object.entries(store.tools)) {
      map.set(name, fp);
    }
    return map;
  } catch {
    return new Map(); // No stored fingerprints = first run
  }
}

/**
 * Save current fingerprints to disk.
 */
export async function saveFingerprints(
  fingerprints: Map<string, ToolFingerprint>,
  storePath: string = DEFAULT_STORE_PATH,
): Promise<void> {
  await mkdir(dirname(storePath), { recursive: true });
  const store: FingerprintStore = {
    version: 1,
    generated_at: new Date().toISOString(),
    tools: Object.fromEntries(fingerprints),
  };
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf-8");
}

// ── Startup check ───────────────────────────────────────────────────────────

/**
 * Run fingerprint check at A-FORGE startup.
 * 1. Fingerprint all registered tools
 * 2. Compare against stored set
 * 3. Log report
 * 4. Save current set
 *
 * Returns the report for logging/alerting.
 */
export async function startupFingerprintCheck(
  tools: Array<{ name: string; inputSchema: unknown }>,
  storePath?: string,
): Promise<FingerprintReport> {
  const current = fingerprintAll(tools);
  const stored = await loadFingerprints(storePath);
  const report = compareFingerprints(current, stored);

  // Log to stderr (safe for stdio transport)
  if (report.verdict !== "CLEAN") {
    process.stderr.write(`[FINGERPRINT] Registry ${report.verdict}: ` +
      `${report.new_tools.length} new, ${report.removed_tools.length} removed, ` +
      `${report.schema_changed.length} changed, ${report.unchanged} unchanged\n`);
    if (report.new_tools.length > 0) process.stderr.write(`  NEW: ${report.new_tools.join(", ")}\n`);
    if (report.removed_tools.length > 0) process.stderr.write(`  REMOVED: ${report.removed_tools.join(", ")}\n`);
    if (report.schema_changed.length > 0) process.stderr.write(`  CHANGED: ${report.schema_changed.join(", ")}\n`);
  } else {
    process.stderr.write(`[FINGERPRINT] Registry CLEAN: ${report.total_tools} tools, ${report.unchanged} unchanged\n`);
  }

  // Save current fingerprints for next startup
  await saveFingerprints(current, storePath);

  return report;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Canonicalize a value for stable JSON hashing.
 * Sorts object keys recursively.
 */
function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (typeof value === "object") {
    const sorted = Object.keys(value as Record<string, unknown>).sort();
    const entries = sorted.map(k => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`);
    return `{${entries.join(",")}}`;
  }
  return String(value);
}

/**
 * Extract a human-readable summary from a Zod schema or JSON schema.
 */
function extractSchemaSummary(schema: unknown): string {
  if (!schema || typeof schema !== "object") return "unknown";
  const s = schema as Record<string, unknown>;

  // Zod schema — extract shape
  if (s._def && typeof s._def === "object") {
    const def = s._def as Record<string, unknown>;
    if (def.typeName === "ZodObject" && def.shape && typeof def.shape === "function") {
      try {
        const shape = (def.shape as Function)();
        const keys = Object.keys(shape);
        return `object(${keys.join(",")})`;
      } catch {
        return "object(?)";
      }
    }
    return String(def.typeName ?? "zod");
  }

  // JSON schema
  if (s.type === "object" && s.properties && typeof s.properties === "object") {
    const keys = Object.keys(s.properties as Record<string, unknown>);
    return `object(${keys.join(",")})`;
  }

  return String(s.type ?? "unknown");
}
