# OCR-DOCTRINE — The Two-Stage Theory of Optical Character Recognition
> **Forged:** 2026-08-04 by 333-AGI Δ MIND
> **Source:** EUREKA-5 from OCR ZEN MAP — convergence of Federation OCR stack + llm_aided_ocr (Dicklesworthstone, 3k+ stars)
> **Thesis:** OCR is NOT a single operation. It is a two-stage process of optical compression followed by linguistic decompression.

---

## 1. THE UNIFIED THEORY

```
OCR = OPTICAL MEASUREMENT + LINGUISTIC DECOMPRESSION

Stage 1 (Optical):  pixels → noisy text     [Tesseract, VLM vision encoder]
Stage 2 (Linguistic): noisy text → clean text [LLM language model prior]
```

### 1.1 Why This Matters

Traditional OCR treats text extraction as a pure pattern recognition problem: match pixel patterns to character shapes. This fails because:

1. **Pixel ambiguity**: The same pixel pattern can represent different characters (`rn` vs `m`, `cl` vs `d`, `I` vs `l`)
2. **Layout interference**: Headers, footers, page numbers, and multi-column layouts inject noise
3. **No linguistic knowledge**: Tesseract doesn't know that `man- agement` is statistically implausible vs `management`

The two-stage theory solves this: stage 1 produces a noisy initial hypothesis, and stage 2 uses linguistic knowledge to correct it.

### 1.2 The Compression Analogy

Vision tokens ARE compressed context. A 1024×1024 image contains ~1M pixels of information. The extracted text might be 500 words × 5 chars = 2500 characters. The compression ratio is ~400:1 (pixel tokens → text tokens).

The VLM/OCR engine performs lossy compression — information IS lost in the pixel→text transformation. The LLM correction pass performs lossless re-expansion — recovering information from the linguistic context that was lost in compression.

This is formally equivalent to:
```
Image → Encoder(VLM) → Latent(text) → Decoder(LLM prior) → Clean Text
```

---

## 2. THE TWO-STAGE ARCHITECTURE IN OUR STACK

### 2.1 VLM-First Path (Tier 1)

```
[Image] → [qwen3-omni-flash / Qwen2.5-VL / Unlimited-OCR]
              ↓ FUSED Stage 1+2 (VLM does both)
         [F12 INJECTION scan] → [F9 ANTI-HANTU] → [F2 TRUTH label]
              ↓
         [STRUCTURED MARKDOWN] → 333-AGI
```

The VLM performs both stages simultaneously — its vision encoder (stage 1) and language decoder (stage 2) are a single model. This is powerful but expensive.

### 2.2 Tesseract + LLM Path (Tier 2)

```
[Image] → [Tesseract 5.5] → [RAW NOISY TEXT]
              ↓                  ↓ Stage 1 only
         [555-ASI-VISION GATE] ← F12 scan mandatory
              ↓
         [LLM CORRECTION PASS] ← Stage 2: linguistic decompression
              ↓
         [CLEAN MARKDOWN] → 333-AGI
```

Tesseract provides stage 1 only. The LLM provides stage 2. This is cheaper at scale but requires two separate systems.

### 2.3 The `llm_aided_ocr` Pattern (External Reference)

```
[Image] → [OpenCV preprocess] → [Tesseract] → [Smart Chunking] → [LLM Pass 1: Correction]
                                                                    → [LLM Pass 2: Formatting + Dedup]
                                                                    → [LLM Pass 3: Quality Score]
```

This project makes the separation explicit — three LLM passes, each with a different prompt tuned for a specific sub-task of linguistic decompression.

---

## 3. WHY THE SEPARATION MATTERS FOR ARCHITECTURE

### 3.1 Prompt Engineering Implications

When stage 1 and stage 2 are fused (VLM path), the prompt must encode BOTH:
- "Extract text accurately" (optical task)
- "Format cleanly, fix errors" (linguistic task)

When separated, each prompt can be optimized for its specific task:
- Correction prompt: "Fix OCR errors. Do NOT add content. Preserve structure."
- Formatting prompt: "Convert to markdown. Remove duplicates. Clean up."

### 3.2 Cost Implications

| Approach | Cost per page | Quality ceiling | Best for |
|----------|---------------|-----------------|----------|
| VLM-First (single pass) | $0.02-0.05 | 90/100 | Complex layouts, tables, financial docs |
| Tesseract + LLM correction | $0.001-0.005 | 85/100 | Clean typed documents, bulk processing |
| Tesseract only | $0.00 | 65/100 | Digital-born PDFs, simple layouts |

### 3.3 Constitutional Implications

The separation creates a natural security boundary:

1. **Stage 1 output (raw OCR)**: UNTRUSTED — subject to F12 injection scan
2. **Stage 2 output (corrected)**: TRUSTED with DER (derived) epistemic label
3. **Both stages pass through**: `asi_vision_gate.py` — the constitutional membrane

This separation is architecturally superior because:
- Injection attacks embedded in images are caught at the stage 1→stage 2 boundary
- Hallucinations added by the LLM in stage 2 are caught by F9 anti-hantu
- Content loss between stages is measurable (retention ratio)

---

## 4. THE SMART CHUNKING INVARIANT

When stage 2 (LLM correction) processes long documents, chunking is NOT optional — it is mathematically necessary due to context window limits. But naive chunking destroys linguistic coherence.

### 4.1 The Three Invariants of Smart Chunking

1. **Paragraph Integrity**: Never split a paragraph across chunks. Paragraphs are semantic units.
2. **Context Bridging**: Each chunk must receive the last N characters of the previous chunk as context. Without this, sentences spanning chunk boundaries become orphaned.
3. **Overlap Guarantee**: N-word overlap between consecutive chunks ensures no information is lost at boundaries.

### 4.2 The Fallback Ladder

```
1. Split on paragraph boundaries (double newlines) — ideal
2. If paragraph > chunk_size, split on sentence boundaries — acceptable
3. If sentence > chunk_size, split on word boundaries with overlap — required
```

Never split mid-word. Never split without overlap.

---

## 5. THE DUPLICATE DETECTION INVARIANT

Tesseract's most common multi-page artifact is the repetition of headers, footers, and page numbers. These appear as near-identical text blocks across pages.

### 5.1 The Jaccard Criterion

For any two text chunks A and B:
```
J(A, B) = |words(A) ∩ words(B)| / |words(A) ∪ words(B)|
```
If J(A, B) ≥ 0.85, they are duplicates. One should be removed.

### 5.2 When NOT to Deduplicate

- J(A, B) < 0.85 → keep both (content may be similar but distinct)
- Chunk is < 50 characters → keep (too short to meaningfully deduplicate)
- Chunk appears only once → keep (not a duplicate)

---

## 6. THE QUALITY FEEDBACK LOOP

Every OCR output should carry a quality score. Without it, we cannot:
- Compare engines (VLM vs Tesseract vs Unlimited-OCR)
- Detect degradation over time (model updates, API changes)
- Automatically re-process low-scoring documents

### 6.1 Heuristic Scoring (Cost: $0)

Uses structural metrics: retention ratio, whitespace normalization, suspicious pattern count. Scores from 0-100 with letter grades.

### 6.2 LLM-Based Scoring (Cost: ~$0.001)

Uses FLAME or any LLM to compare raw vs processed samples. Same pattern as llm_aided_ocr's `assess_output_quality()`.

---

## 7. ARCHITECTURAL PRINCIPLES (binding)

1. **Stage separation is not optional**: F12 injection scan MUST sit between stages 1 and 2
2. **No OCR output reaches 333-AGI ungated**: Every text element passes through `asi_vision_gate.py`
3. **VLM output is DER (derived), not OBS (observed)**: The VLM interprets, it does not directly observe pixels
4. **Tesseract output is OBS (observed), not DER**: Tesseract does pixel→character mapping without interpretation
5. **Quality scoring is mandatory for engine comparison**: Without metrics, we cannot improve
6. **None-guard is mandatory**: Every engine call must fall back to either Tesseract (always available) or the original text

---

## 8. FILE MAP

| File | Role | Lines |
|------|------|-------|
| `asi_vision_gate.py` | Constitutional membrane (F2/F9/F12 gate + dedup + quality) | 827 |
| `ocr_engine.py` | Perception backends (Baidu, Unlimited, Qwen, Tesseract) + SmartChunker | 1042 |
| `ocr_document.py` | Unified entry point + two-pass correction + concurrent processing | 989 |
| `forge_document_ocr.py` | Hybrid dynamic router (Gradio/SGLang/Qwen) | 398 |
| `ocr_pipeline.py` | EMD pipeline (OCR → Ingest → Embed) | 505 |
| `gradio_bridge.py` | Free OCR via HF Spaces | 316 |
| `OCR-DOCTRINE.md` | This file — doctrine | ~200 |

---

*DITEMPA BUKAN DIBERI — forged in flow, not in drift.*
*Derived from EUREKA-5 (OCR ZEN MAP 2026-08-04) + DeepSeek-OCR (arXiv:2510.18234) + llm_aided_ocr (Dicklesworthstone).*
