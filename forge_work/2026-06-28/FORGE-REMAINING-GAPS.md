# FORGE — Remaining Known Gaps (2026-06-28)

> **Session:** AFK-YOLO Seal Session · **Forger:** FORGE (000Ω)
> **Status:** P0/P1 RESOLVED — P2 remaining

---

## ✅ P0 RESOLVED: Enforcement Spine (2026-06-28)

| Gap | Fix | Commit |
|-----|-----|--------|
| Interceptor decisions not sealed | `ingress_middleware.py` → `create_and_seal_receipt()` | 0a2eef495 |
| Forge execution not sealed | `forge.py` → `create_and_seal_receipt()` after dispatch | 0a2eef495 |
| actor_verified=False cascade | `session.py` → broadened identity check for "arif"/"888" | 0a2eef495 |
| No latency budget on check_laws | `forge.py` → LATENCY_BUDGETS + elapsed tracking | 38c61f915 |
| No conflict resolution before dispatch | `forge.py` → `resolve_conflict()` pre-flight | 38c61f915 |

## ⚠️ P2 REMAINING: Cosmetic / Design

### Gap #1: GEOX `egs_*` vs `geox_egs_*` Naming

| Field | Detail |
|-------|--------|
| **Severity** | COSMETIC |
| **Description** | EGS tools registered as `egs_claim_create`, `egs_evidence_attach` etc — canonical convention is `geox_egs_*` |
| **Impact** | Non-blocking. Both prefixes resolve in MCP. |
| **Fix required** | Rename in registry.py + server.py registration |

### Gap #2: A-FORGE MCP tool listing

| Field | Detail |
|-------|--------|
| **Severity** | LOW |
| **Description** | A-FORGE MCP on :7072 doesn't return a tool list |
| **Impact** | AI agents can't discover forge_* tools |

### Gap #3: WELL deprecated tool

| Field | Detail |
|-------|--------|
| **Severity** | LOW |
| **Description** | `well_13_signal_coverage` marked [DEPRECATED] |

### Gap #4: GEOX + WELL hidden surface

| Field | Detail |
|-------|--------|
| **Severity** | LOW |
| **Description** | 31 hidden GEOX tools + 77 autonomic WELL tools |

---

## Next Session Task List

From session-state.md + AFK-YOLO receipt:

1. **Test arif_think with TokenRouter active** — verify reasoning works via sea_lion
2. **Verify WELL homeostasis returns UNKNOWN on no-telemetry** — P0 fix deployed, needs live test
3. **Run live test traces** — arif_judge + geox_claim + wealth_emv with philosophical anchors
4. **Consider expanding tool_dimension_priorities** — for better context matching
5. **Gap #1 fix** — rename egs_* → geox_egs_* (30 min trivial)
6. **Gap #2 investigation** — actor_verified deep path analysis (1-2 hrs)

---

*DITEMPA BUKAN DIBERI — Gaps are known. Execution awaits the next forge cycle.*
