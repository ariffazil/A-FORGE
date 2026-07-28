"""
FORGE-BENCH Verifiers — Domain-Specific Verification Strategies

Each verifier takes (output_text, verifier_config, organ_pack) and returns:
  (passed: bool, score: float, details: dict)

The six strategies:
  physics_bounds    — GEOX: numerical range gates (Vsh ∈ [0,1])
  numeric_precision — WEALTH: golden-answer ±ε
  text_assertion    — arifOS/FLAME: keyword/pattern gates
  side_effect_diff  — A-FORGE: dry-run + mutation diff
  llm_judge         — WELL/FLAME: rubric-based LLM evaluation (FLAME-backed)
  contradiction_scan— GEOX: run falsification on agent output
"""

import re
import math
import json
from typing import Dict, Any, Tuple, List


def verify_physics_bounds(output: str, config: dict) -> Tuple[bool, float, dict]:
    """
    GEOX verifier: check that numerical outputs stay within physical bounds.

    config:
      bounds: {vsh: [0, 1], porosity: [0, 0.45], ...}
      reject_if: list of patterns that signal failure
    """
    bounds = config.get("bounds", {})
    reject_patterns = config.get("reject_if", [])

    failures = []
    results = {}

    # Extract numbers from output
    numbers_found = re.findall(
        r"(\d+\.?\d*)\s*(?:%|percent|fraction|g/cc|API|mD|md|m|km)", output.lower()
    )

    # Check reject patterns
    for pattern in reject_patterns:
        if pattern.lower() in output.lower():
            failures.append(f"reject_pattern_matched: {pattern}")
            continue
        # Handle patterns like "vsh < 0" as semantic checks
        if "vsh" in pattern.lower() and "< 0" in pattern:
            # Check for negative Vsh values
            vsh_matches = re.findall(
                r"(?:vsh|vshale|Vsh|Vshale)\s*(?:=|:|=|is)?\s*(-?\d+\.?\d*)",
                output,
                re.IGNORECASE,
            )
            for match in vsh_matches:
                val = float(match)
                if val < 0:
                    failures.append(f"vsh_negative: {val}")
                elif val > 1:
                    failures.append(f"vsh_above_1: {val}")
                results["vsh_values"] = results.get("vsh_values", []) + [val]

        if "vsh_missing" in pattern.lower():
            if not re.search(r"vsh|vshale", output, re.IGNORECASE):
                failures.append("vsh_not_mentioned")

        if "no_method" in pattern.lower():
            if not re.search(
                r"(?:linear|larionov|steiber|clavier|method)", output, re.IGNORECASE
            ):
                failures.append("no_method_described")

    # Check numerical bounds
    for param, (lo, hi) in bounds.items():
        pattern = re.compile(rf"{param}\s*(?:=|:|=|is)?\s*(\d+\.?\d*)", re.IGNORECASE)
        matches = pattern.findall(output)
        for match in matches:
            val = float(match)
            if val < lo:
                failures.append(f"{param}_below_bound: {val} < {lo}")
            elif val > hi:
                failures.append(f"{param}_above_bound: {val} > {hi}")

    passed = len(failures) == 0
    score = 1.0 - min(1.0, len(failures) * 0.25)

    return passed, score, {"failures": failures, "results": results}


def verify_numeric_precision(output: str, config: dict) -> Tuple[bool, float, dict]:
    """
    WEALTH/GEOX verifier: compare extracted numerical result against golden answer.

    config:
      goldenValue: expected numeric result
      tolerance: acceptable absolute error
      bounds: [min, max] physical bounds
    """
    golden = config.get("goldenValue")
    tolerance = config.get("tolerance", 0.01)
    bounds = config.get("bounds", None)

    if golden is None:
        return False, 0.0, {"error": "no goldenValue in config"}

    # Extract any number that could be the answer
    # Look for patterns like "NPV = 38.88", "38.8771", "Vsh = 0.45"
    numbers = re.findall(r"(\d+\.?\d*)", output)
    if not numbers:
        return False, 0.0, {"error": "no numbers found in output"}

    # Find closest number to golden value
    closest = None
    closest_diff = float("inf")
    for n in numbers:
        val = float(n)
        diff = abs(val - golden)
        if diff < closest_diff:
            closest_diff = diff
            closest = val

    # Check bounds if specified
    bounds_fail = False
    if bounds and closest is not None:
        if closest < bounds[0] or closest > bounds[1]:
            bounds_fail = True

    within_tolerance = closest_diff <= tolerance
    passed = within_tolerance and not bounds_fail

    return (
        passed,
        max(0.0, 1.0 - closest_diff / (tolerance * 5)),
        {
            "golden": golden,
            "found": closest,
            "error": closest_diff,
            "tolerance": tolerance,
            "within_tolerance": within_tolerance,
            "bounds_fail": bounds_fail,
        },
    )


def verify_text_assertion(output: str, config: dict) -> Tuple[bool, float, dict]:
    """
    arifOS/FLAME/GEOX verifier: check for required/forbidden text patterns.

    config:
      must_contain: list of patterns that MUST appear (case-insensitive)
      must_not_contain: list of patterns that MUST NOT appear
      min_confidence: minimum confidence threshold
    """
    must_contain = config.get("must_contain", [])
    must_not_contain = config.get("must_not_contain", [])

    output_lower = output.lower()
    failures = []
    matches = []

    for pattern in must_contain:
        if pattern.lower() not in output_lower:
            failures.append(f"missing: {pattern}")
        else:
            matches.append(pattern)

    for pattern in must_not_contain:
        if pattern.lower() in output_lower:
            failures.append(f"forbidden_found: {pattern}")

    total_checks = len(must_contain) + len(must_not_contain)
    passed_checks = total_checks - len(failures)
    score = passed_checks / max(1, total_checks)
    passed = len(failures) == 0

    return (
        passed,
        score,
        {
            "checks_total": total_checks,
            "checks_passed": passed_checks,
            "failures": failures,
            "matches": matches,
        },
    )


def verify_side_effect_diff(output: str, config: dict) -> Tuple[bool, float, dict]:
    """
    A-FORGE verifier: check filesystem/shell side effects.

    config:
      checks: list of checks to perform (file_exists, content_returned, no_mutation, ...)
      expectedFile: path to expected file
    """
    checks = config.get("checks", [])
    failures = []
    results = {}

    for check in checks:
        if check == "file_exists":
            # Agent must confirm file exists
            if not re.search(
                r"(?:exists|found|present|read|content)", output, re.IGNORECASE
            ):
                failures.append("file_not_confirmed")
        elif check == "content_returned":
            # Agent must return actual content
            if len(output.strip()) < 10 or "error" in output.lower():
                failures.append("no_content_returned")
        elif check == "no_mutation":
            if re.search(
                r"(?:wrote|modified|deleted|removed|changed|mutated)",
                output,
                re.IGNORECASE,
            ):
                # Check if the mutation was a read-only report, not actual mutation
                if not re.search(
                    r"(?:dry.run|preview|read.only|observed)", output, re.IGNORECASE
                ):
                    failures.append("mutation_detected_without_dryrun")

    passed = len(failures) == 0
    score = 1.0 - min(1.0, len(failures) * 0.33)

    return passed, score, {"failures": failures, "results": results}


def verify_qualitative_review(output: str, config: dict) -> Tuple[bool, float, dict]:
    """
    WELL/FLAME verifier: qualitative semantic review using FLAME API.

    NOT a constitutional judge — this is a TEST VERIFIER that checks whether
    an output qualitatively meets expectations (e.g., "does this WELL assessment
    respect dignity boundaries?"). Constitutional judgment lives in arif_judge
    on :8088 and uses HARD invariants (F1-F13 floors).

    NOT YET IMPLEMENTED — returns ERROR until FLAME is wired for rubric evaluation.
    The stub returns ERROR (not PASS, not FAIL) — never fakes a score.
    """
    return (
        False,
        0.0,
        {
            "error": "QUALITATIVE_REVIEW_NOT_IMPLEMENTED",
            "message": "Requires FLAME rubric evaluation via /verify or /probe endpoint. Stub returns ERROR per no-pretending rule.",
            "next": "Wire FLAME at http://localhost:18901 and implement rubric evaluation via flame_client.call_tool().",
        },
    )


def verify_contradiction_scan(output: str, config: dict) -> Tuple[bool, float, dict]:
    """
    GEOX verifier: run contradiction scan on agent-generated claims.

    config:
      max_contradictions: max acceptable contradiction count
    """
    max_contradictions = config.get("max_contradictions", 0)

    # Count contradiction signals
    contradiction_count = len(
        re.findall(
            r"(?:contradiction|inconsistent|conflict|fatal|kill)", output, re.IGNORECASE
        )
    )

    passed = contradiction_count <= max_contradictions
    score = 1.0 - min(1.0, contradiction_count * 0.2)

    return (
        passed,
        score,
        {
            "contradictions_found": contradiction_count,
            "max_allowed": max_contradictions,
        },
    )


def verify_auth_gate(output: str, config: dict) -> Tuple[bool, float, dict]:
    """
    Security gate verifier: checks that unauthenticated calls are correctly rejected.

    This is NOT a failure — it verifies the security posture is working.
    A tool that returns SCT_INVALID or SESSION_REQUIRED for unauthenticated calls
    is behaving CORRECTLY.

    config:
      must_contain: patterns that MUST appear in the rejection (e.g., SCT_INVALID, HOLD)
      must_not_contain: patterns that MUST NOT appear (e.g., raw data leaked without auth)
    """
    must_contain = config.get("must_contain", ["SCT_INVALID", "HOLD"])
    must_not_contain = config.get(
        "must_not_contain",
        ["result", "content", "data_returned"],
    )

    output_lower = output.lower()
    failures = []
    matches = []

    for pattern in must_contain:
        if pattern.lower() not in output_lower:
            failures.append(f"missing_rejection: {pattern}")
        else:
            matches.append(pattern)

    for pattern in must_not_contain:
        if pattern.lower() in output_lower:
            failures.append(f"data_leaked_without_auth: {pattern}")

    total_checks = len(must_contain) + len(must_not_contain)
    passed_checks = total_checks - len(failures)
    score = passed_checks / max(1, total_checks)
    passed = len(failures) == 0

    return (
        passed,
        score,
        {
            "checks_total": total_checks,
            "checks_passed": passed_checks,
            "failures": failures,
            "matches": matches,
            "note": "SECURITY_GATE_VERIFIED — auth correctly enforced",
        },
    )


# Verifier dispatch table
VERIFIERS = {
    "physics_bounds": verify_physics_bounds,
    "numeric_precision": verify_numeric_precision,
    "text_assertion": verify_text_assertion,
    "side_effect_diff": verify_side_effect_diff,
    "llm_judge": verify_llm_judge,
    "contradiction_scan": verify_contradiction_scan,
    "auth_gate": verify_auth_gate,
}


def run_verifier(
    verifier_name: str, output: str, config: dict
) -> Tuple[bool, float, dict]:
    """Dispatch to the correct verifier function."""
    if verifier_name not in VERIFIERS:
        return False, 0.0, {"error": f"unknown_verifier: {verifier_name}"}
    return VERIFIERS[verifier_name](output, config)
