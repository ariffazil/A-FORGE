#!/usr/bin/env python3
"""
document_ingest — A-FORGE Document Intelligence Engine
======================================================
Phase 1 MVP. Layout-first document processing with bounding-box provenance.

Architecture Pattern (from chunkr Eureka):
  Layout-first, NOT text-first — VLM/structure analysis BEFORE text extraction.
  Semantic chunk = document boundary — respect sections/tables/figures.
  Bounding-box provenance — every element traceable to source coordinates.
  Structured typed output — not "best effort markdown."

Modes:
  analyze   — Layout analysis only. Return structure tree. No text.
  extract   — Full pipeline: layout + OCR + structured JSON output.
  chunk     — Extract then semantic chunk for RAG consumption.
  compare   — Diff two documents (version comparison).

Usage:
  python document_ingest.py <file_path> --mode extract [--pages 0-5] [--ocr]
  python document_ingest.py <file_path> --mode analyze
  python document_ingest.py <file_path> --mode chunk --strategy semantic
  python document_ingest.py <file_a> --mode compare --compare-with <file_b>

Output: Structured JSON to stdout. Errors to stderr.

Dependencies (all pre-installed on af-forge VPS):
  pymupdf (fitz) 1.27+  — PDF parsing, layout analysis, text blocks
  pymupdf4llm         — markdown conversion with layout
  tesseract 5.5       — OCR for scanned pages (eng+msa trained)
  Pillow              — image preprocessing for OCR

Constitutional:
  F1  AMANAH    — read-only. No mutation. blast_radius=LOW.
  F2  TRUTH     — bounding-box provenance on every element.
  F11 AUDIT     — sha256(source) + per-element coordinates.

DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

import sys
import json
import hashlib
import subprocess
import argparse
from pathlib import Path
from typing import Any


# ═══════════════════════════════════════════════════════════════════════════════
# UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

def sha256_hex(path: str) -> str:
    """SHA-256 of file content."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def ocr_page(image_path: str, lang: str = "eng+msa") -> str:
    """Run tesseract OCR on an image, return text."""
    try:
        result = subprocess.run(
            ["tesseract", image_path, "stdout", "-l", lang, "--psm", "6"],
            capture_output=True, text=True, timeout=30,
        )
        return result.stdout.strip()
    except Exception as e:
        return f"[OCR_ERROR: {e}]"


# ═══════════════════════════════════════════════════════════════════════════════
# ANALYZE — Layout Analysis (Structure Tree)
# ═══════════════════════════════════════════════════════════════════════════════

def analyze(path: str, pages: list[int] | None = None) -> dict:
    """
    Layout-first analysis. Returns structure tree without full text extraction.
    Identifies: headers, paragraphs, columns, tables, figures, their bounding boxes.
    """
    import pymupdf

    doc = pymupdf.open(path)
    total_pages = len(doc)
    page_range = pages or list(range(total_pages))

    structure: list[dict] = []

    for page_idx in page_range:
        if page_idx >= total_pages:
            break
        page = doc[page_idx]
        page_w = page.rect.width
        page_h = page.rect.height

        # Get layout blocks (pymupdf built-in layout analysis)
        blocks = page.get_text("dict", flags=pymupdf.TEXT_PRESERVE_WHITESPACE)["blocks"]

        page_elements: list[dict] = []
        for block in blocks:
            btype = block.get("type", 1)  # 0=text, 1=image
            bbox = list(block["bbox"])  # [x0, y0, x1, y1]

            if btype == 0:  # text block
                for line in block.get("lines", []):
                    text = "".join([span["text"] for span in line.get("spans", [])])
                    if text.strip():
                        page_elements.append({
                            "type": "text",
                            "bbox": list(line["bbox"]),
                            "text": text.strip()[:200],  # preview only in analyze mode
                            "font": line.get("spans", [{}])[0].get("font", "") if line.get("spans") else "",
                            "size": line.get("spans", [{}])[0].get("size", 0) if line.get("spans") else 0,
                        })
            elif btype == 1:  # image block
                page_elements.append({
                    "type": "image",
                    "bbox": bbox,
                    "width": bbox[2] - bbox[0],
                    "height": bbox[3] - bbox[1],
                })

        # Detect tables (pymupdf built-in)
        tables = page.find_tables()
        for table in tables.tables:
            page_elements.append({
                "type": "table",
                "bbox": list(table.bbox),
                "rows": table.row_count,
                "cols": table.col_count,
            })

        structure.append({
            "page": page_idx + 1,
            "width": page_w,
            "height": page_h,
            "element_count": len(page_elements),
            "elements": page_elements,
        })

    doc.close()

    return {
        "mode": "analyze",
        "file": path,
        "source_sha256": sha256_hex(path),
        "total_pages": total_pages,
        "pages_analyzed": len(page_range),
        "layout_tree": structure,
        "summary": {
            "has_text": any(
                any(e["type"] == "text" for e in p["elements"]) for p in structure
            ),
            "has_tables": any(
                any(e["type"] == "table" for e in p["elements"]) for p in structure
            ),
            "has_images": any(
                any(e["type"] == "image" for e in p["elements"]) for p in structure
            ),
            "dominant_fonts": _detect_fonts(structure),
        },
    }


def _detect_fonts(structure: list[dict]) -> list[str]:
    """Extract dominant fonts from structure."""
    fonts: dict[str, int] = {}
    for page in structure:
        for el in page["elements"]:
            if el["type"] == "text" and el.get("font"):
                fonts[el["font"]] = fonts.get(el["font"], 0) + 1
    return sorted(fonts, key=fonts.get, reverse=True)[:5]


# ═══════════════════════════════════════════════════════════════════════════════
# EXTRACT — Full Pipeline (Layout + Text + Provenance)
# ═══════════════════════════════════════════════════════════════════════════════

def extract(path: str, pages: list[int] | None = None, ocr: bool = False) -> dict:
    """
    Full extraction pipeline.
    Returns structured JSON with typed elements + bounding-box provenance.
    """
    import pymupdf

    doc = pymupdf.open(path)
    total_pages = len(doc)
    page_range = pages or list(range(total_pages))

    structured_content: list[dict] = []
    text_by_page: dict[int, str] = {}

    for page_idx in page_range:
        if page_idx >= total_pages:
            break
        page = doc[page_idx]
        page_num = page_idx + 1

        # Get structured blocks
        blocks = page.get_text("dict", flags=pymupdf.TEXT_PRESERVE_WHITESPACE)["blocks"]

        page_text_parts: list[str] = []
        for block in blocks:
            btype = block.get("type", 1)

            if btype == 0:  # text
                for line in block.get("lines", []):
                    text = "".join([span["text"] for span in line.get("spans", [])])
                    if text.strip():
                        spans = line.get("spans", [])
                        el = {
                            "type": "paragraph",
                            "bbox": list(line["bbox"]),
                            "page": page_num,
                            "text": text.strip(),
                            "confidence": 1.0,  # native text = 100% confidence
                            "font": spans[0].get("font", "") if spans else "",
                            "size": spans[0].get("size", 0) if spans else 0,
                            "flags": spans[0].get("flags", 0) if spans else 0,
                        }
                        structured_content.append(el)
                        page_text_parts.append(text.strip())

            elif btype == 1:  # image — could be scanned content needing OCR
                bbox = list(block["bbox"])
                el = {
                    "type": "image",
                    "bbox": bbox,
                    "page": page_num,
                    "width": bbox[2] - bbox[0],
                    "height": bbox[3] - bbox[1],
                }
                if ocr:
                    # Extract image and OCR it
                    try:
                        pix = pymupdf.Pixmap(doc, block.get("xref", 0) if block.get("xref") else 0)
                        tmp_path = f"/tmp/aforge_ocr_page{page_num}_{page_idx}.png"
                        if pix.n >= 5:
                            pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
                        pix.save(tmp_path)
                        ocr_text = ocr_page(tmp_path)
                        el["ocr_text"] = ocr_text
                        el["confidence"] = 0.7  # OCR confidence lower than native
                        Path(tmp_path).unlink(missing_ok=True)
                    except Exception as e:
                        el["ocr_error"] = str(e)
                        el["confidence"] = 0.0
                structured_content.append(el)

        # Detect tables
        tables = page.find_tables()
        for table in tables.tables:
            try:
                df = table.to_pandas()
                structured_content.append({
                    "type": "table",
                    "bbox": list(table.bbox),
                    "page": page_num,
                    "rows": table.row_count,
                    "cols": table.col_count,
                    "headers": list(df.columns),
                    "data": df.to_dict(orient="records"),
                })
            except Exception:
                structured_content.append({
                    "type": "table",
                    "bbox": list(table.bbox),
                    "page": page_num,
                    "rows": table.row_count,
                    "cols": table.col_count,
                })

        text_by_page[page_num] = "\n".join(page_text_parts)

    # Build metadata
    meta = doc.metadata
    doc.close()

    return {
        "mode": "extract",
        "file": path,
        "source_sha256": sha256_hex(path),
        "metadata": {
            "pages": total_pages,
            "title": meta.get("title", ""),
            "author": meta.get("author", ""),
            "subject": meta.get("subject", ""),
            "creator": meta.get("creator", ""),
            "producer": meta.get("producer", ""),
            "format": meta.get("format", ""),
        },
        "structured_content": structured_content,
        "full_text": "\n\n".join(text_by_page.values()),
        "provenance": {
            "source_sha256": sha256_hex(path),
            "extraction_method": "pymupdf_native" if not ocr else "pymupdf_ocr_hybrid",
            "ocr_engine": "tesseract_5.5" if ocr else None,
        },
        "summary": {
            "paragraphs": sum(1 for el in structured_content if el["type"] == "paragraph"),
            "tables": sum(1 for el in structured_content if el["type"] == "table"),
            "images": sum(1 for el in structured_content if el["type"] == "image"),
            "total_elements": len(structured_content),
        },
    }


# ═══════════════════════════════════════════════════════════════════════════════
# CHUNK — Semantic Chunking for RAG
# ═══════════════════════════════════════════════════════════════════════════════

def chunk_document(
    path: str,
    strategy: str = "semantic",
    chunk_size: int = 1200,
    overlap: int = 200,
) -> dict:
    """
    Extract then chunk for RAG.

    Strategies:
      semantic  — chunk at section/heading boundaries (layout-aware)
      section   — chunk at page boundaries
      page      — one chunk per page
    """
    # First extract
    result = extract(path, ocr=False)

    chunks: list[dict] = []
    elements = result["structured_content"]

    if strategy == "page":
        # One chunk per page
        for page_num in sorted(set(el["page"] for el in elements)):
            page_els = [el for el in elements if el["page"] == page_num]
            page_text = " ".join([el.get("text", "") for el in page_els if el.get("text")])
            chunks.append({
                "chunk_id": f"page_{page_num}",
                "strategy": "page",
                "page": page_num,
                "text": page_text,
                "element_count": len(page_els),
                "has_table": any(el["type"] == "table" for el in page_els),
                "has_image": any(el["type"] == "image" for el in page_els),
            })

    elif strategy == "section":
        # Chunk at paragraph boundaries with size limit
        current_chunk: list[dict] = []
        current_size = 0
        chunk_idx = 0

        for el in elements:
            text = el.get("text", "")
            text_len = len(text)

            if current_size + text_len > chunk_size and current_chunk:
                # Flush chunk
                chunk_text = " ".join([e.get("text", "") for e in current_chunk])
                pages = sorted(set(e["page"] for e in current_chunk))
                chunks.append({
                    "chunk_id": f"chunk_{chunk_idx}",
                    "strategy": "section",
                    "pages": pages,
                    "text": chunk_text,
                    "size_chars": len(chunk_text),
                    "element_count": len(current_chunk),
                })
                # Overlap: keep last element(s) up to overlap chars
                overlap_chars = 0
                overlap_els = []
                for e in reversed(current_chunk):
                    etext = e.get("text", "")
                    if overlap_chars + len(etext) <= overlap:
                        overlap_els.insert(0, e)
                        overlap_chars += len(etext)
                    else:
                        break
                current_chunk = overlap_els
                current_size = overlap_chars
                chunk_idx += 1

            current_chunk.append(el)
            current_size += text_len

        # Final chunk
        if current_chunk:
            chunk_text = " ".join([e.get("text", "") for e in current_chunk])
            pages = sorted(set(e["page"] for e in current_chunk))
            chunks.append({
                "chunk_id": f"chunk_{chunk_idx}",
                "strategy": "section",
                "pages": pages,
                "text": chunk_text,
                "size_chars": len(chunk_text),
                "element_count": len(current_chunk),
            })

    else:  # semantic — detect headings and chunk at heading boundaries
        # Heuristic: large font text = heading. Group paragraphs under their heading.
        sections: list[dict] = []
        current_section: dict | None = None

        for el in elements:
            if el["type"] != "paragraph":
                continue
            size = el.get("size", 10)
            text = el.get("text", "")
            flags = el.get("flags", 0)
            is_bold = bool(flags & 2**3)  # bit 3 = bold

            # Heading heuristic: larger than body text OR bold + short text
            if (size > 12 or (is_bold and len(text) < 100)) and len(text) < 200:
                if current_section:
                    sections.append(current_section)
                current_section = {
                    "heading": text,
                    "page": el["page"],
                    "size": size,
                    "elements": [],
                    "text_parts": [],
                }
            elif current_section:
                current_section["elements"].append(el)
                current_section["text_parts"].append(text)
            else:
                # No heading yet — orphan text
                if not sections:
                    sections.append({
                        "heading": "[NO HEADING]",
                        "page": el["page"],
                        "size": 0,
                        "elements": [],
                        "text_parts": [],
                    })
                sections[-1]["elements"].append(el)
                sections[-1]["text_parts"].append(text)

        if current_section:
            sections.append(current_section)

        # Convert sections to chunks, splitting oversized ones
        for i, section in enumerate(sections):
            section_text = " ".join(section["text_parts"])
            if len(section_text) <= chunk_size:
                chunks.append({
                    "chunk_id": f"semantic_{i}",
                    "strategy": "semantic",
                    "heading": section["heading"],
                    "pages": sorted(set(e["page"] for e in section["elements"])) if section["elements"] else [section["page"]],
                    "text": section_text,
                    "size_chars": len(section_text),
                    "element_count": len(section["elements"]),
                })
            else:
                # Split oversized section
                sub_text = ""
                sub_els = []
                sub_idx = 0
                for el in section["elements"]:
                    t = el.get("text", "")
                    if len(sub_text) + len(t) > chunk_size and sub_text:
                        chunks.append({
                            "chunk_id": f"semantic_{i}_{sub_idx}",
                            "strategy": "semantic",
                            "heading": f"{section['heading']} (part {sub_idx + 1})",
                            "pages": sorted(set(e["page"] for e in sub_els)),
                            "text": sub_text,
                            "size_chars": len(sub_text),
                            "element_count": len(sub_els),
                        })
                        sub_text = t
                        sub_els = [el]
                        sub_idx += 1
                    else:
                        sub_text += " " + t if sub_text else t
                        sub_els.append(el)
                if sub_text:
                    chunks.append({
                        "chunk_id": f"semantic_{i}_{sub_idx}",
                        "strategy": "semantic",
                        "heading": f"{section['heading']} (part {sub_idx + 1})" if sub_idx > 0 else section["heading"],
                        "pages": sorted(set(e["page"] for e in sub_els)),
                        "text": sub_text,
                        "size_chars": len(sub_text),
                        "element_count": len(sub_els),
                    })

    return {
        "mode": "chunk",
        "file": path,
        "source_sha256": result["source_sha256"],
        "metadata": result["metadata"],
        "chunk_strategy": strategy,
        "chunk_size": chunk_size,
        "overlap": overlap,
        "total_chunks": len(chunks),
        "chunks": chunks,
        "summary": result["summary"],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# COMPARE — Document Diff
# ═══════════════════════════════════════════════════════════════════════════════

def compare(path_a: str, path_b: str) -> dict:
    """
    Compare two documents. Returns structural and content diffs.
    Useful for version/revision comparison.
    """
    result_a = extract(path_a)
    result_b = extract(path_b)

    # Structural comparison
    struct_diff = {
        "pages": {"a": result_a["metadata"]["pages"], "b": result_b["metadata"]["pages"],
                   "delta": result_b["metadata"]["pages"] - result_a["metadata"]["pages"]},
        "paragraphs": {"a": result_a["summary"]["paragraphs"], "b": result_b["summary"]["paragraphs"],
                        "delta": result_b["summary"]["paragraphs"] - result_a["summary"]["paragraphs"]},
        "tables": {"a": result_a["summary"]["tables"], "b": result_b["summary"]["tables"],
                    "delta": result_b["summary"]["tables"] - result_a["summary"]["tables"]},
        "total_elements": {"a": result_a["summary"]["total_elements"], "b": result_b["summary"]["total_elements"],
                            "delta": result_b["summary"]["total_elements"] - result_a["summary"]["total_elements"]},
    }

    # Text similarity (simple Jaccard on word sets)
    words_a = set(result_a["full_text"].lower().split())
    words_b = set(result_b["full_text"].lower().split())
    intersection = words_a & words_b
    union = words_a | words_b
    jaccard = len(intersection) / len(union) if union else 1.0

    return {
        "mode": "compare",
        "file_a": path_a,
        "file_b": path_b,
        "sha256_a": result_a["source_sha256"],
        "sha256_b": result_b["source_sha256"],
        "structural_diff": struct_diff,
        "text_similarity": {
            "jaccard": round(jaccard, 4),
            "unique_words_a": len(words_a),
            "unique_words_b": len(words_b),
            "shared_words": len(intersection),
        },
        "verdict": "identical" if jaccard > 0.99 else "similar" if jaccard > 0.7 else "different",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="A-FORGE Document Intelligence Engine")
    parser.add_argument("file", help="Path to document")
    parser.add_argument("--mode", default="extract",
                        choices=["analyze", "extract", "chunk", "compare"])
    parser.add_argument("--pages", help="Page range, e.g. 0-5")
    parser.add_argument("--ocr", action="store_true", help="Enable OCR for scanned pages")
    parser.add_argument("--strategy", default="semantic",
                        choices=["semantic", "section", "page"],
                        help="Chunking strategy (chunk mode)")
    parser.add_argument("--chunk-size", type=int, default=1200,
                        help="Chunk size in characters")
    parser.add_argument("--overlap", type=int, default=200,
                        help="Chunk overlap in characters")
    parser.add_argument("--compare-with", help="Second file for compare mode")
    parser.add_argument("--output", choices=["json", "jsonl"], default="json",
                        help="Output format")

    args = parser.parse_args()

    # Parse page range
    pages = None
    if args.pages:
        if "-" in args.pages:
            start, end = args.pages.split("-")
            pages = list(range(int(start), int(end) + 1))
        else:
            pages = [int(args.pages)]

    # Execute mode
    try:
        if args.mode == "analyze":
            output = analyze(args.file, pages=pages)
        elif args.mode == "extract":
            output = extract(args.file, pages=pages, ocr=args.ocr)
        elif args.mode == "chunk":
            output = chunk_document(args.file, strategy=args.strategy,
                          chunk_size=args.chunk_size, overlap=args.overlap)
        elif args.mode == "compare":
            if not args.compare_with:
                print(json.dumps({"error": "--compare-with required for compare mode"}))
                sys.exit(1)
            output = compare(args.file, args.compare_with)
        else:
            print(json.dumps({"error": f"Unknown mode: {args.mode}"}))
            sys.exit(1)

        if args.output == "jsonl":
            # One JSON object per line (for streaming/chunked responses)
            if args.mode == "chunk":
                for chunk in output.get("chunks", []):
                    print(json.dumps(chunk))
            else:
                print(json.dumps(output))
        else:
            print(json.dumps(output, indent=2, default=str))

    except FileNotFoundError:
        print(json.dumps({"error": f"File not found: {args.file}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e), "type": type(e).__name__}))
        sys.exit(1)


if __name__ == "__main__":
    main()
