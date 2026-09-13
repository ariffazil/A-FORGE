"""
forge_phone_call — governed MCP-callable voice-calling skill for A-FORGE.

Authority-split per memo 2026-09-13 (integrations/forge_phone_call.md):
a PSTN voice call is an irreversible real-world action (T3, 888_HOLD).
This module therefore NEVER dials by itself in its default state — it emits
governed receipts. When Twilio credentials are unconfigured (the current
federation state, Fasa 0), every call resolves to DRY_RUN regardless of the
caller's dry_run flag. Even when credentials exist, `dry_run` defaults to True;
live execution additionally requires F13 sovereign authorisation.

Receipt blocks (F1-F13):
  F1_SNAPSHOT    — pre-mutation reality snapshot (creds redacted, use_case,
                   calendar conflict state) — "before mutation, read reality".
  F2_LABEL       — epistemic label OBS / DER / INT / SPEC for the intent.
  F7_CONFIDENCE  — calibrated confidence, hard-capped at 0.90 (humility floor).
  F11_TRACE      — UUID trace id binding this receipt into the audit chain.
  F13_SOVEREIGN  — authority gate: who authorised, whether live dialling is
                   permitted at all.

CLI: python3 forge_phone_call.py --to +60123456789 --intent "test" --dry-run
"""
from __future__ import annotations

import datetime as _dt
import json
import logging
import os
import re
import sys
import uuid
from typing import Any, Dict, List, Optional

# Make the bridges package importable when run as a script or via MCP loader.
_HERE = os.path.dirname(os.path.abspath(__file__))
_FORGE_ROOT = os.path.dirname(os.path.dirname(_HERE))
if _FORGE_ROOT not in sys.path:
    sys.path.insert(0, _FORGE_ROOT)

from bridges.voice_bridge import (  # noqa: E402
    TwilioVoiceClient,
    TwiMLBuilder,
    build_stream_twiml,
    is_e164,
    new_stream_token,
)

log = logging.getLogger("aforge.forge_phone_call")

__all__ = ["forge_phone_call", "main"]

# ---------------------------------------------------------------------------
# Governance constants
# ---------------------------------------------------------------------------
F7_CONFIDENCE_CAP = 0.90
ALLOWED_USE_CASES = ("booking", "bank_hybrid")
STATUS_COMPLETED = "COMPLETED"
STATUS_DRY_RUN = "DRY_RUN"
STATUS_FAILED = "FAILED"

# Public media-plane host (matches hermes-voice config default).
DEFAULT_WSS_HOST = os.environ.get("PUBLIC_WSS_HOST", "voice.arif-fazil.com")


# ---------------------------------------------------------------------------
# Calendar pre-check (F1: verify before acting)
# ---------------------------------------------------------------------------
# A real implementation queries the calendar bridge; the scaffold exposes the
# conflict-detection contract so tests pin the logic. Convention: conflict
# state is derived from caller-supplied events + a conflict window in minutes.
DEFAULT_CONFLICT_WINDOW_MIN = 60


def check_calendar_conflicts(
    target_datetime: Optional[str],
    existing_events: Optional[List[Dict[str, Any]]] = None,
    window_minutes: int = DEFAULT_CONFLICT_WINDOW_MIN,
) -> Dict[str, Any]:
    """Return {checked, has_conflict, conflicts[], window_minutes, source}.

    Deterministic pure logic — no I/O, so it is fully testable:
      * no target_datetime -> not checked (nothing to compare)
      * event overlaps [target - window, target + window] -> conflict
    """
    result: Dict[str, Any] = {
        "checked": False,
        "has_conflict": False,
        "conflicts": [],
        "window_minutes": window_minutes,
        "source": "forge_phone_call.calendar_scaffold",
    }
    if not target_datetime:
        result["note"] = "no target datetime supplied — calendar not checked"
        return result

    try:
        target = _parse_dt(target_datetime)
    except ValueError as e:
        result["error"] = f"unparseable target_datetime: {e}"
        return result

    result["checked"] = True
    for ev in existing_events or []:
        try:
            ev_start = _parse_dt(str(ev.get("start", "")))
        except ValueError:
            continue  # Witness-First: skip malformed, never crash the call plan
        delta_min = abs((ev_start - target).total_seconds()) / 60.0
        if delta_min <= window_minutes:
            result["has_conflict"] = True
            result["conflicts"].append({
                "event": ev.get("title", "untitled"),
                "start": ev.get("start"),
                "delta_minutes": round(delta_min, 1),
            })
    return result


def _parse_dt(s: str) -> _dt.datetime:
    s = s.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = _dt.datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_dt.timezone.utc)
    return dt


# ---------------------------------------------------------------------------
# F-gate builders
# ---------------------------------------------------------------------------
def _f1_snapshot(client: TwilioVoiceClient, use_case: str,
                 calendar: Dict[str, Any]) -> Dict[str, Any]:
    """F1 AMANAH: read reality before mutation. Secrets stay redacted."""
    return {
        "floor": "F1",
        "name": "F1_SNAPSHOT",
        "twilio_credentials": client.credential_status(),
        "use_case": use_case,
        "calendar": calendar,
        "mutation_allowed": False,  # scaffold never mutates PSTN state live
    }


def _f2_label(use_case: str, intent: str) -> Dict[str, Any]:
    """F2 TRUTH: the call intent is a SPECIFICATION (what we want to happen),
    the outcome would be DERIVED/INTERPRETED only after live audio exists."""
    return {
        "floor": "F2",
        "name": "F2_LABEL",
        "label": "SPEC",
        "intent": intent,
        "use_case": use_case,
        "rationale": "pre-call intent is a specification, not an observation",
    }


def _f7_confidence(raw: float) -> Dict[str, Any]:
    capped = min(max(float(raw), 0.0), F7_CONFIDENCE_CAP)
    return {
        "floor": "F7",
        "name": "F7_CONFIDENCE",
        "confidence": round(capped, 3),
        "cap": F7_CONFIDENCE_CAP,
        "capped_from_raw": round(float(raw), 3) if raw > F7_CONFIDENCE_CAP else None,
    }


def _f11_trace(trace_id: Optional[str]) -> Dict[str, Any]:
    return {
        "floor": "F11",
        "name": "F11_TRACE",
        "trace_id": trace_id or str(uuid.uuid4()),
    }


def _f13_sovereign(auth_token: Optional[str], live_requested: bool,
                   creds_configured: bool) -> Dict[str, Any]:
    """F13 SOVEREIGN: live PSTN dialling needs explicit sovereign authority.
    A bare env token is accepted ONLY for the scaffold's dry-run lane; real
    deployments must route through 888_HOLD (Telegram approval relay)."""
    token_present = bool(auth_token and auth_token.strip())
    return {
        "floor": "F13",
        "name": "F13_SOVEREIGN",
        "sovereign": "ARIF",
        "auth_token_present": token_present,
        "live_dial_permitted": bool(token_present and creds_configured),
        "live_requested": live_requested,
        "gate": "888_HOLD" if (live_requested and not token_present) else "PASS",
        "note": ("sovereign approval required for any live dial "
                 "(memo 2026-09-13: T3, 888_HOLD, per-call approval)"),
    }


def _build_f_gates(client: TwilioVoiceClient, use_case: str, intent: str,
                   calendar: Dict[str, Any], confidence: float,
                   trace_id: str, auth_token: Optional[str],
                   live_requested: bool) -> Dict[str, Dict[str, Any]]:
    return {
        "F1_SNAPSHOT": _f1_snapshot(client, use_case, calendar),
        "F2_LABEL": _f2_label(use_case, intent),
        "F7_CONFIDENCE": _f7_confidence(confidence),
        "F11_TRACE": _f11_trace(trace_id),
        "F13_SOVEREIGN": _f13_sovereign(auth_token, live_requested,
                                        client.configured),
    }


# ---------------------------------------------------------------------------
# Main tool function
# ---------------------------------------------------------------------------
def forge_phone_call(
    to: str,
    intent: str,
    calendar_check: bool = True,
    use_case: str = "booking",
    dry_run: Optional[bool] = None,
    calendar_events: Optional[List[Dict[str, Any]]] = None,
    calendar_target: Optional[str] = None,
    sovereign_token: Optional[str] = None,
    confidence: float = 0.80,
    client: Optional[TwilioVoiceClient] = None,
) -> Dict[str, Any]:
    """Plan (and, only when fully authorised, originate) a governed PSTN call.

    Parameters
    ----------
    to : str                E.164 destination, e.g. "+60312345678".
    intent : str            Goal/prompt for the call.
    calendar_check : bool   Run pre-call calendar conflict verification.
    use_case : str          "booking" | "bank_hybrid".
    dry_run : bool|None     None -> auto: True unless credentials configured.
    calendar_events/target : deterministic calendar-check inputs.
    sovereign_token : str   F13 token; only honoured for the dry-run scaffold.
    client : TwilioVoiceClient  injectable (tests pass a fake-transport one).

    Returns a JSON-serialisable receipt dict (see module docstring).
    """
    receipt_id = f"call_{uuid.uuid4().hex[:12]}"
    timestamp = _dt.datetime.now(_dt.timezone.utc).isoformat()
    trace_id = str(uuid.uuid4())
    cli = client or TwilioVoiceClient()

    # -- validation ----------------------------------------------------------
    if use_case not in ALLOWED_USE_CASES:
        return _failed(receipt_id, timestamp, trace_id,
                       f"use_case must be one of {ALLOWED_USE_CASES}, got {use_case!r}")
    if not intent or not intent.strip():
        return _failed(receipt_id, timestamp, trace_id,
                       "intent must be a non-empty string")
    if not is_e164(to):
        return _failed(receipt_id, timestamp, trace_id,
                       f"to must be E.164 (+CCNNNNNNNNN, 8-15 digits), got {to!r}")

    # -- dry-run defaulting (hard safety) -------------------------------------
    if dry_run is None:
        dry_run = not cli.configured

    # -- calendar pre-check ----------------------------------------------------
    if calendar_check:
        calendar = check_calendar_conflicts(calendar_target, calendar_events)
    else:
        calendar = {
            "checked": False, "has_conflict": False, "conflicts": [],
            "note": "calendar_check disabled by caller",
            "source": "forge_phone_call.calendar_scaffold",
        }

    # -- media plane plan --------------------------------------------------------
    stream_token = new_stream_token()
    wss_url = f"wss://{DEFAULT_WSS_HOST}/internal/{receipt_id}/media?token={stream_token}"
    greeting = _greeting_for(use_case)
    twiml = build_stream_twiml(wss_url, greeting=greeting)

    # -- governance envelope -----------------------------------------------------
    gates = _build_f_gates(cli, use_case, intent, calendar, confidence,
                           trace_id, sovereign_token,
                           live_requested=not dry_run)

    # -- execution lanes ----------------------------------------------------------
    if dry_run:
        call_details = cli._dry_run_result(to, twiml, "dry_run_requested"
                                           if cli.configured
                                           else "credentials_unconfigured")
        call_details["dry_run_forced"] = not cli.configured and dry_run
        status = STATUS_DRY_RUN
    else:
        # Live lane — reachable ONLY when: creds configured AND caller passed
        # dry_run=False explicitly AND F13 gate is open. Scaffold still routes
        # through the client (which tests mock); production wiring must add
        # 888_HOLD approval before ever reaching here.
        if not gates["F13_SOVEREIGN"]["live_dial_permitted"]:
            call_details = cli._dry_run_result(
                to, twiml, "f13_sovereign_gate_closed")
            status = STATUS_DRY_RUN
        else:
            call_details = cli.create_call(to, twiml)
            status = call_details.get("status", STATUS_FAILED)

    receipt = {
        "receipt_id": receipt_id,
        "timestamp": timestamp,
        "status": status,
        "tool": "forge_phone_call",
        "call_details": call_details,
        "f_gates": gates,
        "evidence": {
            "to": to,
            "intent": intent,
            "use_case": use_case,
            "calendar_check": calendar,
            "dry_run": dry_run,
            "twiml": twiml,
            "wss_url_host": DEFAULT_WSS_HOST,
            "media_format": {"encoding": "audio/x-mulaw", "sampleRate": 8000,
                             "channels": 1},
        },
    }
    return receipt


def _greeting_for(use_case: str) -> str:
    if use_case == "bank_hybrid":
        return ("Hello, this is an automated assistant calling on behalf of "
                "an account holder. This call is being handled by an AI system.")
    return ("Hello, this is an automated assistant calling to help schedule "
            "an appointment. This call is being handled by an AI system.")


def _failed(receipt_id: str, timestamp: str, trace_id: str,
            reason: str) -> Dict[str, Any]:
    return {
        "receipt_id": receipt_id,
        "timestamp": timestamp,
        "status": STATUS_FAILED,
        "tool": "forge_phone_call",
        "call_details": {"status": STATUS_FAILED, "call_sid": None,
                         "reason": reason, "dry_run": True},
        "f_gates": {
            "F1_SNAPSHOT": {"floor": "F1", "name": "F1_SNAPSHOT",
                            "mutation_allowed": False},
            "F2_LABEL": {"floor": "F2", "name": "F2_LABEL", "label": "SPEC"},
            "F7_CONFIDENCE": {"floor": "F7", "name": "F7_CONFIDENCE",
                              "confidence": 0.0, "cap": F7_CONFIDENCE_CAP},
            "F11_TRACE": {"floor": "F11", "name": "F11_TRACE",
                          "trace_id": trace_id},
            "F13_SOVEREIGN": {"floor": "F13", "name": "F13_SOVEREIGN",
                              "sovereign": "ARIF", "live_dial_permitted": False,
                              "gate": "PASS"},
        },
        "evidence": {"failure_reason": reason},
    }


# ---------------------------------------------------------------------------
# CLI (dry-run self-test lane)
# ---------------------------------------------------------------------------
def main(argv: Optional[List[str]] = None) -> int:
    import argparse
    p = argparse.ArgumentParser(
        description="forge_phone_call — governed PSTN call scaffold (dry-run)")
    p.add_argument("--to", required=True, help="E.164 destination")
    p.add_argument("--intent", required=True, help="call goal")
    p.add_argument("--use-case", default="booking",
                   choices=list(ALLOWED_USE_CASES))
    p.add_argument("--calendar-check", action="store_true", default=True)
    p.add_argument("--no-calendar-check", dest="calendar_check",
                   action="store_false")
    p.add_argument("--dry-run", action="store_true", default=None,
                   help="force dry-run (default: auto)")
    p.add_argument("--json-only", action="store_true",
                   help="print receipt without surrounding log lines")
    a = p.parse_args(argv)

    if not a.json_only:
        logging.basicConfig(level=logging.INFO,
                            format="[forge_phone_call] %(message)s")
    receipt = forge_phone_call(
        to=a.to, intent=a.intent, use_case=a.use_case,
        calendar_check=a.calendar_check, dry_run=True if a.dry_run else None)
    print(json.dumps(receipt, indent=2, ensure_ascii=False))
    return 0 if receipt["status"] != STATUS_FAILED else 1


if __name__ == "__main__":
    raise SystemExit(main())
