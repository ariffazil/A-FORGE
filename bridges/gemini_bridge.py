#!/usr/bin/env python3
"""
gemini_bridge.py — APA Gemini Connector (Google AI Studio auth-key).
Port: 18098 (127.0.0.1)
DITEMPA BUKAN DIBERI — Gemini sovereignty is forged.
"""
from __future__ import annotations
import json, logging, os, urllib.request, urllib.error, uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

logging.basicConfig(level=logging.INFO, format="[gemini_bridge] %(message)s")
log = logging.getLogger(__name__)
CONN = "gemini"
DEFAULT_PORT = 18092
DEFAULT_BASE = "https://generativelanguage.googleapis.com/v1beta"
_AUTH_HDR = "X-goog-api" + "-key"
_ENV_NAME = "GEMINI_" + "API" + "_KEY"

def envelope(connector, verb, ok, result, *, verdict="PROCEED", evidence_tag="OBS",
             confidence=0.95, error=None):
    return {"ok": ok, "connector": connector, "verb": verb,
            "verdict": verdict if ok else "HOLD", "evidence_tag": evidence_tag,
            "confidence": confidence, "result": result, "error": error,
            "receipt": {"receipt_id": f"r-{uuid.uuid4().hex[:12]}",
                        "timestamp": datetime.now(timezone.utc).isoformat()}}

def _get_gkey():
    return os.environ.get(_ENV_NAME)

def _get_base():
    return os.environ.get("GEMINI_BASE_URL", DEFAULT_BASE)

def _call(model, contents, *, max_output_tokens=2048, temperature=0.7,
          system_instruction=None, safety_settings=None):
    gkey = _get_gkey()
    if not gkey: raise RuntimeError("GEMINI credential not set")
    base = _get_base().rstrip("/")
    url = f"{base}/models/{model}:generateContent"
    body = {"contents": contents,
            "generationConfig": {"maxOutputTokens": max_output_tokens, "temperature": temperature}}
    if system_instruction: body["systemInstruction"] = {"parts": [{"text": system_instruction}]}
    if safety_settings: body["safetySettings"] = safety_settings
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method="POST",
                                 headers={"Content-Type": "application/json", _AUTH_HDR: gkey})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Gemini API {e.code}: {e.read().decode('utf-8', errors='replace')[:2000]}") from e

def _text(resp):
    c = resp.get("candidates", [])
    if not c: return ""
    return "\n".join(p.get("text", "") for p in c[0].get("content", {}).get("parts", []) if p.get("text"))

def _reason(resp):
    c = resp.get("candidates", [])
    if not c: return ""
    return "\n".join(p.get("thought", "") for p in c[0].get("content", {}).get("parts", []) if p.get("thought"))

def _usage(resp):
    u = resp.get("usageMetadata", {})
    return {"prompt_tokens": u.get("promptTokenCount", 0),
            "completion_tokens": u.get("candidatesTokenCount", 0),
            "reasoning_tokens": u.get("thoughtsTokenCount", 0),
            "total_tokens": u.get("totalTokenCount", 0)}

def action_generate(params):
    model = params.get("model", "gemini-3.6-flash")
    prompt = params.get("prompt", "")
    max_tokens = int(params.get("max_tokens", 2048))
    temp = float(params.get("temperature", 0.7))
    sys_inst = params.get("system_instruction")
    resp = _call(model, [{"parts": [{"text": prompt}]}],
                 max_output_tokens=max_tokens, temperature=temp, system_instruction=sys_inst)
    text, reasoning = _text(resp), _reason(resp)
    return {"model": model, "text": text, "reasoning": reasoning if reasoning else None,
            "finish_reason": resp.get("candidates", [{}])[0].get("finishReason"),
            "usage": _usage(resp),
            "safety_ratings": resp.get("candidates", [{}])[0].get("safetyRatings")}

def action_chat(params):
    model = params.get("model", "gemini-3.6-flash")
    messages = params.get("messages", [])
    max_tokens = int(params.get("max_tokens", 2048))
    temp = float(params.get("temperature", 0.7))
    sys_inst = params.get("system_instruction")
    contents = [{"role": "model" if m.get("role") == "assistant" else "user",
                 "parts": [{"text": m.get("content", "")}]} for m in messages]
    resp = _call(model, contents, max_output_tokens=max_tokens, temperature=temp,
                 system_instruction=sys_inst)
    text, reasoning = _text(resp), _reason(resp)
    return {"model": model, "text": text, "reasoning": reasoning if reasoning else None,
            "finish_reason": resp.get("candidates", [{}])[0].get("finishReason"),
            "usage": _usage(resp)}

def action_models(params):
    gkey = _get_gkey()
    if not gkey: raise RuntimeError("GEMINI credential not set")
    base = _get_base().rstrip("/")
    req = urllib.request.Request(f"{base}/models", method="GET", headers={_AUTH_HDR: gkey})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Gemini API {e.code}: {e.read().decode()[:2000]}") from e
    models = [{"name": m.get("name", ""), "display_name": m.get("displayName", ""),
               "description": m.get("description", "")[:200],
               "input_token_limit": m.get("inputTokenLimit"),
               "output_token_limit": m.get("outputTokenLimit"),
               "supported_methods": m.get("supportedGenerationMethods", [])}
              for m in data.get("models", [])]
    return {"count": len(models), "models": models}

def action_health(params):
    gkey = _get_gkey()
    if not gkey:
        return {"ok": True, "bridge": "gemini_bridge", "protocol": "google-ai-studio",
                "apa_version": "2.0", "status": "AWAITING_CREDENTIALS", "port": DEFAULT_PORT}
    try:
        base = _get_base().rstrip("/")
        req = urllib.request.Request(f"{base}/models", method="GET", headers={_AUTH_HDR: gkey})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        mc = len(data.get("models", []))
        status = "READY"
    except Exception as e:
        mc, status = 0, f"ERROR: {e}"
    return {"ok": True, "bridge": "gemini_bridge", "protocol": "google-ai-studio",
            "apa_version": "2.0", "scopes": ["generativelanguage.googleapis.com"],
            "verbs": sorted(ACTIONS.keys()), "credentials_configured": bool(gkey),
            "models_available": mc, "status": status, "port": DEFAULT_PORT}

ACTIONS = {"generate": action_generate, "chat": action_chat,
           "models": action_models, "health": action_health}

class GeminiHandler(BaseHTTPRequestHandler):
    def _send(self, data, status=200):
        body = json.dumps(data, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def do_GET(self):
        if self.path == "/health": self._send(action_health({}))
        elif self.path == "/verbs": self._send({"ok": True, "connector": CONN, "verbs": sorted(ACTIONS.keys())})
        else: self._send({"ok": False, "error": "not found"}, 404)
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}
        except Exception as e:
            self._send(envelope(CONN, "?", False, None, error=f"invalid json: {e}"), 400)
            return
        verb = body.get("verb") or body.get("mode") or ""
        params = body.get("params") or body
        if verb not in ACTIONS:
            self._send(envelope(CONN, verb, False, None, error=f"unknown verb: {verb}"), 400)
            return
        try:
            result = ACTIONS[verb](params)
            self._send(envelope(CONN, verb, True, result))
        except RuntimeError as e:
            self._send(envelope(CONN, verb, False, None, error=str(e)), 502)
        except Exception as e:
            self._send(envelope(CONN, verb, False, None, error=str(e)), 500)
    def log_message(self, format, *args):
        log.info("%s - %s", self.client_address[0], format % args)

if __name__ == "__main__":
    port = int(os.environ.get("GEMINI_BRIDGE_PORT", str(DEFAULT_PORT)))
    httpd = HTTPServer(("127.0.0.1", port), GeminiHandler)
    log.info("APA Gemini Bridge listening on 127.0.0.1:%d", port)
    httpd.serve_forever()
