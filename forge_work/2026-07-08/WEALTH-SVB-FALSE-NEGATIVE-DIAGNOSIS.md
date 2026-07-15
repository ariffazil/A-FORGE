# WEALTH SVB False-Negative Diagnosis

**Date:** 2026-07-08
**Actor:** FORGE-000Ω
**Issue:** #41 (WEALTH)

## Test Results

| Tool | SVB Pre-Collapse Text | Expected | Actual |
|------|----------------------|----------|--------|
| capture_scan | "strong capital, validated by stress tests, confident" | MEDIUM+ | LOW ❌ |
| power_audit | Same text, 6 dimensions | MEDIUM+ | LOW ❌ |
| beautiful_mouse_scan | "zero risk events, flawless execution, record deposits" | EMERGING | ABSENT ❌ |

## Root Cause

Pattern libraries calibrated on **extraction-fraud corpus** (Enron, PDVSA, 1MDB, WorldCom). SVB is **simulative-neutral** — every action individually defensible, aggregate pattern dangerous.

Missing patterns:
- Reassurance language: "strong capital", "validated by", "confident in our ability"
- Zero-failure framing: "zero material risk events", "no significant setbacks"
- Record-metric boasting: "record deposits", "exceptional performance"
- Independence signaling: "independent stress tests" (used as shield)

## Fix Required

1. Add reassurance-language patterns to capture_scan phrase pools
2. Add zero-failure + record-metric patterns to beautiful_mouse_scan
3. Weight "independent validation" as potential capture signal when combined with zero-failure
4. Test against SVB, Lehman, Wirecard pre-collapse corpora

## Classification

- **Severity:** P2 (calibration, not broken)
- **Type:** Research sprint, not engineering fix
- **Blocked by:** Need curated pre-collapse corpus (SVB, Lehman, Wirecard, FTX)
