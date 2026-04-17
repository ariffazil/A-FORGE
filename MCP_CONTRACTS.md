---
title: arifOS MCP Canonical Contract Sheet
version: 2026.04.17
status: SEALED
authority: ARIF_SOVEREIGN
---

# arifOS MCP Canonical Contract Sheet

> One source of truth for all lane tool contracts.
> Any deviation from this schema is a conformance failure.

---

## Conformance Rules (apply to ALL lanes)

| Rule | Invariant |
|------|-----------|
| **R1** | Every session MUST open with an INIT call that writes `000_INIT` to `vault_events` |
| **R2** | Every session MUST close with a SEAL call that writes `999_SEAL` or `999_VAULT` to `vault_events` |
| **R3** | `session_id` at SEAL MUST match `session_id` from INIT |
| **R4** | Each event `prev_hash` MUST equal previous event's `chain_hash` |
| **R5** | A-FORGE MUST NOT write directly to `vault_events` |
| **R6** | Delegate lanes (GEOX, 4TD) MUST route INIT/SEAL through arifOS |
| **R7** | SEAL MUST NOT succeed if INIT has not been called for the session |
| **R8** | `actor_id` MUST be non-empty and non-anonymous at both INIT and SEAL |

---

## Lane: arifOS (Constitutional Kernel)

**Role:** Sovereign truth engine, vault authority, constitutional gate
**Runtime:** Python / FastMCP
**Container:** `A-FORGE-arifos-mcp` (port 8080)
**Vault path:** `public.vault_events` + `public.vault_seals`

### INIT

```
tool:       arifos_init
stage:      000_INIT
verdict:    ACTIVE
required:   intent (str)
optional:   actor_id, session_id, platform, auth_context, risk_tier
returns:    { ok, session_id, vault_id, chain_hash, stage }
vault:      writes vault_events row, prev_hash = last chain_hash
```

### SEAL

```
tool:       arifos_vault
stage:      999_SEAL
verdict:    SEAL | PARTIAL | HOLD | VOID
required:   session_id, summary, verdict
optional:   telemetry, source_agent, pipeline_stage, risk_tier
returns:    { ok, ledger_id, hash, verdict }
vault:      writes vault_events row, chains to INIT
```

### Core Pipeline Tools

| Tool | Stage | Purpose | Key Args |
|------|-------|---------|----------|
| `arifos_init` | 000_INIT | Session open + identity anchor | `intent`, `actor_id` |
| `arifos_sense` | 111_SENSE | Evidence acquisition | `query`, `session_id` |
| `arifos_mind` | 333_EXPLORE | Reasoning pipeline | `query`, `context`, `session_id` |
| `arifos_heart` | 555_HEART | Risk/ethics review | `query`, `content`, `session_id` |
| `arifos_ops` | 777_REASON | Cost/capacity calc | `query`, `session_id` |
| `arifos_judge` | 888_HOLD | Constitutional verdict | `proposal`, `risk_tier`, `session_id` |
| `arifos_vault` | 999_SEAL | Immutable seal | `session_id`, `summary`, `verdict` |
| `arifos_memory` | any | Vector memory retrieve | `query`, `session_id` |
| `arifos_kernel` | any | Route to correct lane | `query`, `session_id` |
| `arifos_forge` | 777_EXEC | Delegated execution | `query`, `allow_execution=True` |
| `arifos_gateway` | any | Orthogonality guard | `query`, `session_id` |

### Verdict Enum

`SEAL` | `PARTIAL` | `HOLD` (888 gate, needs human) | `VOID` | `SABAR` | `ACTIVE`

---

## Lane: WELL (Human Substrate)

**Role:** Biological readiness mirror, cognitive pressure signal, substrate governance
**Runtime:** Python / FastMCP
**Host path:** `/root/WELL/server.py`
**Vault path:** `public.vault_events` (shared chain, via vault_postgres)

### INIT

```
tool:       well_init
stage:      000_INIT
verdict:    ACTIVE
optional:   session_id (auto-generated if None), actor_id (default: "well-substrate")
returns:    { ok, session_id, stage, well_score, chain_hash, w0 }
vault:      writes vault_events row, event_type=WELL_SESSION_INIT
```

### SEAL

```
tool:       well_anchor
stage:      999_VAULT
verdict:    SEAL | HOLD (if substrate DEGRADED)
optional:   force: bool = False
returns:    { ok, vault_id, hash, verdict }
vault:      writes vault_events row via anchor_well_to_vault()
```

### Operational Tools

| Tool | Purpose | Key Args | Returns Key |
|------|---------|----------|-------------|
| `well_state` | Read current snapshot | — | `well_score`, `floors_violated`, `metrics` |
| `well_log` | Write telemetry update | `sleep_hours`, `clarity`, `stress_load`, ... | `well_score`, `floors_violated`, `status` |
| `well_pressure` | Signal cognitive load | `load_delta: float`, `source: str` | `decision_fatigue`, `w6_active` |
| `well_readiness` | Readiness verdict for arifOS JUDGE | — | `verdict`, `bandwidth`, `sabar_advisory` |
| `well_check_floors` | W-Floor status check | — | `floors`, `violated`, `verdict` |

### Floor Enum

`W0` (sovereignty — invariant) | `W1` (sleep debt > 2d) | `W5` (clarity < 4) | `W6` (metabolic pause)

### Bandwidth Enum

`FULL` (score ≥ 80) | `NORMAL` (score ≥ 60) | `REDUCED` (score < 60) | `RESTRICTED` (violations)

---

## Lane: WEALTH (Economic Engine)

**Role:** Capital allocation math, financial scoring, vault-linked transaction record
**Runtime:** Python / FastMCP
**Host path:** `/root/WEALTH/server.py`
**Vault path:** `public.vault_events` + `arifos_vault.wealth.transactions` + `arifos_vault.wealth.portfolio_snapshots`

### INIT

```
tool:       wealth_init
stage:      000_INIT
verdict:    ACTIVE (SEAL envelope)
optional:   session_id (auto-generated), actor_id (default: "wealth-agent"), intent (str)
returns:    { session_id, stage, chain_hash, vault_id }
vault:      writes vault_events row, event_type=WEALTH_SESSION_INIT
```

### SEAL

```
tool:       wealth_snapshot_portfolio
stage:      999_VAULT
verdict:    SEAL | VOID
required:   tool_name, arguments, result
optional:   asset_id, nav_myr, quantity_held, price_close, currency, scale_mode
returns:    { snapshot_id, status, integrity }
vault:      writes arifos_vault.wealth.portfolio_snapshots
```

### Transaction Record (event-level)

```
tool:       wealth_record_transaction
required:   tx_type, amount, currency, description
optional:   asset_id, category, quantity, price, fees, broker, notes
returns:    { tx_id, status, integrity }
vault:      writes arifos_vault.wealth.transactions
```

### Core Compute Tools

| Tool | Purpose | DITEMPA Score Key |
|------|---------|-------------------|
| `wealth_npv_reward` | NPV + Terminal Value | `npv`, `pv_inflows` |
| `wealth_irr_yield` | IRR/MIRR | `irr`, `mirr` |
| `wealth_pi_efficiency` | Profitability Index | `pi`, `expected_pi` |
| `wealth_emv_risk` | Expected Monetary Value | `emv`, `sigma` |
| `wealth_dscr_leverage` | Debt Service Coverage | `dscr`, `floor_pass` |
| `wealth_payback_time` | Payback / DPP | `payback_years` |
| `wealth_monte_carlo_forecast` | Stochastic forecast | `p50_npv`, `p10_npv`, `p90_npv` |
| `wealth_score_kernel` | Final allocation verdict | `verdict`, `bandwidth` |
| `wealth_check_floors` | F1-F13 floor check | `floors`, `verdict` |
| `wealth_policy_audit` | Policy constraint audit | `compliant`, `violations` |

### Scale Mode Enum

`enterprise` | `personal` | `agentic` | `crisis` | `civilization`

---

## Lane: GEOX (Physical Grounding)

**Role:** Subsurface evidence, petrophysics, spatial validation, anomaly contrast
**Runtime:** Python / FastMCP
**Host path:** `/root/geox/geox/geox_mcp/fastmcp_server.py`
**Vault path:** DELEGATES to arifOS (`arifos_vault`)

### INIT (delegated)

```
Calls arifos_init before any governed session.
No independent vault write.
session_id carried through all GEOX tool calls.
```

### SEAL (delegated)

```
Calls arifos_judge_prospect → arifos_vault via arifOS kernel.
GEOX never writes to vault_events directly.
```

### Core Tools

| Tool | Purpose | Key Args |
|------|---------|----------|
| `geox_well_load_bundle` | Load LAS/DLIS well logs | `well_id` |
| `geox_well_qc_logs` | QC on loaded logs | `well_id` |
| `geox_well_compute_petrophysics` | Sw, Vsh, porosity | `well_id`, `volume_id` |
| `geox_seismic_load_line` | Load seismic line | `line_id` |
| `geox_earth3d_load_volume` | Load 3D seismic volume | `volume_id` |
| `geox_earth3d_interpret_horizons` | Horizon picking | `volume_id`, `mode` |
| `geox_prospect_evaluate` | Hydrocarbon potential | `prospect_id`, `ac_risk_score` |
| `geox_cross_summarize_evidence` | Causal evidence synthesis | `prospect_id` |
| `geox_time4d_verify_timing` | Trap-charge timing | `prospect_id`, `trap_ma`, `charge_ma` |
| `arifos_compute_risk` | AC_Risk formula (W_Risk) | `u_phys`, `transform_stack` |
| `arifos_judge_prospect` | Constitutional verdict | `u_phys`, `transform_stack`, `truth_score` |
| `arifos_check_hold` | 888_HOLD gate | `action`, `risk_class` |

### Verdict Enum (from arifOS via GEOX)

`SEAL` (≥ 0.80) | `PARTIAL` (≥ 0.50) | `SABAR` (≥ 0.25) | `VOID` (< 0.25)

---

## Lane: 4TD / Time4D (Planned — Delegate)

**Role:** Burial history simulation, paleo reconstruction, trap-charge timing
**Runtime:** Python (planned)
**Vault path:** DELEGATES to arifOS
**Authority:** GEOX/arifOS kernel — no independent vault ownership

### Contract invariants

- Compute-only lane
- No `vault_events` writes directly
- All governed results passed to `arifos_vault` via session_id
- `arifos_check_hold` required before any irreversible simulation write

---

## Lane: A-FORGE (Execution Shell)

**Role:** Orchestration, CLI, execution dispatch, operator console
**Runtime:** TypeScript / Node.js
**Vault path:** READ-ONLY consumer — NEVER writes to `vault_events`

### Permitted operations

| Operation | Allowed |
|-----------|---------|
| Read vault verdicts | ✅ |
| Dispatch tool calls to Python MCPs | ✅ |
| Show operator console / dashboards | ✅ |
| Orchestrate multi-lane workflows | ✅ |
| Write to `vault_events` directly | ❌ NEVER |
| Self-authorize execution | ❌ NEVER |
| Bypass arifOS judge/seal | ❌ NEVER |
| Hold sovereign INIT authority | ❌ NEVER |

### A-FORGE Boundary Invariant

> A-FORGE is a governed execution shell. It dispatches actions that Python MCPs authorize.
> Any attempt by A-FORGE to own truth, write vault, or bypass the constitutional gate is a F13 violation.

---

## Vault Chain Contract

```
vault_events schema (canonical):
  id            SERIAL PRIMARY KEY
  event_id      UUID UNIQUE NOT NULL
  event_type    VARCHAR(32) NOT NULL
  session_id    VARCHAR(128) NOT NULL
  actor_id      VARCHAR(128) NOT NULL
  stage         VARCHAR(32) NOT NULL   -- 000_INIT | 333_EXPLORE | 999_SEAL | 999_VAULT | ...
  verdict       VARCHAR(32) NOT NULL   -- ACTIVE | SEAL | PARTIAL | HOLD | VOID | SABAR
  payload       JSONB NOT NULL
  risk_tier     VARCHAR(16) NOT NULL
  merkle_leaf   VARCHAR(64) NOT NULL   -- SHA256(event_id::actor_id::verdict::stage)
  prev_hash     VARCHAR(64) NOT NULL   -- chain_hash of previous row (GENESIS for first)
  chain_hash    VARCHAR(64) NOT NULL   -- SHA256(merkle_leaf + prev_hash)
  signature     VARCHAR(128) NOT NULL
  signed_by     VARCHAR(64) NOT NULL
  sealed_at     TIMESTAMPTZ NOT NULL

vault_seals schema (Merkle batch checkpoint):
  id             SERIAL PRIMARY KEY
  tree_size      INTEGER NOT NULL
  merkle_root    VARCHAR(64) NOT NULL  -- last chain_hash of batch
  prev_root      VARCHAR(64) NOT NULL  -- merkle_root of previous vault_seals row
  first_event_id INTEGER NOT NULL
  last_event_id  INTEGER NOT NULL
  signature      VARCHAR(256) NOT NULL
  signed_by      VARCHAR(64) NOT NULL
  sealed_at      TIMESTAMPTZ NOT NULL
```

### Chain integrity rule

```
For every consecutive pair (N, N+1) in vault_events ordered by id:
  vault_events[N+1].prev_hash == vault_events[N].chain_hash   ← MUST hold
  vault_events[N+1].merkle_leaf == SHA256(event_id||'::'||actor_id||'::'||verdict||'::'||stage)
  vault_events[N+1].chain_hash == SHA256(merkle_leaf + prev_hash)
```

---

*DITEMPA BUKAN DIBERI — 999 SEAL ALIVE*


