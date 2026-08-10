#!/usr/bin/env python3
"""
test_qwen_provider.py — Smoke tests for the QwenProvider integration.

Forged 2026-08-10. Validates the P1.5 fix without making real HTTP calls.
Run: python3 /root/A-FORGE/flame/test_qwen_provider.py
Exit 0 = all pass, non-zero = failure.

DITEMPA BUKAN DIBERI.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

# Make the flame dir importable when run as a script
sys.path.insert(0, str(Path(__file__).parent))

# Quiet the FLAME logger
import logging
logging.basicConfig(level=logging.WARNING)


def test_config_parses() -> bool:
    """flame_config.json must remain valid JSON after the Qwen additions."""
    cfg_path = Path(__file__).parent / "flame_config.json"
    try:
        data = json.loads(cfg_path.read_text())
    except json.JSONDecodeError as e:
        print(f"❌ test_config_parses: {e}")
        return False
    if "qwen" not in data.get("providers", {}):
        print("❌ test_config_parses: qwen provider block missing")
        return False
    qwen_prov = data["providers"]["qwen"]
    if qwen_prov.get("cost_band") != "free":
        print(f"❌ test_config_parses: qwen cost_band={qwen_prov.get('cost_band')!r}")
        return False
    if not qwen_prov.get("expiration_epochs"):
        print("❌ test_config_parses: qwen.expiration_epochs is empty")
        return False
    print(f"✅ test_config_parses: {len(qwen_prov['expiration_epochs'])} Qwen models have expiration_epochs")
    return True


def test_qwen_tiers_present() -> bool:
    """RM0-TOOLS-FREELOOP must have 3 Qwen chat tiers, RM0-EMBED-FREELOOP 0 (P1.5.1).

    P1.5.1: Token Plan endpoint has no embedding models. Embed chain stays
    SEA-LION + Ollama only. To restore Qwen embed tiers, override
    QWEN_BASE_URL to the standard DashScope endpoint and use a key
    generated from the Free Tier dashboard.
    """
    cfg_path = Path(__file__).parent / "flame_config.json"
    data = json.loads(cfg_path.read_text())

    chat_tiers = [
        t for t in data["chains"]["RM0-TOOLS-FREELOOP"]["tiers"]
        if t.get("provider") == "qwen"
    ]
    embed_tiers = [
        t for t in data["chains"]["RM0-EMBED-FREELOOP"]["tiers"]
        if t.get("provider") == "qwen"
    ]

    if len(chat_tiers) != 3:
        print(f"❌ test_qwen_tiers_present: chat tiers = {len(chat_tiers)} (expected 3)")
        return False
    if embed_tiers:
        print(
            f"❌ test_qwen_tiers_present: embed tiers should be 0 (P1.5.1, "
            f"token-plan has no embed), got {len(embed_tiers)}"
        )
        return False
    print(f"✅ test_qwen_tiers_present: 3 chat Qwen tiers, 0 embed (token-plan)")
    return True


def test_detect_rate_limit_string_code() -> bool:
    """_detect_rate_limit must accept string body codes (Qwen convention)."""
    from flame_router import _detect_rate_limit, PROVIDER_ERROR_VOCABULARY

    # Qwen quota-exhausted body
    is_rl, reason = _detect_rate_limit(
        "qwen", 403, {"code": "AllocationQuota.FreeTierOnly"}
    )
    if not is_rl or "quota exhausted" not in reason:
        print(f"❌ test_detect_rate_limit_string_code: is_rl={is_rl}, reason={reason!r}")
        return False

    # Negative case — irrelevant code
    is_rl, reason = _detect_rate_limit(
        "qwen", 200, {"code": "OK"}
    )
    if is_rl:
        print(f"❌ test_detect_rate_limit_string_code: false positive on 200 OK")
        return False

    # Backward compat — Cloudflare integer codes still work
    is_rl, reason = _detect_rate_limit(
        "cloudflare", 200, {"code": 1027}
    )
    if not is_rl:
        print(f"❌ test_detect_rate_limit_string_code: Cloudflare 1027 not detected")
        return False

    print("✅ test_detect_rate_limit_string_code: string + integer body codes both detected")
    return True


def test_qwen_provider_state_machine() -> bool:
    """QwenProvider state machine: healthy → exhausted_observed → healthy, and expired_terminal."""
    import os
    from flame_router import QwenProvider

    # EXPIRED_TERMINAL — expiration in the past
    past = time.time() - 86400
    p_expired = QwenProvider(api_key="dummy", expiration_epochs={"qwen3.7-flash": past})
    ok, reason = p_expired._check_state("qwen3.7-flash")
    if ok or "QWEN_EXPIRED" not in reason:
        print(f"❌ test_qwen_provider_state_machine: expired route returned ok={ok}, reason={reason!r}")
        return False

    # HEALTHY — future expiration, no observed exhaustion
    future = time.time() + 86400 * 30
    p_healthy = QwenProvider(api_key="dummy", expiration_epochs={"qwen3.7-flash": future})
    ok, reason = p_healthy._check_state("qwen3.7-flash")
    if not ok:
        print(f"❌ test_qwen_provider_state_machine: healthy route returned ok={ok}, reason={reason!r}")
        return False

    # EXHAUSTED_OBSERVED — within cooldown
    p_exh = QwenProvider(api_key="dummy", expiration_epochs={"qwen3.7-flash": future})
    # P1.5.1 fix: store (timestamp, body_code) tuple so the state reason
    # reports the actual body code observed, not a hardcoded one.
    p_exh.exhausted_observed_at["qwen3.7-flash"] = (
        time.time() - 60,
        "insufficient_quota",
    )
    ok, reason = p_exh._check_state("qwen3.7-flash")
    if ok or "QWEN_EXHAUSTED_OBSERVED" not in reason:
        print(f"❌ test_qwen_provider_state_machine: exhausted route returned ok={ok}, reason={reason!r}")
        return False
    # P1.5.1: the reason must include the actual body code, not a hardcoded one
    if "insufficient_quota" not in reason:
        print(
            f"❌ test_qwen_provider_state_machine: EXHAUSTED_OBSERVED reason "
            f"should include the actual body code 'insufficient_quota', got: {reason!r}"
        )
        return False

    # No key — must fail with QWEN_NO_KEY. Temporarily pop QWEN_API_KEY from
    # env so the constructor's `or os.environ.get(...)` fallback doesn't
    # pick up a real key.
    saved = os.environ.pop("QWEN_API_KEY", None)
    try:
        p_nokey = QwenProvider(api_key="")
        content, latency, ok, err = p_nokey.call(
            "qwen3.7-flash", [{"role": "user", "content": "hi"}]
        )
        if ok or "QWEN_NO_KEY" not in err:
            print(
                f"❌ test_qwen_provider_state_machine: no-key call should fail with "
                f"QWEN_NO_KEY, got ok={ok}, err={err!r}"
            )
            return False
    finally:
        if saved is not None:
            os.environ["QWEN_API_KEY"] = saved

    print(
        "✅ test_qwen_provider_state_machine: 4 states (expired, healthy, "
        "exhausted, no-key) all correct"
    )
    return True


def test_snapshot_cap_validator() -> bool:
    """FlameEngine._validate_qwen_snapshot_cap must not raise on the current config."""
    from flame_router import FlameEngine

    try:
        engine = FlameEngine()
    except Exception as e:
        print(f"❌ test_snapshot_cap_validator: FlameEngine init failed: {e}")
        return False

    # No exception = the validator ran cleanly. (It warns, doesn't raise.)
    # Check that the call method itself was added with a Qwen branch.
    import inspect
    src = inspect.getsource(engine.call)
    if "provider == \"qwen\"" not in src:
        print("❌ test_snapshot_cap_validator: qwen branch missing in engine.call()")
        return False
    if "EXHAUSTED_OBSERVED" not in src and "qwen" not in src:
        print("❌ test_snapshot_cap_validator: qwen state machine not wired")
        return False
    print("✅ test_snapshot_cap_validator: engine init OK, qwen branch present in call()")
    return True


def test_routing_table_includes_qwen() -> bool:
    """RoutingTable built from config must include Qwen chat routes.

    P1.5.1: token-plan endpoint has 3 chat routes and 0 embed routes.
    To restore embed routes, override QWEN_BASE_URL to the standard
    DashScope endpoint and use a Free Tier key.
    """
    from flame_router import FlameEngine

    chat_engine = FlameEngine()
    embed_engine = FlameEngine(chain_id="RM0-EMBED-FREELOOP")

    chat_routes = {
        r["route_id"]
        for r in chat_engine.routing_table.list_all()
        if r["route_id"].startswith("qwen/")
    }
    embed_routes = {
        r["route_id"]
        for r in embed_engine.routing_table.list_all()
        if r["route_id"].startswith("qwen/")
    }

    if len(chat_routes) != 3:
        print(
            f"❌ test_routing_table_includes_qwen: chat chain has "
            f"{len(chat_routes)} Qwen routes (expected 3): {chat_routes}"
        )
        return False
    if embed_routes:
        print(
            f"❌ test_routing_table_includes_qwen: embed chain has "
            f"{len(embed_routes)} Qwen routes (expected 0 — P1.5.1): "
            f"{embed_routes}"
        )
        return False
    expected_chat = {
        "qwen/qwen3.7-plus",
        "qwen/qwen3.6-plus",
        "qwen/deepseek-v3.2",
    }
    if chat_routes != expected_chat:
        print(
            f"❌ test_routing_table_includes_qwen: chat routes mismatch.\n"
            f"   got:      {chat_routes}\n   expected: {expected_chat}"
        )
        return False
    print(
        f"✅ test_routing_table_includes_qwen: 3 chat Qwen routes "
        f"(token-plan catalog), 0 embed"
    )
    return True


def main() -> int:
    tests = [
        test_config_parses,
        test_qwen_tiers_present,
        test_detect_rate_limit_string_code,
        test_qwen_provider_state_machine,
        test_snapshot_cap_validator,
        test_routing_table_includes_qwen,
    ]
    results = []
    for t in tests:
        results.append(t())
    passed = sum(results)
    total = len(results)
    print(f"\n{'='*60}")
    print(f"QwenProvider integration: {passed}/{total} tests passed")
    if passed < total:
        print(f"FAILED: {[tests[i].__name__ for i, r in enumerate(results) if not r]}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
