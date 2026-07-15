# Quantum Substrate Kernel Wiring

> **DITEMPA BUKAN DIBERI**

## Status: reference sketches superseded by canonical tree

These files are forge-work reference sketches. The canonical implementation lives in:

- `/root/arifOS/arifosmcp/runtime/kernel/` — Python constitutional judgment engine
- `/root/A-FORGE/src/executor/` — TypeScript A-FORGE executor
- `/root/arifOS/arifosmcp/packages/npm/arifos-mcp/src/kernel/types.ts` — shared contract surface

## Authority boundary

| Layer | Substrate | Role | Never does |
|---|---|---|---|
| **Kernel** | Python | Constitutional judgment engine, 000–999, ΔΩΨ, verdicts, receipts | Execute host actions |
| **A-FORGE** | TypeScript | Executor, tools, MCP, browser, filesystem, deploy | Judge or seal |
| **Quantum** | Python/C++/cloud | Compute organ for GEOX/WEALTH optimization | Decide, execute, bypass 888/999 |
| **Agents** | LLM/planners | Draft plans, prepare evidence | Execute directly |
| **VAULT999** | Ledger | Immutable lineage | — |
| **Arif / F13** | Human | Sovereign veto | — |

The Python kernel is the constitutional judgment engine, not the sovereign judge. Final veto remains Arif / F13.

## Files

| File | Role |
|---|---|
| `arifos_kernel.py` | **Python constitutional judgment engine** — 000–999 state machine, ΔΩΨ, verdict geometry, ExecutorReceipt, organ client |
| `quantum_organ.py` | **Python quantum compute organ** — statevector simulation, backend labeling, HTTP `/compute` |
| `quantum-substrate-kernel.ts` | **A-FORGE executor-side schemas** — TS types for receipts/evidence + `validateExecutorReceipt` hard-fail |
| `QUANTUM-SUBSTRATE-KERNEL-WIRING.md` | This note |

## Phase alignment (live federation)

```
000 INIT          → arif_init / init_intent
111 OBSERVE       → ingestEvidence (organs feed here)
333 THINK         → reason / plan
444 ROUTE         → pick next organ
555 CRITIQUE/HEART → floor check before provisional act
777 FORGE         → prepareAction (provisional, reversible-first)
888 JUDGE         → judge() — verdict born here only
900 COOL          → cooling ledger / drift detection
999 SEAL          → vault lineage — only SEAL/SABAR may enter
```

## Governing operator

Quantum has its unitary:

```
|ψ'⟩ = U |ψ⟩
```

arifOS has its governance operator:

```
G: (m, E, R) → (m', E', R', V)
```

where `m` = phase, `E` = evidence, `R` = risk, `V` = verdict.

U evolves amplitudes. G evolves authority. They never swap jobs.

## Corrected canonical flow

```
1. Arif / AAA submits intent
2. Python kernel creates GovernanceState
3. Organs compute evidence (GEOX, WEALTH, WELL, Quantum)
4. Python kernel runs 000 → 111 → 333 → 555 → 777 → 888
5. judge.py applies tripwires:
      AUTHORITY → UNCERTAINTY → INTEGRITY → ENTROPY → REVERSIBILITY → FLOOR
6. CollapseResult: SEAL-path / HOLD / VOID / SABAR
7. If executable: ExecutorReceipt issued
8. TypeScript A-FORGE validates receipt (hard-fail if any mandatory field missing)
9. A-FORGE executes bounded action
10. A-FORGE returns ExecutionReport
11. Python kernel verifies result
12. seal.py appends SealRecord into SealChain
13. Arif / F13 veto remains supreme
```

## ExecutorReceipt hard-fail fields

A-FORGE refuses execution unless the receipt contains all of:

- `receiptId`
- `kernelSignature`
- `verdict` (must be SEAL or SABAR)
- `authorityScope`
- `allowedAction`
- `toolName`
- `blastRadius`
- `reversibility`
- `inputHash`
- `leaseExpiry` (must not be expired)

## Quantum backend labeling

Every quantum evidence item carries:

- `backend`: qiskit | cirq | braket | simulator | mock
- `backend_class`: physical | simulator | mock
- `evidence_rank`: OBSERVED | SIMULATED | SPECULATED

A simulator output must never be treated as physical quantum evidence.

## Promote / HOLD / Fix

| Item | Verdict | Reason |
|---|---|---|
| Python kernel as judgment engine | **PROMOTE** | Correct authority boundary |
| TS A-FORGE as hands | **PROMOTE** | Correct execution separation |
| Quantum as organ | **PROMOTE** | Correct containment |
| TS shared types only | **PROMOTE** | Prevents duplicated judgment logic |
| "All tests pass = SEAL" | **HOLD** | Tests are not constitutional seal |
| Simulated quantum fallback | **HOLD unless labeled** | Must not equal physical evidence |
| Current repo verification | **HOLD** | Public paths not confirmed from here |
| `arif_triage` guessed schema | **VOID** | Schema must be inspected first |

## ZEN applied

1. **Kernel = Python constitutional judgment engine.** Governance logic is stable, serializable, numerical, auditable.
2. **A-FORGE = TS hands.** Async execution, MCP, browser, filesystem, deployment.
3. **Expose, don't govern.** `quantum_organ.py` returns evidence. Verdicts live in `arifos_kernel.py`.
4. **Schema = contract.** `EvidenceItem` and `ExecutorReceipt` are the shapes crossing boundaries.
5. **Dumb pipes, smart kernel.** The quantum server is ~180 lines of linear algebra + HTTP.
6. **No new deps.** The organ uses stdlib only. The kernel uses stdlib only.
7. **No hardware quantum cosplay.** Statevector simulation is explicitly labeled `SIMULATED`.

## Run the quantum organ

Terminal 1 — start the organ (pick a free port; 18100 avoids the vault999-api on 8100):

```bash
cd /root/A-FORGE/forge_work/2026-07-09
/root/A-FORGE/.venv-apa/bin/python quantum_organ.py 18100
```

Terminal 2 — probe it:

```bash
curl -s http://127.0.0.1:18100/health

curl -s -X POST http://127.0.0.1:18100/compute \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "bell-test",
    "lineageId": "bell-demo",
    "n_qubits": 2,
    "backend": "simulator",
    "ops": [
      {"type": "single", "gate": "H", "target": 0},
      {"type": "cnot", "control": 0, "target": 1}
    ]
  }' | python3 -m json.tool
```

Expected: probabilities `[0.5, 0, 0, 0.5]` for the Bell state, with `backend_class: simulator` and `evidence_rank: SIMULATED`.

## Run the Python kernel against the quantum organ

```bash
cd /root/A-FORGE/forge_work/2026-07-09
# Default quantum organ URL is http://127.0.0.1:18100
/root/A-FORGE/.venv-apa/bin/python arifos_kernel.py

# Or point it at a different port:
QUANTUM_ORGAN_URL=http://127.0.0.1:28317 /root/A-FORGE/.venv-apa/bin/python arifos_kernel.py
```

This executes the example `__main__` block: init → observe quantum evidence → observe HUMAN floor attestation → think → route → critique → prepare reversible action → judge with authority present → issue ExecutorReceipt.

## Substrate integration rule

No organ — quantum, LLM, classical, GEOX — may:

- set verdict
- change phase beyond its allowed band
- bypass 888 JUDGE or 999 SEAL

Quantum is a powerful calculator. The Python kernel decides when its output may become action. A-FORGE carries that action out. Arif / F13 holds final veto.
