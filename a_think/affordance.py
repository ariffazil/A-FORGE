"""
A-THINK v1 — MCP Fiqh: Affordance Cards
=========================================

WAJIB 2: Every tool must have an affordance card.
HARAM 1: UNKNOWN = HOLD.
SUNAT 3: Risk labels R0-R5 → mode mapping.

Fiqh categories:
  WAJIB  = must do (compulsory)
  HARAM  = forbidden (banned)
  HARUS  = allowed (case-by-case)
  MAKRUH = discouraged
  SUNAT  = recommended

DITEMPA BUKAN DIBERI.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

import yaml


# ── Risk Labels (SUNAT 3) ───────────────────────────────────────────────


class RiskLabel(str, Enum):
    R0 = "R0"  # read_only
    R1 = "R1"  # local_temp_write
    R2 = "R2"  # repo_write
    R3 = "R3"  # external_api_write
    R4 = "R4"  # public_publish
    R5 = "R5"  # destructive_or_irreversible


# ── Affordance Card (WAJIB 2) ───────────────────────────────────────────


@dataclass(frozen=True)
class AffordanceCard:
    """
    Every MCP tool MUST declare this.

    If any field is UNKNOWN → tool is HOLD for GOVERN mode.
    """

    name: str
    purpose: str  # one clear sentence
    reads: list[str]  # what data it can read
    writes: list[str]  # what data it can change
    external_side_effect: bool  # affects outside world?
    destructive: bool  # can destroy data/state?
    reversible: bool  # can be undone?
    requires_human_approval: bool  # needs Arif's ack?
    min_mode: str  # "FAST" | "THINK" | "GOVERN" — minimum mode required
    risk_label: RiskLabel  # R0-R5

    def is_known(self) -> bool:
        """Check if all fields are fully declared. No UNKNOWN allowed."""
        # These fields must not be empty/None/unknown
        if not self.purpose or self.purpose.strip() == "":
            return False
        if not self.reads and not self.writes:
            return False
        if self.external_side_effect is None:
            return False
        if self.destructive is None:
            return False
        if self.reversible is None:
            return False
        if self.requires_human_approval is None:
            return False
        if not self.min_mode:
            return False
        return True

    def govern_allowed(self) -> bool:
        """Can this tool be used in GOVERN mode?"""
        if not self.is_known():
            return False
        if self.min_mode not in ("GOVERN",):
            return False
        return True

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "purpose": self.purpose,
            "reads": self.reads,
            "writes": self.writes,
            "external_side_effect": self.external_side_effect,
            "destructive": self.destructive,
            "reversible": self.reversible,
            "requires_human_approval": self.requires_human_approval,
            "min_mode": self.min_mode,
            "risk_label": self.risk_label.value,
        }


# ── Affordance Registry ─────────────────────────────────────────────────


class AffordanceRegistry:
    """
    Registry of tool affordance cards.

    HARAM 1: If tool not registered → UNKNOWN = HOLD.
    """

    def __init__(self):
        self._cards: dict[str, AffordanceCard] = {}

    def register(self, card: AffordanceCard) -> None:
        """Register a tool's affordance card."""
        self._cards[card.name] = card

    def get(self, tool_name: str) -> Optional[AffordanceCard]:
        """Get affordance card for a tool. None if not registered."""
        return self._cards.get(tool_name)

    def is_known(self, tool_name: str) -> bool:
        """Check if tool has a valid affordance card."""
        card = self.get(tool_name)
        if card is None:
            return False
        return card.is_known()

    def check_execution(self, tool_name: str, mode: str) -> tuple[bool, str]:
        """
        Check if tool execution is allowed in given mode.

        Returns (allowed, reason).
        HARAM 1: UNKNOWN = HOLD.
        """
        card = self.get(tool_name)

        # HARAM 1: No card = UNKNOWN = HOLD
        if card is None:
            return (
                False,
                f"HARAM: tool '{tool_name}' has no affordance card (UNKNOWN = HOLD)",
            )

        # HARAM 1: Incomplete card = UNKNOWN = HOLD
        if not card.is_known():
            return (
                False,
                f"HARAM: tool '{tool_name}' has incomplete affordance card (UNKNOWN = HOLD)",
            )

        # Mode enforcement: request must be >= tool's min_mode
        mode_order = {"FAST": 0, "THINK": 1, "GOVERN": 2}
        tool_min = mode_order.get(card.min_mode, 99)
        request_level = mode_order.get(mode, -1)

        if request_level < tool_min:
            return (
                False,
                f"HARAM: tool '{tool_name}' requires min_mode={card.min_mode}, requested={mode}",
            )

        # HARAM 3: Destructive actions require human approval
        if card.destructive and not card.requires_human_approval:
            return (
                False,
                f"HARAM: tool '{tool_name}' is destructive but does not require human approval",
            )

        return True, "ALLOWED"

    def list_unknown(self) -> list[str]:
        """List tools with incomplete affordance cards."""
        return [name for name, card in self._cards.items() if not card.is_known()]

    def list_by_risk(self, label: RiskLabel) -> list[str]:
        """List tools by risk label."""
        return [name for name, card in self._cards.items() if card.risk_label == label]

    def to_dict(self) -> dict:
        return {name: card.to_dict() for name, card in self._cards.items()}


# ── Risk → Mode Mapping (SUNAT 3) ──────────────────────────────────────

RISK_MODE_MAP = {
    RiskLabel.R0: "FAST",  # read_only → FAST
    RiskLabel.R1: "THINK",  # local_temp_write → THINK
    RiskLabel.R2: "GOVERN",  # repo_write → GOVERN
    RiskLabel.R3: "GOVERN",  # external_api_write → GOVERN
    RiskLabel.R4: "GOVERN",  # public_publish → GOVERN
    RiskLabel.R5: "GOVERN",  # destructive_or_irreversible → GOVERN
}


def risk_to_mode(label: RiskLabel) -> str:
    """Map risk label to minimum required mode."""
    return RISK_MODE_MAP.get(label, "GOVERN")


# ── Affordance Card Loader ──────────────────────────────────────────────


def load_affordances_from_yaml(path: str) -> AffordanceRegistry:
    """Load affordance cards from YAML file."""
    registry = AffordanceRegistry()

    with open(path) as f:
        raw = yaml.safe_load(f)

    for tool_data in raw.get("tools", []):
        card = AffordanceCard(
            name=tool_data["name"],
            purpose=tool_data["purpose"],
            reads=tool_data.get("reads", []),
            writes=tool_data.get("writes", []),
            external_side_effect=tool_data.get("external_side_effect", False),
            destructive=tool_data.get("destructive", False),
            reversible=tool_data.get("reversible", True),
            requires_human_approval=tool_data.get("requires_human_approval", False),
            min_mode=tool_data.get("min_mode", "GOVERN"),
            risk_label=RiskLabel(tool_data.get("risk_label", "R0")),
        )
        registry.register(card)

    return registry


# ── Skill Selection Tracker (AGI Phase 1 — SkillGate preparation) ────────


class SelectionMethod(str, Enum):
    """How a skill was selected."""
    KEYWORD = "keyword"        # matched by keyword/intent
    LEARNED = "learned"        # selected by learned ranking
    MANUAL = "manual"          # human explicitly chose
    ROUTED = "routed"          # arif_route dispatched
    FALLBACK = "fallback"      # default/fallback selection


@dataclass
class SkillSelectionEvent:
    """A single skill selection record for SkillGate credit separation."""
    ts: str
    skill_name: str
    selection_method: SelectionMethod
    intent: str
    session_id: str
    agent_id: str
    outcome_success: bool | None = None  # None = not yet known
    outcome_summary: str | None = None
    alternative_skills: list[str] | None = None  # what else was considered

    def to_dict(self) -> dict:
        return {
            "ts": self.ts,
            "skill_name": self.skill_name,
            "selection_method": self.selection_method.value,
            "intent": self.intent,
            "session_id": self.session_id,
            "agent_id": self.agent_id,
            "outcome_success": self.outcome_success,
            "outcome_summary": self.outcome_summary,
            "alternative_skills": self.alternative_skills,
        }


class SkillSelectionTracker:
    """
    Tracks skill selection events for SkillGate credit separation (Phase 2).

    Logs: which skill was selected, why (method), what happened (outcome).
    Append-only JSONL ledger. Observation only — does not influence selection.

    Phase 1: record events.
    Phase 2: compute selection credit vs execution credit separation.
    """

    def __init__(self, log_path: str = "/root/.local/share/arifos/skill-selection/selections.jsonl"):
        self._log_path = log_path
        self._ensure_dir()

    def _ensure_dir(self) -> None:
        import os
        os.makedirs(os.path.dirname(self._log_path), exist_ok=True)

    def record(
        self,
        skill_name: str,
        selection_method: SelectionMethod | str,
        intent: str,
        session_id: str = "",
        agent_id: str = "",
        outcome_success: bool | None = None,
        outcome_summary: str | None = None,
        alternative_skills: list[str] | None = None,
    ) -> SkillSelectionEvent:
        """Record a skill selection event. Append-only."""
        import json
        from datetime import datetime, timezone

        if isinstance(selection_method, str):
            selection_method = SelectionMethod(selection_method)

        event = SkillSelectionEvent(
            ts=datetime.now(timezone.utc).isoformat(),
            skill_name=skill_name,
            selection_method=selection_method,
            intent=intent[:500],  # truncate long intents
            session_id=session_id,
            agent_id=agent_id,
            outcome_success=outcome_success,
            outcome_summary=outcome_summary,
            alternative_skills=alternative_skills,
        )

        with open(self._log_path, "a") as f:
            f.write(json.dumps(event.to_dict()) + "\n")

        return event

    def query(
        self,
        skill_name: str | None = None,
        agent_id: str | None = None,
        method: SelectionMethod | str | None = None,
        limit: int = 50,
    ) -> list[dict]:
        """Query selection events. Read-only."""
        import json

        try:
            with open(self._log_path) as f:
                lines = f.readlines()
        except FileNotFoundError:
            return []

        events = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue

            if skill_name and event.get("skill_name") != skill_name:
                continue
            if agent_id and event.get("agent_id") != agent_id:
                continue
            if method:
                m = method.value if isinstance(method, SelectionMethod) else method
                if event.get("selection_method") != m:
                    continue

            events.append(event)

        return events[-limit:]

    def stats(self) -> dict:
        """Aggregate selection statistics. Read-only."""
        import json
        from collections import Counter

        try:
            with open(self._log_path) as f:
                lines = f.readlines()
        except FileNotFoundError:
            return {"total": 0, "by_skill": {}, "by_method": {}, "success_rate": 0}

        events = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                continue

        by_skill: Counter = Counter()
        by_method: Counter = Counter()
        successes = 0
        known_outcomes = 0

        for e in events:
            by_skill[e.get("skill_name", "unknown")] += 1
            by_method[e.get("selection_method", "unknown")] += 1
            if e.get("outcome_success") is not None:
                known_outcomes += 1
                if e["outcome_success"]:
                    successes += 1

        return {
            "total": len(events),
            "by_skill": dict(by_skill.most_common()),
            "by_method": dict(by_method.most_common()),
            "success_rate": round(successes / known_outcomes, 3) if known_outcomes > 0 else None,
            "known_outcomes": known_outcomes,
        }


# Module-level singleton
_skill_selection_tracker: SkillSelectionTracker | None = None


def get_skill_selection_tracker() -> SkillSelectionTracker:
    """Get or create the module-level SkillSelectionTracker singleton."""
    global _skill_selection_tracker
    if _skill_selection_tracker is None:
        _skill_selection_tracker = SkillSelectionTracker()
    return _skill_selection_tracker
