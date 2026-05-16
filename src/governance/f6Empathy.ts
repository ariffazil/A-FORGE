/**
 * F6: Empathy / RASA Listening
 *
 * Minimal enforcement: Pattern-based harm detection.
 * This is NOT censorship — this is execution safety.
 *
 * @module governance/f6Empathy
 * @constitutional F6 EMPATHY — No harm to human dignity
 */

export type EmpathyVerdict = "PASS" | "VOID";

export interface EmpathyResult {
  verdict: EmpathyVerdict;
  reason?: string;
  evidence?: string[];
  message?: string;
}

// Destructive command patterns (NOT content censorship)
const HARM_PATTERNS: RegExp[] = [
  /rm\s+-rf\s+\//, // Root deletion
  /rm\s+-rf\s+~/, // Home deletion
  /delete\s+all\s+(?:files|data)/i,
  /drop\s+(?:database|table)s?\b/i,
  /exploit\s+(?:a\s+)?(?:vulnerability|bug|flaw|hole)/i,
  /bypass\s+(?:security|auth|authentication|permission)/i,
  /steal\s+(?:data|credentials|passwords|secrets|keys)/i,
  /inject\s+(?:sql|code|malware|xss|script)/i,
  /overwrite\s+(?:system|boot|mbr|firmware)/i,
  /format\s+(?:the\s+)?(?:root|disk|drive|filesystem|system)/i,
  /:\(\)\{ :|:& };:/, // Fork bomb
  // Data destruction patterns (F6 upgraded)
  /(?:delete|wipe|remove|truncate|drop)\s+(?:all\s+)?(?:vault999|vaul?t|records?|data|tables?|volumes?|collections?|ledgers?|seals?)/i,
  /(?:delete|wipe|remove|truncate|drop)\s+(?:all\s+)?(?:postgres|postgresql|redis|qdrant|memory|vector|docker|data)/i,
  /(?:clear|purge|erase)\s+(?:all\s+)?(?:data|database|logs?|cache|memory|state)/i,
  /(?:stop|kill|shutdown)\s+(?:all\s+)?(?:services|containers|processes|databases?)/i,
  /(?:destroy|demolish)\s+(?:all\s+)?(?:data|records|volumes?|backups?|docker)/i,
  /prune\s+(?:all\s+)?(?:volumes?|images?|containers?|networks?)/i,
  /(?:remove|delete)\s+(?:all\s+)?(?:containers|images|volumes|networks)/i,
  /(?:flush|reset)\s+(?:all\s+)?(?:database|postgres|tables?|cache|state)/i,
  // Dangerous system commands
  /(?:sudo|su|admin)\s+(?:rm|delete|drop|format|wipe|mkfs|dd)/i,
  /dd\s+(?:if|of)=.*(?:dev|zero|null)/i,
  /mkfs/i,
  /(?:rm|delete|remove)\s+-rf\s+(?:home|root|etc|usr|var|opt)/i,
  // Privilege escalation patterns
  /(?:become|get|obtain|get\s+)\s*(?:root|admin|superuser|privileges)/i,
  /make\s+me\s+(?:a\s+)?(?:root|admin|superuser)/i,
  /elevate\s+(?:to\s+)?(?:root|admin|privileges)/i,
  /sudo\s+su\b/i,
  /root\s+(?:access|shell|login)/i,
  /^su\s+$/i,
];

/**
 * Check for harmful execution patterns.
 * VOID = void the operation entirely.
 */
export function checkEmpathy(input: string): EmpathyResult {
  const normalized = input.toLowerCase();

  const triggered = HARM_PATTERNS.filter((pattern) => pattern.test(normalized));

  if (triggered.length > 0) {
    return {
      verdict: "VOID",
      reason: "HARM_PATTERN_DETECTED",
      evidence: triggered.map((p) => p.toString()),
      message:
        "VOID: Potentially harmful execution pattern detected. Operation blocked for safety.",
    };
  }

  return { verdict: "PASS" };
}

/**
 * Check tool arguments for harm (more specific than general input).
 */
export function checkToolHarm(toolName: string, args: Record<string, unknown>): EmpathyResult {
  // Convert args to searchable string
  const argString = JSON.stringify(args).toLowerCase();

  // Check for destructive patterns in tool args
  if (toolName === "run_command" || toolName === "write_file") {
    const destructivePatterns = [
      /rm\s+-rf/,
      />\s*\/dev\/null/,
      /mkfs/,
      /dd\s+if=.*of=\/dev/,
    ];

    const triggered = destructivePatterns.filter((p) => p.test(argString));
    if (triggered.length > 0) {
      return {
        verdict: "VOID",
        reason: "DESTRUCTIVE_TOOL_ARGS",
        evidence: triggered.map((p) => p.toString()),
        message: `VOID: Destructive pattern in ${toolName} arguments.`,
      };
    }
  }

  return { verdict: "PASS" };
}
