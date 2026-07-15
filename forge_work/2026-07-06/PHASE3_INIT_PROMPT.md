# PHASE 3 INIT PROMPT — APEX Membrane: Live Instrumentation
═══════════════════════════════════════════════════════════

You are continuing the APEX Membrane Migration for the arifOS federation.
Phase 2 is sealed (VAULT999 seq=70). The membrane is live. Now wire the
measurement INTO reality.

---

## WHAT PHASE 2 BUILT (do not rebuild)

- `arif_judge` accepts `measurement` dict → F9/F8 floor gates ✅
- APEX modules in `A-FORGE/src/domain/apex/` ✅
- `apex_primitives.py` — derives A,P,E,X,Φ from tool call metrics ✅
- `governed_vs_baseline.py` — compares governed vs ungoverned ✅
- MALU persists to SQLite ✅
- SESAT in all failure paths ✅
- HANTAR utility ✅
- D-MEMBRANE 11/11 PASS, ABCD 17/17 PASS ✅

---

## PHASE 3 TASKS (in order)

### T1: Wire `record_tool_call()` into live tool paths

File: `/root/arifOS/arifosmcp/runtime/tools.py`

The `record_tool_call()` function in `apex_primitives.py` exists but is
never called. Wire it into the actual tool execution paths:

- In `_ok()`: call `record_tool_call(tool, success=True, ...)`
- In `_hold()`: call `record_tool_call(tool, success=False, ...)`
- In `_sabar()`: call `record_tool_call(tool, success=False, failure_code="SABAR", ...)`

Extract evidence/lease/reversible flags from the tool context where available.
Default to safe values when unknown.

**Verify:** After wiring, run a few tool calls, then check:
```python
from arifosmcp.runtime.apex_primitives import compute_apex_from_metrics
print(compute_apex_from_metrics())
```
Should return real A,P,E,X,Φ values (not defaults).

### T2: Wire `compute_apex_from_metrics()` into A-FORGE measurement flow

File: `/root/A-FORGE/src/interfaces/mcp/core.ts` (or wherever forge_evaluate is called)

When A-FORGE builds a MeasurementPacket to pass to `forge_judge_proxy`,
it should call the Python `compute_apex_from_metrics()` function to get
real primitives instead of using placeholder values.

Options:
- A-FORGE calls a new MCP tool `forge_compute_apex` that returns the metrics
- Or A-FORGE reads the SQLite directly via a helper

Choose the simpler path. The key constraint: A-FORGE computes, kernel reads.

### T3: Wire `record_comparison()` for governed-vs-baseline

File: `/root/arifOS/arifosmcp/runtime/tools.py`

In the kernel intercept paths (`_arif_kernel_intercept`, `_arif_judge_deliberate`),
record both the governed verdict AND what a baseline (ungoverned) would have
returned. This populates the `governed_vs_baseline.py` metrics.

- Baseline verdict = "ALLOW" for all actions (the ungoverned default)
- Governed verdict = actual kernel decision
- Call `record_comparison()` with both

### T4: Verify end-to-end measurement flow

Run this test:
```python
# 1. Make some tool calls (any MCP tool)
# 2. Check metrics populated
from arifosmcp.runtime.apex_primitives import compute_apex_from_metrics
m = compute_apex_from_metrics()
assert m["sample_size"] > 0, "No metrics recorded"
assert m["G"] > 0, "G is zero"
print(f"A={m['A']}, P={m['P']}, E={m['E']}, X={m['X']}, Φ={m['Phi']}")
print(f"G={m['G']}, C_dark={m['C_dark']}")

# 3. Check comparison metrics
from arifosmcp.runtime.governed_vs_baseline import compute_comparison_metrics
c = compute_comparison_metrics()
print(f"Governance value: {c}")
```

### T5: Update membrane.py Phase 3 status

Add Phase 3 completion status to `/root/arifOS/arifosmcp/runtime/membrane.py`.

### T6: D-MEMBRANE Phase 3 tests

File: `/root/arifOS/tests/runtime/test_d_membrane.py`

Add tests:
- D-M12: `record_tool_call()` populates SQLite
- D-M13: `compute_apex_from_metrics()` returns real values after recording
- D-M14: `record_comparison()` populates governed-vs-baseline

### T7: Seal

- Run ABCD + D-MEMBRANE tests
- Commit + push both repos
- Restart services
- Seal to VAULT999 (seq=71)

---

## CONSTRAINTS

- **F1 AMANAH:** Every change reversible. Backup before edit.
- **F2 TRUTH:** Label everything OBS/DER/INT/SPEC.
- **F4 CLARITY:** ΔS ≤ 0. Leave no chaos.
- **F8 GENIUS:** Simplest correct path. Don't over-engineer.
- **F11 AUDIT:** Every change leaves a trace.
- **MEMBRANE-01:** Kernel reads measurement, never recomputes.
- **MEMBRANE-02:** A-FORGE computes, never verdicts.

## KEY FILES

```
/root/arifOS/arifosmcp/runtime/tools.py           — tool execution paths
/root/arifOS/arifosmcp/runtime/apex_primitives.py  — APEX from metrics
/root/arifOS/arifosmcp/runtime/governed_vs_baseline.py — comparison
/root/arifOS/arifosmcp/runtime/membrane.py         — membrane contract
/root/arifOS/arifosmcp/tools/arif_kernel_intercept.py — kernel intercept
/root/arifOS/tests/runtime/test_abcd_apex.py       — ABCD tests
/root/arifOS/tests/runtime/test_d_membrane.py      — D-MEMBRANE tests
/root/A-FORGE/src/interfaces/mcp/core.ts            — A-FORGE MCP tools
/root/A-FORGE/src/domain/forge/evaluate.ts          — APEX evaluation
/root/memory/2026-07-06.md                          — prior session memory
```

## THE END STATE

After Phase 3:
- Every tool call records APEX metrics (real data, not placeholders)
- A-FORGE passes real A,P,E,X,Φ in MeasurementPacket to kernel
- Kernel uses real G, C_dark for F9/F8 floor gates
- Governed-vs-baseline comparison shows governance value
- The membrane is not just defined — it's MEASURED

**Kernel kira hukum. A-FORGE kira ukuran. VAULT999 rekod.**

DITEMPA BUKAN DIBERI 🔥
