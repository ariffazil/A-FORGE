# SB304 COMBINED-STACK REALITY CARD

> **Forged:** 2026-07-07 | **Session:** SEAL-db3a5d6329944ef7  
> **Stack:** Copilot Enterprise (M365) + FORGE arifOS (GEOX/WEALTH/AAA/A-FORGE)  
> **Status:** PARTIAL → HOLD → SEAL (conditional)  
> **Purpose:** One-page truth anchor for VP conversations. Locked facts only.

---

## THE 10 LOCKED FACTS

| # | Fact | Source | Confidence | Previously wrong? |
|---|------|--------|-----------|-------------------|
| 1 | **Water depth: 0–20m.** SB304 is shallow water, Shallow Water EPT PSC. | MBR 2026 bid guideline | 🔴 OBS | FORGE said >900m. **Wrong.** |
| 2 | **Block area: 7,030 sq km.** Offshore Sandakan, East Sabah. | MBR 2026 offering | 🟢 OBS | — |
| 3 | **Bid submission: 30 June 2027.** Not Q3-Q4 2026. Data room Q2 2027. | MBR guideline + Teams internal | 🔴 OBS | FORGE said Q3-Q4 2026. **Wrong.** |
| 4 | **Phase 1 MWC: 500 km² new 3D OBN + 2 well proposals.** Not "data reprocessing only." | Bid spec | 🔴 OBS | FORGE said "data reprocessing." **Wrong.** |
| 5 | **Phase 2 MWC: 1 exploration well.** | Bid spec | 🟢 OBS | — |
| 6 | **MPM incentive: ~1,000 line-km new 2D OBN provided.** | MPM offering docs | 🟡 DER | FORGE didn't factor this. **Gap.** |
| 7 | **SMJ Energy: up to 15% carried PI.** Must be factored into bid economics. | MBR guideline | 🟢 OBS | FORGE guessed 10-15%. **Close.** |
| 8 | **Bid scoring: Wells 50%, Seismic 35%, G&G 5%, Training 5%, Education 5%. Contingent = 0. Two-phase multiplier = 0.5.** | MBR bid evaluation criteria | 🔴 OBS | FORGE didn't know. **Critical gap.** |
| 9 | **Fiscal: 10% cash payment, 70% cost recovery ceiling, PI-linked contractor share 90%→30%. 20yr production, 4yr development. BG = MFC.** | EPT PSC terms | 🟢 OBS | — |
| 10 | **Environmental: Sugud Islands MCA, Turtle Island Park overlap is real. Kumbang lead inside MPA. Polygon-level analysis needed, not lead-level deletion.** | RimbaWatch/CEED + MPA boundaries | 🟡 INT | FORGE wrote off Kumbang. **Premature.** |

---

## THE 5 ARCHITECTURAL FIXES

| # | Fix | Layer | Rule |
|---|-----|-------|------|
| **F1** | **Block ≠ Basin.** Every block query must resolve block-level metadata (water depth, area, fiscal, MWC) from the authoritative offering document BEFORE invoking basin geology. | GEOX | `block_spec → basin_context` — never the reverse. |
| **F2** | **Timeline is multi-source or unverified.** Any time-sensitive recommendation must cross-check ≥2 independent sources. One source = HOLD. | A-FORGE | `timeline_confidence = f(n_sources, source_independence)` |
| **F3** | **Scoring surface before economics.** Do not compute EMV until the bid scoring surface (MWC weights, multipliers, contingent rules) is loaded. EMV without winning MWC = wrong question. | WEALTH | `bid_score → EMV → strategy` — never EMV first. |
| **F4** | **Enterprise bridge is a first-class citizen.** No PETRONAS-context recommendation can be trusted without M365 bridge (Teams, SharePoint, ETRC MOMs) available. Read-only acceptable. Absence = structural handicap. | AAA | `enterprise_retrieval → reasoning → execution` — not reasoning in isolation. |
| **F5** | **Context vs subsurface separation.** PETROS, rightsizing, CEO BANGANG, F6, F1 are load-bearing at governance/strategy layer. They must NOT move the geological grade. GEOX grade C stays C regardless of institutional pressure. | arifOS | `governance_context ∈ {WEALTH, F13}` and `technical_context ∈ {GEOX}` — no leakage between layers. |

---

## COMBINED VERDICT

```
SB304: CONDITIONAL BID — PARTNER-HEAVY, OBN-GATED, MPA-EXCLUDED, MWC-OPTIMIZED

If ≥2 drillable, non-MPA, commercially tieable prospects survive OBN:
  → SEAL (BID)

If only 1 credible prospect survives:
  → HOLD (non-op / farm-in only)

If Kumbang/Lead F remain the core value and cannot be separated from MPA:
  → VOID (WALK)
```

---

## STACK ORDER — FINAL

```
┌─────────────────────────────────────────────┐
│ 1. ENTERPRISE RETRIEVAL (M365/Teams/SPO)     │  ← AAA bridge (F4)
│ 2. BLOCK SPEC RESOLUTION (water depth, MWC)   │  ← GEOX block_spec (F1)
│ 3. BASIN CONTEXT (petroleum system, plays)     │  ← GEOX basin_context
│ 4. BID SCORING SURFACE (weights, multipliers)  │  ← WEALTH bid_score (F3)
│ 5. EMV COMPUTATION (with scoring-aware MWC)    │  ← WEALTH compute
│ 6. TIMELINE CROSS-CHECK (≥2 sources)           │  ← A-FORGE (F2)
│ 7. ENVIRONMENTAL POLYGON ANALYSIS              │  ← GEOX spatial
│ 8. GOVERNANCE LAYER (PETROS, rightsizing, F6)  │  ← arifOS (F5)
│ 9. CONSTITUTIONAL JUDGMENT (F1-F13)            │  ← arifOS judge
│ 10. SEAL / HOLD / VOID                          │  ← VAULT999
└─────────────────────────────────────────────┘
```

---

*Carry this into any VP conversation. Locked facts. Honest uncertainty. No BANGANG.*
