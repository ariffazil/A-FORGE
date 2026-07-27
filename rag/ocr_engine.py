#!/usr/bin/env python3
"""
OCR Perception Engine — arifOS Federation
==========================================
Layer 1 (Perception) of the EMD Document Intelligence Stack.
Routes documents to the correct OCR backend based on available infrastructure.

Backends (auto-selected):
  baidu_cloud     — Baidu Cloud Unlimited-OCR API (async, no local GPU)
  qwen25_vl       — Qwen2.5-VL via Bailian API (bbox output, already billed)
  unlimited_local — Self-hosted Unlimited-OCR via Transformers (needs GPU)
  tesseract       — Tesseract (bundled with forge_document_ingest ocr=true)

Status on af-forge: NO GPU → baidu_cloud (needs API keys) or qwen25_vl (existing)

Usage:
  python ocr_engine.py --pdf doc.pdf --output /tmp/out  # auto-route
  python ocr_engine.py --pdf doc.pdf --backend baidu_cloud --dpi 300
  python ocr_engine.py --health                           # probe backends

DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

import os
import sys
import json
import time
import tempfile
import hashlib
from pathlib import Path
from typing import Literal
from dataclasses import dataclass, field
from urllib.request import Request, urlopen
from urllib.error import URLError

# ── Constants ────────────────────────────────────────────────────────
BAIDU_TOKEN_URL = "https://aip.baidubce.com/oauth/2.0/token"
BAIDU_OCR_SUBMIT = (
    "https://aip.baidubce.com/rest/2.0/brain/online/v2/unlimited-ocr-parser/task"
)
BAIDU_OCR_QUERY = (
    "https://aip.baidubce.com/rest/2.0/brain/online/v2/unlimited-ocr-parser/task/query"
)
BAIDU_OCR_LIMITS = {
    "max_pages": 500,
    "max_file_mb": 100,
    "max_image_mb": 10,
    "max_image_edge_px": 8192,
    "submit_qps": 2,
    "poll_qps": 5,
}
DEFAULT_DPI = 300


# ── HTTP Helpers ─────────────────────────────────────────────────────
def _http_post(
    url: str, payload: dict, headers: dict | None = None, timeout: int = 60
) -> dict | None:
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    req = Request(url, data=json.dumps(payload).encode(), headers=h, method="POST")
    try:
        with urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except URLError as e:
        print(f"[ERROR] {url}: {e}", file=sys.stderr)
        return None


def _http_get(url: str, timeout: int = 30) -> dict | None:
    try:
        req = Request(url)
        with urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except URLError as e:
        print(f"[ERROR] {url}: {e}", file=sys.stderr)
        return None


# ── PDF → Image Rasterizer (PyMuPDF) ─────────────────────────────────
def pdf_to_images(pdf_path: str, dpi: int = DEFAULT_DPI) -> list[str]:
    """
    Rasterize every page of a PDF to high-resolution PNGs.
    Returns list of absolute paths to temporary image files.
    Caller is responsible for cleanup.
    """
    import fitz

    doc = fitz.open(pdf_path)
    tmp_dir = tempfile.mkdtemp(prefix="aforge_ocr_")
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    paths = []
    for i, page in enumerate(doc):
        out = os.path.join(tmp_dir, f"page_{i + 1:04d}.png")
        page.get_pixmap(matrix=mat).save(out)
        paths.append(out)
    doc.close()
    return paths


def count_pdf_pages(pdf_path: str) -> int:
    import fitz

    doc = fitz.open(pdf_path)
    n = len(doc)
    doc.close()
    return n


def pdf_metadata(pdf_path: str) -> dict:
    import fitz

    doc = fitz.open(pdf_path)
    info = {
        "pages": len(doc),
        "file_size_mb": round(os.path.getsize(pdf_path) / (1024 * 1024), 2),
        "metadata": dict(doc.metadata) if doc.metadata else {},
    }
    doc.close()
    return info


# ═══════════════════════════════════════════════════════════════════════
#  BACKEND 1: Baidu Cloud Unlimited-OCR API (Async)
# ═══════════════════════════════════════════════════════════════════════


class BaiduCloudOCR:
    """
    Baidu Cloud Unlimited-OCR — async submit/poll API.
    No local GPU needed. PDFs up to 100MB, 500 pages.

    Requires: BAIDU_OCR_API_KEY + BAIDU_OCR_SECRET_KEY environment variables.
    Free tier available at https://cloud.baidu.com/product/ocr

    Flow: submit(file) → task_id → poll(task_id) → download markdown_url
    """

    def __init__(self, api_key: str = "", secret_key: str = ""):
        self.api_key = api_key or os.environ.get("BAIDU_OCR_API_KEY", "")
        self.secret_key = secret_key or os.environ.get("BAIDU_OCR_SECRET_KEY", "")
        self._access_token: str | None = None
        self._token_expires_at: float = 0

    @property
    def available(self) -> bool:
        return bool(self.api_key and self.secret_key)

    def _get_token(self) -> str:
        now = time.time()
        if self._access_token and now < self._token_expires_at - 60:
            return self._access_token

        resp = _http_post(
            BAIDU_TOKEN_URL,
            {},
            params={
                "grant_type": "client_credentials",
                "client_id": self.api_key,
                "client_secret": self.secret_key,
            },
        )
        if resp is None:
            raise ConnectionError("Baidu OAuth: no response")
        if "error" in resp:
            raise PermissionError(f"Baidu OAuth: {resp.get('error_description', resp)}")

        self._access_token = resp["access_token"]
        self._token_expires_at = now + resp.get("expires_in", 2592000)
        return self._access_token

    def submit(self, file_path: str) -> str:
        """Submit document for OCR. Returns task_id."""
        if not self.available:
            raise RuntimeError(
                "Baidu Cloud OCR not configured. Set BAIDU_OCR_API_KEY "
                "and BAIDU_OCR_SECRET_KEY environment variables."
            )

        import base64

        meta = pdf_metadata(file_path)

        if meta["file_size_mb"] > BAIDU_OCR_LIMITS["max_file_mb"]:
            raise ValueError(
                f"PDF too large: {meta['file_size_mb']}MB > "
                f"{BAIDU_OCR_LIMITS['max_file_mb']}MB limit"
            )
        if meta["pages"] > BAIDU_OCR_LIMITS["max_pages"]:
            raise ValueError(
                f"PDF too long: {meta['pages']} pages > "
                f"{BAIDU_OCR_LIMITS['max_pages']} page limit"
            )

        with open(file_path, "rb") as f:
            b64_data = base64.b64encode(f.read()).decode()

        token = self._get_token()
        resp = _http_post(
            f"{BAIDU_OCR_SUBMIT}?access_token={token}",
            {
                "file_data": b64_data,
                "file_name": os.path.basename(file_path),
            },
            timeout=120,
        )
        if resp is None:
            raise ConnectionError("Baidu OCR submit: no response")
        if resp.get("error_code", 0) != 0:
            raise RuntimeError(
                f"Baidu OCR submit failed: {resp.get('error_msg', resp)}"
            )

        task_id = resp.get("result", {}).get("task_id", "")
        if not task_id:
            raise RuntimeError(f"No task_id in response: {resp}")
        print(f"[BAIDU] Submitted: {os.path.basename(file_path)} → task_id={task_id}")
        return task_id

    def poll(self, task_id: str, timeout_s: int = 600, interval_s: int = 5) -> dict:
        """
        Poll until OCR completes. Returns dict with markdown_url + parse_result_url.
        Raises TimeoutError if exceeds timeout_s.
        """
        token = self._get_token()
        deadline = time.time() + timeout_s

        while time.time() < deadline:
            resp = _http_post(
                f"{BAIDU_OCR_QUERY}?access_token={token}",
                {"task_id": task_id},
                timeout=30,
            )
            if resp is None:
                time.sleep(interval_s)
                continue

            result = resp.get("result", {})
            status = result.get("status", "unknown")

            if status == "success":
                print(f"[BAIDU] OCR complete: task_id={task_id}")
                return result
            if status == "failed":
                raise RuntimeError(
                    f"Baidu OCR failed: {result.get('task_error', 'unknown error')}"
                )

            print(f"[BAIDU] Polling task_id={task_id} status={status}")
            time.sleep(interval_s)

        raise TimeoutError(f"OCR task {task_id} timed out after {timeout_s}s")

    def download_result(self, poll_result: dict, output_dir: str) -> str:
        """Download the markdown output to a local file. Returns file path."""
        os.makedirs(output_dir, exist_ok=True)

        markdown_url = poll_result.get("markdown_url", "")
        if not markdown_url:
            raise RuntimeError("No markdown_url in poll result")

        resp = _http_get(markdown_url)
        if resp is None:
            raise ConnectionError(f"Failed to download markdown from {markdown_url}")

        # The markdown_url might return raw text or JSON
        if isinstance(resp, dict):
            content = json.dumps(resp, indent=2, ensure_ascii=False)
            ext = ".json"
        else:
            content = str(resp)
            ext = ".md"

        out_path = os.path.join(output_dir, f"ocr_output{ext}")
        Path(out_path).write_text(content, encoding="utf-8")
        print(f"[BAIDU] Downloaded: {out_path} ({len(content):,} chars)")
        return out_path

    def process(self, file_path: str, output_dir: str, timeout_s: int = 600) -> dict:
        """Full async flow: submit → poll → download."""
        task_id = self.submit(file_path)
        result = self.poll(task_id, timeout_s=timeout_s)
        markdown_path = self.download_result(result, output_dir)

        return {
            "backend": "baidu_cloud",
            "task_id": task_id,
            "markdown_url": result.get("markdown_url", ""),
            "parse_result_url": result.get("parse_result_url", ""),
            "local_path": markdown_path,
            "pages": pdf_metadata(file_path)["pages"],
        }


# ═══════════════════════════════════════════════════════════════════════
#  BACKEND 2: Self-Hosted Unlimited-OCR (GPU Required)
# ═══════════════════════════════════════════════════════════════════════


class UnlimitedOCRLocal:
    """
    Self-hosted Unlimited-OCR via Hugging Face Transformers.
    REQUIRES: CUDA GPU with 8-12GB+ VRAM.

    af-forge status: NO GPU — this backend is NOT available locally.
    Use when a GPU node is provisioned.
    """

    def __init__(self, model_path: str = "baidu/Unlimited-OCR"):
        self.model_path = model_path
        self._model = None
        self._tokenizer = None

    @property
    def available(self) -> bool:
        try:
            import torch

            return torch.cuda.is_available()
        except ImportError:
            return False

    def _load(self):
        if self._model is not None:
            return
        if not self.available:
            raise RuntimeError(
                "Unlimited-OCR local requires CUDA GPU. "
                "af-forge has no GPU. Use baidu_cloud or qwen25_vl backend."
            )
        import torch
        from transformers import AutoModel, AutoTokenizer

        print(
            f"[UNLIMITED-OCR] Loading {self.model_path} (first run downloads ~6GB)..."
        )
        t0 = time.monotonic()
        self._tokenizer = AutoTokenizer.from_pretrained(
            self.model_path, trust_remote_code=True
        )
        dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
        self._model = (
            AutoModel.from_pretrained(
                self.model_path,
                trust_remote_code=True,
                use_safetensors=True,
                torch_dtype=dtype,
            )
            .eval()
            .cuda()
        )
        elapsed = time.monotonic() - t0
        print(f"[UNLIMITED-OCR] Loaded in {elapsed:.1f}s (dtype={dtype})")

    def process_single(
        self,
        image_path: str,
        output_dir: str,
        mode: Literal["gundam", "base"] = "gundam",
    ) -> str:
        self._load()
        os.makedirs(output_dir, exist_ok=True)

        kwargs = {
            "gundam": {"image_size": 640, "crop_mode": True, "ngram_window": 128},
            "base": {"image_size": 1024, "crop_mode": False, "ngram_window": 128},
        }[mode]

        return self._model.infer(
            self._tokenizer,
            prompt="<image>document parsing.",
            image_file=image_path,
            output_path=output_dir,
            base_size=1024,
            max_length=32768,
            no_repeat_ngram_size=35,
            save_results=True,
            **kwargs,
        )

    def process_multi(
        self, pdf_path: str, output_dir: str, dpi: int = DEFAULT_DPI
    ) -> str:
        self._load()
        os.makedirs(output_dir, exist_ok=True)
        images = pdf_to_images(pdf_path, dpi=dpi)
        print(f"[UNLIMITED-OCR] Rasterized {len(images)} pages at {dpi} DPI")

        return self._model.infer_multi(
            self._tokenizer,
            prompt="<image>Multi page parsing.",
            image_files=images,
            output_path=output_dir,
            image_size=1024,
            max_length=32768,
            no_repeat_ngram_size=35,
            ngram_window=1024,
            save_results=True,
        )


# ═══════════════════════════════════════════════════════════════════════
#  AUTO-ROUTER — picks best available backend
# ═══════════════════════════════════════════════════════════════════════


@dataclass
class OCRRequest:
    file_path: str
    output_dir: str
    pages: int = 0
    dpi: int = DEFAULT_DPI
    requires_bbox: bool = False
    is_financial: bool = False
    force_backend: str = ""


def route_ocr(req: OCRRequest) -> dict:
    """
    Auto-select the best OCR backend based on:
    1. Force override (--backend flag)
    2. Bbox requirement → only Qwen2.5-VL handles this
    3. GPU availability → local Unlimited-OCR if possible
    4. Baidu Cloud API → external Unlimited-OCR if credentials exist
    5. Fallback → Qwen2.5-VL (already billed, already working)

    Returns dict with markdown_path or markdown_text, backend used, and metadata.
    """
    if not os.path.exists(req.file_path):
        raise FileNotFoundError(f"File not found: {req.file_path}")

    if req.pages == 0:
        req.pages = (
            count_pdf_pages(req.file_path) if req.file_path.endswith(".pdf") else 1
        )

    # ── Force override ──
    if req.force_backend:
        return _route_forced(req)

    # ── Bbox required → Qwen2.5-VL only ──
    if req.requires_bbox or req.is_financial:
        return _route_qwen(req)

    # ── Check Unlimited-OCR local (GPU) ──
    unlimited = UnlimitedOCRLocal()
    if unlimited.available:
        return _route_unlimited_local(req, unlimited)

    # ── Check Baidu Cloud API ──
    baidu = BaiduCloudOCR()
    if baidu.available:
        return _route_baidu(req, baidu)

    # ── Fallback: Qwen2.5-VL via Bailian ──
    return _route_qwen(req)


def _route_forced(req: OCRRequest) -> dict:
    backend = req.force_backend
    if backend == "baidu_cloud":
        return _route_baidu(req, BaiduCloudOCR())
    elif backend == "unlimited_local":
        return _route_unlimited_local(req, UnlimitedOCRLocal())
    elif backend in ("qwen25_vl", "qwen"):
        return _route_qwen(req)
    else:
        raise ValueError(
            f"Unknown backend: {backend}. Valid: baidu_cloud, unlimited_local, qwen25_vl"
        )


def _route_unlimited_local(req: OCRRequest, engine: UnlimitedOCRLocal) -> dict:
    os.makedirs(req.output_dir, exist_ok=True)
    if req.pages > 5:
        result = engine.process_multi(req.file_path, req.output_dir, req.dpi)
    else:
        # Single image or few pages — gundam mode
        if req.file_path.lower().endswith(".pdf"):
            paths = pdf_to_images(req.file_path, req.dpi)
            result = engine.process_single(paths[0], req.output_dir, "gundam")
        else:
            result = engine.process_single(req.file_path, req.output_dir, "gundam")

    return {
        "backend": "unlimited_local",
        "markdown_path": req.output_dir,
        "pages": req.pages,
        "dpi": req.dpi,
    }


def _route_baidu(req: OCRRequest, engine: BaiduCloudOCR) -> dict:
    return engine.process(req.file_path, req.output_dir)


def _route_qwen(req: OCRRequest) -> dict:
    """
    Qwen2.5-VL via Bailian API — existing integration.
    Currently requires manual pipeline. This stub documents the interface.
    """
    msg = (
        "Qwen2.5-VL routing: Use existing Bailian API pipeline.\n"
        "The forge_document_ingest tool (mode=analyze) accepts images directly.\n"
        f"File: {req.file_path}\n"
        f"Pages: {req.pages}\n"
        f"Bbox required: {req.requires_bbox or req.is_financial}\n"
    )
    print(f"[QWEN-ROUTE] {msg}", file=sys.stderr)
    return {
        "backend": "qwen25_vl",
        "status": "ROUTED_TO_EXISTING_PIPELINE",
        "message": msg,
        "pages": req.pages,
    }


# ── Health Probe ──────────────────────────────────────────────────────


def health_check() -> dict:
    """Probe all OCR backends for availability."""
    result = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "host": os.uname().nodename,
        "backends": {},
    }

    # Unlimited-OCR local
    unlimited = UnlimitedOCRLocal()
    result["backends"]["unlimited_local"] = {
        "available": unlimited.available,
        "requires": "CUDA GPU (8-12GB VRAM)",
        "status": "ready" if unlimited.available else "no_gpu_on_af_forge",
    }

    # Baidu Cloud
    baidu = BaiduCloudOCR()
    result["backends"]["baidu_cloud"] = {
        "available": baidu.available,
        "requires": "BAIDU_OCR_API_KEY + BAIDU_OCR_SECRET_KEY env vars",
        "status": "ready" if baidu.available else "missing_credentials",
    }

    # Qwen2.5-VL (Bailian)
    qwen_available = bool(
        os.environ.get("BAILIAN_API_KEY") or os.environ.get("DASHSCOPE_API_KEY")
    )
    result["backends"]["qwen25_vl"] = {
        "available": qwen_available,
        "requires": "BAILIAN_API_KEY or DASHSCOPE_API_KEY env var",
        "status": "ready" if qwen_available else "missing_credentials",
    }

    # PyMuPDF (PDF rasterizer)
    try:
        import fitz

        fver = fitz.version
        result["backends"]["pymupdf"] = {
            "available": True,
            "version": str(fver),
            "status": "ready",
        }
    except ImportError:
        result["backends"]["pymupdf"] = {"available": False, "status": "not_installed"}

    # RAG pipeline
    from urllib.request import urlopen as _uo

    try:
        with _uo("http://localhost:11434/api/tags", timeout=5) as r:
            import json as _j

            tags = _j.loads(r.read())
            bge_ok = any("bge-m3" in t.get("name", "") for t in tags.get("models", []))
            result["backends"]["ollama_bge_m3"] = {
                "available": bge_ok,
                "status": "ready" if bge_ok else "model_missing",
            }
    except Exception:
        result["backends"]["ollama_bge_m3"] = {
            "available": False,
            "status": "not_responding",
        }

    try:
        with _uo(
            "http://localhost:6333/collections/rag_federation_docs", timeout=5
        ) as r:
            _j.loads(r.read())
            result["backends"]["qdrant"] = {"available": True, "status": "ready"}
    except Exception:
        result["backends"]["qdrant"] = {"available": False, "status": "not_responding"}

    result["any_ocr_available"] = any(
        b["available"]
        for b in [
            result["backends"]["unlimited_local"],
            result["backends"]["baidu_cloud"],
            result["backends"]["qwen25_vl"],
        ]
    )

    return result


# ── CLI ───────────────────────────────────────────────────────────────


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="OCR Perception Engine — arifOS Federation"
    )
    parser.add_argument("--pdf", help="Path to PDF or image file")
    parser.add_argument(
        "--output",
        "-o",
        default="/tmp/ocr_output",
        help="Output directory (default: /tmp/ocr_output)",
    )
    parser.add_argument(
        "--backend",
        default="",
        help="Force backend: baidu_cloud, unlimited_local, qwen25_vl",
    )
    parser.add_argument(
        "--dpi",
        type=int,
        default=DEFAULT_DPI,
        help=f"DPI for PDF rasterization (default: {DEFAULT_DPI})",
    )
    parser.add_argument(
        "--bbox", action="store_true", help="Document requires bounding box output"
    )
    parser.add_argument(
        "--financial", action="store_true", help="Document contains financial figures"
    )
    parser.add_argument(
        "--health", action="store_true", help="Probe backend availability"
    )
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    if args.health:
        h = health_check()
        if args.json:
            print(json.dumps(h, indent=2))
        else:
            print("=== OCR Engine Health ===")
            for name, info in h["backends"].items():
                icon = "✅" if info.get("available") else "❌"
                print(f"  {icon} {name}: {info['status']}")
            print(f"\n  Any OCR available: {'✅' if h['any_ocr_available'] else '❌'}")
        sys.exit(0 if h["any_ocr_available"] else 1)

    if not args.pdf:
        parser.print_help()
        sys.exit(1)

    req = OCRRequest(
        file_path=args.pdf,
        output_dir=args.output,
        dpi=args.dpi,
        requires_bbox=args.bbox,
        is_financial=args.financial,
        force_backend=args.backend,
    )

    try:
        result = route_ocr(req)
        if args.json:
            print(json.dumps(result, indent=2, default=str))
        else:
            print(f"\n[OCR] Backend: {result.get('backend')}")
            print(f"[OCR] Pages: {result.get('pages', '?')}")
            if result.get("local_path"):
                print(f"[OCR] Output: {result['local_path']}")
            if result.get("markdown_url"):
                print(f"[OCR] URL (30-day): {result['markdown_url']}")
    except Exception as e:
        print(f"[FATAL] {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
