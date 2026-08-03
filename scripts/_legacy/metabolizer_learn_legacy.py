#!/usr/bin/env python3
"""
metabolizer_learn.py — Adaptive Context Metabolizer (V0)
DITEMPA BUKAN DIBERI

Feedback layer for adaptive context metabolism.
Reads consequence from execution, compares predicted vs actual organ activation,
then adjusts compiler priors for next session.

Architecture:
  Compiler predicts → Agent executes → arifFlow records → Metabolizer learns → Next compile improves

V0 answers four questions:
  1. What did compiler predict?
  2. What did agent actually use?
  3. Was the difference useful or noisy?
  4. What weight should change next time?

Learning policy (conservative):
  1 occurrence  = NOTE (log, no weight change)
  2 occurrences = WEAK association (+0.05 weight)
  3 occurrences = RECOMMEND secondary organ (+0.10)
  5 occurrences = PRIOR_UPDATE (becomes default, +0.15)

Constitutional rules are NEVER auto-updated. This tunes routing, not law.
"""

import json
import sys
import os
from datetime import datetime, timezone
from pathlib import Path
from dataclasses import dataclass, field

# ─── CONFIG ────────────────────────────────────────────────────────────

WEIGHT_MAP_PATH = Path(
    os.environ.get(
        "METABOLIZER_WEIGHT_MAP", "/root/.arifos/context/organ_weight_map.json"
    )
)
RECEIPTS_PATH = Path(
    os.environ.get(
        "METABOLIZER_RECEIPTS", "/root/.arifos/context/metabolizer_receipts.jsonl"
    )
)
OCCURRENCE_PATH = Path(
    os.environ.get(
        "METABOLIZER_OCCURRENCES", "/root/.arifos/context/cross_organ_occurrences.json"
    )
)

LEARNING_POLICY = {
    "threshold_note": 1,
    "threshold_weak": 2,
    "threshold_recommend": 3,
    "threshold_prior_update": 5,
    "max_weight": 1.0,
    "min_weight": 0.0,
    "learn_rate": 0.05,
}

IMMUTABLE_RULES = [
    "F9_ANTI_HANTU",
    "F10_ONTOLOGY",
    "F13_SOVEREIGN",
    "F1_AMANAH",
    "BEKOK_DEEP_1",
    "AUTHORITY_BOUNDARY",
]

# Keywords that must NEVER be auto-learned — they map to constitutional domains.
# These keywords are hardcoded in context_compile.py's organ registry for arifos.
# Auto-learning a weight for them would dilute constitutional routing.
IMMUTABLE_KEYWORDS = {
    "sovereign",
    "arifos",
    "amanah",
    "truth",
    "clarity",
    "humility",
    "anti-hantu",
    "ontology",
    "auditability",
    "resilience",
    "maruah",
    "governance",
    "constitution",
    "verdict",
    "void",
    "hold",
    "sabar",
    "seal",
    "judge",
    "floor",
    "f1",
    "f2",
    "f3",
    "f4",
    "f5",
    "f6",
    "f7",
    "f8",
    "f9",
    "f10",
    "f11",
    "f12",
    "f13",
}

# ─── DATA STRUCTURES ───────────────────────────────────────────────────


@dataclass
class OrganActivation:
    """Records which organs the agent actually used during a task."""

    task: str
    primary_used: str
    secondary_used: list[str] = field(default_factory=list)
    excluded_but_routed: list[str] = field(default_factory=list)
    irrelevant_used: list[str] = field(default_factory=list)
    failure_signals: list[str] = field(default_factory=list)
    success: bool = True


@dataclass
class CompilerPrediction:
    """Records what the compiler predicted for a task."""

    task: str
    primary: str
    secondary: list[str] = field(default_factory=list)
    excluded: list[str] = field(default_factory=list)
    reduction_pct: float = 0.0


@dataclass
class LearningVerdict:
    """What the metabolizer decided to do."""

    action: str  # REINFORCE | EXPAND | SUPPRESS | HOLD | NOTE
    organ: str
    delta: float
    reason: str
    occurrence_count: int = 0


@dataclass
class MetabolizerReceipt:
    """Immutable audit trail entry."""

    timestamp: str
    task: str
    prediction: dict
    actual: dict
    verdicts: list[dict]
    weight_changes: dict
    session_id: str = ""


# ─── METABOLIZER ENGINE ────────────────────────────────────────────────


class AdaptiveContextMetabolizer:
    """
    V0 metabolizer: compares predicted vs actual organ usage,
    updates keyword-to-organ weights conservatively.

    NEVER mutates constitutional rules. All mutations are logged.
    """

    def __init__(self, weight_map_path: Path = WEIGHT_MAP_PATH):
        self.weight_map_path = weight_map_path
        self.weights = self._load_weights()
        self.occurrences = self._load_occurrences()

    def _load_weights(self) -> dict:
        if self.weight_map_path.exists():
            return json.loads(self.weight_map_path.read_text())
        return {"_meta": {}, "keywords": {}}

    def _save_weights(self):
        self.weight_map_path.write_text(
            json.dumps(self.weights, indent=2, ensure_ascii=False)
        )

    def _load_occurrences(self) -> dict:
        """Load cross-organ occurrence tracker."""
        path = OCCURRENCE_PATH
        if path.exists():
            return json.loads(path.read_text())
        return {}

    def _save_occurrences(self):
        OCCURRENCE_PATH.write_text(json.dumps(self.occurrences, indent=2))

    # ─── CORE: COMPARE PREDICTED vs ACTUAL ─────────────────────────

    def compare(
        self,
        prediction: CompilerPrediction,
        actual: OrganActivation,
        session_id: str = "",
    ) -> tuple[list[LearningVerdict], MetabolizerReceipt]:
        """Compare predicted vs actual organ usage and produce learning verdicts."""
        verdicts: list[LearningVerdict] = []
        weight_changes: dict[str, dict] = {}
        now = datetime.now(timezone.utc).isoformat()

        # ── Case 1: Primary organ correct → REINFORCE ──
        if actual.primary_used == prediction.primary:
            verdicts.append(
                LearningVerdict(
                    action="REINFORCE",
                    organ=prediction.primary,
                    delta=0.0,
                    reason=f"Primary organ '{prediction.primary}' was correct — no change needed.",
                )
            )

        # ── Case 2: Excluded organ was routed → EXPAND ──
        for organ in actual.excluded_but_routed:
            if self._is_immutable(organ):
                verdicts.append(
                    LearningVerdict(
                        action="HOLD",
                        organ=organ,
                        delta=0.0,
                        reason=f"'{organ}' is constitutionally immutable — cannot auto-adjust weights.",
                    )
                )
                continue

            # Track occurrences
            cross_key = f"{prediction.primary}→{organ}"
            self.occurrences.setdefault(
                cross_key,
                {
                    "count": 0,
                    "tasks": [],
                    "first_seen": now,
                },
            )
            occ = self.occurrences[cross_key]
            occ["count"] += 1
            occ["tasks"].append(actual.task)
            occ["last_seen"] = now

            count = occ["count"]
            delta = self._compute_delta(count)
            action = self._compute_action(count)

            # Update keyword weights for the routed organ
            keywords = self._extract_keywords(actual.task)
            for kw in keywords:
                kw_entry = self.weights.setdefault("keywords", {}).setdefault(kw, {})
                current = kw_entry.get(organ, 0.0)
                kw_entry[organ] = min(LEARNING_POLICY["max_weight"], current + delta)
                if "description" not in kw_entry:
                    kw_entry["description"] = (
                        f"Auto-learned: {prediction.primary}→{organ}"
                    )

            verdicts.append(
                LearningVerdict(
                    action=action,
                    organ=organ,
                    delta=delta,
                    reason=f"'{organ}' was excluded but routed via arif_route. "
                    f"({count} occurrences, +{delta:.2f} weight for keywords: {', '.join(keywords[:3])})",
                    occurrence_count=count,
                )
            )
            weight_changes[organ] = {
                "delta": delta,
                "action": action,
                "occurrences": count,
                "keywords_affected": keywords[:5],
            }

        # ── Case 3: Irrelevant organ used → noisy activation ──
        for organ in actual.irrelevant_used:
            if self._is_immutable(organ):
                continue
            verdicts.append(
                LearningVerdict(
                    action="NOTE",
                    organ=organ,
                    delta=0.0,
                    reason=f"'{organ}' was used but wasn't predicted or needed — noisy activation, no weight change.",
                )
            )

        # ── Case 4: Agent failed before routing → risk signal ──
        if not actual.success and actual.failure_signals:
            for signal in actual.failure_signals:
                verdicts.append(
                    LearningVerdict(
                        action="HOLD",
                        organ="unknown",
                        delta=0.0,
                        reason=f"Failure signal: '{signal}' — suppress-too-hard risk. Review manually.",
                    )
                )

        # ── Case 5: Excluded organ correctly suppressed → reinforce suppression ──
        for organ in prediction.excluded:
            if (
                organ not in actual.excluded_but_routed
                and organ not in actual.irrelevant_used
            ):
                verdicts.append(
                    LearningVerdict(
                        action="SUPPRESS",
                        organ=organ,
                        delta=0.0,
                        reason=f"'{organ}' correctly excluded — no activation needed.",
                    )
                )

        # ── Build receipt ──
        receipt = MetabolizerReceipt(
            timestamp=now,
            task=actual.task,
            prediction={
                "primary": prediction.primary,
                "secondary": prediction.secondary,
                "excluded": prediction.excluded,
                "reduction_pct": prediction.reduction_pct,
            },
            actual={
                "primary_used": actual.primary_used,
                "secondary_used": actual.secondary_used,
                "excluded_but_routed": actual.excluded_but_routed,
                "irrelevant_used": actual.irrelevant_used,
                "failure_signals": actual.failure_signals,
                "success": actual.success,
            },
            verdicts=[
                {
                    "action": v.action,
                    "organ": v.organ,
                    "delta": v.delta,
                    "reason": v.reason,
                    "occurrence_count": v.occurrence_count,
                }
                for v in verdicts
            ],
            weight_changes=weight_changes,
            session_id=session_id,
        )

        return verdicts, receipt

    def _compute_delta(self, count: int) -> float:
        """Conservative delta based on occurrence count."""
        rate = LEARNING_POLICY["learn_rate"]
        if count >= LEARNING_POLICY["threshold_prior_update"]:
            return min(0.20, rate * 4)
        elif count >= LEARNING_POLICY["threshold_recommend"]:
            return rate * 2  # 0.10
        elif count >= LEARNING_POLICY["threshold_weak"]:
            return rate  # 0.05
        else:
            return 0.0  # Note only

    def _compute_action(self, count: int) -> str:
        if count >= LEARNING_POLICY["threshold_prior_update"]:
            return "PRIOR_UPDATE"
        elif count >= LEARNING_POLICY["threshold_recommend"]:
            return "RECOMMEND"
        elif count >= LEARNING_POLICY["threshold_weak"]:
            return "WEAK"
        else:
            return "NOTE"

    def _is_immutable(self, organ: str) -> bool:
        """Check if an organ/keyword is constitutionally immutable."""
        immutable = self.weights.get("_immutable_constitutional_rules", {})
        return organ.upper() in [r.split("_")[0] for r in IMMUTABLE_RULES if "_" in r]

    def _extract_keywords(self, task: str) -> list[str]:
        """Extract keywords from task description for weight mapping.

        Filters out constitutionally-immutable keywords (F1-F13, governance terms).
        These keywords are hardcoded in context_compile.py's arifos organ registry
        and must NEVER be auto-weighted toward other organs.
        """
        task_lower = task.lower()
        # Use the keywords that are already in our weight map
        matched = []
        for kw in self.weights.get("keywords", {}):
            if kw in task_lower:
                # Skip constitutionally immutable keywords
                if kw in IMMUTABLE_KEYWORDS:
                    continue
                matched.append(kw)
        # Fallback: only if no existing keywords matched AND first word is not immutable
        if not matched:
            first = task_lower.split()[0]
            if first not in IMMUTABLE_KEYWORDS:
                matched = [first]
        return matched

    # ─── PERSIST ───────────────────────────────────────────────────

    def apply_and_save(self, receipt: MetabolizerReceipt):
        """Save updated weights and append receipt."""
        self._save_weights()
        self._save_occurrences()

        # Append receipt
        receipt_dict = {
            "timestamp": receipt.timestamp,
            "task": receipt.task,
            "prediction": receipt.prediction,
            "actual": receipt.actual,
            "verdicts": receipt.verdicts,
            "weight_changes": receipt.weight_changes,
            "session_id": receipt.session_id,
        }
        RECEIPTS_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(RECEIPTS_PATH, "a") as f:
            f.write(json.dumps(receipt_dict, ensure_ascii=False) + "\n")

    # ─── REPORT ────────────────────────────────────────────────────

    def print_report(
        self,
        prediction: CompilerPrediction,
        actual: OrganActivation,
        verdicts: list[LearningVerdict],
        receipt: MetabolizerReceipt,
    ):
        """Human-readable metabolizer report."""
        print(f"""
╔══════════════════════════════════════════════════════════════╗
║       ADAPTIVE CONTEXT METABOLIZER — Learning Report         ║
╠══════════════════════════════════════════════════════════════╣
║ Task: {actual.task[:55]:<55} ║
╠══════════════════════════════════════════════════════════════╣
║ PREDICTED (compiler)                                        ║
║   Primary:   {prediction.primary:<52} ║
║   Secondary: {", ".join(prediction.secondary) or "none":<52} ║
║   Excluded:  {", ".join(prediction.excluded):<52} ║
╠══════════════════════════════════════════════════════════════╣
║ ACTUAL (agent execution)                                    ║
║   Primary used:      {actual.primary_used:<38} ║
║   Secondary used:    {", ".join(actual.secondary_used) or "none":<38} ║
║   Excluded but routed: {", ".join(actual.excluded_but_routed) or "none":<34} ║
║   Irrelevant used:   {", ".join(actual.irrelevant_used) or "none":<38} ║
║   Success:           {str(actual.success):<38} ║
╠══════════════════════════════════════════════════════════════╣
║ LEARNING VERDICTS                                           ║""")
        for v in verdicts:
            symbol = {
                "REINFORCE": "✅",
                "EXPAND": "📈",
                "SUPPRESS": "📉",
                "HOLD": "⛔",
                "NOTE": "📝",
                "WEAK": "🔹",
                "RECOMMEND": "🔶",
                "PRIOR_UPDATE": "🔺",
            }.get(v.action, "❓")
            print(
                f"║ {symbol} {v.action:<12} {v.organ:<15} Δ={v.delta:+.2f}  {v.reason[:40]:<40} ║"
            )
        print("""╠══════════════════════════════════════════════════════════════╣
║ SUMMARY                                                     ║""")

        changes = [v for v in verdicts if v.delta != 0.0]
        holds = [v for v in verdicts if v.action == "HOLD"]
        if changes:
            for c in changes:
                print(
                    f"║   Weight updated: {c.organ} ({c.occurrence_count} occurrences, +{c.delta:.2f}){' ' * (30 - len(c.organ))} ║"
                )
        if holds:
            print(
                f"║   ⛔ {len(holds)} HOLD(s) — constitutional boundary protected     ║"
            )
        if not changes and not holds:
            print(f"║   No weight changes — prediction was correct.                ║")

        print(f"""╠══════════════════════════════════════════════════════════════╣
║ Receipt: {RECEIPTS_PATH} ║
║ Weights: {self.weight_map_path} ║
╚══════════════════════════════════════════════════════════════╝""")


# ─── CLI ────────────────────────────────────────────────────────────────


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Adaptive Context Metabolizer — feedback layer for context compilation."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # learn command
    learn = sub.add_parser(
        "learn", help="Compare prediction vs actual and update weights"
    )
    learn.add_argument(
        "--task", default="", help="Task description (not required if --from-compile)"
    )
    learn.add_argument(
        "--predicted-primary",
        default="",
        help="Compiler's predicted primary organ (not required if --from-compile)",
    )
    learn.add_argument(
        "--predicted-secondary", default="", help="Comma-separated secondary organs"
    )
    learn.add_argument(
        "--predicted-excluded", default="", help="Comma-separated excluded organs"
    )
    learn.add_argument(
        "--predicted-reduction", type=float, default=0.0, help="Reduction %"
    )
    learn.add_argument(
        "--actual-primary", required=True, help="Organ the agent actually used most"
    )
    learn.add_argument(
        "--actual-secondary", default="", help="Comma-separated secondary organs used"
    )
    learn.add_argument(
        "--actual-routed", default="", help="Excluded organs that were routed to"
    )
    learn.add_argument(
        "--actual-irrelevant", default="", help="Organs used unnecessarily"
    )
    learn.add_argument(
        "--actual-failure", default="", help="Failure signals (comma-separated)"
    )
    learn.add_argument(
        "--success", action="store_true", default=True, help="Whether task succeeded"
    )
    learn.add_argument(
        "--failed", dest="success", action="store_false", help="Whether task failed"
    )
    learn.add_argument("--session-id", default="", help="Session ID for audit")
    learn.add_argument(
        "--dry-run", action="store_true", help="Compute verdicts but don't save"
    )
    learn.add_argument(
        "--from-compile",
        type=str,
        default=None,
        help="Path to context_compile.py JSON output. Auto-fills --task, --predicted-* from compile. "
        "Only --actual-* flags remain required.",
    )

    # status command
    status = sub.add_parser("status", help="Show current learning state")

    # history command
    history = sub.add_parser("history", help="Show metabolizer receipt history")
    history.add_argument(
        "--limit", type=int, default=10, help="Number of receipts to show"
    )

    args = parser.parse_args()

    metabolizer = AdaptiveContextMetabolizer()

    if args.command == "learn":
        # ── Validate: need either --from-compile OR manual prediction fields ──
        if not args.from_compile and (not args.task or not args.predicted_primary):
            print(
                "Error: --from-compile FILE is required, OR --task + --predicted-primary must be provided.",
                file=sys.stderr,
            )
            sys.exit(1)

        # ── Auto-fill prediction from compile JSON if provided ──
        compile_data = None
        if args.from_compile:
            with open(args.from_compile) as f:
                compile_data = json.load(f)
            predicted = compile_data.get("predicted", {})
            _task = compile_data.get("task", args.task)
            _primary = predicted.get("primary", args.predicted_primary)
            _secondary = predicted.get("secondary", [])
            _excluded = predicted.get("excluded", [])
            _reduction = compile_data.get("stats", {}).get("reduction_pct", 0.0)
            _compile_id = compile_data.get("compile_id", "")
        else:
            _task = args.task
            _primary = args.predicted_primary
            _secondary = [
                s.strip() for s in args.predicted_secondary.split(",") if s.strip()
            ]
            _excluded = [
                s.strip() for s in args.predicted_excluded.split(",") if s.strip()
            ]
            _reduction = args.predicted_reduction
            _compile_id = ""

        prediction = CompilerPrediction(
            task=_task,
            primary=_primary,
            secondary=_secondary,
            excluded=_excluded,
            reduction_pct=_reduction,
        )
        actual = OrganActivation(
            task=_task,
            primary_used=args.actual_primary,
            secondary_used=[
                s.strip() for s in args.actual_secondary.split(",") if s.strip()
            ],
            excluded_but_routed=[
                s.strip() for s in args.actual_routed.split(",") if s.strip()
            ],
            irrelevant_used=[
                s.strip() for s in args.actual_irrelevant.split(",") if s.strip()
            ],
            failure_signals=[
                s.strip() for s in args.actual_failure.split(",") if s.strip()
            ],
            success=args.success,
        )

        verdicts, receipt = metabolizer.compare(
            prediction, actual, session_id=args.session_id or _compile_id
        )
        metabolizer.print_report(prediction, actual, verdicts, receipt)

        if not args.dry_run:
            # Always persist occurrences + receipt, even if no weight changes
            # (occurrence tracking needs to survive NOTE-only sessions)
            metabolizer.apply_and_save(receipt)
            if any(v.delta != 0.0 for v in verdicts):
                print("✅ Weights updated and receipt written.")
            else:
                print("📝 Occurrence tracked — no weight changes (below threshold).")
        else:
            print("🔹 DRY RUN — no changes saved.")

    elif args.command == "status":
        weights = metabolizer.weights
        keywords = weights.get("keywords", {})
        learned = {
            k: v
            for k, v in keywords.items()
            if "Auto-learned" in v.get("description", "")
        }
        print(
            f"Organ weight map: {len(keywords)} keywords, {len(learned)} auto-learned"
        )
        print(
            f"Occurrences tracked: {len(metabolizer.occurrences)} cross-organ patterns"
        )
        if learned:
            print("\nAuto-learned keywords:")
            for kw, entry in sorted(learned.items()):
                organs = {k: v for k, v in entry.items() if k not in ("description",)}
                print(f"  {kw}: {organs} — {entry['description']}")

    elif args.command == "history":
        if RECEIPTS_PATH.exists():
            lines = RECEIPTS_PATH.read_text().strip().split("\n")
            for line in lines[-args.limit :]:
                r = json.loads(line)
                verdicts_str = ", ".join(
                    f"{v['action']}:{v['organ']}" for v in r.get("verdicts", [])[:3]
                )
                print(f"{r['timestamp'][:19]} | {r['task'][:40]:<40} | {verdicts_str}")
        else:
            print("No receipts yet.")


if __name__ == "__main__":
    main()
