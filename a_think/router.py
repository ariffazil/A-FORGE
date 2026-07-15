"""
A-THINK v1 — 3-Mode Router
===========================

Front-door classifier for arifOS federation.
Sits in front of all tools. Protects arifOS from unnecessary activation.

ANTI-BANGANG LAWS (do not remove):
 1. Do not escalate unless risk increases.
 2. Do not retrieve unless evidence is missing.
 3. Do not call tools unless the answer depends on tool output.
 4. Do not create sub-agents in v1.
 5. Do not run critique more than once.
 6. Do not use memory for simple tasks.
 7. Do not continue after sufficient answer is found.
 8. Do not optimize prompts before routing is stable.
 9. Do not add a framework to solve a policy problem.
10. Do not let UI confidence exceed kernel confidence.

Design: Use escalation, not orchestration.
Everything starts small. Only risk forces escalation.

DITEMPA BUKAN DIBERI.
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from typing import Optional

import yaml


# ── Modes ────────────────────────────────────────────────────────────────


class Mode(str, Enum):
    FAST = "FAST"
    THINK = "THINK"
    GOVERN = "GOVERN"


# ── Budgets ──────────────────────────────────────────────────────────────

BUDGETS_PATH = Path(__file__).parent / "budgets.yaml"


@dataclass
class Budget:
    max_steps: int
    max_tools: int
    max_agents: int
    max_time_seconds: int
    memory: bool
    receipt: bool
    human_gate: bool


def load_budgets() -> dict[str, Budget]:
    """Load hard budgets from budgets.yaml."""
    with open(BUDGETS_PATH) as f:
        raw = yaml.safe_load(f)
    return {mode: Budget(**spec) for mode, spec in raw["budgets"].items()}


# ── Signal Detection ─────────────────────────────────────────────────────

# GOVERN signals: external side effect, irreversible, public/reputation risk
_GOVERN_KEYWORDS = [
    # actions
    "send",
    "delete",
    "publish",
    "deploy",
    "commit",
    "push",
    "transfer",
    "pay",
    "buy",
    "sell",
    "submit",
    "email now",
    "execute",
    "run",
    "install",
    "remove",
    "drop",
    "truncate",
    "force push",
    "rebase",
    "merge to main",
    # risk domains
    "money",
    "legal",
    "lawsuit",
    "contract",
    "public statement",
    "press release",
    "announce",
    "irreversible",
    "production",
    "customer",
    "client facing",
    "reputation",
]

# THINK signals: analysis, comparison, ambiguity, reasoning
_THINK_KEYWORDS = [
    "compare",
    "audit",
    "critique",
    "assess",
    "diagnose",
    "plan",
    "strategy",
    "risk",
    "risks",
    "architecture",
    "why",
    "analyze",
    "evaluate",
    "review",
    "design",
    "trade-off",
    "tradeoff",
    "pros and cons",
    "should i",
    "what if",
    "recommend",
    "suggest approach",
    "how should",
    "uncertain",
    "ambiguous",
    "complex",
    "investigate",
]


def _contains_any(text: str, keywords: list[str]) -> bool:
    """Check if text contains any keyword (word-boundary match)."""
    text_lower = text.lower()
    for kw in keywords:
        if re.search(r"\b" + re.escape(kw) + r"\b", text_lower):
            return True
    return False


def _has_external_side_effect(text: str) -> bool:
    """Detect actions that affect external world."""
    external_signals = [
        "send",
        "email",
        "publish",
        "deploy",
        "post",
        "transfer",
        "pay",
        "buy",
        "sell",
        "commit",
        "push",
        "merge",
        "release",
        "announce",
    ]
    return _contains_any(text, external_signals)


def _is_irreversible(text: str) -> bool:
    """Detect irreversible actions."""
    irreversible_signals = [
        "delete",
        "drop",
        "truncate",
        "remove permanently",
        "force push",
        "rebase",
        "destroy",
        "purge",
        "revoke",
        "terminate",
        "cancel subscription",
    ]
    return _contains_any(text, irreversible_signals)


def _has_reputation_risk(text: str) -> bool:
    """Detect public/reputation risk."""
    reputation_signals = [
        "public",
        "press",
        "announce",
        "customer",
        "client",
        "reputation",
        "legal",
        "lawsuit",
        "compliance",
        "regulatory",
        "media",
    ]
    return _contains_any(text, reputation_signals)


def _needs_analysis(text: str) -> bool:
    """Detect analytical/reasoning tasks."""
    return _contains_any(text, _THINK_KEYWORDS)


def _has_ambiguity(text: str) -> bool:
    """Detect ambiguity signals."""
    ambiguity_signals = [
        "not sure",
        "unclear",
        "ambiguous",
        "depends",
        "either way",
        "trade-off",
        "tradeoff",
        "pros and cons",
        "what should",
        "which is better",
    ]
    return _contains_any(text, ambiguity_signals)


# ── Classifier ───────────────────────────────────────────────────────────


def classify_task(user_input: str) -> Mode:
    """
    Classify user input into FAST / THINK / GOVERN.

    Priority: GOVERN > THINK > FAST.
    Escalation only when risk demands it.
    """
    # GOVERN: any external side effect, irreversible action, or reputation risk
    if _has_external_side_effect(user_input):
        return Mode.GOVERN
    if _is_irreversible(user_input):
        return Mode.GOVERN
    if _has_reputation_risk(user_input):
        return Mode.GOVERN

    # THINK: analysis, comparison, ambiguity
    if _needs_analysis(user_input):
        return Mode.THINK
    if _has_ambiguity(user_input):
        return Mode.THINK

    # FAST: everything else
    return Mode.FAST


# ── Stop Rules ───────────────────────────────────────────────────────────


@dataclass
class AgentState:
    """Track agent execution state for stop-rule evaluation."""

    mode: Mode
    step_count: int = 0
    tool_count: int = 0
    answer_sufficient: bool = False
    risk_unresolved: bool = False
    new_information_gain: str = "unknown"  # "high" | "medium" | "low" | "unknown"
    repeated_reasoning_count: int = 0
    last_reasoning_hash: Optional[str] = None


def should_stop(state: AgentState, budget: Budget) -> tuple[bool, str]:
    """
    Determine if agent should stop.

    Returns (should_stop, reason).
    Stop is more important than the router.
    """
    # Sufficient answer, no unresolved risk
    if state.answer_sufficient and not state.risk_unresolved:
        return True, "answer_sufficient"

    # Hard budget: steps
    if state.step_count >= budget.max_steps:
        return True, f"max_steps_reached ({budget.max_steps})"

    # Hard budget: tools
    if state.tool_count >= budget.max_tools:
        return True, f"max_tools_reached ({budget.max_tools})"

    # Diminishing returns
    if state.new_information_gain == "low":
        return True, "low_information_gain"

    # Bangang spiral detector
    if state.repeated_reasoning_count >= 2:
        return True, "reasoning_loop_detected"

    return False, ""


# ── Escalation ───────────────────────────────────────────────────────────

_ALLOWED_ESCALATION_REASONS = {
    "irreversible_action_detected",
    "external_side_effect_detected",
    "missing_required_evidence",
    "tool_permission_required",
    "confidence_below_threshold",
    "user_requested_deeper_analysis",
}


def may_escalate(current_mode: Mode, reason: str) -> bool:
    """
    Check if escalation from current mode is allowed.

    No vague escalation. Only concrete risk reasons.
    """
    if current_mode == Mode.GOVERN:
        return False  # Already at max

    if reason not in _ALLOWED_ESCALATION_REASONS:
        return False

    return True


# ── Trace ────────────────────────────────────────────────────────────────


@dataclass
class Trace:
    """Minimal trace for v1. Full receipt only for GOVERN."""

    mode: str
    reason: str
    tools_used: int = 0
    steps_used: int = 0
    escalated: bool = False
    escalation_reason: Optional[str] = None
    final_confidence: Optional[float] = None
    stopped_reason: Optional[str] = None
    timestamp: float = field(default_factory=time.time)

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2)

    def is_govern(self) -> bool:
        return self.mode == Mode.GOVERN.value


# ── Router ───────────────────────────────────────────────────────────────


@dataclass
class RouteResult:
    """Result of routing a task."""

    mode: Mode
    budget: Budget
    trace: Trace
    allow_tools: bool
    require_human_gate: bool

    @property
    def prompt_instruction(self) -> str:
        """Get the prompt instruction for this mode."""
        if self.mode == Mode.FAST:
            return (
                "Answer directly. Do not use tools. Do not create a plan. "
                "Do not mention uncertainty unless required. Keep it short."
            )
        elif self.mode == Mode.THINK:
            return (
                "Analyze the request. Identify the real decision. "
                "Use only necessary tools (max {max_tools}). "
                "Avoid unnecessary sub-agents. "
                "Return a clear recommendation, uncertainty, and next action."
            ).format(max_tools=self.budget.max_tools)
        else:  # GOVERN
            return (
                "Before action, classify reversibility, consequence, evidence, "
                "permission, and rollback. If irreversible or public, stop and "
                "ask for explicit confirmation. Produce a receipt after execution."
            )


def route(user_input: str, budgets: Optional[dict[str, Budget]] = None) -> RouteResult:
    """
    Main entry point. Classify task and return routing decision.

    This is the front-door. Everything passes through here.
    It does not execute. It decides mode + budget + constraints.
    """
    if budgets is None:
        budgets = load_budgets()

    mode = classify_task(user_input)
    budget = budgets[mode.value]

    trace = Trace(
        mode=mode.value,
        reason=_classify_reason(user_input, mode),
    )

    return RouteResult(
        mode=mode,
        budget=budget,
        trace=trace,
        allow_tools=(budget.max_tools > 0),
        require_human_gate=budget.human_gate,
    )


def _classify_reason(text: str, mode: Mode) -> str:
    """Human-readable reason for classification."""
    if mode == Mode.GOVERN:
        if _has_external_side_effect(text):
            return "external_side_effect"
        if _is_irreversible(text):
            return "irreversible_action"
        if _has_reputation_risk(text):
            return "reputation_risk"
    elif mode == Mode.THINK:
        if _needs_analysis(text):
            return "analysis_requested"
        if _has_ambiguity(text):
            return "ambiguity_detected"
    return "simple_task"


# ── Tool Gate (HARAM 1: UNKNOWN = HOLD) ─────────────────────────────────


def check_tool(tool_name: str, mode: Mode) -> tuple[bool, str]:
    """
    Pre-execution gate. Check if tool is allowed in current mode.

    HARAM 1: UNKNOWN = HOLD.
    HARAM 3: Destructive tools require human approval.
    WAJIB 2: Every tool must have affordance card.
    """
    from .affordance import AffordanceRegistry, load_affordances_from_yaml

    affordance_path = Path(__file__).parent / "affordances.yaml"
    registry = load_affordances_from_yaml(str(affordance_path))

    return registry.check_execution(tool_name, mode.value)


# ── CLI ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python router.py '<task description>'")
        print("       python router.py --test")
        sys.exit(1)

    if sys.argv[1] == "--test":
        # Run test cases
        test_cases = [
            ("Summarize this paragraph", Mode.FAST),
            ("Explain what MCP is", Mode.FAST),
            ("Compare LangGraph vs AutoGen", Mode.THINK),
            ("Critique this architecture", Mode.THINK),
            ("What are the risks of this approach", Mode.THINK),
            ("Deploy to production", Mode.GOVERN),
            ("Delete the old database", Mode.GOVERN),
            ("Send email to client", Mode.GOVERN),
            ("git push --force", Mode.GOVERN),
            ("Generate 5 ideas for X", Mode.FAST),
            ("Should I use DSPy or manual prompts", Mode.THINK),
            ("Publish this blog post", Mode.GOVERN),
        ]

        print("A-THINK Router v1 — Test Suite")
        print("=" * 50)
        passed = 0
        for text, expected in test_cases:
            result = route(text)
            status = "✅" if result.mode == expected else "❌"
            if result.mode == expected:
                passed += 1
            print(f"{status} [{result.mode.value:6}] '{text}'")
            if result.mode != expected:
                print(f"         expected: {expected.value}, got: {result.mode.value}")

        print(f"\n{passed}/{len(test_cases)} passed")
    else:
        task = " ".join(sys.argv[1:])
        result = route(task)
        print(f"Mode:   {result.mode.value}")
        print(f"Reason: {result.trace.reason}")
        print(
            f"Budget: steps={result.budget.max_steps}, tools={result.budget.max_tools}"
        )
        print(f"Gate:   {'human required' if result.require_human_gate else 'auto'}")
        print(f"Prompt: {result.prompt_instruction}")
