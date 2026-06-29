# Agentic Tool Description Update — SEAL LOG

**Date:** 2026-06-28  
**Forge Session:** SEAL-cbc8476fcba84c57  
**Intent:** Rewrite all arifOS tool descriptions with agentic intelligence alignment  
**Architect:** Arif (F13 SOVEREIGN)  
**Forger:** OpenCode (FORGE lane)

## Core Shift

From feature descriptions → affordance fields. Each tool description now answers:

> "Should I, as an agent deciding my next action, select this tool now?"

Designed per Arif's agentic genesis framework:

```
tool_score = match(intent, tool_description)
           + schema_fit
           + expected_information_gain
           + authority_allowed
           + reversibility
           + prior_success
           - risk
           - ambiguity
           - policy_violation
           - cost
```

## Files Modified (8 files, +209/-114 lines)

| File | Change |
|------|--------|
| `arifosmcp/runtime/public_registry.py` | `_TOOL_DESCRIPTIONS` fully rewritten. Added missing **arif_act** entry. |
| `arifosmcp/runtime/public_surface.py` | CANONICAL_7 comments with agentic selection language |
| `arifosmcp/constitutional_map.py` | CORE_SEVEN comments updated |
| `arifosmcp/runtime/tools.py` | `_arif_act` docstring with agentic framing + A2ASealVerifier |
| `arifosmcp/server.py` | Instructions rewritten: "select by gap" format |
| `arifosmcp/static/.well-known/mcp/server.json` | All 7 tool descriptions with selection criteria |
| `arifosmcp/PUBLIC_SURFACE_CANON.md` | Table with agentic selection column |
| `arifosmcp/tool_registry.json` | Note updated with gap-closing language |

## Key Fixes

1. **arif_act was MISSING** from `_TOOL_DESCRIPTIONS` — now has full agentic description
2. All Canonical 7 now include: **gradient** (what pulls toward this tool), **gap** (what it closes), **selection criteria** (when to choose / not to choose)
3. Each description structured as: "Select when... Do NOT select when... Returns..."
4. Server instructions now: `arif_init — No session yet? Start here.`

## Validation

- All 5 Python files pass `ast.parse()` syntax check ✅
- `arif_init()` live test returns session ✅

## Audit Trail

This is a governed file-only update. No server restart required — `_TOOL_DESCRIPTIONS` is imported at module load time. Next server restart will pick up the changes.

**DITEMPA BUKAN DIBERI.**
