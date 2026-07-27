#!/usr/bin/env python3
"""
Gradio Bridge — Baidu Unlimited-OCR via Hugging Face Spaces
============================================================
Zero-cost, zero-auth OCR perception using the baidu/Unlimited-OCR HF Space.
Calls the Gradio API programmatically — no browser, no registration.

Flow: PDF → PyMuPDF rasterize → Gradio /run_ocr (per page) → Markdown
      → optional forge_document_ingest → bge-m3 → Qdrant

Usage:
  python gradio_bridge.py --pdf doc.pdf                     # OCR only
  python gradio_bridge.py --pdf doc.pdf --mode base --dpi 200
  python gradio_bridge.py --pdf doc.pdf --pipeline           # Full EMD pipeline
  python gradio_bridge.py --pdf doc.pdf --compare-qwen       # Compare vs Qwen2.5-VL

DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

import os
import sys
import json
import time
import tempfile
from pathlib import Path

DEFAULT_DPI = 200
DEFAULT_MODE = "base"
HF_SPACE = "baidu/Unlimited-OCR"
SCRIPT_DIR = Path(__file__).resolve().parent


# ── PDF Rasterizer ────────────────────────────────────────────────────
def pdf_to_images(pdf_path: str, dpi: int = DEFAULT_DPI) -> list[str]:
    import fitz

    doc = fitz.open(pdf_path)
    tmp_dir = tempfile.mkdtemp(prefix="gradio_ocr_")
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    paths = []
    for i, page in enumerate(doc):
        out = os.path.join(tmp_dir, f"page_{i + 1:04d}.png")
        page.get_pixmap(matrix=mat).save(out)
        paths.append(out)
    doc.close()
    return paths


# ── Gradio API Client ─────────────────────────────────────────────────
class GradioOCRClient:
    """Wraps the baidu/Unlimited-OCR Hugging Face Space Gradio API."""

    def __init__(self):
        from gradio_client import Client

        self._client = Client(HF_SPACE)

    def ocr_page(
        self,
        image_path: str,
        mode: str = DEFAULT_MODE,
        prompt: str = "document parsing.",
    ) -> dict:
        from gradio_client import handle_file

        return self._client.predict(
            image_path=handle_file(image_path),
            mode=mode,
            prompt=prompt,
            api_name="/run_ocr",
        )

    def ocr_pdf_pages(
        self,
        pdf_path: str,
        dpi: int = DEFAULT_DPI,
        mode: str = DEFAULT_MODE,
        callback=None,
    ) -> dict:
        """
        Rasterize PDF pages + OCR each page via Gradio API.
        Returns dict with full_markdown, pages_processed, per_page_results.
        """
        images = pdf_to_images(pdf_path, dpi)
        results = []
        markdown_parts = []
        errors = 0

        t_start = time.monotonic()
        for i, img in enumerate(images):
            page_no = i + 1
            if callback:
                callback(page_no, len(images))

            try:
                result = self.ocr_page(img, mode)
                text = (
                    result.get("text", "") if isinstance(result, dict) else str(result)
                )
                done = result.get("done", True) if isinstance(result, dict) else True

                if text:
                    markdown_parts.append(text)
                    print(f"  [{page_no}/{len(images)}] ✅ {len(text)} chars")
                else:
                    print(f"  [{page_no}/{len(images)}] ⚠️  empty output")
                    errors += 1

                results.append(
                    {
                        "page": page_no,
                        "chars": len(text),
                        "success": done,
                        "image_path": img,
                    }
                )
            except Exception as e:
                print(f"  [{page_no}/{len(images)}] ❌ {e}")
                errors += 1
                results.append(
                    {
                        "page": page_no,
                        "chars": 0,
                        "success": False,
                        "error": str(e),
                    }
                )

        elapsed = time.monotonic() - t_start
        full_md = "\n\n".join(markdown_parts)

        return {
            "pdf": pdf_path,
            "backend": f"gradio_bridge::{HF_SPACE}",
            "mode": mode,
            "dpi": dpi,
            "pages_total": len(images),
            "pages_success": len(images) - errors,
            "pages_errors": errors,
            "total_chars": len(full_md),
            "elapsed_s": round(elapsed, 1),
            "chars_per_second": round(len(full_md) / elapsed, 1) if elapsed > 0 else 0,
            "full_markdown": full_md,
            "per_page": results,
        }


# ── Comparison Engine ─────────────────────────────────────────────────
def compare_with_qwen(pdf_path: str, unlimited_result: dict) -> dict:
    """
    Compare Unlimited-OCR output against Qwen2.5-VL baseline.
    For now: structural comparison (char counts, page coverage).
    Future: edit distance, semantic similarity, hallucination detection.
    """
    comparison = {
        "unlimited_ocr": {
            "backend": "gradio_bridge::baidu/Unlimited-OCR",
            "pages_processed": unlimited_result["pages_success"],
            "total_chars": unlimited_result["total_chars"],
            "elapsed_s": unlimited_result["elapsed_s"],
            "errors": unlimited_result["pages_errors"],
        },
        "qwen25_vl": {
            "backend": "bailian_api::qwen2.5-vl",
            "status": "NOT_YET_RUN",
            "note": "Existing pipeline — run separately via forge_document_ingest",
        },
        "verdict": "unlimited_ocr_tested_qwen_pending",
    }
    return comparison


# ── Pipeline Integration ──────────────────────────────────────────────
def feed_to_pipeline(markdown: str, source: str, output_dir: str) -> dict:
    """Feed OCR output to forge_document_ingest → embed_store."""
    from ocr_pipeline import stage_ingest, stage_embed

    os.makedirs(output_dir, exist_ok=True)

    # Write markdown to temp file
    md_path = os.path.join(output_dir, "ocr_output.md")
    Path(md_path).write_text(markdown, encoding="utf-8")

    # Stage 2: Ingest
    ingest_dir = os.path.join(output_dir, "ingest")
    ingest_result = stage_ingest(md_path, source, ingest_dir)

    # Stage 3: Embed
    chunks_path = ingest_result.get("chunks_path", "")
    if chunks_path:
        embed_result = stage_embed(chunks_path, source)
    else:
        embed_result = {"status": "SKIPPED", "reason": "no chunks"}

    return {
        "markdown_path": md_path,
        "ingest": ingest_result,
        "embed": embed_result,
    }


# ── CLI ───────────────────────────────────────────────────────────────
def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Gradio Bridge — Unlimited-OCR via HF Spaces (RM0)"
    )
    parser.add_argument("--pdf", required=True, help="Path to PDF")
    parser.add_argument(
        "--output", "-o", default="/tmp/gradio_ocr", help="Output directory"
    )
    parser.add_argument(
        "--mode",
        default=DEFAULT_MODE,
        choices=["gundam", "base"],
        help="OCR mode: gundam (640px, fast) or base (1024px, accurate)",
    )
    parser.add_argument(
        "--dpi",
        type=int,
        default=DEFAULT_DPI,
        help=f"PDF rasterization DPI (default: {DEFAULT_DPI})",
    )
    parser.add_argument(
        "--pipeline",
        action="store_true",
        help="Feed output to forge_document_ingest → embed",
    )
    parser.add_argument(
        "--compare-qwen",
        action="store_true",
        help="Compare against Qwen2.5-VL baseline",
    )
    parser.add_argument(
        "--json", action="store_true", help="Output full metadata as JSON"
    )
    args = parser.parse_args()

    if not os.path.exists(args.pdf):
        print(f"[FATAL] PDF not found: {args.pdf}", file=sys.stderr)
        sys.exit(1)

    pdf_name = os.path.splitext(os.path.basename(args.pdf))[0]
    os.makedirs(args.output, exist_ok=True)

    # ── Run OCR ──
    client = GradioOCRClient()
    import fitz

    total_pages = fitz.open(args.pdf).page_count
    fitz.open(args.pdf).close()

    print(f"┌{'─' * 60}┐")
    print(f"│ Gradio Bridge: {HF_SPACE}")
    print(f"│ PDF: {os.path.basename(args.pdf)} ({total_pages} pages)")
    print(f"│ Mode: {args.mode}, DPI: {args.dpi}")
    print(f"└{'─' * 60}┘")

    def progress(current, total):
        pass  # Progress is handled in ocr_pdf_pages

    result = client.ocr_pdf_pages(
        args.pdf, dpi=args.dpi, mode=args.mode, callback=progress
    )

    # ── Save Output ──
    md_path = os.path.join(args.output, f"{pdf_name}_unlimited_ocr.md")
    Path(md_path).write_text(result["full_markdown"], encoding="utf-8")

    meta_path = os.path.join(args.output, f"{pdf_name}_meta.json")
    meta = {k: v for k, v in result.items() if k not in ("full_markdown", "per_page")}
    Path(meta_path).write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print(f"\n┌{'─' * 60}┐")
    print(f"│ ✅ OCR Complete")
    print(f"│ Pages: {result['pages_success']}/{result['pages_total']}")
    print(f"│ Chars: {result['total_chars']:,}")
    print(f"│ Time:  {result['elapsed_s']}s")
    print(f"│ Speed: {result['chars_per_second']} chars/s")
    print(f"│ Output: {md_path}")
    print(f"└{'─' * 60}┘")

    # ── Optional: Compare with Qwen ──
    if args.compare_qwen:
        comparison = compare_with_qwen(args.pdf, result)
        cmp_path = os.path.join(args.output, f"{pdf_name}_comparison.json")
        Path(cmp_path).write_text(json.dumps(comparison, indent=2))
        print(f"\n[COMPARE] Comparison saved: {cmp_path}")

    # ── Optional: Full Pipeline ──
    if args.pipeline:
        print("\n[PIPELINE] Feeding to forge_document_ingest...")
        pipeline_result = feed_to_pipeline(
            result["full_markdown"], pdf_name, args.output
        )
        pipe_path = os.path.join(args.output, f"{pdf_name}_pipeline.json")
        Path(pipe_path).write_text(json.dumps(pipeline_result, indent=2, default=str))
        print(f"[PIPELINE] Done: {pipe_path}")

    # ── JSON Output ──
    if args.json:
        report = {
            "meta": meta,
            "per_page_summary": {
                p["page"]: {"chars": p["chars"], "success": p["success"]}
                for p in result["per_page"]
            },
        }
        print(f"\n{json.dumps(report, indent=2)}")

    sys.exit(0)


if __name__ == "__main__":
    main()
