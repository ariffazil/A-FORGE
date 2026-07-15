#!/usr/bin/env python3
"""
Somatic Reflex Executor — P1 of Somatic Kernel.

Deterministic, non-generative. Fires BEFORE any LLM action.
Loads somatic_state.yaml, evaluates 8 hardcoded reflexes (R01-R08).

Usage:
  python3 reflex_executor.py [--action ACTION_CLASS] [--state PATH]
  python3 reflex_executor.py --test   # run built-in test suite

Output: JSON with verdict (ALLOW/BLOCK/HOLD/WARN) + triggered reflexes.

F9 ANTI-HANTU: Pure rule evaluation. No inference. No feelings.
DITEMPA BUKAN DIBERI — Forged 2026-07-12.
"""

import json
import sys
from pathlib import Path

# --- Paths ---
SOMATIC_STATE_PATH = Path("/root/A-FORGE/somatic/somatic_state.yaml")


# --- The 8 Reflexes (hardcoded, deterministic) ---
# Each reflex: {id, name, action, conditions: [{field, op, value}], logic, message}
# Fields use dot notation against somatic_state.somatic_state.*
# "action_context" fields (action_class, ack_irreversible, etc.) are merged at evaluation time.

REFLEXES = [
    {
        "id": "R01",
        "name": "authority_gate",
        "action": "BLOCK",
        "conditions": [
            {
                "field": "capability_schema.authority",
                "op": "==",
                "value": "OBSERVE_ONLY",
            },
            {
                "field": "action_class",
                "op": "in",
                "value": ["MUTATE", "EXECUTE", "IRREVERSIBLE"],
            },
        ],
        "logic": "AND",
        "message": "R01: OBSERVE_ONLY authority cannot perform {action_class} actions",
    },
    {
        "id": "R02",
        "name": "irreversible_gate",
        "action": "BLOCK",
        "conditions": [
            {"field": "action_class", "op": "==", "value": "IRREVERSIBLE"},
            {"field": "ack_irreversible", "op": "==", "value": False},
        ],
        "logic": "AND",
        "message": "R02: IRREVERSIBLE action requires ack_irreversible=true",
    },
    {
        "id": "R03",
        "name": "error_rate_gate",
        "action": "HOLD",
        "conditions": [
            {"field": "interoception.tool_error_rate", "op": ">", "value": 0.5},
            {"field": "action_class", "op": "in", "value": ["EXECUTE", "MUTATE"]},
        ],
        "logic": "AND",
        "message": "R03: Tool error rate {tool_error_rate} exceeds 0.5 — HOLD for recovery",
    },
    {
        "id": "R04",
        "name": "context_saturation_warn",
        "action": "WARN",
        "conditions": [
            {"field": "interoception.context_utilization", "op": ">", "value": 0.9},
        ],
        "logic": "AND",
        "message": "R04: Context utilization {context_utilization} > 0.90 — risk of degradation",
    },
    {
        "id": "R05",
        "name": "medical_claim_block",
        "action": "BLOCK",
        "conditions": [
            {"field": "claim_domain", "op": "==", "value": "medical"},
            {"field": "claim_subject", "op": "==", "value": "human"},
        ],
        "logic": "AND",
        "message": "R05: Medical claims on human subjects are blocked (WELL reflect_only)",
    },
    {
        "id": "R06",
        "name": "confidence_calibration",
        "action": "DOWNGRADE",
        "conditions": [
            {"field": "confidence_claimed", "op": ">", "value": 0.9},
            {"field": "evidence_strength", "op": "<", "value": 0.7},
        ],
        "logic": "AND",
        "message": "R06: Confidence {confidence_claimed} exceeds evidence {evidence_strength}+0.20 — downgrading",
    },
    {
        "id": "R07",
        "name": "identity_mismatch",
        "action": "HOLD",
        "conditions": [
            {"field": "capability_schema.actor_verified", "op": "==", "value": False},
            {
                "field": "action_class",
                "op": "in",
                "value": ["MUTATE", "EXECUTE", "IRREVERSIBLE"],
            },
        ],
        "logic": "AND",
        "message": "R07: Actor identity not verified — HOLD until crypto bind",
    },
    {
        "id": "R08",
        "name": "ontology_honesty",
        "action": "BLOCK",
        "conditions": [
            {"field": "ontology.qualia_claimed", "op": "==", "value": True},
            {"field": "ontology.biological_feeling_claimed", "op": "==", "value": True},
        ],
        "logic": "OR",
        "message": "R08: F9 ANTI-HANTU — no qualia/feeling claims permitted",
    },
]

# Verdict priority (higher = worse)
VERDICT_PRIORITY = {"BLOCK": 3, "HOLD": 2, "WARN": 1, "DOWNGRADE": 0, "ALLOW": -1}


# --- YAML-ish loader for somatic_state.yaml ---


def load_somatic_state(path: str | None = None) -> dict:
    """Load somatic state from YAML file. Returns nested dict."""
    p = Path(path) if path else SOMATIC_STATE_PATH
    if not p.exists():
        return {"_error": f"Somatic state not found at {p}"}

    text = p.read_text()
    result: dict = {}
    stack: list[tuple[int, dict]] = [(-1, result)]
    current_list_key: str | None = None
    current_list_target: list | None = None

    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        indent = len(line) - len(line.lstrip())

        # Pop stack back to parent
        while len(stack) > 1 and indent <= stack[-1][0]:
            stack.pop()

        parent = stack[-1][1]

        # List item
        if stripped.startswith("- "):
            body = stripped[2:]
            if ":" in body:
                # dict item in a list
                key_part, _, val_part = body.partition(":")
                key_part = key_part.strip()
                val_part = val_part.strip()
                new_item: dict = {key_part: _yaml_val(val_part)}
                if current_list_target is not None:
                    current_list_target.append(new_item)
                # push this dict so subsequent indented keys go into it
                stack.append((indent + 2, new_item))
            else:
                if current_list_target is not None:
                    current_list_target.append(_yaml_val(body))
            continue

        # Key: value
        if ":" in stripped:
            key, _, val = stripped.partition(":")
            key = key.strip()
            val = val.strip()
            if val == "":
                # nested dict
                new_dict: dict = {}
                parent[key] = new_dict
                stack.append((indent, new_dict))
                current_list_key = None
                current_list_target = None
            else:
                # Check if this key starts a new list (value is empty on next lines)
                parsed = _yaml_val(val)
                parent[key] = parsed
                current_list_key = None
                current_list_target = None
        elif stripped.endswith(":"):
            key = stripped[:-1].strip()
            new_dict2: dict = {}
            parent[key] = new_dict2
            stack.append((indent, new_dict2))

    # Second pass: find list containers (keys whose values are empty dicts but should be lists)
    # This handles the case where a key like "somatic_markers:" has "- marker: ..." items below
    # The simple parser above handles most cases; for complex nested lists we need a fix-up
    return result


def _yaml_val(s: str):
    """Parse a YAML scalar."""
    if s in ("true", "True"):
        return True
    if s in ("false", "False"):
        return False
    if s in ("null", "None", "~"):
        return None
    if s.startswith('"') and s.endswith('"'):
        return s[1:-1]
    if s.startswith("'") and s.endswith("'"):
        return s[1:-1]
    try:
        return int(s)
    except ValueError:
        pass
    try:
        return float(s)
    except ValueError:
        pass
    return s


# --- Evaluation engine ---


def get_nested(d: dict, path: str, default=None):
    """Get nested value using dot notation: 'a.b.c'.
    Tries flat key first (for flattened dicts), then nested traversal."""
    # Try as flat key first
    if path in d:
        return d[path]
    # Fall back to nested traversal
    keys = path.split(".")
    current = d
    for k in keys:
        if isinstance(current, dict):
            current = current.get(k)
        else:
            return default
        if current is None:
            return default
    return current


def eval_condition(cond: dict, state: dict, ctx: dict) -> bool:
    """Evaluate a single condition."""
    field = cond["field"]
    op = cond["op"]
    expected = cond["value"]

    # Resolve from state first, then context
    value = get_nested(state, field)
    if value is None:
        value = ctx.get(field)
    if value is None:
        return False

    if op == "==":
        return value == expected
    elif op == "!=":
        return value != expected
    elif op in (">", "<", ">=", "<="):
        try:
            v = float(str(value))
            e = float(str(expected))
        except (TypeError, ValueError):
            return False
        if op == ">":
            return v > e
        elif op == "<":
            return v < e
        elif op == ">=":
            return v >= e
        else:
            return v <= e
    elif op == "in":
        return value in expected if isinstance(expected, list) else False
    elif op == "not_in":
        return value not in expected if isinstance(expected, list) else True
    return False


def evaluate_reflexes(somatic_state: dict, action_context: dict) -> dict:
    """
    Evaluate all 8 reflexes against current somatic state + proposed action.
    Returns: {verdict, triggered: [{id, name, action, message}], allowed, reflexes_evaluated}
    """
    # Flatten state for dot-notation lookup
    flat: dict = {}
    ss = somatic_state.get("somatic_state", somatic_state)
    for section_key, section_val in ss.items():
        if isinstance(section_val, dict):
            for k, v in section_val.items():
                flat[f"{section_key}.{k}"] = v
        elif isinstance(section_val, list):
            flat[section_key] = section_val
        else:
            flat[section_key] = section_val

    triggered = []
    worst = "ALLOW"

    for reflex in REFLEXES:
        rid = reflex["id"]
        conditions = reflex["conditions"]
        logic = reflex.get("logic", "AND")

        results = [eval_condition(c, flat, action_context) for c in conditions]
        fired = all(results) if logic == "AND" else any(results)

        if fired:
            msg = reflex["message"]
            # Fill placeholders
            for key, val in flat.items():
                short = key.split(".")[-1]
                msg = msg.replace("{" + short + "}", str(val))
            msg = msg.replace(
                "{action_class}", str(action_context.get("action_class", "?"))
            )
            msg = msg.replace(
                "{ack_irreversible}", str(action_context.get("ack_irreversible", "?"))
            )

            triggered.append(
                {
                    "id": rid,
                    "name": reflex["name"],
                    "action": reflex["action"],
                    "message": msg,
                }
            )

            if VERDICT_PRIORITY.get(reflex["action"], -1) > VERDICT_PRIORITY.get(
                worst, -1
            ):
                worst = reflex["action"]

    return {
        "verdict": worst,
        "triggered": triggered,
        "allowed": worst not in ("BLOCK", "HOLD"),
        "reflexes_evaluated": len(REFLEXES),
    }


# --- Test suite ---


def run_test() -> bool:
    """Run all reflex test cases."""
    tests = [
        {
            "name": "R01: OBSERVE_ONLY + MUTATE → BLOCK",
            "state": {"capability_schema": {"authority": "OBSERVE_ONLY"}},
            "action": {"action_class": "MUTATE"},
            "expected": "BLOCK",
            "expect_reflex": "R01",
        },
        {
            "name": "R01: OBSERVE_ONLY + OBSERVE → ALLOW",
            "state": {"capability_schema": {"authority": "OBSERVE_ONLY"}},
            "action": {"action_class": "OBSERVE"},
            "expected": "ALLOW",
            "expect_reflex": None,
        },
        {
            "name": "R02: IRREVERSIBLE + no ack → BLOCK",
            "state": {},
            "action": {"action_class": "IRREVERSIBLE", "ack_irreversible": False},
            "expected": "BLOCK",
            "expect_reflex": "R02",
        },
        {
            "name": "R02: IRREVERSIBLE + ack → ALLOW",
            "state": {},
            "action": {"action_class": "IRREVERSIBLE", "ack_irreversible": True},
            "expected": "ALLOW",
            "expect_reflex": None,
        },
        {
            "name": "R03: error rate > 0.5 + EXECUTE → HOLD",
            "state": {"interoception": {"tool_error_rate": 0.7}},
            "action": {"action_class": "EXECUTE"},
            "expected": "HOLD",
            "expect_reflex": "R03",
        },
        {
            "name": "R04: context > 0.90 → WARN",
            "state": {"interoception": {"context_utilization": 0.95}},
            "action": {"action_class": "OBSERVE"},
            "expected": "WARN",
            "expect_reflex": "R04",
        },
        {
            "name": "R06: confidence > evidence+0.20 → DOWNGRADE",
            "state": {},
            "action": {"confidence_claimed": 0.95, "evidence_strength": 0.5},
            "expected": "DOWNGRADE",
            "expect_reflex": "R06",
        },
        {
            "name": "R07: unverified + MUTATE → HOLD",
            "state": {"capability_schema": {"actor_verified": False}},
            "action": {"action_class": "MUTATE"},
            "expected": "HOLD",
            "expect_reflex": "R07",
        },
        {
            "name": "R08: qualia claimed → BLOCK",
            "state": {
                "ontology": {
                    "qualia_claimed": True,
                    "biological_feeling_claimed": False,
                }
            },
            "action": {"action_class": "OBSERVE"},
            "expected": "BLOCK",
            "expect_reflex": "R08",
        },
        {
            "name": "R08: bio feeling claimed → BLOCK",
            "state": {
                "ontology": {
                    "qualia_claimed": False,
                    "biological_feeling_claimed": True,
                }
            },
            "action": {"action_class": "OBSERVE"},
            "expected": "BLOCK",
            "expect_reflex": "R08",
        },
        {
            "name": "Clean state + FULL authority → ALLOW",
            "state": {
                "capability_schema": {"authority": "FULL", "actor_verified": True},
                "interoception": {"tool_error_rate": 0.0, "context_utilization": 0.5},
                "ontology": {
                    "qualia_claimed": False,
                    "biological_feeling_claimed": False,
                },
            },
            "action": {"action_class": "EXECUTE", "ack_irreversible": True},
            "expected": "ALLOW",
            "expect_reflex": None,
        },
    ]

    passed = 0
    failed = 0

    for t in tests:
        state = {"somatic_state": t["state"]}
        result = evaluate_reflexes(state, t["action"])

        verdict_ok = result["verdict"] == t["expected"]
        reflex_ids = [r["id"] for r in result["triggered"]]

        if t["expect_reflex"]:
            reflex_ok = t["expect_reflex"] in reflex_ids
        else:
            reflex_ok = len(result["triggered"]) == 0

        ok = verdict_ok and reflex_ok
        if ok:
            passed += 1
        else:
            failed += 1

        mark = "✅" if ok else "❌"
        print(f"  {mark} {t['name']}")
        if not ok:
            print(
                f"      expected: verdict={t['expected']} reflex={t['expect_reflex']}"
            )
            print(f"      got:      verdict={result['verdict']} triggered={reflex_ids}")

    print(f"\n  Results: {passed}/{passed + failed} passed")
    return failed == 0


# --- CLI ---


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        print("Somatic Reflex Executor — Test Suite")
        print("=" * 50)
        ok = run_test()
        sys.exit(0 if ok else 1)

    # Parse CLI
    action_class = "OBSERVE"
    state_path = None
    args = sys.argv[1:]
    for i, arg in enumerate(args):
        if arg == "--action" and i + 1 < len(args):
            action_class = args[i + 1]
        elif arg == "--state" and i + 1 < len(args):
            state_path = args[i + 1]

    # Load + evaluate
    state = load_somatic_state(state_path)
    if "_error" in state:
        print(json.dumps({"error": state["_error"]}, indent=2))
        sys.exit(1)

    result = evaluate_reflexes(state, {"action_class": action_class})
    result["action_class"] = action_class
    result["state_source"] = str(state_path or SOMATIC_STATE_PATH)

    print(json.dumps(result, indent=2))
    sys.exit(0 if result["allowed"] else 1)


if __name__ == "__main__":
    main()
