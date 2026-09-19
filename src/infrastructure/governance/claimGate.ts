/**
 * claimGate.ts — Explanatory-class gate for A-FORGE mutation/execution ingress.
 *
 * THE ONE RULE (claim_kernel):
 *   A NARRATIVE claim may be true, valuable and worth reading and still carry
 *   zero explanatory power. It may be PUBLISHED but it may never be the SOLE
 *   JUSTIFICATION for a mutation. UNCLASSIFIED fails closed.
 *
 * A-FORGE is the HANDS layer. This gate is MECHANICAL, not advisory: a governed
 * (mutation/execution) tool call whose stated justification is a NARRATIVE or
 * UNCLASSIFIED class claim is REFUSED before any handler body runs.
 *
 * SEAM CHOICE: subprocess CLI into the ONE canonical Python implementation —
 *   python3 /root/AAA/lib/claim_kernel/claim_kernel.py eligible "<text>" --declared <CLASS>
 * exit 0 = eligible, exit 1 = not eligible, stdout = JSON.
 * No TypeScript port of the classifier exists here — one implementation, no drift.
 * This mirrors the existing A-FORGE precedent for mutation authorization:
 * infrastructure/bridges/authorizeMutationBridge.ts (execFile → arifOS Python).
 *
 * FAIL-CLOSED EVERYWHERE: kernel absent, timeout, non-JSON stdout, unknown exit
 * code, or any error path resolves to eligible=false. The only way to obtain
 * eligible=true is exit code 0 AND parsed JSON {"eligible": true}.
 *
 * Policies:
 *   - Only governed action classes (not OBSERVE / SUGGEST) are gated: a read-only
 *     call mutates nothing, so there is no mutation to justify.
 *   - No stated claim at all (no justification/rationale/claim field, no declared
 *     class) => gate not applicable, existing behaviour unchanged (additive).
 *   - Any stated claim must pass. Undeclared claim => UNCLASSIFIED => refused.
 *   - FORGE_CLAIM_GATE=0 disables (operator-level, same pattern as
 *     FORGE_ACT_REQUIRE_MUTATE). Default: enforced.
 *
 * DITEMPA BUKAN DIBERI — the hands refuse, they do not advise.
 */

import { execFile } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  requiresGovernance,
  type ActionClass,
} from "../../domain/governance/actionClassifier.js";

// ── Canonical kernel ────────────────────────────────────────────────────────

export const CLAIM_KERNEL_PATH =
  process.env.CLAIM_KERNEL_PATH || "/root/AAA/lib/claim_kernel/claim_kernel.py";
export const CLAIM_KERNEL_PYTHON = process.env.CLAIM_KERNEL_PYTHON || "python3";
export const CLAIM_KERNEL_SCHEMA = "claim_kernel/v1";
export const CLAIM_KERNEL_TIMEOUT_MS = Number(process.env.CLAIM_KERNEL_TIMEOUT_MS || "5000");

const CLAIM_GATE_EVENT_DIR =
  process.env.FORGE_CLAIM_GATE_EVENT_DIR ||
  path.join(
    path.dirname(process.env.ACT_DECISION_EVENT_DIR || "/root/A-FORGE/forge_work/2026-07-17/act_decision_events"),
    "claim_gate_events",
  );

// ── Class vocabulary (mirrors claim_kernel; used for parsing/normalising only,
//    never for the verdict — the verdict is the kernel's) ───────────────────

export const CLAIM_CLASSES = [
  "MEASURED",
  "MECHANISM",
  "PATTERN",
  "NARRATIVE",
  "UNCLASSIFIED",
] as const;
export type ClaimClass = (typeof CLAIM_CLASSES)[number];

export const ACTION_ELIGIBLE_CLASSES: readonly ClaimClass[] = [
  "MEASURED",
  "MECHANISM",
  "PATTERN",
];

/** Field names an ingress caller may use to state the justification text. */
export const CLAIM_TEXT_FIELDS = ["justification", "rationale", "claim_text", "claim"] as const;
/** Field names an ingress caller may use to declare the claim class. */
export const CLAIM_CLASS_FIELDS = ["claim_class", "declared_class", "justification_class"] as const;

export function claimGateEnabled(): boolean {
  return (process.env.FORGE_CLAIM_GATE ?? "1") !== "0";
}

// ── Stated claim extraction ────────────────────────────────────────────────

export interface StatedClaim {
  text: string;
  /** Declared class, uppercased. "UNCLASSIFIED" when undeclared/unknown. */
  declared: ClaimClass;
  /** True when the caller declared a class the kernel vocabulary doesn't know. */
  declared_unknown: boolean;
  text_field: string | null;
  class_field: string | null;
}

function firstNonEmptyString(
  args: Record<string, unknown>,
  fields: readonly string[],
): { value: string; field: string } | null {
  for (const field of fields) {
    const raw = args?.[field];
    if (typeof raw === "string" && raw.trim()) return { value: raw.trim(), field };
  }
  return null;
}

/**
 * Pull the stated justification + declared class out of an ingress argument bag.
 * Returns null when the caller stated NO claim at all — nothing to judge, and
 * the gate leaves the call exactly as it was before this module existed.
 */
export function extractStatedClaim(
  args: Record<string, unknown> | null | undefined,
): StatedClaim | null {
  const bag = (args && typeof args === "object" ? args : {}) as Record<string, unknown>;
  const text = firstNonEmptyString(bag, CLAIM_TEXT_FIELDS);
  const declaredRaw = firstNonEmptyString(bag, CLAIM_CLASS_FIELDS);
  if (!text && !declaredRaw) return null;

  const upper = (declaredRaw?.value || "").toUpperCase();
  const known = (CLAIM_CLASSES as readonly string[]).includes(upper)
    ? (upper as ClaimClass)
    : "UNCLASSIFIED";

  return {
    text: text?.value ?? "",
    declared: known,
    declared_unknown: Boolean(declaredRaw && known === "UNCLASSIFIED" && upper !== "UNCLASSIFIED"),
    text_field: text?.field ?? null,
    class_field: declaredRaw?.field ?? null,
  };
}

// ── CLI seam ───────────────────────────────────────────────────────────────

export interface ClaimClassVerdict {
  claim_text?: string;
  declared?: string;
  inferred?: string;
  agree?: boolean;
  action_eligible?: boolean;
  narrative_hits?: string[];
  mechanism_hits?: string[];
  pattern_hits?: string[];
  note?: string;
  schema?: string;
}

export interface ClaimKernelVerdict {
  /** true ONLY on exit code 0 AND parsed {"eligible": true}. */
  eligible: boolean;
  reasons: string[];
  class_verdict: ClaimClassVerdict | null;
  baseline_verdict: Record<string, unknown> | null;
  schema: string;
  cli: {
    ok: boolean;
    exit_code: number | null;
    error?: string;
    duration_ms: number;
    kernel_path: string;
  };
}

function failClosed(
  error: string,
  extra: Partial<ClaimKernelVerdict> = {},
  exitCode: number | null = null,
  startedAt = Date.now(),
): ClaimKernelVerdict {
  return {
    eligible: false,
    reasons: [error],
    class_verdict: null,
    baseline_verdict: null,
    schema: CLAIM_KERNEL_SCHEMA,
    cli: {
      ok: false,
      exit_code: exitCode,
      error,
      duration_ms: Date.now() - startedAt,
      kernel_path: CLAIM_KERNEL_PATH,
    },
    ...extra,
  };
}

/**
 * Ask the canonical Python kernel whether this claim may justify an action.
 * Fail-closed on every error path. Async — execFile, no shell.
 */
export function evaluateClaimViaCli(
  text: string,
  declared: string,
  opts: { timeoutMs?: number; kernelPath?: string; python?: string } = {},
): Promise<ClaimKernelVerdict> {
  const startedAt = Date.now();
  const kernelPath = opts.kernelPath || CLAIM_KERNEL_PATH;
  const python = opts.python || CLAIM_KERNEL_PYTHON;
  const timeout = opts.timeoutMs ?? CLAIM_KERNEL_TIMEOUT_MS;

  if (!fs.existsSync(kernelPath)) {
    return Promise.resolve(
      failClosed(`CLAIM_KERNEL_ABSENT: ${kernelPath} not found — fail-closed`, {}, null, startedAt),
    );
  }

  return new Promise<ClaimKernelVerdict>((resolve) => {
    execFile(
      python,
      [kernelPath, "eligible", text, "--declared", declared],
      { timeout, maxBuffer: 512 * 1024, env: { ...process.env } },
      (err: any, stdout: string, stderr: string) => {
        const exitCode: number | null =
          err && typeof err.code === "number" ? err.code : err ? null : 0;

        // Non-zero exit code is NOT automatically final here: the kernel
        // uses exit 1 for "not eligible" WITH valid JSON on stdout. Any other
        // code (2 usage, timeout kill, ENOENT) is a hard fail-closed.
        const raw = (stdout || "").trim();
        if (exitCode !== 0 && exitCode !== 1) {
          const detail = err?.killed
            ? `CLAIM_CLI_TIMEOUT after ${timeout}ms`
            : `CLAIM_CLI_ERROR: ${err?.message || stderr || "unknown"}`;
          return resolve(failClosed(`${detail} — fail-closed`, {}, exitCode, startedAt));
        }
        if (!raw) {
          return resolve(
            failClosed(`CLAIM_CLI_EMPTY_STDOUT (exit ${exitCode}) — fail-closed`, {}, exitCode, startedAt),
          );
        }

        let parsed: any;
        try {
          parsed = JSON.parse(raw);
        } catch (parseErr: any) {
          return resolve(
            failClosed(
              `CLAIM_CLI_PARSE_ERROR: ${parseErr?.message || "invalid JSON"} — fail-closed`,
              {},
              exitCode,
              startedAt,
            ),
          );
        }

        const eligible = exitCode === 0 && parsed?.eligible === true;
        const reasons: string[] = Array.isArray(parsed?.reasons) ? parsed.reasons : [];
        if (!eligible && reasons.length === 0) {
          reasons.push(`CLAIM_KERNEL_REFUSED (exit ${exitCode}) — fail-closed`);
        }

        resolve({
          eligible,
          reasons,
          class_verdict: parsed?.class_verdict ?? null,
          baseline_verdict: parsed?.baseline_verdict ?? null,
          schema: parsed?.schema || CLAIM_KERNEL_SCHEMA,
          cli: {
            ok: true,
            exit_code: exitCode,
            duration_ms: Date.now() - startedAt,
            kernel_path: kernelPath,
          },
        });
      },
    );
  });
}

// ── Gate ───────────────────────────────────────────────────────────────────

export interface ClaimGateAllow {
  ok: true;
  skipped: boolean;
  reason?: string;
  claim?: StatedClaim;
  verdict?: ClaimKernelVerdict;
}

export interface ClaimGateRefuse {
  ok: false;
  error: "CLAIM_GATE";
  reason_code: string;
  message: string;
  claim: StatedClaim;
  verdict: ClaimKernelVerdict;
  action_class: ActionClass;
}

export type ClaimGateResult = ClaimGateAllow | ClaimGateRefuse;

function emitClaimGateEvent(event: Record<string, unknown>): void {
  try {
    fs.mkdirSync(CLAIM_GATE_EVENT_DIR, { recursive: true });
    const line = JSON.stringify({
      schema: "claim_gate_event.v1",
      trace_id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      organ: "a-forge",
      ...event,
    });
    fs.appendFileSync(path.join(CLAIM_GATE_EVENT_DIR, `${new Date().toISOString().slice(0, 10)}.jsonl`), line + "\n");
  } catch {
    // Receipt emission must never block or crash the gate.
  }
}

/**
 * Synthetic non-eligible verdict: a declared class with no justification text
 * is not a justification. Guarded here (at the hands layer) because the kernel
 * accepts a declaration over a text that carries no class signal — see the
 * CLAIM_TEXT_MISSING note in the task report.
 */
function missingTextVerdict(declared: ClaimClass): ClaimKernelVerdict {
  return {
    eligible: false,
    reasons: [
      "CLAIM_TEXT_MISSING: claim_class was declared but no justification text was supplied — " +
        "a declared class is not a justification",
    ],
    class_verdict: {
      claim_text: "",
      declared,
      inferred: "UNCLASSIFIED",
      agree: false,
      action_eligible: false,
      note: "No claim text to judge.",
      schema: CLAIM_KERNEL_SCHEMA,
    },
    baseline_verdict: null,
    schema: CLAIM_KERNEL_SCHEMA,
    cli: {
      ok: true,
      exit_code: null,
      duration_ms: 0,
      kernel_path: CLAIM_KERNEL_PATH,
      error: "CLAIM_TEXT_MISSING",
    },
  };
}

function refuse(
  toolName: string,
  actionClass: ActionClass,
  claim: StatedClaim,
  verdict: ClaimKernelVerdict,
  reasonCode: string,
): ClaimGateRefuse {
  const reasonCodes = verdict.reasons.length ? verdict.reasons : ["CLAIM_NOT_ELIGIBLE"];
  const klass = verdict.class_verdict?.inferred || claim.declared;
  const message =
    `CLAIM_GATE: tool "${toolName}" (${actionClass}) was justified by a ${claim.declared}-class ` +
    `claim — ${reasonCodes.join("; ")}. Inferred class: ${klass}. ` +
    `A NARRATIVE claim may be published but may never be the sole justification for a mutation; ` +
    `UNCLASSIFIED fails closed. ` +
    `To proceed, restate the justification as an action-eligible claim (${ACTION_ELIGIBLE_CLASSES.join(" | ")}) ` +
    `and declare it explicitly: pass "claim_class":"<CLASS>" (or "declared_class") alongside the ` +
    `"justification" text. Verify with: python3 ${CLAIM_KERNEL_PATH} eligible "<text>" --declared <CLASS>`;

  emitClaimGateEvent({
    tool: toolName,
    action_class: actionClass,
    decision: "REJECT",
    reason_code: reasonCode,
    declared: claim.declared,
    declared_unknown: claim.declared_unknown,
    text_field: claim.text_field,
    class_field: claim.class_field,
    inferred: verdict.class_verdict?.inferred ?? null,
    reasons: reasonCodes,
    cli_exit: verdict.cli.exit_code,
    cli_ok: verdict.cli.ok,
    duration_ms: verdict.cli.duration_ms,
  });

  return {
    ok: false,
    error: "CLAIM_GATE",
    reason_code: reasonCode,
    message,
    claim,
    verdict,
    action_class: actionClass,
  };
}

/**
 * The choke-point gate.
 *
 * @param toolName      MCP tool / sink name
 * @param args          raw ingress arguments (where the justification lives)
 * @param actionClass   classified action class for this call
 */
export async function gateToolClaim(
  toolName: string,
  args: Record<string, unknown> | null | undefined,
  actionClass: ActionClass,
): Promise<ClaimGateResult> {
  if (!claimGateEnabled()) {
    return { ok: true, skipped: true, reason: "DISABLED_BY_ENV:FORGE_CLAIM_GATE=0" };
  }
  if (!requiresGovernance(actionClass)) {
    // OBSERVE / SUGGEST — read-only or advisory. No mutation, no justification needed.
    return { ok: true, skipped: true, reason: `NON_GOVERNED_ACTION_CLASS:${actionClass}` };
  }

  const claim = extractStatedClaim(args);
  if (!claim) {
    // No stated claim => nothing to judge. Existing behaviour preserved.
    return { ok: true, skipped: true, reason: "NO_STATED_CLAIM" };
  }

  if (!claim.text) {
    // Declared a class without stating the claim. Fail closed.
    return refuse(
      toolName,
      actionClass,
      claim,
      missingTextVerdict(claim.declared),
      "CLAIM_TEXT_MISSING",
    );
  }

  const verdict = await evaluateClaimViaCli(claim.text, claim.declared);

  if (verdict.eligible) {
    emitClaimGateEvent({
      tool: toolName,
      action_class: actionClass,
      decision: "ALLOW",
      reason_code: "OK_CLAIM_ELIGIBLE",
      declared: claim.declared,
      inferred: verdict.class_verdict?.inferred ?? null,
      cli_exit: verdict.cli.exit_code,
      duration_ms: verdict.cli.duration_ms,
    });
    return { ok: true, skipped: false, claim, verdict };
  }

  return refuse(toolName, actionClass, claim, verdict, "CLAIM_NOT_ACTION_ELIGIBLE");
}

/** MCP-shaped refusal body (used by the core.ts dispatcher wiring). */
export function claimGateRefusalResponse(refusal: ClaimGateRefuse): {
  content: { type: "text"; text: string }[];
  isError: true;
} {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            error: "CLAIM_GATE",
            verdict: "REFUSED",
            reason_code: refusal.reason_code,
            message: refusal.message,
            action_class: refusal.action_class,
            claim: {
              declared: refusal.claim.declared,
              declared_unknown: refusal.claim.declared_unknown,
              inferred: refusal.verdict.class_verdict?.inferred ?? null,
              text_field: refusal.claim.text_field,
              class_field: refusal.claim.class_field,
            },
            reasons: refusal.verdict.reasons,
            action_eligible_classes: [...ACTION_ELIGIBLE_CLASSES],
            gate: "CLAIM_CLASS",
            kernel: refusal.verdict.schema,
            organ: "a-forge",
            _epistemic: { class: "REJECT", gate: "claim_kernel/v1" },
          },
          null,
          2,
        ),
      },
    ],
    isError: true,
  };
}

/** HTTP-shaped refusal body (used by POST /execute wiring in server.ts). */
export function claimGateHoldBody(refusal: ClaimGateRefuse): Record<string, unknown> {
  return {
    ok: false,
    error: {
      type: "governance_hold",
      message: refusal.message,
      reason_code: refusal.reason_code,
    },
    action_class: refusal.action_class,
    adat_gate: "CLAIM_CLASS",
    claim: {
      declared: refusal.claim.declared,
      inferred: refusal.verdict.class_verdict?.inferred ?? null,
    },
    reasons: refusal.verdict.reasons,
    action_eligible_classes: [...ACTION_ELIGIBLE_CLASSES],
    kernel: refusal.verdict.schema,
  };
}

// ── Health ─────────────────────────────────────────────────────────────────

export function claimGateHealth(): Record<string, unknown> {
  const present = fs.existsSync(CLAIM_KERNEL_PATH);
  return {
    gate: "CLAIM_CLASS",
    enabled: claimGateEnabled(),
    kernel_path: CLAIM_KERNEL_PATH,
    kernel_present: present,
    python: CLAIM_KERNEL_PYTHON,
    timeout_ms: CLAIM_KERNEL_TIMEOUT_MS,
    action_eligible_classes: [...ACTION_ELIGIBLE_CLASSES],
    claim_classes: [...CLAIM_CLASSES],
    fail_closed: true,
    event_dir: CLAIM_GATE_EVENT_DIR,
  };
}
