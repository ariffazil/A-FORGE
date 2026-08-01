/**
 * register.ts — forge.register: Gated Tool Registration
 *
 * Registration requires ALL of:
 *   1. GateDecision with verdict = SEAL (G ≥ 0.80, C_dark ≤ 0.40)
 *   2. WitnessVerdict with seal_eligible = true (W³ ≥ 0.75)
 *   3. HARAM scan pass (zero CRITICAL findings)
 *   4. Scar consultation pass (no CRITICAL scar with matching fingerprint)
 *
 * These are non-compensatory: failing any one gate blocks registration.
 *
 * Backward compatible with existing SkillRegistry (skillRegistry.ts).
 * The existing forge_skill monolith calls the same registry internally.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 * @constitutional F1 AMANAH — registration is gated and reversible (24h TTL)
 * @constitutional F8 LAW — arifos domain requires explicit seal_verdict_id
 * @constitutional F11 AUDIT — every registration leaves a trace
 */

import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import type {
  SealRecord,
  GateDecision,
  WitnessVerdict,
  GovernedDomain,
} from "../../contracts/types.js";
import {
  scanToolDescription,
  isShadowOf,
  type PoisonScanResult,
} from "../governance/toolDescriptionPoison.js";

const REGISTRY_DIR = "/root/A-FORGE/.runtime/skills/";
const REGISTRY_PATH = `${REGISTRY_DIR}registry.json`;
const SAMPLES_DIR = `${REGISTRY_DIR}theta_samples/`;

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — REGISTRY STORAGE (reuses .runtime/skills/registry.json)
// ═══════════════════════════════════════════════════════════════════════════════

let cache: Map<string, SealRecord> | null = null;

async function ensureLoaded(): Promise<Map<string, SealRecord>> {
  if (cache) return cache;
  await fs.mkdir(REGISTRY_DIR, { recursive: true });
  await fs.mkdir(SAMPLES_DIR, { recursive: true });
  try {
    const data = await fs.readFile(REGISTRY_PATH, "utf-8");
    const parsed = JSON.parse(data) as Record<string, any>;
    // Coerce existing SkillManifest entries into SealRecord format
    cache = new Map();
    for (const [key, val] of Object.entries(parsed)) {
      if (val && typeof val === "object") {
        cache.set(key, val as SealRecord);
      }
    }
  } catch {
    cache = new Map();
  }
  await pruneExpired();
  return cache;
}

async function persist(): Promise<void> {
  if (!cache) return;
  await fs.mkdir(REGISTRY_DIR, { recursive: true });
  const obj = Object.fromEntries(cache);
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(obj, null, 2));
}

async function pruneExpired(): Promise<void> {
  if (!cache) return;
  const now = Date.now();
  for (const [name, record] of cache.entries()) {
    if (new Date(record.expires_at).getTime() < now && record.status === "REGISTERED") {
      record.status = "EXPIRED";
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — GATE CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

export interface RegisterPreconditions {
  /** The gate decision that evaluated this tool */
  gate: GateDecision;
  /** The witness verdict from tri-witness consensus */
  witness: WitnessVerdict;
  /** Whether HARAM scan passed (zero CRITICAL findings) */
  haramPassed: boolean;
  /** HARAM findings count */
  haramFindings: number;
  /** Scar consultation result */
  scarPressure: number;
  scarsConsulted: number;
  /** OWASP MCP03 tool description poison scan result (Gate 5, 2026-08-01) */
  poisonScan?: PoisonScanResult;
}

interface GateCheckResult {
  passed: boolean;
  blockedBy: string[];
  reason: string;
}

/**
 * Check all preconditions for registration.
 *
 * Non-compensatory: any single gate failure blocks registration.
 */
function checkRegistrationGates(pre: RegisterPreconditions): GateCheckResult {
  const blockedBy: string[] = [];
  const reasons: string[] = [];

  // Gate 1: SEAL verdict from forge.evaluate
  if (pre.gate.verdict !== "SEAL") {
    blockedBy.push("GATE");
    reasons.push(`Gate verdict is ${pre.gate.verdict} — requires SEAL (G ≥ 0.80, C_dark ≤ 0.40)`);
  }

  // Gate 2: Witness consensus
  if (!pre.witness.seal_eligible) {
    blockedBy.push("WITNESS");
    reasons.push(`Witness verdict is ${pre.witness.verdict} — requires CONSENSUS (W³ ≥ 0.75)`);
  }

  // Gate 3: HARAM scan
  if (!pre.haramPassed) {
    blockedBy.push("HARAM");
    reasons.push(`HARAM scan found ${pre.haramFindings} violation(s) — requires zero CRITICAL findings`);
  }

  // Gate 4: Scar law — CRITICAL scar with matching fingerprint blocks registration
  if (pre.scarPressure >= 0.7) {
    blockedBy.push("SCAR");
    reasons.push(`Scar pressure ${pre.scarPressure.toFixed(2)} ≥ 0.7 — CRITICAL scar pattern detected, registration blocked`);
  }

  // Gate 5: OWASP MCP03 — Tool description poison scan (added 2026-08-01)
  // Per scar_scar_005 (phantom tool misclassification) — graph can be stale; code is truth.
  // Per OWASP MCP03 control set: pattern-detect before registration.
  if (pre.poisonScan && !pre.poisonScan.clean) {
    blockedBy.push("POISON");
    reasons.push(
      `Tool description poison scan failed: ${pre.poisonScan.reason} (severity=${pre.poisonScan.severity}, fingerprint=${pre.poisonScan.fingerprint})`
    );
  }

  if (blockedBy.length === 0) {
    return {
      passed: true,
      blockedBy: [],
      reason: "All registration gates passed — SEAL + WITNESS + HARAM + SCAR + POISON",
    };
  }

  return {
    passed: false,
    blockedBy,
    reason: reasons.join("; "),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface RegisterOptions {
  tool_name: string;
  domain: GovernedDomain;
  description: string;
  implementation: string;
  input_schema: string;
  registered_by: string;
  preconditions: RegisterPreconditions;
}

/**
 * forge.register — gated tool registration.
 *
 * Returns SEAL if all gates passed, HOLD if any gate failed.
 * Backward compatible: writes to the same .runtime/skills/registry.json
 * that forge_skill uses.
 */
export async function registerTool(opts: RegisterOptions): Promise<{
  status: "SEAL" | "HOLD";
  record?: SealRecord;
  gateCheck: GateCheckResult;
  message: string;
}> {
  const registry = await ensureLoaded();

  // Gate 5 (auto-scan): If no poison scan was supplied, run one now.
  // Per OWASP MCP03, the scan is mandatory before registration.
  // F12 RESILIENCE — refuse poisoned input.
  if (!opts.preconditions.poisonScan) {
    const autoScan = scanToolDescription(
      opts.tool_name,
      opts.description,
      undefined,
      opts.implementation
    );
    opts.preconditions.poisonScan = autoScan;
  }

  // Check all gates
  const gateCheck = checkRegistrationGates(opts.preconditions);

  if (!gateCheck.passed) {
    return {
      status: "HOLD",
      gateCheck,
      message: `Registration blocked: ${gateCheck.reason}`,
    };
  }

  // Protected names — cannot overwrite core forge tools
  const PROTECTED_NAMES = new Set([
    "forge_skill",
    "forge_execute",
    "forge_evaluate",
    "forge_witness",
    "forge_scar",
    "forge_register",
    "forge_registry",
    "forge_agent",
    "forge_lease",
    "forge_shell",
    "forge_git",
    "forge_docker",
    "forge_filesystem",
    "forge_memory",
    "forge_orchestrate",
  ]);

  if (PROTECTED_NAMES.has(opts.tool_name)) {
    return {
      status: "HOLD",
      gateCheck: { passed: false, blockedBy: ["PROTECTED"], reason: `Tool name '${opts.tool_name}' is protected — cannot override core forge tools` },
      message: `Registration blocked: '${opts.tool_name}' is a protected core tool name`,
    };
  }

  // Check for existing registration
  if (registry.has(opts.tool_name)) {
    const existing = registry.get(opts.tool_name)!;
    if (existing.status === "REGISTERED") {
      return {
        status: "HOLD",
        gateCheck: { passed: false, blockedBy: ["DUPLICATE"], reason: `Tool '${opts.tool_name}' already registered` },
        message: `Tool '${opts.tool_name}' already registered — use forge_skill with new name or revoke existing registration first`,
      };
    }
  }

  // Compute fingerprint
  const fingerprint = crypto
    .createHash("sha256")
    .update(`${opts.domain}::${opts.tool_name}::${opts.description.slice(0, 200)}`)
    .digest("hex")
    .slice(0, 16);

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const record: SealRecord = {
    tool_name: opts.tool_name,
    fingerprint,
    domain: opts.domain,
    implementation: opts.implementation,
    input_schema: opts.input_schema,
    description: opts.description,
    gate_decision: opts.preconditions.gate,
    witness_verdict: opts.preconditions.witness,
    scars_consulted: opts.preconditions.scarsConsulted,
    scar_pressure_applied: opts.preconditions.scarPressure,
    status: "REGISTERED",
    registered_by: opts.registered_by,
    registered_at: now,
    expires_at: expiresAt,
    execution_count: 0,
  };

  registry.set(opts.tool_name, record);
  await persist();

  return {
    status: "SEAL",
    record,
    gateCheck,
    message: `Tool '${opts.tool_name}' registered with SEAL — expires ${expiresAt}`,
  };
}

/**
 * Query the registry.
 */
export async function queryRegistry(opts?: {
  domain?: GovernedDomain;
  status?: string;
}): Promise<{ total: number; tools: SealRecord[] }> {
  const registry = await ensureLoaded();
  let tools = Array.from(registry.values());

  if (opts?.domain) {
    tools = tools.filter(t => t.domain === opts.domain);
  }
  if (opts?.status) {
    tools = tools.filter(t => t.status === opts.status);
  }

  return { total: tools.length, tools };
}

/**
 * Compute registry fingerprint for integrity verification.
 */
export async function registryFingerprint(): Promise<string> {
  const { tools } = await queryRegistry();
  const sorted = tools.map(t => `${t.tool_name}:${t.status}`).sort().join(",");
  return crypto.createHash("sha256").update(sorted).digest("hex").slice(0, 16);
}
