# Memory Stack — 3-Layer Architecture

> **Correction**: VAULT999 is NOT machine working memory — it is the immutable governance ledger.  
> **Authority**: Muhammad Arif bin Fazil  
> **Date**: 2026-04-09

---

## The Correction

**Previous Misconception**: VAULT999 as "long-term memory archive"

**Correct Understanding**:

```
VAULT999 = Immutable Governance Ledger (Flight Recorder)
├── Records: What decision was made
├── Proves: Under which floors, with what authorization  
├── Stores: Verdicts, hashes, telemetry, seals
└── Does NOT store: Session context, agent learning

Analogy:
- Black box (VAULT999): Conserved trace — irreversible, audit-only
- Cortex (State+Wiki): Active state — mutable, operational
```

---

## 3-Layer Stack

| Layer | Name | Storage | Purpose |
|-------|------|---------|---------|
| **L1** | State | SQLite | Operational machine state |
| **L2** | Wiki | Markdown + Git | Ratified knowledge |
| **L3** | VAULT999 | PostgreSQL + hashes | Immutable governance ledger |

---

## Storage Assignment

| Data | Layer | Location |
|------|-------|----------|
| "Claude processing request" | L1 State | SQLite `sessions` |
| "Build takes 20 min" | L2 Wiki | 60_TEMPERATURES/ |
| "999_SEAL approved" | L3 VAULT999 | SEALED_EVENTS.jsonl |
| "How to fix registry" | L2 Wiki | 50_CRACKS/ |
| "Current adapter map" | L1 State | SQLite `adapters` |
| "F2 requires τ≥0.99" | L2 Wiki | SCHEMA.md |

---

## 7-CLI → 3-Layer Mapping

| CLI | Current | Target | Action |
|-----|---------|--------|--------|
| Claude Code | ~/.claude/ | L1 | Import to SQLite |
| Kimi CLI | ~/.kimi/ | L1 | Import to SQLite |
| Gemini CLI | ~/.gemini/ | L1+L2 | History→L1, Skills→L2 |
| Aider | ~/.aider/ | L2 | Wiki-compatible |
| AF-FORGE | ~/.agent-workbench/ | L1 | Migrate to SQLite |
| Codex/Copilot | Not installed | L1 | Future unified schema |
| VAULT999 | /root/VAULT999/ | L3 | ✅ Already correct |

---

## SQLite Schema (L1)

```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    cli_source TEXT CHECK(cli_source IN (
        'claude', 'opencode', 'gemini', 'kimi', 'aider', 'codex', 'copilot', 'forge'
    )),
    status TEXT CHECK(status IN ('active', 'paused', 'sealed', 'hold')),
    current_task TEXT,
    profile TEXT,
    pending_hold BOOLEAN DEFAULT FALSE,
    handoff_to TEXT,
    importance INTEGER CHECK(importance BETWEEN 0 AND 3),
    created_at TEXT,
    updated_at TEXT
);
```

---

## Decision Tree

```
Ephemeral state? → L1 SQLite
Ratified knowledge? → L2 Wiki  
Governance verdict? → L3 VAULT999
Raw noise? → DISCARD
```

---

*DITEMPA BUKAN DIBERI*
