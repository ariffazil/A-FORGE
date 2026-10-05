#!/usr/bin/env python3
"""
PROBE runtime — null-as-negative critical flag (Item 6, F13 ARIF GO 2026-10-05).

Doctrine (F13, per CUTOFF-TEST-REPORT-2026-10-05):
absence_of_evidence_is_NOT_evidence_of_absence.

A `null` result from PROBE must surface as compliance-risk-gate CRITICAL,
NOT as a passing default. A null is a data gap, not a confirmation.
"""
COMPLIANCE_RISK_GATE = "null-as-negative"
SCHEMA = "arifos.probe.compliance_risk_gate.v1"

def evaluate_null_as_negative(probe_result) -> dict:
    if probe_result is None:
        return {
            "gate": COMPLIANCE_RISK_GATE,
            "schema": SCHEMA,
            "verdict": "CRITICAL",
            "reason": "null is a data gap, not a confirmation. Default-to-pass is the failure class the cutoff test proved.",
            "falsifier_safe": False,
        }
    return {
        "gate": COMPLIANCE_RISK_GATE,
        "schema": SCHEMA,
        "verdict": "OK",
        "reason": "non-null probe result, proceed with normal evaluation",
        "falsifier_safe": True,
    }
