/**
 * A-FORGE — ADR-015 Governed Transition & Authority Parity Contract
 *
 * Ratified by ARIF F13 on 2026-10-28 (ADR-015, commit a1a75cc1d).
 * Provides strict TypeScript parity with arifOS Python contracts:
 *  1. Orthogonal authority domains composed under AuthorityEnvelope
 *  2. Bounded ExecutionAuthorizationGrant with strict parameter verification
 *  3. SovereignAttestation with subject-hash binding
 *  4. Consumer-specific legacy projections (LegacySealProjection)
 *  5. Formula-version registry and Jacobian non-authority invariant
 */

export type AssuranceLevel =
  | "anonymous"
  | "declared"
  | "ed25519_verified"
  | "sct_verified"
  | "sovereign_cryptographic";

export interface IdentityAssurance {
  claimed_actor_id: string;
  verified_actor_id?: string | null;
  assurance_level: AssuranceLevel;
  verification_method: string;
  verified_at?: string | null;
}

export type ConstitutionalRole =
  | "SOVEREIGN"
  | "OPERATOR"
  | "AUDITOR"
  | "AGENT"
  | "ANONYMOUS";

export interface ConstitutionalAuthority {
  role: ConstitutionalRole;
  jurisdiction: string;
  floors_enforced: string[];
  verdict_authority: boolean;
}

export type EpistemicActionTier =
  | "OBSERVE"
  | "ADVISE"
  | "REVERSIBLE_EXECUTE"
  | "REQUIRE_F13";

export type FederationAuthorityBand =
  | "DENIED"
  | "OBSERVE_ONLY"
  | "AUTHORIZED"
  | "HUMAN_REQUIRED";

export interface SessionCapabilityLease {
  lease_id: string;
  session_id: string;
  resource_scope: string[];
  allowed_verbs: string[];
  mutation_allowed: boolean;
  destructive_allowed: boolean;
  issued_at: string;
  expires_at: string;
  revoked_at?: string | null;
}

export function isLeaseActive(lease: SessionCapabilityLease, atTime?: Date): boolean {
  if (lease.revoked_at) return false;
  const now = atTime || new Date();
  return now < new Date(lease.expires_at);
}

export interface ExecutionAuthorizationGrant {
  authorization_grant_id: string;
  proposal_hash: string;
  plan_hash: string;
  session_id: string;
  actor_id: string;
  executor_id: string;
  allowed_operation: string;
  target_scope: string[];
  baseline_hash: string;
  policy_version: string;
  issued_at: string;
  expires_at: string;
  single_use: boolean;
  used_at?: string | null;
  revoked_at?: string | null;
  issuer: string;
  // Compatibility alias
  constitutional_chain_id?: string;
}

export interface GrantValidationResult {
  valid: boolean;
  reason: string;
}

export function validateExecutionGrant(
  grant: ExecutionAuthorizationGrant,
  options: {
    proposal_hash: string;
    plan_hash: string;
    executor_id: string;
    target?: string;
    at_time?: Date;
  }
): GrantValidationResult {
  if (grant.revoked_at) {
    return { valid: false, reason: `grant_revoked at ${grant.revoked_at}` };
  }
  if (grant.single_use && grant.used_at) {
    return { valid: false, reason: `grant_already_used at ${grant.used_at}` };
  }
  const now = options.at_time || new Date();
  if (now >= new Date(grant.expires_at)) {
    return { valid: false, reason: `grant_expired at ${grant.expires_at}` };
  }
  if (grant.proposal_hash !== options.proposal_hash) {
    return {
      valid: false,
      reason: `proposal_hash_mismatch: expected ${grant.proposal_hash}, got ${options.proposal_hash}`,
    };
  }
  if (grant.plan_hash !== options.plan_hash) {
    return {
      valid: false,
      reason: `plan_hash_mismatch: expected ${grant.plan_hash}, got ${options.plan_hash}`,
    };
  }
  if (grant.executor_id !== options.executor_id) {
    return {
      valid: false,
      reason: `executor_mismatch: authorized for ${grant.executor_id}, called by ${options.executor_id}`,
    };
  }
  if (options.target && grant.target_scope.length > 0 && !grant.target_scope.includes(options.target)) {
    return {
      valid: false,
      reason: `target_scope_escape: ${options.target} not in [${grant.target_scope.join(", ")}]`,
    };
  }
  return { valid: true, reason: "valid" };
}

export interface HumanMandate {
  sovereign: string;
  mandate_ref?: string | null;
  risk_limit: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  explicit_acceptance_required: boolean;
}

export type RuntimeLifecycleState =
  | "NOT_STARTED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "ROLLED_BACK";

export interface RuntimeLifecycle {
  state: RuntimeLifecycleState;
  started_at?: string | null;
  completed_at?: string | null;
  exit_code?: number | null;
}

export interface WitnessStatus {
  receipt_refs: string[];
  w3_coherence: number;
  independent_verified: boolean;
}

export type AcceptanceStatus = "UNATTESTED" | "ACCEPTED" | "REJECTED" | "DEFERRED";

export interface AuthorityEnvelope {
  identity: IdentityAssurance;
  constitutional: ConstitutionalAuthority;
  human_mandate: HumanMandate;
  capability_lease?: SessionCapabilityLease | null;
  execution_grant?: ExecutionAuthorizationGrant | null;
  lifecycle: RuntimeLifecycle;
  witness: WitnessStatus;
  acceptance: AcceptanceStatus;
}

export type ReceiptType =
  | "AUTH_RECORD"
  | "EXEC_RECORD"
  | "DEPLOY_RECORD"
  | "VERIFY_RECORD"
  | "ACCEPTANCE_RECORD"
  | "CLOSE_RECORD";

export interface SovereignAttestation {
  decision: "ACCEPTED" | "REJECTED" | "DEFERRED";
  subject_type: "DEPLOYMENT" | "ARTIFACT" | "CONSTITUTIONAL_MUTATION" | "SESSION_OUTCOME";
  subject_id: string;
  subject_hash: string;
  outcome_witness_ref: string;
  actor: string;
  assurance_level: "LOW_SESSION" | "MEDIUM_BOUND" | "HIGH_CRYPTOGRAPHIC";
  signature?: string | null;
  recorded_at: string;
  scope: string;
}

export type AuthorizationVerdict = "SEAL" | "HOLD" | "SABAR" | "VOID";

export interface GovernedTransition {
  transition_id: string;
  authorization: {
    verdict: AuthorizationVerdict;
    grant?: ExecutionAuthorizationGrant | null;
    judge: string;
    evaluated_at?: string | null;
  };
  lifecycle: {
    execution_state: RuntimeLifecycleState;
    deployment_state: "NOT_STARTED" | "DEPLOYED" | "FAILED" | "ROLLED_BACK";
    session_closed: boolean;
  };
  witness: {
    receipt_id?: string | null;
    receipt_type?: ReceiptType | null;
    chain_hash?: string | null;
    outcome_observed: boolean;
  };
  attestation?: SovereignAttestation | null;
}

export class LegacySealProjection {
  static projectAuthorized(t: GovernedTransition): boolean {
    return t.authorization.verdict === "SEAL";
  }

  static projectReceiptWritten(t: GovernedTransition): boolean {
    return Boolean(t.witness.receipt_id);
  }

  static projectCompleted(t: GovernedTransition): boolean {
    return t.lifecycle.execution_state === "COMPLETED";
  }

  static projectDeployed(t: GovernedTransition): boolean {
    return t.lifecycle.deployment_state === "DEPLOYED";
  }

  static projectRatified(t: GovernedTransition): boolean {
    return Boolean(t.attestation && t.attestation.decision === "ACCEPTED");
  }

  static projectSessionClosed(t: GovernedTransition): boolean {
    return t.lifecycle.session_closed === true;
  }
}

export const FORMULA_VERSION_REGISTRY = {
  "apex-g-v2-runtime": {
    formula: "A * P * E * X * Phi",
    status: "CURRENT_OBSERVED_IMPLEMENTATION",
    source: "arifosmcp/geometry/eureka_zen.py:246",
    epistemic_class: "heuristic_scoring",
    description: "5-factor product runtime function.",
  },
  "apex-g-v3-proposed": {
    formula: "(A * P * E * X) ** 0.25",
    status: "CANONICAL_CANDIDATE",
    source: "core/laws.py / ADR-015",
    epistemic_class: "heuristic_aggregate",
    description: "4-factor geometric mean candidate. Phi separated as scar gate.",
  },
};

export function assertJacobianNonAuthority(role: string): void {
  const r = role.toLowerCase();
  if (r.includes("verdict") || r.includes("authority") || r.includes("constitutional")) {
    throw new Error(
      `JACOBIAN INVARIANT VIOLATION: Role '${role}' cannot claim constitutional authority or issue verdicts.`
    );
  }
}
