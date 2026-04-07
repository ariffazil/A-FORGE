/**
 * F6: Harm / Dignity (EMPATHY — RASA Listening)
 *
 * Minimal enforcement: Pattern-based harm detection.
 * This is NOT censorship — this is execution safety.
 *
 * @module governance/f6HarmDignity
 * @constitutional F6 EMPATHY — No harm to human dignity
 */

export type HarmVerdict = "PASS" | "VOID";

export interface HarmResult {
  verdict: HarmVerdict;
  reason?: string;
  evidence?: string[];
  message?: string;
}

// Destructive command patterns (NOT content censorship)
const HARM_PATTERNS: RegExp[] = [
  /rm\s+-rf\s+\//, // Root deletion
  /rm\s+-rf\s+~/, // Home deletion
  /delete\s+all\s+(?:files|data)/i,
  /drop\s+(?:database|table)/i,
  /exploit\s+(?:vulnerability|bug)/i,
  /bypass\s+(?:security|auth|authentication)/i,
  /steal\s+(?:data|credentials|passwords)/i,
  /inject\s+(?:sql|code|malware)/i,
  /overwrite\s+(?:system|boot)/i,
  /format\s+(?:disk|drive)/i,
  /:(){ :|:& };:/, // Fork bomb
];

/**
 * Check for harmful execution patterns.
 * VOID = void the operation entirely.
 */
export function checkHarmDignity(input: string): HarmResult {
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
export function checkToolHarm(toolName: string, args: Record<string, unknown>): HarmResult {
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
