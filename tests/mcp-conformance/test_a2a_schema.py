#!/usr/bin/env python3
"""
A2A v1.0 Schema Conformance Test
Checks agent cards for forbidden legacy fields and validates structure.
"""

import json
import sys

# Forbidden top-level fields (v0.3 legacy)
FORBIDDEN_TOP_LEVEL = [
    "protocolVersion",  # Should be in supportedInterfaces[]
    "url",  # Should be in supportedInterfaces[]
    "preferredTransport",  # Removed in v1.0
    "additionalInterfaces",  # Replaced by supportedInterfaces[]
]

# Required v1.0 fields
REQUIRED_TOP_LEVEL = [
    "name",
    "capabilities",
]

# Valid A2A versions
VALID_VERSIONS = ["1.0", "1.0.0", "1.0.1"]


def check_card(card_path, card_name):
    """Check a single agent card for A2A v1.0 conformance."""
    findings = []
    try:
        with open(card_path) as f:
            card = json.load(f)
    except Exception as e:
        return [
            {"id": "PARSE", "severity": "HIGH", "status": "FAIL", "evidence": str(e)}
        ]

    # Check forbidden top-level fields
    for field in FORBIDDEN_TOP_LEVEL:
        if field in card:
            findings.append(
                {
                    "id": "G4",
                    "severity": "MEDIUM",
                    "status": "FAIL",
                    "evidence": f"Forbidden legacy field '{field}' present at top level",
                }
            )

    # Check required fields
    for field in REQUIRED_TOP_LEVEL:
        if field not in card:
            findings.append(
                {
                    "id": "SCHEMA",
                    "severity": "HIGH",
                    "status": "FAIL",
                    "evidence": f"Required field '{field}' missing",
                }
            )

    # Check supportedInterfaces
    if "supportedInterfaces" in card:
        for iface in card["supportedInterfaces"]:
            if "url" not in iface:
                findings.append(
                    {
                        "id": "INTERFACE",
                        "severity": "HIGH",
                        "status": "FAIL",
                        "evidence": "supportedInterfaces entry missing 'url'",
                    }
                )
            if "protocolVersion" in iface:
                ver = iface["protocolVersion"]
                if ver not in VALID_VERSIONS:
                    findings.append(
                        {
                            "id": "G1",
                            "severity": "HIGH",
                            "status": "FAIL",
                            "evidence": f"Invalid protocol version: {ver}",
                        }
                    )

    # Check for stale protocolVersion value
    stale_ver = card.get("protocolVersion")
    if stale_ver and stale_ver not in VALID_VERSIONS:
        findings.append(
            {
                "id": "G1",
                "severity": "HIGH",
                "status": "FAIL",
                "evidence": f"Stale/invalid protocolVersion: {stale_ver}",
            }
        )

    # Check extensions
    caps = card.get("capabilities", {})
    extensions = caps.get("extensions", []) if isinstance(caps, dict) else []
    for ext in extensions:
        if "uri" not in ext:
            findings.append(
                {
                    "id": "EXT",
                    "severity": "MEDIUM",
                    "status": "FAIL",
                    "evidence": "Extension missing 'uri'",
                }
            )

    # Check for signatures
    if "signatures" not in card:
        findings.append(
            {
                "id": "G5",
                "severity": "HIGH",
                "status": "FAIL",
                "evidence": "No signatures[] array (unsigned card)",
            }
        )

    if not findings:
        findings.append(
            {
                "id": "PASS",
                "severity": "INFO",
                "status": "PASS",
                "evidence": "Card conforms to A2A v1.0 schema",
            }
        )

    return findings


if __name__ == "__main__":
    import glob

    card_paths = glob.glob("/root/AAA/agents/*/agent-card.json")
    print(f"A2A v1.0 Schema Conformance Check")
    print(f"=" * 50)
    total_fail = 0
    total_pass = 0
    for path in sorted(card_paths):
        name = path.split("/")[-2]
        findings = check_card(path, name)
        fails = [f for f in findings if f["status"] == "FAIL"]
        passes = [f for f in findings if f["status"] == "PASS"]
        total_fail += len(fails)
        total_pass += len(passes)
        icon = "✅" if not fails else "❌"
        print(f"\n{icon} {name}")
        for f in findings:
            print(f"   [{f['severity']}] {f['id']}: {f['evidence']}")

    print(f"\n{'=' * 50}")
    print(f"Total: {len(card_paths)} cards | {total_pass} pass | {total_fail} fail")
