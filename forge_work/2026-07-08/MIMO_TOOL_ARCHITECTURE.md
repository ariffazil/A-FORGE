# MiMo V2.5 Pro — Tool Architecture Map

> **Model:** 1.02T MoE (42B active), 1M context, hybrid attention (SWA+GA 6:1)
> **Trained for:** Agentic tool use, 672+ tool calls/session, harness awareness
> **Key constraint:** NO built-in tools. All tools come from the harness (OpenCode).
> **Token cost:** ~300 tokens per tool definition. 323 tools = ~97K tokens = 10% of context.

---

## The Problem

OpenCode currently sends ALL 323 tool definitions to MiMo on every request. This:
- Burns ~97K tokens (10% of 1M context) just on tool schema
- Includes tools irrelevant to the current task (GEOX tools when editing code)
- Includes tools MiMo can't use (M365 Copilot tools)
- Azure breaks at 128 tools (but MiMo doesn't — it handles all 323)

## The Solution: Tiered Tool Loading

```
┌─────────────────────────────────────────────────────────┐
│  TIER 0: ALWAYS LOADED (Core) — ~50 tools               │
│  Every session. Every task. Non-negotiable.              │
│  Filesystem, Shell, Git, Session, Health, Memory         │
├─────────────────────────────────────────────────────────┤
│  TIER 1: DOMAIN LOADED (Conditional) — ~80 tools         │
│  Loaded when task matches domain.                        │
│  GEOX (geoscience), WEALTH (capital), WELL (vitality)    │
├─────────────────────────────────────────────────────────┤
│  TIER 2: ON DEMAND (External) — ~40 tools                │
│  Loaded only when explicitly needed.                     │
│  Browser, VPS, Supabase, Qdrant, Chrome DevTools         │
├─────────────────────────────────────────────────────────┤
│  TIER 3: NEVER LOADED — excluded tools                   │
│  M365 Copilot tools (different runtime)                  │
│  Duplicate/alias tools                                   │
│  Deprecated tools                                        │
└─────────────────────────────────────────────────────────┘
```

---

## TIER 0: ALWAYS LOADED (~50 tools)

These are the tools MiMo needs for ANY task. They form the "harness skeleton."

### Forge Core (filesystem + process)
| Tool | Why always |
|------|-----------|
| `forge_filesystem_read` | Every task starts with reading |
| `forge_filesystem_write` | Every task ends with writing |
| `forge_filesystem_patch` | Surgical edits |
| `forge_filesystem_glob` | Find files |
| `forge_filesystem_search` | Find content |
| `forge_filesystem_stat` | Check existence |
| `forge_filesystem_tree` | Understand structure |
| `forge_shell` | Execute anything |
| `forge_shell_dryrun` | Preview before execute |
| `forge_shell_status` | Check shell health |
| `forge_git_status` | Know repo state |
| `forge_git_diff` | See changes |
| `forge_git_log` | History |
| `forge_git_commit` | Save work |

### Session & Governance
| Tool | Why always |
|------|-----------|
| `forge_session_init` | Every session starts here |
| `forge_health_check` | Know if system is alive |
| `forge_status` | Know what's running |
| `forge_probe` | Check organ liveness |
| `forge_check_governance` | Pre-flight floor check |
| `forge_judge_proxy` | Constitutional verdict |
| `forge_lock` | F1 AMANAH gate |
| `forge_lease` | Authority management |

### arifOS Kernel (governance)
| Tool | Why always |
|------|-----------|
| `arif_init` | Bind session |
| `arif_observe` | Reality grounding |
| `arif_think` | Reasoning engine |
| `arif_route` | Intent routing |
| `arif_critique` | Ethics check |
| `arif_judge` | Constitutional verdict |
| `arif_compose` | Response formatting |
| `arif_triage` | Session status |

### Memory & Evidence
| Tool | Why always |
|------|-----------|
| `forge_memory` | Recall past |
| `forge_vault` | VAULT999 access |
| `forge_scar` | Check past failures |
| `forge_scar_scan` | Scan for matching scars |

### Web & Search (lightweight)
| Tool | Why always |
|------|-----------|
| `forge_search` | Quick web search |
| `forge_fetch` | Fetch URL |
| `forge_fetch_url` | Read URL content |
| `forge_fetch_json` | Parse JSON from URL |

**Tier 0 total: ~42 tools, ~12.6K tokens**

---

## TIER 1: DOMAIN LOADED (~80 tools)

Load these when the task matches the domain. Detected by:
- Explicit intent keywords ("seismic", "NPV", "fatigue")
- `arif_route` routing decision
- File patterns (*.sgy for GEOX, *.xlsx for WEALTH)

### GEOX Domain (~20 tools)
| Tools | Trigger keywords |
|-------|-----------------|
| `geox_observe` | seismic, well log, earthquake, bathymetry |
| `geox_compute` | petrophysics, Vsh, porosity, Sw, permeability |
| `geox_interpret` | seismic interpretation, sequence stratigraphy |
| `geox_model` | basin, accommodation, 3D model |
| `geox_prospect` | volumetrics, POS, EVOI |
| `geox_claim` | geological claim, evidence |
| `geox_spatial` | spatial intersection, block spec, map |
| `geox_govern` | claim lifecycle, doctrine |
| `geox_evidence` | synthesize, contradict |
| `geox_surface_status` | GEOX registry |

### WEALTH Domain (~15 tools)
| Tools | Trigger keywords |
|-------|-----------------|
| `wealth_compute_npv` | NPV, net present value |
| `wealth_compute_irr` | IRR, internal rate of return |
| `wealth_compute_emv` | EMV, expected monetary value |
| `wealth_monte_carlo_simulate` | Monte Carlo, simulation |
| `wealth_markowitz_frontier` | portfolio, optimization |
| `wealth_kelly_sizing` | bet sizing, Kelly criterion |
| `wealth_conservatism_check` | assets, liabilities |
| `wealth_flow_check` | cashflow, income, expenses |
| `wealth_runway_check` | runway, burn rate |
| `wealth_omni_wisdom` | synthesis, deal framing |
| `wealth_capital_diagnose` | stress, governance, collapse |
| `wealth_capital_market` | FX, commodity, stock |
| `wealth_vault_query` | portfolio memory |
| `wealth_vault_write` | record transaction |
| `wealth_registry_status` | WEALTH registry |

### WELL Domain (~12 tools)
| Tools | Trigger keywords |
|-------|-----------------|
| `well_readiness` | readiness, vitality |
| `well_validate_vitality` | vitality, NIAT |
| `well_assess_homeostasis` | sleep, fatigue, stress |
| `well_guard_dignity` | dignity, consent |
| `well_classify_substrate` | substrate classification |
| `well_detect_boundary` | boundary detection |
| `well_measure_gradient` | evidence gradient |
| `well_trace_lineage` | memory, trend |
| `well_signal_coverage` | signal audit |
| `well_health_check` | WELL health |
| `well_registry_status` | WELL registry |
| `well_assess_sovereign_entropy` | behavioral modeling |

### A-FORGE Execution (~15 tools)
| Tools | Trigger keywords |
|-------|-----------------|
| `forge_execute` | execute, run, deploy |
| `forge_execute_sealed` | sealed execution |
| `forge_pipeline_run` | pipeline, autonomous |
| `forge_sandbox_run` | sandbox, test |
| `forge_synthesize` | create, generate |
| `forge_docker` | container, docker |
| `forge_job` | background job |
| `forge_stage` | staging |
| `forge_receipt_draft` | receipt, compliance |
| `forge_register` | register tool |
| `forge_evaluate` | APEX evaluation |
| `forge_witness` | tri-witness |
| `forge_heart_critique` | risk assessment |
| `forge_seal` | VAULT999 seal |
| `forge_tier_bind` | trust tier |

**Tier 1 total: ~62 tools, ~18.6K tokens** (loaded per domain, not all at once)

---

## TIER 2: ON DEMAND (~40 tools)

Load ONLY when explicitly requested or when Tier 0/1 tools fail.

### GitHub Operations (~15 tools)
| Tools | When to load |
|-------|-------------|
| `forge_github` | PR, issue, search operations |
| `forge_github_create_issue` | Create issue |
| `forge_github_create_pull_request` | Create PR |
| `forge_github_search_code` | Code search |
| `forge_github_search_repos` | Repo search |
| `forge_github_get_file` | Read file from GitHub |
| `github_*` (native) | All GitHub native tools |

### Browser Automation (~8 tools)
| Tools | When to load |
|-------|-------------|
| `forge_browser_navigate` | Web automation |
| `forge_browser_screenshot` | Visual capture |
| `forge_browser_click` | UI interaction |
| `forge_browser_type` | Form filling |
| `forge_browser_extract_text` | Content extraction |
| `forge_browser_evaluate_js` | JS execution |
| `chrome-devtools_*` | Advanced browser control |

### Infrastructure (~10 tools)
| Tools | When to load |
|-------|-------------|
| `hostinger-vps_*` | VPS management |
| `forge_vps_ports` | Port scanning |
| `forge_vps_services` | Service listing |
| `forge_vps_cron` | Cron management |
| `forge_journalctl` | Log analysis |
| `forge_netdata_*` | Monitoring |

### Data & Search (~7 tools)
| Tools | When to load |
|-------|-------------|
| `supabase_*` | Database operations |
| `qdrant_*` | Vector search |
| `context7_*` | Library docs |
| `perplexity_*` | Deep research |
| `meyhem_*` | MCP discovery |

**Tier 2 total: ~40 tools, ~12K tokens** (loaded only when needed)

---

## TIER 3: NEVER LOADED

| Tools | Why excluded |
|-------|-------------|
| M365 Copilot tools | Different runtime, different auth |
| Duplicate aliases | `wealth_emv_compute` = `wealth_compute_emv` |
| Deprecated tools | `forge_systemctl` → use `forge_shell` |
| `forge_approve` | Self-authorization blocked by design |
| `forge_abort` | Emergency only, load on demand |

---

## Token Budget

| Tier | Tools | Tokens | When loaded |
|------|-------|--------|-------------|
| **Tier 0** | ~42 | ~12.6K | Always |
| **Tier 1** | ~20/domain | ~6K/domain | Per task domain |
| **Tier 2** | ~40 | ~12K | On explicit need |
| **Total active** | ~62-82 | ~18-25K | Typical session |

**Savings:** 97K → 25K tokens = **72% reduction** in tool schema overhead.

---

## Implementation: How OpenCode Should Load Tools

```
Session start:
  → Load Tier 0 (always) — 42 tools
  → Run arif_route(intent) → determines domain
  → Load Tier 1 for detected domain — +20 tools
  → Total: ~62 tools in context

Task requires GitHub:
  → Load Tier 2 GitHub subset — +15 tools
  → Total: ~77 tools

Task requires browser:
  → Load Tier 2 browser subset — +8 tools
  → Total: ~85 tools
```

**MiMo handles 62-85 tools easily.** The model card shows it sustained 1,868 tool calls in one session. The bottleneck was never capability — it was token waste.

---

## The MiMo Advantage

From the model card:
- **Harness awareness:** "makes full use of the affordances of its harness environment, manages its memory, and shapes how its own context is populated"
- **Token efficient:** 64% Pass^3 using ~70K tokens (40-60% fewer than competitors)
- **Long-horizon:** 672+ tool calls in a single session
- **Self-correcting:** Diagnosed and recovered from regression at turn 512

This means MiMo doesn't need ALL tools loaded — it's smart enough to work with a focused toolset and ask for more when needed. The harness (OpenCode) should be the one managing tool availability, not dumping everything into context.

---

*Forged: 2026-07-08 by FORGE (000Ω)*
*DITEMPA BUKAN DIBERI*
