"""Tests for the A-FORGE voice bridge scaffold + forge_phone_call tool.

HARD CONSTRAINT (dry-run only): no test here ever performs a real network
call to Twilio. Credentialed-mode tests use a FAKE transport injected into
TwilioVoiceClient plus DUMMY env vars / constructor creds. No real secrets
are read; nothing secret is ever printed.
"""
from __future__ import annotations

import json
import os
import sys
import unittest
import urllib.parse
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path

FORGE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(FORGE_ROOT))

from bridges.voice_bridge import (  # noqa: E402
    EXPECTED_MEDIA_FORMAT,
    MediaStreamHandlerScaffold,
    TwilioVoiceClient,
    TwiMLBuilder,
    build_stream_twiml,
    is_e164,
)


def _load_voice_calling_pkg():
    """Load the hyphenated skills/voice-calling package (not a valid Python
    identifier, so it cannot be imported normally)."""
    import importlib.util
    pkg_dir = FORGE_ROOT / "skills" / "voice-calling"
    spec = importlib.util.spec_from_file_location(
        "voice_calling", pkg_dir / "__init__.py",
        submodule_search_locations=[str(pkg_dir)])
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["voice_calling"] = mod
    spec.loader.exec_module(mod)
    return mod


_voice_calling = _load_voice_calling_pkg()
fpc = _voice_calling  # the package module: fpc.forge_phone_call, fpc.main, ...
check_calendar_conflicts = _voice_calling.check_calendar_conflicts
F7_CONFIDENCE_CAP = _voice_calling.F7_CONFIDENCE_CAP
ALLOWED_USE_CASES = _voice_calling.ALLOWED_USE_CASES

# Dummy credentials — NEVER real. Classic Twilio test-shaped values.
DUMMY_SID = "AC" + "1" * 32
DUMMY_TOKEN = "dummy-auth-token-not-real"
DUMMY_FROM = "+15550001234"
TO_NUMBER = "+60312345678"

FAKE_GREETING_WSS = "wss://voice.test.local/internal/call_test/media?token=abc"


def make_fake_transport(calls: list, response: tuple[int, dict] = (201, {"sid": "CAtest123"})):
    """Return a transport fn that records invocations and replays `response`."""
    def _transport(url: str, form_data: dict, headers: dict) -> tuple[int, dict]:
        calls.append({"url": url, "form": dict(form_data), "headers": dict(headers)})
        return response
    return _transport


class TwiMLBuilderTests(unittest.TestCase):
    """TwiML output format."""

    def test_say_connect_stream_shape(self):
        xml = (TwiMLBuilder()
               .say("Hello")
               .connect_stream(FAKE_GREETING_WSS)
               .build())
        self.assertTrue(xml.startswith('<?xml version="1.0" encoding="UTF-8"?>'))
        root = ET.fromstring(xml)  # must parse as valid XML
        self.assertEqual(root.tag, "Response")
        self.assertEqual(root[0].tag, "Say")
        self.assertEqual(root[0].text, "Hello")
        self.assertEqual(root[1].tag, "Connect")
        self.assertEqual(root[1][0].tag, "Stream")
        self.assertEqual(root[1][0].get("url"), FAKE_GREETING_WSS)

    def test_shorthand_matches_reference_shape(self):
        # hermes-voice app/twilio.py reference shape: Response>Connect>Stream
        xml = build_stream_twiml(FAKE_GREETING_WSS)
        root = ET.fromstring(xml)
        self.assertEqual(root.tag, "Response")
        self.assertEqual(root[0].tag, "Connect")
        self.assertEqual(root[0][0].tag, "Stream")
        self.assertIn("url=", xml)

    def test_xml_escapes_text(self):
        xml = TwiMLBuilder().say('Book "slot" & confirm <now>').build()
        root = ET.fromstring(xml)
        self.assertIn("&amp;", xml)
        self.assertNotIn("<now>", xml)
        self.assertEqual(root[0].text, 'Book "slot" & confirm <now>')

    def test_validation_errors(self):
        with self.assertRaises(ValueError):
            TwiMLBuilder().say("")  # empty text
        with self.assertRaises(ValueError):
            TwiMLBuilder().connect_stream("https://not-ws.example")  # not ws(s)
        with self.assertRaises(ValueError):
            TwiMLBuilder().build()  # empty response

    def test_extra_verbs(self):
        xml = (TwiMLBuilder().say("Bye").pause(1).hangup().build())
        root = ET.fromstring(xml)
        self.assertEqual([c.tag for c in root], ["Say", "Pause", "Hangup"])
        self.assertEqual(root[1].get("length"), "1")


class E164Tests(unittest.TestCase):
    def test_valid(self):
        for n in ("+60123456789", "+15551234567", "+442071234567"):
            self.assertTrue(is_e164(n), n)

    def test_invalid(self):
        for n in ("60123456789", "+0123456789", "+1234", "+abc", "", "+8", "tel:+6012"):
            self.assertFalse(is_e164(n), n)


class TwilioVoiceClientTests(unittest.TestCase):
    """Mocked-credentialed and uncredentialed dry-run."""

    def test_uncredentialed_env_degrades_to_dry_run(self):
        # Scrub env of any real creds (never read them).
        saved = {k: os.environ.pop(k, None) for k in TwilioVoiceClient.ENV_KEYS}
        os.environ.pop("TWILIO_FROM_NUMBER", None)
        try:
            cli = TwilioVoiceClient()
            self.assertFalse(cli.configured)
            result = cli.create_call(TO_NUMBER, build_stream_twiml(FAKE_GREETING_WSS))
            self.assertEqual(result["status"], "DRY_RUN")
            self.assertTrue(result["dry_run"])
            self.assertIsNone(result["call_sid"])
            self.assertIn("reason", result)
        finally:
            for k, v in saved.items():
                if v is not None:
                    os.environ[k] = v

    def test_credentialed_mocked_transport_completes(self):
        calls: list = []
        cli = TwilioVoiceClient(
            account_sid=DUMMY_SID, auth_token=DUMMY_TOKEN,
            from_number=DUMMY_FROM,
            transport=make_fake_transport(calls, (201, {"sid": "CAtest123"})))
        self.assertTrue(cli.configured)
        twiml = build_stream_twiml(FAKE_GREETING_WSS)
        result = cli.create_call(TO_NUMBER, twiml)

        self.assertEqual(result["status"], "COMPLETED")
        self.assertEqual(result["call_sid"], "CAtest123")
        self.assertFalse(result["dry_run"])
        # The REST call hit the canonical Calls.json endpoint...
        self.assertEqual(len(calls), 1)
        self.assertTrue(calls[0]["url"].endswith(
            f"/2010-04-01/Accounts/{DUMMY_SID}/Calls.json"))
        self.assertTrue(calls[0]["url"].startswith("https://api.twilio.com/"))
        # ...with the right form payload and no secrets in the body.
        form = calls[0]["form"]
        self.assertEqual(form["To"], TO_NUMBER)
        self.assertEqual(form["From"], DUMMY_FROM)
        self.assertIn("<Response>", form["Twiml"])
        self.assertNotIn(DUMMY_TOKEN, json.dumps(form))
        # Basic auth header present but token only in encoded form.
        self.assertTrue(calls[0]["headers"]["Authorization"].startswith("Basic "))
        self.assertNotIn(DUMMY_TOKEN, calls[0]["headers"]["Authorization"])

    def test_credentialed_api_error_fails_cleanly(self):
        cli = TwilioVoiceClient(
            account_sid=DUMMY_SID, auth_token=DUMMY_TOKEN,
            from_number=DUMMY_FROM,
            transport=make_fake_transport([], (400, {"message": "bad number"})))
        result = cli.create_call(TO_NUMBER, "<Response/>")
        self.assertEqual(result["status"], "FAILED")
        self.assertEqual(result["api_error"], "bad number")
        self.assertFalse(result["dry_run"])

    def test_credentialed_but_bad_to_degrades_to_dry_run(self):
        cli = TwilioVoiceClient(
            account_sid=DUMMY_SID, auth_token=DUMMY_TOKEN, from_number=DUMMY_FROM,
            transport=make_fake_transport([]))  # transport must NOT be hit
        result = cli.create_call("12345", "<Response/>")
        self.assertEqual(result["status"], "DRY_RUN")
        self.assertEqual(result["reason"], "invalid_to_number")

    def test_malformed_sid_is_unconfigured(self):
        cli = TwilioVoiceClient(account_sid="XXnotasid", auth_token="t",
                                from_number="+15550000000")
        self.assertFalse(cli.configured)

    def test_credential_status_never_leaks_secrets(self):
        cli = TwilioVoiceClient(account_sid=DUMMY_SID, auth_token=DUMMY_TOKEN,
                                from_number=DUMMY_FROM)
        view = json.dumps(cli.credential_status())
        self.assertNotIn(DUMMY_TOKEN, view)
        self.assertNotIn(DUMMY_SID, view)  # SID only in redacted form
        self.assertNotIn('"account_sid": "' + DUMMY_SID + '"', view)

    def test_env_fallback_twilio_from_number(self):
        saved_a = os.environ.pop("TWILIO_PHONE_NUMBER", None)
        saved_b = os.environ.pop("TWILIO_FROM_NUMBER", None)
        try:
            os.environ["TWILIO_FROM_NUMBER"] = DUMMY_FROM
            cli = TwilioVoiceClient(account_sid=DUMMY_SID,
                                    auth_token=DUMMY_TOKEN)
            self.assertEqual(cli.from_number, DUMMY_FROM)
        finally:
            if saved_a is not None:
                os.environ["TWILIO_PHONE_NUMBER"] = saved_a
            os.environ.pop("TWILIO_FROM_NUMBER", None)
            if saved_b is not None:
                os.environ["TWILIO_FROM_NUMBER"] = saved_b


class MediaStreamHandlerTests(unittest.TestCase):
    """WebSocket event parsing (mulaw 8kHz)."""

    def test_full_event_lifecycle(self):
        h = MediaStreamHandlerScaffold()
        r = h.handle_message(json.dumps(
            {"event": "connected", "protocol": "Call", "version": "1.0.0"}))
        self.assertEqual(r["event"], "connected")
        self.assertTrue(h.connected)

        start = {
            "event": "start",
            "start": {
                "streamSid": "MZxxxxxxxx", "accountSid": DUMMY_SID,
                "callSid": "CAtest123", "tracks": ["inbound"],
                "mediaFormat": {"encoding": "audio/x-mulaw", "sampleRate": 8000,
                                "channels": 1},
            },
        }
        r = h.handle_message(json.dumps(start))
        self.assertEqual(r["streamSid"], "MZxxxxxxxx")
        self.assertTrue(h.format_ok)  # mulaw 8k mono recognised

        # 20ms frame = 160 bytes -> base64 of 160 zero bytes
        import base64
        payload = base64.b64encode(b"\x00" * 160).decode()
        r = h.handle_message(json.dumps(
            {"event": "media",
             "media": {"timestamp": "1000", "payload": payload,
                       "track": "inbound"}}))
        self.assertEqual(r["bytes"], 160)
        r = h.handle_message(json.dumps(
            {"event": "media",
             "media": {"timestamp": "1020", "payload": payload}}))
        self.assertEqual(h.frames, 2)
        self.assertAlmostEqual(h.audio_seconds, 0.04, places=6)

        r = h.handle_message(json.dumps(
            {"event": "stop", "stop": {"callSid": "CAtest123"}}))
        self.assertTrue(h.stopped)
        self.assertEqual(r["summary"]["frames"], 2)

    def test_wrong_media_format_flagged_not_swallowed(self):
        h = MediaStreamHandlerScaffold()
        h.handle_message(json.dumps({
            "event": "start",
            "start": {"streamSid": "s", "mediaFormat":
                      {"encoding": "audio/x-raw", "sampleRate": 16000,
                       "channels": 1}}}))
        self.assertFalse(h.format_ok)  # Witness-First: flag, don't accept
        self.assertNotEqual(h.media_format["encoding"],
                            EXPECTED_MEDIA_FORMAT["encoding"])

    def test_malformed_and_unknown_events(self):
        h = MediaStreamHandlerScaffold()
        r = h.handle_message("not json {{{")
        self.assertEqual(r["event"], "error")
        r = h.handle_message(json.dumps({"event": "mark"}))
        self.assertFalse(r["handled"])
        self.assertEqual(h.unknown_events, ["mark"])
        self.assertEqual(h.errors[0].startswith("malformed_frame"), True)


class CalendarCheckTests(unittest.TestCase):
    def test_no_target_not_checked(self):
        r = check_calendar_conflicts(None, [])
        self.assertFalse(r["checked"])
        self.assertFalse(r["has_conflict"])

    def test_conflict_within_window(self):
        events = [{"title": "physio", "start": "2026-09-15T14:30:00+08:00"}]
        r = check_calendar_conflicts("2026-09-15T14:00:00+08:00", events,
                                     window_minutes=60)
        self.assertTrue(r["checked"])
        self.assertTrue(r["has_conflict"])
        self.assertEqual(r["conflicts"][0]["event"], "physio")

    def test_no_conflict_outside_window(self):
        events = [{"title": "physio", "start": "2026-09-15T18:00:00+08:00"}]
        r = check_calendar_conflicts("2026-09-15T14:00:00+08:00", events,
                                     window_minutes=60)
        self.assertTrue(r["checked"])
        self.assertFalse(r["has_conflict"])

    def test_bad_target_reports_error_without_crashing(self):
        r = check_calendar_conflicts("not-a-date", [])
        self.assertFalse(r["checked"])
        self.assertIn("error", r)


class ForgePhoneCallReceiptTests(unittest.TestCase):
    """Receipt schema integrity + both use cases + governance blocks."""

    REQUIRED_TOP = {"receipt_id", "timestamp", "status", "call_details",
                    "f_gates", "evidence"}
    REQUIRED_GATES = {"F1_SNAPSHOT", "F2_LABEL", "F7_CONFIDENCE",
                      "F11_TRACE", "F13_SOVEREIGN"}

    def _clean_env(self):
        saved = {k: os.environ.pop(k, None) for k in TwilioVoiceClient.ENV_KEYS}
        saved["TWILIO_FROM_NUMBER"] = os.environ.pop("TWILIO_FROM_NUMBER", None)
        return saved

    def _restore(self, saved):
        for k, v in saved.items():
            if v is not None:
                os.environ[k] = v

    def assert_valid_receipt(self, r, expected_status=None):
        self.assertTrue(self.REQUIRED_TOP.issubset(r.keys()), r.keys())
        self.assertTrue(r["receipt_id"].startswith("call_"))
        self.assertIn("T", r["timestamp"])  # ISO-8601-ish
        if expected_status:
            self.assertEqual(r["status"], expected_status)
        self.assertEqual(set(r["f_gates"].keys()), self.REQUIRED_GATES)
        # F2 epistemic label
        self.assertIn(r["f_gates"]["F2_LABEL"]["label"],
                      {"OBS", "DER", "INT", "SPEC"})
        # F7 capped
        self.assertLessEqual(r["f_gates"]["F7_CONFIDENCE"]["confidence"],
                             F7_CONFIDENCE_CAP)
        self.assertEqual(r["f_gates"]["F7_CONFIDENCE"]["cap"],
                         F7_CONFIDENCE_CAP)
        # F11 trace is a UUID
        uuid.UUID(r["f_gates"]["F11_TRACE"]["trace_id"])
        # F13 sovereign gate present with authority info
        f13 = r["f_gates"]["F13_SOVEREIGN"]
        self.assertEqual(f13["sovereign"], "ARIF")
        self.assertIn("live_dial_permitted", f13)
        # JSON-serialisable end to end
        json.dumps(r)

    def test_booking_dry_run_default_uncredentialed(self):
        saved = self._clean_env()
        try:
            r = forge = fpc.forge_phone_call(
                to=TO_NUMBER, intent="Book physio slot",
                use_case="booking",
                calendar_target="2026-09-15T14:00:00+08:00",
                calendar_events=[{"title": "physio",
                                  "start": "2026-09-15T14:30:00+08:00"}])
            self.assert_valid_receipt(r, expected_status="DRY_RUN")
            self.assertTrue(r["call_details"]["dry_run"])
            self.assertEqual(r["evidence"]["calendar_check"]["has_conflict"], True)
            self.assertIn("<Connect><Stream", r["evidence"]["twiml"])
            self.assertIn("AI system", r["evidence"]["twiml"])  # identity disclosure
        finally:
            self._restore(saved)

    def test_bank_hybrid_use_case(self):
        saved = self._clean_env()
        try:
            r = fpc.forge_phone_call(
                to=TO_NUMBER, intent="Reset online banking access",
                use_case="bank_hybrid", calendar_check=False)
            self.assert_valid_receipt(r, expected_status="DRY_RUN")
            self.assertEqual(r["evidence"]["use_case"], "bank_hybrid")
            self.assertFalse(r["evidence"]["calendar_check"]["checked"])
        finally:
            self._restore(saved)

    def test_invalid_use_case_fails(self):
        r = fpc.forge_phone_call(to=TO_NUMBER, intent="x", use_case="spam")
        self.assert_valid_receipt(r, expected_status="FAILED")
        self.assertIn("use_case", r["evidence"]["failure_reason"])

    def test_invalid_to_fails(self):
        r = fpc.forge_phone_call(to="12345", intent="x")
        self.assert_valid_receipt(r, expected_status="FAILED")
        self.assertIn("E.164", r["evidence"]["failure_reason"])

    def test_empty_intent_fails(self):
        r = fpc.forge_phone_call(to=TO_NUMBER, intent="   ")
        self.assert_valid_receipt(r, expected_status="FAILED")

    def test_f7_confidence_capped_at_090(self):
        saved = self._clean_env()
        try:
            r = fpc.forge_phone_call(to=TO_NUMBER, intent="x",
                                     confidence=0.99)
            f7 = r["f_gates"]["F7_CONFIDENCE"]
            self.assertEqual(f7["confidence"], 0.9)
            self.assertEqual(f7["capped_from_raw"], 0.99)
        finally:
            self._restore(saved)

    def test_f1_snapshot_redacts_credentials(self):
        saved = self._clean_env()
        try:
            cli = TwilioVoiceClient(account_sid=DUMMY_SID, auth_token=DUMMY_TOKEN,
                                    from_number=DUMMY_FROM)
            r = fpc.forge_phone_call(to=TO_NUMBER, intent="x", client=cli,
                                     dry_run=True)
            blob = json.dumps(r)
            self.assertNotIn(DUMMY_TOKEN, blob)      # no secret in receipt
            self.assertNotIn(DUMMY_SID, blob)        # SID only redacted form
        finally:
            self._restore(saved)

    def test_dry_run_false_still_dry_runs_when_f13_gate_closed(self):
        # Even with creds + dry_run=False explicitly, no sovereign token
        # means the F13 gate forces dry-run. Transport never invoked.
        calls: list = []
        cli = TwilioVoiceClient(
            account_sid=DUMMY_SID, auth_token=DUMMY_TOKEN, from_number=DUMMY_FROM,
            transport=make_fake_transport(calls))
        r = fpc.forge_phone_call(to=TO_NUMBER, intent="x", client=cli,
                                 dry_run=False)
        self.assertEqual(r["status"], "DRY_RUN")
        self.assertEqual(r["call_details"]["reason"], "f13_sovereign_gate_closed")
        self.assertEqual(len(calls), 0)
        self.assertEqual(r["f_gates"]["F13_SOVEREIGN"]["gate"], "888_HOLD")

    def test_live_lane_with_sovereign_token_mocked_transport(self):
        # Full authority: creds + dry_run=False + sovereign token -> the
        # mocked transport fires exactly once (never the real network).
        calls: list = []
        cli = TwilioVoiceClient(
            account_sid=DUMMY_SID, auth_token=DUMMY_TOKEN, from_number=DUMMY_FROM,
            transport=make_fake_transport(calls, (201, {"sid": "CAlive99"})))
        r = fpc.forge_phone_call(to=TO_NUMBER, intent="Book table",
                                 use_case="booking",
                                 client=cli, dry_run=False,
                                 sovereign_token="sovereign-test-token")
        self.assert_valid_receipt(r, expected_status="COMPLETED")
        self.assertEqual(r["call_details"]["call_sid"], "CAlive99")
        self.assertEqual(len(calls), 1)
        self.assertTrue(r["f_gates"]["F13_SOVEREIGN"]["live_dial_permitted"])

    def test_calendar_check_disabled_by_flag(self):
        saved = self._clean_env()
        try:
            r = fpc.forge_phone_call(to=TO_NUMBER, intent="x",
                                     calendar_check=False)
            cal = r["evidence"]["calendar_check"]
            self.assertFalse(cal["checked"])
            self.assertIn("disabled", cal["note"])
        finally:
            self._restore(saved)

    def test_receipt_json_roundtrip(self):
        saved = self._clean_env()
        try:
            r = fpc.forge_phone_call(to=TO_NUMBER, intent="roundtrip")
            blob = json.dumps(r)
            r2 = json.loads(blob)
            self.assertEqual(r2["receipt_id"], r["receipt_id"])
            self.assertEqual(r2["status"], "DRY_RUN")
        finally:
            self._restore(saved)


class CLITests(unittest.TestCase):
    def test_cli_dry_run_prints_valid_json_receipt(self):
        import contextlib, io
        saved = {k: os.environ.pop(k, None) for k in TwilioVoiceClient.ENV_KEYS}
        os.environ.pop("TWILIO_FROM_NUMBER", None)
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf):
                rc = fpc.main(["--to", TO_NUMBER, "--intent", "CLI self test",
                               "--dry-run", "--json-only"])
            self.assertEqual(rc, 0)
            receipt = json.loads(buf.getvalue())
            self.assertEqual(receipt["status"], "DRY_RUN")
            self.assertIn("f_gates", receipt)
        finally:
            for k, v in saved.items():
                if v is not None:
                    os.environ[k] = v


if __name__ == "__main__":
    unittest.main()
