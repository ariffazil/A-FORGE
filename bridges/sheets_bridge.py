#!/usr/bin/env python3
"""
sheets_bridge.py — APA Sheets Connector (Google API OAuth).
Manifest: /root/A-FORGE/apa/manifests/sheets.yaml
Port: 18096 (127.0.0.1)

DITEMPA BUKAN DIBERI — Spreadsheet sovereignty is forged.
"""

from __future__ import annotations

import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from google_bridge_base import GoogleBridge, serve  # noqa: E402

try:
    from googleapiclient.discovery import build as build_service
except ImportError:
    build_service = None  # type: ignore


CONN = "sheets"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
DEFAULT_PORT = 18096


def _service_factory(creds):
    if build_service is None:
        return None
    return build_service("sheets", "v4", credentials=creds, cache_discovery=False)


def action_read(bridge: GoogleBridge, params):
    """Read values from a range (A1 notation)."""
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("sheets service unavailable")
    spreadsheet_id = params["spreadsheet_id"]
    range_a1 = params["range"]
    res = (
        svc.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=range_a1)
        .execute()
    )
    values = res.get("values", [])
    return {
        "spreadsheet_id": spreadsheet_id,
        "range": range_a1,
        "row_count": len(values),
        "rows": values,
    }


def action_append(bridge: GoogleBridge, params):
    """Append rows to a sheet."""
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("sheets service unavailable")
    spreadsheet_id = params["spreadsheet_id"]
    range_a1 = params["range"]
    rows = params["rows"]
    body = {"values": rows}
    res = (
        svc.spreadsheets()
        .values()
        .append(
            spreadsheetId=spreadsheet_id,
            range=range_a1,
            valueInputOption="USER_ENTERED",
            insertDataOption="INSERT_ROWS",
            body=body,
        )
        .execute()
    )
    return {
        "spreadsheet_id": spreadsheet_id,
        "range": range_a1,
        "updated_rows": res.get("updates", {}).get("updatedRows", 0),
        "updated_range": res.get("updates", {}).get("updatedRange", ""),
    }


def action_update(bridge: GoogleBridge, params):
    """Update cells by range."""
    svc = bridge.service()
    if svc is None:
        raise RuntimeError("sheets service unavailable")
    spreadsheet_id = params["spreadsheet_id"]
    range_a1 = params["range"]
    rows = params["rows"]
    body = {"values": rows}
    res = (
        svc.spreadsheets()
        .values()
        .update(
            spreadsheetId=spreadsheet_id,
            range=range_a1,
            valueInputOption="USER_ENTERED",
            body=body,
        )
        .execute()
    )
    return {
        "spreadsheet_id": spreadsheet_id,
        "range": range_a1,
        "updated_rows": res.get("updatedRows", 0),
        "updated_columns": res.get("updatedColumns", 0),
        "updated_cells": res.get("updatedCells", 0),
    }


ACTIONS = {
    "read": action_read,
    "append": action_append,
    "update": action_update,
}


class SheetsBridge(GoogleBridge):
    CONNECTOR_NAME = CONN
    SCOPES = SCOPES
    DEFAULT_PORT = DEFAULT_PORT
    SERVICE_FN = _service_factory
    ACTIONS = ACTIONS


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="[sheets_bridge] %(message)s")
    serve(SheetsBridge())
