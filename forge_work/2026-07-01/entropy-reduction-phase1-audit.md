# ENTROPY REDUCTION — PHASE 1 AUDIT: AAA SCHEMA STANDARDIZATION
# Date: 2026-07-01 | Agent: FORGE (000Ω) | Authority: F13 SOVEREIGN (888)
# Status: HOLD — awaiting 888 clearance for destructive actions

---
## 1. GLOBAL AUDIT: ENTROPY MEASUREMENT

### 1.1 Agent Card Population
| Category | Count | Schema |
|----------|-------|--------|
| AAA canonical warga (v2.0.0) | 9 | `arifOS/agent-card/v2.0.0` |
| AAA legacy (OpenClaw schema) | 1 | `openclaw-a2a-agent-card.schema.json` |
| AAA no-schema (makcikgpt) | 1 | NO_SCHEMA |
| AAA _external agents | 9 | `arifOS/agent-card/v2.0.0` |
| AAA duplicates (dist/public/seed) | 6 | Mixed |
| OpenClaw workspace (legacy) | 17 | NO_SCHEMA / OpenClaw |
| GEOX skills | 11 | `geox-a2a-agent-card.schema.json` |
| Organ .well-known/ + static/ | 14 | NO_SCHEMA |
| arif-sites duplicates | 7 | NO_SCHEMA |
| Other (HERMES, wealth-git) | 2 | Mixed |
| **TOTAL** | **~77** | **5 schema variants** |

### 1.2 Schema Drift

| Schema | Count | Location |
|--------|-------|----------|
| `arifOS/agent-card/v2.0.0` | 21 | AAA/agents/* (canonical) |
| `openclaw-a2a-agent-card.schema.json` | 5 | AAA/agents/main, OpenClaw workspace |
| `geox-a2a-agent-card.schema.json` | 11 | GEOX/skills/* |
| `a2aproject.github.io/A2A/schema/agent-card.json` | 1 | HERMES/agent-card.json |
| NO_SCHEMA | 39 | Cross-organ, legacy, arif-sites |

**ΔS = HIGH.** Five schema standards, 77 files, 39 with no schema at all.

### 1.3 AAA Duplicate Analysis

The AAA gateway has **9 copies** of the same identity card in different locations:

| Path | Identity | Schema | Version |
|------|----------|--------|---------|
| `AAA/agent-card.json` | AAA Gateway | NO_SCHEMA | 1.0.0 |
| `AAA/.well-known/agent-card.json` | AAA Control Plane | NO_SCHEMA | 2026.06.30 |
| `AAA/dist/.well-known/agent-card.json` | AAA Gateway | NO_SCHEMA | 1.0.0 |
| `AAA/dist/a2a/agent-card.json` | (duplicate) | NO_SCHEMA | — |
| `AAA/public/.well-known/agent-card.json` | AAA Gateway | NO_SCHEMA | 1.0.0 |
| `AAA/public/a2a/agent-card.json` | (duplicate) | NO_SCHEMA | — |
| `AAA/src/seed/agent-card.json` | (seed) | NO_SCHEMA | — |

**DRIFT detected:** `AAA/agent-card.json` (v1.0.0, 14 keys) vs `AAA/.well-known/agent-card.json` (v2026.06.30, 13 keys) — different content, different structure.

### 1.4 Cross-Organ Bleed

Every organ has its own `.well-known/agent-card.json` — legitimate for organ discovery. But also has `static/` duplicates with version drift:

| Organ | .well-known/ version | static/ version | DRIFT |
|-------|---------------------|-----------------|-------|
| arifOS | 2026.06.30 | 2026.06.11-SSCT | **YES** |
| GEOX | v2.0.0-UNIFIED | 2026.06.28-phase2.1 | **YES** |
| WEALTH | 2026.06.30 | 2026.06.15 | **YES** |
| WELL | 2026.06.30 | 2026.05.15 | **YES** |

### 1.5 OpenClaw Workspace — 17 Legacy Cards

Location: `/root/.openclaw/workspace/`

These are pre-AAA-migration artifacts. OpenClaw was decommissioned as a decision engine. These cards serve no active discovery purpose. All should be archived, not deleted.

---
## 2. CANONICAL v2.0.0 SCHEMA BASELINE

The most complete v2.0.0 card is **OpenCode CLI** (`AAA/agents/opencode/agent-card.json`):

**Required fields (30 keys):**
- `$schema`: `"arifOS/agent-card/v2.0.0"`
- `id`, `name`, `description`, `version`
- `principal_agent` (type, category, principle_origin)
- `protocolVersion`
- `url`, `provider`, `documentationUrl`
- `capabilities` (streaming, pushNotifications, tool_calling, mcp_native, etc.)
- `securitySchemes` + `security`
- `defaultInputModes`, `defaultOutputModes`
- `skills[]` (id, name, description, tags, floor_scope)
- `autonomy_tiers` (T1, T2, T3)
- `authority_boundary` (canDo, cannotDo)

**Optional extensions (organ/agent-specific):**
- `mcp_servers[]`, `subAgentPolicy`, `model`, `config`, `binary`
- `tier`, `role`, `class`, `trinity`, `bound_to`
- `hexagon_warga`, `warga_status`, `attestation_id`
- `haramakan_*`, `digital_being_doctrine`, `witness_ledger`

---
## 3. ZEN BLUEPRINT: TARGET STATE (ΔS < 0)

```
AAA/
├── agents/
│   ├── 333-AGI/agent-card.json          ← canonical warga v2.0.0
│   ├── 555-ASI/agent-card.json          ← canonical warga v2.0.0
│   ├── 777-forge/agent-card.json        ← canonical warga v2.0.0
│   ├── 888-APEX/agent-card.json         ← canonical warga v2.0.0
│   ├── A-ARCHIVE/agent-card.json        ← canonical warga v2.0.0
│   ├── A-AUDIT/agent-card.json          ← canonical warga v2.0.0
│   ├── hermes-asi/agent-card.json       ← canonical warga v2.0.0
│   ├── main/agent-card.json             ← MIGRATE to v2.0.0
│   ├── makcikgpt/agent-card.json        ← MIGRATE to v2.0.0
│   ├── openclaw/agent-card.json         ← canonical warga v2.0.0
│   └── opencode/agent-card.json         ← canonical v2.0.0 (GOLD REFERENCE)
│
├── _external/                            ← external agents, v2.0.0
│   ├── aider/agent-card.json
│   ├── claude-code/agent-card.json
│   ├── codex/agent-card.json
│   ├── continue-cli/agent-card.json
│   ├── copilot/agent-card.json
│   ├── gemini-cli/agent-card.json
│   ├── grok-build/agent-card.json
│   ├── kimi-code/agent-card.json
│   └── qwen-code/agent-card.json
│
├── .well-known/
│   └── agent-card.json → ../../agents/888-APEX/agent-card.json  (SYMLINK)
│
└── dist/    ← REMOVE (build artifact, regenerated)
    public/  ← REMOVE (build artifact, regenerated)
    src/seed/ ← REMOVE (seed, regenerated)
    agent-card.json ← DELETE (root duplicate, replaced by .well-known symlink)

arifOS/.well-known/agent-card.json       ← KEEP (organ discovery, update to v2.0.0)
A-FORGE/.well-known/agent-card.json      ← KEEP (organ discovery, update to v2.0.0)
GEOX/.well-known/agent-card.json         ← KEEP (organ discovery, update to v2.0.0)
WEALTH/.well-known/agent-card.json       ← KEEP (organ discovery, update to v2.0.0)
WELL/.well-known/agent-card.json         ← KEEP (organ discovery, update to v2.0.0)

arifOS/static/agent-card.json            ← DELETE (duplicate, .well-known/ is source)
arifOS/VAULT999/static/agent-card.json   ← KEEP (VAULT999 is separate organ identity)
GEOX/static/agent-card.json              ← DELETE (duplicate)
WEALTH/static/agent-card.json            ← DELETE (duplicate)
WELL/static/agent-card.json              ← DELETE (duplicate)

arif-sites/sites/*/agent-card.json       ← DELETE (site-specific, generated from organ cards)
arif-sites/sites/*/a2a/agent-card.json   ← DELETE (site-specific, generated from organ cards)

.openclaw/workspace/**/agent-card.json   ← ARCHIVE (17 files, legacy, no active discovery)
HERMES/agent-card.json                   ← MIGRATE to v2.0.0
wealth-git/.well-known/agent-card.json   ← DELETE (stale, WEALTH/ is canonical)
```

**ΔS reduction: 77 files → ~22 canonical files. 55 removed. 71% entropy reduction.**

---
## 4. REFACTOR SEQUENCE

### Phase 1: AAA Internal Deduplication (THIS AUDIT)
**Blast radius: LOW** — metadata only, no runtime impact.
**Reversibility: FULL** — all deletions are file-level, git-revertable.

| Step | Action | Files affected |
|------|--------|---------------|
| 1.1 | Migrate `main/agent-card.json` from OpenClaw schema → v2.0.0 | 1 |
| 1.2 | Migrate `makcikgpt/agent-card.json` from NO_SCHEMA → v2.0.0 | 1 |
| 1.3 | Delete `AAA/agent-card.json` (root duplicate) | 1 |
| 1.4 | Delete `AAA/dist/` agent cards (2 files) | 2 |
| 1.5 | Delete `AAA/public/` agent cards (2 files) | 2 |
| 1.6 | Delete `AAA/src/seed/agent-card.json` | 1 |
| 1.7 | Replace `AAA/.well-known/agent-card.json` with v2.0.0 AAA gateway card | 1 |
| 1.8 | Symlink `AAA/.well-known/agent-card.json` → `AAA/agents/888-APEX/agent-card.json` | 1 |

### Phase 2: Cross-Organ Cleanup
**Blast radius: LOW-MEDIUM** — affects organ discovery endpoints.

| Step | Action | Files affected |
|------|--------|---------------|
| 2.1 | Delete `arifOS/static/agent-card.json` (duplicate) | 1 |
| 2.2 | Delete `GEOX/static/agent-card.json` (duplicate) | 1 |
| 2.3 | Delete `WEALTH/static/agent-card.json` (duplicate) | 1 |
| 2.4 | Delete `WELL/static/agent-card.json` (duplicate) | 1 |
| 2.5 | Update all organ `.well-known/` cards to v2.0.0 schema | 5 |
| 2.6 | Delete `wealth-git/.well-known/agent-card.json` (stale) | 1 |

### Phase 3: Legacy & Site Cleanup
**Blast radius: LOW** — non-runtime artifacts.

| Step | Action | Files affected |
|------|--------|---------------|
| 3.1 | Archive OpenClaw workspace agent cards → `AAA/agents/_archive/` | 17 |
| 3.2 | Migrate `HERMES/agent-card.json` to v2.0.0 | 1 |
| 3.3 | Delete arif-sites site-specific agent cards (generated from organ cards) | 7 |
| 3.4 | Delete `GEOX/skills/*/agent-card.json` (11 skill cards — review if still needed) | 11 |

---
## 5. FILES FLAGGED FOR DELETION — PHASE 1

These are the exact paths that will be removed in Phase 1. **No deletions executed yet.**

```
# AAA root duplicate (content drift from .well-known/)
/root/AAA/agent-card.json

# AAA build artifacts (regenerated from source)
/root/AAA/dist/.well-known/agent-card.json
/root/AAA/dist/a2a/agent-card.json
/root/AAA/public/.well-known/agent-card.json
/root/AAA/public/a2a/agent-card.json
/root/AAA/src/seed/agent-card.json

# AAA .well-known/ (will be replaced with v2.0.0 symlink, not deleted)
# /root/AAA/.well-known/agent-card.json — REPLACE, not delete
```

**Files to MODIFY (not delete):**
- `/root/AAA/agents/main/agent-card.json` — migrate schema from OpenClaw → v2.0.0
- `/root/AAA/agents/makcikgpt/agent-card.json` — migrate from NO_SCHEMA → v2.0.0
- `/root/AAA/.well-known/agent-card.json` — replace with canonical AAA gateway v2.0.0 card

---
## 6. GOVERNANCE CHECK

| Floor | Status | Notes |
|-------|--------|-------|
| F1 AMANAH | ✅ | All deletions are file-level, git-revertable. Backup before each step. |
| F2 TRUTH | ✅ | All counts verified via `find` + `python3` JSON parsing. Evidence attached. |
| F4 CLARITY | ✅ | ΔS = 71% reduction. Target state fully specified. |
| F8 LAW | ✅ | No boundary violation. All files within `/root/`. |
| F11 AUDIT | ✅ | This document serves as the audit trail. |
| F13 SOVEREIGN | ⏳ HOLD | Awaiting 888 clearance before any destructive action. |

---
## 7. HOLD

**No files have been touched.** This is a read-only audit. Awaiting 888 (Arif) clearance to execute Phase 1 steps 1.1–1.8.

**Question for 888:** The GEOX skill cards (11 files in `GEOX/skills/*/agent-card.json`) use a different schema (`geox-a2a-agent-card.schema.json`). These appear to be skill-level agent cards for GEOX sub-agents. Should these be:
- (A) Migrated to `arifOS/agent-card/v2.0.0` as part of Phase 3?
- (B) Left as-is (they serve a different purpose — skill-level, not agent-level)?
- (C) Deleted (GEOX skills are not independent agents)?

---

*DITEMPA BUKAN DIBERI. FORGE computes, arifOS judges, Arif decides.*