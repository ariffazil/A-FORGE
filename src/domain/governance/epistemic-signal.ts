/**
 * Memory Classification + Epistemic Signal — Discovery 8+9
 * 
 * Every tool return should carry:
 *   - Memory status: is this fact live, stale, recalled, inferred, or sealed?
 *   - Epistemic signal: what kind of truth is this output?
 * 
 * Without these, agents guess at confidence. With these, every output
 * carries its own truth-status and consequence-status.
 * 
 * FORGED: 2026-07-03
 * DITEMPA BUKAN DIBERI
 */

// ─── Discovery 8: Memory Classification ────────────────────────────

export type MemoryClass =
  | 'LIVE_PROBE'      // Directly observed right now (curl, health check)
  | 'SESSION_STATE'   // Current session context (ephemeral, session-scoped)
  | 'CACHED_MEMORY'   // Previously observed, may be stale
  | 'INFERRED'        // Derived from other evidence, not directly observed
  | 'SEALED_RECEIPT'  // Immutable, VAULT999-sealed truth
  | 'STALE';          // Known to be outdated, freshness expired

export interface MemoryStatus {
  /** What kind of memory is this? */
  class: MemoryClass;
  /** When was this data last verified? */
  last_verified?: string;
  /** How old is acceptable before it's stale? (seconds) */
  freshness_ttl_s?: number;
  /** Is this data still within its freshness window? */
  is_fresh?: boolean;
  /** Source of the data */
  source?: string;
}

/**
 * Create a memory status for a tool return.
 */
export function memoryStatus(
  cls: MemoryClass,
  opts: {
    last_verified?: string;
    freshness_ttl_s?: number;
    source?: string;
  } = {}
): MemoryStatus {
  const now = new Date();
  const verified = opts.last_verified ? new Date(opts.last_verified) : null;
  const ttl = opts.freshness_ttl_s ?? 300; // default 5 minutes
  const isFresh = verified ? (now.getTime() - verified.getTime()) < ttl * 1000 : undefined;

  return {
    class: cls,
    last_verified: opts.last_verified,
    freshness_ttl_s: ttl,
    is_fresh: isFresh,
    source: opts.source,
  };
}

/**
 * Quick helpers for common memory patterns.
 */
export const Memory = {
  /** Data observed right now via live probe */
  live: (source?: string) => memoryStatus('LIVE_PROBE', { last_verified: new Date().toISOString(), source }),
  
  /** Data from current session context */
  session: (source?: string) => memoryStatus('SESSION_STATE', { source }),
  
  /** Data recalled from memory/vault */
  cached: (lastVerified: string, ttlS?: number, source?: string) =>
    memoryStatus('CACHED_MEMORY', { last_verified: lastVerified, freshness_ttl_s: ttlS, source }),
  
  /** Data derived/inferred from other evidence */
  inferred: (source?: string) => memoryStatus('INFERRED', { source }),
  
  /** Immutable sealed receipt */
  sealed: (source?: string) => memoryStatus('SEALED_RECEIPT', { source }),
  
  /** Known stale data */
  stale: (lastVerified: string, source?: string) => memoryStatus('STALE', { last_verified: lastVerified, source }),
};

// ─── Discovery 9: Epistemic Signal ─────────────────────────────────

export type EvidenceLayer = 'OBS' | 'DER' | 'INT' | 'SPEC';

export interface EpistemicSignal {
  /** What kind of evidence supports this? */
  evidence_layer: EvidenceLayer;
  /** Confidence 0.0-1.0 (hard-capped at 0.90 per F7) */
  confidence: number;
  /** Known uncertainty sources */
  uncertainty: string[];
  /** Where this evidence came from */
  source: string;
  /** Is this output reversible? */
  reversible: boolean;
  /** What authority does this claim carry? */
  authority_claim: 'ADVISORY' | 'EVIDENCE' | 'VERDICT' | 'SEALED';
}

/**
 * Create an epistemic signal for a tool return.
 */
export function epistemicSignal(
  layer: EvidenceLayer,
  opts: {
    confidence?: number;
    uncertainty?: string[];
    source?: string;
    reversible?: boolean;
    authority_claim?: EpistemicSignal['authority_claim'];
  } = {}
): EpistemicSignal {
  // F7 HUMILITY: cap confidence at 0.90
  const confidence = Math.min(opts.confidence ?? 0.7, 0.90);

  return {
    evidence_layer: layer,
    confidence,
    uncertainty: opts.uncertainty ?? [],
    source: opts.source ?? 'unknown',
    reversible: opts.reversible ?? true,
    authority_claim: opts.authority_claim ?? 'ADVISORY',
  };
}

/**
 * Quick helpers for common epistemic patterns.
 */
export const Epistemic = {
  /** Directly observed — highest evidence quality */
  observed: (source?: string, confidence?: number) =>
    epistemicSignal('OBS', { confidence: confidence ?? 0.85, source, authority_claim: 'EVIDENCE' }),
  
  /** Derived from computation or logic */
  derived: (source?: string, confidence?: number) =>
    epistemicSignal('DER', { confidence: confidence ?? 0.75, source, authority_claim: 'EVIDENCE' }),
  
  /** Interpreted — human or agent judgment */
  interpreted: (source?: string, confidence?: number, uncertainty?: string[]) =>
    epistemicSignal('INT', { confidence: confidence ?? 0.6, source, uncertainty: uncertainty ?? [], authority_claim: 'ADVISORY' }),
  
  /** Speculative — low confidence, high uncertainty */
  speculative: (source?: string, uncertainty?: string[]) =>
    epistemicSignal('SPEC', { confidence: 0.3, source, uncertainty: uncertainty ?? ['speculative'], authority_claim: 'ADVISORY' }),
};

// ─── Enriched Tool Result ──────────────────────────────────────────

/**
 * Wrap any tool result with memory + epistemic metadata.
 * This is what every tool handler should return.
 */
export interface EnrichedResult<T = unknown> {
  /** The actual result data */
  data: T;
  /** Memory classification */
  memory: MemoryStatus;
  /** Epistemic signal */
  epistemic: EpistemicSignal;
  /** Optional error envelope (from error-classifier) */
  error?: unknown;
}

/**
 * Create an enriched tool result.
 */
export function enrichResult<T>(
  data: T,
  memory: MemoryStatus,
  epistemic: EpistemicSignal
): EnrichedResult<T> {
  return { data, memory, epistemic };
}
