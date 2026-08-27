#!/usr/bin/env python3
"""
iarif_synthesis.py — i-ARIF Synthesis Service (Seal B engine)
═══════════════════════════════════════════════════════════════════════════════

F13-ratified Seal B (I_ARIF_EPSTEMIC_FLOOR_2026_08_19): all labor-layer output
(333/555/777/888) destined for human channels MUST pass through i-ARIF for
synthesis. This service IS that pass — a loopback-only membrane.

Contract:
  POST /synthesize {"text": ..., "actor_id": ..., "source_channel": ...}
    → 200 {"synthesized": ..., "latency_ms": ..., "typing_required": bool}
    Engine: FED :4000 cascade alias `i-arif` (P1 qwen3.8-max → P2 M3 →
    P3 glm-5.3 → P4 mimo → P5 deepseek-flash; ratified 2026-08-19).
    typing_required=true when latency > 3000ms (Seal B UX floor: gateway
    must emit typing indicator BEFORE final flush).

  POST /synthesize {"text": ..., "bypass_reason": "...}
    → 200 BYPASS_RECEIPT path: durably logged (jsonl + arifFlow telemetry),
    returns ack. Only legal when i-ARIF unavailable or F13-explicit.

  GET /health → liveness.

Wires: F4 (ΔS<0), F11 (bypass receipts), F13 (sovereign bypass).
Loopback only — LOCALHOST_IS_PASSWORD doctrine.

DITEMPA BUKAN DIBERI — Forged, Not Given (FI-003, 2026-08-21)
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FED_URL = os.environ.get("IARIF_FED_URL", "http://127.0.0.1:4000/v1/chat/completions")
FED_KEY = os.environ.get("IARIF_FED_KEY", "")
LATENCY_CAP_MS = 3000  # Seal B UX floor
RECEIPT_PATH = "/root/forge_work/iarif/bypass_receipts.jsonl"
TELEMETRY_URL = "http://127.0.0.1:7073/ingest"

SYSTEM_PROMPT = (
    "You are i-ARIF, the synthesis membrane of the arifOS federation. "
    "Compress the labor-layer draft below into the final sovereign-facing reply. "
    "Rules: keep meaning, cut entropy (ΔS ≤ 0); preserve the author's language "
    "(Malay/English/mixed) and tone; no new claims; no preamble; if the draft is "
    "already minimal, return it near-unchanged. Output ONLY the final reply text."
)


def _bypass_receipt(actor_id: str, reason: str, channel: str) -> str:
    os.makedirs(os.path.dirname(RECEIPT_PATH), exist_ok=True)
    import uuid

    rid = f"BYPASS-{uuid.uuid4().hex[:12]}"
    entry = {
        "receipt_id": rid,
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "actor_id": actor_id,
        "reason": reason,
        "channel": channel,
        "exported_telemetry": False,
    }
    try:
        body = json.dumps(
            {
                "receipt_id": rid,
                "created_at": entry["ts"],
                "actor_id": actor_id,
                "step_type": "Execute",
                "summary": f"[BYPASS_RECEIPT] {reason}",
                "epistemic_label": "Observation",
            }
        ).encode()
        req = urllib.request.Request(
            TELEMETRY_URL, data=body, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=2):
            entry["exported_telemetry"] = True
    except Exception:
        pass  # fail-open: receipt on disk is the durable witness
    with open(RECEIPT_PATH, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return rid


def _synthesize(text: str) -> tuple[str, int]:
    t0 = time.monotonic()
    payload = json.dumps(
        {
            "model": "i-arif",
            "max_tokens": 2048,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
        }
    ).encode()
    req = urllib.request.Request(
        FED_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {FED_KEY}",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.loads(r.read())
    out = ""
    for ch in d.get("choices", []):
        msg = ch.get("message", {})
        if msg.get("content"):
            out = msg["content"]
            break
    return out.strip(), int((time.monotonic() - t0) * 1000)


class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, obj: dict, extra_headers: dict | None = None):
        raw = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        for k, v in (extra_headers or {}).items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"status": "ok", "seal": "B", "engine": "fed:i-arif"})
            return
        self._json(404, {"error": "not_found"})

    def do_POST(self):
        if not self.path.startswith("/synthesize"):
            self._json(404, {"error": "not_found"})
            return
        try:
            length = int(self.headers.get("Content-Length") or "0")
            body = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            self._json(400, {"error": "bad_json"})
            return
        actor = body.get("actor_id", "unknown")
        channel = body.get("source_channel", "telegram")

        if body.get("bypass_reason"):
            rid = _bypass_receipt(actor, str(body["bypass_reason"]), channel)
            self._json(
                200,
                {
                    "status": "BYPASS_RECEIPT_LOGGED",
                    "receipt_id": rid,
                    "f13_notify": "gateway alarm lane (gateway-side obligation)",
                },
            )
            return

        text = body.get("text")
        if not text:
            self._json(400, {"error": "text_required"})
            return
        try:
            out, ms = _synthesize(str(text))
        except Exception as e:
            # Seal B bypass protocol condition 1: i-ARIF unavailable.
            rid = _bypass_receipt(actor, f"synthesis_unavailable: {e}"[:180], channel)
            self._json(
                503,
                {
                    "status": "IARIF_UNAVAILABLE",
                    "bypass_receipt": rid,
                    "error": str(e)[:200],
                },
            )
            return
        self._json(
            200,
            {
                "status": "SYNTHESIZED",
                "synthesized": out,
                "latency_ms": ms,
                "typing_required": ms > LATENCY_CAP_MS,
                "engine": "fed:i-arif",
            },
            extra_headers={"X-Iarif-Latency-Ms": str(ms)},
        )

    def log_message(self, fmt, *args):
        sys.stderr.write("[iarif-synthesis] " + fmt % args + "\n")


def main():
    srv = ThreadingHTTPServer(("127.0.0.1", 18095), Handler)
    sys.stderr.write("[iarif-synthesis] Seal B engine live on 127.0.0.1:18095\n")
    srv.serve_forever()


if __name__ == "__main__":
    main()
