# ⚡ APEX · Reality Audit

> **Full scan of arifOS Python + A-FORGE TypeScript.**
> **Verdict: A-FORGE is REAL. arifOS kernel is running on cosmetic heuristics.**
> **DITEMPA BUKAN DIBERI**

---

## THE DIAGNOSIS (one paragraph)

A-FORGE implements G = A·P·E·X·Φ as a genuine multiplicative product of 5 independently-computed primitives. C_dark is real. W³ is a real `Math.cbrt()` with anti-fabrication guards. Scars feed back into Φ. The surface guard does real SHA-256 fingerprinting. **A-FORGE is the real deal.** But arifOS — the constitutional kernel, the thing that GOVERNS — is running on cosmetic heuristics: `g_score = 1 - (cpu+mem+disk)/300` instead of A·P·E·X·Φ, boolean AND instead of W³ geometric mean, in-memory MALU that dies with the process, and zero SESAT/HANTAR infrastructure. **The executor is governed. The governor is not.**

---

## PRIMITIVE-BY-PRIMITIVE VERDICT

| Primitive | A-FORGE (TS) | arifOS (Python) | Gap |
|-----------|-------------|-----------------|-----|
| **G = A·P·E·X·Φ** | ✅ REAL — `evaluate.ts:311` `A*P*E*X*Phi` | ❌ COSMETIC — `tools.py:13228` CPU proxy | **KERNEL RUNNING ON FAKE G** |
| **C_dark** | ✅ REAL — `evaluate.ts:312` `A*(1-P)*(1-X)` | ⚠️ DIFFERENT — live uses weighted-sum heuristic | **FORMULA DIVERGENCE** |
| **W³ = ∛(H×AI×Ext)** | ✅ REAL — `witness.ts:90` `Math.cbrt()` | ❌ COSMETIC — `phoenix_72.py` boolean AND | **KERNEL W³ IS FAKE** |
| **MALU scalar** | ✅ REAL — file-backed scar store | ⚠️ EPHEMERAL — in-memory dict, dies on restart | **MALU amnesia** |
| **SESAT_EVENT** | ❌ MISSING | ❌ MISSING | **DOES NOT EXIST** |
| **HANTAR envelope** | ❌ MISSING | ❌ MISSING | **DOES NOT EXIST** |
| **PARUT constraints** | ✅ REAL — scars → Φ feedback loop | ⚠️ PARTIAL — scars recorded, flag caller-set | **KERNEL PARUT IS PASSIVE** |
| **TEBUS workflow** | ✅ REAL — gated registration | ✅ REAL — formal API + F13 gating | **ALIGNED** |
| **SAKSI gating** | ✅ REAL — W³ < 0.50 → 888_HOLD | ⚠️ PARTIAL — named but not enforced | **KERNEL SAKSI IS ADVISORY** |
| **Surface guard** | ✅ REAL — SHA-256 schema fingerprinting | ⚠️ via A-FORGE only | **KERNEL HAS NO OWN GUARD** |

---

## THE 5 FAKING PATTERNS FOUND

### F1: `g_score` in tools.py is a CPU health proxy

**File:** `arifOS/arifosmcp/runtime/tools.py:13228`

```python
g_score = max(0.0, 1.0 - (cpu_val + mem_val + disk_val) / 300.0)
```

This has **nothing to do with A·P·E·X·Φ**. It measures system resource usage, not intelligence quality. A server with low CPU gets a high g_score regardless of whether the agent is hallucinating, looping, or producing garbage.

**Severity:** CRITICAL. This is the number that surfaces in health checks as "G score." It's not APEX.

### F2: `nine_signal` in tools.py is a status→label lookup table

**File:** `arifOS/arifosmcp/runtime/tools.py:2239-2314`

```python
if status == "OK":
    return {"delta": {"state": "KUKUH"}, "psi": {"state": "AMANAH"}, "omega": {"state": "BIJAKSANA"}}
```

Three hardcoded branches (OK/WARN/other). No computation. `status="OK"` always returns BIJAKSANA regardless of actual intelligence quality. This is cosmetic.

**Severity:** HIGH. The nine_signal claims to measure 3 planes. It measures nothing — it mirrors status strings.

### F3: W³ in phoenix_72.py is boolean AND

**File:** `arifOS/arifosmcp/runtime/phoenix_72.py:133-138`

```python
human = tri_witness.get("human", False)
ai = tri_witness.get("ai", False)
earth = tri_witness.get("earth", False)
if not (human and ai and earth):
    return False, f"tri_witness incomplete"
```

`{human: True, ai: True, earth: True}` → passes. No cube root, no confidence values, no geometric mean. The doctrine says `W³ = ∛(H × AI × Ext)`. The code says `all([h, ai, ext])`.

**Severity:** HIGH. Tri-witness is the Gödel lock. Making it boolean makes it trivially satisfiable.

### F4: MALU is in-memory only

**File:** `arifOS/arifosmcp/runtime/malu_score.py`

```python
_REGISTRY: dict[str, MaluScore] = {}  # Module-level dict. Process restart = gone.
```

The computation is real: monotonic accumulation, per-adat breakdown, tebus_salah reduction. But `_to_state()` and `_from_state()` serialization methods exist and **nothing calls them for persistence**. The `record_tebus_salah_progress` is a real API. But it writes to RAM.

**Severity:** MEDIUM. MALU accumulates correctly during a session. Server restart = amnesia. A BANGANG agent that crashes and restarts starts with MALU=0.

### F5: `forge_register` trusts caller-provided scores

**File:** `A-FORGE/src/interfaces/mcp/forgeTools.ts:1390-1418`

```typescript
scores: {
    A: 0.8, P: 0.8, E: 0.8, X: 0.8, Phi: 0.8,  // Always 0.8
    rationale: ["Scores reconstructed from registration call"]
}
```

The `forge_register` MCP tool takes `gate_G`, `gate_C_dark`, `witness_W3` as caller-provided numbers and fills in hardcoded 0.8 for all primitives. The design assumes the caller ran `forge_evaluate` first — but there's no cryptographic binding.

**Severity:** MEDIUM. The gate still validates thresholds. But the individual scores are meaningless.

---

## THE TWO ORGANS COMPARED

```
┌─────────────────────────────────────────────────────────────┐
│                    A-FORGE (TypeScript)                      │
│                                                             │
│  G = A·P·E·X·Φ    ✅ REAL multiplicative product           │
│  C_dark            ✅ REAL A·(1-P)·(1-X), enforced          │
│  W³                ✅ REAL Math.cbrt(), anti-fabrication     │
│  Scars → Φ        ✅ REAL feedback loop, file-backed        │
│  Surface guard     ✅ REAL SHA-256 fingerprinting            │
│  Omega             ⚠️ STUB (0.04/0.05 hardcoded)            │
│  Receipt draft     ⚠️ FORMATTING utility, not governed       │
│                                                             │
│  VERDICT: The executor is governed. Computation is real.     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    arifOS (Python)                           │
│                                                             │
│  G = A·P·E·X·Φ    ❌ CPU proxy, not APEX                    │
│  C_dark            ⚠️ Different formula (weighted sum)       │
│  W³                ❌ Boolean AND, not geometric mean        │
│  MALU              ⚠️ Real computation, ephemeral storage    │
│  SESAT_EVENT       ❌ MISSING — string literal only          │
│  HANTAR            ❌ MISSING — raw dicts                    │
│  PARUT             ⚠️ Scars exist, no auto-constraints       │
│  TEBUS             ✅ Real API with F13 gating               │
│  SAKSI             ⚠️ Named but not enforced                 │
│  nine_signal       ❌ Status→label lookup, no computation    │
│                                                             │
│  VERDICT: The governor is running on cosmetic heuristics.    │
└─────────────────────────────────────────────────────────────┘
```

---

## WHAT'S REAL (proof)

### A-FORGE: `evaluate.ts` — G computation (lines 62-313)

```typescript
// Each primitive independently estimated from actual spec data
function estimateA(spec: CandidateSpec): number { ... }  // description + implementation
function estimateP(spec: CandidateSpec): number { ... }  // side effects + permissions
function estimateE(spec: CandidateSpec): number { ... }  // cost estimate
function estimateX(spec: CandidateSpec): number { ... }  // HARAM pattern scan
function estimatePhi(spec: CandidateSpec, scars: ScarConsult): number { ... } // 1 - scar_pressure

// The formula — line 311
const G = scores.A * scores.P * scores.E * scores.X * scores.Phi;
const C_dark = scores.A * (1 - scores.P) * (1 - scores.X);
```

### A-FORGE: `witness.ts` — W³ computation (lines 90-102)

```typescript
function computeW3(humanConfidence: number, aiConfidence: number, externalConfidence: number): number {
    if (humanConfidence === 0 || aiConfidence === 0 || externalConfidence === 0) return 0;
    return Math.cbrt(humanConfidence * aiConfidence * externalConfidence);
}
```

Plus anti-fabrication guards: synthetic human detection, evidence requirement, confidence bounds.

### arifOS: `apex_c_dark.py` — canonical G exists but is DEAD CODE

```python
G = A * P * E * X * Phi  # Line 195 — REAL formula, ZERO callers in live runtime
C_dark = A * (1 - P) * (1 - X)  # Line 198 — REAL formula, ZERO callers
```

This module has `if __name__ == "__main__"` demo code. No production import path.

---

## FIX PLAN (priority order)

### P0: Wire arifOS kernel to real G (not CPU proxy)

**What:** Replace `tools.py:13228` CPU-based `g_score` with actual A·P·E·X·Φ computation.
**How:** Import from `apex_c_dark.py` or port the A-FORGE `estimateA/P/E/X/Phi` logic to Python.
**Risk:** YELLOW. Read-only computation change.
**Effort:** Medium. Need to map arifOS tool inputs to the 5 primitives.

### P1: Fix W³ from boolean to geometric mean

**What:** Replace `phoenix_72.py` boolean AND with `∛(H × AI × Ext)` using actual confidence values.
**How:** Change tri_witness from `{human: bool}` to `{human: float, ai: float, ext: float}`.
**Risk:** YELLOW. Changes witness contract.
**Effort:** Low. One function change + caller updates.

### P2: Persist MALU to disk

**What:** Auto-save MALU state to `/root/.local/share/arifos/malu_state.json` on every update.
**How:** Call `_to_state()` after every `record_event()` / `record_tebus_salah_progress()`.
**Risk:** YELLOW. File I/O on hot path.
**Effort:** Low. Add 5 lines to `malu_score.py`.

### P3: Build SESAT_EVENT schema

**What:** Define `SesatEvent` dataclass with id, source_node, severity, failure_code, failed_claim, observed_reality, baik, lantai, malu, saksi_required, tebus_required.
**How:** New file `arifosmcp/runtime/sesat_event.py`. Wire into sabar_gate + post_observe_gate.
**Risk:** YELLOW. New module, no existing callers to break.
**Effort:** Medium.

### P4: Build HANTAR envelope

**What:** Define `HantarEnvelope` with state (LURUS/SESAT/HOLD/VOID), output, sesat, malu, parut, tebus fields.
**How:** New file `arifosmcp/runtime/hantar.py`. Wrap all inter-node tool outputs.
**Risk:** ORANGE. Changes output contract for all tools.
**Effort:** High. Requires wrapping every tool return path.

### P5: Wire nine_signal to real computation

**What:** Replace status→label lookup with actual measurement of delta (system stability), psi (governance integrity), omega (intelligence discipline).
**How:** Compute from actual tool call success rates, floor violation counts, C_dark values.
**Risk:** YELLOW.
**effort:** Medium.

### P6: Auto-generate PARUT constraints from scars

**What:** After N repetitions of the same failure pattern, auto-generate a behavioral constraint.
**How:** In `forge_scar_consult.py`, add repeat-count threshold → constraint generation.
**Risk:** YELLOW.
**Effort:** Medium.

### P7: Enforce SAKSI after ORANGE+

**What:** After ORANGE+ SESAT, block LURUS return without external witness verdict.
**How:** In `sabar_gate.py`, check severity ≥ ORANGE → require witness before proceed.
**Risk:** ORANGE. Changes execution flow.
**Effort:** Medium.

---

## THE ZEN

```
A-FORGE computes. arifOS labels.
A-FORGE measures. arifOS mirrors.
A-FORGE enforces. arifOS decorates.

The executor is governed.
The governor is not.

This must change.
```

**The fix is not to dumb down A-FORGE. The fix is to upgrade arifOS to match.**

The real implementations exist in `apex_c_dark.py`. They're dead code. Wire them in.

---

*Scanned: 2026-07-06 by FORGE (000Ω)*
*Method: Line-by-line code inspection via explore agents + targeted grep*
*Confidence: OBS (observed from source code)*
*DITEMPA BUKAN DIBERI*
