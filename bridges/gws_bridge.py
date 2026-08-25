#!/usr/bin/env python3
"""
gws_bridge.py - Universal Google Workspace bridge via gws CLI.

Single HTTP service that dispatches verb calls to gws CLI for all 4
Google services (drive, gmail, calendar, sheets). Uses gws_backend.py
for scope-aware routing.

Port: 18098 (configurable via GWS_BRIDGE_PORT env var)
Bind: 127.0.0.1 only

Endpoints:
  GET  /health  - readiness + scope status
  GET  /verbs   - available verbs per service
  POST /        - verb dispatch: {"service":"drive","verb":"list_files","params":{}}

DITEMPA BUKAN DIBERI - The universal bridge is forged once, serves all.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gws_backend import call_gws, gws_available_scopes, service_in_scope  # noqa: E402

logging.basicConfig(level=logging.INFO, format="[%(name)s] %(message)s")
log = logging.getLogger("gws_bridge")

DEFAULT_PORT = 18098

VERBS: Dict[str, Dict[str, Dict[str, Any]]] = {
    "drive": {
        "list_files": {
            "resource": "files",
            "method": "list",
            "desc": "List files in Drive",
        },
        "get_file": {"resource": "files", "method": "get", "desc": "Get file metadata"},
        "search": {
            "resource": "files",
            "method": "list",
            "desc": "Search files (q param)",
        },
        "read": {
            "resource": "files",
            "method": "export",
            "desc": "Export file as text",
        },
        "download": {"resource": "files", "method": "get", "desc": "Download file"},
    },
    "gmail": {
        "search": {
            "resource": "users.messages",
            "method": "list",
            "desc": "Search messages",
        },
        "read": {"resource": "users.messages", "method": "get", "desc": "Read message"},
        "read_unread": {
            "resource": "users.messages",
            "method": "list",
            "desc": "List unread",
        },
        "draft_create": {
            "resource": "users.drafts",
            "method": "create",
            "desc": "Create draft",
        },
        "draft_send": {
            "resource": "users.drafts",
            "method": "send",
            "desc": "Send draft",
        },
        "send": {
            "resource": "users.messages",
            "method": "send",
            "desc": "Send message",
        },
    },
    "calendar": {
        "list_events": {"resource": "events", "method": "list", "desc": "List events"},
        "get_event": {"resource": "events", "method": "get", "desc": "Get event"},
        "create_event": {
            "resource": "events",
            "method": "insert",
            "desc": "Create event",
        },
        "update_event": {
            "resource": "events",
            "method": "update",
            "desc": "Update event",
        },
        "delete_event": {
            "resource": "events",
            "method": "delete",
            "desc": "Delete event",
        },
        "find_free_slots": {
            "resource": "freebusy",
            "method": "query",
            "desc": "Find free slots",
        },
    },
    "sheets": {
        "read": {
            "resource": "spreadsheets.values",
            "method": "get",
            "desc": "Read range",
        },
        "append": {
            "resource": "spreadsheets.values",
            "method": "append",
            "desc": "Append rows",
        },
        "update": {
            "resource": "spreadsheets.values",
            "method": "update",
            "desc": "Update range",
        },
    },
}


def envelope(
    connector: str,
    verb: str,
    ok: bool,
    result: Any,
    verdict: str = "PROCEED",
    error: str | None = None,
) -> dict:
    return {
        "ok": ok,
        "connector": connector,
        "verb": verb,
        "verdict": verdict if ok else "HOLD",
        "result": result,
        "error": error,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def dispatch(service: str, verb: str, params: dict | None = None) -> dict:
    if service not in VERBS:
        return envelope(
            service,
            verb,
            False,
            None,
            verdict="VOID",
            error=f"unknown service: {service}",
        )
    verb_spec = VERBS[service].get(verb)
    if not verb_spec:
        available = list(VERBS[service].keys())
        return envelope(
            service,
            verb,
            False,
            None,
            verdict="VOID",
            error=f"unknown verb: {verb}. available: {available}",
        )
    resource = verb_spec["resource"]
    method = verb_spec["method"]
    return call_gws(service, resource, method, params=params, connector=service)


class GWSBridgeHandler(BaseHTTPRequestHandler):
    def _send(self, data: dict, status: int = 200):
        body = json.dumps(data, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            scopes = gws_available_scopes()
            services_status = {}
            for svc in VERBS:
                services_status[svc] = {
                    "in_scope": service_in_scope(svc),
                    "verbs": list(VERBS[svc].keys()),
                }
            out_of_scope = [
                s for s, info in services_status.items() if not info["in_scope"]
            ]
            activation_steps = []
            if out_of_scope:
                activation_steps.append(
                    f"gws auth login --services {','.join(out_of_scope)} --readonly"
                )
                activation_steps.append(
                    "open the printed URL in a browser on the VPS, click Allow"
                )
                activation_steps.append(
                    "or: /root/forge_work/2026-08-25-gmail-bootstrap/gmail_one_shot.py"
                )
            self._send(
                {
                    "ok": True,
                    "bridge": "gws_bridge",
                    "protocol": "gws-cli",
                    "apa_version": "3.0",
                    "port": int(os.environ.get("GWS_BRIDGE_PORT", DEFAULT_PORT)),
                    "scopes_granted": sorted(
                        [
                            s.replace("https://www.googleapis.com/auth/", "")
                            for s in scopes
                        ]
                    ),
                    "services": services_status,
                    "status": "READY",
                    "out_of_scope": out_of_scope,
                    "activation_steps": activation_steps,
                }
            )
        elif self.path == "/verbs":
            self._send(
                {
                    "ok": True,
                    "services": {
                        svc: {"verbs": list(vv.keys())} for svc, vv in VERBS.items()
                    },
                }
            )
        else:
            self._send({"ok": False, "error": "not found"}, 404)

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}
        except Exception as e:
            self._send(envelope("?", "?", False, None, error=f"invalid json: {e}"), 400)
            return
        try:
            service = body.get("service", "")
            verb = body.get("verb", body.get("mode", ""))
            params = body.get("params", body)
            result = dispatch(service, verb, params)
            status = (
                200
                if result.get("ok")
                else (403 if "scope" in (result.get("error") or "").lower() else 400)
            )
            self._send(result, status)
        except Exception as e:
            log.exception("dispatch error")
            self._send(envelope("?", "?", False, None, error=f"bridge error: {e}"), 500)

    def log_message(self, format, *args):
        log.info("%s - %s", self.client_address[0], format % args)


def serve():
    port = int(os.environ.get("GWS_BRIDGE_PORT", DEFAULT_PORT))
    httpd = HTTPServer(("127.0.0.1", port), GWSBridgeHandler)
    log.info(
        "gws_bridge listening on 127.0.0.1:%d (services=%s)", port, list(VERBS.keys())
    )
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        log.info("gws_bridge shutting down")
        httpd.shutdown()


if __name__ == "__main__":
    serve()
