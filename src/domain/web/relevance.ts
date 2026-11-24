/**
 * Relevance instrument — local, deterministic, zero-cost.
 *
 * 2026-11-24 FI-008 (tier-0 ladder repair, Arif SEAL).
 *
 * Why this exists: the search executor used to treat "HTTP 200 with a non-empty
 * result array" as an LFD *win*. A lane returning junk therefore REWARDED
 * itself (weight *= e^0.2, clamped at 3.0) until it dominated routing. This
 * module supplies the missing signal: a cheap lexical relevance score that says
 * whether a result is actually about the query.
 *
 * Contract:
 *   - PURE: no I/O, no model, no network, no globals mutated.
 *   - NON-DESTRUCTIVE: the score is attached to evidence; callers must never
 *     use it to drop results. It only gates the learning signal.
 */

/** Minimum max-relevance for a lane to earn an LFD "win". Permissive by design. */
export const RELEVANCE_MIN = Number(process.env.AFORGE_RELEVANCE_MIN ?? "0.01");

/** English + Malay function words that carry no topical signal. */
export const RELEVANCE_STOPWORDS: ReadonlySet<string> = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "had", "her",
  "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "its", "new",
  "now", "old", "see", "two", "way", "who", "boy", "did", "she", "use", "what", "when",
  "with", "have", "this", "that", "from", "they", "will", "would", "there", "their",
  "about", "which", "into", "than", "then", "them", "these", "some", "such", "more",
  "most", "other", "over", "only", "very", "just", "also", "after", "before", "between",
  "dan", "yang", "untuk", "dengan", "dari", "ini", "itu", "tak", "tidak", "ada", "akan",
  "pada", "atau",
]);

/** Lowercase, strip punctuation, drop short + stopword tokens. */
export function tokenizeText(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !RELEVANCE_STOPWORDS.has(w));
}

/**
 * Fraction of distinct query tokens present in title+excerpt (0..1).
 * 0 = no shared topical token (junk), 1 = every query token present.
 */
export function relevanceScore(query: string, title: string, excerpt: string): number {
  const q = Array.from(new Set(tokenizeText(query)));
  if (q.length === 0) return 0;
  const hay = new Set(tokenizeText(`${title} ${excerpt}`));
  let hit = 0;
  for (const t of q) if (hay.has(t)) hit += 1;
  return Number((hit / q.length).toFixed(3));
}

/** True when at least one scored result clears RELEVANCE_MIN. */
export function anyRelevant(scores: number[]): boolean {
  return scores.length > 0 && Math.max(...scores) >= RELEVANCE_MIN;
}
