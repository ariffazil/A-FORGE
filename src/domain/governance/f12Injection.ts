/**
 * F12 INJECTION — Prompt/tool/parameter injection floor.
 *
 * "Detect command injection, path traversal, secret access, prompt
 *  injection, authority smuggling, and self-authorization attempts."
 *
 * Verdict semantics:
 * - SEAL: clean
 * - HOLD: suspicious but bounded
 * - VOID: likely injection / secret exfiltration / authority smuggling
 *
 * Plan: PLAN-2026-06-06-C1-F13EnforcementLayer
 * @constitutional F12 INJECTION — refuse poisoned input
 */

import { F12_THREAT_PATTERNS } from "../types/action-request.js";
import type { FloorContext } from "../types/action-request.js";
import type { FloorReason } from "./floor-types.js";

/** Sensitive file paths that should never be touched. */
const SENSITIVE_PATHS = [
  "/etc/passwd", "/etc/shadow", "/etc/sudoers", "/etc/ssh/",
  "/root/.ssh/", "/root/.gnupg/", "/root/.aws/",
  "/var/log/auth.log", "/proc/", "/sys/",
];

/** Concatenate all string-typed fields of the action for inspection. */
function flattenForScan(a: FloorContext["action"]): string {
  const parts: string[] = [
    a.tool_name,
    a.target,
    a.intent,
    a.expected_outcome,
    a.rollback_plan ?? "",
    a.actor,
    a.session_id,
  ];
  if (a.args) {
    for (const v of Object.values(a.args)) {
      if (typeof v === "string") parts.push(v);
    }
  }
  return parts.join(" ");
}

/**
 * F12 verdict on a single action.
 */
export function checkF12Injection(ctx: FloorContext): FloorReason[] {
  const reasons: FloorReason[] = [];
  const a = ctx.action;
  const haystack = flattenForScan(a);

  // Rule 1: Shell metacharacters in tool args (high suspicion)
  if (a.args) {
    for (const [k, v] of Object.entries(a.args)) {
      if (typeof v === "string" && F12_THREAT_PATTERNS.SHELL_METACHARS.test(v)) {
        // Allow some benign uses of `*` `?` `[]` in patterns
        const benign = /^[\w\-./?*[\]]+$/.test(v);
        if (!benign) {
          reasons.push({
            floor: "F12",
            code: "SHELL_METACHARS",
            message: `F12 INJECTION: arg '${k}' contains shell metacharacters`,
            severity: "VOID",
          });
        }
      }
    }
  }

  // Rule 2: Path traversal
  if (F12_THREAT_PATTERNS.PATH_TRAVERSAL.test(haystack)) {
    reasons.push({
      floor: "F12",
      code: "PATH_TRAVERSAL",
      message: "F12 INJECTION: path traversal pattern (../ or ..\\) detected",
      severity: "VOID",
    });
  }

  // Rule 3: Absolute sensitive paths
  for (const p of SENSITIVE_PATHS) {
    if (a.target.startsWith(p) || haystack.includes(p)) {
      reasons.push({
        floor: "F12",
        code: "SENSITIVE_PATH",
        message: `F12 INJECTION: target references sensitive path '${p}'`,
        severity: "VOID",
      });
    }
  }
  if (F12_THREAT_PATTERNS.ABSOLUTE_SENSITIVE.test(a.target)) {
    reasons.push({
      floor: "F12",
      code: "ABSOLUTE_SENSITIVE_PATH",
      message: `F12 INJECTION: target='${a.target}' is in absolute sensitive path range`,
      severity: "VOID",
    });
  }

  // Rule 4: Prompt injection phrases
  for (const pattern of F12_THREAT_PATTERNS.PROMPT_INJECTION_PHRASES) {
    if (pattern.test(haystack)) {
      reasons.push({
        floor: "F12",
        code: "PROMPT_INJECTION",
        message: `F12 INJECTION: prompt injection pattern detected: ${pattern}`,
        severity: "VOID",
      });
      break;
    }
  }

  // Rule 5: Secret file access
  for (const pattern of F12_THREAT_PATTERNS.SECRET_FILE_PATTERNS) {
    if (pattern.test(a.target) || pattern.test(haystack)) {
      reasons.push({
        floor: "F12",
        code: "SECRET_ACCESS",
        message: "F12 INJECTION: tool arg targets secret/key/credential file",
        severity: "VOID",
      });
      break;
    }
  }

  // Rule 6: Authority smuggling (F13 self-authorization)
  for (const pattern of F12_THREAT_PATTERNS.AUTHORITY_SMUGGLING_PHRASES) {
    if (pattern.test(haystack)) {
      reasons.push({
        floor: "F12",
        code: "AUTHORITY_SMUGGLING",
        message: `F12 INJECTION: text attempts to self-authorize F13/sovereign: ${pattern}`,
        severity: "VOID",
      });
      break;
    }
  }

  return reasons;
}
