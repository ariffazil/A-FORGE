# Zero-Loophole Architecture v1 — Implementation Plan

This document outlines the strict PR-by-PR sequence to implement the 5-Plane Zero-Loophole Architecture in `arifosmcp`, transitioning from open-access/shadow modes to full cryptographic enforcement without breaking existing `WEALTH` or `GEOX` pipelines.

## Phase 1: Foundation (Non-Blocking)

### PR-01: `audit(schema): add v1 identity/authority/decision models`
- **Files:** `arifosmcp/schemas/{identity.py, authority.py, capability.py, decision.py, execution.py, audit.py}`
- **Tests:** `tests/schemas/test_v1_models.py`
- **Acceptance Criteria:** Pydantic models rigorously validate against the v1 JSON specs (e.g., `sealed_decision_packet.v1`). No routing or behavioral changes. Pure additive schemas.

### PR-02: `governance(registry): add canonical tool registry with alias mapping`
- **Files:** `arifosmcp/registry/tool_registry.py`, `arifosmcp/registry/tool_manifest.yaml`
- **Tests:** `tests/registry/test_tool_registry.py`
- **Acceptance Criteria:** A single source of truth for all tools. Correctly resolves aliases (e.g., `agi_mind` -> `arifos_mind`). Emits telemetry warnings on alias usage. Non-blocking.

## Phase 2: Wrappers & Shadow Hashes (Observation Mode)

### PR-03: `forge(plane): add Identity Plane wrapper`
- **Files:** `arifosmcp/planes/identity_plane.py`, `arifosmcp/adapters/arifos_init_adapter.py`
- **Tests:** `tests/planes/test_identity_plane.py`
- **Acceptance Criteria:** Existing `arifos_init` routes through the new `identity_init` logic. Emits an `identity_token_id`. Legacy callers still succeed.

### PR-04: `forge(plane): add Authority Plane in issue-only mode`
- **Files:** `arifosmcp/planes/authority_plane.py`
- **Tests:** `tests/planes/test_authority_plane.py`
- **Acceptance Criteria:** Issues `authority_token_id` mapping the granted scope (read, reason, execute) based on current implicit risk logic. Attached to response payloads. Non-blocking.

### PR-05: `forge(plane): add Capability Plane and canonical resolver`
- **Files:** `arifosmcp/planes/capability_plane.py`, `arifosmcp/adapters/arifos_kernel_adapter.py`
- **Tests:** `tests/planes/test_capability_plane.py`
- **Acceptance Criteria:** All tool dispatches route through the registry resolver. The system logs the canonical target and schema hash. Aliases still function.

### PR-06: `security(validation): add Validation Plane skeleton`
- **Files:** `arifosmcp/planes/validation_plane.py`, `arifosmcp/adapters/arifos_judge_adapter.py`
- **Tests:** `tests/planes/test_validation_plane.py`
- **Acceptance Criteria:** `arifos_judge`, `arifos_sense`, `arifos_ops` wrapped. Emits `sealed_decision_packet` payload in a shadow `payload.v1_shadow` field. Verdicts remain unchanged.

### PR-07: `forge(execution): add Execution Plane shadow manifest`
- **Files:** `arifosmcp/planes/execution_plane.py`, `arifosmcp/adapters/arifos_forge_adapter.py`
- **Tests:** `tests/planes/test_execution_plane.py`
- **Acceptance Criteria:** `arifos_forge` / `code_engine` generate a shadow `manifest_hash` and compare it against the `decision_packet`. Logs validation failures silently. Execution proceeds normally.

## Phase 3: GEOX & Adversarial Advisory

### PR-08: `GEOX(provenance): add GEOX provenance wrapper`
- **Files:** `arifosmcp/GEOX/provenance.py`, `arifosmcp/GEOX/witness_hash.py`
- **Tests:** `tests/GEOX/test_provenance.py`
- **Acceptance Criteria:** Data ingestion tools (`well_load_bundle`, etc.) generate `witness_hash` and provenance metadata. Missing provenance triggers warnings, not halts.

### PR-09: `GEOX(provenance): attach hashes to GEOX compute outputs`
- **Files:** `arifosmcp/adapters/GEOX_adapter.py`
- **Tests:** `tests/GEOX/test_compute_hashes.py`
- **Acceptance Criteria:** GEOX compute and verification tools output `witness_hash`, `input_hash`, and `state_hash`. Backwards compatible with existing clients.

### PR-10: `security(validation): add Adversarial layer in advisory mode`
- **Files:** `arifosmcp/planes/adversary_plane.py`
- **Tests:** `tests/planes/test_adversary_plane.py`
- **Acceptance Criteria:** Simulates identity attacks, schema confusion, and cross-layer mismatches. Emits `adversarial_hash` and scores. Flags anomalies in logs only.

## Phase 4: Hard Enforcement (The Gates Close)

### PR-11: `security(gate): enforce identity-before-cognition`
- **Files:** `arifosmcp/runtime/rest_routes.py`, `arifosmcp/planes/identity_plane.py`
- **Tests:** `tests/security/test_identity_gate.py`
- **Acceptance Criteria:** **First hard gate.** `ANONYMOUS` actors are hard-blocked from `arifos_mind`, `arifos_memory`, `arifos_sense`. Must possess a `BOUND` identity token.

### PR-12: `governance(registry): enforce canonical registry paths`
- **Files:** `arifosmcp/registry/tool_registry.py`, `arifosmcp/runtime/rest_routes.py`
- **Tests:** `tests/security/test_canonical_gate.py`
- **Acceptance Criteria:** **Second hard gate.** Hidden/duplicate paths blocked. Schema mismatch results in immediate `VOID`. Aliases allowed for read-only only.

### PR-13: `forge(execution): enforce Judge <-> Forge hash lock`
- **Files:** `arifosmcp/planes/execution_plane.py`
- **Tests:** `tests/security/test_forge_lock.py`
- **Acceptance Criteria:** **Third hard gate.** `arifos_forge` strictly REJECTS execution if `decision_packet.verdict != SEAL` or if the `manifest_hash` (input, state, actor, session, nonce) fails validation.

### PR-14: `GEOX(provenance): enforce GEOX provenance for consequential outputs`
- **Files:** `arifosmcp/adapters/GEOX_adapter.py`
- **Tests:** `tests/GEOX/test_consequential_enforcement.py`
- **Acceptance Criteria:** `physics_judge_verdict`, `prospect_evaluate`, etc., return `HOLD` or `VOID` if upstream `witness_hash` or provenance is missing.

### PR-15: `security(gate): harden ACP escalation surface`
- **Files:** `arifosmcp/adapters/GEOX_adapter.py`
- **Tests:** `tests/security/test_acp_hardening.py`
- **Acceptance Criteria:** `physics_acp_grant_seal` strictly requires a `SEALED` identity state, human approval token, proposal hash lock, and current state snapshot.

## Phase 5: Pruning & Fail-Closed

### PR-16: `governance(registry): remove deprecated aliases from write/execute paths`
- **Files:** `arifosmcp/registry/tool_manifest.yaml`
- **Tests:** `tests/registry/test_alias_removal.py`
- **Acceptance Criteria:** Legacy aliases (e.g., `code_engine`, `apex_soul`) completely removed from mutating/executing surfaces to eliminate alias drift.

### PR-17: `security(gate): enable full fail-closed mode`
- **Files:** `arifosmcp/runtime/rest_routes.py`, `arifosmcp/planes/*.py`
- **Tests:** `tests/security/test_fail_closed.py`
- **Acceptance Criteria:** **Absolute zero-loophole posture.** Any request missing a schema, stage, identity, or operating outside the explicit call graph is instantly `VOID`. Silent fallbacks to `ANONYMOUS` are impossible.

