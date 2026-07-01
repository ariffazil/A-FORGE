# Canonical Verb Purification — Surface Discovery Report
**Date:** 2026-06-30
**Stage:** 1 of 7 — Surface Discovery
**Agent:** FORGE (000Ω) | A-FORGE lane
**Classification:** OBS — observed findings, DER — derived

---

## Executive Summary

The federation MCP surface has 6 distinct verb-collision patterns across 5 organs. arifOS carries the highest entropy load (41 diagnostic aliases). WEALTH is cleanest. GEOX has phantom tool leak (31 canonical vs 62 registered). The public/private surface split on arifOS is F13-ratified and intentional — not drift.

---

## 1. Tool Surface Map

### arifOS (Constitutional Kernel)
| Surface | Count | Status |
|---------|-------|--------|
| Public manifest (mcp.arif-fazil.com) | 7 | ✅ Intended facade |
| MCP `/tools` endpoint | 48 | ⚠️ Diagnostic superset |
| CANONICAL_TOOLS (internal core) | 17 | ✅ F13-ratified hidden |
| Diagnostic helpers | 41 | 🔶 Verb-collision candidates |

**7 Canonical (public):**
`arif_init`, `arif_observe`, `arif_think`, `arif_route`, `arif_judge`, `arif_act`, `arif_seal`

**10 Internal canonical (hidden from public, F13-ratified):**
`arif_bridge_connect`, `arif_compose`, `arif_critique`, `arif_fetch`, `arif_forge`, `arif_judge_deliberate`, `arif_kernel_intercept`, `arif_measure`, `arif_memory`, `arif_triage`

**Execution aliases (highest collision risk):**
- `arif_forge_execute` ← collision: `aforge_forge_execute`
- `arif_vault_seal` ← collision: `aforge_forge_seal`
- `arif_judge_deliberate` ← collision: `arif_judge`

### A-FORGE (Execution Shell)
| Surface | Count | Status |
|---------|-------|--------|
| Registered MCP tools | 70+ | ⚠️ Auth denied (L1_IDENTITY:anonymous_actor) |
| forge_* canonical | ~40 | 🔶 Verb collision with arifOS |

**Known collisions:**
- `forge_execute` / `forge_forge_execute`
- `forge_seal` / `forge_vault_seal`
- `forge_judge` / `forge_judge_proxy`

### GEOX (Earth Intelligence)
| Surface | Count | Status |
|---------|-------|--------|
| Canonical tools | 31 | ✅ |
| Registered FastMCP | 62 | ❌ **31 phantom entities** |
| Deprecated still callable | 6 | ⚠️ |

**Phantom tool ratio:** 50% leak — highest of any organ.

### WEALTH (Capital Intelligence)
| Surface | Count | Status |
|---------|-------|--------|
| Total tools | 26 | ✅ All canonical |
| Deprecated | 0 | ✅ Clean |

### WELL (Human Readiness)
| Surface | Count | Status |
|---------|-------|--------|
| Total tools | ~13 | ✅ |
| Deprecated still callable | 6 | ⚠️ |

**Deprecated still callable:** `well_assess_governance`, `well_get_health`, `well_init`, `well_machine_state`, `well_readiness`, `well_state`

---

## 2. Verb Collision Matrix

| Verb | arifOS | A-FORGE | GEOX | WEALTH | WELL |
|------|--------|---------|------|--------|------|
| `*_execute` | arif_forge_execute | forge_execute | — | — | — |
| `*_seal` | arif_vault_seal | forge_seal | — | — | — |
| `*_judge` | arif_judge_deliberate | forge_judge_proxy | — | — | — |
| `*_init` | arif_init, arif_session_init | forge_session_init | — | — | well_init (dep) |
| `*_health` | arif_kernel_health | forge_health_check | — | — | well_get_health (dep) |
| `*_measure` | arif_measure, arif_ops_measure | — | — | — | — |
| `*_memory` | arif_memory, arif_memory_recall | forge_memory | — | — | — |

---

## 3. Deprecation Registry Findings

**Source:** `/root/AAA/docs/deprecation-registry.json` (~28k chars, 50+ entries)

**Patterns:**
- Version-gated aliases (v1 → v2 migration)
- Organ-specific deprecations
- FastMCP wrapper decompositions
- Tool renaming with `_v2` suffixes

**Key migrations needed:**
- WELL: 6 tools need alias cleanup
- GEOX: 31 phantom tools need classification (alias vs deprecated vs canonical)

---

## 4. Runtime Drift

**arifOS health endpoint reports:**
```
build_commit:    85f6e57  ← production image
live_commit:     02e72f4  ← running code
verdict:         runtime_drift = TRUE
severity:        warning
known_gap:       "rebuild container to sync"
```

**⚠️ Action required:** Container rebuild to sync live code with production image. Not a security issue but affects canonical surface consistency.

---

## 5. Entropy Sources (Ranked)

| Rank | Source | Organ | Entropy Level | Pattern |
|------|--------|-------|--------------|---------|
| 1 | 41 diagnostic aliases | arifOS | HIGH | SDK helpers leaked to MCP surface |
| 2 | 31 phantom tools | GEOX | HIGH | FastMCP over-registration |
| 3 | 10 execution aliases | arifOS+A-FORGE | CRITICAL | Verb collision on execute/seal/judge |
| 4 | 6 deprecated WELL tools | WELL | MEDIUM | Legacy aliases still callable |
| 5 | runtime drift | arifOS | LOW | Container desync (warning only) |

---

## 6. Recommended Purge Order

### Phase 1 (Immediate — surgical)
1. Collapse `arif_forge_execute` → `aforge_forge_execute` (or vice versa — pick canonical)
2. Collapse `arif_vault_seal` → `aforge_forge_seal`
3. Collapse `arif_judge_deliberate` → `aforge_forge_judge_proxy`
4. Retire WELL deprecated: `well_init`, `well_state`, `well_readiness`, `well_machine_state`, `well_get_health`, `well_assess_governance`

### Phase 2 (Week 2 — structural)
5. Classify GEOX 31 phantom tools (alias vs deprecated vs canonical)
6. Establish FastMCP registration boundary for GEOX

### Phase 3 (Week 4 — systemic)
7. Enforce one-verb-per-action-class rule across all organs
8. Canonical manifest versioning (public 7 vs internal 17 split formalized)

---

## 7. Open Questions

1. **Which canonical wins in arifOS vs A-FORGE collisions?** arifOS is sovereign kernel, A-FORGE is governed executor — but execution aliases live on A-FORGE. Need F13 ruling on which namespace takes precedence.

2. **Should 41 diagnostic tools be hidden from MCP surface entirely?** Currently they appear in `/tools` but are not in public manifest. Rationale: diagnostic = internal. Leak = noise for agents.

3. **GEOX 31 phantom tools — classify before purge.** Could be legitimately registered but not yet implemented, or over-registration from FastMCP wrapper.

4. **Runtime drift: rebuild container or update production image?** Two options: (a) rebuild container from 85f6e57, or (b) push live code (02e72f4) to production.

---

## 8. Evidence

- Public manifest: `https://mcp.arif-fazil.com/manifest/tools.json` (7 tools, v2026.06.30)
- arifOS health: `curl localhost:8088/health` (48 tools exposed, 17 canonical)
- arifOS tools: `curl localhost:8088/tools` (7 in MCP list)
- Deprecation registry: `/root/AAA/docs/deprecation-registry.json` (50+ entries)
- Tool registry: `/root/AAA/docs/TOOLREGISTRY.json` (canonical skill definitions)

---

**Report ID:** FORGE-SD-2026-06-30-001
**Next tool:** arifOS surface_probe or filesystem deep-scan of tool definitions
**EOF**
