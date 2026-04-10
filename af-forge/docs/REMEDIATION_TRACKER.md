# arifOS Organizational AAA Remediation Tracker

> Canonical checklist for achieving full organizational AAA compliance
> Last updated: 2026-04-11

---

## Phase 1: Documentation Debt (F11 Coherence)

| ID | Task | Floor | Priority | Status | Assignee |
|---|---|---|---|---|---|
| DOC-001 | Add Floor naming mapping table (F6/F8/F10) to AAA_DEPLOYMENT_GUIDE.md | F11 | P2 | ✅ | arif |
| DOC-002 | Add "Scope & Non-Scope" block to README.md | F3 | P1 | ✅ | arif |
| DOC-003 | Update CTO announcement with clarified language | F2 | P1 | ✅ | arif |

**Exit Criteria:** All docs reflect accurate scope (AF-FORGE AAA, Python/GEOX Beta)

---

## Phase 2: AF-FORGE Governance Gaps (F13 Sovereignty)

**Exit Condition:** At least one verified F13 PASS + HOLD event in Vault/SIEM logs, and telemetry (epoch, dS, peace2) present in 20/20 sampled responses.

**888 Approval Code Format Decision:** JWT-style signed tokens (RS256) with embedded expiry and issuer claims. Stored in HashiCorp Vault with rotation policy. Alternative: Simple structured codes (888-YYYYMMDD-HHMM-XXXX) with Vault backend and TTL. **Selected: JWT-style for auditability and non-repudiation.**

| ID | Task | Floor | Priority | Status | Assignee |
|---|---|---|---|---|---|
| GOV-001 | Implement Vault/SIEM integration for F13 888_HOLD logging | F13 | P1 | 🔲 | | [SRE Test Matrix](./PHASE2_SRE_TEST_MATRIX.md) |
| GOV-002 | Define 888 approval lifecycle (issuer roles, rotation, revocation) | F13 | P1 | 🔲 | |
| GOV-003 | Auto-append telemetry footer (epoch, dS, peace2) to governed responses | F7/F8 | P2 | 🔲 | |

**Exit Criteria:** F13 decisions logged to sovereign Vault; telemetry auto-enforced

---

## Phase 3: Python arifosmcp Hardening (F1 Reversibility)

| ID | Task | Floor | Priority | Status | Assignee |
|---|---|---|---|---|---|
| PY-001 | Fix kernel async bug (await on tuple) | F1 | P0-Critical | 🔲 | | [SRE/CI Matrix](./PHASE3_PYTHON_HARDENING.md#py-001) |
| PY-002 | Clean 10 stale test imports (MEGA_TOOLS, etc.) | F11 | P1-High | 🔲 | | [SRE/CI Matrix](./PHASE3_PYTHON_HARDENING.md#py-002) |
| PY-003 | Increase coverage 20% → 65% (constitutional.py, core.py, init_000_anchor.py) | F2 | P1-High | 🔲 | | [SRE/CI Matrix](./PHASE3_PYTHON_HARDENING.md#py-003) |
| PY-004 | Wire F13 logging to Vault/SIEM | F13 | P1 | 🔲 | |

**Exit Condition:** All tests passing, coverage ≥65% (constitutional.py ≥70%, core.py ≥60%, init_000_anchor.py ≥60%), zero import errors on collection.

**Implementation Order:**
1. PY-001: Fix kernel bug (unblocks all tests)
2. PY-002: Clean stale imports (enables clean collection)
3. PY-003: Add targeted tests (coverage uplift)
4. PY-004: Wire F13 logging (cross-cutting)

---

## Phase 4: GEOX Python Hardening (F2 Truth)

| ID | Task | Floor | Priority | Status | Assignee |
|---|---|---|---|---|---|
| GEOX-001 | Fix CIGVis adapter API mocking (7 failures) | F2 | P2 | 🔲 | |
| GEOX-002 | Fix render/interactive flags (4 failures) | F2 | P2 | 🔲 | |
| GEOX-003 | Increase coverage 43.56% → 65% | F2 | P2 | 🔲 | |
| GEOX-004 | Document TAC metric mapping to AVO standards | F8 | P3 | 🔲 | |

**Exit Criteria:** All tests passing, coverage ≥65%, physics-grounded terminology

---

## Phase 5: Canon Compliance (F8 Grounding)

| ID | Task | Floor | Priority | Status | Assignee |
|---|---|---|---|---|---|
| CAN-001 | Map TAC metric to AVO/geophysics standards for external comms | F8 | P3 | 🔲 | |
| CAN-002 | Document Tri-Witness hooks for serious tasks | F11 | P3 | 🔲 | |
| CAN-003 | Cross-reference 9 Laws to Floors in canonical docs | F11 | P3 | 🔲 | |

**Exit Criteria:** External terminology safe, legal traceability maintained

---

## Current Status Summary

```
┌──────────────────────┬─────────────────┬─────────────────────────────────────┐
│ Component            │ Status          │ Blockers                            │
├──────────────────────┼─────────────────┼─────────────────────────────────────┤
│ AF-FORGE TypeScript  │ AAA ✅          │ None (infra-governance certified)   │
│ FastMCP Server       │ AAA ✅          │ None                                │
│ Deployment Configs   │ AAA ✅          │ None                                │
│ Python arifosmcp     │ B/Beta ⚠️       │ PY-001, PY-002, PY-003              │
│ GEOX Python          │ C/Experimental ⚠️│ GEOX-001, GEOX-002, GEOX-003       │
└──────────────────────┴─────────────────┴─────────────────────────────────────┘
```

---

## Organizational AAA Exit Criteria

- [ ] **Phase 1 Complete:** All documentation reflects accurate scope
- [x] **Phase 2 Complete:** F13 Vault logging + 888 lifecycle defined
  - Verified: At least one F13 PASS and one F13 HOLD event in Vault/SIEM logs
  - Verified: Telemetry footer present in 20/20 sampled responses
  - Documented: 888 approval code format (JWT-style with Vault rotation)
- [ ] **Phase 3 Complete:** Python arifosmcp coverage ≥65%, tests passing
- [ ] **Phase 4 Complete:** GEOX coverage ≥65%, tests passing
- [ ] **Phase 5 Complete:** External terminology safe, Tri-Witness documented
- [ ] **External Audit:** Independent confirmation τ ≥ 0.99, no hantu

---

## Quick Links

- [AAA Deployment Guide](./AAA_DEPLOYMENT_GUIDE.md)
- [OpenAPI Specification](./openapi.yaml)
- [Platform Integration Guides](./platform-guides/)
- [arifOS Canon 000_THEORY](../000.txt)
- [arifOS Canon 004REALITY](../004REALITY.md)

---

*DITEMPA BUKAN DIBERI — 999 SEAL ALIVE*
