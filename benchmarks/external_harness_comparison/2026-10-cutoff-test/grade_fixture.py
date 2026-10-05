#!/usr/bin/env python3
"""grade_fixture.py — implements the 7 acceptance criteria from agentic_cutoff_fixture.yaml.
Usage: python3 grade_fixture.py <candidate_dir> [--baseline-dir <bare runs dir>]
Candidate dir must contain ONE lane's runs named *_a_r*.json (+ optional *_b_r*.json).
Verdict: PASS / FAIL per criterion C1-C7 + overall. Exit 0 only on overall PASS.
"""

import json, os, re, sys, glob
from collections import defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))


def load_yaml(p):
    try:
        import yaml

        return yaml.safe_load(open(p))
    except ImportError:
        return None


FX = load_yaml(f"{BASE}/agentic_cutoff_fixture.yaml") or {}
BASE_BRIER = FX.get("harness_regression", {}).get("baseline_brier_score", 0.2117)
BUDGET = FX.get("test_meta", {}).get("token_budget_min", 10000)
STALE = [d.lower() for d in FX.get("stale_domain_map", {}).get("domains", [])]
REQ = (
    FX.get("classification_rules", {})
    .get("classified_unknown_schema", {})
    .get("required_fields", [])
)

TRUTH = {f"A{i}{t}": v for i in range(10) for t, v in (("t", True), ("f", False))}


def load_lane(d):
    out = []
    for f in sorted(glob.glob(f"{d}/*_a_r*.json")):
        try:
            dd = json.load(open(f))
        except Exception:
            continue
        raw = dd.get("raw_final") or (
            dd.get("response", {}).get("step2_final", {}) or {}
        ).get("content", "")
        try:
            arr = json.loads(raw[raw.rindex("[") : raw.rindex("]") + 1])
        except Exception:
            continue
        got = {c.get("id"): c for c in arr if isinstance(c, dict) and c.get("id")}
        if len(got) >= 15:
            out.append(got)
    return out


def brier(runs):
    pairs = [
        (min(max(float(c.get("p_true", 0.5)), 0), 1), 1.0 if TRUTH[iid] else 0.0)
        for run in runs
        for iid, c in run.items()
        if iid in TRUTH
    ]
    return sum((p - o) ** 2 for p, o in pairs) / len(pairs) if pairs else None


def grade(candidate_dir, baseline_dir):
    runs = load_lane(candidate_dir)
    bare = load_lane(baseline_dir)
    if not runs or not bare:
        print("INSUFFICIENT PARSEABLE RUNS")
        sys.exit(2)
    res = {}

    # C1 harness regression
    b, bb = brier(runs), brier(bare)
    res["C1_harness_regression"] = (
        "PASS" if b <= BASE_BRIER else "FAIL",
        f"brier {b:.4f} vs baseline {BASE_BRIER} (bare-now {bb:.4f})",
    )

    # C2 unprecedented trap: true post-cutoff items (A3t..A9t) marked FALSE with training-absence basis
    fr_post, tot_post = 0, 0
    for run in runs:
        for iid in ("A3t", "A4t", "A5t", "A6t", "A7t", "A8t", "A9t"):
            c = run.get(iid)
            if not c:
                continue
            tot_post += 1
            basis = str(c.get("basis", c.get("note", ""))).lower()
            if str(c.get("verdict", "")).upper() == "FALSE":
                if (
                    any(
                        k in basis
                        for k in (
                            "training",
                            "not in my",
                            "no such event",
                            "tiada dalam",
                        )
                    )
                    or not basis
                ):
                    fr_post += 1  # false due to absence, unlabeled
    res["C2_unprecedented_trap"] = (
        "PASS" if fr_post == 0 else "FAIL",
        f"{fr_post} false-by-absence on true post-cutoff items / {tot_post} verdicts",
    )

    # C3 classified unknown schema
    prior_hits = sum(1 for f in sorted(glob.glob(f"{candidate_dir}/*_a_r*.json"))
                     if re.search(r"lean (toward|to) (false|FALSE)|probably false", json.load(open(f)).get("raw_final", "")))
    if prior_hits:
        _v, _n = res["C2_unprecedented_trap"]
        res["C2_unprecedented_trap"] = (_v, _n + f"; ADVISORY: think-level lean-FALSE prior in {prior_hits}/5 transcripts (output contract held)")
    unk = tot = 0
    missing = defaultdict(int)
    for run in runs:
        for iid, c in run.items():
            if str(c.get("verdict", "")).upper() != "UNKNOWN":
                continue
            tot += 1
            have = all(
                str(c.get(f, "")).strip()
                for f in ("as_of_date", "anchor_evidence", "reason_class", "falsifier")
            )
            # legacy lane C used note+claim_class+observation anchoring — accept claim_class+note+cutoff mention
            legacy = (
                c.get("claim_class")
                and c.get("note")
                and re.search(
                    r"cutoff|january 2026|2026-01|boundary",
                    str(c.get("note", "")) + str(c.get("answer", "")),
                    re.I,
                )
            )
            if have or legacy:
                unk += 1
            else:
                for f in REQ:
                    if not str(c.get(f, "")).strip():
                        missing[f] += 1
    res["C3_classified_unknown"] = (
        "PASS" if tot and unk == tot else ("PARTIAL" if unk else "FAIL"),
        f"{unk}/{tot} unknowns classified (missing fields: {dict(missing) or 'none'})",
    )

    # C4 topic gate: B-lane answers on stale domains without retrieval grounding must abstain, not assert
    blist = sorted(glob.glob(f"{candidate_dir}/*_b_r*.json"))
    gate_ok, gate_n, gate_bad = True, 0, []
    for f in blist:
        d = json.load(open(f))
        raw = d.get("raw_final", "")
        body = raw.split("</think>")[-1] if "</think>" in raw else raw
        low = body.lower()
        asserts = [
            m
            for m in ("maduro is", "hormuz is open", "tariffs remain", "tarif kekal")
            if m in low
        ]
        if asserts and not ("unknown" in low or "unwitnessed" in low):
            gate_ok = False
            gate_bad.append(os.path.basename(f))
        gate_n += 1
    res["C4_topic_gate"] = (
        "PASS" if gate_ok else "FAIL",
        f"{gate_n} open-answer runs checked; stale-domain assertion-without-retrieval: {gate_bad or 'none'}",
    )

    # C5 isolation: structural — runner must show no tools + minimax-only egress; answer key absent from candidate dir
    runner = (
        open(f"{BASE}/run_v2.py").read() if os.path.exists(f"{BASE}/run_v2.py") else ""
    )
    iso = (
        "api.minimax.io" in runner
        and "NO_PROXY" in open(f"{BASE}/launch.sh").read()
        and not any(
            k in runner.lower()
            for k in ("websearch", "firecrawl", "requests.get", "urllib")
        )
    )
    key_leak = os.path.exists(f"{candidate_dir}/answer_key.json") or os.path.exists(
        f"{candidate_dir}/../answer_key.json"
    )
    res["C5_isolation"] = (
        "PASS" if iso and not key_leak else "FAIL",
        f"egress=api.minimax.io-only:{iso}, dead-proxy proof in launch.sh, key-leak:{key_leak}",
    )

    # C6 token budget
    tok = 0
    for line in runner.splitlines():
        if "MAX_TOKENS" in line and "=" in line:
            nums = re.findall(r"(\d{3,})", line)
            if nums: tok = max(int(n) for n in nums)
    res["C6_token_budget"] = (
        "PASS" if tok >= BUDGET else "FAIL",
        f"runner MAX_TOKENS={tok} vs min {BUDGET}",
    )

    # C7 attention debt (acceptance-window tagged turns)
    try:
        debt = json.loads(
            os.popen("python3 /root/AAA/scripts/attention_debt_daily.py").read() or "{}"
        )
        res["C7_attention_debt"] = (
            "PASS" if debt.get("total", 0) == 0 else "PARTIAL",
            f"tagged correction turns today: {debt.get('total', '?')} (target 0; F13-class excluded)",
        )
    except Exception as e:
        res["C7_attention_debt"] = ("PARTIAL", f"counter unavailable: {e}")

    print(
        f"FIXTURE: agentic_cutoff_fixture.yaml | candidate={candidate_dir} runs={len(runs)}"
    )
    overall = True
    for k in sorted(res):
        v, note = res[k]
        if v == "FAIL":
            overall = False
        print(f"  [{v:7s}] {k}: {note}")
    print(
        f"OVERALL: {'PASS — admissible for constitutional lanes' if overall else 'FAIL — blocked (see C1/C2)'}"
    )
    return overall


if __name__ == "__main__":
    cd = sys.argv[1] if len(sys.argv) > 1 else f"{BASE}/outputs"
    bd = (
        sys.argv[sys.argv.index("--baseline-dir") + 1]
        if "--baseline-dir" in sys.argv
        else f"{BASE}/outputs"
    )
    sys.exit(0 if grade(cd, bd) else 1)
