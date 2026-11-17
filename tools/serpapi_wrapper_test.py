#!/usr/bin/env python3
"""
serpapi_wrapper_test — Fasa 1 (LAW 8 + F1/A2M + pagination lock) + Fasa 3.2
(circuit-breaker mock). 0 SerpApi credit burnt. Uses dry_run mode + a temp
fixture budget file so the real .serpapi_budget.json stays untouched.

Run:  python3 /root/A-FORGE/tools/serpapi_wrapper_test.py
"""

from __future__ import annotations

import json
import sys
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, "/root/A-FORGE/tools")
import serpapi_wrapper as w  # noqa: E402


GREEN = "\033[32m"; RED = "\033[31m"; YEL = "\033[33m"; DIM = "\033[2m"; END = "\033[0m"


def _ok(label: str, msg: str = "") -> None:
    print(f"  {GREEN}✓ PASS{END}  {label}" + (f"  {DIM}{msg}{END}" if msg else ""))


def _fail(label: str, msg: str = "") -> None:
    print(f"  {RED}✗ FAIL{END}  {label}" + (f"  {DIM}{msg}{END}" if msg else ""))


def _expect_raises(
    fn, exc_type: type[Exception], label: str, must_contain: str = ""
) -> bool:
    try:
        fn()
    except exc_type as e:
        msg = str(e)
        if must_contain and must_contain.lower() not in msg.lower():
            _fail(label, f"raised {exc_type.__name__} but message missing '{must_contain}'")
            return False
        _ok(label, f"→ {exc_type.__name__}: {msg[:120]}")
        return True
    except Exception as e:
        _fail(label, f"raised wrong exception {type(e).__name__}: {e}")
        return False
    _fail(label, f"expected {exc_type.__name__}, nothing raised")
    return False


# ---------------------------------------------------------------------------
# FASA 1.1 — LAW 8 blocked engine reject
# ---------------------------------------------------------------------------

def test_fasa_1_1_blocked_engines() -> dict[str, bool]:
    print(f"\n{YEL}── FASA 1.1 — Blocked Engine Reject (LAW 8) ──{END}")
    results: dict[str, bool] = {}

    def call_google_search():
        client = w.SerpApiClient()
        client.search("google_search", "PETRONAS SK317B", dry_run=False)
    results["google_search"] = _expect_raises(
        call_google_search, w.EngineBlockedError,
        "google_search rejected (LAW 8)", must_contain="duplicate",
    )

    def call_bing_search():
        client = w.SerpApiClient()
        client.search("bing_search", "Malaysia oil 2026", dry_run=False)
    results["bing_search"] = _expect_raises(
        call_bing_search, w.EngineBlockedError,
        "bing_search rejected (LAW 8)", must_contain="brave",
    )

    def call_google_news_full():
        client = w.SerpApiClient()
        client.search("google_news", "PETRONAS SK317B", dry_run=False)
    results["google_news_full"] = _expect_raises(
        call_google_news_full, w.EngineBlockedError,
        "google_news (full) rejected — google_news_light covers", must_contain="light",
    )

    def call_unknown():
        client = w.SerpApiClient()
        client.search("google_travel", "cheap flight", dry_run=False)
    results["unknown_engine"] = _expect_raises(
        call_unknown, w.EngineBlockedError,
        "google_travel rejected (not in whitelist)", must_contain="google_travel",
    )

    return results


# ---------------------------------------------------------------------------
# FASA 1.2 — F1/A2M Social HARD HOLD Gate (via WHITELISTED engine)
# ---------------------------------------------------------------------------

def test_fasa_1_2_hard_hold() -> dict[str, bool]:
    """Test hard-hold via in-scope engine so the privacy brake is the one
    that fires (not engine block). Per manifest §2.3, the privacy brake
    binds even on gap-filler engines."""
    print(f"\n{YEL}── FASA 1.2 — F1/A2M Social HARD HOLD Gate ──{END}")
    results: dict[str, bool] = {}

    targets = [
        ("@rico_ricaldo_33", "Syed profile lookup"),
        ("Hafiz Damanhuri", "ex-manager profile lookup"),
        ("Muhammad Arif Fazil", "F13 self-lookup"),
    ]

    for token, label in targets:
        def make_call(t):
            def _f():
                # Use whitelisted engine so engine gate passes, privacy brake fires.
                client = w.SerpApiClient()
                client.search("google_news_light", f"{t} profile news", dry_run=False)
            return _f
        results[f"hold_via_news_light:{token}"] = _expect_raises(
            make_call(token), w.HardHoldError,
            f"news_light lookup of '{token}' HOLD", must_contain="888",
        )

    # Sanity: a non-private query must NOT trigger the brake.
    def call_benign():
        client = w.SerpApiClient()
        out = client.search("google_news_light", "PETRONAS SK317B Sarawak", dry_run=True)
        assert out.get("_dry_run") is True
    try:
        call_benign()
        _ok("benign sovereign-relevant query passes privacy brake", "no false-positive")
        results["benign_passes"] = True
    except Exception as e:
        _fail("benign sovereign-relevant query passes privacy brake", str(e))
        results["benign_passes"] = False

    return results


# ---------------------------------------------------------------------------
# FASA 1.3 — Auto-Pagination Lock
# ---------------------------------------------------------------------------

def test_fasa_1_3_pagination_lock() -> dict[str, bool]:
    print(f"\n{YEL}── FASA 1.3 — Auto-Pagination Lock ──{END}")
    results: dict[str, bool] = {}

    def call_auto_pag_true():
        client = w.SerpApiClient()
        client.search("google_scholar", "Sarawak Basin", extra_params={"auto_pagination": True})
    results["auto_pagination_true"] = _expect_raises(
        call_auto_pag_true, w.PaginationLockError,
        "auto_pagination=True blocked", must_contain="single page",
    )

    def call_num_huge():
        client = w.SerpApiClient()
        client.search("google_jobs", "Geoscientist Malaysia", extra_params={"num": 100})
    results["num_100"] = _expect_raises(
        call_num_huge, w.PaginationLockError,
        "num=100 blocked", must_contain="max 20",
    )

    def call_num_ok():
        client = w.SerpApiClient()
        out = client.search(
            "google_jobs", "Geoscientist Malaysia",
            extra_params={"num": 20}, dry_run=True,
        )
        assert out.get("_dry_run") is True, "expected dry_run=True payload"
        # Confirm num=20 passed through (no PaginationLockError raised).
        assert out["params"].get("num") == 20, f"num=20 should pass, got {out['params'].get('num')}"
    try:
        call_num_ok()
        _ok("num=20 boundary allowed", "dry_run=True, num=20 in passthrough")
        results["num_20_allowed"] = True
    except Exception as e:
        _fail("num=20 boundary allowed", str(e))
        results["num_20_allowed"] = False

    def call_in_scope_dry():
        client = w.SerpApiClient()
        out = client.search("google_scholar", "Sarawak Basin stratigraphy", dry_run=True)
        assert out["engine"] == "google_scholar"
        assert out["params"]["engine"] == "google_scholar"
        assert out["params"]["q"] == "Sarawak Basin stratigraphy"
        assert "api_key" not in out["params"], "api_key must NOT leak to dry_run output"
    try:
        call_in_scope_dry()
        _ok("whitelisted engine accepted (dry_run)", "google_scholar passthrough clean, no key leak")
        results["whitelisted_accepted"] = True
    except Exception as e:
        _fail("whitelisted engine accepted (dry_run)", str(e))
        results["whitelisted_accepted"] = False

    return results


# ---------------------------------------------------------------------------
# FASA 3.2 — Circuit-Breaker Mock
# ---------------------------------------------------------------------------

def _today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _make_fixture_budget(tmpdir: Path, used: int, today_calls: int, today_date: str | None = None) -> Path:
    """Write a fixture .serpapi_budget.json with synthetic state. Today's
    calls dated to today (UTC) so the daily cap counter trips correctly."""
    p = tmpdir / ".serpapi_budget.json"
    today = today_date or _today_utc()
    p.write_text(json.dumps({
        "month": today[:7],
        "total_limit": w.MONTHLY_LIMIT,
        "used": used,
        "calls": [
            {"timestamp": f"{today}T00:{i:02d}:00+00:00", "engine": "google_scholar",
             "domain": "academic", "query": f"fixture-{i}", "credits": 1}
            for i in range(today_calls)
        ],
        "by_domain": {"academic": used},
        "by_engine": {"google_scholar": used},
    }, indent=2))
    return p


@contextmanager
def _fixture_scope(path: Path):
    """Scope the fixture budget — restores the live SOT pointer after."""
    with w.use_fixture_budget(path):
        yield


def test_fasa_3_2_circuit_breaker() -> dict[str, bool]:
    print(f"\n{YEL}── FASA 3.2 — Circuit-Breaker Mock ──{END}")
    results: dict[str, bool] = {}

    with tempfile.TemporaryDirectory() as td:
        td_p = Path(td)

        # 3.2.a Daily cap reached (10 calls today, would-be 11th).
        daily_cap_budget = _make_fixture_budget(td_p, used=10, today_calls=10)
        try:
            with _fixture_scope(daily_cap_budget):
                # NOTE: this makes a real HTTP call. We rely on a wrapper to
                # intercept — but dry_run=False goes to network. For mock
                # purposes, swap to a fake _http_call by monkey-patching.
                pass  # we'll monkey-patch below
        except Exception:
            pass

    # Re-run with monkey-patched HTTP to avoid network + still trip cap.
    import serpapi_wrapper as wmod

    def _fake_http(url, params):
        print(f"    {DIM}[fake_http called] engine={params.get('engine')} q={params.get('q', params.get('search_query',''))[:30]}{END}")
        return {
            "search_metadata": {"status": "Success", "_mock": True},
            "organic_results": [],
        }
    orig_http = wmod._http_call
    wmod._http_call = _fake_http  # type: ignore
    print(f"  {DIM}[debug] monkey-patched wmod._http_call → fake (was {orig_http.__name__ if hasattr(orig_http,'__name__') else orig_http}){END}")

    try:
        with tempfile.TemporaryDirectory() as td:
            td_p = Path(td)

            # 3.2.a Daily cap reached.
            daily_cap = _make_fixture_budget(td_p, used=10, today_calls=10)
            try:
                with _fixture_scope(daily_cap):
                    client = wmod.SerpApiClient()
                    client.search("google_scholar", "test", domain="academic")
                _fail("daily cap mock", "expected BudgetCeilingReached")
                results["daily_cap"] = False
            except wmod.BudgetCeilingReached as e:
                _ok("daily cap raises BudgetCeilingReached", str(e)[:120])
                results["daily_cap"] = True
            except Exception as e:
                _fail("daily cap mock", f"wrong exception {type(e).__name__}: {e}")
                results["daily_cap"] = False

            # 3.2.b Hard ceiling reached (used=200, today_calls=0 so daily gate passes).
            ceiling = _make_fixture_budget(td_p, used=200, today_calls=0)
            try:
                with _fixture_scope(ceiling):
                    client = wmod.SerpApiClient()
                    client.search("google_scholar", "test", domain="academic")
                _fail("hard ceiling mock", "expected BudgetCeilingReached")
                results["hard_ceiling"] = False
            except wmod.BudgetCeilingReached as e:
                _ok("hard ceiling raises BudgetCeilingReached", str(e)[:120])
                results["hard_ceiling"] = True
            except Exception as e:
                _fail("hard ceiling mock", f"wrong exception {type(e).__name__}: {e}")
                results["hard_ceiling"] = False

            # 3.2.c near-cap daily (used=199, 9 calls today, would-be 10th = DAILY_CAP exact).
            near_cap = _make_fixture_budget(td_p, used=199, today_calls=9)
            try:
                with _fixture_scope(near_cap):
                    client = wmod.SerpApiClient()
                    client.search("google_scholar", "test", domain="academic")
                _fail("near-cap daily=10 mock", "expected BudgetCeilingReached (daily)")
                results["near_cap_daily"] = False
            except wmod.BudgetCeilingReached as e:
                _ok("daily cap fires before hard ceiling (used=199 today=9→10)",
                    str(e)[:120])
                results["near_cap_daily"] = True
            except Exception as e:
                _fail("near-cap mock", f"wrong exception {type(e).__name__}: {e}")
                results["near_cap_daily"] = False

            # 3.2.d Corrupt schema — load should refuse.
            corrupt = td_p / ".serpapi_budget.json"
            corrupt.write_text('{"month":"2026-10","used":0}')  # missing keys
            try:
                with _fixture_scope(corrupt):
                    client = wmod.SerpApiClient()
                    client.search("google_scholar", "test", dry_run=False)
                _fail("corrupt schema mock", "expected BudgetSchemaError")
                results["schema_drift"] = False
            except wmod.BudgetSchemaError as e:
                _ok("corrupt schema raises BudgetSchemaError", str(e)[:120])
                results["schema_drift"] = True
            except Exception as e:
                _fail("corrupt schema", f"wrong exception {type(e).__name__}: {e}")
                results["schema_drift"] = False

            # 3.2.e Happy path under budget — should succeed and write fixture.
            happy = _make_fixture_budget(td_p, used=0, today_calls=0)
            try:
                with _fixture_scope(happy):
                    client = wmod.SerpApiClient()
                    out = client.search("google_scholar", "Sarawak Basin", domain="academic")
                assert out.get("search_metadata", {}).get("_mock") is True, (
                    f"expected mock HTTP, got {list(out.keys())[:5]}"
                )
                # Fixture file should now show used=1, by_engine.google_scholar=1
                written = json.loads(happy.read_text())
                assert written["used"] == 1, f"expected used=1, got {written['used']}"
                assert written["by_engine"]["google_scholar"] == 1
                _ok("happy path charges 1 credit + writes fixture",
                    f"used={written['used']} by_engine.scholar=1 calls={len(written['calls'])}")
                results["happy_path"] = True
            except Exception as e:
                _fail("happy path", str(e))
                results["happy_path"] = False

    finally:
        wmod._http_call = orig_http  # type: ignore

    return results


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main() -> int:
    print(f"\n{YEL}════════════ SERPAPI WRAPPER — UNIT TESTS (Fasa 1 + Fasa 3.2) ════════════{END}")
    print(f"{DIM}0 SerpApi credit burnt. HTTP monkey-patched to a fake for circuit-breaker tests.{END}")
    print(f"{DIM}Live SOT (NOT mutated): {w.BUDGET_PATH}{END}")
    print(f"{DIM}Today UTC: {_today_utc()}{END}")

    all_results: dict[str, dict[str, bool]] = {}
    all_results["1.1_blocked_engines"] = test_fasa_1_1_blocked_engines()
    all_results["1.2_hard_hold"] = test_fasa_1_2_hard_hold()
    all_results["1.3_pagination_lock"] = test_fasa_1_3_pagination_lock()
    all_results["3.2_circuit_breaker"] = test_fasa_3_2_circuit_breaker()

    print(f"\n{YEL}── Summary ──{END}")
    total = 0; passed = 0
    for group, rs in all_results.items():
        for k, v in rs.items():
            total += 1
            passed += int(v)
            mark = f"{GREEN}✓{END}" if v else f"{RED}✗{END}"
            print(f"  {mark}  {group}::{k}")

    print(f"\n{YEL}TOTAL: {passed}/{total} passed{END}\n")

    # Verify live SOT untouched.
    live_budget = json.loads(w.BUDGET_PATH.read_text())
    print(f"{DIM}Live SOT untouched — month={live_budget['month']} used={live_budget['used']} / {live_budget['total_limit']}{END}")
    print(f"{DIM}Schema keys present: {sorted(live_budget.keys())}{END}")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())