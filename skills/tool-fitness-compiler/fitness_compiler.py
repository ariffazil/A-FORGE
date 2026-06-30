#!/usr/bin/env python3
"""
Tool Fitness Compiler — Digital Fiqh for MCP Surfaces.

Computes F = Value × Adoption / (Entropy × BlastRadius × CognitiveCost)
for every tool in an organ, classifies into fiqh categories,
and outputs keep/kill/route recommendations.

Usage:
  python3 fitness_compiler.py --organ aforge
  python3 fitness_compiler.py --organ wealth
  python3 fitness_compiler.py --organ geox
  python3 fitness_compiler.py --surface /path/to/affordances.yaml
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


# ─── Fiqh Categories ──────────────────────────────────────────────────────────

FIQH_THRESHOLDS = {
    "wajib": 0.6,  # F >= 0.6  — mandatory, must exist
    "sunat": 0.4,  # F >= 0.4  — recommended
    "harus": 0.2,  # F >= 0.2  — permissible
    "makruh": 0.1,  # F >= 0.1  — discouraged
    "haram": 0.0,  # F < 0.1  — forbidden
}

FIQH_COLORS = {
    "wajib": "🟥",
    "sunat": "🟩",
    "harus": "🟦",
    "makruh": "🟨",
    "haram": "🟥",
}

FIQH_ACTIONS = {
    "wajib": "KEEP",
    "sunat": "KEEP",
    "harus": "KEEP (monitor)",
    "makruh": "ROUTE or MERGE",
    "haram": "KILL",
}


# ─── Risk Label Mapping ───────────────────────────────────────────────────────

RISK_TO_BLAST_RADIUS = {
    "R0": 1.0,  # read-only — no blast
    "R1": 1.1,  # local temp write — minimal
    "R2": 1.3,  # repo write — moderate
    "R3": 1.5,  # external API write — significant
    "R4": 1.8,  # public publish — high
    "R5": 2.0,  # destructive or irreversible — maximum
}


# ─── Data Classes ─────────────────────────────────────────────────────────────


@dataclass
class AffordanceCard:
    name: str
    purpose: str = ""
    reads: list[str] = field(default_factory=list)
    writes: list[str] = field(default_factory=list)
    external_side_effect: bool = False
    destructive: bool = False
    reversible: bool = True
    requires_human_approval: bool = False
    min_mode: str = "THINK"
    risk_label: str = "R0"


@dataclass
class FitnessScore:
    tool_name: str
    value: float  # 0.0–1.0
    adoption: float  # 0.0–1.0
    entropy: float  # 1.0–10.0
    blast_radius: float  # 1.0–6.0
    cognitive_cost: float  # 1.0–10.0
    fitness: float  # computed F
    fiqh: str  # wajib/sunat/harus/makruh/haram
    action: str  # KEEP/KEEP (monitor)/ROUTE or MERGE/KILL
    reason: str = ""


# ─── Fitness Computation ──────────────────────────────────────────────────────


def compute_value(card: AffordanceCard, all_cards: list[AffordanceCard]) -> float:
    """Value = uniqueness of purpose. 1.0 if unique purpose, lower if redundant."""
    purpose = (card.purpose or "").lower()

    # Check if another tool has the same purpose
    purpose_overlap = 0
    for other in all_cards:
        if other.name == card.name:
            continue
        other_purpose = (other.purpose or "").lower()
        # Exact or near-exact purpose match
        if purpose == other_purpose or (len(purpose) > 10 and purpose in other_purpose):
            purpose_overlap += 1

    if purpose_overlap == 0:
        return 1.0  # unique purpose
    elif purpose_overlap == 1:
        return 0.7  # one overlap
    else:
        return 0.5  # multiple overlaps


def estimate_adoption(card: AffordanceCard) -> float:
    """Estimate adoption from tool class. Higher for common operations."""
    name_lower = card.name.lower()

    # Critical infrastructure: init, health, shell, git
    if any(k in name_lower for k in ["init", "session_init"]):
        return 0.95
    if any(k in name_lower for k in ["health", "status", "probe"]):
        return 0.85
    if any(k in name_lower for k in ["shell", "git", "filesystem"]):
        return 0.85

    # Core governance: think, route, judge, seal
    if any(k in name_lower for k in ["think", "route", "judge", "seal"]):
        return 0.8

    # Search and research
    if any(k in name_lower for k in ["search", "research", "docs_lookup"]):
        return 0.7

    # Domain tools: compute, analyze, evaluate
    if any(k in name_lower for k in ["compute", "analyze", "evaluate", "ingest"]):
        return 0.6

    # Specialized tools: vision, seismic, petrophysics
    if any(
        k in name_lower for k in ["vision", "seismic", "petrophysics", "geomechanics"]
    ):
        return 0.5

    # Browser tools
    if any(k in name_lower for k in ["browser"]):
        return 0.5

    # Policy tools
    if any(k in name_lower for k in ["policy"]):
        return 0.4

    # Legacy or niche
    if any(k in name_lower for k in ["legacy", "compat", "deprecated"]):
        return 0.2

    return 0.6  # default


def compute_entropy(card: AffordanceCard, alias_count: int = 0) -> float:
    """Entropy multiplier. 1.0 = baseline, >1.0 = adds noise, <1.0 = clean."""
    entropy = 1.0  # baseline

    # Alias count adds entropy (normalized)
    entropy += alias_count * 0.15

    # Schema ambiguity: empty reads/writes
    if not card.reads and not card.writes:
        entropy += 0.5  # no declared I/O
    elif not card.reads:
        entropy += 0.2  # no declared reads

    # Description vagueness
    purpose = card.purpose or ""
    if len(purpose) < 10:
        entropy += 0.5  # too short
    if "..." in purpose:
        entropy += 0.2  # truncated
    if any(k in purpose.lower() for k in ["todo", "fixme", "placeholder"]):
        entropy += 0.5

    # Overloaded modes
    if card.min_mode == "GOVERN" and not card.destructive:
        entropy += 0.1  # GOVERN for non-destructive = unnecessary friction

    return min(entropy, 3.0)


def compute_blast_radius(card: AffordanceCard) -> float:
    """Blast radius from risk label."""
    return RISK_TO_BLAST_RADIUS.get(card.risk_label, 3.0)


def compute_cognitive_cost(card: AffordanceCard) -> float:
    """Cognitive cost multiplier. 1.0 = baseline, >1.0 = harder to reason about."""
    cost = 1.0

    # Parameter count (estimated from reads/writes)
    param_count = len(card.reads) + len(card.writes)
    cost += param_count * 0.05

    # Description length (too long = expensive, too short = ambiguous)
    purpose_len = len(card.purpose or "")
    if purpose_len > 200:
        cost += 0.2  # too verbose
    elif purpose_len < 20:
        cost += 0.3  # too terse

    # Destructive without clear reversibility
    if card.destructive and not card.reversible:
        cost += 0.2  # irreversible = higher cognitive cost

    # External side effects
    if card.external_side_effect:
        cost += 0.1

    return min(cost, 2.0)


def classify_fiqh(fitness: float) -> tuple[str, str]:
    """Classify fitness score into fiqh category and action."""
    if fitness >= FIQH_THRESHOLDS["wajib"]:
        return "wajib", "KEEP"
    elif fitness >= FIQH_THRESHOLDS["sunat"]:
        return "sunat", "KEEP"
    elif fitness >= FIQH_THRESHOLDS["harus"]:
        return "harus", "KEEP (monitor)"
    elif fitness >= FIQH_THRESHOLDS["makruh"]:
        return "makruh", "ROUTE or MERGE"
    else:
        return "haram", "KILL"


def compute_fitness(
    card: AffordanceCard,
    all_cards: list[AffordanceCard],
    alias_count: int = 0,
) -> FitnessScore:
    """Compute fitness for a single tool.

    F = (Value × Adoption) / (Entropy × BlastRadius × CognitiveCost)

    Each component is a multiplier around 1.0:
    - Value: 0.3–1.0 (uniqueness)
    - Adoption: 0.1–0.9 (estimated usage)
    - Entropy: 1.0–3.0 (noise multiplier)
    - BlastRadius: 1.0–2.0 (risk multiplier)
    - CognitiveCost: 1.0–2.0 (understanding difficulty)
    """
    value = compute_value(card, all_cards)
    adoption = estimate_adoption(card)
    entropy = compute_entropy(card, alias_count)
    blast_radius = compute_blast_radius(card)
    cognitive_cost = compute_cognitive_cost(card)

    # F = Value × Adoption / (Entropy × BlastRadius × CognitiveCost)
    denominator = entropy * blast_radius * cognitive_cost
    if denominator == 0:
        denominator = 0.001

    fitness = (value * adoption) / denominator
    fitness = round(fitness, 4)

    fiqh, action = classify_fiqh(fitness)

    # Generate reason
    reasons = []
    if value < 0.5:
        reasons.append("overlapping capability")
    if entropy > 1.5:
        reasons.append(f"high entropy ({entropy:.1f})")
    if blast_radius >= 1.8:
        reasons.append(f"high blast radius ({card.risk_label})")
    if cognitive_cost > 1.5:
        reasons.append(f"high cognitive cost ({cognitive_cost:.1f})")
    if adoption < 0.3:
        reasons.append("low adoption")
    if card.destructive and not card.reversible:
        reasons.append("irreversible")
    if not reasons:
        reasons.append("healthy")

    return FitnessScore(
        tool_name=card.name,
        value=value,
        adoption=adoption,
        entropy=entropy,
        blast_radius=blast_radius,
        cognitive_cost=cognitive_cost,
        fitness=fitness,
        fiqh=fiqh,
        action=action,
        reason=", ".join(reasons),
    )


# ─── YAML Parser (minimal, no pyyaml dependency) ─────────────────────────────


def parse_affordances_yaml(path: Path) -> list[AffordanceCard]:
    """Parse affordances.yaml without pyyaml dependency."""
    cards = []
    current: dict[str, Any] = {}
    in_tools = False

    with open(path) as f:
        for line in f:
            stripped = line.strip()

            if stripped == "tools:":
                in_tools = True
                continue

            if not in_tools:
                continue

            # New tool entry
            if stripped.startswith("- name:"):
                if current:
                    cards.append(_dict_to_card(current))
                current = {"name": stripped.split(":", 1)[1].strip()}
                continue

            if not stripped or stripped.startswith("#"):
                continue

            # Key-value pair
            if ":" in stripped and current:
                key, _, val = stripped.partition(":")
                key = key.strip()
                val = val.strip()

                # Parse value
                if val == "true":
                    current[key] = True
                elif val == "false":
                    current[key] = False
                elif val.startswith("[") and val.endswith("]"):
                    # Inline list
                    items = [
                        x.strip().strip("'\"")
                        for x in val[1:-1].split(",")
                        if x.strip()
                    ]
                    current[key] = items
                elif val.startswith('"') and val.endswith('"'):
                    current[key] = val[1:-1]
                else:
                    current[key] = val

    if current:
        cards.append(_dict_to_card(current))

    return cards


def _dict_to_card(d: dict[str, Any]) -> AffordanceCard:
    return AffordanceCard(
        name=d.get("name", ""),
        purpose=d.get("purpose", ""),
        reads=d.get("reads", []) if isinstance(d.get("reads"), list) else [],
        writes=d.get("writes", []) if isinstance(d.get("writes"), list) else [],
        external_side_effect=bool(d.get("external_side_effect", False)),
        destructive=bool(d.get("destructive", False)),
        reversible=bool(d.get("reversible", True)),
        requires_human_approval=bool(d.get("requires_human_approval", False)),
        min_mode=d.get("min_mode", "THINK"),
        risk_label=d.get("risk_label", "R0"),
    )


# ─── Alias Registry Loader ────────────────────────────────────────────────────


def load_alias_counts(path: Path) -> dict[str, int]:
    """Load alias registry and count aliases per tool."""
    counts: dict[str, int] = {}
    if not path.exists():
        return counts

    try:
        with open(path) as f:
            content = f.read()
        # Strip JSON comments (// style)
        content = re.sub(r"//.*$", "", content, flags=re.MULTILINE)
        data = json.loads(content)

        alias_map = data.get("alias_map", {})
        for alias, canonical in alias_map.items():
            if alias.startswith("__"):
                continue
            counts[canonical] = counts.get(canonical, 0) + 1

    except (json.JSONDecodeError, KeyError):
        pass

    return counts


# ─── Report Generator ─────────────────────────────────────────────────────────


def generate_report(
    scores: list[FitnessScore],
    organ: str,
) -> dict[str, Any]:
    """Generate structured fitness report."""
    # Sort by fitness (ascending — worst first)
    scores.sort(key=lambda s: s.fitness)

    # Aggregate stats
    fitness_values = [s.fitness for s in scores]
    mean_fitness = sum(fitness_values) / len(fitness_values) if fitness_values else 0
    median_fitness = (
        sorted(fitness_values)[len(fitness_values) // 2] if fitness_values else 0
    )

    # Fiqh distribution
    fiqh_dist = {}
    for s in scores:
        fiqh_dist[s.fiqh] = fiqh_dist.get(s.fiqh, 0) + 1

    # Entropy delta (how much entropy would be removed by killing haram + makruh)
    entropy_before = sum(s.entropy for s in scores)
    entropy_after = sum(s.entropy for s in scores if s.fiqh not in ("haram", "makruh"))
    entropy_delta = entropy_before - entropy_after

    # Recommendations
    kill_list = [s.tool_name for s in scores if s.action == "KILL"]
    route_list = [s.tool_name for s in scores if s.action == "ROUTE or MERGE"]
    keep_list = [s.tool_name for s in scores if "KEEP" in s.action]

    return {
        "organ": organ,
        "total_tools": len(scores),
        "mean_fitness": round(mean_fitness, 4),
        "median_fitness": round(median_fitness, 4),
        "entropy_before": round(entropy_before, 1),
        "entropy_after": round(entropy_after, 1),
        "entropy_delta": round(entropy_delta, 1),
        "fiqh_distribution": fiqh_dist,
        "recommendations": {
            "kill": kill_list,
            "route_or_merge": route_list,
            "keep": keep_list,
        },
        "tools": [
            {
                "name": s.tool_name,
                "fitness": s.fitness,
                "fiqh": s.fiqh,
                "action": s.action,
                "value": s.value,
                "adoption": s.adoption,
                "entropy": s.entropy,
                "blast_radius": s.blast_radius,
                "cognitive_cost": s.cognitive_cost,
                "reason": s.reason,
            }
            for s in scores
        ],
    }


def print_report(report: dict[str, Any]) -> None:
    """Print human-readable report."""
    print(f"\n{'=' * 70}")
    print(f"  TOOL FITNESS COMPILER — {report['organ'].upper()}")
    print(f"{'=' * 70}")
    print(f"  Total tools:      {report['total_tools']}")
    print(f"  Mean fitness:     {report['mean_fitness']}")
    print(f"  Median fitness:   {report['median_fitness']}")
    print(f"  Entropy before:   {report['entropy_before']}")
    print(f"  Entropy after:    {report['entropy_after']}")
    print(
        f"  Entropy delta:    -{report['entropy_delta']} ({report['entropy_delta'] / report['entropy_before'] * 100:.0f}% reduction)"
        if report["entropy_before"] > 0
        else ""
    )
    print(f"\n  Fiqh Distribution:")
    for fiqh, count in report["fiqh_distribution"].items():
        color = FIQH_COLORS.get(fiqh, "  ")
        print(f"    {color} {fiqh:8s}: {count}")
    print(f"\n  Recommendations:")
    rec = report["recommendations"]
    if rec["kill"]:
        print(f"    KILL:           {', '.join(rec['kill'])}")
    if rec["route_or_merge"]:
        print(f"    ROUTE/MERGE:    {', '.join(rec['route_or_merge'])}")
    print(f"    KEEP:           {len(rec['keep'])} tools")
    print(f"\n{'=' * 70}")
    print(f"  Tool Details (sorted by fitness, worst first):")
    print(f"{'=' * 70}")
    print(f"  {'Tool':<40} {'F':>6} {'Fiqh':>8} {'Action':>16} {'Reason'}")
    print(f"  {'-' * 40} {'-' * 6} {'-' * 8} {'-' * 16} {'-' * 30}")
    for t in report["tools"]:
        color = FIQH_COLORS.get(t["fiqh"], "  ")
        name = t["name"][:38]
        print(
            f"  {color} {name:<38} {t['fitness']:>6.3f} {t['fiqh']:>8} {t['action']:>16} {t['reason'][:30]}"
        )
    print()


# ─── Main ─────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="Tool Fitness Compiler — Digital Fiqh")
    parser.add_argument(
        "--organ",
        choices=["aforge", "wealth", "geox", "well", "arifos", "aaa"],
        help="Organ to audit",
    )
    parser.add_argument("--surface", type=Path, help="Custom affordances.yaml path")
    parser.add_argument("--aliases", type=Path, help="Alias registry JSON path")
    parser.add_argument(
        "--json", action="store_true", help="Output JSON instead of text"
    )
    args = parser.parse_args()

    # Resolve affordances path
    if args.surface:
        affordances_path = args.surface
    elif args.organ:
        organ_paths = {
            "aforge": Path("/root/A-FORGE/a_think/affordances.yaml"),
            "wealth": Path("/root/WEALTH/a_think/affordances.yaml"),
            "geox": Path("/root/geox/a_think/affordances.yaml"),
            "well": Path("/root/WELL/a_think/affordances.yaml"),
            "arifos": Path("/root/arifOS/a_think/affordances.yaml"),
            "aaa": Path("/root/AAA/a_think/affordances.yaml"),
        }
        affordances_path = organ_paths.get(args.organ)
        if not affordances_path or not affordances_path.exists():
            print(f"Error: No affordances.yaml found for {args.organ}")
            sys.exit(1)
    else:
        print("Error: Must specify --organ or --surface")
        sys.exit(1)

    # Load cards
    cards = parse_affordances_yaml(affordances_path)
    if not cards:
        print(f"Error: No tools found in {affordances_path}")
        sys.exit(1)

    # Load alias counts
    alias_counts = {}
    if args.aliases:
        alias_counts = load_alias_counts(args.aliases)
    else:
        # Try default locations
        default_alias_paths = [
            affordances_path.parent.parent / "migration" / "alias_registry.json",
            affordances_path.parent.parent / "alias_registry.json",
        ]
        for p in default_alias_paths:
            if p.exists():
                alias_counts = load_alias_counts(p)
                break

    # Compute fitness for all tools
    scores = []
    for card in cards:
        alias_count = alias_counts.get(card.name, 0)
        score = compute_fitness(card, cards, alias_count)
        scores.append(score)

    # Generate and print report
    organ = args.organ or "custom"
    report = generate_report(scores, organ)

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print_report(report)


if __name__ == "__main__":
    main()
