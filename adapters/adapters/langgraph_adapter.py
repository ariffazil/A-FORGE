#!/usr/bin/env python3
"""
LangGraph Adapter — arifOS Constitutional Admission Controller for Agentic Workflows.

Any LangGraph (or compatible) workflow can call this adapter to:
1. Check each step against F1-F13 before execution
2. Record each step to the Reality Ledger
3. Block/flag dangerous transitions

Usage:
    adapter = LangGraphArifOSAdapter()
    result = adapter.run_workflow(steps, context)
    print(result["trace"])
"""

import sys
from datetime import datetime, timezone
from typing import Any, Callable

sys.path.insert(0, "/root")
from core.constitutional_gate import gate_action

# Import Reality Ledger
sys.path.insert(0, "/root/core")
try:
    from reality_ledger import record_event as _record_ledger_event
except ImportError:
    def _record_ledger_event(*args, **kwargs):
        return {"id": "ledger_unavailable", "status": "bypassed"}


class LangGraphArifOSAdapter:
    """Wraps any workflow step with arifOS constitutional admission control."""

    def __init__(self, auto_record_ledger: bool = True):
        self.auto_record_ledger = auto_record_ledger
        self.trace: list[dict] = []
        self._event_counter = 0

    def _next_event_id(self) -> str:
        self._event_counter += 1
        return f"lg-adapter-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}-{self._event_counter:04d}"

    def check_step(
        self,
        step_name: str,
        action_class: str = "mutate",
        reversible: bool = True,
        blast_radius: str = "low",
        human_impact: str = "none",
        secret_touching: bool = False,
        has_receipt: bool = True,
    ) -> dict[str, Any]:
        """Check a single workflow step against the constitution."""
        result = gate_action(
            action_class=action_class,
            intent=step_name,
            reversible=reversible,
            blast_radius=blast_radius,
            human_impact=human_impact,
            secret_touching=secret_touching,
            has_receipt=has_receipt,
        )

        step_record = {
            "step": step_name,
            "action_class": action_class,
            "verdict": result["verdict"],
            "allowed": result["allowed"],
            "floors_checked": result["floors_checked"],
            "floors_violated": result["floors_violated"],
            "message": result["message"],
            "timestamp": result["timestamp"],
        }
        self.trace.append(step_record)

        if self.auto_record_ledger:
            try:
                _record_ledger_event({
                    "id": self._next_event_id(),
                    "actor": "langgraph_adapter",
                    "intent": step_name,
                    "action_class": action_class,
                    "organs_consulted": ["arifOS", "A-FORGE"],
                    "prediction": {
                        "expected_outcome": "constitutional_check",
                        "confidence": 0.95,
                    },
                    "arifos_verdict": {
                        "verdict": "SEAL" if result["allowed"] else "HOLD",
                        "floors_triggered": result["floors_violated"] or result["floors_checked"][:3],
                    },
                })
            except Exception:
                pass  # Ledger write is advisory, not blocking

        return result

    def run_step(
        self,
        step_name: str,
        step_fn: Callable,
        action_class: str = "mutate",
        reversible: bool = True,
        blast_radius: str = "low",
        **kwargs,
    ) -> tuple[bool, Any]:
        """Check, then run a step. Returns (allowed, result)."""
        check = self.check_step(
            step_name=step_name,
            action_class=action_class,
            reversible=reversible,
            blast_radius=blast_radius,
        )

        if not check["allowed"]:
            return False, check["message"]

        result = step_fn(**kwargs)
        return True, result

    def run_workflow(
        self,
        steps: list[dict],
        context: dict | None = None,
    ) -> dict:
        """Run a full workflow with constitutional checks before each step.

        steps: list of {
            "name": str,
            "fn": Callable,  # or None for dry-run
            "action_class": str,
            "reversible": bool,
            "blast_radius": str,
            "args": dict,  # passed to fn
        }

        Returns:
        {
            "passed": bool,
            "steps_passed": int,
            "steps_blocked": int,
            "trace": [...],
        }
        """
        context = context or {}
        passed = 0
        blocked = 0

        for step in steps:
            check = self.check_step(
                step_name=step.get("name", "unnamed"),
                action_class=step.get("action_class", "mutate"),
                reversible=step.get("reversible", True),
                blast_radius=step.get("blast_radius", "low"),
                human_impact=step.get("human_impact", "none"),
                secret_touching=step.get("secret_touching", False),
            )

            if not check["allowed"]:
                blocked += 1
                continue

            if step.get("fn"):
                try:
                    step["fn"](**(step.get("args") or {}))
                except Exception as e:
                    self.trace.append({
                        "step": step.get("name"),
                        "error": str(e),
                    })
                    blocked += 1
                    continue

            passed += 1

        return {
            "passed": blocked == 0,
            "steps_total": len(steps),
            "steps_passed": passed,
            "steps_blocked": blocked,
            "trace": self.trace,
        }


# Demo / self-test
if __name__ == "__main__":
    print("=== LangGraph Adapter Demo ===")
    adapter = LangGraphArifOSAdapter()

    # Step 1: safe observe
    result = adapter.check_step("read_config_file", action_class="observe")
    print(f"  read_config: {'✅ ALLOWED' if result['allowed'] else '❌ BLOCKED'}")

    # Step 2: risky mutate without rollback
    result = adapter.check_step(
        "delete_database", action_class="mutate",
        reversible=False, blast_radius="high",
    )
    print(f"  delete_db:    {'✅ ALLOWED' if result['allowed'] else '❌ BLOCKED (' + result['verdict'] + ')'}")

    # Step 3: safe mutate with rollback
    result = adapter.check_step(
        "deploy_updated_config", action_class="mutate",
        reversible=True, blast_radius="medium", has_receipt=True,
    )
    print(f"  deploy:       {'✅ ALLOWED' if result['allowed'] else '❌ BLOCKED'}")

    # Full workflow demo
    workflow_result = adapter.run_workflow([
        {"name": "validate_inputs", "action_class": "observe"},
        {"name": "compute_model", "action_class": "propose"},
        {"name": "save_results", "action_class": "mutate", "reversible": True},
        {"name": "delete_backups", "action_class": "mutate", "reversible": False, "blast_radius": "high"},
    ])
    print(f"\n  Workflow: {workflow_result['steps_passed']} passed, {workflow_result['steps_blocked']} blocked")

    print("\nAdapter operational. Ready for LangGraph integration.")
