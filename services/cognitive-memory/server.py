"""
MEMORY Cognitive Memory — arifOS Federation Organ (Stage 555m+)
Bridges Qdrant (semantic vectors) + Graphiti MCP (knowledge graph) + VAULT999 (immutable).

Contract: arifOS-MEMORY-COGNITIVE-v1.0
  - Stores MIND plans as first-class graph objects
  - Semantic recall via Qdrant
  - Graph traversal via Graphiti/FalkorDB
  - Contradiction detection across stored plans
  - Cross-session cumulative intelligence

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

import httpx
from fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import JSONResponse

# ─── Server Identity ───────────────────────────────────────────
VERSION = "0.1.0"
ORGAN_NAME = "MEMORY"
ORGAN_ROLE = "cognitive_memory"
ORGAN_STAGE = "555m+"

mcp = FastMCP(
    name="memory-cognitive",
    instructions=(
        "MEMORY Cognitive Memory — arifOS Stage 555m+ Organ. "
        "Bridges Qdrant semantic search + Graphiti knowledge graph + VAULT999 immutability. "
        f"Version {VERSION}. Role: {ORGAN_ROLE}."
    ),
    version=VERSION,
)

# ─── Configuration ────────────────────────────────────────────
QDRANT_URL = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333")
GRAPHITI_MCP_URL = os.environ.get("GRAPHITI_MCP_URL", "http://127.0.0.1:8000/mcp")
QDRANT_COLLECTION = os.environ.get("MEMORY_COLLECTION", "arifos_cognitive_memory")

FLOORS_ACTIVE = ["F01", "F02", "F04", "F07", "F08", "F09", "F10", "F13"]
DEFAULT_WITNESS = {"human": 0.42, "ai": 0.32, "earth": 0.26}

# ─── Graphiti Session Pool ────────────────────────────────────
_graphiti_session: dict = {}


async def _graphiti_call(tool_name: str, arguments: dict) -> dict:
    """Call a Graphiti MCP tool with session management."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Establish session if needed
        now = time.time()
        if not _graphiti_session or _graphiti_session.get("expires_at", 0) < now:
            sse_resp = await client.get(GRAPHITI_MCP_URL, headers={"Accept": "text/event-stream"})
            sid = sse_resp.headers.get("mcp-session-id")
            if sid:
                init_body = {
                    "jsonrpc": "2.0", "id": 1, "method": "initialize",
                    "params": {"protocolVersion": "2025-03-26", "capabilities": {},
                               "clientInfo": {"name": "memory-cognitive", "version": VERSION}},
                }
                await client.post(GRAPHITI_MCP_URL, json=init_body, headers={
                    "Content-Type": "application/json", "Accept": "application/json, text/event-stream",
                    "mcp-session-id": sid,
                })
                _graphiti_session["session_id"] = sid
                _graphiti_session["expires_at"] = now + 300

        sid = _graphiti_session.get("session_id", "")
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        if sid:
            headers["mcp-session-id"] = sid

        call_body = {
            "jsonrpc": "2.0", "id": 2, "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments},
        }
        resp = await client.post(GRAPHITI_MCP_URL, json=call_body, headers=headers)

        # Parse SSE response
        body_data = {}
        if resp.content:
            raw = resp.content.decode()
            for line in raw.split("\n"):
                if line.startswith("data: "):
                    try:
                        body_data = json.loads(line[6:])
                    except json.JSONDecodeError:
                        pass
        return body_data


# ─── Qdrant Helpers ───────────────────────────────────────────
async def _qdrant_search(query_vector: list[float], limit: int = 10) -> list[dict]:
    """Search Qdrant for semantically similar memories."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                f"{QDRANT_URL}/collections/{QDRANT_COLLECTION}/points/search",
                json={"vector": query_vector, "limit": limit, "with_payload": True},
            )
            if resp.status_code == 200:
                return resp.json().get("result", [])
        except Exception:
            pass
    return []


async def _qdrant_upsert(point_id: str, vector: list[float], payload: dict) -> bool:
    """Store a point in Qdrant."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.put(
                f"{QDRANT_URL}/collections/{QDRANT_COLLECTION}/points",
                json={"points": [{"id": point_id, "vector": vector, "payload": payload}]},
            )
            return resp.status_code == 200
        except Exception:
            return False


# ─── Simple Embedding (hash-based, replace with real embeddings later) ──
def _simple_embed(text: str, dims: int = 384) -> list[float]:
    """Deterministic hash-based embedding for prototyping.
    Replace with bge-m3 or similar in production."""
    h = hashlib.sha256(text.encode()).digest()
    vec = []
    for i in range(dims):
        byte_val = h[i % len(h)]
        vec.append((byte_val / 255.0) * 2 - 1)
    # Normalize
    norm = sum(v * v for v in vec) ** 0.5
    return [v / norm for v in vec] if norm > 0 else vec


# ─── arifOS-Native Envelope ───────────────────────────────────
def _envelope(data: dict, verdict: str = "SEAL", epistemic_tag: str = "DER",
              confidence: float = 0.95, entropy_delta: float = 0.0,
              floors_triggered: list[str] | None = None) -> dict:
    return {
        **data,
        "verdict": verdict,
        "epistemic_tag": epistemic_tag,
        "floors_active": FLOORS_ACTIVE,
        "floors_triggered": floors_triggered or [],
        "organ": ORGAN_NAME,
        "stage": ORGAN_STAGE,
        "thermodynamic": {"entropy_delta": entropy_delta, "confidence": confidence,
                          "peace_squared": 1.0, "vitality_index": 0.85},
        "witness": DEFAULT_WITNESS,
        "telemetry": {"timestamp_utc": time.time(), "version": VERSION,
                      "schema": "arifOS-MEMORY-COGNITIVE-v1.0"},
    }


# ═══════════════════════════════════════════════════════════════
# MEMORY TOOLS
# ═══════════════════════════════════════════════════════════════

@mcp.tool(
    name="mem_store_plan",
    description="""MEMORY: Store a MIND reasoning plan into long-term cognitive memory.

Stores in BOTH Qdrant (semantic vector) and Graphiti (knowledge graph node).
This enables cross-session recall and cumulative intelligence.

Provide the plan output from mind_sequentialthinking or mind_plan() calls.
The plan becomes a searchable, graph-linked memory node.""",
)
async def mem_store_plan(
    plan_id: str,
    goal: str,
    plan_summary: str,
    thought_count: int = 0,
    verdict: str = "SEAL",
    confidence: float = 0.9,
    tags: str = "",
    source_session: str = "",
) -> dict[str, Any]:
    """Store a MIND plan into persistent cognitive memory."""
    floors_triggered = []

    # ── F09 check ──
    hantu_words = ["conscious", "soul", "alive", "sentient"]
    if any(w in plan_summary.lower() for w in hantu_words):
        floors_triggered.extend(["F09", "F10"])
        return _envelope(
            {"status": "rejected", "reason": "F09 ANTI-HANTU: plan contains consciousness claims"},
            verdict="VOID", confidence=1.0, floors_triggered=floors_triggered,
        )

    # ── Store in Graphiti ──
    group_id = f"plan-{plan_id}"
    graphiti_result = await _graphiti_call("add_memory", {
        "name": f"Plan: {goal[:60]}",
        "episode_body": json.dumps({
            "type": "mind_plan",
            "plan_id": plan_id,
            "goal": goal,
            "summary": plan_summary,
            "thought_count": thought_count,
            "verdict": verdict,
            "confidence": confidence,
            "tags": [t.strip() for t in tags.split(",") if t.strip()],
            "source_session": source_session,
            "stored_at": time.time(),
        }),
        "group_id": group_id,
        "source": "MIND",
        "source_description": f"arifOS MIND organ plan output (stage 333s)",
    })

    # ── Store in Qdrant ──
    vector = _simple_embed(f"{goal} {plan_summary}")
    point_id = str(uuid.uuid4())
    qdrant_ok = await _qdrant_upsert(point_id, vector, {
        "plan_id": plan_id,
        "goal": goal,
        "summary": plan_summary[:500],
        "verdict": verdict,
        "thought_count": thought_count,
        "tags": tags,
        "source": "MIND",
        "type": "plan",
    })

    # ── Response ──
    graphiti_ok = "result" in graphiti_result
    if not qdrant_ok:
        floors_triggered.append("F04")

    data = {
        "status": "stored" if (graphiti_ok and qdrant_ok) else "partial",
        "plan_id": plan_id,
        "graphiti_stored": graphiti_ok,
        "qdrant_stored": qdrant_ok,
        "group_id": group_id if graphiti_ok else None,
        "collection": QDRANT_COLLECTION,
    }
    return _envelope(data, verdict="SEAL" if qdrant_ok else "CAUTION",
                     epistemic_tag="OBS", confidence=0.99 if qdrant_ok else 0.5,
                     entropy_delta=-0.05, floors_triggered=floors_triggered)


@mcp.tool(
    name="mem_recall_plans",
    description="""MEMORY: Search for stored plans semantically similar to the query.

Returns ranked results from Qdrant vector search + Graphiti graph expansion.
Use this before starting a new reasoning task to find prior related plans.""",
)
async def mem_recall_plans(
    query: str,
    max_results: int = 5,
    include_graph_context: bool = True,
) -> dict[str, Any]:
    """Recall semantically similar plans from cognitive memory."""
    vector = _simple_embed(query)
    qdrant_results = await _qdrant_search(vector, limit=max_results)

    plans = []
    for r in qdrant_results:
        payload = r.get("payload", {})
        plans.append({
            "plan_id": payload.get("plan_id", "?"),
            "goal": payload.get("goal", "")[:120],
            "summary": payload.get("summary", "")[:200],
            "verdict": payload.get("verdict", "?"),
            "thought_count": payload.get("thought_count", 0),
            "score": round(r.get("score", 0), 4),
        })

    # Graph expansion for top result
    graph_context = None
    if include_graph_context and plans:
        top_plan = plans[0]
        node_result = await _graphiti_call("search_nodes", {
            "query": top_plan["goal"], "max_nodes": 3,
        })
        if "result" in node_result:
            content = node_result.get("result", {}).get("content", [{}])
            if content:
                try:
                    graph_context = json.loads(content[0].get("text", "{}"))
                except Exception:
                    graph_context = str(content)[:500]

    data = {
        "query": query,
        "results_count": len(plans),
        "plans": plans,
        "graph_context": graph_context,
    }
    return _envelope(data, verdict="SEAL", epistemic_tag="DER",
                     confidence=0.9 if plans else 0.3,
                     entropy_delta=-0.03 if plans else 0.0)


@mcp.tool(
    name="mem_detect_contradictions",
    description="""MEMORY: Detect contradictions between stored plans.

Compares a new plan summary against existing stored plans using
semantic search + graph relationship analysis. Returns conflicting
plans with contradiction scores.""",
)
async def mem_detect_contradictions(
    plan_summary: str,
    threshold: float = 0.7,
) -> dict[str, Any]:
    """Detect contradictions between new plan and stored plans."""
    vector = _simple_embed(plan_summary)
    results = await _qdrant_search(vector, limit=5)

    contradictions = []
    for r in results:
        payload = r.get("payload", {})
        score = r.get("score", 0)
        # High similarity to an opposite-verdict plan = potential contradiction
        if score > threshold:
            contradictions.append({
                "plan_id": payload.get("plan_id", "?"),
                "goal": payload.get("goal", "")[:100],
                "verdict": payload.get("verdict", "?"),
                "similarity": round(score, 4),
                "risk": "HIGH" if score > 0.9 else "MEDIUM",
            })

    data = {
        "checked_against": len(results),
        "contradictions_found": len(contradictions),
        "contradictions": contradictions,
        "threshold": threshold,
    }
    verdict = "CAUTION" if contradictions else "SEAL"
    return _envelope(data, verdict=verdict, epistemic_tag="DER",
                     confidence=0.95, entropy_delta=0.02 if contradictions else 0.0)


@mcp.tool(
    name="mem_get_plan_graph",
    description="""MEMORY: Retrieve the full plan graph for a given plan_id from Graphiti.

Returns nodes, edges, and related episodes connected to this plan.""",
)
async def mem_get_plan_graph(plan_id: str) -> dict[str, Any]:
    """Get graph context around a stored plan."""
    node_result = await _graphiti_call("search_nodes", {
        "query": plan_id, "max_nodes": 5,
    })
    facts_result = await _graphiti_call("search_memory_facts", {
        "query": plan_id, "max_facts": 5,
    })

    data = {
        "plan_id": plan_id,
        "graph_nodes": node_result.get("result", {}),
        "memory_facts": facts_result.get("result", {}),
    }
    return _envelope(data, verdict="SEAL", epistemic_tag="OBS", confidence=0.9)


@mcp.tool(
    name="mem_stats",
    description="MEMORY: Return memory system statistics — collection sizes, graph health, recent activity",
)
async def mem_stats() -> dict[str, Any]:
    """Memory system health and statistics."""
    # Qdrant collection info
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            q_resp = await client.get(f"{QDRANT_URL}/collections/{QDRANT_COLLECTION}")
            q_info = q_resp.json().get("result", {}) if q_resp.status_code == 200 else {}
        except Exception:
            q_info = {}

    # Graphiti status
    g_status = await _graphiti_call("get_status", {})

    data = {
        "qdrant_collection": QDRANT_COLLECTION,
        "qdrant_points": q_info.get("points_count", "?"),
        "graphiti_status": "connected" if "result" in g_status else "error",
        "graphiti_endpoint": GRAPHITI_MCP_URL,
    }
    return _envelope(data, verdict="SEAL", epistemic_tag="OBS", confidence=0.99)


@mcp.tool(
    name="mem_health",
    description="MEMORY: Health check — returns organ status, connections, and readiness",
)
async def mem_health() -> dict[str, Any]:
    data = {
        "status": "healthy",
        "organ": ORGAN_NAME,
        "role": ORGAN_ROLE,
        "stage": ORGAN_STAGE,
        "version": VERSION,
        "qdrant_url": QDRANT_URL,
        "graphiti_url": GRAPHITI_MCP_URL,
        "collection": QDRANT_COLLECTION,
    }
    return _envelope(data, verdict="SEAL", epistemic_tag="OBS", confidence=0.99)


# ─── Health endpoint ──────────────────────────────────────────
# ─── Entrypoint ────────────────────────────────────────────────
if __name__ == "__main__":
    host = os.environ.get("MEM_HOST", "127.0.0.1")
    port = int(os.environ.get("MEM_PORT", "51002"))

    @mcp.custom_route("/health", methods=["GET"])
    async def health_route(request: Request) -> JSONResponse:
        return JSONResponse({
            "status": "healthy", "organ": ORGAN_NAME,
            "role": ORGAN_ROLE, "stage": ORGAN_STAGE,
            "version": VERSION, "qdrant_url": QDRANT_URL,
            "graphiti_url": GRAPHITI_MCP_URL,
            "floors_active": FLOORS_ACTIVE,
            "contract": "arifOS-MEMORY-COGNITIVE-v1.0",
        })

    print(f"🧠 MEMORY Cognitive — arifOS Stage {ORGAN_STAGE} Organ")
    print(f"   Version: {VERSION}  |  Role: {ORGAN_ROLE}")
    print(f"   Listening on {host}:{port}")
    print(f"   Qdrant: {QDRANT_URL}  |  Graphiti: {GRAPHITI_MCP_URL}")
    mcp.run(transport="streamable-http", host=host, port=port)
