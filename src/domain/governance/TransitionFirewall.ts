/**
 * TransitionFirewall.ts — Structural forbidden-transition firewall (Workstream C).
 *
 * This module implements the ONE canonical transition commit boundary:
 *   commit_transition(request, authorization)
 *
 * The firewall runs FIRST (structural check). The judge authorization check
 * runs AFTER it (injected as a dependency/stub so tests can control it).
 *
 * Firewall contract:
 *   INPUT  { from_state, to_state, subject_type, transition_id, policy_table_version }
 *   OUTPUT ONLY 'PASS' | 'DENY_FORBIDDEN_EDGE' | 'DENY_MALFORMED_TRANSITION'
 *
 * The firewall is PURE and DENY-ONLY:
 *   - Never emits SEAL/HOLD/SABAR/VOID/ACCEPT or any authorization
 *   - Never writes state
 *   - Never changes its table at runtime
 *   - Never interprets language
 *   - PASS means only "this edge is not structurally forbidden"
 *     — judge authorization is still mandatory afterwards
 *
 * The 6 canonical forbidden edges (FTG-01..FTG-06) are loaded from
 * /root/forge_work/forbidden_transitions_v0/forbidden_transitions.json
 * using its source/target names as canonical state strings.
 *
 * State writes must all route through the canonical API (repository
 * compare-and-set semantics; a transition from a stale baseline is rejected).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** The three legal firewall return values — exhaustive. */
export type FirewallVerdict = "PASS" | "DENY_FORBIDDEN_EDGE" | "DENY_MALFORMED_TRANSITION";

/** Input shape for the structural firewall. */
export interface TransitionRequest {
  /** The state we are transitioning FROM (canonical state string from forbidden_transitions.json). */
  from_state: string;
  /** The state we are transitioning TO (canonical state string from forbidden_transitions.json). */
  to_state: string;
  /** Type of subject undergoing transition (for future policy granularity). */
  subject_type: string;
  /** Unique identifier for this transition attempt (audit trail). */
  transition_id: string;
  /** Version of the policy table this request was evaluated against. */
  policy_table_version: string;
}

/** Authorization check result (injected dependency — the judge step). */
export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
}

/** Complete transition outcome including both structural and judge steps. */
export interface TransitionOutcome {
  /** Structural firewall result. */
  structural: FirewallVerdict;
  /** Judge authorization result (only present when structural === "PASS"). */
  authorization?: AuthorizationResult;
  /** Final outcome for the transition. */
  final: "PASS" | "DENY_STRUCTURAL" | "DENY_AUTHORIZATION";
  /** Reason code distinguishing structural denial from judge denial. */
  reason_code?: "FORBIDDEN_EDGE" | "MALFORMED_TRANSITION" | "UNAUTHORIZED";
}

/** Forbidden edge definition from the policy table. */
interface ForbiddenEdge {
  id: string;
  source: string;
  target: string;
  event: string;
  class: string;
}

/** Policy table loaded from forbidden_transitions.json. */
interface PolicyTable {
  version: string;
  edges: ForbiddenEdge[];
}

/** Cache for the loaded policy table (immutable after load). */
let policyTableCache: PolicyTable | null = null;
let policyTableLoadError: Error | null = null;

/**
 * Load the forbidden transitions policy table from the canonical JSON file.
 * This is a pure read — the table is never mutated at runtime.
 */
function loadPolicyTable(): PolicyTable {
  if (policyTableCache) return policyTableCache;
  if (policyTableLoadError) throw policyTableLoadError;

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // The policy file lives outside the src tree at a fixed location.
    // From dist/src/domain/governance/ -> dist/src/domain/ -> dist/src/ -> dist/ -> A-FORGE/ -> root/ -> forge_work/
    const policyPath = join(__dirname, "..", "..", "..", "..", "..", "forge_work", "forbidden_transitions_v0", "forbidden_transitions.json");
    const raw = readFileSync(policyPath, "utf-8");
    const parsed = JSON.parse(raw);

    // Validate the structure we expect.
    if (!parsed.version || !Array.isArray(parsed.edges)) {
      throw new Error("Policy table malformed: missing version or edges array");
    }

    const edges: ForbiddenEdge[] = parsed.edges.map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      event: e.event,
      class: e.class,
    }));

    policyTableCache = { version: parsed.version, edges };
    return policyTableCache;
  } catch (err) {
    policyTableLoadError = err instanceof Error ? err : new Error(String(err));
    throw policyTableLoadError;
  }
}

/**
 * Get the set of all known canonical states from the policy table.
 * Used for malformed-transition detection (fail-closed on unknown states).
 */
function getKnownStates(): Set<string> {
  const table = loadPolicyTable();
  const states = new Set<string>();
  for (const edge of table.edges) {
    states.add(edge.source);
    states.add(edge.target);
  }
  return states;
}

/**
 * Check if a (from_state, to_state) pair is a forbidden edge.
 * Returns the edge ID if forbidden, null otherwise.
 */
function checkForbiddenEdge(from: string, to: string): string | null {
  const table = loadPolicyTable();
  for (const edge of table.edges) {
    if (edge.source === from && edge.target === to) {
      return edge.id;
    }
  }
  return null;
}

/**
 * The PURE structural firewall check.
 * Returns ONLY one of the three FirewallVerdict values.
 * Never writes state, never mutates the table, never interprets language.
 */
export function structuralFirewallCheck(request: TransitionRequest): FirewallVerdict {
  // 1. Validate required fields are present and non-empty strings.
  if (
    typeof request.from_state !== "string" ||
    typeof request.to_state !== "string" ||
    typeof request.subject_type !== "string" ||
    typeof request.transition_id !== "string" ||
    typeof request.policy_table_version !== "string"
  ) {
    return "DENY_MALFORMED_TRANSITION";
  }
  if (
    request.from_state === "" ||
    request.to_state === "" ||
    request.subject_type === "" ||
    request.transition_id === "" ||
    request.policy_table_version === ""
  ) {
    return "DENY_MALFORMED_TRANSITION";
  }

  // 2. Fail-closed: both from_state and to_state must be known canonical states.
  const knownStates = getKnownStates();
  if (!knownStates.has(request.from_state) || !knownStates.has(request.to_state)) {
    return "DENY_MALFORMED_TRANSITION";
  }

  // 3. Check if this exact (from, to) pair is a forbidden edge.
  const forbiddenId = checkForbiddenEdge(request.from_state, request.to_state);
  if (forbiddenId) {
    return "DENY_FORBIDDEN_EDGE";
  }

  // 4. Not forbidden, states are known — structural PASS.
  //    This means ONLY "this edge is not structurally forbidden".
  //    Judge authorization is STILL MANDATORY afterwards.
  return "PASS";
}

/**
 * Judge authorization check — injected as a dependency so tests can control it.
 * The real implementation lives elsewhere (not in this module).
 * This is a STUB TYPE for the dependency injection signature.
 */
export type JudgeAuthorizationCheck = (
  request: TransitionRequest
) => Promise<AuthorizationResult> | AuthorizationResult;

/**
 * The ONE canonical transition commit boundary.
 *
 * Executes the structural firewall FIRST, then the judge authorization check.
 * State writes must route through this function (repository compare-and-set
 * semantics; a transition from a stale baseline is rejected by the caller
 * using the policy_table_version field).
 *
 * @param request - The transition request with from/to states and metadata.
 * @param judgeCheck - Injected judge authorization check (async or sync).
 * @returns Complete transition outcome with reason codes.
 */
export async function commit_transition(
  request: TransitionRequest,
  judgeCheck: JudgeAuthorizationCheck
): Promise<TransitionOutcome> {
  // Step 1: Structural firewall (pure, deny-only, runs first).
  const structural = structuralFirewallCheck(request);

  if (structural !== "PASS") {
    // Structural denial — judge is never consulted.
    const reason_code = structural === "DENY_FORBIDDEN_EDGE" ? "FORBIDDEN_EDGE" : "MALFORMED_TRANSITION";
    return {
      structural,
      final: structural === "DENY_FORBIDDEN_EDGE" ? "DENY_STRUCTURAL" : "DENY_STRUCTURAL",
      reason_code,
    };
  }

  // Step 2: Judge authorization (only reached if structural PASS).
  const auth = await judgeCheck(request);

  if (!auth.authorized) {
    return {
      structural: "PASS",
      authorization: auth,
      final: "DENY_AUTHORIZATION",
      reason_code: "UNAUTHORIZED",
    };
  }

  // Both checks passed.
  return {
    structural: "PASS",
    authorization: auth,
    final: "PASS",
    reason_code: undefined,
  };
}

/**
 * Export the policy table version for callers to include in requests.
 * This enables compare-and-set semantics: a transition from a stale
 * baseline (old policy_table_version) is rejected by the caller.
 */
export function getPolicyTableVersion(): string {
  return loadPolicyTable().version;
}

/**
 * Export the known states for validation helpers.
 */
export function getCanonicalStates(): ReadonlySet<string> {
  return getKnownStates();
}

/**
 * Export the forbidden edges for inspection (read-only).
 */
export function getForbiddenEdges(): ReadonlyArray<ForbiddenEdge> {
  return loadPolicyTable().edges;
}