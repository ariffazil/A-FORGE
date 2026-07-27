#!/usr/bin/env python3
"""
OCR → Ingest → Embed Pipeline — arifOS Federation
==================================================
End-to-end document intelligence pipeline connecting Layer 1 (Perception)
through Layer 2 (Metabolism / RAG).

Flow:
  PDF → PyMuPDF rasterize → OCR Backend → Markdown
      → forge_document_ingest(chunk) → bge-m3 embed → Qdrant

Modes:
  full          — PDF → OCR → ingest → embed (complete pipeline)
  ocr           — PDF → OCR markdown only (stop after Layer 1)
  ingest        — Markdown → forge_document_ingest → embed (Layer 2 only)
  embed         — Chunks JSON → bge-m3 → Qdrant (Layer 2.5 only)
  health        — Probe all pipeline stages

Usage:
  python ocr_pipeline.py --pdf doc.pdf --mode full
  python ocr_pipeline.py --pdf doc.pdf --mode ocr --output /tmp/out
  python ocr_pipeline.py --markdown /tmp/ocr.md --source "contract_v1" --mode ingest
  python ocr_pipeline.py --health

DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

import os
import sys
import json
import time
import shutil
import subprocess
from pathlib import Path
from dataclasses import dataclass, field
from typing import Any

from ocr_engine import (
    pdf_to_images,
    pdf_metadata,
    count_pdf_pages,
    route_ocr,
    OCRRequest,
    BaiduCloudOCR,
    UnlimitedOCRLocal,
    health_check as ocr_health,
)

SCRIPT_DIR = Path(__file__).resolve().parent
EMBED_STORE = SCRIPT_DIR / "embed_store.py"
QUERY_TOOL = SCRIPT_DIR / "query.py"


# ── Stage 1: OCR (Perception) ────────────────────────────────────────


def stage_ocr(pdf_path: str, output_dir: str, **kwargs) -> dict:
    """Run OCR on a PDF, return markdown path + metadata."""
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    meta = pdf_metadata(pdf_path)
    print(f"[PIPELINE] Stage 1/3 OCR: {os.path.basename(pdf_path)}")
    print(f"           {meta['pages']} pages, {meta['file_size_mb']}MB")

    req = OCRRequest(
        file_path=pdf_path,
        output_dir=output_dir,
        pages=meta["pages"],
        **kwargs,
    )

    result = route_ocr(req)

    return {
        "stage": "ocr",
        "file": pdf_path,
        "pages": meta["pages"],
        "file_size_mb": meta["file_size_mb"],
        "backend": result.get("backend", "unknown"),
        "output_dir": output_dir,
        "markdown_path": result.get("local_path", ""),
        "markdown_url": result.get("markdown_url", ""),
    }


# ── Stage 2: Metabolism (forge_document_ingest) ──────────────────────


def stage_ingest(markdown_path: str, source_label: str, output_dir: str) -> dict:
    """
    Feed markdown through forge_document_ingest for chunking.
    Uses A-FORGE MCP tool on :7072.
    """
    print(f"[PIPELINE] Stage 2/3 Ingest: {os.path.basename(markdown_path)}")

    if not os.path.exists(markdown_path):
        raise FileNotFoundError(f"Markdown not found: {markdown_path}")

    content = Path(markdown_path).read_text(encoding="utf-8")
    print(f"           {len(content):,} chars of markdown")

    # Try forge_document_ingest via HTTP (A-FORGE MCP)
    chunks = _call_ingest_http(content, source_label)
    if chunks is None:
        # Fallback: simple chunking
        print("[PIPELINE] forge_document_ingest unavailable, using fallback chunker")
        chunks = _fallback_chunk(content, source_label)

    # Write chunks to JSON
    os.makedirs(output_dir, exist_ok=True)
    chunks_path = os.path.join(output_dir, "chunks.json")
    Path(chunks_path).write_text(json.dumps(chunks, indent=2), encoding="utf-8")

    print(f"           {len(chunks)} chunks → {chunks_path}")
    return {
        "stage": "ingest",
        "chunks_count": len(chunks),
        "chunks_path": chunks_path,
        "source": source_label,
    }


def _call_ingest_http(content: str, source: str) -> list[dict] | None:
    """Call forge_document_ingest via A-FORGE MCP HTTP API."""
    import base64
    from urllib.request import Request, urlopen

    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "forge_document_ingest",
            "arguments": {
                "content_base64": base64.b64encode(content.encode()).decode(),
                "mode": "chunk",
                "chunk_strategy": "semantic",
                "chunk_size": "2000",
                "overlap": "200",
                "output_format": "json",
            },
        },
    }

    try:
        req = Request(
            "http://localhost:7072/mcp",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(req, timeout=60) as r:
            resp = json.loads(r.read())

        result_text = resp.get("result", {}).get("content", [{}])[0].get("text", "")
        if not result_text:
            return None

        result = json.loads(result_text)
        if isinstance(result, list):
            return result
        if isinstance(result, dict):
            return result.get("chunks", result.get("structured_content", []))
        return None
    except Exception as e:
        print(f"[PIPELINE] forge_document_ingest HTTP error: {e}", file=sys.stderr)
        return None


def _fallback_chunk(
    content: str, source: str, chunk_size: int = 2000, overlap: int = 200
) -> list[dict]:
    """Simple section-based chunker when forge_document_ingest is unavailable."""
    chunks = []
    sections = content.split("\n## ")
    if len(sections) == 1:
        sections = content.split("\n# ")

    title = sections[0].strip() if sections else "Untitled"

    for i, section in enumerate(sections):
        text = f"## {section}" if i > 0 else section
        text = text.strip()
        if len(text) < 50:
            continue

        # Sub-chunk long sections
        if len(text) > chunk_size:
            for j in range(0, len(text), chunk_size - overlap):
                sub = text[j : j + chunk_size]
                if len(sub) < 50:
                    continue
                chunks.append(
                    {
                        "chunk_id": f"{source}_chunk_{i}_{j // (chunk_size - overlap)}",
                        "text": sub,
                        "heading": title,
                        "pages": [],
                        "size_chars": len(sub),
                    }
                )
        else:
            chunks.append(
                {
                    "chunk_id": f"{source}_chunk_{i}",
                    "text": text,
                    "heading": title,
                    "pages": [],
                    "size_chars": len(text),
                }
            )

    return chunks


# ── Stage 3: Embed & Store (RAG) ─────────────────────────────────────


def stage_embed(chunks_path: str, source: str) -> dict:
    """Feed chunks to embed_store.py for bge-m3 → Qdrant."""
    print(f"[PIPELINE] Stage 3/3 Embed: {os.path.basename(chunks_path)}")

    if not os.path.exists(chunks_path):
        raise FileNotFoundError(f"Chunks file not found: {chunks_path}")

    result = subprocess.run(
        [sys.executable, str(EMBED_STORE), chunks_path, "--source", source],
        capture_output=True,
        text=True,
        timeout=300,
    )

    if result.returncode != 0:
        print(f"[PIPELINE] Embed store failed: {result.stderr[:500]}", file=sys.stderr)
        return {
            "stage": "embed",
            "status": "FAILED",
            "error": result.stderr[:500],
            "chunks_path": chunks_path,
        }

    try:
        receipt = json.loads(result.stdout.strip().split("\n")[-1])
    except json.JSONDecodeError:
        receipt = {"raw_output": result.stdout.strip()}

    print(f"           {receipt.get('chunks_stored', '?')} vectors stored")
    return {
        "stage": "embed",
        "status": "OK",
        "chunks_stored": receipt.get("chunks_stored", 0),
        "vectors_per_second": receipt.get("vectors_per_second", 0),
        "receipt": receipt,
    }


# ── Full Pipeline ────────────────────────────────────────────────────


@dataclass
class PipelineResult:
    mode: str
    source: str
    stages_completed: list[str]
    ocr: dict | None = None
    ingest: dict | None = None
    embed: dict | None = None
    error: str | None = None
    elapsed_s: float = 0


def run_pipeline(
    pdf_path: str, output_dir: str, source: str = "", mode: str = "full", **kwargs
) -> PipelineResult:
    """
    Run the full EMD document intelligence pipeline.

    Modes:
      full    → OCR → Ingest → Embed (all 3 stages)
      ocr     → OCR only
      ingest  → Ingest + Embed (from existing markdown)
      embed   → Embed only (from chunks JSON)
    """
    t0 = time.monotonic()
    os.makedirs(output_dir, exist_ok=True)

    if not source:
        source = os.path.splitext(os.path.basename(pdf_path))[0]

    result = PipelineResult(mode=mode, source=source, stages_completed=[])
    markdown = ""  # type: str

    try:
        if mode in ("full", "ocr"):
            ocr_output = os.path.join(output_dir, "ocr")
            result.ocr = stage_ocr(pdf_path, ocr_output, **kwargs)
            result.stages_completed.append("ocr")

            if mode == "ocr":
                result.elapsed_s = round(time.monotonic() - t0, 1)
                return result

            markdown = result.ocr.get("markdown_path", "")
            if not markdown:
                raise RuntimeError("OCR produced no markdown output")

        if mode in ("full", "ingest"):
            # "full": use OCR output markdown. "ingest": pdf_path IS the markdown.
            md_input: str = markdown if mode == "full" else pdf_path

            ingest_output = os.path.join(output_dir, "ingest")
            result.ingest = stage_ingest(md_input, source, ingest_output)
            result.stages_completed.append("ingest")

        if mode in ("full", "ingest", "embed"):
            if mode == "embed":
                chunks = pdf_path  # In embed mode, pdf_path is the chunks JSON
                result.embed = stage_embed(chunks, source)
            elif result.ingest is not None:
                chunks = result.ingest.get("chunks_path", "")
                if chunks:
                    result.embed = stage_embed(chunks, source)
            result.stages_completed.append("embed")

    except Exception as e:
        result.error = str(e)
        print(f"[PIPELINE] ERROR: {e}", file=sys.stderr)

    result.elapsed_s = round(time.monotonic() - t0, 1)
    return result


# ── Health Probe ──────────────────────────────────────────────────────


def pipeline_health() -> dict:
    """Probe all pipeline stages."""
    h = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "stages": {},
    }

    # Stage 1: OCR backends
    ocr_backends = ocr_health()["backends"]
    h["stages"]["ocr"] = {
        "available": ocr_health().get("any_ocr_available", False),
        "status": "ready" if ocr_health().get("any_ocr_available") else "no_backend",
        "backends": ocr_backends,
    }

    # Stage 2: forge_document_ingest
    h["stages"]["ingest"] = {"available": False, "status": "unknown"}
    try:
        from urllib.request import urlopen, Request

        payload = json.dumps(
            {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}
        ).encode()
        req = Request(
            "http://localhost:7072/mcp",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(req, timeout=5) as r:
            tools = json.loads(r.read()).get("result", {}).get("tools", [])
            has_ingest = any("document_ingest" in t.get("name", "") for t in tools)
            h["stages"]["ingest"] = {
                "available": has_ingest,
                "status": "ready" if has_ingest else "tool_missing",
            }
    except Exception as e:
        h["stages"]["ingest"]["status"] = f"not_responding: {e}"

    # Stage 3: Ollama + Qdrant
    try:
        r = subprocess.run(
            [sys.executable, str(EMBED_STORE), "--health"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        embed_ok = r.returncode == 0
        h["stages"]["embed"] = {
            "available": embed_ok,
            "status": "ready" if embed_ok else "unhealthy",
        }
    except Exception:
        h["stages"]["embed"] = {"available": False, "status": "not_responding"}

    h["all_stages_ok"] = all(s.get("available", False) for s in h["stages"].values())
    return h


# ── CLI ───────────────────────────────────────────────────────────────


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="OCR → Ingest → Embed Pipeline — arifOS Federation"
    )
    parser.add_argument("--pdf", help="Path to PDF or markdown file")
    parser.add_argument("--markdown", help="Path to markdown file (for ingest mode)")
    parser.add_argument("--chunks", help="Path to chunks JSON file (for embed mode)")
    parser.add_argument(
        "--output", "-o", default="/tmp/ocr_pipeline", help="Output directory"
    )
    parser.add_argument(
        "--source", "-s", default="", help="Source label (defaults to filename)"
    )
    parser.add_argument(
        "--mode",
        "-m",
        default="full",
        choices=["full", "ocr", "ingest", "embed"],
        help="Pipeline mode",
    )
    parser.add_argument(
        "--backend",
        default="",
        help="Force OCR backend: baidu_cloud, unlimited_local, qwen25_vl",
    )
    parser.add_argument(
        "--bbox", action="store_true", help="Document requires bounding box output"
    )
    parser.add_argument(
        "--financial", action="store_true", help="Document contains financial figures"
    )
    parser.add_argument("--dpi", type=int, default=300, help="PDF rasterization DPI")
    parser.add_argument("--health", action="store_true", help="Probe pipeline health")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    if args.health:
        h = pipeline_health()
        if args.json:
            print(json.dumps(h, indent=2))
        else:
            print("=== Pipeline Health ===")
            for stage, info in h["stages"].items():
                icon = "✅" if info.get("available") else "❌"
                print(f"  {icon} {stage}: {info.get('status', '?')}")
            print(f"\n  All stages: {'✅' if h['all_stages_ok'] else '❌'}")
        sys.exit(0 if h["all_stages_ok"] else 1)

    # Determine input file based on mode
    input_file = args.pdf or args.markdown or args.chunks
    if not input_file:
        parser.print_help()
        sys.exit(1)

    if not os.path.exists(input_file):
        print(f"[FATAL] File not found: {input_file}", file=sys.stderr)
        sys.exit(1)

    result = run_pipeline(
        pdf_path=input_file,
        output_dir=args.output,
        source=args.source,
        mode=args.mode,
        dpi=args.dpi,
        requires_bbox=args.bbox,
        is_financial=args.financial,
        force_backend=args.backend,
    )

    # Output
    if result.error:
        print(f"\n[PIPELINE] ❌ FAILED: {result.error}")
        sys.exit(1)

    if args.json:
        out = {
            "mode": result.mode,
            "source": result.source,
            "stages": result.stages_completed,
            "elapsed_s": result.elapsed_s,
        }
        if result.ocr:
            out["ocr"] = result.ocr
        if result.ingest:
            out["ingest"] = result.ingest
        if result.embed:
            out["embed"] = result.embed
        print(json.dumps(out, indent=2, default=str))
    else:
        print(f"\n[PIPELINE] ✅ Complete: {result.mode}")
        print(f"           Stages: {' → '.join(result.stages_completed)}")
        print(f"           Time: {result.elapsed_s}s")
        if result.ocr:
            print(f"           Backend: {result.ocr.get('backend', '?')}")
            print(f"           Pages: {result.ocr.get('pages', '?')}")
        if result.ingest:
            print(f"           Chunks: {result.ingest.get('chunks_count', 0)}")
        if result.embed:
            print(f"           Vectors: {result.embed.get('chunks_stored', 0)}")

    sys.exit(0)


if __name__ == "__main__":
    main()
