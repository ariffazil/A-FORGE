#!/usr/bin/env python3
"""
telegram_bridge.py — APA Telegram Connector: Sovereign Bot API bridge.
Part of APA v1.0 — Autonomous Protocol for Applications.

F13 veto surface. Hermes control path. Lease-gated messaging.
Port: 18096 (internal, 127.0.0.1)

DITEMPA BUKAN DIBERI — Control sovereignty is forged.
"""

import json, os, logging, requests
from http.server import HTTPServer, BaseHTTPRequestHandler

logging.basicConfig(level=logging.INFO, format='[telegram_bridge] %(message)s')
log = logging.getLogger(__name__)

# F2 token hygiene: A-FORGE = HANDS → speak as @arifOS_bot (FORGE_BOT_TOKEN).
# TELEGRAM_BOT_TOKEN belongs to OpenClaw; never ride another agent's identity.
TOKEN = os.environ.get("FORGE_BOT_TOKEN", os.environ.get("TELEGRAM_BOT_TOKEN", ""))
API = f"https://api.telegram.org/bot{TOKEN}"

def api_call(method: str, params: dict) -> dict:
    resp = requests.post(f"{API}/{method}", json=params, timeout=15)
    return resp.json()

def action_send_message(p):
    result = api_call("sendMessage", {
        "chat_id": p["chat_id"],
        "text": p["text"],
        "parse_mode": p.get("parse_mode", "HTML"),
        "reply_to_message_id": p.get("reply_to_message_id"),
    })
    return {
        "message_id": result.get("result", {}).get("message_id"),
        "chat": result.get("result", {}).get("chat", {}).get("username", ""),
        "sent": result.get("ok", False),
    }

def action_edit_message(p):
    result = api_call("editMessageText", {
        "chat_id": p["chat_id"],
        "message_id": p["message_id"],
        "text": p["text"],
        "parse_mode": p.get("parse_mode", "HTML"),
    })
    return {"edited": result.get("ok", False), "message_id": p["message_id"]}

def action_delete_message(p):
    result = api_call("deleteMessage", {
        "chat_id": p["chat_id"],
        "message_id": p["message_id"],
    })
    return {"deleted": result.get("ok", False), "message_id": p["message_id"]}

def action_send_file(p):
    method = "sendDocument"
    files = {"document": p["document"]} if p.get("document") else None
    data = {"chat_id": p["chat_id"], "caption": p.get("caption", "")}
    resp = requests.post(f"{API}/{method}", data=data, files=files, timeout=30)
    result = resp.json()
    return {"message_id": result.get("result", {}).get("message_id"), "sent": result.get("ok", False)}

def action_get_updates(p):
    result = api_call("getUpdates", {
        "limit": p.get("limit", 10),
        "offset": p.get("offset"),
    })
    updates = result.get("result", [])
    return {"count": len(updates), "updates": [
        {"update_id": u["update_id"],
         "message": u.get("message", {}).get("text", "")[:200]}
        for u in updates
    ]}

def action_get_me(p):
    result = api_call("getMe", {})
    bot = result.get("result", {})
    return {"username": bot.get("username"), "id": bot.get("id"), "name": bot.get("first_name")}

ACTIONS = {
    "send_message": action_send_message,
    "edit_message": action_edit_message,
    "delete_message": action_delete_message,
    "send_file": action_send_file,
    "get_updates": action_get_updates,
    "get_me": action_get_me,
}

class TelegramHandler(BaseHTTPRequestHandler):
    def _send(self, data, status=200):
        body = json.dumps(data, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    
    def do_GET(self):
        if self.path == "/health":
            self._send({
                "ok": True, "bridge": "telegram_bridge", "protocol": "bot_api",
                "apa_version": "1.0", "bot_configured": bool(TOKEN),
                "status": "READY" if TOKEN else "AWAITING_TOKEN",
            })
        else:
            self._send({"error": "not found"}, 404)
    
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}
            mode = body.get("mode")
            if mode not in ACTIONS:
                self._send({"ok": False, "error": f"Unknown mode: {mode}"}, 400)
                return
            result = ACTIONS[mode](body)
            self._send({"ok": True, "mode": mode, "result": result})
        except Exception as e:
            log.error(f"Error in {body.get('mode', '?')}: {e}")
            self._send({"ok": False, "error": str(e)}, 500)
    
    def log_message(self, format, *args):
        log.info(f"{self.client_address[0]} - {format % args}")

if __name__ == "__main__":
    port = int(os.environ.get("TELEGRAM_BRIDGE_PORT", "18096"))
    server = HTTPServer(("127.0.0.1", port), TelegramHandler)
    log.info(f"APA Telegram Bridge listening on 127.0.0.1:{port}")
    server.serve_forever()
