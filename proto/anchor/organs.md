# J-Space Organs — Registration & Boundaries

> **Status:** ANCHOR — P2 Task 1
> **Date:** 2026-07-07

---

## The Five Organs

Each organ has a declared boundary in J-Space. Cross-organ actions route through the canonical intent router.

### 1. arifOS — Constitutional Kernel

| Field | Value |
|-------|-------|
| Port | 8088 |
| Language | Python |
| Role | Brain / Governor / Judge |
| Owns | F1-F13 floors, VAULT999, seal chain, 888 JUDGE, identity |
| Boundary | NEVER executes. ONLY judges. |
| MCP Tools | arif_init, arif_judge, arif_seal, arif_observe, arif_think, arif_critique |
| J-Space Role | Sovereignty anchor. Verdict authority. Seal authority. |

### 2. A-FORGE — Execution Shell

| Field | Value |
|-------|-------|
| Port | 7071/7072 |
| Language | TypeScript |
| Role | Hands / Actuator / Forger |
| Owns | forge_* tools, leases, build/deploy, shell, browser |
| Boundary | NEVER adjudicates. ONLY executes under lease. |
| MCP Tools | forge_filesystem, forge_shell, forge_execute, forge_evaluate, forge_scar, forge_witness |
| J-Space Role | Execution surface. Elicitation gate. Fingerprint registry. |

### 3. GEOX — Earth Intelligence

| Field | Value |
|-------|-------|
| Port | 8081 |
| Language | Python |
| Role | Earth physics, evidence, claims |
| Owns | Basin, seismic, petrophysics, prospect, claim lifecycle |
| Boundary | NEVER judges. NEVER executes deployment. ONLY computes earth evidence. |
| MCP Tools | geox_observe, geox_compute, geox_interpret, geox_model, geox_govern, geox_prospect |
| J-Space Role | Evidence source. Epistemic ladder origin (OBS earth data). Irreversible rock record. |

### 4. WEALTH — Capital Intelligence

| Field | Value |
|-------|-------|
| Port | 18082 |
| Language | Python |
| Role | Capital, risk, NPV, conservation |
| Owns | EMV, IRR, portfolio, collapse signatures, boundary governance |
| Boundary | NEVER moves capital. NEVER judges. ONLY computes. |
| MCP Tools | wealth_compute_emv, wealth_compute_npv, wealth_collapse_signature_scan, wealth_boundary_governance |
| J-Space Role | Capital evidence. Risk epistemics. Conservation law. |

### 5. WELL — Human Readiness

| Field | Value |
|-------|-------|
| Port | 18083 |
| Language | Python |
| Role | Human substrate, vitality, dignity |
| Owns | Readiness, homeostasis, dignity guard, substrate classification |
| Boundary | REFLECT_ONLY. NEVER diagnoses. NEVER prescribes. |
| MCP Tools | well_readiness, well_validate_vitality, well_guard_dignity, well_classify_substrate |
| J-Space Role | Human state witness. Dignity boundary. Vitality epistemics. |

---

## Organ Registration in J-Space

Every organ must register with J-Space to participate in the manifold:

```json
{
  "organ_id": "geox",
  "canonical_name": "GEOX Earth Intelligence",
  "port": 8081,
  "language": "python",
  "role": "evidence_source",
  "boundary": "compute_only",
  "tools": ["geox_observe", "geox_compute", "geox_interpret", "geox_model", "geox_govern", "geox_prospect"],
  "epistemic_range": ["OBS", "DER", "INT"],
  "can_seal": false,
  "can_judge": false,
  "can_execute": false,
  "authority_level": "T1_OBSERVE",
  "registered_at": "2026-07-07T00:00:00Z",
  "fingerprint": "<sha256 of organ identity>"
}
```

---

## Cross-Organ Routing

```
User intent → arifOS (classify) → organ (compute) → arifOS (judge) → A-FORGE (execute) → arifOS (seal)
```

| From | To | Route | Authority Required |
|------|-----|-------|-------------------|
| GEOX | arifOS | claim → judge → seal | T1 (observe) |
| WEALTH | arifOS | valuation → judge → seal | T1 (observe) |
| WELL | arifOS | readiness → reflect | T1 (observe) |
| arifOS | A-FORGE | verdict → execute | T2/T3 (lease) |
| A-FORGE | arifOS | result → seal | T1 (observe) |
| Any | Any | cross-organ | Canonical intent router |

---

*DITEMPA BUKAN DIBERI — Organs are registered, not assumed.*
