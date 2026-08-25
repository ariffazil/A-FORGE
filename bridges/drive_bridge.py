#!/usr/bin/env python3
"""
drive_bridge.py — APA Drive Connector (Google API OAuth, READ-ONLY).
Manifest: /root/A-FORGE/apa/manifests/drive.yaml
Port: 18095 (127.0.0.1)

DITEMPA BUKAN DIBERI — Document sovereignty is forged.
"""

from __future__ import annotations

import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from google_bridge_base import GoogleBridge, serve  # noqa: E402

try:
    from googleapiclient.discovery import build as build_service
except ImportError:
    build_service = None  # type: ignore


CONN = "drive"
SCOPES = ["https://www.googleapis.com/auth/drive"]
DEFAULT_PORT = 18095


def _service_factory(creds):
    if build_service is None:
        return None
    return build_service("drive", "v3", credentials=creds, cache_discovery=False)


def action_list_files(bridge: GoogleBridge, params):
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("drive service unavailable")
    page_size = int(params.get("limit", 50))
    query = params.get("query")
    kwargs = {
        "pageSize": page_size,
        "fields": "files(id,name,mimeType,modifiedTime,size,webViewLink)",
    }
    if query:
        kwargs["q"] = query
    res = svc.files().list(**kwargs).execute()
    files = res.get("files", [])
    return {"count": len(files), "files": files}


def action_search(bridge: GoogleBridge, params):
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("drive service unavailable")
    name = params["name"]
    res = (
        svc.files()
        .list(
            q=f"name contains '{name}'",
            pageSize=int(params.get("limit", 20)),
            fields="files(id,name,mimeType,modifiedTime,webViewLink)",
        )
        .execute()
    )
    files = res.get("files", [])
    return {"count": len(files), "files": files, "query": name}


def action_get_metadata(bridge: GoogleBridge, params):
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("drive service unavailable")
    file_id = params["file_id"]
    f = (
        svc.files()
        .get(
            fileId=file_id,
            fields="id,name,mimeType,modifiedTime,size,webViewLink,owners,permissions",
        )
        .execute()
    )
    return f


def action_read(bridge: GoogleBridge, params):
    """Read text content (Google Docs exported, plain text files)."""
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("drive service unavailable")
    file_id = params["file_id"]
    meta = svc.files().get(fileId=file_id, fields="mimeType,name").execute()
    mime = meta.get("mimeType", "")
    if "google-apps" in mime:
        # Google Docs → export as text
        content = svc.files().export(fileId=file_id, mimeType="text/plain").execute()
        text = (
            content.decode("utf-8", errors="replace")
            if isinstance(content, bytes)
            else str(content)
        )
    else:
        # Plain file → media download
        from io import BytesIO
        from googleapiclient.http import MediaIoBaseDownload

        request = svc.files().get_media(fileId=file_id)
        buf = BytesIO()
        downloader = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        text = buf.getvalue().decode("utf-8", errors="replace")
    return {
        "file_id": file_id,
        "name": meta.get("name"),
        "mime_type": mime,
        "content": text[:50000],
    }


def action_download(bridge: GoogleBridge, params):
    """Download file to local path."""
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("drive service unavailable")
    file_id = params["file_id"]
    out_path = params["path"]
    meta = svc.files().get(fileId=file_id, fields="name,mimeType").execute()
    from io import BytesIO
    from googleapiclient.http import MediaIoBaseDownload

    if "google-apps" in meta.get("mimeType", ""):
        # Cannot download native Google files directly; export
        request = svc.files().export_media(fileId=file_id, mimeType="application/pdf")
    else:
        request = svc.files().get_media(fileId=file_id)
    buf = BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    with open(out_path, "wb") as f:
        f.write(buf.getvalue())
    return {
        "file_id": file_id,
        "name": meta.get("name"),
        "downloaded_to": out_path,
        "bytes": len(buf.getvalue()),
    }


ACTIONS = {
    "list_files": action_list_files,
    "search": action_search,
    "read": action_read,
    "download": action_download,
    "get_metadata": action_get_metadata,
}


class DriveBridge(GoogleBridge):
    CONNECTOR_NAME = CONN
    SCOPES = SCOPES
    DEFAULT_PORT = DEFAULT_PORT
    SERVICE_FN = _service_factory
    ACTIONS = ACTIONS


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="[drive_bridge] %(message)s")
    serve(DriveBridge())
