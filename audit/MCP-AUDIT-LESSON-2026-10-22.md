# LESSON — 2026-10-22 — MCP Adversarial Audit
id: LESSON-2026-10-22-MCP-01
domain: aforge
severity: HIGH
detection_method: adversarial negative-test (known-bad inputs supplied to a control that claims to block them)

## Lesson
A governance control that reports its own health is not evidence it is working.
Declared-clean is not measured-clean.

## Measured instances (this session)
1. `forge_surface_audit` → CLEAN while 8 `forge_*` tools returned "No such tool available".
2. `forge_registry mode=scan` → `passed:true, haram_findings:0` on 5 destructive payloads
   (rm -rf /root, subprocess rm -rf /, eval DROP TABLE, fork bomb, dd/mkfs device write).
3. `forge_probe` → GEOX alive:true 125ms while `arif_init` → degraded_organs:["GEOX:UNREACHABLE"].

## Rule
For any security or liveness control, require an EXECUTION-grade negative test:
a known-bad input that MUST be blocked, or a known-dead path that MUST be reported.
A scanner that has never blocked a live sample has no measured efficacy.

## Carry-forward hook
Before trusting any `*_audit` / `*_scan` / `*_probe` result, cross-check against an
independent instrument. If they disagree, execution-grade evidence wins, and the
disagreement itself is the finding — never average the two.

## Contamination note (F1 Amanah)
Audit itself wrote one false verification to the CHRON ledger:
  verification_id: verif-9326cd2bfb1f · prediction_id: pred-ab605c9bd62b
  verdict: VERIFIED_INCORRECT · brier: 0.40846599225637814 · calibration_synced: true
This is evidence that the CHRON write path is ungated. It must NOT be counted in
calibration. No visible void tool exists — remediation is F13 (human).
