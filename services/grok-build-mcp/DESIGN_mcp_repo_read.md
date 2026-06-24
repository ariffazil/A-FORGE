# DESIGN: mcp-repo-read — Cognitive Clarity & Low-Entropy Evolution

**Date:** 2026-06-23  
**Context:** Evolve the read tier narrow MCP (originally mechanical FS tools) per the sovereign agentic prompt: "more agentic while significantly reducing cognitive chaos".

**Core Posture**
- Read-only, always.
- Clarity > features.
- Bounded (REPO_ROOT only).
- Evidence-based, humble, auditable (F1, F2, F4, F7, F9, F11, F13 compatible).
- Machine-parsable + human-usable.

## Design Decisions & Trade-offs

### 1. Tool Surface
**Decision:** Keep the original five tool names (`list_files`, `read_file`, `search_symbols`, `get_adr`, `search_memory`) + add one high-value synthesis tool (`query_context`).

**Rationale:**
- Backward compatibility with existing registrations, smoke tests, orchestration layout, and agent cards.
- Names are acceptable; the *behavior* was made cognitive.
- `query_context` is the "agentic" front door: natural query → synthesized evidence package. This directly attacks "limited intelligent routing and context synthesis".

**Alternative considered:** Rename everything to `explore_structure`, `retrieve_document`, etc. Rejected for entropy of migration in multiple places (configs, skills, tests, A2A examples).

### 2. Response Envelope (the clarity multiplier)
**Every tool returns (via `_enrich_response` + per-tool):**

```json
{
  "status": "...",
  "summary": "concise high-signal takeaway (always first)",
  "primary...": {specific data},
  "related_context": [ {type, id/path, relevance, snippet} ],
  "reasoning": "short transparent trace of how/why these results",
  "limitations": [explicit, humble],
  "suggestions": ["calm, useful next steps — never pushy"],
  "telemetry": {tool, scope, ...}
}
```

**Why this reduces chaos:**
- Progressive disclosure built-in.
- Caller (Grok Build, Hermes, or human) gets orientation without extra roundtrips.
- "Related" is proactive value but only when signal is clear (governance files, ADRs).
- Explicit limitations prevent over-trust.

### 3. Internal Helpers (lightweight agentic behavior)
- `_summarize()`: headings + first meaningful paragraphs.
- `_extract_outline()`: markdown headings or fallback opening sentence.
- `_find_related_adrs()`: keyword overlap (very simple, predictable, auditable).
- `_enrich_response()`: consistent envelope.

**Trade-off:** No embeddings / vector search (would require heavy deps or external service, increase complexity, violate "calm + bounded"). Substring + overlap is transparent and sufficient for ADRs (small set of ~9 files).

### 4. Progressive Disclosure in read_file
- Default "smart" mode: summary + outline + short excerpt + related.
- `mode="full"` or explicit offset/limit still supported.
- This makes the tool feel like a thoughtful assistant rather than `cat`.

### 5. search_memory vs dedicated memory server
- This server focuses on **repo + ADR + light gov context**.
- Heavy rhythm, dream, deeper cooling delegated to `mcp-memory`.
- `search_memory` now produces better structured evidence + points caller to the right server.

### 6. New query_context Tool
The primary agentic lever:
- Caller says "ADR on boundaries and related code" or "how is intelligence routing governed?"
- Server returns a ready-to-use evidence bundle.
- Minimizes follow-up prompts.

### Constitutional & Governance Alignment
- All reads reversible (F1).
- Truth strictly from FS (F2).
- Clarity and humility via explicit fields (F4, F7).
- Telemetry + related surfacing supports audit (F11).
- Never claims authority; always surfaces escalation/suggestions paths.
- Compatible with 888_HOLD (this surface is purely evidence provider).

### What "Agentic" Means Here (Within Bounds)
- Suggests better queries / follow-ups when helpful.
- Surfaces related context intelligently (reduces caller work).
- Synthesizes (summary + reasoning) rather than dumps.
- **Never** overly eager: related is conservative, suggestions are optional and calm, no writes, no external calls except rg (local).

## Files Changed (this cycle)
- `mcp_repo_read.py` — core (restructured for reliable registration, envelope hardened on all paths including errors, improved helpers + docstrings, "read_document" suggestion fixed, query_context always present)
- `smoke_test_grok_mcp.py` — extended with explicit envelope + synthesis verification
- Supporting: DESIGN (this), README, grok-build-mcp.example.json (already accurate), AAA/agents/grok-build/AGENTS.md

Implementation now exactly matches the high-clarity spec: single clean if __name__ at EOF, all @mcp.tool() before runner. Both `python ...` and `python -m ...` + --http paths work.

## Success Verification
- Using the tools produces concise, oriented answers.
- A downstream agent can act with one or two calls instead of many.
- Outputs feel "bounded, trustworthy, and calm".
- Related context and suggestions demonstrably reduce cognitive load.

## Future (only with clear 888 path if needed)
- Optional lightweight local index (still read-only).
- Better cross-file reference parsing.
- Integration as a resource provider (MCP resources) in addition to tools.

All changes preserve the narrow, read-only contract and federation posture.

DITEMPA BUKAN DIBERI.