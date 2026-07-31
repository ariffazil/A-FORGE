/**
 * Capability ABI — Canonical contract for ephemeral + permanent tools.
 *
 * ═══ P1.3 RATIFIED (2026-07-31) — CANONICAL CAPABILITY ABI ═══════════════
 *
 * Every tool registered in the A-FORGE capability market — ephemeral or
 * permanent — must declare its full ABI before it can be leased. The ABI
 * is the language-agnostic contract that arifOS + A2A peers use to
 * understand what the tool does, what it costs, what it touches, and
 * how to roll it back.
 *
 * Non-compensatory admissibility gates (P0 — restore one reality):
 *   H_A ∧ H_S ∧ H_E ∧ H_R ∧ H_V
 *   H_A — authority + identity valid
 *   H_S — containment + safety valid
 *   H_E — evidence + provenance valid
 *   H_R — rollback / irreversible-action handling valid
 *   H_V — independent verifier exists
 *
 * Any failed hard gate ⇒ VOID or HOLD. Cost or popularity cannot
 * compensate. This is the Stage 1 gate from the next-horizon doctrine.
 *
 * Stage 2 (empirical mission utility) and Stage 3 (trajectory Θ) live
 * in the CapabilityMarket (P2 work). This file is the contract surface;
 * the empirical computation is downstream.
 *
 * @module forge/capabilityAbi
 * @constitutional F1 AMANAH — every capability declares its reversibility
 * @constitutional F2 TRUTH — every input/output schema is provable
 * @constitutional F9 ANTIHANTU — data_classification is honest, not aspirational
 * @constitutional F11 AUDIT — every capability is hash-bound and provenance-tagged
 * @constitutional F13 SOVEREIGN — only 888 ratifies a capability into permanent registry
 */

import { z } from "zod";

// ── Authority + identity ────────────────────────────────────────────────────

export const AuthorityClassSchema = z.enum([
  "OBSERVE",          // read-only, no mutation
  "SUGGEST",          // proposes, never applies
  "SIMULATE",         // runs in shadow / dry-run
  "DRAFT",            // writes to a quarantined draft area
  "QUEUE",            // stages a mutation for human approval
  "EXECUTE_REVERSIBLE",   // bounded mutation with rollback path
  "EXECUTE_HIGH_IMPACT",  // high-blast mutation, requires arifOS seal
  "IRREVERSIBLE",     // truly irreversible — requires 888_HOLD
]);

// ── Data classification (F9 ANTIHANTU: honest labels, not aspirational) ──

export const DataClassificationSchema = z.enum([
  "PUBLIC",           // no redaction
  "INTERNAL",         // federation-internal
  "SENSITIVE_PII",    // personally identifiable — redaction required
  "CREDENTIAL",       // secret material — broker-only, never serialized
  "SOVEREIGN",        // F13 territory — human veto required
]);

// ── Network scope (F1: deny by default, ALLOWLIST) ─────────────────────────

export const NetworkScopeSchema = z.object({
  default_policy: z.enum(["DENY", "LOCALHOST_ONLY", "ALLOWLIST"]),
  allowed_domains: z.array(z.string()).default([]),
  allowed_endpoints: z.array(z.string()).default([]),  // IP:port
});

// ── Filesystem scope (F1: allowlist only) ──────────────────────────────────

export const FilesystemScopeSchema = z.object({
  default_policy: z.enum(["DENY", "ALLOWLIST"]),
  read_allowlist: z.array(z.string()).default([]),
  write_allowlist: z.array(z.string()).default([]),
  explicit_denies: z.array(z.string()).default([]),    // overrides allowlist
});

// ── Resource budget ────────────────────────────────────────────────────────

export const ResourceBudgetSchema = z.object({
  cpu_cores: z.number().int().min(1).max(4),          // bwrap-friendly cap
  memory_mb: z.number().int().min(64).max(4096),
  storage_mb: z.number().int().min(64).max(10240),
  timeout_ms: z.number().int().min(1000).max(1_800_000),   // hard cap 30 min
  network_required: z.boolean().default(false),
});

// ── Verifier (H_V — independent verifier exists) ──────────────────────────

export const VerifierMethodSchema = z.enum([
  "known_answer",           // deterministic input → expected output
  "schema_invariant",       // output matches declared schema
  "independent_recompute",  // different code path reaches same result
  "differential_testing",   // comparison against reference implementation
  "domain_witness",         // GEOX/WEALTH/WELL organ attests
  "metamorphic_testing",    // property-based oracle
  "external_ground_truth",  // human or out-of-band oracle
  // SELF_CERTIFIED is NOT admissible. Self-certification is rejected.
]);

export const VerifierSpecSchema = z.object({
  method: VerifierMethodSchema,
  // The verifier is run by an EXTERNAL executor — never by the tool itself.
  // The candidate tool CANNOT control its own verifier. (P0.3)
  external_executor: z.string().min(1),  // actor_id of verifier runner
  witness_required: z.boolean().default(false),
  min_passes: z.number().int().min(1).default(1),
  // Receipt contract — receipt_hash must be emitted on every pass
  receipt_policy: z.enum(["emit_to_vault999", "emit_to_local", "ephemeral_only"]),
});

// ── Rollback (H_R — rollback / irreversible-action handling valid) ──────────

export const RollbackSpecSchema = z.object({
  strategy: z.enum([
    "none",                  // truly irreversible — requires IRREVERSIBLE authority
    "transactional",         // full revert possible
    "compensating_action",   // semantic rollback via separate action
    "human_undo_required",   // only a human can undo this
  ]),
  estimated_rollback_ms: z.number().int().min(0).default(0),
  requires_lease_extension: z.boolean().default(false),
});

// ── Evidence requirements (H_E — evidence + provenance valid) ─────────────

export const EvidenceRequirementsSchema = z.object({
  provenance_required: z.boolean().default(true),
  merkle_chain_intact_required: z.boolean().default(true),
  receipts_emitted: z.array(z.enum([
    "vault999_seal",
    "flow_receipt",
    "verifier_receipt",
    "human_approval",
  ])).min(1),
});

// ── Idempotency ────────────────────────────────────────────────────────────

export const IdempotencySpecSchema = z.object({
  is_idempotent: z.boolean(),
  idempotency_key_input: z.boolean().default(false),   // caller provides key
  dedup_window_ms: z.number().int().min(0).default(0), // 0 = no dedup
});

// ── TTL + receipt policy ──────────────────────────────────────────────────

export const TtlSpecSchema = z.object({
  ttl_ms: z.number().int().min(60_000).default(3_600_000),     // default 1h
  auto_retire_on_expiry: z.boolean().default(true),
  promotion_eligible_after_expiry: z.boolean().default(false),
});

// ── Full Capability ABI ────────────────────────────────────────────────────

export const CapabilityAbiSchema = z.object({
  capability_id: z.string().min(1),               // forge_<verb>_<noun>
  intent: z.string().min(10).max(2000),
  input_schema: z.record(z.unknown()),            // JSON-Schema-like object
  output_schema: z.record(z.unknown()),
  authority_class: AuthorityClassSchema,
  side_effects: z.array(z.string()).default([]),
  data_classification: DataClassificationSchema,
  network_scope: NetworkScopeSchema,
  filesystem_scope: FilesystemScopeSchema,
  resource_budget: ResourceBudgetSchema,
  timeout_ms: z.number().int().min(1000).max(1_800_000),
  idempotency: IdempotencySpecSchema,
  rollback: RollbackSpecSchema,
  verifier: VerifierSpecSchema,
  evidence_requirements: EvidenceRequirementsSchema,
  ttl: TtlSpecSchema,
  // Provenance — every ABI declares who forged it (immutable)
  forged_by: z.string().min(1),                   // actor_id
  forged_at: z.string(),                          // ISO-8601
  // ABIs are versioned; v1 is canonical
  abi_version: z.literal("v1").default("v1"),
});

export type CapabilityAbi = z.infer<typeof CapabilityAbiSchema>;

// ── Non-compensatory admissibility gate (P0 — restore one reality) ────────

export interface AdmissibilityVerdict {
  H_A: { ok: boolean; reason?: string };   // authority + identity
  H_S: { ok: boolean; reason?: string };   // containment + safety
  H_E: { ok: boolean; reason?: string };   // evidence + provenance
  H_R: { ok: boolean; reason?: string };   // rollback
  H_V: { ok: boolean; reason?: string };   // independent verifier
  /** Intersection — any failed hard gate collapses the result. */
  ok: boolean;
  /** Which gates failed. Empty iff ok. */
  failing_gates: ReadonlyArray<"H_A" | "H_S" | "H_E" | "H_R" | "H_V">;
}

export function evaluateAdmissibility(
  abi: CapabilityAbi,
  ctx: {
    /** Has the actor proven identity for this authority class? */
    identity_valid: boolean;
    /** Is the requested containment backend (sandbox/exec) available? */
    containment_available: boolean;
    /** Is the merkle chain intact up to the forged_at timestamp? */
    merkle_intact: boolean;
    /** Has the actor produced a receipt for past actions on this surface? */
    receipts_present: boolean;
    /** Is rollback strategy compatible with authority_class? */
    rollback_compatible: boolean;
    /** Is there an EXTERNAL verifier executor registered? */
    verifier_external_executor_registered: boolean;
  },
): AdmissibilityVerdict {
  const failing: Array<"H_A" | "H_S" | "H_E" | "H_R" | "H_V"> = [];

  // H_A — authority + identity
  const H_A_ok = ctx.identity_valid && abi.forged_by.length > 0;
  if (!H_A_ok) failing.push("H_A");

  // H_S — containment + safety
  // IRREVERSIBLE + containment unavailable ⇒ H_S fail
  const H_S_ok =
    ctx.containment_available ||
    (abi.authority_class !== "IRREVERSIBLE" &&
      abi.authority_class !== "EXECUTE_HIGH_IMPACT");
  if (!H_S_ok) failing.push("H_S");

  // H_E — evidence + provenance
  const H_E_ok =
    ctx.merkle_intact &&
    ctx.receipts_present &&
    abi.evidence_requirements.provenance_required &&
    abi.evidence_requirements.receipts_emitted.length > 0;
  if (!H_E_ok) failing.push("H_E");

  // H_R — rollback handling
  const H_R_ok =
    ctx.rollback_compatible ||
    (abi.rollback.strategy !== "none" &&
      abi.authority_class !== "IRREVERSIBLE");
  if (!H_R_ok) failing.push("H_R");

  // H_V — independent verifier
  const H_V_ok =
    ctx.verifier_external_executor_registered &&
    abi.verifier.method !== ("SELF_CERTIFIED" as any) &&
    abi.verifier.external_executor.length > 0;
  if (!H_V_ok) failing.push("H_V");

  const ok = failing.length === 0;
  return {
    H_A: { ok: H_A_ok, reason: H_A_ok ? undefined : "identity or forged_by missing" },
    H_S: { ok: H_S_ok, reason: H_S_ok ? undefined : "containment unavailable for irreversible authority class" },
    H_E: { ok: H_E_ok, reason: H_E_ok ? undefined : "merkle chain or receipts not intact" },
    H_R: { ok: H_R_ok, reason: H_R_ok ? undefined : "rollback strategy incompatible with authority class" },
    H_V: { ok: H_V_ok, reason: H_V_ok ? undefined : "external verifier executor not registered" },
    ok,
    failing_gates: failing,
  };
}