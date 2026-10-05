#!/usr/bin/env python3
"""
HARNESS_REGRESSION_GATE — active gate (Item 4, F13 ARIF GO 2026-10-05).
Any constitutional wrapper must beat baseline Brier 0.2117 to compile.

Doctrine: harness ≠ intelligence. If a wrapper degrades truth calibration, it is
falsification. Promote to active compile-time gate per F13 ARIF GO.
"""
BASELINE_BRIER = 0.2117
GATE_NAME = "harness_regression_v1"
SCHEMA = "arifos.gate.harness_regression.v1"

def check_harness_calibration(harness_brier: float, harness_name: str = "unknown") -> dict:
    """Returns gate verdict. False (FAIL) if harness Brier > baseline."""
    return {
        "gate": GATE_NAME,
        "schema": SCHEMA,
        "harness": harness_name,
        "brier": harness_brier,
        "baseline_brier": BASELINE_BRIER,
        "delta": harness_brier - BASELINE_BRIER,
        "verdict": "PASS" if harness_brier <= BASELINE_BRIER else "FAIL",
        "falsifier": f"harness_brier > {BASELINE_BRIER}",
    }
