# FORMULA REALITY REPORT — APEX Theory Validation

> **Auditor:** FORMULA_REALITY_AUDITOR
> **Date:** 2026-07-06
> **Scope:** /root/arifOS + /root/A-FORGE
> **Method:** Static code analysis — read implementations, trace call graphs, verify formulas against canonical equations
> **Doctrine:** DITEMPA BUKAN DIBERI. Do not praise APEX. Test it.

---

## Executive Summary

Of 9 tracked APEX primitives, **3 are verified-live with correct formulas**, **3 are dead code with zero callers**, **2 are partially live with formula/input defects**, and **1 is cosmetic-only** (status-to-label mapping with ~39 call sites).

The production judgment pipeline (`calculate_genius` → `_3_apex.py`) correctly computes G = A·P·E·X·Φ from real 13-floor scores. But a parallel dead-input path in `tools.py` genius mode feeds hardcoded 0.7/0.6 values into `compute_apex()` and returns the same G every time. The newly forged SESAT, HANTAR, and PARUT modules are structurally complete but have zero external callers — they are dead code awaiting integration.

**5 faking patterns survive the patches.** 3 are structural. 2 are input-level.

---

## Per-Equation Verdicts

### 1. G = A · P · E · X · Φ — PARTIAL

| Implementation | File:Line | Formula | Data Source | Live Callers | Verdict |
|---|---|---|---|---|---|
| `calculate_genius()` | `core/enforcement/genius.py:613` | `A * P * E * X * Φ * (1-h)` | Real 13-floor scores via PCA/cluster | `_3_apex.py:504` (main judgment path) | **VERIFIED_LIVE** |
| `compute_apex()` | `arifosmcp/runtime/apex_c_dark.py:195` | `A * P * E * X * Phi` | **HARDCODED** (0.7, 0.7, 0.7, 0.6, 0.6) | `tools.py:13363` (genius mode) | **COSMETIC_PROXY** |
| `GovernanceScore.g_score()` | `arifosmcp/kernel/apex_decision_field.py:65` | `A * P * E * X` (4-factor, missing Φ) | Real inputs from capability assessment | `assess_apex_decision_field()` | **PARTIAL** (missing Φ) |

**Evidence:**
- `genius.py:612-613`: `g_gen = akal * presence * energy * exploration * phi` — correct 5-factor formula. Dials derived from real floor scores via PCA eigendecomposition (≥5 observations) or geometric mean cluster projection (fallback).
- `tools.py:13364-13368`: `adaptation=0.7, perception=0.7, execution=0.7, cross_domain=0.6, integration=0.6` — every genius mode call returns G=0.12348. The TODO comments say "Phase 2: derive from live telemetry" but Phase 2 never happened.
- `apex_decision_field.py:65`: Epoch 36Ω uses 4-factor `A*P*E*X`. The Φ dial was added later in genius.py but not retrofitted here.

**The real production G** flows through `calculate_genius()` in `core/enforcement/genius.py`, called from `_3_apex.py:504` in the main `judge_apex()` pipeline. This path uses real floor scores. It is correct.

**The cosmetic G** flows through `compute_apex()` in `tools.py` genius mode. It is a demo stub that was never upgraded.

---

### 2. C_dark = A · (1-P) · (1-X) — PARTIAL

| Implementation | File:Line | Formula | Data Source | Live Callers | Verdict |
|---|---|---|---|---|---|
| `compute_apex()` | `arifosmcp/runtime/apex_c_dark.py:198` | `A * (1-P) * (1-X)` | Hardcoded (same as G) | `tools.py:13363` | **COSMETIC_PROXY** |
| `compute_c_dark()` | `arifosmcp/runtime/apex_c_dark.py:282` | `A * (1-P) * (1-X)` | Standalone, correct formula | Zero external callers | **VERIFIED_DEAD_CODE** |
| `_compute_c_dark()` | `arifosmcp/runtime/post_observe_gate.py:149-160` | `0.25*H + 0.20*scar + 0.15*godel + 0.15*hum + 0.25*ToM` | Real observation data | `post_observe_gate():255` | **VERIFIED_LIVE** (different formula) |

**Evidence:**
- `apex_c_dark.py:198`: `C_dark = A * (1 - P) * (1 - X)` — canonical formula. Correct.
- `post_observe_gate.py:153-160`: 5-component weighted sum. This is NOT `A*(1-P)*(1-X)`. It measures hallucination risk from observation content (hantu patterns, unresolved scars, circular reasoning, humility violations). It is a different C_dark — the F9 ANTIHANTU variant.
- Both formulas are labeled "C_dark" but measure different things. The `apex_c_dark.py` version measures intelligence parameter misalignment. The `post_observe_gate.py` version measures observation content hallucination markers.

**The two C_dark implementations are not duplicates — they are complementary.** But only the post_observe_gate version is live. The canonical `A*(1-P)*(1-X)` version is only called with hardcoded inputs.

---

### 3. W³ = ∛(H × AI × Ext) — PARTIAL (one correct, one WRONG)

| Implementation | File:Line | Formula | Data Source | Live Callers | Verdict |
|---|---|---|---|---|---|
| `compute_w3()` | `arifosmcp/runtime/phoenix_72.py:134` | `(h * ai * ext) ** (1/3)` | Real tri-witness dict | `should_seal():172` | **VERIFIED_LIVE** |
| `compute_w3()` | `core/intelligence.py:5` | `(h + ai + ext) / 3.0` | Real scores | 3 skill handlers | **COSMETIC_PROXY — WRONG FORMULA** |

**Evidence:**
- `phoenix_72.py:134`: `w3 = (h * ai * ext) ** (1/3)` — correct Nash geometric mean. Supports both boolean and numeric inputs. Zero in any channel collapses W³ to 0. Correct.
- `core/intelligence.py:5`: `return round((human_score + ai_score + earth_score) / 3.0, 3)` — **ARITHMETIC MEAN, NOT GEOMETRIC MEAN.** This is mathematically wrong for W³. An arithmetic mean does not collapse to zero when one channel is zero. The Nash (1950) bargaining solution requires geometric mean.

**Live callers using the WRONG formula:**
- `skills/constitutional-check/handler.py:47` — `w3 = compute_w3(human, ai, earth)`
- `skills/deep-research/handler.py:78` — `w3 = compute_w3(human_score=0.95, ai_score=0.92, earth_score=verified["consistency"])`
- `core/execution_validator.py:53` — `w3 = compute_w3(1.0 if human_approved else 0.8, 0.95 if actual.get("success") else 0.3, integrity_score)`

**This is a FAKING PATTERN.** The function is named `compute_w3` and returns a value called `w3_score`, but it computes arithmetic mean instead of geometric mean. The Nash collapse property (zero in any channel → W³=0) is lost.

---

### 4. MALU — VERIFIED_LIVE (with caveats)

| Aspect | File:Line | Status |
|---|---|---|
| Accumulator | `malu_score.py:205-358` | **VERIFIED_LIVE** — full MaluScore class |
| Persistence | `malu_score.py:371-397` | **VERIFIED_LIVE** — saves to `malu_state.json`, loads on import |
| `record_malu_event()` | `malu_score.py:407-412` | **VERIFIED_LIVE** — 6+ callers |
| `get_malu_score()` | `malu_score.py:400-404` | **VERIFIED_LIVE** — darjat_engine, metabolic_loop, agent_binding, simulative_gate, decision_torus |
| `compute_floor_product()` | `malu_score.py:101-161` | **VERIFIED_DEAD_CODE** — zero external callers |

**Evidence of live callers:**
- `darjat_engine.py:358` — `malu = get_malu_score(agent_id)`
- `metabolic_loop.py:383` — `ms = get_malu_score(self.agent_id)`
- `agent_binding.py:189` — `ms = get_malu_score(agent_id)`
- `simulative_gate.py:162` — `ms = get_malu_score(agent_id)`
- `decision_torus.py:266` — `ms = get_malu_score(agent_id)`
- `sabar_gate.py:158` — `record_malu_event(actor_id=..., reason=..., malu_delta=..., source=...)`

**BUG in sabar_gate.py:158-162:**
```python
receipt = record_malu_event(
    actor_id=actor_id,
    reason=reason,          # ← This is NOT adat_id!
    malu_delta=malu_delta,
    source=GATE_ID,
)
```
`record_malu_event()` signature: `(actor_id: str, adat_id: str, **kwargs)`. The `reason` kwarg does not match `adat_id`. The `adat_id` positional parameter is missing. This will either raise TypeError (missing `adat_id`) or be silently caught by the `except Exception` at line 170. Either way, **malu recording from sabar_gate is broken.** The fallback returns `sealed: False`.

**`compute_floor_product()` dead code:**
- `malu_score.py:101` — multiplicative floor-product per CMAG (arxiv 2603.13189). Correct implementation. Zero callers anywhere in the codebase. The docstring says "Draft stage — pending F13 ratification for binding switch."

---

### 5. SESAT — VERIFIED_DEAD_CODE

| Aspect | File:Line | Status |
|---|---|---|
| `SesatEvent` dataclass | `sesat_event.py:78-155` | Correct, complete |
| 9 JALAN failure codes | `sesat_event.py:33-42` | Correct, all 9 present |
| MALU deltas per code | `sesat_event.py:46-56` | Correct, differentiated |
| `emit_sesat()` | `sesat_event.py:158-190` | Correct, but **zero external callers** |
| Auto-MALU on severity | `sesat_event.py:119-128` | Correct — ORANGE+ requires SAKSI |

**Call graph:**
- `hantar.py:27` — `from arifosmcp.runtime.sesat_event import SesatEvent` (type import)
- `hantar.py:147` — `SesatEvent()` auto-generated in `__post_init__` when state=SESAT
- **Zero external callers of `emit_sesat()` or direct `SesatEvent()` construction.**

SESAT is structurally complete — the dataclass, the 9 JALAN codes, the MALU deltas, the severity escalation. But nobody calls it. No runtime failure path creates a SesatEvent.

---

### 6. HANTAR — VERIFIED_DEAD_CODE

| Aspect | File:Line | Status |
|---|---|---|
| `HantarEnvelope` dataclass | `hantar.py:105-191` | Correct, complete |
| State invariant enforcement | `hantar.py:144-159` | Correct — SESAT↔sesat auto-link |
| `MaluState` | `hantar.py:64-74` | Correct |
| `ParutState` | `hantar.py:78-87` | Correct |
| `TebusState` | `hantar.py:91-101` | Correct |
| `hantar_wrap()` | `hantar.py:194-220` | Correct, but **zero external callers** |

**Call graph:**
- `hantar.py:194` — `hantar_wrap()` defined
- `hantar.py:211` — `HantarEnvelope()` constructed inside `hantar_wrap()`
- **Zero external callers.** No tool result, no organ handoff, no state transfer uses HantarEnvelope.

HANTAR is the governed envelope for inter-node communication. The doctrine says "WAJIB on every communication." The implementation says "nobody uses it."

---

### 7. Φ (Integration / Witness Dial) — PARTIAL

| Path | File:Line | Derivation | Live |
|---|---|---|---|
| Cluster path | `genius.py:349-353` | `tri_witness * (1 - toac_contrast) * f13_sovereign` | **YES** — real data |
| PCA path | `genius.py:279` | `PHI=0.75` hardcoded | **YES** — but placeholder |
| Fallback | `genius.py:610` | `getattr(dials, 'PHI', 0.8)` | **YES** — default 0.8 |
| apex_c_dark | `apex_c_dark.py:192` | Input parameter, clamped | Only via hardcoded caller |

**Evidence:**
- `genius.py:349-353`: `phi = tri_witness * (1.0 - min(toac_contrast, 0.99)) * getattr(floors, 'f13_sovereign', 0.9)` — derived from real constitutional floor scores. This is the cluster path used when <5 verdicts accumulated.
- `genius.py:279`: `PHI=0.75,  # ZEN placeholder; full witness from telemetry in cluster path` — in the PCA eigendecomposition path, Φ is hardcoded. The comment acknowledges it's a placeholder.
- `genius.py:610`: `phi = getattr(dials, 'PHI', 0.8)` — if PHI is missing from dials, defaults to 0.8. This is a safety fallback, not a real computation.

**Verdict:** Φ is LIVE in the cluster path with real data. In the PCA path, it is a HARDCODED PLACEHOLDER (0.75). The PCA path is used when ≥5 verdicts have been accumulated — which is the more mature runtime state. So the more the system runs, the more it falls into the path with hardcoded Φ.

---

### 8. PARUT (Scar Memory) — VERIFIED_DEAD_CODE

| Aspect | File:Line | Status |
|---|---|---|
| `ParutState` dataclass | `hantar.py:78-87` | Correct — triggered, parut_id, repeated_failure_count, constraint |
| Referenced in SesatEvent | `sesat_event.py` (via repair_chain) | Only as string labels |
| Live tracking | — | **NONE** — no standalone PARUT tracking outside HantarEnvelope |

PARUT exists only inside `HantarEnvelope.ParutState`. Since HantarEnvelope has zero callers, ParutState is never instantiated in production. There is no independent scar memory system that tracks repeated failures and generates constraints.

---

### 9. nine_signal — COSMETIC_PROXY

| Implementation | File:Line | Type | Live Callers |
|---|---|---|---|
| `_nine_signal_from_status()` | `tools.py:2239-2314` | Status → label lookup | **~39 call sites** (tools.py + law.py) |
| `_nine_signal_from_apex()` | `tools.py:2317-2381` | G, C_dark → signal derivation | **0 reachable** (gated by `_apex_scores`) |
| `_inject_nine_signal()` | `tools.py:2384-2405` | Router — tries apex, falls back to status | Called from `_enforce_nine_signal()` |

**Evidence:**
- `_nine_signal_from_status()` maps status strings (OK, SEAL, HOLD, VOID, SABAR, DEGRADED, etc.) to static label dicts. No computation. Pure lookup. Used by **35+ direct call sites** in tools.py and **4 call sites** in law.py.
- `_nine_signal_from_apex()` correctly derives signals from G, C_dark, and system_health. But it is only called from `_inject_nine_signal()` at line 2394, which checks `out.get("_apex_scores")`. **No tool in the entire codebase ever sets `_apex_scores` in its output.** The grep for `_apex_scores` returns exactly 1 match — the check itself at line 2392.
- Therefore: `_nine_signal_from_apex()` is **functionally dead code** — correct formula, zero reachable callers in production.

**The 35+ direct calls bypass `_inject_nine_signal` entirely.** They call `_nine_signal_from_status()` directly, e.g.:
```python
"nine_signal": _nine_signal_from_status("HOLD")  # tools.py:8835
```

**This is the largest faking pattern by call-site count.** Every tool response carries a "nine_signal" block that is a pure cosmetic label derived from the response status string. The APEX-derived version exists but is unreachable.

---

## Per-File Summary

| File | Lines | APEX Relevance | Status |
|---|---|---|---|
| `arifosmcp/runtime/apex_c_dark.py` | 333 | G, C_dark formulas + verdict logic | Formulas correct. Called only with hardcoded inputs from tools.py genius mode. |
| `core/enforcement/genius.py` | 657 | G = A·P·E·X·Φ, PCA dials, cluster dials | **PRIMARY LIVE PATH.** Real floor scores → real G. Φ hardcoded in PCA path. |
| `arifosmcp/runtime/phoenix_72.py` | 531 | W³ geometric mean, should_seal | Correct formula. Called from should_seal(). Live. |
| `core/intelligence.py` | 11 | W³ (WRONG), omega_zero | **WRONG FORMULA.** Arithmetic mean instead of geometric. 3 live callers. |
| `arifosmcp/runtime/malu_score.py` | 448 | MALU accumulator, persistence, floor product | Accumulator + persistence: LIVE. floor_product: DEAD. |
| `arifosmcp/runtime/sesat_event.py` | 190 | SESAT failure object, 9 JALAN codes | Structurally complete. Zero external callers. DEAD. |
| `arifosmcp/runtime/hantar.py` | 220 | HANTAR envelope, ParutState, TebusState | Structurally complete. Zero external callers. DEAD. |
| `arifosmcp/runtime/tools.py` | 19825 | nine_signal, genius mode, system_health_score | ~39 cosmetic nine_signal calls. Genius mode uses hardcoded inputs. system_health_score correctly labeled as NOT APEX G. |
| `arifosmcp/kernel/apex_decision_field.py` | 267 | G36 = A*P*E*X (4-factor), C_dark with Q factor | Used in capability formation gates. Missing Φ. |
| `arifosmcp/runtime/post_observe_gate.py` | 376 | C_dark (5-component variant) | LIVE with real observation data. Different formula than canonical. |
| `arifosmcp/runtime/philosophy.py` | 533 | compute_G (quantizer), compute_Omega | Not APEX G — quantizer for atlas coordinates. Has live callers. |
| `core/organs/_3_apex.py` | 723 | judge_apex() — main APEX judgment | Calls calculate_genius() with real floor scores. LIVE. |
| `core/judgment.py` | 509 | judge_apex(), judge_cognition() | Uses genius_score from calculate_genius(). LIVE. |
| `arifosmcp/runtime/enforcer.py` | 709 | Hardcoded g_score=0.2 for blocked paths | FAKING PATTERN — hardcoded score for governance blocks. |
| `core/organs/_5_wealth.py` | 256 | g_score=0.85 default in EconomicEnvelope | FAKING PATTERN — hardcoded default. |

---

## Metrics

### Live Caller Coverage

| Primitive | Has Live Callers? | Count |
|---|---|---|
| G | YES | 2 paths (calculate_genius + compute_apex) |
| C_dark | YES | 1 path (post_observe_gate) + 1 dead (compute_c_dark) |
| W³ | YES | 1 correct (phoenix_72) + 3 wrong (core/intelligence) |
| MALU | YES | 6+ callers |
| SESAT | **NO** | 0 |
| HANTAR | **NO** | 0 |
| Φ | YES (partial) | 1 live (cluster), 1 hardcoded (PCA) |
| PARUT | **NO** | 0 |
| nine_signal | YES | ~39 callers (all cosmetic) |

**Live caller coverage: 6/9 = 67%** (G, C_dark, W³, MALU, Φ, nine_signal)
**Correct-formula live coverage: 4/9 = 44%** (G via calculate_genius, C_dark via post_observe_gate, W³ via phoenix_72, MALU)

### Formula Fidelity

| Primitive | Matches Canonical Equation? | Notes |
|---|---|---|
| G (calculate_genius) | **YES** | A·P·E·X·Φ from real floors |
| G (compute_apex) | **YES** (formula) / **NO** (inputs) | Hardcoded 0.7/0.6 |
| G (apex_decision_field) | **PARTIAL** | 4-factor, missing Φ |
| C_dark (apex_c_dark) | **YES** | A·(1-P)·(1-X), but dead inputs |
| C_dark (post_observe_gate) | **NO** (different formula) | 5-component weighted sum — intentional variant |
| W³ (phoenix_72) | **YES** | cbrt(H×AI×Ext) |
| W³ (core/intelligence) | **NO** | Arithmetic mean — WRONG |
| MALU | **YES** | Monotonic accumulation with tebus decay |
| Φ (cluster) | **YES** | tri_witness × (1-contrast) × f13 |
| Φ (PCA) | **NO** | Hardcoded 0.75 |
| nine_signal_from_apex | **YES** | G/C_dark → signal mapping |
| nine_signal_from_status | **N/A** | Label-only, no formula |

**Formula fidelity: 7/12 formula instances correct = 58%**
**Excluding intentional variants: 7/10 = 70%**

### Dead Code Ratio

| Category | Count | Items |
|---|---|---|
| Dead modules (zero external callers) | 3 | sesat_event.py, hantar.py, compute_floor_product |
| Dead functions (unreachable in production) | 2 | _nine_signal_from_apex, emit_sesat |
| Hardcoded-input stubs | 2 | compute_apex in tools.py genius mode, PHI=0.75 in PCA path |
| Total tracked code surfaces | ~14 | — |

**Dead code ratio: 5/14 = 36%** (dead modules + dead functions)
**Including hardcoded stubs: 7/14 = 50%**

### Proxy Mislabel Count

| # | Location | What It Is | What It's Called | Severity |
|---|---|---|---|---|
| 1 | `core/intelligence.py:5` | Arithmetic mean | `compute_w3` (W³) | **HIGH** — 3 live callers compute wrong W³ |
| 2 | `tools.py:2239` (×39 sites) | Status→label lookup | `nine_signal` | **HIGH** — presented as governance signal |
| 3 | `tools.py:13364-13368` | Hardcoded 0.7/0.6 stub | `compute_apex` (G, C_dark) | **MEDIUM** — labeled with TODO |
| 4 | `enforcer.py:403` | Hardcoded 0.2 | `g_score` | **MEDIUM** — used for blocked-path atlas |
| 5 | `_5_wealth.py:56` | Hardcoded 0.85 | `g_score` default | **LOW** — default value in model |

**Proxy mislabel count: 5**

---

## Remaining Faking Patterns

### FAKING-1: `core/intelligence.py:5` — Wrong W³ formula (HIGH)

```python
def compute_w3(human_score: float, ai_score: float, earth_score: float) -> float:
    return round((human_score + ai_score + earth_score) / 3.0, 3)  # ← ARITHMETIC MEAN
```

Should be: `round((human_score * ai_score * earth_score) ** (1/3), 3)`

Called by 3 live skill handlers. The Nash collapse property (any zero → W³=0) is lost. With arithmetic mean, `compute_w3(0.95, 0.0, 0.8)` returns 0.583 instead of 0.0.

### FAKING-2: `_nine_signal_from_status()` — Cosmetic labels (HIGH)

35+ direct call sites in tools.py and 4 in law.py use `_nine_signal_from_status("HOLD")` to produce a static label block. The `_nine_signal_from_apex()` function exists to derive signals from real G/C_dark values, but it is gated behind `_apex_scores` which is never populated by any tool. All 39 call sites produce cosmetic labels.

### FAKING-3: `tools.py:13364-13368` — Hardcoded APEX inputs (MEDIUM)

```python
apex_v = compute_apex(
    adaptation=0.7,  # TODO: derive from live tool call success rate
    perception=0.7,  # TODO: derive from evidence floor compliance
    execution=0.7,   # TODO: derive from forge execution success rate
    cross_domain=0.6, # TODO: derive from inter-organ routing success
    integration=0.6,  # TODO: derive from scar feedback / Φ
)
```

Every genius mode call returns identical G=0.12348, C_dark=0.084. The TODO comments have been there since the patch was applied. Phase 2 never happened.

### FAKING-4: `enforcer.py:403` — Hardcoded g_score for blocked paths (MEDIUM)

```python
scores = AtlasScores(
    delta_s=1.0,
    g_score=0.2,      # ← HARDCODED
    omega_score=0.9,
    ...
)
```

When a tool call is governance-blocked, the enforcer feeds g_score=0.2 into the philosophy selector. This is not measured — it is assigned.

### FAKING-5: `genius.py:279` — Hardcoded Φ in PCA path (MEDIUM)

```python
dials = APEXDials(
    ...
    PHI=0.75,  # ZEN placeholder; full witness from telemetry in cluster path
)
```

When the system has ≥5 accumulated verdicts, it uses PCA eigendecomposition. In that path, Φ is hardcoded to 0.75. The cluster path (used for <5 verdicts) correctly derives Φ from `tri_witness * (1-toac_contrast) * f13_sovereign`. The more mature the system, the more it relies on the hardcoded placeholder.

---

## Additional Findings

### BUG: `sabar_gate.py:158` — record_malu_event argument mismatch

```python
receipt = record_malu_event(
    actor_id=actor_id,
    reason=reason,          # ← NOT adat_id!
    malu_delta=malu_delta,
    source=GATE_ID,
)
```

`record_malu_event(actor_id, adat_id, **kwargs)` expects `adat_id` as second positional. `reason` is passed as keyword, leaving `adat_id` unset. This will raise TypeError, caught by `except Exception` at line 170, returning `sealed: False`. **MALU recording from sabar_gate is silently broken.**

### OBSERVATION: Two C_dark implementations measure different things

- `apex_c_dark.py`: C_dark = A·(1-P)·(1-X) — measures intelligence parameter misalignment
- `post_observe_gate.py`: C_dark = 0.25·H + 0.20·scar + 0.15·godel + 0.15·hum + 0.25·ToM — measures observation content hallucination markers

Both are labeled "C_dark" in their respective domains. This is not a bug — they serve different purposes. But it means the canonical `A·(1-P)·(1-X)` formula has zero live callers with real data.

### OBSERVATION: compute_floor_product has correct CMAG implementation but zero callers

`malu_score.py:101-161` implements the multiplicative floor-product per CMAG (arxiv 2603.13189). The docstring says "Draft stage — pending F13 ratification for binding switch." It is correct, complete, and dead.

---

## Summary Scorecard

| Metric | Value | Target | Gap |
|---|---|---|---|
| Live caller coverage | 67% (6/9) | 100% | SESAT, HANTAR, PARUT |
| Correct-formula live coverage | 44% (4/9) | 100% | +3 partial + 2 dead |
| Formula fidelity | 58% (7/12) | 100% | W³ wrong, Φ PCA hardcoded |
| Dead code ratio | 36% (5/14) | 0% | 3 modules + 2 functions |
| Proxy mislabel count | 5 | 0 | See FAKING 1-5 |
| Surviving faking patterns | 5 | 0 | 2 HIGH, 3 MEDIUM |

---

## Recommendations (prioritized)

1. **FIX `core/intelligence.py:5`** — Replace arithmetic mean with geometric mean. 3 live callers affected. One-line fix.
2. **WIRE `_apex_scores` into tool outputs** — Make `_nine_signal_from_apex()` reachable. Requires tools to compute and pass G/C_dark in their output dicts.
3. **INTEGRATE SESAT/HANTAR** — Wire `emit_sesat()` into failure paths and `hantar_wrap()` into tool result construction. These modules are correct but unused.
4. **FIX `sabar_gate.py:158`** — Change `reason=reason` to pass a valid `adat_id`. MALU recording from SABAR gate is broken.
5. **DERIVE APEX inputs in tools.py genius mode** — Replace hardcoded 0.7/0.6 with live telemetry. The TODO comments exist; the derivation does not.
6. **FIX Φ in PCA path** — Derive from tri_witness and ToAC contrast, not hardcoded 0.75.
7. **FIX `enforcer.py:403`** — Derive g_score from actual governance state, not hardcoded 0.2.

---

*Report generated: 2026-07-06*
*Auditor: FORMULA_REALITY_AUDITOR*
*Verdict: DITEMPA BUKAN DIBERI — The equations are forged. The runtime is catching up. 5 faking patterns remain.*
