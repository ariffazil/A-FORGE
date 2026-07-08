# GEOX ↔ arifOS Isomorphism Canon

> **Batu asas untuk Jalan B.** Manifold J-space didokumentasikan sebagai canon
> sebelum dijadikan executable code.

---

## Dokumen

| # | Dokumen | Invariant | Witness |
|---|---------|-----------|---------|
| 1 | `GEOX-arifOS-IDENTITY-MAP.md` | Identity Continuity (F1) | `startupFingerprintCheck()` |
| 2 | `GEOX-arifOS-VERDICT-MAP.md` | Authority Conservation (F11/F13) | `installElicitationGate()` |
| 3 | `GEOX-arifOS-INVARIANT-MAP.md` | 9 invariants as manifold constraints | VAULT999 seal chain |

---

## Manifold Status (2026-07-07 — OBS grounded)

| Invariant | arifOS | A-FORGE | GEOX | WEALTH | WELL | Status |
|---|---|---|---|---|---|---|
| INV-1 Verdict Monotonicity | ✅ | ✅ | ❌ acrisk independent | N/A | N/A | **⚠️** |
| INV-2 Identity Origin | ✅ | ✅ | ⚠️ inherited | ⚠️ inherited | ⚠️ inherited | **⚠️** |
| INV-3 Authority Concentration | ✅ | ✅ | ❌ issues own SEAL | ✅ | N/A | **⚠️** |
| INV-4 Irreversibility Gate | ✅ | ✅ | N/A | N/A | N/A | **✅** |
| INV-5 Verdict Provenance | ❌ | ❌ | ❌ | ❌ | ❌ | **❌** |
| INV-6 Lease Boundary | ✅ | ✅ | ❌ no leases | ❌ no leases | ❌ no leases | **⚠️** |
| INV-7 Floor Compliance | ✅ | ✅ | ❌ own RiskTier | ❌ | ❌ | **⚠️** |
| INV-8 Seal Chain Continuity | ✅ | N/A | N/A | N/A | N/A | **✅** |
| INV-9 Entropy Reduction | ⚠️ | ⚠️ | N/A | N/A | N/A | **⚠️** |

**Overall: 2/9 fully enforced, 5/9 partially, 1/9 missing, 1 N/A.**

### Manifold Equation

```
M = I(id) × V(mono) × A(conc) × E(ΔS≤0)
M = 0.85 × 0.75 × 0.75 × 0.50 = 0.24

Threshold: M ≥ 0.80 → MANIFOLD_STABLE
Current:   M = 0.24 → MANIFOLD_DRIFT
```

**Previous claim of STABLE was premature (pre-analysis). Corrected 2026-07-07.**

---

## Three Critical Fixes to Reach MANIFOLD_STABLE

| Fix | Invariants | Impact | Effort |
|---|---|---|---|
| Verdict Provenance envelope | INV-5 (primary), INV-1, INV-3 | Highest — without it, other fixes are decorative | P1 — schema-only |
| GEOX acrisk → SealType translation | INV-1, INV-3 | High — primary manifold leak | P1 — translation in organ_governance.py |
| Cross-Organ Lease Propagation | INV-6 | Medium — requires arifOS endpoint | P2 |

---

## Next (Jalan B)

1. Implement `verdict_source` + `verdict_authority` envelope across all 5 substrates
2. GEOX `acrisk` → canonical SealType translation layer
3. `domain/isomorphism/isomorphism-pair.interface.ts` — Executable IsomorphismPair type
4. Unit test: prove each invariant holds at runtime
5. `forge_isomorphism_check` tool: runtime witness

---

**DITEMPA BUKAN DIBERI — The canon is forged, not given.**
