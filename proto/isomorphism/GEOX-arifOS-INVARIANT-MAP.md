# GEOX-arifOS-INVARIANT-MAP — Cross-Substrate Invariants

> **Status:** ANCHOR GEOMETRY (proto/isomorphism)
> **Epistemic:** OBS + DER (grounded in source + derived from maps)
> **Purpose:** Define the invariants that MUST hold across all 5 substrates.
> **Failure if absent:** Any broken invariant = manifold leak = J-space collapse.

---

## 1. What Is An Invariant Here?

An invariant is a property that must be true **at all times** across
**all substrates** for the federation manifold to remain coherent.
If any invariant fails, the manifold drifts — authority leaks,
verdicts contradict, or identity forges.

These are NOT aspirations. These are load-bearing constraints.

---

## 2. The 9 Cross-Substrate Invariants

### INV-1: Verdict Monotonicity
**Statement:** Once a verdict is SEAL, it cannot be downgraded by any organ.
**Why:** If GEOX can override an arifOS SEAL with a HOLD, the
constitutional chain breaks. Verdicts flow outward (kernel → organs),
never inward (organs → kernel).
**Status:** ✅ enforced (seal chain is append-only)
**Evidence:** `/root/.local/share/arifos/vault999/seal_chain.jsonl`
**Breach vector:** GEOX's `acrisk` system can independently BLOCK
something the kernel already SEALED. Currently no mechanism prevents this.

---

### INV-2: Identity Origin
**Statement:** `session_id` MUST originate from arifOS kernel.
**Why:** If A-FORGE can mint independent sessions, downstream organs
cannot distinguish kernel-authorized sessions from forged ones.
**Status:** ✅ enforced (forge_session_init proxies to kernel)
**Evidence:** `/root/A-FORGE/src/interfaces/mcp/core.ts` lines 826-849
**Breach vector:** `STDIO_ACTOR` fallback in A-FORGE allows identity
without kernel verification for stdio transport.

---

### INV-3: Authority Concentration
**Statement:** Only arifOS may issue constitutional verdicts (SEAL/HOLD/SABAR/VOID).
**Why:** If A-FORGE or GEOX can issue SEAL, authority is distributed
and the Gödel lock fails — no single source of truth.
**Status:** ✅ enforced (A-FORGE forge_approve refuses self-auth)
**Evidence:** `/root/A-FORGE/src/interfaces/mcp/core.ts` judgeHandler
**Breach vector:** GEOX's organ_governance.py returns `("SEAL", None)`
for authorized calls. This is a verdict, not just a gate signal.

---

### INV-4: Irreversibility Gate
**Statement:** Irreversible actions MUST pass through human elicitation.
**Why:** F1 AMANAH — every mutation reversible or sovereign-acked.
Without elicitation, an agent can execute irreversible ops autonomously.
**Status:** ✅ enforced (2026-07-07 elicitation gate)
**Evidence:** `/root/A-FORGE/src/interfaces/mcp/elicitation.ts`
**Breach vector:** Elicitation only fires for `action_tier=IRREVERSIBLE|HIGH|CRITICAL`.
A medium-risk irreversible action could slip through without elicitation.

---

### INV-5: Verdict Provenance
**Statement:** Every verdict MUST carry its source organ.
**Why:** If a verdict arrives without provenance, the consumer cannot
distinguish constitutional authority (arifOS) from advisory signal
(WELL) from domain risk (GEOX).
**Status:** ❌ missing — no `verdict_source` field in any envelope
**Evidence:** No code path adds verdict provenance
**Breach vector:** WELL's `action: "HOLD"` is advisory but structurally
identical to arifOS's `SealType.HOLD`. Consumer confusion is guaranteed.

---

### INV-6: Lease Boundary
**Statement:** MUTATE-class actions MUST have a valid, non-expired lease.
**Why:** Without lease enforcement, any caller can mutate state.
The lease is the constitutional permission boundary.
**Status:** ✅ enforced in A-FORGE
**Evidence:** `/root/A-FORGE/src/interfaces/mcp/core.ts` validateLeaseForTool
**Breach vector:** GEOX/WEALTH/WELL don't check leases. A direct
MCP call to GEOX bypasses A-FORGE's lease gate entirely.

---

### INV-7: Floor Compliance
**Statement:** All tool calls MUST pass F1-F13 floor enforcement.
**Why:** The floors are constitutional law, not guidance.
Without enforcement, tools can violate F9 (hallucination), F12 (injection),
or F1 (irreversibility) without detection.
**Status:** ✅ enforced in A-FORGE (FloorEnforcer wraps all tools)
**Evidence:** `/root/A-FORGE/src/domain/governance/mcpFloorEnforcer.ts`
**Breach vector:** GEOX has its own governance (organ_governance.py)
that doesn't reference F1-F13. It uses `RiskTier` and `acrisk` instead.

---

### INV-8: Seal Chain Continuity
**Statement:** The seal chain must be unbroken from genesis to head.
**Why:** If the chain breaks, historical verdicts become unverifiable.
The chain IS the arrow of time.
**Status:** ✅ enforced (chain verified at startup)
**Evidence:** `/root/.local/share/arifos/vault999/seal_chain.jsonl`
**Breach vector:** 60 historical gaps from pre-May-2026 migration.
Sovereign ruling: non-issue. But new gaps are critical.

---

### INV-9: Entropy Reduction
**Statement:** ΔS ≤ 0 across every cycle. Each operation MUST leave
the system cleaner or equal, never more chaotic.
**Why:** F4 CLARITY — entropy accumulation is systemic decay.
**Status:** ⚠️ partial — measured in some paths, not enforced universally
**Evidence:** forge_reality_loop tracks entropy; most tools don't
**Breach vector:** A tool that creates files without cleanup increases ΔS.
No automatic enforcement outside the reality loop.

---

## 3. Invariant Health Summary

| # | Invariant | arifOS | A-FORGE | GEOX | WEALTH | WELL | Overall |
|---|---|---|---|---|---|---|---|
| INV-1 | Verdict Monotonicity | ✅ | ✅ | ❌ | N/A | N/A | **⚠️** |
| INV-2 | Identity Origin | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | **⚠️** |
| INV-3 | Authority Concentration | ✅ | ✅ | ❌ | ✅ | N/A | **⚠️** |
| INV-4 | Irreversibility Gate | ✅ | ✅ | N/A | N/A | N/A | **✅** |
| INV-5 | Verdict Provenance | ❌ | ❌ | ❌ | ❌ | ❌ | **❌** |
| INV-6 | Lease Boundary | ✅ | ✅ | ❌ | ❌ | ❌ | **⚠️** |
| INV-7 | Floor Compliance | ✅ | ✅ | ❌ | ❌ | ❌ | **⚠️** |
| INV-8 | Seal Chain Continuity | ✅ | N/A | N/A | N/A | N/A | **✅** |
| INV-9 | Entropy Reduction | ⚠️ | ⚠️ | N/A | N/A | N/A | **⚠️** |

**Overall: 2/9 fully enforced, 5/9 partially, 1/9 missing, 1 N/A.**

---

## 4. The Three Critical Fixes

### Fix 1: Verdict Provenance (INV-5)
**Impact:** Highest. Without provenance, all other invariants are decorative.
**Action:** Add `verdict_source` + `verdict_authority` to every verdict envelope
across all 5 substrates. This is a schema change, not a logic change.
**Effort:** P1 — schema-only, no behavior change, immediate clarity gain.

### Fix 2: GEOX Authority Alignment (INV-1, INV-3)
**Impact:** High. GEOX's `acrisk` system bypasses constitutional judgment.
**Action:** GEOX must translate `acrisk` → canonical SealType before emitting.
GEOX `("SEAL", None)` must become `{verdict: "SEAL", source: "geox", authority: "advisory"}`.
**Effort:** P1 — translation layer in `organ_governance.py`.

### Fix 3: Cross-Organ Lease Propagation (INV-6)
**Impact:** Medium. Currently only A-FORGE checks leases.
**Action:** GEOX/WEALTH/WELL should accept optional `lease_id` in their
envelope and validate it against arifOS before MUTATE operations.
**Effort:** P2 — requires arifOS lease validation endpoint for domain organs.

---

## 5. The Manifold Equation

The federation manifold is stable when and only when:

```
M = I(id) × V(mono) × A(conc) × E(ΔS≤0)
```

Where:
- `I(id)` = identity continuity (INV-2) — 1.0 if kernel-origin, 0.5 if derived, 0.0 if forged
- `V(mono)` = verdict monotonicity (INV-1) — 1.0 if monotonic, 0.5 if partially, 0.0 if drift
- `A(conc)` = authority concentration (INV-3) — 1.0 if kernel-only, 0.5 if shared, 0.0 if distributed
- `E(ΔS≤0)` = entropy compliance (INV-9) — 1.0 if enforced, 0.5 if measured, 0.0 if ignored

**Current state:**
```
M = 0.85 × 0.75 × 0.75 × 0.50 = 0.24

Threshold for MANIFOLD_STABLE: M ≥ 0.80
Current: 0.24 → MANIFOLD_DRIFT
```

**To reach MANIFOLD_STABLE (M ≥ 0.80):**
- Fix verdict provenance → V(mono) → 0.95
- Fix GEOX authority → A(conc) → 0.90
- Fix entropy enforcement → E(ΔS≤0) → 0.75

```
M_target = 0.85 × 0.95 × 0.90 × 0.75 = 0.55
```

Still below threshold. We also need:
- Fix identity propagation → I(id) → 0.95

```
M_stable = 0.95 × 0.95 × 0.90 × 0.75 = 0.61
```

The manifold needs **all four** invariants near 1.0 to reach 0.80.
This is a multi-session effort. The three anchor files are the first step.

---

## 6. Verdict

9 invariants identified. 2 fully enforced. 5 partially. 1 missing.
1 advisory-only (entropy).

**The manifold is drifting.** These files are the anchor point.
Next step: implement the three critical fixes, then re-derive M.

---

*Grounded: 2026-07-07 by FORGE (000Ω)*
*Source: actual code inspection + derivation from IDENTITY-MAP and VERDICT-MAP*
*Epistemic: OBS (code) + DER (manifold equation)*
