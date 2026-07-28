# FORGE-BENCH — arifOS Federation Tool Benchmark

> **DITEMPA BUKAN DIBERI** — The bench that proves your tools work, not the one that says they should.
> Forged: 2026-07-28 by OpenCode (333-AGI) under F13 SOVEREIGN directive.
> Methodology: Ignite UI MCP Testbed matrix execution + AutoResearch propose->evaluate->ratchet loop.

## What This Is

A CI-runnable benchmark that tests every MCP tool in the arifOS federation by running real prompts against real endpoints, verifying outputs with domain-specific verifiers, and producing a comparable score grid.

**It answers:** Does tool X actually produce correct output? Does adding skills/memory/context make it better or worse? Which model gives the best results per organ?

## Architecture

```
  MATRIX ENGINE       ISOLATION ENGINE      VERIFICATION ENGINE
  Task x ToolVar   -> /tmp/worktree      -> Per-organ verifier
  x Model              per run               dispatched
        |                    |                    |
        v                    v                    v
  HISTORY GRID         REPORT GENERATOR       CI GATE
                                               exit 0/2/1
```

## Quick Start

```bash
# Mock mode (no live organs needed)
python3 runner.py --ratchet                  # Full matrix + ratchet
python3 runner.py --organ geox              # Single organ

# Live mode (requires af-forge localhost)
python3 runner.py --organ arifos --live      # arifOS: no auth needed
python3 runner.py --organ flame --live       # FLAME: no auth needed
python3 runner.py --live --session-token "sct_v1..."  # With SCT

# CI mode
python3 runner.py --ci                      # exit 0/2/1
python3 runner.py --validate                # config validation only
```

## Live Organs — Auth Architecture

The federation has a two-layer session model discovered via live probes on 2026-07-28:

```
Layer 1: MCP Transport          Layer 2: Constitutional
---------                       ---------
initialize -> mcp-session-id    arif_init -> SCT token
notifications/initialized       Required for: GEOX, WEALTH, A-FORGE, WELL
Required for: GEOX,WEALTH,      Not required: arifOS (returns "pending"),
  A-FORGE, WELL                            FLAME (no auth)
```

| Organ | MCP Session | SCT Required | Live Status |
|-------|------------|-------------|-------------|
| **arifOS :8088** | No | No | 3/3 PASS |
| **FLAME :18901** | No (HTTP API) | No | 3/3 PASS |
| **GEOX :8081** | Yes | Yes | Auth-gated |
| **WEALTH :18082** | Yes | Yes | Auth-gated |
| **A-FORGE :7071** | Yes | Yes | Auth-gated |
| **WELL :18083** | Yes | Yes | Auth-gated |

**Auth-gated organs** return `SESSION_MISSING`/`SCT_INVALID` without proper authentication. This is correct constitutional behavior. The bench reports these honestly — ERROR, never PASS. To test them live, pass `--session-token` with a valid SCT from `arif_init`.

## Organ Packs

Each organ gets a JSON pack declaring:
- What tools it exposes
- What scenarios exercise them
- How to verify outputs
- What transport/auth is needed (`transport`, `requiresMcpSession`, `requiresAuth`)

Packs live in `organ_packs/`. 6 organs: `arifos`, `flame`, `geox`, `wealth`, `aforge`, `well`. Add a new tool = add a scenario to the pack. No engine changes.

## Verification Strategies

| Strategy | For | How it works |
|----------|-----|-------------|
| `physics_bounds` | GEOX petrophysics, geomechanics | Numerical range gates (Vsh in [0,1], phi in [0,0.45]) |
| `numeric_precision` | WEALTH NPV/IRR/EMV | Compare against analytical golden answer +/- epsilon |
| `text_assertion` | arifOS verdicts, FLAME fact-check, GEOX falsify | Keyword/pattern gates (must_contain/must_not_contain) |
| `side_effect_diff` | A-FORGE fs/shell/git | Before/after state comparison, dry-run verification |
| `qualitative_review` | WELL assessments, FLAME quality | Semantic review via FLAME API (WIP — not yet implemented) |
| `contradiction_scan` | GEOX multi-claim | Run contradiction scan on agent output |

**Naming note:** `qualitative_review` is NOT a constitutional judge. Constitutional judgment lives in `arif_judge` on :8088 and uses HARD invariants (F1-F13 floors). `qualitative_review` is a test utility for qualitative output assessment — it reviews, it does not judge.

## CI Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All cells passed every verifier |
| 2 | All cells ran but >=1 verifier failed |
| 1 | Catastrophic (tool unavailable, runner crashed) |

## Mock Fidelity

Mock responses match real organ response shapes where live verification was possible:
- **arifOS**: Verified — returns "pending" verdict for anonymous calls (matching live kernel)
- **FLAME**: Verified — returns FLAME API response shapes (matching live /health, /verify, /probe)
- **GEOX/WEALTH/A-FORGE/WELL**: Idealized — MCP response shape is correct, content is reasonable but unverified pending SCT auth resolution

## Files

```
forge-bench/
  README.md           <- this file
  runner.py           <- matrix engine + ratchet + CI
  verifiers.py        <- domain-specific verification functions (6 strategies)
  mcp_client.py       <- HttpClient (MCP), FlameClient (FLAME), MockClient
  bench.json          <- default matrix config
  organ_packs/        <- one JSON pack per organ (6 organs)
  reports/            <- generated reports land here
```

## Extending

1. Add a scenario to the organ pack JSON
2. If using a new verifier type, add the function to `verifiers.py`
3. If the tool is new, add mock response to `MockClient` in `mcp_client.py`
4. Run `python3 runner.py --validate`
5. Run `python3 runner.py --organ <organ>` to test
