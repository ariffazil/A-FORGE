# FORGE SEAL: MCP Transport Spine v0.1

**Date:** 2026-06-28
**Agent:** FORGE (000Ω)
**Preceded by:** Full ingestion of arifOS (289 runtime files), AAA (157 entries, 59 schemas, 61 skills), A-FORGE (73 entries, ~150 TS files, 59 tools)
**Trigger:** Arif asked to wire ChatGPT's MCP spine proposal against existing infrastructure

---

## Key Finding

**ChatGPT's proposal is ~80% already implemented.** The spine is already wired. The real work is unifying transport conventions.

## The 4 Real Gaps

| Gap | Current State | Fix |
|-----|--------------|-----|
| **Error semantics** | 3 formats (A-FORGE: `isError`, GEOX: `status: OK/ERROR`, arifOS: `status: void`) | Standardize to MCP SDK `isError` + `recoverable` + `authority_class` |
| **Authority classification** | 4 systems (A-FORGE 8-class, arifOS 10-class, GEOX 3-flag, PeerContract 5-class) | Project to ChatGPT's 4-class (`ADVISORY_ONLY/MUTATION_ALLOWED/IRREVERSIBLE_PROPOSED/IRREVERSIBLE_SEALED`) onto existing 8-class |
| **Resource URI schemes** | 6 schemes (`geox://`, `arifos://`, `forge://`, `well://`, `wealth://`, `tree777://`) | Add `egs://` and `arifos://receipts/` as aliases; keep existing schemes |
| **Unified receipt format** | No standard receipt_id, fields differ per organ | Define canonical receipt schema at `/root/AAA/schemas/receipt.schema.json` |

## The 3 Things That Don't Need Building

ChatGPT proposed 9 spine tools. **All 9 already exist** under different names:
- `geox_data_qc_bundle` = `geox_well_qc` + `geox_well_ingest`
- `geox_claim_create` = `geox_claim(mode=create)`
- `geox_claim_challenge` = `geox_evidence(mode=contradict)` + `geox_claim(mode=challenge)`
- `geox_evidence_attach` = `geox_claim(mode=attach)`
- `geox_evidence_reason` = `geox_evidence(mode=synthesize, abduct)`
- `geox_seismic_compute` = `geox_seismic_compute`
- `arif_triage` = `arif_route(mode=auto)`
- `arif_judge` = `arif_judge`
- `arif_receipt_create` = `arif_seal` + `forge_vault`

## What Was Forged

| Artifact | Path | Content |
|----------|------|---------|
| MCP Transport Spine v0.1 | `/root/AAA/docs/transport/MCP_GEOX_ARIFOS_SPINE_V0.1.md` | 11 sections, 3 appendices, 458 lines. Maps every ChatGPT proposal to existing infra with wiring required, who should do it, and effort level. |

## Next Actions (Priority Order)

1. **P0: Standardize error format** — unify `isError` across GEOX, arifOS, A-FORGE. ~15 lines total.
2. **P0: Add `authority_class` to every tool response** — 1 field per response envelope across all organs.
3. **P1: Add `_organ_boundary` to every tool response** — annotates which organ produced what.
4. **P1: Standardize receipt format** — define canonical schema at `/root/AAA/schemas/receipt.schema.json`.
5. **P2: Add `egs://` resource aliases** in GEOX.
6. **P2: Add `arifos://receipts/{id}`** resource in arifOS.
7. **P2: Add origin validation** to GEOX, WEALTH, WELL.
8. **P3: Build spine probe battery** — 5 probes testing read-only discipline, claim lifecycle, authority leak, LLM misbehavior, ASAL audit.

## Evidence Paths

- MCP spine doc: `/root/AAA/docs/transport/MCP_GEOX_ARIFOS_SPINE_V0.1.md`
- Ingestion reports in agent task results (this session)
- Session state: `/root/.claude/projects/-root/memory/session-state.md`

---

*DITEMPA BUKAN DIBERI — Forged, Not Given.*
*FORGE SEAL · 2026-06-28 · MCP Transport Spine v0.1*
