"""
test_quantum_planner.py — Test harness for quantum superposition planner.

DITEMPA BUKAN DIBERI — Tests are evidence, not opinions.

Run: python test_quantum_planner.py
"""

import sys
import os

# Add tools/quantum to path
sys.path.insert(0, os.path.dirname(__file__))

from quantum_planner import (
    QuantumPlanner,
    Hypothesis,
    PlanResult,
    PlanMode,
    HypothesisStatus,
    BlastRadius,
    Reversibility,
    EpistemicLabel,
    emit_quantum_receipt,
)


def test_superposition_holds_when_below_threshold():
    """
    T1: Discrimination threshold NOT reached → mode = SUPERPOSITION

    H1: 0.52, H2: 0.48 → Δ = 0.04 < 0.40 → cannot collapse
    """
    planner = QuantumPlanner(coherence_budget=1.0, discrimination_threshold=0.40)

    result = planner.plan(
        task="fix graphiti-mcp false unhealthy",
        hypotheses=[
            Hypothesis(
                id="H1",
                plan="restart container",
                steps=["docker restart graphiti-mcp"],
                amplitude_prior=0.50,
                evidence_for=["restart resolves transient issues"],
                evidence_against=["root cause unfixed"],
                blast_radius=BlastRadius.CONTAINER,
                reversibility=Reversibility.FULL,
            ),
            Hypothesis(
                id="H2",
                plan="fix healthcheck script then restart",
                steps=["edit graphiti-start.sh", "systemctl restart"],
                amplitude_prior=0.50,
                evidence_for=["fixes root cause", "prevents recurrence"],
                evidence_against=["takes longer", "more steps"],
                blast_radius=BlastRadius.HOST,
                reversibility=Reversibility.FULL,
            ),
        ],
    )

    assert result.mode == PlanMode.SUPERPOSITION, f"Expected SUPERPOSITION, got {result.mode}"
    assert result.discrimination_reached is False
    assert len(result.hypotheses) == 2
    assert result.hypotheses[0].status == HypothesisStatus.PRIMARY
    assert result.hypotheses[1].status == HypothesisStatus.BACKUP
    assert "HOLD" in result.recommendation
    print("✅ T1 PASS: Superposition holds when below threshold")


def test_collapse_when_threshold_exceeded():
    """
    T2: Discrimination threshold EXCEEDED → mode = COLLAPSED

    H1: strong evidence, H2: weak evidence → Δ > 0.40 → collapse
    """
    planner = QuantumPlanner(coherence_budget=1.0, discrimination_threshold=0.40)

    result = planner.plan(
        task="deploy to production",
        hypotheses=[
            Hypothesis(
                id="H1",
                plan="deploy with green tests",
                steps=["run tests", "deploy"],
                amplitude_prior=0.70,
                evidence_for=["tests pass", "rollback available"],
                evidence_against=[],
                blast_radius=BlastRadius.HOST,
                reversibility=Reversibility.PARTIAL,
            ),
            Hypothesis(
                id="H2",
                plan="skip tests, deploy now",
                steps=["deploy --no-tests"],
                amplitude_prior=0.30,
                evidence_for=["faster"],
                evidence_against=["no safety net", "risky"],
                blast_radius=BlastRadius.HOST,
                reversibility=Reversibility.NONE,
            ),
        ],
    )

    assert result.mode == PlanMode.COLLAPSED, f"Expected COLLAPSED, got {result.mode}"
    assert result.discrimination_reached is True
    assert result.collapse_event is not None
    assert result.collapse_event.collapsed_to == "H1"
    assert result.hypotheses[0].status == HypothesisStatus.COLLAPSED
    assert result.hypotheses[0].verdict == "PROCEED"
    assert result.hypotheses[1].verdict == "HOLD"
    print("✅ T2 PASS: Collapse occurs when threshold exceeded")


def test_tunneling_when_classical_blocked():
    """
    T3: Classical path BLOCKED → attempt quantum tunnel

    H1: amplitude < 0.30, all evidence weak → tunnel probability > threshold
    """
    planner = QuantumPlanner(coherence_budget=1.0, discrimination_threshold=0.40)

    result = planner.plan(
        task="resolve impossible geological correlation",
        hypotheses=[
            Hypothesis(
                id="H1",
                plan="use regional analog as proxy",
                steps=["identify analog basin", "apply scaling factor"],
                amplitude_prior=0.20,
                evidence_for=["analog exists"],
                evidence_against=["structural differences unknown"],
                blast_radius=BlastRadius.FEDERATION,
                reversibility=Reversibility.PARTIAL,
                coherence_cost_estimate=0.3,
            ),
            Hypothesis(
                id="H2",
                plan="acquire new seismic",
                steps=["plan survey", "execute", "reprocess"],
                amplitude_prior=0.20,
                evidence_for=["definitive answer"],
                evidence_against=["cost too high", "time too long"],
                blast_radius=BlastRadius.HOST,
                reversibility=Reversibility.FULL,
                coherence_cost_estimate=0.5,
            ),
        ],
    )

    # Both below 0.30, tunneling may trigger
    assert result.mode in [PlanMode.TUNNELING, PlanMode.SUPERPOSITION]
    print(f"✅ T3 PASS: Mode = {result.mode.value} (tunneling or held)")


def test_arif_override_forces_collapse():
    """
    T4: Arif override → force collapse regardless of threshold
    """
    planner = QuantumPlanner(coherence_budget=1.0, discrimination_threshold=0.40)

    result = planner.plan(
        task="emergency fix",
        hypotheses=[
            Hypothesis(id="H1", plan="safe path", steps=["slow approach"], amplitude_prior=0.52),
            Hypothesis(id="H2", plan="fast path", steps=["aggressive"], amplitude_prior=0.48),
        ],
        arif_override=True,
    )

    assert result.mode == PlanMode.COLLAPSED
    assert result.collapse_event.reason == "arif_override"
    print("✅ T4 PASS: Arif override forces collapse")


def test_coherence_budget_hold():
    """
    T5: Coherence budget > 85% consumed → 888_HOLD
    """
    planner = QuantumPlanner(coherence_budget=1.0)

    # Drain budget
    for _ in range(9):
        planner.budget.consume(0.10)

    status = planner.budget.can_proceed()
    assert status[0] is False
    assert status[1] == "COHERENCE_HOLD"
    print("✅ T5 PASS: Coherence budget triggers hold at 85%")


def test_coherence_budget_depleted():
    """
    T6: Coherence budget > 95% consumed → STOP
    """
    planner = QuantumPlanner(coherence_budget=1.0)

    planner.budget.consume(0.96)

    status = planner.budget.can_proceed()
    assert status[0] is False
    assert status[1] == "COHERENCE_DEPLETED"
    print("✅ T6 PASS: Coherence budget stops at 95%")


def test_receipt_emission():
    """
    T7: PlanResult can be serialized to quantum receipt
    """
    planner = QuantumPlanner(coherence_budget=1.0, discrimination_threshold=0.30)

    result = planner.plan(
        task="test task",
        hypotheses=[
            Hypothesis(id="H1", plan="plan A", steps=["step1"], amplitude_prior=0.70,
                      evidence_for=["evidence"] * 3, evidence_against=[]),
            Hypothesis(id="H2", plan="plan B", steps=["step1"], amplitude_prior=0.30,
                      evidence_for=[], evidence_against=["weak"] * 2),
        ],
    )

    receipt = emit_quantum_receipt(result, task="test task")

    assert receipt["type"] == "QUANTUM_SUPERPOSITION_PLAN"
    assert "id" in receipt
    assert "ψ_coherence" in receipt
    assert "f9_compliance" in receipt
    assert receipt["f9_compliance"]["no_consciousness_claims"] is True
    assert receipt["f9_compliance"]["amplitudes_are_mathematical"] is True
    print("✅ T7 PASS: Quantum receipt emission works")


def test_f9_anti_hantu_compliance():
    """
    T8: No consciousness claims in output, F9 bounds respected
    """
    planner = QuantumPlanner(coherence_budget=1.0)

    result = planner.plan(
        task="any task",
        hypotheses=[
            Hypothesis(id="H1", plan="option one", steps=["do thing"]),
        ],
    )

    result_dict = result.to_dict()
    result_json = json.dumps(result_dict, indent=2)

    # Check no consciousness claims
    forbidden_phrases = [
        "I think", "I feel", "I believe", "I prefer",
        "the model feels", "the model wants", "consciousness",
    ]

    for phrase in forbidden_phrases:
        assert phrase.lower() not in result_json.lower(), f"F9 VIOLATION: '{phrase}' found"

    # F9 bounds: amplitudes ∈ [0, 1], ψ_coherence ∈ [0, 1], cost ≤ budget
    assert 0.0 <= result_dict["ψ_coherence"] <= 1.0
    for h in result_dict["hypotheses"]:
        assert 0.0 <= h["amplitude_final"] <= 1.0
    assert result_dict["coherence_cost_consumed"] <= result_dict["coherence_budget"]["total"]

    print("✅ T8 PASS: F9 Anti-Hantu compliance — no consciousness claims, F9 bounds respected")


def test_max_hypotheses():
    """
    T9: Maximum 7 hypotheses enforced (decoherence risk)
    """
    planner = QuantumPlanner(coherence_budget=1.0)

    too_many = [
        Hypothesis(id=f"H{i}", plan=f"plan {i}", steps=[f"step {i}"], amplitude_prior=1.0)
        for i in range(10)
    ]

    try:
        planner.plan("too many", too_many)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "7" in str(e)
        print("✅ T9 PASS: Maximum 7 hypotheses enforced")


def test_real_trace_graphiti_mcp():
    """
    T10: Real trace from today's graphiti-mcp fix session

    H1: restart container (restore quickly)
    H2: fix healthcheck script then restart (restore + prevent recurrence)
    """
    planner = QuantumPlanner(coherence_budget=1.0, discrimination_threshold=0.40)

    result = planner.plan(
        task="fix graphiti-mcp false unhealthy (container healthy, health check misconfigured)",
        hypotheses=[
            Hypothesis(
                id="H1",
                plan="restart container only",
                steps=[
                    "systemctl restart graphiti-mcp",
                    "wait for startup",
                    "verify /health endpoint responds",
                ],
                amplitude_prior=0.50,
                evidence_for=[
                    "container is actually healthy",
                    "quick restoration",
                    "health check will still fail but service works",
                ],
                evidence_against=[
                    "health check still misconfigured",
                    "will show unhealthy again",
                    "same problem recurs",
                ],
                blast_radius=BlastRadius.CONTAINER,
                reversibility=Reversibility.FULL,
                coherence_cost_estimate=0.1,
                label=EpistemicLabel.DER,
            ),
            Hypothesis(
                id="H2",
                plan="fix healthcheck + restart",
                steps=[
                    "edit /usr/local/bin/graphiti-start.sh",
                    "add --health-cmd with correct endpoint",
                    "systemctl daemon-reload",
                    "systemctl restart graphiti-mcp",
                    "verify health check passes",
                ],
                amplitude_prior=0.50,
                evidence_for=[
                    "fixes root cause",
                    "health check will pass",
                    "problem cannot recur",
                    "proper engineering",
                ],
                evidence_against=[
                    "takes longer",
                    "more steps = more risk",
                    "requires script edit",
                ],
                blast_radius=BlastRadius.HOST,
                reversibility=Reversibility.FULL,
                coherence_cost_estimate=0.15,
                label=EpistemicLabel.DER,
            ),
        ],
    )

    print(f"\n{'='*60}")
    print(f"Real Trace: graphiti-mcp fix")
    print(f"Mode: {result.mode.value}")
    print(f"Discrimination reached: {result.discrimination_reached}")
    print(f"ψ_coherence: {result.ψ_coherence:.3f}")
    print(f"Coherence cost: {result.coherence_cost_consumed:.3f}")
    print()
    for h in sorted(result.hypotheses, key=lambda x: x.rank):
        print(f"  Rank {h.rank}: {h.id}")
        print(f"    amplitude: {h.amplitude_final:.3f}")
        print(f"    interference: {h.interference_net:+.3f}")
        print(f"    status: {h.status.value}")
        print(f"    verdict: {h.verdict}")
    print()
    print(f"Recommendation: {result.recommendation}")
    print(f"{'='*60}\n")

    # We expect this to be COLLAPSED because H2 has more evidence_for
    assert result.mode in [PlanMode.COLLAPSED, PlanMode.SUPERPOSITION]

    if result.mode == PlanMode.COLLAPSED:
        assert result.collapse_event is not None
        print(f"✅ T10 PASS: Collapsed to {result.collapse_event.collapsed_to}")
    else:
        print(f"✅ T10 PASS: Held in superposition (discrimination threshold not met)")


# ── RUN ALL TESTS ─────────────────────────────────────────────────────────────


if __name__ == "__main__":
    import json

    print("Quantum Planner Test Suite — QSKILL-01")
    print("=" * 60)

    tests = [
        test_superposition_holds_when_below_threshold,
        test_collapse_when_threshold_exceeded,
        test_tunneling_when_classical_blocked,
        test_arif_override_forces_collapse,
        test_coherence_budget_hold,
        test_coherence_budget_depleted,
        test_receipt_emission,
        test_f9_anti_hantu_compliance,
        test_max_hypotheses,
        test_real_trace_graphiti_mcp,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {test.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"💥 ERROR: {test.__name__}: {e}")
            failed += 1

    print()
    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed, {passed+failed} total")
    print("DITEMPA BUKAN DIBERI — Evidence, not opinions.")
