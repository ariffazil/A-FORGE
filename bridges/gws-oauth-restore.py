#!/usr/bin/env python3
"""gws-oauth-restore.py — complete a Google OAuth re-consent and write the store.

WHY: the mail-gateway OAuth refresh token expired at exactly 7 days
(issued 2026-09-16 00:28 +08, dead 2026-09-23 ~00:34Z). That is Google's
Testing-publishing-status refresh-token lifetime. The token cannot be revived —
Google returns invalid_grant — so a fresh consent is the only path.

WHAT: listens on 127.0.0.1:8080 (the redirect_uri the consent URL carries),
exchanges the authorization code, and writes the store in the exact
AES-256-GCM format gws uses:
    .encryption_key  -> base64 of a 32-byte key
    credentials.enc  -> nonce(12) || AESGCM(json{client_id,client_secret,refresh_token,type})
    token_cache.json -> nonce(12) || AESGCM(json{ "<scope string>": {access_token,
                                            refresh_token, expires_at, id_token} })

Run as the `mail-gateway` identity so the store keeps its owner and 0600 mode.

USAGE
    sudo -u mail-gateway python3 gws-oauth-restore.py
    # then open the URL the companion prints, approve, and wait for "RESTORED".
"""

from __future__ import annotations

import base64
import http.server
import json
import os
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

STORE = Path("/var/lib/mail-gateway/gws")
KEY_FILE = STORE / ".encryption_key"
CREDS = STORE / "credentials.enc"
CACHE = STORE / "token_cache.json"
RECEIPTS = Path("/var/lib/mail-gateway/audit/oauth-refresh-receipts.jsonl")
PORT = int(os.environ.get("OAUTH_CALLBACK_PORT", "8080"))
TOKEN_URI = "https://oauth2.googleapis.com/token"

# The union of every scope the previous grant carried. Requesting the same set
# keeps the calendar and drive bridges working and changes no capability level.
SCOPES = [
    "https://mail.google.com/",
    "https://www.googleapis.com/auth/gmail.addons.current.action.compose",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/drive",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]


def receipt(entry: dict) -> None:
    entry = {"ts": datetime.now(timezone.utc).isoformat(), "actor": "hermes-edge-bridge", **entry}
    try:
        RECEIPTS.parent.mkdir(parents=True, exist_ok=True)
        with RECEIPTS.open("a") as f:
            f.write(json.dumps(entry) + "\n")
    except OSError:
        pass


def load_key() -> bytes:
    return base64.urlsafe_b64decode(KEY_FILE.read_bytes().strip())


def encrypt(key: bytes, obj) -> bytes:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    nonce = os.urandom(12)
    return nonce + AESGCM(key).encrypt(nonce, json.dumps(obj).encode(), None)


def decrypt(key: bytes, blob: bytes):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    return json.loads(AESGCM(key).decrypt(blob[:12], blob[12:], None))


def exchange(code: str, client_id: str, client_secret: str, redirect_uri: str) -> dict:
    data = urllib.parse.urlencode({
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }).encode()
    req = urllib.request.Request(TOKEN_URI, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read())


def yday_struct(epoch: float) -> list:
    """gws stores expiry as [year, yday, hour, min, sec, nanos, 0, 0, 0]."""
    dt = datetime.fromtimestamp(epoch, timezone.utc)
    # yday is 1-based
    return [dt.year, dt.timetuple().tm_yday, dt.hour, dt.minute, dt.second,
            dt.microsecond * 1000, 0, 0, 0]


def write_store(key: bytes, tok: dict, prev_cache: dict) -> dict:
    """Write credentials.enc and token_cache.json. Returns a summary."""
    client_id = tok.get("client_id") or PREV_CREDS["client_id"]
    refresh = tok.get("refresh_token") or PREV_CREDS["refresh_token"]
    expiry = time.time() + int(tok.get("expires_in", 3600)) - 60

    # credentials.enc — the durable record
    creds_obj = {
        "client_id": client_id,
        "client_secret": PREV_CREDS["client_secret"],
        "refresh_token": refresh,
        "type": "authorized_user",
    }
    CREDS.write_bytes(encrypt(key, creds_obj))
    os.chmod(CREDS, 0o600)

    # token_cache.json — preserve the existing scope keys so every lane still resolves
    granted_scope = tok.get("scope", "")
    entry = {
        "access_token": tok["access_token"],
        "refresh_token": refresh,
        "expires_at": yday_struct(expiry),
        "id_token": tok.get("id_token", ""),
    }
    new_cache = dict(prev_cache)
    # rewrite every previous key with the fresh token; add the granted scope key too
    for k in list(new_cache.keys()):
        new_cache[k] = dict(entry)
    new_cache[granted_scope] = dict(entry)
    CACHE.write_bytes(encrypt(key, new_cache))
    os.chmod(CACHE, 0o600)

    return {
        "refresh_token_len": len(refresh),
        "access_token_len": len(tok["access_token"]),
        "expires_in_s": tok.get("expires_in"),
        "granted_scope": granted_scope,
        "cache_keys": len(new_cache),
        "wrote_credentials": str(CREDS),
        "wrote_cache": str(CACHE),
    }


PREV_CREDS: dict = {}


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if parsed.path not in ("/", "/oauth2/callback", "/oauth/callback"):
            self.send_response(404); self.end_headers(); return

        code = params.get("code", [""])[0]
        err = params.get("error", [""])[0]

        if err:
            self._page(400, f"<h1>OAuth error</h1><pre>{err}</pre>")
            return
        if not code:
            # a plain visit (readiness probe) — don't terminate the server
            self._page(200, "<h1>gws OAuth restore listener</h1><p>Waiting for the consent redirect.</p>")
            return

        try:
            tok = exchange(code, PREV_CREDS["client_id"], PREV_CREDS["client_secret"],
                           f"http://localhost:{PORT}")
            key = load_key()
            prev = decrypt(key, CACHE.read_bytes())
            summary = write_store(key, tok, prev)
            receipt({"purpose": "Gmail OAuth re-consent completed (F13 directive 'Fix it')",
                     "action": "authorization code exchanged; store rewritten",
                     "result": summary})
            self._page(200, "<h1>Restored.</h1><p>New Google tokens written. "
                            "You can close this tab.</p><pre>"
                            + json.dumps({k: v for k, v in summary.items()
                                          if k in ("expires_in_s", "cache_keys")}, indent=1)
                            + "</pre>")
            self.server._done = True
        except Exception as e:  # noqa: BLE001
            receipt({"purpose": "Gmail OAuth re-consent FAILED", "error": f"{type(e).__name__}: {e}"})
            self._page(500, f"<h1>Exchange failed</h1><pre>{type(e).__name__}: {e}</pre>")

    def _page(self, code, html):
        body = html.encode("ascii", errors="replace")
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> int:
    global PREV_CREDS
    key = load_key()
    creds = decrypt(key, CREDS.read_bytes())
    PREV_CREDS = creds

    auth_params = {
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "redirect_uri": f"http://localhost:{PORT}",
        "response_type": "code",
        "client_id": creds["client_id"],
        "prompt": "select_account consent",
        "include_granted_scopes": "true",
    }
    url = "https://accounts.google.com/o/oauth2/auth?" + urllib.parse.urlencode(auth_params)

    srv = http.server.HTTPServer(("127.0.0.1", PORT), Handler)
    srv._done = False
    srv.timeout = 1

    print("=" * 72)
    print("OPEN THIS URL IN A BROWSER SIGNED IN AS THE MAILBOX OWNER")
    print("=" * 72)
    print()
    print(url)
    print()
    print(f"listening on http://127.0.0.1:{PORT}/  (redirect target)")
    print("waiting up to 30 minutes ...", flush=True)

    deadline = time.time() + 1800
    while time.time() < deadline and not srv._done:
        srv.handle_request()
    srv.server_close()

    if srv._done:
        print("\nRESTORED — store rewritten.")
        return 0
    print("\nTIMEOUT — no callback received.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
