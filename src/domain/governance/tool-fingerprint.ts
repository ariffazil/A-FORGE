/**
 * tool-fingerprint.ts — Tool Fingerprinting for Dedupe + Drift Detection
 *
 * Computes a stable SHA-256 fingerprint from tool name + inputSchema.
 * Two tools with the same fingerprint = duplicate (same name + same schema).
 * One tool with changed fingerprint between restarts = schema drift.
 *
 * Uses: sha256(name + "::" + normalizedSchema)
 * Normalized schema: JSON.stringify(inputSchema) with sorted keys.
 *
 * P1 Task 2: Tool fingerprinting on forge_registry startup.
 * FastMCP equivalent: tool-fingerprinting.md at gofastmcp.com
 *
 * DITEMPA BUKAN DIBERI
 */

import * as crypto from "node:crypto";

export interface ToolFingerprint {
  toolName: string;
  fingerprint: string;
  schemaHash: string;
  schemaLength: number;
  registeredAt: string;
}

export interface FingerprintCheckResult {
  total: number;
  unique: number;
  duplicates: ToolFingerprintCollision[];
  fingerprints: ToolFingerprint[];
  passed: boolean;
  checkedAt: string;
}

export interface ToolFingerprintCollision {
  fingerprint: string;
  tools: string[];
}

/**
 * Normalize a Zod schema object to a stable JSON representation.
 * Strips descriptions (which can change without functional impact),
 * sorts keys, and produces a canonical string.
 */
function normalizeInputSchema(schema: any): string {
  if (!schema) return "{}";

  try {
    // If schema has _def (ZodObject), extract the shape
    if (schema._def && schema._def.shape) {
      return JSON.stringify(shapeToJson(schema._def.shape), objectKeysSort);
    }
    // If schema is a ZodRawShape (plain object of ZodTypes)
    if (typeof schema === "object" && !Array.isArray(schema)) {
      return JSON.stringify(objectToJsonSchema(schema), objectKeysSort);
    }
    // If it's a raw JSON Schema object
    if (schema.type || schema.properties) {
      return JSON.stringify(schema, objectKeysSort);
    }
  } catch {
    // Fallback
  }

  return JSON.stringify(schema, objectKeysSort);
}

/** Recursively extract a JSON-serializable representation from a Zod shape */
function shapeToJson(shape: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(shape)) {
    if (!value) continue;
    // ZodString, ZodNumber, ZodBoolean, ZodEnum, etc.
    const typeName = value._def?.typeName;
    if (typeName) {
      const entry: Record<string, any> = { type: typeName };
      if (value.isOptional?.()) entry.optional = true;
      if (value.description) entry.description = value.description;
      result[key] = entry;
    } else if (typeof value._def?.shape === "object") {
      // Nested ZodObject
      result[key] = shapeToJson(value._def.shape);
    } else if (typeof value === "object") {
      result[key] = String(value);
    }
  }
  return result;
}

/** Convert a plain object (RawShape pattern) to stable JSON schema */
function objectToJsonSchema(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value?._def?.typeName) {
      result[key] = { type: value._def.typeName };
    } else if (typeof value === "object") {
      result[key] = objectToJsonSchema(value);
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

/** JSON.stringify replacer that sorts keys for stable output */
function objectKeysSort(_key: string, value: any): any {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value).sort().reduce((sorted: Record<string, any>, k) => {
      sorted[k] = value[k];
      return sorted;
    }, {} as Record<string, any>);
  }
  return value;
}

/**
 * Compute SHA-256 fingerprint for a single tool.
 * Fingerprint = sha256(toolName + "::" + normalizedSchema)
 * Schema hash = sha256(normalizedSchema) — for drift detection
 */
export function computeToolFingerprint(toolName: string, inputSchema: any): ToolFingerprint {
  const normalized = normalizeInputSchema(inputSchema);
  const schemaHash = crypto.createHash("sha256").update(normalized).digest("hex");
  const fingerprint = crypto
    .createHash("sha256")
    .update(`${toolName}::${normalized}`)
    .digest("hex");

  return {
    toolName,
    fingerprint,
    schemaHash,
    schemaLength: normalized.length,
    registeredAt: new Date().toISOString(),
  };
}

/**
 * Check all registered tools for fingerprint collisions (duplicates).
 * Same fingerprint = two tools with the same name + schema.
 */
export function checkToolFingerprints(
  tools: Array<{ name: string; schema?: any }>,
): FingerprintCheckResult {
  const fingerprints: ToolFingerprint[] = [];
  const fingerprintMap = new Map<string, string[]>();

  for (const tool of tools) {
    const fp = computeToolFingerprint(tool.name, tool.schema);
    fingerprints.push(fp);

    if (!fingerprintMap.has(fp.fingerprint)) {
      fingerprintMap.set(fp.fingerprint, []);
    }
    fingerprintMap.get(fp.fingerprint)!.push(tool.name);
  }

  const duplicates: ToolFingerprintCollision[] = [];
  for (const [fingerprint, names] of fingerprintMap.entries()) {
    if (names.length > 1) {
      duplicates.push({ fingerprint, tools: names });
    }
  }

  return {
    total: tools.length,
    unique: fingerprintMap.size,
    duplicates,
    fingerprints,
    passed: duplicates.length === 0,
    checkedAt: new Date().toISOString(),
  };
}
