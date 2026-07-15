#!/usr/bin/env python3
"""
Somatic Scar Evaluator — P2 of Somatic Kernel.

Evaluates state-conditioned scars against current somatic state.
When conditions match → scar fires, returns constraint.

Usage:
  python3 scar_evaluator.py [--action ACTION_CLASS] [--state PATH] [--scars PATH]
  python3 scar_evaluator.py --test   # run built-in test suite

Output: JSON with fired_scars, total_evaluated, constraint_summary.

F9 ANTI-HANTU: Pure condition matching. No inference.
F2 TRUTH: All conditions reference measurable metrics.
DITEMPA BUKAN DIBERI — Forged 2026-07-12.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# --- Paths ---
SOMATIC_STATE_PATH = Path("/root/A-FORGE/somatic/somatic_state.yaml")
SCARS_PATH = Path("/root/A-FORGE/somatic/state_conditioned_scars.json")


# --- Minimal YAML loader (reused from reflex_executor) ---


def load_yaml(path: Path) -> dict:
    """Load a YAML file into a dict. Handles list-of-dicts."""
    if not path.exists():
        return {"_error": f"File not found: {path}"}
    text = path.read_text()
    result: dict = {}
    stack: list[dict] = [result]
    indent_stack: list[int] = [-1]
    list_key_stack: list[str | None] = [None]  # which key is a list

    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        indent = len(line) - len(line.lstrip())

        # Pop stack back to parent based on indent
        while len(stack) > 1 and indent <= indent_stack[-1]:
            stack.pop()
            indent_stack.pop()
            list_key_stack.pop()

        parent = stack[-1]

        # List item
        if stripped.startswith("- "):
            body = stripped[2:]
            # Find which key in parent should hold this list
            target_key = list_key_stack[-1]
            if target_key and target_key in parent:
                if not isinstance(parent[target_key], list):
                    parent[target_key] = []
                target_list = parent[target_key]
            else:
                # Fallback: find last list-valued key
                target_list = None
                for k in reversed(list(parent.keys())):
                    if isinstance(parent[k], list):
                        target_list = parent[k]
                        target_key = k
                        break
                if target_list is None:
                    continue

            if ":" in body:
                # dict item in a list
                key_part, _, val_part = body.partition(":")
                key_part = key_part.strip()
                val_part = val_part.strip()
                new_item: dict = {key_part: yaml_val(val_part)}
                target_list.append(new_item)
                stack.append(new_item)
                indent_stack.append(indent + 2)
                list_key_stack.append(None)
            else:
                target_list.append(yaml_val(body))
            continue

        # Key: value
        if ":" in stripped:
            key, _, val = stripped.partition(":")
            key = key.strip()
            val = val.strip()
            if val == "":
                # nested dict or list container — peek next line
                new_dict: dict = {}
                parent[key] = new_dict
                stack.append(new_dict)
                indent_stack.append(indent)
                # Check if next non-empty line starts with "- " (list)
                # We'll handle this by setting list_key_stack
                list_key_stack.append(key)
            else:
                parent[key] = yaml_val(val)
                list_key_stack.append(None)

    return result


def yaml_val(s: str):
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


# --- State flattening ---


def flatten_state(state: dict) -> dict:
    """Flatten nested somatic state for dot-notation lookup."""
    flat: dict = {}
    ss = state.get("somatic_state", state)
    for section_key, section_val in ss.items():
        if isinstance(section_val, dict):
            for k, v in section_val.items():
                flat[f"{section_key}.{k}"] = v
        elif isinstance(section_val, list):
            flat[section_key] = section_val
        else:
            flat[section_key] = section_val
    return flat


def get_nested(d: dict, path: str, default=None):
    """Get nested value. Tries flat key first, then nested traversal."""
    if path in d:
        return d[path]
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


# --- Condition evaluation ---


def eval_scar_condition(cond: dict, value) -> bool:
    """Evaluate a single condition against a value."""
    op = cond.get("operator", "")
    expected = cond.get("value")

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
    elif op == "length_>":
        if isinstance(value, list):
            try:
                return len(value) > int(str(expected))
            except (TypeError, ValueError):
                return False
        return False
    elif op == "length_==":
        if isinstance(value, list):
            try:
                return len(value) == int(str(expected))
            except (TypeError, ValueError):
                return False
        return False
    elif op == "length_<":
        if isinstance(value, list):
            try:
                return len(value) < int(str(expected))
            except (TypeError, ValueError):
                return False
        return False
    return False


# --- Scar evaluation ---


def evaluate_scars(
    somatic_state: dict, action_context: dict, scars_source=None
) -> dict:
    """
    Evaluate all state-conditioned scars against current somatic state.
    scars_source: path (str/Path) or dict with 'state_conditioned_scars' key.
    Returns: {fired_scars: [{id, failure_mode, constraint, scar_pressure, ...}],
              total_evaluated, total_fired, constraint_summary}
    """
    # Load scars
    if isinstance(scars_source, dict):
        scars_data = scars_source
    else:
        p = Path(scars_source) if scars_source else SCARS_PATH
        if not p.exists():
            return {
                "fired_scars": [],
                "total_evaluated": 0,
                "total_fired": 0,
                "error": f"Scars file not found: {p}",
            }
        if p.suffix == ".json":
            scars_data = json.loads(p.read_text())
        else:
            scars_data = load_yaml(p)
    scars = scars_data.get("state_conditioned_scars", [])

    # Flatten state
    flat = flatten_state(somatic_state)

    # Merge action context
    for k, v in action_context.items():
        flat[k] = v

    # Check expiry
    now = datetime.now(timezone.utc)

    fired = []
    for scar in scars:
        sid = scar.get("id", "?")
        auto_fire = scar.get("auto_fire", False)
        if not auto_fire:
            continue

        # Check expiry
        expiry = scar.get("expiry")
        if expiry and expiry != "null":
            try:
                exp_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
                if now > exp_dt:
                    continue  # scar expired
            except (ValueError, TypeError):
                pass  # invalid expiry, treat as no expiry

        # Evaluate conditions
        conditions = scar.get("state_conditions", {})
        all_match = True

        for metric, cond in conditions.items():
            value = get_nested(flat, metric)
            if not eval_scar_condition(cond, value):
                all_match = False
                break

        if all_match:
            fired.append(
                {
                    "id": sid,
                    "failure_mode": scar.get("failure_mode", "?"),
                    "constraint": scar.get("constraint", ""),
                    "scar_pressure": scar.get("scar_pressure", 0.5),
                    "counterexamples": scar.get("counterexamples", []),
                    "source": scar.get("source", "unknown"),
                    "fired_at": now.isoformat(),
                }
            )

    # Sort by scar_pressure descending
    fired.sort(key=lambda s: s.get("scar_pressure", 0), reverse=True)

    # Build constraint summary
    constraints = [f["constraint"] for f in fired if f.get("constraint")]

    return {
        "fired_scars": fired,
        "total_evaluated": len(scars),
        "total_fired": len(fired),
        "constraint_summary": constraints,
        "highest_pressure": fired[0]["scar_pressure"] if fired else 0.0,
    }


# --- Test suite ---


def run_test() -> bool:
    """Run test cases for scar evaluation."""
    test_scars = {
        "state_conditioned_scars": [
            {
                "id": "TEST-001",
                "failure_mode": "test: degraded + mutate",
                "state_conditions": {
                    "regulatory_state.state": {
                        "operator": "in",
                        "value": ["CAUTION", "PROTECTIVE", "SHUTDOWN"],
                    },
                    "action_class": {"operator": "==", "value": "MUTATE"},
                },
                "constraint": "Block mutation in degraded state",
                "auto_fire": True,
                "scar_pressure": 0.8,
                "counterexamples": ["NOMINAL state"],
                "expiry": None,
                "source": "test",
            },
            {
                "id": "TEST-002",
                "failure_mode": "test: high error rate",
                "state_conditions": {
                    "interoception.tool_error_rate": {"operator": ">", "value": 0.5},
                },
                "constraint": "Hold execution",
                "auto_fire": True,
                "scar_pressure": 0.6,
                "counterexamples": ["error_rate <= 0.1"],
                "expiry": None,
                "source": "test",
            },
            {
                "id": "TEST-003",
                "failure_mode": "test: expired scar",
                "state_conditions": {
                    "interoception.context_utilization": {
                        "operator": ">",
                        "value": 0.0,
                    },
                },
                "constraint": "Should not fire",
                "auto_fire": True,
                "scar_pressure": 0.1,
                "counterexamples": [],
                "expiry": "2020-01-01T00:00:00Z",  # expired
                "source": "test",
            },
            {
                "id": "TEST-004",
                "failure_mode": "test: auto_fire=false",
                "state_conditions": {
                    "interoception.context_utilization": {
                        "operator": ">",
                        "value": 0.0,
                    },
                },
                "constraint": "Should not fire",
                "auto_fire": False,
                "scar_pressure": 0.9,
                "counterexamples": [],
                "expiry": None,
                "source": "test",
            },
            {
                "id": "TEST-005",
                "failure_mode": "test: organs down",
                "state_conditions": {
                    "capability_schema.organs_down": {
                        "operator": "length_>",
                        "value": 0,
                    },
                },
                "constraint": "Route around degraded organs",
                "auto_fire": True,
                "scar_pressure": 0.7,
                "counterexamples": ["all organs healthy"],
                "expiry": None,
                "source": "test",
            },
        ]
    }

    # Test cases
    tests = [
        {
            "name": "TEST-001: degraded + mutate → fires",
            "state": {
                "somatic_state": {
                    "regulatory_state": {"state": "CAUTION"},
                    "interoception": {
                        "tool_error_rate": 0.0,
                        "context_utilization": 0.5,
                    },
                    "capability_schema": {"organs_down": []},
                }
            },
            "action": {"action_class": "MUTATE"},
            "expect_fired": ["TEST-001"],
            "expect_not_fired": ["TEST-002", "TEST-003", "TEST-004", "TEST-005"],
        },
        {
            "name": "TEST-002: high error rate → fires",
            "state": {
                "somatic_state": {
                    "regulatory_state": {"state": "NOMINAL"},
                    "interoception": {
                        "tool_error_rate": 0.7,
                        "context_utilization": 0.5,
                    },
                    "capability_schema": {"organs_down": []},
                }
            },
            "action": {"action_class": "OBSERVE"},
            "expect_fired": ["TEST-002"],
            "expect_not_fired": ["TEST-001", "TEST-003", "TEST-004", "TEST-005"],
        },
        {
            "name": "TEST-003: expired → never fires",
            "state": {
                "somatic_state": {
                    "regulatory_state": {"state": "NOMINAL"},
                    "interoception": {
                        "tool_error_rate": 0.0,
                        "context_utilization": 1.0,
                    },
                    "capability_schema": {"organs_down": []},
                }
            },
            "action": {"action_class": "OBSERVE"},
            "expect_fired": [],
            "expect_not_fired": ["TEST-003"],
        },
        {
            "name": "TEST-005: organs down → fires",
            "state": {
                "somatic_state": {
                    "regulatory_state": {"state": "NOMINAL"},
                    "interoception": {
                        "tool_error_rate": 0.0,
                        "context_utilization": 0.5,
                    },
                    "capability_schema": {"organs_down": ["geox"]},
                }
            },
            "action": {"action_class": "OBSERVE"},
            "expect_fired": ["TEST-005"],
            "expect_not_fired": ["TEST-001", "TEST-002", "TEST-003", "TEST-004"],
        },
        {
            "name": "Clean state → nothing fires",
            "state": {
                "somatic_state": {
                    "regulatory_state": {"state": "NOMINAL"},
                    "interoception": {
                        "tool_error_rate": 0.0,
                        "context_utilization": 0.5,
                    },
                    "capability_schema": {"organs_down": []},
                }
            },
            "action": {"action_class": "OBSERVE"},
            "expect_fired": [],
            "expect_not_fired": [
                "TEST-001",
                "TEST-002",
                "TEST-003",
                "TEST-004",
                "TEST-005",
            ],
        },
    ]

    passed = 0
    failed = 0

    for t in tests:
        result = evaluate_scars(t["state"], t["action"], test_scars)
        fired_ids = [s["id"] for s in result["fired_scars"]]

        # Check expected fired
        ok = True
        for ef in t["expect_fired"]:
            if ef not in fired_ids:
                ok = False
        for enf in t["expect_not_fired"]:
            if enf in fired_ids:
                ok = False

        if ok:
            passed += 1
        else:
            failed += 1

        mark = "✅" if ok else "❌"
        print(f"  {mark} {t['name']}")
        if not ok:
            print(f"      expected fired: {t['expect_fired']}")
            print(f"      actually fired: {fired_ids}")

    print(f"\n  Results: {passed}/{passed + failed} passed")
    return failed == 0


# --- CLI ---


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        print("Somatic Scar Evaluator — Test Suite")
        print("=" * 50)
        ok = run_test()
        sys.exit(0 if ok else 1)

    # Parse CLI
    action_class = "OBSERVE"
    state_path = None
    scars_path = None
    args = sys.argv[1:]
    for i, arg in enumerate(args):
        if arg == "--action" and i + 1 < len(args):
            action_class = args[i + 1]
        elif arg == "--state" and i + 1 < len(args):
            state_path = args[i + 1]
        elif arg == "--scars" and i + 1 < len(args):
            scars_path = args[i + 1]

    # Load state
    p = Path(state_path) if state_path else SOMATIC_STATE_PATH
    if not p.exists():
        print(json.dumps({"error": f"Somatic state not found: {p}"}, indent=2))
        sys.exit(1)
    state = load_yaml(p)
    if "_error" in state:
        print(json.dumps({"error": state["_error"]}, indent=2))
        sys.exit(1)

    # Evaluate
    result = evaluate_scars(state, {"action_class": action_class}, scars_path)
    result["action_class"] = action_class
    result["state_source"] = str(p)

    print(json.dumps(result, indent=2))
    sys.exit(0 if result["total_fired"] == 0 else 2)


if __name__ == "__main__":
    main()
