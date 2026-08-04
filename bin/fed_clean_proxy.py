#!/usr/bin/env python3
"""
FED Clean Proxy — strips unsupported Responses API features before forwarding to LiteLLM.

Why this exists:
  LiteLLM 1.90.2 supports the `callbacks` config but the custom callback for
  /v1/responses is NOT being invoked reliably. To unblock Codex CLI v0.146
  (which hard-codes store=true + web_search tool), we put a tiny HTTP proxy
  in front of LiteLLM that strips these fields at the wire level.

Route:
  Codex → http://127.0.0.1:4001/v1/*  →  this proxy  →  http://127.0.0.1:4000/v1/*  →  LiteLLM

This proxy is intentionally minimal: only /v1/responses is transformed.
  All other paths forward as-is. Authentication header passes through.

Reversibility: T2 stop + restore Codex base_url = http://127.0.0.1:4000

Author: kimi-code/FI-008 (warga AAA)
Sovereign: F13 (Muhammad Arif bin Fazil)
Date: 2026-08-04T15
Doctrine: DITEMPA BUKAN DIBERI
"""

import http.server
import json
import logging
import sys
import urllib.request
import urllib.error

LISTEN_HOST = "127.0.0.1"
LISTEN_PORT = 4001
UPSTREAM = "http://127.0.0.1:4000"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [FED-CLEAN] %(levelname)s %(message)s",
    stream=sys.stdout,
)
_LOG = logging.getLogger("fed-clean-proxy")


def _strip_responses_features(body: bytes, content_type: str) -> bytes:
    """Strip store=true and web_search tool from Responses API request bodies."""
    if "application/json" not in (content_type or ""):
        return body
    try:
        data = json.loads(body.decode("utf-8"))
    except Exception:
        return body  # not JSON, pass through

    mutated = []

    # 1) Force store=false
    if isinstance(data, dict) and data.get("store") is True:
        data["store"] = False
        mutated.append("store:true->false")

    # 2) Drop web_search tool
    if isinstance(data, dict) and isinstance(data.get("tools"), list):
        before = len(data["tools"])
        data["tools"] = [
            t for t in data["tools"]
            if not (isinstance(t, dict) and t.get("type") == "web_search")
        ]
        if len(data["tools"]) != before:
            mutated.append(f"web_search_tool:dropped({before - len(data['tools'])})")

    if mutated:
        _LOG.info("stripped: %s", "+".join(mutated))
        return json.dumps(data, ensure_ascii=False).encode("utf-8")
    return body


class _ProxyHandler(http.server.BaseHTTPRequestHandler):
    """Forwards to LiteLLM, stripping Responses API features on the way."""

    def log_message(self, fmt, *args):
        _LOG.info("%s - %s", self.address_string(), fmt % args)

    def _do(self, method: str) -> None:
        # Read incoming body
        content_length = int(self.headers.get("Content-Length", 0) or 0)
        body = self.rfile.read(content_length) if content_length else b""
        content_type = self.headers.get("Content-Type", "")

        # Strip if Responses API request
        if self.path.startswith("/v1/responses"):
            body = _strip_responses_features(body, content_type)

        # Build upstream request
        url = UPSTREAM + self.path
        req = urllib.request.Request(url, data=body, method=method)
        # Forward headers (skip hop-by-hop)
        for k, v in self.headers.items():
            lk = k.lower()
            if lk in ("host", "content-length", "transfer-encoding", "connection"):
                continue
            req.add_header(k, v)
        # Ensure Content-Length is correct after mutation
        if body:
            req.remove_header("Content-Length")
            req.add_header("Content-Length", str(len(body)))

        # Send to upstream
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                for k, v in resp.getheaders():
                    lk = k.lower()
                    if lk in ("transfer-encoding", "connection", "server"):
                        continue
                    self.send_header(k, v)
                self.send_header("Content-Length", str(len(resp_body)))
                self.end_headers()
                self.wfile.write(resp_body)
        except urllib.error.HTTPError as e:
            err_body = e.read() if hasattr(e, "read") else b""
            self.send_response(e.code)
            self.send_header("Content-Type", e.headers.get("Content-Type", "application/json"))
            self.send_header("Content-Length", str(len(err_body)))
            self.end_headers()
            self.wfile.write(err_body)
        except Exception as exc:
            err = json.dumps({"error": {"message": str(exc), "type": "proxy_error"}}).encode()
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(err)))
            self.end_headers()
            self.wfile.write(err)

    def do_GET(self):
        self._do("GET")

    def do_POST(self):
        self._do("POST")

    def do_PUT(self):
        self._do("PUT")

    def do_DELETE(self):
        self._do("DELETE")


def main():
    server = http.server.ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), _ProxyHandler)
    _LOG.info("FED Clean Proxy listening on %s:%d → %s", LISTEN_HOST, LISTEN_PORT, UPSTREAM)
    _LOG.info("Strips: store=true→false + web_search tool (Responses API only)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        _LOG.info("Shutting down")
        server.shutdown()


if __name__ == "__main__":
    main()