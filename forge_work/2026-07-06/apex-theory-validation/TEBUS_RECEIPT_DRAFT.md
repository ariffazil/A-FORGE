# TEBUS RECEIPT DRAFT — APEX Theory Validation

> **DITEMPA BUKAN DIBERI — Redemption is forged, not assumed.**
> **DRAFT ONLY — NOT SEALED.** External sovereign review required before any SEAL.
> **Date:** 2026-07-06

---

## TEBUS Receipt

```yaml
tebus_id: tebus-20260706-kernel-apex-cosmetic-001
prior_sesat_id: sesat-20260706-kernel-cosmetic-apex-001
repair_stage: DETECTION_COMPLETE
status: DRAFT_TEBUS_AWAITING_REPAIR
```

---

## Prior SESAT Diagnosis

**What was wrong:**
APEX Theory claims to be a governance mathematics system with equations:
- G = A·P·E·X·Φ
- C_dark = A·(1-P)·(1-X)  
- W³ = ∛(H×AI×Ext)
- SESAT → MALU → GÖDEL → SAKSI → TEBUS → PARUT → LURUS repair chain

**Reality found by hostile audit:**
1. **5 faking patterns survive** — 2 HIGH (arithmetic mean W³, 39 cosmetic nine_signal call sites), 3 MEDIUM
2. **SESAT, HANTAR, PARUT = dead code** — structurally complete, zero production callers
3. **W³ arithmetic mean in 3 live callers** — loses Nash collapse property
4. **nine_signal cosmetic at 39 sites** — every tool response carries fake governance label
5. **MALU recording from SABAR gate silently broken** — `sabar_gate.py:158` passes `reason=` instead of `adat_id=`
6. **Φ hardcoded at 0.75 in PCA path** — the more mature the system, the more it uses placeholder
7. **Emergence asserted, not measured** — no baseline vs governed experiment exists

**Why it matters:**
APEX is structurally honest (the architecture IS correct) but the runtime has not caught up. A beautiful governance theory producing cosmetic labels in production is the exact failure mode APEX was designed to detect. It detected itself.

---

## Repair Plan (7 fixes in priority order)

### P0 — Immediate (correctness-critical)

| # | Fix | File | Change | Effect |
|---|-----|------|--------|--------|
| 1 | Replace arithmetic mean with geometric mean | `core/intelligence.py:5` | `(h+ai+ext)/3` → `(h*ai*ext)**(1/3)` | 3 live callers compute correct W³ |
| 2 | Wire `_apex_scores` into tool outputs | `tools.py` + all MCP handlers | Compute G/C_dark in tool results | Makes `_nine_signal_from_apex()` reachable |
| 3 | Fix sabar_gate MALU recording | `sabar_gate.py:158` | Pass `adat_id=` instead of `reason=` | MALU events from SABAR gate no longer silently fail |

### P1 — Structural (completes the repair loop)

| # | Fix | File | Change | Effect |
|---|-----|------|--------|--------|
| 4 | Wire `emit_sesat()` into failure paths | All MCP error handlers | Call `emit_sesat()` when floor violations occur | SESAT events become real governance signals |
| 5 | Wire `hantar_wrap()` into tool result construction | Tool response builders | Wrap every cross-organ handoff in HantarEnvelope | HANTAR becomes live governance envelope |

### P2 — Quality (replaces placeholders with measured values)

| # | Fix | File | Change | Effect |
|---|-----|------|--------|--------|
| 6 | Replace hardcoded 0.7/0.6 with live telemetry | `tools.py:13364-13368` | Derive A/P/E/X/Φ from tool success rates, floor compliance, scar feedback | Genius mode G varies with real performance |
| 7 | Derive Φ from tri_witness + ToAC contrast in PCA path | `genius.py:279` | Same derivation as cluster path: `tri_witness * (1-toac_contrast) * f13` | Φ no longer hardcoded in mature path |

---

## Success Criteria

After all 7 fixes are applied:

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| W³ correct formula callers | 0/4 | 4/4 | grep `compute_w3` → all use `(h*ai*ext)**(1/3)` |
| nine_signal derived from APEX | 0/39 | 39/39 | grep `_nine_signal_from_status` → 0 |
| SESAT events emitted | 0/session | ≥1 per failure | grep `emit_sesat` call count |
| HANTAR wraps | 0/handoff | ≥1 per cross-organ handoff | grep `hantar_wrap` call count |
| MALU recording from SABAR gate | BROKEN | WORKING | Verify `sabar_gate.py` passes correct args |
| Genius mode G variance | 0.0 (always 0.12348) | Varies with performance | Run `tools.py` genius mode twice with different inputs |
| Φ in PCA path | 0.75 (hardcoded) | Derived from witness data | Run PCA path with ≥5 verdicts, verify Φ ≠ 0.75 |

---

## Remaining Risks After Repair

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| nine_signal cosmetic proxies may persist in third-party tool integrations | Medium | Low | Include in integration test suite |
| SESAT/HANTAR integration may miss edge cases (non-failure paths) | Low | Low | Unit tests for each integration point |
| MALU persistence may diverge from in-memory state if file write fails | Low | Medium | Add write-verification to malu_state.json save |
| Emergence assertion remains unvalidated | High | Medium | Requires separate experiment design — not a bug fix |
| No empirical calibration of G thresholds (0.80 is asserted) | Medium | Medium | Requires longitudinal measurement across 100+ tool calls |

---

## DRAFT_RECEIPT

```yaml
DRAFT_RECEIPT:
  title: APEX_THEORY_VALIDATION_DOCKET
  status: DRAFT_ONLY_NOT_SEALED
  doctrine: DITEMPA_BUKAN_DIBERI
  agents:
    - FORMULA_REALITY_AUDITOR
    - CONTRAST_EXPERIMENT_DESIGNER
    - EMERGENCE_AND_QUANTUM_CLAIM_TESTER
  overall_verdict: SESAT
  equation_verdicts:
    G_A_P_E_X_Phi: PARTIAL_SESAT
    C_dark: PARTIAL_SESAT
    W3: PARTIAL_SESAT_WRONG_FORMULA_LIVE
    MALU: VERIFIED_LIVE
    SESAT: VERIFIED_DEAD_CODE
    HANTAR: VERIFIED_DEAD_CODE
    PARUT: VERIFIED_DEAD_CODE
    Phi: PARTIAL_SESAT_HARDCODED
    nine_signal: COSMETIC_PROXY
  evidence:
    files_inspected: 15 core files across arifOS + A-FORGE
    searches_run: 12 grep patterns across 6 organ directories
    contrast_scenarios: 14
    threshold_tests_passed: 7/7
    faking_patterns_found: 5 (2 HIGH, 3 MEDIUM)
    dead_modules: 3 (sesat_event, hantar, compute_floor_product)
    wrong_formulas_live: 1 (W³ in core/intelligence.py — 3 callers)
    bugs_found: 1 (sabar_gate.py:158 malu recording)
    bug_fixes_proposed: 7
    emergence_experiment_exists: false
  blocked_claims:
    - any nine_signal claiming genuine governance signal
    - any W³ from core/intelligence.py arithmetic mean
    - any literal quantum claim without quantum hardware
    - any emergence claim without measurement instrumentation
    - any BIJAKSANA label from status-only label
  next_actions:
    - P0: Fix core/intelligence.py W³ formula (geometric mean)
    - P0: Wire _apex_scores into tool outputs
    - P0: Fix sabar_gate.py malu recording
    - P1: Wire emit_sesat() into failure paths
    - P1: Wire hantar_wrap() into tool result construction
    - P2: Replace hardcoded APEX inputs with live telemetry
    - P2: Derive Φ from witness data in PCA path
  remaining_risks:
    - Emergence unvalidated (no controlled experiment)
    - G thresholds uncalibrated (0.80 asserted)
    - SESAT/HANTAR integration may miss edge cases
  requires: external_sovereign_review
  seal_proposal: DEFER — not until P0 fixes applied and verified
```

---

*DRAFT RECEIPT — DO NOT SEAL. Requires Arif review and P0 fixes.*
*DITEMPA BUKAN DIBERI — APEX survives hostile measurement by confessing where it fails.*
