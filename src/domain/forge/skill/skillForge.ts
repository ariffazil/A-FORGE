/**
 * skillForge.ts — Core forge_skill logic
 *
 * APEX THEORY Epoch 34Ω — Organism Layer
 *
 * The forge loop:
 *   1. arifOS judges → SEAL
 *   2. A-FORGE asks: do I have a tool for this?
 *      ├── YES → forge_execute (existing)
 *      └── NO  → forge_skill (generate)
 *                  ├── LLM generates tool code (via TokenRouter — Phase 2)
 *                  ├── Layer 1: HARAM scan
 *                  ├── Layer 2: Decision Field G = Q·V·Ψ·Φ
 *                  ├── Layer 3: Scar Law consultation
 *                  ├── Layer 4: VAULT999 seal (if CRYSTALLIZE verdict)
 *                  ├── Register to SkillRegistry
 *                  └── Optional: execute (requires seal_verdict_id)
 *
 * Verdict vocabulary (organism-layer — arifOS SEAL/SABAR/HOLD/VOID are reserved):
 *   CRYSTALLIZE = G ≥ 0.50  (arifOS SEAL is constitutional kernel)
 *   NUCLEATE    = 0.25–0.50 (arifOS SABAR is constitutional kernel)
 *   DORMANT     = 0.10–0.25 (arifOS HOLD is constitutional kernel)
 *   WITHER      = G < 0.10  (arifOS VOID is constitutional kernel)
 */

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import { computeDecisionField } from "./decisionField.js";
import { consultScars, fingerprintIntent, sealScar } from "./scarLaw.js";
import { getSkillRegistry } from "./skillRegistry.js";
import type { ForgeSkillRequest, ForgeSkillResult, SkillManifest } from "./types.js";

const RUNTIME_DIR = "/root/A-FORGE/.runtime/skills/";
const SCAR_PATTERNS: Array<{ re: RegExp; severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; name: string }> = [
  { re: /rm\s+-rf\s+\/\s*(;|$|\||2>)/, severity: "CRITICAL", name: "rm -rf /" },
  { re: /DROP\s+DATABASE|DROP\s+TABLE/i, severity: "CRITICAL", name: "DROP DATABASE/TABLE" },
  { re: /:\(\)\s*\{\s*:\|:&\s*\;?\s*\};?\s*:/, severity: "CRITICAL", name: "Fork bomb" },
  { re: />\s*\/dev\/(sda|sdb|nvme|mmc)/, severity: "CRITICAL", name: "Direct block device write" },
  { re: /mkfs\.\w+/, severity: "HIGH", name: "Filesystem creation" },
  { re: /dd\s+if=/, severity: "HIGH", name: "dd destructive" },
  { re: /chmod\s+777/, severity: "MEDIUM", name: "World-writable file" },
  { re: /eval\s*\(/, severity: "HIGH", name: "eval() usage" },
  { re: /process\.env\./, severity: "LOW", name: "Environment variable access" },
  { re: /child_process\.exec(File)?\(/, severity: "MEDIUM", name: "Shell exec" },
];

export type LlmProviderLike = {
  generate(opts: { prompt: string; maxTokens?: number; temperature?: number }): Promise<string>;
};

/**
 * Scan implementation for HARAM patterns.
 * Returns count + names of findings.
 */
export function haramScan(implementation: string): { findings: number; names: string[]; critical: number; high: number } {
  const findings: string[] = [];
  let critical = 0;
  let high = 0;
  for (const p of SCAR_PATTERNS) {
    if (p.re.test(implementation)) {
      findings.push(p.name);
      if (p.severity === "CRITICAL") critical++;
      if (p.severity === "HIGH") high++;
    }
  }
  return { findings: findings.length, names: findings, critical, high };
}

/**
 * Create a TokenRouter LLM client (OpenAI-compatible /v1/chat/completions).
 *
 * Uses TOKENROUTER_API_KEY, TOKENROUTER_BASE_URL, TOKENROUTER_MODEL from env.
 * TokenRouter proxies to MiniMax/DeepSeek/etc. — provider-agnostic from caller POV.
 *
 * F1 AMANAH: key never logged. F13 SOVEREIGN: read-only compute.
 */
function createTokenRouterClient(): LlmProviderLike {
  const apiKey = process.env.TOKENROUTER_API_KEY;
  const baseUrl = process.env.TOKENROUTER_BASE_URL || "https://api.tokenrouter.com/v1";
  const model = process.env.TOKENROUTER_MODEL || "MiniMax-M3";

  if (!apiKey) {
    throw new Error("TOKENROUTER_API_KEY not set — forge_skill LLM generation unavailable");
  }

  return {
    async generate(opts: { prompt: string; maxTokens?: number; temperature?: number }): Promise<string> {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "user", content: opts.prompt },
          ],
          max_tokens: opts.maxTokens ?? 2000,
          temperature: opts.temperature ?? 0.2,
        }),
        signal: AbortSignal.timeout(opts.maxTokens ? opts.maxTokens * 50 : 60_000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "<unreadable>");
        throw new Error(`TokenRouter ${response.status}: ${body.slice(0, 200)}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("TokenRouter returned empty response");
      }

      return content;
    },
  };
}

/**
 * LLM code generation — produces a TypeScript tool implementation
 * matching a strict schema.
 *
 * Phase 2 P1: wired via TokenRouter (TOKENROUTER_API_KEY/URL/MODEL env vars).
 * TokenRouter proxies to MiniMax/DeepSeek — provider-agnostic.
 * Falls back to TEMPLATE scaffold on any LLM failure (graceful degradation).
 */
async function generateToolCode(req: ForgeSkillRequest): Promise<{
  tool_name: string;
  description: string;
  input_schema: string;
  implementation: string;
  llm_used: boolean;
}> {
  const prompt = `You are forge_skill, the constitutional meta-tool of A-FORGE.

Generate a TypeScript MCP tool for the following intent.

INTENT: ${req.intent}
DOMAIN: ${req.domain}
${req.target_tool_name ? `SUGGESTED NAME: ${req.target_tool_name}` : ""}

CONSTRAINTS (constitutional — must respect):
- Tool name MUST start with "forge_"
- Pure computation only — no filesystem mutation, no network calls outside MCP, no shell exec
- Read-only or computation tools only (Phase 1)
- HARAM patterns FORBIDDEN: rm -rf /, DROP DATABASE, fork bombs, /dev/sdX writes, eval(), mkfs, dd if=, chmod 777
- Must export an async function: async (args) => Promise<{ content: Array<{ type: "text", text: string }> }>
- Input must be a JSON-serializable object
- Output must include _epistemic envelope

Return ONLY valid JSON in this exact shape:
{
  "tool_name": "forge_xxx",
  "description": "one-line description",
  "input_schema": "{ zod schema as TypeScript source }",
  "implementation": "async function implementation as TypeScript source"
}

Do NOT include markdown. Do NOT include explanations. ONLY the JSON.`;

  // Phase 2 P1: TokenRouter LLM call with graceful degradation
  try {
    const llm = createTokenRouterClient();
    const raw = await llm.generate({ prompt, maxTokens: 2000, temperature: 0.2 });

    // Strip markdown fences if the model ignored our instruction
    const jsonStr = raw
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/, "")
      .trim();

    const parsed = JSON.parse(jsonStr) as {
      tool_name?: string;
      description?: string;
      input_schema?: string;
      implementation?: string;
    };

    const tool_name = parsed.tool_name ?? req.target_tool_name ?? "forge_generated";
    const description = parsed.description ?? `[LLM] ${req.intent}`;
    const input_schema = parsed.input_schema ?? "z.object({}).strict()";
    const implementation = parsed.implementation
      ?? `async () => ({ content: [{ type: "text", text: JSON.stringify({ status: "LLM_EMPTY", intent: ${JSON.stringify(req.intent)} }) }] })`;

    return { tool_name, description, input_schema, implementation, llm_used: true };
  } catch (err) {
    // F7 HUMILITY: LLM failure → graceful degradation to template scaffold.
    // Scar will be sealed by caller if verdict falls below threshold.
    console.warn(`[forge_skill] TokenRouter generation failed, using template: ${(err as Error).message}`);
    return {
      tool_name: req.target_tool_name ?? "forge_generated",
      description: `[TEMPLATE-FALLBACK] ${req.intent}`,
      input_schema: "z.object({}).strict()",
      implementation: `async () => ({ content: [{ type: "text", text: JSON.stringify({ status: "TEMPLATE_NO_LLM", intent: ${JSON.stringify(req.intent)} }) }] })`,
      llm_used: false,
    };
  }
}

/**
 * Main forge entry point.
 */
export async function forgeSkill(
  req: ForgeSkillRequest,
): Promise<ForgeSkillResult> {
  // Step 0: Irreversible domain gate — F13 SOVEREIGN
  const irreversibleDomains = ["arifos"];
  if (irreversibleDomains.includes(req.domain) && !req.seal_verdict_id) {
    return {
      status: "DORMANT",
      decision_field: { Q: 0, V: 0, Psi: 0, Phi: 0, G: 0, verdict: "DORMANT", rationale: [] },
      scars_consulted: 0,
      haram_findings: 0,
      llm_used: false,
      message: `F13 SOVEREIGN: domain '${req.domain}' requires seal_verdict_id from arifOS`,
    };
  }

  // Step 1: Consult Scar Law — what failures should constrain this generation?
  const scars = await consultScars(req.intent, req.domain);

  // Step 2: LLM generation (TokenRouter — Phase 2 P1 wired)
  // Graceful degradation: falls back to template scaffold on LLM failure.
  let tool_name: string;
  let description: string;
  let input_schema: string;
  let implementation: string;
  let llm_used = false;

  try {
    const generated = await generateToolCode(req);
    tool_name = generated.tool_name;
    description = generated.description;
    input_schema = generated.input_schema;
    implementation = generated.implementation;
    llm_used = generated.llm_used;
  } catch (err) {
    // generateToolCode already degrades gracefully internally, but catch any
    // unexpected failure (e.g., JSON parse of unexpected shape)
    await sealScar({
      intent: req.intent,
      domain: req.domain,
      failure_mode: `LLM generation crashed: ${(err as Error).message}`,
      severity: "MEDIUM",
    });
    tool_name = req.target_tool_name ?? "forge_generated";
    description = `[CRASH-FALLBACK] ${req.intent}`;
    input_schema = "z.object({}).strict()";
    implementation = `async () => ({ content: [{ type: "text", text: JSON.stringify({ status: "CRASH_FALLBACK", intent: ${JSON.stringify(req.intent)} }) }] })`;
  }

  // Step 3: HARAM scan
  const scan = haramScan(implementation);

  // Step 4: Decision Field
  const field = computeDecisionField({
    intent: req.intent,
    domain: req.domain,
    targetToolName: tool_name,
    haramFindings: scan.findings,
    implementation,
    scars,
  });

  // Step 5: Verdict routing (organism-layer vocabulary — arifOS SEAL/SABAR/HOLD/VOID reserved)
  if (field.verdict === "WITHER") {
    // Seal scar — this failure pattern must not repeat
    await sealScar({
      intent: req.intent,
      domain: req.domain,
      failure_mode: `WITHER verdict: ${field.rationale.slice(0, 3).join("; ").slice(0, 200)}`,
      severity: "HIGH",
    });
    return {
      status: "WITHER",
      tool_name,
      decision_field: field,
      scars_consulted: scars.length,
      haram_findings: scan.findings,
      llm_used,
      message: `WITHER: ${field.rationale[field.rationale.length - 1] ?? "insufficient energy"}`,
    };
  }

  if (field.verdict === "DORMANT") {
    return {
      status: "DORMANT",
      tool_name,
      decision_field: field,
      scars_consulted: scars.length,
      haram_findings: scan.findings,
      llm_used,
      message: `DORMANT: ${field.rationale[field.rationale.length - 1] ?? "defer"}`,
    };
  }

  // Step 6: For SEAL/SABAR — register to SkillRegistry
  const registry = getSkillRegistry();
  const fingerprint = crypto
    .createHash("sha256")
    .update(fingerprintIntent(req.intent, req.domain) + "::" + implementation.trim())
    .digest("hex")
    .slice(0, 16);

  const now = Date.now();
  const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString(); // 24h

  const manifest: SkillManifest = {
    tool_name,
    description,
    domain: req.domain,
    input_schema,
    implementation,
    haram_findings: scan.findings,
    haram_passed: scan.findings === 0,
    decision_field: field,
    scar_pressure_applied: scars.reduce((s, x) => s + x.scar_pressure, 0),
    fingerprint,
    llm_used,
    created_at: new Date(now).toISOString(),
    expires_at: expiresAt,
    created_by: req.actor_id,
    status: field.verdict === "CRYSTALLIZE" ? "REGISTERED" : "PENDING_REVIEW",
    execution_count: 0,
  };

  const reg = await registry.register(manifest);
  if (!reg.accepted) {
    return {
      status: "DORMANT",
      tool_name,
      decision_field: field,
      scars_consulted: scars.length,
      haram_findings: scan.findings,
      llm_used,
      message: `Registration refused: ${reg.reason}`,
    };
  }

  // Step 7: VAULT999 seal — required for Phase 1
  let vaultSealId: string | undefined;
  try {
    vaultSealId = await sealToVault(manifest, field, req);
  } catch (err) {
    // Seal failure → revoke registration
    await registry.revoke(tool_name);
    return {
      status: "DORMANT",
      tool_name,
      decision_field: field,
      scars_consulted: scars.length,
      haram_findings: scan.findings,
      llm_used,
      message: `VAULT999 seal failed: ${(err as Error).message}. Registration revoked.`,
    };
  }

  manifest.vault_seal_id = vaultSealId;
  await registry.update(manifest);

  return {
    status: field.verdict === "CRYSTALLIZE" ? "CRYSTALLIZE" : "NUCLEATE",
    tool_name,
    fingerprint,
    decision_field: field,
    scars_consulted: scars.length,
    haram_findings: scan.findings,
    llm_used,
    vault_seal_id: vaultSealId,
    expires_at: expiresAt,
    message: `${field.verdict}: ${tool_name} forged. Fingerprint=${fingerprint}. Expires=${expiresAt}.`,
  };
}

/**
 * Seal the generated tool to VAULT999.
 * Phase 1: write a record file in .runtime/vault/seals/
 * Phase 2: use proper VAULT999 client.
 */
async function sealToVault(
  manifest: SkillManifest,
  field: import("./types.js").DecisionField,
  req: ForgeSkillRequest,
): Promise<string> {
  const SEAL_DIR = "/root/A-FORGE/.runtime/vault/seals/";
  await fs.mkdir(SEAL_DIR, { recursive: true });
  const sealId = `seal_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const sealPath = `${SEAL_DIR}${sealId}.json`;
  const sealRecord = {
    seal_id: sealId,
    sealed_at: new Date().toISOString(),
    actor_id: req.actor_id,
    seal_verdict_id: req.seal_verdict_id,
    tool_name: manifest.tool_name,
    fingerprint: manifest.fingerprint,
    domain: manifest.domain,
    decision_field: field,
    haram_findings: manifest.haram_findings,
    llm_used: manifest.llm_used,
    scar_pressure_applied: manifest.scar_pressure_applied,
    expires_at: manifest.expires_at,
    schema_version: "1.1.0",
  };
  await fs.writeFile(sealPath, JSON.stringify(sealRecord, null, 2));
  return sealId;
}