# MEMORY CONSOLIDATION — Tiered Execution Plan
**Date:** 2026-07-08 18:46 UTC
**Inputs absorbed:**
1. `/root/A-FORGE/forge_work/2026-07-08/MEMORY-SURFACE-AUDIT.md` (232 lines, FORGE/000Ω, SEAL-cece138ff9194733)
2. `/root/A-FORGE/forge_work/2026-07-08/UNIFIED-MEMORY-ARCHITECTURE.md` (143 lines, FORGE/000Ω, same session)
3. Live filesystem probe (`/root/.agents/skills/`, `carry_forward.json`, `/root/AAA/asi/knowledge-taxonomy.json`)
**Sovereign:** Arif (F13) — SABAR HOLD until approval

---

## 0 · Drift check before tier proposal

`/root/.local/share/arifos/carry_forward.json` shows:
- `identity_drift: DRIFT`
- `next_safe_action: ADDRESS_DRIFT_BEFORE_PROCEED`
- `last_seal: verdict=SEAL, epoch=unknown`
- 2 active scars (2026-06-15, 2026-06-30)

**Per F1/F11/F13:** Drift state should be closed before adding new tiers. Drift is **prior session's unpaid debt**, not the current tier plan's blocker — but it must be resolved first or it inherits every new seal.

---

## 1 · Live state vs audit-doc claims (drift in the audit itself)

The MEMORY-SURFACE-AUDIT.md has 3 factual drift points when checked against live filesystem (2026-07-08 18:46):

| Audit claim | Live filesystem | Status |
|---|---|---|
| `999-vault-seal-immutable` ARCHIVED | ACTIVE at `/root/.agents/skills/999-vault-seal-immutable/` | **STALE — already reactivated** |
| `zen-organ-memory` ARCHIVED | ACTIVE at `/root/.agents/skills/zen-organ-memory/` | **STALE — already reactivated** |
| `asi-knowledge-writeback` ARCHIVED | ACTIVE at `/root/.agents/skills/asi-knowledge-writeback/SKILL.md` | **STALE — already reactivated** |
| `S15 knowledge_graph_query` MISSING | ACTIVE at `/root/.agents/skills/knowledge-graph-query/SKILL.md` (created 18:46) | **STALE — created minutes ago** |

**Implication:** The audit captures a **T1.5 moment in time** before someone (probably another OpenCode/Kimi session today) executed A1+A2 of the UNIFIED-MEMORY-ARCHITECTURE proposal. The proposal's actions 1, 2, and 3 are already done.

**What remains from the proposal:**
- A3: Create `unified-memory-federation` skill — **TODO**
- A4: Memory consolidation script (L0→L5 pipeline) — **TODO**
- A5: Auto-ingest carry_forward at boot — **TODO**
- A6: Remove/deprecate `forge_vault` duplicate — **TODO, requires T2 (gateway-level)**

---

## 2 · Memory architecture current state (live, not aspirational)

```
                    ┌─────────────────────────────────────────┐
                    │         arifOS (8088)                    │
                    │  arif_memory (8 modes) ← CANONICAL       │
                    │  arif_seal (5 modes) ← VAULT999          │
                    │  carry_forward.json ← DRIFT state        │
                    │  seal_chain.jsonl ← LIVE (84+ seals)     │
                    └──────────────┬──────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
    ┌─────────▼──────┐  ┌────────▼────────┐  ┌───────▼────────┐
    │ A-FORGE (7071) │  │  WELL (18083)   │  │ WEALTH (18082) │
    │ forge_memory   │  │ well_trace_     │  │ wealth_vault_  │
    │ forge_vault ⚠ │  │   lineage       │  │   query/write  │
    │ forge_skill-   │  │                 │  │                │
    │   store_*      │  └─────────────────┘  └────────────────┘
    └────────────────┘
              │
    ┌─────────▼──────────────────────────────┐
    │ AAA (3001)                              │
    │ knowledge-taxonomy.json (841 nodes,873) │
    │ S15 READ: knowledge-graph-query ACTIVE  │
    │ S14 WRITE: asi-knowledge-writeback ACTIVE│
    └─────────────────────────────────────────┘
```

⚠ = `forge_vault` is the only remaining direct duplicate of `arif_seal`. Per the proposal A6, deprecate.

---

## 3 · Tiered execution plan — 4 tiers, F13 ack gates

### Tier 0 — Drift closure (BLOCKING, F13 ack required)

| Step | Action | Reversibility | Blast |
|---|---|---|---|
| 0.1 | Read prior session `session-2026-07-04-drift-close.md` to understand what drift = DRIFT refers to | FULL | LOW |
| 0.2 | Inspect 2 active scars (2026-06-15, 2026-06-30) — read first lines, check if metabolized | FULL | LOW |
| 0.3 | Decide: SEAL drift resolution or escalate to 888_HOLD if scars unaddressed | IRREVERSIBLE | LOW |
| 0.4 | Update `carry_forward.json` with new last_seal hash after closure | MEDIUM (state file) | LOW |

**Why first:** New memory tiers inherit drift state if not closed. Sealing L5 entries on top of an open DRIFT compounds the entropy.

### Tier 1 — Audit-doc reconciliation (autonomous, T1)

| Step | Action | Reversibility | Blast |
|---|---|---|---|
| 1.1 | Patch `MEMORY-SURFACE-AUDIT.md` §2 — move 3 skills from "Archived" → "Already Reactivated" column | FULL | LOW |
| 1.2 | Patch `MEMORY-SURFACE-AUDIT.md` §5 C2 — strike the "CRITICAL SKILLS ARCHIVED" contradiction | FULL | LOW |
| 1.3 | Add OBSERVATION block: "Audit reflects state at SEAL-cece138ff9194733 inception. Reactivation A1+A2 already executed in subsequent session." | FULL | LOW |
| 1.4 | Re-emit audit with `last_verified: 2026-07-08T18:46Z` + new state hash | FULL | LOW |

### Tier 2 — Unified memory skill + consolidation script (T2, F13 ack on irreversible)

| Step | Action | Reversibility | Blast |
|---|---|---|---|
| 2.1 | Create `/root/.agents/skills/unified-memory-federation/SKILL.md` with L0-L5 routing table from proposal §4 | FULL | LOW |
| 2.2 | Create `scripts/recall.sh` — fan-out across L0-L5, merge with tier labels | FULL | LOW |
| 2.3 | Create `scripts/consolidate.sh` — runs L0→L5 promotion pipeline at session end | MEDIUM (writes daily memory) | LOW |
| 2.4 | Bind `unified-memory-federation` to arifOS via `forge_register` (subject to APEX v36Ω gates) | FULL | MEDIUM |
| 2.5 | Test in dry-run mode on the 841-node graph (verify S15 read path returns real nodes) | FULL | LOW |
| 2.6 | SEAL the skill to VAULT999 (F13 ack required — irreversible) | IRREVERSIBLE | LOW |

### Tier 3 — `forge_vault` deprecation (T2, F13 ack on gateway surface change)

| Step | Action | Reversibility | Blast |
|---|---|---|---|
| 3.1 | Audit every caller of `forge_vault` in /root/A-FORGE and /root/AAA and /root/.arifos | FULL | LOW |
| 3.2 | For each caller: rewrite to use `arif_seal` directly (domain wrapper pattern) | FULL (with old code retained) | MEDIUM |
| 3.3 | Add deprecation notice to `forge_vault` schema (`[DEPRECATED] use arif_seal`) — pattern matches `forge_systemctl` | FULL | LOW |
| 3.4 | Wait 1 rotation cycle (~7 days) | — | — |
| 3.5 | Remove `forge_vault` from MCP registry (F13 ack — gateway surface change) | IRREVERSIBLE | HIGH |
| 3.6 | SEAL the deprecation | IRREVERSIBLE | LOW |

### Tier 4 — Auto-ingest carry_forward at boot (T1, autonomous)

| Step | Action | Reversibility | Blast |
|---|---|---|---|
| 4.1 | Add `carry_forward_ingest` hook to `arif_init` mode = `init` and `resume` | FULL (env var toggle) | LOW |
| 4.2 | Hook reads `carry_forward.json` after session bind, surfaces DRIFT/SCAR state to agent context | FULL | LOW |
| 4.3 | Test: stub DRIFT state, verify agent sees `next_safe_action: ADDRESS_DRIFT_BEFORE_PROCEED` | FULL | LOW |

---

## 4 · FLOOR alignment matrix

| Floor | Tier 0 | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---|---|---|---|---|
| F1 AMANAH | drift close is reversible | doc patch reversible | skill create reversible; SEAL irreversible | vault deprecation has rollback window | hook reversible via env |
| F2 TRUTH | — | audit OBS/DER labels preserved | skill references live state | caller audit logs all rewrites | — |
| F4 CLARITY | one carry_forward.json | audit deduped | one canonical skill | forge_vault removed (ΔS<0) | one ingestion point |
| F7 HUMILITY | — | — | recall reports confidence per tier | — | — |
| F11 AUDIT | new seal on drift close | patch leaves hash trail | consolidation script logs each step | caller audit + deprecation seal | hook logs every boot ingest |
| F13 SOVEREIGN | required for tier 0.3 | — | required for 2.6 | required for 3.5 + 3.6 | — |

---

## 5 · Cross-document map (where this plan lives)

| Artifact | Path | Role |
|---|---|---|
| This plan | `/root/A-FORGE/forge_work/2026-07-08/MEMORY-CONSOLIDATION-TIERED-PLAN.md` | Execution contract |
| Audit input | `/root/A-FORGE/forge_work/2026-07-08/MEMORY-SURFACE-AUDIT.md` | Drift inventory (already partly resolved) |
| Architecture input | `/root/A-FORGE/forge_work/2026-07-08/UNIFIED-MEMORY-ARCHITECTURE.md` | Design (proposal status: A1+A2 done) |
| Skills to create | `/root/.agents/skills/unified-memory-federation/` (Tier 2) | Future SKILL.md + scripts |
| Carry-forward | `/root/.local/share/arifos/carry_forward.json` | Drift state to resolve (Tier 0) |

---

## 6 · Open questions before execution

1. **Tier 0 priority** — is drift closure happening now, or scheduled separately? The carry_forward shows `last_seal.epoch: unknown` and 2 scars. Sabar sebelum proceed.
2. **Tier 3 timing** — `forge_vault` removal is HIGH blast (gateway surface change). Standard practice: 7-day deprecation window. Confirm window or override?
3. **Who owns Tier 2** — `unified-memory-federation` skill creation. The proposal doesn't name an owner. Suggest: Hermes (memory steward across sessions). Confirm?
4. **Live vs aspirational** — the audit doc frames memory as fragmented; live state is less fragmented than the doc claims (S15 just shipped, A1+A2 already done). Recompute the "fragmentation index" before sealing tier 2.

---

## 7 · Authorship + receipt plan

- **Tier 0 seal:** pending F13 ack, will write to VAULT999 with carry_forward before/after hashes
- **Tier 1 patch:** no seal needed (reversible doc fix)
- **Tier 2 seal:** at step 2.6, with G≥0.80 verification, prior judge path via arif_judge
- **Tier 3 seal:** at step 3.6, with full caller-audit receipt bundle
- **Tier 4 hook:** no seal needed (env-flag reversible)

All tiers observe: 1 irreversible action per seal event (F1), so 4 irreversible events total (Tier 0.3, Tier 2.6, Tier 3.5, Tier 3.6).

---

**SABAR HOLD** — awaiting F13 ack on Tier 0 (drift closure) before any execution.

DITEMPA BUKAN DIBERI.