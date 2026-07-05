# GEOX Hardening Receipt — 2026-07-05

> **DITEMPA BUKAN DIBERI**
> **Forged:** 2026-07-05T10:42Z
> **Session:** SEAL-dfcbdde46a1946fe
> **Actor:** QQQ-FFF-TEST (FORGE under Arif F13)

---

## Fixes Applied

| # | File | Change | Bug |
|---|------|--------|-----|
| 1 | `tools/petrophysics.py:276` | `confidence_band` = P50 instead of full `uncertainty_band` dict | Output validation error — dict rejected as `number\|null` |
| 2 | `tools/kernel/_petrophysics.py:166` | Added 2% tolerance to `rhob > matrix_density` check | Real calcite stringers (2.653 > 2.65) falsely rejected |
| 3 | `tools/kernel/_unit_registry.py:16` | `PHI` max raised from 0.45 → 0.50 | Physics9 alignment (Physics9 says 50%) |

## Verification Results

| Step | Status | Detail |
|------|--------|--------|
| `geox_well_ingest` | ✅ PASS | 3000 samples, 6 curves |
| `geox_well_qc` | ✅ PASS | All curves QC pass |
| `geox_petrophysics(vsh)` | ✅ SUCCESS | mean=0.1663 v/v |
| `geox_petrophysics(porosity)` | ✅ SUCCESS | mean=0.3623 v/v |
| `geox_petrophysics(saturation)` | ✅ SUCCESS | mean=0.4166 v/v |
| Petrophysics tests | ✅ 8/8 PASS | All hardening tests pass |
| Surface audit | ✅ CLEAN | 46 canonical tools |
| arifOS conformance | ✅ 9/9 PASS | Substrate gate GREEN |
| `forge_shell` chain | ✅ VALID | 6 records, chain valid |

## Surface Audit

- **46 canonical tools** — all registered with proper domains and affordances
- **All PASS** — no drift, no phantom tools, no contradictions
- **`geox_claim`/`geox_prospect`** correctly require 888_HOLD

## Findings

1. **Output schema alignment fixed** — `confidence_band` now uses P50 value, matching the `number|null` schema
2. **RHOB tolerance added** — 2% margin prevents false rejection of real calcite-cemented stringers
3. **Physics9 alignment** — PHI bound now matches the canonical 50% limit
4. **Surface audit CLEAN** — no contradictions between registry and live MCP surface

---

*DITEMPA BUKAN DIBERI — Hardened.*