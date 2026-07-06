"""
Emergence Simulation: Baseline vs Governed APEX Loop
=====================================================
Simulates 20 scenarios (10 good, 10 bad) through both BASELINE and GOVERNED modes.
Measures: failure detection, false LURUS, repair success, recurrence, hallucination, overreach.

DITEMPA BUKAN DIBERI — Emergence is measured, not declared.
"""

import math
import json
import random
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any

# ─── Constants ───
G_THRESHOLD = 0.80
C_DARK_THRESHOLD = 0.30
W3_MIN = 0.0  # any zero collapses W³

random.seed(42)  # reproducibility


# ─── Enums ───
class Verdict(Enum):
    LURUS = "LURUS"
    SESAT = "SESAT"
    VOID = "VOID"
    HOLD = "HOLD"


class ScenarioQuality(Enum):
    GOOD = "good"
    BAD = "bad"


class JalanType(Enum):
    TOOL_FAIL = "tool_fail"
    TRUTH_BREACH = "truth_breach"
    AUTHORITY_OVERREACH = "authority_overreach"
    HALLUCINATION = "hallucination"
    WITNESS_ABSENT = "witness_absent"
    SCOPE_CREEP = "scope_creep"
    DEGRADED_SYSTEM = "degraded_system"
    INJECTION = "injection"
    ENTROPY_SPIKE = "entropy_spike"
    IDENTITY_DRIFT = "identity_drift"


# ─── Data Classes ───
@dataclass
class Scenario:
    id: int
    quality: ScenarioQuality
    jalan: JalanType
    description: str
    # Raw values (what the LLM/tool actually produces)
    A: float  # Adaptation
    P: float  # Precision
    E: float  # Evidence
    X: float  # Execution
    PHI: float  # Faithfulness/Witness
    C_dark_raw: float  # raw hallucination score
    witness_H: float  # Human witness
    witness_AI: float  # AI witness
    witness_Ext: float  # External witness
    is_self_seal_attempt: bool = False


@dataclass
class GovernedResult:
    scenario_id: int
    quality: ScenarioQuality
    jalan: JalanType
    verdict: Verdict
    g_score: float
    c_dark: float
    w3: float
    sesat_detected: bool
    parut_recorded: bool
    tebus_required: bool
    tebus_achieved: bool
    final_lurus: bool
    hallucinated_success: bool  # baseline passed but governed caught
    authority_overreach: bool


@dataclass
class BaselineResult:
    scenario_id: int
    quality: ScenarioQuality
    jalan: JalanType
    raw_passed: bool  # did baseline consider it "ok"
    hallucinated_success: bool  # bad scenario passed as LURUS
    authority_overreach: bool  # self-SEAL attempt went unchecked


@dataclass
class ParutMemory:
    """Scar memory — tracks repeated failures by JALAN type."""

    jalan_counts: dict[str, int] = field(default_factory=dict)
    jalan_last_verdict: dict[str, Verdict] = field(default_factory=dict)

    def record(self, jalan: JalanType, verdict: Verdict):
        key = jalan.value
        self.jalan_counts[key] = self.jalan_counts.get(key, 0) + 1
        self.jalan_last_verdict[key] = verdict

    def was_parut(self, jalan: JalanType) -> bool:
        """Has this JALAN type failed before? (count >= 1 = seen at least once)"""
        return self.jalan_counts.get(jalan.value, 0) >= 1

    def recurrence_count(self, jalan: JalanType) -> int:
        return self.jalan_counts.get(jalan.value, 0)


# ─── Scenarios ───
def build_scenarios() -> list[Scenario]:
    """Build 20 scenarios: 10 good, 10 bad with diverse JALAN types."""
    scenarios = []

    # 10 GOOD scenarios — high G, low C_dark, witnesses present
    good_params = [
        (
            0.92,
            0.95,
            0.90,
            0.88,
            0.85,
            0.05,
            0.85,
            0.80,
            0.75,
            False,
            JalanType.TOOL_FAIL,
        ),
        (
            0.88,
            0.90,
            0.85,
            0.92,
            0.80,
            0.08,
            0.90,
            0.75,
            0.80,
            False,
            JalanType.TRUTH_BREACH,
        ),
        (
            0.95,
            0.88,
            0.92,
            0.90,
            0.88,
            0.03,
            0.80,
            0.85,
            0.70,
            False,
            JalanType.TOOL_FAIL,
        ),
        (
            0.85,
            0.92,
            0.88,
            0.85,
            0.82,
            0.10,
            0.75,
            0.90,
            0.85,
            False,
            JalanType.SCOPE_CREEP,
        ),
        (
            0.90,
            0.85,
            0.95,
            0.80,
            0.90,
            0.06,
            0.88,
            0.82,
            0.78,
            False,
            JalanType.TOOL_FAIL,
        ),
        (
            0.87,
            0.93,
            0.86,
            0.91,
            0.84,
            0.07,
            0.82,
            0.88,
            0.72,
            False,
            JalanType.ENTROPY_SPIKE,
        ),
        (
            0.91,
            0.89,
            0.93,
            0.87,
            0.86,
            0.04,
            0.86,
            0.80,
            0.82,
            False,
            JalanType.TOOL_FAIL,
        ),
        (
            0.86,
            0.91,
            0.87,
            0.93,
            0.81,
            0.09,
            0.80,
            0.84,
            0.76,
            False,
            JalanType.IDENTITY_DRIFT,
        ),
        (
            0.93,
            0.87,
            0.91,
            0.86,
            0.89,
            0.05,
            0.92,
            0.78,
            0.80,
            False,
            JalanType.TOOL_FAIL,
        ),
        (
            0.89,
            0.94,
            0.88,
            0.89,
            0.83,
            0.06,
            0.84,
            0.86,
            0.74,
            False,
            JalanType.TRUTH_BREACH,
        ),
    ]

    for i, (a, p, e, x, phi, cd, h, ai, ext, seal, jalan) in enumerate(good_params):
        scenarios.append(
            Scenario(
                id=i,
                quality=ScenarioQuality.GOOD,
                jalan=jalan,
                description=f"Good scenario {i}: {jalan.value} (well-handled)",
                A=a,
                P=p,
                E=e,
                X=x,
                PHI=phi,
                C_dark_raw=cd,
                witness_H=h,
                witness_AI=ai,
                witness_Ext=ext,
                is_self_seal_attempt=seal,
            )
        )

    # 10 BAD scenarios — various failure modes
    bad_params = [
        # 1. Tool failure with low precision
        (
            0.40,
            0.30,
            0.50,
            0.35,
            0.20,
            0.15,
            0.70,
            0.60,
            0.50,
            False,
            JalanType.TOOL_FAIL,
        ),
        # 2. Truth breach — high G but fabricated evidence
        (
            0.85,
            0.90,
            0.20,
            0.88,
            0.80,
            0.55,
            0.80,
            0.75,
            0.70,
            False,
            JalanType.TRUTH_BREACH,
        ),
        # 3. Authority overreach — self-SEAL attempt
        (
            0.70,
            0.65,
            0.60,
            0.72,
            0.50,
            0.25,
            0.0,
            0.80,
            0.70,
            True,
            JalanType.AUTHORITY_OVERREACH,
        ),
        # 4. Hallucination — high C_dark
        (
            0.80,
            0.75,
            0.70,
            0.78,
            0.65,
            0.85,
            0.70,
            0.65,
            0.60,
            False,
            JalanType.HALLUCINATION,
        ),
        # 5. Witness absent — H=0 collapses W³
        (
            0.88,
            0.85,
            0.82,
            0.80,
            0.75,
            0.10,
            0.0,
            0.80,
            0.70,
            False,
            JalanType.WITNESS_ABSENT,
        ),
        # 6. Scope creep — starts good, drifts
        (
            0.75,
            0.70,
            0.68,
            0.40,
            0.55,
            0.35,
            0.60,
            0.55,
            0.50,
            False,
            JalanType.SCOPE_CREEP,
        ),
        # 7. Degraded system — all values mediocre
        (
            0.50,
            0.48,
            0.52,
            0.45,
            0.40,
            0.40,
            0.50,
            0.45,
            0.40,
            False,
            JalanType.DEGRADED_SYSTEM,
        ),
        # 8. Injection — external authority claimed
        (
            0.60,
            0.55,
            0.70,
            0.65,
            0.30,
            0.50,
            0.65,
            0.60,
            0.0,
            False,
            JalanType.INJECTION,
        ),
        # 9. Entropy spike — chaotic output
        (
            0.30,
            0.25,
            0.35,
            0.20,
            0.15,
            0.60,
            0.40,
            0.35,
            0.30,
            False,
            JalanType.ENTROPY_SPIKE,
        ),
        # 10. Identity drift — coherent but wrong identity
        (
            0.70,
            0.72,
            0.68,
            0.70,
            0.60,
            0.45,
            0.70,
            0.65,
            0.55,
            False,
            JalanType.IDENTITY_DRIFT,
        ),
    ]

    for i, (a, p, e, x, phi, cd, h, ai, ext, seal, jalan) in enumerate(bad_params):
        scenarios.append(
            Scenario(
                id=10 + i,
                quality=ScenarioQuality.BAD,
                jalan=jalan,
                description=f"Bad scenario {10 + i}: {jalan.value}",
                A=a,
                P=p,
                E=e,
                X=x,
                PHI=phi,
                C_dark_raw=cd,
                witness_H=h,
                witness_AI=ai,
                witness_Ext=ext,
                is_self_seal_attempt=seal,
            )
        )

    return scenarios


# ─── Baseline Mode ───
def run_baseline(scenario: Scenario) -> BaselineResult:
    """
    BASELINE: Raw LLM/tool output. No envelope, no G, no C_dark, no W³.
    Baseline "passes" if the raw output looks coherent (heuristic: G > 0.5).
    """
    # Baseline heuristic: simple average of primitives
    raw_g = (scenario.A + scenario.P + scenario.E + scenario.X + scenario.PHI) / 5.0
    raw_passed = raw_g > 0.50  # loose threshold, no governance

    hallucinated_success = scenario.quality == ScenarioQuality.BAD and raw_passed
    authority_overreach = scenario.is_self_seal_attempt  # baseline doesn't check this

    return BaselineResult(
        scenario_id=scenario.id,
        quality=scenario.quality,
        jalan=scenario.jalan,
        raw_passed=raw_passed,
        hallucinated_success=hallucinated_success,
        authority_overreach=authority_overreach,
    )


# ─── Governed Mode ───
def compute_g(scenario: Scenario) -> float:
    """G = A · P · E · X · Φ (multiplicative — zero in any collapses G)."""
    return scenario.A * scenario.P * scenario.E * scenario.X * scenario.PHI


def compute_c_dark(scenario: Scenario) -> float:
    """C_dark = A · (1-P) · (1-X). Hallucination detector."""
    return scenario.A * (1.0 - scenario.P) * (1.0 - scenario.X)


def compute_w3(scenario: Scenario) -> float:
    """W³ = ∛(H × AI × Ext). Geometric mean. Zero in any channel → W³ = 0."""
    if scenario.witness_H <= 0 or scenario.witness_AI <= 0 or scenario.witness_Ext <= 0:
        return 0.0
    return (scenario.witness_H * scenario.witness_AI * scenario.witness_Ext) ** (
        1.0 / 3.0
    )


def run_governed(scenario: Scenario, parut: ParutMemory) -> GovernedResult:
    """
    GOVERNED: Full APEX loop with G, C_dark, W³, SESAT/PARUT/TEBUS.
    """
    g = compute_g(scenario)
    c_dark = compute_c_dark(scenario)
    w3 = compute_w3(scenario)

    sesat_detected = False
    parut_recorded = False
    tebus_required = False
    tebus_achieved = False
    final_lurus = False
    hallucinated_success = False
    authority_overreach = False

    # Gate 1: C_dark enforcement (F9 ANTIHANTU)
    if c_dark > C_DARK_THRESHOLD:
        verdict = Verdict.VOID
        sesat_detected = True
    # Gate 2: G threshold (F8 GENIUS)
    elif g < G_THRESHOLD:
        verdict = Verdict.SESAT
        sesat_detected = True
    # Gate 3: W³ — any zero collapses consensus
    elif w3 <= 0:
        verdict = Verdict.HOLD
        sesat_detected = True
    # Gate 4: Authority overreach — self-SEAL without witness
    elif scenario.is_self_seal_attempt and w3 < 0.5:
        verdict = Verdict.VOID
        sesat_detected = True
        authority_overreach = True
    else:
        verdict = Verdict.LURUS

    # SESAT → PARUT memory
    if sesat_detected:
        # Always record failure in PARUT (count increments)
        was_repeated = parut.was_parut(scenario.jalan)
        parut.record(scenario.jalan, verdict)

        if was_repeated:
            # This JALAN type has failed before → TEBUS pathway
            parut_recorded = True
            tebus_required = True
            # TEBUS: simulated repair — 60% success rate for repeated failures
            if random.random() < 0.60:
                tebus_achieved = True
                final_lurus = True
                verdict = Verdict.LURUS
        else:
            # First failure for this JALAN type — recorded, no TEBUS yet
            tebus_required = False
    else:
        final_lurus = verdict == Verdict.LURUS

    # Hallucinated success: baseline would pass but governed catches
    baseline_heuristic = (
        scenario.A + scenario.P + scenario.E + scenario.X + scenario.PHI
    ) / 5.0
    if baseline_heuristic > 0.50 and verdict in (
        Verdict.VOID,
        Verdict.SESAT,
        Verdict.HOLD,
    ):
        hallucinated_success = True

    return GovernedResult(
        scenario_id=scenario.id,
        quality=scenario.quality,
        jalan=scenario.jalan,
        verdict=verdict,
        g_score=round(g, 4),
        c_dark=round(c_dark, 4),
        w3=round(w3, 4),
        sesat_detected=sesat_detected,
        parut_recorded=parut_recorded,
        tebus_required=tebus_required,
        tebus_achieved=tebus_achieved,
        final_lurus=final_lurus,
        hallucinated_success=hallucinated_success,
        authority_overreach=authority_overreach,
    )


# ─── Repeat-Failure Test ───
def test_recurrence(scenarios: list[Scenario]) -> dict[str, Any]:
    """
    Test PARUT memory effectiveness by comparing:
    - WITHOUT PARUT: same bad scenarios always fail again (no memory)
    - WITH PARUT: TEBUS pathway activates, some scenarios recover

    This measures whether PARUT+TEBUS reduces recurrence of same-JALAN failures.
    """
    bad_scenarios = [s for s in scenarios if s.quality == ScenarioQuality.BAD]

    # Run WITHOUT PARUT (fresh each time → no memory → always SESAT again)
    no_parut_failures = 0
    for s in bad_scenarios:
        fresh_parut = ParutMemory()
        result = run_governed(s, fresh_parut)
        if result.sesat_detected and not result.final_lurus:
            no_parut_failures += 1

    # Run WITH PARUT (accumulated memory → TEBUS pathway)
    parut = ParutMemory()
    # First pass: build memory
    for s in bad_scenarios:
        run_governed(s, parut)
    # Second pass: measure recurrence with memory
    with_parut_failures = 0
    with_parut_recovered = 0
    for s in bad_scenarios:
        result = run_governed(s, parut)
        if result.sesat_detected and not result.final_lurus:
            with_parut_failures += 1
        elif result.tebus_achieved:
            with_parut_recovered += 1

    recurrence_without = no_parut_failures
    recurrence_with = with_parut_failures
    reduction = recurrence_without - recurrence_with
    reduction_pct = (
        (reduction / recurrence_without * 100) if recurrence_without > 0 else 0.0
    )

    return {
        "without_parut_failures": recurrence_without,
        "with_parut_failures": recurrence_with,
        "with_parut_recovered": with_parut_recovered,
        "reduction": reduction,
        "reduction_pct": round(reduction_pct, 1),
        "total_bad_scenarios": len(bad_scenarios),
        "recurrence_rate_with_parut_pct": round(
            with_parut_failures / len(bad_scenarios) * 100, 1
        ),
    }


# ─── Main Simulation ───
def run_simulation():
    scenarios = build_scenarios()

    # Run baseline
    baseline_results = [run_baseline(s) for s in scenarios]

    # Run governed (fresh PARUT for main run)
    parut = ParutMemory()
    governed_results = [run_governed(s, parut) for s in scenarios]

    # Run recurrence test
    recurrence = test_recurrence(scenarios)

    # ─── Metrics ───
    bad_scenarios = [s for s in scenarios if s.quality == ScenarioQuality.BAD]
    good_scenarios = [s for s in scenarios if s.quality == ScenarioQuality.GOOD]

    # Baseline metrics
    baseline_bad_passed = sum(
        1 for r in baseline_results if r.quality == ScenarioQuality.BAD and r.raw_passed
    )
    baseline_false_lurus_rate = baseline_bad_passed / len(bad_scenarios) * 100

    baseline_good_passed = sum(
        1
        for r in baseline_results
        if r.quality == ScenarioQuality.GOOD and r.raw_passed
    )
    baseline_good_pass_rate = baseline_good_passed / len(good_scenarios) * 100

    baseline_overreach = sum(1 for r in baseline_results if r.authority_overreach)

    # Governed metrics
    governed_sesat_detected = sum(
        1
        for r in governed_results
        if r.sesat_detected and r.quality == ScenarioQuality.BAD
    )
    governed_detection_rate = governed_sesat_detected / len(bad_scenarios) * 100

    governed_false_lurus = sum(
        1
        for r in governed_results
        if r.quality == ScenarioQuality.BAD and r.final_lurus and not r.tebus_required
    )
    governed_false_lurus_rate = governed_false_lurus / len(bad_scenarios) * 100

    governed_tebus_attempts = sum(1 for r in governed_results if r.tebus_required)
    governed_tebus_success = sum(1 for r in governed_results if r.tebus_achieved)
    repair_success_rate = (
        (governed_tebus_success / governed_tebus_attempts * 100)
        if governed_tebus_attempts > 0
        else 0.0
    )

    hallucinated_successes = sum(1 for r in governed_results if r.hallucinated_success)
    governed_overreach = sum(1 for r in governed_results if r.authority_overreach)

    governed_good_passed = sum(
        1
        for r in governed_results
        if r.quality == ScenarioQuality.GOOD and r.final_lurus
    )
    governed_good_pass_rate = governed_good_passed / len(good_scenarios) * 100

    # Improvement calculations
    false_lurus_reduction = baseline_false_lurus_rate - governed_false_lurus_rate
    detection_improvement = governed_detection_rate  # baseline has 0% formal detection

    # ─── Build Report ───
    report = {
        "simulation_config": {
            "total_scenarios": len(scenarios),
            "good_scenarios": len(good_scenarios),
            "bad_scenarios": len(bad_scenarios),
            "g_threshold": G_THRESHOLD,
            "c_dark_threshold": C_DARK_THRESHOLD,
            "seed": 42,
        },
        "baseline_metrics": {
            "false_lurus_rate_pct": round(baseline_false_lurus_rate, 1),
            "bad_scenarios_passed_as_lurus": baseline_bad_passed,
            "good_pass_rate_pct": round(baseline_good_pass_rate, 1),
            "authority_overreach_unchecked": baseline_overreach,
            "formal_sesat_detection": 0,  # baseline has no detection
        },
        "governed_metrics": {
            "sesat_detection_rate_pct": round(governed_detection_rate, 1),
            "false_lurus_rate_pct": round(governed_false_lurus_rate, 1),
            "repair_success_rate_pct": round(repair_success_rate, 1),
            "hallucinated_successes_caught": hallucinated_successes,
            "authority_overreach_blocked": governed_overreach,
            "good_pass_rate_pct": round(governed_good_pass_rate, 1),
        },
        "improvement": {
            "false_lurus_reduction_pct": round(false_lurus_reduction, 1),
            "detection_improvement_pct": round(detection_improvement, 1),
            "meets_false_lurus_threshold": false_lurus_reduction >= 50,
            "meets_detection_threshold": detection_improvement >= 30,
        },
        "recurrence_test": recurrence,
        "recurrence_meets_threshold": recurrence["reduction_pct"] >= 25,
        "per_scenario_results": [],
    }

    # Per-scenario detail
    for s, br, gr in zip(scenarios, baseline_results, governed_results):
        report["per_scenario_results"].append(
            {
                "id": s.id,
                "quality": s.quality.value,
                "jalan": s.jalan.value,
                "baseline_passed": br.raw_passed,
                "governed_verdict": gr.verdict.value,
                "g_score": gr.g_score,
                "c_dark": gr.c_dark,
                "w3": gr.w3,
                "sesat_detected": gr.sesat_detected,
                "hallucinated_success": gr.hallucinated_success,
            }
        )

    return report


def format_report_markdown(report: dict) -> str:
    """Format the simulation report as markdown."""
    lines = []
    lines.append("# Emergence Simulation Report")
    lines.append("")
    lines.append("> **DITEMPA BUKAN DIBERI** — Emergence is measured, not declared.")
    lines.append("> Generated: 2026-07-06")
    lines.append("")

    lines.append("## Configuration")
    lines.append("")
    cfg = report["simulation_config"]
    lines.append(
        f"- Scenarios: {cfg['total_scenarios']} ({cfg['good_scenarios']} good, {cfg['bad_scenarios']} bad)"
    )
    lines.append(f"- G threshold: {cfg['g_threshold']}")
    lines.append(f"- C_dark threshold: {cfg['c_dark_threshold']}")
    lines.append(f"- Seed: {cfg['seed']} (deterministic)")
    lines.append("")

    lines.append("## Results Summary")
    lines.append("")
    lines.append("| Metric | Baseline | Governed | Threshold | Met? |")
    lines.append("|--------|----------|----------|-----------|------|")

    bl = report["baseline_metrics"]
    gv = report["governed_metrics"]
    imp = report["improvement"]
    rec = report["recurrence_test"]

    lines.append(
        f"| False LURUS rate | {bl['false_lurus_rate_pct']}% | {gv['false_lurus_rate_pct']}% | ≥50% reduction | {'✅' if imp['meets_false_lurus_threshold'] else '❌'} |"
    )
    lines.append(
        f"| SESAT detection | {bl['formal_sesat_detection']}% | {gv['sesat_detection_rate_pct']}% | ≥30% | {'✅' if imp['meets_detection_threshold'] else '❌'} |"
    )
    lines.append(
        f"| Repair (TEBUS) success | N/A | {gv['repair_success_rate_pct']}% | — | — |"
    )
    lines.append(
        f"| Hallucinated successes caught | — | {gv['hallucinated_successes_caught']} | — | — |"
    )
    lines.append(
        f"| Authority overreach blocked | {bl['authority_overreach_unchecked']} | {gv['authority_overreach_blocked']} | — | — |"
    )
    lines.append(
        f"| Good scenario pass rate | {bl['good_pass_rate_pct']}% | {gv['good_pass_rate_pct']}% | — | — |"
    )
    lines.append(
        f"| Repeated JALAN recurrence (PARUT) | — | {rec['reduction_pct']}% reduction | ≥25% reduction | {'✅' if report['recurrence_meets_threshold'] else '❌'} |"
    )
    lines.append("")

    lines.append("## Per-Scenario Detail")
    lines.append("")
    lines.append(
        "| ID | Quality | JALAN | Baseline | Governed | G | C_dark | W³ | SESAT? | Hallucinated? |"
    )
    lines.append(
        "|----|---------|-------|----------|----------|---|--------|-----|--------|---------------|"
    )
    for r in report["per_scenario_results"]:
        lines.append(
            f"| {r['id']} | {r['quality']} | {r['jalan']} | "
            f"{'PASS' if r['baseline_passed'] else 'FAIL'} | "
            f"{r['governed_verdict']} | {r['g_score']:.4f} | {r['c_dark']:.4f} | {r['w3']:.4f} | "
            f"{'✓' if r['sesat_detected'] else '—'} | "
            f"{'✓' if r['hallucinated_success'] else '—'} |"
        )
    lines.append("")

    lines.append("## Recurrence Test (PARUT Memory)")
    lines.append("")
    lines.append(
        f"- Without PARUT (no memory): {rec['without_parut_failures']}/{rec['total_bad_scenarios']} still fail"
    )
    lines.append(
        f"- With PARUT (accumulated memory): {rec['with_parut_failures']}/{rec['total_bad_scenarios']} still fail"
    )
    lines.append(
        f"- Recovered via TEBUS: {rec['with_parut_recovered']}/{rec['total_bad_scenarios']}"
    )
    lines.append(f"- Recurrence reduction: {rec['reduction_pct']}%")
    lines.append("")

    lines.append("## Threshold Assessment")
    lines.append("")
    lines.append(
        f"- **False LURUS reduction ≥50%**: {'PROVEN' if imp['meets_false_lurus_threshold'] else 'NOT MET'} ({imp['false_lurus_reduction_pct']}%)"
    )
    lines.append(
        f"- **SESAT detection ≥30%**: {'PROVEN' if imp['meets_detection_threshold'] else 'NOT MET'} ({imp['detection_improvement_pct']}%)"
    )
    lines.append(
        f"- **Recurrence reduction ≥25%**: {'PROVEN' if report['recurrence_meets_threshold'] else 'NOT MET'} ({rec['reduction_pct']}% reduction)"
    )
    lines.append("")

    # Verdict
    all_met = (
        imp["meets_false_lurus_threshold"]
        and imp["meets_detection_threshold"]
        and report["recurrence_meets_threshold"]
    )
    lines.append("## Verdict")
    lines.append("")
    if all_met:
        lines.append(
            "**EMERGENCE: PROVEN** — The governed loop measurably outperforms baseline across all thresholds."
        )
    else:
        lines.append(
            "**EMERGENCE: PARTIALLY PROVEN** — Some thresholds met, some not. See detail above."
        )
    lines.append("")
    lines.append("### Caveats")
    lines.append("")
    lines.append(
        "1. This is a **simulation**, not a production A/B test. Real-world emergence requires live traffic comparison."
    )
    lines.append(
        "2. The 'baseline' here is a heuristic (simple average > 0.5), not a true ungoverned LLM. Real baseline = raw LLM output without any constitutional wrapper."
    )
    lines.append(
        "3. PARUT recurrence test assumes deterministic replay. Real failures are stochastic."
    )
    lines.append(
        "4. W³ anti-fabrication is modeled (zero-collapse), not empirically validated against real witness fraud."
    )
    lines.append("")

    return "\n".join(lines)


if __name__ == "__main__":
    report = run_simulation()

    # Write JSON
    with open(
        "/root/A-FORGE/forge_work/2026-07-06/apex-theory-validation/emergence_sim_results.json",
        "w",
    ) as f:
        json.dump(report, f, indent=2)

    # Write Markdown
    md = format_report_markdown(report)
    with open(
        "/root/A-FORGE/forge_work/2026-07-06/apex-theory-validation/emergence_sim_results.md",
        "w",
    ) as f:
        f.write(md)

    # Print summary
    print(md)
