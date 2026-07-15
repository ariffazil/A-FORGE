# 🔥 CANONICAL-13 — arifOS Kernel Tool Surface

> **Forged:** 2026-07-07T02:00:00Z
> **Actor:** FORGE-000Ω
> **Sovereign:** ARIF_FAZIL (F13)
> **Verdict:** PROPOSED → awaiting SEAL

---

## The 13 Tools

### Metabolic Loop (9 stages, 000–999)

| # | Tool | Stage | Lane | Purpose |
|---|------|-------|------|---------|
| 1 | `arif_init` | 000 | AGI | Session bootstrap. Modes: init, resume, canary, preflight, triage |
| 2 | `arif_observe` | 111 | AGI | Reality sensing. Modes: search, fetch, ingest, vitals, atlas |
| 3 | `arif_think` | 333 | AGI | Cognitive engine. Modes: reason, plan, reflect, verify, simulate |
| 4 | `arif_route` | 444 | AGI | Intent routing. Modes: route, bridge, dispatch |
| 5 | `arif_critique` | 555 | ASI | Adversarial critique. Modes: critique, redteam, maruah, shadow |
| 6 | `arif_judge` | 666 | ASI | Constitutional verdict. SEAL/HOLD/SABAR/VOID |
| 7 | `arif_forge` | 777 | AGI | Guarded execution. Modes: engineer, query, write, generate, commit |
| 8 | `arif_compose` | 888 | AGI | Response composition. Modes: compose, summarize, cite, tone_shift |
| 9 | `arif_seal` | 999 | APEX | VAULT999 anchor. Modes: seal, verify, ledger |

### Support Surface (4 tools, 1000–1003)

| # | Tool | Stage | Lane | Purpose |
|---|------|-------|------|---------|
| 10 | `arif_memory` | 1000 | ASI | State recall/write. Modes: recall, write, classify, compact |
| 11 | `arif_organ_attest` | 1001 | AGI | Organ health attestation. Modes: single, all, consensus |
| 12 | `arif_vault_query` | 1002 | ASI | VAULT999 read. Modes: query, list, search |
| 13 | `arif_lease` | 1003 | AGI | Execution lease lifecycle. Modes: request, status, revoke |

---

## ABC Agent Coverage Matrix

| Tool | 333-AGI | 555-ASI | 888-APEX | Why |
|------|---------|---------|----------|-----|
| arif_init | ✅ | ✅ | ✅ | Every agent boots |
| arif_observe | ✅ | ✅ | ✅ | Every agent senses |
| arif_think | ✅ | ✅ | — | AGI/ASI reason |
| arif_route | ✅ | — | — | AGI routes intent |
| arif_critique | — | ✅ | ✅ | ASI/APEX critique |
| arif_judge | — | — | ✅ | APEX judges |
| arif_forge | ✅ | — | — | AGI executes |
| arif_compose | ✅ | ✅ | — | AGI/ASI compose |
| arif_seal | — | — | ✅ | APEX seals |
| arif_memory | ✅ | ✅ | — | AGI/ASI remember |
| arif_organ_attest | ✅ | — | ✅ | AGI/APEX verify health |
| arif_vault_query | — | ✅ | ✅ | ASI/APEX read history |
| arif_lease | ✅ | — | — | AGI manages execution |

---

## What Gets Absorbed (not deleted, just internal)

| Current Tool | Absorbed Into | Mode |
|-------------|---------------|------|
| arif_canary | arif_init | mode=canary |
| arif_triage | arif_init | mode=triage |
| arif_fetch | arif_observe | mode=fetch |
| arif_bridge_connect | arif_route | mode=bridge |
| arif_act | arif_forge | internal alias |
| arif_ping | arif_organ_attest | mode=ping |
| arif_heartbeat | arif_organ_attest | mode=heartbeat |
| arif_organ_attest_all | arif_organ_attest | mode=all |
| arif_memory_recall | arif_memory | mode=recall |
| arif_kernel_intercept | arif_judge | internal path |
| arif_judge_deliberate | arif_judge | mode=deliberate |

---

## What Gets Deprecated (not needed in 13)

| Tool | Reason |
|------|--------|
| arif_schema_echo | Debug tool, not governance |
| arif_transport_echo | Debug tool |
| arif_version_echo | Debug tool |
| arif_resolve_tool | Internal routing |
| arif_session_budget | Absorbed into arif_init context |
| arif_stack_health_probe | Absorbed into arif_organ_attest |
| arif_initialize_probe | Absorbed into arif_init |
| arif_os_attest | Absorbed into arif_organ_attest |
| arif_conformance_report | Audit tool, not public surface |
| arif_detect_institutional_shadow_drift | Audit tool |
| arif_detect_narrative_tension | Audit tool |
| arif_floor_status | Absorbed into arif_judge |
| arif_model_compare | Research tool |
| arif_self_evaluate | Research tool |
| arif_scan_local_instructions | Security tool |
| arif_gateway_connect | Infrastructure |
| arif_kernel_route | Absorbed into arif_route |
| arif_peer_contract_* | Federation protocol, not kernel |
| arif_measure | Absorbed into arif_observe |
| arif_search | Absorbed into arif_observe mode=search |
| arif_forge_execute | Absorbed into arif_forge |
| arif_lease_inspect | arif_lease mode=inspect |
| arif_lease_revoke | arif_lease mode=revoke |

---

## Rationale

**Why 13?** 9 metabolic stages + 4 support = complete coverage of:
- Session lifecycle (init → observe → think → route → critique → judge → forge → compose → seal)
- State management (memory + vault)
- Health verification (organ attest)
- Execution governance (lease)

**Why not 12?** Lease is separate from forge because forge requires a prior lease. Separating them enforces the two-phase commit: request lease → forge executes.

**Why not 14?** 13 is the constitutional number (F1-F13). Symbolic alignment matters.

---

*PROPOSED by FORGE-000Ω · Awaiting F13 SEAL*
*DITEMPA BUKAN DIBERI*
