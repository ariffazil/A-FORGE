#!/usr/bin/env python3
"""
google_bridge_base.py — Shared OAuth core for APA Google Workspace bridges.

Used by: calendar_bridge.py, drive_bridge.py, sheets_bridge.py, gmail_bridge.py.
Provides:
  - OAuth refresh token flow (google-auth)
  - API service construction (google-api-python-client)
  - APA envelope (matches apa/core/schemas.py)
  - HTTP server scaffolding (BaseHTTPRequestHandler)
  - Health check + readiness gate

DITEMPA BUKAN DIBERI — The base is forged once, inherited by all.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Callable, Dict, List, Optional

# google libs may be missing on systems without them installed
try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build as build_service
    from googleapiclient.errors import HttpError

    _GOOGLE_LIBS_MISSING = False
except ImportError:
    Request = None  # type: ignore
    Credentials = None  # type: ignore
    build_service = None  # type: ignore
    HttpError = Exception  # type: ignore
    _GOOGLE_LIBS_MISSING = True

logging.basicConfig(level=logging.INFO, format="[%(name)s] %(message)s")


# ── APA Envelope (per apa/core/schemas.py) ───────────────────────────────────


def envelope(
    connector: str,
    verb: str,
    ok: bool,
    result: Any,
    *,
    verdict: str = "PROCEED",
    evidence_tag: str = "OBS",
    confidence: float = 0.95,
    error: Optional[str] = None,
) -> Dict[str, Any]:
    """Canonical APA response envelope. Every bridge verb returns one of these."""
    return {
        "ok": ok,
        "connector": connector,
        "verb": verb,
        "verdict": verdict if ok else "HOLD",
        "evidence_tag": evidence_tag,
        "confidence": confidence,
        "result": result,
        "error": error,
        "receipt": {
            "receipt_id": f"r-{uuid.uuid4().hex[:12]}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }


# ── OAuth + Service Cache ────────────────────────────────────────────────────


class GoogleBridge:
    """Base class for Google Workspace APA bridges.

    Subclasses define class attributes:
      - CONNECTOR_NAME (e.g. "calendar")
      - SCOPES (list of OAuth scopes)
      - SERVICE_FN (callable: creds -> googleapiclient service)
      - ACTIONS (dict verb_name -> callable)
    """

    CONNECTOR_NAME: str = ""
    SCOPES: List[str] = []
    DEFAULT_PORT: int = 0
    SERVICE_FN: Optional[Callable[[Any], Any]] = None
    ACTIONS: Dict[str, Callable] = {}  # verb -> (bridge, params) -> result

    def __init__(self) -> None:
        self.log = logging.getLogger(self.__class__.__name__)
        self._creds = None
        self._service = None
        self._token_path = os.environ.get(
            "GOOGLE_TOKEN_PATH", "/root/HERMES/google_token.json"
        )

    # ── Credential lifecycle ────────────────────────────────────────────────

    def _load_creds(self):
        if _GOOGLE_LIBS_MISSING or Credentials is None:
            return None
        if not os.path.exists(self._token_path):
            self.log.warning("token file missing: %s", self._token_path)
            return None
        try:
            creds = Credentials.from_authorized_user_file(self._token_path, self.SCOPES)
        except Exception as e:
            self.log.error("failed to load creds: %s", e)
            return None
        if creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())  # type: ignore
            except Exception as e:
                self.log.error("refresh failed: %s", e)
                return None
        return creds

    def creds(self):
        if self._creds is None:
            self._creds = self._load_creds()
        return self._creds

    def service(self):
        if self._service is None:
            creds = self.creds()
            if creds is None or self.SERVICE_FN is None:
                return None
            self._service = self.SERVICE_FN(creds)
        return self._service

    # ── Health ──────────────────────────────────────────────────────────────

    def health(self) -> Dict[str, Any]:
        creds = self.creds()
        ready = creds is not None and self.service() is not None
        return {
            "ok": True,
            "bridge": f"{self.CONNECTOR_NAME}_bridge",
            "protocol": "google-api-oauth",
            "apa_version": "2.0",
            "scopes": self.SCOPES,
            "verbs": sorted(list(self.ACTIONS.keys())),
            "google_libs_installed": not _GOOGLE_LIBS_MISSING,
            "credentials_configured": creds is not None,
            "status": "READY"
            if ready
            else (
                "MISSING_DEPENDENCY" if _GOOGLE_LIBS_MISSING else "AWAITING_CREDENTIALS"
            ),
            "port": self.DEFAULT_PORT,
        }


# ── HTTP Server scaffolding ─────────────────────────────────────────────────


def make_handler(bridge):
    """Create BaseHTTPRequestHandler subclass bound to a GoogleBridge instance."""

    class BridgeHandler(BaseHTTPRequestHandler):
        def _send(self, data, status=200):
            body = json.dumps(data, default=str).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):  # noqa: N802
            if self.path == "/health":
                self._send(bridge.health())
            elif self.path == "/verbs":
                self._send(
                    {
                        "ok": True,
                        "connector": bridge.CONNECTOR_NAME,
                        "verbs": [{"name": name} for name in bridge.ACTIONS.keys()],
                    }
                )
            else:
                self._send({"ok": False, "error": "not found"}, 404)

        def do_POST(self):  # noqa: N802
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length)) if length else {}
            except Exception as e:
                self._send(
                    envelope(
                        bridge.CONNECTOR_NAME,
                        "?",
                        False,
                        None,
                        error=f"invalid json: {e}",
                    ),
                    400,
                )
                return

            verb = body.get("verb") or body.get("mode") or ""
            params = body.get("params") or body
            if verb not in bridge.ACTIONS:
                self._send(
                    envelope(
                        bridge.CONNECTOR_NAME,
                        verb,
                        False,
                        None,
                        error=f"unknown verb: {verb}",
                    ),
                    400,
                )
                return

            try:
                result = bridge.ACTIONS[verb](bridge, params)
                self._send(envelope(bridge.CONNECTOR_NAME, verb, True, result))
            except HttpError as e:  # type: ignore
                self._send(
                    envelope(
                        bridge.CONNECTOR_NAME,
                        verb,
                        False,
                        None,
                        error=f"google api: {e}",
                    ),
                    502,
                )
            except Exception as e:
                self._send(
                    envelope(bridge.CONNECTOR_NAME, verb, False, None, error=str(e)),
                    500,
                )

        def log_message(self, format, *args):  # noqa: A002
            bridge.log.info("%s - %s", self.client_address[0], format % args)

    return BridgeHandler


def serve(bridge) -> None:
    port = int(
        os.environ.get(
            f"{bridge.CONNECTOR_NAME.upper()}_BRIDGE_PORT", str(bridge.DEFAULT_PORT)
        )
    )
    handler = make_handler(bridge)
    httpd = HTTPServer(("127.0.0.1", port), handler)
    bridge.log.info(
        "APA %s Bridge listening on 127.0.0.1:%d (verbs=%s)",
        bridge.CONNECTOR_NAME,
        port,
        sorted(bridge.ACTIONS.keys()),
    )
    httpd.serve_forever()
