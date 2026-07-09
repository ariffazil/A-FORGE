#!/usr/bin/env python3
"""
Canonical Receipt Schema Validation Tests
=========================================

Validates receipts against canonical_receipt.schema.json.
Tests both valid and invalid cases.

Usage:
    python test_canonical_receipt.py

Exit codes:
    0 = all tests passed
    1 = one or more tests failed

DITEMPA BUKAN DIBERI — The schema is the keel.
"""

import json
import sys
from pathlib import Path
from typing import Any

try:
    import jsonschema
    from jsonschema import validate, ValidationError
except ImportError:
    print("ERROR: jsonschema not installed. Run: pip install jsonschema")
    sys.exit(1)


# Paths
SCHEMA_PATH = Path(__file__).parent.parent / "canonical_receipt.schema.json"
VALID_RECEIPT_PATH = Path(__file__).parent.parent / "samples" / "valid_receipt.json"
INVALID_RECEIPTS_PATH = (
    Path(__file__).parent.parent / "samples" / "invalid_receipts.json"
)


def load_json(path: Path) -> dict:
    """Load JSON file."""
    with open(path) as f:
        return json.load(f)


def validate_receipt(receipt: dict, schema: dict) -> tuple[bool, str]:
    """
    Validate a receipt against the schema.

    Returns:
        (is_valid, error_message)
    """
    try:
        validate(instance=receipt, schema=schema)
        return True, "Valid"
    except ValidationError as e:
        return False, str(e.message)
    except Exception as e:
        return False, f"Unexpected error: {e}"


def test_valid_receipt(schema: dict) -> bool:
    """Test that the valid receipt passes validation."""
    print("\n[TEST] Valid receipt validation")
    receipt = load_json(VALID_RECEIPT_PATH)
    is_valid, error = validate_receipt(receipt, schema)

    if is_valid:
        print("  ✓ PASS: Valid receipt accepted")
        return True
    else:
        print(f"  ✗ FAIL: Valid receipt rejected: {error}")
        return False


def test_invalid_receipts(schema: dict) -> tuple[int, int]:
    """
    Test that invalid receipts are correctly rejected.

    Returns:
        (passed, failed) counts
    """
    print("\n[TEST] Invalid receipt rejection")
    invalid_data = load_json(INVALID_RECEIPTS_PATH)

    passed = 0
    failed = 0

    for case in invalid_data["invalid_cases"]:
        case_id = case["case_id"]
        description = case["description"]
        expected_failure = case["expected_failure"]
        receipt = case["receipt"]

        is_valid, error = validate_receipt(receipt, schema)

        if not is_valid:
            print(f"  ✓ PASS: {case_id} — {description}")
            print(f"    Expected: {expected_failure}")
            print(f"    Got: {error[:100]}...")
            passed += 1
        else:
            print(f"  ✗ FAIL: {case_id} — {description}")
            print(f"    Expected rejection but receipt was accepted")
            failed += 1

    return passed, failed


def test_schema_structure(schema: dict) -> bool:
    """Test that the schema has all required fields and enums."""
    print("\n[TEST] Schema structure validation")

    required_fields = [
        "receipt_id",
        "session_id",
        "actor_id",
        "principal_id",
        "operator_id",
        "agent_id",
        "tool_id",
        "organ",
        "tool_name",
        "action_class",
        "authority_scope",
        "input_hash",
        "output_hash",
        "timestamp",
        "epistemic_status",
        "evidence_layer",
        "authority_claim",
        "reversibility",
        "mutation",
        "external_side_effect",
        "witnesses",
        "dependencies",
        "floor_results",
        "verdict_request",
        "vault999_status",
    ]

    # Check required fields
    schema_required = schema.get("required", [])
    missing = [f for f in required_fields if f not in schema_required]
    if missing:
        print(f"  ✗ FAIL: Missing required fields: {missing}")
        return False
    else:
        print(f"  ✓ PASS: All {len(required_fields)} required fields present")

    # Check enum definitions
    properties = schema.get("properties", {})

    enum_checks = {
        "epistemic_status": ["OBS", "DER", "INT", "SPEC"],
        "evidence_layer": [
            "L1_GROUND_TRUTH",
            "L2_VERIFIED_STATE",
            "L3_CACHED_STATE",
            "L4_INFERRED",
        ],
        "authority_claim": [
            "NONE",
            "ADVISORY",
            "RECOMMENDATION",
            "VERDICT_REQUEST",
            "SEAL_REQUEST",
            "SEALED_RECEIPT",
        ],
        "reversibility": ["REVERSIBLE", "COSTLY_REVERSIBLE", "IRREVERSIBLE"],
        "action_class": ["OBSERVE", "COMPUTE", "RECOMMEND", "MUTATE", "SEAL_REQUEST"],
        "vault999_status": ["NONE", "DRAFT_ONLY", "REQUESTED", "SEALED"],
    }

    for field, expected_values in enum_checks.items():
        field_schema = properties.get(field, {})
        actual_values = field_schema.get("enum", [])
        if set(expected_values) == set(actual_values):
            print(f"  ✓ PASS: {field} enum values correct")
        else:
            print(
                f"  ✗ FAIL: {field} enum mismatch: expected {expected_values}, got {actual_values}"
            )
            return False

    # Check floor_results has F1-F13
    floor_results = properties.get("floor_results", {}).get("properties", {})
    for floor_num in range(1, 14):
        floor_key = f"F{floor_num}"
        if floor_key not in floor_results:
            print(f"  ✗ FAIL: Missing floor {floor_key} in floor_results")
            return False
    print(f"  ✓ PASS: All 13 floors (F1-F13) defined in floor_results")

    # Check allOf rules exist
    all_of = schema.get("allOf", [])
    if len(all_of) >= 3:
        print(
            f"  ✓ PASS: {len(all_of)} conditional rules defined (witness, L1, VAULT999)"
        )
    else:
        print(f"  ✗ FAIL: Expected at least 3 conditional rules, got {len(all_of)}")
        return False

    return True


def test_hard_rules(schema: dict) -> bool:
    """Test that hard rules are properly enforced."""
    print("\n[TEST] Hard rules enforcement")

    # Rule 1: No required identity field may be nullable
    required_fields = schema.get("required", [])
    properties = schema.get("properties", {})

    identity_fields = ["actor_id", "agent_id", "principal_id", "tool_id"]
    for field in identity_fields:
        if field in required_fields:
            field_schema = properties.get(field, {})
            # Check it doesn't have type: null
            field_type = field_schema.get("type")
            if field_type == "null":
                print(f"  ✗ FAIL: {field} is nullable (should be non-nullable)")
                return False
            # Check minLength if string
            if field_type == "string":
                min_length = field_schema.get("minLength", 0)
                if min_length > 0:
                    print(
                        f"  ✓ PASS: {field} is non-nullable string with minLength={min_length}"
                    )
                else:
                    print(f"  ✗ FAIL: {field} has no minLength constraint")
                    return False

    # Rule 2: No organ may emit L1 unless vault999_status is SEALED
    # (enforced via allOf conditional)
    all_of = schema.get("allOf", [])
    l1_rule_exists = False
    for rule in all_of:
        if_clause = rule.get("if", {})
        properties_if = if_clause.get("properties", {})
        if "evidence_layer" in properties_if:
            then_clause = rule.get("then", {})
            properties_then = then_clause.get("properties", {})
            if "vault999_status" in properties_then:
                vault_status = properties_then["vault999_status"]
                if vault_status.get("const") == "SEALED":
                    l1_rule_exists = True
                    print("  ✓ PASS: L1_GROUND_TRUTH requires vault999_status=SEALED")

    if not l1_rule_exists:
        print("  ✗ FAIL: Missing rule: L1_GROUND_TRUTH requires vault999_status=SEALED")
        return False

    # Rule 3: No ChatGPT/LLM/AAA output may emit SEALED
    # (enforced via allOf conditional: SEALED requires organ=VAULT999)
    vault_rule_exists = False
    for rule in all_of:
        if_clause = rule.get("if", {})
        properties_if = if_clause.get("properties", {})
        if "vault999_status" in properties_if:
            then_clause = rule.get("then", {})
            properties_then = then_clause.get("properties", {})
            if "organ" in properties_then:
                organ_const = properties_then["organ"]
                if organ_const.get("const") == "VAULT999":
                    vault_rule_exists = True
                    print("  ✓ PASS: SEALED status requires organ=VAULT999")

    if not vault_rule_exists:
        print("  ✗ FAIL: Missing rule: SEALED status requires organ=VAULT999")
        return False

    # Rule 4: witnesses must be non-empty for VERDICT_REQUEST and SEAL_REQUEST
    witness_rule_exists = False
    for rule in all_of:
        if_clause = rule.get("if", {})
        properties_if = if_clause.get("properties", {})
        if "authority_claim" in properties_if:
            authority_values = properties_if["authority_claim"].get("enum", [])
            if (
                "VERDICT_REQUEST" in authority_values
                and "SEAL_REQUEST" in authority_values
            ):
                then_clause = rule.get("then", {})
                properties_then = then_clause.get("properties", {})
                if "witnesses" in properties_then:
                    min_items = properties_then["witnesses"].get("minItems", 0)
                    if min_items >= 1:
                        witness_rule_exists = True
                        print(
                            "  ✓ PASS: VERDICT_REQUEST/SEAL_REQUEST require witnesses (minItems=1)"
                        )

    if not witness_rule_exists:
        print("  ✗ FAIL: Missing rule: VERDICT_REQUEST/SEAL_REQUEST require witnesses")
        return False

    return True


def main():
    """Run all tests."""
    print("=" * 60)
    print("CANONICAL RECEIPT SCHEMA VALIDATION TESTS")
    print("=" * 60)

    # Load schema
    try:
        schema = load_json(SCHEMA_PATH)
        print(f"\n✓ Schema loaded: {SCHEMA_PATH}")
    except Exception as e:
        print(f"\n✗ Failed to load schema: {e}")
        sys.exit(1)

    # Run tests
    results = []

    # Test 1: Schema structure
    results.append(("Schema structure", test_schema_structure(schema)))

    # Test 2: Hard rules
    results.append(("Hard rules", test_hard_rules(schema)))

    # Test 3: Valid receipt
    results.append(("Valid receipt", test_valid_receipt(schema)))

    # Test 4: Invalid receipts
    passed, failed = test_invalid_receipts(schema)
    results.append(("Invalid receipts", failed == 0))

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    all_passed = True
    for test_name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {status}: {test_name}")
        if not passed:
            all_passed = False

    print(f"\nInvalid receipt tests: {passed} passed, {failed} failed")

    if all_passed:
        print("\n✓ ALL TESTS PASSED — Schema is COMPLIANT")
        return 0
    else:
        print("\n✗ SOME TESTS FAILED — Schema requires fixes")
        return 1


if __name__ == "__main__":
    sys.exit(main())
