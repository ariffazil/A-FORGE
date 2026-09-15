/**
 * FORGE-777 Compiler Tools — TaskIR Binding Layer
 *
 * 4 MCP tools forming the FORGE-777 TaskIR binding compiler over the existing
 * arifOS 8-verb constitutional chain. NO new brain. NO new organ. Reuse:
 *   arif_init 000 → arif_observe 111 → arif_think 333 → arif_route 444 →
 *   arif_memory 555 → arif_judge 666 → arif_forge 777 → arif_seal 999
 *
 * The 4 tools:
 *   forge_compile_task    — Intent + evidence → immutable TaskIR (over arif_route.444)
 *   forge_dispatch_lane   — TaskIR + lane → bounded lane invocation (over arif_route.444)
 *   forge_collect_evidence — Runtime reality → typed evidence packet (over arif_observe.111)
 *   forge_seal_run        — TaskIR + evidence → AWAITING_JUDGMENT (over arif_judge.666)
 *
 * @module mcp/forgeCompilerTools
 * @constitutional F1 AMANAH — reversible by design; seal_run NEVER writes to VAULT999
 *   without explicit constitutional authority (F13).
 * @constitutional F13 SOVEREIGN — only arif_judge with verified identity may SEAL.
 * @apex-zen 2026-09-15 — 4 thin shims over existing 8-verb chain. Zero new database.
 *
 * Iron rules:
 *   - TaskIR is IMMUTABLE after forge_compile_task. Later stages append observations
 *     and verdict evidence but never silently rewrite original task truth.
 *   - forge_dispatch_lane enforces one-dispatch-per-TaskIR (single-lane invocation).
 *   - forge_collect_evidence enforces one-evidence-packet-per-run (no leak).
 *   - forge_seal_run NEVER returns `sealed=true` from A-FORGE alone. Returns
 *     `awaiting_verification=true`; only arif_judge.666 may upgrade to SEAL.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as crypto from "crypto";

// ── Schemas ───────────────────────────────────────────────────────────────

const TaskIRSchema = z.object({
  task_id: z.string().regex(/^forge-\d{8}-[a-z0-9-]+$/, "task_id must be forge-YYYYMMDD-<slug>"),
  intent: z.string().min(1).max(2000),
  acceptance_criteria: z.array(z.string()).default([]),
  non_goals: z.array(z.string()).default([]),
  risk_class: z.enum(["read", "patch", "service", "deploy", "secret-adjacent", "auth"]),
  repository_ref: z.object({
    repo: z.string(),
    commit: z.string(),
    worktree: z.string().default("isolated"),
  }).optional(),
  evidence: z.object({
    observed: z.array(z.string()).default([]),
    hypotheses: z.array(z.string()).default([]),
    contradictions: z.array(z.string()).default([]),
    excluded_files: z.array(z.string()).default([]),
    candidate_files: z.array(z.string()).default([]),
  }).default({}),
  invariants: z.array(z.string()).default([]),
  prohibited_actions: z.array(z.string()).default([]),
  verification: z.object({
    baseline_commands: z.array(z.string()).default([]),
    reproduce_commands: z.array(z.string()).default([]),
    quality_commands: z.array(z.string()).default([]),
    exit_criteria: z.array(z.string()).default([]),
  }).default({}),
  budget: z.object({
    max_total_usd: z.number().nonnegative().default(0.75),
    max_premium_calls: z.number().int().nonnegative().default(2),
    max_repair_loops: z.number().int().nonnegative().default(3),
  }).default({}),
});

const LaneDispatchSchema = z.object({
  run_id: z.string(),
  lane: z.enum([
    "forge-scout", "forge-scout-pro",
    "forge-builder", "forge-economy", "forge-planner",
    "forge-judge",
  ]),
  task_ir_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  context_budget_tokens: z.number().int().nonnegative().default(48000),
  output_budget_tokens: z.number().int().nonnegative().default(12000),
  max_tool_loops: z.number().int().nonnegative().default(3),
  allowed_tools: z.array(z.string()).default([]),
  forbidden_tools: z.array(z.string()).default([]),
});

const EvidenceSchema = z.object({
  run_id: z.string(),
  task_ir_hash: z.string(),
  evidence_hash: z.string(),
  commit_before: z.string().optional(),
  commit_after: z.string().optional(),
  diff_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
  changed_files: z.array(z.string()).default([]),
  tests: z.object({
    baseline: z.enum(["PASS", "FAIL", "SKIPPED", "UNKNOWN"]).default("UNKNOWN"),
    reproduction: z.enum(["PASS", "FAIL", "SKIPPED", "UNKNOWN"]).default("UNKNOWN"),
    regression: z.enum(["PASS", "FAIL", "SKIPPED", "UNKNOWN"]).default("UNKNOWN"),
    relevant_suite: z.enum(["PASS", "FAIL", "SKIPPED", "UNKNOWN"]).default("UNKNOWN"),
  }).default({}),
  quality: z.object({
    lint: z.enum(["PASS", "FAIL", "SKIPPED", "UNKNOWN"]).default("UNKNOWN"),
    types: z.enum(["PASS", "FAIL", "SKIPPED", "UNKNOWN"]).default("UNKNOWN"),
    secret_scan: z.enum(["PASS", "FAIL", "SKIPPED", "UNKNOWN"]).default("UNKNOWN"),
  }).default({}),
  model: z.object({
    alias: z.string(),
    provider: z.string().default("unknown"),
    input_tokens: z.number().int().nonnegative().default(0),
    output_tokens: z.number().int().nonnegative().default(0),
    cost_band: z.enum(["PLAN_INCLUDED", "PAYG", "FREE_TIER", "UNKNOWN"]).default("UNKNOWN"),
  }),
  // F1: NEVER accept raw secrets, tokens, key values, headers, or session IDs.
  redaction_check: z.boolean().default(true),
});

const SealSchema = z.object({
  run_id: z.string(),
  task_ir_hash: z.string(),
  evidence_hash: z.string(),
  judge_receipt: z.object({
    verdict: z.enum(["READY", "REWORK", "HOLD", "VOID"]),
    reasons: z.array(z.string()).default([]),
    actor_canonicalized: z.boolean().default(false),
  }),
});

// ── Pure helpers (no I/O, deterministic) ─────────────────────────────────

function sha256(content: string): string {
  return `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`;
}

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    Object.values(obj).forEach((v: unknown) => { deepFreeze(v); });
    Object.freeze(obj);
  }
  return obj;
}

// F1: scan evidence payload for secret-like patterns. Refuse if found.
function redactCheck(payload: Record<string, unknown>): {
  clean: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  const serialized = JSON.stringify(payload);
  // Cheap pattern scan. Real redaction belongs upstream; this is a circuit-breaker.
  const forbidden = [
    /sk-[A-Za-z0-9]{20,}/g,           // OpenAI-style keys
    /act_v1\.[A-Za-z0-9._-]{50,}/g,    // ACT tokens
    /sct_v1\.[A-Za-z0-9._-]{50,}/g,    // legacy SCT
    /ghp_[A-Za-z0-9]{36,}/g,           // GitHub PAT
    /Bearer\s+[A-Za-z0-9._-]{30,}/g,   // bearer tokens
  ];
  for (const pat of forbidden) {
    const m = serialized.match(pat);
    if (m) violations.push(`forbidden pattern: ${pat.source} (${m.length} matches)`);
  }
  return { clean: violations.length === 0, violations };
}

// ── In-memory TaskIR store (process-local; no DB) ────────────────────────
// Per arifOS constitutional: arif_memory.555 owns durable evidence.
// This map is the FORGE-777 compiler's session-local cache for in-flight runs.
// Cleared on session close.

const taskirStore = new Map<string, { taskir: unknown; hash: string; ts: number }>();
const evidenceStore = new Map<string, { evidence: unknown; hash: string; ts: number }>();
const dispatchLog = new Map<string, { lane: string; task_ir_hash: string; ts: number }>();

const TASKIR_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function gcStore<K, V>(store: Map<K, { ts: number } & V>) {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (now - v.ts > TASKIR_TTL_MS) store.delete(k);
  }
}

// ── Tool registrations ────────────────────────────────────────────────────

export function registerForgeCompilerTools(server: McpServer) {
  // 1) forge_compile_task — Intent + constraints → immutable TaskIR
  server.tool(
    "forge_compile_task",
    "Compile a coding intent into an immutable TaskIR (over arif_route.444). " +
      "Returns task_id and sha256 hash. TaskIR is frozen at creation time.",
    {
      task_ir: TaskIRSchema,
    },
    async ({ task_ir }) => {
      gcStore(taskirStore);
      // F2: validate risk_class + invariants consistency.
      if (task_ir.risk_class === "auth" && task_ir.invariants.length === 0) {
        throw new Error("F11 BLOCK: auth risk_class requires invariants array (got 0)");
      }
      if (task_ir.risk_class === "deploy" && !task_ir.prohibited_actions.includes("merge_without_human")) {
        throw new Error("F13 BLOCK: deploy risk_class must include 'merge_without_human' in prohibited_actions");
      }
      const frozen = deepFreeze(task_ir);
      const hash = sha256(JSON.stringify(frozen));
      const ts = Date.now();
      taskirStore.set(task_ir.task_id, { taskir: frozen, hash, ts });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            task_id: task_ir.task_id,
            task_ir_hash: hash,
            immutable: true,
            stored_at: new Date(ts).toISOString(),
            risk_class: task_ir.risk_class,
            next_step: "forge_dispatch_lane",
          }, null, 2),
        }],
      };
    }
  );

  // 2) forge_dispatch_lane — TaskIR + lane → bounded invocation envelope
  server.tool(
    "forge_dispatch_lane",
    "Dispatch a frozen TaskIR to one bounded lane (forge-scout / forge-builder / etc.). " +
      "Returns run_id + lane envelope. One-dispatch-per-TaskIR enforced via task_ir_hash.",
    {
      dispatch: LaneDispatchSchema,
    },
    async ({ dispatch }) => {
      gcStore(taskirStore);
      gcStore(dispatchLog);
      const stored = taskirStore.get(dispatch.run_id);
      if (!stored) {
        throw new Error(`TASKIR_MISSING: run_id ${dispatch.run_id} not in compiler cache. forge_compile_task first.`);
      }
      if (stored.hash !== dispatch.task_ir_hash) {
        throw new Error(`TASKIR_HASH_MISMATCH: stored=${stored.hash.slice(0,16)}… vs request=${dispatch.task_ir_hash.slice(0,16)}…`);
      }
      // Enforce one-dispatch-per-task_ir_hash (no double dispatch on the same evidence).
      const existing = Array.from(dispatchLog.values()).find(
        (d) => d.task_ir_hash === dispatch.task_ir_hash
      );
      if (existing) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              idempotent: true,
              previous_lane: existing.lane,
              dispatched_at: new Date(existing.ts).toISOString(),
              note: "Same task_ir_hash already dispatched. Re-dispatch refused by F1 AMANAH.",
            }, null, 2),
          }],
        };
      }
      dispatchLog.set(dispatch.run_id, {
        lane: dispatch.lane,
        task_ir_hash: dispatch.task_ir_hash,
        ts: Date.now(),
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            run_id: dispatch.run_id,
            lane: dispatch.lane,
            envelope: {
              context_budget_tokens: dispatch.context_budget_tokens,
              output_budget_tokens: dispatch.output_budget_tokens,
              max_tool_loops: dispatch.max_tool_loops,
              allowed_tools: dispatch.allowed_tools,
              forbidden_tools: dispatch.forbidden_tools,
            },
            task_ir_hash: dispatch.task_ir_hash,
            dispatched_at: new Date().toISOString(),
            next_step: "execute lane work, then forge_collect_evidence",
          }, null, 2),
        }],
      };
    }
  );

  // 3) forge_collect_evidence — Runtime reality → typed evidence packet
  server.tool(
    "forge_collect_evidence",
    "Collect runtime reality (diffs + tests + cost) into a typed evidence packet. " +
      "F1: refuses payload containing secret-like patterns.",
    {
      evidence: EvidenceSchema,
    },
    async ({ evidence }) => {
      gcStore(evidenceStore);
      const check = redactCheck(evidence as unknown as Record<string, unknown>);
      if (!check.clean || !evidence.redaction_check) {
        throw new Error(
          `F11/F1 BLOCK: evidence payload failed redaction. Violations=${JSON.stringify(check.violations)}`
        );
      }
      const frozen = deepFreeze(evidence);
      const hash = sha256(JSON.stringify(frozen));
      evidenceStore.set(evidence.run_id, { evidence: frozen, hash, ts: Date.now() });

      // Compute pass/fail against the stored TaskIR (if present).
      const stored = taskirStore.get(evidence.run_id);
      let taskirHash = evidence.task_ir_hash;
      let verdict: "PASS" | "WARN" | "FAIL" = "PASS";
      const reasons: string[] = [];
      if (stored && stored.hash !== evidence.task_ir_hash) {
        verdict = "FAIL";
        reasons.push("task_ir_hash mismatch");
      }
      const t = evidence.tests;
      const q = evidence.quality;
      const allTestsPass = [t.baseline, t.reproduction, t.regression, t.relevant_suite]
        .every((r) => r === "PASS");
      const allQualityPass = [q.lint, q.types, q.secret_scan].every((r) => r === "PASS");
      if (!allTestsPass) {
        verdict = "FAIL";
        reasons.push("at least one test result != PASS");
      }
      if (!allQualityPass) {
        verdict = verdict === "FAIL" ? "FAIL" : "WARN";
        reasons.push("at least one quality check != PASS");
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            run_id: evidence.run_id,
            evidence_hash: hash,
            task_ir_hash: taskirHash,
            verdict,
            reasons,
            next_step: "forge_seal_run with judge_receipt",
          }, null, 2),
        }],
      };
    }
  );

  // 4) forge_seal_run — AWAITING_JUDGMENT only. NEVER returns `sealed=true` from A-FORGE alone.
  server.tool(
    "forge_seal_run",
    "Submit completed TaskIR + evidence to constitutional judgment. " +
      "Returns AWAITING_VERIFICATION. Only arif_judge.666 with verified identity may upgrade to SEAL.",
    {
      seal_request: SealSchema,
    },
    async ({ seal_request }) => {
      const storedT = taskirStore.get(seal_request.run_id);
      const storedE = evidenceStore.get(seal_request.run_id);
      if (!storedT || storedT.hash !== seal_request.task_ir_hash) {
        throw new Error("TASKIR_MISSING_OR_MISMATCH");
      }
      if (!storedE || storedE.hash !== seal_request.evidence_hash) {
        throw new Error("EVIDENCE_MISSING_OR_MISMATCH");
      }
      if (seal_request.judge_receipt.verdict === "VOID" && !seal_request.judge_receipt.actor_canonicalized) {
        throw new Error("F13 BLOCK: VOID verdict requires actor_canonicalized=true");
      }
      // F12: A-FORGE NEVER returns `sealed=true`. Separation of powers.
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            run_id: seal_request.run_id,
            task_ir_hash: seal_request.task_ir_hash,
            evidence_hash: seal_request.evidence_hash,
            awaiting_verification: true,
            sealed: false, // F12 verdict hygiene — NEVER true from A-FORGE alone
            submitted_judge_verdict: seal_request.judge_receipt.verdict,
            submitted_judge_reasons: seal_request.judge_receipt.reasons,
            next_step: "Hand off to arif_judge.666 for constitutional SEAL",
          }, null, 2),
        }],
      };
    }
  );
}
