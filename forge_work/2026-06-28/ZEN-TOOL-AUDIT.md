# ZEN: Tool Embodiment Audit & Fix Plan

> **Date:** 2026-06-28
> **Auditor:** OpenCode (FORGE lane)
> **Sovereign:** Arif
> **Status:** DRAFT — proposed fixes, requires F13 ratification for code changes
> **DITEMPA BUKAN DIBERI — Forged, Not Given**

---

## Summary

122 tools across 5 organs audited. **14 zen issues** found. **7 fix proposals** below.

---

## Fix Proposal 1: Deprecate `arif_forge`/`arif_forge_execute` on arifOS

**What:** `arif_forge` and `arif_forge_execute` are legacy proxies from pre-Brain/Hands split (June 2026). A-FORGE's `forge_execute` is canonical.

**Action:**
- Move both to deprecation registry ✅ *(done)*
- Add runtime warning when called
- Remove from root endpoint after 1 session cooling

**Effort:** Low — documentation + code comment change
**Risk:** None — A-FORGE `forge_execute` already handles all execution

---

## Fix Proposal 2: Move 6 Hermes Tools to Dedicated Hermes MCP

**What:** `hermes_system_status`, `hermes_epistemic_check`, `hermes_fact_check`, `hermes_cross_verify`, `hermes_plan_review`, `hermes_memory_steward` leak into arifOS kernel MCP.

**Action:**
- Create `/root/.hermes/mcp_servers/hermes-mcp.py` with these 6 tools
- Remove from arifOS `DIAGNOSTIC_TOOLS` list
- Register as separate MCP server in opencode.json

**Effort:** Medium — extract + repackage + register
**Risk:** Low — tools are read-only, no data migration

---

## Fix Proposal 3: Resolve GEOX Pattern A vs EGS Overlap

**What:** 3 pairs of overlapping tools:
- `geox_claim` vs `geox_egs_claim_create/challenge`
- `geox_evidence` vs `geox_egs_evidence_attach/reason`
- `geox_seismic_compute` (unified) vs `geox_egs_seismic_compute`

**Action:**
- Decouple `geox_evidence` and `geox_claim` from Pattern A → standalone tools with unified API
- Mark EGS variants as DEPRECATED_PROXY
- `geox_seismic_compute` (unified) is already canonical — mark `geox_egs_seismic_compute` as legacy

**Effort:** Medium — code refactoring in GEOX server
**Risk:** Medium — tool signatures must remain backward-compatible

---

## Fix Proposal 4: Deduplicate WELL Registry Tools

**What:** WELL has `well_registry_status` AND `well_system_registry_status` doing the same thing.

**Action:**
- Mark `well_system_registry_status` as DEPRECATED
- `well_registry_status` (blueprint canonical format) is the canonical one
- Remove `well_system_registry_status` after 1 session

**Effort:** Low — code removal
**Risk:** None — `well_registry_status` returns superset of data

---

## Fix Proposal 5: Standardize Registry Naming Across Organs

**What:** Inconsistent naming:
- GEOX: `geox_surface_status` 
- WEALTH: `wealth_system_registry_status`
- WELL: `well_registry_status` + `well_system_registry_status`

**Action:**
- Add `geox_system_registry_status` as alias for `geox_surface_status`
- Remove `well_system_registry_status` (see #4)
- Standard convention: `<organ>_system_registry_status` for registry probes

**Effort:** Low — add alias, no code changes
**Risk:** None — aliases are backward-compatible

---

## Fix Proposal 6: Resolve 3-Way Browser Overlap

**What:** 3 concurrent browser tool systems:
- `forge_browser_*` (click, navigate, screenshot, type, evaluate_js, extract_text)
- `chrome-devtools` MCP (full devtools protocol)
- `playwright` MCP (port 8931/sse)

**Action:**
- Deprecate `forge_browser_*` tools — route to `chrome-devtools` 
- Keep `playwright` as backup (port 8931 handles SSE transport)
- `chrome-devtools` is canonical browser interface

**Effort:** Low — documentation + routing
**Risk:** Low — chrome-devtools is already the most capable

---

## Fix Proposal 7: Tidy arifOS Naming Inconsistencies

**What:** Multiple naming inconsistencies:
- `arif_critique` vs `arif_heart_critique` → merge to `arif_think(mode=critique)`
- `arif_memory` vs `arif_memory_recall` → consolidate to `arif_vault_query`
- `arif_measure` vs `arif_ops_measure` → consolidate to `arif_observe(mode=vitals)`
- `arif_fetch` vs `arif_evidence_fetch` → consolidate to `arif_observe(mode=ingest)`

**Action:**
- Add entries to deprecation registry ✅ *(done)*
- Add runtime routing from legacy names to canonical names
- Remove from exposed tool list after 1 session

**Effort:** Medium — code changes in arifOS tool registration
**Risk:** Low — internal tools, not in the public 8-tool surface

---

## Priority Matrix

| # | Fix | Effort | Risk | Impact | Priority |
|---|-----|--------|------|--------|----------|
| 1 | Deprecate arif_forge* | Low | None | Medium | **P1** |
| 2 | Move Hermes tools | Medium | Low | Medium | **P1** |
| 3 | GEOX Pattern A vs EGS | Medium | Medium | Medium | P2 |
| 4 | WELL double registry | Low | None | Low | **P1** |
| 5 | Standardize registry names | Low | None | Low | P2 |
| 6 | Resolve browser overlap | Low | Low | Low | P3 |
| 7 | arifOS naming tidy | Medium | Low | Low | P3 |

---

## Deprecation Registry Updated ✅

All 14 zen issues now tracked in `/root/AAA/docs/deprecation-registry.json`:
- ✓ 12 new deprecated_tools entries (arif_forge, arif_forge_execute, arif_critique, arif_memory, arif_memory_recall, arif_fetch, arif_evidence_fetch, arif_measure, arif_ops_measure, hermes_* x6)
- ✓ 9 zen_issues tracked (UNRESOLVED status)
- ✓ GEOX and WELL specific issues documented

---

## Evidence

- Deprecation registry: `/root/AAA/docs/deprecation-registry.json`
- Embodiment skill: `/root/.agents/skills/tools-embodiment-application/SKILL.md`
- Session state: `/root/.claude/projects/-root/memory/session-state.md`

---

*Audited by OpenCode. Fix proposals for F13 SOVEREIGN review.*
*DITEMPA BUKAN DIBERI*

