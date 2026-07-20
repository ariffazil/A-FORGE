#!/usr/bin/env python3
"""FLAME API server — port 18901.

P0.7 fix (2026-07-20):
  - Only loads allowlisted provider API keys (not all secrets)
  - Passes prompts through real stdin (not command-line arguments)
  - Request size limit enforced
  - Typed caller envelope on all responses
  - /verify endpoint for cryptographic provenance validation

P1 fixes (2026-07-20 — FORGE rework):
  - POST /probe: real model probing (was GET-only, broken)
  - POST /v1/chat/completions: OpenAI-compatible chat (was "Unknown action")
  - POST /completions: simple text completions
  - GET /v1/routes: now calls _ensure_table() before snapshot
  - Startup: populate_table_from_probes() on engine init
  - _cached_probe(): fixed stale-cache bug
"""

import json, os, sys, subprocess, threading, time, hashlib
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from pathlib import Path

# ── Secrets — allowlisted provider keys only (P0.7 fix) ──────────────────
_FLAME_ALLOWLIST_KEYS = {
    "GROQ_API_KEY",
    "SEA_LION_API_KEY",
    "GEMINI_API_KEY",
    "CEREBRAS_API_KEY",
}

_secrets = Path("/root/.secrets/vault.env")
if _secrets.exists():
    for _line in _secrets.read_text().splitlines():
        _line = _line.strip()
        if _line.startswith("export ") and "=" in _line:
            _kv = _line[7:].split("=", 1)
            if len(_kv) == 2:
                _k, _v = _kv[0].strip(), _kv[1].strip().strip('"').strip("'")
                if _k and _k in _FLAME_ALLOWLIST_KEYS and _k not in os.environ:
                    os.environ[_k] = _v

# ── Constants ────────────────────────────────────────────────────────────

MAX_REQUEST_CHARS = 50_000  # P0.7: request size limit
MAX_BODY_BYTES = 200_000  # HTTP body limit

# ── Cache ────────────────────────────────────────────────────────────────

_cache = {"probe": None, "last_probe": 0, "refreshing": False}


def _chain():
    return os.getenv("FLAME_CHAIN", "RM0-TOOLS-FREELOOP")


def _build_envelope(env: dict | None = None) -> dict:
    """Build FLAME caller envelope — only FLAME-specific env vars."""
    base = {}
    if env:
        for k in _FLAME_ALLOWLIST_KEYS:
            if k in env:
                base[k] = env[k]
    return base


def _run_flame(
    args: list[str],
    stdin_text: str = "",
    timeout: int = 15,
    sensitivity: str = "PUBLIC",
    caller_id: str = "flame-api",
) -> dict:
    """Run FLAME CLI with stdin (P0.7 fix: not command-line args).
    Returns JSON result with provenance envelope.
    """
    if len(stdin_text) > MAX_REQUEST_CHARS:
        return {
            "error": f"Request exceeds {MAX_REQUEST_CHARS} chars",
            "authority": "ADVISORY",
            "ok": False,
            "failure_class": "request_too_large",
        }

    try:
        cmd = [
            "/usr/bin/python3",
            "/root/A-FORGE/flame/flame_router.py",
            "--json",
            "--sensitivity",
            sensitivity,
            "--caller",
            caller_id,
        ] + args

        # P0.7: Pass prompt through stdin, NOT command-line args
        r = subprocess.run(
            cmd,
            input=stdin_text,  # Real stdin — not appended to argv
            capture_output=True,
            text=True,
            timeout=timeout,
            env=_build_envelope(dict(os.environ)),  # Only FLAME keys
        )
        if r.returncode == 0 and r.stdout.strip():
            result = json.loads(r.stdout)
            result["authority"] = "ADVISORY"
            result["_flame_api"] = {
                "server": "flame-api-server",
                "caller_id": caller_id,
                "sensitivity": sensitivity,
            }
            return result
        return {
            "error": r.stderr.strip()[:500] if r.stderr else "empty response",
            "authority": "ADVISORY",
            "ok": False,
        }
    except subprocess.TimeoutExpired:
        return {"error": "FLAME timeout", "authority": "ADVISORY", "ok": False}
    except Exception as e:
        return {"error": str(e)[:500], "authority": "ADVISORY", "ok": False}


def _cached_probe() -> dict:
    """Return cached probe or trigger background refresh.

    P1 FIX (2026-07-20): Was returning stale cache indefinitely.
    Now returns "probing" status while refresh runs, with timeout.
    """
    global _cache
    now = time.time()

    # Return fresh cache (within 120s)
    if _cache["probe"] and (now - _cache["last_probe"]) < 120:
        return _cache["probe"]

    # If no cache or stale AND not already refreshing, trigger refresh
    if not _cache["refreshing"]:
        _cache["refreshing"] = True

        def refresh():
            global _cache
            result = _run_flame(["--mode", "probe"], timeout=120)
            result["authority"] = "ADVISORY"
            _cache["probe"] = result
            _cache["last_probe"] = time.time()
            _cache["refreshing"] = False

        threading.Thread(target=refresh, daemon=True).start()

    # Return current cache (may be stale) or probing status
    return _cache["probe"] or {
        "status": "probing",
        "note": "Refresh in progress — retry in 10s",
        "authority": "ADVISORY",
    }


def _live_probe() -> dict:
    """Synchronous live probe — blocks until results return.
    Used by POST /probe for real-time model health checks.
    """
    result = _run_flame(["--mode", "probe"], timeout=120)
    result["authority"] = "ADVISORY"
    # Update cache
    _cache["probe"] = result
    _cache["last_probe"] = time.time()
    return result


# ── Engine singleton ────────────────────────────────────────────────────
_engine = None


def _get_engine():
    global _engine
    if _engine is None:
        from flame_router import FlameEngine

        _engine = FlameEngine()
        # P1 FIX: Populate routing table on startup
        _startup_probe(_engine)
    return _engine


def _startup_probe(engine):
    """P1 FIX: Run initial probe in background to populate routing table."""

    def _probe():
        try:
            engine.populate_table_from_probes()
            engine._save_state()
            print(
                f"FLAME startup probe complete — {len(engine.routing_table.snapshot()['routes'])} routes",
                file=sys.stderr,
                flush=True,
            )
        except Exception as e:
            print(f"FLAME startup probe failed: {e}", file=sys.stderr, flush=True)

    threading.Thread(target=_probe, daemon=True).start()


# ── Handler ─────────────────────────────────────────────────────────────


class H(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send(200, {"authority": "ADVISORY"})

    def do_GET(self):
        path = urlparse(self.path).path
        action = path.rstrip("/").split("/")[-1] or "health"
        if action == "health":
            result = {
                "name": "FLAME API",
                "status": "live",
                "chain": _chain(),
                "mode": "RM0-TOOLS-FREELOOP",
                "authority": "ADVISORY",
                "p0_fixes": [
                    "seal→snapshot-checksum",
                    "reasoning_no_final=fail",
                    "rm0_hard_gate",
                    "safety_refuse_no_shop",
                    "allowlisted_env",
                    "stdin_not_argv",
                    "request_size_limit",
                ],
                "p1_fixes": [
                    "post-probe-live",
                    "chat-completions",
                    "simple-completions",
                    "startup-table-populate",
                    "stale-cache-fix",
                    "routes-ensure-table",
                ],
            }
        elif action == "probe":
            result = _cached_probe()
        elif action == "endpoints":
            result = {
                "/health": "this",
                "/probe": "GET cached / POST live model health",
                "/v1/routes": "live routing table",
                "/v1/stream": "POST {text} — SSE streaming",
                "/v1/chat/completions": "POST — OpenAI-compatible chat",
                "/completions": "POST {prompt} — simple text",
                "/summarize": "POST {text, sensitivity?, caller_id?}",
                "/classify": "POST {text, categories?, sensitivity?, caller_id?}",
                "/verify": "POST {fingerprint, prompt_hash, content, model, provider, created_at}",
                "authority": "ADVISORY",
            }
        elif action == "routes":
            # P1 FIX: ensure table is populated before snapshot
            engine = _get_engine()
            engine._ensure_table()
            result = {
                "routing_table": engine.routing_table.snapshot(),
                "authority": "ADVISORY",
            }
        else:
            result = {
                "name": "FLAME API",
                "status": "live",
                "endpoints": [
                    "/health",
                    "/probe",
                    "/summarize",
                    "/classify",
                    "/verify",
                    "/v1/chat/completions",
                    "/completions",
                ],
                "authority": "ADVISORY",
            }
        self._send(200, result)

    def do_POST(self):
        path = urlparse(self.path).path
        action = path.rstrip("/").split("/")[-1] or "summarize"

        # P0.7: Body size limit
        length = min(int(self.headers.get("Content-Length", 0)), MAX_BODY_BYTES)
        query = {}
        if length:
            body = self.rfile.read(length).decode()
            try:
                query = json.loads(body)
            except Exception:
                query = {"text": body[:MAX_REQUEST_CHARS]}

        sensitivity = query.get("sensitivity", "PUBLIC")
        caller_id = query.get("caller_id", "flame-api")

        if action == "summarize":
            text = query.get("text", query.get("prompt", ""))
            if not text:
                result = {"error": "Missing text", "authority": "ADVISORY"}
            else:
                result = _run_flame(
                    ["--mode", "summarize"],
                    stdin_text=text,
                    timeout=20,
                    sensitivity=sensitivity,
                    caller_id=caller_id,
                )
        elif action == "classify":
            text = query.get("text", "")
            cats = query.get("categories", "error,warning,info")
            if not text:
                result = {"error": "Missing text", "authority": "ADVISORY"}
            else:
                result = _run_flame(
                    ["--mode", "classify"],
                    stdin_text=f"Classify: {text} into: {cats}",
                    timeout=20,
                    sensitivity=sensitivity,
                    caller_id=caller_id,
                )
        elif action == "verify":
            # GAP-2: Cryptographic provenance verification
            required = [
                "fingerprint",
                "prompt_hash",
                "content",
                "model",
                "provider",
                "created_at",
            ]
            missing = [f for f in required if f not in query]
            if missing:
                result = {
                    "valid": False,
                    "error": f"Missing fields: {missing}",
                    "authority": "ADVISORY",
                }
            else:
                material = (
                    f"{query['prompt_hash']}|{query['content']}|"
                    f"{query['model']}|{query['provider']}|{query['created_at']}"
                )
                computed = hashlib.sha256(material.encode()).hexdigest()
                valid = computed == query["fingerprint"]
                result = {
                    "valid": valid,
                    "computed_fingerprint": computed,
                    "claimed_fingerprint": query["fingerprint"],
                    "verdict": (
                        "VALID"
                        if valid
                        else "INVALID — content tampered or provenance forged"
                    ),
                    "authority": "ADVISORY",
                    "note": "FLAME output is ALWAYS advisory. VALID fingerprint ≠ authoritative truth.",
                }
        elif action == "stream":
            # SSE streaming endpoint
            text = query.get("text", query.get("prompt", ""))
            if not text:
                self._send(400, {"error": "Missing text", "authority": "ADVISORY"})
                return
            self._handle_stream(text, sensitivity, caller_id)
            return  # _handle_stream writes directly

        # ── P1 NEW: Completions — simple + chat (OpenAI-compatible) ─────
        elif action == "completions":
            # Detect if /v1/chat/completions (messages) or /completions (prompt)
            path_parts = path.rstrip("/").split("/")
            is_chat = len(path_parts) >= 2 and path_parts[-2] == "chat"
            messages = query.get("messages", [])

            if is_chat and messages:
                # OpenAI-compatible: extract prompt from messages
                system = ""
                user_msgs = []
                for m in messages:
                    if m.get("role") == "system":
                        system = m.get("content", "")
                    elif m.get("role") == "user":
                        user_msgs.append(m.get("content", ""))
                prompt = "\n".join(user_msgs)
                max_tokens = int(query.get("max_tokens", 512))
            else:
                # Simple completions: direct prompt
                prompt = query.get("prompt", query.get("text", ""))
                system = query.get("system", "")
                max_tokens = int(query.get("max_tokens", 256))

            if not prompt:
                result = {
                    "error": "Missing prompt or messages",
                    "authority": "ADVISORY",
                }
            else:
                temperature = float(query.get("temperature", 0.3))
                engine = _get_engine()
                raw = engine.call(
                    prompt,
                    system=system,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    sensitivity=sensitivity,
                )
                # Convert FlameResult to dict
                result = {
                    "content": raw.content,
                    "model": raw.model,
                    "provider": raw.provider,
                    "latency_ms": raw.latency_ms,
                    "ok": raw.ok,
                    "error": raw.error,
                    "fingerprint": raw.fingerprint,
                    "prompt_hash": raw.prompt_hash,
                    "classification": raw.classification,
                    "authority": raw.authority,
                    "chain_id": raw.chain_id,
                    "tried": raw.tried,
                }

        # ── P1 NEW: Live probe ─────────────────────────────────────────
        elif action == "probe":
            result = _live_probe()

        else:
            result = {"error": f"Unknown action: {action}", "authority": "ADVISORY"}
        self._send(200 if "error" not in result else 400, result)

    def _handle_stream(self, text: str, sensitivity: str, caller_id: str):
        """Handle SSE streaming response."""
        engine = _get_engine()
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("X-FLAME-Authority", "ADVISORY")
        self.end_headers()

        try:
            for chunk in engine.stream(text, sensitivity=sensitivity):
                if chunk.get("token"):
                    payload = json.dumps(
                        {"token": chunk["token"], "authority": "ADVISORY"}
                    )
                    self.wfile.write(f"data: {payload}\n\n".encode())
                elif chunk.get("done"):
                    payload = json.dumps(
                        {
                            "done": True,
                            "model": chunk.get("model", "HOLD"),
                            "usage": chunk.get("usage", {}),
                            "error": chunk.get("error", ""),
                            "authority": "ADVISORY",
                        }
                    )
                    self.wfile.write(f"event: done\ndata: {payload}\n\n".encode())
                    return
                self.wfile.flush()
        except Exception as e:
            error_payload = json.dumps({"error": str(e), "authority": "ADVISORY"})
            self.wfile.write(f"event: error\ndata: {error_payload}\n\n".encode())

    def _send(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("X-FLAME-Authority", "ADVISORY")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 18901
    print(f"FLAME API :{port} chain={_chain()}", file=sys.stderr, flush=True)
    HTTPServer(("127.0.0.1", port), H).serve_forever()
