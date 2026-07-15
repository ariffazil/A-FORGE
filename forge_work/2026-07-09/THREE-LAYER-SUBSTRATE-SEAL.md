# Three Layers, Three Substrates, One Sovereign

**receipt_id:** `three-layer-2026-07-09-b3a11e1`  
**timestamp:** `2026-07-09T12:18:25Z`  
**receipt_sha256:** `b69ae4effd77be2b0543a23c8d35a515f1771604e1617061c7f9327633cc3110`  
**arifOS:** `b3a11e1`

| Layer | Path | Role |
|-------|------|------|
| Python Kernel | `arifOS/arifosmcp/runtime/kernel/` | Judge |
| TS A-FORGE | `A-FORGE/src/executor/` | Hands |
| Quantum | `kernel/contracts/quantum.py` | Calculator contract (not organ solver) |
| Shared types | `packages/npm/.../kernel/types.ts` | TS contracts only |

**Flow:** Python judges → receipt → A-FORGE executes → report → Python seals.  
**Tests:** `tests/kernel/test_formal_kernel_geometry.py` **7/7 PASS**.

**Honest correction:** `organs/quantum.py` with Qiskit dispatch is **not** in-tree. Quantum is governance contract + external organ adapters.
