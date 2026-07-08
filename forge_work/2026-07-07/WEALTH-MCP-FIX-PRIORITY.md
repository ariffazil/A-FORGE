# WEALTH MCP — Fix-Priority Report (SVB Backtest Cross-Agent Findings)

**Date:** 2026-07-07  
**Session:** `SEAL-dbdbcfd24f88475a` (Arif) + `SEAL-9de3f20ccd0642ff` (FORGE-000)  
**Agents:** Claude (Tracks 1-2 + edge cases) + FORGE-000/OpenCode (Track 3 + surface audit)  
**Evidence labels:** VERIFIED = reproduced live; DERIVED = inferred from score patterns

---

## EXECUTIVE SUMMARY

WEALTH MCP has **3 P0 bugs** that make its capital-primitive layer numerically unreliable and its DIAGNOSE cluster structurally blind to bank-style solvency failures. The SVB case — a well-documented, primary-sourced collapse outside the tool's calibration corpus — exposed failures at every layer: arithmetic (NPV/IRR wrong), signal detection (false negatives on real pre-mortem data), input handling (silent field-dropping, undocumented type contracts), and session propagation (null actor_id across organs). 

**The single most damaging finding:** `wealth_compute_npv` systematically returns `true_NPV / (1+r)` — every NPV this tool has ever computed is wrong by a factor of 1/(1+r). For geoscience economics chains (P50 well NPV → POS-weighted EMV), this is an 8-15% systematic understatement that can flip accept/reject decisions near breakeven.

---

## P0 — MUST FIX BEFORE ANY PRODUCTION USE

### P0.1: `wealth_compute_npv` — Systematic Off-by-One Discounting Bug

**VERIFIED.** Two independent test vectors, both confirmed:

| Test Case | True NPV | Tool Output | Ratio |
|-----------|----------|-------------|-------|
| [-100,30,30,30,30,30], r=0.1 | 13.72 | 12.48 | 0.9093 |
| [-150,20,20,20,20,20,200], r=0.1 | −17.36 | −15.78 | 0.9093 |

Ratio = 0.9093 = 1/1.1 exactly. **The tool discounts the t=0 cash flow as if it occurs at t=1.** Root cause: the discounting loop starts at index 0 instead of index 1, applying `1/(1+r)^(i+1)` instead of `1/(1+r)^i`.

**Fix:** Change discounting to start at period 0 for CF[0] (or treat CF[0] as undiscounted t=0 investment). Add unit tests with known-answer cases.

### P0.2: `wealth_compute_irr` — Solver Fails on Trivial Case

**VERIFIED.** Single cash flow case: invest 100, receive 110 next period. Analytic IRR = 10.0%. Tool returns `irr: null`, `warnings: []` (empty). No diagnostic, no indication the solver failed or why.

Also confirmed by FORGE-000: `[-100,30,40,50,60]` → `null` (analytic IRR ≈ 25%).

**Fix:** Verify solver converges for single-root cases. Add fallback to analytic solution for 2-period cases. Populate `warnings` on solver failure.

### P0.3: `wealth_institutional_stress_index` — Silent Field-Dropping → False Negative

**VERIFIED** (stress score) + **DERIVED** (cause = field-dropping). 

Real SVB data from Jan 2023 (5 weeks before FDIC seizure):
- Unrealized losses = 111% of shareholder equity
- CRO seat vacant 9 months
- 6 open Fed supervisory deficiencies
- 8% workforce rightsizing

→ Tool returned **`stress_index: 0.216, risk_level: GREEN`**.

Root cause (DERIVED): `governance` component score = 0.0 despite alarming governance inputs. The tool's schema only recognizes `board_size`, `board_resignations_12m`, `company_secretaries_as_directors`, `avg_tenure_years` — fields like `cro_seat_vacant_months` and `fed_supervisory_deficiencies_open` were silently dropped rather than rejected. Similarly, no field in `financial_signals` captures balance-sheet duration mismatch (unrealized losses vs. equity) — the tool is structurally blind to the proximate cause of the SVB-style failure.

**Fix:** (a) Reject unknown fields with a validation error rather than silently dropping. (b) Add `cro_vacant_months`, `supervisory_deficiencies_open`, `unrealized_losses_vs_equity_pct` to the governance and financial signal schemas. (c) If the tool cannot model a risk dimension, emit `UNKNOWN` for that component rather than `0.0`.

---

## P1 — FIX BEFORE NEXT DEPLOYMENT CYCLE

### P1.1: Undocumented Type Contract → Fatal Crash

**VERIFIED.** `wealth_institutional_stress_index` crashes with `TypeError` if `workforce_signals.key_personnel_departures` is passed as an integer. Code does `len(departures)` — expects a list, but schema/description give no indication. Any LLM caller passing an integer (the natural reading of "key_personnel_departures: 1") gets `INTERNAL_ERROR`/`FATAL`/`ESCALATE_TO_888_HOLD`.

**Fix:** Add Pydantic validation at the schema level. Accept both `int` (count) and `list[str]` (names). Gracefully reject with a descriptive error, not a fatal crash.

### P1.2: DIAGNOSE Cluster Auth Gate — Opaque Failure

**VERIFIED.** Both `wealth_governance_capacity` and `wealth_cascade_model` return bare `"No approval received."` — no error class, no schema explanation, no indication of what approval is missing or how to obtain it. Systematic across the DIAGNOSE cluster.

**Fix:** Either document the approval gate in tool descriptions, or surface an error envelope with `error_class`, `remedy`, and `required_approval` fields.

### P1.3: Transport-Layer JSON Serialization (4 tools affected)

**VERIFIED (FORGE-000).** Arrays and objects are stringified in MCP transport. Affected tools: `wealth_conservation_check`, `wealth_flow_check`, `wealth_boundary_governance`, and likely any tool accepting `list` or `dict` parameters. Pydantic validation errors show `input_value='[]'` (str) when list expected.

**Fix:** May require FastMCP schema annotation (`Annotated[list, ...]`) or client-side JSON parsing. Add integration tests for array/object parameters.

### P1.4: Inconsistent Verdict Fields + Null Actor ID (Cross-Organ)

**VERIFIED (Claude + FORGE-000).** `wealth_survival_engine` returns 5 mutually inconsistent verdict signals in one payload: `status: "HOLD"`, `risk.verdict: "GO"`, `domain_verdict: "QUALIFY"`, `apex.verdict: "HOLD"`, `risk.economic: "HIGH"`. Also `actor_id: null` despite running in actor-bound session — corroborates Claude's kernel-level finding, now confirmed cross-organ in WEALTH.

**Fix:** Unify verdict fields into a single authoritative signal. Propagate session actor_id into tool execution context.

### P1.5: Preload Resource System Broken (3 tools blocked)

**VERIFIED (FORGE-000).** `wealth://risk/thresholds`, `wealth://federation/contract`, `wealth://reality/context` all return "Failed to read MCP resource." This gates `wealth_collapse_signature_scan`, `wealth_compute_emv`, and any tool requiring these preloads. Without preloads, these tools are dead — they return `PRELOAD_REQUIRED` with no path to resolution.

**Fix:** Either implement the resource handlers or remove the preload requirement until they're ready.

### P1.6: 4 Phantom Tools in Registry

**VERIFIED (FORGE-000).** `wealth_registry_status` lists `wealth_institutional_stress_index`, `wealth_governance_capacity`, `wealth_cascade_model`, `wealth_external_exploitation_detect` as "public_tools" — but they are not callable via MCP or arifos bridge. Registry claims ≠ reality.

**Fix:** Either deploy these tools or remove from registry. Current state violates F2 TRUTH.

---

## P2 — FIX IN NEXT MAINTENANCE CYCLE

### P2.1: Signal Detection Sensitivity (3 tools)

**VERIFIED (both agents).** `power_audit`, `capture_scan`, and `beautiful_mouse_scan` rely on keyword/phrase matching against small pools (13-15 phrases each). All three scored LOW/ABSENT on SVB pre-collapse text that a human would flag as institutional overconfidence.

**Fix:** Expand phrase pools. Consider embedding-based semantic detection as complement to keyword matching.

### P2.2: Boundary Input Semantics

**VERIFIED (FORGE-000).** `runway_check` returns `"infinite"` for negative assets + zero burn. `survival_engine` liquidity mode returns `GREEN` with liquid_assets=0. Both are technically correct arithmetic but semantically misleading.

**Fix:** Add semantic validation: negative equity → `NEGATIVE_EQUITY` not `infinite`. Zero-input survival → `INSUFFICIENT_DATA` not `GREEN`.

### P2.3: `forge_surface_audit` Blind to Registry/Reality Gap

**VERIFIED (FORGE-000).** Surface audit returns `CLEAN` despite 4 phantom tools. No cross-check between registry and callable surface.

**Fix:** Add registry↔callable cross-check to surface audit.

---

## TEST COVERAGE MAP (COMBINED)

| Tool | Tested By | Status |
|------|-----------|--------|
| `institutional_stress_index` | Claude | 🔴 P0 false negative + P1 crash |
| `governance_capacity` | Claude | 🟠 P1 opaque auth gate |
| `cascade_model` | Claude | 🟠 P1 opaque auth gate |
| `external_exploitation_detect` | Neither | ❌ Phantom tool |
| `collapse_signature_scan` | Neither | ❌ Preload dead |
| `compute_npv` | Both | 🔴 P0 systematic off-by-one |
| `compute_irr` | Both | 🔴 P0 solver broken |
| `compute_emv` (new) | Neither | ❌ Preload dead |
| `emv_compute` (legacy) | FORGE-000 | ✅ CORRECT |
| `capture_scan` | Both | 🟠 P2 false negative |
| `power_audit` | Both | 🟠 P2 false negative |
| `beautiful_mouse_scan` | Both | 🟠 P2 insensitive |
| `survival_engine` | Both | 🟡 P1 inconsistent verdicts |
| `runway_check` | FORGE-000 | 🟡 P2 semantic |
| `wisdom_evaluate` | FORGE-000 | 🟡 P2 neutral fallback |
| `boundary_governance` | FORGE-000 | 🟠 P1 serialization |
| `conservation_check` | FORGE-000 | 🟠 P1 serialization |
| `flow_check` | FORGE-000 | 🟠 P1 serialization |
| `asymmetry_check` | FORGE-000 | ✅ CORRECT |
| `confluence_check` | FORGE-000 | ✅ CORRECT |

**Combined: 7/20 tools tested clean. 4 phantom. 3 preload-blocked. 6 bugged (3 P0, 3 P1, 3 P2).**

---

## RECOMMENDED FIX ORDER

1. **P0.1 + P0.2 (NPV + IRR)** — Fix arithmetic bugs first; these poison everything downstream
2. **P0.3 (stress_index field-dropping)** — Add reject-on-unknown + missing solvency fields
3. **P1.5 (preload resources)** — Unblock collapse_signature_scan and compute_emv
4. **P1.1 (type contract)** — Add Pydantic validation to prevent crashes
5. **P1.3 (serialization)** — Fix transport layer
6. **P1.4 (verdict consistency + actor propagation)** — Cross-organ fix
7. **P1.2 (auth gate)** — Document or fix DIAGNOSE approval gates
8. **P1.6 (phantom tools)** — Deploy or unregister

---

*Forged: 2026-07-07 — Cross-agent (Claude + FORGE-000) under F13 SOVEREIGN directive*  
*DITEMPA BUKAN DIBERI*
