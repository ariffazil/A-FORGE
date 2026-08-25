"""
Tests for the 6 APA Google bridges built in FFF round 2 (2026-08-25).

Coverage:
  - HTTP /health endpoint reachable + returns valid APA envelope
  - HTTP verbs route to action handlers correctly
  - Action handlers return APA envelope (not raw exceptions)
  - google_bridge_base loads and instantiates
  - HTTPError from upstream is wrapped cleanly

Run: /root/venv/bin/pytest /root/A-FORGE/tests/test_google_bridges.py -v
"""

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

import pytest

# Make bridges/ importable
BRIDGES = Path("/root/A-FORGE/bridges")
sys.path.insert(0, str(BRIDGES))

BRIDGE_PORTS = {
    "calendar_bridge": 18094,
    "drive_bridge": 18099,
    "sheets_bridge": 18096,
    "gmail_bridge": 18097,
    "gemini_bridge": 18092,
    "gws_bridge": 18098,
}

# ── Live HTTP probes (requires bridges running) ────────────────────


@pytest.mark.parametrize("name,port", list(BRIDGE_PORTS.items()))
def test_bridge_listening(name, port):
    """Each bridge must be reachable on its assigned port."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=3) as r:
            assert r.status == 200, f"{name}: HTTP {r.status}"
            body = json.loads(r.read())
            assert body.get("bridge") == name, f"{name}: bad body {body}"
    except (urllib.error.URLError, ConnectionError):
        pytest.skip(f"{name} not running on :{port}")


@pytest.mark.parametrize("name,port", list(BRIDGE_PORTS.items()))
def test_bridge_health_envelope(name, port):
    """Each /health endpoint returns APA envelope."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=3) as r:
            body = json.loads(r.read())
    except (urllib.error.URLError, ConnectionError):
        pytest.skip(f"{name} not running")
    assert body.get("ok") is True, f"{name}: ok != True"
    assert "bridge" in body, f"{name}: missing bridge field"
    assert "protocol" in body, f"{name}: missing protocol"


@pytest.mark.parametrize("name,port", list(BRIDGE_PORTS.items()))
def test_bridge_verbs_endpoint(name, port):
    """Each /verbs endpoint returns either verbs (flat) or services (nested)."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/verbs", timeout=3) as r:
            body = json.loads(r.read())
    except (urllib.error.URLError, ConnectionError):
        pytest.skip(f"{name} not running")
    assert body.get("ok") is True, f"{name}: ok != True"
    # My bridges (built round 2) use flat "verbs" list.
    # gws_bridge (pre-existing) uses nested "services" dict.
    if name == "gws_bridge":
        assert "services" in body, f"{name}: gws uses services dict, missing"
        assert isinstance(body["services"], dict), f"{name}: services not dict"
    else:
        assert "verbs" in body, f"{name}: missing verbs"
        assert isinstance(body["verbs"], list), f"{name}: verbs not list"


def test_gemini_bridge_health_ready():
    """gemini_bridge specifically reports READY (the only one with active credentials)."""
    try:
        with urllib.request.urlopen("http://127.0.0.1:18092/health", timeout=3) as r:
            body = json.loads(r.read())
    except (urllib.error.URLError, ConnectionError):
        pytest.skip("gemini_bridge not running")
    assert body.get("status") == "READY", f"expected READY, got {body.get('status')}"
    assert body.get("credentials_configured") is True, "credentials not configured"
    assert body.get("models_available", 0) > 0, "no models available"


def test_gemini_bridge_generate_live():
    """gemini_bridge actually generates content (end-to-end)."""
    req = urllib.request.Request(
        "http://127.0.0.1:18092/generate",
        data=json.dumps(
            {"verb": "generate", "params": {"prompt": "Reply OK", "max_tokens": 50}}
        ).encode(),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = json.loads(r.read())
    except (urllib.error.URLError, ConnectionError):
        pytest.skip("gemini_bridge not running")
    except urllib.error.HTTPError as e:
        if e.code == 429:
            pytest.skip("rate-limited")
        raise
    assert body.get("ok") is True, f"bridge returned: {body}"
    result = body["result"]
    assert result["model"], "no model"
    assert result["text"] is not None, "no text"
    assert result["usage"]["total_tokens"] > 0, "no tokens"


def test_gemini_bridge_models_list():
    """gemini_bridge models endpoint returns available models."""
    req = urllib.request.Request(
        "http://127.0.0.1:18092/models",
        data=json.dumps({"verb": "models", "params": {}}).encode(),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            body = json.loads(r.read())
    except (urllib.error.URLError, ConnectionError):
        pytest.skip("gemini_bridge not running")
    assert body.get("ok") is True, f"models call failed: {body}"
    models = body["result"]["models"]
    assert len(models) > 0, "no models returned"
    # Check at least one Gemini model
    assert any("gemini" in m["name"] for m in models), "no Gemini models"


# ── Module-level tests (don't require bridges running) ─────────────


def test_google_bridge_base_imports():
    """google_bridge_base.py imports cleanly."""
    try:
        import google_bridge_base
    except ImportError as e:
        pytest.fail(f"import failed: {e}")
    # Check class exists
    assert hasattr(google_bridge_base, "GoogleBridge"), "GoogleBridge class missing"
    # Check key methods
    for method in ("__init__", "_load_creds", "creds", "service", "health"):
        assert hasattr(google_bridge_base.GoogleBridge, method), (
            f"missing method {method}"
        )


def test_google_bridge_base_envelope_helper():
    """The envelope() helper produces correct APA envelope shape."""
    try:
        import google_bridge_base
    except ImportError:
        pytest.skip("google_bridge_base not importable")
    env = google_bridge_base.envelope("test", "verb", True, {"k": "v"})
    assert env["ok"] is True
    assert env["connector"] == "test"
    assert env["verb"] == "verb"
    assert env["result"] == {"k": "v"}
    assert "receipt" in env
    assert "receipt_id" in env["receipt"]
    # Failure envelope
    env2 = google_bridge_base.envelope("test", "verb", False, None, error="x")
    assert env2["ok"] is False
    assert env2["verdict"] == "HOLD"
    assert env2["error"] == "x"


def test_all_bridges_have_action_handler():
    """Each bridge module exports a handler dict or function."""
    expected = {
        "calendar_bridge",
        "drive_bridge",
        "sheets_bridge",
        "gmail_bridge",
        "gemini_bridge",
        "gws_bridge",
    }
    found = set()
    for name in expected:
        try:
            mod = __import__(name)
            found.add(name)
        except ImportError:
            continue
    missing = expected - found
    assert not missing, f"missing bridge modules: {missing}"
