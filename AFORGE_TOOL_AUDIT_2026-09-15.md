# A-FORGE Tool Surface APEX-Zen Audit
> **Date:** 2026-09-15 | **Agent:** FI-008 (Kimi Code) | **Authority:** F13 autonomous
> **Verdict:** CONSOLIDATION RECOMMENDED — 26 tools eliminable across 14 clusters

---

## 1. CURRENT STATE

| Metric | Value |
|---|---|
| **Affordance tools (affordances.yaml)** | 118 |
| **Registry tools (live MCP)** | 126 |
| **Drift (registry vs affordance)** | 8 missing from affordances |
| **Fingerprint check** | ✅ 122 unique, 0 duplicates |
| **OBSERVE tools** | 95 (80.5%) |
| **MUTATE tools** | 23 (19.5%) |
| **R0 (lowest risk)** | 92 (78%) |
| **R3+ risk** | 24 (20%) |

### 8 Drift Items (in registry, missing from affordances.yaml)
1. `forge_collect_evidence`
2. `forge_compile_task`
3. `forge_dispatch_lane`
4. `forge_rsi_dual_rate_fq`
5. `forge_rsi_impulse_response`
6. `forge_rsi_state_vector`
7. `forge_seal_run`
8. `forge_web_extract`

---

## 2. REDUNDANCY CLUSTERS (14 clusters, 46 tools → ~19)

### WAVE 1 — LOW RISK, MECHANICAL MERGE (−17 tools)

#### 2.1 Search/Retrieval (6 → 2)
| Tool | Purpose | Verdict |
|---|---|---|
| `forge_search` | Brave web search | **KEEP** (already has source dispatch) |
| `forge_fetch` | URL fetch + SearxNG | **KEEP** (different paradigm: URL-first) |
| `forge_research` | Governed research | **DELETE** — `forge_search(source=research)` already dispatches to same handler |
| `forge_minimax_search` | MiniMax web search | **DELETE** — declared dead in `toolDedupe.ts:88`, `serve.ts:97`, but still registered (contradiction) |
| `forge_docs_lookup` | Context7 docs | **DELETE** — `forge_search(source=docs)` dispatches to same `context7Lookup` |
| `forge_docsgpt` | DocsGPT knowledge | **KEEP** (has F2/F7 epistemic membrane, distinct backend) |

**Savings: −3 tools** | Risk: LOW | Agent confusion: HIGH elimination (6 search entry points → 3)

#### 2.2 Cooling (2 → 1)
| Tool | Purpose | Verdict |
|---|---|---|
| `forge_cool_drift` | Single drift cooling receipt | **MERGE** into `forge_cool(verb: drift\|pattern)` |
| `forge_cool_pattern` | Recurrence cooling receipt | **DELETE** — adds 3 optional fields to same `craftCoolingReceipt` pipeline |

**Savings: −1** | Risk: LOW (INV-C1..C4 preserved verbatim)

#### 2.3 APEX (5 → 1)
| Tool | Purpose | Verdict |
|---|---|---|
| `forge_apex_encode` | Goal→task decomposition | **MERGE** into `forge_apex(action: encode\|metabolize\|emd\|recompute\|status)` |
| `forge_apex_metabolize` | Metabolic cycle | **DELETE** |
| `forge_apex_emd` | EMD validation | **DELETE** |
| `forge_apex_recompute` | Recompute on field change | **DELETE** |
| `forge_apex_goal_status` | Inspect goal state | **DELETE** |

**Savings: −4** | Risk: LOW (all 5 OBSERVE, all whitelisted, shared `goalStore`/`getGoal()`)

#### 2.4 World Model (3 → 1)
| Tool | Purpose | Verdict |
|---|---|---|
| `forge_wm_stats` | Statistics dashboard | **MERGE** into `forge_wm(view: stats\|gaps\|quality)` |
| `forge_wm_gaps` | Gap alerts | **DELETE** |
| `forge_wm_quality` | Quality report | **DELETE** |

**Savings: −2** | Risk: LOW (all read same `loadTrajectories()`/`loadAlerts()`)

#### 2.5 Experience (2+1 → 1)
| Tool | Purpose | Verdict |
|---|---|---|
| `forge_experience_trace` | Record experience trace | **MERGE** into `forge_experience(verb: record\|query\|skill_select)` |
| `forge_experience_query` | Query traces | **DELETE** |
| `forge_skill_select_query` | Query skill selection events | **DELETE** (same JSONL-read pattern) |

**Savings: −2** | Risk: LOW (all whitelisted OBSERVE, shared `loadTraces`/`recordExperienceTrace`)

#### 2.6 Parallel (4 → 1)
| Tool | Purpose | Verdict |
|---|---|---|
| `forge_parallel` | Spawn parallel tasks | **MERGE** into `forge_parallel(action: run\|status\|cancel\|list)` |
| `forge_parallel_status` | Query group status | **DELETE** |
| `forge_parallel_list` | List all groups | **DELETE** |
| `forge_parallel_cancel` | Cancel group | **DELETE** |

**Savings: −3** | Risk: LOW (status/list/cancel are ≤30-line wrappers over same `taskGroups` map)

#### 2.7 Scar Scan (1 → 0)
| Tool | Purpose | Verdict |
|---|---|---|
| `forge_scar_scan` | Check artifact vs SCAR DB | **DELETE** — **STUB** returning constant `CLEAN` at `forge8Verbs.ts:415-434`; real logic in `forge_scar(mode=consult)` |

**Savings: −1** | Risk: NONE (dead code)

---

### WAVE 2 — MODE-GATED MUTATE (−7 tools)

#### 2.8 Registry/Status (3 → 1)
| Tool | Purpose | Verdict |
|---|---|---|
| `forge_registry` | Dynamic skill registry (6 modes) | **MERGE** into unified `forge_registry` (add mode=runtime, mode=fingerprint_live) |
| `forge_registry_status` | Full registry truth diagnostic | **DELETE** — duplicates `forge_registry(mode=status)` + `checkToolFingerprints` |
| `forge_status` | Active execution state | **DELETE** → `forge_registry(mode=runtime)` |

**Savings: −2** | Risk: LOW (all pure read, both call `checkToolFingerprints`)

#### 2.9 Shell (5 → 1)
| Tool | Purpose | Verdict |
|---|---|---|
| `forge_shell` | Execute commands | **MERGE** into `forge_shell(mode: exec\|dryrun\|status\|ledger\|alerts)` |
| `forge_shell_dryrun` | Preview without executing | **DELETE** — comment: "backward compatibility" |
| `forge_shell_status` | Subsystem health | **DELETE** |
| `forge_shell_ledger` | Hash-chain entries | **DELETE** |
| `forge_shell_alert_history` | Alert history | **DELETE** |

**Savings: −4** | Risk: LOW-MED (exec=R5 MUTATE, rest=R0 OBSERVE; handler-gating precedent: `forge_git`/`forge_docker`)

#### 2.10 GitHub (4 → 1)
| Tool | Purpose | Verdict |
|---|---|---|
| `forge_github` | Search + PRs | **MERGE** into `forge_github(mode: search\|pr\|get_file\|put_file\|create_issue)` |
| `forge_github_get_file` | Read file | **DELETE** |
| `forge_github_create_or_update_file` | Create/update file | **DELETE** |
| `forge_github_create_issue` | Create issue | **DELETE** |

**Savings: −3** | Risk: LOW (dedupe two parallel HTTP helper stacks: `ghFetch` vs `ghGet`/`ghPost`)

#### 2.11 Skill Store (2 → 1)
| Tool | Purpose | Verdict |
|---|---|---|
| `forge_skillstore_read` | Query artifact store | **MERGE** into `forge_skillstore(verb: read\|write)` |
| `forge_skillstore_write` | Store artifact | **DELETE** |

**Savings: −1** | Risk: LOW-MED (OBSERVE/MUTATE split, `forge_git` precedent)

---

### WAVE 3 — DEFER / JUDGE (−2 tools, optional)

#### 2.12 Visual (2 → 1, optional)
| Tool | Purpose | Verdict |
|---|---|---|
| `forge_visual_qa` | W3 tri-witness QA | **OPTIONAL MERGE** into `forge_visual(action: qa\|seal)` |
| `forge_visual_seal` | VAULT999 composite seal | Different constitutional stage; low call frequency |

**Savings: −1** | Risk: MEDIUM-HIGH (seal path is irreversibility-adjacent)

#### 2.13 Surface Audit (2 → 1, optional)
| Tool | Purpose | Verdict |
|---|---|---|
| `forge_surface_audit` | Full audit/scan/fix | **OPTIONAL MERGE** into `forge_surface(action: audit\|scan\|fix\|check\|status\|pin\|config)` |
| `forge_surface_guard` | Check/status/pin/config | Different backend but same domain |

**Savings: −1** | Risk: MEDIUM (these tools police the surface itself)

#### 2.14 Execute Sealed (defer)
| Tool | Purpose | Verdict |
|---|---|---|
| `forge_execute` | Standard execution | **KEEP SEPARATE** — merging highest-blast-radius tools under one schema |
| `forge_execute_sealed` | VAULT999-gated execution | Different auth lanes; F11 auditability argues for distinct names |

**Savings: 0** | Recommendation: DEFER

---

## 3. SUMMARY

| Wave | Tools Eliminated | Risk | Savings |
|---|---|---|---|
| Wave 1 (mechanical) | 17 | LOW | ~1,200 words of schema tokens/session |
| Wave 2 (mode-gated) | 7 | LOW-MED | ~600 words of schema tokens/session |
| Wave 3 (defer/optional) | 2 | MED-HIGH | ~150 words |
| **TOTAL** | **26** | — | **~1,950 words/session + 26 tool selection decisions** |

### Final Surface
- **Current:** 118 tools (affordance) / 126 (registry)
- **After consolidation:** ~92 tools (affordance) / ~100 (registry)
- **Reduction:** ~22% fewer tools = ~22% less attention cost per agent turn

---

## 4. IMPLEMENTATION RISKS

1. **Name-keyed governance plumbing:** `actionClassifier.ts`, `serve.ts` STATELESS_TOOLS, `godelLock.ts`, `aThinkGuard.ts`, `worldModel.ts`, `profiles.ts`, `goalEncoder.ts`, `policyTools.ts` all reference exact tool names. Every merge needs migration across ~9 files.

2. **affordances.yaml sync:** Must update in same commit or `forge_surface_audit` will report PHANTOM/MISSING drift.

3. **MUTATE/OBSERVE across modes:** Merged tools spanning mutation classes need handler-gating (precedent: `forge_git`/`forge_docker`).

4. **`forge_minimax_search` contradiction:** Registered but declared deleted. Resolve first as validation.

5. **Client compatibility:** Downstream callers may invoke retired names. `toolDedupe.KNOWN_DEPRECATED` provides observability.

---

## 5. RECOMMENDED PHASING

1. **Phase 1** (this session): Fix `forge_minimax_search` contradiction + sync affordances.yaml for 8 drift items
2. **Phase 2** (next session): Wave 1 merges (cooling, WM, APEX, experience, parallel, scar_scan)
3. **Phase 3** (after testing): Wave 2 merges (shell, github, registry, skillstore)
4. **Phase 4** (governance review): Wave 3 decisions (visual, surface, execute_sealed)

---

*APEX-zen aligned. ΔS < 0. DITEMPA BUKAN DIBERI.*
