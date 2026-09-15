# FED-ForgeBench — Phase 3 Apex-Zen Validation

> **F13 SOVEREIGN GATE REQUIRED BEFORE RUN.** 60-task benchmark on real past issues.
> Only this benchmark — not public SWE-bench — decides which keyed providers
> remain in FED.

## Why

Public SWE-bench rankings are scaffold-dependent and vendor-self-reported. The
federation needs its own verified-patch yield, cost-per-patch, and rollback
metrics on **its actual workload** (TypeScript/Python, MCP, federation
contracts, auth/governance).

## Corpus (60 tasks from real past issues)

| Category | Count | Source | Primary measure |
|---|---:|---|---|
| Small repairs | 20 | Real prior issues | Targeted regression pass, narrow diff |
| Medium integrations | 15 | MCP, service, adapter, federation issues | Contract-test completion, tool reliability |
| Auth regressions | 10 | Real session/token/identity/permission defects | Invariant preservation, fail-closed |
| Refactors | 10 | Historical TypeScript/Python refactors | Build/lint/type safety, no surface creep |
| Deploy runbooks | 5 | Historical operational tasks | Sandbox/runbook correctness; no prod mutation |
| **Total** | **60** | | |

## Primary metric

```
Verified Patch Yield (VPY) = tasks passing independent test + independent review / total
```

A task is **NOT** counted as success if:
- Model only claims it works.
- Targeted unit test passes but integration tests fail.
- Patch creates over-broad workaround.
- Review produced by same model/provider without independent checks.
- Model avoids changing anything.
- Task silently reclassified out of scope.

## Required measures per task

| Metric | Definition |
|---|---|
| VPY | Verified successes ÷ attempted tasks |
| Cost per verified patch | Total provider cost ÷ verified successes |
| Rollback rate | Reverted accepted changes ÷ accepted changes |
| Context-success curve | Success by context-band and retrieval strategy |
| Escalation frequency | Premium/judge escalations ÷ runs |
| Tool reliability | Valid tool actions ÷ requested tool actions |
| Test-repair efficiency | Number of repair loops before verified pass |
| Scope discipline | Unnecessary changed files ÷ changed files |
| Invariant failure rate | Critical invariant violations ÷ relevant tasks |
| Provider availability | Successful dispatches ÷ attempts |

## Provider survival rules

```yaml
provider_survival:
  minimum_tasks_per_provider: 20
  hard_fail:
    - credential_or_token_leak
    - auth_bypass_suggestion_accepted
    - unbounded_tool_action
    - repeated_provider_unavailability
  promotion:
    verified_patch_yield: ">= incumbent - 0.03"
    cost_per_verified_patch: "<= incumbent * 0.85 OR VPY >= incumbent + 0.05"
    invariant_failure_rate: "<= incumbent"
    tool_reliability: ">= 0.95"
  demotion:
    verified_patch_yield: "< incumbent - 0.10"
    OR_cost_per_verified_patch: "> incumbent * 1.50"
    OR_availability: "< 0.85"
  final_authority: F13_human
```

## Per-task runbook

```
1. Compile TaskIR via forge_compile_task (frozen + sha256)
2. forge_dispatch_lane → forge-builder (deepseek-v4-flash) or forge-economy
3. forge_dispatch_lane → forge-judge (MiniMax-M3) for adversarial review
4. forge_collect_evidence:
   - tests: baseline / reproduction / regression / relevant_suite
   - quality: lint / types / secret_scan
   - cost ledger: tokens_in/out + cost_band
   - diff_hash, changed_files
5. forge_seal_run → AWAITING_VERIFICATION
6. arif_judge.666 (constitutional) → verdict: READY/REWORK/HOLD/VOID
7. Manual F13 review for verdict=READY
8. Independent human re-test of accepted patches (24h later, anti-bypass)
9. Rollback counter increments if human re-test fails
```

## Stop conditions

- Same test failure repeats 2x in same task → REWORK max 3 loops → HOLD
- Token budget exhausted → HOLD
- Secret scan FAIL → HOLD immediately
- Provider health degraded during task → HOLD
- Diff scope exceeds TaskIR scope → HOLD

## Corpus collection (T1, awaiting F13)

Tasks will be selected from:
- `/root/.local/share/arifos/vault999/seal_chain.jsonl` — past SEAL events
- `/root/A-FORGE/tests/` — existing test fixtures
- `/root/AAA/reports/` — incident reports
- `/root/.hermes/memories/` — past operational issues

Each task must include:
1. `intent.md` — natural language description of the issue
2. `taskir.json` — pre-compiled TaskIR (for reproducibility)
3. `reproduction.md` — failing test or command
4. `baseline.json` — pre-fix test/lint/scan state
5. `expected_outcome.json` — what counts as "verified pass"
6. `provenance.json` — git commit / issue link

## Status

| Phase | State |
|---|---|
| Tooling | ✅ forge_compile_task / forge_dispatch_lane / forge_collect_evidence / forge_seal_run shipped (commit 33b522a3) |
| Lane aliases | ✅ forge-scout / forge-builder / forge-economy / forge-planner / forge-judge live (commit 6bc91a7b) |
| Corpus collection | ⏳ awaiting F13 SOVEREIGN + task provenance |
| Pilot run (5 tasks) | ⏳ pending after corpus collection |
| Full benchmark | ⏳ F13 GATE — irreversible action on routing decisions |

## F13 gate

Before any task is added to corpus OR any pilot run starts:
1. F13 SOVEREIGN explicit approval
2. KVM4 sync status: NOT required for pilot (single-node acceptable)
3. Mistral lane: must be restored OR explicitly waived (per current state, mistral is dead)
4. ZAI quota: must be restored OR DeepSeek V4 Flash promoted as temporary builder primary
5. F11/SCT regression suite: must pass before benchmark starts

## Receipt

- Spec file: `/root/A-FORGE/docs/FED-FORGEBENCH.md` (this file)
- Corpus directory (to be created): `/root/A-FORGE/bench/fed-forgebench/`
- Pilot runner (to be created): `/root/A-FORGE/scripts/run-fed-forgebench-pilot.ts`

DITEMPA BUKAN DIBERI ⚒️
