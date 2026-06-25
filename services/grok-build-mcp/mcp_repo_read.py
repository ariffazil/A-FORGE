#!/usr/bin/env python3
"""
mcp-repo-read — Narrow, read-only, cognitive-clarity MCP server for Grok Build (and Hermes).

Purpose: Deliver high-signal, low-entropy access to repository code, structure, symbols, and ADRs.
Every response aims to reduce mental overhead: summary-first, explicit reasoning, bounded related context,
limitations called out, calm suggestions.

Tools (cognitive actions, not raw FS):
- list_files: explore structure + light categorization + key hints + suggestions
- read_file: default "smart" mode (summary + outline + excerpt + auto-related). mode="full" or offset/limit supported for progressive disclosure.
- search_symbols: classified hits (definition vs match) + context lines + graceful fallback
- get_adr: summary + outline + excerpt + automatically discovered related ADRs (keyword overlap)
- search_memory: structured evidence (ADRs prioritized) + relevance + clear handoff to mcp-memory
- query_context: main agentic synthesis entrypoint — natural query → unified scored evidence package (ADRs first)

All outputs use the same cognitive envelope:
  summary (high-signal first), tool-specific primary data, related_context (conservative),
  reasoning (transparent trace), limitations (explicit), suggestions (calm), telemetry (always).

Strictly read-only. Bounded to REPO_ROOT. Evidence-based. No assumptions.

Constitutional: F1 (read reversible), F2 (FS truth), F4 (clarity), F7 (humility via limitations), F9/F11 (explicit + telemetry).

Register as "mcp-repo-read". Preferred after external research for sovereign grounding.
"""

from __future__ import annotations
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastmcp import FastMCP

mcp = FastMCP(
    name="mcp-repo-read",
    instructions=(
        "Narrow, strictly read-only cognitive instrument for high-signal access to repository code, "
        "structure, symbols, and arifOS governance ADRs.\n\n"
        "Every tool returns a consistent envelope:\n"
        "  summary (high-signal takeaway — read this first)\n"
        "  + tool-specific primary data\n"
        "  + related_context (only when genuinely helpful, e.g. related ADRs)\n"
        "  + reasoning (short transparent trace)\n"
        "  + limitations (explicit humility + scope)\n"
        "  + suggestions (calm, useful, never pushy)\n"
        "  + telemetry (tool + scope)\n\n"
        "Use query_context for natural-language synthesis across ADRs + code.\n"
        "Use read_file in default 'smart' mode for progressive disclosure.\n"
        "Bounded to REPO_ROOT only. No writes. No heavy dependencies.\n"
        "Part of the arifOS federation narrow-MCP set. Preferred for Grok Build before broad exploration.\n\n"
        "HARDENED: Returns 'canonical_handoff' + 'contradiction_risk' for gov queries. "
        "This is encoder/metabolizer only (111/222). Hand off to canonical arif_think/arif_judge/arif_seal/arif_forge for 333+. "
        "Declare geometry (scar+soul) at arif_init. Geometry aligns with transformer encoder/decoder/metabolizer + thordials/fractals."
    ),
    version="2026.06.23-arifos-gb-clarity-hardened",
)

# Config
REPO_ROOT = Path(os.environ.get("REPO_ROOT", "/root"))
ADR_DIR = REPO_ROOT / "arifOS" / "adr"
MAX_FILE_SIZE = 100_000  # bytes for safety

def _safe_path(p: str) -> Path:
    candidate = (REPO_ROOT / p).resolve()
    if not str(candidate).startswith(str(REPO_ROOT)):
        raise ValueError("Path traversal blocked")
    return candidate


# ─── Cognitive Clarity Helpers (low-entropy, no external deps) ─────────────────

def _extract_outline(text: str, max_headings: int = 8) -> List[str]:
    """Lightweight outline from markdown headings + first meaningful sentence."""
    lines = text.splitlines()
    outline = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(("# ", "## ", "### ", "#### ", "##### ")):
            outline.append(stripped[:130])
            if len(outline) >= max_headings:
                break
    if not outline and text:
        # Fallback: first non-empty, non-heading line (often the lead sentence)
        for l in lines:
            s = l.strip()
            if s and not s.startswith(("#", "-", "*", ">", "```")):
                outline.append(s[:140])
                break
    return outline


def _summarize(text: str, max_chars: int = 720) -> str:
    """Concise high-signal summary preferring title + key decision/context sentences."""
    if not text:
        return ""
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    title = next((l for l in lines if l.startswith("# ")), lines[0] if lines else "")[:100]
    outline = _extract_outline(text, 3)
    # Grab decision / context paragraphs
    body_parts = []
    capture = False
    for l in lines:
        low = l.lower()
        if any(k in low for k in ["decision", "context", "status", "architect"]):
            capture = True
        if capture:
            body_parts.append(l)
            if len(" ".join(body_parts)) > 420:
                break
    body = " ".join(body_parts)[:420] if body_parts else " ".join(lines[1:4])
    summary = title
    if outline:
        summary += " | " + " | ".join(outline[:2])
    if body and len(summary) < 200:
        summary = (summary + ". " + body).strip()
    return summary[:max_chars] or text[:max_chars]


def _find_related_adrs(query_text: str, exclude_name: Optional[str] = None, top_k: int = 3) -> List[Dict[str, Any]]:
    """Simple keyword-overlap related ADRs. Calm, not over-eager."""
    if not query_text or not ADR_DIR.exists():
        return []
    q_words = set(w.lower() for w in query_text.split() if len(w) > 3)
    related = []
    for adr_path in sorted(ADR_DIR.glob("*.md")):
        if exclude_name and adr_path.name == exclude_name:
            continue
        try:
            content = adr_path.read_text(errors="ignore").lower()
            score = sum(1 for w in q_words if w in content)
            if score > 0:
                related.append({
                    "adr": adr_path.name,
                    "relevance": min(score / max(len(q_words), 1), 1.0),
                    "path": str(adr_path.relative_to(REPO_ROOT)),
                    "snippet": content[:180].replace("\n", " ")
                })
        except (OSError, UnicodeDecodeError) as e:
            # ADR file unreadable — skip, not fatal for related-ADR lookups
            pass
    related.sort(key=lambda x: x["relevance"], reverse=True)
    return related[:top_k]


def _enrich_response(base: Dict[str, Any], tool: str, query_context: str = "") -> Dict[str, Any]:
    """Standard envelope for cognitive clarity."""
    base.setdefault("status", "ok")
    base.setdefault("telemetry", {})
    base["telemetry"].update({"tool": tool, "repo_scope": str(REPO_ROOT)})
    # Always ensure core clarity fields if not present
    base.setdefault("summary", "")
    base.setdefault("related_context", [])
    base.setdefault("reasoning", "Direct file/ADR/system operation within bounded repo.")
    base.setdefault("limitations", [
        "read-only surface",
        "scoped to REPO_ROOT",
        "no semantic embeddings (substring + simple overlap)",
        "capped results for clarity"
    ])
    base.setdefault("suggestions", [])
    return base

@mcp.tool()
def list_files(path: str = ".", recursive: bool = False, glob: Optional[str] = None) -> Dict[str, Any]:
    """
    Explore repository structure with light categorization and orientation hints.

    Returns: files (capped), categories, key_hints, plus full cognitive envelope.
    Default is shallow (one level). Set recursive=true for deeper walks (still capped).
    """
    base = _safe_path(path)
    if not base.exists():
        err = {
            "status": "error",
            "errors": ["path not found"],
            "summary": f"Path not found under repo root: {path}",
            "reasoning": "Safe path resolution succeeded but target did not exist on disk.",
        }
        return _enrich_response(err, "list_files", path)

    files: List[str] = []
    categories: Dict[str, int] = {}
    key_hints = []

    if recursive:
        for root, dirs, fs in os.walk(base):
            for f in fs:
                fp = Path(root) / f
                rel = str(fp.relative_to(REPO_ROOT))
                if glob is None or glob in rel:
                    files.append(rel)
                    # Light categorization for clarity
                    if "adr" in rel.lower():
                        categories["adr"] = categories.get("adr", 0) + 1
                    elif rel.endswith((".py", ".ts", ".js")):
                        categories["code"] = categories.get("code", 0) + 1
                    elif "test" in rel.lower():
                        categories["tests"] = categories.get("tests", 0) + 1
                    if "ADR_" in rel or "README" in rel.upper():
                        key_hints.append(rel)
    else:
        for item in base.iterdir():
            rel = str(item.relative_to(REPO_ROOT)) + ("/" if item.is_dir() else "")
            files.append(rel)
            if item.is_dir() and any(k in item.name.lower() for k in ["adr", "src", "core", "docs", "memory"]):
                key_hints.append(rel)

    result = {
        "path": str(base.relative_to(REPO_ROOT)),
        "files": files[:120],
        "count": len(files),
        "categories": categories,
        "key_hints": key_hints[:6],
        "summary": f"Directory under {path} with {len(files)} visible items. Key areas: {', '.join(key_hints[:4]) or 'general structure'}.",
    }
    result = _enrich_response(result, "list_files", path)
    result["reasoning"] = f"Scanned {'recursive' if recursive else 'shallow'} view within REPO_ROOT. Categorized for quick orientation."
    result["canonical_stage"] = "111_OBSERVE"
    result["cognitive_action"] = "observe (encoder layer)"
    result["geometry_role"] = "evidence feed for agent_geometry (scar/soul)"
    result["suggestions"] = [
        "Use read_file on promising paths (e.g. ADRs or key source).",
        "Narrow further with glob or specific subpath."
    ]
    return result

@mcp.tool()
def read_file(path: str, offset: int = 0, limit: int = 500, mode: str = "smart") -> Dict[str, Any]:
    """
    Retrieve a file with cognitive support (summary-first by default).

    mode="smart" (default): summary + outline + excerpt + related_context (for governance files).
    mode="full" or explicit offset/limit: progressive disclosure for large files.
    Always bounded + size guarded.
    """
    p = _safe_path(path)
    if not p.is_file():
        err = {
            "status": "error",
            "errors": ["not a file or missing"],
            "summary": f"Cannot read — not a regular file or does not exist: {path}",
            "reasoning": "_safe_path resolved but target is not a readable file.",
        }
        return _enrich_response(err, "read_file", path)

    if p.stat().st_size > MAX_FILE_SIZE:
        err = {
            "status": "error",
            "errors": ["file too large for narrow surface"],
            "size": p.stat().st_size,
            "summary": f"File exceeds MAX_FILE_SIZE ({MAX_FILE_SIZE} bytes) — use offset/limit or read a smaller file.",
            "reasoning": "Guard rail to keep responses low-entropy and fast.",
        }
        return _enrich_response(err, "read_file", path)

    full_content = p.read_text(encoding="utf-8", errors="replace")
    total_lines = len(full_content.splitlines())

    # Progressive disclosure
    if mode == "full" or (offset or limit != 500):
        start = max(0, offset)
        end = min(total_lines, start + limit)
        excerpt = "\n".join(full_content.splitlines()[start:end])
        summary = _summarize(full_content)
    else:
        summary = _summarize(full_content)
        outline = _extract_outline(full_content)
        # Default smart excerpt: first ~25 lines or until first major heading block
        lines = full_content.splitlines()
        excerpt_lines = lines[:40]
        excerpt = "\n".join(excerpt_lines)
        if len(excerpt) > 2200:
            excerpt = excerpt[:2200] + "\n... (truncated for clarity; request full or higher limit)"

    # Proactive related context (esp for ADRs and governance files)
    related = []
    if "adr" in str(p).lower() or "ADR" in p.name:
        related = _find_related_adrs(full_content[:1500] or path, exclude_name=p.name)
    elif any(k in str(p).lower() for k in ["boundary", "govern", "kernel", "floor"]):
        related = _find_related_adrs(path + " " + summary[:300], top_k=2)

    result = {
        "path": str(p.relative_to(REPO_ROOT)),
        "summary": summary,
        "outline": _extract_outline(full_content) if mode != "full" else [],
        "excerpt": excerpt,
        "returned_lines": len(excerpt.splitlines()),
        "total_lines": total_lines,
        "mode": mode,
        "related_context": related,
    }
    result = _enrich_response(result, "read_file", path)
    result["reasoning"] = "Smart read: summary + outline first for rapid understanding. Related surfaced only when governance signals detected."
    result["suggestions"] = ["Call again with mode='full' for complete text.", "Follow related ADRs via get_adr if relevant."]
    return result

@mcp.tool()
def search_symbols(query: str, path: str = ".", glob: str = "*.py", max_results: int = 20) -> Dict[str, Any]:
    """
    Locate symbols and text matches with lightweight classification.

    Hits are tagged "definition" vs "match" when detectable.
    Uses rg when available (context lines) with pure-Python fallback.
    """
    base = _safe_path(path)
    hits: List[Dict[str, Any]] = []
    q_lower = query.lower()

    try:
        cmd = ["rg", "--line-number", "-B", "1", "-A", "1", "--max-count", str(max_results), query, str(base), "--glob", glob]
        out = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL, timeout=6)
        for line in out.splitlines():
            if line.strip():
                # Classify lightly
                typ = "match"
                if "def " in line or "class " in line or "function " in line.lower():
                    typ = "definition"
                hits.append({"line": line.strip()[:220], "type": typ})
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        # rg not available or timed out — fall through to pure-Python fallback
        pass
    except (OSError, subprocess.CalledProcessError) as e:
        # rg path error (non-zero exit, permission denied) — fall through to fallback
        pass

    # Fallback: pure-Python scan when rg unavailable
    if not hits:
        for f in list(base.rglob(glob.replace("**", "*")))[:50]:
            try:
                txt = f.read_text(errors="ignore")
                if q_lower in txt.lower():
                    rel = str(f.relative_to(REPO_ROOT))
                    hits.append({"file": rel, "type": "file_match", "snippet": txt[:160].replace("\n", " ")})
            except (OSError, UnicodeDecodeError) as e:
                # Binary or unreadable file — skip, not fatal
                pass
            if len(hits) >= max_results:
                break

    result = {
        "query": query,
        "path_scanned": str(base.relative_to(REPO_ROOT)),
        "hits": hits[:max_results],
        "count": len(hits),
        "summary": f"Found {len(hits)} matches for '{query}'. Definitions prioritized when detectable.",
    }
    result = _enrich_response(result, "search_symbols", query)
    result["reasoning"] = "rg preferred for precision + context; graceful fallback. Type classification helps caller focus on definitions first."
    result["suggestions"] = ["Use get_adr or read_file on files that look like governance entrypoints."]
    return result

@mcp.tool()
def get_adr(adr_id: str = "latest") -> Dict[str, Any]:
    """
    Retrieve governance ADR with synthesized context.

    Always includes: summary, decision driver highlights, and automatically discovered related ADRs.
    This is the primary high-clarity entry for constitutional memory.
    """
    target = None
    if adr_id == "latest":
        adrs = sorted(ADR_DIR.glob("ADR_*.md"))
        target = adrs[-1] if adrs else None
    else:
        # Flexible lookup: "001", "ADR_001", full name
        candidates = [
            ADR_DIR / f"ADR_{adr_id}.md" if not adr_id.startswith("ADR_") else ADR_DIR / f"{adr_id}.md",
            ADR_DIR / f"{adr_id}.md",
            ADR_DIR / adr_id
        ]
        for c in candidates:
            if c.exists():
                target = c
                break
        if not target:
            # last chance: contains
            for c in sorted(ADR_DIR.glob("*.md")):
                if adr_id in c.name:
                    target = c
                    break

    if not target or not target.exists():
        err = {
            "status": "error",
            "errors": ["ADR not found"],
            "summary": f"ADR not found for id='{adr_id}' (searched arifOS/adr/).",
            "reasoning": "Flexible lookup (latest, ADR_XXX, numeric, contains) exhausted.",
        }
        return _enrich_response(err, "get_adr", adr_id)

    content = target.read_text(encoding="utf-8", errors="replace")
    summary = _summarize(content)
    outline = _extract_outline(content)
    related = _find_related_adrs(content[:1200] + " " + target.name, exclude_name=target.name)

    result = {
        "adr": str(target.relative_to(REPO_ROOT)),
        "summary": summary,
        "outline": outline,
        "excerpt": content[:900] + ("\n...(use full read if needed)" if len(content) > 900 else ""),
        "related_context": related,
        "lines": len(content.splitlines()),
    }
    result = _enrich_response(result, "get_adr", adr_id)
    result["reasoning"] = "Loaded real ADR from filesystem. Related ADRs discovered via keyword overlap on decision language."
    result["suggestions"] = ["Cross-reference via search_symbols on key terms from this ADR.", "For broader memory use mcp-memory."]
    return result

@mcp.tool()
def search_memory(query: str, top_k: int = 5) -> Dict[str, Any]:
    """
    Search repository + governance artifacts for evidence.

    Focused synthesis across ADRs and cooling ledgers. Returns scored, summarized evidence.
    For deep memory/rhythm use the dedicated mcp-memory server.
    """
    results: List[Dict[str, Any]] = []
    q = query.lower()

    # Prioritize ADRs (high-trust governance)
    for a in sorted(ADR_DIR.glob("*.md")):
        try:
            txt = a.read_text(encoding="utf-8", errors="replace")
            low = txt.lower()
            if q in low or q in a.name.lower():
                score = 0.9 if q in a.name.lower() else 0.6
                results.append({
                    "id": a.name,
                    "type": "adr",
                    "summary": _summarize(txt)[:280],
                    "path": str(a.relative_to(REPO_ROOT)),
                    "relevance": score,
                    "trust": "human_verified"
                })
        except (OSError, UnicodeDecodeError) as e:
            # ADR file unreadable — skip, not fatal for search
            pass
        if len(results) >= top_k:
            break

    # Light cooling/ledger support (fallback)
    if len(results) < top_k:
        for cool_dir in [REPO_ROOT / "AAA" / "registries" / "cooling_ledger", REPO_ROOT / "HERMES" / "audit" / "cooling_ledger"]:
            if not cool_dir.exists():
                continue
            for f in sorted(cool_dir.glob("*"))[:10]:
                try:
                    txt = f.read_text(errors="ignore")
                    if q in txt.lower():
                        results.append({
                            "id": f.name,
                            "type": "cooling_ledger",
                            "summary": txt[:260].replace("\n", " "),
                            "path": str(f.relative_to(REPO_ROOT)),
                            "relevance": 0.5,
                        })
                except (OSError, UnicodeDecodeError) as e:
                    # Cooling ledger file unreadable — skip, not fatal
                    pass
                if len(results) >= top_k:
                    break

    result = {
        "query": query,
        "results": results[:top_k],
        "summary": f"Retrieved {len(results)} evidence items. ADRs prioritized for constitutional weight.",
    }
    result = _enrich_response(result, "search_memory", query)
    result["reasoning"] = "Hybrid scan of ADR directory + known cooling locations. Relevance heuristic favors exact title matches and governance docs."
    result["suggestions"] = ["For full daily rhythm and deeper cooling, call mcp-memory:get_rhythm_context or recall_cooling_ledger.", "Follow up with get_adr on high-relevance hits."]
    return result


@mcp.tool()
def query_context(query: str, focus: str = "all", top_k: int = 6) -> Dict[str, Any]:
    """
    High-signal context retrieval across the repository.

    Agentic entrypoint: give a natural-language question or intent.
    Returns a unified, scored evidence package (ADRs prioritized first).
    This is the primary synthesis tool — use it to get oriented quickly and
    minimize follow-up tool calls.

    focus: "all" | "adr" | "code" | "structure"
    """
    q = query.lower()
    evidence: List[Dict] = []
    reasoning_parts: List[str] = []

    # Always scan ADRs for governance (highest value signal)
    adr_hits = []
    for a in sorted(ADR_DIR.glob("*.md")):
        try:
            txt = a.read_text(errors="ignore")
            low = txt.lower()
            if q in low or any(w in low for w in q.split() if len(w) > 4):
                rel = 0.9 if q in a.name.lower() else 0.6
                adr_hits.append({
                    "type": "adr",
                    "id": a.name,
                    "summary": _summarize(txt)[:280],
                    "path": str(a.relative_to(REPO_ROOT)),
                    "relevance": rel
                })
        except (OSError, UnicodeDecodeError) as e:
            # ADR file unreadable — skip, not fatal for query_context synthesis
            pass
    if adr_hits:
        evidence.extend(sorted(adr_hits, key=lambda x: -x["relevance"])[:3])
        reasoning_parts.append("ADRs scanned for governance context (primary signal).")

    # Code / symbols when relevant
    if focus in ("all", "code") and len(evidence) < top_k:
        try:
            cmd = ["rg", "--line-number", "--max-count", "6", query, str(REPO_ROOT), "--glob", "*.py"]
            out = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL, timeout=5)
            for line in out.splitlines()[:5]:
                if line.strip():
                    evidence.append({"type": "code", "match": line.strip()[:180], "relevance": 0.5})
            if any(e["type"] == "code" for e in evidence):
                reasoning_parts.append("Code matches located via rg.")
        except (FileNotFoundError, subprocess.TimeoutExpired):
            # rg unavailable or timed out — skip code scan, synthesis still valid
            pass
        except (OSError, subprocess.CalledProcessError) as e:
            # rg path error (non-zero exit, permission denied) — skip, not fatal
            pass

    # Structure hints
    if focus in ("all", "structure") or "adr" in q:
        evidence.append({"type": "structure", "hint": "arifOS/adr/", "path": str(ADR_DIR.relative_to(REPO_ROOT)), "relevance": 0.4})

    related = []
    if evidence:
        seed = query + " " + " ".join(str(e.get("id", e.get("match", ""))) for e in evidence[:2])
        related = _find_related_adrs(seed, top_k=2)

    result = {
        "query": query,
        "focus": focus,
        "summary": f"Synthesized {len(evidence)} evidence items. Governance (ADRs) prioritized for clarity.",
        "evidence": evidence[:top_k],
        "related_context": related,
    }
    result = _enrich_response(result, "query_context", query)
    result["reasoning"] = " | ".join(reasoning_parts) or "Broad low-entropy scan: ADRs + code + structure. Keyword + filename signals only."

    # Harden flow: detect governance implications to force canonical handoff (reduce chaos, map contradiction)
    gov_keywords = ["judge", "seal", "forge", "execute", "memory forget", "deploy", "irreversible", "888", "999"]
    high_gov = any(k in q for k in gov_keywords)
    if high_gov:
        result["contradiction_risk"] = "HIGH - synthesis here is evidence only; irreversible actions require canonical path"
        result["canonical_handoff"] = "arif_think (metabolizer) -> arif_critique -> arif_judge (SEAL) -> arif_seal -> arif_forge"
        result["geometry_note"] = "Declare geometry at arif_init; this narrow surface is encoder/metabolizer only."
    result["suggestions"] = [
        "Use get_adr on specific high-relevance ADRs for full decision context.",
        "read_file(path, mode='full') for complete source when needed.",
        "Route deeper memory/rhythm needs to mcp-memory.",
        "For any gov action (judge/seal/forge): use canonical arif_* tools after this evidence step."
    ]
    if high_gov:
        result["suggestions"].append("DO NOT act on this synthesis alone - hand off to arifOS canonical MCP.")
    return result


# ─── Entry point (supports both direct run and python -m) ─────────────────────
if __name__ == "__main__":
    import sys
    if "--http" in sys.argv:
        mcp.run(transport="streamable-http", host="127.0.0.1", port=18791)
    else:
        mcp.run(transport="stdio")
