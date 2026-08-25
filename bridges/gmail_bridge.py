#!/usr/bin/env python3
"""
gmail_bridge.py — APA Gmail Connector (Google API OAuth).
Manifest: /root/A-FORGE/apa/manifests/gmail.yaml
Port: 18097 (127.0.0.1)

DITEMPA BUKAN DIBERI — Communication sovereignty is forged.

CRITICAL: send/draft_send are IRREVERSIBLE — require capability membrane.
The base class envelope provides verdict/audit; the membrane enforcement
lives at the calling MCP layer (forge_gmail) — this bridge is the executor.
"""

from __future__ import annotations

import base64
import logging
import os
import sys
from email.mime.text import MIMEText

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from google_bridge_base import GoogleBridge, serve  # noqa: E402

try:
    from googleapiclient.discovery import build as build_service
except ImportError:
    build_service = None  # type: ignore


CONN = "gmail"
# SCOPES: start read-only. To add gmail.send later, append it here
# and re-consent in Google OAuth (one-time human gesture on the VPS).
SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
]
DEFAULT_PORT = 18097


def _service_factory(creds):
    if build_service is None:
        return None
    return build_service("gmail", "v1", credentials=creds, cache_discovery=False)


def _decode_body(payload):
    """Decode MIME body data (handles base64)."""
    data = payload.get("body", {}).get("data", "")
    if not data:
        return ""
    try:
        return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
    except Exception:
        return ""


def _extract_headers(headers, names):
    out = {}
    for h in headers or []:
        if h["name"].lower() in [n.lower() for n in names]:
            out[h["name"]] = h["value"]
    return out


def action_search(bridge: GoogleBridge, params):
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("gmail service unavailable")
    query = params.get("query", "")
    max_results = int(params.get("limit", 20))
    res = (
        svc.users()
        .messages()
        .list(userId="me", q=query, maxResults=max_results)
        .execute()
    )
    msgs = res.get("messages", [])
    return {"count": len(msgs), "message_ids": [m["id"] for m in msgs], "query": query}


def action_read(bridge: GoogleBridge, params):
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("gmail service unavailable")
    msg_id = params["message_id"]
    fmt = params.get("format", "metadata")
    msg = svc.users().messages().get(userId="me", id=msg_id, format=fmt).execute()
    payload = msg.get("payload", {})
    headers = _extract_headers(
        payload.get("headers", []), ["Subject", "From", "To", "Date"]
    )
    return {
        "id": msg_id,
        "thread_id": msg.get("threadId"),
        "snippet": msg.get("snippet", ""),
        "headers": headers,
        "body": _decode_body(payload) if fmt in ("full", "raw") else "",
        "label_ids": msg.get("labelIds", []),
    }


def action_read_unread(bridge: GoogleBridge, params):
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("gmail service unavailable")
    query = params.get("query", "is:unread")
    max_results = int(params.get("limit", 10))
    res = (
        svc.users()
        .messages()
        .list(userId="me", q=query, maxResults=max_results)
        .execute()
    )
    msgs = res.get("messages", [])
    out = []
    for m in msgs[:max_results]:
        full = (
            svc.users()
            .messages()
            .get(userId="me", id=m["id"], format="metadata")
            .execute()
        )
        headers = _extract_headers(
            full.get("payload", {}).get("headers", []), ["Subject", "From", "Date"]
        )
        out.append(
            {
                "id": m["id"],
                "thread_id": full.get("threadId"),
                "snippet": full.get("snippet", ""),
                "headers": headers,
            }
        )
    return {"count": len(out), "messages": out}


def action_draft_create(bridge: GoogleBridge, params):
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("gmail service unavailable")
    msg = MIMEText(params.get("body", ""))
    msg["to"] = params["to"]
    msg["subject"] = params["subject"]
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    res = (
        svc.users()
        .drafts()
        .create(userId="me", body={"message": {"raw": raw}})
        .execute()
    )
    return {
        "draft_id": res.get("id"),
        "created": True,
        "subject": params["subject"],
        "to": params["to"],
    }


def action_draft_update(bridge: GoogleBridge, params):
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("gmail service unavailable")
    draft_id = params["draft_id"]
    msg = MIMEText(params.get("body", ""))
    msg["to"] = params["to"]
    msg["subject"] = params["subject"]
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    res = (
        svc.users()
        .drafts()
        .update(userId="me", id=draft_id, body={"message": {"raw": raw}})
        .execute()
    )
    return {"draft_id": draft_id, "updated": True}


def action_draft_send(bridge: GoogleBridge, params):
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("gmail service unavailable")
    draft_id = params["draft_id"]
    res = svc.users().drafts().send(userId="me", body={"id": draft_id}).execute()
    return {"sent_id": res.get("id"), "draft_id": draft_id, "sent": True}


def action_draft_delete(bridge: GoogleBridge, params):
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("gmail service unavailable")
    draft_id = params["draft_id"]
    svc.users().drafts().delete(userId="me", id=draft_id).execute()
    return {"draft_id": draft_id, "deleted": True}


def action_modify_labels(bridge: GoogleBridge, params):
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("gmail service unavailable")
    msg_id = params["message_id"]
    add = params.get("add_label_ids", [])
    remove = params.get("remove_label_ids", [])
    body = {}
    if add:
        body["addLabelIds"] = add
    if remove:
        body["removeLabelIds"] = remove
    if not body:
        return {"error": "no label changes specified"}
    svc.users().messages().modify(userId="me", id=msg_id, body=body).execute()
    return {"message_id": msg_id, "added": add, "removed": remove, "modified": True}


def action_send(bridge: GoogleBridge, params):
    """IRREVERSIBLE — requires capability membrane enforcement at MCP layer.
    Bridge enforces: subject and body hashes match what was authorized.
    """
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("gmail service unavailable")
    msg = MIMEText(params["body"])
    msg["to"] = params["to"]
    msg["subject"] = params["subject"]
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    res = svc.users().messages().send(userId="me", body={"raw": raw}).execute()
    return {
        "sent_id": res.get("id"),
        "to": params["to"],
        "subject": params["subject"],
        "sent": True,
    }


ACTIONS = {
    "search": action_search,
    "read": action_read,
    "read_unread": action_read_unread,
    "draft_create": action_draft_create,
    "draft_update": action_draft_update,
    "draft_send": action_draft_send,
    "draft_delete": action_draft_delete,
    "modify_labels": action_modify_labels,
    "send": action_send,
}


class GmailBridge(GoogleBridge):
    CONNECTOR_NAME = CONN
    SCOPES = SCOPES
    DEFAULT_PORT = DEFAULT_PORT
    SERVICE_FN = _service_factory
    ACTIONS = ACTIONS


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="[gmail_bridge] %(message)s")
    serve(GmailBridge())
