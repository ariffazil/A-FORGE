/**
 * F6: Empathy / RASA Listening
 *
 * Enforces F6 EMPATHY with two layers:
 *   1. Pattern-based harm detection (destructive commands, data loss)
 *   2. κᵣ (kappa-r) stakeholder impact scoring — matches arifOS F6_Empathy
 *
 * κᵣ thresholds (from core/shared/physics.py):
 *   - κᵣ ≥ 0.10 for operational/tool actions (OPS)
 *   - κᵣ ≥ 0.70 for human-facing outputs (HUMAN)
 *   - κᵣ < 0.10 → VOID (unacceptable harm to weakest stakeholder)
 *
 * This is NOT censorship — this is constitutional execution safety.
 *
 * @module governance/f6Empathy
 * @constitutional F6 EMPATHY — Protect weakest stakeholder
 */

export type EmpathyVerdict = "PASS" | "CAUTION" | "HOLD" | "VOID";

export interface EmpathyResult {
  verdict: EmpathyVerdict;
  reason?: string;
  evidence?: string[];
  message?: string;
  kappa_r?: number;
  stakeholder_context?: string;
}

// ─── κᵣ (Kappa-R) Constants ─────────────────────────────────

/** Minimum κᵣ for operational/tool actions (OPS). */
const KAPPA_R_OPS_MIN = 0.10;

/** Minimum κᵣ for human-facing outputs (HUMAN). */
const KAPPA_R_HUMAN_MIN = 0.70;

/** κᵣ below this is VOID — unacceptable harm to weakest stakeholder. */
const KAPPA_R_VOID_THRESHOLD = 0.10;

// ─── Harm pattern vocabulary ────────────────────────────────

/** Patterns that indicate direct harm to human dignity. */
const DIGNITY_HARM_PATTERNS: RegExp[] = [
  /insult|humiliate|degrade|shame|mock|ridicule/i,
  /threaten|intimidate|coerce|blackmail|extort/i,
  /discriminate|harass|stalk|dox/i,
  /defraud|scam|phish|impersonate/i,
  /exploit\s+(?:a\s+)?(?:child|minor|elderly|vulnerable)/i,
];

/** Patterns indicating stakeholder impact — triggers κᵣ scoring. */
const STAKEHOLDER_IMPACT_PATTERNS: RegExp[] = [
  /(?:affect|impact|harm|benefit)\s+(?:users?|customers?|employees?|citizens?|public|community)/i,
  /(?:privacy|consent|data\s+rights?|personal\s+(?:data|info))/i,
  /(?:accessibility|inclusion|equity|fairness|bias)/i,
  /(?:layoff|termination|suspension|ban|block)\s+(?:of|all)?\s*(?:users?|accounts?|access)/i,
  /(?:environmental|ecological|pollution|emissions?|waste)/i,
  /(?:indigenous|native|traditional|cultural\s+heritage)/i,
];

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

// ─── κᵣ (Kappa-R) Computation ────────────────────────────

/**
 * Compute κᵣ (kappa-r) — the empathy coefficient.
 *
 * κᵣ = 1.0 - (harm_score / max_harm)
 *
 * Where harm_score is additive from matched patterns:
 *   - Dignity harm patterns:     +0.40 each
 *   - Stakeholder impact patterns: +0.25 each
 *   - Destructive command patterns: +0.50 each (VOID directly)
 *   - Privilege escalation:       +0.35 each
 *
 * Returns κᵣ in [0.0, 1.0]. 1.0 = no harm detected.
 */
export function computeKappaR(
  input: string,
  toolName?: string,
  args?: Record<string, unknown>,
): number {
  const normalized = input.toLowerCase();
  let harmScore = 0.0;

  // Dignity harm — heaviest weight
  for (const p of DIGNITY_HARM_PATTERNS) {
    if (p.test(normalized)) harmScore += 0.4;
  }

  // Stakeholder impact
  for (const p of STAKEHOLDER_IMPACT_PATTERNS) {
    if (p.test(normalized)) harmScore += 0.25;
  }

  // Destructive commands
  for (const p of HARM_PATTERNS) {
    if (p.test(normalized)) harmScore += 0.5;
  }

  // Tool-specific check
  if (toolName && args) {
    const argString = JSON.stringify(args).toLowerCase();
    if (toolName === "run_command" || toolName === "write_file") {
      if (/rm\s+-rf/.test(argString)) harmScore += 0.5;
      if (/>\s*\/dev\/null/.test(argString)) harmScore += 0.3;
      if (/mkfs/.test(argString)) harmScore += 0.5;
      if (/dd\s+if=.*of=\/dev/.test(argString)) harmScore += 0.5;
    }
  }

  return Math.max(0.0, Math.min(1.0, 1.0 - harmScore));
}

/**
 * Classify context as OPS (operational/tool action) or HUMAN (human-facing output).
 */
function classifyStakeholderContext(
  input: string,
  toolName?: string,
): "OPS" | "HUMAN" {
  // Human-facing indicators
  const humanIndicators = [
    ...DIGNITY_HARM_PATTERNS,
    ...STAKEHOLDER_IMPACT_PATTERNS,
    /(?:message|email|reply|respond|communicate|notify|announce|publish|post|share)\s+(?:to|with|for)?\s*(?:user|customer|person|client|citizen|public)/i,
    /(?:write|compose|draft|send)\s+(?:message|email|letter|notification|announcement)/i,
  ];

  for (const p of humanIndicators) {
    if (p.test(input.toLowerCase())) return "HUMAN";
  }

  // OPS by default
  return "OPS";
}

/**
 * Compute κᵣ verdict from the score.
 *
 * OPS:  κᵣ ≥ 0.10 → PASS, κᵣ < 0.10 → VOID
 * HUMAN: κᵣ ≥ 0.70 → PASS, κᵣ ≥ 0.40 → CAUTION, κᵣ ≥ 0.10 → HOLD, κᵣ < 0.10 → VOID
 */
function kappaVerdict(kappaR: number, context: "OPS" | "HUMAN"): EmpathyVerdict {
  const minKappa = context === "HUMAN" ? KAPPA_R_HUMAN_MIN : KAPPA_R_OPS_MIN;

  if (kappaR >= minKappa) return "PASS";
  if (kappaR < KAPPA_R_VOID_THRESHOLD) return "VOID";
  if (context === "HUMAN") {
    if (kappaR >= 0.40) return "CAUTION";
    return "HOLD";
  }
  return "VOID"; // OPS below 0.10 = VOID
}

/**
 * Check for harmful execution patterns with κᵣ scoring.
 * VOID = void the operation entirely.
 */
export function checkEmpathy(input: string): EmpathyResult {
  const normalized = input.toLowerCase();
  const context = classifyStakeholderContext(input);
  const kappaR = computeKappaR(input);

  // Direct harm patterns still VOID immediately
  const triggered = HARM_PATTERNS.filter((pattern) => pattern.test(normalized));
  if (triggered.length > 0) {
    return {
      verdict: "VOID",
      reason: "HARM_PATTERN_DETECTED",
      evidence: triggered.map((p) => p.toString()),
      message:
        "VOID: Potentially harmful execution pattern detected. Operation blocked for safety.",
      kappa_r: kappaR,
      stakeholder_context: context,
    };
  }

  // κᵣ-based verdict
  const verdict = kappaVerdict(kappaR, context);
  if (verdict !== "PASS") {
    const minRequired = context === "HUMAN" ? KAPPA_R_HUMAN_MIN : KAPPA_R_OPS_MIN;
    return {
      verdict,
      reason: `KAPPA_R_${verdict}`,
      message: `${verdict}: κᵣ=${kappaR.toFixed(3)} below ${context} minimum ${minRequired.toFixed(2)}. Stakeholder impact detected.`,
      kappa_r: kappaR,
      stakeholder_context: context,
    };
  }

  return { verdict: "PASS", kappa_r: kappaR, stakeholder_context: context };
}

/**
 * Check tool arguments for harm with κᵣ scoring.
 */
export function checkToolHarm(toolName: string, args: Record<string, unknown>): EmpathyResult {
  const argString = JSON.stringify(args).toLowerCase();
  const context = classifyStakeholderContext(argString, toolName);
  const kappaR = computeKappaR(argString, toolName, args);

  // Destructive patterns still VOID immediately
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
        kappa_r: kappaR,
        stakeholder_context: context,
      };
    }
  }

  const verdict = kappaVerdict(kappaR, context);
  if (verdict !== "PASS") {
    const minRequired = context === "HUMAN" ? KAPPA_R_HUMAN_MIN : KAPPA_R_OPS_MIN;
    return {
      verdict,
      reason: `KAPPA_R_${verdict}`,
      message: `${verdict}: κᵣ=${kappaR.toFixed(3)} below ${context} minimum ${minRequired.toFixed(2)} for tool ${toolName}.`,
      kappa_r: kappaR,
      stakeholder_context: context,
    };
  }

  return { verdict: "PASS", kappa_r: kappaR, stakeholder_context: context };
}

/**
 * F6 EMPATHY floor check — called by FloorEnforcer.checkAll().
 *
 * Returns CAUTION (not VOID/HOLD) for SOFT floor by default,
 * escalating to HOLD only when κᵣ < KAPPA_R_VOID_THRESHOLD.
 */
export function checkF6Empathy(input: string, toolName?: string, args?: Record<string, unknown>): EmpathyResult {
  const result = toolName && args
    ? checkToolHarm(toolName, args)
    : checkEmpathy(input);

  // F6 is SOFT — downgrade VOID to HOLD, HOLD to CAUTION
  // Only direct harm patterns remain VOID
  if (result.verdict === "VOID" && result.reason !== "HARM_PATTERN_DETECTED" && result.reason !== "DESTRUCTIVE_TOOL_ARGS") {
    result.verdict = "HOLD";
  }

  return result;
}
