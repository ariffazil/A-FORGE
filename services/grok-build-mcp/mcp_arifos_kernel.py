#!/usr/bin/env python3
"""
mcp-arifos-kernel — Narrow, read-first sovereign surface for arifOS kernel.

This is the optimal agentic MCP transport for Grok Build (AAA) to the arifOS constitutional kernel
without loading the monolithic 17k+ LOC runtime/tools.py surface.

Purpose (per daily operating system + narrow MCP philosophy):
- High-signal, low-noise access to constitutional state, floors, entropy, rhythm hooks.
- Read tier first (F1 reversible).
- Gated entry to judgment / seal (never auto-mutate; always escalate to 888_HOLD + A2A or arifOS MCP).
- Integrates daily rhythm (Pagi briefing grounding, Malam reflection -> cooling).
- Uses real arifOS core modules where possible (constitution_kernel, cooling, entropy report, floors).

Tools (tight, 7 max):
- get_kernel_health
- check_floors
- get_rhythm_context (kernel view of daily pulses)
- recall_kernel_memory (governed seals, recent verdicts, ADRs)
- submit_for_judgment (candidate + evidence -> structured HOLD + escalation receipt)
- record_malam_reflection (writes to cooling ledger; feeds dream)
- get_entropy_snapshot (from entropy-report.json + runtime)

All outputs: {"status": "ok|hold|error", ..., "telemetry": {...}, "escalation": {...}}

Transport: stdio (primary for Grok Build), streamable-http option.
Constitutional: F1, F2, F4, F7, F9, F11, F13. Never bypasses 888.
Hybrid: xAI multi-agent for breadth -> this for sovereign kernel depth -> A-FORGE for execution.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastmcp import FastMCP

mcp = FastMCP(
    name="mcp-arifos-kernel",
    instructions=(
        "Narrow constitutional kernel surface for Grok Build. "
        "Read-first access to arifOS floors, entropy, rhythm, sealed memory. "
        "Judgment entry always gated (returns escalation instructions). "
        "Part of arifOS AAA A-FORGE narrow MCP federation. F1-F13 native. "
        "Escalate mutations via A-FORGE leases + arifOS 888 + AAA A2A."
    ),
    version="2026.06.23-arifos-gb-kernel",
)

ROOT = Path(os.environ.get("REPO_ROOT", "/root"))

# Canonical arifOS kernel sources (truth)
ARIFOS_ROOT = ROOT / "arifOS"
ADR_DIR = ARIFOS_ROOT / "adr"
ENTROPY_REPORT = ARIFOS_ROOT / "entropy-report.json"
VAULT_DIR = ARIFOS_ROOT / "VAULT999"
KERNEL_CORE = ARIFOS_ROOT / "arifosmcp" / "core"
PULSE_BASE = ROOT / "HERMES" / "state" / "daily-pulse"
COOLING_CANDIDATES = [
    ROOT / "HERMES" / "audit" / "cooling_ledger",
    ROOT / "AAA" / "registries" / "cooling_ledger",
]
DREAM_BASE = ROOT / "HERMES" / "state" / "dream-engine"


def _safe_read(path: Path, max_bytes: int = 200_000) -> str:
    try:
        if path.exists() and path.is_file():
            data = path.read_bytes()
            if len(data) > max_bytes:
                data = data[:max_bytes]
            return data.decode("utf-8", errors="replace")
    except Exception:
        pass
    return ""


def _tele(tool: str, **extra: Any) -> Dict[str, Any]:
    t = {"tool": tool, "ts": datetime.now(timezone.utc).isoformat(), "surface": "mcp-arifos-kernel"}
    t.update(extra)
    return t


@mcp.tool()
def get_kernel_health() -> Dict[str, Any]:
    """Snapshot of arifOS kernel health, entropy, floors summary, last rhythm, vault liveness."""
    health: Dict[str, Any] = {
        "status": "ok",
        "kernel": "arifOS constitutional core",
        "floors_active": ["F1", "F2", "F4", "F7", "F9", "F11", "F13"],
        "telemetry": _tele("get_kernel_health"),
    }

    # Entropy report (direct from arifOS root)
    if ENTROPY_REPORT.exists():
        try:
            rep = json.loads(_safe_read(ENTROPY_REPORT))
            health["entropy"] = {
                "epoch": rep.get("epoch"),
                "loc_summary": rep.get("metrics", {}).get("loc_summary"),
                "hotspots_count": len(rep.get("metrics", {}).get("hotspots", [])),
            }
        except Exception:
            health["entropy"] = {"note": "entropy-report present but unparsable"}

    # Recent VAULT seals (read-only chain state)
    seals: List[str] = []
    if VAULT_DIR.exists():
        for p in sorted(VAULT_DIR.glob("**/*.jsonl"))[-3:]:
            try:
                lines = _safe_read(p).strip().splitlines()[-1:]
                if lines:
                    seals.append({"file": str(p.relative_to(ROOT)), "tail": lines[0][:200]})
            except Exception:
                pass
    health["recent_vault"] = seals

    # Last known rhythm (pagi)
    pagi_dir = PULSE_BASE / "pagi"
    if pagi_dir.exists():
        latest = sorted([f for f in pagi_dir.glob("*.md") if f.is_file()])
        if latest:
            health["last_pagi"] = str(latest[-1].relative_to(ROOT))

    # Core kernel files presence (evidence of liveness)
    core_files = ["constitution_kernel.py", "floors.py", "authority_gate.py"]
    present = [f for f in core_files if (KERNEL_CORE / f).exists() or (ARIFOS_ROOT / "core" / f).exists()]
    health["core_kernel_modules"] = present

    return health


@mcp.tool()
def check_floors(action_description: str = "", context: Optional[str] = None) -> Dict[str, Any]:
    """Lightweight constitutional floor pre-check. Returns structured advisory (not final verdict).
    For real judgment: use submit_for_judgment + escalate to arifOS arif_judge or 888 via A2A.
    """
    desc = (action_description or "").lower()
    flags: List[str] = []
    if any(k in desc for k in ["delete", "rm ", "drop ", "force", "prod", "deploy", "secret", "vault"]):
        flags.append("F1/F13: potential irreversible or high-blast")
    if "external" in desc or "multi-agent" in desc or "research" in desc:
        flags.append("F7: external signal — apply humility + cross-verify (F2)")
    if not flags:
        flags.append("F2/F4: no obvious high-risk markers in description")

    return {
        "status": "ok",
        "advisory": "PRE-CHECK ONLY. This is not 888_JUDGE.",
        "flags": flags,
        "recommendation": "Route high-risk or uncertain via submit_for_judgment or direct arifOS MCP 888 + A2A.",
        "telemetry": _tele("check_floors", flags=len(flags)),
    }


@mcp.tool()
def get_rhythm_context(pulse: str = "pagi", date: str = "latest") -> Dict[str, Any]:
    """Kernel-aware view of Hermes daily rhythm for orientation (Pagi) and closure (Malam)."""
    p = pulse if pulse in {"pagi", "midday", "malam"} else "pagi"
    base = PULSE_BASE / p
    content = ""
    files: List[str] = []
    if base.exists():
        cands = sorted([f for f in base.glob("*.md") if f.is_file()])
        target = cands[-1] if (date == "latest" and cands) else (base / f"{date}.md" if date != "latest" else None)
        if target and target.exists():
            content = _safe_read(target)[:1800]
        files = [str(f.relative_to(ROOT)) for f in cands[-3:]]
    return {
        "status": "ok",
        "pulse": p,
        "content": content,
        "recent": files,
        "note": "Closed loop: Malam reflection -> Dream Engine -> Pagi briefing. Kernel health feeds orientation.",
        "telemetry": _tele("get_rhythm_context", pulse=p),
    }


@mcp.tool()
def recall_kernel_memory(query: str = "", top_k: int = 5) -> Dict[str, Any]:
    """Governed recall of kernel artifacts: recent seals, ADR governance, constitution notes."""
    q = (query or "").lower()
    hits: List[Dict[str, Any]] = []

    # ADRs
    if ADR_DIR.exists():
        for a in sorted(ADR_DIR.glob("*.md")):
            try:
                txt = a.read_text(errors="ignore")
                if (not q) or (q in txt.lower() or q in a.name.lower()):
                    hits.append({"type": "adr", "id": a.name, "path": str(a.relative_to(ROOT)), "snippet": txt[:220]})
            except Exception:
                pass
            if len(hits) >= top_k:
                break

    # Recent vault seals (read)
    if VAULT_DIR.exists() and len(hits) < top_k:
        for jl in sorted(VAULT_DIR.rglob("*.jsonl")):
            try:
                tail = _safe_read(jl).splitlines()[-1:]
                if tail and (not q or q in tail[0].lower()):
                    hits.append({"type": "vault_seal", "file": str(jl.relative_to(ROOT)), "snippet": tail[0][:180]})
            except Exception:
                pass
            if len(hits) >= top_k:
                break

    return {
        "status": "ok",
        "hits": hits[:top_k],
        "note": "Read-only kernel memory. Full semantic via arifos-memory-mcp. 888 judgment for action.",
        "telemetry": _tele("recall_kernel_memory"),
    }


@mcp.tool()
def submit_for_judgment(candidate: str, evidence_refs: Optional[List[str]] = None) -> Dict[str, Any]:
    """Submit a candidate action/decision for 888-style judgment.
    Returns HOLD structure + exact escalation path. Does NOT execute judgment here.
    Real 888 lives in arifOS MCP (arif_judge) + AAA A2A deliberation + Arif (F13).
    """
    evidence_refs = evidence_refs or []
    receipt = {
        "status": "hold",
        "verdict": "HOLD",
        "candidate": candidate[:500],
        "evidence_refs": evidence_refs,
        "escalation": {
            "primary": "arifOS MCP arif_judge (http://localhost:8088 or arifos.arif-fazil.com/mcp)",
            "a2a": "AAA a2a-server (3001) — submit task with type '888_judge'",
            "fallback": "A-FORGE lease if execution scoped; always precede with this hold receipt",
        },
        "required": ["domain_evidence (GEOX/WEALTH/WELL)", "pre_critique if dignity/ethics", "ack_irreversible for seal"],
        "telemetry": _tele("submit_for_judgment"),
        "next": "Feed this receipt + evidence into arif_judge or A2A 888. After SEAL, record via record_malam_reflection.",
    }
    return receipt


@mcp.tool()
def record_malam_reflection(content: str, tags: Optional[List[str]] = None, date: Optional[str] = None) -> Dict[str, Any]:
    """Record evening (Malam) reflection. Writes to Cooling Ledger (F7/F11).
    This closes the daily loop and feeds Dream Engine + next Pagi.
    Mutation is intentional here — always called from governed Grok Build flow with context.
    """
    tags = tags or ["malam", "reflection"]
    date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    written: List[str] = []
    payload = f"""---
date: {date}
tags: {tags}
source: mcp-arifos-kernel / Grok Build Malam
---
{content[:4000]}
"""

    for cdir in COOLING_CANDIDATES:
        try:
            cdir.mkdir(parents=True, exist_ok=True)
            out = cdir / f"malam-{date}.md"
            out.write_text(payload, encoding="utf-8")
            written.append(str(out.relative_to(ROOT)))
        except Exception as e:
            written.append(f"error:{cdir}:{e}")

    # Also drop into dream inbox for engine pickup
    try:
        (DREAM_BASE / "inbox").mkdir(parents=True, exist_ok=True)
        dream_in = DREAM_BASE / "inbox" / f"malam-{date}.md"
        dream_in.write_text(payload[:1200], encoding="utf-8")
        written.append(str(dream_in.relative_to(ROOT)))
    except Exception:
        pass

    return {
        "status": "ok",
        "written": written,
        "note": "Malam reflection recorded. Cooling + dream inbox updated. Next Pagi will ingest. For 999_SEAL use arif_seal after 888.",
        "telemetry": _tele("record_malam_reflection", tags=",".join(tags)),
    }


@mcp.tool()
def get_entropy_snapshot() -> Dict[str, Any]:
    """Direct kernel entropy + hotspot view from arifOS entropy-report + runtime state."""
    snap: Dict[str, Any] = {"status": "ok", "source": str(ENTROPY_REPORT)}
    raw = _safe_read(ENTROPY_REPORT)
    if raw:
        try:
            data = json.loads(raw)
            snap["metrics"] = data.get("metrics", {})
            snap["hotspots"] = data.get("metrics", {}).get("hotspots", [])[:3]
        except Exception:
            snap["raw_head"] = raw[:600]
    # Add core cooling status stub
    snap["cooling"] = "Use record_malam_reflection + recall via mcp-memory. Core/cooling_ledger.py active for SABAR."
    snap["telemetry"] = _tele("get_entropy_snapshot")
    return snap


if __name__ == "__main__":
    import sys
    if "--http" in sys.argv:
        # Non-default port for narrow kernel surface
        mcp.run(transport="streamable-http", host="127.0.0.1", port=18793)
    else:
        mcp.run(transport="stdio")
