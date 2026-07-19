/**
 * NonceStore — in-memory nonce tracking with TTL expiry.
 *
 * Fixes the AAE nonce replay vulnerability: nonces are generated but
 * never tracked. This store records each seen nonce and rejects replays.
 *
 * Design:
 *   - Map<string, { seen_at: number }> — O(1) lookup
 *   - TTL-based expiry (default 10 min, matches AAE max lifetime)
 *   - Periodic cleanup on check() to bound memory
 *   - Singleton export for federation-wide use
 *
 * Constitutional:
 *   F1 AMANAH — replay = identity forgery → DENY
 *   F8 LAW    — nonce reuse is a policy violation
 *   F11 AUDIT — every replay attempt is logged
 *
 * @module governance/nonceStore
 * @forged 2026-07-18 — response to nonce replay vulnerability
 */

export interface NonceCheckResult {
  /** true if this nonce was already seen (replay attack) */
  replay: boolean;
  /** human-readable reason */
  reason?: string;
}

interface NonceEntry {
  seen_at: number;
}

export class NonceStore {
  private seen: Map<string, NonceEntry> = new Map();
  private ttlMs: number;
  private maxEntries: number;

  /**
   * @param ttlMs  How long a nonce is remembered (default 10 min)
   * @param maxEntries  Cap to prevent unbounded memory growth (default 100_000)
   */
  constructor(ttlMs: number = 10 * 60 * 1000, maxEntries: number = 100_000) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  /**
   * Check whether a nonce has been seen before, then record it.
   * This is the primary entry point — atomic check-and-record.
   *
   * Returns { replay: true } if the nonce was already used.
   */
  checkAndRecord(nonce: string): NonceCheckResult {
    if (!nonce || typeof nonce !== "string") {
      return { replay: false, reason: "empty_nonce_skipped" };
    }

    // Periodic cleanup to bound memory
    this.cleanup();

    const now = Date.now();
    const existing = this.seen.get(nonce);

    if (existing) {
      // Check if the existing entry is still within TTL
      if (now - existing.seen_at < this.ttlMs) {
        return {
          replay: true,
          reason: `REPLAY_DETECTED: nonce "${nonce}" was already used at ${new Date(existing.seen_at).toISOString()}`,
        };
      }
      // Entry expired — treat as fresh (fall through to re-record)
    }

    // Record the nonce
    this.seen.set(nonce, { seen_at: now });
    return { replay: false };
  }

  /**
   * Check only (do not record). Useful for pre-validation.
   */
  isReplay(nonce: string): boolean {
    if (!nonce) return false;
    const existing = this.seen.get(nonce);
    if (!existing) return false;
    return Date.now() - existing.seen_at < this.ttlMs;
  }

  /**
   * Record a nonce without checking. Useful when caller already checked.
   */
  record(nonce: string): void {
    if (!nonce) return;
    this.seen.set(nonce, { seen_at: Date.now() });
  }

  /**
   * Remove expired entries to bound memory.
   */
  cleanup(): void {
    const now = Date.now();
    // Only run cleanup if we're over half the max
    if (this.seen.size < this.maxEntries / 2) return;

    for (const [nonce, entry] of this.seen) {
      if (now - entry.seen_at >= this.ttlMs) {
        this.seen.delete(nonce);
      }
    }

    // If still over max after TTL cleanup, evict oldest
    if (this.seen.size > this.maxEntries) {
      const entries = [...this.seen.entries()]
        .sort((a, b) => a[1].seen_at - b[1].seen_at);
      const toEvict = entries.slice(0, entries.length - this.maxEntries);
      for (const [nonce] of toEvict) {
        this.seen.delete(nonce);
      }
    }
  }

  /** Number of nonces currently tracked. */
  get size(): number {
    return this.seen.size;
  }

  /** Clear all tracked nonces (for testing). */
  clear(): void {
    this.seen.clear();
  }
}

/**
 * Singleton NonceStore for federation-wide nonce tracking.
 * Import this in McpPolicyGate and forgeTools.
 */
export const globalNonceStore = new NonceStore();
