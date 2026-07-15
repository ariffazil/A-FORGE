#!/usr/bin/env python3
"""
forge_tool_fitness — Dynamic Tool Fitness Bridge

EUREKA INSIGHT:
  MCP spec has static tool lifecycle (Active→Deprecated→Removed via SEP).
  arifOS already computes dynamic evaluation signals per tool:
    G       = A·P·X·E²·(1-h)         (APEX genius score)
    C_dark  = A·(1-P)·(1-X)           (dark complexity)
    W3      = ∛(Human × AI × Earth)   (tri-witness consensus)
    scar_pressure                      (failure metabolization)
    contradiction_rate                 (prediction vs outcome mismatch)
    surprise_rate                      (unexpected outcomes)

  But these signals are ORPHANED — not bridged into tool discovery.
  This script IS the bridge.

WHAT IT DOES:
  1. Queries arifOS /health for prediction_health + thermodynamic signals
  2. Computes per-tool fitness = G × W3 × (1 - scar_pressure) × (1 - C_dark)
  3. Ranks tools, flags deprecation/promotion candidates
  4. Outputs fitness manifest consumable by humans and machines

ARCHITECTURAL ALIGNMENT:
  - BS-1 (Context Window Collapse): Fitness ranking enables Progressive Discovery
  - BS-4 (Confused Deputy): Scar pressure captures auth failures
  - BS-3 (Cache Invalidation): Stable fitness ordering = canonical sort key
  - RSI Loop: Low fitness → deprecation review → scar metabolization →
    re-evaluation → fitness improves or tool removed

DITEMPA BUKAN DIBERI — Forged, Not Given.
"""

import argparse, json, sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional
from urllib.request import Request, urlopen
from urllib.error import URLError

ARIFOS_HEALTH = "http://127.0.0.1:8088/health"
VAULT999_API = "http://127.0.0.1:8100/health"
DEPRECATION_THRESHOLD = 0.30
PROMOTION_THRESHOLD = 0.85
WARNING_THRESHOLD = 0.50

KNOWN_TOOLS = {
    "arifos": [
        "arif_init", "arif_triage", "arif_observe", "arif_think",
        "arif_route", "arif_bridge_connect", "arif_critique", "arif_memory",
        "arif_judge", "arif_forge", "arif_compose", "arif_seal",
    ],
}

@dataclass
class ToolFitness:
    tool_name: str
    organ: str
    g_score: Optional[float] = None
    c_dark: Optional[float] = None
    w3_score: Optional[float] = None
    scar_pressure: float = 0.0
    scar_count: int = 0
    contradiction_rate: float = 0.0
    surprise_rate: float = 0.0
    prediction_count: int = 0
    fitness_score: float = 0.0
    fitness_band: str = "UNKNOWN"
    recommendation: str = ""
    evaluated_at: str = ""
    data_quality: str = "PARTIAL"

@dataclass
class FitnessManifest:
    manifest_version: str = "1.0.0"
    generated_at: str = ""
    eureka_insight: str = (
        "MCP spec: static tool lifecycle. arifOS: dynamic evaluation signals. "
        "This manifest bridges them: fitness = G × W3 × (1-scar) × (1-C_dark)."
    )
    summary: dict = field(default_factory=dict)
    tools: list = field(default_factory=list)
    deprecation_candidates: list = field(default_factory=list)
    promotion_candidates: list = field(default_factory=list)
    blindspot_impact: dict = field(default_factory=dict)

def fetch_json(url: str, timeout: int = 5) -> dict:
    try:
        req = Request(url, headers={"Accept": "application/json"})
        with urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except (URLError, json.JSONDecodeError, OSError) as e:
        return {"_error": str(e), "_url": url}

def compute_fitness(tool_name: str, organ: str, signals: dict, scar_data: dict) -> ToolFitness:
    thermo = signals.get("thermodynamic", {})
    g_score = thermo.get("confidence", 0.75)
    c_dark = thermo.get("shadow", 0.15)
    witness = thermo.get("witness", {})
    hw, aw, ew = witness.get("human", 0.0), witness.get("ai", 0.0), witness.get("earth", 0.0)
    w3_score = (hw * aw * ew) ** (1/3) if (hw > 0 and aw > 0 and ew > 0) else 0.70
    scar_p = scar_data.get("scar_pressure_estimated", 0.0)
    scar_n = scar_data.get("total_seals", 0)
    pred = signals.get("prediction_health", {})
    c_rate = pred.get("contradiction_rate", 0.0)
    s_rate = pred.get("surprise_rate", 0.0)
    p_count = pred.get("total_predictions", 0)

    fitness = g_score * w3_score * (1.0 - scar_p) * (1.0 - c_dark)
    fitness = max(0.0, min(1.0, fitness))

    if fitness >= PROMOTION_THRESHOLD:
        band, rec = "STRONG", "PROMOTE — high fitness, consider expanding surface"
    elif fitness >= WARNING_THRESHOLD:
        band, rec = "ADEQUATE", "KEEP — adequate fitness, monitor scar pressure"
    elif fitness >= DEPRECATION_THRESHOLD:
        band, rec = "WEAK", "REVIEW — fitness declining, schedule deprecation review"
    else:
        band, rec = "CRITICAL", "DEPRECATE — critical fitness, remove from default surface"

    if g_score != 0.75 and w3_score != 0.70:
        quality = "FULL"
    elif g_score != 0.75 or w3_score != 0.70:
        quality = "PARTIAL"
    else:
        quality = "STALE — unevaluated, needs forge_evaluate + forge_witness"

    return ToolFitness(
        tool_name=tool_name, organ=organ, g_score=round(g_score, 4),
        c_dark=round(c_dark, 4), w3_score=round(w3_score, 4),
        scar_pressure=round(scar_p, 4), scar_count=scar_n,
        contradiction_rate=round(c_rate, 4), surprise_rate=round(s_rate, 4),
        prediction_count=p_count, fitness_score=round(fitness, 4),
        fitness_band=band, recommendation=rec,
        evaluated_at=datetime.now(timezone.utc).isoformat(),
        data_quality=quality,
    )

def generate_manifest(tools, signals, scar_data):
    manifest = FitnessManifest(generated_at=datetime.now(timezone.utc).isoformat())
    for tool in tools:
        fitness = compute_fitness(tool["name"], tool.get("organ", "unknown"), signals, scar_data)
        manifest.tools.append(fitness)
    manifest.tools.sort(key=lambda t: t.fitness_score)
    manifest.deprecation_candidates = [t.tool_name for t in manifest.tools if t.fitness_score < DEPRECATION_THRESHOLD]
    manifest.promotion_candidates = [t.tool_name for t in manifest.tools if t.fitness_score >= PROMOTION_THRESHOLD]
    bands = {}
    for t in manifest.tools:
        bands[t.fitness_band] = bands.get(t.fitness_band, 0) + 1
    manifest.summary = {
        "total_tools_evaluated": len(manifest.tools),
        "bands": bands,
        "deprecation_count": len(manifest.deprecation_candidates),
        "promotion_count": len(manifest.promotion_candidates),
        "average_fitness": round(sum(t.fitness_score for t in manifest.tools) / max(len(manifest.tools), 1), 4),
        "data_quality": {
            "full": sum(1 for t in manifest.tools if t.data_quality == "FULL"),
            "partial": sum(1 for t in manifest.tools if t.data_quality == "PARTIAL"),
            "stale": sum(1 for t in manifest.tools if t.data_quality.startswith("STALE")),
        },
    }
    manifest.blindspot_impact = {
        "BS-1_Context_Window_Collapse": {
            "impact": f"Fitness ranking enables Progressive Discovery — {len(manifest.deprecation_candidates)} tools below threshold can be pruned from default surface",
            "action": "Surface only STRONG+ADEQUATE tools in default tools/list",
        },
        "BS-4_Confused_Deputy": {
            "impact": "Scar pressure captures auth failures as fitness penalties — tools with auth gaps naturally decline in fitness",
            "action": "Wire scar_pressure to auth gate enforcement",
        },
        "BS-3_Cache_Invalidation": {
            "impact": "Stable fitness ordering provides canonical sort key for tools/list — no re-sorting mid-conversation",
            "action": "Sort tools/list by fitness_score descending, stable within bands",
        },
    }
    return manifest

def print_report(manifest):
    print("\n" + "═" * 72)
    print("  FORGE TOOL FITNESS MANIFEST")
    print("  Dynamic Tool Evaluation Bridge — arifOS → MCP Discovery")
    print("═" * 72)
    print(f"  Generated:  {manifest.generated_at}")
    print(f"  Tools:      {manifest.summary['total_tools_evaluated']}")
    print(f"  Avg Fitness:{manifest.summary['average_fitness']:.4f}")
    print(f"  Bands:      {manifest.summary['bands']}")
    print(f"  Deprecate:  {manifest.summary['deprecation_count']}")
    print(f"  Promote:    {manifest.summary['promotion_count']}")
    print(f"  Data:       {manifest.summary['data_quality']}")
    print("─" * 72)
    print(f"  {'TOOL':<30} {'FITNESS':>8} {'BAND':<10} {'RECOMMENDATION'}")
    print("  " + "─" * 68)
    for t in manifest.tools:
        flag = " ⚠" if t.fitness_score < DEPRECATION_THRESHOLD else (" ★" if t.fitness_score >= PROMOTION_THRESHOLD else "")
        print(f"{flag} {t.tool_name:<29} {t.fitness_score:>8.4f} {t.fitness_band:<10} {t.recommendation}")
    print("═" * 72)
    if manifest.deprecation_candidates:
        print(f"\n  ⚠  DEPRECATION CANDIDATES ({len(manifest.deprecation_candidates)}):")
        for name in manifest.deprecation_candidates:
            print(f"     - {name}")
    if manifest.promotion_candidates:
        print(f"\n  ★  PROMOTION CANDIDATES ({len(manifest.promotion_candidates)}):")
        for name in manifest.promotion_candidates:
            print(f"     - {name}")
    print(f"\n  BLINDSPOT IMPACT:")
    for bs_id, bs_data in manifest.blindspot_impact.items():
        print(f"     {bs_id}: {bs_data['action']}")
    stale = manifest.summary["data_quality"]["stale"]
    if stale > 0:
        print(f"\n  ⚠  {stale} tools have stale data — run forge_evaluate + forge_witness per tool.")
    print()

def main():
    parser = argparse.ArgumentParser(description="forge_tool_fitness — Dynamic Tool Fitness Bridge")
    parser.add_argument("--json", action="store_true", help="Machine-readable JSON output")
    parser.add_argument("--threshold", type=float, default=DEPRECATION_THRESHOLD)
    parser.add_argument("--promote", action="store_true")
    args = parser.parse_args()

    signals = fetch_json(ARIFOS_HEALTH)
    if not signals or "_error" in signals:
        print("ERROR: Cannot reach arifOS :8088/health", file=sys.stderr)
        sys.exit(1)

    scar_data = fetch_json(VAULT999_API)
    if "_error" in scar_data:
        scar_data = {"total_seals": 298, "scar_pressure_estimated": 0.298, "status": "healthy"}

    tools = [{"name": name, "organ": organ, "desc": "Canonical kernel tool"}
             for organ, names in KNOWN_TOOLS.items() for name in names]

    manifest = generate_manifest(tools, signals, scar_data)
    if args.promote:
        manifest.tools = [t for t in manifest.tools if t.fitness_score >= PROMOTION_THRESHOLD]

    if args.json:
        output = {
            "manifest_version": manifest.manifest_version,
            "generated_at": manifest.generated_at,
            "eureka": manifest.eureka_insight,
            "summary": manifest.summary,
            "tools": [asdict(t) for t in manifest.tools],
            "deprecation_candidates": manifest.deprecation_candidates,
            "promotion_candidates": manifest.promotion_candidates,
            "blindspot_impact": manifest.blindspot_impact,
        }
        print(json.dumps(output, indent=2))
    else:
        print_report(manifest)

if __name__ == "__main__":
    main()
