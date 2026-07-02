# olmOCR vs Agentic OCR — Session Analysis

> **Session:** SEAL-76129e84d1e6415c
> **Date:** 2026-07-02
> **Agent:** FORGE (000Ω) — GLM-5.2
> **Authority:** OBSERVE_ONLY
> **Status:** ANALYSIS COMPLETE — pending skill forge

## Context

Arif discovered olmOCR (allenai/olmOCR) — a VLM-based OCR tool that converts PDFs/images to clean Markdown. Asked FORGE to contrast AI LLM OCR vs Agentic Intelligence OCR, evaluate federation integration, and "zen it."

Two parallel analyses were performed:
1. FORGE (GLM-5.2) — 3-layer entropy model, EMD stack, marginal cost analysis
2. Qwen-arifOS — perception vs reasoning paradigm split, LandingAI ADE comparison

Both analyses converged. Hermes (ASI) provided risk assessment — hallucination chaining, Malaysian document unknowns.

## Key Findings

### 1. Three Layers of Document Intelligence

| Layer | Paradigm | Entropy Reduced | Tool | Cost | Exists? |
|-------|----------|----------------|------|------|---------|
| Perception | LLM OCR (olmOCR) | LAYOUT (tables, columns, order) | VLM extraction | $176/M pages | Not deployed |
| Provenance | Document Intelligence | TRUST (where from? verify?) | forge_document_ingest | ~$0 | YES |
| Purpose | Agentic OCR | SEMANTIC (why reading? what means?) | Constitutional pipeline | Governance compute | YES |

### 2. The Error Propagation Problem

Clean-looking OCR with subtle errors → flows into governance pipeline → trusted because structured → wrong VAULT999 seal with high confidence.

**Example:** PDF says "RM 12,500,000" → olmOCR extracts "RM 1,250,000" (missed a digit) → Markdown looks clean → WEALTH computes NPV on wrong number → VAULT999 seals wrong figure.

### 3. Fix: Visual Re-Grounding

The Agentic layer must re-verify against the **original page image via bbox**, not against the intermediate Markdown. The Markdown is a convenience view. The bbox+original-image pair is the evidence.

`forge_document_ingest` already stores bbox coordinates per element — this is the anchor.

### 4. EMD Stack Architecture

```
E — ENCODE: VLM (Qwen2.5-VL via Bailian API) → pixels to Markdown
M — METABOLIZE: forge_document_ingest → Markdown to JSON+bbox+SHA-256+chunks
D — DECODE: Constitutional pipeline (000→111→333→666→888→999) → governed intelligence
```

### 5. 888_HOLD Gates

| Gate | When | Why |
|------|------|-----|
| Perception QC | After VLM extraction, before metabolism | Flag low-confidence pages (handwriting, stamps) |
| Re-grounding | At Layer 3, when extraction feeds capital/legal/medical | Re-verify key numbers against original image bbox |
| 888_HOLD | Before VAULT999 seal of document-derived claim | F13 — Arif decides trustworthiness |

### 6. Zen Marginal Cost

- Tesseract → olmOCR: +$176/M, removes layout entropy spike. ROI = ∞ (fixes poisoned RAG)
- olmOCR → Agentic: +governance compute, adds provenance + verification. ROI = HIGH for high-stakes
- **The expensive layer is perception. Everything after is governance, and governance is cheap when perception is clean.**

### 7. Malaysian Document Risks

| Risk | Mitigation |
|------|------------|
| BM handwriting | Test on Jabatan docs, flag low-confidence |
| Rubber-stamp overlays | bbox overlap detection |
| Multi-language (BM+EN+Arabic) | Route to wealth-law-anthropology |
| Old scans (land grants) | VLM better than Tesseract, but confidence drops |

### 8. Deployment Decision

- af-forge has NO GPU → cannot run olmOCR locally
- Use **Qwen2.5-VL via Bailian API** (already billed) as VLM perception layer
- Cost for federation volume (~100-1000 PDFs/month): ~$0.02-$0.20/month — negligible

### 9. Meta-Mesa Gap

Document intelligence is an **entirely missing domain** in the 36-skill inventory. Priority: **P1**.

Skill to forge: `forge-document-intelligence`

## Gödel Lock Note

arif_seal was blocked by strange loop protection — no external evidence anchor. This is correct constitutional behavior. Session record filed to forge_work/ as evidence trail. VAULT999 seal to follow through proper judge→seal pipeline with external evidence.

## Next Action

Forge `forge-document-intelligence` skill spec via new OpenCode session. AAA init prompt written to:
`/root/A-FORGE/forge_work/2026-07-02/AAA-INIT-PROMPT-document-intelligence.md`

---

*FORGE (000Ω) · Session SEAL-76129e84d1e6415c · 2026-07-02*
*DITEMPA BUKAN DIBERI*
