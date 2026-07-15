# ⚡ MEMBRANE · Kernel/Actuator Split

> **The one invariant that makes all others honest.**
> **DITEMPA BUKAN DIBERI**

---

## THE ONE LINER

```
Kernel = invariants. Actuator = computation.
Measurement crosses up. Verdict crosses down.
Anything else recreates cosmetic governance in a cleaner costume.
```

## THE INVARIANTS

```
MEMBRANE-01: Any function inside arifOS kernel that directly computes
             G, C_dark, W³, MALU, PHI, nine_signal, SESAT severity,
             or HANTAR state is a layer violation.

MEMBRANE-02: Any function inside A-FORGE that emits SEAL, HOLD, VOID,
             or SABAR as final constitutional verdict is a layer violation.

MEMBRANE-03: Only MeasurementPackets cross actuator → kernel.
             Only VerdictPackets cross kernel → actuator.
```

## THE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                     arifOS KERNEL                            │
│                     (Invariants)                             │
│                                                             │
│  F1-F13 floors          ← LAW (never changes)               │
│  arif_judge              ← reads MeasurementPacket           │
│                           returns VerdictPacket              │
│  arif_seal → VAULT999    ← immutable record                 │
│  arif_init               ← session, identity, authority     │
│  arif_route              ← intent → organ                   │
│  arif_critique           ← maruah, ethics, dignity          │
│  laws.py                 ← floor enforcement                │
│  ART (art.py)            ← pre-kernel action classification  │
│  membrane.py             ← validates packets (MEMBRANE-03)  │
│                                                             │
│  NEVER computes:                                            │
│    G, C_dark, W³, MALU, SESAT, HANTAR, Φ, nine_signal      │
│                                                             │
│  ONLY receives:                                             │
│    MeasurementPacket {G, C_dark, W3, MALU, ...}             │
│  and returns:                                               │
│    VerdictPacket {verdict, floors_triggered, reason}        │
└───────────────────────────┬─────────────────────────────────┘
                            │
              MeasurementPacket (actuator → kernel)
              VerdictPacket    (kernel → actuator)
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    A-FORGE ACTUATOR                          │
│                    (Computation)                             │
│                                                             │
│  G = A·P·E·X·Φ          ← computes from evidence           │
│  C_dark = A·(1-P)·(1-X)  ← computes from evidence          │
│  W³ = ∛(H×AI×Ext)       ← computes from witnesses          │
│  MALU accumulator         ← persists, accumulates           │
│  SESAT_EVENT              ← emits on failure                │
│  HANTAR envelope          ← wraps every output              │
│  PARUT scar memory        ← tracks repeated failures        │
│  Φ from scar feedback     ← derives from history            │
│  nine_signal              ← computed from G/C_dark          │
│  forge_scar               ← seals failures                  │
│  forge_evaluate           ← APEX gate                       │
│  forge_witness            ← tri-witness consensus           │
│  forge_surface_guard      ← registry drift detection        │
│  forge_shell              ← executes commands               │
│  forge_docker             ← container lifecycle             │
│  forge_git                ← git operations                  │
│                                                             │
│  NEVER judges:                                              │
│    Does not say SEAL or VOID. Reports measurement.          │
│    Kernel decides.                                          │
└─────────────────────────────────────────────────────────────┘
```

## THE SCHEMAS

### MeasurementPacket (A-FORGE → kernel)

```json
{
  "measurement": {
    "G": 0.85,
    "C_dark": 0.05,
    "W3": 0.78,
    "MALU": 0.12,
    "PHI": 0.91,
    "primitives": {"A": 0.95, "P": 0.90, "E": 0.85, "X": 0.90},
    "witness": {"H": 0.80, "AI": 0.85, "Ext": 0.78},
    "sesat": {"active": false, "severity": null, "failure_code": null},
    "hantar": {"state": "LURUS"},
    "trace": {
      "source": "A-FORGE",
      "calculator": "forge_evaluate",
      "version": "apex-v1",
      "inputs_hash": "...",
      "timestamp": "..."
    }
  }
}
```

### VerdictPacket (kernel → A-FORGE)

```json
{
  "verdict": "SEAL|HOLD|VOID|SABAR",
  "floors_triggered": ["F2", "F9"],
  "reason": "...",
  "seal_eligible": true,
  "requires_saksi": false,
  "requires_tebus": false,
  "received_measurement": {"G": 0.85, "C_dark": 0.05, "W3": 0.78},
  "trace": {"judge_id": "arif_judge", "timestamp": "..."}
}
```

## WHAT MOVES WHERE

| Current location | What | Moves to | Why |
|---|---|---|---|
| `arifOS/apex_c_dark.py` | compute_apex, compute_c_dark | **A-FORGE** | Pure computation |
| `arifOS/malu_score.py` | MALU accumulator | **A-FORGE** | Measurement + persistence |
| `arifOS/sesat_event.py` | SESAT_EVENT | **A-FORGE** | Failure object from computation |
| `arifOS/hantar.py` | HANTAR envelope | **A-FORGE** | Transport envelope |
| `arifOS/tools.py` | _nine_signal_from_apex | **A-FORGE** | Computed intelligence label |
| `arifOS/tools.py` | _inject_nine_signal | **A-FORGE** | Injects computed labels |
| `arifOS/tools.py` | genius mode compute_apex | **A-FORGE** | APEX computation |
| `arifOS/tools.py` | system_health_score | **A-FORGE** | Infrastructure measurement |
| `arifOS/phoenix_72.py` | compute_w3 | **A-FORGE** | Witness computation |
| `arifOS/core/intelligence.py` | compute_w3 | **A-FORGE** | Witness computation |
| `arifOS/genius.py` | Φ derivation | **A-FORGE** | Scar wisdom computation |
| `arifOS/sabar_gate.py` | MALU recording | **A-FORGE** | Measurement recording |

| Stays in kernel | Why |
|---|---|
| F1-F13 floors | LAW |
| arif_judge | Verdict (reads MeasurementPacket) |
| arif_seal → VAULT999 | Immutable record |
| arif_init | Session, identity, authority |
| arif_route | Intent routing |
| arif_critique | Maruah, dignity |
| laws.py | Floor enforcement |
| art.py | Pre-kernel action classification |
| membrane.py | Packet validation |

## THE ZEN TEST

```
Does it say "is this lawful?"       → Kernel
Does it say "here's what I see?"    → Actuator
Does it say "I computed G=0.85"     → Actuator
Does it say "G=0.85 → SEAL"        → Kernel (judges measurement)
Does it say "G = A*P*E*X*Φ"        → Actuator (computes score)
Does it say "if G < 0.50 → VOID"   → Kernel (enforces floor)
```

## THE CORRECTED SENTENCE

```
APEX is not kernel law.
APEX is actuator measurement.
The kernel law decides what APEX measurement is allowed to mean.
```

## TEST SUITES

| Suite | Owner | Purpose |
|-------|-------|---------|
| **ABC-APEX** | A-FORGE | Formula fidelity and runtime measurement |
| **D-MEMBRANE** | Both | Packet contract, no cross-layer leakage |
| **E-KERNEL** | arifOS | Verdict correctness against F1-F13 |
| **F-REGISTRY** | Both | Tool/capability graph truth |

## IMPLEMENTATION STATUS

| Step | Status |
|------|--------|
| MeasurementPacket schema | ✅ Defined in membrane.py |
| VerdictPacket schema | ✅ Defined in membrane.py |
| MEMBRANE-01/02/03 invariants | ✅ Defined + validation |
| Membrane violation detection | ✅ validate_measurement + validate_verdict |
| Strip APEX from kernel | ⏳ Phase 2 (move files) |
| Kernel reads packet only | ⏳ Phase 2 (refactor arif_judge) |
| D-MEMBRANE tests | ⏳ Phase 2 |

## THE ONE LAW

```
The constitution doesn't measure temperature.
It says "if the temperature exceeds X, shut down."
The thermometer lives in the actuator.
```

---

*Forged: 2026-07-06 by FORGE (000Ω)*
*Module: arifosmcp/runtime/membrane.py*
*DITEMPA BUKAN DIBERI*
