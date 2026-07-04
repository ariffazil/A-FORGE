# TRIANGULATION — External Audit P0 Items vs Live Federation State

> **Session:** SEAL-455cad18b3164037 (OBSERVE_ONLY — actor_verified=false)
> **Date:** 2026-07-03 15:38 UTC
> **Authority lane:** A-FORGE 111 SENSE — read-only triangulation
> **Source audit:** `/root/A-FORGE/forge_work/2026-07-03/EXTERNAL-AUDIT-ASSETOPSBENCH-AGI-SUBSTRATE.md`
> **arifOS Zen Circuit status:** 000 ✅ (session bound) · 111 ✅ (this pass) · 888 ← (logging) · 333/555/666/777/999 SKIPPED (per OBSERVE_ONLY override in `arifOS/AGENTS.md`)

---

## 1. Executive Summary

| # | Audit Claim (source §) | Triangulated Verdict | Severity |
|---|------------------------|---------------------|----------|
| 1 | Verdict enum inconsistency across organs (§3) | **CONFIRMED WORSE** — 7+ A-FORGE enums, 5-value GEOX, 4-value arifOS canonical, mixed AAA doc-vs-code, 2-value WEALTH | **HIGH** |
| 2 | A-FORGE maps SABAR→HOLD (§3) | **INACCURATE** — SABAR preserved as distinct value in 8+ files (core.ts:925 `const blocked = verdict === "VOID" \|\| verdict === "SABAR" \|\| verdict === "HOLD"`) | LOW (still inconsistent, but for different reason) |
| 3 | `arif_init(light)` envelope incomplete (§4.2) | **CONFIRMED** — `mode="light"` accepted; live envelope missing `init_mode`, `session_mode`, `authority_scope`, `tool_registry_version`, `next_allowed_verbs`, `verdict_code`, `action_class`, `witness`, `trace` | **HIGH** |
| 4 | Sessionless-safe `ephemeral_eval` mode absent (§4.3) | **CONFIRMED** — `session_mode` exists only for civilian sovereignty opt-out (rights_registry.py:382); no benchmark-eval mode | **HIGH** |
| 5 | F3 witness diagnostic-only, not default-runtime-enforced (§2 + §7) | **PARTIALLY CONFIRMED** — vault.py:68 enforces witness for IRREVERSIBLE only; L03 WITNESS is SOFT floor; default reversible path does not require live witness summary | MEDIUM |
| 6 | A2B "0/50 seals" (§2 + §7) | **NEEDS DEEPER READ** — `/root/a2b/evals/` has 5 runs; `reports/EVAL_REPORT_v0.1.md` not read in this pass | UNKNOWN |
| 7 | A-FORGE CI stale (§2) | **PARTIAL** — workflow files dated Jun 24–Jul 1 (recent); "stale" likely refers to run failures, not file freshness; GitHub Actions run history not queried | LOW |

**Audit core thesis** ("You do not need more organs. You need cleaner contracts.") — **CORROBORATED**.

---

## 2. Verdict Enum Triangulation (live code paths)

### 2.1 arifOS canonical (4-value)
- `arifOS/arifosmcp/arifos_vault/evidence_receipt.py:24` — `witness_attestation: str  # SEAL | SABAR | HOLD | VOID`
- `wealth/api/schemas/waw-envelope.json:79,94` — `enum: ["SEAL", "COMPLY", "CAUTION", "HOLD", "SABAR", "VOID"]` (6-value WAW envelope; canonical verdict subset remains 4-value)
- `arifOS/tests/test_11_mega_tools_gates.py:31` — `current_public_surface_mode() == "canonical13"` (locked public surface)

### 2.2 GEOX (5-value — DIFFERENT)
| File | Values |
|------|--------|
| `GEOX/src/geox_core/core/doctrine/geox_core_prompt.py:221` | SEAL / QUALIFY / HOLD / VOID / 888_HOLD |
| `GEOX/src/geox_core/schemas/render_payload.py:212` | `Literal["SEAL", "QUALIFY", "HOLD", "VOID", "888_HOLD"]` |
| `GEOX/src/geox_mcp/server.py:1486` | "SEAL, HOLD, VOID, QUALIFY" (description string) |
| `GEOX/src/geox_mcp/tools/vision.py:25` | "SEAL reserved / QUALIFY / INTERPRETATION / …" (extends) |
| `GEOX/src/geox_core/telemetry/geox_telemetry.py:184` | `{"SEAL": 1.0, "QUALIFY": 0.85, "HOLD": 0.60, "VOID": 0.20}` |

**Diff vs arifOS canonical:** GEOX has **QUALIFY** where arifOS has **SABAR**; GEOX adds **888_HOLD**.

### 2.3 A-FORGE (7+ distinct enums — WORST OFFENDER)
| File | Values | Notes |
|------|--------|-------|
| `src/domain/governance/floor-types.ts:27` | SEAL / SABAR / **CAUTION** / HOLD / VOID | Has extra CAUTION |
| `src/interfaces/middleware/ConstitutionalBoundary.ts:23` | SEAL / HOLD / VOID | 3-value, NO SABAR |
| `src/domain/governance/AmanahLockManager.ts:33` | SEAL / **888-HOLD** | 2-value, hyphenated |
| `src/interfaces/routes/repoStewardRoutes.ts:117` | SEAL / SABAR / VOID / **DOWN** / **UNKNOWN** | Has DOWN/UNKNOWN |
| `src/domain/governance/wellReadiness.ts:12` | **PASS** / SABAR / HOLD | 3-value, no SEAL |
| `src/domain/forge/skill/decisionField.ts:250` | **CRYSTALLIZE / NUCLEATE / DORMANT / WITHER** | 4-value, completely different vocabulary |
| `src/domain/forge/skill/skillForge.ts:19` | (same as above; comment: "arifOS SEAL/SABAR/HOLD/VOID reserved") | Acknowledges separation |
| `src/infrastructure/governance/CoolingLedgerRegistry.ts:9` | SABAR / HOLD | 2-value |
| `src/domain/governance/apexDials.ts:69` | SEAL / SABAR / HOLD / VOID | Matches arifOS canonical |
| `src/domain/forge/check_verdict.ts:33` | SEAL / SABAR / HOLD / VOID / null | 4+1 |
| `src/domain/types/wealth.ts:52` | SEAL / HOLD / VOID | 3-value |

**A-FORGE SABAR→HOLD mapping: INACCURATE per audit.** SABAR is its own block value alongside HOLD, not collapsed into HOLD. core.ts:925: `const blocked = verdict === "VOID" || verdict === "SABAR" || verdict === "HOLD"`.

### 2.4 AAA (mixed — doc vs code)
| File | Values |
|------|--------|
| `AAA/docs/AAA_STATE_LANGUAGE.md:88` | `verdict: "SEAL \| HOLD \| SABAR \| VOID \| PARTIAL"` (5-value, doc) |
| `AAA/a2a-server/chat_agent.py:158,254` | `verdict="SEAL"` (1-value, code) |
| `AAA/a2a-server/vault999_writer_fix.py:255` | `verdict="SEAL"` |
| `AAA/skills/aaa-agentic-governance/scripts/compose_federation_receipt.py:122,131` | `verdict = "SEAL"` or `"SEAL_REJECTED"` (2-value) |
| `AAA/skills/aaa-agentic-governance/scripts/floor_check.py:278,284` | `SEAL_REJECTED` or `SEAL` (2-value) |
| `AAA/src/gateway/deliberation.ts:365` | `verdict: 'SEAL'` (1-value) |
| `AAA/core/automatic_runtime_gate.py` | `GateVerdict` (referenced; enum body not read) |

**AAA has NO clean canonical enum.** Doc claims 5-value; code uses 1–2 values; `automatic_runtime_gate` is the source-of-truth candidate but not verified in this pass.

### 2.5 WEALTH (different again)
- `wealth/api/schemas/wealth-basis.json:119` — `enum: ["SEALED", "QUALIFY", "888-HOLD", "VOID"]` (4-value, **SEALED** not SEAL, hyphenated)
- `wealth/internal/apex_envelope_wealth.py:66` — `verdict = "SEAL" if G >= 0.80 else ("SABAR" if G >= 0.50 else "HOLD")` (uses arifOS canonical)
- **WEALTH has at least 2 different enums across its own codebase.**

### 2.6 Triangulation verdict (verdict enum)
- **6+ distinct verdict value sets across 5 organs** (arifOS, GEOX, A-FORGE, AAA, WEALTH)
- **A-FORGE alone has 7+ distinct enums** for internal sub-modules
- **A-FORGE SABAR→HOLD claim is INACCURATE** — SABAR is preserved as distinct value
- Cross-organ evaluation/remediation routing is **structurally broken** until unification

---

## 3. arif_init Envelope Gap (live observation this session)

### 3.1 Allowed `mode` values (per `arifOS/tests/test_11_mega_tools_gates.py:39-48`)
```
init, light, resume, validate, epoch_open, epoch_seal, opt_out, opt_out_profiling
```
`mode="light"` is accepted as input — but the **envelope returned** does not match audit §5 spec.

### 3.2 Live arif_init response (this session, mode="init", actor_id="FORGE-000Ω")
Returned fields:
- `session_id` ✅
- `actor_verified` ✅ (value: false — gates authority to OBSERVE_ONLY)
- `authority` ✅ (value: "OBSERVE_ONLY")
- `verdict` ✅ (value: "SEAL_OBSERVE_ONLY")
- `constitution_hash` ✅
- `detail_ref` ✅
- `next_tool` ✅ (SINGULAR — not `next_allowed_verbs` array)
- `degraded` ✅ (array)
- `next_safe_action` ✅
- `session_birth` ✅
- `motto` / `state_emoji` / `mode_emoji` / `signature` ✅
- `_envelope`, `_wrapper_degradation` ✅

Missing per audit §5 schema:
- ❌ `init_mode` (audit wants "light" | "full")
- ❌ `session_mode` (audit wants "ephemeral_eval" | "persistent_bound")
- ❌ `authority_scope` (audit wants "OBSERVE_ONLY" | "SUGGEST_ONLY" | "EXECUTE_BOUND" — live has `authority` only)
- ❌ `actor_bound` (audit wants bool — live has `actor_verified` bool, semantic overlap)
- ❌ `tool_registry_version`
- ❌ `next_allowed_verbs` (array — live has `next_tool` singular string)
- ❌ `verdict_code` (typed subcode like `HOLD.AUTH_REQUIRED`)
- ❌ `action_class` (typed enum like `EXECUTE_REVERSIBLE`)
- ❌ `witness` (object with `active_count`, `missing_types`, `mode3_collapse`)
- ❌ `trace` (object with `run_id`, `scenario_id`, `benchmark_id`, `tool_registry_version`, `otel_trace_id`)

**Gap: 10 of 13 audit-spec fields missing or differently-named.**

---

## 4. ephemeral_eval Mode Gap

### 4.1 Current state
- `arifOS/arifosmcp/runtime/civilian_sovereignty/rights_registry.py:382` — `session_mode: "opt_out | standard"` (different semantic — civilian sovereignty)
- `arifOS/arifosmcp/runtime/civilian_sovereignty/` is the only place `session_mode` appears in arifOS core
- ACP adapter (`hermes-agent/acp_adapter/server.py:530`) has `_session_modes(state)` for Claude ACP, **NOT** arifOS session modes
- No `ephemeral_eval` constant, no benchmark-eval bypass path

### 4.2 A2B blocker (audit §7 — "Identity airlock blocks governed attempts (0/50 seals)")
- A2B harness in `/root/a2b/evals/` (5 runs: SEAL_A2B_SESSION, p0_3_mcp_bridge, run001_gov, run002_gov, run002_nogov, smoke)
- `arif_judge.py:620-638` — `F11_SESSION_GATE: arif_judge requires a valid session_id` — **hard floor, blocks all eval scenarios without session**
- No narrow read-only path exists; ephemeral_eval mode would need to:
  1. Bypass F11 session requirement
  2. Cap authority at OBSERVE_ONLY
  3. Auto-escalate to HOLD.AUTH_REQUIRED on any mutate
  4. Not write VAULT999 entries
  5. Emit benchmark telemetry per audit §11

---

## 5. F3 Witness Wiring (live code)

### 5.1 Floor classification (per arifOS MCP runtime, just injected)
- **L03 WITNESS = SOFT** (not HARD)
- L01 AMANAH, L02 TRUTH, L09 ANTIHANTU, L10 ONTOLOGY, L11 AUTH, L12 INJECTION, L13 SOVEREIGN are HARD
- L04 CLARITY, L05 PEACE, L06 EMPATHY, L07 HUMILITY, L08 GENIUS are SOFT (alongside L03)

### 5.2 Enforcement paths
| File | Mechanism | Default enforces? |
|------|-----------|-------------------|
| `arifOS/arifosmcp/tools/vault.py:68-80` | "witness required for IRREVERSIBLE" — explicit GÖDEL-LOCK | NO (only IRREVERSIBLE) |
| `arifOS/arifosmcp/core/constitutional_core.py:558-633` | `_requires_human_witness(context, threat)` | Only for human witness on specific threats |
| `arifOS/arifosmcp/core/law_evaluator.py:499-554` | Similar human-witness gate | Same as above |
| `arifOS/arifosmcp/tools/judge.py:566+` | F11 SESSION_GATE at line 620 (hard floor) | YES (session_id, NOT witness) |
| `arifOS/arifosmcp/constitution/runtime_hook.py:60-66` | G3/G4: MUTATE without external actor_signature / judge_state_hash / plan_id | YES (mutation paths) |

### 5.3 Default judge path (`arif_judge.py:566`)
- Primary gate: F11 SESSION_GATE (line 620) — requires session_id
- No explicit F3 witness_summary requirement for non-IRREVERSIBLE calls
- Witness is implicit via the vault.seal flow (IRREVERSIBLE-only)

**Audit claim: "F3 witness diagnostic only; not yet enforced on default runtime path"** — **PARTIALLY TRUE.** Enforced on IRREVERSIBLE; not enforced on default reversible/standard path.

---

## 6. A2B Status (preliminary — needs deeper read)

### 6.1 Evidence observed
- `/root/a2b/` exists; `.git` last activity Jul 3
- `evals/` subdirs:
  - `SEAL_A2B_SESSION.md` (file)
  - `p0_3_mcp_bridge/` (dir)
  - `run001_gov/`, `run002_gov/`, `run002_nogov/` (dirs)
  - `smoke/` (dir)
- `reports/`:
  - `EVAL_REPORT_v0.1.md`
  - `IJCAI_2026_SUBMISSION.md`
- `harness/`, `notebooks/`, `scripts/`, `src/`, `data/`, `docs/` subdirs

### 6.2 Not verified in this pass
- "0/50 seals" claim — requires reading `EVAL_REPORT_v0.1.md` and `run00*/` outputs
- Current A2B governance integration status
- Whether identity airlock still blocks all governed attempts

**Recommendation:** Defer A2B claim verification to 333 PLAN pass.

---

## 7. A-FORGE CI Fleet

### 7.1 Workflow files at `/root/A-FORGE/.github/workflows/`
| File | Last modified | Purpose |
|------|---------------|---------|
| `agentic-ci.yml` | Jul 1 21:17 | Dual-lane agentic CI (per A-FORGE AGENTS.md §CI ARCHITECTURE) |
| `sentinel-premerge-gate.yml` | Jun 29 01:12 | Pre-merge governance |
| `08-publish-npm.yml` | Jun 30 13:37 | NPM publish |
| `governance-gate.yml` | Jun 24 23:58 | Governance gate |
| `a-forge-boundary-guard.yml` | Jun 24 23:58 | Boundary contract enforcement |
| `repo-hygiene-weekly.yml` | Jun 24 23:58 | Weekly hygiene |
| `repo-routing-validation.yml` | Jun 24 23:58 | Routing validation |

### 7.2 arifOS workflows (at `/root/.github/workflows/`)
35+ workflow files, mostly dated Apr 19 (consolidated `ci-unified.yml` is largest at 21KB).

### 7.3 Triangulation
- Workflow files are **recent** (Jul 1 last edit)
- "Stale CI" claim cannot be verified without querying GitHub Actions API for last successful run
- **Defer to 333 PLAN**: query `gh api repos/ariffazil/A-FORGE/actions/runs?per_page=5` for actual run status

---

## 8. Routing (per A-FORGE `AGENTS.md` "Compile-Into-Runtime Rule")

```
insight → organ → failure mode → action → telemetry field

verdict_enum_drift → Governance (Ψ) → cross-organ evaluation breakage
  → action: unify to arifOS canonical 4-value (SEAL/SABAR/HOLD/VOID) + typed reason_code
  → telemetry: verdict_enum_version, verdict_reason_code

arif_init_envelope_gap → Cognition (Ψ) → benchmark agent rejection
  → action: ship machine-complete envelope per audit §5 (10 fields added/renamed)
  → telemetry: envelope_schema_version, init_mode, session_mode, authority_scope, tool_registry_version

ephemeral_eval_absence → Reality (Δ) → benchmark blocked at F11_SESSION_GATE
  → action: add session_mode="ephemeral_eval" with OBSERVE_ONLY cap + auto-escalate on mutate
  → telemetry: session_mode, ephemeral_escalation_count

f3_witness_so_floor → Witness (Witness) → silent gap on reversible paths
  → action: wire default witness_summary into arif_judge non-IRREVERSIBLE path
  → telemetry: witness_summary_present, witness_active_count, missing_witnesses

a2b_blocked → Execution (Δ) → 0/50 governed seals
  → action: route through ephemeral_eval mode + identity airlock bypass
  → telemetry: a2b_run_seal_count, a2b_run_hold_count

ci_staleness → Execution (Δ) → unknown — needs run history
  → action: query gh API for run history; classify per-lane
  → telemetry: lane1_status, lane2_status, last_green_at
```

---

## 9. Severity-Ordered Patch Priority

| Priority | Patch | Effort (audit estimate) | Federation blast |
|----------|-------|------------------------|------------------|
| **P0-A** | Verdict enum unification + typed reason_code across 5 organs | M | Federation-wide; affects every arif_judge call, every eval scorer, every dashboard |
| **P0-B** | `arif_init(light)` machine envelope (10 fields) | M | arifOS kernel; benchmark-facing only |
| **P0-C** | `ephemeral_eval` session mode + F11 bypass | M | arifOS kernel + AAA runtime gate + A2B harness |
| **P0-D** | F3 witness default-runtime wiring | M | arifOS arif_judge + AAA deliberation + A-FORGE chain |
| **P1** | Witness integration as default in judgment envelope | M | Same as P0-D |
| **P1** | OTEL trace correlation (run_id/scenario_id/otel_trace_id) | M | A-FORGE telemetry + arifOS kernel |
| **P1** | A2A Agent Card signed from live registry | M | AAA |
| **P1** | Memory tier APIs L0–L5 | M | arifOS + VAULT999 |
| **P2** | Resources surface (read-only list) | M | arifOS MCP |

---

## 10. Next Stage

Per **arifOS Zen Circuit** (`/root/arifOS/AGENTS.md`):
> "For OBSERVE/READ tasks, skip 333–777 but complete 000, 111, 888."

| Stage | Status | Notes |
|-------|--------|-------|
| 000 INIT | ✅ DONE | `arif_init(mode="init", actor_id="FORGE-000Ω")` returned `SEAL-455cad18b3164037`, authority=`OBSERVE_ONLY` |
| 111 SENSE | ✅ DONE | This triangulation pass |
| 333 PLAN | SKIPPED | OBSERVE_ONLY authority |
| 555 CRITIQUE | SKIPPED | OBSERVE_ONLY authority |
| 666 JUDGE | SKIPPED | OBSERVE_ONLY authority |
| 777 FORGE | SKIPPED | OBSERVE_ONLY authority; A-FORGE never self-authorizes constitutional changes |
| 888 LOG | ✅ THIS FILE | Audit trail written |
| 999 SEAL | DEFERRED | Requires authority upgrade; can only seal observation receipts at OBSERVE_ONLY |

---

## 11. Awaiting Arif Signal

Three paths forward:

**(a) Identity verification → authority upgrade → walk full heptalogy per patch**
- Provide `actor_signature` (SHA-256 of session_id + nonce, signed by ARIF_FAZIL principal key) to `arif_init` upgrade flow
- Unlocks EXECUTE_REVERSIBLE / EXECUTE_BOUND authority
- Enables 333 PLAN → 555 CRITIQUE → 666 JUDGE → 777 FORGE → 999 SEAL per P0 patch

**(b) Commission proper 666_JUDGE → 777_FORGE path through arifOS kernel**
- For each of P0-A/B/C/D, draft a separate session
- arifOS issues SEAL verdict per patch
- A-FORGE executes under lease per audit roadmap week-1 / week-2 / week-5

**(c) Defer — file this triangulation only**
- Triangulation receipt is complete and sealed-for-reference
- 888 LOG done
- No further action this session

---

## 12. Audit Trail (F11)

| Event | Time (UTC) | Actor | Tool | Outcome |
|-------|------------|-------|------|---------|
| arif_init(mode="init") | 2026-07-03 15:38:02 | FORGE-000Ω | arif_init | SEAL_OBSERVE_ONLY (actor_verified=false) |
| Session bound | 2026-07-03 15:38:02 | FORGE-000Ω | (state) | session_id=SEAL-455cad18b3164037 |
| 111 SENSE — verdict enum triangulation | 2026-07-03 15:38–15:42 | FORGE-000Ω | grep | 6+ enums across 5 organs confirmed |
| 111 SENSE — init envelope | 2026-07-03 15:38–15:42 | FORGE-000Ω | grep + read test_11_mega_tools_gates.py | 10/13 fields missing |
| 111 SENSE — ephemeral_eval | 2026-07-03 15:38–15:42 | FORGE-000Ω | grep | absent; only opt-out session_mode exists |
| 111 SENSE — F3 witness | 2026-07-03 15:38–15:42 | FORGE-000Ω | grep + read judge.py/vault.py | SOFT floor; IRREVERSIBLE-only enforcement |
| 111 SENSE — A2B | 2026-07-03 15:38–15:42 | FORGE-000Ω | ls + grep | evals/ exists; deeper read deferred |
| 111 SENSE — A-FORGE CI | 2026-07-03 15:38–15:42 | FORGE-000Ω | ls workflows/ | files recent (Jul 1); run history not queried |
| 888 LOG — this file | 2026-07-03 15:43 | FORGE-000Ω | write | triangulation receipt written |

**No mutations made.** All actions read-only. ΔS ≤ 0.

---

*Triangulation Receipt — FORGE 111 SENSE → 888 LOG*
*Session: `SEAL-455cad18b3164037`*
*Authority: `OBSERVE_ONLY` (actor_verified=false)*
*Date: 2026-07-03*
*DITEMPA BUKAN DIBERI — Forged, Not Given.*