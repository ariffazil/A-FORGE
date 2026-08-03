#!/usr/bin/env python3
"""
GWS Bridge — CLI entry point for A-FORGE Google Workspace capability.
ZEN-FORGED 2026-08-03 — extracted from arifOS kernel.

Usage:
  python3 gws_bridge.py gmail read-unread [--max 10] [--query "is:unread"]
  python3 gws_bridge.py gmail send --to X --subject Y --body Z [--actor-id A]
  python3 gws_bridge.py calendar list [--max 10]
  python3 gws_bridge.py calendar create --summary X --start Y --end Z [--actor-id A]
  python3 gws_bridge.py drive list [--max 15]
  python3 gws_bridge.py drive search --query X
  python3 gws_bridge.py sheets read --id X [--range "Sheet1!A1:Z100"]
  python3 gws_bridge.py sheets append --id X --values '[["a","b"]]' [--actor-id A]

Output: JSON to stdout. Exit 0 on success, 1 on error.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Ensure the google_workspace module is importable
sys.path.insert(0, str(Path(__file__).parent))

from google_workspace import (  # type: ignore[import-untyped]
    google_calendar_create_event,
    google_calendar_list_events,
    google_drive_list_files,
    google_drive_search,
    google_gmail_read_unread,
    google_gmail_send,
    google_sheets_append,
    google_sheets_read,
)


def main() -> None:
    if len(sys.argv) < 2:
        print(
            json.dumps(
                {
                    "status": "HOLD",
                    "error": "usage: gws_bridge.py <service> <verb> [args...]",
                }
            )
        )
        sys.exit(1)

    service = sys.argv[1]
    verb = sys.argv[2] if len(sys.argv) > 2 else ""
    args = _parse_args(sys.argv[3:])

    result: dict = {
        "status": "HOLD",
        "error": f"unknown service/verb: {service}/{verb}",
    }

    try:
        if service == "gmail":
            result = _handle_gmail(verb, args)
        elif service == "calendar":
            result = _handle_calendar(verb, args)
        elif service == "drive":
            result = _handle_drive(verb, args)
        elif service == "sheets":
            result = _handle_sheets(verb, args)
    except Exception as e:
        result = {"status": "HOLD", "error": str(e)}

    print(json.dumps(result, default=str))
    sys.exit(0 if result.get("status") == "SEAL" else 1)


def _parse_args(argv: list[str]) -> dict:
    """Parse --key value pairs into a dict."""
    d: dict = {}
    i = 0
    while i < len(argv):
        if argv[i].startswith("--"):
            key = argv[i][2:].replace("-", "_")
            if i + 1 < len(argv) and not argv[i + 1].startswith("--"):
                val = argv[i + 1]
                # Try JSON decode for structured values
                try:
                    val = json.loads(val)
                except (json.JSONDecodeError, ValueError):
                    pass
                d[key] = val
                i += 2
            else:
                d[key] = True
                i += 1
        else:
            i += 1
    return d


def _handle_gmail(verb: str, args: dict) -> dict:
    if verb == "read-unread":
        return google_gmail_read_unread(
            max_results=int(args.get("max", 10)),
            query=str(args.get("query", "is:unread")),
            actor_id=args.get("actor_id"),
        )
    elif verb == "send":
        return google_gmail_send(
            to=str(args["to"]),
            subject=str(args.get("subject", "")),
            body=str(args.get("body", "")),
            actor_id=args.get("actor_id"),
            permitted_scope=args.get("permitted_scope"),
        )
    return {"status": "HOLD", "error": f"unknown gmail verb: {verb}"}


def _handle_calendar(verb: str, args: dict) -> dict:
    if verb == "list":
        return google_calendar_list_events(
            max_results=int(args.get("max", 10)),
            calendar_id=str(args.get("calendar_id", "primary")),
            actor_id=args.get("actor_id"),
        )
    elif verb == "create":
        return google_calendar_create_event(
            summary=str(args.get("summary", "")),
            start_iso=str(args.get("start", "")),
            end_iso=str(args.get("end", "")),
            description=str(args.get("description", "")),
            calendar_id=str(args.get("calendar_id", "primary")),
            timezone=str(args.get("timezone", "Asia/Kuala_Lumpur")),
            actor_id=args.get("actor_id"),
        )
    return {"status": "HOLD", "error": f"unknown calendar verb: {verb}"}


def _handle_drive(verb: str, args: dict) -> dict:
    if verb == "list":
        return google_drive_list_files(
            page_size=int(args.get("max", 15)),
            actor_id=args.get("actor_id"),
        )
    elif verb == "search":
        return google_drive_search(
            query=str(args.get("query", "")),
            page_size=int(args.get("max", 10)),
            actor_id=args.get("actor_id"),
        )
    return {"status": "HOLD", "error": f"unknown drive verb: {verb}"}


def _handle_sheets(verb: str, args: dict) -> dict:
    if verb == "read":
        return google_sheets_read(
            spreadsheet_id=str(args["id"]),
            range_name=str(args.get("range", "Sheet1!A1:Z100")),
            actor_id=args.get("actor_id"),
        )
    elif verb == "append":
        values = args.get("values", [])
        if isinstance(values, str):
            values = json.loads(values)
        return google_sheets_append(
            spreadsheet_id=str(args["id"]),
            values=values,
            range_name=str(args.get("range", "Sheet1")),
            actor_id=args.get("actor_id"),
        )
    return {"status": "HOLD", "error": f"unknown sheets verb: {verb}"}


if __name__ == "__main__":
    main()
