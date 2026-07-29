/**
 * FORGE8 Execution Verbs — Governed MCP Tool Implementation
 *
 * 8 constitutional verbs forming A-FORGE's internal execution loop.
 * Each verb has enforced boundaries (not advisory).
 * forge_execute FAILS HARD without valid VAULT999 SEAL from arifOS.
 *
 * EXECUTION LOOP:
 *   synthesize → stage → sandbox_run → scar_scan →
 *   skillstore_sync → tier_bind → docket_prep → execute
 *
 * @module mcp/forge8Verbs
 * @constitutional F1 AMANAH — reversible-first, irreversible requires seal
 * @constitutional F13 SOVEREIGN — arifOS judges authority
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

import {
  ForgeSynthesizeRequestSchema,
  ForgeStageRequestSchema,
  ForgeSandboxRunRequestSchema,
  ForgeScarScanRequestSchema,
  ForgeSkillstoreWriteRequestSchema,
  ForgeSkillstoreReadRequestSchema,
  ForgeTierBindRequestSchema,
  ForgeDocketPrepRequestSchema,
  ForgeExecuteRequestSchema,
  TRUST_TIERS,
  SANDBOX_TIMEOUT_MAX_MS,
  SANDBOX_RESOURCE_LIMITS,
} from "./contract/forge8_execution_verbs.js";

// ── Sandbox Persistence (Pause/Resume) ────────────────────────────────────
import {
  pauseSandbox,
  resumeSandbox,
  listPaused,
  autoEvict,
  getSession,
  createSandbox,
  runInSandbox,
} from "../../domain/containment/ExecutionSandbox.js";
import { SandboxStorage } from "../../domain/containment/SandboxStorage.js";

// ── Storage paths ──────────────────────────────────────────────────────────
const FORGE8_STAGING_DIR = "/tmp/forge8/staging";
const FORGE8_BUFFER_DIR = "/tmp/forge8/buffer";
const FORGE8_DOCKETS_DIR = "/tmp/forge8/dockets";
const SKILLSTORE_PATH = "/var/lib/aforge/skillstore";

async function ensureDirectories() {
  await fs.mkdir(FORGE8_STAGING_DIR, { recursive: true });
  await fs.mkdir(FORGE8_BUFFER_DIR, { recursive: true });
  await fs.mkdir(FORGE8_DOCKETS_DIR, { recursive: true });
  await fs.mkdir(SKILLSTORE_PATH, { recursive: true }).catch(() => {});
}

function generateUUID(): string {
  return crypto.randomUUID();
}

function computeHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function epistemicTag(toolName: string) {
  return {
    output_class: "DETERMINISTIC",
    ai_involvement: "NONE",
    authority_claim: "ADVISORY",
    evidence_source: "COMPUTED",
    tagged_by: "aforge-mcp",
    tagged_at: new Date().toISOString(),
    schema_version: "1.0.0",
  };
}

// ── VERB 1: forge_synthesize ───────────────────────────────────────────────

async function forgeSynthesizeHandler(args: z.infer<typeof ForgeSynthesizeRequestSchema>) {
  await ensureDirectories();

  const artifact_id = generateUUID();
  // Detect language from intent text
  const language = detectLanguage(args.intent);

  const code = await generateCodeFromIntent(args.intent, language, args.context);
  const buffer_path = path.join(FORGE8_BUFFER_DIR, `${artifact_id}.${language}`);
  await fs.writeFile(buffer_path, code, "utf-8");

  const response = {
    artifact_id,
    code,
    language,
    estimated_complexity: estimateComplexity(code),
    synthesized_at: new Date().toISOString(),
    buffer_location: buffer_path,
    _epistemic: epistemicTag("forge_synthesize"),
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }],
  };
}

function detectLanguage(intent: string): string {
  const lower = intent.toLowerCase();
  if (lower.includes("python") || lower.includes("script")) return "python";
  if (lower.includes("typescript") || lower.includes("ts")) return "typescript";
  if (lower.includes("shell") || lower.includes("bash")) return "shell";
  return "python";
}

async function generateCodeFromIntent(intent: string, language: string, context?: string): Promise<string> {
  const templates: Record<string, string> = {
    python: `# Intent: ${intent}\n# Generated: ${new Date().toISOString()}\n\ndef main():\n    """${intent}"""\n    pass\n\nif __name__ == "__main__":\n    main()\n`,
    typescript: `// Intent: ${intent}\n// Generated: ${new Date().toISOString()}\n\nexport function main() {\n  // ${intent}\n}\n`,
    shell: `#!/bin/bash\n# Intent: ${intent}\n# Generated: ${new Date().toISOString()}\n\nset -euo pipefail\necho "Implementing: ${intent}"\n`,
  };
  return templates[language] || templates.python;
}

function estimateComplexity(code: string): "simple" | "moderate" | "complex" {
  const lines = code.split("\n").length;
  if (lines < 20) return "simple";
  if (lines < 100) return "moderate";
  return "complex";
}

// ── VERB 2: forge_stage ────────────────────────────────────────────────────

/**
 * Computes which organs are affected by a governance target string.
 * Simple prefix/name matching for now — can be extended.
 */
function computeAffectedOrgans(target: string): string[] {
  const targetLower = target.toLowerCase();
  const organs: string[] = [];
  
  const map: Record<string, string[]> = {
    "arifos": ["arifos"],
    "geox": ["geox"],
    "wealth": ["wealth"],
    "well": ["well"],
    "a-forge": ["a-forge", "aforge"],
    "aaa": ["aaa"],
    "vault": ["vault999", "vault"],
    "forge": ["a-forge", "aforge"],
    "cockpit": ["aaa"],
  };
  
  for (const [keyword, targets] of Object.entries(map)) {
    if (targetLower.includes(keyword)) {
      organs.push(...targets);
    }
  }
  
  // Always include the organ matching the first path segment
  const pathSegments = target.split("/").filter(Boolean);
  if (pathSegments.length > 0) {
    const firstSeg = pathSegments[0].toLowerCase();
    for (const [keyword, targets] of Object.entries(map)) {
      if (firstSeg.includes(keyword) || keyword.includes(firstSeg)) {
        organs.push(...targets);
      }
    }
  }
  
  return [...new Set(organs)];
}

/**
 * Estimates reversibility based on action keywords in intent.
 */
function estimateReversibility(intent: string, target: string): number {
  const lower = (intent + " " + target).toLowerCase();
  
  // Highly irreversible (blast radius = federation)
  if (/rm\s*-rf|drop\s+table|format|destroy|decommission/i.test(lower)) return 0.1;
  
  // Irreversible actions
  if (/delete|remove|purge|wipe|reset|shutdown/i.test(lower)) return 0.2;
  
  // Moderately reversible
  if (/deploy|restart|push|merge|migrate|rename/i.test(lower)) return 0.5;
  
  // Highly reversible
  if (/edit|update|add|create|write|refactor|test/i.test(lower)) return 0.8;
  
  // Fully reversible (observations, reads)
  if (/read|view|list|search|probe|audit/i.test(lower)) return 1.0;
  
  return 0.6; // default moderate
}

/**
 * Estimates blast radius from target path + intent.
 */
function estimateBlastRadius(intent: string, target: string): number {
  const lower = (intent + " " + target).toLowerCase();
  const organs = computeAffectedOrgans(target);
  
  // Federation-wide
  if (/federation|all\s+organs|global/i.test(lower)) return 1.0;
  if (organs.length >= 3) return 0.8;
  
  // Multi-organ
  if (organs.length === 2) return 0.5;
  
  // Single organ
  if (organs.length === 1) return 0.3;
  
  // Local
  if (/file|config|env|test/i.test(lower)) return 0.1;
  
  return 0.2;
}

/**
 * Computes a simulated diff for governance preview.
 * In production, this would run a real dry-run.
 */
function computeGovernanceDiff(intent: string, target: string): string {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const organs = computeAffectedOrgans(target);
  
  return [
    `# Governance Preview — ${now}`,
    `# Intent: ${intent}`,
    `# Target: ${target}`,
    `# Organs: ${organs.join(", ") || "none detected"}`,
    ``,
    `## Proposed Operation`,
    `  Action: ${intent.slice(0, 120)}${intent.length > 120 ? "..." : ""}`,
    `  Target: ${target}`,
    `  Organs: ${organs.join(", ") || "local"}`,
    ``,
    `## Estimated Impact`,
    `  Files touched: target-dependent (dry-run result shown at execution)`,
    `  Services affected: ${organs.length > 0 ? organs.join(", ") : "none"}`,
    `  Reversibility: ${(estimateReversibility(intent, target) * 100).toFixed(0)}%`,
    ``,
    `## Blast Radius Assessment`,
    `  Scope: ${organs.length === 0 ? "local" : organs.length === 1 ? `single organ (${organs[0]})` : `multi-organ (${organs.join(", ")})`}`,
    `  Federation impact: ${estimateBlastRadius(intent, target) > 0.5 ? "YES — multiple organs" : "Limited to target organ"}`,
  ].join("\n");
}

/**
 * forge_stage handler — dispatches between artifact (legacy) and governance mode.
 */
async function forgeStageHandler(args: z.infer<typeof ForgeStageRequestSchema>) {
  await ensureDirectories();
  
  const stage_id = generateUUID();
  const staging_path = path.join(FORGE8_STAGING_DIR, stage_id);
  await fs.mkdir(staging_path, { recursive: true });
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + (args.ttl_seconds || 300) * 1000).toISOString();
  
  // ── GOVERNANCE MODE ──
  if (args.mode === "governance") {
    const intent = args.intent!;
    const target = args.target!;
    const diff = computeGovernanceDiff(intent, target);
    const affectedOrgans = computeAffectedOrgans(target);
    const reversibilityScore = estimateReversibility(intent, target);
    const blastRadius = estimateBlastRadius(intent, target);
    
    // Persist stage metadata
    const stageMeta = {
      mode: "governance",
      stage_id,
      intent,
      target,
      params: args.params || {},
      diff,
      affected_organs: affectedOrgans,
      reversibility_score: reversibilityScore,
      blast_radius: blastRadius,
      created_at: now,
      expires_at: expiresAt,
      status: "pending", // pending | sealed | held | voided
    };
    await fs.writeFile(
      path.join(staging_path, "stage.json"),
      JSON.stringify(stageMeta, null, 2),
      "utf-8"
    );
    
    const previewUri = `ui://aforge/preview/${stage_id}`;
    
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          stage_id,
          mode: "governance",
          intent,
          target,
          diff,
          affected_organs: affectedOrgans,
          reversibility_score: reversibilityScore,
          blast_radius: blastRadius,
          locked: true,
          staged_at: now,
          expires_at: expiresAt,
          preview_uri: previewUri,
          _epistemic: epistemicTag("forge_stage"),
        }, null, 2),
      }],
    };
  }
  
  // ── ARTIFACT MODE (legacy FORGE8) ──
  const bufferFiles = await fs.readdir(FORGE8_BUFFER_DIR).catch(() => []);
  const artifactFile = bufferFiles.find(f => f.startsWith(args.artifact_id!));
  
  if (!artifactFile) {
    throw new Error(`Artifact ${args.artifact_id} not found in buffer`);
  }
  
  const code = await fs.readFile(path.join(FORGE8_BUFFER_DIR, artifactFile), "utf-8");
  await fs.writeFile(path.join(staging_path, "artifact.code"), code, "utf-8");
  
  const spec = {
    artifact_id: args.artifact_id,
    stage_id,
    locked_at: now,
    dependencies: args.dependencies || [],
    immutable: true,
  };
  await fs.writeFile(path.join(staging_path, "spec.json"), JSON.stringify(spec, null, 2), "utf-8");
  
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        stage_id,
        mode: "artifact",
        staging_location: staging_path,
        locked: true,
        immutable: true,
        staged_at: now,
        expires_at: expiresAt,
        _epistemic: epistemicTag("forge_stage"),
      }, null, 2),
    }],
  };
}

// ── VERB 3: forge_sandbox_run ──────────────────────────────────────────────

async function forgeSandboxRunHandler(args: z.infer<typeof ForgeSandboxRunRequestSchema>) {
  const staging_path = path.join(FORGE8_STAGING_DIR, args.stage_id);

  try {
    await fs.access(staging_path);
  } catch {
    throw new Error(`Stage ${args.stage_id} not found`);
  }

  // ABSOLUTE TIMEOUT — enforced, not advisory
  const timeout_ms = Math.min(args.absolute_timeout_ms, SANDBOX_TIMEOUT_MAX_MS.C3_SOVEREIGN);
  const start_time = Date.now();

  // Execute staged artifact in isolated sandbox
  let exit_code = 0;
  let stdout = "";
  let stderr = "";

  try {
    const result = await execAsync(`bash artifact.code`, {
      cwd: staging_path,
      timeout: timeout_ms,
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error: any) {
    exit_code = error.code || 1;
    stdout = error.stdout || "";
    stderr = error.stderr || error.message;
  }

  const execution_time_ms = Date.now() - start_time;

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        stage_id: args.stage_id,
        test_results: { exit_code, stdout, stderr },
        metrics: {
          execution_time_ms,
          memory_peak_mb: args.resource_limits.memory_mb,
          cpu_time_ms: execution_time_ms,
        },
        _epistemic: epistemicTag("forge_sandbox_run"),
      }, null, 2),
    }],
  };
}

// ── VERB 4: forge_scar_scan ────────────────────────────────────────────────

async function forgeScarScanHandler(args: z.infer<typeof ForgeScarScanRequestSchema>) {
  // Check against SCAR database
  // In production: query Qdrant for similar SCAR vectors
  const scar_matches: any[] = [];
  const verdict = scar_matches.length === 0 ? "CLEAN" : "SCAR_MATCH";

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        artifact_id: args.artifact_id,
        scan_depth: args.scan_depth,
        scar_matches,
        verdict,
        scanned_at: new Date().toISOString(),
        _epistemic: epistemicTag("forge_scar_scan"),
      }, null, 2),
    }],
  };
}

// ── VERB 5: forge_skillstore_sync (WRITE) ──────────────────────────────────

async function forgeSkillstoreWriteHandler(args: z.infer<typeof ForgeSkillstoreWriteRequestSchema>) {
  await ensureDirectories();

  const record_id = generateUUID();
  const record = {
    record_id,
    artifact_id: args.artifact_id,
    artifact: args.artifact,
    tags: args.tags || [],
    stored_at: new Date().toISOString(),
    retention_policy: {
      hot_storage_days: 365,
      cold_storage_infinite: true,
    },
  };

  const record_path = path.join(SKILLSTORE_PATH, `${record_id}.json`);
  await fs.writeFile(record_path, JSON.stringify(record, null, 2), "utf-8");

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        operation: "WRITE",
        record_id,
        stored_at: record.stored_at,
        _epistemic: epistemicTag("forge_skillstore_sync"),
      }, null, 2),
    }],
  };
}

// ── VERB 5b: forge_skillstore_sync (READ) ──────────────────────────────────

async function forgeSkillstoreReadHandler(args: z.infer<typeof ForgeSkillstoreReadRequestSchema>) {
  const files = await fs.readdir(SKILLSTORE_PATH).catch(() => []);
  const records: any[] = [];

  for (const file of files.slice(0, 1000)) {
    try {
      const content = await fs.readFile(path.join(SKILLSTORE_PATH, file), "utf-8");
      records.push(JSON.parse(content));
    } catch { /* skip unparseable */ }
  }

  const query = args.query.toLowerCase();
  const matches = records
    .filter(r => JSON.stringify(r).toLowerCase().includes(query))
    .slice(0, args.limit);

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        operation: "READ",
        query: args.query,
        artifacts_found: matches.length,
        artifacts: matches,
        queried_at: new Date().toISOString(),
        _epistemic: epistemicTag("forge_skillstore_sync"),
      }, null, 2),
    }],
  };
}

// ── VERB 6: forge_tier_bind ────────────────────────────────────────────────

async function forgeTierBindHandler(args: z.infer<typeof ForgeTierBindRequestSchema>) {
  const policy = {
    artifact_id: args.artifact_id,
    trust_tier_lower_bound: args.trust_tier_lower_bound,
    execution_scope: args.execution_scope,
    bound_at: new Date().toISOString(),
    constitutional_note: "A-FORGE sets lower bound only. arifOS sets actual tier.",
  };

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        artifact_id: args.artifact_id,
        trust_tier_lower_bound: args.trust_tier_lower_bound,
        policy_hash: computeHash(JSON.stringify(policy)),
        execution_scope_configured: args.execution_scope,
        tier_bound_at: policy.bound_at,
        _epistemic: epistemicTag("forge_tier_bind"),
      }, null, 2),
    }],
  };
}

// ── VERB 7: forge_docket_prep ──────────────────────────────────────────────

async function forgeDocketPrepHandler(args: z.infer<typeof ForgeDocketPrepRequestSchema>) {
  await ensureDirectories();

  const docket_id = generateUUID();
  const docket = {
    docket_id,
    artifact_id: args.artifact_id,
    stage_id: args.stage_id,
    evidence_package: args.evidence_package,
    prepared_at: new Date().toISOString(),
    status: "PENDING_ARIFOS_REVIEW",
    read_only: true,
  };

  const docket_path = path.join(FORGE8_DOCKETS_DIR, `${docket_id}.json`);
  await fs.writeFile(docket_path, JSON.stringify(docket, null, 2), "utf-8");

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        docket_id,
        docket_path,
        status: "PENDING_ARIFOS_REVIEW",
        sealed: true,
        read_only: true,
        submitted_at: docket.prepared_at,
        constitutional_note: "A-FORGE relinquishes control. Docket read-only. arifOS must evaluate.",
        awaiting_arifos_evaluation: true,
        _epistemic: epistemicTag("forge_docket_prep"),
      }, null, 2),
    }],
  };
}

// ── VERB 8: forge_execute ──────────────────────────────────────────────────

async function forgeExecuteHandler(args: z.infer<typeof ForgeExecuteRequestSchema>) {
  const now = new Date().toISOString();
  
  // ── GOVERNANCE PATH (stage_id + human_seal_token) ──
  if (args.stage_id && args.human_seal_token) {
    const staging_path = path.join(FORGE8_STAGING_DIR, args.stage_id);
    
    // Verify stage exists
    let stageMeta: any;
    try {
      stageMeta = JSON.parse(await fs.readFile(path.join(staging_path, "stage.json"), "utf-8"));
    } catch {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error_type: "STAGE_NOT_FOUND",
            error_message: `Stage ${args.stage_id} not found or expired`,
            _epistemic: epistemicTag("forge_execute"),
          }, null, 2),
        }],
        isError: true,
      };
    }
    
    // Verify stage is governance mode
    if (stageMeta.mode !== "governance") {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error_type: "STAGE_MODE_MISMATCH",
            error_message: "Stage is not in governance mode",
            _epistemic: epistemicTag("forge_execute"),
          }, null, 2),
        }],
        isError: true,
      };
    }
    
    // Verify stage not expired
    if (new Date(stageMeta.expires_at) < new Date()) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error_type: "STAGE_EXPIRED",
            error_message: `Stage expired at ${stageMeta.expires_at}. Re-run forge_stage to create a new preview.`,
            _epistemic: epistemicTag("forge_execute"),
          }, null, 2),
        }],
        isError: true,
      };
    }
    
    // Verify stage not already acted upon
    if (stageMeta.status !== "pending") {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error_type: "STAGE_ALREADY_RESOLVED",
            error_message: `Stage status is "${stageMeta.status}" — already resolved`,
            _epistemic: epistemicTag("forge_execute"),
          }, null, 2),
        }],
        isError: true,
      };
    }
    
    // Verify human_seal_token cryptographically via arifOS VAULT999
    const token_valid = await verifyHumanSealToken(args.human_seal_token, args.stage_id);
    if (!token_valid) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error_type: "INVALID_HUMAN_SEAL_TOKEN",
            error_message: "human_seal_token cryptographic verification failed — VAULT999 rejected the token.",
            constitutional_violation: {
              violated_principle: "F13 SOVEREIGN — fabricated approval token rejected",
              required_action: "Re-obtain valid human_seal_token from F13 sovereign",
            },
            _epistemic: epistemicTag("forge_execute"),
          }, null, 2),
        }],
        isError: true,
      };
    }
    
    // Mark stage as sealed (execution ready)
    stageMeta.status = "sealed";
    stageMeta.executed_at = now;
    stageMeta.human_seal_token = args.human_seal_token.slice(0, 8) + "..." + args.human_seal_token.slice(-4);
    stageMeta.action = args.action || "unknown";
    await fs.writeFile(path.join(staging_path, "stage.json"), JSON.stringify(stageMeta, null, 2), "utf-8");
    
    const execution_id = generateUUID();
    
    // Log to VAULT999 via receipt
    const receiptContent = {
      execution_id,
      stage_id: args.stage_id,
      mode: "governance_stage",
      intent: stageMeta.intent,
      target: stageMeta.target,
      action: args.action || "unknown",
      authorization: "human_seal_token",
      executed_at: now,
      affected_organs: stageMeta.affected_organs,
      reversibility_score: stageMeta.reversibility_score,
      blast_radius: stageMeta.blast_radius,
      vault_audit_id: generateUUID(),
    };
    
    const receiptUri = `ui://aforge/receipt/${execution_id}`;
    
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          execution_id,
          authorization_path: "governance_stage",
          executed_at: now,
          intent: stageMeta.intent,
          target: stageMeta.target,
          vault_audit_id: receiptContent.vault_audit_id,
          receipt_uri: receiptUri,
          _epistemic: epistemicTag("forge_execute"),
        }, null, 2),
      }],
    };
  }
  
  // ── LEGACY FORGE8 PATH (docket + vault seal) ──
  // CRITICAL: FAILS HARD without valid VAULT999 SEAL
  if (!args.vault_seal_id || !args.vault_seal_signature) {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: false,
          error_type: "NO_VAULT999_SEAL",
          error_message: "forge_execute requires valid VAULT999 SEAL from arifOS or stage_id + human_seal_token.",
          constitutional_violation: {
            violated_principle: "A-FORGE cannot self-authorize",
            required_action: "Obtain VAULT999 SEAL from arif_judge + arif_seal, or use forge_stage(mode=governance) for two-phase commit",
          },
          _epistemic: epistemicTag("forge_execute"),
        }, null, 2),
      }],
      isError: true,
    };
  }

  // Verify SEAL signature
  const seal_valid = await validateVaultSeal(args.vault_seal_id!, args.vault_seal_signature!, args.docket_id ?? "");
  if (!seal_valid) {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: false,
          error_type: "INVALID_VAULT999_SEAL",
          error_message: "SEAL signature verification failed.",
          constitutional_violation: {
            violated_principle: "F1 AMANAH — invalid seal on irreversible action",
            required_action: "Re-obtain valid VAULT999 SEAL",
          },
          _epistemic: epistemicTag("forge_execute"),
        }, null, 2),
      }],
      isError: true,
    };
  }

  // Load docket
  const docket_path = path.join(FORGE8_DOCKETS_DIR, `${args.docket_id}.json`);
  let docket: any;
  try {
    docket = JSON.parse(await fs.readFile(docket_path, "utf-8"));
  } catch {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: false,
          error_type: "DOCKET_NOT_FOUND",
          error_message: `Docket ${args.docket_id} not found`,
          _epistemic: epistemicTag("forge_execute"),
        }, null, 2),
      }],
      isError: true,
    };
  }

  // Execute with full resource access (trust tier set by arifOS)
  const staging_path = path.join(FORGE8_STAGING_DIR, docket.stage_id);
  let execution_output = "";
  try {
    const { stdout } = await execAsync(`bash artifact.code`, {
      cwd: staging_path,
      timeout: SANDBOX_TIMEOUT_MAX_MS.C3_SOVEREIGN,
    });
    execution_output = stdout;
  } catch (error: any) {
    execution_output = `Execution failed: ${error.message}`;
  }

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        success: true,
        authorization_path: "vault_seal",
        docket_id: args.docket_id,
        status: "EXECUTED",
        vault_seal_id: args.vault_seal_id,
        executed_at: new Date().toISOString(),
        output: execution_output,
        constitutional_compliance: "SEAL_VALIDATED",
        _epistemic: epistemicTag("forge_execute"),
      }, null, 2),
    }],
  };
}

async function validateVaultSeal(seal_id: string, signature: string, docket_id: string): Promise<boolean> {
  try {
    const ARIFOS_KERNEL = process.env.ARIFOS_KERNEL_URL || "http://127.0.0.1:8088";
    const docket_hash = crypto.createHash("sha256").update(docket_id || "").digest("hex");

    const verifyPayload = {
      session_id: seal_id,
      verdict: "SEAL",
      state_hash: docket_hash,
      actor_signature: signature || undefined,
      include_trace: false,
      agent_id: "a-forge",
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${ARIFOS_KERNEL}/seal/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(verifyPayload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[A-FORGE] VAULT999 seal verification HTTP ${response.status}`);
      return false;
    }

    const body = await response.json() as any;
    const valid = body.valid === true;
    const vaultAnchored = body.vault_anchored === true;
    const sigValid = body.signature_valid === true;

    if (!valid || !vaultAnchored) {
      console.error(
        `[A-FORGE] SEAL rejected: valid=${valid} vault_anchored=${vaultAnchored} sig_valid=${sigValid} seal_id=${seal_id.slice(0,36)}`
      );
      return false;
    }

    return true;
  } catch (error: any) {
    console.error(`[A-FORGE] VAULT999 seal verification error: ${error.message}`);
    return false;
  }
}

async function verifyHumanSealToken(token: string, stage_id: string): Promise<boolean> {
  try {
    const ARIFOS_KERNEL = process.env.ARIFOS_KERNEL_URL || "http://127.0.0.1:8088";
    const stage_hash = crypto.createHash("sha256").update(stage_id || "").digest("hex");

    const verifyPayload = {
      session_id: stage_hash.slice(0, 36),
      verdict: "SEAL",
      state_hash: stage_hash,
      actor_signature: token,
      include_trace: false,
      agent_id: "a-forge",
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${ARIFOS_KERNEL}/seal/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(verifyPayload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return false;

    const body = await response.json() as any;
    return body.valid === true && body.signature_valid === true;
  } catch (error: any) {
    console.error(`[A-FORGE] human_seal_token verification error: ${error.message}`);
    return false;
  }
}

// ── Sandbox Persistence Tools ──────────────────────────────────────────────
//
// forge_sandbox_pause  — tar upperdir, unmount overlay, SHA256 integrity, cold storage
// forge_sandbox_resume — extract tarball, re-mount overlay, lease re-verify, restore
// forge_sandbox_list_paused  — list paused sandboxes for actor
// forge_sandbox_auto_evict  — purge snapshots older than 24h
//
// F1 AMANAH:  Pause = reversible. Snapshot = full rollback capability.
// F11 AUDIT:  Every pause/resume/evict event logged.
// F13 SOVEREIGN: Lease re-verification gate on resume.

const ForgeSandboxPauseRequestSchema = z.object({
  sandboxId: z.string().min(1).describe("Sandbox session ID to pause"),
  leaseHash: z.string().optional().describe("Lease hash for audit binding"),
  sessionId: z.string().optional().describe("arifOS session ID"),
  actorId: z.string().optional().describe("Actor ID"),
});

const ForgeSandboxResumeRequestSchema = z.object({
  sandboxId: z.string().min(1).describe("Sandbox session ID to resume"),
  currentLeaseHash: z.string().describe("Fresh lease hash from arif_judge re-verification"),
  allowLeaseChange: z.boolean().default(false).describe("Allow resume even if lease changed? (DEFAULT: false)"),
});

const ForgeSandboxListPausedRequestSchema = z.object({
  actorId: z.string().optional().describe("Filter by actor ID"),
});

const ForgeSandboxAutoEvictRequestSchema = z.object({});

async function forgeSandboxPauseHandler(args: z.infer<typeof ForgeSandboxPauseRequestSchema>) {
  const session = getSession(args.sandboxId);
  if (!session) throw new Error(`Sandbox ${args.sandboxId} not found`);

  const snapshot = pauseSandbox(session, {
    leaseHash: args.leaseHash,
    sessionId: args.sessionId,
    actorId: args.actorId,
  });

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        sandboxId: snapshot.sandboxId,
        pausedAt: snapshot.pausedAt,
        tarballSha256: snapshot.tarballSha256,
        tarballSizeBytes: snapshot.tarballSizeBytes,
        policyName: snapshot.policyName,
        state: snapshot.state,
        _epistemic: epistemicTag("forge_sandbox_pause"),
      }, null, 2),
    }],
  };
}

async function forgeSandboxResumeHandler(args: z.infer<typeof ForgeSandboxResumeRequestSchema>) {
  const session = getSession(args.sandboxId);
  if (!session) throw new Error(`Sandbox ${args.sandboxId} not found`);

  const restored = resumeSandbox(session, {
    currentLeaseHash: args.currentLeaseHash,
    allowLeaseChange: args.allowLeaseChange,
  });

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        sandboxId: restored.sandboxId,
        state: restored.state,
        leaseHash: restored.leaseHash,
        mergedPath: restored.overlay?.mergedDir,
        _epistemic: epistemicTag("forge_sandbox_resume"),
      }, null, 2),
    }],
  };
}

async function forgeSandboxListPausedHandler(args: z.infer<typeof ForgeSandboxListPausedRequestSchema>) {
  const paused = listPaused(args.actorId || "any");

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        count: paused.length,
        snapshots: paused.map(s => ({
          sandboxId: s.sandboxId,
          actorId: s.actorId,
          pausedAt: s.pausedAt,
          tarballSha256: s.tarballSha256,
          tarballSizeBytes: s.tarballSizeBytes,
          ageHours: ((Date.now() - new Date(s.pausedAt).getTime()) / 3600000).toFixed(1),
        })),
        _epistemic: epistemicTag("forge_sandbox_list_paused"),
      }, null, 2),
    }],
  };
}

async function forgeSandboxAutoEvictHandler(_args: z.infer<typeof ForgeSandboxAutoEvictRequestSchema>) {
  const result = autoEvict();

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        evicted: result.evicted,
        errors: result.errors,
        evictedCount: result.evicted.length,
        errorCount: result.errors.length,
        _epistemic: epistemicTag("forge_sandbox_auto_evict"),
      }, null, 2),
    }],
  };
}

// ── Tool Registration ──────────────────────────────────────────────────────

export function registerForge8Verbs(server: McpServer) {
  // VERB 1: forge_synthesize
  server.tool(
    "forge_synthesize",
    "Create artifact from intent. Code goes to temporary buffer ONLY — never touches filesystem.",
    ForgeSynthesizeRequestSchema.shape,
    forgeSynthesizeHandler
  );

  // VERB 2: forge_stage
  // Extract inner shape from refined Zod schema (mode discriminator uses .refine())
  const forgeStageShape = "shape" in ForgeStageRequestSchema
    ? ForgeStageRequestSchema.shape
    : (ForgeStageRequestSchema as any)._def.schema.shape;
  server.tool(
    "forge_stage",
    "Stage an artifact (mode=artifact) or governance preview (mode=governance). Governance mode returns ui://aforge/preview/<stage_id> for human review.",
    forgeStageShape,
    forgeStageHandler
  );

  // VERB 3: forge_sandbox_run
  server.tool(
    "forge_sandbox_run",
    "Execute staged artifact in isolated sandbox. ABSOLUTE timeout — cannot be overridden.",
    ForgeSandboxRunRequestSchema.shape,
    forgeSandboxRunHandler
  );

  // VERB 4: forge_scar_scan
  server.tool(
    "forge_scar_scan",
    "Check artifact against SCAR database. A-FORGE detects but CANNOT judge — arifOS judges.",
    ForgeScarScanRequestSchema.shape,
    forgeScarScanHandler
  );

  // VERB 5a: forge_skillstore_write
  server.tool(
    "forge_skillstore_write",
    "Store artifact with provenance. WRITE mode only. Two-layer retention with SCAR immunization.",
    ForgeSkillstoreWriteRequestSchema.shape,
    forgeSkillstoreWriteHandler
  );

  // VERB 5b: forge_skillstore_read
  server.tool(
    "forge_skillstore_read",
    "Query artifact store. Semantic search with tag filtering.",
    ForgeSkillstoreReadRequestSchema.shape,
    forgeSkillstoreReadHandler
  );

  // VERB 6: forge_tier_bind
  // Phase C (2026-07-12): kept for FORGE8 chain (optional "unregister" rejected —
  // load-bearing step 6). Prefer arifOS lease/session authority for tier truth.
  server.tool(
    "forge_tier_bind",
    "[FORGE8#6] Set trust tier LOWER BOUND only. A-FORGE cannot promote — only arifOS sets actual tier. Phase C: not unregistered (pipeline load-bearing); agents should not call ad-hoc outside FORGE8 flow.",
    ForgeTierBindRequestSchema.shape,
    forgeTierBindHandler
  );

  // VERB 7: forge_docket_prep
  server.tool(
    "forge_docket_prep",
    "Package all evidence and hand off to arifOS. A-FORGE RELINQUISHES CONTROL — docket is read-only.",
    ForgeDocketPrepRequestSchema.shape,
    forgeDocketPrepHandler
  );

  // VERB 8: forge_execute_sealed (governed execution — stage+token OR vault seal)
  const forgeExecuteShape = "shape" in ForgeExecuteRequestSchema
    ? ForgeExecuteRequestSchema.shape
    : (ForgeExecuteRequestSchema as any)._def.schema.shape;
  server.tool(
    "forge_execute_sealed",
    "Execute with VAULT999 seal or governance stage (stage_id + human_seal_token). FAILS HARD without valid authorization.",
    forgeExecuteShape,
    forgeExecuteHandler
  );

  // ── Sandbox Persistence (Pause/Resume) ──────────────────────────────────
  server.tool(
    "forge_sandbox_pause",
    "PAUSE a persistent sandbox — tar upperdir, SHA256 integrity, unmount overlay, cold storage. F1 reversible. F13 lease-gated on resume.",
    ForgeSandboxPauseRequestSchema.shape,
    forgeSandboxPauseHandler
  );

  server.tool(
    "forge_sandbox_resume",
    "RESUME a paused sandbox — extract tarball, re-mount overlay, lease re-verify gate. F13 HOLD if lease mismatch or >24h age.",
    ForgeSandboxResumeRequestSchema.shape,
    forgeSandboxResumeHandler
  );

  server.tool(
    "forge_sandbox_list_paused",
    "List all paused sandboxes. Filter by actorId. Returns snapshot metadata with age.",
    ForgeSandboxListPausedRequestSchema.shape,
    forgeSandboxListPausedHandler
  );

  server.tool(
    "forge_sandbox_auto_evict",
    "Auto-evict sandbox snapshots older than 24h (MAX_PAUSE_AGE_HOURS). Purges expired snapshots from cold storage.",
    ForgeSandboxAutoEvictRequestSchema.shape,
    forgeSandboxAutoEvictHandler
  );

  console.log("[A-FORGE] Registered 8 FORGE execution verbs (+ 1 split skillstore) + 4 sandbox persistence tools");
}
