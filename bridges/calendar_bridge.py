#!/usr/bin/env python3
"""
calendar_bridge.py — APA Calendar Connector (Google API OAuth).
Manifest: /root/A-FORGE/apa/manifests/calendar.yaml
Port: 18094 (127.0.0.1)

ZEN-MIGRATED 2026-08-25: from CalDAV → Google API OAuth (matches manifest).

DITEMPA BUKAN DIBERI — Time sovereignty is forged.
"""

from __future__ import annotations

import logging
import os
import sys
from datetime import datetime, timezone

# Allow sibling base import
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from google_bridge_base import GoogleBridge, serve  # noqa: E402

try:
    from googleapiclient.discovery import build as build_service
except ImportError:
    build_service = None  # type: ignore


CONN = "calendar"
SCOPES = ["https://www.googleapis.com/auth/calendar"]
DEFAULT_PORT = 18094


def _service_factory(creds):
    if build_service is None:
        return None
    return build_service("calendar", "v3", credentials=creds, cache_discovery=False)


def action_list_events(bridge: GoogleBridge, params):
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("calendar service unavailable")
    cal_id = params.get("calendar_id", "primary")
    max_results = int(params.get("limit", 50))
    time_min = params.get("time_min") or datetime.now(timezone.utc).isoformat()
    time_max = params.get("time_max")
    kwargs = {
        "calendarId": cal_id,
        "maxResults": max_results,
        "singleEvents": True,
        "orderBy": "startTime",
        "timeMin": time_min,
    }
    if time_max:
        kwargs["timeMax"] = time_max
    res = svc.events().list(**kwargs).execute()
    items = res.get("items", [])
    events = [
        {
            "id": ev.get("id"),
            "summary": ev.get("summary"),
            "start": ev.get("start", {}).get("dateTime")
            or ev.get("start", {}).get("date"),
            "end": ev.get("end", {}).get("dateTime") or ev.get("end", {}).get("date"),
            "location": ev.get("location", ""),
            "status": ev.get("status", "confirmed"),
            "html_link": ev.get("htmlLink", ""),
        }
        for ev in items
    ]
    return {"count": len(events), "events": events}


def action_get_event(bridge: GoogleBridge, params):
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("calendar service unavailable")
    cal_id = params.get("calendar_id", "primary")
    event_id = params["event_id"]
    ev = svc.events().get(calendarId=cal_id, eventId=event_id).execute()
    return {
        "id": ev.get("id"),
        "summary": ev.get("summary"),
        "start": ev.get("start", {}).get("dateTime") or ev.get("start", {}).get("date"),
        "end": ev.get("end", {}).get("dateTime") or ev.get("end", {}).get("date"),
        "location": ev.get("location", ""),
        "description": (ev.get("description") or "")[:5000],
        "status": ev.get("status", "confirmed"),
        "html_link": ev.get("htmlLink", ""),
    }


def action_create_event(bridge: GoogleBridge, params):
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("calendar service unavailable")
    cal_id = params.get("calendar_id", "primary")
    body = {
        "summary": params["summary"],
        "start": {"dateTime": params["start"]},
        "end": {"dateTime": params["end"]},
    }
    if params.get("location"):
        body["location"] = params["location"]
    if params.get("description"):
        body["description"] = params["description"]
    ev = svc.events().insert(calendarId=cal_id, body=body).execute()
    return {
        "id": ev.get("id"),
        "created": True,
        "summary": ev.get("summary"),
        "start": ev.get("start", {}).get("dateTime"),
        "end": ev.get("end", {}).get("dateTime"),
        "html_link": ev.get("htmlLink", ""),
    }


def action_update_event(bridge: GoogleBridge, params):
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("calendar service unavailable")
    cal_id = params.get("calendar_id", "primary")
    event_id = params["event_id"]
    body = {}
    for k in ("summary", "location", "description"):
        if k in params:
            body[k] = params[k]
    if "start" in params:
        body["start"] = {"dateTime": params["start"]}
    if "end" in params:
        body["end"] = {"dateTime": params["end"]}
    ev = svc.events().patch(calendarId=cal_id, eventId=event_id, body=body).execute()
    return {"id": ev.get("id"), "updated": True}


def action_delete_event(bridge: GoogleBridge, params):
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("calendar service unavailable")
    cal_id = params.get("calendar_id", "primary")
    event_id = params["event_id"]
    svc.events().delete(calendarId=cal_id, eventId=event_id).execute()
    return {"id": event_id, "deleted": True}


def action_find_free_slots(bridge: GoogleBridge, params):
    """Use FreeBusy API to find free slots."""
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("calendar service unavailable")
    cal_id = params.get("calendar_id", "primary")
    time_min = params["start"]
    time_max = params["end"]
    body = {"timeMin": time_min, "timeMax": time_max, "items": [{"id": cal_id}]}
    res = svc.freebusy().query(body=body).execute()
    busy = res.get("calendars", {}).get(cal_id, {}).get("busy", [])
    return {
        "calendar_id": cal_id,
        "busy_slots": busy,
        "free_slots_query": {"start": time_min, "end": time_max},
    }


# ACTIONS map (matches manifest verbs)
ACTIONS = {
    "list_events": action_list_events,
    "get_event": action_get_event,
    "create_event": action_create_event,
    "update_event": action_update_event,
    "delete_event": action_delete_event,
    "find_free_slots": action_find_free_slots,
}


class CalendarBridge(GoogleBridge):
    CONNECTOR_NAME = CONN
    SCOPES = SCOPES
    DEFAULT_PORT = DEFAULT_PORT
    SERVICE_FN = staticmethod(_service_factory) if False else _service_factory  # type: ignore
    ACTIONS = ACTIONS


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="[calendar_bridge] %(message)s")
    serve(CalendarBridge())
