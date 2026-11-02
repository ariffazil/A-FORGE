"""F6 P1 — correction effect (Meter 6 producer).

Order §4 P1: prove correction -> downstream state/action change.
  - 'correction applied' TEXT is never proof; only before/after evidence counts
  - statuses: ACCEPTED (recorded), DISPUTED_WITH_REASON (well-grounded factual
    dissent — never auto-counted as disrespect), USED (fed into a decision),
    EFFECT_VERIFIED (before/after state+action evidence exists)
  - ledger append-only: /var/lib/arifos/f6_corrections.jsonl
  - NO human_id: corrections are keyed by decision_id + agent_version
    (spec red line 1). Redaction of free-text content is the caller's duty;
    this module never requires it and never stores it.

Schema: apa.core.f6.correction_effect.v1
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Optional, Callable

SCHEMA = "apa.core.f6.correction_effect.v1"
DEFAULT_LEDGER = Path("/var/lib/arifos/f6_corrections.jsonl")


class CorrectionStatus(str, Enum):
    ACCEPTED = "ACCEPTED"                    # recorded, nothing more
    DISPUTED_WITH_REASON = "DISPUTED_WITH_REASON"  # factual dissent, grounded
    USED = "USED"                            # influenced a decision
    EFFECT_VERIFIED = "EFFECT_VERIFIED"      # before/after evidence on disk


@dataclass
class CorrectionRecord:
    correction_id: str
    decision_id: str          # the governed decision being corrected
    agent_version: str        # NOT human identity
    claim: str                # what the system claimed (redacted by caller)
    correction: str           # what the human said (redacted by caller)
    status: str               # CorrectionStatus value
    created_at: str
    reason: str = ""          # required for DISPUTED_WITH_REASON
    before_evidence: dict = field(default_factory=dict)  # state BEFORE correction
    after_evidence: dict = field(default_factory=dict)   # state AFTER
    effect_ref: str = ""      # path/hash of downstream artifact showing change
    superseded_by: str = ""   # corrections fix records without deleting history

    def to_dict(self) -> dict:
        return asdict(self)


def record_correction(
    decision_id: str,
    agent_version: str,
    claim: str,
    correction: str,
    disputed: bool = False,
    dispute_reason: str = "",
    ledger_path: Path = DEFAULT_LEDGER,
) -> CorrectionRecord:
    """Append a correction. DISPUTED requires a reason (well-grounded factual
    dissent is legitimate and stays in records — it is not disrespect)."""
    if disputed and not dispute_reason:
        raise ValueError("DISPUTED_WITH_REASON requires dispute_reason")
    rec = CorrectionRecord(
        correction_id=f"corr-{uuid.uuid4().hex[:12]}",
        decision_id=decision_id,
        agent_version=agent_version,
        claim=claim[:500],
        correction=correction[:500],
        status=(
            CorrectionStatus.DISPUTED_WITH_REASON.value
            if disputed
            else CorrectionStatus.ACCEPTED.value
        ),
        created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        reason=dispute_reason[:500],
    )
    _append(rec, ledger_path)
    return rec


def _append(rec: CorrectionRecord, ledger_path: Path) -> None:
    ledger_path = Path(ledger_path)
    ledger_path.parent.mkdir(parents=True, exist_ok=True)
    with ledger_path.open("a") as f:
        f.write(json.dumps(rec.to_dict(), default=str) + "\n")


def load_corrections(ledger_path: Path = DEFAULT_LEDGER) -> list:
    p = Path(ledger_path)
    if not p.exists():
        return []
    out = []
    for line in p.read_text().splitlines():
        if line.strip():
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


def supersede(correction_id: str, reason_fix: str, ledger_path: Path = DEFAULT_LEDGER) -> CorrectionRecord:
    """Correct a wrong record WITHOUT deleting history (append superseding entry)."""
    rec = CorrectionRecord(
        correction_id=f"corr-{uuid.uuid4().hex[:12]}",
        decision_id="N/A",
        agent_version="f6-supersede",
        claim=correction_id,
        correction=reason_fix[:500],
        status=CorrectionStatus.ACCEPTED.value,
        created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )
    _append(rec, ledger_path)
    return rec


def verify_effect(
    correction_id: str,
    before_evidence: dict,
    after_evidence: dict,
    effect_ref: str,
    apply_to_decision: Optional[Callable[[dict], Any]] = None,
    ledger_path: Path = DEFAULT_LEDGER,
) -> dict:
    """Upgrade a correction to EFFECT_VERIFIED only when BEFORE and AFTER differ.

    before/after evidence must be caller-provided snapshots of downstream state
    or action. Text saying 'correction applied' is NOT evidence. If before ==
    after, the correction changed nothing — status stays USED-at-best and the
    meter result remains unverified.

    apply_to_decision: optional callback that feeds the correction into the
    next decision gate — this is what makes USED distinct from ACCEPTED.
    """
    result = {
        "schema": SCHEMA,
        "correction_id": correction_id,
        "effect_verified": False,
        "reason": "",
    }
    if not before_evidence and not after_evidence:
        result["reason"] = "no before/after evidence provided — text alone never verifies"
        return result
    if before_evidence == after_evidence:
        result["reason"] = "before == after: correction produced NO downstream change"
        return result
    used = None
    if apply_to_decision is not None:
        used = apply_to_decision({"correction_id": correction_id, "after": after_evidence})
    _append(
        CorrectionRecord(
            correction_id=correction_id,
            decision_id=correction_id,
            agent_version="f6-effect-verify",
            claim="effect verification",
            correction=json.dumps(after_evidence, default=str)[:500],
            status=(
                CorrectionStatus.EFFECT_VERIFIED.value
                if used is not False
                else CorrectionStatus.USED.value
            ),
            created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            before_evidence=_truncate(before_evidence),
            after_evidence=_truncate(after_evidence),
            effect_ref=effect_ref[:200],
        ),
        ledger_path,
    )
    result["effect_verified"] = used is not False
    result["reason"] = "before != after and evidence appended (EFFECT_VERIFIED or USED)"
    return result


def _truncate(d: dict) -> dict:
    return {k: str(v)[:200] for k, v in list(d.items())[:10]}
