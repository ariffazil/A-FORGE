# PATCH-LOG — Centralized Philosophical Quote Registry
# Date: 2026-06-28 01:08 UTC
# Session: SEAL-2702f2fe75834127
# Trigger: Arif directive — map 33 philosophical quotes to MCP tools, centralize, transport to outputs
# Patches: 2 files, 1 new file

## PATCH 7: Centralized Tool-Quote Registry + Injection Pipeline
### Files:
###   NEW:  /root/arifOS/data/tool_quote_registry.json
###   EDIT: /root/arifOS/arifosmcp/runtime/tools.py

### What was built:
###   1. tool_quote_registry.json — centralized mapping of philosophical quotes
###      to specific MCP tools across all 4 organs + cross-cutting tools.
###      - 58 quotes mapped to 30 tools
###      - 18 authors indexed (Marcus Aurelius through Benjamin Franklin)
###      - Each quote has: id, text, author, source, year, trigger condition
###      - Triggers: "always", "high_uncertainty", "HOLD_or_SABAR", "low_pos", etc.
###      - Non-contaminating: NEVER used for reasoning, only human resonance
###
###   2. tools.py injection pipeline modified:
###      - _lookup_tool_quote() function added — checks registry before atlas
###      - Tool-specific quotes take PRECEDENCE over atlas coordinate selection
###      - Fallback to atlas_27 for tools without registry entries
###      - atlas_mode field reflects source: "tool_specific" vs "atlas_27"
###      - Non-fatal: lookup failure silently falls back to atlas
###
###   3. Quote-to-Tool mapping:
###      arifOS: init, think, judge, route, seal, observe, critique, act, forge
###             + system: vault999, cooling_ledger, canon_matrix, asal
###      GEOX:   claim_create, evidence_reason, seismic_compute, prospect,
###              subsurface_model, well_desurvey
###      WELL:   classify_substrate, assess_homeostasis, check_repair,
###              assess_livelihood, guard_dignity, assess_sovereign_entropy
###      WEALTH: compute_emv, compute_evoi, asymmetry_check, runway_check,
###              collapse_signature_scan, monte_carlo_simulate,
###              conservation_check, power_audit, fiscal_breakeven

### How quotes transport to tool outputs:
###   Every arifOS tool output already carries a philosophical_anchor field
###   injected by _enforce_tool_policy() in tools.py. The new pipeline:
###   1. Check tool_quote_registry.json for tool-specific quote → use it
###   2. If not found → fall back to atlas_27 S×G×Ω coordinate selection
###   3. Inject as philosophical_anchor in tool output envelope
###   Domain organ tools (GEOX/WEALTH/WELL) receive quotes via the same
###   pipeline when they transit through arifOS bridge or AAA routing.

### Cross-cutting quotes:
###   F13 SOVEREIGN: Nietzsche — "no price too high for owning yourself"
###   DITEMPA BUKAN DIBERI: Arif Fazil — core motto, WAJIB for all tools

## VERIFICATION
- tool_quote_registry.json: valid JSON, 30 tools mapped
- tools.py: SYNTAX OK
- Injection pipeline: non-fatal, falls back to atlas on any error
- 0 breaking changes to existing tool behavior

## WHAT THIS ENABLES
- arif_judge now anchors to Nietzsche ("Those who have a why...") not a math coordinate
- geox_claim_create now anchors to Socrates ("I know I know nothing") for epistemic humility
- well_assess_sovereign_entropy now anchors to Nietzsche ("overwhelmed by the tribe")
- wealth_asymmetry_check now anchors to Sun Tzu ("All warfare is based on deception")
- Each tool's quote matches its PURPOSE, not just its mathematical zone
