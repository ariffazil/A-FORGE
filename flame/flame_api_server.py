#!/usr/bin/env python3
"""FLAME API server — port 18901. Sources vault.env, calls FLAME CLI."""
import json, os, sys, subprocess, threading, time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from pathlib import Path

# ── Secrets ──────────────────────────────────────────────────────────
_secrets = Path("/root/.secrets/vault.env")
if _secrets.exists():
    for _line in _secrets.read_text().splitlines():
        _line = _line.strip()
        if _line.startswith("export ") and "=" in _line:
            _kv = _line[7:].split("=", 1)
            if len(_kv) == 2:
                _k, _v = _kv[0].strip(), _kv[1].strip().strip('"').strip("'")
                if _k and _k not in os.environ:
                    os.environ[_k] = _v

# ── Cache ────────────────────────────────────────────────────────────
_cache = {"probe": None, "last_probe": 0}

def _run_flame(args: list[str], stdin_text: str = "", timeout: int = 15) -> dict:
    """Run FLAME CLI and return JSON result."""
    try:
        cmd = ["/usr/local/bin/flame", "--json"] + args
        if stdin_text:
            cmd.append(stdin_text)
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=os.environ.copy())
        if r.returncode == 0 and r.stdout.strip():
            return json.loads(r.stdout)
        return {"error": r.stderr.strip()[:500] if r.stderr else "empty response"}
    except subprocess.TimeoutExpired:
        return {"error": "FLAME timeout"}
    except Exception as e:
        return {"error": str(e)[:500]}

def _cached_probe() -> dict:
    """Return cached probe or trigger background refresh."""
    now = time.time()
    if _cache["probe"] and (now - _cache["last_probe"]) < 120:
        return _cache["probe"]
    if not _cache["probe"]:
        def refresh():
            _cache["probe"] = _run_flame(["--mode", "probe"], timeout=20)
            _cache["last_probe"] = time.time()
        threading.Thread(target=refresh, daemon=True).start()
    return _cache["probe"] or {"status": "probing", "note": "Refresh in progress — retry in 10s"}

# ── Handler ─────────────────────────────────────────────────────────
class H(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send(200, {})
    def do_GET(self):
        path = urlparse(self.path).path
        action = path.rstrip("/").split("/")[-1] or "health"
        if action == "health":
            result = {"name": "FLAME API", "status": "live", "mode": "RM0-TOOLS-FREELOOP"}
        elif action == "probe":
            result = _cached_probe()
        elif action == "endpoints":
            result = {"/health": "this", "/probe": "model health", "/summarize": "POST {text}", "/classify": "POST {text, categories}"}
        else:
            result = {"name": "FLAME API", "status": "live", "endpoints": ["/health","/probe","/summarize","/classify"]}
        self._send(200, result)
    def do_POST(self):
        path = urlparse(self.path).path
        action = path.rstrip("/").split("/")[-1] or "summarize"
        length = int(self.headers.get("Content-Length", 0))
        query = {}
        if length:
            body = self.rfile.read(length).decode()
            try: query = json.loads(body)
            except: query = {"text": body}
        if action == "summarize":
            text = query.get("text", query.get("prompt", ""))
            if not text: result = {"error": "Missing text"}
            else: result = _run_flame(["--mode", "summarize"], stdin_text=text, timeout=20)
        elif action == "classify":
            text = query.get("text", "")
            cats = query.get("categories", "error,warning,info")
            if not text: result = {"error": "Missing text"}
            else: result = _run_flame(["--mode", "classify"], stdin_text=f"Classify: {text} into: {cats}", timeout=20)
        else:
            result = {"error": f"Unknown action: {action}"}
        self._send(200 if "error" not in result else 400, result)
    def _send(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    def log_message(self, *a): pass

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 18901
    print(f"FLAME API :{port}", file=sys.stderr, flush=True)
    HTTPServer(("127.0.0.1", port), H).serve_forever()
