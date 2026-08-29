#!/usr/bin/env python3
"""minimax-relay: minimal OpenAI-compat HTTP relay → https://api.minimax.io/v1.
Listens on 127.0.0.1:4011 to replace litellm for FED Gateway haproxy backend.
Forces `model: MiniMax-M3` on every chat-completion request (drop-in for `forge-777`).
"""
import http.server, socketserver, json, os, urllib.request, urllib.error, sys

PORT = 4011
HOST = "127.0.0.1"
UPSTREAM = "https://api.minimax.io"
UPSTREAM_API = "https://api.minimax.io/v1"

API_KEY = os.environ.get("MINIMAX_API_KEY", "")
if not API_KEY:
    print("MINIMAX_API_KEY not in env", file=sys.stderr, flush=True)
    sys.exit(2)


def forward_post(body: bytes, path: str, content_type: str):
    # rewrite model to MiniMax-M3 (drop-in for forge-777)
    try:
        j = json.loads(body)
        if isinstance(j, dict) and "model" in j:
            j["model"] = "MiniMax-M3"
        body = json.dumps(j).encode("utf-8")
    except Exception:
        pass
    # Strip leading /v1 if present; ALWAYS hit /chat/completions (don't trust caller path)
    url = UPSTREAM_API + "/chat/completions"
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": content_type or "application/json",
            "Authorization": f"Bearer {API_KEY}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()
    except Exception as e:
        return 502, {"Content-Type": "application/json"}, json.dumps({"error": str(e)}).encode()


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("%s - - %s\n" % (self.address_string(), fmt % args))
        sys.stderr.flush()

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/v1/models"):
            try:
                req = urllib.request.Request(
                    UPSTREAM_API + "/models",
                    headers={"Authorization": f"Bearer {API_KEY}"},
                )
                with urllib.request.urlopen(req, timeout=10) as r:
                    body = r.read()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(body)))
                    self._cors()
                    self.end_headers()
                    self.wfile.write(body)
            except Exception as e:
                msg = json.dumps({"error": str(e)}).encode()
                self.send_response(502)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(msg)))
                self.end_headers()
                self.wfile.write(msg)
            return
        if self.path in ("/", "/health", "/health/liveliness", "/health/readiness"):
            body = b'{"status":"ok"}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_response(404)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0") or 0)
        body = self.rfile.read(length) if length else b""
        status, headers, payload = forward_post(body, self.path, self.headers.get("Content-Type", ""))
        self.send_response(status)
        for k in ("Content-Type",):
            if k in headers:
                self.send_header(k, headers[k])
        self.send_header("Content-Length", str(len(payload)))
        self._cors()
        self.end_headers()
        self.wfile.write(payload)


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    srv = ThreadedHTTPServer((HOST, PORT), Handler)
    print(f"minimax-relay listening on {HOST}:{PORT}", flush=True)
    srv.serve_forever()
