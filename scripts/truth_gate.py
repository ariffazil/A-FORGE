#!/usr/bin/env python3
"""
truth_gate.py — CLI bridge for claim_must_use_receipt().

Wired into forge_judge_proxy (core.ts) so every claim entering arif_judge
passes through the truth enforcement gate.

Usage:
  python3 truth_gate.py <warga_id> <statement> [--irreversible]

Returns JSON with:
  allowed, evidence_layer, verdict, receipt_id, instruction

Exit code:
  0 = allowed (claim may proceed)
  1 = blocked (claim must HOLD)
  2 = error
"""

import sys, json, os
from pathlib import Path

# Locate paths_resolver relative to this script:
# scripts/truth_gate.py → ../paradox-engine/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "paradox-engine"))
from paths_resolver import org_path  # noqa: E402

# Add arifOS to sys.path (env override still wins, then falls back to resolver)
ARIFOS_ROOT = os.environ.get("ARIFOS_ROOT") or str(org_path("arifOS"))
sys.path.insert(0, ARIFOS_ROOT)

try:
    from arifosmcp.arifos_vault.truth_enforcement import claim_must_use_receipt
except ImportError as e:
    print(
        json.dumps(
            {
                "error": f"Cannot import truth_enforcement: {e}",
                "allowed": False,
                "reason": "gate_import_failed",
                "instruction": "HALT — cannot load truth enforcement module",
            }
        )
    )
    sys.exit(2)


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Truth Enforcement Gate — CLI bridge")
    parser.add_argument(
        "warga_id", help="AAA warga agent ID (e.g. opencode, forge, hermes)"
    )
    parser.add_argument("statement", help="The claim being submitted to judge")
    parser.add_argument(
        "--irreversible", action="store_true", help="Mark as irreversible"
    )
    args = parser.parse_args()

    try:
        result = claim_must_use_receipt(
            warga_id=args.warga_id,
            statement=args.statement,
            irreversible=args.irreversible,
        )

        # Serialize for JSON output
        output = {
            "gate": "truth_enforcement",
            "warga": result.get("warga"),
            "allowed": result.get("allowed"),
            "reason": result.get("reason"),
            "evidence_layer": result.get("evidence_layer"),
            "verdict": result.get("verdict"),
            "receipt_id": result.get("receipt_id"),
            "instruction": result.get("instruction"),
        }

        print(json.dumps(output))

        if result.get("allowed") is True:
            sys.exit(0)
        else:
            sys.exit(1)

    except Exception as e:
        print(
            json.dumps(
                {
                    "error": str(e),
                    "allowed": False,
                    "reason": "gate_execution_failed",
                    "instruction": f"HALT — gate threw: {str(e)[:200]}",
                }
            )
        )
        sys.exit(2)


if __name__ == "__main__":
    main()
