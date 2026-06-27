#!/usr/bin/env python3
"""
mcp-memory — Narrow memory / governance surface for Grok Build.

Exposes minimal tools for ADRs, Cooling Ledger, Dream Engine context, constitutional memory.

Bridges to existing arifos_memory_mcp where possible, but scoped for Grok Build orchestration.

Tools (very narrow):
- recall_adr_context
- recall_cooling_ledger
- get_dream_summary (or recent entropy notes)
- search_governance (F floors, 888 notes)

Read-only. Ties into F11 audit, F7 humility.

For mcp-ops-change or irreversible: always escalate to arifOS 888 via A2A or arifOS MCP.

Hybrid use: After xAI multi-agent research, use this for sovereign memory grounding before execution in Grok Build.

Transport: stdio preferred.
"""

from __future__ import annotations
import logging
import os
from pathlib import Path
from typing import Dict, Any, List, Optional

from fastmcp import FastMCP

logger = logging.getLogger(__name__)

mcp = FastMCP(
    name="mcp-memory",
    instructions="Narrow sovereign memory surface: ADRs, Cooling Ledger entries, Dream Engine summaries, governance constraints. For Grok Build planning and reflection phases. Read tier. Escalate mutations via arifOS 888 + A2A.",
    version="2026.06.23-arifos-gb",
)

ROOT = Path(os.environ.get("REPO_ROOT", "/root"))
ADR_DIR = ROOT / "arifOS" / "adr"
# Real grounded locations (HERMES owns daily pulses + cooling; AAA fallback; arifOS core)
COOLING_DIRS = [
    ROOT / "HERMES" / "audit" / "cooling_ledger",
    ROOT / "AAA" / "registries" / "cooling_ledger",
]
PULSE_BASE = ROOT / "HERMES" / "state" / "daily-pulse"
DREAM_BASE = ROOT / "HERMES" / "state" / "dream-engine"
DREAM_SPEC_FALLBACKS = [
    ROOT / "arifOS" / "docs" / "DREAM_ENGINE_SPEC.md",
    ROOT / "docs" / "DREAM_ENGINE_SPEC.md",
    ROOT / "D-DAJJAL" / "WELL_DREAM_ENGINE_SPEC.md",
]

@mcp.tool()
def recall_adr_context(query: str, top_k: int = 5) -> Dict[str, Any]:
    """Semantic-ish recall of relevant ADRs. Real load from /root/arifOS/adr."""
    logger.info("recall_adr_context called", extra={"tool": "recall_adr_context", "query": query[:80]})
    adrs = sorted(ADR_DIR.glob("*.md"))
    hits = []
    q = query.lower()
    for a in adrs:
        try:
            txt = a.read_text(encoding="utf-8", errors="replace")
            if q in txt.lower() or q in a.name.lower():
                hits.append({"adr": a.name, "snippet": txt[:400], "path": str(a.relative_to(REPO_ROOT))})
        except Exception:
            pass
        if len(hits) >= top_k:
            break
    return {"status": "ok", "hits": hits, "source": "arifOS/adr", "telemetry": {"tool": "recall_adr_context"}}

def _find_cooling_entries(q: str = "", top_k: int = 5) -> List[Dict]:
    entries: List[Dict] = []
    for cdir in COOLING_DIRS:
        if not cdir.exists():
            continue
        for f in sorted(cdir.glob("*.yaml"))[-top_k:]:
            try:
                content = f.read_text(encoding="utf-8", errors="replace")
                if not q or q in content.lower() or q in f.name.lower():
                    entries.append({"file": f.name, "content": content[:600], "path": str(f.relative_to(ROOT))})
            except Exception:
                pass
            if len(entries) >= top_k:
                break
    return entries

@mcp.tool()
def recall_cooling_ledger(query: str = "", top_k: int = 5) -> Dict[str, Any]:
    """Recall recent Cooling Ledger entries for reflection. Grounded in HERMES + AAA locations."""
    logger.info("recall_cooling_ledger called", extra={"tool": "recall_cooling_ledger"})
    q = query.lower()
    entries = _find_cooling_entries(q, top_k)
    return {"status": "ok", "entries": entries, "note": "Cooling Ledger for F7/F11 humility and audit. Bridge to arifos-memory-mcp or arifOS core/cooling_ledger.py for semantic. Escalate writes via 888.", "telemetry": {"tool": "recall_cooling_ledger", "sources": [str(d) for d in COOLING_DIRS]}}

@mcp.tool()
def get_dream_summary() -> Dict[str, Any]:
    """Recent Dream Engine / entropy synthesis summary. Grounded across known locations."""
    summary = "Dream Engine: thermodynamic consolidation of memory (L4/L6). Use for Malam reflection and next Pagi briefing."
    for dp in DREAM_SPEC_FALLBACKS:
        if dp.exists():
            try:
                summary = dp.read_text(encoding="utf-8", errors="replace")[:900]
                break
            except Exception:
                pass
    # Also surface recent dream outbox if present
    outbox = DREAM_BASE / "outbox"
    recent = []
    if outbox.exists():
        for f in sorted(outbox.glob("*.md"))[-2:]:
            try:
                recent.append({"file": f.name, "snippet": f.read_text(errors="ignore")[:300]})
            except Exception:
                pass
    return {"status": "ok", "summary": summary, "recent_outbox": recent, "telemetry": {"tool": "get_dream_summary", "pulse_loop": "malam->dream->pagi"}}

@mcp.tool()
def search_governance(query: str, top_k: int = 5) -> Dict[str, Any]:
    """Search constitutional floors, 888 notes, F-gates, ADRs. Thin governance overlay. Full via arifOS 888 + A2A."""
    logger.info("search_governance called", extra={"tool": "search_governance", "query": query[:80]})
    q = query.lower()
    results: List[Dict] = []
    # Scan ADRs for governance mentions (F floors, 888, HOLD)
    if ADR_DIR.exists():
        for a in sorted(ADR_DIR.glob("*.md")):
            try:
                txt = a.read_text(errors="ignore")
                if any(k in txt.lower() for k in ["f1", "f11", "888", "hold", "floor", "amanah", "judge"]):
                    if not q or q in txt.lower() or q in a.name.lower():
                        results.append({"type": "adr", "id": a.name, "snippet": txt[:280].replace("\n", " ")})
            except Exception:
                pass
            if len(results) >= top_k:
                break
    # Static core constitutional anchors
    anchors = [
        {"floor": "F1", "note": "Read is reversible. All mutation requires pre-think + lease or 888."},
        {"floor": "F2", "note": "Truth from FS + evidence organs. No hallucinated paths."},
        {"action": "888_HOLD", "note": "Escalate irreversible / high blast via arifOS MCP or A2A."},
        {"layer": "L11/L13", "note": "Governance and seal paths authenticated."},
    ]
    for a in anchors:
        if not q or q in str(a).lower():
            results.append(a)
    return {"status": "ok", "results": results[:top_k], "note": "Governance overlay. Full judgment via arifOS 888 + AAA A2A mesh. Use for Grok Build planning before any change.", "telemetry": {"tool": "search_governance"}}

@mcp.tool()
def get_rhythm_context(pulse: str = "pagi", date: str = "latest") -> Dict[str, Any]:
    """Return context from the closed daily intelligence loop (Pagi/Midday/Malam + dream feeds).
    Used by Grok Build for orientation before work (Pagi) or reflection (Malam).
    Grounded in HERMES state.
    """
    valid = {"pagi", "midday", "malam"}
    p = pulse if pulse in valid else "pagi"
    base = PULSE_BASE / p
    content = ""
    files = []
    if base.exists():
        if date == "latest":
            cands = sorted([f for f in base.glob("*.md") if f.is_file()])
            target = cands[-1] if cands else None
        else:
            target = base / f"{date}.md"
        if target and target.exists():
            try:
                content = target.read_text(encoding="utf-8", errors="replace")[:2000]
            except Exception:
                content = ""
        files = [str(f.relative_to(ROOT)) for f in sorted(base.glob("*.md"))[-3:]]
    dream_feed = ""
    inbox = DREAM_BASE / "inbox"
    if inbox.exists():
        for f in sorted(inbox.glob("*"))[-1:]:
            try:
                dream_feed = f.read_text(errors="ignore")[:400]
            except Exception:
                pass
    return {
        "status": "ok",
        "pulse": p,
        "date": date,
        "content": content,
        "recent_files": files,
        "dream_feed": dream_feed,
        "telemetry": {"tool": "get_rhythm_context", "loop": "pagi-midday-malam-dream"},
        "note": "Hermes daily rhythm grounded. Malam reflection feeds next Pagi. For kernel judgment use mcp-arifos-kernel."
    }

if __name__ == "__main__":
    import sys
    if "--http" in sys.argv:
        mcp.run(transport="streamable-http", host="127.0.0.1", port=18792)
    else:
        mcp.run(transport="stdio")
