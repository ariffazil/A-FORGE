/**
 * reply_forge.ts — Agent Reply Forgery: 9-Mode Modular Reply System
 *
 * Every agent reply is a forged artifact — structured communication with
 * verifiable provenance, constitutional alignment, and clear routing.
 *
 * Built on two layers:
 *   1. Template skeleton — fixed structure (To / From / CC / Title / Context / Verdict / Way Forward / Seal)
 *   2. Mode dial — modular flavor that determines how each section is written
 *
 * Skill source: ~/.hermes/skills/agent-reply-forgery/SKILL.md
 * Ratified: 2026.05.03 by Arif Fazil (APEX Judge)
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { createHash } from "node:crypto";

// ═══════════════════════════════════════════════════════════════════════════════
// 9 MODE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const REPLY_MODE = {
  HEALTH: "HEALTH",
  INCIDENT: "INCIDENT",
  PROPOSAL: "PROPOSAL",
  ESCALATE: "ESCALATE",
  AUDIT: "AUDIT",
  PLAN: "PLAN",
  EXPLAIN: "EXPLAIN",
  DENY: "DENY",
  META: "META",
} as const;

export type ReplyMode = (typeof REPLY_MODE)[keyof typeof REPLY_MODE];

export const REPLY_MODE_TABLE: Record<ReplyMode, {
  useWhen: string;
  typicalVerdict: "SEAL" | "SABAR" | "VOID";
  tone: string;
}> = {
  HEALTH:     { useWhen: "System status, uptime, health checks",                   typicalVerdict: "SEAL",  tone: "Factual, low drama" },
  INCIDENT:   { useWhen: "Something broken, degraded, or behaving unexpectedly", typicalVerdict: "SABAR", tone: "Crisp, no blame" },
  PROPOSAL:   { useWhen: "Suggesting a change, design, plan",                     typicalVerdict: "SABAR", tone: "Option-based, not pushy" },
  ESCALATE:   { useWhen: "Human decision required NOW — Floor 13 triggered",    typicalVerdict: "SABAR", tone: "Direct, minimal narrative" },
  AUDIT:      { useWhen: "Post-incident retrospective, review",                  typicalVerdict: "SEAL",  tone: "Structured, retrospective" },
  PLAN:       { useWhen: "Forward-looking roadmap, next steps",                 typicalVerdict: "SABAR", tone: "Roadmap, not a report" },
  EXPLAIN:    { useWhen: "Teaching, clarification, deep dive",                   typicalVerdict: "SEAL",  tone: "Patient, explanatory" },
  DENY:       { useWhen: "Refusal, boundary enforcement",                       typicalVerdict: "VOID",  tone: "Respectful, firm" },
  META:       { useWhen: "Discussing template, governance, or system itself",    typicalVerdict: "SABAR", tone: "Careful, canon-referential" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// VERDICT & CONFIDENCE
// ═══════════════════════════════════════════════════════════════════════════════

export type ReplyVerdict = "✅ SEAL" | "⚠️ SABAR" | "🛑 VOID";

export type ReplyConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface ConfidenceLevel {
  label: ReplyConfidence;
  score: number; // 0.0–1.0
  meaning: string;
  verdictImplication: "SEAL_possible" | "SABAR_or_SEAL_with_caveats" | "SABAR_or_VOID";
}

export const CONFIDENCE_LEVELS: Record<ReplyConfidence, ConfidenceLevel> = {
  HIGH:   { label: "HIGH",   score: 0.80, meaning: "Multiple sources, well-established, low uncertainty", verdictImplication: "SEAL_possible" },
  MEDIUM: { label: "MEDIUM", score: 0.50, meaning: "Some evidence, some uncertainty, alternatives possible", verdictImplication: "SABAR_or_SEAL_with_caveats" },
  LOW:    { label: "LOW",    score: 0.30, meaning: "Speculative, single source, high uncertainty",        verdictImplication: "SABAR_or_VOID" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTITUTIONAL ALIGNMENT
// ═══════════════════════════════════════════════════════════════════════════════

export interface ActiveFloor {
  floor: string;
  internal: string;      // F-code meaning
  public: string;        // Human-language translation
}

export const VERDICT_FLOOR_MAP: Record<string, ActiveFloor[]> = {
  "✅ SEAL": [
    { floor: "F2", internal: "Truth — evidence complete",         public: "evidence shows" },
    { floor: "F8", internal: "Genius — G ≥ 0.80",                public: "Confidence high, proceeding" },
    { floor: "F13", internal: "Sovereign — authorized",          public: "Your call" },
  ],
  "⚠️ SABAR": [
    { floor: "F2", internal: "Truth — evidence incomplete",      public: "evidence shows" },
    { floor: "F7", internal: "Humility — acknowledge uncertainty",public: "not certain yet" },
    { floor: "F13", internal: "Sovereign — human needed",        public: "Your call" },
  ],
  "🛑 VOID": [
    { floor: "F1", internal: "Amanah — irreversible risk",      public: "needs your approval" },
    { floor: "F11", internal: "Auth — identity/scope fail",      public: "boundary enforcement" },
    { floor: "F13", internal: "Sovereign — human veto",          public: "Your call" },
  ],
};

// Floor translation for public output (F-codes never appear in group/public output)
export function floorToPublic(floorCode: string): string {
  const map: Record<string, string> = {
    F1:  "irreversible",
    F2:  "evidence shows",
    F5:  "human dignity",
    F7:  "not certain yet",
    F8:  "Confidence high, proceeding",
    F9:  "Anti-Hallucination",
    F11: "boundary enforcement",
    F13: "Your call",
  };
  return map[floorCode] ?? floorCode;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPLY CONTEXT — INPUT TO THE FORGE
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReplyRecipient {
  name: string;
  role?: string;
  platform?: "telegram_group" | "telegram_dm" | "a2a" | "mcp" | "internal";
  explicitTo?: boolean; // true = Arif is in To:, false = Arif is in CC:
}

export interface ReplyCC {
  recipients: ReplyRecipient[];
  arifAlwaysIncluded: boolean; // Arif always in CC unless he's in To:
}

export interface ReplyContext {
  // Routing
  to: ReplyRecipient;
  from: { name: string; role: string; system: string };
  cc: ReplyCC;

  // Content
  title: string;
  context: string[];       // Array of context lines (each = one paragraph of context)
  verdict: ReplyVerdict;
  wayForward: string[];   // Array of way-forward lines
  seal: {
    reasoning: string[]; // Array of reasoning lines
    confidence: ReplyConfidence;
    floorsActive?: string[]; // Internal F-codes (not shown in public)
    timestamp: string;    // YYYY.MM.DD.NNN (9-digit sequence number)
  };

  // Metadata
  mode: ReplyMode;
  isGroupBroadcast?: boolean;
  taskId?: string;

  // Optional overrides
  toneOverride?: "neutral" | "empathetic" | "terse" | "formal" | "technical";
  options?: { label: string; consequence: string }[]; // For PROPOSAL/ESCALATE modes
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODE AUTO-SELECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Auto-detect the appropriate reply mode from context keywords.
 * Used when mode is not explicitly specified.
 */
export function detectReplyMode(input: {
  keywords?: string[];
  isHealthCheck?: boolean;
  isIncident?: boolean;
  isProposal?: boolean;
  isUrgent?: boolean;
  isAudit?: boolean;
  isPlan?: boolean;
  isExplain?: boolean;
  isDeny?: boolean;
  isMeta?: boolean;
  verdict?: ReplyVerdict;
}): ReplyMode {
  if (input.isHealthCheck) return REPLY_MODE.HEALTH;
  if (input.isIncident)     return REPLY_MODE.INCIDENT;
  if (input.isProposal)    return REPLY_MODE.PROPOSAL;
  if (input.isUrgent)      return REPLY_MODE.ESCALATE;
  if (input.isAudit)       return REPLY_MODE.AUDIT;
  if (input.isPlan)        return REPLY_MODE.PLAN;
  if (input.isExplain)     return REPLY_MODE.EXPLAIN;
  if (input.isDeny)        return REPLY_MODE.DENY;
  if (input.isMeta)         return REPLY_MODE.META;

  // Keyword-based fallback
  if (input.keywords) {
    const kw = input.keywords.join(" ").toLowerCase();
    if (/\b(health|uptime|nominal|running|ok|clean|check)\b/.test(kw)) return REPLY_MODE.HEALTH;
    if (/\b(broken|degraded|slow|error|fail|outage|incident|crash)\b/.test(kw)) return REPLY_MODE.INCIDENT;
    if (/\b(propose|proposal|suggest|design|change)\b/.test(kw)) return REPLY_MODE.PROPOSAL;
    if (/\b(urgent|emergency|now|immediate|F13|sovereign)\b/.test(kw)) return REPLY_MODE.ESCALATE;
    if (/\b(audit|retrospective|review|after|incident)\b/.test(kw)) return REPLY_MODE.AUDIT;
    if (/\b(plan|roadmap|next steps|phases)\b/.test(kw)) return REPLY_MODE.PLAN;
    if (/\b(explain|clarify|teach|what is|how does)\b/.test(kw)) return REPLY_MODE.EXPLAIN;
    if (/\b(deny|reject|forbidden|cannot|won't)\b/.test(kw)) return REPLY_MODE.DENY;
    if (/\b(meta|template|governance|skill|system)\b/.test(kw)) return REPLY_MODE.META;
  }

  // Default based on verdict
  if (input.verdict === "✅ SEAL") return REPLY_MODE.HEALTH;
  if (input.verdict === "🛑 VOID") return REPLY_MODE.DENY;
  return REPLY_MODE.PROPOSAL;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPLY FORGE — THE RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

export interface ForgeOptions {
  arifTelegramHandle?: string;
  separatorChar?: string;
  timestampSeq?: number; // For unique 9-digit timestamps
}

/**
 * Forge a structured reply from a ReplyContext.
 * Renders the fixed skeleton with mode-specific flavor.
 *
 * Returns both the formatted string (for human surfaces) and structured data
 * (for A2A/MCP machine surfaces).
 */
export function forgeReply(
  ctx: ReplyContext,
  options: ForgeOptions = {},
): { text: string; structured: ForgeStructuredOutput } {
  const {
    arifTelegramHandle = "@ariffazil",
    separatorChar = "─",
    timestampSeq = Math.floor(Math.random() * 999) + 1,
  } = options;

  const sep = separatorChar.repeat(32);
  const ts = ctx.seal.timestamp ?? generateTimestamp(timestampSeq);

  // Determine CC block
  const ccBlock = buildCCBlock(ctx, arifTelegramHandle);

  // Determine way forward block
  const wayForwardBlock = buildWayForwardBlock(ctx);

  // Determine seal block
  const sealBlock = buildSealBlock(ctx, ts);

  // Assemble the full reply text
  const lines: string[] = [];

  // Header
  lines.push(`To:      ${formatRecipient(ctx.to)}`);
  lines.push(`From:    ${ctx.from.name} · ${ctx.from.role} · ${ctx.from.system}`);
  if (ccBlock) lines.push(`CC:      ${ccBlock}`);
  lines.push(`Title:   ${ctx.title}`);
  lines.push(sep);

  // Context
  for (const line of ctx.context) {
    lines.push(`Context:   ${line}`);
  }
  lines.push("");

  // Verdict
  lines.push(`Verdict:  ${ctx.verdict}`);
  lines.push("");

  // Way Forward
  lines.push(`Way Forward:  ${ctx.wayForward[0] ?? ""}`);
  for (let i = 1; i < ctx.wayForward.length; i++) {
    lines.push(`              ${ctx.wayForward[i]}`);
  }
  lines.push(sep);

  // Seal (reasoning trace)
  for (const line of ctx.seal.reasoning) {
    lines.push(`Seal:    ${line}`);
  }
  lines.push(`Confidence: ${ctx.seal.confidence}`);
  if (ctx.seal.floorsActive?.length) {
    lines.push(`Floors:   ${ctx.seal.floorsActive.join(", ")}`);
  }
  lines.push(`Timestamp: ${ts}`);
  lines.push("");
  lines.push("DITEMPA BUKAN DIBERI");

  const text = lines.join("\n");

  // Structured output for A2A/MCP surfaces
  const structured: ForgeStructuredOutput = {
    to: formatRecipient(ctx.to),
    from: `${ctx.from.name} · ${ctx.from.role} · ${ctx.from.system}`,
    cc: ctx.cc.recipients.map((r) => formatRecipient(r)),
    title: ctx.title,
    mode: ctx.mode,
    verdict: ctx.verdict,
    context: ctx.context,
    wayForward: ctx.wayForward,
    seal: {
      reasoning: ctx.seal.reasoning,
      confidence: ctx.seal.confidence,
      floorsActive: ctx.seal.floorsActive ?? [],
      timestamp: ts,
    },
    // A2A surface format
    a2aSurface: {
      verdict: ctx.verdict.replace(/[^\w]/g, "").toUpperCase() as "SABAR" | "VOID" | "SEAL", // SEAL | SABAR | VOID
      agent: ctx.from.name.toLowerCase(),
      taskId: ctx.taskId ?? `a2a-${ts}`,
      status: verdictToTaskState(ctx.verdict),
      mode: ctx.mode,
      timestamp: ts,
      confidence: CONFIDENCE_LEVELS[ctx.seal.confidence].score,
      floorsActive: ctx.seal.floorsActive ?? [],
      humanRequired: ctx.verdict !== "✅ SEAL",
      nextAction: ctx.wayForward.length > 1 ? "required" : "none",
    },
  };

  return { text, structured };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatRecipient(r: ReplyRecipient): string {
  let s = r.name;
  if (r.role) s += ` · ${r.role}`;
  if (r.platform && r.platform !== "telegram_group") s += ` · ${r.platform}`;
  return s;
}

function buildCCBlock(ctx: ReplyContext, arifHandle: string): string {
  const { cc, to, isGroupBroadcast } = ctx;

  if (!cc.recipients.length && !cc.arifAlwaysIncluded) return "— (none needed)";

  const names = cc.recipients.map((r) => {
    if (r.name === "Arif Fazil") return `${arifHandle} · Human Sovereign`;
    return r.name + (r.role ? ` · ${r.role}` : "");
  });

  // Arif always in CC unless he's in To:
  const arifInTo = to.name === "Arif Fazil";
  if (!arifInTo && cc.arifAlwaysIncluded) {
    names.push(`${arifHandle} · Human Sovereign · APEX Judge`);
  }

  return names.join(", ");
}

function buildWayForwardBlock(ctx: ReplyContext): string {
  if (ctx.options && ctx.options.length > 0 && (ctx.mode === "PROPOSAL" || ctx.mode === "ESCALATE")) {
    const lines: string[] = [];
    for (const opt of ctx.options) {
      lines.push(`${opt.label}) ${opt.consequence}`);
    }
    return lines.join("\n              ");
  }
  return ctx.wayForward.join("\n              ");
}

function buildSealBlock(ctx: ReplyContext, ts: string): string {
  const lines: string[] = [];
  for (const line of ctx.seal.reasoning) {
    lines.push(`Seal:    ${line}`);
  }
  return lines.join("\n");
}

function generateTimestamp(seq: number): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const nnn = String(seq).padStart(3, "0");
  return `${yyyy}.${mm}.${dd}.${nnn}`;
}

function verdictToTaskState(verdict: ReplyVerdict): "completed" | "pending" | "blocked" | "working" {
  switch (verdict) {
    case "✅ SEAL":   return "completed";
    case "⚠️ SABAR":  return "pending";
    case "🛑 VOID":   return "blocked";
    default:          return "working";
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRUCTURED OUTPUT (A2A/MCP SURFACE)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ForgeStructuredOutput {
  // Human surface fields
  to: string;
  from: string;
  cc: string[];
  title: string;
  mode: ReplyMode;
  verdict: ReplyVerdict;
  context: string[];
  wayForward: string[];
  seal: {
    reasoning: string[];
    confidence: ReplyConfidence;
    floorsActive: string[];
    timestamp: string;
  };

  // A2A surface (machine-readable)
  a2aSurface: {
    verdict: "SEAL" | "SABAR" | "VOID";
    agent: string;
    taskId: string;
    status: "completed" | "pending" | "blocked" | "working";
    mode: ReplyMode;
    timestamp: string;
    confidence: number;
    floorsActive: string[];
    humanRequired: boolean;
    nextAction: "required" | "optional" | "none";
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VAULT999 SEAL HASH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a Vault999-compatible SHA-256 hash of the reply outcome.
 */
export function forgeVault999Hash(output: ForgeStructuredOutput): string {
  const data = JSON.stringify({
    v: 1,
    verdict: output.a2aSurface.verdict,
    agent: output.a2aSurface.agent,
    taskId: output.a2aSurface.taskId,
    mode: output.a2aSurface.mode,
    timestamp: output.a2aSurface.timestamp,
    confidence: output.a2aSurface.confidence,
    floors: output.a2aSurface.floorsActive,
  });
  return createHash("sha256").update(data).digest("hex");
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE HELPERS — ONE-STEP REPLY FORGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a HEALTH mode reply in one call.
 */
export function forgeHealth(params: {
  to: ReplyRecipient;
  from: { name: string; role: string; system: string };
  title: string;
  context: string[];
  sealLines: string[];
  timestampSeq?: number;
}): { text: string; structured: ForgeStructuredOutput } {
  return forgeReply({
    ...params,
    cc: { recipients: [], arifAlwaysIncluded: true },
    verdict: "✅ SEAL",
    wayForward: ["Monitoring continues.", "Next check in 15 min."],
    seal: {
      reasoning: params.sealLines,
      confidence: "HIGH",
      timestamp: generateTimestamp(params.timestampSeq ?? 1),
    },
    mode: REPLY_MODE.HEALTH,
  });
}

/**
 * Build an INCIDENT mode reply in one call.
 */
export function forgeIncident(params: {
  to: ReplyRecipient;
  from: { name: string; role: string; system: string };
  title: string;
  context: string[];
  impact?: string;
  mitigation: string[];
  sealLines: string[];
  confidence: ReplyConfidence;
  timestampSeq?: number;
}): { text: string; structured: ForgeStructuredOutput } {
  return forgeReply({
    to: params.to,
    from: params.from,
    cc: { recipients: [], arifAlwaysIncluded: true },
    title: params.title,
    context: params.context,
    verdict: "⚠️ SABAR",
    wayForward: params.mitigation,
    seal: {
      reasoning: params.sealLines,
      confidence: params.confidence,
      floorsActive: ["F2", "F7"],
      timestamp: generateTimestamp(params.timestampSeq ?? 1),
    },
    mode: REPLY_MODE.INCIDENT,
  });
}

/**
 * Build a PROPOSAL mode reply in one call.
 */
export function forgeProposal(params: {
  to: ReplyRecipient;
  from: { name: string; role: string; system: string };
  title: string;
  context: string[];
  options: { label: string; consequence: string }[];
  sealLines: string[];
  nextSteps?: string[];
  timestampSeq?: number;
}): { text: string; structured: ForgeStructuredOutput } {
  return forgeReply({
    to: params.to,
    from: params.from,
    cc: { recipients: [], arifAlwaysIncluded: true },
    title: `Proposal — ${params.title}`,
    context: params.context,
    verdict: "⚠️ SABAR",
    wayForward: params.nextSteps ?? [],
    options: params.options,
    seal: {
      reasoning: params.sealLines,
      confidence: "HIGH",
      floorsActive: ["F2", "F8"],
      timestamp: generateTimestamp(params.timestampSeq ?? 1),
    },
    mode: REPLY_MODE.PROPOSAL,
  });
}

/**
 * Build an ESCALATE mode reply in one call.
 */
export function forgeEscalate(params: {
  to: ReplyRecipient;
  from: { name: string; role: string; system: string };
  cc?: ReplyRecipient[];
  title: string;
  context: string[];
  floorsTriggered: string[];
  options: { label: string; consequence: string }[];
  sealLines: string[];
  timestampSeq?: number;
}): { text: string; structured: ForgeStructuredOutput } {
  return forgeReply({
    to: params.to,
    from: params.from,
    cc: { recipients: params.cc ?? [], arifAlwaysIncluded: true },
    title: `⚡ URGENT — ${params.title}`,
    context: params.context,
    verdict: "⚠️ SABAR",
    wayForward: [],
    options: params.options,
    seal: {
      reasoning: params.sealLines,
      confidence: "HIGH",
      floorsActive: params.floorsTriggered,
      timestamp: generateTimestamp(params.timestampSeq ?? 1),
    },
    mode: REPLY_MODE.ESCALATE,
  });
}

/**
 * Build a DENY mode reply in one call.
 */
export function forgeDeny(params: {
  to: ReplyRecipient;
  from: { name: string; role: string; system: string };
  title: string;
  context: string[];
  reason: string;
  floorsTriggered: string[];
  alternative?: string;
  timestampSeq?: number;
}): { text: string; structured: ForgeStructuredOutput } {
  return forgeReply({
    to: params.to,
    from: params.from,
    cc: { recipients: [], arifAlwaysIncluded: true },
    title: `Request rejected — ${params.title}`,
    context: params.context,
    verdict: "🛑 VOID",
    wayForward: params.alternative ? [`Suggestion: ${params.alternative}`] : ["No alternative — outside AAA mandate entirely."],
    seal: {
      reasoning: [
        `Floors triggered: ${params.floorsTriggered.join(", ")}`,
        `Reason: ${params.reason}`,
      ],
      confidence: "HIGH",
      floorsActive: params.floorsTriggered,
      timestamp: generateTimestamp(params.timestampSeq ?? 1),
    },
    mode: REPLY_MODE.DENY,
  });
}

/**
 * Build an AUDIT mode reply in one call.
 */
export function forgeAudit(params: {
  to: ReplyRecipient;
  from: { name: string; role: string; system: string };
  title: string;
  context: string[];
  mitigations: string[];
  sealLines: string[];
  nextReview?: string;
  timestampSeq?: number;
}): { text: string; structured: ForgeStructuredOutput } {
  return forgeReply({
    to: params.to,
    from: params.from,
    cc: { recipients: [], arifAlwaysIncluded: true },
    title: `Audit — ${params.title}`,
    context: params.context,
    verdict: "✅ SEAL",
    wayForward: [
      "Mitigations applied:",
      ...params.mitigations.map((m) => `- ${m}`),
      params.nextReview ? `Next review: ${params.nextReview}` : "No further action needed.",
    ],
    seal: {
      reasoning: params.sealLines,
      confidence: "HIGH",
      floorsActive: ["F2"],
      timestamp: generateTimestamp(params.timestampSeq ?? 1),
    },
    mode: REPLY_MODE.AUDIT,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODALITY FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

export type ContentModality = "text" | "code" | "image" | "audio" | "json" | "a2a_payload";

export interface FormattedContent {
  modality: ContentModality;
  content: string;
  label?: string;
  mimeType?: string;
}

/**
 * Format content according to modality rules from the skill.
 * - Code/config → code block with language tag
 * - Secrets/tokens → placeholder
 * - Images → MEDIA:/path or ![alt](url)
 * - JSON (human) → code block
 * - JSON (machine) → raw
 */
export function formatByModality(
  content: string,
  modality: ContentModality,
  options?: { filename?: string; label?: string; secret?: boolean },
): FormattedContent {
  if (modality === "code") {
    const lang = options?.filename?.split(".").pop() ?? "text";
    return {
      modality,
      content: "```" + lang + "\n" + content + "\n```",
      label: options?.filename ? `// ${options.filename}` : undefined,
      mimeType: "text/plain",
    };
  }

  if (modality === "json") {
    return {
      modality,
      content: "```json\n" + content + "\n```",
      mimeType: "application/json",
    };
  }

  if (modality === "image") {
    // If content is a local path
    if (content.startsWith("/")) {
      return {
        modality,
        content: `MEDIA:${content}`,
        label: options?.label,
        mimeType: "image/png",
      };
    }
    // URL
    return {
      modality,
      content: `![${options?.label ?? "image"}](${content})`,
      mimeType: "image/png",
    };
  }

  if (modality === "audio") {
    return {
      modality,
      content: `MEDIA:${content}`,
      label: options?.label,
      mimeType: "audio/ogg",
    };
  }

  // text or json_machine
  return {
    modality,
    content,
    mimeType: modality === "a2a_payload" ? "application/json" : "text/plain",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  forgeReply,
  forgeHealth,
  forgeIncident,
  forgeProposal,
  forgeEscalate,
  forgeDeny,
  forgeAudit,
  forgeVault999Hash,
  detectReplyMode,
  formatByModality,
  REPLY_MODE,
  CONFIDENCE_LEVELS,
  VERDICT_FLOOR_MAP,
  floorToPublic,
};
