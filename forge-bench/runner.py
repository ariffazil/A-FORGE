#!/usr/bin/env python3
"""
FORGE-BENCH Runner — Matrix Engine + Ratchet + CI Gate

Runs one shared prompt across a matrix of organs × tool variants × models.
Verifies outputs with domain-specific verifiers, produces a comparable score grid.

Methodology:
  Ignite UI MCP Testbed: matrix execution (task × variant × model) + CI exit codes
  AutoResearch: propose → execute → evaluate → ratchet (keep only improvements)

Usage:
  python3 runner.py --config bench.json          # full matrix
  python3 runner.py --organ geox                 # single organ
  python3 runner.py --organ geox --live          # against live endpoints
  python3 runner.py --ci                         # CI mode (exit codes)
  python3 runner.py --validate                   # validate configs only

CI Exit Codes:  0 = all pass, 2 = some tests failed, 1 = catastrophic error
"""

import json
import sys
import os
import time
import argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

# Local imports
from verifiers import run_verifier
from mcp_client import (
    MockClient,
    HttpClient,
    FlameClient,
    create_client,
    extract_text_content,
)

BENCH_DIR = Path(__file__).parent
ORGAN_PACKS_DIR = BENCH_DIR / "organ_packs"
REPORTS_DIR = BENCH_DIR / "reports"


def load_organ_pack(organ_name: str) -> dict:
    """Load an organ pack JSON file."""
    path = ORGAN_PACKS_DIR / f"{organ_name}.json"
    if not path.exists():
        print(f"ERROR: Organ pack not found: {path}")
        sys.exit(1)
    with open(path) as f:
        return json.load(f)


def load_all_packs() -> list[dict]:
    """Load all available organ packs."""
    packs = []
    for path in sorted(ORGAN_PACKS_DIR.glob("*.json")):
        with open(path) as f:
            packs.append(json.load(f))
    return packs


def health_check(client, pack: dict) -> bool:
    """Check if an organ's health endpoint responds."""
    base_url = pack.get("baseUrl", "")
    if not base_url:
        return False
    return client.health(base_url)


def execute_scenario(
    client, pack: dict, scenario: dict, variant: dict, model: str = "mock"
) -> dict:
    """
    Run one scenario-variant-model cell.

    Steps:
      1. Health check the organ
      2. Send prompt to agent (mock: simulate tool call)
      3. Extract text output
      4. Run verifier against output
    """
    organ_name = pack["name"]
    scenario_id = scenario["id"]
    variant_id = variant.get("id", "default")
    tool_name = scenario.get("toolUnderTest", "")
    prompt = scenario.get("prompt", "")
    verifier_name = scenario.get("verifier", "text_assertion")
    verifier_config = scenario.get("verifierConfig", {})

    result = {
        "organ": organ_name,
        "scenario": scenario_id,
        "variant": variant_id,
        "model": model,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tool_under_test": tool_name,
        "prompt": prompt,
        "passed": False,
        "score": 0.0,
        "errors": [],
        "details": {},
        "elapsed_s": 0.0,
        "mock": True,
    }

    # 1. Health check
    if not health_check(client, pack):
        result["errors"].append("health_check_failed")
        result["details"]["health"] = "DOWN"
        return result
    result["details"]["health"] = "OK"

    # 2. Build arguments from prompt/variant context
    arguments = _build_arguments(scenario, variant)

    # 3. Call the tool
    start = time.time()
    base_url = pack.get("baseUrl") if not isinstance(client, MockClient) else None
    response = client.call_tool(organ_name, tool_name, arguments, base_url=base_url)
    result["elapsed_s"] = time.time() - start
    result["mock"] = response.get("_mock", False)
    result["raw_response"] = response

    if "error" in response and "result" not in response:
        result["errors"].append(
            f"tool_error: {response['error'].get('message', 'unknown')}"
        )
        result["details"]["tool_error"] = response["error"]
        return result

    # 4. Extract text content
    output_text = extract_text_content(response)
    result["output"] = output_text[:2000]  # Truncate for storage

    # 5. Run verifier
    passed, score, details = run_verifier(verifier_name, output_text, verifier_config)
    result["passed"] = passed
    result["score"] = score
    result["details"]["verifier"] = details
    result["verifier"] = verifier_name

    return result


def _build_arguments(scenario: dict, variant: dict) -> dict:
    """Build MCP tool arguments from scenario config and variant."""
    args = {}
    scenario_id = scenario.get("id", "")

    if "npv" in scenario_id or "emv" in scenario_id:
        args["mode"] = "npv" if "npv" in scenario_id else "emv"
        prompt = scenario.get("prompt", "")
        # Extract cash flows if present
        if "cash flows" in prompt.lower() or "returns" in prompt.lower():
            args["cash_flows"] = [-100, 30, 40, 50, 60]
            args["discount_rate"] = 0.1

    elif "petrophysics" in scenario_id:
        args["mode"] = "generate"
        args["gr_clean"] = 15
        args["gr_shale"] = 150
        args["vsh_method"] = "linear"

    elif "falsify" in scenario_id:
        args["mode"] = "full"
        args["claim_text"] = scenario.get("prompt", "")

    elif "judge" in scenario_id:
        # arif_judge: candidate is the action to judge
        if "high-risk" in scenario_id or "DROP" in scenario.get("prompt", ""):
            args["candidate"] = "DROP TABLE production.users CASCADE"
        else:
            args["candidate"] = scenario.get("prompt", "")

    elif "route" in scenario_id:
        # arif_route: intent is the routing target
        args["intent"] = scenario.get("prompt", "")

    elif "basin" in scenario_id:
        args["mode"] = "profile"
        args["name"] = "Malay Basin"

    return args


def run_ratchet(client, pack: dict, scenario: dict) -> dict:
    """
    AutoResearch-style ratchet: run all variants, keep only the champion.

    Returns: { champion: variant_id, cells: [all results], improvement: delta }
    """
    variants = scenario.get("variants", [{"id": "default", "mcpServers": []}])
    cells = []
    best_score = -1.0
    champion = None

    for variant in variants:
        result = execute_scenario(client, pack, scenario, variant)
        cells.append(result)
        if result["score"] > best_score:
            best_score = result["score"]
            champion = variant.get("id", "default")

    # Find baseline (first variant, usually "no-tools")
    baseline = cells[0]["score"] if cells else 0.0
    improvement = best_score - baseline

    return {
        "scenario": scenario["id"],
        "champion": champion,
        "champion_score": best_score,
        "baseline_score": baseline,
        "improvement": improvement,
        "cells": cells,
    }


def print_results(results: list[dict], verbose: bool = False):
    """Print results as a formatted table."""
    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    failed = total - passed

    print(f"\n{'=' * 72}")
    print(f"  FORGE-BENCH RESULTS — {total} cells, {passed} PASS, {failed} FAIL")
    print(f"{'=' * 72}")
    print(f"{'Organ':<10} {'Scenario':<32} {'Variant':<12} {'Score':<8} {'Verdict':<8}")
    print(f"{'-' * 72}")

    for r in results:
        status = "✅ PASS" if r["passed"] else "❌ FAIL"
        if r.get("errors"):
            status = f"⚠️  ERR({len(r['errors'])})"
        print(
            f"{r['organ']:<10} {r['scenario']:<32} {r['variant']:<12} "
            f"{r['score']:.2f}     {status}"
        )

        if verbose and r.get("errors"):
            for err in r["errors"]:
                print(f"          └─ {err}")
        if verbose and not r["passed"]:
            details = r.get("details", {}).get("verifier", {})
            failures = details.get("failures", [])
            for f in failures:
                print(f"          └─ {f}")

    print(f"{'=' * 72}")
    return passed, failed


def validate_configs():
    """Validate all organ packs and bench config without executing."""
    packs = load_all_packs()
    errors = []
    for pack in packs:
        name = pack.get("name", "unknown")
        scenarios = pack.get("scenarios", [])
        if not scenarios:
            errors.append(f"{name}: no scenarios defined")
        for s in scenarios:
            if "verifier" not in s:
                errors.append(f"{name}/{s.get('id', '?')}: missing verifier")
            if "prompt" not in s:
                errors.append(f"{name}/{s.get('id', '?')}: missing prompt")
            variants = s.get("variants", [])
            if not variants:
                errors.append(f"{name}/{s.get('id', '?')}: no variants defined")

    if errors:
        print("VALIDATION FAILED:")
        for e in errors:
            print(f"  ❌ {e}")
        sys.exit(1)
    print(f"✅ All {len(packs)} organ packs valid")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="FORGE-BENCH: Federation Tool Benchmark"
    )
    parser.add_argument("--config", default="bench.json", help="Matrix config file")
    parser.add_argument("--organ", help="Run only this organ (e.g., geox, wealth)")
    parser.add_argument(
        "--live", action="store_true", help="Use live HTTP endpoints (not mock)"
    )
    parser.add_argument("--ci", action="store_true", help="CI mode: exit 0/2/1")
    parser.add_argument("--validate", action="store_true", help="Validate configs only")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument(
        "--ratchet", action="store_true", help="Run AutoResearch-style ratchet"
    )
    parser.add_argument(
        "--session-token",
        help="SCT from arif_init (required for auth-gated organs: GEOX, WEALTH, A-FORGE)",
    )
    args = parser.parse_args()

    # Validate mode
    if args.validate:
        validate_configs()
        return

    # Load packs
    if args.organ:
        packs = [load_organ_pack(args.organ)]
        print(f"FORGE-BENCH: Testing organ '{args.organ}'")
    else:
        packs = load_all_packs()
        print(f"FORGE-BENCH: Testing {len(packs)} organs")

    # Auto-init arifOS session if live mode without explicit session_token
    session_token = getattr(args, "session_token", None)
    if args.live and not session_token:
        print("  Auto-init: binding arifOS session for constitutional gate...")
        init_client = HttpClient(timeout=10)
        init_resp = init_client.call_tool(
            "arifos",
            "arif_init",
            {
                "mode": "init",
                "actor_id": "forge-bench",
                "verbosity": "minimal",
                "requested_authority": "OBSERVE_ONLY",
            },
            base_url="http://localhost:8088",
        )
        init_text = extract_text_content(init_resp)
        try:
            init_data = json.loads(init_text)
            session_token = init_data.get("session_token") or init_data.get("sct")
        except (json.JSONDecodeError, TypeError):
            pass
        if session_token:
            print(f"  ✅ Session bound: {str(session_token)[:40]}...")
        else:
            print(f"  ⚠️  No session_token from arif_init — auth-gated organs will fail")

    # If explicit --session-token provided, it overrides auto-init
    if getattr(args, "session_token", None):
        session_token = args.session_token

    mode_label = "LIVE" if args.live else "MOCK (offline)"
    print(f"Mode: {mode_label}")
    print(f"Packs: {', '.join(p['name'] for p in packs)}")

    # Run all scenarios
    all_results = []
    ratchet_results = []

    for pack in packs:
        organ_name = pack["name"]
        transport = pack.get("transport", "mcp")  # "mcp" or "flame"
        scenarios = pack.get("scenarios", [])

        # Per-organ client: FLAME organs use FlameClient, MCP organs use HttpClient
        if args.live and transport == "flame":
            organ_client = FlameClient(
                base_url=pack.get("baseUrl", "http://localhost:18901")
            )
        elif args.live:
            organ_client = HttpClient(session_token=session_token)
        else:
            organ_client = MockClient()

        if not health_check(organ_client, pack):
            print(f"  ❌ {organ_name}: health check FAILED — skipping")
            all_results.append(
                {
                    "organ": organ_name,
                    "scenario": "HEALTH_CHECK",
                    "variant": "n/a",
                    "model": "n/a",
                    "passed": False,
                    "score": 0.0,
                    "errors": ["health_check_failed"],
                    "details": {},
                    "elapsed_s": 0.0,
                    "mock": not args.live,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "tool_under_test": "health",
                    "prompt": "",
                    "output": "",
                    "verifier": "none",
                    "raw_response": {},
                }
            )
            continue

        print(f"\n  {organ_name}: {len(scenarios)} scenarios")

        for scenario in scenarios:
            if args.ratchet:
                rr = run_ratchet(organ_client, pack, scenario)
                ratchet_results.append(rr)
                all_results.extend(rr["cells"])
            else:
                variants = scenario.get(
                    "variants", [{"id": "default", "mcpServers": []}]
                )
                for variant in variants:
                    result = execute_scenario(organ_client, pack, scenario, variant)
                    all_results.append(result)

    # Print results
    passed, failed = print_results(all_results, verbose=args.verbose)

    # Print ratchet summary if enabled
    if args.ratchet and ratchet_results:
        print(f"\n{'=' * 72}")
        print(f"  RATCHET SUMMARY (AutoResearch loop)")
        print(f"{'=' * 72}")
        for rr in ratchet_results:
            icon = "📈" if rr["improvement"] > 0 else "➡️ "
            print(
                f"  {icon} {rr['scenario']}: champion={rr['champion']} "
                f"({rr['champion_score']:.2f}) vs baseline={rr['baseline_score']:.2f} "
                f"Δ={rr['improvement']:+.2f}"
            )

    # Save report
    report_path = REPORTS_DIR / f"bench-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    os.makedirs(REPORTS_DIR, exist_ok=True)
    report = {
        "bench": "FORGE-BENCH",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode": mode_label,
        "total": len(all_results),
        "passed": passed,
        "failed": failed,
        "ratchet": ratchet_results if args.ratchet else None,
        "results": all_results,
    }
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2, default=str)

    print(f"\nReport: {report_path}")

    # CI exit codes
    if args.ci:
        if failed == 0:
            print("\nCI: ALL PASSED — exit 0")
            sys.exit(0)
        elif passed > 0:
            print(f"\nCI: {failed} FAILURES — exit 2")
            sys.exit(2)
        else:
            print("\nCI: CATASTROPHIC — exit 1")
            sys.exit(1)


if __name__ == "__main__":
    main()
