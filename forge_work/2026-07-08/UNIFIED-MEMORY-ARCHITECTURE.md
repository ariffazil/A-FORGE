# 🧠 UNIFIED MEMORY ARCHITECTURE — Proposal

> **Designer:** FORGE (000Ω) | **Session:** SEAL-cece138ff9194733
> **Scope:** arifOS + AAA + A-FORGE unified memory layer
> **Date:** 2026-07-08 | **Sovereign:** Arif (F13)
> **Status:** PROPOSED — awaiting F13 review

---

## 1. THE PROBLEM (one sentence)

Memory exists in 6+ surfaces, 12+ tools, and 8 skills — but no agent can query "what does the federation remember about X?" in one call.

## 2. THE DESIGN (three principles)

```
1. ONE CANONICAL SOURCE    → arif_memory is the authority
2. DOMAIN WRAPPERS         → organs wrap arif_memory for domain-specific access
3. CONSOLIDATION PIPELINE  → session → daily → knowledge graph → VAULT999
```

## 3. MEMORY TIERS (from zen-organ-memory)

| Tier | Name | Lifetime | Tool | Example |
|------|------|----------|------|---------|
| L0 | **Volatile** | Session only | Session context | Current reasoning state |
| L1 | **Working** | Task duration | forge_work/ | Build artifacts, drafts |
| L2 | **Daily** | 30 days | /root/memory/YYYY-MM-DD.md | Session summaries |
| L3 | **Durable** | Permanent | arif_memory(remember) | Preferences, decisions |
| L4 | **Knowledge** | Permanent | 555-ASI graph | Facts, claims, edges |
| L5 | **Sealed** | Irreversible | arif_seal(seal) | VAULT999, seal chain |

**Rule:** L0→L1 is free. L1→L2 requires session end. L2→L3 requires explicit remember. L3→L4 requires SEAL. L4→L5 requires ack_irreversible.

## 4. UNIFIED SKILL: `unified-memory-federation`

### What it does

One skill that any agent loads at wake. Provides:

```
MEMORY RECALL  — query across all tiers (L0-L5)
MEMORY WRITE   — write to correct tier with governance
MEMORY SEAL    — promote to irreversible (L5)
MEMORY CONSOLIDATE — run the pipeline (L0→L1→L2→L3→L4)
MEMORY AUDIT   — health check on all memory surfaces
```

### Tool Routing

```
recall("what do we know about X?")
    → L0: session context (in-memory)
    → L1: /root/A-FORGE/forge_work/ (grep)
    → L2: /root/memory/ (grep)
    → L3: arif_memory(recall)
    → L4: knowledge-taxonomy.json (search)
    → L5: arif_seal(list) + VAULT999
    → Returns: merged results with tier labels

write("remember this decision", tier=L3)
    → arif_memory(remember)

seal("this is final", ack_irreversible=true)
    → arif_judge → arif_seal(seal)

consolidate()  [session end]
    → L0→L1: save working artifacts
    → L1→L2: write daily summary
    → L2→L3: promote durable memories
    → L3→L4: write knowledge edges (if SEALED)
    → Update carry_forward.json
```

### Implementation Path

| Component | Location | Status |
|-----------|----------|--------|
| Skill file | `/root/.agents/skills/unified-memory-federation/SKILL.md` | TO CREATE |
| Recall script | `/root/.agents/skills/unified-memory-federation/scripts/recall.sh` | TO CREATE |
| Consolidate script | `/root/.agents/skills/unified-memory-federation/scripts/consolidate.sh` | TO CREATE |
| S15 knowledge_graph_query | `/root/.agents/skills/knowledge-graph-query/SKILL.md` | TO CREATE |

## 5. ACTIONS (ordered by priority)

### A1: Reactivate archived memory skills [T1]
```bash
# Move from archive to active
cp -r /root/.agents/skills/.archive-2026-07-08/999-vault-seal-immutable /root/.agents/skills/
cp -r /root/.agents/skills/.archive-2026-07-08/zen-organ-memory /root/.agents/skills/
cp -r /root/.agents/skills/.archive-2026-07-08/asi-knowledge-writeback /root/.agents/skills/
```

### A2: Create S15 knowledge-graph-query skill [T1]
Read path for the 841-node knowledge graph. Query by node type, domain, confidence, relationship.

### A3: Create unified-memory-federation skill [T1]
The master skill. Single entry point for all memory operations.

### A4: Create memory consolidation script [T2]
Session-end script that runs the L0→L5 pipeline.

### A5: Auto-ingest carry_forward at boot [T2]
Add to agent bootstrap: auto-read carry_forward.json, surface DRIFT warnings.

### A6: Remove forge_vault duplicate [T2]
forge_vault duplicates arif_seal. Deprecate in favor of arif_seal wrapper.

## 6. WHAT THIS CHANGES

| Before | After |
|--------|-------|
| 8 scattered memory skills | 1 unified + 3 reactivated |
| 12+ memory tools with overlapping access | 1 canonical (arif_memory) + domain wrappers |
| Knowledge graph orphaned (841 nodes unread) | S15 provides governed read path |
| No consolidation pipeline | Session-end auto-consolidation |
| carry_forward.json requires manual read | Auto-ingested at boot |
| forge_vault duplicates arif_seal | Deprecated, wraps arif_seal |

## 7. AUTHORITY

- **arif_memory** remains the canonical memory authority (arifOS :8088)
- **arif_seal** remains the canonical seal authority (VAULT999)
- Domain wrappers (forge_*, well_*, wealth_*) are convenience layers, not authorities
- Knowledge graph writes require SEAL (via asi-knowledge-writeback)
- Knowledge graph reads are T1 (via S15 knowledge-graph-query)

## 8. FLOOR ALIGNMENT

| Floor | Memory obligation |
|-------|------------------|
| **F1 AMANAH** | No memory deletion without backup. Append-only for L4-L5. |
| **F2 TRUTH** | Every memory entry has epistemic label (OBS/DER/INT/SPEC). |
| **F4 CLARITY** | One canonical surface per tier. No duplicate storage. |
| **F7 HUMILITY** | Memory recall reports confidence, not certainty. |
| **F11 AUDIT** | Every memory write leaves a receipt. |
| **F13 SOVEREIGN** | L5 seal requires ack_irreversible. |

---

*Proposed: 2026-07-08 by FORGE (000Ω) under F13 SOVEREIGN*
*Awaiting: F13 review + approval to implement*
*DITEMPA BUKAN DIBERI*
