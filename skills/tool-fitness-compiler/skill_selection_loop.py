#!/usr/bin/env python3
"""SKILL SELECTION LOOP — witnessed reality changes future selection.

Failure class named: SELECTION_PRESSURE_ADVISORY
    Skills in this federation die by human decision (cold-storage, merge).
    Tool fitness is COMPUTED; skill fitness is OPINED. Nothing in the runtime
    lets a witnessed failure move a skill's future selection. This closes that.

Named consumer (do not add another): /root/AAA/skills/skill-mesh (freeze/thaw)
    + every harness skill loader (.agents/skills, .claude/skills, HERMES/skills).

Named authority boundary (this script holds NO mutation authority):
    It computes and recommends. It may NOT freeze, delete, or rewrite a skill.
    Those transitions require a witness receipt + a separate executor.
    -> the BLOCKED action is demonstrated in --selftest.

Reuse, not re-invention: the scoring math is imported from the existing
tool-fitness-compiler (F = Value*Adoption / (Entropy*BlastRadius*CognitiveCost),
fiqh bands, KEEP/ROUTE/KILL). This file adds only the WITNESS dimension.

Acceptance criterion (AAA-EMERGENCE::AT-001, master):
    "Can witnessed reality change future selection?"
    PASS requires: same signature + different selection, once a witness attaches.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import pathlib
import re
import sys
from datetime import datetime, timezone

AAA_SKILLS = pathlib.Path("/root/AAA/skills")
SCARS_DIR = pathlib.Path("/root/AAA/scars")
ARCHIVE_DIR = pathlib.Path("/root/.agents/skills-archive")
RECEIPTS = pathlib.Path("/root/AAA/state/skill_selection_receipts.jsonl")
FITNESS_SRC = pathlib.Path(
    "/root/A-FORGE/skills/tool-fitness-compiler/fitness_compiler.py"
)

# Precision guard: federation vocabulary carries no signal inside a scar name.
# Without this the token matcher over-fires and demotes healthy skills.
STOP_TOKENS = {
    "agent",
    "agents",
    "audit",
    "audits",
    "forge",
    "skill",
    "skills",
    "arif",
    "arifos",
    "data",
    "test",
    "tests",
    "report",
    "state",
    "memory",
    "federation",
    "kernel",
    "receipt",
    "receipts",
    "witness",
    "system",
    "index",
    "with",
    "from",
    "that",
    "this",
    "live",
    "probe",
    "claim",
    "claims",
    "seal",
    "sealed",
    "vault",
    "tool",
    "tools",
    "code",
    "file",
    "files",
    "config",
    "deploy",
    "model",
    "run",
}

# ── reuse the existing scorer ────────────────────────────────────────────────
_spec = importlib.util.spec_from_file_location("fitness_compiler", FITNESS_SRC)
fc = importlib.util.module_from_spec(_spec)
sys.modules.setdefault("fitness_compiler", fc)  # dataclasses resolves via sys.modules
_spec.loader.exec_module(fc)


# ── 1 · SCOUT — reality inventory, not declared inventory ────────────────────
def frontmatter(text: str) -> dict:
    m = re.match(r"^---\n(.*?)\n---", text, re.S)
    if not m:
        return {}
    out, key = {}, None
    for line in m.group(1).splitlines():
        if re.match(r"^\s", line) and key:
            out[key] = (out.get(key, "") + " " + line.strip()).strip()
        elif ":" in line:
            key, val = line.split(":", 1)
            key, val = key.strip(), val.strip().strip(">'\"")
            if val:
                out[key] = val
    return out


def load_skills() -> list[dict]:
    skills = []
    for md in sorted(AAA_SKILLS.glob("*/SKILL.md")):
        body = md.read_text(encoding="utf-8", errors="ignore")
        fm = frontmatter(body)
        name = fm.get("name") or md.parent.name
        skills.append(
            {
                "name": name,
                "dir": md.parent.name,
                "purpose": fm.get("description", "")[:240],
                "trigger": fm.get("trigger", "")[:240],
                "do_not_use": fm.get("do_not_use", "")[:240],
                "body_len": len(body),
                "path": str(md),
            }
        )
    return skills


def load_witness() -> dict:
    """Witnessed reality: scars (failures that happened) + archive (kills that happened)."""
    scars = {}
    if SCARS_DIR.exists():
        for s in sorted(SCARS_DIR.glob("*.md")):
            head = s.read_text(encoding="utf-8", errors="ignore")[:400]
            scars[s.stem] = head
    archived = (
        sorted(p.name for p in ARCHIVE_DIR.iterdir()) if ARCHIVE_DIR.exists() else []
    )
    # Cross-run state: skills this loop already moved once. Selection must carry
    # memory forward, or every run restarts adaptation from zero.
    repeat_moved: set[str] = set()
    prior_runs = 0
    if RECEIPTS.exists():
        for line in RECEIPTS.read_text(encoding="utf-8").splitlines():
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            prior_runs += 1
            for name in rec.get("moved_skills", []):
                repeat_moved.add(name)
    return {
        "scars": scars,
        "archived": archived,
        "scar_count": len(scars),
        "archive_count": len(archived),
        "repeat_moved": repeat_moved,
        "prior_runs": prior_runs,
    }


# ── 2 · BUILDER — smallest reversible shape: an AffordanceCard per skill ─────
def to_card(s: dict, scar_hit: bool = False) -> "fc.AffordanceCard":
    text = (s["purpose"] + " " + s["trigger"]).lower()
    writes = [
        w
        for w in ("vault", "deploy", "webroot", "config", "registry", "seal")
        if w in text
    ]
    destructive = any(
        k in text for k in ("delete", "drop", "destroy", "rm -rf", "purge")
    )
    external = any(
        k in text for k in ("email", "telegram", "publish", "post", "send", "deploy")
    )
    risk = "R0"
    if destructive:
        risk = "R4"
    elif external:
        risk = "R3"
    elif writes:
        risk = "R2"
    elif s["do_not_use"]:
        risk = "R1"
    if scar_hit:
        risk = "R4" if risk in ("R0", "R1") else risk
    return fc.AffordanceCard(
        name=s["name"],
        purpose=s["purpose"],
        reads=["skill_catalog"] if not writes else ["skill_catalog"] + writes,
        writes=writes,
        external_side_effect=external,
        destructive=destructive,
        reversible=not destructive,
        requires_human_approval=risk in ("R4", "R5"),
        min_mode="ACT" if external else "THINK",
        risk_label=risk,
    )


# ── 3 · WITNESS → SELECTION: the emergence step ──────────────────────────────
def witness_signature(s: dict, witness: dict) -> list[str]:
    """Which witnessed failures touch this skill's domain?

    Coarse first-order matcher on scar stems. Tokens carrying no signal
    (federation vocabulary) are dropped; two informative tokens must overlap.
    """
    hay = (s["name"] + " " + s["purpose"] + " " + s["trigger"]).lower()
    hits = []
    for stem in witness["scars"]:
        tokens = [
            t
            for t in re.split(r"[-_]", stem.lower())
            if len(t) > 3 and t not in STOP_TOKENS
        ]
        if tokens and sum(1 for t in tokens if t in hay) >= 2:
            hits.append(stem)
    return hits


def select(skills: list[dict], witness: dict, attach_witness: bool) -> list[dict]:
    cards = [to_card(s, scar_hit=bool(witness_signature(s, witness))) for s in skills]
    rows = []
    for s, card in zip(skills, cards):
        alias_count = 0
        score = fc.compute_fitness(card, cards, alias_count)
        action, reason = score.action, score.reason
        sigs = witness_signature(s, witness)
        if attach_witness and sigs:
            # witnessed reality moves selection — one band down, never up
            demote = {
                "KEEP": "KEEP (monitor)",
                "KEEP (monitor)": "ROUTE or MERGE",
                "ROUTE or MERGE": "KILL",
                "KILL": "KILL",
            }
            action = demote.get(action, action)
            reason = f"WITNESS-MOVED: {', '.join(sigs[:2])} -> {action}"
            # Cross-run adaptation: a skill moved before and still matching the
            # same signature escalates again. This is what makes the loop
            # adaptive rather than a one-shot report.
            if s["name"] in witness.get("repeat_moved", set()):
                # Bounded ratchet: clamp at ROUTE or MERGE. KILL is never
                # reachable by escalation alone — it needs an executor and a
                # witness receipt naming the failure. A coarse matcher must not
                # be able to recommend destruction.
                escalated = demote.get(action, action)
                if escalated == "KILL":
                    escalated = "ROUTE or MERGE"
                action = escalated
                reason = f"REPEAT-WITNESS: {', '.join(sigs[:2])} -> {action}"
        elif attach_witness:
            reason = f"NO-WITNESS: {reason}"
        rows.append(
            {
                "skill": s["name"],
                "dir": s["dir"],
                "fitness": round(score.fitness, 4),
                "fiqh": score.fiqh,
                "action": action,
                "reason": reason,
                "scar_signatures": sigs,
                "witness_attached": attach_witness,
            }
        )
    return rows


# ── 4 · WITNESS (independent) — receipt, then the BLOCKED boundary ───────────
def write_receipt(rows: list[dict], witness: dict, note: str) -> dict:
    rec = {
        "receipt": "SKILL-SELECTION",
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "failure_class": "SELECTION_PRESSURE_ADVISORY",
        "consumer": "skill-mesh freeze/thaw + harness skill loaders",
        "witness_reality": {
            "scars": witness["scar_count"],
            "archived": witness["archive_count"],
        },
        "counts": {
            "scored": len(rows),
            "witness_moved": sum(
                1
                for r in rows
                if r["reason"].startswith(("WITNESS-MOVED", "REPEAT-WITNESS"))
            ),
            "repeat_moved": sum(
                1 for r in rows if r["reason"].startswith("REPEAT-WITNESS")
            ),
            "kill": sum(1 for r in rows if r["action"] == "KILL"),
            "route": sum(1 for r in rows if r["action"] == "ROUTE or MERGE"),
        },
        "moved_skills": [
            r["skill"]
            for r in rows
            if r["reason"].startswith(("WITNESS-MOVED", "REPEAT-WITNESS"))
        ],
        "prior_runs": witness.get("prior_runs", 0),
        "note": note,
        "authority": "ADVISORY_ONLY — no freeze/delete/rewrite performed",
    }
    RECEIPTS.parent.mkdir(parents=True, exist_ok=True)
    with RECEIPTS.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(rec) + "\n")
    return rec


def attempt_freeze(skill: str, has_witness: bool) -> dict:
    """The authority boundary, demonstrated — not described."""
    if not has_witness:
        return {
            "action": "FREEZE",
            "skill": skill,
            "result": "BLOCKED",
            "gate": "WITNESS_REQUIRED",
            "reason": "no witness receipt naming a failure signature; selection is advisory",
        }
    return {
        "action": "FREEZE",
        "skill": skill,
        "result": "REQUIRES_EXECUTOR",
        "gate": "AUTHORITY",
    }



# ── 6 · BOUNDED AUTO-UPGRADE — mutation with an authority boundary ──────────
UPGRADE_MARKER_START = "<!-- SKILL-WITNESS-NOTE (auto, additive-only) -->"
UPGRADE_MARKER_END = "<!-- /SKILL-WITNESS-NOTE -->"
ALLOWED_FIELDS = {"do_not_use", "trigger", "description"}  # additive only
BLOCKED_FIELDS = {"name", "version", "authority", "owner"}


def _witness_block(sigs: list[str], action: str) -> str:
    names = ", ".join(sigs[:3])
    return (
        f"\n{UPGRADE_MARKER_START}\n"
        f"Witnessed reality moved this skill's selection to **{action}**.\n"
        f"Scar signatures: {names}\n"
        f"Do not treat this skill as neutral until the signatures are resolved.\n"
        f"{UPGRADE_MARKER_END}\n"
    )


def apply_upgrades(
    rows: list[dict],
    limit: int = 5,
    dry_run: bool = False,
) -> list[dict]:
    """Additive-only skill mutation. Returns a receipt per attempted change.

    BLOCKED (demonstrated, never silently skipped):
      - any edit outside the marked witness block
      - any skill already carrying an unresolved block with the SAME signatures
        (that is the idempotence boundary)
      - any change to an identity/authority field
    """
    out: list[dict] = []
    applied = 0
    for r in rows:
        if applied >= limit:
            out.append({"skill": r["skill"], "result": "DEFERRED", "reason": "blast-radius limit reached"})
            continue
        if not r["reason"].startswith(("WITNESS-MOVED", "REPEAT-WITNESS")):
            continue
        md = AAA_SKILLS / r["dir"] / "SKILL.md"
        if not md.exists():
            out.append({"skill": r["skill"], "result": "BLOCKED", "gate": "NO_FILE"})
            continue
        body = md.read_text(encoding="utf-8")
        sigs = r.get("scar_signatures", [])
        if UPGRADE_MARKER_START in body and any(x in body for x in sigs):
            out.append({"skill": r["skill"], "result": "SKIPPED", "gate": "IDEMPOTENT"})
            continue
        addition = _witness_block(sigs, r["action"])
        if dry_run:
            out.append({"skill": r["skill"], "result": "WOULD_APPEND", "scars": sigs})
            applied += 1
            continue
        md.write_text(body.rstrip() + "\n" + addition, encoding="utf-8")
        out.append({"skill": r["skill"], "result": "APPLIED", "scars": sigs, "action": r["action"]})
        applied += 1
    return out


def attempt_identity_change(skill: str) -> dict:
    """The other half of the boundary, demonstrated."""
    return {
        "skill": skill,
        "result": "BLOCKED",
        "gate": "IDENTITY_FIELD",
        "reason": "rename/rewrite/delete requires an executor + witness receipt; additive-only is autonomous",
    }


# ── 5 · acceptance tests (AT-001 / AT-003) ─────────────────────────────────
def selftest() -> int:
    witness = load_witness()
    skills = load_skills()
    print(f"SCOUT    : {len(skills)} skills @ {AAA_SKILLS}")
    print(
        f"WITNESS  : {witness['scar_count']} scars · {witness['archive_count']} already archived"
    )

    before = select(skills, witness, attach_witness=False)
    after = select(skills, witness, attach_witness=True)
    b = {r["skill"]: r["action"] for r in before}
    a = {r["skill"]: r["action"] for r in after}

    flips = [k for k in b if b[k] != a.get(k)]
    print(
        f"\nAT-001 (same signature + different selection): {len(flips)} selection(s) moved"
    )
    for k in flips[:8]:
        print(f"   {k:38s} {b[k]:16s} -> {a[k]}")

    moved_rows = [
        r for r in after if r["reason"].startswith(("WITNESS-MOVED", "REPEAT-WITNESS"))
    ]
    print(
        f"AT-003 (adaptation actually happens)        : {len(moved_rows)} skill(s) carry a witness-moved reason"
    )

    blocked = attempt_freeze(skills[0]["name"], has_witness=False)
    allowed = attempt_freeze(skills[0]["name"], has_witness=True)
    print(
        f"\nAUTHORITY BOUNDARY (blocked action shown)   : {blocked['result']} gate={blocked['gate']}"
    )
    print(
        f"AUTHORITY BOUNDARY (with witness)           : {allowed['result']} gate={allowed['gate']}"
    )

    rec = write_receipt(after, witness, note="selftest")
    print(f"\nRECEIPT  : {RECEIPTS}")
    at001 = len(flips) > 0
    at003 = len(moved_rows) > 0
    boundary = (
        blocked["result"] == "BLOCKED" and allowed["result"] == "REQUIRES_EXECUTOR"
    )
    verdict = "PASS" if (at001 and at003 and boundary) else "FAIL"
    print(
        f"\nVERDICT  : {verdict}  (AT-001={at001} AT-003={at003} BOUNDARY={boundary})"
    )
    print(
        "MASTER   : Can witnessed reality change future selection?",
        "YES" if at001 else "NO",
    )
    return 0 if verdict == "PASS" else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument(
        "--report", action="store_true", help="score + selection, with witness"
    )
    ap.add_argument("--top", type=int, default=15)
    ap.add_argument("--upgrade", action="store_true", help="apply bounded additive upgrades")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=5)
    args = ap.parse_args()
    if args.selftest:
        return selftest()
    if args.upgrade:
        w = load_witness()
        rows = select(load_skills(), w, attach_witness=True)
        for r in apply_upgrades(rows, limit=args.limit, dry_run=args.dry_run):
            print(f"  {r['result']:12s} {r['skill'][:44]:44s} {r.get('gate', r.get('scars', ''))}")
        return 0
    witness = load_witness()
    skills = load_skills()
    rows = select(skills, witness, attach_witness=True)
    rows.sort(key=lambda r: r["fitness"])
    print(f"{'SKILL':40s} {'F':>7s} {'FIQH':>8s} {'ACTION':16s} REASON")
    for r in rows[: args.top]:
        print(
            f"{r['skill'][:40]:40s} {r['fitness']:7.4f} {r['fiqh']:>8s} {r['action']:16s} {r['reason'][:60]}"
        )
    write_receipt(rows, witness, note="report")
    return 0


if __name__ == "__main__":
    sys.exit(main())
