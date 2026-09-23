#!/usr/bin/env python3
"""oauth_callback_handler.py — receives Google's OAuth response on localhost:18080.

Runs as mail-gateway (per spec). Listens for the redirect, exchanges the
authorization code for a new access_token + refresh_token, writes the
encrypted credentials back to /var/lib/mail-gateway/gws/.

Invocation:
  sudo -u mail-gateway /root/A-FORGE/bridges/oauth_callback_handler.py
"""
import http.server, urllib.parse, json, sys, time
from pathlib import Path
import urllib.request

PENDING = Path("/var/lib/mail-gateway/audit/oauth-pending.json")
TOKEN_STORE = Path("/var/lib/mail-gateway/gws/token_cache.json")
ENCRYPTION_KEY = Path("/var/lib/mail-gateway/gws/.encryption_key")

def exchange_code(code, redirect_uri, client_id, client_secret, token_uri):
    """POST to Google's token_uri with the authorization code."""
    data = urllib.parse.urlencode({
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }).encode()
    req = urllib.request.Request(token_uri, data=data, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        return {"error": f"HTTP {e.code}", "body": body[:300]}

def encrypt_and_store(creds_dict, store_path, key_path):
    """Encrypt credentials with the existing key and write to token_cache.json."""
    from cryptography.fernet import Fernet
    key = key_path.read_bytes()
    f = Fernet(key)
    encrypted = f.encrypt(json.dumps(creds_dict).encode())
    store_path.write_bytes(encrypted)
    return True

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # silence default logging

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        if parsed.path != "/oauth/callback":
            self.send_response(404); self.end_headers(); return

        received_state = params.get("state", [""])[0]
        code = params.get("code", [""])[0]
        error = params.get("error", [""])[0]

        # Load pending config
        pending = json.loads(PENDING.read_text())
        if received_state != pending["state"]:
            self.send_response(400)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<h1>State mismatch - possible CSRF. Aborting.</h1>")
            return

        if error:
            self.send_response(400)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(("<h1>OAuth error: " + error + "</h1>").encode("ascii", errors="replace"))
            return

        # Exchange code for tokens
        result = exchange_code(
            code,
            pending["callback_url"],
            pending["client_id"],
            pending["client_secret"],
            pending["token_uri"],
        )

        if "error" in result:
            self.send_response(500)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            err_body = ("<h1>Token exchange failed</h1><pre>" + json.dumps(result, indent=2) + "</pre>").encode("ascii", errors="replace")
            self.wfile.write(err_body)
            return

        # Encrypt and store
        try:
            encrypt_and_store(result, TOKEN_STORE, ENCRYPTION_KEY)
            PENDING.unlink(missing_ok=True)
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<h1>OAuth refresh complete.</h1><p>New token written. You can close this tab.</p>")
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(("<h1>Encrypt/store failed: " + str(e) + "</h1>").encode("ascii", errors="replace"))

if __name__ == "__main__":
    pending = json.loads(PENDING.read_text())
    server = http.server.HTTPServer(("127.0.0.1", pending["callback_port"]), Handler)
    print(f"OAuth callback listener on http://127.0.0.1:{pending['callback_port']}/oauth/callback")
    print(f"Waiting up to 5 minutes for redirect...")
    server.timeout = 300
    server.handle_request()
    server.server_close()
    print("Done.")
