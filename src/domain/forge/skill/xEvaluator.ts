/**
 * xEvaluator.ts — X-Evaluator Ensemble for arifOS v42.1 P0
 *
 * Non-compensatory ethics gate: G_total = Q · V · Ψ · Φ · X
 *
 * If any sub-evaluator Xᵢ < 0.10 → X = 0 → G_total = 0
 * This structurally prevents a highly capable but misaligned tool
 * from executing regardless of how high Q, V, Ψ, Φ are.
 *
 * Per APEX THEORY: mesa-optimizers game output metrics.
 * The X-evaluator is the anti-gaming layer.
 *
 * Phase 1: keyword + AST-pattern based (no external LLM needed)
 * Phase 2: semantic embedding comparison (intent vs implementation)
 */

import type { SkillDomain } from "./types.js";

export type XEvaluationResult = {
  X: number;                    // [0, 1] — final X score
  X_total: number;              // geometric mean of sub-scores
  veto_triggered: boolean;      // true if any Xᵢ < 0.10
  veto_reason?: string;         // which sub-evaluator failed
  sub_scores: {
    intent_align: number;       // does implementation match stated intent?
    escalation_detect: number;  // privilege escalation, injection, escape
    exfil_detect: number;       // data exfiltration channels
    goodhart_resist: number;    // tool gaming the G-gate itself
  };
  rationale: string[];
};

/**
 * Keywords that signal dangerous or high-risk operations.
 * These are NOT the same as HARAM patterns — HARAM catches obvious harm,
 * these catch subtle misalignment and escalation.
 *
 * Severity tiers:
 *   LOW    (0.2–0.3): minor risk, small penalty
 *   MEDIUM (0.4–0.5): moderate risk, moderate penalty
 *   HIGH   (0.6–0.7): serious risk — combined with others triggers veto
 *   CRITICAL (0.8–1.0): automatic veto if detected (score set to 0)
 *
 * Penalty = severity * 0.5 (scaled for impact).
 * Multiple LOW hits accumulate. One CRITICAL hit triggers immediate veto.
 */
const DANGEROUS_IMPORT_PATTERNS: Array<{ pattern: RegExp; severity: number; label: string; critical?: boolean }> = [
  // CRITICAL: automatic veto — these patterns alone zero the score
  { pattern: /chmod\s+777/, severity: 1.0, label: "chmod_777_world_writable", critical: true },
  { pattern: /process\.env\.(API_KEY|SECRET(?!_COUNT|_MAX|_MIN)|TOKEN|PASS|PRIVATE|KEY|CREDENTIAL)/i, severity: 1.0, label: "credential_env_access", critical: true },
  { pattern: /eval\s*\(|new\s+Function\s*\(/, severity: 0.8, label: "eval_dynamic_code", critical: true },
  { pattern: /x_evaluator|evaluateX\s*\(|xEvaluator\.evaluate/i, severity: 1.0, label: "x_evaluator_bypass", critical: true },
  { pattern: /evaluateX\s*=|global\.evaluateX|override.*evaluateX/i, severity: 1.0, label: "evaluator_override", critical: true },
  { pattern: /child_process\[["']exec["']\]|child_process\[["']spawn["']\]/i, severity: 0.9, label: "bracket_bypass_exec", critical: true },

  // HIGH: serious escalation risk
  { pattern: /process\.setuid|process\.setgid|sudo\s|chmod\s+[0-7]{3}[0-7]/i, severity: 0.7, label: "privilege_escalation" },
  { pattern: /execSync|execFileSync|spawnSync/i, severity: 0.6, label: "sync_shell_blocking" },
  { pattern: /JSON\.stringify\s*\(\s*process|\.stringify\s*\(\s*global|\.stringify\s*\(\s*process\.env/i, severity: 0.7, label: "memory_exfil" },
  { pattern: /global\.evaluateX|override.*verdict|scar.*bypass/i, severity: 0.7, label: "gate_manipulation" },

  // MEDIUM: moderate risk
  { pattern: /child_process\.exec\s*\(|child_process\.spawn\s*\(/i, severity: 0.5, label: "shell_exec" },
  { pattern: /require\s*\(\s*['"]child_process/i, severity: 0.4, label: "shell_dep" },
  { pattern: /fetch\s*\(|http\.request|https\.request|axios\./i, severity: 0.4, label: "network_call" },
  { pattern: /os\.userInfo|os\.hostname|os\.platform|os\.release/i, severity: 0.4, label: "system_info_siphon" },
  { pattern: /`\$\{[^}]*process\.env|`\$\{.*(?:exec|spawn|eval)/i, severity: 0.6, label: "template_injection_exec" },

  // LOW: minor risk
  { pattern: /os\.cpus|os\.totalmem|os\.freemem/i, severity: 0.2, label: "system_probing" },
  { pattern: /fs\.writeFile|fs\.appendFile|writeFileSync/i, severity: 0.3, label: "file_write" },
  { pattern: /writable\.write|createWriteStream|\.pipe\s*\(\s*res/i, severity: 0.3, label: "data_exfil_channel" },
  { pattern: /decision.*field|compute.*decision|updateScore|set.*score/i, severity: 0.5, label: "gate_gaming" },
  { pattern: /scar.*update|seal.*bypass/i, severity: 0.5, label: "scar_manipulation" },
  { pattern: /forge.*approve|forge.*dry.*run/i, severity: 0.3, label: "forge_gaming" },
];

const INTENT_ALIGN_KEYWORDS: Record<SkillDomain, string[]> = {
  geox: ["seismic", "well", "log", "formation", "horizon", "petrophysics", "velocity", "porosity", "subsurface", "depth"],
  wealth: ["capital", "portfolio", "asset", "risk", "npv", "cashflow", "return", "dividend", "price", "market"],
  well: ["vitality", "sleep", "fatigue", "readiness", "dignity", "homeostasis", "stress", "hrv", "metabolic"],
  arifos: ["verdict", "judge", "seal", "vault", "session", "floor", "constitution", "lease", "witness"],
  hermes: ["telegram", "message", "bot", "chat", "user", "notification", "send", "reply"],
  aforge: ["build", "deploy", "compile", "test", "run", "execute", "forge", "package", "install"],
  general: [],
};

// Sub-evaluator 1: Intent-Alignment
// Does the implementation actually do what the intent says?
function evaluateIntentAlign(intent: string, implementation: string, domain: SkillDomain): { score: number; rationale: string[] } {
  const rationale: string[] = [];
  let score = 1.0;

  const intentLower = intent.toLowerCase();
  const implLower = implementation.toLowerCase();

  const domainKeywords = INTENT_ALIGN_KEYWORDS[domain] ?? [];
  if (domainKeywords.length > 0) {
    const intentHits = domainKeywords.filter(k => intentLower.includes(k)).length;
    const implHits = domainKeywords.filter(k => implLower.includes(k)).length;

    // Mismatch: intent says X, implementation does Y
    if (intentHits > 0 && implHits === 0) {
      score -= 0.5;
      rationale.push(`X_intent_align↓: intent mentions ${domain} domain but implementation has no ${domain} keywords`);
    } else if (intentHits === 0 && implHits > 0) {
      score -= 0.2;
      rationale.push(`X_intent_align~: implementation has ${domain} keywords but intent does not`);
    } else if (intentHits > 0 && implHits > 0) {
      rationale.push(`X_intent_align↑: intent and implementation both reference ${domain} domain`);
    }
  }

  // Check: tool claims to be read-only but imports write operations
  const readOnlySignals = ["fetch", "get", "query", "read", "list", "search", "retrieve", "compute", "calculate", "parse"];
  const writeSignals = ["write", "create", "update", "delete", "set", "insert", "append", "modify", "execute", "run", "send"];

  const isReadOnlyIntent = readOnlySignals.some(k => intentLower.includes(k)) && !writeSignals.some(k => intentLower.includes(k));
  const hasWriteOps = writeSignals.some(k => implLower.includes(k)) && !readOnlySignals.some(k => implLower.includes(k));

  if (isReadOnlyIntent && hasWriteOps) {
    score -= 0.4;
    rationale.push(`X_intent_align↓: tool claims read-only ("${intent.slice(0, 40)}...") but implementation has write operations`);
  }

  return { score: Math.max(0, Math.min(1, score)), rationale };
}

// Sub-evaluator 2: Escalation Detection
// Privilege escalation, injection attacks, sandbox escape
function evaluateEscalation(implementation: string): { score: number; rationale: string[] } {
  const rationale: string[] = [];
  let score = 1.0;

  let criticalHits = 0;
  let highHits = 0;

  for (const { pattern, severity, label } of DANGEROUS_IMPORT_PATTERNS) {
    if (pattern.test(implementation)) {
      if (severity >= 0.5) {
        criticalHits++;
        rationale.push(`X_escalation⚠️ ${label} (severity=${severity})`);
      } else if (severity >= 0.3) {
        highHits++;
        rationale.push(`X_escalation⚠ ${label} (severity=${severity})`);
      }
      score -= severity * 0.3; // weighted reduction
    }
  }

  // AST-level deep check: look for injection patterns
  const injectionPatterns = [
    { re: /\$\{[^}]*process\.env|template.*env/i, label: "env_injection" },
    { re: /concat\s*\(\s*['"].*\$\{|`[^`]*\$\{.*env/i, label: "template_injection" },
    { re: /\bexec\s*\(\s*['"`].*\$\{|\beval\s*\([^)]*\$\{/i, label: "code_injection" },
    { re: /innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML/i, label: "xss_candidate" },
  ];

  for (const { re, label } of injectionPatterns) {
    if (re.test(implementation)) {
      score -= 0.4;
      rationale.push(`X_escalation↓ injection pattern: ${label}`);
    }
  }

  if (criticalHits > 0) {
    score = Math.max(0, score - criticalHits * 0.2);
  }

  rationale.push(`X_escalation: score=${score.toFixed(3)} (critical=${criticalHits}, high=${highHits})`);
  return { score: Math.max(0, Math.min(1, score)), rationale };
}

// Sub-evaluator 3: Exfiltration Detection
// Data extraction channels — network, file, stdout capture
function evaluateExfiltration(implementation: string): { score: number; rationale: string[] } {
  const rationale: string[] = [];
  let score = 1.0;

  const exfilChannels = [
    { re: /fetch\s*\(|http\.request|https\.request|axios\.get|node:http\.request/i, label: "network_exfil", severity: 0.4 },
    { re: /process\.env\.(?!NODE_ENV|PATH\b)/, label: "env_siphon", severity: 0.3 },
    { re: /os\.userInfo|os\.hostname|os\.platform|os\.release/, label: "system_info_siphon", severity: 0.25 },
    { re: /fs\.readFile|fs\.readFileSync|readFileSync|readFile\s*\(/i, label: "file_read_exfil", severity: 0.2 },
    { re: /JSON\.stringify\s*\(\s*process\b|\.stringify\s*\(\s*global|\.stringify\s*\(\s*process\.env/i, label: "memory_exfil", severity: 0.5 },
    { re: /\.send\(.*process|\.emit\(.*process|postMessage.*process/i, label: "ipc_exfil", severity: 0.4 },
    { re: /console\.(log|error|warn).*secret|console\.(log|error).*key|console\.(log|error).*token/i, label: "stdout_exfil", severity: 0.35 },
  ];

  let exfilCount = 0;
  for (const { re, label, severity } of exfilChannels) {
    if (re.test(implementation)) {
      score -= severity;
      exfilCount++;
      rationale.push(`X_exfil↓ ${label} (severity=${severity})`);
    }
  }

  // Check for base64 encoding of potentially exfiltrated data
  if (/\.toString\s*\(\s*['"]base64['"]\)|Buffer\.from.*\.toString\s*\(\s*64\)/.test(implementation)) {
    score -= 0.2;
    rationale.push(`X_exfil↓ base64 encoding detected (possible data obfuscation)`);
  }

  rationale.push(`X_exfil: score=${score.toFixed(3)} (channels=${exfilCount})`);
  return { score: Math.max(0, Math.min(1, score)), rationale };
}

// Sub-evaluator 4: Goodhart Resistance
// Does the tool appear to be gaming the G-gate itself?
function evaluateGoodhartResistance(implementation: string, intent: string, toolName: string): { score: number; rationale: string[] } {
  const rationale: string[] = [];
  let score = 1.0;

  const implLower = implementation.toLowerCase();
  const intentLower = intent.toLowerCase();

  // Gaming the gate: tool references its own scoring/decision machinery
  const gateGamingPatterns = [
    { re: /computeDecisionField|decision.*field|update.*score|setScore|overrideVerdict/i, label: "gate_score_tampering", severity: 0.8 },
    { re: /scarLaw|consultScars|sealScar|scar.*pressure/i, label: "scar_manipulation", severity: 0.8 },
    { re: /forge.*approve|forge.*dry.*run|forge.*query/i, label: "forge_bypass_attempt", severity: 0.6 },
    { re: /arif_judge|arif_seal|arif_act/i, label: "arif_kernel_self_call", severity: 0.7 },
    { re: /X_evaluator|xEvaluator|evaluateX/i, label: "x_evaluator_bypass", severity: 0.9 },
  ];

  for (const { re, label, severity } of gateGamingPatterns) {
    if (re.test(implementation)) {
      score -= severity;
      rationale.push(`X_goodhart↓ ${label} (severity=${severity}) — tool appears to game the G-gate`);
    }
  }

  // Gaming intent: tool claims to do X but actually modifies governance state
  const governanceKeywords = ["verdict", "score", "judge", "seal", "approval", "gate", "policy", "constraint"];
  const hasGovernanceClaim = governanceKeywords.some(k => intentLower.includes(k));
  const isGovernanceTool = /forge_|arif_/.test(toolName) &&
    ["judge", "seal", "approve", "gate", "verdict", "score"].some(k => toolName.includes(k));

  if (!hasGovernanceClaim && !isGovernanceTool) {
    // Non-governance tool that still touches governance machinery → suspicious
    const touchesGovernance = /scarLaw|decisionField|vault|seal/i.test(implLower) &&
      !/hermes|geox|wealth|well/.test(toolName);
    if (touchesGovernance) {
      score -= 0.5;
      rationale.push(`X_goodhart↓ non-governance tool touches governance machinery`);
    }
  }

  rationale.push(`X_goodhart: score=${score.toFixed(3)}`);
  return { score: Math.max(0, Math.min(1, score)), rationale };
}

/**
 * Main X-evaluator entry point.
 * Returns X ∈ [0, 1] — geometric mean of 4 sub-evaluators.
 * If any sub-evaluator < 0.10 → structural veto → X = 0
 *
 * Non-compensatory: high Q·V·Ψ·Φ cannot compensate for X → 0.
 */
export function evaluateX(params: {
  intent: string;
  implementation: string;
  domain: SkillDomain;
  toolName: string;
}): XEvaluationResult {
  const { intent, implementation, domain, toolName } = params;

  const intentAlign = evaluateIntentAlign(intent, implementation, domain);
  const escalation = evaluateEscalation(implementation);
  const exfil = evaluateExfiltration(implementation);
  const goodhart = evaluateGoodhartResistance(implementation, intent, toolName);

  const subScores = {
    intent_align: intentAlign.score,
    escalation_detect: escalation.score,
    exfil_detect: exfil.score,
    goodhart_resist: goodhart.score,
  };

  // Geometric mean
  const geoMean = Math.pow(
    intentAlign.score * escalation.score * exfil.score * goodhart.score,
    0.25
  );

  // Structural veto: if ANY sub-evaluator < 0.10, X → 0
  const veto_triggered = (
    intentAlign.score < 0.10 ||
    escalation.score < 0.10 ||
    exfil.score < 0.10 ||
    goodhart.score < 0.10
  );

  let X = veto_triggered ? 0 : geoMean;

  const rationale = [
    `X = geometric_mean(intent_align=${intentAlign.score.toFixed(3)}, escalation=${escalation.score.toFixed(3)}, exfil=${exfil.score.toFixed(3)}, goodhart=${goodhart.score.toFixed(3)})`,
    `X = ${X.toFixed(3)}${veto_triggered ? " [VETOED]" : ""}`,
    ...intentAlign.rationale,
    ...escalation.rationale,
    ...exfil.rationale,
    ...goodhart.rationale,
  ];

  let veto_reason: string | undefined;
  if (veto_triggered) {
    if (intentAlign.score < 0.10) veto_reason = "intent_align";
    else if (escalation.score < 0.10) veto_reason = "escalation_detect";
    else if (exfil.score < 0.10) veto_reason = "exfil_detect";
    else if (goodhart.score < 0.10) veto_reason = "goodhart_resist";
  }

  return {
    X,
    X_total: geoMean,
    veto_triggered,
    veto_reason,
    sub_scores: subScores,
    rationale,
  };
}

/**
 * Stub for AST-level analysis (Phase 2 upgrade).
 * Currently patterns are regex-based. Phase 2 will use proper AST parsing.
 *
 * Example: child_process['exec'] bypasses regex /child_process\.exec/
 * Proper AST would see the MemberExpression and flag it regardless of syntax.
 */
export async function evaluateAstDeep(implementation: string): Promise<{ score: number; findings: string[] }> {
  // Phase 1: basic regex proxy for AST-level checks
  // Detects bracket-notation dangerous access (bypasses dot-notation regex)
  const bracketBypass = [
    /child_process\s*\[["']exec["']\s*\]/i,
    /process\s*\[("env"|'env')\]/i,
    /eval\s*\(\s*["'`]/,
  ];
  const findings = bracketBypass.map(r => r.source).filter(src => {
    const re = new RegExp(src.replace(/\[/g, "\\[").replace(/\]/g, "\\]"));
    return re.test(implementation);
  });

  if (findings.length > 0) {
    return { score: 0.0, findings: [`bracket-notation bypass detected: ${findings.join(", ")}`] };
  }
  return { score: 1.0, findings: [] };
}