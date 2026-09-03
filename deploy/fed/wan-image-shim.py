#!/usr/bin/env python3
# wan-image-shim: OpenAI chat/completions -> Aliyun token-plan multimodal-generation
# Translates the hybrid native response into clean OpenAI shape.
# Forged 2026-09-04 by FI-003 (Qwen Code) under F13 directive "Fix FED now".
import json, os, time, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

UPSTREAM = "https://token-plan.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
API_KEY = os.environ.get("QWEN_API_KEY", "")
PORT = int(os.environ.get("WAN_SHIM_PORT", "4020"))
BIND = os.environ.get("WAN_SHIM_BIND", "100.64.0.5")

class H(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[wan-shim] {self.address_string()} {fmt % args}", flush=True)

    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/health", "/health/liveliness"):
            self._send(200, {"status": "ok", "service": "wan-image-shim"})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/v1/chat/completions":
            self._send(404, {"error": {"message": "only /v1/chat/completions"}})
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
            req = json.loads(self.rfile.read(n))
        except Exception as e:
            self._send(400, {"error": {"message": f"bad json: {e}"}})
            return

        model = req.get("model", "wan2.7-image-pro")
        # merge text parts from OpenAI content (string or list)
        content = (req.get("messages") or [{}])[0].get("content", "")
        if isinstance(content, list):
            text = " ".join(p.get("text", "") for p in content if isinstance(p, dict))
        else:
            text = str(content)

        upstream_body = {
            "model": model,
            "input": {"messages": [{"role": "user", "content": [{"text": text}]}]},
            "parameters": {"n": req.get("n", 1), "size": "1024*1024"},
        }
        r = urllib.request.Request(UPSTREAM, data=json.dumps(upstream_body).encode(),
            headers={"Authorization": "Bearer " + API_KEY, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(r, timeout=170) as resp:
                out = json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            self._send(e.code, {"error": {"message": f"upstream: {e.read().decode()[:500]}"}})
            return
        except Exception as e:
            self._send(502, {"error": {"message": f"upstream fail: {e}"}})
            return

        urls, usage = [], out.get("usage", {})
        try:
            for ch in out["output"]["choices"]:
                for c in ch["message"]["content"]:
                    if "image" in c:
                        urls.append(c["image"])
        except Exception:
            pass
        if not urls:
            self._send(502, {"error": {"message": "no image in upstream response", "raw_keys": list(out.keys())}})
            return

        md = "\n".join(f"![generated image {i+1}]({u})" for i, u in enumerate(urls))
        self._send(200, {
            "id": f"wan-shim-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": md}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": usage.get("input_tokens", 0), "completion_tokens": usage.get("output_tokens", 0), "total_tokens": usage.get("total_tokens", 0)},
            "image_urls": urls,
        })

if __name__ == "__main__":
    print(f"[wan-shim] binding {BIND}:{PORT} -> {UPSTREAM}", flush=True)
    ThreadingHTTPServer((BIND, PORT), H).serve_forever()
