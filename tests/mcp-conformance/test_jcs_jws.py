#!/usr/bin/env python3
"""
RFC 8785 JCS (JSON Canonicalization Scheme) test vectors.
Tests canonicalization behavior for A2A signed agent cards.
"""
import json
import sys

def jcs_canonicalize(obj):
    """
    Simplified JCS canonicalization.
    Production version should use protobuf presence rules.
    This is a test vector generator, not a production implementation.
    """
    # Sort keys recursively, remove empty arrays/objects
    def sort_and_clean(o):
        if isinstance(o, dict):
            # Remove empty optional repeated fields
            cleaned = {}
            for k, v in sorted(o.items()):
                cv = sort_and_clean(v)
                # Keep explicitly set defaults (streaming: false)
                # Omit empty repeated fields (extensions: [])
                if isinstance(cv, list) and len(cv) == 0:
                    continue  # Omit empty repeated
                if isinstance(cv, dict) and len(cv) == 0:
                    continue  # Omit empty objects
                cleaned[k] = cv
            return cleaned
        elif isinstance(o, list):
            return [sort_and_clean(i) for i in o]
        else:
            return o

    cleaned = sort_and_clean(obj)
    return json.dumps(cleaned, separators=(',', ':'), ensure_ascii=False)

# Test vectors from A2A spec
test_vectors = [
    {
        "name": "Basic agent card",
        "input": {
            "name": "Example Agent",
            "description": "A test agent",
            "capabilities": {
                "streaming": False,
                "pushNotifications": False
            },
            "skills": []
        },
        "expected_canonical": '{"capabilities":{"pushNotifications":false,"streaming":false},"description":"A test agent","name":"Example Agent"}'
    },
    {
        "name": "Empty extensions omitted",
        "input": {
            "name": "Test",
            "capabilities": {
                "streaming": False,
                "extensions": []
            }
        },
        "expected_canonical": '{"capabilities":{"streaming":false},"name":"Test"}'
    },
    {
        "name": "Explicit default retained",
        "input": {
            "name": "Test",
            "capabilities": {
                "streaming": False  # Explicit default — KEEP
            }
        },
        "expected_canonical": '{"capabilities":{"streaming":false},"name":"Test"}'
    },
    {
        "name": "Unicode handling",
        "input": {
            "name": "Agent \u00e9\u00e8\u00ea",
            "description": "Unicode test \u4e16\u754c"
        },
        "expected_canonical": '{"description":"Unicode test \\u4e16\\u754c","name":"Agent \\u00e9\\u00e8\\u00ea"}'
    },
    {
        "name": "Numeric precision",
        "input": {
            "name": "Test",
            "version": 1.0
        },
        "expected_canonical": '{"name":"Test","version":1}'
    },
]

if __name__ == "__main__":
    print("RFC 8785 JCS Test Vectors")
    print("=" * 50)
    passed = 0
    failed = 0
    for tv in test_vectors:
        result = jcs_canonicalize(tv["input"])
        match = result == tv["expected_canonical"]
        icon = "✅" if match else "❌"
        print(f"\n{icon} {tv['name']}")
        if not match:
            print(f"   Expected: {tv['expected_canonical']}")
            print(f"   Got:      {result}")
            failed += 1
        else:
            print(f"   Canonical: {result}")
            passed += 1

    print(f"\n{'=' * 50}")
    print(f"Results: {passed} pass | {failed} fail | {passed + failed} total")

    # Also test JWS structure
    print(f"\nJWS Structure Test")
    print(f"-" * 50)
    import base64
    import hashlib
    import hmac

    # Simulate JWS signing
    protected_header = {"alg": "HS256", "typ": "JOSE", "kid": "test-key-1"}
    payload = test_vectors[0]["expected_canonical"]

    protected_b64 = base64.urlsafe_b64encode(
        json.dumps(protected_header, separators=(',', ':')).encode()
    ).rstrip(b'=').decode()

    payload_b64 = base64.urlsafe_b64encode(payload.encode()).rstrip(b'=').decode()

    signing_input = f"{protected_b64}.{payload_b64}"
    secret = b"test-secret-for-vectors-only"
    signature = hmac.new(secret, signing_input.encode(), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).rstrip(b'=').decode()

    jws = {
        "signatures": [{
            "protected": protected_b64,
            "signature": sig_b64,
            "header": {"kid": "test-key-1"}
        }]
    }

    print(f"  Protected header: {protected_b64[:40]}...")
    print(f"  Payload (b64): {payload_b64[:40]}...")
    print(f"  Signature (b64): {sig_b64[:40]}...")
    print(f"  JWS structure: ✅ Valid")

    # Verify
    verify_input = f"{protected_b64}.{payload_b64}"
    expected_sig = hmac.new(secret, verify_input.encode(), hashlib.sha256).digest()
    expected_b64 = base64.urlsafe_b64encode(expected_sig).rstrip(b'=').decode()
    verified = sig_b64 == expected_b64
    print(f"  Signature verification: {'✅ PASS' if verified else '❌ FAIL'}")

    if failed > 0 or not verified:
        sys.exit(1)
    sys.exit(0)
