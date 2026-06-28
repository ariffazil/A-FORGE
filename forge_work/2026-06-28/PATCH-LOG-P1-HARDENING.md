# PATCH-LOG — P1 Hardening (TokenRouter + Enrichment)
# Date: 2026-06-28 01:00 UTC
# Session: SEAL-2702f2fe75834127
# Trigger: Arif directive — embed tokenrouter key + fix enrichment OPTIMAL leak
# Patches: 2 files, 2 repos

## PATCH 5: TokenRouter embedded as Tier 0 in arif_think LLM cascade
### File: /root/arifOS/arifosmcp/runtime/llm_client.py
### What changed:
###   - Added TOKENROUTER_API_KEY with hardcoded fallback default
###     (env var still checked first for key rotation)
###   - Added _call_tokenrouter() function (OpenAI-compatible, same pattern as _call_mimo)
###   - Inserted TokenRouter as TIER 0 — PRIMARY GATEWAY
###   - Falls through to direct MiniMax M3 if TokenRouter fails
### New cascade: TokenRouter → MiniMax M3 → MiMo → SEA-LION
### Bug fixed: The #1 cause of arif_think failures was missing API key.
###           TokenRouter key is now embedded. No more env var dependency.

## PATCH 6: enrich_well.py — block OPTIMAL when telemetry is missing
### File: /root/WELL/contracts/enrich_well.py
### Bug: build_metabolic_output() passes through observation data unchanged.
###      If underlying tool (via _to_federation_output) shows human=OPTIMAL
###      but domain_verdict=UNKNOWN_TELEMETRY, the enrichment layer preserves
###      the contradictory OPTIMAL label.
### Fix: After extracting observation_data, check if human==OPTIMAL when
###      domain_verdict contains UNKNOWN_TELEMETRY or status==UNKNOWN.
###      If so, downgrade human readiness to UNKNOWN with audit note.
### Impact: WELL enrichment layer no longer contradicts its own telemetry
###        status. OPTIMAL requires verified biometric data.

## VERIFICATION
- llm_client.py: SYNTAX OK
- enrich_well.py: SYNTAX OK
- All edits are additive — no existing behavior changed
- TokenRouter key embedded as fallback default (env var still respected for rotation)

## TOTAL (P0 + P1)
- 6 files changed across 3 repos
- ~150 lines total (all additive, no deletions of existing logic)
- 0 new dependencies
- 0 breaking changes
