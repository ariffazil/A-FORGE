# AAA INIT PROMPT — Document Intelligence Skill Forge

> **RSI Task: forge-document-intelligence skill**
> **Session origin:** SEAL-76129e84d1e6415c (FORGE GLM-5.2 analysis)
> **Date:** 2026-07-02
> **Priority:** P1 (meta-mesa gap — entirely missing domain)
> **Authority:** C2 (Execute after floor check)
> **Gödel lock:** Session analysis sealed to forge_work/, not VAULT999 (strange loop blocked self-seal). External evidence available on request.

---

## YOUR MISSION

You are OpenCode, Arif's governed forge worker. Your task is to **forge a new skill** called `forge-document-intelligence` that wraps the EMD (Encode-Metabolize-Decode) document intelligence stack as a first-class federation capability.

**Why:** "OCR tesseract is basic rights for AAA citizens." Document reading is a fundamental capability, not a specialty tool. The federation has `forge_document_ingest` (the metabolism layer) but no VLM perception backend and no skill wrapping the full stack. This skill makes document intelligence available to every AAA citizen agent.

**What you are building:** A skill at `/root/.agents/skills/forge-document-intelligence/SKILL.md` that encodes:
1. The 3-layer architecture (Perception → Provenance → Purpose)
2. The EMD stack pipeline
3. The visual re-grounding protocol (the critical anti-hallucination mechanism)
4. 888_HOLD gate placement
5. Malaysian document risk patterns
6. Domain routing rules
7. Cost-aware extraction strategy

---

## FULL CONTEXT (Read Before Acting)

### The Problem

The world's knowledge is trapped in PDFs. RAG systems ingest these PDFs, but if OCR is bad, the AI is wrong before retrieval starts. Three OCR paradigms exist:

| Paradigm | Tool | What It Does | Limitation |
|----------|------|-------------|------------|
| Legacy OCR | Tesseract | Pixel → character match | No layout understanding, tables break, reading order wrong |
| LLM OCR | olmOCR (Allen AI) | VLM "sees" page → Markdown | No provenance, no governance, no self-verification |
| Agentic OCR | LandingAI ADE, LlamaIndex | Goal-oriented extraction with self-correction | No constitutional governance, no VAULT999 |

### The Insight

These are NOT competing tools. They are **three layers of one stack**, each reducing a different type of entropy:

1. **Perception** (olmOCR/VLM) — reduces LAYOUT entropy (tables, columns, reading order)
2. **Provenance** (`forge_document_ingest`) — reduces TRUST entropy (where did this come from? can I verify?)
3. **Purpose** (Constitutional pipeline) — reduces SEMANTIC entropy (why am I reading this? what does it mean?)

### The Error Propagation Problem (CRITICAL)

```
VLM extracts: "Total: RM 1,250,000"   (original said 12,500,000 — missed a digit)
    ↓ Markdown looks clean
Agentic layer trusts it: confidence=HIGH
    ↓
WEALTH computes NPV on wrong number
    ↓
VAULT999 seals wrong number with high confidence
```

**Clean-looking OCR with subtle errors is MORE dangerous than obviously bad OCR** — because the governance pipeline trusts structured output.

### The Fix: Visual Re-Grounding

The Agentic layer must re-verify against the **original page image via bbox coordinates**, NOT against the intermediate Markdown.

- Markdown = convenience view
- bbox + original page image = evidence
- `forge_document_ingest` already stores bbox per element — this is the anchor

### The EMD Stack

```
┌──────────────────────────────────────────────────────┐
│  LAYER 1: PERCEPTION (Ingestion Boundary)            │
│  ────────────────────────────────────────────────    │
│  Input: PDF/PNG/JPEG                                 │
│  Engine: Qwen2.5-VL via Bailian API (no GPU needed)  │
│  Output: Markdown + page images (PRESERVED)          │
│  Consumer: GEOX, WEALTH, WELL, AAA                   │
│  Floor: F2 TRUTH (label as OBS, confidence <0.90)    │
│  Cost: ~$0.02/page via Bailian                       │
│  NOTE: af-forge has NO GPU. Use remote API, not      │
│        local olmOCR deployment.                      │
└──────────────────┬───────────────────────────────────┘
                   │  Markdown + page images
                   ▼
┌──────────────────────────────────────────────────────┐
│  LAYER 2: METABOLISM (Provenance Layer)              │
│  ────────────────────────────────────────────────    │
│  Input: Markdown + page images                       │
│  Engine: forge_document_ingest (ALREADY EXISTS)      │
│  Output: Structured JSON + bbox + SHA-256 + chunks   │
│  Key: bbox → original page pixels (NOT to Markdown)  │
│  Floor: F11 AUDIT (provenance hash)                  │
│  Cost: ~$0 (CPU, local)                              │
│  Modes: analyze, extract, chunk, compare              │
└──────────────────┬───────────────────────────────────┘
                   │  JSON + bbox + provenance
                   ▼
┌──────────────────────────────────────────────────────┐
│  LAYER 3: PURPOSE (Governed Action Layer)            │
│  ────────────────────────────────────────────────    │
│  Input: JSON + bbox + provenance                     │
│  Engine: Constitutional pipeline                     │
│         (000→111→333→666→888→999)                    │
│  Action: Route by domain, verify claims,             │
│         re-ground against original image if HIGH     │
│         stakes (money, legal, medical)               │
│  Floor: F1 AMANAH + F2 TRUTH + F13 SOVEREIGN         │
│  888_HOLD: Any extraction feeding WEALTH capital     │
│  computation or VAULT999 seal                        │
│  Cost: governance compute                            │
└──────────────────────────────────────────────────────┘
```

### 888_HOLD Gate Placement

| Gate | When | Why | Action |
|------|------|------|--------|
| Perception QC | After VLM extraction, before metabolism | Flag pages with low VLM confidence | Route to manual review or re-extract with different params |
| Re-grounding | At Layer 3, when extraction feeds capital/legal/medical decision | Verify key numbers against original image bbox | Use `forge_document_ingest` bbox → original page image to re-verify |
| 888_HOLD | Before VAULT999 seal of any document-derived claim | F13 SOVEREIGN — Arif decides trustworthiness | Block seal, present evidence to Arif for decision |

### Malaysian Document Risk Patterns

| Risk | Context | Mitigation |
|------|---------|------------|
| BM handwriting | Government forms, Jabatan documents | Test Qwen2.5-VL on samples, flag confidence <0.70 |
| Rubber-stamp overlays | Stamps cover text → VLM hallucinates covered content | bbox overlap detection — flag overlapping elements |
| Multi-language mixing | BM+EN+Arabic in Syariah/government docs | Route to `wealth-law-anthropology` skill for context |
| Old scans (1960s-80s) | Land grants, colonial records | VLM better than Tesseract, but confidence drops → more re-grounding |
| Multi-column BM layouts | Newspapers, official reports | VLM handles natively, but verify reading order with bbox |

### Domain Routing Rules

| Document Type | Route To | Why |
|--------------|----------|-----|
| Legal filings, contracts, faraid | WEALTH (`wealth-law-anthropology`) | Legal domain expertise |
| Well logs, seismic reports, basin data | GEOX (`geox-constitution`) | Earth science |
| Medical documents, health records | WELL (`well-substrate-readiness`) | Human readiness |
| Financial reports, annual reports | WEALTH (`wealth-capital-reasoning`) | Capital intelligence |
| Research papers, academic | AAA (general RAG) | Knowledge base |
| Government docs (Jabatan, KTN) | AAA + WEALTH (context-dependent) | BM+EN routing |

### Zen Marginal Cost

```
Tesseract:  $0/M pages   → HIGH entropy   → POISONED RAG
olmOCR:     $176/M pages  → LOW entropy    → CLEAN RAG
Agentic:    +governance   → LOWEST entropy → GOVERNED RAG
```

**You pay for OCR once. You pay for bad OCR forever.**

The expensive layer is perception. Everything after is governance, and governance is cheap when perception is clean.

### Meta-Mesa Gap Registration

This skill fills a P1 gap in the meta-mesa skill atlas:
- **Gap:** Document intelligence is an entirely missing domain (0 of 36 skills cover it)
- **Skill name:** `forge-document-intelligence`
- **Domain:** A-FORGE / Infrastructure
- **Priority:** P1
- **Referenced by:** (will be referenced by) `111-sense-evidence-observe`, `333-mind-plan-generate`, `aforge-execution`

---

## SKILL SPEC — What to Build

### File Location
```
/root/.agents/skills/forge-document-intelligence/SKILL.md
```

### Skill Structure

The SKILL.md must contain:

1. **Header** — name, version, forged date, domain, priority
2. **What This Skill Is** — one paragraph: EMD stack wrapper, document intelligence as AAA citizen right
3. **The Three Layers** — Perception/Provenance/Purpose table
4. **The EMD Stack** — architecture diagram (ASCII)
5. **Visual Re-Grounding Protocol** — the critical anti-hallucination mechanism
   - When to re-ground (high-stakes: money, legal, medical)
   - How to re-ground (bbox → original page image, not Markdown)
   - What to do if re-grounding fails (flag, 888_HOLD)
6. **888_HOLD Gates** — table with gate/when/why/action
7. **Domain Routing** — document type → organ table
8. **Malaysian Document Risks** — risk/pattern/mitigation table
9. **Cost-Aware Extraction** — when to use Tesseract (simple, single-column) vs VLM (complex, multi-column, tables)
10. **Integration Points** — how this skill connects to:
    - `forge_document_ingest` (Layer 2 engine)
    - `111-sense-evidence-observe` (evidence binding)
    - `333-mind-plan-generate` (plan from extracted data)
    - Constitutional pipeline (governance)
    - VAULT999 (seal document-derived claims)
11. **Quick Reference** — decision tree for document processing
12. **Anti-Patterns** — what NOT to do
    - ❌ Trust Markdown without re-grounding for high-stakes
    - ❌ Use Tesseract for multi-column/table documents
    - ❌ Seal document-derived claims without 888_HOLD
    - ❌ Skip bbox preservation (Markdown without provenance = useless)
13. **Telemetry** — skill metrics template

### Anti-Patterns to Encode

| Anti-Pattern | Why It's Wrong | Remedy |
|-------------|---------------|--------|
| Trust Markdown blindly for high-stakes | Clean-looking text can have subtle errors | Re-ground against original image via bbox |
| Use Tesseract for tables/multi-column | Breaks layout, poisons downstream RAG | Use VLM extraction (Qwen2.5-VL API) |
| Seal document-derived claim without 888_HOLD | F13 violation — Arif must decide | Gate at VAULT999 seal, present evidence |
| Skip bbox preservation | Markdown without provenance = unverifiable | forge_document_ingest stores bbox by default |
| Route all documents the same way | Legal ≠ geological ≠ medical | Domain routing table |
| Deploy olmOCR locally on af-forge | No GPU available | Use Bailian API (Qwen2.5-VL) |

### Constitutional Constraints

- **F1 AMANAH:** All document processing is reversible (read-only ingestion). Original files never modified.
- **F2 TRUTH:** All extractions labeled OBS with confidence <0.90. Never claim certainty without re-grounding.
- **F4 CLARITY:** Clean output — structured JSON, not raw text dumps.
- **F11 AUDIT:** Every extraction leaves a provenance hash (SHA-256) and bbox trail.
- **F13 SOVEREIGN:** 888_HOLD before any document-derived claim enters VAULT999.

---

## EXECUTION INSTRUCTIONS

1. **Read this prompt fully** — understand the 3-layer architecture and the re-grounding protocol
2. **Check meta-mesa** — verify `forge-document-intelligence` is still a P1 gap
3. **Create the skill directory:** `mkdir -p /root/.agents/skills/forge-document-intelligence`
4. **Write SKILL.md** — following the spec above
5. **Verify** — load the skill, check it routes correctly in meta-mesa
6. **Update meta-mesa** — add `forge-document-intelligence` to the routing table and remove from gap register
7. **Log** — write execution receipt to `/root/A-FORGE/forge_work/2026-07-02/`
8. **Report** — return skill path, line count, and meta-mesa update confirmation

### Success Criteria

- [ ] SKILL.md exists at `/root/.agents/skills/forge-document-intelligence/SKILL.md`
- [ ] Contains all 13 sections from the spec
- [ ] Re-grounding protocol is clearly documented (the critical anti-hallucination mechanism)
- [ ] 888_HOLD gates are documented
- [ ] Malaysian document risks are documented
- [ ] Domain routing table is complete
- [ ] Meta-mesa gap register updated (removed from missing, added to routing)
- [ ] Execution receipt written

### Do NOT

- Do NOT deploy olmOCR locally (no GPU on af-forge)
- Do NOT modify `forge_document_ingest` tool code (it already works)
- Do NOT create a new MCP tool (this is a SKILL, not a tool)
- Do NOT seal anything to VAULT999 (that requires 888_HOLD + external evidence)
- Do NOT claim this skill is "complete" until meta-mesa is updated

---

## SESSION CONTEXT

- **Origin session:** SEAL-76129e84d1e6415c (FORGE GLM-5.2, 2026-07-02)
- **Analysis file:** `/root/A-FORGE/forge_work/2026-07-02/olmocr-agentic-ocr-analysis.md`
- **Arif's directive:** "seal this session and forge rsi aaa init prompt to execute this. new opencode session"
- **Hermes input:** Confirmed architectural split, flagged hallucination chaining risk and Malaysian document unknowns
- **Qwen-arifOS input:** Confirmed perception vs reasoning paradigm split, referenced LandingAI ADE and LlamaIndex

## REFERENCES

- olmOCR: https://github.com/allenai/olmocr
- olmOCR paper: https://olmocr.allenai.org/papers/olmocr.pdf
- forge_document_ingest: A-FORGE MCP tool (already exists)
- Meta-mesa skill atlas: `/root/.agents/skills/meta-mesa-skill-atlas/SKILL.md`
- AGENTS.md: `/root/AGENTS.md` (heptalogy + constitutional floors)
- A-FORGE AGENTS.md: `/root/A-FORGE/AGENTS.md`

---

*Forged by FORGE (000Ω) for F13 SOVEREIGN · 2026-07-02*
*Session: SEAL-76129e84d1e6415c*
*DITEMPA BUKAN DIBERI*
