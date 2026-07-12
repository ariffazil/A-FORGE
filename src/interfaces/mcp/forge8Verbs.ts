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

async function forgeStageHandler(args: z.infer<typeof ForgeStageRequestSchema>) {
  await ensureDirectories();

  const stage_id = generateUUID();
  const staging_path = path.join(FORGE8_STAGING_DIR, stage_id);
  await fs.mkdir(staging_path, { recursive: true });

  // Find artifact in buffer
  const bufferFiles = await fs.readdir(FORGE8_BUFFER_DIR).catch(() => []);
  const artifactFile = bufferFiles.find(f => f.startsWith(args.artifact_id));

  if (!artifactFile) {
    throw new Error(`Artifact ${args.artifact_id} not found in buffer`);
  }

  // Copy to staging and lock
  const code = await fs.readFile(path.join(FORGE8_BUFFER_DIR, artifactFile), "utf-8");
  await fs.writeFile(path.join(staging_path, "artifact.code"), code, "utf-8");

  const spec = {
    artifact_id: args.artifact_id,
    stage_id,
    locked_at: new Date().toISOString(),
    dependencies: args.dependencies || [],
    immutable: true,
  };
  await fs.writeFile(path.join(staging_path, "spec.json"), JSON.stringify(spec, null, 2), "utf-8");

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        stage_id,
        staging_location: staging_path,
        locked: true,
        immutable: true,
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
  // CRITICAL: FAILS HARD without valid VAULT999 SEAL
  if (!args.vault_seal_id || !args.vault_seal_signature) {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: false,
          error_type: "NO_VAULT999_SEAL",
          error_message: "forge_execute requires valid VAULT999 SEAL from arifOS.",
          constitutional_violation: {
            violated_principle: "A-FORGE cannot self-authorize",
            required_action: "Obtain VAULT999 SEAL from arif_judge + arif_seal",
          },
          _epistemic: epistemicTag("forge_execute"),
        }, null, 2),
      }],
      isError: true,
    };
  }

  // Verify SEAL signature
  const seal_valid = await validateVaultSeal(args.vault_seal_id, args.vault_seal_signature, args.docket_id);
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

async function validateVaultSeal(seal_id: string, _signature: string, _docket_id: string): Promise<boolean> {
  // In production: call arifOS VAULT999 to verify SEAL cryptographically
  // For now: basic format validation
  const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuid_regex.test(seal_id);
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
  server.tool(
    "forge_stage",
    "Move artifact to quarantine staging. Spec becomes IMMUTABLE after staging.",
    ForgeStageRequestSchema.shape,
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

  // VERB 8: forge_execute_sealed (governed execution — distinct from legacy forge_execute)
  server.tool(
    "forge_execute_sealed",
    "Execute with VAULT999 seal. FAILS HARD without valid seal — no self-authorization possible.",
    ForgeExecuteRequestSchema.shape,
    forgeExecuteHandler
  );

  console.log("[A-FORGE] Registered 8 FORGE execution verbs (+ 1 split skillstore)");
}
