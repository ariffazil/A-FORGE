#!/usr/bin/env python3
"""
UOCR Bridge v2 — Baidu Unlimited-OCR-2 via Hugging Face ZeroGPU Space
=============================================================================
Horizon-aware client for the Baidu Unlimited-OCR-2 Gradio Space.

WHY THIS FILE EXISTS (2026-10-28)
---------------------------------
The live `rag/gradio_bridge.py` targets the v1 Space (`baidu/Unlimited-OCR`,
endpoint `/run_ocr`). Baidu released v2 on 2026-10-27 with a different surface:

    v1  Space : baidu/Unlimited-OCR     endpoint: /run_ocr
     args: (image, mode, prompt)
    v2  Space : baidu/Unlimited-OCR-2   endpoints: /parse_page, /parse_document,
     /explode_pdf
     args: (image, instruction, mode, max_page_tokens)

`rag/ocr_document.py` additionally points at a raw URL that now returns HTTP 404
(`https://baidu-unlimited-ocr.hf.space/api/ocr`).

The substantive difference is HORIZON, not version:
  - `/parse_page`     -> one image per request
  - `/parse_document` -> ALL pages of a document in ONE request, so the model's
                        SR-SWA attention can use cross-page context.

This client adds the horizon concept, probes the endpoint surface before use
(fail-closed), and reports measured timings -- no hardcoded "ready" status.

SPACE LIMITS (read from the Space's own app.py, 2026-10-28):
  MAX_DOC_PAGES    = 20     (hard cap -- a 107-page document CANNOT be one request)
  ZeroGPU quota    = 2 min/day unauthenticated, 5 min/day with a free HF token
  DOC_SECONDS      = 180 (<=2 pages) / 600 (<=8) / 1500 (<=20)
  Single page      = 60 s GPU budget

Consequence: `/parse_document` is a 20-page horizon, not a 300-page horizon.
Documents longer than 20 pages must be chunked -- and chunk boundaries are where
cross-page context is LOST. This is a measured limit of the FREE LANE, not a
property of the model (the model card reports 131,072 positions; Baidu's own
leaderboard uses 100+ page documents on self-hosted SGLang).

DITEMPA BUKAN DIBERI -- Forged, Not Given.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# -- Configuration -------------------------------------------------------
DEFAULT_SPACE = os.environ.get("UOCR_SPACE", "baidu/Unlimited-OCR-2")
DEFAULT_DPI = int(os.environ.get("UOCR_DPI", "200"))
DEFAULT_MODE = os.environ.get("UOCR_MODE", "auto")  # auto | gundam | base
MAX_DOC_PAGES = int(os.environ.get("UOCR_MAX_DOC_PAGES", "20"))
DEFAULT_MAX_PAGE_TOKENS = int(os.environ.get("UOCR_MAX_PAGE_TOKENS", "20000"))

SCRIPT_DIR = Path(__file__).resolve().parent


class UocrUnavailable(RuntimeError):
    """Raised when the Space surface is not usable. Never silently swallowed."""


@dataclass
class UocrResult:
    """One measured OCR call. Every field is observed, not asserted."""

    horizon: str  # "page" | "document"
    ok: bool
    secs: float
    text: str = ""
    pages: int = 0
    engine: str = ""
    endpoint: str = ""
    space: str = ""
    error: str = ""
    truncated: bool = False
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "horizon": self.horizon,
            "ok": self.ok,
            "secs": self.secs,
            "pages": self.pages,
            "engine": self.engine,
            "endpoint": self.endpoint,
            "space": self.space,
            "error": self.error,
            "truncated": self.truncated,
            "chars": len(self.text),
            "meta": self.meta,
        }


# -- Surface probe (fail-closed) ----------------------------------------
def probe_space(space: str = DEFAULT_SPACE) -> dict[str, Any]:
    """
    Read the Space's live API surface. Never assume an endpoint exists.

    Returns a dict with `ok`, `endpoints`, and `space`. On failure `ok` is
    False and `error` explains why -- the caller must HOLD, not fall back to a
    hardcoded URL.
    """
    import urllib.request

    slug = space.replace("/", "-").lower()
    url = f"https://{slug}.hf.space/gradio_api/info"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "arifOS/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
    except Exception as exc:  # noqa: BLE001 -- reported, not hidden
        return {
            "ok": False,
            "space": space,
            "url": url,
            "error": f"{type(exc).__name__}: {exc}",
            "endpoints": [],
        }

    endpoints = list((data.get("named_endpoints") or {}).keys())
    return {
        "ok": bool(endpoints),
        "space": space,
        "url": url,
        "endpoints": endpoints,
        "error": "" if endpoints else "space exposes no named endpoints",
    }


def require_endpoint(space: str, endpoint: str) -> None:
    """Fail closed: raise if the endpoint we intend to call is not exposed."""
    surface = probe_space(space)
    if not surface["ok"]:
        raise UocrUnavailable(
            f"space {space} unreachable: {surface.get('error', 'unknown')}"
        )
    if endpoint not in surface["endpoints"]:
        raise UocrUnavailable(
            f"space {space} does not expose {endpoint}; "
            f"live endpoints: {surface['endpoints']}"
        )


# -- PDF rasterizer ------------------------------------------------------
def pdf_to_images(pdf_path: str, dpi: int = DEFAULT_DPI) -> list[str]:
    """Rasterize PDF pages to PNG. Uses a private temp dir (not /tmp)."""
    import tempfile

    import fitz  # PyMuPDF

    doc = fitz.open(pdf_path)
    tmp_dir = tempfile.mkdtemp(prefix="uocr_v2_")
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    paths: list[str] = []
    for i, page in enumerate(doc):
        out = os.path.join(tmp_dir, f"page_{i + 1:04d}.png")
        page.get_pixmap(matrix=mat).save(out)
        paths.append(out)
    doc.close()
    return paths


# -- Client --------------------------------------------------------------
class UocrClient:
    """Horizon-aware client for the Unlimited-OCR-2 Space."""

    def __init__(self, space: str = DEFAULT_SPACE, max_doc_pages: int = MAX_DOC_PAGES):
        self.space = space
        self.max_doc_pages = max_doc_pages
        self._client = None

    def _get_client(self):
        if self._client is None:
            from gradio_client import Client

            self._client = Client(self.space)
        return self._client

    # -- horizon: single page --------------------------------------------
    def parse_page(
        self,
        image_path: str,
        instruction: str = "document parsing.",
        mode: str = DEFAULT_MODE,
        max_page_tokens: int = DEFAULT_MAX_PAGE_TOKENS,
    ) -> UocrResult:
        from gradio_client import handle_file

        require_endpoint(self.space, "/parse_page")
        t0 = time.monotonic()
        try:
            raw = self._get_client().predict(
                handle_file(image_path),
                instruction,
                mode,
                max_page_tokens,
                api_name="/parse_page",
            )
        except Exception as exc:  # noqa: BLE001 -- reported in the result
            return UocrResult(
                horizon="page",
                ok=False,
                secs=round(time.monotonic() - t0, 1),
                engine="unlimited-ocr-2",
                endpoint="/parse_page",
                space=self.space,
                error=f"{type(exc).__name__}: {exc}",
            )
        return UocrResult(
            horizon="page",
            ok=True,
            secs=round(time.monotonic() - t0, 1),
            text=str(raw),
            pages=1,
            engine="unlimited-ocr-2",
            endpoint="/parse_page",
            space=self.space,
        )

    # -- horizon: whole document in ONE request ---------------------------
    def parse_document(
        self,
        image_paths: list[str],
        instruction: str = "Multi page parsing.",
        mode: str = DEFAULT_MODE,
        max_page_tokens: int = DEFAULT_MAX_PAGE_TOKENS,
    ) -> UocrResult:
        """
        Parse every page of a document in ONE request so the model can use
        cross-page context (the whole point of SR-SWA).

        HARD LIMIT: the Space caps a document at MAX_DOC_PAGES (20). Longer
        documents are chunked by the caller; chunk boundaries lose cross-page
        context, so `truncated` / `chunks` is reported honestly.
        """
        from gradio_client import handle_file

        if not image_paths:
            return UocrResult(
                horizon="document",
                ok=False,
                secs=0.0,
                engine="unlimited-ocr-2",
                endpoint="/parse_document",
                space=self.space,
                error="no images supplied",
            )

        require_endpoint(self.space, "/parse_document")

        chunks = [
            image_paths[i : i + self.max_doc_pages]
            for i in range(0, len(image_paths), self.max_doc_pages)
        ]
        parts: list[str] = []
        t0 = time.monotonic()
        errors: list[str] = []

        for idx, chunk in enumerate(chunks):
            try:
                raw = self._get_client().predict(
                    [handle_file(p) for p in chunk],
                    instruction,
                    mode,
                    max_page_tokens,
                    api_name="/parse_document",
                )
                parts.append(str(raw))
            except Exception as exc:  # noqa: BLE001
                errors.append(f"chunk{idx + 1}: {type(exc).__name__}: {exc}")

        text = "\n\n".join(p for p in parts if p.strip())
        return UocrResult(
            horizon="document",
            ok=bool(text) and not errors,
            secs=round(time.monotonic() - t0, 1),
            text=text,
            pages=len(image_paths),
            engine="unlimited-ocr-2",
            endpoint="/parse_document",
            space=self.space,
            error="; ".join(errors),
            truncated=len(chunks) > 1,
            meta={
                "chunks": len(chunks),
                "chunk_size": self.max_doc_pages,
                "cross_page_context": len(chunks) == 1,
            },
        )

    # -- convenience: PDF at document horizon -----------------------------
    def parse_pdf(
        self,
        pdf_path: str,
        horizon: str = "document",
        instruction: str = "",
        mode: str = DEFAULT_MODE,
        dpi: int = DEFAULT_DPI,
    ) -> UocrResult:
        images = pdf_to_images(pdf_path, dpi=dpi)
        if horizon == "page":
            out = self.parse_page(images[0], instruction or "document parsing.", mode)
        else:
            out = self.parse_document(
                images, instruction or "Multi page parsing.", mode
            )
        out.meta["pdf"] = pdf_path
        out.meta["dpi"] = dpi
        out.meta["pages_rasterized"] = len(images)
        return out


# -- CLI -----------------------------------------------------------------
def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(
        description="UOCR Bridge v2 -- Unlimited-OCR-2 horizon-aware client"
    )
    parser.add_argument("--pdf", help="PDF to OCR")
    parser.add_argument("--image", help="single image to OCR")
    parser.add_argument(
        "--horizon", choices=["page", "document"], default="document"
    )
    parser.add_argument("--space", default=DEFAULT_SPACE)
    parser.add_argument("--mode", default=DEFAULT_MODE)
    parser.add_argument("--dpi", type=int, default=DEFAULT_DPI)
    parser.add_argument("--health", action="store_true", help="probe the Space surface")
    args = parser.parse_args()

    if args.health:
        surface = probe_space(args.space)
        print(json.dumps(surface, indent=1))
        return 0 if surface["ok"] else 2

    client = UocrClient(space=args.space)

    if args.image:
        res = client.parse_page(args.image, mode=args.mode)
    elif args.pdf:
        res = client.parse_pdf(
            args.pdf, horizon=args.horizon, mode=args.mode, dpi=args.dpi
        )
    else:
        parser.error("need --pdf, --image, or --health")
        return 2

    print(json.dumps(res.to_dict(), indent=1, ensure_ascii=False))
    if res.ok and args.pdf:
        out_dir = Path(os.environ.get("UOCR_OUT_DIR", "/root/A-FORGE/data/uocr"))
        out_dir.mkdir(parents=True, exist_ok=True)
        stem = Path(args.pdf).stem
        suffix = "doc" if args.horizon == "document" else "page"
        (out_dir / f"{stem}.{suffix}.md").write_text(res.text, encoding="utf-8")
        print(f"[uocr] wrote {out_dir / f'{stem}.{suffix}.md'}")
    return 0 if res.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
