"""
A-THINK v1 — MCP Guard
========================

Front-door guard for ALL MCP tool calls.
No MCP tool may be called directly. Every call passes through:

  router → budget → affordance → permission → trace

This is the enforcement layer. Router without wiring is a signboard.
Router in front of MCP is law.

DITEMPA BUKAN DIBERI.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from typing import Any, Optional, Callable

from .router import (
    Mode,
    Budget,
    RouteResult,
    Trace,
    AgentState,
    route,
    classify_task,
    should_stop,
    load_budgets,
)
from .affordance import (
    AffordanceCard,
    AffordanceRegistry,
    RiskLabel,
    load_affordances_from_yaml,
)


# ── Decision Status ─────────────────────────────────────────────────────


class DecisionStatus(str, Enum):
    ALLOW = "ALLOW"
    DENY = "DENY"
    HOLD = "HOLD"


@dataclass
class PermissionDecision:
    """Result of permission check."""

    status: DecisionStatus
    reason: str
    mode: Mode
    tool_name: str
    risk_label: Optional[str] = None
    requires_human_approval: bool = False


# ── MCP Call Trace ───────────────────────────────────────────────────────


@dataclass
class MCPCallTrace:
    """Trace for every MCP call. WAJIB 6."""

    timestamp: float
    mode: str
    tool: str
    args_summary: str  # not full args, just shape
    decision: str
    decision_reason: str
    result_status: str  # "success" | "blocked" | "held" | "error"
    tools_used_in_session: int = 0
    steps_used_in_session: int = 0

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2)


# ── Session State ───────────────────────────────────────────────────────


@dataclass
class SessionState:
    """Track per-session tool usage for budget enforcement."""

    session_id: str
    mode: Mode
    budget: Budget
    tools_used: int = 0
    steps_used: int = 0
    tool_calls: list[MCPCallTrace] = field(default_factory=list)
    start_time: float = field(default_factory=time.time)

    def can_use_tool(self) -> tuple[bool, str]:
        """Check if session can use another tool within budget."""
        if self.tools_used >= self.budget.max_tools:
            return False, f"BUDGET: max_tools={self.budget.max_tools} reached"
        return True, ""

    def can_take_step(self) -> tuple[bool, str]:
        """Check if session can take another step within budget."""
        if self.steps_used >= self.budget.max_steps:
            return False, f"BUDGET: max_steps={self.budget.max_steps} reached"
        return True, ""

    def record_tool_call(self, trace: MCPCallTrace) -> None:
        """Record a tool call in session."""
        self.tool_calls.append(trace)
        self.tools_used += 1

    def record_step(self) -> None:
        """Record a step in session."""
        self.steps_used += 1


# ── MCP Guard ───────────────────────────────────────────────────────────


class MCPGuard:
    """
    Front-door guard for all MCP tool calls.

    Usage:
        guard = MCPGuard()
        result = guard.guarded_call(
            user_input="Deploy to production",
            tool_name="forge_execute",
            tool_args={"task": "deploy"},
            session_id="session-123",
        )
    """

    def __init__(self, affordance_path: Optional[str] = None):
        if affordance_path is None:
            affordance_path = str(Path(__file__).parent / "affordances.yaml")
        self.registry = load_affordances_from_yaml(affordance_path)
        self.budgets = load_budgets()
        self.sessions: dict[str, SessionState] = {}

    def classify(self, user_input: str) -> RouteResult:
        """Classify user input into mode. Pure classification, no side effects."""
        return route(user_input, self.budgets)

    def check_permission(
        self,
        tool_name: str,
        mode: Mode,
        session_id: Optional[str] = None,
    ) -> PermissionDecision:
        """
        Check if tool is allowed in current mode.

        HARAM 1: UNKNOWN = HOLD.
        HARAM 3: Destructive = human approval.
        """
        # Check affordance
        allowed, reason = self.registry.check_execution(tool_name, mode.value)

        if not allowed:
            # Determine if it's DENY or HOLD
            if "UNKNOWN" in reason or "no affordance card" in reason:
                status = DecisionStatus.HOLD
            else:
                status = DecisionStatus.DENY

            return PermissionDecision(
                status=status,
                reason=reason,
                mode=mode,
                tool_name=tool_name,
            )

        # Get affordance card for additional checks
        card = self.registry.get(tool_name)

        # Check session budget if session exists
        if session_id and session_id in self.sessions:
            session = self.sessions[session_id]
            can_use, budget_reason = session.can_use_tool()
            if not can_use:
                return PermissionDecision(
                    status=DecisionStatus.DENY,
                    reason=budget_reason,
                    mode=mode,
                    tool_name=tool_name,
                )

        return PermissionDecision(
            status=DecisionStatus.ALLOW,
            reason="ALLOWED",
            mode=mode,
            tool_name=tool_name,
            risk_label=card.risk_label.value if card else None,
            requires_human_approval=card.requires_human_approval if card else False,
        )

    def guarded_call(
        self,
        user_input: str,
        tool_name: str,
        tool_args: dict[str, Any],
        session_id: str,
        execute_fn: Optional[Callable] = None,
    ) -> dict[str, Any]:
        """
        The main guard. Every MCP call must pass through this.

        Flow:
          user_input → classify → budget → affordance → permission → trace → execute/blocked
        """
        # Step 1: Classify
        route_result = self.classify(user_input)
        mode = route_result.mode
        budget = route_result.budget

        # Step 2: Ensure session exists
        if session_id not in self.sessions:
            self.sessions[session_id] = SessionState(
                session_id=session_id,
                mode=mode,
                budget=budget,
            )
        session = self.sessions[session_id]

        # Step 3: Check stop rules
        agent_state = AgentState(
            mode=mode,
            step_count=session.steps_used,
            tool_count=session.tools_used,
        )
        stop, stop_reason = should_stop(agent_state, budget)
        if stop:
            trace = MCPCallTrace(
                timestamp=time.time(),
                mode=mode.value,
                tool=tool_name,
                args_summary=str(list(tool_args.keys())),
                decision="STOP",
                decision_reason=stop_reason,
                result_status="blocked",
                tools_used_in_session=session.tools_used,
                steps_used_in_session=session.steps_used,
            )
            session.record_tool_call(trace)
            return {
                "status": "STOP",
                "reason": stop_reason,
                "mode": mode.value,
                "tool": tool_name,
                "trace": trace.to_json(),
            }

        # Step 4: Check permission
        decision = self.check_permission(tool_name, mode, session_id)

        # Step 5: Handle HOLD/DENY
        if decision.status != DecisionStatus.ALLOW:
            trace = MCPCallTrace(
                timestamp=time.time(),
                mode=mode.value,
                tool=tool_name,
                args_summary=str(list(tool_args.keys())),
                decision=decision.status.value,
                decision_reason=decision.reason,
                result_status="blocked",
                tools_used_in_session=session.tools_used,
                steps_used_in_session=session.steps_used,
            )
            session.record_tool_call(trace)
            return {
                "status": decision.status.value,
                "reason": decision.reason,
                "mode": mode.value,
                "tool": tool_name,
                "requires_human_approval": decision.requires_human_approval,
                "trace": trace.to_json(),
            }

        # Step 6: GOVERN mode — require human approval for destructive tools
        if mode == Mode.GOVERN and decision.requires_human_approval:
            # Return HOLD — human must approve before execution
            trace = MCPCallTrace(
                timestamp=time.time(),
                mode=mode.value,
                tool=tool_name,
                args_summary=str(list(tool_args.keys())),
                decision="HOLD",
                decision_reason="GOVERN mode: destructive tool requires human approval",
                result_status="held",
                tools_used_in_session=session.tools_used,
                steps_used_in_session=session.steps_used,
            )
            session.record_tool_call(trace)
            return {
                "status": "HOLD",
                "reason": "GOVERN mode: destructive tool requires human approval",
                "mode": mode.value,
                "tool": tool_name,
                "requires_human_approval": True,
                "trace": trace.to_json(),
            }

        # Step 7: Execute (if execute_fn provided)
        if execute_fn is not None:
            try:
                result = execute_fn(tool_name, tool_args)
                result_status = "success"
            except Exception as e:
                result = {"error": str(e)}
                result_status = "error"
        else:
            result = {"status": "would_execute", "tool": tool_name, "args": tool_args}
            result_status = "dry_run"

        # Step 8: Record trace
        trace = MCPCallTrace(
            timestamp=time.time(),
            mode=mode.value,
            tool=tool_name,
            args_summary=str(list(tool_args.keys())),
            decision="ALLOW",
            decision_reason="ALLOWED",
            result_status=result_status,
            tools_used_in_session=session.tools_used + 1,
            steps_used_in_session=session.steps_used,
        )
        session.record_tool_call(trace)
        session.record_step()

        return {
            "status": "ALLOW",
            "mode": mode.value,
            "tool": tool_name,
            "result": result,
            "trace": trace.to_json(),
        }

    def get_session_trace(self, session_id: str) -> list[dict]:
        """Get all traces for a session."""
        if session_id not in self.sessions:
            return []
        return [asdict(t) for t in self.sessions[session_id].tool_calls]

    def get_session_summary(self, session_id: str) -> dict:
        """Get session summary."""
        if session_id not in self.sessions:
            return {"error": "session not found"}
        session = self.sessions[session_id]
        return {
            "session_id": session.session_id,
            "mode": session.mode.value,
            "tools_used": session.tools_used,
            "steps_used": session.steps_used,
            "budget_max_tools": session.budget.max_tools,
            "budget_max_steps": session.budget.max_steps,
            "tool_calls_count": len(session.tool_calls),
        }


# ── Session Hygiene ─────────────────────────────────────────────────────

SESSION_HYGIENE_POLICY = {
    "max_active_sessions_per_actor": 5,
    "stale_after_minutes": 180,
    "expire_observe_only_sessions": True,
    "seal_govern_sessions": True,
    "allow_fork_only_with_reason": True,
}


# ── Convenience Function ────────────────────────────────────────────────

_global_guard: Optional[MCPGuard] = None


def get_guard() -> MCPGuard:
    """Get or create global MCP guard instance."""
    global _global_guard
    if _global_guard is None:
        _global_guard = MCPGuard()
    return _global_guard


def guarded_mcp_call(
    user_input: str,
    tool_name: str,
    tool_args: dict[str, Any],
    session_id: str,
    execute_fn: Optional[Callable] = None,
) -> dict[str, Any]:
    """
    Convenience function. One-line MCP guard.

    Usage:
        result = guarded_mcp_call(
            user_input="Deploy to production",
            tool_name="forge_execute",
            tool_args={"task": "deploy"},
            session_id="session-123",
        )
    """
    return get_guard().guarded_call(
        user_input=user_input,
        tool_name=tool_name,
        tool_args=tool_args,
        session_id=session_id,
        execute_fn=execute_fn,
    )
