# VERDICT_SEMANTIC_MAP — Phase 1 Audit

> **Date:** 2026-07-07 · **Auditor:** FORGE (000Ω) · **Status:** COMPLETE
> **Scope:** All `class *Verdict*` definitions in `/root/arifOS/` (excluding archive/)
> **Total found:** 159 verdict-related classes, 19 named exactly `Verdict`

---

## 1. Semantic Clusters

### Cluster A: Canonical Governance (SEAL/HOLD/SABAR/VOID)

The "correct" 4-verdict pattern. Used by the constitutional kernel.

| # | File | Name | Members | Notes |
|---|------|------|---------|-------|
| 1 | `arifosmcp/models/verdicts.py` | `SealType` | SEAL, HOLD, SABAR, VOID | **CANONICAL SOURCE** — 4 sub-states each |
| 2 | `arifosmcp/runtime/kernel_runtime.py` | `Verdict` | SEAL, HOLD, SABAR, VOID | Identical to canonical |
| 3 | `arifosmcp/runtime/apex_c_dark.py` | `Verdict` | SEAL, SABAR, HOLD, VOID | Identical to canonical |
| 4 | `arifosmcp/evals/sequential_thinking_runner.py` | `Verdict` | SEAL, HOLD, VOID, SABAR | Identical to canonical |
| 5 | `core/shared/governed_tool.py` | `Verdict` | SEAL, HOLD, VOID | Missing SABAR |
| 6 | `arifosmcp/golden_path/session_state.py` | `Verdict` | SEAL, SABAR, HOLD, VOID, PENDING | Adds PENDING |
| 7 | `docs/agents/execution-controller.py` | `Verdict` | SEAL, VOID, HOLD(888_HOLD), PARTIAL, SABAR | Adds PARTIAL, HOLD uses 888 prefix |

### Cluster B: Expanded Governance (adds PROVISIONAL/PARTIAL)

| # | File | Name | Members | Notes |
|---|------|------|---------|-------|
| 8 | `core/shared/types.py` | `Verdict` | SEAL, PROVISIONAL, PARTIAL, SABAR, HOLD, HOLD_888, VOID | **7 members** — most expanded. Has normalization rule |
| 9 | `arifosmcp/hexagon/agents/base.py` | `VerdictStatus` | SEAL, SABAR, VOID, HOLD, PARTIAL | Adds PARTIAL |
| 10 | `arifosmcp/runtime/webmcp/governance.py` | `Verdict` | SEAL, VOID, PARTIAL, SABAR, HOLD_888 | Adds PARTIAL, uses HOLD_888 |
| 11 | `arifosmcp/gateway/schemas.py` | `Verdict` | SEAL, HOLD, VOID, SABAR, ESCALATE | Adds ESCALATE — transport leak |

### Cluster C: Different Vocabulary (APPROVED/PAUSE/HARAM/PASS)

**SEMANTIC COLLISION** — same concept, different words.

| # | File | Name | Members | Notes |
|---|------|------|---------|-------|
| 12 | `arifosmcp/abi/amanah_gate.py` | `Verdict` | PROCEED, HOLD, HARAM | **PROCEED≠SEAL, HARAM≠VOID** |
| 13 | `core/organs/vault/types.py` | `Verdict` | APPROVED, PARTIAL, PAUSE, VOID, HOLD | **APPROVED≠SEAL, PAUSE≠SABAR** |
| 14 | `core/organs/vault/types_v2.py` | `Verdict` | APPROVED, PARTIAL, PAUSE, VOID, HOLD | Identical to vault/types.py |
| 15 | `arifosmcp/schemas/topology.py` | `Verdict` | PASS, REVISE, HOLD, VOID | **PASS≠SEAL, REVISE≠SABAR** |

### Cluster D: Not Verdicts at All (data structures disguised as verdicts)

**F9 VIOLATION** — naming collision with governance verdicts.

| # | File | Name | Type | Actual Purpose |
|---|------|------|------|----------------|
| 16 | `arifosmcp/runtime/model.py` | `Verdict` | BaseModel | `{code: str, floor: str}` — just a container |
| 17 | `arifosmcp/runtime/__advisory__/arif_action_classifier.py` | `Verdict` | dataclass | `{gate, reasons, required_human_judge, may_execute}` |
| 18 | `arifosmcp/schemas/explore.py` | `Verdict` | BaseModel | `{saturation, next_moves}` — exploration state |
| 19 | `arifosmcp/hexagon/agents/base.py` | `Verdict` | dataclass | Wraps VerdictStatus + floor scores |

### Cluster E: Domain-Specific Verdicts (correctly scoped)

These are NOT collisions — they're domain-specific and correctly named with prefixes.

| Domain | Examples | Count |
|--------|----------|-------|
| ART (pre-kernel) | `ArtVerdict` (PROCEED, HOLD, BLOCK, DEFAULT_OBSERVE) | 3 |
| Governance pipeline | `PipelineVerdict`, `GovernanceVerdict`, `ConstitutionalVerdict` | 5 |
| Risk/Reversibility | `RiskVerdict`, `ReversibilityVerdict`, `DriftVerdict` | 4 |
| Gate systems | `GateVerdict`, `EnforcementVerdict`, `SessionVerdict`, `SealGuardVerdict` | 8 |
| Geometry/Mind | `GeometryVerdict`, `ExecutionVerdict`, `ReasoningVerdict`, `TruthVerdict`, etc. | 9 |
| Domain organs | `GeoxVerdict`, `PolicyVerdict`, `MaruahVerdict`, `DeliveryVerdict` | 6 |
| Envelope/Schema | `CanonicalVerdict`, `VerdictCode`, `VerdictType`, `VerdictStatus` | 10 |
| Other | `ApexVerdict`, `LoopVerdict`, `TorusVerdict`, `DutyVerdict`, etc. | ~20 |

**Total Cluster E: ~65 correctly prefixed verdicts.** These are fine — no collision.

---

## 2. Sovereignty Violations

| Violation | File | Issue |
|-----------|------|-------|
| **SEAL without F13** | `arifosmcp/abi/amanah_gate.py` | Uses PROCEED instead of SEAL — bypasses sovereignty check |
| **VOID without 888** | `core/organs/vault/types.py` | VOID means "rejected" but no 888_HOLD gate |
| **HOLD meaning "retry"** | `arifosmcp/gateway/schemas.py` | ESCALATE added — transport semantics leaking into governance |
| **SEAL meaning "success"** | `core/shared/governed_tool.py` | SEAL used as generic "ok" without floor checks |
| **PASS instead of SEAL** | `arifosmcp/schemas/topology.py` | Topology pass/fail mixed with constitutional verdicts |

---

## 3. Import Graph (who imports what)

| Source Verdict | Imported by | Count |
|---------------|-------------|-------|
| `runtime/model.py` Verdict | megaTools/*, kernel_router, bridge | ~12 |
| `core/shared/types.py` Verdict | arifosmcp kernel, legacy tools | ~8 |
| `abi/amanah_gate.py` Verdict | shell_forge, tools.py (AmanahVerdict alias) | ~3 |
| `models/verdicts.py` SealType | models/__init__.py only | 1 |
| `runtime/kernel_runtime.py` Verdict | kernel internals | ~5 |
| `runtime/apex_c_dark.py` Verdict | apex calculations | ~2 |
| `hexagon/agents/base.py` Verdict | hexagon agents | ~3 |
| Local (not imported) | Most files | ~100+ |

**Critical finding:** The canonical `models/verdicts.py` SealType is imported by exactly 1 file. The runtime `model.py` Verdict (a BaseModel, not an enum) is imported by ~12 files. The canonical source is effectively dead.

---

## 4. Collision Severity Matrix

| Collision | Files | Semantic Conflict | Risk |
|-----------|-------|-------------------|------|
| `Verdict` (governance enum) | 11 | SEAL means different things | **CRITICAL** |
| `Verdict` (data container) | 3 | Not a verdict at all | **HIGH** |
| `VerdictCode` | 6 | Different code sets | **HIGH** |
| `GateVerdict` | 3 | Different gate semantics | **MEDIUM** |
| `GovernanceVerdict` | 2 | Different governance models | **MEDIUM** |
| `VerdictStatus` | 2 | Different status sets | **LOW** |

---

## 5. Recommended Resolution

### Phase 2: Split governance vs transport

```python
# Governance (constitutional law)
from arifosmcp.models.verdicts import SealType  # SEAL, HOLD, SABAR, VOID

# Transport (execution plumbing)  
from arifosmcp.models.transport import RuntimeStatus  # SUCCESS, ERROR, TIMEOUT, RETRY
```

### Phase 3: Rewire all 19 `class Verdict` definitions

| Category | Action | Files |
|----------|--------|-------|
| Cluster A (correct) | Replace with `from models.verdicts import SealType` | 7 |
| Cluster B (expanded) | Merge PROVISIONAL/PARTIAL into VerdictState sub-states | 4 |
| Cluster C (wrong vocab) | Map APPROVED→SEAL, PAUSE→SABAR, PROCEED→SEAL, HARAM→VOID | 4 |
| Cluster D (not verdicts) | Rename to `VerdictEnvelope`, `ActionGate`, `ExploreState` | 4 |
| Cluster E (prefixed) | Leave as-is — correctly scoped | ~65 |

### Phase 4: Add monotonicity enforcement

```python
# In arif_judge, arif_forge, arif_seal
VERDICT_ORDER = {
    SealType.SEAL: 0,   # Lowest authority
    SealType.SABAR: 1,
    SealType.HOLD: 2,
    SealType.VOID: 3,   # Highest authority — overrides all
}
```

---

## 6. J-Space Impact

Without this fix:
- JITU cannot detect conflict (different Verdict meanings)
- arif_memory cannot judge truth (Verdict routing broken)
- arif_judge cannot route sovereignty (monotonicity violated)
- 888 cannot enforce human veto (HOLD means different things)
- VAULT999 cannot seal correctly (SEAL semantics ambiguous)
- A-FORGE cannot obey governance (Verdict is transport, not law)

With this fix:
- Single canonical Verdict source
- Governance separated from transport
- Monotonicity enforced at every gate
- J-space ignition prerequisites satisfied

---

*Phase 1 complete. No mutations performed. Ready for Phase 2 on sovereign approval.*
*DITEMPA BUKAN DIBERI*
