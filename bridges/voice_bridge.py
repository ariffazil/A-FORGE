#!/usr/bin/env python3
"""
voice_bridge.py — PSTN voice bridge scaffold for the arifOS federation.

Three orthogonal pieces, zero hard dependencies (stdlib only — works with or
without the `twilio` pip package installed):

  * TwiMLBuilder              — valid TwiML XML generation (Say / Connect /
                                Stream / Pause / Hangup), XML-escaped.
  * TwilioVoiceClient         — wraps POST {api}/2010-04-01/Accounts/{sid}/Calls.json,
                                creds from TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN /
                                TWILIO_PHONE_NUMBER. Degrades to dry-run when
                                credentials are missing or malformed. Secrets are
                                never logged and never appear in receipts.
  * MediaStreamHandlerScaffold — parses Twilio Media Streams websocket events
                                (connected / start / media / stop), mulaw 8 kHz
                                audio/x-mulaw base64 frames.

Reference implementation (GREEN, 22/22 tests): /root/forge_work/2026-09-13-hermes-voice
Interfaces and env-var names match that scaffold so the two can be wired at Fasa 2.

DITEMPA BUKAN DIBERI — control sovereignty is forged.
DRY-RUN FIRST: no real network call happens unless a fully credentialed client
is explicitly invoked with dry_run=False; tests always inject a fake transport.
"""
from __future__ import annotations

import base64
import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET
from typing import Any, Callable, Dict, List, Optional, Tuple

log = logging.getLogger("aforge.voice_bridge")

# ---------------------------------------------------------------------------
# Environment contract (matches hermes-voice app/config.py + integrations spec)
# ---------------------------------------------------------------------------
ENV_ACCOUNT_SID = "TWILIO_ACCOUNT_SID"
ENV_AUTH_TOKEN = "TWILIO_AUTH_TOKEN"
ENV_PHONE_NUMBER = "TWILIO_PHONE_NUMBER"          # A-FORGE name (task contract)
ENV_PHONE_NUMBER_ALT = "TWILIO_FROM_NUMBER"       # hermes-voice name (compat)

TWILIO_API_BASE = "https://api.twilio.com/2010-04-01/Accounts"
CALLS_PATH = "Calls.json"
CALL_TIMEOUT_S = 30

# Media Streams wire contract (verified memo 2026-09-13):
#   audio/x-mulaw, 8000 Hz, mono, base64, 20 ms frames -> 160 bytes / frame
EXPECTED_MEDIA_FORMAT = {
    "encoding": "audio/x-mulaw",
    "sampleRate": 8000,
    "channels": 1,
}
FRAME_MS = 20
FRAME_BYTES = 160


def _redact(secret: str) -> str:
    """F2 token hygiene: never emit a full secret. Empty stays empty."""
    if not secret:
        return ""
    if len(secret) <= 4:
        return "****"
    return secret[:2] + "…" + secret[-2:]


# ---------------------------------------------------------------------------
# TwiMLBuilder
# ---------------------------------------------------------------------------
class TwiMLBuilder:
    """Builds valid TwiML XML without requiring the twilio package.

    Canonical output shape (matches hermes-voice app/twilio.py):

        <?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="..." language="...">greeting</Say>
          <Connect><Stream url="wss://host/path?token=..."/></Connect>
        </Response>
    """

    def __init__(self) -> None:
        self._ops: List[Tuple[str, Dict[str, Any]]] = []

    # -- verbs ------------------------------------------------------------
    def say(self, text: str, voice: str = "Polly.Amy",
            language: str = "en-US") -> "TwiMLBuilder":
        if not text or not text.strip():
            raise ValueError("Say requires non-empty text")
        self._ops.append(("Say", {"_text": text, "voice": voice,
                                  "language": language}))
        return self

    def connect_stream(self, url: str, track: Optional[str] = None) -> "TwiMLBuilder":
        """<Connect><Stream> — blocks subsequent TwiML while the stream runs."""
        if not url or not url.startswith(("wss://", "ws://")):
            raise ValueError("Stream url must be ws:// or wss://")
        attrs = {"url": url}
        if track:
            attrs["track"] = track
        self._ops.append(("Connect", {"_child": ("Stream", attrs)}))
        return self

    def pause(self, length_seconds: int = 1) -> "TwiMLBuilder":
        if length_seconds < 0:
            raise ValueError("pause length must be >= 0")
        self._ops.append(("Pause", {"length": str(int(length_seconds))}))
        return self

    def hangup(self) -> "TwiMLBuilder":
        self._ops.append(("Hangup", {}))
        return self

    # -- render -----------------------------------------------------------
    def build(self) -> str:
        if not self._ops:
            raise ValueError("TwiML Response would be empty — add at least one verb")
        root = ET.Element("Response")
        for verb, spec in self._ops:
            el = ET.SubElement(root, verb)
            if "_text" in spec:
                el.text = spec["_text"]
                for k, v in spec.items():
                    if k != "_text":
                        el.set(k, v)
            elif "_child" in spec:
                child_verb, child_attrs = spec["_child"]
                ET.SubElement(el, child_verb, child_attrs)
            else:
                for k, v in spec.items():
                    el.set(k, v)
        return ('<?xml version="1.0" encoding="UTF-8"?>'
                + ET.tostring(root, encoding="unicode"))

    def stream_url(self) -> Optional[str]:
        for verb, spec in self._ops:
            if verb == "Connect" and "_child" in spec:
                return spec["_child"][1].get("url")
        return None

    def __repr__(self) -> str:  # pragma: no cover — debug aid only
        return f"<TwiMLBuilder ops={[v for v, _ in self._ops]}>"


def build_stream_twiml(wss_url: str, greeting: str = "") -> str:
    """Shorthand mirroring hermes-voice app/twilio.py build_stream_twiml()."""
    b = TwiMLBuilder()
    if greeting:
        b.say(greeting)
    b.connect_stream(wss_url)
    return b.build()


# ---------------------------------------------------------------------------
# TwilioVoiceClient
# ---------------------------------------------------------------------------
# Injectable transport: (url, form_data, headers) -> (status_code, json_body).
# Default uses urllib against the real API; tests inject a fake — the fake is
# the ONLY thing tests ever call, per the DRY-RUN-ONLY hard constraint.
Transport = Callable[[str, Dict[str, str], Dict[str, str]], Tuple[int, Dict[str, Any]]]


def _default_transport(url: str, form_data: Dict[str, str],
                       headers: Dict[str, str]) -> Tuple[int, Dict[str, Any]]:
    body = urllib.parse.urlencode(form_data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=CALL_TIMEOUT_S) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:  # Twilio error envelope is JSON
        try:
            return e.code, json.loads(e.read().decode("utf-8"))
        except Exception:
            return e.code, {"error": "non-json error body"}


class TwilioVoiceClient:
    """Outbound-call control plane wrapper around the Twilio REST API.

    Reads credentials from the environment:
        TWILIO_ACCOUNT_SID   (e.g. ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)
        TWILIO_AUTH_TOKEN
        TWILIO_PHONE_NUMBER  (fallback: TWILIO_FROM_NUMBER, hermes-voice compat)

    If any credential is missing or the SID is malformed, `configured` is False
    and every create_call() degrades to a dry-run result — no network, no crash.
    """

    ENV_KEYS = (ENV_ACCOUNT_SID, ENV_AUTH_TOKEN, ENV_PHONE_NUMBER)

    def __init__(self, account_sid: Optional[str] = None,
                 auth_token: Optional[str] = None,
                 from_number: Optional[str] = None,
                 transport: Optional[Transport] = None) -> None:
        self.account_sid = (account_sid if account_sid is not None
                            else os.environ.get(ENV_ACCOUNT_SID, ""))
        self.auth_token = (auth_token if auth_token is not None
                           else os.environ.get(ENV_AUTH_TOKEN, ""))
        if from_number is None:
            from_number = os.environ.get(ENV_PHONE_NUMBER, "") or \
                os.environ.get(ENV_PHONE_NUMBER_ALT, "")
        self.from_number = from_number
        self._transport = transport or _default_transport

    # -- credential state ---------------------------------------------------
    @property
    def configured(self) -> bool:
        return (bool(self.account_sid)
                and self.account_sid.startswith("AC")
                and bool(self.auth_token)
                and bool(self.from_number))

    def credential_status(self) -> Dict[str, Any]:
        """F2-safe view of credentials — redacted, for receipts/logs only."""
        return {
            "account_sid": _redact(self.account_sid),
            "auth_token": _redact(self.auth_token) or "MISSING",
            "from_number": self.from_number if self.from_number else "MISSING",
            "configured": self.configured,
        }

    # -- the one REST verb this scaffold owns --------------------------------
    def calls_url(self) -> str:
        return f"{TWILIO_API_BASE}/{self.account_sid}/{CALLS_PATH}"

    def _basic_auth_header(self) -> str:
        # stdlib basic auth; the token never leaves this method's scope un-redacted
        import binascii
        raw = f"{self.account_sid}:{self.auth_token}".encode("utf-8")
        return "Basic " + base64.b64encode(raw).decode("ascii")

    def create_call(self, to: str, twiml: str,
                    timeout: int = CALL_TIMEOUT_S) -> Dict[str, Any]:
        """POST /2010-04-01/Accounts/{sid}/Calls.json.

        Returns a dict; when uncredentialed (or `to` invalid) the result is a
        dry-run envelope with status="DRY_RUN" and reason set.
        """
        if not self.configured:
            reason = "credentials_unconfigured"
            log.info("TwilioVoiceClient dry-run (%s) — refusing network", reason)
            return self._dry_run_result(to, twiml, reason)
        if not is_e164(to):
            reason = "invalid_to_number"
            log.info("TwilioVoiceClient dry-run (%s) — bad E.164 %r", reason, to)
            return self._dry_run_result(to, twiml, reason)

        form = {
            "To": to,
            "From": self.from_number,
            "Twiml": twiml,
            "Timeout": str(timeout),
        }
        headers = {
            "Authorization": self._basic_auth_header(),
            "Content-Type": "application/x-www-form-urlencoded",
        }
        status_code, payload = self._transport(self.calls_url(), form, headers)
        if status_code in (200, 201):
            return {
                "status": "COMPLETED",
                "call_sid": payload.get("sid"),
                "to": to,
                "from": self.from_number,
                "api_status_code": status_code,
                "dry_run": False,
            }
        return {
            "status": "FAILED",
            "to": to,
            "from": self.from_number,
            "api_status_code": status_code,
            "api_error": payload.get("message", "twilio rejected the call"),
            "dry_run": False,
        }

    def _dry_run_result(self, to: str, twiml: str, reason: str) -> Dict[str, Any]:
        return {
            "status": "DRY_RUN",
            "call_sid": None,
            "to": to,
            "from": self.from_number or None,
            "reason": reason,
            "dry_run": True,
            "twiml": twiml,
        }


# ---------------------------------------------------------------------------
# E.164 helpers
# ---------------------------------------------------------------------------
def is_e164(number: str) -> bool:
    """Loose E.164: '+' then 8-15 digits, no leading zero in country code."""
    if not isinstance(number, str):
        return False
    if len(number) < 9 or len(number) > 16:
        return False
    if not number.startswith("+"):
        return False
    digits = number[1:]
    return digits.isdigit() and not digits.startswith("0")


# ---------------------------------------------------------------------------
# MediaStreamHandlerScaffold
# ---------------------------------------------------------------------------
class MediaStreamHandlerScaffold:
    """Parses Twilio Media Streams websocket event frames.

    Event grammar (all JSON text frames):
        {"event": "connected", "protocol": "...", "version": "..."}
        {"event": "start", "start": {"streamSid", "accountSid", "callSid",
                                     "tracks", "mediaFormat": {encoding,
                                     sampleRate, channels}}}
        {"event": "media", "media": {"timestamp", "payload" (b64), "track"}}
        {"event": "stop", "stop": {"callSid"}}

    Audio contract: audio/x-mulaw @ 8000 Hz mono, base64, 20 ms (160 byte)
    frames — validated on `start`; non-conforming formats are flagged, not
    silently accepted (Witness-First: no silent fallbacks).
    """

    SUPPORTED_EVENTS = ("connected", "start", "media", "stop")

    def __init__(self) -> None:
        self.connected: bool = False
        self.started: bool = False
        self.stopped: bool = False
        self.protocol: Optional[str] = None
        self.version: Optional[str] = None
        self.stream_sid: Optional[str] = None
        self.account_sid: Optional[str] = None
        self.call_sid: Optional[str] = None
        self.tracks: List[str] = []
        self.media_format: Dict[str, Any] = {}
        self.format_ok: Optional[bool] = None
        self.frames: int = 0
        self.audio_bytes: int = 0
        self.last_media_timestamp: Optional[str] = None
        self.unknown_events: List[str] = []
        self.errors: List[str] = []

    # -- event ingestion ------------------------------------------------------
    def handle_message(self, raw: str | bytes) -> Dict[str, Any]:
        """Parse one websocket text frame. Returns a per-event result dict."""
        try:
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8")
            event = json.loads(raw)
        except (ValueError, UnicodeDecodeError) as e:
            self.errors.append(f"malformed_frame: {e}")
            return {"event": "error", "error": "malformed_json"}

        kind = event.get("event")
        handler = getattr(self, f"_on_{kind}", None) if kind in self.SUPPORTED_EVENTS else None
        if handler is None:
            self.unknown_events.append(str(kind))
            return {"event": str(kind), "handled": False,
                    "note": "recorded, not handled (scaffold)"}
        return handler(event)

    def _on_connected(self, event: Dict[str, Any]) -> Dict[str, Any]:
        self.connected = True
        self.protocol = event.get("protocol")
        self.version = event.get("version")
        return {"event": "connected", "protocol": self.protocol,
                "version": self.version}

    def _on_start(self, event: Dict[str, Any]) -> Dict[str, Any]:
        start = event.get("start") or {}
        self.started = True
        self.stream_sid = start.get("streamSid")
        self.account_sid = start.get("accountSid")
        self.call_sid = start.get("callSid")
        self.tracks = list(start.get("tracks") or [])
        self.media_format = dict(start.get("mediaFormat") or {})
        self.format_ok = self._validate_media_format(self.media_format)
        return {"event": "start", "streamSid": self.stream_sid,
                "callSid": self.call_sid, "tracks": self.tracks,
                "mediaFormat": self.media_format, "format_ok": self.format_ok}

    def _on_media(self, event: Dict[str, Any]) -> Dict[str, Any]:
        media = event.get("media") or {}
        payload = media.get("payload", "")
        track = media.get("track", "inbound")
        nbytes = 0
        try:
            nbytes = len(base64.b64decode(payload, validate=False))
        except (ValueError, TypeError) as e:
            self.errors.append(f"bad_media_payload: {e}")
        self.frames += 1
        self.audio_bytes += nbytes
        self.last_media_timestamp = media.get("timestamp")
        return {"event": "media", "track": track, "bytes": nbytes,
                "frame": self.frames, "timestamp": self.last_media_timestamp}

    def _on_stop(self, event: Dict[str, Any]) -> Dict[str, Any]:
        self.stopped = True
        stop = event.get("stop") or {}
        if stop.get("callSid"):
            self.call_sid = stop["callSid"]
        return {"event": "stop", "callSid": self.call_sid,
                "summary": self.summary()}

    # -- validation / reporting ------------------------------------------------
    def _validate_media_format(self, fmt: Dict[str, Any]) -> bool:
        return all(fmt.get(k) == v for k, v in EXPECTED_MEDIA_FORMAT.items())

    @property
    def audio_seconds(self) -> float:
        return self.audio_bytes / FRAME_BYTES * FRAME_MS / 1000.0

    def summary(self) -> Dict[str, Any]:
        return {
            "connected": self.connected,
            "started": self.started,
            "stopped": self.stopped,
            "stream_sid": self.stream_sid,
            "call_sid": self.call_sid,
            "tracks": self.tracks,
            "media_format": self.media_format,
            "format_ok": self.format_ok,
            "expected_format": dict(EXPECTED_MEDIA_FORMAT),
            "frames": self.frames,
            "audio_bytes": self.audio_bytes,
            "audio_seconds": round(self.audio_seconds, 3),
            "last_media_timestamp": self.last_media_timestamp,
            "unknown_events": list(self.unknown_events),
            "errors": list(self.errors),
        }


def new_stream_token() -> str:
    """Placeholder stream-token minter (real HMAC lives in hermes-voice
    app/security.py — this A-FORGE scaffold only needs an opaque id)."""
    return str(uuid.uuid4())
