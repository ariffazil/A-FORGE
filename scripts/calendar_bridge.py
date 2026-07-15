#!/usr/bin/env python3
"""
calendar_bridge.py — APA Calendar Connector: Sovereign CalDAV bridge.
Part of APA v1.0 (Autonomous Protocol for Applications).
A-FORGE → APA → Google Calendar (or any CalDAV provider).

Requires: pip install caldav  (or venv with caldav)
Port: 18094 (internal, 127.0.0.1)

DITEMPA BUKAN DIBERI — Time sovereignty is forged.
"""

from __future__ import annotations

import json
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

try:
    import caldav
except ImportError as e:  # pragma: no cover
    caldav = None
    _CALDAV_IMPORT_ERROR = e
else:
    _CALDAV_IMPORT_ERROR = None

logging.basicConfig(level=logging.INFO, format="[calendar_bridge] %(message)s")
log = logging.getLogger(__name__)

CRED_PATH = os.environ.get("CALENDAR_CRED_PATH", "/root/.secrets/calendar/google.json")


def load_creds():
    if not os.path.exists(CRED_PATH):
        return None
    with open(CRED_PATH) as f:
        return json.load(f)


def get_client():
    if caldav is None:
        raise RuntimeError(f"caldav not installed: {_CALDAV_IMPORT_ERROR}")
    creds = load_creds()
    if not creds:
        raise RuntimeError(f"Credentials not found at {CRED_PATH}")
    if not creds.get("app_password") or str(creds.get("app_password")).startswith("YOUR_"):
        raise RuntimeError("app_password not configured (template still in place)")
    return caldav.DAVClient(
        url=creds["caldav_url"],
        username=creds["email"],
        password=creds["app_password"],
    )


def get_calendar(cal_id=None):
    p = get_client().principal()
    calendars = p.calendars()
    if not calendars:
        raise RuntimeError("No calendars found on CalDAV principal")
    if cal_id:
        for c in calendars:
            if str(c.id) == cal_id or str(getattr(c, "name", "")) == cal_id:
                return c
    return calendars[0]


def _parse_dt(val):
    """Parse CalDAV datetime value which may be a datetime or string."""
    if isinstance(val, datetime):
        return val
    if hasattr(val, "value"):
        return _parse_dt(val.value)
    s = str(val).replace("Z", "+00:00")
    # bare YYYYMMDD or YYYYMMDDTHHMMSS
    if re.fullmatch(r"\d{8}", s):
        return datetime.strptime(s, "%Y%m%d").replace(tzinfo=timezone.utc)
    if re.fullmatch(r"\d{8}T\d{6}", s):
        return datetime.strptime(s, "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(s)


def _fmt_dt(dt_val):
    if isinstance(dt_val, datetime):
        return dt_val.isoformat()
    return str(dt_val)


def _to_ical_dt(val: str) -> str:
    """Normalize ISO/loose input to ICS DTSTART/DTEND form (UTC-ish)."""
    s = str(val).strip()
    if re.fullmatch(r"\d{8}(T\d{6}Z?)?", s):
        return s if s.endswith("Z") or "T" not in s else s
    dt = _parse_dt(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _escape_ical_text(text: str) -> str:
    return (
        str(text)
        .replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def _find_event_by_uid(cal, uid: str, days_back=365, days_fwd=365):
    start = datetime.now(timezone.utc) - timedelta(days=days_back)
    end = datetime.now(timezone.utc) + timedelta(days=days_fwd)
    events = cal.date_search(start=start, end=end, expand=True)
    for ev in events:
        try:
            ve = ev.instance.vevent
            ev_uid = str(ve.uid.value) if hasattr(ve, "uid") and ve.uid else ""
            if ev_uid == uid:
                return ev, ve
        except Exception:
            continue
    return None, None


def action_list_events(params):
    cal = get_calendar(params.get("calendar_id"))
    limit = int(params.get("limit", 50))
    start = datetime.fromisoformat(
        params.get("start", (datetime.now(timezone.utc) - timedelta(days=7)).isoformat())
    )
    end = datetime.fromisoformat(
        params.get("end", (datetime.now(timezone.utc) + timedelta(days=30)).isoformat())
    )

    try:
        events = cal.date_search(start=start, end=end, expand=True)
        results = []
        for ev in events[:limit]:
            try:
                ve = ev.instance.vevent
                results.append(
                    {
                        "uid": str(ve.uid.value) if hasattr(ve, "uid") and ve.uid else str(ev.id),
                        "summary": str(ve.summary.value)
                        if hasattr(ve, "summary") and ve.summary
                        else "",
                        "start": _fmt_dt(_parse_dt(ve.dtstart.value)),
                        "end": _fmt_dt(_parse_dt(ve.dtend.value))
                        if hasattr(ve, "dtend") and ve.dtend
                        else "",
                        "location": str(ve.location.value)
                        if hasattr(ve, "location") and ve.location
                        else "",
                    }
                )
            except Exception:
                continue
        return {"count": len(results), "events": results}
    except Exception as e:
        return {"error": str(e), "events": []}


def action_get_event(params):
    cal = get_calendar(params.get("calendar_id"))
    uid = params["uid"]
    try:
        ev, ve = _find_event_by_uid(cal, uid)
        if not ve:
            return {"error": "Event not found", "uid": uid}
        return {
            "uid": uid,
            "summary": str(ve.summary.value) if hasattr(ve, "summary") and ve.summary else "",
            "start": _fmt_dt(_parse_dt(ve.dtstart.value)),
            "end": _fmt_dt(_parse_dt(ve.dtend.value))
            if hasattr(ve, "dtend") and ve.dtend
            else "",
            "location": str(ve.location.value) if hasattr(ve, "location") and ve.location else "",
            "description": str(ve.description.value)[:5000]
            if hasattr(ve, "description") and ve.description
            else "",
            "status": str(ve.status.value) if hasattr(ve, "status") and ve.status else "CONFIRMED",
        }
    except Exception as e:
        return {"error": str(e)}


def action_create_event(params):
    cal = get_calendar(params.get("calendar_id"))
    uid_val = str(uuid.uuid4())
    summary = _escape_ical_text(params["summary"])
    location = _escape_ical_text(params.get("location", ""))
    description = _escape_ical_text(params.get("description", ""))
    dtstart = _to_ical_dt(params["start"])
    dtend = _to_ical_dt(params["end"])
    ical = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//APA//Sovereign Calendar//EN
BEGIN:VEVENT
UID:{uid_val}
DTSTAMP:{datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")}
DTSTART:{dtstart}
DTEND:{dtend}
SUMMARY:{summary}
LOCATION:{location}
DESCRIPTION:{description}
END:VEVENT
END:VCALENDAR"""
    cal.save_event(ical)
    return {
        "uid": uid_val,
        "created": True,
        "summary": params["summary"],
        "start": params["start"],
        "end": params["end"],
    }


def action_update_event(params):
    cal = get_calendar(params.get("calendar_id"))
    uid = params["uid"]
    ev, ve = _find_event_by_uid(cal, uid)
    if not ve:
        return {"error": "Event not found", "uid": uid}

    if "summary" in params:
        ve.summary.value = params["summary"]
    if "location" in params:
        if hasattr(ve, "location") and ve.location:
            ve.location.value = params["location"]
    if "description" in params:
        if hasattr(ve, "description") and ve.description:
            ve.description.value = params["description"]
    # Recreate with new times if provided (more portable than in-place dt mutate)
    if "start" in params or "end" in params:
        summary = params.get(
            "summary",
            str(ve.summary.value) if hasattr(ve, "summary") and ve.summary else "",
        )
        location = params.get(
            "location",
            str(ve.location.value) if hasattr(ve, "location") and ve.location else "",
        )
        description = params.get(
            "description",
            str(ve.description.value) if hasattr(ve, "description") and ve.description else "",
        )
        start = params.get("start", _fmt_dt(_parse_dt(ve.dtstart.value)))
        end = params.get(
            "end",
            _fmt_dt(_parse_dt(ve.dtend.value))
            if hasattr(ve, "dtend") and ve.dtend
            else start,
        )
        try:
            ev.delete()
        except Exception:
            pass
        return action_create_event(
            {
                "summary": summary,
                "start": start,
                "end": end,
                "location": location,
                "description": description,
                "calendar_id": params.get("calendar_id"),
            }
            | {"_updated_from": uid}
        )

    try:
        ev.save()
    except Exception:
        # some caldav clients use .save() on component
        try:
            ve.parent.save()
        except Exception as e:
            return {"error": f"update failed: {e}", "uid": uid}
    return {"uid": uid, "updated": True}


def action_delete_event(params):
    cal = get_calendar(params.get("calendar_id"))
    uid = params["uid"]
    try:
        ev, ve = _find_event_by_uid(cal, uid)
        if not ev:
            return {"error": "Event not found", "uid": uid}
        ev.delete()
        return {"uid": uid, "deleted": True}
    except Exception as e:
        return {"error": str(e)}


def action_find_free_slots(params):
    cal = get_calendar(params.get("calendar_id"))
    start = _parse_dt(params["start"])
    end = _parse_dt(params["end"])
    duration = int(params.get("duration_minutes", 30))
    try:
        events = cal.date_search(start=start, end=end, expand=True)
        busy = []
        for ev in events:
            ve = ev.instance.vevent
            bs = _parse_dt(ve.dtstart.value)
            be = (
                _parse_dt(ve.dtend.value)
                if hasattr(ve, "dtend") and ve.dtend
                else bs + timedelta(hours=1)
            )
            busy.append({"start": bs, "end": be})
        busy.sort(key=lambda x: x["start"])
        free, cursor = [], start
        for b in busy:
            if cursor < b["start"]:
                gap = (b["start"] - cursor).total_seconds() / 60
                if gap >= duration:
                    free.append(
                        {
                            "start": cursor.isoformat(),
                            "end": b["start"].isoformat(),
                            "duration_minutes": int(gap),
                        }
                    )
            cursor = max(cursor, b["end"])
        if cursor < end:
            gap = (end - cursor).total_seconds() / 60
            if gap >= duration:
                free.append(
                    {
                        "start": cursor.isoformat(),
                        "end": end.isoformat(),
                        "duration_minutes": int(gap),
                    }
                )
        return {"free_slots": free, "count": len(free)}
    except Exception as e:
        return {"error": str(e), "free_slots": []}


def action_quick_add(params):
    """
    Minimal natural-language → event.
    Supports patterns like: 'Lunch with Arif tomorrow 13:00' or ISO snippets.
    Not a full NLP engine — honest partial parser (F2 TRUTH).
    """
    text = (params.get("text") or "").strip()
    if not text:
        return {"error": "text required"}

    now = datetime.now(timezone.utc)
    duration = int(params.get("duration_minutes", 60))
    start = now + timedelta(hours=1)
    start = start.replace(minute=0, second=0, microsecond=0)

    lower = text.lower()
    if "tomorrow" in lower:
        start = (now + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
    elif "today" in lower:
        start = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)

    m = re.search(r"\b(\d{1,2}):(\d{2})\b", text)
    if m:
        start = start.replace(hour=int(m.group(1)), minute=int(m.group(2)))
    m2 = re.search(r"\b(\d{1,2})\s*(am|pm)\b", lower)
    if m2:
        h = int(m2.group(1)) % 12
        if m2.group(2) == "pm":
            h += 12
        start = start.replace(hour=h, minute=0)

    end = start + timedelta(minutes=duration)
    summary = re.sub(
        r"\b(today|tomorrow|\d{1,2}:\d{2}|\d{1,2}\s*(am|pm))\b",
        "",
        text,
        flags=re.I,
    ).strip(" -–|")
    if not summary:
        summary = text[:80]

    created = action_create_event(
        {
            "summary": summary,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "description": f"quick_add: {text}",
            "calendar_id": params.get("calendar_id"),
        }
    )
    return {
        "uid": created.get("uid"),
        "parsed": {
            "summary": summary,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "parser": "regex_partial",
        },
        "created": created.get("created", False),
        "raw_text": text,
    }


ACTIONS = {
    "list_events": action_list_events,
    "get_event": action_get_event,
    "create_event": action_create_event,
    "update_event": action_update_event,
    "delete_event": action_delete_event,
    "find_free_slots": action_find_free_slots,
    "quick_add": action_quick_add,
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
            creds = load_creds()
            creds_exist = bool(creds)
            pwd_ok = bool(
                creds
                and creds.get("app_password")
                and not str(creds.get("app_password")).startswith("YOUR_")
            )
            status = "READY" if (creds_exist and pwd_ok and caldav is not None) else "AWAITING_CREDENTIALS"
            if caldav is None:
                status = "MISSING_DEPENDENCY"
            self._send(
                {
                    "ok": True,
                    "bridge": "calendar_bridge",
                    "protocol": "caldav",
                    "apa_version": "1.0",
                    "verbs": sorted(ACTIONS.keys()),
                    "credentials_configured": creds_exist and pwd_ok,
                    "caldav_installed": caldav is not None,
                    "status": status,
                }
            )
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
    port = int(os.environ.get("CALENDAR_BRIDGE_PORT", "18094"))
    server = HTTPServer(("127.0.0.1", port), CalendarHandler)
    log.info(f"APA Calendar Bridge listening on 127.0.0.1:{port}")
    server.serve_forever()
