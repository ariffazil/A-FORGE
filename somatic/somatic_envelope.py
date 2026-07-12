#!/usr/bin/env python3
"""
Somatic Envelope — P3 of Somatic Kernel.

Wraps every consequential tool call with the full 8-phase somatic control loop:

  SENSE → ORIENT → PREDICT → GATE → ACT → OBSERVE → LEARN → RECOVER

The envelope does NOT call MCP tools directly. It wraps an executor function.
This keeps it decoupled from transport (HTTP, stdio, etc).

Usage:
  from somatic_envelope import SomaticEnvelope

  envelope = SomaticEnvelope()
  result = envelope.wrap(
      tool_name="forge_shell",
      arguments={"command": "ls -la"},
      executor_fn=my_executor,
      action_class="MUTATE",
  )

  # result.allowed — whether the action was permitted
  # result.phases — dict of all 8 phase outputs
  # result.result — the actual tool result (if allowed)
  # result.somatic_metadata — state, reflexes, scars, prediction

F9 ANTI-HANTU: Pure coordination. No inference. No feelings.
DITEMPA BUKAN DIBERI — Forged 2026-07-12.
"""

import json
import time
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

# Import sibling modules
sys.path.insert(0, str(Path(__file__).parent))
from reflex_executor import evaluate_reflexes, load_somatic_state as load_state_reflex
from scar_evaluator import evaluate_scars

# --- Paths ---
SOMATIC_STATE_PATH = Path("/root/A-FORGE/somatic/somatic_state.yaml")
GENERATOR_PATH = Path("/root/A-FORGE/somatic/generate_somatic_state.py")

# --- Constants ---
PREDICTION_ERROR_WARN = 0.3
PREDICTION_ERROR_CRITICAL = 0.7
MAX_RECOVERY_ATTEMPTS = 2


# --- Data classes ---


@dataclass
class PhaseResult:
    """Result of a single somatic control loop phase."""

    phase: str
    status: str  # OK, BLOCKED, SKIPPED, ERROR
    data: dict = field(default_factory=dict)
    duration_ms: float = 0.0
    error: str | None = None


@dataclass
class EnvelopeResult:
    """Full result of the somatic envelope pipeline."""

    allowed: bool
    verdict: str  # ALLOW, BLOCK, HOLD, WARN, RECOVER
    tool_name: str
    action_class: str
    phases: dict = field(default_factory=dict)
    result: Any = None
    somatic_metadata: dict = field(default_factory=dict)
    prediction_error: float = 0.0
    recovery_triggered: bool = False
    total_duration_ms: float = 0.0

    def to_dict(self) -> dict:
        """Serialize to dict (excludes result which may be non-serializable)."""
        d = asdict(self)
        try:
            json.dumps(d["result"])
        except (TypeError, ValueError):
            d["result"] = str(d["result"])
        return d


# --- Risk table (deterministic) ---

RISK_TABLE = {
    # action_class → base risk
    "OBSERVE": "LOW",
    "ANALYZE": "LOW",
    "DRAFT": "LOW",
    "MUTATE": "MEDIUM",
    "EXECUTE": "MEDIUM",
    "IRREVERSIBLE": "HIGH",
    "EXTERNAL_SIDE_EFFECT": "HIGH",
}

REGULATORY_RISK_MODIFIER = {
    "NOMINAL": 0,
    "ELEVATED": 0,
    "CAUTION": 1,
    "PROTECTIVE": 2,
    "SHUTDOWN": 3,
}

RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def elevate_risk(base_risk: str, levels: int) -> str:
    """Elevate risk by N levels."""
    try:
        idx = RISK_LEVELS.index(base_risk)
        return RISK_LEVELS[min(idx + levels, len(RISK_LEVELS) - 1)]
    except ValueError:
        return base_risk


# --- Somatic Envelope ---


class SomaticEnvelope:
    """
    Wraps tool calls with the 8-phase somatic control loop.

    Stateless per call — loads fresh somatic state each time.
    Maintains a session-level marker history for learning.
    """

    def __init__(self, state_path: str | None = None, scars_path: str | None = None):
        self.state_path = Path(state_path) if state_path else SOMATIC_STATE_PATH
        self.scars_path = Path(scars_path) if scars_path else None
        self._marker_history: list[dict] = []
        self._prediction_log: list[dict] = []

    def wrap(
        self,
        tool_name: str,
        arguments: dict,
        executor_fn: Callable[[str, dict], Any],
        action_class: str = "OBSERVE",
        ack_irreversible: bool = False,
    ) -> EnvelopeResult:
        """
        Run the full 8-phase somatic control loop around a tool call.

        Args:
            tool_name: MCP tool name (e.g., "forge_shell", "arif_observe")
            arguments: Tool arguments dict
            executor_fn: Callable(tool_name, arguments) → result
            action_class: OBSERVE|DRAFT|MUTATE|EXECUTE|IRREVERSIBLE
            ack_irreversible: Required for IRREVERSIBLE actions

        Returns:
            EnvelopeResult with all phases, result (if allowed), metadata
        """
        start = time.monotonic()
        result = EnvelopeResult(
            allowed=False,
            verdict="UNKNOWN",
            tool_name=tool_name,
            action_class=action_class,
        )

        # Build action context
        action_ctx = {
            "action_class": action_class,
            "ack_irreversible": ack_irreversible,
            "tool_name": tool_name,
        }

        # === Phase 1: SENSE ===
        sense = self._phase_sense()
        result.phases["SENSE"] = sense

        if sense.status == "ERROR":
            result.verdict = "BLOCK"
            result.total_duration_ms = (time.monotonic() - start) * 1000
            return result

        somatic_state = sense.data.get("somatic_state", {})

        # === Phase 2: ORIENT ===
        orient = self._phase_orient(somatic_state, action_ctx)
        result.phases["ORIENT"] = orient

        # === Phase 3: PREDICT ===
        predict = self._phase_predict(somatic_state, action_ctx)
        result.phases["PREDICT"] = predict
        result.somatic_metadata["prediction"] = predict.data

        # === Phase 4: GATE (reflexes + scars) ===
        gate = self._phase_gate(somatic_state, action_ctx)
        result.phases["GATE"] = gate

        # Extract gate verdict
        reflex_verdict = gate.data.get("reflex_verdict", "ALLOW")
        scar_constraints = gate.data.get("scar_constraints", [])
        gate_verdict = gate.data.get("combined_verdict", "ALLOW")

        result.somatic_metadata["reflexes"] = gate.data.get("reflex_result", {})
        result.somatic_metadata["scars"] = gate.data.get("scar_result", {})

        # If gate blocks, stop here
        if gate_verdict in ("BLOCK", "HOLD"):
            result.allowed = False
            result.verdict = gate_verdict
            result.total_duration_ms = (time.monotonic() - start) * 1000
            return result

        # === Phase 5: ACT ===
        act = self._phase_act(tool_name, arguments, executor_fn)
        result.phases["ACT"] = act
        result.result = act.data.get("result")
        result.allowed = act.status == "OK"

        # === Phase 6: OBSERVE ===
        observe = self._phase_observe(predict.data, act.data)
        result.phases["OBSERVE"] = observe
        result.prediction_error = observe.data.get("prediction_error", 0.0)

        # === Phase 7: LEARN ===
        learn = self._phase_learn(observe.data, somatic_state)
        result.phases["LEARN"] = learn
        result.somatic_metadata["markers_updated"] = learn.data.get("markers", [])

        # === Phase 8: RECOVER ===
        recover = self._phase_recover(observe.data, act.data)
        result.phases["RECOVER"] = recover
        result.recovery_triggered = recover.data.get("recovery_needed", False)

        # Final verdict
        if result.recovery_triggered:
            result.verdict = "RECOVER"
        elif gate_verdict == "WARN":
            result.verdict = "WARN"
        else:
            result.verdict = "ALLOW"

        result.total_duration_ms = (time.monotonic() - start) * 1000
        return result

    # --- Phase implementations ---

    def _phase_sense(self) -> PhaseResult:
        """SENSE: Load current somatic state."""
        start = time.monotonic()
        try:
            state = load_state_reflex(str(self.state_path))
            if "_error" in state:
                # Try generating fresh
                if GENERATOR_PATH.exists():
                    import subprocess

                    subprocess.run(
                        [sys.executable, str(GENERATOR_PATH)],
                        capture_output=True,
                        timeout=15,
                    )
                    state = load_state_reflex(str(self.state_path))

            if "_error" in state:
                return PhaseResult(
                    phase="SENSE",
                    status="ERROR",
                    error=state["_error"],
                    duration_ms=(time.monotonic() - start) * 1000,
                )

            return PhaseResult(
                phase="SENSE",
                status="OK",
                data=state,
                duration_ms=(time.monotonic() - start) * 1000,
            )
        except Exception as e:
            return PhaseResult(
                phase="SENSE",
                status="ERROR",
                error=str(e),
                duration_ms=(time.monotonic() - start) * 1000,
            )

    def _phase_orient(self, somatic_state: dict, action_ctx: dict) -> PhaseResult:
        """ORIENT: Map capabilities and authority."""
        start = time.monotonic()
        ss = somatic_state.get("somatic_state", somatic_state)

        capability = ss.get("capability_schema", {})
        authority = capability.get("authority", "UNKNOWN")
        actor_verified = capability.get("actor_verified", False)
        organs_healthy = capability.get("organs_healthy", [])
        organs_down = capability.get("organs_down", [])

        orientation = {
            "authority": authority,
            "actor_verified": actor_verified,
            "organs_healthy_count": len(organs_healthy),
            "organs_down_count": len(organs_down),
            "organs_down": organs_down,
            "session_bound": capability.get("session_bound", False),
            "action_class": action_ctx.get("action_class"),
            "can_mutate": authority in ("LIMITED_MUTATE", "FULL"),
            "can_execute": authority in ("LIMITED_MUTATE", "FULL"),
        }

        return PhaseResult(
            phase="ORIENT",
            status="OK",
            data=orientation,
            duration_ms=(time.monotonic() - start) * 1000,
        )

    def _phase_predict(self, somatic_state: dict, action_ctx: dict) -> PhaseResult:
        """PREDICT: Estimate consequence + risk before acting."""
        start = time.monotonic()
        ss = somatic_state.get("somatic_state", somatic_state)

        action_class = action_ctx.get("action_class", "OBSERVE")
        regulatory = ss.get("regulatory_state", {})
        reg_state = regulatory.get("state", "NOMINAL")
        confidence_cap = regulatory.get("confidence_cap", 0.9)
        interoception = ss.get("interoception", {})
        error_rate = interoception.get("tool_error_rate", 0.0)

        # Base risk from action class
        base_risk = RISK_TABLE.get(action_class, "MEDIUM")

        # Elevate based on regulatory state
        modifier = REGULATORY_RISK_MODIFIER.get(reg_state, 0)
        predicted_risk = elevate_risk(base_risk, modifier)

        # Elevate if error rate is high
        if error_rate > 0.3:
            predicted_risk = elevate_risk(predicted_risk, 1)

        # Expected outcome
        expected_outcome = (
            "success" if predicted_risk in ("LOW", "MEDIUM") else "uncertain"
        )

        prediction = {
            "predicted_risk": predicted_risk,
            "base_risk": base_risk,
            "regulatory_modifier": modifier,
            "confidence_cap": confidence_cap,
            "expected_outcome": expected_outcome,
            "error_rate_at_predict": error_rate,
        }

        return PhaseResult(
            phase="PREDICT",
            status="OK",
            data=prediction,
            duration_ms=(time.monotonic() - start) * 1000,
        )

    def _phase_gate(self, somatic_state: dict, action_ctx: dict) -> PhaseResult:
        """GATE: Run reflexes + scars. Deterministic, non-generative."""
        start = time.monotonic()

        # Run reflexes
        reflex_result = evaluate_reflexes(somatic_state, action_ctx)
        reflex_verdict = reflex_result.get("verdict", "ALLOW")

        # Run scars
        scars_source = None
        if self.scars_path and self.scars_path.exists():
            scars_source = str(self.scars_path)
        scar_result = evaluate_scars(somatic_state, action_ctx, scars_source)
        scar_constraints = scar_result.get("constraint_summary", [])

        # Combined verdict: worst of reflex + scar
        verdict_priority = {
            "BLOCK": 3,
            "HOLD": 2,
            "WARN": 1,
            "DOWNGRADE": 0,
            "ALLOW": -1,
        }
        combined = reflex_verdict
        if scar_result.get("total_fired", 0) > 0:
            # Scars with pressure > 0.8 escalate to HOLD
            max_pressure = scar_result.get("highest_pressure", 0)
            if max_pressure > 0.8 and verdict_priority.get(combined, -1) < 2:
                combined = "HOLD"
            elif max_pressure > 0.5 and verdict_priority.get(combined, -1) < 1:
                combined = "WARN"

        return PhaseResult(
            phase="GATE",
            status="OK",
            data={
                "reflex_verdict": reflex_verdict,
                "reflex_result": reflex_result,
                "scar_result": scar_result,
                "scar_constraints": scar_constraints,
                "combined_verdict": combined,
            },
            duration_ms=(time.monotonic() - start) * 1000,
        )

    def _phase_act(
        self, tool_name: str, arguments: dict, executor_fn: Callable
    ) -> PhaseResult:
        """ACT: Execute the tool call via the provided executor."""
        start = time.monotonic()
        try:
            exec_result = executor_fn(tool_name, arguments)
            return PhaseResult(
                phase="ACT",
                status="OK",
                data={"result": exec_result, "success": True},
                duration_ms=(time.monotonic() - start) * 1000,
            )
        except Exception as e:
            return PhaseResult(
                phase="ACT",
                status="ERROR",
                data={"result": None, "success": False, "error_type": type(e).__name__},
                error=str(e),
                duration_ms=(time.monotonic() - start) * 1000,
            )

    def _phase_observe(self, prediction: dict, act_data: dict) -> PhaseResult:
        """OBSERVE: Compare predicted vs actual outcome."""
        start = time.monotonic()

        predicted_risk = prediction.get("predicted_risk", "MEDIUM")
        expected_outcome = prediction.get("expected_outcome", "success")
        act_success = act_data.get("success", False)

        # Calculate prediction error
        # If we predicted success and it failed → high error
        # If we predicted uncertain and it failed → low error
        if expected_outcome == "success" and not act_success:
            prediction_error = 0.8
        elif expected_outcome == "uncertain" and act_success:
            prediction_error = 0.2  # pleasant surprise
        elif expected_outcome == "uncertain" and not act_success:
            prediction_error = 0.1  # expected
        else:
            prediction_error = 0.0  # predicted correctly

        # Risk was correct?
        risk_accurate = (
            predicted_risk in ("LOW", "MEDIUM")
            if act_success
            else predicted_risk in ("HIGH", "CRITICAL")
        )

        return PhaseResult(
            phase="OBSERVE",
            status="OK",
            data={
                "prediction_error": prediction_error,
                "predicted_risk": predicted_risk,
                "expected_outcome": expected_outcome,
                "actual_success": act_success,
                "risk_accurate": risk_accurate,
            },
            duration_ms=(time.monotonic() - start) * 1000,
        )

    def _phase_learn(self, observe_data: dict, somatic_state: dict) -> PhaseResult:
        """LEARN: Update markers if prediction error exceeds threshold."""
        start = time.monotonic()

        prediction_error = observe_data.get("prediction_error", 0.0)
        markers = []

        if prediction_error > PREDICTION_ERROR_WARN:
            marker = {
                "marker": f"prediction_error_{int(time.time())}",
                "activation": min(1.0, prediction_error),
                "source": "somatic_envelope:learn",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            markers.append(marker)
            self._marker_history.append(marker)

        # Check if we should record a scar-worthy pattern
        if prediction_error > PREDICTION_ERROR_CRITICAL:
            markers.append(
                {
                    "marker": "scar_candidate",
                    "activation": prediction_error,
                    "source": "somatic_envelope:learn:critical",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "recommendation": "Consider adding state-conditioned scar for this pattern",
                }
            )

        return PhaseResult(
            phase="LEARN",
            status="OK",
            data={"markers": markers, "prediction_error": prediction_error},
            duration_ms=(time.monotonic() - start) * 1000,
        )

    def _phase_recover(self, observe_data: dict, act_data: dict) -> PhaseResult:
        """RECOVER: Determine if recovery action is needed."""
        start = time.monotonic()

        prediction_error = observe_data.get("prediction_error", 0.0)
        act_success = act_data.get("success", False)
        recovery_needed = False
        recovery_action = None

        if prediction_error > PREDICTION_ERROR_CRITICAL:
            recovery_needed = True
            recovery_action = "HALT — prediction error critical. Review before retry."
        elif not act_success:
            recovery_needed = True
            recovery_action = (
                "RETRY_WITH_BACKOFF — tool call failed. Check error before retry."
            )

        return PhaseResult(
            phase="RECOVER",
            status="OK",
            data={
                "recovery_needed": recovery_needed,
                "recovery_action": recovery_action,
                "prediction_error": prediction_error,
            },
            duration_ms=(time.monotonic() - start) * 1000,
        )

    def get_marker_history(self) -> list[dict]:
        """Return accumulated markers from this session."""
        return self._marker_history.copy()


# --- Convenience function ---


def wrap_call(
    tool_name: str,
    arguments: dict,
    executor_fn: Callable,
    action_class: str = "OBSERVE",
    ack_irreversible: bool = False,
    state_path: str | None = None,
    scars_path: str | None = None,
) -> EnvelopeResult:
    """One-shot convenience function. Creates envelope, runs pipeline."""
    envelope = SomaticEnvelope(state_path=state_path, scars_path=scars_path)
    return envelope.wrap(
        tool_name=tool_name,
        arguments=arguments,
        executor_fn=executor_fn,
        action_class=action_class,
        ack_irreversible=ack_irreversible,
    )


# --- Test suite ---


def run_test() -> bool:
    """Test the envelope pipeline with mock executors."""
    tests = []

    # Helper: mock executor that succeeds
    def mock_success(tool_name: str, arguments: dict) -> dict:
        return {"status": "ok", "output": "mock result"}

    # Helper: mock executor that fails
    def mock_failure(tool_name: str, arguments: dict) -> dict:
        raise RuntimeError("mock tool failure")

    # Test 1: OBSERVE should always be allowed (WARN is allowed, not blocking)
    envelope = SomaticEnvelope()
    r = envelope.wrap("arif_observe", {"query": "test"}, mock_success, "OBSERVE")
    tests.append(("OBSERVE action → ALLOW/WARN (allowed)", r.allowed))

    # Test 2: MUTATE with OBSERVE_ONLY should be blocked (reflex R01)
    r2 = envelope.wrap("forge_shell", {"command": "ls"}, mock_success, "MUTATE")
    # Current state has authority=OBSERVE_ONLY, so R01 should fire
    tests.append(
        ("MUTATE with OBSERVE_ONLY → BLOCK", not r2.allowed and r2.verdict == "BLOCK")
    )

    # Test 3: Gate phase should have reflex data
    gate3 = r2.phases.get("GATE")
    tests.append(
        (
            "Gate has reflex data",
            gate3 is not None and "reflex_verdict" in getattr(gate3, "data", {}),
        )
    )

    # Test 4: SENSE phase returns state
    sense4 = r.phases.get("SENSE")
    tests.append(("SENSE returns state", sense4 is not None and sense4.status == "OK"))

    # Test 5: PREDICT phase returns risk
    pred5 = r.phases.get("PREDICT")
    pred_data = getattr(pred5, "data", {}) if pred5 else {}
    tests.append(("PREDICT returns risk", "predicted_risk" in pred_data))

    # Test 6: OBSERVE phase returns prediction error
    obs6 = r.phases.get("OBSERVE")
    obs_data = getattr(obs6, "data", {}) if obs6 else {}
    tests.append(("OBSERVE returns prediction_error", "prediction_error" in obs_data))

    # Test 7: Failed executor → recovery needed
    r3 = envelope.wrap("arif_observe", {"query": "test"}, mock_failure, "OBSERVE")
    rec7 = r3.phases.get("RECOVER")
    rec_data = getattr(rec7, "data", {}) if rec7 else {}
    tests.append(
        ("Failed executor → recovery needed", rec_data.get("recovery_needed", False))
    )

    # Test 8: LEARN records markers on high prediction error
    # (mock_failure with OBSERVE should give prediction_error 0.8)
    learn8 = r3.phases.get("LEARN")
    learn_data = getattr(learn8, "data", {}) if learn8 else {}
    tests.append(
        ("LEARN records markers on error", len(learn_data.get("markers", [])) > 0)
    )

    # Test 9: Envelope result has all 8 phases
    all_phases = {
        "SENSE",
        "ORIENT",
        "PREDICT",
        "GATE",
        "ACT",
        "OBSERVE",
        "LEARN",
        "RECOVER",
    }
    tests.append(("All 8 phases present", all_phases == set(r.phases.keys())))

    # Test 10: Total duration is positive
    tests.append(("Total duration > 0", r.total_duration_ms > 0))

    # Print results
    passed = sum(1 for _, ok in tests if ok)
    failed = len(tests) - passed
    for name, ok in tests:
        mark = "✅" if ok else "❌"
        print(f"  {mark} {name}")

    print(f"\n  Results: {passed}/{len(tests)} passed")
    return failed == 0


# --- CLI ---


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        print("Somatic Envelope — Test Suite")
        print("=" * 50)
        ok = run_test()
        sys.exit(0 if ok else 1)

    if len(sys.argv) > 1 and sys.argv[1] == "--demo":
        # Demo: wrap a simple OBSERVE call
        def demo_executor(tool_name: str, arguments: dict) -> dict:
            return {"status": "ok", "tool": tool_name, "args": arguments}

        envelope = SomaticEnvelope()
        result = envelope.wrap(
            tool_name="arif_observe",
            arguments={"query": "test query"},
            executor_fn=demo_executor,
            action_class="OBSERVE",
        )
        print(json.dumps(result.to_dict(), indent=2, default=str))
        return

    print("Usage:")
    print("  python3 somatic_envelope.py --test    # run test suite")
    print("  python3 somatic_envelope.py --demo    # demo with mock executor")
    print()
    print("Import and use:")
    print("  from somatic_envelope import SomaticEnvelope, wrap_call")


if __name__ == "__main__":
    main()
