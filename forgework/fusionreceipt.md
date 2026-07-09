# FUSION RECEIPT — Malaysia Fiscal / PETRONAS Stress Curve

| Field | Value |
|---|---|
| Version | v0.3-draft |
| Status | **DRAFT_ONLY** — not_sealed_notice |
| Created | 2026-07-09 |
| Created by | FORGE-000Ω (under F13 SOVEREIGN) |
| Session | SEAL-533821c0d6f94b72 (actor_verified=false → OBSERVE_ONLY) |
| Audit source | External auditor report, 2026-07-09 |
| Evidence layer | L2/L3 (session reasoning + USER_SUPPLIED data) |
| Runtime verdict | Tool registry coherent; live MCP execution not yet trustworthy end-to-end |
| Hash anchor | See `_MANIFEST.json` for canonical sha256 values |

---

## Executive Verdict

The fiscal logic for Malaysia's oil-price subsidy asymmetry and PETRONAS-as-battery insight is structurally sound, but the live runtime path remains unproven. This receipt binds the analysis as a draft and records that the main failure is MCP execution, provenance, and receipt discipline rather than the economic model.

## Model (derived from auditor reasoning)

**Three-way stress when Brent rises:**
1. Subsidies rise immediately (sensitivity ~-RM3.5b per US$10/bbl)
2. PETRONAS revenue rises but partly, with FX/LNG drag (~+RM3.0b per US$10/bbl)
3. **Safe extra dividend = 0 if any of:**
   - capex floor fails
   - liquidity floor fails
   - reserve_replacement_ratio < 1.0

## Core Insight (auditor)

> "Higher Brent increases petroleum revenue, but subsidy cost rises faster and sooner."
> "Oil upside is no longer clean upside."

## Assumptions (USER_SUPPLIED — confidence: low–medium)

| ID | Claim | Confidence | Status |
|---|---|---|---|
| A1 | Fuel subsidy cost RM3–5b/month | 0.65 | UNVERIFIED |
| A2 | 2026 subsidy burden ~RM40b | 0.55 | UNVERIFIED |
| A3 | Per US$10/bbl: +RM3.0b revenue, -RM3.5b subsidy | 0.60 | UNVERIFIED_DERIVED |
| A4 | MOF subsidy breakeven US$90–100/bbl | 0.55 | UNVERIFIED |

Full evidence ledger: [`evidence_fiscal_malaysia_2026.json`](./evidence_fiscal_malaysia_2026.json)

## Runtime Claim Matrix

| Layer | Expected | Observed in session | Verdict |
|---|---|---|---|
| WEALTH discovery | Tools listed and callable | Tools listed | PARTIAL |
| WEALTH execution | Domain calls execute | 403 DNS rebinding / Invalid Origin | BLOCKED |
| GEOX discovery | Namespace visible | Namespace visible | PARTIAL |
| GEOX execution | Session bootstrap or registry callable | `SESSION_REQUIRED` | BLOCKED |
| arifOS judgment | `arif_judge` produces final verdict | not invoked in this chain | UNVERIFIED |
| VAULT999 seal | sealed receipt | not attempted | NOT_SEALED |

## Holds (P0 — block SEAL)

| Hold | Cause | Owner |
|---|---|---|
| WEALTH MCP origin blocks all domain calls | DNS rebinding / Invalid Origin | WEALTH maintainer |
| GEOX session_required on registry call | schema/runtime drift | GEOX maintainer |
| arifOS actor_verified=false | verification gate (kernel working as designed) | F13 SOVEREIGN |
| No arif_judge SEAL | OBSERVE_ONLY authority scope | (chain: holds above) |

## Promotion State

Current state is `DRAFT_888_HOLD`.
This is a conversation-level hold only, not a kernel `arif_judge` verdict.

## Child Artifacts

| File | Purpose | Status |
|---|---|---|
| `evidence_fiscal_malaysia_2026.json` | Evidence ledger (sources, dates, expiry) | DRAFT |
| `petronas_stress_curve.schema.json` | Formal schema proposal for `mode=sovereign_resource_stewardship` | PROPOSAL_NOT_IMPLEMENTED |
| `malaysia_fiscal_scenarios_v0_2.csv` | Illustrative scenario table | ILLUSTRATIVE_NOT_DATA |
| `AAA_COCKPIT_CARD.md` | Tool health + evidence layer dashboard | LIVE |
| `KERNEL_STATE_2026-07-09.md` | SCAR-KERNEL-INIT-2026-07-08 closure note | SEALED-TO-FS |
| `petronas_datapack_2021_2025.json` | Placeholder datapack contract for real PETRONAS grounding | DRAFT_SKELETON |

## Forbidden Promotion (to L1 / canonical SEAL)

Do not promote without:
1. ✅ WEALTH MCP origin policy fixed + `wealth_healthcheck_origin` tool
2. ✅ GEOX session bootstrap path surfaced
3. ✅ arifOS actor_verified=true (sends identity_proof or sovereign ack)
4. ✅ `arif_judge` returns SEAL verdict on this receipt
5. ✅ Source bundle for all RM figures (replace USER_SUPPLIED with public URLs + dates)

## Required Public Evidence Bundle

Each RM or USD figure promoted beyond USER_SUPPLIED must include:
1. source title
2. publisher
3. publication date
4. accessed date
5. url
6. exact figure used
7. claim scope
8. confidence
9. expiry or refresh trigger

## Next Replay Order

1. `wealth_healthcheck_origin`
2. `wealth_field_macro(mode="fiscal_breakeven", country="MYS", ...)`
3. GEOX session bootstrap
4. PETRONAS datapack grounding
5. `arif_judge`
6. `arif_seal`

## not_sealed_notice

> This receipt is **DRAFT_ONLY**. It exists as a durable conversation anchor and a structural contract for the audit findings, not as a sealed civilizational record. Promote only via `arif_judge` + `arif_seal` with tri-witness (human × AI × external).
