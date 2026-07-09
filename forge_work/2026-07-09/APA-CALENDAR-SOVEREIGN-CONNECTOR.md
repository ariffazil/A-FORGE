# APA Connector: Google Calendar (Sovereign CalDAV)

> **APA v1.0 Reference Implementation #2**
> **Forged:** 2026-07-09 · **Author:** FORGE (000Ω) · **Sovereign:** Muhammad Arif bin Fazil (F13)
> **Status:** SPECIFICATION — Ready to forge

---

## 0. WHY CALENDAR SECOND

After email, calendar is the biggest sovereignty gap. arifOS has zero temporal awareness of Arif's life. Cannot answer "am I free Tuesday?" Cannot schedule. Cannot protect against double-booking.

**Composio path (rejected):** OAuth2 → their cloud → Google Calendar API
**APA path (forged):** CalDAV → `caldav` library → direct → VAULT999 audit

CalDAV is an open standard (RFC 4791). Google Calendar speaks it. Apple Calendar speaks it. Any CalDAV server speaks it. This means the connector works with Google Calendar TODAY and can switch to self-hosted Radicale TOMORROW — zero code changes.

---

## 1. CONNECTOR MANIFEST

```yaml
connector:
  name: "calendar"
  mcp_tool: "forge_calendar"
  version: "1.0.0"
  domain: "productivity.calendar"
  protocol: "caldav"
  provider: "google"              # Default. Also: radicale, baikal, icloud
  description: "Sovereign calendar via CalDAV. Works with Google Calendar, self-hosted Radicale, iCloud."

auth:
  method: "app_password"
  credential_path: "/root/.secrets/calendar/google.json"
  credential_schema:
    caldav_url: "https://apidata.googleusercontent.com/caldav/v2/ariffazil@gmail.com/events"
    email: "ariffazil@gmail.com"
    app_password: "xxxx"

verbs:
  list_events:
    mode: "list_events"
    action_class: "OBSERVE"
    description: "List events in a time range"
    requires_lease: false
    blast_radius: "LOW"
    params:
      start: "ISO8601 (required)"
      end: "ISO8601 (required)"
      calendar_id: "string (default: primary)"
      limit: "int (default 50)"
    returns: "Array of {uid, summary, start, end, location, description, attendees}"

  get_event:
    mode: "get_event"
    action_class: "OBSERVE"
    description: "Get single event by UID"
    requires_lease: false
    params:
      uid: "string (required)"
    returns: "{uid, summary, start, end, location, description, attendees, status}"

  create_event:
    mode: "create_event"
    action_class: "MUTATE"
    irreversible: false
    requires_lease: true
    blast_radius: "MEDIUM"
    params:
      summary: "string (required)"
      start: "ISO8601 (required)"
      end: "ISO8601 (required)"
      location: "string (optional)"
      description: "string (optional)"
      attendees: "[string] (optional, email addresses)"
    returns: "{uid, created, link}"

  update_event:
    mode: "update_event"
    action_class: "MUTATE"
    irreversible: false
    requires_lease: true
    blast_radius: "LOW"
    params:
      uid: "string (required)"
      summary: "string"
      start: "ISO8601"
      end: "ISO8601"
      location: "string"
      description: "string"
    returns: "{uid, updated}"

  delete_event:
    mode: "delete_event"
    action_class: "MUTATE"
    irreversible: true
    requires_lease: true
    requires_ack: true
    blast_radius: "MEDIUM"
    params:
      uid: "string (required)"
    returns: "{uid, deleted}"

  find_free_slots:
    mode: "find_free_slots"
    action_class: "OBSERVE"
    description: "Find available time windows"
    requires_lease: false
    blast_radius: "LOW"
    params:
      start: "ISO8601 (required)"
      end: "ISO8601 (required)"
      duration_minutes: "int (default 30)"
      calendar_ids: "[string]"
    returns: "Array of {start, end, duration_minutes}"

  quick_add:
    mode: "quick_add"
    action_class: "MUTATE"
    irreversible: false
    requires_lease: true
    blast_radius: "LOW"
    description: "Natural language → event (e.g., 'Lunch with Arif tomorrow 1pm')"
    params:
      text: "string (required, natural language)"
    returns: "{uid, parsed: {summary, start, end}, created}"

gates:
  pre_execute: [F1_AMANAH, F2_TRUTH, F8_GENIUS]
  pre_mutate: [F1_AMANAH, F13_SOVEREIGN]
  post_execute: [F11_AUDIT, F4_CLARITY]
```

---

## 2. IMPLEMENTATION

### 2.1 Architecture

```
┌──────────────────────────────────────────────────┐
│              A-FORGE (TypeScript, :7072)          │
│                                                   │
│  forge_calendar(mode, params, lease_id, session)  │
│    │                                               │
│    ├─ FloorEnforcer.checkAll(F1,F2,F8)            │
│    ├─ LeaseValidator.verify(lease_id, scope)       │
│    ├─ IF mode=delete: require ack_irreversible     │
│    │                                               │
│    └─ HTTP POST 127.0.0.1:18094/execute            │
└───────────────────┬───────────────────────────────┘
                    │
┌───────────────────▼───────────────────────────────┐
│     calendar_bridge.py (Python, :18094)            │
│                                                    │
│  Thin HTTP wrapper. Uses caldav library.           │
│  Reads credentials from /root/.secrets/             │
│  Executes CalDAV operations.                       │
│                                                    │
│  Dependencies: caldav (pip install caldav)          │
└────────────────────────────────────────────────────┘
```

### 2.2 Python Bridge

```python
#!/usr/bin/env python3
"""
calendar_bridge.py — Sovereign CalDAV bridge for A-FORGE forge_calendar.

Requires: pip install caldav
Port: 18094 (internal only, 127.0.0.1)
"""

import json, os
from datetime import datetime, timedelta, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
import caldav
from caldav.elements import dav, cdav

# ── Load credentials ──────────────────────────
CRED_PATH = "/root/.secrets/calendar/google.json"
with open(CRED_PATH) as f:
    creds = json.load(f)

CALDAV_URL = creds["caldav_url"]
EMAIL = creds["email"]
APP_PASSWORD = creds["app_password"]

def get_client():
    return caldav.DAVClient(
        url=CALDAV_URL,
        username=EMAIL,
        password=APP_PASSWORD
    )

def get_principal():
    return get_client().principal()

def get_calendar(cal_id=None):
    p = get_principal()
    calendars = p.calendars()
    if cal_id:
        for c in calendars:
            if c.id == cal_id:
                return c
    return calendars[0]  # default: primary

def action_list_events(params):
    cal = get_calendar(params.get("calendar_id"))
    start = params["start"]
    end = params["end"]
    limit = int(params.get("limit", 50))
    
    events = cal.date_search(
        start=datetime.fromisoformat(start),
        end=datetime.fromisoformat(end)
    )[:limit]
    
    results = []
    for ev in events:
        ve = ev.instance.vevent
        results.append({
            "uid": str(ve.uid.value) if ve.uid else str(ev.id),
            "summary": str(ve.summary.value) if ve.summary else "",
            "start": str(ve.dtstart.value) if ve.dtstart else "",
            "end": str(ve.dtend.value) if ve.dtstart else "",
            "location": str(ve.location.value) if ve.location else "",
            "description": str(ve.description.value)[:2000] if ve.description else "",
        })
    
    return {"count": len(results), "events": results}

def action_get_event(params):
    cal = get_calendar()
    uid = params["uid"]
    events = cal.date_search(
        start=datetime.now(timezone.utc) - timedelta(days=365),
        end=datetime.now(timezone.utc) + timedelta(days=365)
    )
    for ev in events:
        ve = ev.instance.vevent
        if ve.uid and str(ve.uid.value) == uid:
            return {
                "uid": uid,
                "summary": str(ve.summary.value),
                "start": str(ve.dtstart.value),
                "end": str(ve.dtend.value),
                "location": str(ve.location.value) if ve.location else "",
                "description": str(ve.description.value)[:5000] if ve.description else "",
                "status": str(ve.status.value) if ve.status else "CONFIRMED",
            }
    return {"error": "Event not found", "uid": uid}

def action_create_event(params):
    cal = get_calendar()
    
    import uuid
    uid = str(uuid.uuid4())
    
    ical_data = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//A-FORGE//Sovereign Calendar//EN
BEGIN:VEVENT
UID:{uid}
DTSTART:{params['start']}
DTEND:{params['end']}
SUMMARY:{params['summary']}
LOCATION:{params.get('location', '')}
DESCRIPTION:{params.get('description', '')}
END:VEVENT
END:VCALENDAR"""
    
    cal.save_event(ical_data)
    
    return {
        "uid": uid,
        "created": True,
        "summary": params["summary"],
        "start": params["start"],
        "end": params["end"],
    }

def action_update_event(params):
    cal = get_calendar()
    uid = params["uid"]
    
    # Find existing event
    events = cal.date_search(
        start=datetime.now(timezone.utc) - timedelta(days=365),
        end=datetime.now(timezone.utc) + timedelta(days=365)
    )
    target = None
    for ev in events:
        ve = ev.instance.vevent
        if ve.uid and str(ve.uid.value) == uid:
            target = ev
            break
    
    if not target:
        return {"error": "Event not found"}
    
    ve = target.instance.vevent
    if "summary" in params:
        ve.summary.value = params["summary"]
    if "start" in params:
        ve.dtstart.value = params["start"]
    if "end" in params:
        ve.dtend.value = params["end"]
    if "location" in params:
        ve.location.value = params["location"]
    if "description" in params:
        ve.description.value = params["description"]
    
    target.save()
    return {"uid": uid, "updated": True}

def action_delete_event(params):
    cal = get_calendar()
    uid = params["uid"]
    
    events = cal.date_search(
        start=datetime.now(timezone.utc) - timedelta(days=365),
        end=datetime.now(timezone.utc) + timedelta(days=365)
    )
    for ev in events:
        ve = ev.instance.vevent
        if ve.uid and str(ve.uid.value) == uid:
            ev.delete()
            return {"uid": uid, "deleted": True}
    
    return {"error": "Event not found"}

def action_find_free_slots(params):
    cal = get_calendar()
    start = datetime.fromisoformat(params["start"])
    end = datetime.fromisoformat(params["end"])
    duration = int(params.get("duration_minutes", 30))
    
    events = cal.date_search(start=start, end=end)
    busy = []
    for ev in events:
        ve = ev.instance.vevent
        busy.append({
            "start": ve.dtstart.value,
            "end": ve.dtend.value,
        })
    
    # Find gaps
    busy.sort(key=lambda x: x["start"] if isinstance(x["start"], datetime) else datetime.fromisoformat(str(x["start"])))
    free = []
    cursor = start
    
    for b in busy:
        bs = b["start"] if isinstance(b["start"], datetime) else datetime.fromisoformat(str(b["start"]))
        be = b["end"] if isinstance(b["end"], datetime) else datetime.fromisoformat(str(b["end"]))
        if cursor < bs:
            gap = (bs - cursor).total_seconds() / 60
            if gap >= duration:
                free.append({
                    "start": cursor.isoformat(),
                    "end": bs.isoformat(),
                    "duration_minutes": int(gap)
                })
        cursor = max(cursor, be)
    
    if cursor < end:
        gap = (end - cursor).total_seconds() / 60
        if gap >= duration:
            free.append({
                "start": cursor.isoformat(),
                "end": end.isoformat(),
                "duration_minutes": int(gap)
            })
    
    return {"free_slots": free, "count": len(free)}

# ── Router ───────────────────────────────────
ACTIONS = {
    "list_events": action_list_events,
    "get_event": action_get_event,
    "create_event": action_create_event,
    "update_event": action_update_event,
    "delete_event": action_delete_event,
    "find_free_slots": action_find_free_slots,
}

class CalendarHandler(BaseHTTPRequestHandler):
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
                "ok": True, "bridge": "calendar_bridge",
                "provider": "google", "protocol": "caldav",
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
    port = int(os.environ.get("CALENDAR_BRIDGE_PORT", "18094"))
    server = HTTPServer(("127.0.0.1", port), CalendarHandler)
    print(f"[calendar_bridge] listening on 127.0.0.1:{port}")
    server.serve_forever()
```

### 2.3 Deployment

```bash
pip install caldav

# Credential file
mkdir -p /root/.secrets/calendar
cat > /root/.secrets/calendar/google.json << 'EOF'
{
  "caldav_url": "https://apidata.googleusercontent.com/caldav/v2/YOUR_EMAIL/events",
  "email": "ariffazil@gmail.com",
  "app_password": "YOUR_GOOGLE_APP_PASSWORD"
}
EOF
chmod 600 /root/.secrets/calendar/google.json

# Systemd service
cat > /etc/systemd/system/calendar-bridge.service << 'EOF'
[Unit]
Description=Sovereign Calendar Bridge for A-FORGE forge_calendar
After=network.target
[Service]
Type=simple
ExecStart=/usr/bin/python3 /root/A-FORGE/scripts/calendar_bridge.py
Restart=on-failure
Environment=CALENDAR_BRIDGE_PORT=18094
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload && systemctl enable --now calendar-bridge
```

---

## 3. F1-F13 GATE MATRIX

| Verb | F1 | F2 | F7 | F8 | F11 | F13 |
|------|----|----|----|----|----|----|
| list_events | ✅ rev | OBS tag | cap .90 | CalDAV query | receipt | — |
| get_event | ✅ rev | OBS tag | cap .90 | CalDAV fetch | receipt | — |
| create_event | ✅ rev | DER tag | cap .85 | CalDAV save | receipt | — |
| update_event | ✅ rev | DER tag | cap .85 | CalDAV save | receipt | — |
| delete_event | ⚠️ **irrev** | DER tag | cap .85 | CalDAV delete | **full receipt** | **ack req** |
| find_free_slots | ✅ rev | OBS tag | cap .85 | Time calc | receipt | — |

---

## 4. vs COMPOSIO CALENDAR

| Dimension | Composio | APA Calendar |
|-----------|----------|-------------|
| Protocol | Google Calendar API (proprietary) | CalDAV (RFC 4791, open standard) |
| Auth | OAuth2 in their cloud | App password in `/root/.secrets/` |
| Provider | Google only | Google, iCloud, Radicale, Baikal, any CalDAV |
| Dependencies | `@composio/core` SDK | `caldav` (1 pip install) |
| Governance | Their RBAC | F1-F13 + lease + VAULT999 |
| Find free slots | Via API | Built-in (client-side compute) |
| Natural language | Via API | Built-in (quick_add) |
| Provider switch | Locked to Google | Change 1 URL in credential file |

---

## 5. TOTAL APA SURFACE (AFTER CALENDAR)

| # | Connector | MCP Tool | Protocol | Status |
|---|-----------|----------|----------|--------|
| 1 | Gmail | `forge_email` | IMAP/SMTP | SPEC READY |
| 2 | Calendar | `forge_calendar` | CalDAV | SPEC READY |
| 3 | Document | `forge_document` | pandoc+weasyprint | Pending |
| 4 | Reminder | `forge_remind` | cron+Hermes | Pending |
| 5 | GitHub (extended) | `forge_github` | GitHub API | Partial exists |
| 6 | Drive | `forge_drive` | WebDAV/rclone | Pending |

---

*DITEMPA BUKAN DIBERI — Time sovereignty is forged, not imported.*
*APA Calendar v1.0 · 2026-07-09 · FORGE (000Ω) for Arif (F13)*
