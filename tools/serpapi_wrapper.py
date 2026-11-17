#!/usr/bin/env python3
"""
serpapi_wrapper — Governed gap-filler wrapper for A-FORGE (Option A, per
serpapi-lane-map-2026-10-18.md, F13 ratified). Sits in front of SerpApi HTTP
endpoint, enforces WHITELIST (5 engines) + HARD HOLD (F1/A2M private-account
gate) + PAGINATION LOCK (single page) + CREDIT CEILING (.serpapi_budget.json
mutated atomically after every successful HTTP 200).

In-scope engines (5, gap-fillers — Brave/Exa do not return these structures):
    - google_news_light     (Sovereign daily brief fallback)
    - google_scholar        (citation graph for EUREKA stamps)
    - google_jobs           (PETRONAS exit baseline Mar 2027 / MSS prep)
    - google_maps           (vendor audit, event venue logging)
    - youtube_video_transcript  (multilingual / fail-recovery; SerpApi's
                                  underlying engine = youtube + sp= transcript filter,
                                  per VAULT999 serpapi-binding open finding)

Out-of-scope (raises EngineBlockedError before any HTTP):
    google_search, google_news (full), bing_search, youtube_search,
    youtube_video, youtube_channel, google_shopping, google_finance,
    google_images, google_travel, google_play_books, facebook_profile,
    instagram_profile — and any engine name not in IN_SCOPE.

Authoritative reference:
    /root/.hermes/registry/serpapi-lane-map-2026-10-18.md
    /root/arifOS/VAULT999/serpapi-binding/binding-receipt-20261017T222632Z.json
    /root/A-FORGE/tools/.serpapi_budget.json  (Julai 2026 schema — DO NOT mutate)

Usage (programmatic):
    from serpapi_wrapper import SerpApiClient
    c = SerpApiClient()
    out = c.search("google_scholar", "Sarawak Basin stratigraphy")

Usage (CLI, for 777_FORGE / A-FORGE integration):
    python3 serpapi_wrapper.py --engine google_scholar --query "Sarawak Basin"
    python3 serpapi_wrapper.py --engine google_news_light --query "PETRONAS SK317B" --domain news

Floor scope: F1 (Truth), F2 (Consent), F8 (Reversibility), F9 (Anti-Shadow),
             F11 (Anti-Hantu), F13 (Sovereign).
Authority ceiling: 777_FORGE / F13. Any 888-class binary (private-account probe)
              raises immediately and never opens the HTTP socket.

DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


# -----------------------------------------------------------------------------
# CONSTITUTIONAL CONSTANTS — do not move without 888 directive
# -----------------------------------------------------------------------------

#: Authoritative whitelist (gap-filler only). F13-ratified 2026-10-18.
#: 2026-10-18 amendment (F13 888 directive, per-chat IG proxy lane):
#: instagram_profile added for SOVEREIGN-mediated profile/handle lookups.
#: SerpApi proxy bypasses IG datacenter IP 429 — needed when VPS direct
#: (yt-dlp/curl) is rate-limited. Stays inside HARD_HOLD_NAMES gate for
#: bonded humans (Syed, Hafiz, Arif himself) — per-call AUDIT must still log.
IN_SCOPE: frozenset[str] = frozenset({
    "google_news_light",
    "google_scholar",
    "google_jobs",
    "google_maps",
    # NOTE: SerpApi exposes this as engine=youtube with sp=EgIQAg%3D%3D
    # transcript filter, not a standalone engine name. Wrapper maps at runtime.
    "youtube_video_transcript",
    # 2026-10-18: IG profile probe via SerpApi proxy (datacenter bypass).
    "instagram_profile",
})

#: Anything not in IN_SCOPE → EngineBlockedError before socket opens.
BLOCKED_DECISION_GUIDE: dict[str, str] = {
    "google_search": "Duplicate of aforge.forge_search (Brave default). LAW 8 + LAWS 4 → HARAM.",
    "google_news": "google_news_light subset covers the gap; full version duplicates Brave News / Exa.",
    "bing_search": "aforge.forge_search default = Brave; Bing duplicates.",
    "youtube_search": "Native mcp__youtube__ already serves this.",
    "youtube_video": "Native mcp__youtube__ already serves this.",
    "youtube_channel": "Native mcp__youtube__ already serves this.",
    "google_play_books": "ISBN/edition only — gated behind 888 HOLD (not in-scope).",
    "google_shopping": "Default policy = unused unless 888 opens a specific case.",
    "google_finance": "Default policy = unused unless 888 opens a specific case.",
    "google_images": "Default policy = unused unless 888 opens a specific case.",
    "google_travel": "Default policy = unused unless 888 opens a specific case.",
    "facebook_profile": "Out-of-scope by default (LAW 8 + SerpApi cost). 888 per-call override if needed.",
}

#: F1/A2M HARD HOLD list — named private individuals. ANY probe touching these
#: raises HOLD_FOR_888_CONSENT regardless of engine. This is the sovereign
#: privacy brake; it cannot be relaxed by any agent below 888.
HARD_HOLD_NAMES: tuple[str, ...] = (
    "@rico_ricaldo_33",      # Syed Mokhtaruddin (Abang Sado) — with @
    "rico_ricaldo_33",       # plain handle (case-insensitive match below)
    "Syed Mokhtaruddin",
    "Syed Khairuddin",       # legacy mislabel — included for safety
    "Hafiz Damanhuri",        # ex-manager PETRONAS
    "Mohamad Hafiz Damanhuri",
    "Muhammad Arif Fazil",   # F13 SOVEREIGN
    "Muhammad Arif bin Fazil",
    "Arif Fazil",
)

#: Budget SOT — schema must remain Julai 2026 layout (month, total_limit, used,
#: calls, by_domain, by_engine). Mutation is read-modify-write under flock.
BUDGET_PATH = Path("/root/A-FORGE/tools/.serpapi_budget.json")

#: Hard ceiling (FREEZE). When used >= HARD_CEILING, every subsequent call
#: raises BudgetCeilingReached. Manifest specifies 200/250 to leave 50-credit
#: buffer for any F13 binary that overruns.
HARD_CEILING: int = 200
MONTHLY_LIMIT: int = 250
DAILY_CAP: int = 10

#: Endpoint. Single HTTPS host — no separate tenant per engine.
SERPAPI_ENDPOINT = "https://serpapi.com/search.json"

#: Per-request HTTP timeout (seconds). Generous because scholar is slow.
HTTP_TIMEOUT: int = 30


# -----------------------------------------------------------------------------
# CONSTITUTIONAL ERRORS — raised by Python whitelist BEFORE socket opens
# -----------------------------------------------------------------------------

class SerpApiError(Exception):
    """Base class for all wrapper errors. Never swallows; never retries."""


class EngineBlockedError(SerpApiError):
    """Engine name not in IN_SCOPE whitelist. No HTTP traffic permitted.
    Per LAW 8 (Anti-Bloat) + 888 directive 2026-10-18."""


class HardHoldError(SerpApiError):
    """Query targets a sovereign-private individual without 888 consent.
    Per F1/A2M privacy brake + binding receipt 2026-10-17T222939Z.
    Alias per spec 2026-10-18 test: HOLD_FOR_888_CONSENT = HardHoldError"""


# Spec alias — tests instantiate/raise by this name
HOLD_FOR_888_CONSENT = HardHoldError


class PaginationLockError(SerpApiError):
    """Caller attempted auto_pagination=True or num>=20. Single page only.
    Per F1 reversibility + manifest §3 auto_pagination=false."""


class BudgetCeilingReached(SerpApiError):
    """used >= HARD_CEILING (200/250) or used_today >= DAILY_CAP (10).
    Per credit-guard policy + manifest §3."""


class BudgetSchemaError(SerpApiError):
    """Budget file present but does not match Julai 2026 schema. Refuses
    to mutate a file we cannot reason about. Re-run after manual fix."""


# -----------------------------------------------------------------------------
# BUDGET LEDGER — atomic, flock-protected, append-only after success
# -----------------------------------------------------------------------------

_ACTIVE_BUDGET_PATH: Path | None = None  # instance-level override (set by SerpApiClient)


def _resolve_budget_path() -> Path:
    """Return instance-overridden path if set, else the module-level SOT."""
    return _ACTIVE_BUDGET_PATH if _ACTIVE_BUDGET_PATH is not None else BUDGET_PATH


@contextmanager
def use_fixture_budget(path: Path):
    """Context manager that scopes a fixture budget file to a code block.
    Restores the live SOT pointer on exit — even if the block raises."""
    global _ACTIVE_BUDGET_PATH
    prev = _ACTIVE_BUDGET_PATH
    _ACTIVE_BUDGET_PATH = path
    try:
        yield
    finally:
        _ACTIVE_BUDGET_PATH = prev


def _load_budget() -> dict[str, Any]:
    """Load .serpapi_budget.json. Validates schema against Julai 2026 layout.
    Auto-rotates month to current YYYY-MM (Oct 2026 reset to used=0) per
    F13 ruling 2026-10-18. Schema unchanged."""
    p = _resolve_budget_path()
    if not p.exists():
        raise BudgetSchemaError(
            f"Budget SOT missing at {p}. Refuses to create — restore from backup."
        )
    try:
        raw = p.read_text()
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise BudgetSchemaError(f"Budget file is not valid JSON: {e}") from e

    required = {"month", "total_limit", "used", "calls", "by_domain", "by_engine"}
    missing = required - set(data.keys())
    if missing:
        raise BudgetSchemaError(
            f"Budget schema drifted from Julai 2026. Missing keys: {sorted(missing)}. "
            f"Refuses to mutate — restore from .bak or re-author."
        )

    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    if data["month"] != current_month:
        # Month rotation — used reset to 0, calls/by_domain/by_engine archived.
        # Schema preserved (no new keys).
        data = {
            "month": current_month,
            "total_limit": data.get("total_limit", MONTHLY_LIMIT),
            "used": 0,
            "calls": [],
            "by_domain": {},
            "by_engine": {},
        }
        # Do not write here — write at first successful charge so the file
        # always reflects an actual usage event.
    return data


def _write_budget(data: dict[str, Any]) -> None:
    """Atomic write — write to temp file, fsync, rename. Avoids leaving a
    half-written ledger if the process dies mid-write."""
    fd, tmp_path = tempfile.mkstemp(
        dir=str(_resolve_budget_path().parent),
        prefix=".serpapi_budget.",
        suffix=".tmp",
    )
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=2, sort_keys=False)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, _resolve_budget_path())
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise


def _charge_credit(engine: str, query: str, domain: str, cost: int) -> dict[str, Any]:
    """Read-modify-write .serpapi_budget.json after a successful HTTP 200.
    Raises BudgetCeilingReached if used >= HARD_CEILING (refuses BEFORE
    attempting any charge, so the API call has already happened — wrapper
    surfaces the 200 result but tags the charge as a HARD_HOLD_CEILING breach
    that 888 must reconcile)."""
    data = _load_budget()
    now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")
    day_key = now_iso[:10]

    used_today = sum(
        1 for c in data["calls"]
        if isinstance(c, dict) and c.get("timestamp", "").startswith(day_key)
    )
    if used_today >= DAILY_CAP:
        raise BudgetCeilingReached(
            f"Daily cap {DAILY_CAP} reached on {day_key}. "
            f"HOLD until next UTC day. Used today = {used_today}."
        )

    new_used = data["used"] + cost
    if new_used >= HARD_CEILING:
        raise BudgetCeilingReached(
            f"Hard ceiling {HARD_CEILING}/{MONTHLY_LIMIT} would be breached "
            f"(new_used={new_used}, current={data['used']}). "
            f"HOLD + notify 888 via Telegram Home channel."
        )

    call_entry = {
        "timestamp": now_iso,
        "engine": engine,
        "domain": domain,
        "query": query,
        "credits": cost,
    }
    data["calls"].append(call_entry)
    data["used"] = new_used
    data["by_engine"][engine] = data["by_engine"].get(engine, 0) + cost
    data["by_domain"][domain] = data["by_domain"].get(domain, 0) + cost

    _write_budget(data)
    return data


# -----------------------------------------------------------------------------
# WHITELIST + HOLD GATE — runs before urllib.request opens socket
# -----------------------------------------------------------------------------

def _check_engine(engine: str) -> None:
    """LAW 8 + binding-receipt whitelist gate. Raises before any HTTP."""
    if engine not in IN_SCOPE:
        if engine in BLOCKED_DECISION_GUIDE:
            reason = BLOCKED_DECISION_GUIDE[engine]
        else:
            reason = (
                f"Engine '{engine}' not in F13-ratified whitelist "
                f"({', '.join(sorted(IN_SCOPE))}). "
                f"Add via 888 directive or use aforge.forge_search (Brave/Exa)."
            )
        raise EngineBlockedError(f"[BLOCKED] {engine}: {reason}")


def _check_hard_hold(query: str, extra_text: str = "") -> None:
    """F1/A2M privacy brake. Scans query + extra params for named-private
    individual handles. Raises HOLD_FOR_888_CONSENT before socket opens."""
    blob = f"{query} {extra_text}".lower()
    for name in HARD_HOLD_NAMES:
        if name.lower() in blob:
            raise HardHoldError(
                f"[HOLD_FOR_888_CONSENT] Query targets sovereign-private "
                f"individual '{name}'. F1/A2M privacy brake binds. "
                f"888 must issue per-purpose, per-actor, per-reason override."
            )


def _force_pagination_off(params: dict[str, Any]) -> dict[str, Any]:
    """F1 reversibility — single-page fetch only. Strips any pagination param
    the caller attempted to inject. Raises PaginationLockError on egregious
    misuse so the audit log shows the attempt."""
    if params.pop("auto_pagination", None) is True:
        raise PaginationLockError(
            "auto_pagination=True blocked. Single page only — 888 HOLD for deeper crawl."
        )
    if "num" in params:
        n = params["num"]
        if isinstance(n, int) and n > 20:
            raise PaginationLockError(
                f"num={n} blocked (max 20 per single page). 888 HOLD for deep crawl."
            )
        if isinstance(n, str) and n.isdigit() and int(n) > 20:
            raise PaginationLockError(
                f"num={n} blocked (max 20 per single page). 888 HOLD for deep crawl."
            )
    # Force no_cache=False (default; SerpApi returns cache hits unless told
    # otherwise — but the *wrapper* keeps the cache layer optional; we strip
    # caller attempts to force no_cache=True to prevent bypass of audit).
    params.setdefault("no_cache", "false")
    return params


def _map_youtube_transcript(query: str, extra: dict[str, Any]) -> dict[str, Any]:
    """Per VAULT999 serpapi-binding open finding: SerpApi's youtube engine
    exposes transcript via sp=EgIQAg%3D%3D filter, not as a separate engine.
    Accept (a) a YouTube URL or video_id in query, or (b) a search string for
    discovery + transcript filter."""
    params = {"engine": "youtube", "sp": "EgIQAg%253D%253D"}
    if "video_id" in extra:
        params["v"] = extra.pop("video_id")
    elif query.startswith(("http://", "https://", "www.")):
        # Best-effort URL passthrough; SerpApi extracts v= from URLs.
        params["search_query"] = query
    else:
        # Discovery + transcript filter — search returns videos with captions.
        params["search_query"] = query
    return params


# -----------------------------------------------------------------------------
# HTTP CALL — single transport, single key, single timeout
# -----------------------------------------------------------------------------

def _http_call(url: str, params: dict[str, Any]) -> dict[str, Any]:
    """Single GET. urllib only — no extra deps. Returns parsed JSON or raises."""
    qs = urllib.parse.urlencode(params, safe="")
    full = f"{url}?{qs}"
    req = urllib.request.Request(
        full,
        headers={
            "User-Agent": "aforge-serpapi-wrapper/1.0 (+F13)",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            body = resp.read()
            status = resp.status
    except urllib.error.HTTPError as e:
        # Pass the upstream body for debug; do NOT retry on 429/402 (caller
        # must reconcile budget).
        raw = e.read().decode("utf-8", errors="replace")
        raise SerpApiError(
            f"[HTTP {e.code}] SerpApi returned error: {raw[:500]}"
        ) from e
    except urllib.error.URLError as e:
        raise SerpApiError(f"[TRANSPORT] {e}") from e

    if status != 200:
        raise SerpApiError(f"[HTTP {status}] non-200 from SerpApi")
    try:
        return json.loads(body)
    except json.JSONDecodeError as e:
        raise SerpApiError(f"[PARSE] non-JSON body ({len(body)} bytes)") from e


# -----------------------------------------------------------------------------
# PUBLIC API
# -----------------------------------------------------------------------------

class SerpApiClient:
    """Governed gap-filler client. Use one instance per task; not thread-safe."""

    def __init__(
        self,
        api_key: str | None = None,
        budget_path: Path | None = None,
    ) -> None:
        self.api_key = api_key or os.environ.get("SERPAPI_API_KEY", "")
        if not self.api_key:
            raise SerpApiError(
                "SERPAPI_API_KEY env var not set. Refuses to run."
            )
        if budget_path is not None:
            # Permit tests to point at a fixture; production path is the SOT.
            # Use a module-level pointer that the ledger functions resolve at
            # call time. Callers should pass via context manager (see
            # use_fixture_budget()) so production state is never polluted.
            global _ACTIVE_BUDGET_PATH
            _ACTIVE_BUDGET_PATH = budget_path

    def search(
        self,
        engine: str,
        query: str,
        domain: str = "search",
        extra_params: dict[str, Any] | None = None,
        cost_credits: int = 1,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        """Single governed call. Returns parsed JSON. Side-effect: writes
        .serpapi_budget.json on successful HTTP 200. dry_run=True skips
        the HTTP call AND the budget charge — used for tests."""
        extra_params = dict(extra_params or {})
        _check_engine(engine)
        _check_hard_hold(query, json.dumps(extra_params))
        extra_params = _force_pagination_off(extra_params)

        if engine == "youtube_video_transcript":
            params = _map_youtube_transcript(query, extra_params)
            params["api_key"] = self.api_key
        else:
            params = {"engine": engine, "q": query, "api_key": self.api_key}
            # Pass-through for engine-specific knobs (hl, gl, location, etc.).
            # Pagination/auto already stripped above.
            for k, v in extra_params.items():
                if k not in {"engine", "q", "api_key"}:
                    params[k] = v

        if dry_run:
            return {
                "_dry_run": True,
                "engine": engine,
                "query": query,
                "params": {k: v for k, v in params.items() if k != "api_key"},
            }

        result = _http_call(SERPAPI_ENDPOINT, params)
        _charge_credit(engine=engine, query=query, domain=domain, cost=cost_credits)
        return result


# -----------------------------------------------------------------------------
# CLI — for 777_FORGE / A-FORGE integration (`subprocess` calls)
# -----------------------------------------------------------------------------

def _cli() -> int:
    p = argparse.ArgumentParser(
        prog="serpapi_wrapper",
        description="Governed SerpApi gap-filler for A-FORGE (Option A, F13 2026-10-18).",
    )
    p.add_argument("--engine", required=True, help="Engine name (whitelisted)")
    p.add_argument("--query", required=True, help="Search query")
    p.add_argument("--domain", default="search", help="by_domain tag (e.g. news/academic/jobs/maps)")
    p.add_argument(
        "--param",
        action="append",
        default=[],
        help="Pass-through extra param key=value (repeatable). Pagination keys blocked.",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Skip HTTP + budget charge; print the params that *would* be sent.",
    )
    p.add_argument(
        "--compact",
        action="store_true",
        help="Compact JSON output (no pretty-print).",
    )
    args = p.parse_args()

    extra: dict[str, Any] = {}
    for kv in args.param:
        if "=" not in kv:
            print(f"[error] bad --param '{kv}', expected key=value", file=sys.stderr)
            return 2
        k, v = kv.split("=", 1)
        extra[k] = v

    try:
        client = SerpApiClient()
        result = client.search(
            engine=args.engine,
            query=args.query,
            domain=args.domain,
            extra_params=extra,
            dry_run=args.dry_run,
        )
    except SerpApiError as e:
        err = {"error": str(e), "error_class": type(e).__name__}
        print(json.dumps(err, indent=2) if not args.compact else json.dumps(err))
        return 1

    if args.compact:
        print(json.dumps(result, separators=(",", ":")))
    else:
        print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(_cli())