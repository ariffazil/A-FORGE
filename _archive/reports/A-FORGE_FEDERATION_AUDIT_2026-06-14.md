# arifOS Federation Audit — Complete Tool & Transport Surface
**2026-06-14 20:37 KL | Session: 2026-06-14T12:31:33Z**
**Auditor: AGI OPENCLAW (ChatGPT via arifOS MCP)**

---

## EXECUTIVE VERDICT

| Surface | Status | Tools | MCP-Bridged | Notes |
|---------|--------|-------|-------------|-------|
| **arifOS** | 🟢 ALIVE | 18 (13 canonical + 5 diagnostic) | ✅ YES (:8088) | Constitutional kernel. Forge dry-run only. |
| **A-FORGE** | 🟡 ALIVE, NOT BRIDGED | ~50 tools | ❌ NO | MCP server on :7071. **Single-session limit.** |
| **GEOX** | 🟢 ALIVE, NOT BRIDGED | 37 tools | ❌ NO | MCP server on :8081. Earth intelligence. |
| **WEALTH** | 🟢 ALIVE | 20 tools + 18 resources + 10 prompts | ✅ YES (:18082) | Capital intelligence. |
| **WELL** | 🟢 ALIVE | 18 somatic + 77 autonomic | ✅ YES (:18083) | Human substrate mirror. |
| **AAA** | 🟢 ALIVE | A2A gateway (not MCP) | ❌ NO (wrong protocol) | Port :3001. Agent-to-Agent protocol, not MCP. |
| **cn-organ** | 🟢 ALIVE | A2A bridge | ❌ NO | Port :18795. Continue CLI bridge. |
| **Hermes** | 🟡 ALIVE | Event bus + vault query | N/A | Port :8644. NATS-based. |
| **Supabase** | 🟡 UNVERIFIED | DB backend | N/A | Port :54321. VAULT999 backend. |
| **NATS** | 🟡 UNVERIFIED | Event bus | N/A | Spinal cord event transport. |
| **Prometheus** | 🟢 ALIVE | Metrics | N/A | Port :9090. Connected to A-FORGE. |
| **Grafana** | 🟢 ALIVE | Dashboards | N/A | Port :3000. |
| **Caddy** | 🟢 ALIVE | Reverse proxy | N/A | Ports :80, :443. TLS termination. |

---

## 1. COMPLETE TOOL INVENTORY

### 1A. arifOS MCP (port 8088 → bridged to ChatGPT ✅)

**13 Canonical Tools (000→999 metabolic path):**

| Stage | Tool | Action Class | Description |
|-------|------|-------------|-------------|
| 000 INIT | `arif_session_init` | OBSERVE | Constitutional session ignition |
| 111 SENSE | `arif_sense_observe` | OBSERVE | Web search, URL ingest, repo map |
| 222 FETCH | `arif_evidence_fetch` | OBSERVE | External evidence with citations |
| 333 MIND | `arif_mind_reason` | OBSERVE | Multi-step reasoning, planning |
| 444 ROUTE | `arif_kernel_route` | OBSERVE | Intent routing to correct organ |
| 555 MEMORY | `arif_memory_recall` | OBSERVE | Recall/store/get/list/context |
| 666 HEART | `arif_heart_critique` | OBSERVE | Ethical risk, maruah, red-team |
| 777 FORGE | `arif_forge_execute` | MUTATE | **Dry-run only** in current config |
| 888 JUDGE | `arif_judge_deliberate` | ATOMIC | Constitutional verdict (SEAL/HOLD/VOID) |
| 999 VAULT | `arif_vault_seal` | ATOMIC | Irreversible ledger seal |
| — | `arif_gateway_connect` | OBSERVE | Cross-organ bridge |
| — | `arif_reply_compose` | OBSERVE | Final response composition |
| — | `arif_ops_measure` | OBSERVE | System health, vitals, cost |

**5 Diagnostic Tools:**
`arif_ping`, `arif_schema_echo`, `arif_version_echo`, `arif_transport_echo`, `arif_initialize_probe`

---

### 1B. A-FORGE MCP (port 7071 → NOT bridged to ChatGPT ❌)

**Tier 00 — Identity (2 tools):**
- `arif_session_init` — Constitutional session ignition
- `arif_health_check` — Server health and genome status v2.0

**Tier 01 — Perception (3 tools):**
- `minimax_web_search` — Web search via MiniMax AI
- `minimax_understand_image` — Image analysis via MiniMax vision
- `arif_sense_observe` — Environmental sensing + lambda2 vector

**Tier 07 — Reflection (1 tool):**
- `arif_mind_reason` — LLM-based synthesis from grounded facts

**Tier 04 — Risk (2 tools):**
- `arif_heart_critique` — F3 (Witness) + F6 (Empathy) + F9 (Anti-Hantu) + W0 (WELL) check
- `forge_check_governance` — Same handler, alias

**Tier 05 — Execution (5 tools):**
- `arif_forge_execute` — Full agent loop with FileTools + EditorTools + WEALTH + MiniMax
- `forge_run` — Same handler, alias
- `forge_approve` — Human approval gate
- `forge_judge_proxy` — Proxy forwarder to arifOS `arif_judge_deliberate`
- `forge_pipeline` — **Autonomous 000→999 pipeline** (SENSE → REASON → WITNESS → FORGE → JUDGE → VAULT)

**Tier 06 — Stewardship (2 tools):**
- `arif_vault_seal` — Ledger closure
- `forge_remember` — Memory store

**VAULT999 REST (5 tools):**
- `forge_vault_read` — Read vault record by name
- `forge_vault_list` — List vault records by category
- `forge_vault_write` — Write vault record (Supabase-backed)
- `forge_vault_delete` — Delete vault record
- `forge_vault_seal` — Seal terminal verdict with full context

**Domain — WEALTH (3 tools):**
- `wealth_evaluate_ROI` — Investment ROI evaluation
- `wealth_compute_EMV` — Expected Monetary Value
- `wealth_thermodynamic_scan` — Landauer cost scan

**Domain — WELL (4 tools):**
- `forge_well_state_read` — Read WELL biological telemetry
- `forge_well_readiness_check` — WELL readiness verdict (OPTIMAL→LOW_CAPACITY)
- `forge_well_floor_scan` — Scan all 13 W-Floors
- `forge_well_anchor` — Anchor WELL state to vault999

**Tier 1 — Filesystem Proxy (5 tools):**
- `forge_filesystem_read` — Read files (F8: scoped to /root, /tmp, /data)
- `forge_filesystem_write` — Write files (F1: overwrite requires explicit ack)
- `forge_filesystem_glob` — Glob pattern search (F8: scoped)
- `forge_filesystem_grep` — Regex search (F8: scoped)
- `forge_filesystem_stat` — File metadata (F8: scoped)

**Tier 1 — Database Proxy (2 tools):**
- `forge_postgres_query` — Raw SQL (READ-ONLY by default; writes require flag)
- `forge_postgres_schema` — Schema inspection

**Tier 1 — Memory Proxy (2 tools):**
- `forge_memory_recall` — Federation memory search (arifOS + VAULT999 fallback)
- `forge_memory_store` — Federation memory write

**Tier 1 — Git Proxy (4 tools):**
- `forge_git_status` — Working tree status
- `forge_git_diff` — Uncommitted diff
- `forge_git_log` — Commit history
- `forge_git_commit` — Stage + commit (F1: push requires 888_HOLD)

**Tier 1 — GitHub Proxy (2 tools):**
- `forge_github_search` — Search repos/code/issues/PRs
- `forge_github_pr` — List/get/create pull requests

**Tier 1 — Docker Proxy (4 tools):**
- `forge_docker_ps` — List containers
- `forge_docker_logs` — View logs (read-only)
- `forge_docker_exec` — Execute in container (F1: read-only by default)
- `forge_docker_images` — List images

**Amanah Locks (2 tools):**
- `request_amanah_lock` — F1 Amanah lock before irreversible mutation
- `release_amanah_lock` — Release lock with ownership proof

**TOTAL A-FORGE TOOLS: ~48**

**Resources (3):**
- `forge://vault/records` — Last 50 vault records
- `forge://vault/categories` — Vault category counts
- `forge://well/state` — Current WELL state.json

**Key feature: C1 FloorEnforcer wrapper on ALL tool registrations.**
Every `server.tool()` and `server.registerTool()` call is intercepted and auto-gated through F1-F13 enforcement. No tool can be registered without passing through the floor chokepoint.

---

### 1C. GEOX MCP (port 8081 → NOT bridged to ChatGPT ❌)

**37 canonical tools — Registry Truth: PASS**

| Category | Tools |
|----------|-------|
| Basin Intelligence | `geox_basin_profile`, `geox_basin_resolve`, `geox_query_intake` |
| Data Ingestion | `geox_data_ingest_bundle`, `geox_data_qc_bundle`, `geox_dst_ingest_test`, `geox_header_inspect`, `geox_fault_stick_ingest_tool`, `geox_literature_ingest` |
| Claims Engine | `geox_claim_create`, `geox_claim_validate`, `geox_claim_challenge`, `geox_claim_seal`, `geox_evidence_attach` |
| Evidence | `geox_evidence_discover`, `geox_evidence_reason` |
| Seismic | `geox_seismic_compute`, `geox_seismic_compute_attribute_tool`, `geox_segy_export_tool`, `geox_volume_frame_tool`, `geox_blend_volume_tool` |
| Interpretation | `geox_horizon_contrast_surface`, `geox_sequence_interpret` |
| Subsurface | `geox_subsurface_generate_candidates`, `geox_subsurface_verify_integrity`, `geox_prospect_evaluate` |
| Spatial | `geox_map_context_scene`, `geox_coord_transform_tool`, `geox_blockspace_resolution_tool` |
| Vision/ML | `geox_vision_audit`, `geox_vision_calibrate`, `geox_vision_minimax_inference`, `geox_vision_perceptual_inventory` |
| System | `geox_system_registry_status`, `geox_attribute_registry_list_tool`, `geox_abstraction_guard` |
| Reports | `geox_report_to_workflow` |

**Physics guard: PASSED.** All 37 tools callable.

---

### 1D. WEALTH MCP (port 18082 → bridged to ChatGPT ✅)

**20 Public Tools — Registry Truth: PASS**

| # | Tool | Domain |
|---|------|--------|
| 1 | `wealth_conservation_capital` | Ω-01 Capital stock reality |
| 2 | `wealth_flow_liquidity` | Ω-02 Cashflow, burn, runway |
| 3 | `wealth_gradient_price` | Ω-03 Price pressure, spread |
| 4 | `wealth_entropy_risk` | Ω-04 Uncertainty, tail risk |
| 5 | `wealth_energy_productivity` | Ω-05 Output per input |
| 6 | `wealth_time_discount` | Ω-06 NPV, IRR, payback |
| 7 | `wealth_inertia_leverage` | Ω-07 Leverage stress, fragility |
| 8 | `wealth_field_macro` | Ω-08 Macro environment |
| 9 | `wealth_signal_information` | Ω-09 Evidence value, EVOI |
| 10 | `wealth_game_coordination` | Ω-10 Multi-agent incentives |
| 11 | `wealth_boundary_governance` | Ω-11 Constitutional floors |
| 12 | `wealth_governance_verdict` | Final allocation verdict |
| 13 | `wealth_agent_path` | Intent routing |
| 14 | `wealth_omni_wisdom` | Unified capital intelligence |
| 15 | `wealth_inequality_kernel` | Inequality diagnosis |
| 16 | `wealth_market_data` | FX, commodities, macro |
| 17 | `wealth_personal_finance` | Track, summary, runway, EPF, zakat |
| 18 | `wealth_stock_analysis` | 15-mode stock governance |
| 19 | `wealth_survival_engine` | Unified survival intelligence |
| 20 | `wealth_system_registry_status` | Registry truth diagnostic |

**18 Resources + 10 Prompts**

---

### 1E. WELL MCP (port 18083 → bridged to ChatGPT ✅)

**18 Somatic (Public) Tools:**

| # | Tool | Domain |
|---|------|--------|
| 1 | `well_classify_substrate` | Ω-01 Substrate classification |
| 2 | `well_trace_lineage` | Ω-02 Memory, trend, ledger |
| 3 | `well_detect_boundary` | Ω-03 Boundary detection |
| 4 | `well_measure_gradient` | Ω-04 Chemical/energy/pressure gradient |
| 5 | `well_assess_metabolism` | Ω-05 Biological metabolism |
| 6 | `well_assess_homeostasis` | Ω-06 Regulation, stability |
| 7 | `well_check_repair` | Ω-07 Repair, recovery, resilience |
| 8 | `well_validate_vitality` | Ω-08 Vitality, readiness, NIAT |
| 9 | `well_assess_livelihood` | Ω-09 Role, dignity, meaning |
| 10 | `well_assess_reliability` | Ω-10 Machine/institution reliability |
| 11 | `well_compute_metabolic_flux` | Ω-10b Thermodynamic entropy rate |
| 12 | `well_guard_dignity` | Ω-12 Soul, personhood, consent |
| 13 | `well_assess_sovereign_entropy` | SE: Unpredictability protection |
| 14 | `well_13_signal_coverage` | Audit of 13 canonical signals |
| 15 | `well_registry_status` | Registry truth diagnostic |
| 16 | `well_system_registry_status` | Surface vs autonomic |
| 17 | `well_medical_boundary` | Non-diagnosis guard |
| 18 | `mcp_health_check` | DEPRECATED → `well_assess_reliability(mode='health')` |

**77 Autonomic (Hidden) Tools** — intentionally not exposed. Exist in code but excluded from MCP surface by somatic boundary enforcement. Include the full 000→999 metabolic chain (`well_000_init`, `well_111_sense`, ..., `well_999_vault`) plus internal governance tools.

**13 Canonical Aliases:**
```
well_000_init → well_classify_substrate
well_111_sense → well_classify_substrate
well_222_fetch → well_measure_gradient
well_333_mind → well_assess_metabolism
well_444_kernel → well_detect_boundary
well_444_gateway → well_detect_boundary
well_444_reply → well_trace_lineage
well_555_memory → well_trace_lineage
well_666_heart → well_assess_homeostasis
well_777_forge → well_check_repair
well_888_judge → well_validate_vitality
well_999_vault → well_trace_lineage
well_000_ops → well_assess_reliability
```

---

## 2. TRANSPORT LAYER MAP

```
┌─────────────────────────────────────────────────────────────────┐
│                      CHATGPT SESSION                            │
│  MCP Clients: arifOS ✅ | WEALTH ✅ | WELL ✅ | GEOX ❌ | AF ❌  │
└──────────┬──────────┬──────────┬────────────────────────────────┘
           │          │          │
    ┌──────▼──┐ ┌─────▼───┐ ┌───▼──────┐
    │ arifOS  │ │ WEALTH  │ │  WELL    │
    │ :8088   │ │ :18082  │ │ :18083   │
    │ HTTP/SSE│ │ HTTP/SSE│ │ HTTP/SSE │
    └────┬────┘ └────┬────┘ └────┬─────┘
         │           │           │
         └───────────┼───────────┘
                     │
         ┌───────────▼───────────┐
         │     A-FORGE :7071     │  ← NOT bridged to ChatGPT
         │   HTTP/SSE (1 sess)   │
         │   Prometheus connected │
         └──┬──────┬──────┬──────┘
            │      │      │
    ┌───────▼┐ ┌───▼──┐ ┌▼───────┐
    │  GEOX  │ │ AAA  │ │Hermes  │
    │ :8081  │ │:3001 │ │ :8644  │
    │  MCP   │ │ A2A  │ │ NATS   │
    └────────┘ └──────┘ └────────┘
         │           │           │
    ┌────▼────┐ ┌───▼────┐ ┌───▼─────┐
    │Supabase │ │Caddy   │ │  NATS   │
    │ :54321  │ │:80,:443│ │ :4222   │
    │VAULT999 │ │TLS term│ │Event Bus│
    └─────────┘ └────────┘ └─────────┘
```

### MCP Transport Protocols Used

| Server | Type | Port | Transport | Sessions |
|--------|------|------|-----------|----------|
| arifOS | HTTP/SSE | 8088 | Streamable HTTP | Multi-session ✅ |
| A-FORGE | HTTP/SSE | 7071 | Streamable HTTP | **Single session** ⚠️ |
| GEOX | HTTP/SSE | 8081 | Streamable HTTP | Multi-session ✅ |
| WEALTH | HTTP/SSE | 18082 | Streamable HTTP | Multi-session ✅ |
| WELL | HTTP/SSE | 18083 | Streamable HTTP | Multi-session ✅ |

### Federation Flow (forge_pipeline auto-routing)

```
Task "Evaluate Malay Basin"
  → 111 SENSE: classify → GEOX
  → 444 ROUTE: ping organ status
  → 555 WITNESS: gather evidence
  → 777 FORGE: POST to GEOX :8081 → geox_query_intake
  → 888 JUDGE: POST to arifOS :8088 → arif_judge_deliberate
  → 999 VAULT: POST to A-FORGE :7071 → arif_vault_seal
```

---

## 3. GAPS IDENTIFIED

### Gap 1: A-FORGE not bridged to ChatGPT ❌
- **Status:** A-FORGE MCP server RUNNING on :7071
- **Problem:** NOT in `/root/.claude/settings.json` `mcpServers`
- **Blockers:** Single-session model (Prometheus occupies the only session)
- **Fix:** Either run A-FORGE MCP in multi-session mode on a separate port, or run the stdio MCP CLI (`npm run mcp:stdio` or `npm run mcp:http`) as a separate process

### Gap 2: GEOX not bridged to ChatGPT ❌
- **Status:** GEOX MCP server RUNNING on :8081
- **Problem:** NOT in `/root/.claude/settings.json` `mcpServers`
- **Fix:** Add GEOX to settings.json (same pattern as arifOS/WEALTH/WELL)

### Gap 3: AAA is A2A, not MCP
- **Status:** AAA RUNNING on :3001
- **Problem:** AAA speaks A2A protocol (task-based dispatch), NOT MCP
- **Impact:** Cannot be directly added as an MCP server to ChatGPT
- **Workaround:** A-FORGE's `forge_pipeline` already bridges AAA-like routing

### Gap 4: A-FORGE single-session limit
- **Problem:** A-FORGE MCP server currently supports ONE session at a time
- **Current occupant:** Prometheus (metrics scraping)
- **Impact:** Cannot connect ChatGPT as a second MCP client
- **Fix:** Run a second A-FORGE MCP instance on a different port for ChatGPT, or upgrade to multi-session

### Gap 5: Actor identity not verified
- **Problem:** All calls from ChatGPT are `actor_id: "anonymous"`
- **Impact:** arifOS correctly blocks all ATOMIC authority
- **Need:** Define agent identity contract as specified in user's Phase 1 plan

---

## 4. ANSWER: IS A-FORGE READY?

**Yes, technically. But not operationally.**

### What's ready:
- ✅ Full MCP server implementation with `@modelcontextprotocol/sdk`
- ✅ ~48 tools spanning filesystem, git, postgres, docker, memory, vault, WELL, WEALTH, governance
- ✅ C1 FloorEnforcer auto-gating on ALL tool registrations
- ✅ `forge_pipeline` — autonomous 000→999 routing to correct organ
- ✅ F1 Amanah locks with TTL
- ✅ Proper risk classification (OBSERVE/MUTATE/ATOMIC)
- ✅ 888_HOLD gates on dangerous tools
- ✅ HEALTH check endpoint working

### What's NOT ready:
- ❌ NOT in ChatGPT's MCP settings.json
- ❌ Single-session model blocks multi-client access
- ❌ No agent identity contract defined
- ❌ No lease model for scoped authority
- ❌ No registry projection (agent_role → allowed_tools → risk_level)

### What to do:

```bash
# Option A: Run A-FORGE MCP on a separate port for ChatGPT
cd /root/A-FORGE
npm run build
node dist/src/mcp/cli.js serve --transport http --port 7072 &

# Option B: Use the existing server but fix multi-session
# (requires code change in server.ts)

# Then add to /root/.claude/settings.json:
# "A-FORGE": {
#   "type": "http",
#   "url": "http://127.0.0.1:7072/mcp",
#   "description": "Governed execution gateway — filesystem, git, postgres, docker, vault"
# }
```

---

## 5. TOTAL TOOL COUNT

| Organ | Public Tools | Hidden/Internal | Total |
|-------|-------------|-----------------|-------|
| arifOS | 18 | 0 | 18 |
| A-FORGE | ~48 | 0 | ~48 |
| GEOX | 37 | 0 | 37 |
| WEALTH | 20 | 34 aliases | 54 |
| WELL | 18 | 77 autonomic | 95 |
| **TOTAL** | **~141** | **~111** | **~252** |

---

## 6. RECOMMENDED NEXT ACTIONS

1. **Bridge A-FORGE to ChatGPT** — Run second MCP instance on port 7072, add to settings.json
2. **Bridge GEOX to ChatGPT** — Add to settings.json (port 8081)
3. **Define agent identity contract** — `agent_id`, `role`, `authority` matrix
4. **Build registry projection** — `agent_role → allowed_tools → risk_level → required_floor → lease_required`
5. **Upgrade A-FORGE to multi-session** — or document single-session constraint
6. **Verify NATS + Supabase** — transport layer health check (blocked by auto-mode)
7. **Add 666_heart prompt template** — complete the 000→999 prompt chain (already in user's RSI list)

---

*DITEMPA BUKAN DIBERI — Forged, Not Given.*
*Audit sealed to: /root/A-FORGE_FEDERATION_AUDIT_2026-06-14.md*
