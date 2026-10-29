# TOMBSTONE — apa/core/act_executor.py

**Status:** TOMBSTONED 2026-10-23 (F13 order "tombstone ACT executor yang test-only").
**Production path:** `src/interfaces/mcp/core.ts` (lease gate) + `src/interfaces/mcp/apaCustody.ts` (kill switch, denial ledger, idempotency, read-back).
**Tests:** `A-FORGE/tests/constitutional/test_must_fail_probes.py` and `A-FORGE/tests/adversarial/test_attack_vectors.py` may still import the class as a reference model. That does not make it live.
**Guard:** setting `A_FORGE_PRODUCTION=1` makes `ACTExecutor(...)` raise. It must never be wired into a production caller.
**Why keep it:** the adversarial tests encode the intended 7-phase semantics. Deleting the file would delete the test oracle. Tombstone preserves the oracle while denying production authority.
