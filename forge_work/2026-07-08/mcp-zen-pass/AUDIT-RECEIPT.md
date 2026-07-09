# MCP ZEN PASS — Audit Receipt
**Date:** 2026-07-08
**Operator:** FORGE (000Ω) for F13 SOVEREIGN
**Scope:** GEOX `/root/GEOX/src/geox_mcp/` — 3 candidate files
**Status:** AUDIT COMPLETE, NO MUTATION

---

## TL;DR

The 3 candidate files flagged as "bloat" by initial pass are **NOT bloat**.
All three are load-bearing for the GEOX clean architecture (Phase 2.1, 2026-06-29).
Correct zen action is **delegate to arifOS kernel**, not delete. That requires
888_HOLD per GEOX AGENTS.md (tool registry changes are locked).

**Outcome of this pass:** Zero files quarantined. Audit receipt written.
No live mutation attempted. No production deployment needed.

---

## Per-file verdict

### 1. `surface_migration.py` — 293 lines — **KEEP**

**Function:** Migration audit receipt. Maps 81 legacy surface routes + 50 alias routes to unified GEOX modes (`geox_observe`, `geox_compute`, `geox_interpret`, `geox_model`, `geox_spatial`, `geox_bridge`). Exports `audit_surface_migration()` that validates integrity.

**Imports:** Test file only (`tests/unit/test_surface_migration.py`). Zero live server.py imports.

**Why not bloat:**
- Fossil record of Phase 2.1 clean-architecture pass
- `audit_surface_migration()` is the regression guard: if anyone adds a new tool and forgets to register the legacy alias, this catches it
- Test `test_fossilization_scope_counts_stable` enforces 81+50 invariant
- Removing it = removing the safety net that ensures backward-compat doesn't silently break

**Verdict:** KEEP as-is. The fact that it's test-only is correct — it IS the test for the migration.

---

### 2. `geox_middleware.py` — 415 lines — **ZEN TARGET, T3 GATED**

**Function:** Provides two Starlette middlewares:
- `GeoxGovernanceMiddleware` — auth/session/audit gating on every request
- `GeoxToolListTtlMiddleware` — TTL cache for tool list responses

**Imports:** `server.py:310` and `server.py:330`. Loaded unconditionally at server startup.

**Why it's a zen violation:**
- Zen rule: MCP server should be a dumb pipe; governance belongs in arifOS kernel
- GEOX is currently doing governance INSIDE its MCP server (auth checks, session checks, audit logging)
- That's the brain-in-the-wrong-place problem

**Why it's NOT simple delete:**
- 415 lines of actual governance logic
- Removing it = losing auth + audit for all 35 GEOX tools
- Must be ported to arifOS `forge_check_governance` or equivalent first
- server.py:310, 330 must be rewired

**Verdict:** Refactor target. Port governance → arifOS kernel, then strip middleware. Requires 888_HOLD per GEOX AGENTS.md §"Requires 888_HOLD" (tool registry changes).

---

### 3. `tools_wiring.py` — 1638 lines — **ZEN TARGET, T3 GATED**

**Function:** `register_tools_on(mcp)` — registers all 35 canonical GEOX tools onto a FastMCP instance. The single largest piece of code in server.py's footprint (37% of server.py lines).

**Imports:** `server.py:2688` (called once at startup).

**Why it's a zen violation:**
- Wiring = registration logic. Per zen doctrine, the kernel should register tools, not the MCP server
- 1638 lines of tool glue = maintenance debt + coupling
- "register_tools_on" as a function pattern IS the API gateway anti-pattern (zen rule: "You ARE the tool, not a gateway")

**Why it's NOT simple delete:**
- Every one of the 35 canonical tools needs to be registered somewhere
- Auto-discovery via decorators + canonical registry would be the alternative
- Currently branch `pr-121` has uncommitted modifications to this file — mid-merge state

**Verdict:** Refactor target. Migrate to decorator-based registration driven by `registry.py:CANONICAL_PUBLIC_TOOLS`. Requires 888_HOLD.

---

## Branch state observed (OBS)

- Branch: `pr-121` (not main)
- Uncommitted modifications: `entrypoint.sh`, `entrypoint_unified.sh`, `src/geox_mcp/server.py`, `src/geox_mcp/tools/unified_dispatcher.py`, `src/geox_mcp/tools_wiring.py`
- Deleted files: `tests/test_analog_atlas.py`, `tests/test_biharmonic_grid.py`, `tests/test_contrast_views.py`, `tests/test_crustal_domain_classify.py`, `tests/test_e2e_geox_real.py`, `tests/test_geox_sovereign_e2e.py`
- Last commit: `c50fcd8a chore: session artifacts + eval scripts from 2026-07-07`

**Risk note:** Mid-merge state means any large refactor should either:
(a) wait until pr-121 lands, or
(b) target pr-121 directly with new commits.

---

## Recommended path (T3 path, needs sovereign 888_HOLD)

**Phase A — Foundation (T2, sovereign announce):**
1. Wait for pr-121 merge to main, OR explicitly authorize refactor on pr-121 branch
2. Re-run zen audit on main branch state

**Phase B — Middleware delegation (T3, 888_HOLD):**
1. Port `GeoxGovernanceMiddleware` logic → arifOS `forge_check_governance`
2. Port `GeoxToolListTtlMiddleware` → arifOS tool registry cache
3. Strip `geox_middleware.py` to thin shim that delegates to arifOS
4. server.py:310, 330 rewire
5. Full test pass required before merge per GEOX AGENTS.md

**Phase C — Wiring collapse (T3, 888_HOLD):**
1. Migrate `register_tools_on` → decorator-driven auto-registration from `registry.py`
2. Strip `tools_wiring.py` (or shrink to <200 lines of pure glue)
3. server.py:2688 rewire
4. Full test pass

**Phase D — Surface migration fossilization (T2, sovereign announce):**
1. Once Phase B+C stable for 30+ days: convert `surface_migration.py` from active module to archived test fixture
2. Keeps the audit function but moves it to `tests/fixtures/legacy_routes_snapshot.json`

---

## What this pass DID NOT do (and why)

- ❌ Did NOT quarantine any files. None of the 3 were actual bloat.
- ❌ Did NOT modify server.py. Touching live server on live organ = T3, needs 888_HOLD.
- ❌ Did NOT restart GEOX daemon. The live process on :8081 is unaffected.
- ❌ Did NOT push to git. Branch state observed, no changes staged.

## What this pass DID do

- ✅ Read all 3 candidate files
- ✅ Mapped import graph (server.py:310, 330, 2688 + tests/unit/test_surface_migration.py:1)
- ✅ Identified branch state (pr-121, uncommitted mods)
- ✅ Surfaced 3-action path with explicit T1/T2/T3 gates
- ✅ Surfaced GEOX AGENTS.md constraint (tool registry = 888_HOLD)

---

## Sovereign decisions pending

| Question | Recommendation |
|---|---|
| Wait for pr-121 merge? | YES — cleaner refactor target |
| Or refactor on pr-121? | OK if explicitly authorized |
| Phase B (middleware → kernel) | 888_HOLD required, recommend Q3 2026 |
| Phase C (wiring → decorators) | 888_HOLD required, recommend Q3 2026 |
| Phase D (fossilize migration) | Announce only, T2 |

---

*DITEMPA BUKAN DIBERI — Zen is forged through honest reading, not reflexive deletion.*

**Sealed:** forge_work/2026-07-08/mcp-zen-pass/AUDIT-RECEIPT.md
**Actor:** FORGE (000Ω)
**Hash:** `3db8bfce3dbc4e69dd00821a109fc2bfc7952da6cfa1fc18ef8229aa1e1745a7`
**Finalized:** 2026-07-09 (FORGE-000Ω)