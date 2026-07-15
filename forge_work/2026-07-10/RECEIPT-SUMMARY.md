## Enrichment & Deregistration — Summary

### Results

| Metric | Before | After |
|--------|--------|-------|
| WEALTH tools | 50 | 7 (100% enriched) |
| GEOX tools | 79 | 19 (74% enriched) |
| arifOS tools | 11 | 10 (91% enriched) |
| WELL tools | 18 | 18 (100% enriched) |
| A-FORGE tools | 98 | 98 (100% enriched) |
| **Total federation tools** | **228** | **152 (76% enriched)** |
| **Enriched on wire** | **0%** | **~85%** |

### Bangang rate
5 incidents / 1 session = **5.0 per session** (baseline). Gate to target 0.

### What's left
- GEOX: 5 tools without Use-when (seismic_compute, surface_status, 3 tie-workflow via sub-server)
- arifOS: arif_compose missing (overwritten by alias_shim — devirtualize alias_shim or move enrichment later)
- 3 tie-workflow tools: fold into geox_seismic_compute as modes
- A-FORGE: live surface verification (stdio transport — probe via aforge_forge_registry_status)
- Gate spec: OBS-level claim without tool_result → DEGRADED_EVIDENCE
- Doc drift: arifOS README vs tool count vs PyPI — pick one, version-stamp it

