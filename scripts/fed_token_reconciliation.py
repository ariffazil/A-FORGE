"""FED Token Semantic Reconciliation & Negative-Control Probe Utility (PR-FED-1).

Read-only analytical utility that:
  1. Reconciles token totals explicitly by semantic bucket (attempted, replayed,
     unique, accepted) without unexplained arithmetic adjustments.
  2. Classifies legacy malformed ``.%fZ`` rows as quarantined semantically
     without mutating production history.
  3. Provides strict HTTP-status parsing and negative-control transport probe
     verification (e.g. 127.0.0.1:58402, 100.64.0.5:42960) so unreachable or
     non-200 endpoints fail visibly and never masquerade as healthy or accepted.
"""

from __future__ import annotations

import re
import sqlite3
import urllib.error
import urllib.request
from pathlib import Path

from fed_attribution_callback import classify_legacy_timestamp

STRICT_HTTP_STATUS_RE = re.compile(r"\bHTTP/\d(?:\.\d)?\s+(\d{3})\b|\bstatus[=:]\s*(\d{3})\b", re.IGNORECASE)


def parse_strict_http_status(log_line: str) -> int | None:
    """Parse an explicit HTTP status code from a structured log line.

    Never performs bare substring matching (which caused false 402/429 hits
    against port numbers such as 127.0.0.1:58402 and 100.64.0.5:42960).
    """
    if not isinstance(log_line, str):
        return None
    m = STRICT_HTTP_STATUS_RE.search(log_line)
    if not m:
        return None
    code_str = m.group(1) or m.group(2)
    return int(code_str) if code_str else None


def probe_endpoint_strict(url: str, timeout: float = 0.5) -> dict:
    """Probe an HTTP endpoint strictly; return explicit status/error without masking."""
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return {
                "url": url,
                "reachable": True,
                "http_status": int(resp.status),
                "accepted": False,  # HTTP 200 never proves task acceptance
                "error": None,
            }
    except urllib.error.HTTPError as e:
        return {
            "url": url,
            "reachable": True,
            "http_status": int(e.code),
            "accepted": False,
            "error": f"HTTPError:{e.code}",
        }
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
        return {
            "url": url,
            "reachable": False,
            "http_status": None,
            "accepted": False,
            "error": f"{type(e).__name__}:{e}",
        }


def summarize_ledger_tokens_readonly(db_path: str | Path) -> dict:
    """Read-only summary of token semantics and legacy timestamp quarantine counts."""
    path = Path(db_path)
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    try:
        cols = {r[1] for r in con.execute("PRAGMA table_info(token_bank_spend)").fetchall()}
        rows = [dict(r) for r in con.execute("SELECT * FROM token_bank_spend").fetchall()]
    finally:
        con.close()

    totals: dict[str, int | None] = {
        "row_count": len(rows),
        "attempted_input_tokens": 0,
        "attempted_output_tokens": 0,
        "replayed_input_tokens": 0,
        "replayed_output_tokens": 0,
        "unique_input_tokens": 0,
        "unique_output_tokens": 0,
        "accepted_input_tokens": 0,
        "accepted_output_tokens": 0,
        "rows_missing_replayed": 0,
        "rows_missing_unique": 0,
        "rows_missing_accepted": 0,
        "legacy_malformed_percent_f_rows": 0,
        "legacy_invalid_timestamp_rows": 0,
        "valid_utc_timestamp_rows": 0,
    }

    has_replayed = "replayed_input_tokens" in cols
    has_unique = "unique_input_tokens" in cols
    has_accepted = "accepted_input_tokens" in cols

    for r in rows:
        ts_class = classify_legacy_timestamp(r.get("called_at"))
        if ts_class == "LEGACY_MALFORMED_LITERAL_PERCENT_F":
            totals["legacy_malformed_percent_f_rows"] += 1  # type: ignore[operator]
        elif ts_class == "VALID_UTC_ISO8601":
            totals["valid_utc_timestamp_rows"] += 1  # type: ignore[operator]
        else:
            totals["legacy_invalid_timestamp_rows"] += 1  # type: ignore[operator]

        ai = r.get("attempted_input_tokens") if "attempted_input_tokens" in cols else r.get("tokens_in")
        ao = r.get("attempted_output_tokens") if "attempted_output_tokens" in cols else r.get("tokens_out")
        if ai is not None:
            totals["attempted_input_tokens"] += int(ai)  # type: ignore[operator]
        if ao is not None:
            totals["attempted_output_tokens"] += int(ao)  # type: ignore[operator]

        if has_replayed and r.get("replayed_input_tokens") is not None:
            totals["replayed_input_tokens"] += int(r["replayed_input_tokens"])  # type: ignore[operator]
            if r.get("replayed_output_tokens") is not None:
                totals["replayed_output_tokens"] += int(r["replayed_output_tokens"])  # type: ignore[operator]
        else:
            totals["rows_missing_replayed"] += 1  # type: ignore[operator]

        if has_unique and r.get("unique_input_tokens") is not None:
            totals["unique_input_tokens"] += int(r["unique_input_tokens"])  # type: ignore[operator]
            if r.get("unique_output_tokens") is not None:
                totals["unique_output_tokens"] += int(r["unique_output_tokens"])  # type: ignore[operator]
        else:
            totals["rows_missing_unique"] += 1  # type: ignore[operator]

        if has_accepted and r.get("accepted_input_tokens") is not None:
            totals["accepted_input_tokens"] += int(r["accepted_input_tokens"])  # type: ignore[operator]
            if r.get("accepted_output_tokens") is not None:
                totals["accepted_output_tokens"] += int(r["accepted_output_tokens"])  # type: ignore[operator]
        else:
            totals["rows_missing_accepted"] += 1  # type: ignore[operator]

    return totals
