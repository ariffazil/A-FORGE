#!/usr/bin/env python3
"""
image_url_to_base64.py — LiteLLM callback: URL→base64 shim for MiMo v2.5
==========================================================================

MiMo v2.5 supports vision but rejects external URLs — only accepts
inline data:image/...;base64,... URIs. This callback intercepts outgoing
requests, detects image_url parts with HTTP(S) URLs, downloads them,
converts to base64 data URIs, and replaces the URL in-place.

Transparent to Hermes (sender) and MiMo (receiver).

Usage in litellm_config.yaml:
  callbacks: ["image_url_to_base64"]

F2 TRUTH: OBS — downloaded pixels, base64-encoded. No interpretation.
DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

import base64
import logging
import mimetypes
import urllib.request
from typing import Any

import litellm
from litellm.integrations.custom_logger import CustomLogger

logger = logging.getLogger("image_url_to_base64")

# Mime type fallback for unknown extensions
DEFAULT_MIME = "image/png"

# Max image size to download (10 MB)
MAX_IMAGE_BYTES = 10 * 1024 * 1024


def _url_to_data_uri(url: str) -> str | None:
    """
    Download an image URL and convert to data:image/...;base64,... URI.
    Returns None on failure (network error, too large, etc.).
    """
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "arifOS-ImageShim/1.0"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            content_type = resp.headers.get("Content-Type", "")
            data = resp.read(MAX_IMAGE_BYTES + 1)

            if len(data) > MAX_IMAGE_BYTES:
                logger.warning("Image too large (%d bytes), skipping: %s", len(data), url)
                return None

            # Extract mime from Content-Type or guess from URL
            if ";" in content_type:
                mime = content_type.split(";")[0].strip()
            elif "/" in content_type:
                mime = content_type.strip()
            else:
                mime, _ = mimetypes.guess_type(url)
                if not mime:
                    mime = DEFAULT_MIME

            b64 = base64.b64encode(data).decode("ascii")
            data_uri = f"data:{mime};base64,{b64}"
            logger.info(
                "Converted URL→base64: %s → %s (%d bytes, %s)",
                url[:80],
                data_uri[:60],
                len(data),
                mime,
            )
            return data_uri
    except Exception as e:
        logger.warning("Failed to download/convert image URL: %s — %s", url[:80], e)
        return None


def _process_content(content: list[dict[str, Any]]) -> bool:
    """
    Walk through message content array, find image_url parts with HTTP(S) URLs,
    download and convert to base64 data URIs. Returns True if any modification made.
    """
    modified = False

    for part in content:
        if not isinstance(part, dict):
            continue

        part_type = part.get("type", "")

        # Handle inline_url style: {"type": "image_url", "image_url": {"url": "https://..."}}
        if part_type == "image_url":
            image_url_obj = part.get("image_url", {})
            if isinstance(image_url_obj, dict):
                url = image_url_obj.get("url", "")
            elif isinstance(image_url_obj, str):
                url = image_url_obj
            else:
                continue

            if url and url.startswith(("http://", "https://")):
                data_uri = _url_to_data_uri(url)
                if data_uri:
                    if isinstance(image_url_obj, dict):
                        part["image_url"]["url"] = data_uri
                    else:
                        part["image_url"] = data_uri
                    modified = True

        # Handle source style: {"type": "image", "source": {"url": "https://..."}}
        elif part_type == "image":
            source = part.get("source", {})
            if isinstance(source, dict):
                url = source.get("url", "")
                if url and url.startswith(("http://", "https://")):
                    data_uri = _url_to_data_uri(url)
                    if data_uri:
                        part["source"]["url"] = data_uri
                        part["source"]["media_type"] = data_uri.split(";")[0].replace("data:", "")
                        modified = True

    return modified


class ImageURLToBase64Callback(CustomLogger):
    """
    LiteLLM custom callback that converts image URLs to base64 data URIs
    before requests reach providers that reject external URLs (e.g., MiMo v2.5).
    """

    def __init__(self):
        self.converted_count = 0
        self.failed_count = 0

    def log_pre_api_call(self, model, messages, kwargs):
        """Intercept before API call and convert image URLs to base64."""
        for msg in messages:
            content = msg.get("content")
            if isinstance(content, list):
                if _process_content(content):
                    self.converted_count += 1
            # Handle nested content in tool results, etc.
            elif isinstance(content, dict):
                inner = content.get("content")
                if isinstance(inner, list):
                    _process_content(inner)


# Singleton for LiteLLM callback registration
image_url_to_base64_callback = ImageURLToBase64Callback()
