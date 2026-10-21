/**
 * IDENTITY_CANON v1 — TypeScript mirror of contracts/identity_canon.py (arifOS).
 * Generated 2026-10-22 from contracts/identity.py CANONICAL_ACTORS +
 * runtime sovereign variants (71 entries, insertion-order, first-match-wins). Regenerate on registry change.
 *
 * THE RULE (contracts/IDENTITY_CANON.md):
 *   claimed handle is identity of record, never overwritten;
 *   canonical id is comparison-only;
 *   comparisonKey = canonical, lowercased, separators removed.
 */

const REGISTRY: ReadonlyArray<readonly [string, string]> = [
  ["arif", "ARIF"],
  ["arif-fazil", "ARIF"],
  ["ariffazil", "ARIF"],
  ["forge", "FORGE"],
  ["a-forge", "FORGE"],
  ["000", "FORGE"],
  ["000\u03c9", "FORGE"],
  ["auditor", "AUDITOR"],
  ["a-audit", "AUDITOR"],
  ["\u03c8", "AUDITOR"],
  ["ops", "OPS"],
  ["\ud83c\udf10", "OPS"],
  ["plan", "PLAN"],
  ["planner", "PLAN"],
  ["\u03c9", "PLAN"],
  ["aaagw", "AAAGW"],
  ["aaa", "AAAGW"],
  ["aaa-gateway", "AAAGW"],
  ["cockpit", "AAAGW"],
  ["hermes", "HERMES"],
  ["hermes-asi", "HERMES"],
  ["opencode", "OPENCODE"],
  ["opencode-333", "OPENCODE"],
  ["333-agi", "OPENCODE"],
  ["333", "OPENCODE"],
  ["fi-008", "FI-008"],
  ["kimi-code-fi008", "FI-008"],
  ["kimi-code", "FI-008"],
  ["kimi-code/fi-008", "FI-008"],
  ["sotcron", "SOTCRON"],
  ["sot-cron", "SOTCRON"],
  ["openclaw", "OPENCLAW"],
  ["openclaw-gateway", "OPENCLAW"],
  ["openclaw-audit", "OPENCLAW"],
  ["openclaw-bot", "OPENCLAW"],
  ["agi_asi_bot", "OPENCLAW"],
  ["grok", "GROK"],
  ["grok-build", "GROK"],
  ["fi-007", "GROK"],
  ["gap-audit", "GROK"],
  ["p0-verify", "GROK"],
  ["grok-build/fi-007", "GROK"],
  ["claude", "CLAUDE"],
  ["claude-code", "CLAUDE"],
  ["anthropic", "CLAUDE"],
  ["qwen", "QWEN"],
  ["qwen-code", "QWEN"],
  ["fi-003", "QWEN"],
  ["qwen-code/fi-003", "QWEN"],
  ["kimi", "KIMI"],
  ["codex", "CODEX"],
  ["codex-cli", "CODEX"],
  ["fi-005", "CODEX"],
  ["codex-cli/fi-005", "CODEX"],
  ["gemini", "GEMINI"],
  ["gemini-cli", "GEMINI"],
  ["fi-004", "GEMINI"],
  ["gemini-cli/fi-004", "GEMINI"],
  ["i_arif", "I_ARIF"],
  ["i-arif", "I_ARIF"],
  ["iarif", "I_ARIF"],
  ["arif fazil", "ARIF"],
  ["arif_fazil", "ARIF"],
  ["arif f", "ARIF"],
  ["arif f.", "ARIF"],
  ["muhammad arif", "ARIF"],
  ["muhammad arif bin fazil", "ARIF"],
  ["muhammad_arif", "ARIF"],
  ["888", "ARIF"],
  ["f13", "ARIF"],
  ["sovereign", "ARIF"],
];

const REGISTRY_MAP: ReadonlyMap<string, string> = new Map(REGISTRY);

function mechanical(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-");
}

/** Resolve a raw handle to its canonical form (registry first, slash head/tail, mechanical fallback). */
export function canonicalActorId(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const hit = REGISTRY_MAP.get(text.toLowerCase());
  if (hit) return hit;
  // Slash path (mirrors contracts/identity.py): `claude/opus-5.5` resolves
  // because its head resolves. Nobody/FI-999 resolves to nothing.
  if (text.includes("/")) {
    for (const part of text.split("/")) {
      const p = part.trim();
      if (!p || p.includes("/")) continue;
      const sub = REGISTRY_MAP.get(p.toLowerCase());
      if (sub) return sub;
    }
  }
  return mechanical(text);
}

/** IDENTITY_CANON comparison key: canonical, lowercased, all separators removed. */
export function comparisonKey(raw: string | null | undefined): string | null {
  const canon = canonicalActorId(raw);
  if (canon === null) return null;
  return canon.toLowerCase().replace(/[-_\s./]+/g, "");
}

/** True when two handles are the same principal under IDENTITY_CANON v1. */
export function samePrincipal(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ka = comparisonKey(a);
  const kb = comparisonKey(b);
  if (ka === null || kb === null) return false;
  return ka === kb;
}
