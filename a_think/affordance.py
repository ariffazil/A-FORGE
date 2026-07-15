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
