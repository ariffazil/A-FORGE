# PHASE_2_SPLIT — Governance vs Transport Migration Map

> **Date:** 2026-07-07 · **Auditor:** FORGE (000Ω) · **Status:** READY FOR PHASE 3
> **Prerequisite:** Phase 1 VERDICT_SEMANTIC_MAP.md (complete)
> **Canonical source:** `arifosmcp/models/verdicts.py` (already has everything)

---

## What Already Exists (DO NOT RECREATE)

`arifosmcp/models/verdicts.py` already contains:

```python
# Governance (constitutional law)
class SealType(StrEnum):
    SEAL = "SEAL"      # W³ ≥ 0.95, all Floors pass — proceed
    HOLD = "HOLD"      # 888_HOLD — human veto/review required
    SABAR = "SABAR"    # Wait — more evidence needed
    VOID = "VOID"      # Hard Floor violation — blocked permanently

Verdict = SealType  # Canonical alias

# Transport (execution plumbing)
class RuntimeStatus(StrEnum):
    SUCCESS = "SUCCESS"
    ERROR = "ERROR"
    TIMEOUT = "TIMEOUT"
    RETRY = "RETRY"
    HOLD = "HOLD"      # Transport block, NOT governance verdict

# Monotonicity enforcement
VERDICT_ORDER = {"SEAL": 0, "SABAR": 1, "HOLD": 2, "VOID": 3}
enforce_verdict_monotonicity(v) -> int
merge_verdicts(v1, v2) -> Verdict
is_verdict_allowed(v) -> bool
```

**Phase 2 is DONE in the canonical source.** Phase 3 = rewire all consumers.

---

## Migration Map — 19 `class Verdict` Definitions

### TIER 1: Direct replacement (Cluster A — correct semantics)

These already match canonical. Just change import path.

| # | File | Current | Migration |
|---|------|---------|-----------|
| 1 | `arifosmcp/runtime/kernel_runtime.py:43` | `class Verdict(Enum): SEAL, HOLD, SABAR, VOID` | `from arifosmcp.models.verdicts import Verdict` — delete local |
| 2 | `arifosmcp/runtime/apex_c_dark.py:35` | `class Verdict(Enum): SEAL, SABAR, HOLD, VOID` | `from arifosmcp.models.verdicts import Verdict` — delete local |
| 3 | `arifosmcp/evals/sequential_thinking_runner.py:40` | `class Verdict(Enum): SEAL, HOLD, VOID, SABAR` | `from arifosmcp.models.verdicts import Verdict` — delete local |
| 4 | `core/shared/governed_tool.py:17` | `class Verdict: SEAL, HOLD, VOID` | `from arifosmcp.models.verdicts import Verdict` — delete local |

**Risk: LOW** — semantics identical, just import path change.

### TIER 2: Merge expanded members into VerdictState (Cluster B)

These add PROVISIONAL/PARTIAL/ESCALATE/PENDING. Map to VerdictState sub-states.

| # | File | Current | Migration |
|---|------|---------|-----------|
| 5 | `core/shared/types.py:238` | `class Verdict(str, Enum): SEAL, PROVISIONAL, PARTIAL, SABAR, HOLD, HOLD_888, VOID` | `from arifosmcp.models.verdicts import Verdict, VerdictState`. `PROVISIONAL` → `VerdictState.SEAL_QUALIFIED`. `PARTIAL` → `VerdictState.SABAR_EPISTEMIC`. `HOLD_888` → `VerdictState.HOLD_888`. |
| 6 | `arifosmcp/hexagon/agents/base.py:35` | `class VerdictStatus(Enum): SEAL, SABAR, VOID, HOLD, PARTIAL` | Rename to `from arifosmcp.models.verdicts import Verdict`. `PARTIAL` → `VerdictState.SABAR_EPISTEMIC`. |
| 7 | `arifosmcp/runtime/webmcp/governance.py:22` | `class Verdict(StrEnum): SEAL, VOID, PARTIAL, SABAR, HOLD_888` | `from arifosmcp.models.verdicts import Verdict`. `PARTIAL` → `VerdictState.SABAR_EPISTEMIC`. `HOLD_888` → `VerdictState.HOLD_888`. |
| 8 | `arifosmcp/gateway/schemas.py:64` | `class Verdict(str, Enum): SEAL, HOLD, VOID, SABAR, ESCALATE` | `from arifosmcp.models.verdicts import Verdict`. `ESCALATE` → remove (was transport leak). |
| 9 | `arifosmcp/golden_path/session_state.py:24` | `class Verdict(str, Enum): SEAL, SABAR, HOLD, VOID, PENDING` | `from arifosmcp.models.verdicts import Verdict`. `PENDING` → `VerdictState.SABAR_EPISTEMIC`. |
| 10 | `docs/agents/execution-controller.py:35` | `class Verdict(Enum): SEAL, VOID, HOLD(888_HOLD), PARTIAL, SABAR` | `from arifosmcp.models.verdicts import Verdict`. `PARTIAL` → `VerdictState.SABAR_EPISTEMIC`. |

**Risk: MEDIUM** — need to verify callers handle VerdictState sub-states.

### TIER 3: Vocabulary remapping (Cluster C — different words)

These use different words for the same concepts. Need careful mapping.

| # | File | Current | Migration |
|---|------|---------|-----------|
| 11 | `arifosmcp/abi/amanah_gate.py:30` | `class Verdict(str, Enum): PROCEED, HOLD, HARAM` | `from arifosmcp.models.verdicts import Verdict`. `PROCEED` → `Verdict.SEAL`. `HARAM` → `Verdict.VOID`. Keep `HOLD` as-is. |
| 12 | `core/organs/vault/types.py:31` | `class Verdict(Enum): APPROVED, PARTIAL, PAUSE, VOID, HOLD` | `from arifosmcp.models.verdicts import Verdict`. `APPROVED` → `Verdict.SEAL`. `PAUSE` → `Verdict.SABAR`. `PARTIAL` → `VerdictState.SABAR_EPISTEMIC`. |
| 13 | `core/organs/vault/types_v2.py:30` | `class Verdict(Enum): APPROVED, PARTIAL, PAUSE, VOID, HOLD` | Same as #12. |
| 14 | `arifosmcp/schemas/topology.py:46` | `class Verdict(StrEnum): PASS, REVISE, HOLD, VOID` | `from arifosmcp.models.verdicts import Verdict`. `PASS` → `Verdict.SEAL`. `REVISE` → `Verdict.SABAR`. |

**Risk: HIGH** — every caller using `Verdict.PROCEED` or `Verdict.APPROVED` must be updated.

### TIER 4: Rename (Cluster D — not verdicts at all)

These are data structures, not governance verdicts. Rename to avoid collision.

| # | File | Current | Migration |
|---|------|---------|-----------|
| 15 | `arifosmcp/runtime/model.py:174` | `class Verdict(BaseModel): {code, floor}` | Rename to `VerdictEnvelope`. Import Verdict from canonical for governance. |
| 16 | `arifosmcp/runtime/__advisory__/arif_action_classifier.py:62` | `class Verdict: {gate, reasons, may_execute}` | Rename to `ActionGate`. Not a verdict. |
| 17 | `arifosmcp/schemas/explore.py:144` | `class Verdict(BaseModel): {saturation, next_moves}` | Rename to `ExploreState`. Not a verdict. |
| 18 | `arifosmcp/hexagon/agents/base.py:57` | `class Verdict: wraps VerdictStatus + floor scores` | Rename to `VerdictReport`. Use canonical Verdict for governance. |

**Risk: MEDIUM** — renaming breaks all callers. Need grep + update.

### TIER 5: Leave alone (Cluster E — correctly prefixed)

~65 domain-specific verdicts with prefixes (ArtVerdict, GateVerdict, PolicyVerdict, etc.). These are correct. No action needed.

---

## Import Rewiring (Phase 3)

### Before (fragmented):
```python
# Every file defines its own
class Verdict(Enum):
    SEAL = "SEAL"
    HOLD = "HOLD"
    # ... different members per file
```

### After (unified):
```python
# Every file imports from canonical source
from arifosmcp.models.verdicts import Verdict, VerdictState, RuntimeStatus
# Governance: Verdict (SEAL/HOLD/SABAR/VOID)
# Sub-states: VerdictState (SEAL_CANONICAL, HOLD_888, etc.)
# Transport: RuntimeStatus (SUCCESS/ERROR/TIMEOUT/RETRY)
```

---

## Monotonicity Enforcement Points (Phase 4)

These are the merge points that MUST call `merge_verdicts()`:

| Merge Point | File | Current | Fix |
|-------------|------|---------|-----|
| Judge verdict merge | `arifosmcp/runtime/megaTools/tool_*_judge*.py` | Manual comparison | `merge_verdicts(v1, v2)` |
| Memory floor aggregation | `arifosmcp/runtime/megaTools/tool_13_arif_memory.py` | Manual comparison | `merge_verdicts(v1, v2)` |
| Forge execution gate | `arifosmcp/runtime/megaTools/tool_*_forge*.py` | Manual comparison | `merge_verdicts(v1, v2)` |
| 888_HOLD routing | `arifosmcp/core/kernel/*.py` | Manual comparison | `merge_verdicts(v1, v2)` |
| JITU conflict detection | `arifosmcp/core/conflict_resolver.py` | Manual comparison | `merge_verdicts(v1, v2)` |

---

## Phase 3 Execution Order (recommended)

1. **Tier 1** (4 files) — direct replacement, zero semantic change
2. **Tier 4** (4 files) — rename data structures, no governance change
3. **Tier 2** (6 files) — merge expanded members, medium risk
4. **Tier 3** (4 files) — vocabulary remapping, high risk
5. **Phase 4** — monotonicity enforcement at merge points

Each tier is independently revertable (F1 AMANAH).

---

## Validation Checklist

After Phase 3, verify:

- [ ] `grep -rn "class Verdict" --include="*.py"` returns only `models/verdicts.py`
- [ ] `grep -rn "from.*import.*Verdict" --include="*.py"` all point to `models.verdicts`
- [ ] `python -m pytest tests/ -q` passes
- [ ] `arif_judge` returns canonical Verdict
- [ ] `arif_memory` floor checks use canonical Verdict
- [ ] `arif_forge` execution gate uses canonical Verdict
- [ ] VAULT999 seal uses canonical Verdict
- [ ] No file defines `class Verdict` locally (except canonical)

---

*Phase 2 complete. Canonical source already has governance/transport split + monotonicity.*
*Phase 3 = rewire all 19 consumers. Phase 4 = enforce at merge points.*
*DITEMPA BUKAN DIBERI*
