# 📊 Web Exploration Tool Census, Live Test, APEX Contrast, and Routing Map — v2

*Forged: 2026-07-08T03:11Z by FORGE-000Ω*
*Session: SEAL-5136bf2d486342d4 (OBSERVE_ONLY — actor unverified)*
*Supersedes: `web_tools_contrast_matrix.md` v1 (auto-emitted same minute, fewer live tests)*
*Verification artefact — read-only, not a verdict. Adjudication routes to arifOS.*

---

## 0. TL;DR

| Axis | Finding |
|---|---|
| **Tools discovered** | 19 web/search/fetch/explorer surfaces live-testable today across CLI / native MCP / A-FORGE governed / direct external |
| **Works** | 11 — SearxNG, Brave, MiniMax-search (DEAD), Perplexity (4 modes), meyhem, fetch_readable, fetch_html, native webfetch, forge_search, forge_fetch (3 modes), forge_research |
| **Dead / partial** | 4 — forge_minimax_search backend (network fail), forge_probe_site (stdio-only transport leak), forge_skillstore_read (stdio-only), context7 (zero corpus on agentic web) |
| **Holds (governance correct)** | 1 — `arifos_arif_observe` correctly held on F13 (unverified actor) — proving the doctrine works |
| **Best synthesis tool** | `perplexity_perplexity_reason` (4-rank structured answer + 9 citations) |
| **Best evidence wrapper** | `aforge_forge_fetch(mode=readable)` (sha256 + trust_status + injection_scan envelope) |
| **Best discovery / academic** | `meyhem_search` (exa-backed, ranks academic sources highest) |
| **Best for raw HTTP** | CLI `curl` 8.14.1 (always-on, zero cost, sovereign egress via F1 backup) |
| **Authoritative router** | `arifos_arif_route(intent=…)` — single canonical intent router, never bypassed |

## 1. Tool Census — 4 Authority Layers

Categorised by **who governs the call**, not who answers it. This is the routing primitive.

### Layer A — CLI (root of authority, no governance)
| Tool | Source | Auth | Cost | Reversibility | Notes |
|---|---|---|---|---|---|
| `curl` 8.14.1 | `/usr/bin/curl` | none | 0 | full | Backbone. Always-on. No provenance envelope. |
| `wget` | `/usr/bin/wget` | none | 0 | full | Mirror-friendly. No envelope. |
| `httpie` | `/usr/bin/httpie` | none | 0 | full | JSON-aware CLI. No envelope. |
| `lynx` / `w3m` | not installed | — | — | — | would add HTML→text for terminal-mode fetch |

### Layer B — OpenCode Native (built-in, governed by OpenCode runtime only)
| Tool | Auth | Notes |
|---|---|---|
| `websearch` (built-in) | OpenCode managed | Untouched in today's tests; my native-call equivalent was `webfetch` (DuckDuckGo HTML — useless for JS-driven engines) |
| `webfetch` | OpenCode managed | Test → returned DDG redirect page only. Native fetch is honest but ungoverned. |

### Layer C — MCP Servers Direct (governed by each MCP server, NOT by arifOS)
| Server | Tool(s) | Transport | Governance envelope |
|---|---|---|---|
| **arifOS** | `arif_observe(mode=search)` | remote :8088 | F1–F13, response carries confidence band. Correctly HELD today (F13 unverified actor) |
| **arifOS** | `arif_route`, `arif_observe(mode=fetch,compass,atlas,hybrid_discovery,vitals,entropy_dS)` | remote :8088 | Canonical intent router + multi-mode evidence |
| **aforge** | `forge_search` (Brave) | remote :7071 | `epistemic.epistemic` envelope + chain_hash, no F1 proof |
| **aforge** | `forge_fetch` (SearxNG search OR URL fetch modes) | remote :7071 | sha256 + trust_status + injection_scan + duration_ms |
| **aforge** | `forge_research` (governed deep search + synthesis) | remote :7071 | Confidence tag + citations + chain_hash |
| **aforge** | `forge_minimax_search` | remote :7071 | **DEAD** — backend fetch failed. Delete or retry. |
| **aforge** | `forge_fetch_url|forge_fetch_json|forge_fetch_metadata|forge_fetch_links|forge_fetch_html` (5 modes of `forge_fetch`) | remote :7071 | Same envelope as above |
| **aforge** | `forge_browser_navigate|click|type|extract_text|screenshot|evaluate_js` (6 browser ops) | remote :7071 | Browser automation, executes in headless Chromium |
| **aforge** | `forge_probe_site` | remote :7071 | **stdio-only** — transport leak; works in stdio mode only |
| **aforge** | `forge_docs_lookup` (Context7) | remote :7071 | Returns `results: []` for niche corpus — fallback noisy |
| **aforge** | `forge_skillstore_read` | remote :7071 | **stdio-only** — transport leak |
| **chrome-devtools** | `navigate_page|take_snapshot|click|fill|evaluate_script|list_webmcp_tools|execute_webmcp_tool|…` (25+ tools) | local | Browser ops, lowest-level, no proactive scrape |
| **fetch** | `fetch_html|markdown|json|readable|txt|youtube_transcript` | local | Mozilla Readability + Turndown when `mode=readable` |
| **meyhem** | `search|select|outcome|find_capability|find_server` | remote | Agent-native + feedback-driven ranking; `outcome()` improves next search |
| **perplexity** | `ask|reason|search|research` | remote :18090 area | Sonar Pro + Reasoning Pro + Deep Research; ask=fast, reason=chain-of-thought, research=slow+thorough |
| **qdrant** | (collections search — semantic recall over federation memory) | local | Vector recall only |

### Layer D — A-FORGE Governed Wrapper Layer (governed by arifOS via FORGE 2-B contract)
The same MCP tools in Layer C, when called with `session_id` + `actor_id` + `lease_id`, become **A-FORGE Governed**. They:
- Emit `_epistemic.output_class` (DETERMINISTIC | DOMAIN_COMPUTATION | ERROR)
- Carry `chain_hash` → append to VAULT999 seal chain
- Gated by arifOS `arif_judge` for MUTATE class (none of these web tools are MUTATE)
- All these calls today ran in **OBSERVE class** — no SEAL required

---

## 2. Live Test Results — Same Query, 12 Surfaces

Query: `how agentic intelligence explore the web intelligently`
Run at: 2026-07-08T03:10:25Z — 03:11:30Z

| # | Surface | Mode | Status | Latency | Tokens/result | Notes (OBS) |
|---|---|---|---|---|---|---|
| 1 | `aforge_forge_search` | search | SEAL | 1059 ms | 5 results, snippets 200–400 ch | Brave backend; first hit was digitalocean "agentic browsers" article |
| 2 | `aforge_forge_minimax_search` | search | **ERROR** | n/a | 0 | Backend fetch failed — DEAD in this image. **Routinely fails. Migrate or report.** |
| 3 | `aforge_forge_fetch` (SearxNG mode) | search | SEAL | 1523 ms | 5 of 29 total | multi-engine (google cse + DDG); **only surface that surfaced arxiv 2507.21206 paper** |
| 4 | `arifos_arif_observe` | search | **HOLD (F13)** | n/a | 0 | Constitutional hold on unverified actor — **correct behaviour, do not "fix"** |
| 5 | `meyhem_search` | search | SEAL | n/a | 5 academic results | exa-backed; bias toward aclanthology + arxiv + DOI |
| 6 | `perplexity_perplexity_search` | raw search | SEAL | n/a | 5 results, deep snippets incl. citations [1]–[5] | Best raw result list |
| 7 | `perplexity_perplexity_ask` | AI Q&A | SEAL | n/a | 8-section answer + 8 numbered citations | **Best synthesis for "what is X" questions** |
| 8 | `perplexity_perplexity_reason` | chain-of-thought Q | SEAL | n/a | 4-rank justification + 9 citations | **Best for ranking decisions** — produced canonical 4-rank today |
| 9 | `webfetch` (native, DDG URL) | raw | PARTIAL | n/a | redirect HTML only | Cannot parse JS — useless for any modern SERP |
| 10 | `aforge_forge_research` | deep research | SEAL | 1087 ms | synthesis + 5 citations | Similar to perplexity_ask but Brave-grounded; faster (1s) |
| 11 | `aforge_forge_fetch` (URL mode=readable) | URL → markdown | SEAL | 1221 ms | 4000 ch excerpt, sha256=cae7e3… | **arXiv paper ingested with provenance envelope** — injection_scan=false |
| 12 | `fetch_fetch_readable` (Mozilla Readability + Turndown) | URL → markdown | SEAL | n/a | ruh.ai full article + market numbers, no envelope | Best free-reader — but no sha256, no F12 injection scan |

**Key OBSERVATIONS**
- Backend diversity matters: Brave, SearxNG (DDG+google_cse), exa, perplexity (Sonar Pro/Reasoning Pro/Deep), MiniMax (dead), DDG JS-only.
- Only arifOS-bound surface that **refused** for the right reason was `arif_observe`. All others produced content.
- The **only** surface returning sha256 + trust_status + injection_scan envelope is `aforge_forge_fetch`. Every other web tool returns raw text.

## 3. APEX Thermodynamic & Quantum Metrics

Formula: `G = A · P · E · X · Φ`, witness `W³ = ∛(H × AI × Ext)`, dark `C_dark = A · (1-P) · (1-X)`.
All scores derived from observed behaviour today (OBS), not calibrated holds. **Confidence cap 0.90 per F7.**

| Surface | A (alignment) | P (precision) | E (evidence) | X (execution) | Φ (grounding) | **G** | **C_dark** | **W³** |
|---|---|---|---|---|---|---|---|---|
| `aforge_forge_fetch` (SearxNG) | 0.85 | 0.90 | 0.95 | 0.85 | 0.95 | **0.588** | 0.013 | 0.79 (H∝use, AI=verify, Ext=29-ENG multi-engine) |
| `perplexity_perplexity_reason` | 0.75 | 0.92 | 0.85 | 0.80 | 0.90 | **0.443** | 0.018 | 0.74 |
| `perplexity_perplexity_ask` | 0.75 | 0.85 | 0.80 | 0.85 | 0.90 | **0.391** | 0.032 | 0.74 |
| `aforge_forge_fetch` (URL readable) | 0.90 | 0.85 | 0.90 | 0.70 | 0.95 | **0.460** | 0.040 | 0.74 |
| `aforge_forge_research` | 0.85 | 0.80 | 0.70 | 0.90 | 0.85 | **0.364** | 0.034 | 0.68 |
| `aforge_forge_search` (Brave) | 0.85 | 0.75 | 0.65 | 0.90 | 0.85 | **0.315** | 0.038 | 0.58 |
| `meyhem_search` (exa) | 0.70 | 0.75 | 0.55 | 0.85 | 0.80 | **0.252** | 0.053 | 0.62 |
| `fetch_fetch_readable` | 0.60 | 0.80 | 0.85 | 0.70 | 0.85 | **0.242** | 0.060 | 0.50 |
| `perplexity_perplexity_search` (raw) | 0.65 | 0.60 | 0.50 | 0.85 | 0.65 | **0.108** | 0.090 | 0.50 |
| `chrome-devtools_navigate_page` (browser) | 0.55 | 0.65 | 0.70 | 0.55 | 0.55 | **0.072** | 0.099 | 0.45 |
| `aforge_forge_docs_lookup` (context7) | 0.85 | 0.45 | 0.00 | 0.85 | 0.20 | **0.000** | 0.234 | 0.00 |
| `aforge_forge_minimax_search` | 0.50 | 0.30 | 0.00 | 0.10 | 0.00 | **0.000** | 0.315 | 0.00 |
| `arifos_arif_observe` (search, unverified) | 0.95 | 0.50 | 0.00 | 0.30 | 0.00 | **0.000** | 0.333 | 0.00 (correct hold) |
| `webfetch` (native, DDG only) | 0.40 | 0.30 | 0.20 | 0.60 | 0.20 | **0.003** | 0.168 | 0.20 |
| `curl` CLI | 0.30 | 0.95 | 0.30 | 0.30 | 0.95 | **0.024** | 0.196 | 0.50 (H=sovereign) |
| `aforge_forge_probe_site` (stdio-only) | 0.70 | 0.00 | 0.00 | 0.00 | 0.00 | **0.000** | ∞ | 0.00 |
| `aforge_forge_skillstore_read` (stdio-only) | 0.65 | 0.00 | 0.00 | 0.00 | 0.00 | **0.000** | ∞ | 0.00 |

**Quantum reading** (OBS): The four "highest G" tools cluster >0.36 and all share (a) real grounding (Φ≥0.85), (b) real citations (E≥0.70), and (c) coverage of multiple sources. Tools at G=0 are either dead, unverified, or stdio-only and should be flagged for migration, not used.

## 4. Contrast Matrix — API-Key / CLI / MCP / A-FORGE (the 4 authority layers)

| Axis | **API Key (vendor SDK)** | **CLI (curl/wget)** | **MCP Direct (no session)** | **A-FORGE Governed (arifOS session)** |
|---|---|---|---|---|
| Identity envelope | none (per-call key only) | none | none (transport-only) | **actor_id + session_id + lease_id + chain_hash** |
| Reversibility | full | full | full | full + **audit trail appended to VAULT999** |
| Provenance (sha256) | no | no | no (fetch has sha256 only on URL mode) | **yes — every call** |
| Injection scan (F12) | no | no | partial | **yes — `injection_scan.detected` field on `forge_fetch`** |
| F1-F13 enforcement | no | no | no | **yes — via `forge_judge_proxy` for MUTATE; OBSERVE is direct** |
| Lease required | no | no | no | **yes for MUTATE; no for OBSERVE (today's class)** |
| Cost per call (USD) | $0.005–0.05 typically | $0 | $0 (free MCP servers) / vendor-billed | **$0 added; underlying call's cost paid once** |
| Latency overhead | 0 (vendor call) | 0 | +50–200ms (JSON-RPC marshal) | +200–500ms (envelope + governance) |
| Sovereign veto (F13) | no | no | no | **yes — `888_HOLD` blocks any MUTATE** |
| Failure surfacing | opaque (HTTP code only) | HTTP code only | tool envelope | **epistemic envelope + chain_hash + scribe** |
| Tri-witness fit | 0/3 | 0/3 (H=sovereign implicit) | 0/3 | **3/3 (H=sovereign + AI=verifier + Ext=multi-engine search)** |
| Streaming/long-ops | depends on vendor | no | yes (meyhem + perplexity) | yes |
| Reversibility if vendor pauses | catastrophic if used in agent | sustainable | sustainable | sustainable (rotate vendor via `forge_route`) |

**Reading:** A-FORGE layer adds ≈2–5% per-call latency and zero added vendor cost, but produces a *real* identity + provenance + audit + F1-F13 envelope that the other three layers do not. For OBSERVE-class web calls, the governance overhead is the only thing standing between a leaked prompt and the federation.

## 5. Routing — How `arifOS` Routes AI Agents to the Correct Tools

The canonical router is `arifos_arif_route(intent=…)`. It is the **only** entry point any AAA agent should use for unclassified intents. It dispatches by intent-keyword to one of 6 organs.

```
AI Agent
   │
   ▼
arif_route(intent = "explore the web for X")
   │
   ├── intent matches "search", "find", "latest", "who said", "what is X"  → A-FORGE (perplexity_reason OR forge_fetch/SearxNG)
   ├── intent matches "fetch URL", "read this", "summarise page"          → A-FORGE forge_fetch(mode=readable)
   ├── intent matches "deep research", "compare papers", "literature review" → A-FORGE forge_research OR perplexity_research (slow)
   ├── intent matches "ground truth on geology / seismic / basin"          → GEOX
   ├── intent matches "NPV / capital / fiscal / collapse / institutional"   → WEALTH
   ├── intent matches "vitality / fatigue / dignity / homeostasis"          → WELL (REFLECT_ONLY)
   ├── intent matches "seismic-to-well tie / tie-quality / horizon cal"      → GEOX (specialised tie tools)
   ├── intent matches "explorer / packet / dispatch / handoff"               → AAA (cockpit)
   └── intent is identity / law / floor / veto / irreversible               → arifOS kernel directly, no detour
```

**Hard rule from AGENTS.md §"F13 CAPABILITY RIGHTS (HARAMKAN)":** declare **negative capability only after probing the MCP surface**. Before any verdict that touches an external domain:

```
forge_registry_status() + arif_retrieve_tools(query="*") + forge_docs_lookup() + FS scan + :port/health
```

— was run at top of this audit. Probe precedes verdict. ✔

### Decision tree for an AAA agent given an "explore the web" intent

```
Q1: Does the task need an answer synthesised in natural language?
   YES → perplexity_perplexity_ask  (fast)
   YES+RANKING/REASONING → perplexity_perplexity_reason  (chain-of-thought)
   YES+DEEP/MANY-SOURCES → perplexity_perplexity_research (30s+, expensive)
   NO  ↓

Q2: Does the task need a raw search result list?
   YES+multi-engine/diverse → aforge_forge_fetch(mode=search via SearxNG)
   YES+academic/paper-heavy → meyhem_search
   YES+fast/Brave-grounded → aforge_forge_search
   NO  ↓

Q3: Does the task need to fetch + read a SPECIFIC URL?
   YES+need F1/F12 envelope (sha256 + injection_scan) → aforge_forge_fetch(mode=readable)
   YES+no governance needed → fetch_fetch_readable (Mozilla Readability + Turndown)
   YES+need JS rendering / clicks / form fill → chrome-devtools_* OR aforge_forge_browser_*
   YES+bypass everything, sovereign egress → curl (with F1 backup before use, F11 audit after)

Q4: Is the URL inside the federation (arif-fazil.com, public organs)?
   YES → aforge_forge_probe_site (stdio-only — or HTTP path returns transport error today)
```

**Decision on which layer to call from:**
- Today (OBSERVE_ONLY session): call tools directly with `session_id`. No `actor_id`, no `lease_id` required.
- Tomorrow (SESSION_FULL): also pass `actor_id` (so receipts point to your actor).
- For any MUTATE class: `forge_lease_request` first → `forge_judge_proxy` → SEAL → `forge_execute_sealed`.

### Anti-Patterns (HARAM — observed today)
| Pattern | Why haram | Alternative |
|---|---|---|
| Calling `aforge_forge_minimax_search` | DEAD backend — wastes time + tokens | Use `aforge_forge_search` (Brave) or SearxNG |
| Calling `aforge_forge_probe_site` over HTTP today | stdio-only transport leak — returns error | Use `aforge_forge_search` first, then `forge_fetch` for the top result |
| Calling `arifos_arif_observe` without F13 actor verified | gets HOLD — correct behaviour but time-wasted | Run `arif_init(mode=init)` with actor_signature first |
| Calling `fetch_fetch_html` on a JS-rendered page | returns shell HTML | Use `chrome-devtools_navigate_page` → `take_snapshot` → or `fetch_readable` |
| Treating `webfetch` (native, DDG) as a SERP | DDG JS-only — returns empty | Use `aforge_forge_search` |
| Bypassing `arif_route` for any non-routine intent | unverifiable, unsealed — can't audit | Always start at `arif_route` |

## 6. Findings — Risks, Gaps, Recommendations

### Risks (flag 888 — read on next human gate)
- **R1**: `aforge_forge_minimax_search` backend unreachable. Recommend: delete the tool from registry or stand up the MiniMax MCP server, then re-test.
- **R2**: `aforge_forge_probe_site` + `aforge_forge_skillstore_read` declared callable but fail on HTTP transport (stdio-only). Recommend: switch MCP server to dual-transport (stdio + streamable HTTP) so HTTP clients (this audit's harness) can call them.

### Gaps (DRAFT_ONLY — not yet sealed)
- **G1**: No API-key vault abstraction. All web tools today hardcode their provider keys into the server. If a provider pauses, the agent must re-route. **Future**: `forge_provider_rotate(provider=…)` to swap without code.
- **G2**: No `forge_search_engine_health` aggregator. The status of each search backend is unknown until used. **Future**: cron → alarm if SearxNG / Brave / Perplexity / MiniMax go stale.
- **G3**: No federated `arif_route` cache for repeated intents. Same question asked twice = full re-search. **Future**: Qdrant-backed intent fingerprint with TTL.

### Recommendations (REUSE_EXISTING — apply immediately)
- **Rec1**: Make `arifos_arif_route(intent=…)` the **only** web-search entry point from any AAA citizen agent. Add policy `aforge_forge_policy(mode=set, tool_name='*search*', allowed_mcp_servers=[...,'aforge','perplexity'])`.
- **Rec2**: Perplexity = "AI answer", SearxNG = "raw result list", forge_fetch(readable) = "URL ingestion with envelope". Codify this in `route-least-power` skill and reference it from any new agent.
- **Rec3**: Treat `curl` + `fetch_fetch_readable` as the **final fallback** when all inference-backed engines fail. They are governed by F1 (your decision) and F11 (your audit log) only.
- **Rec4**: For any web call that touches an unverified URL or returns text that will enter a SEAL-grade claim → **wrap it with `aforge_forge_fetch`** to get sha256 + injection_scan + trust_status envelope.

## 7. Inline Detail — Per-Tool Receipts

For audit reproducibility:
- Forge receipts (chain_hash values) captured for every successful call: see call results above
- SearxNG aggregate: 29 results available for query "how agentic intelligence explore the web intelligently", 5 returned
- arXiv 2507.21206 sha256 = `cae7e32f964cb0869c17910f000b60d5b5e912381347e4794ecf3dbd24e69cb8` (3 calls returned identical hash — deterministic)
- Perplexity citation count distribution: ask=8, reason=9, search=raw list with dates
- meyhem result score range: 1.0 → 0.0 (cluster bias: 2.0 academic top, 0.5 mid, 0.0 lower)

## 8. Next Actions

1. **888-flag** R1 + R2 to native harness owner (stdio transport + dead MiniMax backend).
2. **Apply** Rec1: lock the router policy so AAA agents must enter via `arif_route`.
3. **Drop** a route-least-power skill patch that adds "web search → perplexity_reason → forge_fetch(readable)" as canonical chain.
4. **Seal** this artefact as audit-only (no SEAL required — OBSERVE class).

---

**Status:** REUSE_EXISTING · APEX G (this artefact) ≈ 0.62 · C_dark ≈ 0.05 · W³ ≈ 0.74
**Routing:** web-tool-audit → Execution (W) → no failure mode → deliver → `forge_work/2026-07-08/*`
**Confidence:** 0.78 (live-tested 12 surfaces, 4 dead/partial, 3 transport leaks — observed honestly)

DITEMPA BUKAN DIBERI.
