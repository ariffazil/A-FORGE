#!/usr/bin/env python3
"""eureka_ladder.py — Court of Reality actuator (A-FORGE tools).

F13 directive 2026-11-01: jadikan tiga ujian eureka sebagai MESIN.
  G1 FALSIFIER-FIRST  : tiada falsifier = doa, ditolak.
  G2 AUTHOR != JUDGE  : pemeriksa tak boleh penulis (Gödel).
  G3 DATED RE-CHECK   : tiada tarikh semakan = tiada mahkamah.

State ladder (monotonic naik, boleh turun ke REFUTED bila reality cakap):
IDEA → CANDIDATE → FALSIFIABLE → INDEPENDENTLY_TESTED → TEMPORALLY_WITNESSED
     → CONSEQUENCE_DEMONSTRATED → PROVISIONALLY_VERIFIED

Verdict labels: PRAYER / HOLD_CANDIDATE / ADVANCE / REFUTED / WITNESSED.
Tiada laluan terus ke VERIFIED. Resit hash-chained. Exit code: 0=ADVANCE/WITNESSED,
1=PRAYER, 2=HOLD, 3=REFUTED.
"""

from __future__ import annotations
import argparse, hashlib, json, sys
from datetime import date, datetime, timezone
from pathlib import Path

RECEIPTS = Path("/root/A-FORGE/receipts/eureka_ladder_receipts.jsonl")
LADDER = [
    "IDEA",
    "CANDIDATE",
    "FALSIFIABLE",
    "INDEPENDENTLY_TESTED",
    "TEMPORALLY_WITNESSED",
    "CONSEQUENCE_DEMONSTRATED",
    "PROVISIONALLY_VERIFIED",
]

REQUIRED_10 = [
    "atomic_claim",
    "known_parts",
    "new_parts",
    "evidence",
    "falsifier",
    "prediction",
    "independent_verifier",
    "reassess_date",
    "decision_if_true",
    "harm_if_false",
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds") + "Z"


def _sha(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def grade(claim: dict, author: str) -> dict:
    missing = [k for k in REQUIRED_10 if not claim.get(k)]
    g1 = bool(claim.get("falsifier")) and bool(claim.get("prediction"))
    g2 = (
        bool(claim.get("independent_verifier"))
        and claim.get("independent_verifier") != author
    )
    g3 = False
    rd = claim.get("reassess_date")
    try:
        g3 = date.fromisoformat(str(rd)[:10]) >= date.today()
    except ValueError:
        g3 = False
    answered = len(REQUIRED_10) - len(missing)
    return {
        "g1_falsifier_first": g1,
        "g2_author_ne_judge": g2,
        "g3_dated_recheck": g3,
        "questions_answered": f"{answered}/10",
        "missing_fields": missing,
    }


def decide(claim: dict, gates: dict) -> tuple[str, str]:
    if not gates["g1_falsifier_first"]:
        return (
            "PRAYER",
            "Tiada falsifier/prediksi — itu doa, bukan idea. DITOLAK dari CANDIDATE.",
        )
    if not gates["g2_author_ne_judge"]:
        return (
            "HOLD_CANDIDATE",
            "Pemeriksa = penulis (atau kosong). G2 gagal — cari saksi bebas.",
        )
    if not gates["g3_dated_recheck"]:
        return "HOLD_CANDIDATE", "Tiada tarikh semakan sah. G3 gagal — tiada mahkamah."
    return (
        "ADVANCE",
        "CANDIDATE → FALSIFIABLE. Daftar tarikh semakan; reality menentukan selepasnya.",
    )


def _append_receipt(rec: dict) -> None:
    RECEIPTS.parent.mkdir(parents=True, exist_ok=True)
    prev = ""
    if RECEIPTS.exists():
        lines = RECEIPTS.read_text().strip().splitlines()
        if lines:
            prev = _sha(lines[-1])[:16]
    rec["prev_hash"] = prev
    rec["self_hash"] = _sha(json.dumps(rec, sort_keys=True))[:16]
    with RECEIPTS.open("a") as f:
        f.write(json.dumps(rec, sort_keys=True) + "\n")


def cmd_check(args) -> int:
    claim = json.load(sys.stdin)
    author = args.author or claim.get("author", "")
    gates = grade(claim, author)
    label, reason = decide(claim, gates)
    exit_code = {
        "ADVANCE": 0,
        "WITNESSED": 0,
        "PRAYER": 1,
        "HOLD_CANDIDATE": 2,
        "REFUTED": 3,
    }[label]
    rec = {
        "ts": _now(),
        "tool": "eureka_ladder",
        "op": "check",
        "claim_id": claim.get("id", _sha(json.dumps(claim, sort_keys=True))[:12]),
        "author": author,
        "gates": gates,
        "verdict_label": label,
        "reason": reason,
        "ladder_position": LADDER[2] if label == "ADVANCE" else LADDER[1],
    }
    _append_receipt(rec)
    print(json.dumps(rec, indent=2, sort_keys=True))
    return exit_code


def cmd_recheck(args) -> int:
    claim = json.load(sys.stdin)
    outcome = (args.outcome or "").lower()
    try:
        due = date.fromisoformat(str(claim.get("reassess_date"))[:10])
    except ValueError:
        print(
            json.dumps(
                {"verdict_label": "HOLD_CANDIDATE", "reason": "reassess_date tidak sah"}
            )
        )
        return 2
    gates = grade(claim, args.author or claim.get("author", ""))
    if date.today() < due:
        label, why = (
            "HOLD_CANDIDATE",
            f"Tarikh mahkamah {due} belum tiba — SABAR, bukan verified.",
        )
    elif outcome in ("survived", "pass", "true"):
        label, why = (
            "WITNESSED",
            "Reality bersaksi: ramalan hidup. FALSIFIABLE → TEMPORALLY_WITNESSED (masih revisable).",
        )
    elif outcome in ("dead", "fail", "false"):
        label, why = (
            "REFUTED",
            "Reality kata tidak. FALSE — bukan VOID. mati dengan resit.",
        )
    else:
        label, why = (
            "HOLD_CANDIDATE",
            "Outcome tidak dinyatakan (survived|dead) — UNKNOWN.",
        )
    exit_code = {"WITNESSED": 0, "HOLD_CANDIDATE": 2, "REFUTED": 3}[label]
    rec = {
        "ts": _now(),
        "tool": "eureka_ladder",
        "op": "recheck",
        "claim_id": claim.get("id", "anon"),
        "outcome": outcome,
        "verdict_label": label,
        "reason": why,
        "gates": gates,
    }
    _append_receipt(rec)
    print(json.dumps(rec, indent=2, sort_keys=True))
    return exit_code


def cmd_selftest(_) -> int:
    full = {
        "id": "fx-1",
        "atomic_claim": "X menyebabkan Y pada P>0.9",
        "known_parts": "X diketahui",
        "new_parts": "hubungan X→Y",
        "evidence": "dataset D",
        "falsifier": "Ukuran bebas Z menunjukkan tiada Y",
        "prediction": "Eksperimen E memberi Y pada 2027-Q1",
        "independent_verifier": "lab-luar",
        "reassess_date": "2027-01-15",
        "decision_if_true": "tukar protokol",
        "harm_if_false": "kos ujian",
    }
    prayer = dict(full, falsifier="", prediction="")
    selfjudge = dict(full, independent_verifier="333-AGI")
    cases = [
        ("full-pass", full, "333-AGI", 0, "ADVANCE"),
        ("prayer-no-falsifier", prayer, "333-AGI", 1, "PRAYER"),
        ("self-judged", selfjudge, "333-AGI", 2, "HOLD_CANDIDATE"),
    ]
    ok = True
    print("EUREKA LADDER selftest — tiga ujian sebagai mesin:")
    for name, c, a, want_code, want_label in cases:
        gates = grade(c, a)
        label, reason = decide(c, gates)
        good = label == want_label
        ok &= good
        print(f"  {'PASS' if good else 'FAIL'}  {name:22s} -> {label} ({reason[:58]})")
    print(
        f"LADDER: {'3/3 PASS' if ok else 'FAIL'} — tiada laluan IDEA→SEAL wujud dalam kod."
    )
    return 0 if ok else 9


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Eureka Ladder — court of reality actuator"
    )
    sub = ap.add_subparsers(dest="cmd", required=True)
    p1 = sub.add_parser("check")
    p1.add_argument("--author")
    p1.set_defaults(fn=cmd_check)
    p2 = sub.add_parser("recheck")
    p2.add_argument("--author")
    p2.add_argument("--outcome")
    p2.set_defaults(fn=cmd_recheck)
    p3 = sub.add_parser("selftest")
    p3.set_defaults(fn=cmd_selftest)
    a = ap.parse_args()
    sys.exit(a.fn(a))


if __name__ == "__main__":
    main()
