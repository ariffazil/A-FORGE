# ⚡ TEBUS · arifOS Kernel APEX Repair

> **Status:** DRAFT — NOT SEALED. Requires SAKSI before LURUS.
> **DITEMPA BUKAN DIBERI**

---

```yaml
TEBUS_RECEIPT:
  id: tebus-20260706-kernel-apex-cosmetic-001
  prior_sesat_id: sesat-20260706-kernel-cosmetic-apex-001
  repaired_by: FORGE-000
  repair_node: A-FORGE
  timestamp: "2026-07-06T01:30:00+08:00"

  root_cause: >
    arifOS Python kernel live runtime used cosmetic proxies for APEX G,
    boolean AND for W³, in-memory dict for MALU, and status→label lookup
    for nine_signal — while real implementations existed in dead code
    (apex_c_dark.py) and A-FORGE TypeScript.

  corrective_action: >
    Wired real APEX math into live kernel. Stopped false labels. Added
    structured SESAT_EVENT and HANTAR envelope. Made MALU persistent.

  patches_applied:
    - file: arifosmcp/runtime/tools.py
      changes:
        - "Renamed CPU proxy g_score → system_health_score with legacy alias"
        - "Added _nine_signal_from_apex() — real G/C_dark computation for nine_signal"
        - "Updated _inject_nine_signal() to prefer APEX scores when available"
        - "Replaced hardcoded g_score=0.97 in genius mode with real compute_apex() call"
        - "Added comment: 'NOT APEX G — this is infrastructure health'"

    - file: arifosmcp/runtime/phoenix_72.py
      changes:
        - "Added compute_w3() — real Nash geometric mean ∛(H×AI×Ext)"
        - "Replaced boolean AND tri_witness check with compute_w3()"
        - "Updated type annotations to accept bool|float witness confidences"

    - file: arifosmcp/runtime/malu_score.py
      changes:
        - "Added _save_registry() — persist MALU to /root/.local/share/arifos/malu_state.json"
        - "Added _load_registry() — auto-load on module import"
        - "Added record_malu_event() convenience function with auto-persist"
        - "Added _save_registry() calls after record_adat_violation and record_tebus_salah_progress"

    - file: arifosmcp/runtime/sesat_event.py (NEW)
      changes:
        - "Created SesatEvent dataclass with full schema"
        - "Created FailureCode enum (9 JALAN codes)"
        - "Created Severity enum (GREEN/YELLOW/ORANGE/RED/BLACK)"
        - "Created emit_sesat() convenience function"
        - "Auto-computes malu_delta from failure code"
        - "Auto-sets saksi_required for ORANGE+"

    - file: arifosmcp/runtime/hantar.py (NEW)
      changes:
        - "Created HantarEnvelope dataclass with full schema"
        - "Created HantarState enum (LURUS/SESAT/HOLD/VOID)"
        - "Created hantar_wrap() convenience function"
        - "Auto-generates SESAT if state=SESAT but no sesat provided"
        - "Auto-sets tebus.required if state=SESAT"

  evidence:
    compilation: "All 4 modules import and compute correctly"
    apex_G: "compute_apex(A=0.8,P=0.7,E=0.6,X=0.5,Phi=0.6) → G=0.1008, C_dark=0.1200"
    c_dark: "compute_c_dark(A=0.9,P=0.1,X=0.1) → 0.729 (correct: 0.9×0.9×0.9)"
    w3: "cbrt(0.8×0.6×0.4) = 0.5769 (correct geometric mean)"
    sesat_event: "emit_sesat() → structured object with severity, jalan, baik, lantai"
    hantar: "hantar_wrap() → envelope with state, sesat, malu, tebus"
    malu_persist: "/root/.local/share/arifos/malu_state.json created on first mutation"

  saksi:
    required: true
    witness_node: null  # NOT YET VERIFIED
    witness_verdict: null  # AWAITING SAKSI

  malu:
    total_before: 0.0
    total_after: 0.0  # No malu for self-repair

  state_after_repair: HOLD  # Cannot claim LURUS without SAKSI

  remaining_risk:
    - "Phase 1 APEX primitives (A,P,E,X,Phi) use defaults in genius mode — need live telemetry derivation"
    - "nine_signal_from_apex not yet called by all tool paths — only when _apex_scores present"
    - "HANTAR envelope not yet wrapping all kernel tool outputs — schema exists, wiring pending"
    - "forge_register still uses hardcoded 0.8 for A/P/E/X/Phi scores"
    - "Omega (calibration gap) still hardcoded 0.04/0.05 in A-FORGE evaluate.ts"
    - "W³ confidence values still caller-provided — no cryptographic binding to actual witness"
    - "MALU persistence is JSON file — should migrate to SQLite for concurrent access"

  invariants_added:
    - "system_health_score ≠ APEX G (comment + rename)"
    - "compute_w3() replaces boolean AND (phoenix_72.py)"
    - "MALU persists to disk (malu_score.py)"
    - "SESAT_EVENT is machine-readable (sesat_event.py)"
    - "HANTAR envelope exists (hantar.py)"

  next_safe_action: "External witness (SAKSI) verifies patched runtime before claiming LURUS"
```

---

## What Changed (summary)

| Before | After | File |
|--------|-------|------|
| `g_score = 1 - (cpu+mem+disk)/300` labeled as APEX G | `system_health_score` with explicit "NOT APEX G" comment | tools.py |
| `g_score: 0.97` hardcoded | Real `compute_apex()` call with 5 primitives | tools.py |
| `nine_signal` = status→BIJAKSANA label lookup | `_nine_signal_from_apex()` computes real G/C_dark | tools.py |
| `all([human, ai, earth])` boolean AND | `compute_w3()` = `∛(H×AI×Ext)` geometric mean | phoenix_72.py |
| `_REGISTRY: dict = {}` (in-memory, dies on restart) | Auto-persist to `/root/.local/share/arifos/malu_state.json` | malu_score.py |
| SESAT = string literal in array | `SesatEvent` dataclass with 9 JALAN codes, severity, baik, lantai | sesat_event.py (NEW) |
| HANTAR = does not exist | `HantarEnvelope` with state, sesat, malu, parut, tebus | hantar.py (NEW) |

---

## What's Still Needed (Phase 2)

1. **Derive APEX primitives from live telemetry** — A,P,E,X,Phi should come from actual tool call success rates, evidence floor compliance, execution success, inter-organ routing, and scar feedback. Currently defaults.

2. **Wire HANTAR into all kernel tool outputs** — every `_ok()`, `_hold()`, `_void()` return should wrap in HANTAR envelope.

3. **Wire `_nine_signal_from_apex()` into all tool paths** — currently only activates when `_apex_scores` dict is present in output.

4. **Fix `forge_register` hardcoded 0.8** — A-FORGE should recompute scores from prior `forge_evaluate` output.

5. **Migrate MALU to SQLite** — JSON file is single-process safe but not concurrent.

6. **Add `no_cosmetic_constitutional_labels` conformance test** — CI must fail if CPU proxy is labeled APEX G.

---

*DRAFT — NOT SEALED. SAKSI required before LURUS.*
*Forged: 2026-07-06 by FORGE (000Ω)*
*DITEMPA BUKAN DIBERI*
