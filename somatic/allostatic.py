#!/usr/bin/env python3
"""
Allostatic Preparation — P6 of Somatic Kernel.

Pre-fetches and pre-allocates resources based on predicted demand.
Like how the body prepares for exercise before you start moving —
the system prepares for anticipated tasks before they execute.

Scenarios:
  1. Before long audit → allocate more context
  2. Before irreversible decision → gather witnesses
  3. Before tool call → prefetch schema
  4. When transport degraded → lower autonomy

Usage:
  from allostatic import AllostaticPlanner

  planner = AllostaticPlanner()
  prep = planner.prepare(
      task_description="Full federation audit",
      action_class="MUTATE",
      reversibility="IRREVERSIBLE",
  )
  # prep.preparations — list of resource allocations
  # prep.autonomy_adjustment — lowered if transport degraded

F7 HUMILITY: Predictions are ESTIMATE, not OBS.
F2 TRUTH: All preparations are advisory, not mandatory.
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

# --- Constants ---
CONTEXT_THRESHOLD_LONG_TASK = 0.7  # if context already high, pre-allocate
LATENCY_DEGRADED_MS = 1000  # latency above this = degraded transport
ORGAN_DOWN_THRESHOLD = 1  # any organ down = degraded


@dataclass
class Preparation:
    """A single resource preparation."""

    resource: str  # what is being prepared
    action: str  # what to do (pre_fetch, pre_allocate, lower, gather)
    reason: str  # why this preparation is needed
    priority: str  # LOW / MEDIUM / HIGH / CRITICAL
    estimated_cost: str  # LOW / MEDIUM / HIGH
    reversible: bool  # can this preparation be undone
    evidence_class: str  # OBS / DER / INT / SPEC


@dataclass
class PreparationReport:
    """Full allostatic preparation report."""

    task_description: str
    action_class: str
    reversibility: str
    preparations: list = field(default_factory=list)
    autonomy_adjustment: str = "FULL"  # FULL / LIMITED / OBSERVE
    transport_state: str = "UNKNOWN"  # NOMINAL / DEGRADED / CRITICAL
    context_pressure: float = 0.0  # 0.0-1.0
    witness_gap: bool = False  # True if witnesses needed but missing
    timestamp: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        d["preparations"] = [asdict(p) for p in self.preparations]
        return d


class AllostaticPlanner:
    """
    Analyzes upcoming tasks and pre-allocates resources.
    Stateless per call.
    """

    def __init__(self):
        self._preparation_history: list[dict] = []

    def prepare(
        self,
        task_description: str = "",
        action_class: str = "OBSERVE",
        reversibility: str = "FULL",
        tools_needed: list[str] | None = None,
    ) -> PreparationReport:
        """
        Analyze task and produce preparation report.
        Deterministic rules, not LLM-generated.
        """
        report = PreparationReport(
            task_description=task_description,
            action_class=action_class,
            reversibility=reversibility,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

        # 1. Check transport state
        transport = self._check_transport()
        report.transport_state = transport.get("state", "UNKNOWN")

        # 2. Check context pressure
        context = self._check_context()
        report.context_pressure = context.get("pressure", 0.0)

        # 3. Generate preparations based on task analysis
        preparations = []

        # Scenario 1: Long audit → allocate more context
        if self._is_long_task(task_description, action_class):
            preparations.append(
                Preparation(
                    resource="context_window",
                    action="pre_allocate",
                    reason="Long task detected — allocate additional context capacity",
                    priority="MEDIUM",
                    estimated_cost="LOW",
                    reversible=True,
                    evidence_class="DER",
                )
            )

        # Scenario 2: Irreversible decision → gather witnesses
        if reversibility in ("IRREVERSIBLE", "PARTIAL"):
            preparations.append(
                Preparation(
                    resource="witnesses",
                    action="gather",
                    reason="Irreversible action — tri-witness (Human × AI × External) required",
                    priority="HIGH",
                    estimated_cost="MEDIUM",
                    reversible=False,
                    evidence_class="DER",
                )
            )
            report.witness_gap = True

        # Scenario 3: Tool call → prefetch schema
        if tools_needed:
            for tool in tools_needed:
                preparations.append(
                    Preparation(
                        resource=f"schema:{tool}",
                        action="pre_fetch",
                        reason=f"Tool {tool} schema pre-fetched for faster execution",
                        priority="LOW",
                        estimated_cost="LOW",
                        reversible=True,
                        evidence_class="INT",
                    )
                )

        # Scenario 4: Transport degraded → lower autonomy
        if transport.get("state") == "DEGRADED":
            preparations.append(
                Preparation(
                    resource="autonomy_level",
                    action="lower",
                    reason="Transport degraded — reducing tool call frequency, caching aggressively",
                    priority="HIGH",
                    estimated_cost="LOW",
                    reversible=True,
                    evidence_class="OBS",
                )
            )
            report.autonomy_adjustment = "LIMITED"
        elif transport.get("state") == "CRITICAL":
            preparations.append(
                Preparation(
                    resource="autonomy_level",
                    action="lower",
                    reason="Transport critical — observe only, no mutations",
                    priority="CRITICAL",
                    estimated_cost="LOW",
                    reversible=True,
                    evidence_class="OBS",
                )
            )
            report.autonomy_adjustment = "OBSERVE"

        # Context pressure mitigation
        if context.get("pressure", 0) > CONTEXT_THRESHOLD_LONG_TASK:
            preparations.append(
                Preparation(
                    resource="output_compression",
                    action="pre_allocate",
                    reason="Context pressure high — compress output, defer non-essential detail",
                    priority="MEDIUM",
                    estimated_cost="LOW",
                    reversible=True,
                    evidence_class="DER",
                )
            )

        # Organ degradation preparation
        organs_down = transport.get("organs_down", [])
        if organs_down:
            for organ in organs_down:
                preparations.append(
                    Preparation(
                        resource=f"route_fallback:{organ}",
                        action="pre_fetch",
                        reason=f"Organ {organ} down — prepare fallback routing",
                        priority="HIGH",
                        estimated_cost="LOW",
                        reversible=True,
                        evidence_class="OBS",
                    )
                )

        report.preparations = preparations

        # Record in history
        self._preparation_history.append(
            {
                "task": task_description[:100],
                "preparations_count": len(preparations),
                "autonomy": report.autonomy_adjustment,
                "transport": report.transport_state,
                "timestamp": report.timestamp,
            }
        )

        return report

    def _check_transport(self) -> dict:
        """Check transport health (organs, latency)."""
        organs = {
            "arifos": 8088,
            "aforge": 7071,
            "aaa": 3001,
            "geox": 8081,
            "wealth": 18082,
            "well": 18083,
        }
        down = []
        total_latency = 0
        checked = 0

        for name, port in organs.items():
            try:
                req = urllib.request.Request(f"http://localhost:{port}/health")
                import time

                start = time.monotonic()
                with urllib.request.urlopen(req, timeout=3) as resp:
                    latency = int((time.monotonic() - start) * 1000)
                    total_latency += latency
                    checked += 1
            except Exception:
                down.append(name)

        avg_latency = total_latency // max(checked, 1)

        if len(down) >= 3:
            state = "CRITICAL"
        elif len(down) >= 1 or avg_latency > LATENCY_DEGRADED_MS:
            state = "DEGRADED"
        else:
            state = "NOMINAL"

        return {
            "state": state,
            "organs_down": down,
            "avg_latency_ms": avg_latency,
            "organs_checked": checked,
        }

    def _check_context(self) -> dict:
        """Check context pressure from somatic state."""
        state_path = Path("/root/A-FORGE/somatic/somatic_state.yaml")
        if not state_path.exists():
            return {"pressure": 0.0, "source": "no_state"}

        try:
            # Simple read of context_utilization from YAML
            text = state_path.read_text()
            for line in text.split("\n"):
                if "context_utilization:" in line:
                    val = line.split(":")[-1].strip()
                    try:
                        return {"pressure": float(val), "source": "somatic_state"}
                    except ValueError:
                        pass
        except Exception:
            pass

        return {"pressure": 0.0, "source": "parse_failed"}

    def _is_long_task(self, description: str, action_class: str) -> bool:
        """Detect if task is likely long-running."""
        long_keywords = [
            "audit",
            "review",
            "full",
            "comprehensive",
            "migration",
            "refactor",
            "all",
            "entire",
            "complete",
            "deep",
            "scan",
        ]
        desc_lower = description.lower()
        return any(kw in desc_lower for kw in long_keywords) or action_class in (
            "EXECUTE",
            "IRREVERSIBLE",
        )

    def get_history(self) -> list[dict]:
        """Return preparation history."""
        return self._preparation_history.copy()


# --- Convenience ---


def prepare_for_task(
    task_description: str = "",
    action_class: str = "OBSERVE",
    reversibility: str = "FULL",
    tools_needed: list[str] | None = None,
) -> PreparationReport:
    """One-shot convenience function."""
    planner = AllostaticPlanner()
    return planner.prepare(
        task_description=task_description,
        action_class=action_class,
        reversibility=reversibility,
        tools_needed=tools_needed,
    )


# --- Test suite ---


def run_test() -> bool:
    """Test allostatic preparation scenarios."""
    tests = []
    planner = AllostaticPlanner()

    # Test 1: Long audit → context pre-allocation
    r1 = planner.prepare(
        task_description="Full federation audit of all organs",
        action_class="EXECUTE",
        reversibility="FULL",
    )
    context_prep = [p for p in r1.preparations if p.resource == "context_window"]
    tests.append(("Long audit → context pre-allocated", len(context_prep) > 0))

    # Test 2: Irreversible → witness gathering
    r2 = planner.prepare(
        task_description="Delete old data",
        action_class="IRREVERSIBLE",
        reversibility="IRREVERSIBLE",
    )
    witness_prep = [p for p in r2.preparations if p.resource == "witnesses"]
    tests.append(("Irreversible → witnesses gathered", len(witness_prep) > 0))
    tests.append(("Irreversible → witness_gap=True", r2.witness_gap is True))

    # Test 3: Tool call → schema prefetch
    r3 = planner.prepare(
        task_description="Run seismic analysis",
        action_class="OBSERVE",
        reversibility="FULL",
        tools_needed=["geox_seismic_compute", "geox_well_tie"],
    )
    schema_preps = [p for p in r3.preparations if "schema:" in p.resource]
    tests.append(("Tool call → schemas prefetched", len(schema_preps) == 2))

    # Test 4: Simple task → minimal preparations
    r4 = planner.prepare(
        task_description="Read a file",
        action_class="OBSERVE",
        reversibility="FULL",
    )
    tests.append(("Simple task → few preparations", len(r4.preparations) <= 1))

    # Test 5: All preparations have evidence class
    all_have_class = all(p.evidence_class for p in r1.preparations)
    tests.append(("All preparations have evidence class", all_have_class))

    # Test 6: Report has timestamp
    tests.append(("Report has timestamp", r1.timestamp != ""))

    # Test 7: Autonomy adjustment is set
    tests.append(
        ("Autonomy adjustment is string", isinstance(r1.autonomy_adjustment, str))
    )

    # Test 8: Transport state is set
    tests.append(
        (
            "Transport state is set",
            r1.transport_state in ("NOMINAL", "DEGRADED", "CRITICAL", "UNKNOWN"),
        )
    )

    # Test 9: Preparation history accumulates
    history = planner.get_history()
    tests.append(("History accumulates", len(history) >= 4))

    # Test 10: Reversible preparations
    reversible_count = sum(1 for p in r1.preparations if p.reversible)
    tests.append(
        (
            "Most preparations are reversible",
            reversible_count >= len(r1.preparations) // 2,
        )
    )

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
        print("Allostatic Preparation — Test Suite")
        print("=" * 50)
        ok = run_test()
        sys.exit(0 if ok else 1)

    if len(sys.argv) > 1 and sys.argv[1] == "--demo":
        planner = AllostaticPlanner()
        report = planner.prepare(
            task_description="Full comprehensive federation audit with deployment",
            action_class="EXECUTE",
            reversibility="IRREVERSIBLE",
            tools_needed=["forge_shell", "forge_git", "forge_docker"],
        )
        print(json.dumps(report.to_dict(), indent=2))
        return

    print("Usage:")
    print("  python3 allostatic.py --test    # run test suite")
    print("  python3 allostatic.py --demo    # demo with audit scenario")
    print()
    print("Import and use:")
    print("  from allostatic import AllostaticPlanner, prepare_for_task")


if __name__ == "__main__":
    main()
