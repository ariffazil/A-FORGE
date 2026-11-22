#!/usr/bin/env python3
"""fed_route_truth — REQUESTED ROUTE != RESOLVED ROUTE, made witnessable.

FORGED 2026-11-23 · 333-AGI (FI-001) · under F13 sovereign directive
`ARIFOS::HUMAN-RETURN-FED-AAA-INIT::2026-11-23::v1.0` §"REQUIRED FED UPDATE".

WHAT THIS IS
    A READ-ONLY instrument over the FED attribution log. It answers three
    questions that the canonical plan calls constitutional but that nothing
    currently computes:

    1. REQUESTED ROUTE != RESOLVED ROUTE — what was asked for, what was
       actually served, why it fell over, what it cost, how long it took,
       and which lineage row proves it.
    2. CRITICAL INDEPENDENCE — for a verifier pair, are proposer and
       verifier genuinely independent, or do they share a failure domain?
    3. COST CARE — which lanes are dead, failing, unused, duplicated or
       disproportionately expensive.

WHAT THIS IS NOT
    It does not route. It does not judge. It does not mutate. It does not
    decide which model is constitutional. It does not open a second FED.

    Cost care is REPORT-ONLY. The already-authorised reversible policy for
    demoting a lane lives in `A-FORGE/scripts/fed_route_weights.py` (the
    FED-BIJAKSANA sentinel). This script feeds it evidence; it never edits
    the chain itself. That is deliberate: a new mutation path is a new
    authority, and authority never self-widens.

HONEST LIMITS
    The attribution log does not carry verifier CONTEXT isolation or
    MUTATION authority. Those two axes therefore report UNKNOWN unless the
    caller attests them explicitly. An independence claim is therefore never
    OBSERVED_INDEPENDENT on log evidence alone — it is UNKNOWN, honestly.

Usage:
    fed_route_truth.py --routes 20
    fed_route_truth.py --independence --verifier <lane> --proposer <lane>
    fed_route_truth.py --cost-care --days 7
    fed_route_truth.py --routes 20 --json
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import os
import sys
from datetime import datetime, timedelta, timezone

ATTR_LOG = os.environ.get(
    "FED_ATTRIBUTION_LOG", "/root/.local/share/arifos/fed_attribution_log.jsonl"
)

# ── Independence classification vocabulary (exact, per directive) ────────────
FULLY_COLLAPSED = "FULLY_COLLAPSED"
CRITICAL_OVERLAP = "CRITICAL_OVERLAP"
PARTIAL_OVERLAP = "PARTIAL_OVERLAP"
OBSERVED_INDEPENDENT = "OBSERVED_INDEPENDENT"
UNKNOWN = "UNKNOWN"

PASS = "PASS"
OVERLAP = "OVERLAP"
UNVERIFIED = "UNVERIFIED"


def read_log(path: str = ATTR_LOG, limit: int | None = None) -> list[dict]:
    rows: list[dict] = []
    if not os.path.exists(path):
        return rows
    with open(path, "r", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception:  # noqa: BLE001 — a torn tail line must not kill the read
                continue
            if isinstance(obj, dict):
                rows.append(obj)
    if limit and len(rows) > limit:
        rows = rows[-limit:]
    return rows


def _family(row: dict) -> str:
    """Provider family of a served call."""
    return (
        str(
            row.get("serving_provider")
            or row.get("provider")
            or row.get("served_group")
            or row.get("requested_model_group")
            or ""
        )
        .strip()
        .lower()
    )


def _gateway(row: dict) -> str:
    """Credential / gateway path."""
    return (
        str(
            row.get("credential_id")
            or row.get("entry_gateway")
            or row.get("routing_intermediary")
            or ""
        )
        .strip()
        .lower()
    )


def _failure_domain(row: dict) -> str:
    return str(row.get("failure_domain") or "").strip().lower()


def _host(row: dict) -> str:
    return str(row.get("api_base_host_redacted") or "").strip().lower()


def _lane_of(row: dict) -> str:
    return (
        str(
            row.get("requested_model_group")
            or row.get("requested_alias")
            or row.get("requested_model")
            or ""
        )
        .strip()
        .lower()
    )


def route_truth(rows: list[dict], n: int = 20) -> list[dict]:
    """Per-call requested vs resolved truth."""
    out = []
    for row in rows[-n:]:
        requested = str(row.get("requested_model") or row.get("requested_alias") or "")
        served = str(row.get("served_model") or "")
        out.append(
            {
                "requested_alias": row.get("requested_alias"),
                "requested_model": requested,
                "requested_model_group": row.get("requested_model_group"),
                "served_model": served,
                "upstream_model_id": row.get("upstream_model_id"),
                "served_group": row.get("served_group"),
                "substituted": bool(row.get("substituted")),
                "fallback_used": bool(row.get("fallback_used")),
                "fallback_edge_id": row.get("fallback_edge_id"),
                "fallback_reason": row.get("fallback_reason"),
                "attempted_fallbacks": row.get("attempted_fallbacks"),
                "serving_provider": row.get("serving_provider"),
                "serving_provider_confidence": row.get("serving_provider_confidence"),
                "entry_gateway": row.get("entry_gateway"),
                "failure_domain": row.get("failure_domain"),
                "attribution_status": row.get("attribution_status"),
                "response_status": row.get("response_status"),
                "finish_reason": row.get("finish_reason"),
                "latency_ms": row.get("latency_ms"),
                "actor_resolved": row.get("actor_resolved"),
                "actor_verification_state": row.get("actor_verification_state"),
                "logical_request_id": row.get("logical_request_id"),
                "trace_id": row.get("trace_id"),
                "requested_equals_served": bool(requested) and requested == served,
                "substitution_is_silent": bool(
                    row.get("substituted") and not row.get("fallback_used")
                ),
            }
        )
    return out


def classify_independence(
    proposer: dict,
    verifier: dict,
    *,
    context_isolated: bool | None = None,
    verifier_zero_mutation: bool | None = None,
) -> dict:
    """Classify the independence of a verifier against a proposer.

    Five axes, per the canonical plan's Z10:
      1. model family        2. credential/gateway path
      3. failure domain      4. context isolation
      5. zero mutation authority

    Axes 4 and 5 are NOT carried by the attribution log. They are UNVERIFIED
    unless the caller attests them. Therefore OBSERVED_INDEPENDENT is never
    claimed on log evidence alone.
    """
    pf, vf = _family(proposer), _family(verifier)
    pg, vg = _gateway(proposer), _gateway(verifier)
    pfd, vfd = _failure_domain(proposer), _failure_domain(verifier)
    ph, vh = _host(proposer), _host(verifier)

    axes = {
        "model_family": OVERLAP
        if (pf and vf and pf == vf)
        else (PASS if (pf and vf) else UNVERIFIED),
        "gateway_credential_path": (
            OVERLAP
            if (pg and vg and pg == vg)
            else (PASS if (pg and vg) else UNVERIFIED)
        ),
        "failure_domain": (
            OVERLAP
            if (pfd and vfd and pfd == vfd)
            else (PASS if (pfd and vfd) else UNVERIFIED)
        ),
        "host": OVERLAP
        if (ph and vh and ph == vh)
        else (PASS if (ph and vh) else UNVERIFIED),
        "context_isolation": (
            PASS
            if context_isolated is True
            else (OVERLAP if context_isolated is False else UNVERIFIED)
        ),
        "zero_mutation_authority": (
            PASS
            if verifier_zero_mutation is True
            else (OVERLAP if verifier_zero_mutation is False else UNVERIFIED)
        ),
    }

    observable = ("model_family", "gateway_credential_path", "failure_domain")
    overlaps = [k for k in observable if axes[k] == OVERLAP]
    passes = [k for k in observable if axes[k] == PASS]
    unverified = [k for k in observable if axes[k] == UNVERIFIED]

    if overlaps and len(overlaps) == len(observable):
        verdict = FULLY_COLLAPSED
        reason = (
            "proposer and verifier share family, credential path and failure domain"
        )
    elif "model_family" in overlaps or "failure_domain" in overlaps:
        verdict = CRITICAL_OVERLAP
        reason = (
            f"shared {', '.join(overlaps)} — not a single failure domain by default"
        )
    elif passes and not overlaps:
        if (
            axes["context_isolation"] == PASS
            and axes["zero_mutation_authority"] == PASS
        ):
            verdict = OBSERVED_INDEPENDENT
            reason = "all five axes satisfied"
        else:
            verdict = UNKNOWN
            reason = (
                "observable axes pass, but context isolation and zero mutation authority "
                "are UNVERIFIED — independence is NOT proven"
            )
    elif unverified and not overlaps:
        verdict = UNKNOWN
        reason = f"unverifiable axes: {', '.join(unverified)}"
    else:
        verdict = PARTIAL_OVERLAP
        reason = f"partial overlap on {', '.join(overlaps or ['none'])}, partial pass on {', '.join(passes or ['none'])}"

    return {
        "verdict": verdict,
        "reason": reason,
        "axes": axes,
        "proposer": {
            "lane": _lane_of(proposer),
            "family": pf,
            "gateway": pg,
            "failure_domain": pfd,
            "host": ph,
        },
        "verifier": {
            "lane": _lane_of(verifier),
            "family": vf,
            "gateway": vg,
            "failure_domain": vfd,
            "host": vh,
        },
        "shared_provider_family_is_not_automatically_one_failure_domain": True,
    }


def cost_care(rows: list[dict], days: int = 7) -> dict:
    """Dead / failing / unused / duplicated / disproportionately costly lanes.

    REPORT-ONLY. Applying a demotion is the job of the already-authorised
    `fed_route_weights.py` policy; this function supplies the evidence.

    HONEST UNKNOWN: a call whose outcome was never recorded is counted as
    UNKNOWN, never as a success and never as a failure. Counting it either
    way would manufacture a lane verdict out of a missing instrument.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    buckets: dict[str, dict] = collections.defaultdict(
        lambda: {
            "calls": 0,
            "ok": 0,
            "failed": 0,
            "unknown": 0,
            "substituted": 0,
            "substituted_status": 0,
            "families": set(),
            "gateways": set(),
            "hosts": set(),
            "latencies": [],
        }
    )
    for row in rows:
        ts = str(row.get("timestamp_utc") or row.get("timestamp") or row.get("ts")
                  or row.get("called_at") or "")
        lane = _lane_of(row)
        if not lane:
            continue
        try:
            when = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:  # noqa: BLE001
            when = None
        if when is not None and when < cutoff:
            continue
        b = buckets[lane]
        b["calls"] += 1
        status = str(row.get("response_status") or "").upper()
        if status in ("OK", "SUCCESS", "200"):
            b["ok"] += 1
        elif status == "SUBSTITUTED":
            b["ok"] += 1
            b["substituted_status"] += 1
        elif status in ("ERROR", "FAIL", "FAILED", "500", "429", "TIMEOUT", "EXCEPTION"):
            b["failed"] += 1
        else:
            b["unknown"] += 1
        if row.get("substituted"):
            b["substituted"] += 1
        if _family(row):
            b["families"].add(_family(row))
        if _gateway(row):
            b["gateways"].add(_gateway(row))
        if _host(row):
            b["hosts"].add(_host(row))
        lat = row.get("latency_ms")
        if isinstance(lat, (int, float)):
            b["latencies"].append(float(lat))

    lanes = []
    for lane, b in sorted(buckets.items()):
        known = b["ok"] + b["failed"]
        fail_pct = (100.0 * b["failed"] / known) if known else 0.0
        lat = sorted(b["latencies"])
        median = lat[len(lat) // 2] if lat else None
        flags = []
        if b["calls"] == 0:
            flags.append("unused")
        if b["calls"] and known and b["ok"] == 0:
            flags.append("dead_zero_success")
        if b["calls"] >= 5 and known and fail_pct >= 50:
            flags.append("failing")
        if b["calls"] and b["substituted"] == b["calls"]:
            flags.append("always_substituted")
        if b["calls"] and b["unknown"] == b["calls"]:
            flags.append("outcome_unattributed")
        if b["calls"] and b["substituted"] and (b["substituted"] / b["calls"]) >= 0.9:
            flags.append("mostly_substituted")
        lanes.append(
            {
                "lane": lane,
                "calls": b["calls"],
                "ok": b["ok"],
                "failed": b["failed"],
                "unknown": b["unknown"],
                "fail_pct": round(fail_pct, 2),
                "substituted": b["substituted"],
                "families": sorted(b["families"]),
                "gateways": sorted(b["gateways"]),
                "hosts": sorted(b["hosts"]),
                "median_latency_ms": median,
                "flags": flags,
            }
        )

    dupes: dict[tuple, list[str]] = collections.defaultdict(list)
    for item in lanes:
        for fam in item["families"]:
            for host in item["hosts"]:
                dupes[(fam, host)].append(item["lane"])
    duplicates = {f"{fam}@{host}": sorted(set(v)) for (fam, host), v in dupes.items() if len(set(v)) > 1}

    return {
        "window_days": days,
        "lanes": lanes,
        "duplicates": duplicates,
        "policy": ("report-only; demotion is the job of A-FORGE/scripts/fed_route_weights.py "
                   "under the existing FED-BIJAKSANA reversible policy"),
        "destructive_action": "never — quarantine or de-register, never delete",
    }

def _latest_by_lane(rows: list[dict]) -> dict[str, dict]:
    """Most recent observed row per lane (the log is append-ordered)."""
    out: dict[str, dict] = {}
    for row in rows:
        lane = _lane_of(row)
        if lane:
            out[lane] = row  # LAST row wins: the log is append-ordered
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="FED route truth + independence + cost care (read-only)"
    )
    parser.add_argument("--routes", type=int, nargs="?", const=20, default=None,
                        help="show the last N requested-vs-resolved routes")
    parser.add_argument("--independence", action="store_true",
                        help="classify the independence of a verifier against a proposer")
    parser.add_argument("--verifier", help="verifier lane name")
    parser.add_argument("--proposer", help="proposer lane name")
    parser.add_argument("--context-isolated", action="store_true",
                        help="attest that the verifier received an isolated context")
    parser.add_argument("--zero-mutation", action="store_true",
                        help="attest that the verifier holds zero mutation authority")
    parser.add_argument("--cost-care", action="store_true", help="lane health / cost care report")
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    rows = read_log()
    if not rows:
        out = {"error": "attribution log not found or empty", "path": ATTR_LOG}
        print(json.dumps(out, indent=2) if args.json else out["error"])
        return 1

    if args.independence:
        by_lane = _latest_by_lane(rows)
        proposer = by_lane.get((args.proposer or "").lower())
        verifier = by_lane.get((args.verifier or "").lower())
        if proposer is None or verifier is None:
            out = {
                "error": "proposer or verifier lane not observed in the attribution log",
                "proposer": args.proposer,
                "verifier": args.verifier,
                "observed_lanes_sample": sorted(by_lane)[:25],
            }
            print(json.dumps(out, indent=2) if args.json else out["error"])
            return 1
        result = classify_independence(
            proposer,
            verifier,
            context_isolated=True if args.context_isolated else None,
            verifier_zero_mutation=True if args.zero_mutation else None,
        )
        print(json.dumps(result, indent=2) if args.json else _fmt_independence(result))
        return 0

    if args.cost_care:
        result = cost_care(rows, days=args.days)
        if args.json:
            print(json.dumps(result, indent=2))
            return 0
        print(f"FED COST CARE — window {args.days}d · source {ATTR_LOG}")
        flagged = [item for item in result["lanes"] if item["flags"]]
        for item in flagged:
            print(f"  ! {item['lane']:28} calls={item['calls']:6} ok={item['ok']:6} "
                  f"unknown={item['unknown']:6} fail={item['fail_pct']:5.1f}% "
                  f"flags={','.join(item['flags'])}")
        if not flagged:
            print("  (no lane flagged)")
        if result["duplicates"]:
            print("  duplicate family@host groups:")
            for key, lanes in result["duplicates"].items():
                print(f"    {key}: {', '.join(lanes)}")
        print(f"  policy: {result['policy']}")
        return 0

    n = args.routes if args.routes is not None else 20
    out_rows = route_truth(rows, n=n)
    if args.json:
        print(json.dumps(out_rows, indent=2))
        return 0
    print(f"FED ROUTE TRUTH — last {len(out_rows)} calls · source {ATTR_LOG}")
    for row in out_rows:
        flag = ""
        if row["substituted"] and not row["fallback_used"]:
            flag = "  <- SILENT SUBSTITUTION"
        elif row["fallback_used"]:
            flag = f"  <- fallback: {row.get('fallback_reason')}"
        print(f"  {str(row['requested_model']):34} -> {str(row['served_model']):34} "
              f"[{str(row.get('serving_provider')):12}] {str(row.get('response_status')):6}{flag}")
    return 0


def _fmt_independence(result: dict) -> str:
    lines = [
        f"INDEPENDENCE VERDICT: {result['verdict']}",
        f"  reason: {result['reason']}",
        f"  proposer: {result['proposer']}",
        f"  verifier: {result['verifier']}",
        "  axes:",
    ]
    for axis, value in result["axes"].items():
        lines.append(f"    {axis:28} {value}")
    return "\n".join(lines)


if __name__ == "__main__":
    sys.exit(main())
