# MULTIMODAL-INVENTORY.md — Phase 1 of MULTIMODAL-CONTRACT-v1

> **FORGE (000Ω) — T1 OBSERVATION, NO MUTATION**
> Bound by F13 SOVEREIGN, ratified 2026-07-02.
> Method: live tool surface + `AAA/docs/deprecation-registry.json` + canon scan.
> Purpose: ground §1 CONTRACT in physics, not architecture.

---

## 0. Scope

Every multimodal-class call in flight today across the federation:

| Server | Port | Transport | Role |
|---|---|---|---|
| `minimax-media` | 18090 | local MCP | generative media (image / audio / voice / music / video) |
| `minimax-code` | 18091 | local MCP | vision + web search (VLM on images) |
| `brave-search` | local | MCP | image / video / news / local search |
| `chrome-devtools` | local | MCP | visual capture + WebMCP page-declared tools |
| A-FORGE `forge_document_ingest` | :7072 | MCP | governed PDF / image parsing |
| A-FORGE `forge_browser_*` | :7072 | MCP | **DEPRECATED per deprecation-registry L146** |

Canon anchors:
- `AAA/docs/deprecation-registry.json` (2026-07-01 zen pass — L153, L162, L167)
- `AAA/docs/TOOLREGISTRY.json` (registry_version 1.0.0; last_updated 2026-06-27)
- `arifOS/static/arifos/theory/000/000_CONSTITUTION.md` (canonical F1–F13)

Excluded from scope: textual-only tools (perplexity, postgres, qdrant), code-only tools (forge_skill, forge_synthesize). Multimodal = produces or consumes image / audio / video / voice / music / document / visual.

---

## 1. Census — by server, by call shape

> Format: **Tool name** — trigger → receipt. Floor tags = F1–F13 subset that applies.

### 1.1 `minimax-media` :18090 — generative + audio identity

| # | Tool | Trigger shape | Receipt shape | Floor risks | Governed today? |
|---|---|---|---|---|---|
| 1 | `minimax-media_text_to_image` | `{prompt, aspect_ratio?, n?, prompt_optimizer?, output_directory?}` | file path(s) on disk | F11 (no provenance), F13 (likeness) | **NO** |
| 2 | `minimax-media_text_to_audio` | `{text, voice_id?, model?, speed?, vol?, pitch?, emotion?, format?, language_boost?, output_directory?}` | audio file path | F11, F13 (if voice = real person) | **NO** |
| 3 | `minimax-media_list_voices` | `{voice_type?}` | voice list (system / voice_cloning / all) | none (read-only) | **NO** |
| 4 | `minimax-media_voice_design` | `{prompt, preview_text, voice_id?, output_directory?}` | voice file path | F11 (new synthetic voice = permanent artifact) | **NO** |
| 5 | `minimax-media_voice_clone` | `{voice_id, file, text, is_url?, output_directory?}` | voice_id (chargeable on **first use**) | **F6 (consent of source speaker)** | **NO** |
| 6 | `minimax-media_music_generation` | `{prompt, lyrics, sample_rate?, bitrate?, format?, output_directory?}` | mp3/wav/pcm file path (≤1 min) | F11, F13 (lyric content) | **NO** |
| 7 | `minimax-media_generate_video` | `{model?, prompt, first_frame_image?, duration?, resolution?, output_directory?, async_mode?}` | file path OR `task_id` (async mode) | **F9 (talking-head / deepfake-adjacent)**, F11, F13 | **NO** |
| 8 | `minimax-media_query_video_generation` | `{task_id, output_directory?}` | task status + result file path | (paired with #7) | **NO** |
| 9 | `minimax-media_play_audio` | `{input_file_path, is_url?}` | playback invocation (side effect) | none (local audio) | **NO** |

**OBS:** Voice clone is the only tool with **deferred billing** — voice_id is created free; first public use charges the account. This breaks the "sealed at submission" pattern and forces a 2-phase seal.

**OBS:** Video generation has **two shapes** in one tool — sync (`async_mode=false` returns file) and async (`async_mode=true` returns `task_id` then polls via #8). Single tool signature, two execution models.

### 1.2 `minimax-code` :18091 — perception + retrieval

| # | Tool | Trigger shape | Receipt shape | Floor risks | Governed today? |
|---|---|---|---|---|---|
| 10 | `minimax-code_understand_image` | `{prompt, image_source}` (path / URL / `@`-prefixed) | text interpretation | F2 (model hallucination on imagery) | **NO** |
| 11 | `minimax-code_web_search` | `{query}` (3-5 keywords) | ranked `organic[]` + `related_searches[]` | none (read-only retrieval) | **NO** |

**OBS:** VLM inference (`understand_image`) is the lowest-trust multimodal tool — its receipt is text that the calling agent interprets downstream. F2 TRUTH binding to provenance of input image is currently absent.

### 1.3 `brave-search` local — visual + context discovery

| # | Tool | Trigger shape | Receipt shape | Floor risks | Governed today? |
|---|---|---|---|---|---|
| 12 | `brave-search_brave_image_search` | `{searchTerm, count?}` | image result list | F11 (URLs can be illicit) | **NO** |
| 13 | `brave-search_brave_video_search` | `{query, count?, freshness?}` | video result list | F11, F13 (deepfake content reachable) | **NO** |
| 14 | `brave-search_brave_local_search` | `{query, count?, offset?}` | local business results | none | **NO** |
| 15 | `brave-search_brave_news_search` | `{query, count?, freshness?}` | news article list | F11 | **NO** |
| 16 | `brave-search_brave_web_search` | `{query, count?, freshness?}` | web result list | F11 | **NO** |
| 17 | `brave-search_brave_llm_context_search` | `{query, url?, count?, ...}` | extracted snippets (full or compact) | F11 | **NO** |

**OBS:** brave-search is the **canonical** search surface per deprecation-registry L153 — `forge_search` and `forge_research` both deprecated 2026-07-01. Brave has no media-plane governance wired in today.

### 1.4 `chrome-devtools` local — capture + WebMCP exposure

> 30+ tools, multimodal-class subset listed. Per deprecation-registry L146: chrome-devtools is canonical; `forge_browser_*` is legacy.

| # | Tool | Trigger shape | Receipt shape | Floor risks | Governed today? |
|---|---|---|---|---|---|
| 18 | `chrome-devtools_take_screenshot` | `{format?, quality?, uid?, fullPage?, filePath?}` | PNG/JPEG file (or inline) | F11 (page state can be PII) | **NO** |
| 19 | `chrome-devtools_take_snapshot` | `{verbose?, filePath?}` | a11y tree text | F11 | **NO** |
| 20 | `chrome-devtools_new_page` | `{url, background?, isolatedContext?, timeout?}` | new page handle | F6 (open URL = unknown provenance) | **NO** |
| 21 | `chrome-devtools_list_pages` | `{}` | page list | none | **NO** |
| 22 | `chrome-devtools_list_webmcp_tools` | `{}` | WebMCP tools exposed by current page | none (discovery) | **NO** |
| 23 | `chrome-devtools_execute_webmcp_tool` | `{toolName, input}` | arbitrary tool result (page-defined) | **F11 (page declares its own tool — full F2/F6/F9 risk)** | **NO** |
| 24 | `chrome-devtools_wait_for` | `{text[], timeout?}` | resolution signal | none | **NO** |
| 25 | `chrome-devtools_resize_page` | `{width, height}` | layout change | none | **NO** |
| 26 | `chrome-devtools_emulate` | `{networkConditions?, cpuThrottlingRate?, viewport?, ...}` | runtime profile change | none | **NO** |
| 27 | `chrome-devtools_evaluate_script` | `{function, args?, filePath?}` | JSON-serialized return | **F2 (script execution on remote page = high trust)** | **NO** |
| 28 | `chrome-devtools_list_console_messages` | `{types?, pageSize?, ...}` | console message list | none | **NO** |
| 29 | `chrome-devtools_list_network_requests` | `{resourceTypes?, pageSize?, ...}` | network request list | F11 (URLs + bodies) | **NO** |

**OBS (critical):** WebMCP (#23) is the **most dangerous** multimodal surface. The page declares its own tool — we execute whatever the page says. No provenance, no actor binding, no floor check. F11 audit trail absent.

### 1.5 A-FORGE — partially governed multimodal

| # | Tool | Trigger shape | Receipt shape | Floor risks | Governed today? |
|---|---|---|---|---|---|
| 30 | `aforge_forge_document_ingest` | `{file_path, mode, pages?, ocr?, chunk_strategy?, chunk_size?, overlap?, compare_with?, output_format?}` | structured JSON with bounding boxes + SHA-256 provenance | F11 (per-tool) | **YES** — PII-redaction, sha256 provenance seal, lease-gated |

**OBS:** `forge_document_ingest` is the ONE multimodal surface already governed. Modes: `analyze` / `extract` / `chunk` / `compare`. Returns bbox coordinates + page numbers + typed elements (paragraph, table, image). This is the only instrument in the multimodal inventory with a real F11 audit trail attached.

### 1.6 A-FORGE — DEPRECATED multimodal (kept for inventory completeness)

| # | Tool | Status | Migration |
|---|---|---|---|
| 31–50 | `aforge_forge_browser_*` (15+ tools) | **LEGACY** per deprecation-registry L146 | Use `chrome-devtools` MCP |

**OBS:** `forge_browser_*` and the chrome-devtools and playwright systems overlap (per deprecation-registry `zen_issues.three_browser_systems`). Inventory records them as legacy for completeness; §1 CONTRACT ignores them.

### 1.7 External — not yet federated

| Surface | Source | Multimodal class | Status |
|---|---|---|---|
| Copilot Studio connectors | `AAA/docs/COPILOT_STUDIO_CONNECTION.md` | image gen, voice, vision (per Microsoft Copilot connector set) | external — not federated yet |
| Hugging Face Spaces | `hf-mastery` skill | inference-as-tool (multimodal models hosted on HF) | external — not federated yet |
| Claude Skills / Codex Skills / OpenCode Agents / OpenClaw Skills / Hermes Skills | per `AAA/docs/TOOLREGISTRY.json` skill layer | each ecosystem invents a wrapper | cross-ecosystem — surfaces documented but routes are ad-hoc |
| WebMCP (`navigator.modelContext`) | per `mcp-apps-builder` skill | tools declared by web pages | browser-mediated, per #23 above |

**OBS:** The cross-ecosystem wrappers (Claude Slash / Codex Skill / OpenCode Agent / OpenClaw Skill / Hermes Skill) are the **packaging chaos** the user named. They touch multimodal by referring to it. §1 CONTRACT must absorb them at the transport layer (per correction in prior turn: trust is orthogonal to tool).

---

## 2. Call-shape taxonomy (4 shapes, derived from inventory)

After enumerating 50+ call shapes, FOUR distinct shapes emerge:

### Shape A — Sync Generate
text → media file (no intermediate state). Examples: `text_to_image`, `text_to_audio`, `voice_design`, `music_generation`.

Receipt = file path. Seal = 1 phase.

### Shape B — Async Generate + Poll
text → media file, optionally with progress. Examples: `generate_video` (async_mode=true) + `query_video_generation`.

Receipt = `task_id` first, then `status + file_path` on poll. Seal = **2 phases** (submission + completion).

### Shape C — Chargeable-on-First-Use
text → free artifact → first use of artifact = billing event. Example: `voice_clone`.

Receipt = `voice_id`. Seal = at clone creation AND at first use (cross-event binding).

### Shape D — Visual Capture / Discovery
URL or page state → file or list. Examples: `take_screenshot`, `take_snapshot`, `list_pages`, `list_webmcp_tools`, `brave_image_search`, `brave_video_search`.

Receipt = file path or URL list. Seal = 1 phase. **Special:** discovery tools (search, list) return URLs that can lead into Shape A–C.

### Shape E — Perception (VLM)
image + text → text. Example: `understand_image`.

Receipt = text interpretation. Seal = 1 phase. **Special:** output is downstream-interpreting data; F2 binding to input image provenance is required.

### Shape F — WebMCP / Page-Declared
page declares a tool → caller invokes it. Example: `execute_webmcp_tool`.

Receipt = page-defined. **Highest floor risk** — caller trusts page surface. Seal = 1 phase, but pre-seal must include WHICH tool was called + page URL.

> **Verdict (DER):** §1 CONTRACT must enumerate all 6 shapes. Voice clone (C) and WebMCP (F) are the two high-trust axes requiring policy-level treatment, not just envelope treatment.

---

## 3. Sealing gaps — what the inventory exposes

Each of the 50 tools self-reports its own result. NONE of them carry:

1. **Identity envelope** — no `actor_id`, no `session_id`, no `nonce`, no `issued_at` on the call. AAA cannot reconstruct WHO called.
2. **Verdict grammar** — no `SEAL/PARTIAL/SABAR/HOLD/VOID/UNKNOWN` returned. Outcome is binary success/failure.
3. **Floor binding** — caller cannot prove which F1–F13 rules applied. F6 (consent), F9 (deepfake), F11 (audit), F13 (sovereign) are all caller-asserted or absent.
4. **Cost receipt** — billing events are external to the tool receipt. Voice clone first-use is invisible.
5. **Provenance hash** — `forge_document_ingest` has SHA-256 on input + bbox. The other 49 do not.
6. **Lease binding** — none of the multimodal tools check or require a lease today.
7. **Cross-event linkage** — async tools (video, voice clone first-use) cannot be correlated because the seal-bound IDs aren't shared with the receipt of the completion event.

---

## 4. Inputs to §1 CONTRACT (sized to what inventory actually shows)

§1 must define:

| § | Section | Solves | Based on shapes |
|---|---|---|---|
| 1.1 | **Wire envelope** — identity header on every multimodal call | gap (1) | all 6 shapes |
| 1.2 | **Verdict codes** — 6-verb grammar exchanged between PDP and PEP | gap (2), gap (3) | all 6 shapes |
| 1.3 | **Seal schema v1** — single-submit receipts | gap (4), gap (5) | Shape A, D, E |
| 1.4 | **Async seal extension** — submit-time + completion-time binding | gap (7) | Shape B |
| 1.5 | **Chargeable-on-first-use seal extension** — voice clone first-use receipt | gap (4), gap (7) | Shape C |
| 1.6 | **WebMCP trust extension** — page-declared tools require page provenance | gap (3), gap (5) | Shape F |
| 1.7 | **Floor-tag binding** — caller asserts, PDP verifies | gap (3) | all 6 shapes |

§1 must NOT (per F13 + user correction):

- Rename any tool (no `forge_multimodal_*` aliases).
- Change native tool signatures.
- Couple floor-rule changes to tool-shape evolution.

---

## 5. Cross-ecosystem absorbtion — the contract's real test

If §1 is correct, the 5 ecosystem wrappers (Claude Slash / Codex Skill / OpenCode Agent / OpenClaw Skill / Hermes Skill) need zero changes to inherit the contract.

The wrapper's job is: take user text → format a native `minimax-media_*` (or `brave_*` / `chrome-*`) call → attach the envelope from §1.1 → invoke → translate envelope + verdict back to user surface.

Trust plane is at the **wire**, not at the **wrapper**.

---

## 6. Evidence labeling summary

| Section | Label | Reason |
|---|---|---|
| 1.x census tables | **OBS** | direct read of live tool surface + deprecation-registry |
| 2 shapes | **DER** | taxonomic abstraction from OBS |
| 3 gaps | **DER** | gap inference from observed call signatures |
| 4 inputs | **SPEC** | requirements for §1, not yet implemented |
| 5 absorption | **INT** | interpretive claim about cross-ecosystem consequence |

---

## 7. Next step

**PROPOSAL — DO NOT EXECUTE §1 UNTIL ARIF RATIFIES THIS INVENTORY**

| Choice | Action |
|---|---|
| **A** | Ratify inventory as-is. FORGE drafts §1 CONTRACT sized to the 6 shapes above (sealed at `arifOS/CONTRACTS/MULTIMODAL-v1.md`, symlinked into A-FORGE). |
| **B** | Add/remove/rename inventory entries before §1. |
| **C** | Different layering — §1 territory first (e.g. wire envelope only), shapes later. |

F13 KEKAL. Physics first.
