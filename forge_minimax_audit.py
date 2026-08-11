#!/usr/bin/env python3
# forge_minimax_audit — A-FORGE wrapper for external_apex_audit.py
# Forged: 2026-08-11 by 333-AGI Δ MIND
# Purpose: register MiniMax-M3 external constitutional review as a forge_* callable
# Mechanism: thin wrapper that delegates to external_apex_audit.py and exposes
#            it as a JSON-friendly CLI for forge_shell integration
# Path: /root/A-FORGE/forge_minimax_audit.py
#
# Usage:
#   forge_shell(command="python3 /root/A-FORGE/forge_minimax_audit.py '{\"action_hash\":\"...\",\"evidence\":{...}}'")
#   → exits 0 with verdict JSON on stdout, errors on stderr
#
# Future: when A-FORGE serve.ts is rebuilt, this becomes forge_minimax_audit as proper MCP tool.

import sys
import os
import json
import subprocess
from pathlib import Path

DELEGATE = "/root/A-FORGE/external_apex_audit.py"


def main():
    if len(sys.argv) < 2:
        print(
            json.dumps(
                {
                    "error": "missing payload",
                    "usage": "forge_minimax_audit.py '<json payload>'",
                    "schema": {
                        "action_hash": "sha256:...",
                        "evidence": {
                            "actor": "...",
                            "intent": "...",
                            "reversibility": "REVERSIBLE|IRREVERSIBLE",
                            "blast_radius": "low|medium|high",
                            "label_OBS": ["..."],
                            "label_DER": ["..."],
                            "label_INT": ["..."],
                            "label_SPEC": ["..."],
                        },
                    },
                },
                indent=2,
            )
        )
        sys.exit(1)

    payload = sys.argv[1]
    try:
        json.loads(payload)  # validate JSON
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"invalid JSON payload: {e}"}))
        sys.exit(2)

    # Ensure delegate exists
    if not Path(DELEGATE).exists():
        print(json.dumps({"error": f"delegate missing: {DELEGATE}"}))
        sys.exit(3)

    # Ensure MINIMAX_API_KEY is in env (inherited from systemd)
    if not os.environ.get("MINIMAX_API_KEY"):
        print(
            json.dumps(
                {
                    "error": "MINIMAX_API_KEY not in env",
                    "fallback": "source /root/.secrets/kunci-mas.env before invoking",
                }
            ),
            file=sys.stderr,
        )
        sys.exit(4)

    # Delegate to external_apex_audit.py
    result = subprocess.run(
        ["python3", DELEGATE, payload], capture_output=True, text=True, timeout=120
    )
    if result.returncode != 0:
        print(
            json.dumps(
                {
                    "error": "external_apex_audit failed",
                    "stderr": result.stderr,
                    "stdout": result.stdout,
                }
            )
        )
        sys.exit(result.returncode)

    # Verify output is valid JSON
    try:
        verdict = json.loads(result.stdout)
        # Add wrapper metadata
        verdict["_wrapper"] = {
            "tool": "forge_minimax_audit",
            "delegate": DELEGATE,
            "wrapper_version": "1.0.0",
            "usage": "forge_shell → python3 /root/A-FORGE/forge_minimax_audit.py",
        }
        print(json.dumps(verdict, indent=2))
    except json.JSONDecodeError:
        print(
            json.dumps(
                {"error": "delegate returned non-JSON", "raw_stdout": result.stdout}
            )
        )
        sys.exit(5)


if __name__ == "__main__":
    main()
