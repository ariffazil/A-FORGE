#!/usr/bin/env python3
"""
mimo_vision_shim.py — MiMo v2.5 base64 image encoder proxy.

Sits between Hermes and LiteLLM. Intercepts requests to MiMo models,
downloads URL-based images, converts to base64 data URIs, then forwards
to the real LiteLLM proxy.

MiMo v2.5 supports vision but rejects external URLs — only accepts
inline data: URIs. This shim bridges the gap.

Port: 4001 (upstream → 127.0.0.1:4000 via litellm-local-forward socat)
Config: /root/A-FORGE/mimo_vision_shim.env (UPSTREAM_URL override)
Author: 333-AGI Δ MIND — F13 SOVEREIGN directive 2026-08-05
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import time
import urllib.request
import urllib.error
from typing import Any

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import Response, StreamingResponse

# ── Config ──────────────────────────────────────────────────────────────────

UPSTREAM_URL = os.environ.get("UPSTREAM_URL", "http://127.0.0.1:4000")
LISTEN_HOST = os.environ.get("LISTEN_HOST", "127.0.0.1")
LISTEN_PORT = int(os.environ.get("LISTEN_PORT", "4002"))
DOWNLOAD_TIMEOUT = int(os.environ.get("DOWNLOAD_TIMEOUT", "10"))
MAX_IMAGE_BYTES = int(os.environ.get("MAX_IMAGE_BYTES", "10_000_000"))  # 10 MB

# Models that need URL→base64 conversion (reject external URLs)
MIMO_MODELS = frozenset({
    "mimo-v2.5",
    "mimo-v2.5-pro",
    "mimo-v2.5-ultraspeed",
})

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [mimo_shim] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("mimo_shim")

app = FastAPI(title="MiMo Vision Shim", docs_url=None, redoc_url=None)


# ── Image conversion ────────────────────────────────────────────────────────

def _detect_mime(data: bytes) -> str:
    """Detect image MIME type from magic bytes."""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"GIF8":
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:4] == b"\x00\x00\x00\x1c" or data[:4] == b"\x00\x00\x00\x18":
        return "image/heic"
    return "image/png"  # safe default


def _download_as_base64(url: str) -> str | None:
    """Download an image URL and return a data: URI. Returns None on failure."""
    try:
        if url.startswith("file://"):
            from urllib.parse import unquote
            path = unquote(url[7:])
            with open(path, "rb") as f:
                data = f.read()
        elif url.startswith("data:"):
            return url  # already base64
        else:
            req = urllib.request.Request(url, headers={"User-Agent": "mimo-shim/1.0"})
            with urllib.request.urlopen(req, timeout=DOWNLOAD_TIMEOUT) as resp:
                data = resp.read()

        if len(data) > MAX_IMAGE_BYTES:
            log.warning("Image too large (%d bytes), skipping conversion", len(data))
            return None

        mime = _detect_mime(data)
        b64 = base64.b64encode(data).decode("ascii")
        return f"data:{mime};base64,{b64}"

    except Exception as e:
        log.error("Failed to download/convert image from %s: %s", url[:80], e)
        return None


def _convert_message_images(content: list) -> bool:
    """Convert URL images in a message content array to base64. Returns True if any changed."""
    changed = False
    for part in content:
        if not isinstance(part, dict):
            continue
        if part.get("type") != "image_url":
            continue

        image_url_obj = part.get("image_url", {})
        url = image_url_obj.get("url", "")

        # Skip if already base64 or empty
        if not url or url.startswith("data:"):
            continue

        # Convert URL → base64
        b64_uri = _download_as_base64(url)
        if b64_uri:
            image_url_obj["url"] = b64_uri
            changed = True
            log.info("Converted URL→base64: %s... (%d chars)", url[:60], len(b64_uri))

    return changed


def _needs_conversion(model: str) -> bool:
    """Check if this model needs URL→base64 conversion."""
    # Handle provider-prefixed model names (openai/mimo-v2.5)
    model_name = model.split("/")[-1] if "/" in model else model
    return model_name in MIMO_MODELS


# ── Proxy ───────────────────────────────────────────────────────────────────

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy(request: Request, path: str):
    """Reverse proxy with MiMo image conversion."""
    # Read the request body
    body = await request.body()

    # Check if this is a chat completion with MiMo model
    converted = False
    if path in ("v1/chat/completions", "chat/completions") and body:
        try:
            data = json.loads(body)
            model = data.get("model", "")

            if _needs_conversion(model):
                messages = data.get("messages", [])
                for msg in messages:
                    content = msg.get("content")
                    if isinstance(content, list):
                        if _convert_message_images(content):
                            converted = True

                if converted:
                    body = json.dumps(data).encode("utf-8")
                    log.info("Shimmed %d image(s) for model %s", 1, model)
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass

    # Build upstream URL
    upstream = f"{UPSTREAM_URL}/{path}"
    if request.url.query:
        upstream += f"?{request.url.query}"

    # Forward headers (strip hop-by-hop)
    headers = {}
    for key, value in request.headers.items():
        if key.lower() not in ("host", "transfer-encoding", "connection"):
            headers[key] = value

    start = time.monotonic()
    try:
        # Make the upstream request
        req = urllib.request.Request(
            url=upstream,
            data=body if body else None,
            method=request.method,
            headers=headers,
        )

        # Execute in a thread to not block the event loop
        loop = asyncio.get_event_loop()
        resp = await loop.run_in_executor(None, lambda: urllib.request.urlopen(req, timeout=120))

        resp_body = resp.read()
        resp_headers = dict(resp.headers)
        elapsed_ms = (time.monotonic() - start) * 1000

        # Remove hop-by-hop headers
        for hop in ("transfer-encoding", "connection", "keep-alive"):
            resp_headers.pop(hop, None)

        log.info(
            "→ %s %s [%d] %.0fms%s",
            request.method,
            path,
            resp.status,
            elapsed_ms,
            " (shimmed)" if converted else "",
        )

        return Response(
            content=resp_body,
            status_code=resp.status,
            headers=resp_headers,
        )

    except urllib.error.HTTPError as e:
        resp_body = e.read()
        elapsed_ms = (time.monotonic() - start) * 1000
        log.warning("→ %s %s [%d] %.0fms", request.method, path, e.code, elapsed_ms)
        return Response(
            content=resp_body,
            status_code=e.code,
            headers=dict(e.headers),
        )

    except Exception as e:
        elapsed_ms = (time.monotonic() - start) * 1000
        log.error("→ %s %s [502] %.0fms — %s", request.method, path, elapsed_ms, e)
        return Response(
            content=f'{{"error": "mimo_vision_shim: upstream error: {e}"}}'.encode(),
            status_code=502,
            media_type="application/json",
        )


@app.get("/health")
async def health():
    """Health check for the shim."""
    return {"status": "ok", "upstream": UPSTREAM_URL, "shim": "mimo-vision"}


# ── Main ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    log.info("Starting MiMo Vision Shim on %s:%d → %s", LISTEN_HOST, LISTEN_PORT, UPSTREAM_URL)
    uvicorn.run(
        app,
        host=LISTEN_HOST,
        port=LISTEN_PORT,
        log_level="warning",
        access_log=False,
    )
