# Task: <short-slug>

## TaskIR (frozen via forge_compile_task)
```json
{
  "task_id": "forge-20260915-<slug>",
  "intent": "<one sentence>",
  "risk_class": "patch|service|deploy|secret-adjacent|auth",
  "acceptance_criteria": ["..."],
  "non_goals": ["..."],
  "invariants": ["..."],
  "prohibited_actions": ["..."],
  "verification": {
    "baseline_commands": ["..."],
    "reproduce_commands": ["..."],
    "quality_commands": ["..."],
    "exit_criteria": ["..."]
  },
  "budget": { "max_total_usd": 0.75, "max_premium_calls": 2, "max_repair_loops": 3 }
}
```

## Reproduction
<command that fails before fix, passes after>

## Expected outcome
- targeted regression test PASS
- relevant_suite PASS
- secret_scan PASS
- diff scope <= 3 files changed
- no auth/governance regressions

## Provenance
- git commit (pre-fix): <sha>
- issue link / report: <url>
- collected by: <who>
- F13 approved: <yes/no>

## Status
- [ ] compiled
- [ ] dispatched
- [ ] builder patched
- [ ] evidence collected
- [ ] judge verdict: READY / REWORK / HOLD
- [ ] F13 review
- [ ] 24h human re-test
- [ ] verified / rolled back
