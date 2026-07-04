# P0 Implementation — AOB Envelope + Witness + Ephemeral Eval
> FORGED 2026-07-03 | OpenCode (333-AGI) | DITEMPA BUKAN DIBERI

## Source
External audit: `EXTERNAL-AUDIT-ASSETOPSBENCH-AGI-SUBSTRATE.md`
Diagnosis: governance ~7/10, benchmark ~4/10, AGI-substrate ~5/10
Core fix: "You do not need more organs. You need cleaner contracts."

## What Was Built (4 P0 Patches)

### P0-1: Unified Enforcement Envelope + Verdict Codes
**File:** `/root/arifOS/arifosmcp/schemas/enforcement_envelope.py` (NEW, 254 lines)
- `CanonicalVerdict`: SEAL / HOLD / SABAR / VOID — single source across ALL organs
- `VerdictReason`: 16 typed reason codes (OK, HOLD.AUTH_REQUIRED, HOLD.WITNESS_INSUFFICIENT, etc.)
- `SessionMode`: ephemeral_eval | persistent_bound
- `AuthorityScope`: OBSERVE_ONLY | SUGGEST_ONLY | EXECUTE_BOUND
- `EnforcementEnvelope`: Pydantic model with kernel, authority, verdict, witness, trace, navigation blocks
- `LEGACY_VERDICT_MAP`: GEOX QUALIFY→SABAR, A-FORGE CAUTION→SABAR, PARADOX_HOLD→HOLD
- Convenience factories: `make_ephemeral_envelope()`, `make_persistent_envelope()`, `make_hold_envelope()`

### P0-2: Ephemeral Eval Mode (sessionless-safe)
**File:** `/root/arifOS/arifosmcp/tools/session.py` (MODIFIED)
- New `session_mode` parameter on `arif_init`: `ephemeral_eval` | `persistent_bound`
- `ephemeral_eval`: OBSERVE_ONLY, no identity bind, ANONYMOUS authority
- Returns machine-readable enforcement envelope with `session_mode: ephemeral_eval`
- Auto-escalates to HOLD.AUTH_REQUIRED on any MUTATE+ path
- Generates lightweight session ID for tracing only (`eval-{uuid12}`)

### P0-3: Machine arif_init(light) Enforcement Envelope
**File:** `/root/arifOS/arifosmcp/tools/session.py` (MODIFIED, `_project_light()`)
Added to every light-mode response:
- `init_mode`, `session_mode`, `authority_scope`, `actor_bound`
- `kernel_epoch: "2026-07-03"`, `public_surface_version: "7"`
- `tool_registry_version: "1.0.0"`, `allowed_next_verbs: [...]`
- `trace`: {run_id, scenario_id, benchmark_id, tool_registry_version, otel_trace_id}
- `witness`: {active_count, missing_types, mode3_collapse, diversity_level}
- `verdict_code`: typed reason code
- `action_class`: from ActionClass enum

### P0-4: F3 Witness Wiring (diagnostic → live)
**Files:**
- `/root/AAA/core/automatic_runtime_gate.py` (MODIFIED): Replaced F3 diagnostic stub (lines 493-495) with live witness enforcement
  - `check_all_floors()` now accepts optional `witness_state` parameter
  - With `witness_state`: calls `pre_forge_witness_gate()` — blocks MUTATE/DEPLOY/ALLOCATE if diversity < 3
  - Without `witness_state`: computes lightweight score, issues SABAR advisory for EXECUTE_HIGH_IMPACT/IRREVERSIBLE
  - Mode-3 collapse (AI-judging-AI) → HOLD even without session state
  - Graceful ImportError fallback if witness_diversity module unavailable
- `/root/A-FORGE/src/domain/governance/floor-types.ts` (MODIFIED): Added `VerdictCode` type, `toVerdictCode()` mapper, `verdict_code` field on `FloorReason`. SABAR→HOLD collapse prevention documented.

## Verification
- **arifOS tests:** 170 passed, 1 pre-existing failure (LLM-dependent test)
- **Enforcement envelope:** All verdict normalizations verified (QUALIFY→SABAR, CAUTION→SABAR, PARADOX_HOLD→HOLD)
- **Ephemeral eval:** Envelope factories produce correct session_mode, authority_scope, allowed_next
- **_project_light():** All 10 new machine envelope fields present and typed
- **F3 witness:** pre_forge_witness_gate correctly blocks MUTATE with 2/5 witnesses, allows OBSERVE always
- **A-FORGE TypeScript:** Compiles clean (`tsc --noEmit --project tsconfig.json`)
- **automatic_runtime_gate:** Witness advisory fires for EXECUTE_HIGH_IMPACT, Mode-3 detection works

## Files Changed
| File | Type | Lines |
|------|------|-------|
| `/root/arifOS/arifosmcp/schemas/enforcement_envelope.py` | NEW | 254 |
| `/root/arifOS/arifosmcp/tools/session.py` | MODIFIED | +110 (ephemeral_eval block + envelope fields) |
| `/root/AAA/core/automatic_runtime_gate.py` | MODIFIED | +70 (F3 witness wiring) |
| `/root/A-FORGE/src/domain/governance/floor-types.ts` | MODIFIED | +50 (VerdictCode + toVerdictCode) |

## What Remains (P1/P2)
- OTEL trace wiring (init→seal, one correlated trace per run)
- A2A Agent Card generation from live registry
- Benchmark breadth expansion (IoT, FMSR, TSFM, WO, vibration domains)
- Resources surface (MCP resources/list for constitution, registry, verdict codes)
- Trajectory persistence with AssetOpsBench-native format

## Next Action
Push to main, restart arifOS kernel, run smoke test with `arif_init(session_mode="ephemeral_eval")`.
Then expand A2B governed runner to use ephemeral eval path → re-run sample-50.
