# ISSUE → CONTROL → TEST MAP (grant-contract workstream · 2026-11-01)

Authorization: ARIF AUTHORIZATION BOUNDARY (user turn 2026-11-01). Author 333-AGI,
C2/B2 initial work + evidence by hermes (same F13 ORDER 2026-11-01). No deploy,
no restart, no VAULT999 seal, no self-merge.

## 1. The three authorized patches

| Patch | Control (code) | Test (acceptance) | State |
|---|---|---|---|
| B2 parameter commitment | forge.ts dispatch gate: paramsHash(stableStringify(params)) must equal receipt.inputHash per dispatched action; validateReceipt hard-fails on missing inputHash; refusal before dispatch, receipt not consumed | grantContract B2 (param-level substitution DENIED, 0 invocations, 0 mutations, refusal names inputHash) | GREEN (18/18 era) |
| C2 single-use receipt | receiptLedger.ts claim-before-dispatch (claimReceipt → REPLAY_REJECTED), markOutcome terminal states, process-local boundary declared | grantContract C2–C6 (one mutation from two submissions; concurrent: one claim; validation refusal does not consume; claimed-not-dispatched stays distinguishable; timeout = UNKNOWN_OUTCOME consumed) | GREEN |
| Verification-failure completion semantics | forge.ts P1→completion axis: per-action verification PASS/FAIL/UNSPECIFIED from expected_output; summary.verdict = VERIFICATION_FAILED when any supplied expectation fails ("done" not issuable); summary.verification counts; trace success = commands ok AND verified | grantContract F1 (mismatch → VERIFICATION_FAILED, command ran, outcome SUCCESS) · F2 (match → SUCCESS, positive control) · F3 (no expectation → legacy semantics, UNSPECIFIED) | GREEN (this branch) |

Result: grantContract 21/21 · npm test 402/402 (0 fail; post-patch run 2026-11-01T05:5x +08).

## 2. Contract suite map (grantContract.test.ts, 21 tests)

| Section | Guarantee | Mechanism |
|---|---|---|
| A (A1,A1+,A2) | expired grant refused | ACT expiry + receipt lease expiry, pre-dispatch |
| B (B1,B1b,B2) | substitution refused | allowedActions gate; toolName bound; inputHash parameter commitment |
| C (C1–C6) | timeout ≠ duplicate mutation | UNKNOWN_OUTCOME, single-use claim, concurrency-safe |
| D | possession ≠ identity | ACT actor binding |
| E (E1–E4) | grants never widen | lease scope resolution + maxTools cap |
| F (F1–F3) | command success ≠ outcome | verification axis gates the completion claim |

## 3. Cross-reference to the 2026-11-01 state-audit register

- A2 (envelope forces HOLD) — NOT addressed here (transport lane; separate P0).
- C1 (receipt verifier / normaliser / anchor) — C2 ledger is the executor-side
  substrate; anchor + normalisers remain the named open item.
- C2 audit (legacy history unrepairable) — untouched by design.
- Strategy-bullet "'done' tidak boleh dikeluarkan apabila verification gagal" →
  closed by the F-section control above.
- Strategy-bullet "tool timeout tidak boleh menggandakan mutation" → C-section.
- Strategy-bullet "audit log tidak boleh menyamakan command success dengan outcome"
  → F-section axis + outcome_class separation (2026-09-25).

## 4. Honest limits (retained, not hidden)

- inputHash producer in the KERNEL grant path is still absent (kernel mirror has
  no inputHash field; ATLAS333 §6 seal contract carries no params). Enforcement
  is fail-closed: validateReceipt hard-fails without inputHash, so a real grant
  flow must mint sha256(stableStringify(params)) at grant time — named next step.
- forgeShell builds sealEnvelope.inputHash but never compares it (DERIVED
  equivalent defect) — named next step.
- Ledger is process-local: cross-restart/multi-worker replay NOT protected.
- MCP live-path reachability of forgeExecute UNPROVEN (0 external callers).

## 5. Deployment authorization objects (returned to Arif per boundary)

- PR: (branch feat/grant-contract-b2c2-vf-20261101 → main)
- Evidence: .contract-evidence/{PATCH-B2C2-20261101.md, FINAL-RUN-grantContract.txt,
  grant-contract-run-20261101.txt, npm-test-postpatch-20261101.txt, THIS FILE}
- Canon-mutate receipts: /var/lib/arifos/canon_mutations.jsonl (hermes trc-hermes-c2*;
  333-AGI vf-patch cycles, lock=true)
- Test receipts: grantContract 21/21 · npm 402/402 (2026-11-01)
- Deployment: NOT PERFORMED. Awaiting Arif.
