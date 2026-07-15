#!/usr/bin/env python3
"""
email_bridge.py — APA Gmail Connector: Sovereign IMAP/SMTP bridge.
Part of APA v1.0 (Autonomous Protocol for Applications).
A-FORGE → APA → Gmail.

Zero external dependencies. Python stdlib only.
Port: 18093 (internal, 127.0.0.1)

DITEMPA BUKAN DIBERI — Email sovereignty is forged.
"""

import json, os, hashlib, ssl, logging
import imaplib, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.parser import BytesParser
from email.policy import default
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format='[email_bridge] %(message)s')
log = logging.getLogger(__name__)

# ── Load credentials ──────────────────────────
CRED_PATH = os.environ.get("EMAIL_CRED_PATH", "/root/.secrets/email/gmail.json")

def load_creds():
    if not os.path.exists(CRED_PATH):
        return None
    with open(CRED_PATH) as f:
        return json.load(f)

# ── IMAP ──────────────────────────────────────
def imap_connect():
    creds = load_creds()
    if not creds:
        raise RuntimeError(f"Credentials not found at {CRED_PATH}")
    ctx = ssl.create_default_context()
    conn = imaplib.IMAP4_SSL(creds["imap_server"], creds.get("imap_port", 993), ssl_context=ctx)
    conn.login(creds["email"], creds["app_password"])
    return conn

def smtp_connect():
    creds = load_creds()
    if not creds:
        raise RuntimeError(f"Credentials not found at {CRED_PATH}")
    ctx = ssl.create_default_context()
    conn = smtplib.SMTP(creds["smtp_server"], creds.get("smtp_port", 587))
    conn.starttls(context=ctx)
    conn.login(creds["email"], creds["app_password"])
    return conn

# ── Actions ────────────────────────────────────

def action_search(params):
    conn = imap_connect()
    conn.select("INBOX")
    query = params.get("query", "ALL")
    limit = min(int(params.get("limit", 20)), 50)
    status, data = conn.search(None, query)
    ids = data[0].split()[-limit:] if data[0] else []
    results = []
    for eid in ids:
        status, msg_data = conn.fetch(eid, "(BODY[HEADER.FIELDS (SUBJECT FROM DATE)])")
        if msg_data and msg_data[0]:
            parser = BytesParser(policy=default)
            msg = parser.parsebytes(msg_data[0][1])
            results.append({
                "id": eid.decode(),
                "subject": str(msg.get("Subject", "")),
                "from": str(msg.get("From", "")),
                "date": str(msg.get("Date", "")),
            })
    conn.logout()
    return {"count": len(results), "results": results}

def action_read(params):
    conn = imap_connect()
    conn.select("INBOX")
    eid = params["email_id"].encode()
    status, msg_data = conn.fetch(eid, "(RFC822)")
    if not msg_data or not msg_data[0]:
        conn.logout()
        return {"error": "Email not found"}
    parser = BytesParser(policy=default)
    msg = parser.parsebytes(msg_data[0][1])
    body_text = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                body_text = part.get_content()
                break
    else:
        body_text = msg.get_content()
    conn.logout()
    return {
        "id": eid.decode(),
        "subject": str(msg.get("Subject", "")),
        "from": str(msg.get("From", "")),
        "to": str(msg.get("To", "")),
        "date": str(msg.get("Date", "")),
        "body_text": str(body_text)[:10000],
    }

def action_send(params):
    creds = load_creds()
    msg = MIMEMultipart()
    msg["From"] = creds["email"]
    msg["To"] = params["to"]
    msg["Subject"] = params["subject"]
    if params.get("cc"):
        msg["Cc"] = params["cc"]
    body = params["body"]
    if params.get("body_html"):
        msg.attach(MIMEText(body, "plain"))
        msg.attach(MIMEText(params["body_html"], "html"))
    else:
        msg.attach(MIMEText(body, "plain"))
    conn = smtp_connect()
    recipients = [params["to"]]
    if params.get("cc"):
        recipients.append(params["cc"])
    if params.get("bcc"):
        recipients.append(params["bcc"])
    result = conn.send_message(msg)
    conn.quit()
    content_hash = hashlib.sha256(
        f"{params['to']}{params['subject']}{params['body']}".encode()
    ).hexdigest()
    return {
        "smtp_response": str(result),
        "sent": True,
        "sha256": content_hash,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

def action_list_labels(params):
    conn = imap_connect()
    status, data = conn.list()
    labels = []
    for entry in data:
        if isinstance(entry, bytes):
            parts = entry.decode().split(' "/" ')
            if len(parts) >= 2:
                labels.append({"name": parts[1].strip('"'), "flags": parts[0]})
    conn.logout()
    return {"labels": labels}

ACTIONS = {
    "search": action_search,
    "read": action_read,
    "send": action_send,
    "list_labels": action_list_labels,
}

class EmailHandler(BaseHTTPRequestHandler):
    def _send(self, data, status=200):
        body = json.dumps(data, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    
    def do_GET(self):
        if self.path == "/health":
            creds = load_creds()
            creds_exist = bool(creds)
            email_ok = bool(creds and creds.get("email") and "YOUR_" not in str(creds.get("email")))
            pwd_ok = bool(
                creds
                and creds.get("app_password")
                and not str(creds.get("app_password")).startswith("YOUR_")
                and "PLACEHOLDER" not in str(creds.get("app_password")).upper()
            )
            ready = creds_exist and email_ok and pwd_ok
            self._send({
                "ok": True,
                "bridge": "email_bridge",
                "protocol": "imap+smtp",
                "apa_version": "1.0",
                "verbs": sorted(ACTIONS.keys()),
                "credentials_configured": ready,
                "status": "READY" if ready else "AWAITING_CREDENTIALS",
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
    port = int(os.environ.get("EMAIL_BRIDGE_PORT", "18093"))
    server = HTTPServer(("127.0.0.1", port), EmailHandler)
    log.info(f"APA Email Bridge listening on 127.0.0.1:{port}")
    server.serve_forever()
