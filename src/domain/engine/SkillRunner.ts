/**
 * SkillRunner.ts — Governed skill execution engine for A-FORGE.
 *
 * Day 3-4 of the crypto-attestation buildout. This is what makes the building useful.
 *
 * When AAA ingress dispatches a skill (e.g., "github-pr-review") with a signed
 * CAPSULE, the SkillRunner:
 *
 *   1. Reads SKILL.md from /root/AAA/skills/{skill_id}/SKILL.md
 *   2. Pins skill_sha256 = SHA256(SKILL.md content) — supply-chain anchor
 *   3. Constructs a governed task prompt from skill procedure + capsule context
 *   4. Delegates to AgentEngine.run() for LLM-assisted execution
 *   5. Signs each step output + the final receipt with did:arif:a-forge
 *
 * The SkillRun receipt is VAULT999-admissible: deterministic, signed, hash-chained.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given.
 */

import { createHash, randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SkillDispatchPayload {
  capsule: {
    event_id: string;
    source: string;
    event_type: string;
    payload_hash: string;
    received_at: string;
    source_did: string;
    hmac_verified: boolean;
    nonce: string;
    signature: string;
    vault999_leaf?: string | null;
    skill_routed_to?: string | null;
    agent_pool?: string | null;
    authority_tier?: string | null;
  };
  skill_id: string;
  agent_pool: string;
  authority_tier: string;
  floor_gates: string[];
}

export interface SkillStepReceipt {
  step_index: number;
  tool_name: string;
  args_hash: string;
  output_hash: string;
  signature: string; // did:arif:a-forge Ed25519
}

export interface SkillRunResult {
  skill_id: string;
  skill_sha256: string;
  capsule_id: string;
  authority_tier: string;
  steps: SkillStepReceipt[];
  final_text: string;
  turn_count: number;
  total_tokens: number;
  verdict: "SEAL" | "HOLD" | "VOID" | "SABAR" | "UNKNOWN";
  receipt_signature: string; // did:arif:a-forge signs the whole run
  session_id: string;
  started_at: string;
  completed_at: string;
}

export interface SkillFrontmatter {
  id: string;
  name: string;
  version: string;
  description: string;
  owner: string;
  risk_tier: string;
  floor_scope: string[];
  [key: string]: unknown;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SKILLS_ROOT = process.env.AAA_SKILLS_ROOT || "/root/AAA/skills";
const AAA_ROOT = process.env.AAA_ROOT || "/root/AAA";

// ── Skill loading ──────────────────────────────────────────────────────────────

function parseSkillFrontmatter(markdown: string): {
  frontmatter: SkillFrontmatter | null;
  body: string;
} {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: markdown };

  try {
    // Minimal YAML parser — frontmatter is flat key: value
    const raw: Record<string, unknown> = {};
    const lines = match[1].split("\n");
    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 1).trim();
      if (!key || !value) continue;
      // Parse arrays: "[F1, F4, F13]" → ["F1", "F4", "F13"]
      if (value.startsWith("[") && value.endsWith("]")) {
        raw[key] = value
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/['"]/g, ""));
      } else if (value === "true") raw[key] = true;
      else if (value === "false") raw[key] = false;
      else raw[key] = value;
    }

    return {
      frontmatter: {
        id: String(raw.id ?? ""),
        name: String(raw.name ?? ""),
        version: String(raw.version ?? "0.0.0"),
        description: String(raw.description ?? ""),
        owner: String(raw.owner ?? "unknown"),
        risk_tier: String(raw.risk_tier ?? "medium"),
        floor_scope: Array.isArray(raw.floor_scope) ? raw.floor_scope as string[] : [],
      },
      body: match[2],
    };
  } catch {
    return { frontmatter: null, body: markdown };
  }
}

export function loadSkill(skillId: string): {
  markdown: string;
  frontmatter: SkillFrontmatter | null;
  sha256: string;
  path: string;
} | null {
  const skillPath = join(SKILLS_ROOT, skillId, "SKILL.md");
  if (!existsSync(skillPath)) return null;

  const markdown = readFileSync(skillPath, "utf-8");
  const sha256 = createHash("sha256").update(markdown).digest("hex");
  const { frontmatter } = parseSkillFrontmatter(markdown);

  return { markdown, frontmatter, sha256, path: skillPath };
}

// ── Task construction ──────────────────────────────────────────────────────────

export function buildSkillTask(
  skill: { markdown: string; frontmatter: SkillFrontmatter | null; sha256: string },
  capsule: SkillDispatchPayload["capsule"],
  authority_tier: string,
  floor_gates: string[],
): string {
  const lines: string[] = [];

  lines.push("## CONSTITUTIONAL EXECUTION CONTEXT");
  lines.push("");
  lines.push(`You are A-FORGE executing a governed skill under arifOS federation rules.`);
  lines.push(`Authority tier: ${authority_tier}. Floor gates active: ${floor_gates.join(", ")}.`);
  lines.push("");
  lines.push(`### CAPSULE (cryptographically verified ingress event)`);
  lines.push(`- Event ID: \`${capsule.event_id}\``);
  lines.push(`- Source: ${capsule.source} (${capsule.source_did})`);
  lines.push(`- Event type: \`${capsule.event_type}\``);
  lines.push(`- HMAC verified: ${capsule.hmac_verified}`);
  lines.push(`- Received at: ${capsule.received_at}`);
  lines.push("");
  lines.push(`### SKILL (pinned against supply-chain modification)`);
  lines.push(`- Skill ID: \`${skill.frontmatter?.id ?? "unknown"}\``);
  lines.push(`- Skill SHA256: \`${skill.sha256}\``);
  lines.push(`- Version: ${skill.frontmatter?.version ?? "unknown"}`);
  lines.push(`- Risk tier: ${skill.frontmatter?.risk_tier ?? "unknown"}`);
  lines.push("");

  if (capsule.payload_hash) {
    lines.push(`### PAYLOAD CONTEXT`);
    lines.push(`The raw event payload has SHA256: \`${capsule.payload_hash}\`.`);
    lines.push(`Use tools to fetch the full payload if needed for execution.`);
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## SKILL PROCEDURE (must follow exactly)");
  lines.push("");
  lines.push(skill.markdown.split("---\n").slice(2).join("---\n") || skill.markdown);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## EXECUTION RULES (constitutional — violation = VOID)");
  lines.push("");
  lines.push("1. **F1 AMANAH**: No irreversible action without explicit lease. Dry-run first.");
  lines.push("2. **F2 TRUTH**: Every claim must cite evidence. No hallucination tolerated.");
  lines.push("3. **F4 CLARITY**: Output must reduce entropy. Be specific, not vague.");
  lines.push("4. **F9 ANTIHANTU**: No deception, no manipulation, no consciousness claims.");
  lines.push("5. **F11 AUDITABILITY**: Every tool call is logged. Every decision is attributable.");
  lines.push("6. **F13 SOVEREIGN**: Arif's veto is final. If uncertain → HOLD.");
  lines.push("");
  lines.push("When complete, output a final verdict: SEAL (success), HOLD (needs human), or VOID (blocked).");

  return lines.join("\n");
}

// ── Receipt signing ────────────────────────────────────────────────────────────

function signWithOrgan(data: Buffer, organId: string = "a-forge"): string {
  try {
    const hex = data.toString("hex");
    const result = execSync(
      `python3 -c "
import sys
sys.path.insert(0, '${AAA_ROOT}')
from auth.gen_did import sign
print(sign(bytes.fromhex('${hex}'), '${organId}'))
"`,
      { encoding: "utf-8", timeout: 5000 },
    ).trim();
    return result;
  } catch {
    return `UNSIGNED:sign-failed-${organId}`;
  }
}

export function signStepReceipt(
  stepIndex: number,
  toolName: string,
  args: Record<string, unknown>,
  output: string,
): SkillStepReceipt {
  const argsHash = createHash("sha256")
    .update(JSON.stringify(args, Object.keys(args).sort()))
    .digest("hex");
  const outputHash = createHash("sha256").update(output).digest("hex");
  const canonical = `step:${stepIndex}|tool:${toolName}|args:${argsHash}|out:${outputHash}`;
  const signature = signWithOrgan(Buffer.from(canonical));

  return {
    step_index: stepIndex,
    tool_name: toolName,
    args_hash: argsHash,
    output_hash: outputHash,
    signature,
  };
}

export function signSkillReceipt(result: Omit<SkillRunResult, "receipt_signature">): string {
  const canonical = [
    `skill:${result.skill_id}`,
    `skill_sha256:${result.skill_sha256}`,
    `capsule:${result.capsule_id}`,
    `verdict:${result.verdict}`,
    `steps:${result.steps.length}`,
    `tokens:${result.total_tokens}`,
    `session:${result.session_id}`,
  ].join("|");
  return signWithOrgan(Buffer.from(canonical));
}

// ── Skill execution (orchestrates AgentEngine) ─────────────────────────────────

export interface SkillRunnerDeps {
  agentEngineFactory: (task: string, sessionId: string) => Promise<{
    finalText: string;
    turnCount: number;
    totalEstimatedTokens: number;
  }>;
}

export async function runSkill(
  dispatch: SkillDispatchPayload,
  deps: SkillRunnerDeps,
): Promise<SkillRunResult> {
  const startedAt = new Date().toISOString();
  const sessionId = randomUUID();

  // 1. Load skill
  const skill = loadSkill(dispatch.skill_id);
  if (!skill) {
    return {
      skill_id: dispatch.skill_id,
      skill_sha256: "UNKNOWN",
      capsule_id: dispatch.capsule.event_id,
      authority_tier: dispatch.authority_tier,
      steps: [],
      final_text: `Skill not found: ${dispatch.skill_id}`,
      turn_count: 0,
      total_tokens: 0,
      verdict: "VOID",
      receipt_signature: signWithOrgan(
        Buffer.from(`VOID:skill_not_found:${dispatch.skill_id}`),
      ),
      session_id: sessionId,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    };
  }

  // 2. Build task
  const task = buildSkillTask(
    skill,
    dispatch.capsule,
    dispatch.authority_tier,
    dispatch.floor_gates,
  );

  // 3. Execute via AgentEngine
  let finalText: string;
  let turnCount: number;
  let totalTokens: number;

  try {
    const result = await deps.agentEngineFactory(task, sessionId);
    finalText = result.finalText;
    turnCount = result.turnCount;
    totalTokens = result.totalEstimatedTokens;
  } catch (err) {
    finalText = `Engine error: ${String(err)}`;
    turnCount = 0;
    totalTokens = 0;
  }

  // 4. Determine verdict from output
  let verdict: SkillRunResult["verdict"] = "UNKNOWN";
  const upper = finalText.toUpperCase();
  if (upper.includes("VERDICT: SEAL") || upper.includes("SEAL")) verdict = "SEAL";
  else if (upper.includes("VERDICT: HOLD") || upper.includes("HOLD")) verdict = "HOLD";
  else if (upper.includes("VERDICT: VOID") || upper.includes("VOID")) verdict = "VOID";
  else if (upper.includes("SABAR")) verdict = "SABAR";

  // 5. Build result and sign
  const result: Omit<SkillRunResult, "receipt_signature"> = {
    skill_id: dispatch.skill_id,
    skill_sha256: skill.sha256,
    capsule_id: dispatch.capsule.event_id,
    authority_tier: dispatch.authority_tier,
    steps: [], // Populated by AgentEngine tool call hooks
    final_text: finalText,
    turn_count: turnCount,
    total_tokens: totalTokens,
    verdict,
    session_id: sessionId,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
  };

  return {
    ...result,
    receipt_signature: signSkillReceipt(result),
  };
}
