#!/usr/bin/env python3
"""FED Actor Key Plan — plan-only provisioning for key-based attribution.

Why this exists
---------------
Not every harness can send x-arifos-* headers. A per-actor LiteLLM virtual key
gives the attribution callback a deterministic identity at precedence level 2
(authenticated key/team, confidence 0.95) with zero client cooperation and no
prompt inspection. It also works unchanged from kvm2 / kvm4 / future nodes.

This script NEVER calls the LiteLLM admin API, never reads the master key, and
never prints secrets. It emits the exact payloads an authorized operator (or an
F13-gated apply step) would send to POST /key/generate.

Usage
-----
  python3 scripts/fed_actor_key_plan.py
  python3 scripts/fed_actor_key_plan.py --models agi-333,asi-555 --out plan.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

AGENTS_REGISTRY = (
    Path(__file__).resolve().parent.parent / "deploy" / "fed" / "agents.json"
)


def build_plan(agents: dict, models: list[str], key_prefix: str = "fed-actor") -> dict:
    plan = []
    for a in agents.get("agents") or []:
        name = str(a.get("name") or "").strip().lower()
        if not name:
            continue
        alias = f"{key_prefix}-{name}"
        metadata = {
            "actor_id": name,
            "client": name,
            "contract": "arifos.fed-attribution.v1",
            "provisioned_by": "fed_actor_key_plan.py",
        }
        plan.append(
            {
                "key_alias": alias,
                "actor_id": name,
                "fi": a.get("fi"),
                "team_id": f"aaa-{name}",
                "user_id": name,
                "models": models,
                "metadata": metadata,
                "endpoint": "POST /key/generate (LiteLLM admin surface)",
                "payload": {
                    "key_alias": alias,
                    "team_id": f"aaa-{name}",
                    "user_id": name,
                    "models": models,
                    "metadata": metadata,
                    "duration": None,
                    "max_budget": None,
                },
                "delivery": "store the returned key in the harness secret store as FED_ACTOR_KEY; never in git",
                "verification": "run scripts/fed_flow_probe.py --live --actor <name> with the new key",
            }
        )
    return {
        "contract": "arifos.fed-attribution.v1",
        "mode": "PLAN_ONLY",
        "authority": "live key creation is a mutation: require F13/bounded authorization",
        "models": models,
        "keys": plan,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Plan FED per-actor virtual keys")
    ap.add_argument(
        "--models", default="agi-333", help="comma-separated allowed model groups"
    )
    ap.add_argument("--key-prefix", default="fed-actor")
    ap.add_argument("--registry", default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args(argv)

    path = Path(args.registry) if args.registry else AGENTS_REGISTRY
    agents = json.loads(path.read_text(encoding="utf-8"))
    models = [m.strip() for m in args.models.split(",") if m.strip()]
    plan = build_plan(agents, models, args.key_prefix)
    blob = json.dumps(plan, indent=2, sort_keys=True)
    if args.out:
        Path(args.out).write_text(blob + "\n", encoding="utf-8")
        print(f"wrote {args.out} ({len(plan['keys'])} key plans)")
    else:
        print(blob)
    return 0


if __name__ == "__main__":
    sys.exit(main())
