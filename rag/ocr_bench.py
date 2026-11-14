#!/usr/bin/env python3
"""
OCR Benchmark Harness — A-FORGE
=============================================================================
Measures OUR OCR engines against a real ground-truth corpus so that OCR
performance stops being a narrative.

WHY (2026-10-28)
----------------
Every OCR number in the federation so far came from a vendor's leaderboard
chart or from prose in a skill file. Nothing measured OUR engines. The one
public long-document benchmark Baidu released with Unlimited-OCR-2 --
MarathonDocBench -- is public and holds 100 documents of 100+ pages each,
which makes it usable as a regression corpus.

WHAT THIS DOES
--------------
  1. Fetch a slice of MarathonDocBench (or any local dir of page images).
  2. Run a chosen engine over the pages.
  3. Score the output with measured proxies (chars, common-word ratio,
     alpha ratio, readability proxy) and emit a receipt.
  4. Numbers are MEASURED, never asserted. MarathonDocBench ships no
     ground-truth transcription to compare against, so the score is a
     readability proxy -- and it is labelled as one.

USAGE
  python ocr_bench.py --list-engines
  python ocr_bench.py --doc mp3lan_0778 --pages 8 --engine tesseract
  python ocr_bench.py --doc mp3lan_0778 --pages 8 --compare
  python ocr_bench.py --out /root/forge_work/ocr-bench/latest.json

DITEMPA BUKAN DIBERI -- Forged, Not Given.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

MARATHON_BASE = (
    "https://huggingface.co/datasets/baidu/MarathonDocBench/resolve/main"
)
MARATHON_META = f"{MARATHON_BASE}/images/metadata.jsonl"

CACHE_DIR = Path(
    os.environ.get("OCR_BENCH_CACHE", "/root/forge_work/ocr-bench/cache")
)

# Words common enough in English/Malay technical prose to be a weak signal
# of "real OCR" vs "character soup". Deliberately not a quality metric --
# a garbage stream of these is still garbage.
COMMON_WORDS = {
    "the", "and", "of", "to", "in", "is", "that", "for", "it", "as", "with",
    "on", "are", "this", "by", "from", "at", "or", "an", "be", "was", "were",
    "will", "has", "have", "not", "but", "which", "you", "your", "all",
    "yang", "dan", "untuk", "dengan", "pada", "adalah", "ini", "itu", "dalam",
    "tidak", "atau", "dari", "oleh", "akan", "telah",
}

ENGINES = ["tesseract", "unlimited_gradio", "unlimited_gradio_v1", "mulerouter_vlm"]


# -- Dataset -------------------------------------------------------------
def fetch_metadata() -> list[dict]:
    """Fetch MarathonDocBench page metadata (public, no auth)."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached = CACHE_DIR / "metadata.jsonl"
    if not cached.exists():
        req = urllib.request.Request(
            MARATHON_META, headers={"User-Agent": "arifOS/1.0"}
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            cached.write_bytes(resp.read())
    rows = []
    with cached.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if line:
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return rows


def doc_index(rows: list[dict]) -> dict[str, dict]:
    """doc_id -> {num_pages, pages: [page numbers]}"""
    docs: dict[str, dict] = {}
    for r in rows:
        d = docs.setdefault(r["doc_id"], {"num_pages": 0, "pages": []})
        d["num_pages"] = max(d["num_pages"], int(r.get("num_pages", 0)))
        d["pages"].append(int(r.get("page", 0)))
    for d in docs.values():
        d["pages"] = sorted(d["pages"])
    return docs


def fetch_pages(doc_id: str, pages: list[int]) -> list[str]:
    """Download the requested page images of a document; cache them."""
    out_dir = CACHE_DIR / doc_id
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for p in pages:
        dest = out_dir / f"page_{p:04d}.png"
        if not dest.exists():
            url = f"{MARATHON_BASE}/images/{doc_id}/page_{p}.png"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "arifOS/1.0"})
                with urllib.request.urlopen(req, timeout=120) as resp:
                    dest.write_bytes(resp.read())
            except Exception as exc:  # noqa: BLE001
                print(f"[bench] fetch failed {doc_id} p{p}: {exc}", file=sys.stderr)
                continue
        paths.append(str(dest))
    return paths


# -- Engines -------------------------------------------------------------
def run_tesseract(image_paths: list[str], lang: str = "eng+msa") -> dict:
    """Our in-house fallback. Per page, tesseract CLI, --psm 6."""
    texts = []
    t0 = time.monotonic()
    for ip in image_paths:
        try:
            r = subprocess.run(
                ["tesseract", ip, "stdout", "-l", lang, "--psm", "6"],
                capture_output=True,
                text=True,
                timeout=120,
            )
            texts.append(r.stdout.strip())
        except Exception as exc:  # noqa: BLE001
            texts.append(f"[OCR_ERROR: {exc}]")
    return {
        "text": "\n\n".join(texts),
        "per_page": texts,
        "secs": round(time.monotonic() - t0, 1),
        "requests": len(image_paths),
        "cost": "RM0",
    }


def run_unlimited_gradio(image_paths: list[str]) -> dict:
    """v2 Space, document horizon (ONE request when it fits the cap)."""
    sys.path.insert(0, "/root/A-FORGE/rag")
    from uocr_bridge_v2 import UocrClient

    client = UocrClient()
    res = client.parse_document(image_paths)
    return {
        "text": res.text,
        "per_page": [res.text] if res.text else [],
        "secs": res.secs,
        "requests": res.meta.get("chunks", 0),
        "cost": "RM0",
        "horizon": res.horizon,
        "cross_page_context": res.meta.get("cross_page_context"),
        "error": res.error,
        "ok": res.ok,
    }


def run_unlimited_gradio_v1(image_paths: list[str]) -> dict:
    """v1 Space, /run_ocr per page. The surface our old code targeted."""
    from gradio_client import Client, handle_file

    client = Client("baidu/Unlimited-OCR")
    texts = []
    t0 = time.monotonic()
    for ip in image_paths:
        try:
            r = client.predict(
                handle_file(ip), "base", "document parsing.", api_name="/run_ocr"
            )
            texts.append(r.get("text", "") if isinstance(r, dict) else str(r))
        except Exception as exc:  # noqa: BLE001
            texts.append(f"[OCR_ERROR: {exc}]")
    return {
        "text": "\n\n".join(texts),
        "per_page": texts,
        "secs": round(time.monotonic() - t0, 1),
        "requests": len(image_paths),
        "cost": "RM0",
    }


def run_mulerouter(image_paths: list[str]) -> dict:
    """MuleRouter VLM -- the paid lane we control."""
    sys.path.insert(0, "/root/A-FORGE/rag")
    from ocr_engine import MuleRouterVLMOCR

    m = MuleRouterVLMOCR()
    if not m.available:
        return {"text": "", "per_page": [], "secs": 0, "requests": 0,
                "cost": "n/a", "error": "no MULEROUTER_API_KEY"}
    texts = []
    t0 = time.monotonic()
    for ip in image_paths:
        r = m.process(ip)
        if isinstance(r, dict) and r.get("status") == "error":
            texts.append(f"[OCR_ERROR: {r.get('error')}]")
        else:
            texts.append(r.get("text", "") if isinstance(r, dict) else str(r))
    return {
        "text": "\n\n".join(texts),
        "per_page": texts,
        "secs": round(time.monotonic() - t0, 1),
        "requests": len(image_paths),
        "cost": "paid",
    }


ENGINE_FUNCS = {
    "tesseract": run_tesseract,
    "unlimited_gradio": run_unlimited_gradio,
    "unlimited_gradio_v1": run_unlimited_gradio_v1,
    "mulerouter_vlm": run_mulerouter,
}


# -- Scoring (measured proxies, NOT a vendor metric) ---------------------
def score(text: str) -> dict[str, Any]:
    """
    Measured proxies for readability. These are NOT accuracy -- MarathonDocBench
    ships no ground-truth transcription for us to compare against, so we report
    proxies and label them as proxies.
    """
    stripped = text.strip()
    if not stripped:
        return {
            "chars": 0,
            "words": 0,
            "common_word_ratio": 0.0,
            "alpha_ratio": 0.0,
            "line_count": 0,
            "readability_proxy": 0.0,
        }
    words = re.findall(r"[A-Za-z]{2,}", stripped)
    alpha_chars = [c for c in stripped if c.isalpha()]
    common = sum(1 for w in words if w.lower() in COMMON_WORDS)
    alpha_ratio = len(alpha_chars) / max(1, len(stripped))
    common_ratio = common / max(1, len(words))
    # A crude readability proxy: long real words beat character soup.
    long_words = sum(1 for w in words if len(w) >= 5)
    proxy = round(
        0.5 * common_ratio
        + 0.3 * min(1.0, long_words / max(1, len(words)) * 3)
        + 0.2 * alpha_ratio,
        4,
    )
    return {
        "chars": len(stripped),
        "words": len(words),
        "common_word_ratio": round(common_ratio, 4),
        "alpha_ratio": round(alpha_ratio, 4),
        "line_count": len([l for l in stripped.split("\n") if l.strip()]),
        "readability_proxy": proxy,
    }


def run_engine(engine: str, image_paths: list[str]) -> dict:
    fn = ENGINE_FUNCS.get(engine)
    if fn is None:
        return {"error": f"unknown engine {engine}", "text": "", "secs": 0}
    try:
        return fn(image_paths)
    except Exception as exc:  # noqa: BLE001
        return {
            "error": f"{type(exc).__name__}: {exc}",
            "text": "",
            "per_page": [],
            "secs": 0,
            "requests": 0,
        }


# -- Main ----------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(description="A-FORGE OCR benchmark harness")
    parser.add_argument("--list-engines", action="store_true")
    parser.add_argument("--doc", help="MarathonDocBench doc_id, e.g. mp3lan_0778")
    parser.add_argument("--pages", type=int, default=8)
    parser.add_argument("--engine", default="tesseract")
    parser.add_argument("--compare", action="store_true", help="run all engines")
    parser.add_argument("--out", default="")
    args = parser.parse_args()

    if args.list_engines:
        print(json.dumps(sorted(ENGINE_FUNCS.keys()), indent=1))
        return 0

    rows = fetch_metadata()
    docs = doc_index(rows)
    if args.doc not in docs:
        print(
            f"doc {args.doc} not in MarathonDocBench. "
            f"largest: {sorted(docs.items(), key=lambda kv: -kv[1]['num_pages'])[:5]}",
            file=sys.stderr,
        )
        return 2

    info = docs[args.doc]
    n = min(args.pages, len(info["pages"]))
    selected = info["pages"][:n]
    print(
        f"[bench] {args.doc}: {info['num_pages']} pages total, running {n}",
        file=sys.stderr,
    )

    images = fetch_pages(args.doc, selected)
    if not images:
        print("[bench] no pages fetched", file=sys.stderr)
        return 2

    engines = sorted(ENGINE_FUNCS.keys()) if args.compare else [args.engine]
    report: dict[str, Any] = {
        "doc_id": args.doc,
        "doc_num_pages": info["num_pages"],
        "pages_run": len(images),
        "page_numbers": selected[: len(images)],
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "corpus": "baidu/MarathonDocBench (public)",
        "results": {},
    }

    for eng in engines:
        print(f"[bench] running {eng} ...", file=sys.stderr)
        res = run_engine(eng, images)
        entry = {
            "secs": res.get("secs"),
            "requests": res.get("requests"),
            "cost": res.get("cost"),
            "horizon": res.get("horizon"),
            "cross_page_context": res.get("cross_page_context"),
            "error": res.get("error", ""),
            "score": score(res.get("text", "")),
            "sample": res.get("text", "")[:600],
        }
        report["results"][eng] = entry
        s = entry["score"]
        print(
            f"[bench] {eng}: {entry['secs']}s req={entry['requests']} "
            f"chars={s['chars']} proxy={s['readability_proxy']} "
            f"err={entry['error'][:60]}",
            file=sys.stderr,
        )

    out = Path(args.out) if args.out else (CACHE_DIR / "latest.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=1, ensure_ascii=False))
    print(f"[bench] receipt: {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
