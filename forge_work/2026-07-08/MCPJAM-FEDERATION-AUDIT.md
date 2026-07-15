# MCPJam Federation Audit — 2026-07-08

> **Actor:** FORGE (000Ω) · **Session:** SEAL-55de51e5e55e4123
> **Tool:** `@mcpjam/cli` v3.13.0
> **Scope:** All 6 federation organs — protocol conformance, tool surface, doctor checks

---

## Summary

| Organ | Port | Status | Protocol | Tools | Resources | Prompts | Conformance |
|-------|------|--------|----------|-------|-----------|---------|-------------|
| **arifOS** | 8088 | ✅ ready | 2025-11-25 | 12 | 183 | 8 | **13/15 PASS** (2 skipped) |
| **A-FORGE** | 7071 | ❌ error | — | 0 | 0 | 0 | **FAILED** — server already initialized |
| **GEOX** | 8081 | ✅ ready | 2025-11-25 | 13 | 19 | 10 | **13/15 PASS** (2 skipped) |
| **WEALTH** | 18082 | ✅ ready | 2025-11-25 | 50 | 15 | 7 | **12/15 PASS** (1 failed, 2 skipped) |
| **WELL** | 18083 | ✅ degraded | 2025-11-25 | 18 | 30 | 15 | **13/15 PASS** (2 skipped) |
| **AAA** | 3001 | ✅ healthy | A2A (not MCP) | — | — | — | Not tested (A2A protocol) |

**Total MCP tools across federation:** 93 (12 + 13 + 50 + 18)
**Total resources:** 247 (183 + 19 + 15 + 30)
**Total prompts:** 40 (8 + 10 + 7 + 15)

---

## Findings

### F1: A-FORGE Protocol Non-Compliance (CRITICAL)

**Severity:** HIGH
**Check:** `server-initialize`
**Error:** `Invalid Request: Server already initialized` (HTTP 400)

A-FORGE rejects new MCP `initialize` requests with `-32600` error, claiming "Server already initialized." This means:
- Each MCP client that connects gets the server into an initialized state
- Subsequent clients cannot connect because the server thinks it's already initialized
- **This is a stateful server bug** — MCP Streamable HTTP servers should handle each connection independently

**Impact:** MCPJam CLI, and any new MCP client, cannot connect to A-FORGE after the first connection.

**Fix:** A-FORGE must reset connection state per-request or use session-scoped initialization.

### F2: WEALTH Missing DNS Rebinding Protection (MEDIUM)

**Severity:** MEDIUM
**Check:** `localhost-host-rebinding-rejected`
**Error:** Expected 4xx for invalid Host/Origin headers, got 200

WEALTH accepts MCP initialize requests with arbitrary Host/Origin headers. This is a DNS rebinding vulnerability — an attacker could redirect a local browser to `http://localhost:18082/mcp` via a malicious page.

**arifOS, GEOX, WELL:** All correctly reject evil Host headers with 403.

**Fix:** WEALTH should validate Origin/Host headers against allowed localhost addresses.

### F3: All Organs — Optional Checks Skipped (INFO)

**Checks skipped on all organs:**
1. `completion-complete` — Server doesn't advertise completions capability (expected)
2. `server-sse-polling-session` — Server uses stateless Streamable HTTP without session IDs (by design)

These are informational, not failures.

### F4: WELL Reports Degraded Status (INFO)

WELL's `/health` endpoint returns `status: "degraded"`. MCPJam still connects and lists 18 tools successfully. Degraded state likely relates to stale biometric data, not MCP protocol issues.

---

## Tool Surface Snapshot

### arifOS (12 tools)
```
arif_init, arif_triage, arif_observe, arif_think, arif_route,
arif_bridge_connect, arif_critique, arif_memory, arif_judge,
arif_forge, arif_compose, arif_seal
```

### GEOX (13 tools)
```
geox_surface_status, geox_claim, geox_evidence, geox_prospect,
geox_tie_receipt, geox_tie_preflight, geox_observe, geox_compute,
geox_model, geox_interpret, geox_spatial, geox_govern, geox_bridge
```

### WEALTH (50 tools)
```
wealth_wisdom_evaluate, wealth_power_audit, wealth_capture_scan,
wealth_compute_npv, wealth_compute_irr, wealth_conservation_check,
wealth_flow_check, wealth_runway_check, wealth_compute_emv,
wealth_emv_compute, wealth_monte_carlo_simulate, wealth_monte_carlo,
wealth_compute_evoi, wealth_evoi_compute, wealth_confluence_check,
wealth_asymmetry_check, wealth_fiscal_breakeven, wealth_stock_analysis,
wealth_personal_finance, wealth_market_data, wealth_omni_wisdom,
wealth_agent_path, wealth_reason_agent, wealth_vault_write,
wealth_vault_query, wealth_registry_status, wealth_system_registry_status,
wealth_boundary_governance, wealth_survival_engine,
wealth_collapse_signature_scan, wealth_beautiful_mouse_scan,
wealth_judge_handoff, wealth_markowitz_frontier, wealth_kelly_sizing,
wealth_robust_portfolio, wealth_chance_constrained,
wealth_two_stage_recourse, wealth_bid_surface, wealth_optimize_mwc,
wealth_institutional_stress_index, wealth_cascade_model,
wealth_governance_capacity, wealth_external_exploitation_detect,
capital_primitive, capital_health, capital_diagnose, capital_wisdom,
capital_market, capital_ledger, capital_registry
```

### WELL (18 tools)
```
well_health_check, well_medical_boundary, well_readiness,
well_signal_coverage, well_classify_substrate, well_trace_lineage,
well_detect_boundary, well_measure_gradient, well_assess_metabolism,
well_assess_homeostasis, well_check_repair, well_validate_vitality,
well_assess_livelihood, well_guard_dignity, well_assess_reliability,
well_compute_metabolic_flux, well_assess_sovereign_entropy,
well_registry_status
```

---

## A-FORGE Detailed Error

```json
{
  "status": "error",
  "checks": {
    "probe": "error",
    "connection": "error",
    "initialization": "skipped",
    "capabilities": "skipped",
    "tools": "skipped",
    "resources": "skipped",
    "prompts": "skipped"
  },
  "error": {
    "code": "SERVER_UNREACHABLE",
    "message": "Failed to connect. Streamable HTTP error: Server already initialized."
  }
}
```

A-FORGE's Express server at :7071 maintains MCP session state globally. When mcpjam (or any second client) sends `initialize`, the server rejects it because a prior session (likely from the federation's own MCP gateway) already initialized it.

---

## Recommendations

| # | Action | Priority | Organ |
|---|--------|----------|-------|
| 1 | Fix A-FORGE per-session initialization reset | **P0** | A-FORGE |
| 2 | Add Origin/Host header validation to WEALTH | **P1** | WEALTH |
| 3 | Baseline snapshot saved to `/tmp/mcpjam-baseline/` | Done | All |
| 4 | Create eval cases for regression detection | **P2** | All |
| 5 | Add `mcpjam server doctor` to CI/CD pipeline | **P2** | Infra |

---

## Baseline Files

All raw JSON saved to `/tmp/mcpjam-baseline/`:
- `arifos.json` — doctor output (122KB)
- `arifos-conf.json` — protocol conformance
- `geox.json` — doctor output (34KB)
- `geox-conf.json` — protocol conformance
- `wealth.json` — doctor output (66KB)
- `wealth-conf.json` — protocol conformance (FAILED)
- `well.json` — doctor output (45KB)
- `well-conf.json` — protocol conformance

---

*DITEMPA BUKAN DIBERI — MCPJam audit complete.*
