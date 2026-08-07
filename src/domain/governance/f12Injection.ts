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
    // P1.3: Skip SCT/capability tokens from F12 scan. These are kernel-minted
    // session tokens (sct_v1.*) that legitimately contain fields like "kid"
    // and "token" which otherwise trigger false-positive SECRET_ACCESS alerts.
    const skipKeys = new Set(["session_token", "sct", "arifos_sct"]);
    for (const [k, v] of Object.entries(a.args)) {
      if (typeof v === "string" && !skipKeys.has(k)) parts.push(v);
    }
  }
  return parts.join(" ");
}

/**
 * Tools that legitimately accept code or structured strings containing
 * shell metacharacters (braces, parens, etc.). These tools are governed
 * by additional layers (HARAM scan, Decision Field, Scar Law, Witness)
 * and their code inputs are sanitized at their own enforcement boundaries.
 *
 * Without this allowlist, F12 blocks legitimate governance tools from
 * receiving implementation code as arguments.
 */
const CODE_ACCEPTING_TOOLS = new Set([
  "forge_skill",
  "forge_evaluate",
  "forge_witness",
  "forge_scar",
  "forge_register",
  "forge_registry",
  "forge_shell_dryrun",
  "forge_vault",
  // Governance bridge tools: forge_session_init and forge_kernel proxy
  // session tokens and kernel arguments through arifOS — they have their
  // own governance layers (ACT gate, kernel auth, lease enforcement).
  // F12 SHELL_METACHARS is a false positive on their structured payloads.
  "forge_session_init",
  "forge_kernel",
  // Filesystem content legitimately contains backticks, braces, and
  // structured text (markdown, JSON, code). forge_filesystem has its
  // own path scoping via checkPathAllowed — F12 SHELL_METACHARS is
  // a false positive on content payloads.
  "forge_filesystem",
  "forge_filesystem_read",
  "forge_filesystem_write",
  "forge_filesystem_patch",
  "forge_filesystem_tree",
  "forge_filesystem_search",
  "forge_filesystem_stat",
  "forge_filesystem_move",
  "forge_filesystem_delete",
  "forge_document_ingest",
]);

/**
 * F12 verdict on a single action.
 */
export function checkF12Injection(ctx: FloorContext): FloorReason[] {
  const reasons: FloorReason[] = [];
  const a = ctx.action;

  // Code-accepting tools skip shell metacharacter check — they have their
  // own governance layers (HARAM scan, Decision Field, etc.)
  const isCodeAccepter = CODE_ACCEPTING_TOOLS.has(a.tool_name);

  const haystack = flattenForScan(a);

  // Rule 1: Shell metacharacters in tool args (high suspicion)
  if (a.args && !isCodeAccepter) {
    for (const [k, v] of Object.entries(a.args)) {
      if (typeof v === "string" && F12_THREAT_PATTERNS.SHELL_METACHARS.test(v)) {
        // DARWIN FIX 4: JSON-aware benign pattern. Extends to allow JSON
        // structural characters ({ } " , : \n \r \t space) plus standard
        // filename + URL chars. Without this, every forge_vault.write /
        // forge_filesystem.write payload containing JSON braces gets
        // F12 VOID'd even though no injection risk exists — pure cost.
        const benign = /^[\w\-./?*[\]{}"',:;_+=()@%&#!?\s\n\r\t]+$/.test(v);
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
  // EXCEPTION: forge_filesystem, forge_git, forge_postgres, forge_docker,
  // forge_github, forge_memory, forge_document_ingest are authorized
  // proxies with their own path scoping (checkPathAllowed).
  // They operate on /root, /tmp, /data which are valid work directories.
  const AUTHORIZED_PROXY_TOOLS = new Set([
    "forge_filesystem",
    "forge_filesystem_read",
    "forge_filesystem_write",
    "forge_filesystem_patch",
    "forge_filesystem_tree",
    "forge_filesystem_search",
    "forge_filesystem_stat",
    "forge_filesystem_move",
    "forge_filesystem_delete",
    "forge_git",
    "forge_postgres",
    "forge_docker",
    "forge_github",
    "forge_memory",
    "forge_document_ingest",
  ]);
  const isAuthorizedProxy = AUTHORIZED_PROXY_TOOLS.has(a.tool_name);
  if (!isAuthorizedProxy) {
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
  // P1.3: For code-accepting tools (forge_vault, forge_filesystem, etc.),
  // only check the action target (file paths), not the content payload.
  // These tools legitimately carry structured content containing words like
  // "token", "key", "password" that trigger false-positive SECRET_ACCESS.
  const haystackForSecretCheck = isCodeAccepter ? a.target : haystack;
  for (const pattern of F12_THREAT_PATTERNS.SECRET_FILE_PATTERNS) {
    if (pattern.test(a.target) || pattern.test(haystackForSecretCheck)) {
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

  // Rule 7: Browser page-originated actions (two-context defense).
  // Page content is never authority; agent task instructions are authority.
  const rawTaskContext = ctx.action.metadata?.task_context;
  const rawPageContext = ctx.action.metadata?.page_context;
  if (
    ctx.action.tool_name.startsWith("forge_browser_") &&
    rawPageContext &&
    typeof rawPageContext === "object"
  ) {
    const pageSnippet = (rawPageContext as Record<string, unknown>).snippet;
    if (!rawTaskContext) {
      reasons.push({
        floor: "F12",
        code: "PAGE_ORIGINATED_ACTION",
        message: "F12 INJECTION: browser action driven by page content without agent task authority",
        severity: "HOLD",
      });
    } else if (
      typeof pageSnippet === "string" &&
      pageSnippet.length >= 12 &&
      haystack.toLowerCase().includes(pageSnippet.toLowerCase())
    ) {
      const taskText = rawTaskContext && typeof rawTaskContext === "object"
        ? [
            (rawTaskContext as Record<string, unknown>).task ?? "",
            (rawTaskContext as Record<string, unknown>).expected_outcome ?? "",
          ].join(" ").toLowerCase()
        : "";
      if (!taskText.includes(pageSnippet.toLowerCase())) {
        reasons.push({
          floor: "F12",
          code: "PAGE_ORIGINATED_ACTION",
          message: "F12 INJECTION: browser action reproduces page content not authorized by task",
          severity: "VOID",
        });
      }
    }
  }

  return reasons;
}
