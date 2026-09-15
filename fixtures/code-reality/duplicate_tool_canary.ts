/**
 * GOLDEN TEST FIXTURE — Duplicate Tool Canary
 * =============================================
 * Purpose: Validate that audit.repository_entropy detects capability duplication.
 * Created: 2026-09-16
 * Test: Test 4 (Controlled dead-code canary)
 *
 * This file declares a mock tool that duplicates the capability of an existing
 * A-FORGE tool (forge_probe). An agent SHOULD detect this as HYPOTHESIS duplicate.
 * An agent MUST NOT auto-delete it.
 */

// CANARY: Duplicate of forge_probe capability
// This tool does exactly what forge_probe does — probes federation organs.
// A capability-overlap analyzer SHOULD flag this.
interface CanaryDuplicateProbeInput {
  organs: string[];
  include_latency?: boolean;
}

interface CanaryDuplicateProbeOutput {
  status: string;
  organs: Record<string, { healthy: boolean; latency_ms?: number }>;
}

/**
 * fixture_duplicate_probe — duplicates forge_probe's capability.
 *
 * Expected detection:
 * - Contract similarity with forge_probe: HIGH
 * - Capability overlap: SAME (probes federation organs)
 * - Verdict: HYPOTHESIS (duplicate_implementation)
 * - Disposition: INVESTIGATE — compare callers and receipts
 *
 * This is NOT safe to delete without checking:
 * 1. Are there callers that use this specific name?
 * 2. Is this a test-only mock?
 * 3. Does it have different side effects?
 */
export function fixture_duplicate_probe(
  input: CanaryDuplicateProbeInput
): CanaryDuplicateProbeOutput {
  // Identical capability to forge_probe
  const results: Record<string, { healthy: boolean; latency_ms?: number }> = {};
  for (const organ of input.organs) {
    results[organ] = { healthy: true, latency_ms: Math.random() * 100 };
  }
  return { status: "ok", organs: results };
}

// CANARY 2: Duplicate schema with different name
// This is the same interface as forge_health_check but named differently
export interface CanaryHealthCheckInput {
  session_id?: string;
  actor_id?: string;
}

export interface CanaryHealthCheckOutput {
  status: string;
  uptime: number;
  version: string;
}

/**
 * fixture_health_mirror — mirrors forge_health_check.
 * Expected: HYPOTHESIS (duplicate_implementation)
 * Disposition: INVESTIGATE
 */
export function fixture_health_mirror(
  _input: CanaryHealthCheckInput
): CanaryHealthCheckOutput {
  return { status: "ok", uptime: 0, version: "canary-0.0.0" };
}
