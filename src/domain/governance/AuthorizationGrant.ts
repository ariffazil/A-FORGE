/**
 * AuthorizationGrant — schema + validator (no runtime enforcement of signing)
 *
 * Grant structure:
 *   grant_id: string — unique identifier for this grant
 *   candidate_digest: string — candidate_manifest_sha256 this grant authorizes
 *   repository: string — repository identifier (e.g., "ariffazil/a-forge")
 *   operation: string — operation being authorized (e.g., "release", "deploy")
 *   service_scope: string — service scope (must match candidate's requested_service_scope)
 *   baseline_digest: string — baseline_attestation_sha256 at time of grant
 *   expires_at: string — ISO 8601 timestamp when grant expires
 *   use_limit: number — max uses (1 = single-use semantics)
 *   authorized_by: string — identity of authorizer (e.g., "F13", "888-APEX")
 *   signature?: string — optional Ed25519 signature (NOT validated here; validation is separate)
 */

export interface AuthorizationGrant {
  grant_id: string;
  candidate_digest: string;
  repository: string;
  operation: string;
  service_scope: string;
  baseline_digest: string;
  expires_at: string;
  use_limit: number;
  authorized_by: string;
  signature?: string;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  code?: "DIGEST_MISMATCH" | "EXPIRED" | "REUSED" | "SCOPE_MISMATCH" | "INVALID_STRUCTURE";
}

/**
 * In-memory store for tracking grant usage (use_limit=1 semantics)
 * In production this would be persisted; for now it's ephemeral per process.
 */
const grantUsage = new Map<string, number>();

/**
 * Validate an AuthorizationGrant against a candidate manifest digest and expected scope.
 * REJECTS on:
 *   - digest mismatch (grant for digest X cannot authorize Y)
 *   - expired grant
 *   - reused/used grant (use_limit=1 semantics)
 *   - mismatched scope
 *   - invalid structure (missing required fields)
 */
export function validateAuthorizationGrant(
  grant: AuthorizationGrant,
  expectedCandidateDigest: string,
  expectedServiceScope: string,
  expectedBaselineDigest: string
): ValidationResult {
  // Structural validation
  const requiredFields: (keyof AuthorizationGrant)[] = [
    "grant_id",
    "candidate_digest",
    "repository",
    "operation",
    "service_scope",
    "baseline_digest",
    "expires_at",
    "use_limit",
    "authorized_by",
  ];

  for (const field of requiredFields) {
    if (!(field in grant) || grant[field] === undefined || grant[field] === null) {
      return {
        valid: false,
        reason: `Missing required field: ${field}`,
        code: "INVALID_STRUCTURE",
      };
    }
  }

  if (typeof grant.use_limit !== "number" || grant.use_limit < 1) {
    return {
      valid: false,
      reason: "use_limit must be a positive integer",
      code: "INVALID_STRUCTURE",
    };
  }

  // Digest mismatch
  if (grant.candidate_digest !== expectedCandidateDigest) {
    return {
      valid: false,
      reason: `Digest mismatch: grant authorizes ${grant.candidate_digest}, expected ${expectedCandidateDigest}`,
      code: "DIGEST_MISMATCH",
    };
  }

  // Baseline digest mismatch
  if (grant.baseline_digest !== expectedBaselineDigest) {
    return {
      valid: false,
      reason: `Baseline digest mismatch: grant expects ${grant.baseline_digest}, current baseline is ${expectedBaselineDigest}`,
      code: "DIGEST_MISMATCH",
    };
  }

  // Scope mismatch
  if (grant.service_scope !== expectedServiceScope) {
    return {
      valid: false,
      reason: `Scope mismatch: grant scope is ${grant.service_scope}, expected ${expectedServiceScope}`,
      code: "SCOPE_MISMATCH",
    };
  }

  // Expiration check
  const now = new Date();
  const expiresAt = new Date(grant.expires_at);
  if (isNaN(expiresAt.getTime())) {
    return {
      valid: false,
      reason: "Invalid expires_at timestamp",
      code: "INVALID_STRUCTURE",
    };
  }
  if (now > expiresAt) {
    return {
      valid: false,
      reason: `Grant expired at ${grant.expires_at}`,
      code: "EXPIRED",
    };
  }

  // Reuse check (use_limit=1 semantics)
  const usedCount = grantUsage.get(grant.grant_id) || 0;
  if (usedCount >= grant.use_limit) {
    return {
      valid: false,
      reason: `Grant ${grant.grant_id} exhausted (used ${usedCount}/${grant.use_limit})`,
      code: "REUSED",
    };
  }

  return { valid: true };
}

/**
 * Record a grant usage (call after successful validation to enforce use_limit)
 */
export function recordGrantUsage(grantId: string): void {
  const current = grantUsage.get(grantId) || 0;
  grantUsage.set(grantId, current + 1);
}

/**
 * Reset grant usage tracking (for testing)
 */
export function resetGrantUsage(): void {
  grantUsage.clear();
}

/**
 * Create a test grant for testing purposes
 */
export function createTestGrant(overrides: Partial<AuthorizationGrant> = {}): AuthorizationGrant {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

  return {
    grant_id: overrides.grant_id ?? `grant-${sha256(`${now.toISOString()}-${Math.random()}`).slice(0, 12)}`,
    candidate_digest: overrides.candidate_digest || "digest-x",
    repository: overrides.repository || "ariffazil/a-forge",
    operation: overrides.operation || "release",
    service_scope: overrides.service_scope || "aforge-release",
    baseline_digest: overrides.baseline_digest || "baseline-y",
    expires_at: overrides.expires_at ?? expiresAt.toISOString(),
    use_limit: overrides.use_limit ?? 1,
    authorized_by: overrides.authorized_by || "F13",
    signature: overrides.signature,
  };
}

/**
 * Simple SHA256 helper (for test grant creation)
 */
function sha256(input: string): string {
  // This is a placeholder - in real code use crypto.createHash
  // For tests we just need a deterministic string
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, "0");
}