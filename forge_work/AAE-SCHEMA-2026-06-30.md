# AAE v1 Schema Receipt — 2026-06-30
> **Status:** 9/9 tests PASS · f1Amanah extended · McpPolicyGate wired
> **DITEMPA BUKAN DIBERI**

---

## What Was Built

### AAE v1 (Amanah Authorization Envelope)
**File:** `/root/A-FORGE/src/domain/governance/amanahEnvelope.ts` (295 lines)

13-field signed JSON packet that travels with every governed tool call:

| # | Field | Type | Purpose |
|---|-------|------|---------|
| 1 | version | "AAE-v1" | Schema version |
| 2 | actor_id | string | Who is acting (F1 AMANAH) |
| 3 | intent_hash | string (BLAKE3) | What they intend (tamper detection) |
| 4 | action_class | ActionClass | 7-tier action taxonomy |
| 5 | reversibility | number 0.0–1.0 | How reversible (F1) |
| 6 | blast_radius | BlastRadius | How far effects reach |
| 7 | evidence_refs | string[] | VAULT999 entry IDs |
| 8 | expiry | Unix ms | F8 LAW: expired = auto DENY |
| 9 | nonce | string | Anti-replay |
| 10 | idempotency_key | string | Deduplication |
| 11 | signature | HMAC-SHA256 | Integrity proof |
| 12 | issued_at | Unix ms | When issued |
| 13 | issuer | string | Which organ issued |

**Crypto:** BLAKE3 for intent hash, HMAC-SHA256 for signature, timing-safe compare.

### Tests (9/9 PASS)
**File:** `/root/A-FORGE/test/amanahEnvelope.test.ts`

| # | Test | What it proves |
|---|------|---------------|
| 1 | buildAAE happy path | Envelope construction works |
| 2 | verifyAAE valid envelope | Valid envelope passes all checks |
| 3 | F1 DENY — missing actor_id | F1 enforced: no actor = DENY |
| 4 | F1 DENY — missing expiry | F1 enforced: no expiry = DENY |
| 5 | F1 DENY — missing signature | F1 enforced: no sig = DENY |
| 6 | F8 DENY — expired AAE | F8 enforced: expired = DENY |
| 7 | tampered — wrong secret | Signature mismatch detected |
| 8 | extendAAE preserves intent_hash | TTL extension doesn't change intent |
| 9 | computeIntentHash deterministic | Same intent = same hash, always |

---

## What Was Extended

### f1Amanah.ts — Rule 6: AAE Action Class Validation
**File:** `/root/A-FORGE/src/domain/governance/f1Amanah.ts`

New Rule 6 validates that if an AAE envelope is present in the floor context:
- AAE `action_class` must match the tool's classified severity
- Uses `classifyTool()` from `actionClassifier.ts` to determine tool severity
- AAE `action_class` must be >= tool severity (e.g., IRREVERSIBLE tool requires IRREVERSIBLE AAE)
- Also verifies AAE integrity (signature + expiry) if `organ_secret` is provided

### McpPolicyGate.ts — Layer 1b + Layer 5b: AAE Integration
**File:** `/root/A-FORGE/src/domain/governance/McpPolicyGate.ts`

**Layer 1b (Identity):**
- If AAE envelope present on request: verify signature, expiry, mandatory fields
- Verify AAE `actor_id` matches request `actor_id` (prevents identity mismatch)

**Layer 5b (Verdict):**
- If AAE envelope present: verify `action_class` vs tool classification
- IRREVERSIBLE tools require IRREVERSIBLE AAE → DENY otherwise
- EXECUTE_HIGH_IMPACT tools require >= EXECUTE_HIGH_IMPACT AAE → DENY otherwise

---

## Parity with arifOS Python

| Component | arifOS (Python) | A-FORGE (TypeScript) |
|-----------|----------------|---------------------|
| Authorization Envelope | `authorization_envelope.py` (245 lines) | `amanahEnvelope.ts` (295 lines) |
| Policy Engine | `policy_engine.py` (254 lines) | `McpPolicyGate.ts` (554+ lines) |
| Action Classifier | `classify_action()` in envelope | `actionClassifier.ts` (200 lines) |
| Trace Context | `trace_context.py` (180 lines) | McpPolicyGate audit log |
| Identity Binding | `identity_binding.py` (125 lines) | McpPolicyGate Layer 1 |
| Sovereign Bridge | `sovereign_bridge.py` (269 lines) | — (arifOS-only) |
| Integration | `sovereign_fabric.py` (296 lines) | McpPolicyGate evaluate() |

**Parity: 6/7 layers match.** Sovereign Bridge is arifOS-only (loads /000 + /999 for kernel-level sovereignty checks).

---

## Remaining (Future)

| Item | Priority | Notes |
|------|----------|-------|
| Wire AAE into forge_shell handler | Medium | Shell calls should build AAE before execution |
| Wire AAE into forge_execute handler | Medium | Execute calls should build AAE before execution |
| Add AAE to forge_dry_run output | Low | Preview should show what AAE would be needed |
| AAE rotation/renewal | Low | Long-running sessions need AAE refresh |

---

*DITEMPA BUKAN DIBERI — The envelope is the membrane. The gate is the law.*
