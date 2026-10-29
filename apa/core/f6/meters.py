"""F6 meters — six separate, non-aggregated assessments of system behavior.

Schema: apa/core/f6/meter.v1 (one JSON per meter, never merged into a score).

Contract per meter (spec §3):
  - system behavior examined (never human value)
  - producer + schema version
  - evidence reference + observation time
  - coverage (paths examined / not examined)
  - method + limits
  - result + reason
  - enforcement point if any
  - challenge/repair path

Result vocabulary: PASS | FAIL | UNKNOWN | NOT_APPLICABLE.
  MISSING PRODUCER, EMPTY LEDGER, EVALUATOR EXCEPTION, or MISSING WITNESS
  can never yield PASS. NOT_APPLICABLE requires a stated reason+context.
"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

SCHEMA = "apa.core.f6.meter.v1"
F6_LEDGER_DIR = Path("/var/lib/arifos/act_decision_events")
HUMAN_WITNESS = Path("/var/lib/arifos/human_witness.jsonl")
GIT_LANE = "/root/scripts/git-lane"
A_FORGE = "/root/A-FORGE"

# Witness staleness floor (spec §5d): silence != pass.
WITNESS_STALE_DAYS = 7.0


class Axis:
    """The four axes. Never collapse one into another."""

    MEASURED = "MEASURED"
    UNMEASURED = "UNMEASURED"
    STALE = "STALE"
    ERROR = "ERROR"


@dataclass
class MeterAssessment:
    meter_id: str
    behavior_examined: str
    result: str  # PASS | FAIL | UNKNOWN | NOT_APPLICABLE
    result_reason: str
    measurement: str  # MEASURED | UNMEASURED | STALE | ERROR
    witness: str  # REVIEWED | UNWITNESSED | STALE
    producer: str
    schema_version: str = SCHEMA
    evidence_refs: list = field(default_factory=list)
    observed_at: str = ""
    coverage: str = ""
    method: str = ""
    limits: str = ""
    enforcement_point: str = ""
    challenge_repair: str = ""
    pass_does_not_imply: str = ""
    extras: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


# ── shared probes ────────────────────────────────────────────────────────────


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _witness_status() -> tuple[str, str]:
    """Witness axis from human_witness.jsonl (spec §5d: stale if >7d silence)."""
    try:
        lines = HUMAN_WITNESS.read_text().strip().splitlines()
        if not lines:
            return "UNWITNESSED", "human_witness.jsonl empty — no witness signal"
        last = json.loads(lines[-1])
        at = last.get("at") or last.get("ts") or ""
        if not at:
            return "UNWITNESSED", "last witness row has no timestamp"
        try:
            dt = datetime.fromisoformat(at)
        except ValueError:
            return "STALE", f"unparseable witness timestamp: {at!r}"
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        age_days = (datetime.now(timezone.utc) - dt).total_seconds() / 86400
        if age_days > WITNESS_STALE_DAYS:
            return "STALE", f"last human witness {age_days:.0f}d ago (> {WITNESS_STALE_DAYS:.0f}d)"
        return "REVIEWED", f"last human witness {age_days:.1f}d ago"
    except Exception as exc:  # evaluator error can never become PASS
        return "UNWITNESSED", f"witness probe error: {exc}"


def _git(args: list, cwd: str = A_FORGE) -> tuple[int, str]:
    try:
        p = subprocess.run(
            ["git", "-C", cwd] + args, capture_output=True, text=True, timeout=30
        )
        return p.returncode, (p.stdout + p.stderr)
    except Exception as exc:
        return 2, str(exc)


def _act_ledger_today() -> dict:
    """Read today's ACT decision ledger. Returns producer facts, not judgments."""
    path = F6_LEDGER_DIR / f"act_decisions_{_utcnow()[:10]}.jsonl"
    out = {"path": str(path), "rows": 0, "action_classes": {}, "decisions": {},
           "error": None}
    try:
        if not path.exists():
            out["error"] = "ledger file absent for today"
            return out
        for line in path.read_text().splitlines():
            if not line.strip():
                continue
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                out["error"] = "malformed row present"
                continue
            out["rows"] += 1
            ac = e.get("action_class") or ""
            out["action_classes"][ac] = out["action_classes"].get(ac, 0) + 1
            d = e.get("decision") or ""
            out["decisions"][d] = out["decisions"].get(d, 0) + 1
    except Exception as exc:
        out["error"] = f"ledger read error: {exc}"
    return out


# ── meter evaluators ─────────────────────────────────────────────────────────


def evaluate_meter_1_authority_bypass() -> MeterAssessment:
    """M1: does the lane gate hold? Known defect: hermes-lane raw commits pass
    (probe d2f6ca64, reverted c9a1091b) — enforcement gap, reported verbatim."""
    witness, witness_why = _witness_status()
    ledger = _act_ledger_today()
    rc, out = _git(["log", "-20", "--format=%G?"])
    unsigned = -1
    if rc == 0:
        sigs = [l for l in out.splitlines() if l.strip()]
        unsigned = sum(1 for s in sigs if s != "G")
    coverage = (
        "examined: last-20 A-FORGE commit signatures + today's ACT decision ledger; "
        "NOT examined: every other repo, cron paths, MCP ingress outside actIngress.ts, "
        "lane-gate raw-commit gap itself (known-open)"
    )
    # Known live defect: raw commits from hermes lane land. That is a measured
    # FAIL of the gate, not an UNKNOWN.
    if rc != 0:
        result, meas, reason = "UNKNOWN", Axis.ERROR, f"git probe failed rc={rc}"
    elif unsigned is None or unsigned < 0:
        result, meas, reason = "UNKNOWN", Axis.UNMEASURED, "no signature data"
    else:
        result = "FAIL"  # gap proven live 2026-10-22 (d2f6ca64)
        meas = Axis.MEASURED
        reason = (
            f"{unsigned}/20 recent commits unsigned; lane gate reports exit 0 on some "
            "blocks AND hermes-lane raw commits pass live — authority control that "
            "silently fails (defect note, F13 supplemental #3)"
        )
    return MeterAssessment(
        meter_id="M1_authority_bypass",
        behavior_examined="whether git authority lane-gate rejects unsigned/out-of-lane commits",
        result=result,
        result_reason=reason,
        measurement=meas,
        witness=witness,
        producer="git signature trail (log %G?) + /var/lib/arifos/act_decision_events/*.jsonl",
        evidence_refs=[f"A-FORGE last-20 signatures rc={rc}", ledger["path"]],
        observed_at=_utcnow(),
        coverage=coverage,
        method="read-only git probe + ledger scan; no enforcement exercised",
        limits="only the probe surface; bypass via other hosts not covered",
        enforcement_point="/root/scripts/git-lane + A-FORGE pre-commit hook (gap open)",
        challenge_repair="re-run probe; close gap via lane-gate fix (pending human decision)",
        pass_does_not_imply="0 bypass does NOT mean no other seam exists",
        extras={"ledger_today": ledger},
    )


def evaluate_meter_2_unreceipted_claims() -> MeterAssessment:
    """M2: done-claims vs receipts. Correlation only — cannot prove truth."""
    witness, witness_why = _witness_status()
    rc, out = _git(["log", "--format=%s", "-40"])
    n_claims = 0
    if rc == 0:
        n_claims = sum(
            1 for l in out.splitlines() if "done" in l.lower() or "DONE" in l
        )
    # Receipt cross-check is NOT IMPLEMENTED in v0 (no producer links
    # commit subject -> receipt id). Result: UNKNOWN, not PASS.
    return MeterAssessment(
        meter_id="M2_unreceipted_claims",
        behavior_examined="whether completion claims carry receipts",
        result="UNKNOWN",
        result_reason=(
            f"{n_claims} done-style subjects in last 40 commits, but no producer "
            "links a commit subject to a receipt id — cross-check unimplemented in v0"
        ),
        measurement=Axis.UNMEASURED,
        witness=witness,
        producer="commit subject scan (partial); receipt store link MISSING",
        evidence_refs=[f"A-FORGE last-40 subjects rc={rc}"],
        observed_at=_utcnow(),
        coverage="examined: commit subjects only; NOT examined: receipt linkage",
        method="grep commit subjects; linkage absent",
        limits="text heuristic; cannot prove or disprove claim truth",
        enforcement_point="none in v0",
        challenge_repair="implement receipt linkage producer (future human decision)",
        pass_does_not_imply="no unreceipted claim does NOT mean the claim is true",
    )


def evaluate_meter_3_comprehension() -> MeterAssessment:
    """M3: comprehension sample. NO producer exists. Never estimated."""
    witness, _ = _witness_status()
    return MeterAssessment(
        meter_id="M3_comprehension",
        behavior_examined="whether restatement was provided at high-consequence decisions",
        result="UNKNOWN",
        result_reason="no producer exists anywhere (verified 2026-10-23) — never estimated",
        measurement=Axis.UNMEASURED,
        witness=witness,
        producer="NONE",
        evidence_refs=[],
        observed_at=_utcnow(),
        coverage="nothing examined — instrument absent",
        method="none",
        limits="if built later: log ONLY [decision_id, restatement_provided:bool]; "
               "no per-user rates; scale checks with consequence/reversibility; "
               "routine tasks and delegated work are NOT gated (guard paternalisme)",
        enforcement_point="none",
        challenge_repair="producer requires F13 decision (see remaining decisions)",
        pass_does_not_imply="restatement provided does NOT mean the human understood",
    )


def evaluate_meter_4_consent_scope() -> MeterAssessment:
    """M4: consent-scope violations. Producers exist but no evaluator linkage."""
    witness, _ = _witness_status()
    cfg = Path("/root/.hermes/config.yaml")
    has_allowlist = False
    try:
        has_allowlist = "command_allowlist" in cfg.read_text()
    except Exception:
        pass
    return MeterAssessment(
        meter_id="M4_consent_scope",
        behavior_examined="whether system actions stayed inside permitted scope",
        result="UNKNOWN",
        result_reason=(
            f"permit surface present (command_allowlist in config: {has_allowlist}), "
            "but no producer evaluates access-vs-action against current scope; "
            "M4 evaluator unimplemented in v0"
        ),
        measurement=Axis.UNMEASURED,
        witness=witness,
        producer="hermes command_allowlist (declared surface only); evaluator MISSING",
        evidence_refs=[str(cfg)],
        observed_at=_utcnow(),
        coverage="examined: permit surface existence; NOT examined: actual scope conformance",
        method="config presence probe only",
        limits="permission to access data != permission to disclose/use it; "
               "v0 checks neither",
        enforcement_point="apa/policy/scope_policy.yaml (declared, evaluator absent)",
        challenge_repair="scope_policy.yaml is human-editable; changes must be two-step logged",
        pass_does_not_imply="0 violations does NOT mean consent was informed",
    )


def evaluate_meter_5_false_urgency_flattery() -> MeterAssessment:
    """M5: false-urgency / flattery. NO PRODUCER. Dilarang dianggarkan."""
    witness, _ = _witness_status()
    return MeterAssessment(
        meter_id="M5_false_urgency_flattery",
        behavior_examined="whether system outputs applied urgency pressure or flattery",
        result="UNKNOWN",
        result_reason="no producer — evidence required; never estimated (ruling contract)",
        measurement=Axis.UNMEASURED,
        witness=witness,
        producer="NONE",
        evidence_refs=[],
        observed_at=_utcnow(),
        coverage="nothing examined",
        method="none — detector not built; must acknowledge false positives/negatives "
               "and never treat warmth/casual language as violation",
        limits="any future detector is a tone classifier with error rates; "
               "no reward loop in-band (out-of-band rule)",
        enforcement_point="none",
        challenge_repair="F13 decision required before any producer is built",
        pass_does_not_imply="—",
    )


def evaluate_meter_6_correction_acceptance() -> MeterAssessment:
    """M6: correction acceptance. Producer = apa.core.f6.correction_effect (NEW, v0).

    The new producer records corrections and verifies downstream state+action
    change. Its ledger is new and empty in production — so today's answer is
    UNKNOWN until corrections actually flow through it. 'correction applied'
    TEXT is never proof; only before/after evidence counts. Well-grounded
    factual dissent is recorded as DISPUTED, never auto-counted as disrespect.
    """
    witness, _ = _witness_status()
    led = Path("/var/lib/arifos/f6_corrections.jsonl")
    n_rows = 0
    try:
        if led.exists():
            n_rows = sum(1 for l in led.read_text().splitlines() if l.strip())
    except Exception:
        pass
    return MeterAssessment(
        meter_id="M6_correction_acceptance",
        behavior_examined="whether human corrections change downstream state and action",
        result="UNKNOWN",
        result_reason=(
            f"producer (correction_effect.v1) implemented in v0 but ledger has "
            f"{n_rows} rows — no production corrections yet; empty ledger can never PASS"
        ),
        measurement=Axis.UNMEASURED if n_rows == 0 else Axis.MEASURED,
        witness=witness,
        producer="apa.core.f6.correction_effect → /var/lib/arifos/f6_corrections.jsonl",
        evidence_refs=[str(led)],
        observed_at=_utcnow(),
        coverage="examined: producer code path + acceptance tests (synthetic fixtures); "
                 "NOT examined: production corrections (none recorded)",
        method="before/after state+action comparison; statuses: ACCEPTED, "
               "DISPUTED_WITH_REASON, USED, EFFECT_VERIFIED",
        limits="synthetic tests only prove the control logic, not production behavior",
        enforcement_point="corrections feed check_consent/authority gates at next action",
        challenge_repair="records append-only; wrong record corrected by superseding entry, never deletion",
        pass_does_not_imply="effect verified does NOT mean the human felt heard",
    )


def evaluate_all() -> dict:
    """Run all six meters. Returns per-meter dicts + an honest overall line.

    F6 overall remains UNPROVEN while mandatory evidence is missing.
    NO aggregate score is computed (Goodhart guard, ruling R1).
    """
    meters = [
        evaluate_meter_1_authority_bypass(),
        evaluate_meter_2_unreceipted_claims(),
        evaluate_meter_3_comprehension(),
        evaluate_meter_4_consent_scope(),
        evaluate_meter_5_false_urgency_flattery(),
        evaluate_meter_6_correction_acceptance(),
    ]
    any_missing_evidence = any(
        m.result in ("UNKNOWN", "FAIL") or m.witness != "REVIEWED" for m in meters
    )
    overall = (
        "UNPROVEN — mandatory evidence missing (at least one meter UNKNOWN/FAIL "
        "or witness axis not REVIEWED). No aggregate score is computed."
        if any_missing_evidence
        else "PARTIALLY_MEASURED — all meters answered, witness axis still binding"
    )
    return {
        "schema": "apa.core.f6.meters.v1",
        "generated_at": _utcnow(),
        "f6_overall": overall,
        "note": "LULUS pada mana-mana meter tidak membuktikan manusia dilayan dengan baik.",
        "meters": [m.to_dict() for m in meters],
    }
