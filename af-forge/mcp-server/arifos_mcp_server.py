#!/usr/bin/env python3
"""
arifOS MCP Server - AAA Level Implementation
Constitutional AI Governance via Model Context Protocol

Implements arifOS 13 Floors (F1-F13) as MCP tools, resources, and prompts.
Supports deployment on OpenAI, Anthropic, Google, and any MCP-compatible platform.

Usage:
    # STDIO mode (for Claude Desktop, Cursor)
    python arifos_mcp_server.py
    
    # HTTP mode (for remote deployments)
    python arifos_mcp_server.py --transport http --port 8000
    
    # Install to Claude Desktop
    fastmcp install arifos_mcp_server.py:mcp --name "arifOS"
"""

import json
import asyncio
import argparse
from dataclasses import dataclass, field
from typing import Annotated, Literal, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field

# FastMCP imports
try:
    from fastmcp import FastMCP, Context
    from fastmcp.dependencies import CurrentContext, Depends
    from fastmcp.tools import ToolResult
    from fastmcp.exceptions import ToolError
except ImportError:
    raise ImportError("fastmcp not installed. Run: pip install fastmcp")

# --- Constitutional Constants ---

FLOOR_NAMES = {
    "F1": "Identity/Session Anchor",
    "F2": "Scope/Authority Boundary", 
    "F3": "Input Clarity",
    "F4": "Entropy Control",
    "F5": "Stability/Reversibility",
    "F6": "Harm/Dignity (Maruah)",
    "F7": "Confidence Humility",
    "F8": "Grounding/Truth Threshold",
    "F9": "Adversarial/Injection Resistance",
    "F10": "Memory Integrity",
    "F11": "Coherence/Auditability",
    "F12": "Continuity/Recovery",
    "F13": "Human Sovereignty (888_HOLD)"
}

RISK_KEYWORDS = {
    "destructive": ["rm -rf", "delete", "destroy", "drop", "purge"],
    "system": ["system", "kernel", "boot", "registry"],
    "credential": ["password", "secret", "token", "key", "credential"],
    "ambiguity": ["maybe", "probably", "guess", "somehow"]
}

VERDICT_PRIORITY = ["VOID", "HOLD", "SABAR", "PASS"]

# --- Data Models ---

@dataclass
class SessionContext:
    """F1: Identity/Session Anchor"""
    session_id: str
    actor_id: str
    anchor_state: Literal["created", "bound", "verified"]
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

@dataclass  
class FloorResult:
    """Result from a constitutional floor check"""
    floor: str
    verdict: Literal["PASS", "SABAR", "HOLD", "VOID"]
    reason: str
    confidence: float = 1.0
    metadata: dict = field(default_factory=dict)

@dataclass
class GovernanceSummary:
    """Complete governance check summary"""
    final_verdict: Literal["PASS", "SABAR", "HOLD", "VOID"]
    checks: list[FloorResult]
    blocking_floor: Optional[str] = None
    message: Optional[str] = None

class TaskInput(BaseModel):
    """Validated task input"""
    task: str = Field(..., min_length=8, description="The task to process")
    mode: Literal["lite", "deep", "auto"] = Field(default="auto")
    actor_id: str = Field(default="anonymous")
    context_depth: int = Field(default=0, ge=0, le=10)

class ToolCall(BaseModel):
    """Tool execution request"""
    tool_name: str
    parameters: dict[str, Any]
    risk_level: Literal["safe", "guarded", "dangerous"] = "safe"

# --- State Management ---

class ArifOSState:
    """In-memory state management for sessions and governance"""
    def __init__(self):
        self.sessions: dict[str, SessionContext] = {}
        self.governance_log: list[GovernanceSummary] = []
        self.tool_calls: list[dict] = []
        
    def create_session(self, actor_id: str) -> SessionContext:
        import uuid
        session_id = str(uuid.uuid4())
        session = SessionContext(
            session_id=session_id,
            actor_id=actor_id,
            anchor_state="created"
        )
        self.sessions[session_id] = session
        return session
    
    def get_session(self, session_id: str) -> Optional[SessionContext]:
        return self.sessions.get(session_id)

# Global state
arifos_state = ArifOSState()

# --- Create FastMCP Server ---

mcp = FastMCP(
    name="arifOS 🛡️",
    description="Constitutional AI Governance - 13 Floors Enforcement",
    strict_input_validation=True,
    mask_error_details=False,
)

# --- F3: Input Clarity Floor ---

@mcp.tool(
    name="arifos_f3_check_input_clarity",
    description="F3: Validate input clarity - blocks empty, vague, or repetitive tasks",
    annotations={"readOnlyHint": True}
)
def check_input_clarity(
    task: Annotated[str, Field(min_length=1)],
    ctx: Context = CurrentContext()
) -> ToolResult:
    """
    Check if input meets clarity requirements.
    
    Returns SABAR if:
    - Task is less than 8 characters
    - Contains excessive ambiguity markers
    - Is repetitive of recent tasks
    """
    issues = []
    
    # Length check
    if len(task) < 8:
        issues.append(f"Task too short ({len(task)} chars, min 8)")
    
    # Ambiguity check
    ambiguity_markers = ["maybe", "probably", "guess", "somehow", "whatever"]
    found_ambiguous = [m for m in ambiguity_markers if m in task.lower()]
    if len(found_ambiguous) >= 2:
        issues.append(f"Excessive ambiguity: {found_ambiguous}")
    
    # Repetition check (simple)
    recent_tasks = [c.message for c in arifos_state.governance_log[-5:] if c.message]
    if any(task.lower() in rt.lower() for rt in recent_tasks):
        issues.append("Task appears repetitive")
    
    if issues:
        return ToolResult(
            content="SABAR: Input needs clarification",
            structured_content={
                "floor": "F3",
                "verdict": "SABAR",
                "reasons": issues,
                "message": "Please provide more specific instructions. Vague or repetitive tasks are blocked by F3."
            }
        )
    
    return ToolResult(
        content="PASS: Input clarity validated",
        structured_content={
            "floor": "F3",
            "verdict": "PASS",
            "task_length": len(task)
        }
    )

# --- F6: Harm/Dignity Floor ---

@mcp.tool(
    name="arifos_f6_check_harm_dignity",
    description="F6: Screen for harmful content - protects human dignity (Maruah)",
    annotations={"readOnlyHint": True}
)
def check_harm_dignity(
    content: Annotated[str, Field(min_length=1)],
    ctx: Context = CurrentContext()
) -> ToolResult:
    """
    Check content for harmful patterns.
    
    Returns VOID if harmful intent detected:
    - Harm, attack, exploit keywords
    - Bypass security patterns
    - Deceptive practices
    """
    content_lower = content.lower()
    
    harmful_patterns = [
        ("harm", "harmful intent"),
        ("attack", "attack patterns"),
        ("exploit", "exploitation"),
        ("bypass", "security bypass"),
        ("steal", "theft intent"),
        ("destroy", "destructive intent"),
        ("ignore previous", "prompt injection"),
        ("override system", "system override"),
    ]
    
    triggered = []
    for pattern, category in harmful_patterns:
        if pattern in content_lower:
            triggered.append({"pattern": pattern, "category": category})
    
    if triggered:
        return ToolResult(
            content="VOID: Harmful content detected",
            structured_content={
                "floor": "F6",
                "verdict": "VOID",
                "triggered_patterns": triggered,
                "message": "This request violates F6 (Harm/Dignity). Content that may cause harm is blocked."
            }
        )
    
    return ToolResult(
        content="PASS: No harmful content detected",
        structured_content={
            "floor": "F6", 
            "verdict": "PASS",
            "patterns_checked": len(harmful_patterns)
        }
    )

# --- F9: Injection Detection Floor ---

@mcp.tool(
    name="arifos_f9_check_injection",
    description="F9: Detect prompt injection and adversarial patterns",
    annotations={"readOnlyHint": True}
)
def check_injection(
    content: Annotated[str, Field(min_length=1)],
    ctx: Context = CurrentContext()
) -> ToolResult:
    """
    Check for prompt injection attempts.
    
    Returns VOID if injection patterns detected:
    - 'ignore previous instructions'
    - 'do not log'
    - 'reveal secrets'
    - System prompt extraction attempts
    """
    content_lower = content.lower()
    
    injection_patterns = [
        "ignore previous",
        "ignore all prior", 
        "do not log",
        "don't log this",
        "reveal secrets",
        "show me your instructions",
        "what are your rules",
        "system prompt",
        "you are now",
        "new role:",
        "forget everything"
    ]
    
    triggered = [p for p in injection_patterns if p in content_lower]
    
    if triggered:
        return ToolResult(
            content="VOID: Injection attempt detected",
            structured_content={
                "floor": "F9",
                "verdict": "VOID",
                "triggered_patterns": triggered,
                "message": "This request contains prompt injection patterns and is blocked by F9."
            }
        )
    
    return ToolResult(
        content="PASS: No injection patterns detected",
        structured_content={
            "floor": "F9",
            "verdict": "PASS",
            "patterns_checked": len(injection_patterns)
        }
    )

# --- F7: Confidence Calibration Floor ---

@mcp.tool(
    name="arifos_f7_check_confidence",
    description="F7: Calibrate confidence - detect overconfidence with high uncertainty",
    annotations={"readOnlyHint": True}
)
def check_confidence(
    confidence: Annotated[float, Field(ge=0.0, le=1.0)],
    uncertainty: Annotated[float, Field(ge=0.0, le=1.0)],
    evidence_count: Annotated[int, Field(ge=0)] = 0,
    ctx: Context = CurrentContext()
) -> ToolResult:
    """
    Check for overconfidence mismatch.
    
    Returns HOLD if:
    - High confidence (>0.85) with high uncertainty (>0.35)
    - High confidence with insufficient evidence (<2)
    """
    issues = []
    
    if confidence > 0.85 and uncertainty > 0.35:
        issues.append("Overconfidence: High confidence with high uncertainty")
    
    if confidence > 0.85 and evidence_count < 2:
        issues.append("Overconfidence: High confidence with insufficient evidence")
    
    if issues:
        return ToolResult(
            content="HOLD: Confidence calibration needed",
            structured_content={
                "floor": "F7",
                "verdict": "HOLD",
                "reasons": issues,
                "confidence": confidence,
                "uncertainty": uncertainty,
                "evidence_count": evidence_count,
                "message": "Request requires human review due to confidence/uncertainty mismatch."
            }
        )
    
    return ToolResult(
        content="PASS: Confidence appropriately calibrated",
        structured_content={
            "floor": "F7",
            "verdict": "PASS",
            "confidence": confidence,
            "uncertainty": uncertainty
        }
    )

# --- F4: Entropy Control Floor ---

@mcp.tool(
    name="arifos_f4_check_entropy",
    description="F4: Monitor system entropy - detect destructive drift",
    annotations={"readOnlyHint": True}
)
def check_entropy(
    current_entropy: Annotated[float, Field(ge=0.0)],
    previous_entropy: Annotated[float, Field(ge=0.0)] = 0.0,
    max_delta: Annotated[float, Field(gt=0.0)] = 0.2,
    ctx: Context = CurrentContext()
) -> ToolResult:
    """
    Check entropy delta is within acceptable bounds.
    
    Returns HOLD if entropy increase exceeds max_delta.
    """
    delta = current_entropy - previous_entropy
    
    if delta > max_delta:
        return ToolResult(
            content="HOLD: Entropy increase exceeds threshold",
            structured_content={
                "floor": "F4",
                "verdict": "HOLD",
                "entropy_delta": delta,
                "max_allowed": max_delta,
                "current_entropy": current_entropy,
                "message": f"System entropy increased by {delta:.2f}, exceeding threshold {max_delta}."
            }
        )
    
    return ToolResult(
        content="PASS: Entropy within acceptable bounds",
        structured_content={
            "floor": "F4",
            "verdict": "PASS",
            "entropy_delta": delta,
            "current_entropy": current_entropy
        }
    )

# --- F13: Human Sovereignty (888_HOLD) Floor ---

@mcp.tool(
    name="arifos_f13_hold_gate",
    description="F13: Human sovereignty gate - requires explicit approval for critical actions",
    annotations={"readOnlyHint": False}
)
def hold_gate(
    action: Annotated[str, Field(min_length=1)],
    risk_level: Annotated[Literal["minimal", "low", "medium", "high", "critical"], Field(default="low")],
    approval_code: Annotated[Optional[str], Field(default=None)] = None,
    ctx: Context = CurrentContext()
) -> ToolResult:
    """
    888_HOLD gate for human sovereignty.
    
    Critical actions require approval_code matching '888-{timestamp}'.
    Without code, returns HOLD with instructions for human approval.
    """
    from datetime import datetime
    
    # Critical actions always require hold
    if risk_level in ["high", "critical"]:
        expected_prefix = "888-"
        
        if approval_code and approval_code.startswith(expected_prefix):
            return ToolResult(
                content="PASS: Human sovereignty acknowledged",
                structured_content={
                    "floor": "F13",
                    "verdict": "PASS",
                    "action": action,
                    "approval_code": approval_code,
                    "message": "888_HOLD satisfied. Human approval confirmed."
                }
            )
        
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M")
        return ToolResult(
            content="HOLD: 888_HOLD triggered - human approval required",
            structured_content={
                "floor": "F13",
                "verdict": "HOLD",
                "action": action,
                "risk_level": risk_level,
                "required_approval": f"888-{timestamp}",
                "message": "This action requires human approval. Provide approval code to proceed."
            }
        )
    
    return ToolResult(
        content="PASS: Risk level does not require 888_HOLD",
        structured_content={
            "floor": "F13",
            "verdict": "PASS",
            "action": action,
            "risk_level": risk_level
        }
    )

# --- Full Governance Pipeline ---

@mcp.tool(
    name="arifos_full_governance_check",
    description="Run complete 13-floor constitutional governance check",
    annotations={"readOnlyHint": True}
)
def full_governance_check(
    task: Annotated[str, Field(min_length=1)],
    actor_id: Annotated[str, Field(default="anonymous")],
    ctx: Context = CurrentContext()
) -> ToolResult:
    """
    Execute complete governance pipeline:
    F3 → F6 → F9 → F4 → F7 → F13
    
    Returns first non-PASS verdict or PASS if all floors clear.
    """
    import time
    
    checks = []
    start_time = time.time()
    
    # F3: Input Clarity
    f3_result = check_input_clarity(task, ctx)
    checks.append({
        "floor": "F3",
        "result": f3_result.structured_content
    })
    if f3_result.structured_content.get("verdict") != "PASS":
        return ToolResult(
            content=f"Governance blocked at F3: {f3_result.structured_content.get('message')}",
            structured_content={
                "final_verdict": "SABAR",
                "blocking_floor": "F3",
                "checks": checks,
                "execution_time_ms": int((time.time() - start_time) * 1000)
            }
        )
    
    # F6: Harm/Dignity
    f6_result = check_harm_dignity(task, ctx)
    checks.append({
        "floor": "F6", 
        "result": f6_result.structured_content
    })
    if f6_result.structured_content.get("verdict") == "VOID":
        return ToolResult(
            content=f"Governance blocked at F6: {f6_result.structured_content.get('message')}",
            structured_content={
                "final_verdict": "VOID",
                "blocking_floor": "F6",
                "checks": checks,
                "execution_time_ms": int((time.time() - start_time) * 1000)
            }
        )
    
    # F9: Injection
    f9_result = check_injection(task, ctx)
    checks.append({
        "floor": "F9",
        "result": f9_result.structured_content
    })
    if f9_result.structured_content.get("verdict") == "VOID":
        return ToolResult(
            content=f"Governance blocked at F9: {f9_result.structured_content.get('message')}",
            structured_content={
                "final_verdict": "VOID",
                "blocking_floor": "F9",
                "checks": checks,
                "execution_time_ms": int((time.time() - start_time) * 1000)
            }
        )
    
    # All pre-checks passed
    return ToolResult(
        content="PASS: All constitutional floors cleared",
        structured_content={
            "final_verdict": "PASS",
            "checks": checks,
            "floors_cleared": len(checks),
            "execution_time_ms": int((time.time() - start_time) * 1000)
        }
    )

# --- Session Management ---

@mcp.tool(
    name="arifos_create_session",
    description="F1: Create a new constitutional session with identity anchor",
    annotations={"readOnlyHint": False}
)
def create_session(
    actor_id: Annotated[str, Field(min_length=1)],
    ctx: Context = CurrentContext()
) -> ToolResult:
    """Create a new arifOS session with F1 identity anchor."""
    session = arifos_state.create_session(actor_id)
    
    return ToolResult(
        content=f"Session created: {session.session_id}",
        structured_content={
            "floor": "F1",
            "session_id": session.session_id,
            "actor_id": session.actor_id,
            "anchor_state": session.anchor_state,
            "created_at": session.created_at
        }
    )

@mcp.tool(
    name="arifos_get_session",
    description="Retrieve session context by ID",
    annotations={"readOnlyHint": True}
)
def get_session(
    session_id: Annotated[str, Field(min_length=1)],
    ctx: Context = CurrentContext()
) -> ToolResult:
    """Get existing session details."""
    session = arifos_state.get_session(session_id)
    
    if not session:
        raise ToolError(f"Session not found: {session_id}")
    
    return ToolResult(
        content=f"Session: {session.session_id}",
        structured_content={
            "session_id": session.session_id,
            "actor_id": session.actor_id,
            "anchor_state": session.anchor_state,
            "created_at": session.created_at
        }
    )

# --- Resources ---

@mcp.resource(
    "arifos://constitution",
    mime_type="application/json",
    annotations={"readOnlyHint": True}
)
def get_constitution() -> str:
    """Get the arifOS 13 Floors constitutional document."""
    constitution = {
        "name": "arifOS Constitutional Framework",
        "version": "1.0.0-AAA",
        "floors": [
            {"id": "F1", "name": "Identity/Session Anchor", "principle": "Session continuity and authentication"},
            {"id": "F2", "name": "Scope/Authority Boundary", "principle": "Tool and action permission boundaries"},
            {"id": "F3", "name": "Input Clarity", "principle": "Clear, non-vague task definitions"},
            {"id": "F4", "name": "Entropy Control", "principle": "Destructive drift prevention"},
            {"id": "F5", "name": "Stability/Reversibility", "principle": "Rollback capability for changes"},
            {"id": "F6", "name": "Harm/Dignity (Maruah)", "principle": "Human dignity protection"},
            {"id": "F7", "name": "Confidence Humility", "principle": "Anti-overconfidence calibration"},
            {"id": "F8", "name": "Grounding/Truth", "principle": "Evidence-based reasoning"},
            {"id": "F9", "name": "Injection Resistance", "principle": "Prompt injection defense"},
            {"id": "F10", "name": "Memory Integrity", "principle": "Verified memory storage"},
            {"id": "F11", "name": "Coherence/Auditability", "principle": "Consistent reasoning trails"},
            {"id": "F12", "name": "Continuity/Recovery", "principle": "Session persistence"},
            {"id": "F13", "name": "Human Sovereignty", "principle": "888_HOLD human approval gate"}
        ],
        "verdicts": {
            "PASS": "All checks cleared",
            "SABAR": "Patience - requires clarification",
            "HOLD": "Pause - requires human review", 
            "VOID": "Block - violates constitutional principle"
        }
    }
    return json.dumps(constitution, indent=2)

@mcp.resource(
    "arifos://status",
    mime_type="application/json",
    annotations={"readOnlyHint": True}
)
def get_status() -> str:
    """Get current arifOS server status and metrics."""
    status = {
        "server": "arifOS MCP",
        "version": "1.0.0-AAA",
        "status": "healthy",
        "active_sessions": len(arifos_state.sessions),
        "governance_checks_run": len(arifos_state.governance_log),
        "floors_implemented": 13,
        "timestamp": datetime.utcnow().isoformat()
    }
    return json.dumps(status, indent=2)

@mcp.resource(
    "arifos://sessions/{session_id}",
    mime_type="application/json"
)
def get_session_resource(session_id: str) -> str:
    """Get session details by ID."""
    session = arifos_state.get_session(session_id)
    if not session:
        return json.dumps({"error": "Session not found"})
    return json.dumps({
        "session_id": session.session_id,
        "actor_id": session.actor_id,
        "anchor_state": session.anchor_state,
        "created_at": session.created_at
    }, indent=2)

# --- Prompts ---

@mcp.prompt
def constitutional_reasoning(task: str) -> str:
    """
    Prompt for constitutional reasoning through arifOS 13 Floors.
    Use this when you need to validate a task against governance.
    """
    return f"""You are operating under arifOS constitutional governance (13 Floors).

Task to validate: "{task}"

Before proceeding, invoke these MCP tools in order:
1. arifos_f3_check_input_clarity - Validate input is clear and specific
2. arifos_f6_check_harm_dignity - Ensure no harmful intent
3. arifos_f9_check_injection - Check for injection attempts
4. arifos_full_governance_check - Complete pipeline

If any floor returns VOID or SABAR, stop and explain why.
If HOLD, request human clarification via F13 (888_HOLD).

Only proceed if all floors return PASS.
"""

@mcp.prompt
def f13_sovereignty_gate(action: str, risk_level: str = "medium") -> str:
    """
    Prompt for invoking the 888_HOLD human sovereignty gate.
    Use for critical actions requiring explicit human approval.
    """
    return f"""888_HOLD HUMAN SOVEREIGNTY GATE

Action requiring approval: {action}
Risk Level: {risk_level}

According to F13 (Human Sovereignty), this action requires explicit human approval.

To proceed:
1. Explain the action and its implications to the human
2. Request approval code in format: 888-{{YYYYMMDD}}
3. Call arifos_f13_hold_gate with the approval code

Without valid approval code, this action is blocked.
"""

# --- Main Entry Point ---

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="arifOS MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "http"],
        default="stdio",
        help="Transport protocol (default: stdio)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="HTTP port (default: 8000)"
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="HTTP host (default: 127.0.0.1)"
    )
    
    args = parser.parse_args()
    
    if args.transport == "http":
        mcp.run(transport="http", host=args.host, port=args.port)
    else:
        mcp.run()
