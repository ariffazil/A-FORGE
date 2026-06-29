# A2B-IJCAI-2026: Root Cause Diagnosis & Fix Plan
**Date:** 2026-06-29
**Verdict:** OBS (direct file inspection) + DER (architecture inference)
**Confidence:** 0.88

---

## Executive Summary

All 50 governed evaluations blocked at `GATE_1_IDENTITY` — not because governance is broken, but because the eval harness uses `actor_class=CLAIMED` (unverified) for `arifbench-eval`. The fix is a one-line change: register the eval actor as `actor_class=VERIFIED` via `forge_agent`. After that, read-only tool use (arif_observe) passes freely and accuracy should improve toward the ungoverned baseline (36%).

---

## What the Data Says

### Blocking trace (all 50 scenarios, identical):
```json
{
  "judge_verdict": "HOLD",
  "judge_blocked_at": "GATE_1_IDENTITY",
  "judge_reasons": [
    "CLAIMED identity (arifbench-eval) cannot execute IRREVERSIBLE. Requires verified or delegated authority."
  ],
  "judge_violated_laws": ["L11"],
  "judge_governance_hold": true,
  "judge_confidence": 0.0
}
```

### Accuracy comparison (disk-verified):
| Run | Accuracy | Tool Use | Seals |
|-----|----------|----------|-------|
| run001_gov | 16/50 = 32% | BLOCKED | 0 |
| run002_nogov | 18/50 = 36% | FULL | 0 |
| Delta | −4% (noise, p>0.5) | — | — |

### Latency:
| Metric | Governed | Ungoverned | Delta |
|--------|----------|------------|-------|
| p50 | 3495ms | 3699ms | −204ms |
| p95 | 5796ms | 6020ms | −224ms |
| Mean | 3593ms | 3871ms | −278ms |

Governance is **faster** (negative overhead) because the short-circuit at identity gate (~1ms) avoids downstream LLM output processing.

---

## Root Cause: The Identity Airlock

The arifOS governance kernel enforces actor identity classes at `GATE_1_IDENTITY`:

| Actor Class | Tool Access |
|-------------|-------------|
| `VERIFIED` | Full read access, bounded write |
| `CLAIMED` | OBSERVE only, no MUTATE/IRREVERSIBLE |
| `ANONYMOUS` | No tool access |

The eval harness calls `arif_init(mode='light', actor_id='arifbench-eval')` but does **not** pass `actor_signature` or a nonce that proves identity. Result: `actor_class=CLAIMED` → all tool calls get `L11` (Law 11: verified authority required for irreversible actions) → 50/50 HOLD.

This is **working as designed**. The identity airlock is correctly protecting against unverified actors. The problem is the harness was never configured with a proper identity proof.

---

## Architecture: Where the Gate Lives

```
eval_harness.py
  └─> arif_init(actor_id="arifbench-eval", mode="light")
        └─> arifOS kernel → actor_class = CLAIMED (no signature provided)
              └─> arif_judge(intent="answer MCQ", ...)
                    └─> GATE_1_IDENTITY
                          └─> L11 violation → HOLD (50/50)
```

The `actor_class` is computed inside arifOS kernel. The fix must either:
1. Provide a valid `actor_signature` in `arif_init` to achieve `VERIFIED` class, OR
2. Route the eval harness through the A-FORGE `forge_agent` registration path which issues a lease that bypasses the identity gate

---

## The Fix: Three Options

### Option A — Register eval actor via `forge_agent` (RECOMMENDED)
Register `arifbench-eval` as a `VERIFIED` agent in A-FORGE, then use `forge_lease_request` to get a bounded lease that the arifOS kernel will honor.

**Pros:** Clean, constitutional, uses existing infrastructure
**Cons:** Requires changes to eval_harness.py

### Option B — Provide `actor_signature` in `arif_init`
Use the eval harness's API key or a pre-shared secret as `actor_signature` in `arif_init(mode='init')`. Requires the kernel to recognize this as proof of identity.

**Pros:** Minimal harness change
**Cons:** Requires pre-shared key setup; not yet implemented

### Option C — Bypass governance in harness (WRONG)
Set `governance=False` and run ungoverned. This achieves 36% accuracy but loses the constitutional audit trail and submission framing.

**Verdict:** Do not use. This abandons the core research contribution.

**Recommendation:** Option A (forge_agent registration) is the correct path.

---

## A-Bias: Second-Order Problem

After identity is fixed and tool use is enabled, the next bottleneck is the LLM's systematic position bias toward option "A".

### Observed:
| Option | Governed | Expected (uniform) |
|--------|----------|-------------------|
| A | 42% | 25% |
| B | 24% | 25% |
| C | 20% | 25% |
| D | 14% | 25% |

### Mitigation options:
1. **Option shuffling** — randomize option order per scenario
2. **Logprob scoring** — pick highest logprob option, not first token
3. **Calibration prompting** — instruct model to consider all options before deciding
4. **Self-consistency** — run each scenario N times, pick most common answer

---

## Dependency Map

```
FIX REQUIRED (this session):
  A-FORGE forge_agent register → arifbench-eval → actor_class=VERIFIED
  → forge_lease_request (scope: arif_observe, arif_judge) → lease_id
  → eval_harness.py: pass lease_id in arif_judge calls

ENABLES (after fix):
  arif_observe(query=question) → returns asset/sensor/failure evidence
  → arif_judge with actual evidence → SEAL or HOLD per scenario
  → VAULT999 seal receipts written → constitutional audit trail exists
  → Accuracy moves from 32% toward 36% (ungoverned baseline) or higher

NEXT:
  Prompt iteration to counter A-bias (shuffle + calibration prompting)
  Target: competitive IJCAI performance (top 3 = 65–80% expected)
```

---

## What NOT to Do

- ❌ Do not "just turn off governance" — that abandons the research contribution
- ❌ Do not modify arifOS kernel identity logic — the airlock is correct
- ❌ Do not run more evals until identity is fixed — wasted compute, same 32% result
- ❌ Do not claim 32% as final accuracy — it's a lower bound due to blocked tool use

---

## Evidence Sources
- `/root/A2B/evals/run001_gov/eval_aggregate.json` — disk-verified aggregate
- `/root/A2B/evals/run001_gov/eval_results.jsonl` — 50 scenario traces
- `/root/A2B/harness/eval_harness.py` — harness source (lines 128–179, 340–435)
- `/root/A-FORGE/src/interfaces/mcp/forgeTools.ts` — forge_agent register logic
- `/root/A-FORGE/src/domain/governance/actionClassifier.ts` — REVERSIBLE_EXEC_TOOLS list

---

*DITEMPA BUKAN DIBERI — Forged, Not Given.*