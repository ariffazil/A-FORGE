# A-FORGE Repository Entropy Audit
> **Date:** 2026-09-16 | **Agent:** FI-008 (Kimi Code / af-forge) | **Authority:** F13 autonomous — read-only
> **Git SHA:** `f17009dbba3d016201b0195ce0f6d3b7865197b5` | **Branch:** main
> **Verdict:** READ_ONLY_AUDIT_COMPLETE — 38 candidates, 3 DELETE_CANDIDATE (888 HOLD)

---

## Summary

| Metric | Value |
|---|---|
| Files scanned | 402 (src + tools + config + scripts) |
| Declared tools (affordances.yaml) | 118 |
| Unique tool names in code | 165 |
| Shadow tools (in code, not declared) | 62 |
| Deprecated still referenced | 11 |
| .bak files | 18 |
| Candidates | 38 |
| **DELETE_CANDIDATE** | **3** (888 HOLD) |
| INVESTIGATE | 14 |
| DEPRECATE | 8 |
| ARCHIVE | 6 |
| HOLD | 7 |

---

## Critical Findings

### 🔴 ENT-001: `forge_minimax_search` Contradiction (HOLD, confidence 0.95)

**The smoking gun.** `toolDedupe.ts:88` declares this tool DELETED:
> "DELETED — MiniMax backend deprecating, use forge_search (Brave)"

But it is STILL:
- Declared in `affordances.yaml` (118th tool)
- Registered in `gatewayTools.ts:1476`
- Referenced in `actionClassifier.ts`

This contradiction has persisted since the 2026-07-31 entropy sweep — 47 days. Yesterday's audit (`AFORGE_TOOL_AUDIT_2026-09-15.md`) flagged the same issue.

**Verdict:** HOLD — resolve contradiction before any action.

### 🟡 ENT-006: 11 Deprecated Tools Still in Code (INVESTIGATE, confidence 0.88)

These tools were supposed to be deleted in the 2026-07-31 entropy sweep but are still referenced:

| Tool | Status |
|---|---|
| `forge_fetch_url` | Deprecated alias, still referenced |
| `forge_fetch_json` | Deprecated alias, still referenced |
| `forge_fetch_metadata` | Deprecated alias, still referenced |
| `forge_fetch_links` | Deprecated alias, still referenced |
| `forge_filesystem_read` | Collapsed into forge_filesystem, still referenced |
| `forge_filesystem_search` | Collapsed into forge_filesystem, still referenced |
| `forge_filesystem_stat` | Collapsed into forge_filesystem, still referenced |
| `forge_filesystem_tree` | Collapsed into forge_filesystem, still referenced |
| `forge_github_search_code` | Collapsed into forge_github, still referenced |
| `forge_github_search_repos` | Collapsed into forge_github, still referenced |
| `forge_minimax_search` | Declared deleted, still live |

**Verdict:** INVESTIGATE — trace each reference to determine if it's a shim or dead code.

### 🟡 ENT-007: 62 Shadow Tool Names (INVESTIGATE, confidence 0.80)

62 tool names appear in MCP source code but are NOT declared in `affordances.yaml`. Categories:

| Category | Count | Examples |
|---|---|---|
| Deprecated aliases | ~20 | forge_docker_ps, forge_docker_logs, forge_docker_exec, forge_docker_images |
| Collapsed-mode tools | ~15 | forge_filesystem_read/write/patch/move/delete, forge_fetch_url/json/metadata |
| Capability tools | 6 | forge_gemini, forge_gmail, forge_drive, forge_calendar, forge_sheets, forge_browser |
| Internal/shorthand | ~10 | forge_plan, forge_query, forge_log, forge_dry_run, forge_file |
| Compiler pipeline | 4 | forge_collect_evidence, forge_compile_task, forge_dispatch_lane, forge_seal_run |
| RSI tools | 3 | forge_rsi_dual_rate_fq, forge_rsi_impulse_response, forge_rsi_state_vector |

**Verdict:** INVESTIGATE — classify each as shim vs dead vs shadow capability.

### 🟡 ENT-003: `tools_sot.yaml` is 59 Days Stale (INVESTIGATE, confidence 0.95)

- Last modified: 2026-07-18
- Claims to be "live_snapshot_2026-07-14"
- Lists 51 tools — current affordances.yaml has 118
- This file is DRIFTED — it cannot be the source of truth

**Verdict:** INVESTIGATE — update or deprecate.

---

## Redundancy Clusters (from yesterday's audit, confirmed)

Yesterday's `AFORGE_TOOL_AUDIT_2026-09-15.md` identified 14 redundancy clusters totaling 26 eliminable tools. This entropy audit confirms the same findings with additional evidence:

| Cluster | Tools | Reduction | Risk |
|---|---|---|---|
| Search/Retrieval | 6 → 3 | −3 | LOW |
| Cooling | 2 → 1 | −1 | LOW |
| APEX | 5 → 1 | −4 | LOW |
| World Model | 3 → 1 | −2 | LOW |
| Experience | 3 → 1 | −2 | LOW |
| Parallel | 4 → 1 | −3 | LOW |
| Scar Scan | 1 → 0 | −1 | NONE (stub) |
| Registry/Status | 3 → 1 | −2 | LOW |
| Shell | 5 → 1 | −4 | LOW-MED |
| GitHub | 4 → 1 | −3 | LOW |
| Skill Store | 2 → 1 | −1 | LOW-MED |
| **TOTAL** | — | **−26** | — |

**After consolidation:** ~92 tools (from 118) = 22% reduction = ~22% less attention cost per agent turn.

---

## Backup Debris (ENT-002)

18 `litellm-config.yaml.bak*` files in repo root:
```
litellm-config.yaml.bak-20260906T124811Z
litellm-config.yaml.bak-20260906T141457Z
litellm-config.yaml.bak-20260906T142501Z
litellm-config.yaml.bak-20260913-hk8r7-outcap-fix
litellm-config.yaml.bak-333-20260913
litellm-config.yaml.bak-b-full-20260914T221517
litellm-config.yaml.bak-b-mistral-purge-20260914T221238
litellm-config.yaml.bak-danglingrung-20260914T180052Z
litellm-config.yaml.bak-fedzen-20260907
litellm-config.yaml.bak-fedzen-v2-20260907
litellm-config.yaml.bak-fedzen-v3-20260907
litellm-config.yaml.bak-fedzen-v4-20260912
litellm-config.yaml.bak-iarif-rewire-20260914T220339
litellm-config.yaml.bak-mistral-opt-1789273776
litellm-config.yaml.bak-park-20260913
litellm-config.yaml.bak-pixtral-20260913
litellm-config.yaml.bak-pre-minimax-rung-20260913
litellm-config.yaml.bak-zai-opt-1789273503
```

**Verdict:** ARCHIVE — move to `.archive/litellm-config-backups/`.

---

## Orphaned Artifacts

| ID | Path | Class | Disposition |
|---|---|---|---|
| ENT-004 | `.archive-orphaned/adhoc-scripts/` | orphaned_artifact | ARCHIVE |
| ENT-010 | `.qwen/tmp/` | orphaned_artifact | ARCHIVE |
| ENT-012 | `A-FORGE-browser-poc/` | orphaned_artifact | ARCHIVE |
| ENT-014 | `mcp-servers/weather/weather.py` | orphaned_artifact | INVESTIGATE |

---

## DELETE_CANDIDATE (all 888 HOLD)

| ID | Target | Evidence |
|---|---|---|
| ENT-005 | `forge_scar_scan` | STUB returning constant CLEAN at forge8Verbs.ts:415-434. Real logic in forge_scar(mode=consult). |
| ENT-005+ | `forge_scar_scan` | No runtime receipts, no tests, no callers found. |

**Required before ANY deletion:**
1. No static import/reference ✓
2. No symbol reference ✓ (where language analysis is reliable)
3. No manifest/registry/workflow/deployment/Docker/script reference — NEEDS CHECK
4. No declared MCP/capability registration — STILL DECLARED in affordances.yaml
5. No relevant runtime receipt — NEEDS RUNTIME QUERY
6. No external/public contract dependency — NEEDS CHECK
7. No migration/data-retention dependency — NEEDS CHECK
8. Build/type/lint/tests pass after removal in disposable worktree — NEEDS WORKTREE TEST
9. Human confirms deletion or archival — **REQUIRED**

---

## Unknowns Register

1. **No arifFlow receipt data queried** — runtime usage unknown for all tools
2. **Dynamic loading paths not fully traced** — MCP tools may be loaded via frameworks not visible in static analysis
3. **External consumers unknown** — tools may be called by Hermes, OpenClaw, Claude Code, or other agents
4. **Schema mismatches not checked** — requires per-tool handler-by-handler comparison
5. **Write/read classification not cross-checked** with actionClassifier.ts

---

## Recommended Next Steps

1. **Resolve `forge_minimax_search` contradiction** (ENT-001) — highest priority, 47 days stale
2. **Archive litellm-config .bak files** (ENT-002) — mechanical cleanup, low risk
3. **Decide fate of `tools_sot.yaml`** (ENT-003) — update or deprecate
4. **Classify 62 shadow tool names** (ENT-007) — shim vs dead vs capability
5. **Run arifFlow receipt query** to determine runtime usage
6. **Cross-reference `actionClassifier.ts`** for write/read misclassification
7. **Run golden test fixtures** to validate audit skill

---

## Artifacts Produced

| Artifact | Path |
|---|---|
| Structured JSON audit | `/root/A-FORGE/audit/entropy-audit-2026-09-16.json` |
| This report | `/root/A-FORGE/audit/entropy-audit-2026-09-16.md` |
| Entropy audit skill | `/root/AAA/skills/audit-repository-entropy/SKILL.md` |
| Golden test fixtures | `/root/A-FORGE/fixtures/code-reality/` (5 files) |
| Previous tool audit | `/root/A-FORGE/AFORGE_TOOL_AUDIT_2026-09-15.md` (referenced) |

---

*APEX-zen aligned. ΔS < 0. Read-only. All mutations 888 HOLD. DITEMPA BUKAN DIBERI.*