# APA Connector: Gmail (Sovereign IMAP/SMTP)

> **APA v1.0 Reference Implementation #1**
> **Forged:** 2026-07-09 · **Author:** FORGE (000Ω) · **Sovereign:** Muhammad Arif bin Fazil (F13)
> **Status:** SPECIFICATION — Ready to forge

---

## 0. WHY THIS CONNECTOR FIRST

Gmail is Arif's primary communication channel. Every email interaction today requires switching context out of arifOS. This is the single biggest daily-productivity sovereignty gap.

**Composio path (rejected):** OAuth2 → their cloud → Gmail API → their audit
**APA path (forged):** IMAP/SMTP → Python stdlib → direct connection → VAULT999 audit

---

## 1. CONNECTOR MANIFEST

```yaml
connector:
  name: "email"
  mcp_tool: "forge_email"
  version: "1.0.0"
  domain: "communication.email"
  protocol: "imap+smtp"
  provider: "gmail"              # Default. Also: protonmail, fastmail, custom
  description: "Sovereign email via IMAP/SMTP. Zero cloud dependencies."

auth:
  method: "app_password"         # Not OAuth2. Not cloud-hosted.
  credential_path: "/root/.secrets/email/gmail.json"
  credential_schema:
    imap_server: "imap.gmail.com"
    imap_port: 993
    smtp_server: "smtp.gmail.com"
    smtp_port: 587
    email: "ariffazil@gmail.com"
    app_password: "xxxx"         # 16-char Google App Password

verbs:
  search:
    mode: "search"
    action_class: "OBSERVE"
    description: "Search inbox with Gmail query syntax"
    requires_lease: false
    blast_radius: "LOW"
    params:
      query: "string (Gmail search syntax)"
      limit: "int (default 20, max 50)"
    returns: "Array of {id, thread_id, subject, from, date, snippet}"

  read:
    mode: "read"
    action_class: "OBSERVE"
    description: "Read full email by ID"
    requires_lease: false
    blast_radius: "LOW"
    params:
      email_id: "string (IMAP UID)"
      include_attachments: "bool (default: false)"
    returns: "{id, subject, from, to, date, body_text, body_html, attachments[]}"

  send:
    mode: "send"
    action_class: "MUTATE"
    irreversible: true
    requires_lease: true
    requires_ack: true
    requires_tri_witness: true    # External recipient → F3 WITNESS
    blast_radius: "HIGH"
    params:
      to: "string (required)"
      cc: "string (optional)"
      bcc: "string (optional)"
      subject: "string (required)"
      body: "string (required, plain text)"
      body_html: "string (optional)"
    returns: "{message_id, smtp_response, sha256}"

  draft:
    mode: "draft"
    action_class: "MUTATE"
    irreversible: false
    requires_lease: true
    blast_radius: "LOW"
    params:
      to: "string"
      subject: "string"
      body: "string"
    returns: "{draft_id}"

  list_labels:
    mode: "list_labels"
    action_class: "OBSERVE"
    requires_lease: false
    blast_radius: "LOW"
    returns: "Array of {name, id, type}"

  modify_labels:
    mode: "modify_labels"
    action_class: "MUTATE"
    irreversible: false
    requires_lease: true
    blast_radius: "LOW"
    params:
      email_id: "string"
      add_labels: "[string]"
      remove_labels: "[string]"
    returns: "{email_id, added, removed}"

  thread:
    mode: "thread"
    action_class: "OBSERVE"
    requires_lease: false
    blast_radius: "LOW"
    params:
      thread_id: "string"
    returns: "Array of emails in thread, chronological"
```

---

## 2. IMPLEMENTATION

### 2.1 Architecture

```
┌──────────────────────────────────────────────────┐
│              A-FORGE (TypeScript, :7072)          │
│                                                   │
│  forge_email(mode, params, lease_id, session_id)  │
│    │                                               │
│    ├─ FloorEnforcer.checkAll(F1,F2,F8,F13)        │
│    ├─ LeaseValidator.verify(lease_id, scope)       │
│    ├─ IF mode=send: TriWitness.check(F3)           │
│    │                                               │
│    └─ HTTP POST 127.0.0.1:18093/execute            │
│                                                   │
└───────────────────┬───────────────────────────────┘
                    │
┌───────────────────▼───────────────────────────────┐
│       email_bridge.py (Python, :18093)             │
│                                                    │
│  Thin HTTP wrapper. No policy. No judgment.        │
│  Reads credentials from /root/.secrets/             │
│  Executes IMAP/SMTP via Python stdlib.             │
│  Returns normalized JSON.                          │
│                                                    │
│  Dependencies: ZERO (imaplib, smtplib, email)      │
└────────────────────────────────────────────────────┘
```

### 2.2 Python Bridge — `email_bridge.py`

```python
#!/usr/bin/env python3
"""
email_bridge.py — Sovereign IMAP/SMTP bridge for A-FORGE forge_email.

Zero external dependencies. Uses Python stdlib only:
  imaplib, smtplib, email, json, http.server

Run: python3 /root/A-FORGE/scripts/email_bridge.py
Port: 18093 (internal only, 127.0.0.1)
"""

import json, os, hashlib, ssl
import imaplib, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.parser import BytesParser
from email.policy import default
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone

# ── Load credentials ──────────────────────────
CRED_PATH = "/root/.secrets/email/gmail.json"
with open(CRED_PATH) as f:
    creds = json.load(f)

IMAP_SERVER = creds["imap_server"]
IMAP_PORT = creds.get("imap_port", 993)
SMTP_SERVER = creds["smtp_server"]
SMTP_PORT = creds.get("smtp_port", 587)
EMAIL = creds["email"]
APP_PASSWORD = creds["app_password"]

# ── IMAP connection (reconnect per call) ─────
def imap_connect():
    ctx = ssl.create_default_context()
    conn = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT, ssl_context=ctx)
    conn.login(EMAIL, APP_PASSWORD)
    return conn

# ── SMTP connection ──────────────────────────
def smtp_connect():
    ctx = ssl.create_default_context()
    conn = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
    conn.starttls(context=ctx)
    conn.login(EMAIL, APP_PASSWORD)
    return conn

# ── Actions ──────────────────────────────────

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
                "subject": msg.get("Subject", ""),
                "from": msg.get("From", ""),
                "date": msg.get("Date", ""),
            })
    conn.logout()
    return {"count": len(results), "results": results}

def action_read(params):
    conn = imap_connect()
    conn.select("INBOX")
    eid = params["email_id"].encode()
    status, msg_data = conn.fetch(eid, "(RFC822)")
    parser = BytesParser(policy=default)
    msg = parser.parsebytes(msg_data[0][1])
    
    body_text = ""
    body_html = ""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            if ct == "text/plain":
                body_text = part.get_content()
            elif ct == "text/html":
                body_html = part.get_content()
    else:
        body_text = msg.get_content()
    
    conn.logout()
    return {
        "id": eid.decode(),
        "subject": msg.get("Subject", ""),
        "from": msg.get("From", ""),
        "to": msg.get("To", ""),
        "date": msg.get("Date", ""),
        "body_text": body_text[:10000],
        "body_html": body_html[:50000] if params.get("include_html") else None,
    }

def action_send(params):
    msg = MIMEMultipart()
    msg["From"] = EMAIL
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
                labels.append({
                    "name": parts[1].strip('"'),
                    "flags": parts[0],
                })
    conn.logout()
    return {"labels": labels}

# ── Router ───────────────────────────────────
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
            self._send({
                "ok": True, "bridge": "email_bridge",
                "provider": "gmail", "protocol": "imap+smtp",
                "email": EMAIL,
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
            self._send({"ok": False, "error": str(e)}, 500)

if __name__ == "__main__":
    port = int(os.environ.get("EMAIL_BRIDGE_PORT", "18093"))
    server = HTTPServer(("127.0.0.1", port), EmailHandler)
    print(f"[email_bridge] listening on 127.0.0.1:{port}")
    server.serve_forever()
```

### 2.3 Dependencies

```
ZERO pip installs required.
Python stdlib only: imaplib, smtplib, email, json, http.server, hashlib, ssl
```

### 2.4 Deployment

```bash
# 1. Create credential file
mkdir -p /root/.secrets/email
cat > /root/.secrets/email/gmail.json << 'EOF'
{
  "imap_server": "imap.gmail.com",
  "imap_port": 993,
  "smtp_server": "smtp.gmail.com",
  "smtp_port": 587,
  "email": "ariffazil@gmail.com",
  "app_password": "YOUR_16_CHAR_GOOGLE_APP_PASSWORD"
}
EOF
chmod 600 /root/.secrets/email/gmail.json

# 2. Copy bridge script
cp email_bridge.py /root/A-FORGE/scripts/email_bridge.py

# 3. Create systemd service
cat > /etc/systemd/system/email-bridge.service << 'EOF'
[Unit]
Description=Sovereign Email Bridge for A-FORGE forge_email
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /root/A-FORGE/scripts/email_bridge.py
Restart=on-failure
RestartSec=5
Environment=EMAIL_BRIDGE_PORT=18093

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now email-bridge
curl http://127.0.0.1:18093/health
```

---

## 3. F1-F13 GATE MATRIX

| Verb | F1 | F2 | F3 | F4 | F7 | F8 | F9 | F11 | F13 |
|------|----|----|----|----|----|----|----|----|----|
| search | ✅ reversible | OBS tag | N/A | ΔS=0 | cap .90 | IMAP query | verify response | receipt | — |
| read | ✅ reversible | OBS tag | N/A | ΔS=0 | cap .90 | IMAP fetch | verify body | receipt | — |
| **send** | ⚠️ irreversible | DER tag | **W³ req** | verify sent | cap .85 | SMTP send | **SMTP 250** | **full receipt** | **ack req** |
| draft | ✅ reversible | DER tag | N/A | ΔS≤0 | cap .85 | IMAP append | verify saved | receipt | — |
| list_labels | ✅ reversible | OBS tag | N/A | ΔS=0 | cap .90 | IMAP list | verify list | receipt | — |
| modify_labels | ✅ reversible | OBS tag | N/A | ΔS≤0 | cap .85 | IMAP store | verify flags | receipt | — |

---

## 4. RESPONSE EXAMPLES

### 4.1 Search

```json
{
  "ok": true,
  "connector": "email",
  "verb": "search",
  "verdict": "SEAL",
  "evidence_tag": "OBS",
  "confidence": 0.90,
  "result": {
    "count": 5,
    "results": [
      {"id": "12345", "subject": "Federation health report", "from": "...", "date": "..."}
    ]
  },
  "receipt": {
    "vault_entry_id": "vault_2026-07-09_001",
    "timestamp": "2026-07-09T03:30:00Z",
    "actor_id": "333-AGI",
    "session_id": "sess_xxx"
  },
  "latency_ms": 340,
  "protocol": "imap"
}
```

### 4.2 Send

```json
{
  "ok": true,
  "connector": "email",
  "verb": "send",
  "verdict": "SEAL",
  "evidence_tag": "DER",
  "confidence": 0.85,
  "result": {
    "smtp_response": "{'recipient@example.com': (250, b'2.0.0 OK')}",
    "sent": true,
    "sha256": "abc123def456...",
    "timestamp": "2026-07-09T03:30:05Z"
  },
  "floor_checks": {
    "f1_amanah": true,
    "f2_truth": true,
    "f3_witness": true,
    "f8_genius": true,
    "f13_sovereign": true
  },
  "lease_id": "lease_xxx",
  "receipt": {
    "vault_entry_id": "vault_2026-07-09_002",
    "timestamp": "2026-07-09T03:30:05Z",
    "actor_id": "333-AGI",
    "session_id": "sess_xxx",
    "sha256": "abc123def456..."
  },
  "latency_ms": 1200,
  "protocol": "smtp"
}
```

---

## 5. vs COMPOSIO GMAIL

| Dimension | Composio Gmail | APA Gmail |
|-----------|---------------|-----------|
| Protocol | Gmail API (REST, proprietary) | IMAP/SMTP (RFC 3501, RFC 5321) |
| Auth | OAuth2 token in their cloud | App password in `/root/.secrets/` |
| Token breach risk | May 2026: revoked | Zero — never leaves VPS |
| Provider portability | Gmail only | Any IMAP provider |
| Dependencies | `composio` SDK, their cloud | Python stdlib only |
| Governance | Their policy | F1-F13 + lease + VAULT999 |
| Audit | Their logs | Your VAULT999 |
| Send gate | Their approval flow | `ack_irreversible` + tri-witness |
| Cost | Free tier → $29/mo | $0 |
| Latency | Cloud proxy + API hop | Direct IMAP/SMTP |

---

## 6. FORGE SEQUENCE

```
Phase 1: Deploy bridge (30 min)
  □ Create /root/.secrets/email/gmail.json
  □ Copy email_bridge.py to /root/A-FORGE/scripts/
  □ Create + start email-bridge.service
  □ Verify: curl http://127.0.0.1:18093/health

Phase 2: Register MCP tool (1 hour)
  □ Add forge_email to A-FORGE MCP core.ts
  □ Wire FloorEnforcer for each verb
  □ Wire lease check for MUTATE verbs
  □ Wire tri-witness for send verb
  □ Wire VAULT999 receipt for all verbs
  □ Build + test: npm run build && npm test

Phase 3: Integration test (30 min)
  □ forge_email(mode="search", query="from:arif")
  □ forge_email(mode="read", email_id="...")
  □ forge_email(mode="send", to="arif@...", ...) — DRY RUN FIRST
  □ Verify VAULT999 receipts written

Phase 4: Production (15 min)
  □ Restart A-FORGE MCP: systemctl restart a-forge-mcp
  □ Federation health attest: forge_probe()
  □ SEAL: arif_seal(mode="seal", payload="APA-GMAIL-v1-DEPLOYED")
```

---

*DITEMPA BUKAN DIBERI — Email sovereignty is forged, not imported.*
*APA Gmail v1.0 · 2026-07-09 · FORGE (000Ω) for Arif (F13)*
