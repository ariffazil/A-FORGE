# FORGE PRESCRIPTION — Agentic Deep Research Pipeline for arifOS
**Verdict:** SABAR — Named gaps identified, specific fixes required before SEAL
**Date:** 2026-06-27
**Author:** FORGE (A-FORGE) — 666_JUDGE review complete
**Status:** DRAFT — requires 888_JUDGE + Arif ratification
**Evidence basis:** arifOS runtime/explore.py (2530L), deep-research SKILL (124L), Anthropic eng blog, Awesome-Deep-Research survey, A-FORGE src/

---

## TAKEAWAY (Answer First)

**arifOS has the right substrate. The wiring is missing.**

`arif_explore` (2530 lines, 8 modes, PROSPECTOR+NAVIGATOR+SURVEYOR+EUREKA implemented) +
`deep-research SKILL` (124 lines, 6-phase loop) +
A-FORGE forge_* tools + arifOS 888_JUDGE + VAULT999

**= raw material for true agentic deep research**

What's missing is the **orchestration layer** that binds them into a governed pipeline with:
- Organ attestation (GEOX/WEALTH/WELL each signing off on their domain)
- Malaysia/ASEAN primary sources wired in
- Replay receipts at every step
- Effort scaling (Anthropic: simple=3-10 calls, complex=10+ parallel subagents)
- VAULT999 seal at saturation

ChatGPT Deep Research is a librarian. arifOS should build a **research institute**.

---

## 1. EXISTING SURFACE — What We Have

### 1.1 arifOS `arif_explore` (runtime/explore.py)

```
2530 lines | 8 modes | State machine: INIT→PLAN→STEP→UPDATE→CHECK→REFLECT→SEAL
Risk tier: LOW | Irreversible: FALSE | F2/F4/F7/F9 gated
```

| Mode | Status | What it does |
|------|--------|--------------|
| **PROSPECTOR** | ✅ IMPLEMENTED | Filesystem/codebase traversal — uses Bash, Read, Glob, Git |
| **NAVIGATOR** | ✅ IMPLEMENTED | Web traversal — delegates to arif_fetch (URL) or arif_observe (query) |
| **SURVEYOR** | ✅ IMPLEMENTED | Cross-organ signal fusion — queries GEOX + WELL + WEALTH simultaneously |
| **EUREKA** | ✅ IMPLEMENTED | Evolutionary LDEA loop — orchestrates Navigator+Prospector+Surveyor in Learn→Discover→Evaluate→Adapt cycles |
| **DRILLER** | ❌ PENDING | API surface discovery |
| **MAPPER** | ❌ PENDING | Knowledge graph traversal |
| **SCOUT** | ❌ PENDING | Recursive meta-explorer |
| **AUTO** | ✅ AUTO-SELECT | Mode selected from seed shape |

**Key design features already present:**
- ExplorationGraph with nodes + edges + content_hash
- Saturation detection (3 dry cycles, adaptive threshold for multi-domain)
- Novelty scoring (hash deduplication + term diversity + source diversity)
- Cross-domain link detection
- Budget enforcement (max_depth, max_steps, time_budget)
- StepResult with coverage_delta + confidence + terminal flag

### 1.2 deep-research SKILL (/.openclaw/workspace/forge_work/deep-research/SKILL.md)

```
124 lines | 6-phase loop | F2/F3/F4/F7/F12 compliant
```

```
INTAKE → SEARCH → FETCH → VERIFY → SYNTHESIZE → CITE
```

**Already has:**
- Evidence threshold logic (1 source, 3 sources, primary only)
- F12 injection defense (untrusted-content boundary)
- Structured output format with confidence bands
- Anti-pattern list
- Subagent spawning strategy (kimi for synthesis phase)

### 1.3 A-FORGE Search Tools (src/infrastructure/tools/SearchTools.ts)

- `grep_text` — ripgrep over working directory (filesystem search)
- Also has: Brave Search MCP, Perplexity MCP, context7 (library docs)

### 1.4 arifOS Organ MCP Tools

| Organ | Relevant Tools |
|-------|---------------|
| GEOX | `geox_geox_evidence`, `geox_geox_prospect`, `geox_geox_basin` |
| WEALTH | `wealth_wealth_omni_wisdom`, `wealth_wealth_fiscal_breakeven`, `wealth_wealth_stock_analysis` |
| WELL | `well_well_assess_homeostasis`, `well_well_validate_vitality`, `well_well_guard_dignity` |
| arifOS | `arif_observe` (web search + repo atlas), `arif_fetch` (verified fetch), `arif_think` (reasoning), `arif_critique`, `arif_judge`, `arif_seal` |

---

## 2. EXTERNAL EUREKA INSIGHTS

### 2.1 Anthropic Engineering — What They Learned

Source: [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) (Jun 2025)

| Pattern | arifOS gap | Required fix |
|---------|-----------|-------------|
| **Orchestrator-worker** (lead agent decomposes → parallel subagents) | arifOS has EUREKA mode but no explicit effort-scaling rules | Add effort tier: TRIVIAL/FACTUAL/COMPARATIVE/DEEP (see §3.3) |
| **Token budget = primary performance lever** | No token budget enforcement in deep-research SKILL | Add session budget tracking |
| **Start wide → narrow** | deep-research SKILL starts with 3-5 query variations but no iterative narrowing | Add query refinement loop |
| **Parallel subagents** | deep-research SKILL spawns kimi for synthesis but no parallel search subagents | Wire arif_explore [navigator] parallel dispatch |
| **Subagent → filesystem artifact** (not just chat) | Findings stay in memory, no intermediate artifact | Each subagent writes to forge_work/ artifact, passes reference |
| **Saturation detection** | EUREKA has dry-cycle detection but not explicitly tied to novelty threshold | Calibrate against Anthropic's "3 dry cycles = done" |
| **Source quality heuristics** | deep-research SKILL prefers "official > community > aggregator" but no domain-specific priority | Malaysia/ASEAN source priority list (§4.2) |
| **Tool description as first-class engineering** | MCP tool descriptions in registry are functional but not optimized | Rewrite key tool descriptions following Anthropic's "each tool = distinct purpose + clear description" |
| **Context truncation → memory checkpoint** | No checkpoint/save mechanism when context exceeds threshold | Add context checkpoint before truncation |

### 2.2 Best Open-Source Implementations

| Framework | Stars | Key insight for arifOS |
|----------|-------|----------------------|
| **gpt-researcher** | 22.8k | Full async research agent — good artifact architecture reference |
| **DeerFlow** (ByteDance) | 9.4k | Report → script → execution loop — structured handoff pattern |
| **deep-research (Aomni)** | 2.6k | Clean minimal implementation — good for stripping down |
| **CORAL** (2026, ACL) | — | Multi-agent evolution with heartbeat-guided search — most advanced |
| **Dr. Zero** (Meta, 2026) | — | Self-evolving without training data — relevant for autonomous mode |
| **Enterprise Deep Research** (Salesforce) | — | Controllable, steerable multi-agent for enterprise — governance model |

### 2.3 Key Architectural Patterns

1. **Artifact-first subagents**: Subagents write to filesystem, pass references. Not "game of telephone" through context.
2. **Effort-tier classification**: Query complexity determines subagent count and call budget.
3. **Source quality hierarchy**: Primary (official docs, API) > Secondary (community) > Tertiary (aggregator).
4. **Parallelization at two levels**: Lead spawns 3-5 subagents in parallel; each subagent uses 3+ tools in parallel.
5. **Context checkpoint before truncation**: Save plan to memory at ~100K tokens before context limit.
6. **Saturation = 3 consecutive dry cycles** with no novel findings.

---

## 3. THE PIPELINE — How It Should Work

### 3.1 Full Loop (000 → 999)

```
Arif intent: "deep research on [question]"
    │
    ▼
000 INIT ───────────────────────────────────────────────
    Bind constitutional session
    Verify organ health (arifos, aforge, geox, wealth, well)
    Load deep-research SKILL
    Load arif_explore [AUTO]
    │
    ▼
111 OBSERVE (arif_explore [AUTO]) ─────────────────────
    Classify question into mode: TRIVIAL / FACTUAL / COMPARATIVE / DEEP
    If CODEBASE → PROSPECTOR
    If WEB + single source → NAVIGATOR
    If CROSS-ORGAN question → SURVEYOR
    If OPEN-ENDED / multi-domain → EUREKA
    │
    ▼
222 FETCH (deep-research SKILL phase 2-3) ─────────────
    Execute search with effort tier:
      TRIVIAL: 1 subagent, 3-10 calls
      FACTUAL: 1-2 subagents, 10-15 calls
      COMPARATIVE: 2-4 subagents, 10-15 calls each
      DEEP: 5+ subagents, 20+ calls each
    Primary sources: BNM, DOSM, Bursa Malaysia, etc. (see §4.2)
    F12 boundary on all web content
    │
    ▼
333 REASON (deep-research SKILL phase 4) ─────────────
    Cross-verify claims between ≥2 sources
    Flag contradictions explicitly
    Compute confidence bands: HIGH >0.9 / MEDIUM 0.7-0.9 / LOW <0.7
    arif_think for multi-hypothesis reasoning
    │
    ▼
444 COMPOSE (deep-research SKILL phase 5) ─────────────
    Structured synthesis:
      - Direct answer (2-3 sentences)
      - Evidence with inline citations
      - Contradictions/gaps
      - Confidence by claim
    Each subagent writes to forge_work/ artifact
    Lead agent reads artifacts (not context)
    │
    ▼
555 ATTEST (organ attestation) ─────────────────────────
    GEOX domain claims → geox_geox_evidence (synthesize)
      "Verify these geological/geophysical claims against your evidence base"
    WEALTH domain claims → wealth_wealth_omni_wisdom (synthesize)
      "Verify these capital/value claims against your computation models"
    WELL domain claims → well_well_assess_homeostasis (reflect)
      "Reflect: does this proposal respect human vitality and dignity?"
    Each organ returns: ATTESTED / CONTESTED / OUT_OF_SCOPE
    │
    ▼
666 CRITIQUE (arif_critique) ─────────────────────────
    Consequence assessment:
      - Dignity impact on weakest stakeholder
      - Malaysia/ASEAN-first alignment
      - Gödel-lock compliance (no self-authorization)
    C_dark check: C_dark < 0.30 → pass, else HOLD
    │
    ▼
777 MEASURE (arif_measure) ───────────────────────────
    Token budget check
    Coverage assessment
    Replay receipt generation
    forge_work/ artifact finalized
    │
    ▼
888 JUDGE (arif_judge) ───────────────────────────────
    Verdict: SEAL / SABAR / HOLD
    If SABAR: named floors that fail + actionable fixes
    If HOLD: escalate to Arif
    If SEAL: proceed to VAULT
    │
    ▼
999 SEAL (arif_seal → VAULT999) ──────────────────────
    Immutable artifact with:
      - exploration_graph (nodes + edges + content_hash)
      - findings with confidence + sources
      - organ_attestation receipts
      - C_dark score
      - effort tier used
      - Malaysia/ASEAN source priority log
      - replay receipt (trace_id, steps, gaps)
```

### 3.2 Effort Tier Classification

```python
def classify_effort(question: str) -> EffortTier:
    """
    TRIVIAL:    Direct factual lookup — "What is BNM's OPR today?"
    FACTUAL:    Single-topic deep dive — "Explain Malaysia's inflation mechanism"
    COMPARATIVE: Multi-entity comparison — "Compare PETRONAS vs Exxon valuation"
    DEEP:       Open-ended multi-domain — "Federation Intelligence Elevation"
    """
    multi_entity = len([w for w in ["vs","versus","compare","difference"] if w in question.lower()])
    open_ended = len([w for w in ["why","how","what if","impact","strategy"] if w in question.lower()])
    depth = len([w for w in ["deep","thorough","comprehensive","research"] if w in question.lower()])

    score = multi_entity * 2 + open_ended + depth
    if score == 0: return "TRIVIAL"
    elif score <= 2: return "FACTUAL"
    elif score <= 4: return "COMPARATIVE"
    else: return "DEEP"
```

| Tier | Subagents | Calls each | Saturation |
|------|-----------|------------|------------|
| TRIVIAL | 1 | 3-10 | 3 dry cycles |
| FACTUAL | 1-2 | 10-15 | 5 dry cycles |
| COMPARATIVE | 2-4 | 10-15 | 7 dry cycles |
| DEEP | 5+ | 20+ | 10 dry cycles |

### 3.3 Subagent Spawning (A-FORGE)

```typescript
// Each subagent writes to forge_work/deep-research/{trace_id}/{subagent_id}.md
// Lead agent reads artifacts, not context
interface ResearchSubagent {
  id: string;
  objective: string;          // e.g. "Gather PETRONAS revenue data from BNM"
  output_format: string;       // e.g. "structured_findings"
  sources: string[];           // Priority-ordered source list
  tools: string[];             // Which arif_explore modes + MCP tools
  artifact_path: string;       // Where to write findings
  effort_tier: EffortTier;
}
```

---

## 4. MISSING COMPONENTS — The Gaps

### 4.1 Critical Gaps (Block SEAL)

| Gap | Severity | Description |
|-----|----------|-------------|
| **arif_explore [DRILLER] not implemented** | CRITICAL | API surface discovery — cannot auto-probe BNM API, DOSM bulk download, Bursa Malaysia feed |
| **arif_explore [MAPPER] not implemented** | HIGH | Knowledge graph traversal — cannot link research findings to federation ontology |
| **Malaysia/ASEAN sources not wired** | HIGH | BNM API, DOSM, Bursa Malaysia, Suruhanjaya Tenaga, DOE/JAS, PETRONAS annual report, AMRO, ASEANStats — none in search pipeline |
| **No effort-tier enforcement** | HIGH | deep-research SKILL has no call budget or subagent scaling |
| **Organ attestation not in loop** | HIGH | §555 in pipeline has no formal implementation — geox_*/wealth_*/well_* called ad-hoc |
| **No replay receipts** | MEDIUM | No trace_id → artifact_path → findings → attestation → seal chain |
| **No context checkpoint** | MEDIUM | Anthropic: save plan at ~100K tokens before truncation |

### 4.2 Medium Gaps (Reduce SABAR score)

| Gap | Description |
|-----|-------------|
| **NAVIGATOR: arif_fetch dependency** | Navigator delegates to arif_fetch — need to verify arif_fetch handles Malaysian government SSL certificates |
| **No citation agent** | Anthropic uses explicit CitationAgent — arifOS has no equivalent |
| **deep-research SKILL not registered in TOOLREGISTRY.json** | Skill exists but not formally in skill registry |
| **No eval harness** | Anthropic: 20-query eval set, LLM-as-judge, human spot-check |
| **SURVEYOR: organ bridges untested** | geox_query, well_query, wealth_query — not verified live |

---

## 5. PRIORITY FORGE ORDER

### Phase 1 — Wire What Exists (No new tools)

```
1. Wire deep-research SKILL → arif_explore [EUREKA]
   The SKILL already has 6 phases. arif_explore already has EUREKA.
   Connect: SKILL's SEARCH → EUREKA dispatch. SKILL's CITE → EUREKA verdict.

2. Register deep-research SKILL in TOOLREGISTRY.json
   Add to skill registry with F2/F4/F7/F12 compliance tags

3. Add effort tier to arif_explore [AUTO] mode
   Extend _classify_question to return EffortTier

4. Wire Malaysia/ASEAN source priority
   In arif_explore [NAVIGATOR]: add BNM, DOSM, Bursa Malaysia, etc. as first-class seed URLs
   This is a config change, not a code change.
```

### Phase 2 — Complete the Modes (3-5 days)

```
5. Implement arif_explore [DRILLER] — API surface discovery
   Template: NavigatorMode but instead of URL fetch → OpenAPI probe
   BNM API: https://api.bnm.gov.my/ (documented, has API key)
   DOSM: https://www.dosm.gov.my/ (bulk download CSV)
   Bursa Malaysia: https://www.bursamalaysia.com/ (corporate filings)
   Tool: httpx or requests under sandbox

6. Implement arif_explore [MAPPER] — Knowledge graph traversal
   Connect to Qdrant (vector search) or existing knowledge graph
   Map findings to federation ontology (organ, floor, signal)

7. Implement arif_explore [SCOUT] — Recursive meta-explorer
   Uses EUREKA as sub-mode. Scouting for new exploration strategies.
```

### Phase 3 — Governance Hardening (2-3 days)

```
8. Add formal organ attestation at §555
   Implement: research_verdict = geox_geox_evidence(mode="synthesize", ...)
   Returns ATTESTED/CONTESTED with confidence and citations

9. Add replay receipt schema
   Extend ExploreResponse to include:
     - trace_id
     - artifact_paths: list of subagent artifact files
     - organ_attestation_receipts
     - C_dark score
     - effort_tier

10. Add context checkpoint
    Before EUREKA step ~50: checkpoint exploration_graph to forge_work/
    On resume: reload from checkpoint

11. Add eval harness
    20 query benchmark (Arif-curated, Malaysian/ASEAN focused)
    LLM-as-judge scoring rubric
```

### Phase 4 — Production Hardening (1-2 days)

```
12. Rainbow deployment support (Anthropic pattern)
    EUREKA updates deploy without disrupting running research sessions

13. Effort-tier observability
    Prometheus metrics: active_subagents, calls_per_tier, novel_findings_per_cycle

14. Token budget tracking
    Per-session token counter with auto-HOLD at threshold
```

---

## 6. MALAYSIA/ASEAN SOURCE PRIORITY LIST

```
TIER A — Primary (must exhaust before Tier B)
────────────────────────────────────────────────
1. BNM API          https://api.bnm.gov.my/
   - OPR, inflation, FX, monetary stats
   - API key required (free tier available)

2. DOSM (Dept of Statistics Malaysia)
   https://www.dosm.gov.my/
   - GDP, CPI, trade, labour force
   - Bulk CSV/JSON download

3. Bursa Malaysia
   https://www.bursamalaysia.com/
   - Corporate filings, stock data, annual reports

4. Suruhanjaya Tenaga / Energy Commission
   https://www.meih.st.gov.my/
   - Malaysia energy data, generation, demand

5. DOE Malaysia / JAS
   https://www.doe.gov.my/
   - Environmental data

6. PETRONAS Annual Report
   https://www.petronas.com/investors/annual-reports
   - Revenue, production, reserves

7. AMRO (ASEAN+3 Macro Research)
   https://www.amro-asia.org/
   - Regional economic surveillance

8. ASEANStats
   https://www.aseanstats.org/
   - ASEAN macro data, trade, demographics

TIER B — Secondary (for claims not covered by Tier A)
────────────────────────────────────────────────────
9. Bank Negara Malaysia publications (PDF reports)
10. MIER (Malaysian Institute of Economic Research)
11. Khazanah Research
12. MARC Ratings
13. Securities Commission Malaysia

TIER C — Global fallback (only if Tier A+B exhausted)
─────────────────────────────────────────────────────
14. World Bank Open Data
15. IMF Data
16. UNData / UNSD
17. Our World in Data (ASEAN subset)
```

---

## 7. ARCHITECTURE — Artifact Flow

```
deep-research SKILL [lead orchestrator]
    │
    ├──→ arif_explore [PROSPECTOR] ─→ forge_work/{trace_id}/codebase.md
    ├──→ arif_explore [NAVIGATOR] ─→ forge_work/{trace_id}/web.md
    ├──→ arif_explore [DRILLER] ─→ forge_work/{trace_id}/apis.md
    ├──→ arif_explore [SURVEYOR] ─→ forge_work/{trace_id}/organ_signals.md
    │
    ▼ (all artifacts written before synthesis)
deep-research SKILL [synthesis phase]
    │
    ▼
forge_work/{trace_id}/synthesis.md (lead reads artifacts, NOT context)
    │
    ▼
organ attestation (GEOX / WEALTH / WELL)
    │
    ▼
forge_work/{trace_id}/attestation.md
    │
    ▼
arif_critique (consequence assessment)
    │
    ▼
arif_judge (verdict)
    │
    ▼
VAULT999 sealed artifact
```

---

## 8. CONCRETE TODOS (FORGE-READY)

```
[ ] Wire deep-research SKILL → arif_explore EUREKA loop
    File: /root/.agents/skills/deep-research/SKILL.md (updated)
    Test: "Federation Intelligence Elevation" → 5-phase EUREKA run

[ ] Add BNM API + DOSM to arif_explore [NAVIGATOR] seed list
    File: /root/arifOS/arifosmcp/runtime/explore.py (NAVIGATOR seed override)
    Test: "What is Malaysia's current OPR?" → BNM API source first

[ ] Implement arif_explore [DRILLER]
    File: /root/arifOS/arifosmcp/runtime/explore.py (DrillerMode class)
    Test: "Discover available BNM API endpoints" → list endpoints + sample data

[ ] Implement arif_explore [MAPPER]
    File: /root/arifOS/arifosmcp/runtime/explore.py (MapperMode class)
    Test: "Map all WEALTH tools to capital primitives" → tool→concept graph

[ ] Add organ attestation formalization at §555
    Files: geox_geox_evidence + wealth_wealth_omni_wisdom + well_well_assess_homeostasis
    Test: "PETRONAS collapse risk" → all 3 organs respond with attestation

[ ] Add replay receipt to ExploreResponse
    File: /root/arifOS/arifosmcp/schemas/explore.py
    Schema: trace_id, artifact_paths, attestation_receipts, C_dark, effort_tier

[ ] Add eval harness (20-query benchmark)
    File: /root/AAA/eval/deep_research_benchmark.py
    Queries: Malaysian/ASEAN specific, ground truth verifiable
```

---

## 9. WHY CHATGPT DEEP RESEARCH FAILS THE CONSTITUTION

| ChatGPT | arifOS Agentic |
|---------|----------------|
| No organ attestation | GEOX/WEALTH/WELL each sign off |
| No Malaysia/ASEAN priority | BNM/DOSM/Bursa as Tier A sources |
| Stateless session | Replay receipts + VAULT999 seal |
| No Gödel-lock | Agents cannot self-authorize capability expansion |
| No blast radius | Every research has explicit scope + reversibility |
| No 888_JUDGE | SEAL/SABAR/HOLD before artifact is accepted |
| US-centric defaults | Malaysia-first + ASEAN data sovereignty |
| "Find and summarize" | Perceive → evaluate → act → update → seal |

---

## 10. SESSION STATE

```
current_verdict: SABAR
verdict_history: ["arifOS-bypass-HOLD-2026-06-27", "agentic-deep-research-SABAR-2026-06-27"]
floor_scores: {f1:0.4, f2:0.5, f3:0.4, f4:0.6, f5:0.5, f6:0.5, f7:0.5, f8:0.5, f9:0.4, f10:0.5, f11:0.4, f12:0.4, f13:0.6}
overall_score: 0.48
stage: FORGE (prescription complete)
next: 888_JUDGE ratification required
```

**Named floors failing (SABAR triggers):**
- F1 AMANAH (replay receipts missing — partial only)
- F2 TRUTH (Malaysia/ASEAN primary sources not wired — evidence chain incomplete)
- F3 WITNESS (organ attestation not formalized)
- F9 ANTIHANTU (C_dark check not in deep-research SKILL loop)
- F11 AUTH (no formal identity chain for research sessions)

**Fix required before SEAL:** Implement §8 TODOs 1-6 (Phases 1-2).

---

*DITEMPA BUKAN DIBERI — Forge is ready. Sabar until 888 ratifies.*
*Evidence: arifOS/runtime/explore.py (2530L) + deep-research SKILL (124L) + Anthropic eng blog + Awesome-Deep-Research survey*
