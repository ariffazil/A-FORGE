#!/usr/bin/env python3
"""
organ_activation_learner.py — Adaptive Context Metabolism (V0)
DITEMPA BUKAN DIBERI

Feedback loop: reads compiler predictions + agent execution logs, compares
predicted vs actual organ activation, outputs actionable diff.

V0 is READ-ONLY — produces a diff report + recommendations. Does NOT
auto-mutate weights. Weight mutation requires V1 (with arifFlow integration).

Architecture:
  Compile (→ compile_id + predicted.json)
    → Agent executes (→ activation_log.jsonl)
      → Learner compares (→ diff report + recommendations)
        → Human ratifies weight changes

Three questions V0 answers:
  1. What did the compiler predict?
  2. What did the agent actually use?
  3. Was the difference a compiler gap or correct escalation?

Output:
  - diff report (stdout)
  - activation_receipts.jsonl (append-only audit trail)
"""

import json
import sys
import os
from datetime import datetime, timezone
from pathlib import Path
from dataclasses import dataclass, field

# ─── PATHS ──────────────────────────────────────────────────────────────

ACTIVATION_LOG = Path(
    os.environ.get("ACTIVATION_LOG", "/root/.arifos/context/activation_log.jsonl")
)
RECEIPTS_PATH = Path(
    os.environ.get(
        "ACTIVATION_RECEIPTS", "/root/.arifos/context/activation_receipts.jsonl"
    )
)
WEIGHT_MAP_PATH = Path(
    os.environ.get(
        "ORGAN_ACTIVATION_MAP", "/root/.arifos/context/organ_activation_map.json"
    )
)

# ─── SCHEMA: ACTIVATION LOG ENTRY ──────────────────────────────────────
# Each line in activation_log.jsonl:
# {
#   "compile_id": "66e782e760c99994",     # from compiler output
#   "task": "assess thermal maturity...",  # task description
#   "timestamp": "2026-08-03T09:10:58Z",
#   "session_id": "SEAL-xxx",
#   "organs_activated": ["geox"],          # organs agent used tools from
#   "cross_organ_routes": [                # excluded organs agent routed to
#     {
#       "organ": "wealth",
#       "reason": "compiler_gap",          # compiler_gap | correct_escalation | unnecessary
#       "tool": "capital_primitive",
#       "note": "Task required NPV after maturity analysis"
#     }
#   ],
#   "task_outcome": "completed",           # completed | abandoned | escalated
#   "floor_verdict": "Pass",
#   "agent_notes": ""
# }

# ─── LEARNING POLICY ────────────────────────────────────────────────────

CONSERVATIVE_THRESHOLDS = {
    "note": 1,  # 1 occurrence → log, no action
    "weak": 2,  # 2 occurrences → weak signal
    "recommend": 3,  # 3 occurrences → recommend weight change
    "prior_update": 5,  # 5 occurrences → automatic prior update
}

# ─── DATA STRUCTURES ────────────────────────────────────────────────────


@dataclass
class ActivationDiff:
    """Difference between predicted and actual organ activation."""

    compile_id: str
    task: str

    # Predicted
    predicted_primary: str
    predicted_secondary: list[str]
    predicted_excluded: list[str]

    # Actual
    actual_organs_used: list[str]
    cross_organ_routes: list[dict]

    # Analysis
    compiler_gaps: list[str]  # organs that SHOULD have been activated
    correct_escalations: list[str]  # organs correctly routed to mid-task
    unnecessary_routes: list[str]  # organs used unnecessarily

    # Recommendations
    recommendations: list[str]  # human-readable actions

    # Metadata
    task_outcome: str = "unknown"
    confidence_delta: float = 0.0


# ─── LEARNER ────────────────────────────────────────────────────────────


class OrganActivationLearner:
    """V0: READ-ONLY. Compares predicted vs actual activation, produces diff."""

    def __init__(self):
        RECEIPTS_PATH.parent.mkdir(parents=True, exist_ok=True)

    def compare(
        self,
        prediction: dict,
        activation_log: dict,
    ) -> ActivationDiff:
        """Compare compiler prediction vs agent execution log."""

        pred = prediction.get("predicted", prediction)
        primary = pred.get("primary", "unknown")
        secondary = pred.get("secondary", [])
        excluded = pred.get("excluded", [])

        activated = activation_log.get("organs_activated", [])
        cross_routes = activation_log.get("cross_organ_routes", [])

        compiler_gaps = []
        correct_escalations = []
        unnecessary_routes = []

        for route in cross_routes:
            organ = route.get("organ", "unknown")
            reason = route.get("reason", "unknown")

            if reason == "compiler_gap":
                compiler_gaps.append(organ)
            elif reason == "correct_escalation":
                correct_escalations.append(organ)
            elif reason == "unnecessary":
                unnecessary_routes.append(organ)
            else:
                # Unknown reason — treat as compiler_gap (conservative)
                compiler_gaps.append(organ)

        recommendations = []
        for gap in compiler_gaps:
            recommendations.append(
                f"EXPAND: '{gap}' was excluded but agent needed it. "
                f"Consider promoting '{gap}' from excluded to secondary for similar tasks."
            )
        for esc in correct_escalations:
            recommendations.append(
                f"ROUTE_OK: '{esc}' was correctly escalated via arif_route. "
                f"No compiler change needed — routing worked as designed."
            )
        for unnec in unnecessary_routes:
            recommendations.append(
                f"NOISE: '{unnec}' was used unnecessarily. "
                f"Investigate if agent hallucinated or was distracted."
            )

        if not cross_routes:
            recommendations.append(
                "REINFORCE: Prediction was correct. No cross-organ routing needed."
            )

        return ActivationDiff(
            compile_id=prediction.get(
                "compile_id", activation_log.get("compile_id", "")
            ),
            task=activation_log.get("task", prediction.get("task", "")),
            predicted_primary=primary,
            predicted_secondary=secondary,
            predicted_excluded=excluded,
            actual_organs_used=activated,
            cross_organ_routes=cross_routes,
            compiler_gaps=compiler_gaps,
            correct_escalations=correct_escalations,
            unnecessary_routes=unnecessary_routes,
            recommendations=recommendations,
            task_outcome=activation_log.get("task_outcome", "unknown"),
        )

    def write_receipt(self, diff: ActivationDiff):
        """Append diff to activation_receipts.jsonl (immutable audit)."""
        receipt = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "compile_id": diff.compile_id,
            "task": diff.task,
            "predicted": {
                "primary": diff.predicted_primary,
                "secondary": diff.predicted_secondary,
                "excluded": diff.predicted_excluded,
            },
            "actual": {
                "organs_used": diff.actual_organs_used,
                "cross_organ_routes": diff.cross_organ_routes,
            },
            "analysis": {
                "compiler_gaps": diff.compiler_gaps,
                "correct_escalations": diff.correct_escalations,
                "unnecessary_routes": diff.unnecessary_routes,
            },
            "recommendations": diff.recommendations,
            "task_outcome": diff.task_outcome,
        }
        with open(RECEIPTS_PATH, "a") as f:
            f.write(json.dumps(receipt, ensure_ascii=False) + "\n")

    def print_report(self, diff: ActivationDiff):
        """Human-readable diff report."""
        print(f"""
╔══════════════════════════════════════════════════════════════╗
║     ORGAN ACTIVATION LEARNER — Prediction vs Actual Diff     ║
╠══════════════════════════════════════════════════════════════╣
║ compile_id: {diff.compile_id:<50} ║
║ Task: {diff.task[:55]:<55} ║
╠══════════════════════════════════════════════════════════════╣
║ PREDICTED (compiler)                                        ║
║   Primary:   {diff.predicted_primary:<52} ║
║   Secondary: {", ".join(diff.predicted_secondary) or "(none)":<52} ║
║   Excluded:  {", ".join(diff.predicted_excluded):<52} ║
╠══════════════════════════════════════════════════════════════╣
║ ACTUAL (agent execution)                                    ║
║   Organs used:     {", ".join(diff.actual_organs_used) or "(none)":<39} ║
║   Cross-organ:     {len(diff.cross_organ_routes)} route(s)                           ║
║   Task outcome:    {diff.task_outcome:<39} ║
╠══════════════════════════════════════════════════════════════╣
║ ANALYSIS                                                    ║""")
        for route in diff.cross_organ_routes:
            organ = route.get("organ", "?")
            reason = route.get("reason", "?")
            tool = route.get("tool", "?")
            note = route.get("note", "")
            print(f"║   {organ:<12} → {reason:<20} via {tool:<20} ║")
            if note:
                print(f"║          note: {note[:45]:<45} ║")

        print(f"""╠══════════════════════════════════════════════════════════════╣
║ RECOMMENDATIONS                                             ║""")
        for r in diff.recommendations:
            symbol = {
                "EXPAND": "📈",
                "ROUTE_OK": "✅",
                "NOISE": "⚠️",
                "REINFORCE": "🔒",
            }.get(r.split(":")[0], "📝")
            print(f"║ {symbol} {r[:55]:<55} ║")

        print(f"""╠══════════════════════════════════════════════════════════════╣
║ SUMMARY                                                     ║
║   Compiler gaps:       {len(diff.compiler_gaps):<3} (organs that SHOULD have been active) ║
║   Correct escalations: {len(diff.correct_escalations):<3} (routing worked as designed)       ║
║   Unnecessary routes:  {len(diff.unnecessary_routes):<3} (noise / hallucination)             ║
╠══════════════════════════════════════════════════════════════╣
║ Receipt: {RECEIPTS_PATH} ║
╚══════════════════════════════════════════════════════════════╝""")


# ─── CLI ────────────────────────────────────────────────────────────────


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Organ Activation Learner — compare compiler predictions vs agent execution."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # diff command: compare one prediction vs one activation log
    diff_cmd = sub.add_parser("diff", help="Compare prediction vs activation log")
    diff_cmd.add_argument(
        "--prediction", help="Path to compiler JSON output (manual mode)"
    )
    diff_cmd.add_argument(
        "--activation", help="Path to activation log JSONL entry (manual mode)"
    )
    diff_cmd.add_argument(
        "--from-compile",
        help="Path to .compile.json from context_boot.sh. Auto-resolves activation log by compile_id.",
    )
    diff_cmd.add_argument(
        "--save", action="store_true", help="Write receipt to activation_receipts.jsonl"
    )

    # history command
    hist_cmd = sub.add_parser("history", help="Show activation receipt history")
    hist_cmd.add_argument("--limit", type=int, default=10)

    # schema command
    schema_cmd = sub.add_parser("schema", help="Show the activation log schema")

    args = parser.parse_args()
    learner = OrganActivationLearner()

    if args.command == "diff":
        # ── --from-compile mode: auto-resolve activation by compile_id ──
        if args.from_compile:
            with open(args.from_compile) as f:
                prediction = json.load(f)
            compile_id = prediction.get("compile_id")
            if not compile_id:
                print("❌ No compile_id in prediction JSON. Cannot auto-resolve.")
                sys.exit(1)
            # Find matching activation log entry
            if not ACTIVATION_LOG.exists():
                print(
                    f"❌ No activation log at {ACTIVATION_LOG}. Agent hasn't logged any tasks yet."
                )
                sys.exit(1)
            activation = None
            with open(ACTIVATION_LOG) as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    entry = json.loads(line)
                    if entry.get("compile_id") == compile_id:
                        activation = entry
                        break
            if activation is None:
                print(
                    f"❌ No activation log entry for compile_id={compile_id}. "
                    f"Agent hasn't logged a task with this compile_id yet. "
                    f"Did the agent write to {ACTIVATION_LOG}?"
                )
                sys.exit(1)
            print(f"🔗 Auto-resolved: compile_id={compile_id}")
            print(f"   Prediction: {args.from_compile}")
            print(f"   Activation: {ACTIVATION_LOG} (entry matched by compile_id)")
            print()
        else:
            if not args.prediction or not args.activation:
                print(
                    "❌ Either (--prediction + --activation) or --from-compile is required."
                )
                sys.exit(1)
            with open(args.prediction) as f:
                prediction = json.load(f)
            with open(args.activation) as f:
                content = f.read().strip()
                # Try single JSON object first, fall back to JSONL (last line)
                try:
                    activation = json.loads(content)
                except json.JSONDecodeError:
                    activation = json.loads(content.split("\n")[-1])

        diff = learner.compare(prediction, activation)
        learner.print_report(diff)

        if args.save:
            learner.write_receipt(diff)
            print("✅ Receipt written.")

    elif args.command == "history":
        if RECEIPTS_PATH.exists():
            lines = RECEIPTS_PATH.read_text().strip().split("\n")
            for line in lines[-args.limit :]:
                r = json.loads(line)
                gaps = len(r.get("analysis", {}).get("compiler_gaps", []))
                esc = len(r.get("analysis", {}).get("correct_escalations", []))
                print(
                    f"{r['timestamp'][:19]} | {r['task'][:35]:<35} | gaps={gaps} esc={esc} | {r['recommendations'][0][:40] if r.get('recommendations') else 'none'}"
                )
        else:
            print("No receipts yet.")

    elif args.command == "schema":
        print("""
ACTIVATION LOG SCHEMA (activation_log.jsonl):

Each line is a JSON object. The agent writes one line per task completion.

{
  "compile_id": "66e782e760c99994",       // from compiler output (required)
  "task": "assess thermal maturity...",    // task description (required)
  "timestamp": "2026-08-03T09:10:58Z",    // ISO 8601 (required)
  "session_id": "SEAL-xxx",               // arifOS session ID (optional)
  "organs_activated": ["geox"],           // organs the agent used tools from
  "cross_organ_routes": [                 // excluded organs the agent routed to
    {
      "organ": "wealth",                  // which organ
      "reason": "compiler_gap",           // compiler_gap | correct_escalation | unnecessary
      "tool": "capital_primitive",        // which tool was called
      "note": "Task required NPV"         // free-text explanation
    }
  ],
  "task_outcome": "completed",            // completed | abandoned | escalated
  "floor_verdict": "Pass",                // constitutional verdict
  "agent_notes": ""                       // free-text
}

REASON CLASSIFICATION:
  compiler_gap      - The compiler SHOULD have activated this organ but didn't
  correct_escalation - Agent correctly used arif_route to reach this organ mid-task
  unnecessary        - Agent used this organ without need (hallucination / noise)
""")


if __name__ == "__main__":
    main()
