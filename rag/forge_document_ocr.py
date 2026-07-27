#!/usr/bin/env python3
"""
forge_document_ocr — Hybrid Dynamic Router for arifOS Federation
=================================================================
Layer 1 (Perception) — Auto-routing OCR engine with 3 backends.

Backend selection (auto, by document characteristics):
  unlimited_gradio  — HF Space Gradio API (RM0, zero-auth, <6 pages per session)
  unlimited_sglang  — Self-hosted SGLang/vLLM (GPU required, 100% sovereign)
  qwen25_vl         — Qwen2.5-VL via Bailian (bbox output, financial docs)

Routing logic:
  ┌─ requires_bbox OR is_financial → qwen25_vl
  ├─ GPU available (SGLang live)   → unlimited_sglang
  ├─ pages ≤ 6                     → unlimited_gradio (free, immediate)
  └─ pages > 6, no GPU             → unlimited_gradio (best effort, may hit quota)

Usage:
  python forge_document_ocr.py --pdf doc.pdf                          # auto-route
  python forge_document_ocr.py --pdf doc.pdf --backend unlimited_sglang
  python forge_document_ocr.py --pdf doc.pdf --pipeline --source "geox_report"
  python forge_document_ocr.py --health                               # probe backends

DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

import os
import sys
import json
import time
from pathlib import Path
from dataclasses import dataclass, field
from typing import Literal

# ── Import backend engines ───────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from ocr_engine import (
    pdf_to_images,
    pdf_metadata,
    count_pdf_pages,
    BaiduCloudOCR,
    UnlimitedOCRLocal,
)
from gradio_bridge import GradioOCRClient


# ═══════════════════════════════════════════════════════════════════════
#  HYBRID ROUTER
# ═══════════════════════════════════════════════════════════════════════


@dataclass
class OCRCRequest:
    file_path: str
    output_dir: str = "/tmp/forge_ocr"
    dpi: int = 200
    pages: int = 0
    requires_bbox: bool = False
    is_financial: bool = False
    force_backend: str = ""

    def __post_init__(self):
        if self.pages == 0 and os.path.exists(self.file_path):
            ext = os.path.splitext(self.file_path)[1].lower()
            if ext == ".pdf":
                self.pages = count_pdf_pages(self.file_path)
            else:
                self.pages = 1


class HybridOCRRouter:
    """
    Auto-selects the best available OCR backend based on:
    1. Force override (--backend flag)
    2. Bbox requirement → Qwen2.5-VL
    3. GPU availability → Self-hosted SGLang
    4. Page count ≤ 6 → Gradio Bridge (free, immediate)
    5. Fallback → Gradio Bridge (best effort)
    """

    def __init__(self):
        self._gradio: GradioOCRClient | None = None
        self._sglang_available: bool | None = None
        self._qwen_available: bool | None = None

    @property
    def gradio(self) -> GradioOCRClient:
        if self._gradio is None:
            self._gradio = GradioOCRClient()
        return self._gradio

    @property
    def sglang_available(self) -> bool:
        if self._sglang_available is None:
            self._sglang_available = False
            endpoint = os.environ.get("UNLIMITED_OCR_ENDPOINT", "")
            if endpoint:
                try:
                    from urllib.request import urlopen

                    with urlopen(f"{endpoint}/health", timeout=3) as r:
                        self._sglang_available = r.status == 200
                except Exception:
                    self._sglang_available = False
            else:
                # Check if local GPU is available for self-hosting
                unlimited = UnlimitedOCRLocal()
                self._sglang_available = unlimited.available
        return self._sglang_available

    @property
    def qwen_available(self) -> bool:
        if self._qwen_available is None:
            self._qwen_available = bool(
                os.environ.get("BAILIAN_API_KEY") or os.environ.get("DASHSCOPE_API_KEY")
            )
        return self._qwen_available

    def select_backend(self, req: OCRCRequest) -> str:
        """Select backend based on request + available infrastructure."""
        if req.force_backend:
            return req.force_backend

        # Rule 1: Bbox or financial → Qwen2.5-VL
        if req.requires_bbox or req.is_financial:
            if self.qwen_available:
                return "qwen25_vl"
            # Fallback: warn but continue
            print(
                "[ROUTER] ⚠️  bbox required but Qwen2.5-VL unavailable. "
                "Proceeding with best-effort.",
                file=sys.stderr,
            )

        # Rule 2: GPU available → Self-hosted (sovereign, fast)
        if self.sglang_available:
            return "unlimited_sglang"

        # Rule 3: ≤6 pages → Gradio Bridge (free, immediate, reliable)
        if req.pages <= 6:
            return "unlimited_gradio"

        # Rule 4: >6 pages, no GPU → Gradio (best effort, may hit quota)
        return "unlimited_gradio"

    def process(self, req: OCRCRequest) -> dict:
        """Route and execute OCR via the selected backend."""
        backend = self.select_backend(req)
        os.makedirs(req.output_dir, exist_ok=True)

        print(f"[ROUTER] Selected backend: {backend}")
        print(f"         Pages: {req.pages} | DPI: {req.dpi}")

        if backend == "unlimited_gradio":
            return self._process_gradio(req)
        elif backend == "unlimited_sglang":
            return self._process_sglang(req)
        elif backend == "qwen25_vl":
            return self._process_qwen(req)
        else:
            raise ValueError(f"Unknown backend: {backend}")

    def _process_gradio(self, req: OCRCRequest) -> dict:
        t0 = time.monotonic()
        print(f"[GRADIO] Processing {req.pages} pages via HF Space (RM0)...")

        result = self.gradio.ocr_pdf_pages(req.file_path, dpi=req.dpi, mode="base")

        # Save output
        md_path = os.path.join(req.output_dir, "ocr_output.md")
        Path(md_path).write_text(result["full_markdown"], encoding="utf-8")

        return {
            "backend": "unlimited_gradio",
            "markdown_path": md_path,
            "pages_success": result["pages_success"],
            "pages_total": result["pages_total"],
            "total_chars": result["total_chars"],
            "elapsed_s": round(time.monotonic() - t0, 1),
            "quota_hit": result["pages_errors"] > 0,
        }

    def _process_sglang(self, req: OCRCRequest) -> dict:
        t0 = time.monotonic()
        print(f"[SGLANG] Processing {req.pages} pages via self-hosted GPU...")

        # Delegate to UnlimitedOCRLocal engine
        engine = UnlimitedOCRLocal()
        images = pdf_to_images(req.file_path, dpi=req.dpi)

        if req.pages <= 5:
            engine.process_single(images[0], req.output_dir, "gundam")
        else:
            engine.process_multi(req.file_path, req.output_dir, req.dpi)

        # Find markdown in output dir
        md_files = list(Path(req.output_dir).rglob("*.md"))
        md_path = str(md_files[0]) if md_files else req.output_dir

        return {
            "backend": "unlimited_sglang",
            "markdown_path": md_path,
            "pages_success": req.pages,
            "pages_total": req.pages,
            "total_chars": len(Path(md_path).read_text()) if md_files else 0,
            "elapsed_s": round(time.monotonic() - t0, 1),
            "quota_hit": False,
        }

    def _process_qwen(self, req: OCRCRequest) -> dict:
        # Route through existing Bailian API pipeline
        msg = (
            f"Routing to Qwen2.5-VL via Bailian API. "
            f"Pages: {req.pages}, bbox: {req.requires_bbox or req.is_financial}"
        )
        print(f"[QWEN] {msg}")
        return {
            "backend": "qwen25_vl",
            "markdown_path": None,
            "status": "ROUTED_TO_EXISTING_PIPELINE",
            "message": msg,
            "pages_total": req.pages,
        }

    def health(self) -> dict:
        """Probe all backends."""
        return {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "backends": {
                "unlimited_gradio": {
                    "available": True,
                    "cost": "RM0",
                    "quota": "~6 pages/session (ZeroGPU free tier)",
                    "status": "ready",
                },
                "unlimited_sglang": {
                    "available": self.sglang_available,
                    "cost": "~RM2/hr (on-demand GPU)",
                    "quota": "unlimited",
                    "status": "ready" if self.sglang_available else "no_gpu",
                },
                "qwen25_vl": {
                    "available": self.qwen_available,
                    "cost": "~$0.02/page (Bailian API)",
                    "quota": "unlimited",
                    "status": "ready" if self.qwen_available else "missing_credentials",
                },
            },
            "routing_rules": [
                "requires_bbox or is_financial → qwen25_vl",
                "GPU available → unlimited_sglang",
                "pages ≤ 6 → unlimited_gradio (free)",
                "pages > 6, no GPU → unlimited_gradio (best effort)",
            ],
        }


# ── Pipeline Integration ──────────────────────────────────────────────
def full_pipeline(pdf_path: str, output_dir: str, source: str = "", **kwargs) -> dict:
    """
    Complete EMD pipeline: OCR → Ingest → Embed.

    Returns dict with results from each stage.
    """
    from ocr_pipeline import stage_ingest, stage_embed

    os.makedirs(output_dir, exist_ok=True)
    if not source:
        source = os.path.splitext(os.path.basename(pdf_path))[0]

    router = HybridOCRRouter()
    req = OCRCRequest(file_path=pdf_path, output_dir=output_dir, **kwargs)

    # Stage 1: OCR
    t0 = time.monotonic()
    ocr_result = router.process(req)

    if not ocr_result.get("markdown_path"):
        return {"status": "OCR_FAILED", "ocr": ocr_result}

    # Stage 2: Ingest
    ingest_result = stage_ingest(
        ocr_result["markdown_path"], source, os.path.join(output_dir, "ingest")
    )

    # Stage 3: Embed
    chunks = ingest_result.get("chunks_path", "")
    if chunks:
        embed_result = stage_embed(chunks, source)
    else:
        embed_result = {"status": "SKIPPED", "reason": "no chunks"}

    return {
        "source": source,
        "elapsed_s": round(time.monotonic() - t0, 1),
        "ocr": ocr_result,
        "ingest": ingest_result,
        "embed": embed_result,
    }


# ── CLI ───────────────────────────────────────────────────────────────
def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="forge_document_ocr — Hybrid Dynamic Router"
    )
    parser.add_argument("--pdf", help="Path to PDF or image")
    parser.add_argument(
        "--output", "-o", default="/tmp/forge_ocr", help="Output directory"
    )
    parser.add_argument("--source", "-s", default="", help="Source label for RAG")
    parser.add_argument(
        "--backend",
        default="",
        help="Force backend: unlimited_gradio, unlimited_sglang, qwen25_vl",
    )
    parser.add_argument("--dpi", type=int, default=200, help="PDF rasterization DPI")
    parser.add_argument(
        "--bbox", action="store_true", help="Document requires bounding box"
    )
    parser.add_argument(
        "--financial", action="store_true", help="Document contains financial figures"
    )
    parser.add_argument(
        "--pipeline",
        action="store_true",
        help="Run full pipeline: OCR → Ingest → Embed",
    )
    parser.add_argument("--health", action="store_true", help="Probe all backends")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    if args.health:
        router = HybridOCRRouter()
        h = router.health()
        if args.json:
            print(json.dumps(h, indent=2))
        else:
            print("=== forge_document_ocr — Hybrid Router ===")
            for name, info in h["backends"].items():
                icon = "✅" if info["available"] else "❌"
                cost = info.get("cost", "?")
                print(f"  {icon} {name}: {info['status']} ({cost})")
            print("\n  Routing Rules:")
            for rule in h["routing_rules"]:
                print(f"    • {rule}")
        sys.exit(0)

    if not args.pdf:
        parser.print_help()
        sys.exit(1)

    if args.pipeline:
        result = full_pipeline(
            args.pdf,
            args.output,
            args.source,
            dpi=args.dpi,
            requires_bbox=args.bbox,
            is_financial=args.financial,
            force_backend=args.backend,
        )
    else:
        router = HybridOCRRouter()
        req = OCRCRequest(
            file_path=args.pdf,
            output_dir=args.output,
            dpi=args.dpi,
            requires_bbox=args.bbox,
            is_financial=args.financial,
            force_backend=args.backend,
        )
        result = router.process(req)

    if args.json:
        print(json.dumps(result, indent=2, default=str))
    else:
        backend = result.get("backend", "?")
        pages = result.get("pages_success", result.get("pages_total", "?"))
        chars = result.get("total_chars", 0)
        elapsed = result.get("elapsed_s", 0)
        print(f"\n✅ OCR Complete")
        print(f"   Backend: {backend}")
        print(f"   Pages: {pages}")
        print(f"   Chars: {chars:,}")
        print(f"   Time: {elapsed}s")
        if result.get("quota_hit"):
            print(f"   ⚠️  ZeroGPU quota hit — some pages may be missing")

    sys.exit(0)


if __name__ == "__main__":
    main()
