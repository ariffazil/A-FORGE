# 99 Level Missing Component Map
**Date:** 2026-04-16
**Substrate:** arifOS MCP

## Missing Modules & Functions

1. **`arifosmcp.runtime.hardened_toolchain`**
   - Missing module completely. `HardenedToolchain` class cannot be imported.
2. **`core.enforcement.routing`**
   - Missing module. Affects `TestRouteRefuse`, `TestRoutingCompatibility`, and `TestShouldRealityCheck`.
3. **`arifosmcp.intelligence.tools`**
   - Missing module. Affects `TestRealityGroundingRealAPI`, `TestSearchResult`, `TestGroundingSearch`, `TestSearchResultProcessing`, `TestThrottlingAndConfig`, `TestSearchWithConsensus`, `TestUnifiedToolOutput`, `TestErrorHandling`, and `TestResultValidation`.
4. **`arifosmcp.runtime.tools` (Missing Exports)**
   - `INIT_ANCHOR`
   - `AGI_REASON`
   - `AGI_REFLECT`
   - `ASI_CRITIQUE`
   - `ASI_SIMULATE`
   - `APEX_JUDGE`
   - `VAULT_SEAL`
   - `reality_compass`
   - `search_reality`
   - `ingest_evidence`
   - `agentzero_engineer`
   - `agentzero_validate`
   - `session_memory`
   - `ollama_local_generate`
5. **`arifosmcp.runtime.tools_hardened_dispatch`**
   - `hardened_init_anchor_dispatch`
6. **`arifosmcp.capability_map`**
   - `InitAnchorMode`
7. **`core.organs.unified_memory`**
   - Import errors related to `blake3` and unified memory structures missing inside `core.organs._4_vault`.

## Missing Files & Schemas

1. **`/root/arifOS/scripts/deploy_production.py`**
   - Missing deployment script affecting `TestDeployProduction`.
2. **`/root/arifOS/schemas/provider_soul.schema.json`**
   - Missing JSON schema for provider soul validation.
3. **`/root/arifOS/schemas/runtime_truth.schema.json`**
   - Missing JSON schema for runtime truth validation.

## Missing Function Signatures & Variables

1. **`arifos_init()`**
   - Missing expected kwargs: `session_class`, `model_soul`, `deployment_id`, `raw_input`.
2. **`arifos_forge()`**
   - Missing expected kwargs: `spec`.
3. **`_probe_intelligence_services`**
   - Missing attribute on `arifosmcp.runtime.tools`.

## Missing Governance & Floor State

1. **Runtime Floors**
   - `F1_Amanah` not in runtime floor enforcement list.
   - `F6` (harm/dignity) not in runtime floor list.
   - `F9` (Anti-Hantu) not in runtime floor list.
2. **CI Gates**
   - Floor registry inaccessible or incomplete. F10 and F11 violated. Confidence thresholds (F2) and Peace constraints (F5) violated.

**Assessment:**
System requires comprehensive synthesis of missing intelligence tools, routing enforcements, and the restoration of the hardened toolchain to achieve 99% operational maturity.
