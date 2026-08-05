#!/usr/bin/env python3
"""
arifOS-A-FORGE Hugging Face Import CLI
══════════════════════════════════════

Standalone script for A-FORGE to call the HF import gate via forge_shell.
Reads HF_TOKEN from environment. Reads request from stdin or CLI args.
Outputs JSON verdict to stdout. Exit code 0 = SEAL, 1 = HOLD, 2 = VOID, 3 = ERROR.

Usage:
  echo '{"repo_id":"microsoft/phi-2","intended_use":"reasoning"}' | python3 hf_import.py
  python3 hf_import.py --repo-id microsoft/phi-2 --intended-use reasoning
  python3 hf_import.py --preflight microsoft/phi-2
  python3 hf_import.py --batch microsoft/phi-2,google/gemma-2b,ariffazil/FFF

DITEMPA BUKAN DIBERI — Forged, Not Given. 2026-08-05.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

# Add arifOS to path for imports
ARIFOS_ROOT = os.environ.get("ARIFOS_ROOT", "/root/arifOS")
sys.path.insert(0, ARIFOS_ROOT)


def main():
    parser = argparse.ArgumentParser(
        description="arifOS Hugging Face Import Gate",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--repo-id",
        help="HF repo ID (e.g., microsoft/phi-2)",
    )
    parser.add_argument(
        "--intended-use",
        default="general",
        help="How the model will be used in arifOS",
    )
    parser.add_argument(
        "--actor-id",
        default="A-FORGE",
        help="Calling actor for audit trail",
    )
    parser.add_argument(
        "--session-id",
        default="",
        help="Governing session ID",
    )
    parser.add_argument(
        "--preflight",
        help="Quick preflight check for a single repo",
    )
    parser.add_argument(
        "--batch",
        help="Comma-separated list of repo IDs for batch screening",
    )
    parser.add_argument(
        "--dataset",
        action="store_true",
        help="Import as dataset (relaxed F8 threshold)",
    )
    parser.add_argument(
        "--min-gain",
        type=float,
        help="Override F8 minimum G threshold",
    )
    parser.add_argument(
        "--json-input",
        action="store_true",
        help="Read JSON request from stdin",
    )

    args = parser.parse_args()

    # Resolve repo_id from various inputs
    if args.json_input:
        try:
            data = json.load(sys.stdin)
            repo_id = data.get("repo_id", "")
            intended_use = data.get("intended_use", args.intended_use)
            actor_id = data.get("actor_id", args.actor_id)
            session_id = data.get("session_id", args.session_id)
            dataset = data.get("dataset", args.dataset)
            min_gain = data.get("min_gain", args.min_gain)
        except json.JSONDecodeError as exc:
            emit_error(f"Invalid JSON input: {exc}")
            sys.exit(3)
    elif args.preflight:
        repo_id = args.preflight
        intended_use = "preflight"
        actor_id = args.actor_id
        session_id = args.session_id
        dataset = False
        min_gain = None
    elif args.batch:
        repo_ids = [r.strip() for r in args.batch.split(",") if r.strip()]
        if not repo_ids:
            emit_error("No valid repo IDs in batch")
            sys.exit(3)
        run_batch(repo_ids, args.actor_id)
        return
    elif args.repo_id:
        repo_id = args.repo_id
        intended_use = args.intended_use
        actor_id = args.actor_id
        session_id = args.session_id
        dataset = args.dataset
        min_gain = args.min_gain
    else:
        emit_error(
            "No repo_id provided. Use --repo-id, --preflight, --batch, or --json-input"
        )
        sys.exit(3)

    # Run the import
    result = run_import(repo_id, intended_use, actor_id, session_id, dataset, min_gain)

    # Exit code mapping
    exit_codes = {"SEAL": 0, "HOLD": 1, "VOID": 2, "ERROR": 3}
    sys.exit(exit_codes.get(result.get("verdict", "ERROR"), 3))


def run_import(
    repo_id: str,
    intended_use: str,
    actor_id: str,
    session_id: str,
    dataset: bool = False,
    min_gain: float | None = None,
) -> dict:
    """Run the full import gate and emit JSON result."""
    try:
        from arifosmcp.integrations.hf_bridge import hf_bridge

        if hf_bridge is None:
            emit_error("HF Bridge not initialized — check HF_TOKEN environment")
            sys.exit(3)

        if dataset:
            result = hf_bridge.import_dataset(
                repo_id=repo_id,
                intended_use=intended_use,
                actor_id=actor_id,
                session_id=session_id,
            )
        else:
            result = hf_bridge.import_model(
                repo_id=repo_id,
                intended_use=intended_use,
                actor_id=actor_id,
                session_id=session_id,
                min_gain_override=min_gain,
            )

        output = result.to_kernel_response()
        print(json.dumps(output, indent=2, default=str))
        return output

    except ImportError as exc:
        emit_error(f"arifOS import failed: {exc}. Ensure ARIFOS_ROOT is set correctly.")
        sys.exit(3)
    except Exception as exc:
        emit_error(f"Import gate error: {exc}")
        sys.exit(3)


def run_batch(repo_ids: list[str], actor_id: str) -> None:
    """Run batch screening for multiple repos."""
    try:
        from arifosmcp.integrations.hf_bridge import hf_bridge

        if hf_bridge is None:
            emit_error("HF Bridge not initialized — check HF_TOKEN environment")
            sys.exit(3)

        results = hf_bridge.batch_screen(repo_ids)
        print(
            json.dumps(
                {"batch_results": results, "count": len(results)}, indent=2, default=str
            )
        )

        # Exit code based on worst result
        has_error = any(r.get("verdict") == "ERROR" for r in results)
        has_void = any(r.get("verdict") == "VOID" for r in results)
        has_hold = any(r.get("verdict") == "HOLD" for r in results)

        if has_error:
            sys.exit(3)
        elif has_void:
            sys.exit(2)
        elif has_hold:
            sys.exit(1)
        else:
            sys.exit(0)

    except Exception as exc:
        emit_error(f"Batch screening error: {exc}")
        sys.exit(3)


def emit_error(message: str) -> None:
    """Emit a structured error to stdout."""
    print(
        json.dumps(
            {
                "verdict": "ERROR",
                "error": message,
                "recommended_action": "INVESTIGATE",
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
