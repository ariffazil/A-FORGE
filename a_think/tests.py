"""
A-THINK v1 — Enforcement Tests
================================

Proves:
1. FAST uses 0 tools
2. THINK respects max 2 tools
3. GOVERN + UNKNOWN = HOLD
4. Direct bypass = DENY
5. Budget enforcement
6. Stop rules
7. Session tracking

Run: python -m a_think.tests
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from a_think import (
    Mode,
    route,
    check_tool,
    MCPGuard,
    guarded_mcp_call,
    DecisionStatus,
)


def test_fast_uses_zero_tools():
    """FAST mode should not allow any tool calls."""
    guard = MCPGuard()

    # Simple question → FAST
    r = route("Summarize this paragraph")
    assert r.mode == Mode.FAST, f"Expected FAST, got {r.mode}"
    assert r.allow_tools == False, "FAST should not allow tools"

    # Even if we try to call a tool in FAST, it should be blocked
    decision = guard.check_permission("arif_observe", Mode.FAST)
    assert decision.status == DecisionStatus.DENY, (
        f"Expected DENY, got {decision.status}"
    )

    print("✅ FAST uses 0 tools")


def test_think_respects_max_two_tools():
    """THINK mode should respect max 2 tools budget."""
    guard = MCPGuard()

    # Analysis → THINK
    r = route("Compare LangGraph vs AutoGen")
    assert r.mode == Mode.THINK, f"Expected THINK, got {r.mode}"
    assert r.budget.max_tools == 2, f"Expected max_tools=2, got {r.budget.max_tools}"

    # First tool call — should work
    result1 = guard.guarded_call(
        user_input="Compare LangGraph vs AutoGen",
        tool_name="forge_search",
        tool_args={"query": "LangGraph vs AutoGen"},
        session_id="test-think-budget",
    )
    assert result1["status"] == "ALLOW", (
        f"First call should be ALLOW, got {result1['status']}"
    )

    # Second tool call — should work
    result2 = guard.guarded_call(
        user_input="Compare LangGraph vs AutoGen",
        tool_name="forge_search",
        tool_args={"query": "AutoGen features"},
        session_id="test-think-budget",
    )
    assert result2["status"] == "ALLOW", (
        f"Second call should be ALLOW, got {result2['status']}"
    )

    # Third tool call — should be blocked by budget
    result3 = guard.guarded_call(
        user_input="Compare LangGraph vs AutoGen",
        tool_name="forge_search",
        tool_args={"query": "comparison"},
        session_id="test-think-budget",
    )
    assert result3["status"] in ("DENY", "STOP"), (
        f"Third call should be DENY/STOP (budget), got {result3['status']}"
    )
    assert "BUDGET" in result3["reason"] or "max_tools" in result3["reason"], (
        f"Expected budget in reason, got {result3['reason']}"
    )

    print("✅ THINK respects max 2 tools")


def test_govern_unknown_hold():
    """GOVERN mode + unknown tool = HOLD."""
    guard = MCPGuard()

    # Deploy → GOVERN
    r = route("Deploy to production")
    assert r.mode == Mode.GOVERN, f"Expected GOVERN, got {r.mode}"

    # Unknown tool → HOLD
    decision = guard.check_permission("some_random_tool", Mode.GOVERN)
    assert decision.status == DecisionStatus.HOLD, (
        f"Expected HOLD, got {decision.status}"
    )
    assert "UNKNOWN" in decision.reason or "no affordance card" in decision.reason

    print("✅ GOVERN + UNKNOWN = HOLD")


def test_direct_bypass_denied():
    """Direct MCP call bypass attempt should be denied."""
    guard = MCPGuard()

    # Try to call a GOVERN-only tool without going through router
    decision = guard.check_permission("forge_shell", Mode.FAST)
    assert decision.status == DecisionStatus.DENY, (
        f"Expected DENY, got {decision.status}"
    )

    # Try to call a GOVERN-only tool in THINK mode
    decision = guard.check_permission("forge_shell", Mode.THINK)
    assert decision.status == DecisionStatus.DENY, (
        f"Expected DENY, got {decision.status}"
    )

    # GOVERN mode should allow it
    decision = guard.check_permission("forge_shell", Mode.GOVERN)
    assert decision.status == DecisionStatus.ALLOW, (
        f"Expected ALLOW, got {decision.status}"
    )

    print("✅ Direct bypass denied")


def test_budget_enforcement():
    """Budget should be enforced per mode."""
    guard = MCPGuard()

    # FAST: 0 tools
    r = route("Explain MCP")
    assert r.budget.max_tools == 0
    assert r.budget.max_steps == 1

    # THINK: 2 tools, 5 steps
    r = route("Critique this architecture")
    assert r.budget.max_tools == 2
    assert r.budget.max_steps == 5

    # GOVERN: 5 tools, 9 steps
    r = route("Delete the database")
    assert r.budget.max_tools == 5
    assert r.budget.max_steps == 9

    print("✅ Budget enforcement correct")


def test_stop_rules():
    """Stop rules should fire when limits hit."""
    guard = MCPGuard()

    # Create session with THINK budget
    session_id = "test-stop-rules"
    guard.sessions[session_id] = guard.sessions.get(session_id) or __import__(
        "a_think.mcp_guard", fromlist=["SessionState"]
    ).SessionState(
        session_id=session_id,
        mode=Mode.THINK,
        budget=guard.budgets["THINK"],
    )

    # Max out tools
    guard.sessions[session_id].tools_used = 2

    # Next call should be stopped
    result = guard.guarded_call(
        user_input="Analyze this",
        tool_name="forge_search",
        tool_args={"query": "test"},
        session_id=session_id,
    )
    assert result["status"] == "STOP", f"Expected STOP, got {result['status']}"
    assert "BUDGET" in result["reason"] or "max_tools" in result["reason"]

    print("✅ Stop rules enforced")


def test_session_tracking():
    """Session should track tool usage."""
    guard = MCPGuard()

    session_id = "test-tracking"

    # First call
    guard.guarded_call(
        user_input="Compare tools",
        tool_name="forge_search",
        tool_args={"query": "test1"},
        session_id=session_id,
    )

    # Check session
    summary = guard.get_session_summary(session_id)
    assert summary["tools_used"] == 1, (
        f"Expected 1 tool used, got {summary['tools_used']}"
    )
    assert summary["mode"] == "THINK"

    # Second call
    guard.guarded_call(
        user_input="Compare tools",
        tool_name="forge_search",
        tool_args={"query": "test2"},
        session_id=session_id,
    )

    summary = guard.get_session_summary(session_id)
    assert summary["tools_used"] == 2, (
        f"Expected 2 tools used, got {summary['tools_used']}"
    )

    # Get trace
    traces = guard.get_session_trace(session_id)
    assert len(traces) == 2, f"Expected 2 traces, got {len(traces)}"

    print("✅ Session tracking works")


def test_govern_destructive_requires_approval():
    """GOVERN mode + destructive tool = HOLD for human approval."""
    guard = MCPGuard()

    # Deploy → GOVERN
    result = guard.guarded_call(
        user_input="Deploy to production",
        tool_name="forge_execute",
        tool_args={"task": "deploy"},
        session_id="test-govern-approval",
    )
    assert result["status"] == "HOLD", f"Expected HOLD, got {result['status']}"
    assert result["requires_human_approval"] == True

    print("✅ GOVERN destructive requires human approval")


def test_govern_read_only_allowed():
    """GOVERN mode + read-only tool = ALLOW."""
    guard = MCPGuard()

    # Use a read-only tool in GOVERN mode
    result = guard.guarded_call(
        user_input="Deploy to production",
        tool_name="forge_dry_run",
        tool_args={"task": "preview deploy"},
        session_id="test-govern-readonly",
    )
    assert result["status"] == "ALLOW", f"Expected ALLOW, got {result['status']}"

    print("✅ GOVERN read-only allowed")


def test_full_flow():
    """Test full flow: classify → budget → affordance → permission → trace."""
    guard = MCPGuard()

    # FAST: simple question, no tools
    result = guard.guarded_call(
        user_input="What is MCP?",
        tool_name="forge_search",
        tool_args={"query": "MCP"},
        session_id="test-full-flow-fast",
    )
    assert result["status"] in ("DENY", "STOP"), (
        f"FAST should DENY/STOP tools, got {result['status']}"
    )

    # THINK: analysis, 2 tools max
    result = guard.guarded_call(
        user_input="Compare LangGraph vs AutoGen",
        tool_name="forge_search",
        tool_args={"query": "comparison"},
        session_id="test-full-flow-think",
    )
    assert result["status"] == "ALLOW", f"THINK should ALLOW, got {result['status']}"

    # GOVERN: deploy, requires approval
    result = guard.guarded_call(
        user_input="Deploy to production",
        tool_name="forge_execute",
        tool_args={"task": "deploy"},
        session_id="test-full-flow-govern",
    )
    assert result["status"] == "HOLD", f"GOVERN should HOLD, got {result['status']}"

    print("✅ Full flow works")


def run_all_tests():
    """Run all enforcement tests."""
    print("=" * 50)
    print("A-THINK v1 — Enforcement Tests")
    print("=" * 50)
    print()

    tests = [
        test_fast_uses_zero_tools,
        test_think_respects_max_two_tools,
        test_govern_unknown_hold,
        test_direct_bypass_denied,
        test_budget_enforcement,
        test_stop_rules,
        test_session_tracking,
        test_govern_destructive_requires_approval,
        test_govern_read_only_allowed,
        test_full_flow,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"❌ {test.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ {test.__name__}: {type(e).__name__}: {e}")
            failed += 1

    print()
    print(f"Results: {passed}/{passed + failed} passed")

    if failed > 0:
        print(f"\n⚠️  {failed} tests failed!")
        return 1
    else:
        print("\n✅ All enforcement tests passed!")
        return 0


if __name__ == "__main__":
    sys.exit(run_all_tests())
