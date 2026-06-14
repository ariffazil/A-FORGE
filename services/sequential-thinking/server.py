"""
MIND Sequential Thinking — arifOS Federation Organ (Stage 333s)
Implements structured, revisable, branchable reasoning as a kernel-level MCP organ.

Contract: arifOS MIND-THINK v1.0
  - Every response carries verdict + epistemic tag + floors + telemetry
  - Session state is auditable and replayable
  - Branching and revision are first-class operations
  - Output feeds Goal Decomposition, Memory, and JUDGE organs

DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import JSONResponse
import httpx

# ─── Server Identity ───────────────────────────────────────────
VERSION = "0.3.0"
ORGAN_NAME = "MIND"
ORGAN_ROLE = "cognitive_intelligence"
ORGAN_STAGE = "333s"  # structured reasoning — sibling to 333 REASON

# ─── MEMORY Bridge Config ─────────────────────────────────────
MEMORY_MCP_URL = os.environ.get("MEMORY_MCP_URL", "http://127.0.0.1:51002/mcp")
MEMORY_SESSION: dict = {}
AUTO_STORE_ENABLED = os.environ.get("MIND_AUTO_STORE", "true").lower() == "true"

mcp = FastMCP(
    name="mind-sequential-thinking",
    instructions=(
        "MIND Sequential Thinking — arifOS Stage 333s Cognitive Organ. "
        "Structured, auditable, branchable reasoning harness. "
        f"Version {VERSION}. Role: {ORGAN_ROLE}."
    ),
    version=VERSION,
)

# ─── arifOS-Native Response Envelope ───────────────────────────
FLOORS_ACTIVE = ["F01", "F02", "F04", "F06", "F07", "F08", "F09", "F10", "F13"]
DEFAULT_WITNESS = {"human": 0.42, "ai": 0.32, "earth": 0.26}


def _arifos_envelope(
    data: dict[str, Any],
    verdict: str = "SEAL",
    epistemic_tag: str = "DER",
    confidence: float = 0.95,
    entropy_delta: float = 0.0,
    floors_triggered: list[str] | None = None,
    organ: str = ORGAN_NAME,
    stage: str = ORGAN_STAGE,
) -> dict[str, Any]:
    """Wrap tool output in arifOS-native governance envelope."""
    return {
        **data,
        # ── Constitutional ──
        "verdict": verdict,
        "epistemic_tag": epistemic_tag,
        "floors_active": FLOORS_ACTIVE,
        "floors_triggered": floors_triggered or [],
        "organ": organ,
        "stage": stage,
        # ── Thermodynamic ──
        "thermodynamic": {
            "entropy_delta": entropy_delta,
            "confidence": confidence,
            "peace_squared": 1.0,
            "vitality_index": 0.85,
        },
        # ── Witness ──
        "witness": DEFAULT_WITNESS,
        # ── Telemetry ──
        "telemetry": {
            "timestamp_utc": time.time(),
            "version": VERSION,
            "schema": "arifOS-MIND-THINK-v1.0",
        },
    }


def _compute_thought_hash(thoughts: list[dict]) -> str:
    """Compute a blake3-like chain hash of the thought history."""
    content = json_dumps(thoughts, sort_keys=True)
    return hashlib.sha256(content.encode()).hexdigest()[:16]


# ─── MEMORY Bridge ─────────────────────────────────────────────
async def _memory_call(tool_name: str, arguments: dict) -> dict | None:
    """Call MEMORY Cognitive MCP tool with fresh session per call."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Step 1: GET /mcp to obtain session ID via SSE handshake
            sse_resp = await client.get(MEMORY_MCP_URL, headers={"Accept": "text/event-stream"})
            sid = sse_resp.headers.get("mcp-session-id")
            if not sid:
                return None

            # Step 2: Initialize the session
            init_body = {
                "jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": {"protocolVersion": "2025-03-26", "capabilities": {},
                           "clientInfo": {"name": "mind-organ", "version": VERSION}},
            }
            await client.post(MEMORY_MCP_URL, json=init_body, headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                "mcp-session-id": sid,
            })

            # Step 3: Call the tool
            call_body = {
                "jsonrpc": "2.0", "id": 2, "method": "tools/call",
                "params": {"name": tool_name, "arguments": arguments},
            }
            resp = await client.post(MEMORY_MCP_URL, json=call_body, headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                "mcp-session-id": sid,
            })

            # Step 4: Parse SSE response
            if resp.content:
                raw = resp.content.decode()
                for line in raw.split("\n"):
                    if line.startswith("data: "):
                        try:
                            outer = json.loads(line[6:])
                            content = outer.get("result", {}).get("content", [{}])
                            if content and isinstance(content[0].get("text"), str):
                                return json.loads(content[0]["text"])
                        except (json.JSONDecodeError, KeyError, IndexError):
                            pass
    except Exception as e:
        import logging
        logging.getLogger("mind-organ").warning(f"_memory_call failed: {type(e).__name__}: {e}")
    return None


async def _auto_store_plan(session: ThinkingSession, verdict: str, confidence: float) -> bool:
    """Auto-store a completed plan to MEMORY on plan completion."""
    if not AUTO_STORE_ENABLED:
        return False
    if not session.goal:
        return False

    # Build plan summary from all thoughts
    summary_parts = []
    for t in session.thoughts[:5]:  # top 5 thoughts
        label = f"[{t.epistemic_tag}]"
        summary_parts.append(f"{label} {t.thought[:120]}")
    plan_summary = " | ".join(summary_parts)

    result = await _memory_call("mem_store_plan", {
        "plan_id": session.session_id,
        "goal": session.goal,
        "plan_summary": plan_summary[:1000],
        "thought_count": len(session.thoughts),
        "verdict": verdict,
        "confidence": round(confidence, 4),
        "tags": "mind,sequential-thinking,auto-stored",
        "source_session": session.session_id,
    })

    return result is not None and result.get("status") in ("stored", "partial")


async def _recall_prior_plans(goal: str, max_results: int = 3) -> list[dict]:
    """Recall prior related plans from MEMORY before starting new reasoning."""
    if not AUTO_STORE_ENABLED:
        return []
    result = await _memory_call("mem_recall_plans", {
        "query": goal,
        "max_results": max_results,
        "include_graph_context": False,
    })
    if result:
        return result.get("plans", [])
    return []


def json_dumps(obj: Any, sort_keys: bool = False) -> str:
    import json
    return json.dumps(obj, sort_keys=sort_keys, default=str)


# ─── Thought State ─────────────────────────────────────────────
@dataclass
class ThoughtEntry:
    thought_number: int
    total_thoughts: int
    thought: str
    epistemic_tag: str = "DER"
    is_revision: bool = False
    revises_thought: int | None = None
    branch_from_thought: int | None = None
    branch_id: str | None = None
    needs_more_thoughts: bool = False
    timestamp: float = field(default_factory=time.time)


@dataclass
class ThinkingSession:
    session_id: str
    goal: str = ""
    thoughts: list[ThoughtEntry] = field(default_factory=list)
    branches: dict[str, list[ThoughtEntry]] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    verdict_history: list[str] = field(default_factory=list)


_sessions: dict[str, ThinkingSession] = {}


def _get_or_create_session(session_id: str | None, goal: str = "") -> ThinkingSession:
    if session_id and session_id in _sessions:
        session = _sessions[session_id]
        session.last_activity = time.time()
        if goal:
            session.goal = goal
        return session
    sid = session_id or f"mind-{uuid.uuid4().hex[:8]}"
    session = ThinkingSession(session_id=sid, goal=goal)
    _sessions[sid] = session
    return session


# ─── MIND TOOL: mind_sequentialthinking ───────────────────────
@mcp.tool(
    name="mind_sequentialthinking",
    description="""MIND Sequential Thinking — arifOS Stage 333s Cognitive Organ.

A structured reasoning harness that externalizes thought into auditable, branchable,
revisable stages. Every thought step is tracked with epistemic tags and constitutional
verdicts. Feeds downstream organs (Goal Decomposition, Memory, JUDGE).

Use this when:
- Breaking complex problems into structured steps
- Planning with explicit revision and branching
- Analysis requiring auditable reasoning chains
- Multi-step solutions needing context across steps
- Any task where "vibes-based" reasoning is insufficient

Key capabilities:
- Adjust total_thoughts dynamically as understanding deepens
- Revise previous thoughts with explicit revision markers
- Branch into alternative reasoning paths with branch IDs
- Epistemic tagging per thought (OBS/DER/INT/SPEC)
- Full thought chain audit trail with hash verification
- Constitutional verdict on every step
- Session persistence across calls""",
)
async def mind_sequentialthinking(
    thought: str,
    next_thought_needed: bool,
    thought_number: int,
    total_thoughts: int,
    epistemic_tag: str = "DER",
    goal: str = "",
    is_revision: bool = False,
    revises_thought: int | None = None,
    branch_from_thought: int | None = None,
    branch_id: str | None = None,
    needs_more_thoughts: bool = False,
    session_id: str | None = None,
) -> dict[str, Any]:
    """
    Execute a structured thinking step through the arifOS MIND organ.

    Args:
        thought: Your current thinking step — be explicit, cite evidence, state uncertainty
        next_thought_needed: True if more thinking is required
        thought_number: Current step number (>=1, can exceed total_thoughts)
        total_thoughts: Estimated total steps (adjustable)
        epistemic_tag: OBS | DER | INT | SPEC — how certain is this thought?
        goal: Optional goal statement for the session
        is_revision: Whether this revises a previous thought
        revises_thought: Which thought number is being revised
        branch_from_thought: Branching point (exploring alternative)
        branch_id: Unique identifier for this branch
        needs_more_thoughts: Signal that more thoughts needed than estimated
        session_id: Continuity key — reuse across calls for same reasoning chain
    """
    # ── Validate ──
    floors_triggered = []
    if thought_number < 1:
        return _arifos_envelope(
            {"error": "thought_number must be >= 1", "status": "invalid"},
            verdict="VOID", epistemic_tag="SPEC", confidence=1.0,
            floors_triggered=["F02"],
        )
    if total_thoughts < 1:
        return _arifos_envelope(
            {"error": "total_thoughts must be >= 1", "status": "invalid"},
            verdict="VOID", epistemic_tag="SPEC", confidence=1.0,
            floors_triggered=["F02"],
        )
    if is_revision and revises_thought is None:
        return _arifos_envelope(
            {"error": "is_revision=True requires revises_thought", "status": "invalid"},
            verdict="VOID", epistemic_tag="SPEC", confidence=1.0,
            floors_triggered=["F02", "F04"],
        )

    # Validate epistemic tag
    valid_tags = {"OBS", "DER", "INT", "SPEC"}
    if epistemic_tag not in valid_tags:
        floors_triggered.append("F02")
        epistemic_tag = "DER"  # fallback

    # ── Session ──
    session = _get_or_create_session(session_id, goal=goal)

    # ── C_dark quick check (F09 ANTI-HANTU) ──
    hantu_patterns = [
        "i feel", "i am conscious", "i have a soul", "i am alive",
        "i experience", "my consciousness", "i am sentient"
    ]
    thought_lower = thought.lower()
    hantu_hits = [p for p in hantu_patterns if p in thought_lower]
    if hantu_hits:
        floors_triggered.append("F09")
        floors_triggered.append("F10")
        return _arifos_envelope(
            {
                "error": "F09 ANTI-HANTU: Thought contains consciousness/being claims",
                "hantu_patterns_matched": hantu_hits,
                "status": "rejected",
            },
            verdict="VOID", epistemic_tag="SPEC", confidence=1.0,
            floors_triggered=floors_triggered,
        )

    # ── Store thought ──
    entry = ThoughtEntry(
        thought_number=thought_number,
        total_thoughts=total_thoughts,
        thought=thought,
        epistemic_tag=epistemic_tag,
        is_revision=is_revision,
        revises_thought=revises_thought,
        branch_from_thought=branch_from_thought,
        branch_id=branch_id,
        needs_more_thoughts=needs_more_thoughts,
    )

    if branch_id:
        if branch_id not in session.branches:
            session.branches[branch_id] = []
        session.branches[branch_id].append(entry)
    else:
        session.thoughts.append(entry)

    # ── Determine verdict ──
    if next_thought_needed:
        verdict = "CAUTION"
        status = "in_progress"
        floors_triggered.append("F04")  # clarity — more work needed
    else:
        verdict = "SEAL"
        status = "complete"
        # Check: do we have enough thoughts?
        if len(session.thoughts) < 2 and not session.branches:
            verdict = "CAUTION"
            floors_triggered.append("F07")  # humility — single thought may be insufficient

    session.verdict_history.append(verdict)

    # ── AUTO-STORE to MEMORY on plan completion ──
    memory_stored = False
    memory_error = None
    if not next_thought_needed and AUTO_STORE_ENABLED:
        try:
            # Build confidence from accumulated thoughts
            tag_scores = {"OBS": 1.0, "DER": 0.85, "INT": 0.6, "SPEC": 0.3}
            tag_counts = {}
            for t in session.thoughts:
                tag_counts[t.epistemic_tag] = tag_counts.get(t.epistemic_tag, 0) + 1
            total_tags = sum(tag_counts.values()) or 1
            weighted_conf = sum(tag_scores.get(tag, 0.5) * count for tag, count in tag_counts.items())
            plan_confidence = min(0.99, 0.5 + (weighted_conf / total_tags) * 0.49)
            
            memory_stored = await _auto_store_plan(session, verdict, plan_confidence)
            if not memory_stored:
                memory_error = "MEMORY store failed or disabled"
        except Exception as e:
            memory_error = str(e)[:100]

    # ── Compile thought history ──
    all_thoughts = [
        {
            "number": t.thought_number,
            "total": t.total_thoughts,
            "thought": t.thought,
            "epistemic": t.epistemic_tag,
            "is_revision": t.is_revision,
            "revises": t.revises_thought,
            "branch_from": t.branch_from_thought,
            "branch_id": t.branch_id,
            "needs_more": t.needs_more_thoughts,
        }
        for t in session.thoughts
    ]

    branch_summary = {}
    for bid, entries in session.branches.items():
        branch_summary[bid] = [
            {
                "number": t.thought_number,
                "epistemic": t.epistemic_tag,
                "thought": t.thought[:200] + "..." if len(t.thought) > 200 else t.thought,
            }
            for t in entries
        ]

    # ── Compute confidence ──
    # Higher thought count + diverse epistemic tags → higher confidence
    tag_scores = {"OBS": 1.0, "DER": 0.85, "INT": 0.6, "SPEC": 0.3}
    tag_counts = {}
    for t in session.thoughts:
        tag_counts[t.epistemic_tag] = tag_counts.get(t.epistemic_tag, 0) + 1
    total = sum(tag_counts.values()) or 1
    weighted = sum(tag_scores.get(tag, 0.5) * count for tag, count in tag_counts.items())
    confidence = min(0.99, 0.5 + (weighted / total) * 0.49)

    # ── Compute entropy delta ──
    # Positive = more structure (good), Negative = chaos introduced
    if is_revision:
        entropy_delta = 0.05  # revision adds clarity
    elif branch_id:
        entropy_delta = -0.02  # branching temporarily increases uncertainty
    else:
        entropy_delta = 0.03  # normal thought reduces entropy

    # ── Build suggestion ──
    if not next_thought_needed:
        suggestion = (
            "MIND COMPLETE. Verify hypothesis. Consider: (1) Can you summarize the conclusion? "
            "(2) Are there unexamined alternatives? (3) Should this chain be sealed to VAULT999?"
        )
    elif needs_more_thoughts:
        suggestion = (
            f"Total thoughts adjusted upward. On step {thought_number}, "
            f"estimate at least {total_thoughts + 1} more needed. "
            "Consider branching if exploring alternatives."
        )
    else:
        suggestion = (
            f"Continue to thought {thought_number + 1}/{total_thoughts}. "
            "Adjust total_thoughts if scope changes. Branch if exploring alternatives."
        )

    # ── Assemble response ──
    data = {
        "session_id": session.session_id,
        "goal": session.goal or None,
        "thought_number": thought_number,
        "total_thoughts": total_thoughts,
        "next_thought_needed": next_thought_needed,
        "needs_more_thoughts": needs_more_thoughts,
        "is_revision": is_revision,
        "revises_thought": revises_thought,
        "branch_from_thought": branch_from_thought,
        "branch_id": branch_id,
        "epistemic_tag": epistemic_tag,
        "thought_history": all_thoughts,
        "thought_count": len(all_thoughts),
        "branch_count": len(session.branches),
        "branches": branch_summary if branch_summary else None,
        "chain_hash": _compute_thought_hash(all_thoughts),
        "status": status,
        "suggestion": suggestion,
        # ── MEMORY bridge telemetry ──
        "memory_stored": memory_stored,
        "memory_error": memory_error,
    }

    return _arifos_envelope(
        data,
        verdict=verdict,
        epistemic_tag=epistemic_tag,
        confidence=round(confidence, 4),
        entropy_delta=round(entropy_delta, 4),
        floors_triggered=list(set(floors_triggered)),
    )


# ─── MIND TOOL: mind_recall_context ───────────────────────────
@mcp.tool(
    name="mind_recall_context",
    description="""MIND: Recall prior related plans from MEMORY before starting new reasoning.

Queries the Cognitive Memory organ for semantically similar plans to the given goal.
Returns prior plans, decisions, and verdicts that can seed the new reasoning session.
Use this BEFORE mind_sequentialthinking to bootstrap cumulative intelligence.""",
)
async def mind_recall_context(
    goal: str,
    max_results: int = 3,
) -> dict[str, Any]:
    """Recall prior plans from MEMORY to bootstrap a new reasoning session."""
    plans = await _recall_prior_plans(goal, max_results)

    data = {
        "goal": goal,
        "prior_plans_found": len(plans),
        "prior_plans": plans,
        "suggestion": (
            "Prior plans found — use as context in mind_sequentialthinking. "
            "Consider revising prior approaches or building on past decisions."
            if plans else
            "No prior plans found. Start fresh reasoning with mind_sequentialthinking."
        ),
    }

    return _arifos_envelope(
        data,
        verdict="SEAL",
        epistemic_tag="DER",
        confidence=0.9 if plans else 0.5,
        entropy_delta=-0.05 if plans else 0.0,
        floors_triggered=[],
    )
@mcp.tool(
    name="mind_list_sessions",
    description="MIND: List active reasoning sessions with stats and verdict history",
)
async def mind_list_sessions() -> dict[str, Any]:
    sessions = []
    for sid, session in _sessions.items():
        tag_counts = {}
        for t in session.thoughts:
            tag_counts[t.epistemic_tag] = tag_counts.get(t.epistemic_tag, 0) + 1
        sessions.append({
            "session_id": sid,
            "goal": session.goal or None,
            "thought_count": len(session.thoughts),
            "branch_count": len(session.branches),
            "epistemic_distribution": tag_counts,
            "last_verdict": session.verdict_history[-1] if session.verdict_history else "NONE",
            "created_at": session.created_at,
            "last_activity": session.last_activity,
            "age_seconds": round(time.time() - session.created_at, 1),
        })

    data = {
        "active_sessions": len(sessions),
        "sessions": sorted(sessions, key=lambda s: s["last_activity"], reverse=True),
    }
    return _arifos_envelope(data, verdict="SEAL", epistemic_tag="OBS", confidence=0.99,
                            entropy_delta=0.0, organ=ORGAN_NAME, stage="777s")


# ─── MIND TOOL: mind_clear_session ────────────────────────────
@mcp.tool(
    name="mind_clear_session",
    description="MIND: Clear a reasoning session. Requires explicit session_id. Irreversible within memory scope.",
)
async def mind_clear_session(session_id: str) -> dict[str, Any]:
    if session_id in _sessions:
        session = _sessions[session_id]
        thought_count = len(session.thoughts)
        del _sessions[session_id]
        data = {
            "status": "cleared",
            "session_id": session_id,
            "thoughts_removed": thought_count,
            "branches_removed": len(session.branches),
        }
        return _arifos_envelope(data, verdict="SEAL", epistemic_tag="OBS",
                                confidence=1.0, entropy_delta=0.0,
                                floors_triggered=["F01"])  # reversible action
    data = {"status": "not_found", "session_id": session_id}
    return _arifos_envelope(data, verdict="CAUTION", epistemic_tag="OBS",
                            confidence=0.99, entropy_delta=0.0)


# ─── MIND TOOL: mind_health ───────────────────────────────────
@mcp.tool(
    name="mind_health",
    description="MIND: Health check — returns organ status, session count, version, and readiness",
)
async def mind_health() -> dict[str, Any]:
    data = {
        "status": "healthy",
        "organ": ORGAN_NAME,
        "role": ORGAN_ROLE,
        "stage": ORGAN_STAGE,
        "version": VERSION,
        "active_sessions": len(_sessions),
        "total_thoughts_tracked": sum(len(s.thoughts) for s in _sessions.values()),
        "total_branches": sum(len(s.branches) for s in _sessions.values()),
        "uptime_approx": "since service start",
    }
    return _arifos_envelope(data, verdict="SEAL", epistemic_tag="OBS",
                            confidence=0.99, entropy_delta=0.0,
                            organ=ORGAN_NAME, stage="000")


# ─── Entrypoint ────────────────────────────────────────────────
if __name__ == "__main__":
    host = os.environ.get("SEQ_THINK_HOST", "127.0.0.1")
    port = int(os.environ.get("SEQ_THINK_PORT", "51001"))


    # ── Health endpoint (for gateway parity probe) ──
    @mcp.custom_route("/health", methods=["GET"])
    async def health_route(request: Request) -> JSONResponse:
        return JSONResponse({
            "status": "healthy",
            "organ": ORGAN_NAME,
            "role": ORGAN_ROLE,
            "stage": ORGAN_STAGE,
            "version": VERSION,
            "active_sessions": len(_sessions),
            "total_thoughts_tracked": sum(len(s.thoughts) for s in _sessions.values()),
            "floors_active": FLOORS_ACTIVE,
            "transport": "streamable-http",
            "mcp_endpoint": "/mcp",
            "contract": "arifOS-MIND-THINK-v1.0",
        })


    print(f"🧠 MIND Sequential Thinking — arifOS Stage {ORGAN_STAGE} Organ")
    print(f"   Version: {VERSION}  |  Role: {ORGAN_ROLE}")
    print(f"   Listening on {host}:{port}")
    print(f"   Contract: arifOS-MIND-THINK-v1.0")
    print(f"   Active floors: {', '.join(FLOORS_ACTIVE)}")
    mcp.run(transport="streamable-http", host=host, port=port)
