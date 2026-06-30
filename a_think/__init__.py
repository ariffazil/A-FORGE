"""
A-THINK v1 — 3-Mode Router + MCP Guard for arifOS Federation

Front-door classifier + enforcement. Sits in front of all tools.
No MCP tool may be called directly. Every call passes through:

  router → budget → affordance → permission → trace

Fiqh MCP enforcement:
  WAJIB 1: Classify before MCP call
  WAJIB 2: Every tool has affordance card
  WAJIB 5: Human approval for destructive
  WAJIB 6: Log every MCP call
  HARAM 1: UNKNOWN = HOLD
  HARAM 3: Auto-approve destructive = blocked

Usage:
    from a_think import route, Mode, check_tool, MCPGuard, guarded_mcp_call
    from a_think.affordance import AffordanceCard, AffordanceRegistry

    # Classify task
    result = route("Compare LangGraph vs AutoGen")
    print(result.mode)        # Mode.THINK

    # Guard MCP call
    result = guarded_mcp_call(
        user_input="Deploy to production",
        tool_name="forge_execute",
        tool_args={"task": "deploy"},
        session_id="session-123",
    )
    # result["status"] = "HOLD" (requires human approval)
"""

from .router import (
    Mode,
    Budget,
    RouteResult,
    Trace,
    AgentState,
    route,
    classify_task,
    should_stop,
    may_escalate,
    load_budgets,
    check_tool,
)

from .affordance import (
    AffordanceCard,
    AffordanceRegistry,
    RiskLabel,
    risk_to_mode,
    load_affordances_from_yaml,
)

from .mcp_guard import (
    MCPGuard,
    SessionState,
    MCPCallTrace,
    PermissionDecision,
    DecisionStatus,
    guarded_mcp_call,
    get_guard,
    SESSION_HYGIENE_POLICY,
)

__version__ = "0.1.0"
__all__ = [
    # Router
    "Mode",
    "Budget",
    "RouteResult",
    "Trace",
    "AgentState",
    "route",
    "classify_task",
    "should_stop",
    "may_escalate",
    "load_budgets",
    "check_tool",
    # Affordance
    "AffordanceCard",
    "AffordanceRegistry",
    "RiskLabel",
    "risk_to_mode",
    "load_affordances_from_yaml",
    # Guard
    "MCPGuard",
    "SessionState",
    "MCPCallTrace",
    "PermissionDecision",
    "DecisionStatus",
    "guarded_mcp_call",
    "get_guard",
    "SESSION_HYGIENE_POLICY",
]
