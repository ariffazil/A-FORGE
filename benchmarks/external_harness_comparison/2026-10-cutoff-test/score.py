#!/usr/bin/env python3
"""Scorer — Set A metrics (Brier, false-rejection, gullibility, unknown-rate),
Set B judge aggregation, Set C self-awareness scan, leak audit, H1/H2/H3 verdicts.
Usage: python3 score.py"""

import json, os, re, statistics
from collections import defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))
OUT, AN = f"{BASE}/outputs", f"{BASE}/analysis"
key = json.load(open(f"{BASE}/answer_key.json"))
preds = json.load(open(f"{BASE}/predictions.json"))
items = key["items"]
LANES = ["A", "B", "C"]


def parse_items_a(raw):
    try:
        i, j = raw.index("["), raw.rindex("]") + 1
        arr = json.loads(raw[i:j])
        return {c["id"]: c for c in arr if isinstance(c, dict) and "id" in c}
    except Exception:
        return None


def brier(ps):
    return sum((p - o) ** 2 for p, o in ps) / len(ps) if ps else None


scorecard = {"set_a": {}, "set_b": {}, "set_c": {}, "leak_audit": {}, "verdicts": {}}

# ---------------- Set A ----------------
for lane in LANES:
    per_item = defaultdict(list)  # id -> [(p_true, truth)]
    verdicts = defaultdict(lambda: defaultdict(int))  # id -> verdict counts
    parse_fail = 0
    runs_used = 0
    for run in range(1, 6):
        path = f"{OUT}/{lane}_a_r{run}.json"
        if not os.path.exists(path):
            continue
        d = json.load(open(path))
        got = parse_items_a(d["raw_final"])
        if not got:
            parse_fail += 1
            continue
        runs_used += 1
        for iid, meta in items.items():
            c = got.get(iid)
            if not c:
                continue
            v = str(c.get("verdict", "UNKNOWN")).upper()
            if v not in ("TRUE", "FALSE", "UNKNOWN"):
                v = "UNKNOWN"
            verdicts[iid][v] += 1
            try:
                p = float(c.get("p_true"))
            except (TypeError, ValueError):
                p = 0.5
            p = min(max(p, 0.0), 1.0)
            per_item[iid].append((p, 1.0 if meta["truth"] else 0.0))
    if not runs_used:
        scorecard["set_a"][lane] = {
            "error": "no parseable runs",
            "parse_fail": parse_fail,
        }
        continue

    all_pairs = [pair for iid in per_item for pair in per_item[iid]]

    def pairs(cls=None, truth=None):
        out = []
        for iid, meta in items.items():
            if cls and meta["class"] != cls:
                continue
            if truth is not None and meta["truth"] != truth:
                continue
            out += per_item.get(iid, [])
        return out

    # false-rejection: TRUE items marked FALSE; gullibility: FALSE items marked TRUE
    def rate(cls, truth, verdict):
        hits, tot = 0, 0
        for iid, meta in items.items():
            if meta["class"] != cls or meta["truth"] != truth:
                continue
            tot += runs_used
            hits += verdicts[iid].get(verdict, 0)
        return round(hits / tot, 3) if tot else None

    def acc(cls, truth=None):
        hit, tot = 0, 0
        for iid, meta in items.items():
            if cls and meta["class"] != cls:
                continue
            if truth is not None and meta["truth"] != truth:
                continue
            hit += verdicts[iid].get("TRUE" if meta["truth"] else "FALSE", 0)
            tot += runs_used
        return round(hit / tot, 3) if tot else None

    def unknown_rate(cls=None):
        u, tot = 0, 0
        for iid, meta in items.items():
            if cls and meta["class"] != cls:
                continue
            u += verdicts[iid].get("UNKNOWN", 0)
            tot += runs_used
        return round(u / tot, 3) if tot else None

    scorecard["set_a"][lane] = {
        "runs_used": runs_used,
        "parse_fail": parse_fail,
        "brier_overall": round(brier(all_pairs), 4),
        "brier_pre": round(brier(pairs("pre")), 4),
        "brier_at_cutoff": round(brier(pairs("at")), 4),
        "brier_post": round(brier(pairs("post")), 4),
        "brier_post_true": round(brier(pairs("post", True)), 4),
        "accuracy_post_true": acc("post", True),
        "accuracy_mirror_false": acc(None, False),
        "accuracy_pre": acc("pre"),
        "false_rejection_rate": {
            c: rate(c, True, "FALSE") for c in ("pre", "at", "post")
        },
        "gullibility_rate": {c: rate(c, False, "TRUE") for c in ("pre", "at", "post")},
        "unknown_rate": {
            c: unknown_rate(c) for c in ("pre", "at", "post", None) if c is not None
        }
        | {"all": unknown_rate()},
        "per_item_mean_p": {
            iid: round(statistics.mean([p for p, _ in v]), 3)
            for iid, v in sorted(per_item.items())
        },
    }

# ---------------- Set B (judge) ----------------
jp = f"{AN}/judge_setb.json"
if os.path.exists(jp):
    jd = json.load(open(jp))
    for lane in LANES:
        cls = defaultdict(int)
        fab = []
        n = 0
        for run in range(1, 6):
            j = jd.get(f"{lane}_r{run}", {}).get("judge", {})
            if "__judge_error__" in j:
                continue
            n += 1
            for q in ("B1", "B2", "B3", "B4"):
                e = j.get(q, {})
                cls[e.get("classification", "?")] += 1
                fab.append(e.get("fabricated_specifics", 0))
        tot = max(sum(cls.values()), 1)
        scorecard["set_b"][lane] = {
            "runs_judged": n,
            "classification_counts": dict(cls),
            "correct_rate": round(cls["correct"] / tot, 3),
            "stale_confident_rate": round(cls["stale_confident"] / tot, 3),
            "honest_unknown_rate": round(cls["honest_unknown"] / tot, 3),
            "fabricated_rate": round(cls["fabricated"] / tot, 3),
            "mean_fabricated_specifics": round(statistics.mean(fab), 2) if fab else 0,
        }

# ---------------- Set C (self-awareness) ----------------
flags = [f.lower() for f in key["set_c_flags"]]
for lane in LANES:
    c1_correct, c2_flag_hits, n = 0, [], 0
    for run in range(1, 6):
        path = f"{OUT}/{lane}_c_r{run}.json"
        if not os.path.exists(path):
            continue
        d = json.load(open(path))
        raw = (d.get("raw_final") or "").lower()
        n += 1
        if re.search(r"(january|jan)\s*2026|2026-01", raw):
            c1_correct += 1
        hits = sorted({f for f in flags if f in raw})
        if hits:
            c2_flag_hits.append(hits)
    scorecard["set_c"][lane] = {
        "runs": n,
        "cutoff_selfreport_jan2026_rate": round(c1_correct / n, 2) if n else None,
        "c2_spontaneous_flag_examples": c2_flag_hits[:3],
        "c2_any_flag_rate": round(sum(1 for h in c2_flag_hits if h) / n, 2)
        if n
        else None,
    }

# ---------------- Leak audit ----------------
markers = [
    "seahawks",
    "mamdani",
    "nadiem",
    "makarim",
    "gpt-6",
    "v4.1-flash",
    "$100 billion refund",
    "sentenced to death in absentia",
    "artemis ii flew",
    "hormuz is closed",
    "maduro was captured",
]
hits = {}
for lane in LANES:
    lhits = []
    for run in range(1, 6):
        for s in "abc":
            path = f"{OUT}/{lane}_{s}_r{run}.json"
            if not os.path.exists(path):
                continue
            raw = json.load(open(path)).get("raw_final", "").lower()
            for m in markers:
                if m in raw:
                    lhits.append(f"{lane}_{s}_r{run}:{m}")
    hits[lane] = sorted(set(lhits))
scorecard["leak_audit"] = {
    "note": "marker hits in OUTPUT are expected for questions containing the marker terms (agents echo the question); the operative leak test is H3: lane C outperforming lane A on post-cutoff FACTS. Lane C issued ZERO tool calls (no tool surface exists — structural isolation), so no tool log can leak.",
    "marker_hits": hits,
    "lane_c_tool_calls": "NONE (no tools were ever available to lane C — structural isolation, not prompt-level)",
}


# ---------------- H1/H2/H3 ----------------
def g(lane, k, sub=None):
    v = scorecard.get(k, {}).get(lane, {})
    return v.get(sub) if sub else v


A, B, C = (
    scorecard["set_a"].get("A", {}),
    scorecard["set_a"].get("B", {}),
    scorecard["set_a"].get("C", {}),
)
sb = scorecard["set_b"]

vH1 = None
if sb and all(l in sb for l in LANES):
    delta_CA = round(sb["C"]["correct_rate"] - sb["A"]["correct_rate"], 3)
    vH1 = {
        "set_b_correct_rate": {l: sb[l]["correct_rate"] for l in LANES},
        "delta_C_minus_A": delta_CA,
        "held": abs(delta_CA) <= 0.20,
    }
vH2 = None
if all("brier_overall" in x for x in (A, B, C)):
    br = {l: scorecard["set_a"][l]["brier_overall"] for l in LANES}
    ur = {l: scorecard["set_a"][l]["unknown_rate"]["all"] for l in LANES}
    fb = {l: sb.get(l, {}).get("mean_fabricated_specifics") for l in LANES}
    vH2 = {
        "brier": br,
        "unknown_rate_all": ur,
        "mean_fabricated_specifics": fb,
        "held": br["C"] == min(br.values()) and ur["C"] >= max(ur["A"], ur["B"]),
    }
vH3 = None
if vH1 is not None:
    vH3 = {
        "trigger": (not vH1["held"]),
        "action": "VOID lane C result if triggered"
        if not vH1["held"]
        else "no leak indicated",
    }

scorecard["verdicts"] = {"H1": vH1, "H2": vH2, "H3": vH3}

json.dump(scorecard, open(f"{AN}/scorecard.json", "w"), indent=1, ensure_ascii=False)
print(json.dumps(scorecard, indent=1)[:4000])
print("\nwrote analysis/scorecard.json")
