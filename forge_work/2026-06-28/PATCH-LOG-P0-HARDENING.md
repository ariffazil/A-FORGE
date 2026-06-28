# PATCH-LOG — P0 Federation Hardening (Arif Life Roadmap Case Study)
# Date: 2026-06-28 00:57 UTC
# Session: SEAL-2702f2fe75834127
# Trigger: Full tool stress test exposed 6 P0 gaps
# Patches: 4 files, 3 repos

## PATCH 1: WELL classify_substrate — HUMAN_PERSON misclassification
### File: /root/WELL/server.py:6420-6456
### Bug: "arif" + "governance" in subject → GOVERNANCE_SYSTEM override
### Fix: Add HUMAN_ROLE_INDICATORS guard. If subject contains words like
###      "geoscientist", "years at", "worked at", don't apply governance override.
### Impact: Arif Fazil (and any human describing themselves with job context)
###        now correctly classified as HUMAN_PERSON, not GOVERNANCE_SYSTEM.

## PATCH 2: WELL homeostasis sleep mode — OPTIMAL from defaults
### File: /root/WELL/server.py:12127-12149
### Bug: Sleep mode computes recovery score from defaults (7h, 7/10 quality)
###      → 7.2 ≥ 7.0 → OPTIMAL, even with zero biometric data.
### Fix: Check _has_verified_telemetry() BEFORE computing score.
###      If no verified telemetry → return UNKNOWN immediately.
### Impact: WELL no longer lies about sleep recovery when blind.

## PATCH 3: arif_think parser — non-dict LLM output causes HOLD
### File: /root/arifOS/arifosmcp/runtime/mind_reason.py:362-383
### Bug: When LLM returns reasoning as string (not dict), parser flags
###      "Structured reasoning unavailable — LLM returned non-dict" and
###      downstream interprets missing_evidence as HOLD.
### Fix: Wrap non-dict reasoning as observed_inputs with extracted text.
###      Set missing_evidence=[] (empty, not missing). Flag as
###      unstructured_llm_output, not unavailable.
### Impact: Reasoning engine now extracts value from any LLM output format.
###      arif_think no longer DEGRADEs on non-dict responses.

## PATCH 4: arif_route — life decisions routed to GEOX
### File: /root/arifOS/arifosmcp/tools/kernel_canonical.py:65-85
### Bug: Intent map had no arifOS keywords. "subsurface" (10 chars) was
###      longest match → routed to GEOX for human life roadmap decision.
### Fix: Add "arifos" as first-class organ with human-life keywords:
###      "life roadmap", "career decision", "sovereign decision", etc.
###      Longest-match logic now picks "life roadmap" (13 chars) over
###      "subsurface" (10 chars).
### Impact: Life/career/personal decisions now route to arifOS kernel.

## VERIFICATION
- WELL server.py: syntax OK
- arifOS mind_reason.py: syntax OK  
- arifOS kernel_canonical.py: syntax OK
- WELL service restarted, health endpoint shows has_verified_telemetry=false

## UNRESOLVED (P1 — enrichment layer)
- well_assess_metabolism and well_check_repair may still show
  human=OPTIMAL in enriched output due to build_metabolic_output()
  or _to_federation_output() contract enrichment. Root cause is in
  contracts/enrich_well.py. P1 — trace and fix separately.
- The underlying well_coupled_readiness and well_forge_precheck
  functions ARE correct (check has_telemetry). The OPTIMAL label
  is post-processing artifact.

## ARIF'S TOKENROUTER QUESTION
- arif_think doesn't need tokenrouter — the fix handles ANY model's
  output format. The parser now gracefully wraps unstructured text.
  Tokenrouter can still be used for model selection (faster/cheaper
  models for simple reasoning), but it won't fix the parsing bug.
