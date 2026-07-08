# 🔥 FORGE_FETCH · Comparison & Eureka Capabilities

> **Date:** 2026-07-07
> **Actor:** FORGE (000Ω)
> **Sovereign:** Arif (F13)
> **Status:** DER/INT — analysis of 3 fetch tool implementations + A-FORGE eureka extraction

---

## 1. forge_fetch — Current A-FORGE Implementation

**Location:** `src/interfaces/mcp/proxyTools.ts:447`
**Language:** TypeScript (in-process)
**Risk:** R0 (read-only, no mutations)

| Capability | Status |
|---|---|
| Modes | html, markdown, text, json, readable |
| Content extraction | Regex-based HTML stripping (script/style/nav/header/footer) |
| Max chars | 50,000 default |
| Timeout | 15s default |
| robots.txt | ❌ Not checked |
| JS rendering | ❌ Static fetch only |
| Chunking/pagination | ❌ No start_index support |
| User-Agent | A-FORGE/1.0 |
| Readability | Regex strip only (not Mozilla Readability) |
| Proxy support | ❌ |
| Content-type detection | Basic (html vs non-html) |

**Strengths:** Zero-overhead, in-process (no subprocess), 5 modes, governed by A-FORGE MCP ingress.
**Weaknesses:** Primitive HTML extraction, no chunking, no robots.txt, no JS rendering, regex-based cleaning loses structure.

---

## 2. MCP Fetch Server (Official — modelcontextprotocol/servers)

**Location:** `src/fetch/` in modelcontextprotocol/servers
**Language:** Python (standalone subprocess)
**Stars:** Reference implementation (official MCP)

| Capability | Status |
|---|---|
| Modes | markdown (default), raw |
| Content extraction | **Mozilla Readability** (`readabilipy`) + `markdownify` |
| Max chars | 5,000 default (configurable) |
| Timeout | 30s |
| robots.txt | ✅ Checked (Protego parser, autonomous vs manual user-agent) |
| JS rendering | ❌ Static fetch only |
| Chunking/pagination | ✅ `start_index` parameter for reading long pages in chunks |
| User-Agent | Dual: autonomous vs manual (differentiated) |
| Readability | ✅ Proper Readability extraction |
| Proxy support | ✅ `--proxy-url` config |
| Content-type detection | ✅ HTML vs non-HTML |
| Prompt integration | ✅ Has prompt tool for user-initiated fetches |
| Security | CAUTION: can access local/internal IPs |

**Eureka features for A-FORGE embedding:**
1. **Chunked reading** (`start_index` + `max_length`) — critical for long pages
2. **Proper Readability extraction** — `readabilipy` + `markdownify` vs regex
3. **robots.txt compliance** — ethical crawling distinction (autonomous vs manual)
4. **Dual User-Agent** — autonomous vs user-initiated differentiation
5. **Proxy support** — enterprise/geo-restricted content access

---

## 3. Agentic Tools MCP (Pimzino/agentic-tools-mcp)

**Location:** `@pimzino/agentic-tools-mcp` (npm)
**Language:** TypeScript
**Stars:** 87
**Focus:** Task management + Agent memories (NOT fetch)

| Feature | Tools | A-FORGE Equivalent | Gap |
|---|---|---|---|
| **Project CRUD** | list/create/get/update/delete_project | forge_job (partial) | Project isolation |
| **Unlimited task hierarchy** | create/list/get/update/delete/move_task | todowrite (flat) | Hierarchy |
| **PRD parsing** | parse_prd → auto-generate tasks | ❌ None | **EUREKA** |
| **Task recommendation** | get_next_task_recommendation | ❌ None | **EUREKA** |
| **Complexity analysis** | analyze_task_complexity | ❌ None | **EUREKA** |
| **Progress inference** | infer_progress | forge_status (partial) | Gap |
| **Research queries** | generate_research_queries | forge_research (manual) | Gap |
| **Agent memories** | create/search/get/list/update/delete_memory | forge_memory + forge_skillstore | Overlap |
| **Memory search** | Multi-field text search with relevance scoring | forge_memory (basic) | **EUREKA** |
| **PRD → Task DAG** | Parse requirements → structured task graph | ❌ None | **EUREKA** |

---

## 4. Eureka Capabilities — What to Embed

### EUREKA-1: Chunked Page Reading (from MCP Fetch Server)

**Impact:** HIGH — long pages currently truncated silently.
**Implementation:** Add `start_index` parameter to `forge_fetch`.

```typescript
// Current: hard truncation at max_chars
// Proposed: chunked reading
inputSchema: z.object({
  url: z.string().url(),
  mode: z.enum(["html", "markdown", "text", "json", "readable"]).default("readable"),
  max_chars: z.number().default(50000),
  start_index: z.number().default(0).describe("Start reading from this character index"),
  timeout_ms: z.number().default(15000),
})
```

**Diff:** ~5 lines change in `proxyTools.ts`

### EUREKA-2: Proper Readability Extraction (from MCP Fetch Server)

**Impact:** HIGH — regex stripping loses headings, lists, tables, code blocks.
**Implementation:** Replace regex with `@mozilla/readability` + `turndown` (JS equivalent of readabilipy + markdownify).

```typescript
// Current: regex-based strip
// Proposed: Readability + Turndown
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';

const dom = new JSDOM(raw);
const reader = new Readability(dom.window.document);
const article = reader.parse();
const markdown = new TurndownService().turndown(article?.content || '');
```

**Diff:** Add 2 deps (`@mozilla/readability`, `turndown`), replace 15 lines of regex with 5 lines of proper extraction.

### EUREKA-3: PRD → Task DAG Parser (from Agentic Tools MCP)

**Impact:** MEDIUM — currently manual task decomposition.
**Implementation:** New `forge_parse_prd` tool that takes a PRD document and outputs a structured task graph with dependencies.

**Routing:** `forge_parse_prd` → PRD text → LLM extraction → task nodes with parentId/dependencies/priority/complexity → forge_job graph.

**Floor alignment:**
- F2 TRUTH: LLM-extracted tasks are INTERPRETED, not OBSERVED
- F8 GENIUS: Output is a DAG, not a flat list
- F11 AUDIT: Each task node has provenance (which PRD section)

### EUREKA-4: Intelligent Task Recommendation (from Agentic Tools MCP)

**Impact:** MEDIUM — currently agents must manually choose next task.
**Implementation:** New `forge_next_task` that analyzes the task graph and recommends the next action based on:
- Dependency completion
- Priority ranking
- Complexity vs available time
- Blocked task detection

**Routing:** forge_job (task store) → `forge_next_task` → ranked recommendation.

### EUREKA-5: Relevance-Scored Memory Search (from Agentic Tools MCP)

**Impact:** MEDIUM — forge_memory search is basic keyword match.
**Implementation:** Enhance `forge_memory` search with weighted scoring:
- Title matches: 60% weight
- Content matches: 30% weight
- Category/tag bonus: 20% weight

**Diff:** Modify `forge_memory` recall mode, ~20 lines scoring logic.

### EUREKA-6: robots.txt Compliance (from MCP Fetch Server)

**Impact:** LOW-MEDIUM — ethical crawling for autonomous agents.
**Implementation:** Add optional robots.txt check before fetch. Two modes:
- `autonomous` (default): check robots.txt, HOLD if blocked
- `manual`: skip robots.txt (user-initiated)

**Floor alignment:** F5 PEACE (respect web norms), F12 INJECTION (external ≠ authority).

---

## 5. Survival of the Fittest — A-FORGE Tool Refactor Candidates

### Tier 1: WEAK — Replace or Kill

| Tool | Why Weak | Replacement |
|---|---|---|
| `forge_fetch` | Regex-based extraction, no chunking, no robots.txt | EUREKA-1 + EUREKA-2 (proper Readability + chunking) |
| `forge_systemctl` | Already deprecated, duplicates `forge_shell('systemctl ...')` | Remove, keep `forge_shell` |
| `forge_research` | Manual wrapper, no intelligence | Enhance with Agentic Tools' research query generation |

### Tier 2: OVERLAPPING — Consolidate

| Tools | Overlap | Action |
|---|---|---|
| `forge_memory` + `forge_skillstore_read/write` | Both store/retrieve artifacts | Merge into unified `forge_memory` with relevance scoring (EUREKA-5) |
| `forge_github` + `forge_github_*` (6 tools) | forge_github is generic, others are specific | Keep forge_github as router, consolidate 6 specific tools |
| `forge_browser_*` (6 tools) | All browser ops | Already consolidated pattern — keep, but add EUREKA-1 chunking to browser_extract_text |

### Tier 3: STRONG — Keep & Harden

| Tool | Why Strong | Harden |
|---|---|---|
| `forge_shell` | Core execution primitive | Already hardened with ArifJudge + ArifSeal |
| `forge_dry_run` | F1 AMANAH core | Keep |
| `forge_execute` | Core execution | Keep, add shadow gate |
| `forge_pipeline_run` | Multi-organ orchestration | Keep |
| `forge_reality_loop` | Universal improvement engine | Keep, mature |
| `forge_evaluate` | APEX gate | Keep |
| `forge_scar` | Scar metabolization | Keep |
| `forge_witness` | Tri-witness gate | Keep |

### Tier 4: MISSING — Build New

| Capability | Source | A-FORGE Tool Name | Priority |
|---|---|---|---|
| PRD → Task DAG | Agentic Tools MCP | `forge_parse_prd` | MEDIUM |
| Task recommendation | Agentic Tools MCP | `forge_next_task` | MEDIUM |
| Complexity analysis | Agentic Tools MCP | `forge_complexity` | LOW |
| Chunked fetch | MCP Fetch Server | Enhance `forge_fetch` | HIGH |
| Readability extraction | MCP Fetch Server | Enhance `forge_fetch` | HIGH |

---

## 6. Action Items

| # | Action | Tier | Blast | Reversibility |
|---|---|---|---|---|
| 1 | Add `start_index` to `forge_fetch` | T1 | LOW | FULL |
| 2 | Replace regex with Readability+Turndown | T1 | LOW | FULL |
| 3 | Add robots.txt optional check | T2 | LOW | FULL |
| 4 | Remove deprecated `forge_systemctl` | T1 | LOW | FULL |
| 5 | Enhance `forge_memory` with relevance scoring | T2 | MEDIUM | FULL |
| 6 | New `forge_parse_prd` tool | T3 | MEDIUM | FULL |
| 7 | New `forge_next_task` recommendation | T3 | MEDIUM | FULL |
| 8 | Consolidate `forge_github_*` tools | T2 | MEDIUM | PARTIAL |

**All actions are T1/T2 — no 888_HOLD required. All reversible.**

---

## 7. ROUTING (Compile-Into-Runtime)

```
forge_fetch weakness → Execution (organ) → bad content extraction → replace regex → content_quality telemetry
PRD gap → Execution (organ) → manual task decomposition → add forge_parse_prd → prd_parsed telemetry
memory search gap → Memory (organ) → basic keyword match → add relevance scoring → search_precision telemetry
```

---

*Forged: 2026-07-07 by FORGE (000Ω)*
*DITEMPA BUKAN DIBERI*
