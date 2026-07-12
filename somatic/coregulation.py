#!/usr/bin/env python3
"""
Co-Regulation Coupling — P5 of Somatic Kernel.

Reads human state from WELL organ → computes coupled state → produces
agent behavior adaptations. The agent adapts to the human, not the other way.

WELL reads state. arifOS judges. Arif decides.
Co-regulation adapts the agent's behavior to preserve human dignity.

Usage:
  from coregulation import CoRegulator

  reg = CoRegulator()
  state = reg.sense_human_state()        # read from WELL
  adaptations = reg.compute_adaptations(state)  # compute behavior changes
  reg.apply_to_envelope(envelope, adaptations)  # wire into somatic envelope

F6 MARUAH: Dignity-first. Never weaponize human state signals.
F9 ANTI-HANTU: No consciousness claims. Telemetry only.
DITEMPA BUKAN DIBERI — Forged 2026-07-12.
"""

import json
import sys
import urllib.request
import urllib.error
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

WELL_MCP = "http://localhost:18083"


# --- Data classes ---


@dataclass
class HumanState:
    """Observed human state from WELL. All values OBS/DER."""

    polyvagal: str = "unknown"  # ventral / sympathetic / dorsal
    fatigue: str = "unknown"  # LOW / MODERATE / HIGH / CRITICAL
    stress: str = "unknown"  # LOW / MODERATE / HIGH / CRITICAL
    clarity: float = 0.5  # 0.0-1.0 cognitive clarity
    confidence: float = 0.5  # 0.0-1.0 measurement confidence
    dignity_risk: str = "unknown"  # LOW / MODERATE / HIGH / CRITICAL
    flow_state: bool = False  # true if in flow
    autonomy_pressure: str = "unknown"  # low / medium / high
    competence_pressure: str = "unknown"
    relatedness_pressure: str = "unknown"
    posture: str = "unknown"  # governed posture from WELL
    vitality_color: str = "unknown"  # GREEN / YELLOW / RED
    vitality_gate: str = "unknown"  # ALLOW / RECOVER / BLOCK
    evidence_type: str = "unknown"  # inferred / observed / telemetry
    timestamp: str = ""
    # WELL posture modulation (set dynamically from classify_state)
    response_length_from_well: str = "medium"
    tone_from_well: str = "neutral"
    pacing_from_well: str = "normal"
    complexity_from_well: str = "normal"
    silence_tolerance_from_well: str = "medium"
    challenge_level_from_well: str = "normal"

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Adaptations:
    """Agent behavior adaptations based on human state."""

    response_length: str = "medium"  # short / medium / long
    tone: str = "neutral"  # gentle / neutral / direct / formal
    pacing: str = "normal"  # slow / normal / fast
    complexity: str = "normal"  # simple / normal / detailed
    silence_tolerance: str = "medium"  # low / medium / high
    challenge_level: str = "normal"  # low / normal / high
    tool_tier_ceiling: str = "FULL"  # OBSERVE / LIMITED / FULL
    defer_non_urgent: bool = False
    request_review: bool = False
    protective_posture: bool = False
    evidence_boost: float = 0.0  # add to confidence cap
    directives: list = field(default_factory=list)
    source: str = "coregulation"
    timestamp: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


# --- WELL integration ---


def mcp_call(base_url: str, tool_name: str, arguments: dict | None = None) -> dict:
    """Call an MCP tool via streamable HTTP JSON-RPC."""
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments or {},
        },
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{base_url}/mcp",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read())
            content = body.get("result", {}).get("content", [])
            if content and isinstance(content, list):
                text = content[0].get("text", "{}")
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    return {"_raw": text}
            return body.get("result", body)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as e:
        return {"_error": str(e)}


# --- Co-Regulator ---


class CoRegulator:
    """
    Reads human state from WELL → computes coupled state →
    produces agent behavior adaptations.

    Stateless per call. No persistent state.
    """

    def sense_human_state(self, message: str | None = None) -> HumanState:
        """
        Read human state from WELL organs.
        Returns HumanState with all available signals.
        """
        state = HumanState(timestamp=datetime.now(timezone.utc).isoformat())

        # 1. classify_state — polyvagal + SDT
        classify_args = {}
        if message:
            classify_args["message"] = message

        classify = mcp_call(WELL_MCP, "well_classify_state", classify_args)
        if "_error" not in classify:
            sv = classify.get("state_vector", {})
            state.polyvagal = sv.get("polyvagal", "unknown")
            state.confidence = sv.get("confidence", 0.5)

            sdt = sv.get("sdt_pressure", {})
            state.autonomy_pressure = sdt.get("autonomy", "unknown")
            state.competence_pressure = sdt.get("competence", "unknown")
            state.relatedness_pressure = sdt.get("relatedness", "unknown")

            gp = classify.get("governed_posture", {})
            state.posture = gp.get("posture", "unknown")

            pm = gp.get("posture_modulation", {})
            state.response_length_from_well = pm.get("response_length", "medium")
            state.tone_from_well = pm.get("tone", "neutral")
            state.pacing_from_well = pm.get("pacing", "normal")
            state.complexity_from_well = pm.get("complexity", "normal")
            state.silence_tolerance_from_well = pm.get("silence_tolerance", "medium")
            state.challenge_level_from_well = pm.get("challenge_level", "normal")

        # 2. validate_vitality — readiness envelope
        vitality = mcp_call(WELL_MCP, "well_validate_vitality", {"mode": "readiness"})
        if "_error" not in vitality:
            obs = vitality.get("observation", {})
            state.vitality_color = obs.get("color", "unknown")

            vg = vitality.get("vitality_gate", {})
            state.vitality_gate = vg.get("verdict", "unknown")

            # Extract substrate states
            h_well = vg.get("H_WELL", {})
            if isinstance(h_well, dict):
                h_state = h_well.get("state", "unknown")
                # Map H_WELL state to fatigue/stress
                if h_state == "READY":
                    state.fatigue = "LOW"
                    state.stress = "LOW"
                elif h_state == "DEGRADED":
                    state.fatigue = "MODERATE"
                    state.stress = "MODERATE"
                elif h_state == "CRITICAL":
                    state.fatigue = "HIGH"
                    state.stress = "HIGH"

            # Biometric data
            bio = vitality.get("observation", {}).get("biometric", {})
            if bio:
                state.clarity = bio.get("clarity", 5) / 10.0  # normalize to 0-1

        # 3. Derive dignity risk
        if state.polyvagal == "dorsal":
            state.dignity_risk = "HIGH"
        elif state.polyvagal == "sympathetic":
            state.dignity_risk = "MODERATE"
        else:
            state.dignity_risk = "LOW"

        # 4. Detect flow state (ventral + low pressure + high clarity)
        if (
            state.polyvagal == "ventral"
            and state.autonomy_pressure == "low"
            and state.clarity > 0.7
        ):
            state.flow_state = True

        return state

    def compute_adaptations(self, human_state: HumanState) -> Adaptations:
        """
        Compute agent behavior adaptations from human state.
        Deterministic rules, not LLM-generated.
        """
        adaptations = Adaptations(timestamp=datetime.now(timezone.utc).isoformat())

        # Use WELL's own posture modulation if available
        if hasattr(human_state, "response_length_from_well"):
            adaptations.response_length = getattr(
                human_state, "response_length_from_well", "medium"
            )
            adaptations.tone = getattr(human_state, "tone_from_well", "neutral")
            adaptations.pacing = getattr(human_state, "pacing_from_well", "normal")
            adaptations.complexity = getattr(
                human_state, "complexity_from_well", "normal"
            )
            adaptations.silence_tolerance = getattr(
                human_state, "silence_tolerance_from_well", "medium"
            )
            adaptations.challenge_level = getattr(
                human_state, "challenge_level_from_well", "normal"
            )

        # Override with specific state-based adaptations

        # Fatigue adaptations
        if human_state.fatigue in ("HIGH", "CRITICAL"):
            adaptations.response_length = "short"
            adaptations.defer_non_urgent = True
            adaptations.directives.append(
                "Human fatigued — shorter responses, defer non-urgent work"
            )

        # Stress adaptations
        if human_state.stress in ("HIGH", "CRITICAL"):
            adaptations.tone = "gentle"
            adaptations.complexity = "simple"
            adaptations.directives.append(
                "Human stressed — gentler tone, simpler explanations, more options"
            )

        # Flow state adaptations
        if human_state.flow_state:
            adaptations.silence_tolerance = "high"
            adaptations.challenge_level = "low"
            adaptations.directives.append(
                "Human in flow — minimal interruption, preserve state"
            )

        # Uncertainty adaptations
        if human_state.confidence < 0.4:
            adaptations.evidence_boost = 0.1
            adaptations.pacing = "slow"
            adaptations.request_review = True
            adaptations.directives.append(
                "Low evidence confidence — slow down, request review, add evidence"
            )

        # Dignity risk adaptations
        if human_state.dignity_risk in ("HIGH", "CRITICAL"):
            adaptations.protective_posture = True
            adaptations.tone = "gentle"
            adaptations.challenge_level = "low"
            adaptations.directives.append(
                "F6 MARUAH: dignity at risk — protective posture, no pressure"
            )

        # Vitality gate adaptations
        if human_state.vitality_gate == "BLOCK":
            adaptations.tool_tier_ceiling = "OBSERVE"
            adaptations.defer_non_urgent = True
            adaptations.directives.append("VITALITY BLOCK — observe only, no mutations")
        elif human_state.vitality_gate == "RECOVER":
            adaptations.tool_tier_ceiling = "LIMITED"
            adaptations.directives.append(
                "VITALITY RECOVER — limited tool tier, simplify"
            )

        # SDT pressure adaptations
        if human_state.autonomy_pressure == "high":
            adaptations.challenge_level = "low"
            adaptations.directives.append(
                "High autonomy pressure — reduce challenge, offer choices"
            )

        return adaptations

    def sense_and_adapt(self, message: str | None = None) -> dict:
        """One-shot: sense human state + compute adaptations."""
        human_state = self.sense_human_state(message)
        adaptations = self.compute_adaptations(human_state)
        return {
            "human_state": human_state.to_dict(),
            "adaptations": adaptations.to_dict(),
        }


# --- Convenience ---


def get_adaptations(message: str | None = None) -> Adaptations:
    """One-shot convenience function."""
    reg = CoRegulator()
    human_state = reg.sense_human_state(message)
    return reg.compute_adaptations(human_state)


# --- Test suite ---


def run_test() -> bool:
    """Test co-regulation with various human state scenarios."""
    tests = []
    reg = CoRegulator()

    # Test 1: Fatigued human → short responses, defer
    fatigued = HumanState(
        polyvagal="dorsal",
        fatigue="HIGH",
        stress="LOW",
        clarity=0.3,
        confidence=0.6,
        dignity_risk="HIGH",
    )
    a1 = reg.compute_adaptations(fatigued)
    tests.append(("Fatigued → short responses", a1.response_length == "short"))
    tests.append(("Fatigued → defer non-urgent", a1.defer_non_urgent is True))
    tests.append(("Fatigued → gentle tone", a1.tone == "gentle"))

    # Test 2: Flow state → minimal interruption
    flow = HumanState(
        polyvagal="ventral",
        fatigue="LOW",
        stress="LOW",
        clarity=0.9,
        confidence=0.8,
        dignity_risk="LOW",
        flow_state=True,
    )
    a2 = reg.compute_adaptations(flow)
    tests.append(("Flow → high silence tolerance", a2.silence_tolerance == "high"))
    tests.append(("Flow → low challenge", a2.challenge_level == "low"))

    # Test 3: Stressed human → gentle, simple
    stressed = HumanState(
        polyvagal="sympathetic",
        fatigue="LOW",
        stress="HIGH",
        clarity=0.5,
        confidence=0.5,
        dignity_risk="MODERATE",
    )
    a3 = reg.compute_adaptations(stressed)
    tests.append(("Stressed → gentle tone", a3.tone == "gentle"))
    tests.append(("Stressed → simple complexity", a3.complexity == "simple"))

    # Test 4: Low confidence → request review, slow down
    uncertain = HumanState(
        polyvagal="ventral",
        fatigue="LOW",
        stress="LOW",
        clarity=0.5,
        confidence=0.3,
        dignity_risk="LOW",
    )
    a4 = reg.compute_adaptations(uncertain)
    tests.append(("Uncertain → request review", a4.request_review is True))
    tests.append(("Uncertain → slow pacing", a4.pacing == "slow"))
    tests.append(("Uncertain → evidence boost", a4.evidence_boost > 0))

    # Test 5: Vitality BLOCK → observe only
    blocked = HumanState(
        polyvagal="dorsal",
        fatigue="CRITICAL",
        stress="CRITICAL",
        clarity=0.2,
        confidence=0.4,
        dignity_risk="CRITICAL",
        vitality_gate="BLOCK",
    )
    a5 = reg.compute_adaptations(blocked)
    tests.append(("Vitality BLOCK → OBSERVE tier", a5.tool_tier_ceiling == "OBSERVE"))
    tests.append(("Vitality BLOCK → defer", a5.defer_non_urgent is True))
    tests.append(("Vitality BLOCK → protective", a5.protective_posture is True))

    # Test 6: Healthy human → neutral defaults
    healthy = HumanState(
        polyvagal="ventral",
        fatigue="LOW",
        stress="LOW",
        clarity=0.8,
        confidence=0.8,
        dignity_risk="LOW",
    )
    a6 = reg.compute_adaptations(healthy)
    tests.append(("Healthy → medium response", a6.response_length == "medium"))
    tests.append(("Healthy → no defer", a6.defer_non_urgent is False))
    tests.append(("Healthy → FULL tier", a6.tool_tier_ceiling == "FULL"))

    # Test 7: Directives present
    tests.append(("Fatigued has directives", len(a1.directives) > 0))
    tests.append(("Stressed has directives", len(a3.directives) > 0))

    # Test 8: All adaptations have timestamps
    tests.append(("Adaptations have timestamp", a1.timestamp != ""))

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
        print("Co-Regulation Coupling — Test Suite")
        print("=" * 50)
        ok = run_test()
        sys.exit(0 if ok else 1)

    if len(sys.argv) > 1 and sys.argv[1] == "--live":
        # Live: read from WELL and show adaptations
        reg = CoRegulator()
        message = sys.argv[2] if len(sys.argv) > 2 else None
        result = reg.sense_and_adapt(message)
        print(json.dumps(result, indent=2))
        return

    print("Usage:")
    print("  python3 coregulation.py --test       # run test suite")
    print("  python3 coregulation.py --live        # live WELL reading")
    print("  python3 coregulation.py --live 'msg'  # with message context")
    print()
    print("Import and use:")
    print("  from coregulation import CoRegulator, get_adaptations")


if __name__ == "__main__":
    main()
