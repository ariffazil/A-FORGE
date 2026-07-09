#!/usr/bin/env python3
"""
agent-onboard.py — Agent Registration Ceremony for arifOS Federation
═══════════════════════════════════════════════════════════════════════
DITEMPA BUKAN DIBERI — Forged, Not Given.

Three gates:
  GATE 1: Validate public key (Ed25519, PEM format)
  GATE 2: Challenge-response (optional, for live agents)
  GATE 3: Register in agent_identities.json

Usage:
  # Standard onboarding (challenge-response)
  python3 agent-onboard.py \\
    --agent-id FORGE \\
    --agent-type opencode \\
    --role governed_coder \\
    --public-key /root/A-FORGE/IDENTITY/keys/FORGE/FORGE_ed25519_public.pem \\
    --authority '{"observe": true, "dry_run": true, "mutate_files": "lease_required"}'

  # Sovereign-approved onboarding (bypass challenge)
  python3 agent-onboard.py \\
    --agent-id hermes \\
    --agent-type external \\
    --role telegram_agent \\
    --public-key /tmp/hermes_public.pem \\
    --sovereign-approval

  # List all registered agents
  python3 agent-onboard.py --list

  # Verify an agent's identity proof
  python3 agent-onboard.py --verify FORGE
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Paths
REGISTRY_PATH = Path("/root/A-FORGE/data/agent_identities.json")
KEYS_DIR = Path("/root/A-FORGE/IDENTITY/keys")
ALERTS_LOG = Path("/root/A-FORGE/data/governance_alerts.log")
SOVEREIGN_KEY = Path("/root/AAA/IDENTITY/keys/arif_public.pem")


def load_registry() -> dict:
    """Load agent identities registry."""
    if not REGISTRY_PATH.exists():
        return {}
    return json.loads(REGISTRY_PATH.read_text())


def save_registry(registry: dict) -> None:
    """Save agent identities registry."""
    REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    REGISTRY_PATH.write_text(json.dumps(registry, indent=2, default=str))
    print(f"✅ Registry saved to {REGISTRY_PATH}")


def log_alert(event: str, data: dict) -> None:
    """Append to governance alerts log."""
    ALERTS_LOG.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": event,
        **data,
    }
    with open(ALERTS_LOG, "a") as f:
        f.write(json.dumps(entry) + "\n")


def compute_fingerprint(public_key_pem: str) -> str:
    """Compute SHA256 fingerprint of a PEM public key."""
    import subprocess

    result = subprocess.run(
        ["openssl", "pkey", "-pubin", "-outform", "DER"],
        input=public_key_pem.encode(),
        capture_output=True,
    )
    if result.returncode != 0:
        raise ValueError(f"Invalid public key: {result.stderr.decode()}")
    der_bytes = result.stdout
    return "sha256:" + hashlib.sha256(der_bytes).hexdigest()


def validate_ed25519_key(public_key_path: str) -> tuple[bool, str, str]:
    """
    Gate 1: Validate that the file contains a valid Ed25519 public key.
    Returns: (valid, pem_content, fingerprint)
    """
    import subprocess

    path = Path(public_key_path)
    if not path.exists():
        return False, "", f"File not found: {public_key_path}"

    pem_content = path.read_text().strip()

    # Verify it's a valid Ed25519 public key
    result = subprocess.run(
        ["openssl", "pkey", "-pubin", "-in", str(path), "-noout", "-text"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return False, "", f"Invalid key: {result.stderr}"

    if "ED25519" not in result.stdout.upper():
        return False, "", f"Not an Ed25519 key. Found: {result.stdout[:100]}"

    fingerprint = compute_fingerprint(pem_content)
    return True, pem_content, fingerprint


def challenge_response_ceremony(agent_id: str, public_key_pem: str) -> tuple[bool, str]:
    """
    Gate 2: Challenge-response verification.
    For interactive use — generates a nonce, asks agent to sign it.
    """
    import base64
    import secrets

    import subprocess

    nonce = secrets.token_urlsafe(32)
    message = f"{agent_id}:{nonce}"

    print(f"\n🔐 Challenge-Response Ceremony for '{agent_id}'")
    print(f"   Nonce: {nonce}")
    print(f"   Message to sign: {message}")
    print()
    print("   The agent must sign this message with its PRIVATE key.")
    print("   Command (on agent's machine):")
    print(
        f"     echo -n '{message}' | openssl pkeyutl -sign -inkey <private_key.pem> | base64"
    )
    print()

    signature_b64 = input("   Paste signature (base64): ").strip()
    if not signature_b64:
        return False, "No signature provided"

    # Verify the signature
    try:
        # Write public key to temp file
        import tempfile

        with tempfile.NamedTemporaryFile(mode="w", suffix=".pem", delete=False) as f:
            f.write(public_key_pem)
            pub_path = f.name

        sig_bytes = base64.b64decode(signature_b64)
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(sig_bytes)
            sig_path = f.name

        result = subprocess.run(
            [
                "openssl",
                "pkeyutl",
                "-verify",
                "-pubin",
                "-inkey",
                pub_path,
                "-sigfile",
                sig_path,
            ],
            input=message.encode(),
            capture_output=True,
        )

        os.unlink(pub_path)
        os.unlink(sig_path)

        if result.returncode == 0:
            return True, "Challenge-response verified"
        else:
            return False, f"Verification failed: {result.stderr.decode()}"

    except Exception as e:
        return False, f"Verification error: {e}"


def register_agent(
    agent_id: str,
    agent_type: str,
    role: str,
    public_key_pem: str,
    fingerprint: str,
    authority: dict,
    verification_method: str,
    sovereign_approval: bool = False,
) -> dict:
    """Gate 3: Register agent in registry."""
    registry = load_registry()

    now = datetime.now(timezone.utc).isoformat()

    entry = {
        "agent_id": agent_id,
        "agent_type": agent_type,
        "role": role,
        "authority": authority,
        "identity_proof": {
            "type": "ed25519",
            "public_key_fingerprint": fingerprint,
            "public_key_pem": public_key_pem,
            "registered_at": now,
            "verification_method": verification_method,
            "verified_by": "sovereign" if sovereign_approval else "arifOS_kernel",
        },
        "trust_tier": "OBSERVED",
        "registered_at": now,
        "last_seen": now,
        "lease_ids": [],
    }

    # Check if agent already exists
    if agent_id in registry:
        old = registry[agent_id]
        old_proof = old.get("identity_proof", {})
        force = bool(os.environ.get("ARIFOS_ONBOARD_FORCE") or entry.get("_force"))
        if isinstance(old_proof, dict) and old_proof.get("type") == "ed25519":
            print(f"⚠️  Agent '{agent_id}' already has Ed25519 identity.")
            print(
                f"    Fingerprint: {old_proof.get('public_key_fingerprint', 'unknown')}"
            )
            print(f"    Registered:  {old_proof.get('registered_at', 'unknown')}")
            if not force:
                confirm = input("    Overwrite? [y/N] ").strip().lower()
                if confirm != "y":
                    print("    Aborted.")
                    return old
            else:
                print("    Overwrite forced (ARIFOS_ONBOARD_FORCE=1).")
        # Archive old entry
        entry["previous_identity"] = old_proof
        entry.pop("_force", None)

    registry[agent_id] = entry
    save_registry(registry)

    # Log to governance alerts
    log_alert(
        "agent_registered",
        {
            "agent_id": agent_id,
            "agent_type": agent_type,
            "fingerprint": fingerprint,
            "verification_method": verification_method,
            "sovereign_approval": sovereign_approval,
        },
    )

    return entry


def list_agents() -> None:
    """List all registered agents."""
    registry = load_registry()
    if not registry:
        print("Registry is empty.")
        return

    print(
        f"\n{'Agent ID':<25} {'Type':<12} {'Trust Tier':<12} {'Identity':<15} {'Last Seen':<20}"
    )
    print("─" * 90)
    for agent_id, entry in registry.items():
        proof = entry.get("identity_proof", {})
        if isinstance(proof, dict):
            proof_type = proof.get("type", "none")
            if proof_type == "ed25519":
                identity = "✅ Ed25519"
            else:
                identity = f"❓ {proof_type}"
        elif proof == "pending":
            identity = "⚠️  PENDING"
        else:
            identity = f"❓ {proof}"

        trust = entry.get("trust_tier", "UNVERIFIED")
        agent_type = entry.get("agent_type", "unknown")
        last_seen = (
            entry.get("last_seen", "never")[:19] if entry.get("last_seen") else "never"
        )

        print(
            f"{agent_id:<25} {agent_type:<12} {trust:<12} {identity:<15} {last_seen:<20}"
        )

    print(f"\nTotal: {len(registry)} agents")


def verify_agent(agent_id: str) -> None:
    """Verify an agent's identity proof."""
    registry = load_registry()
    if agent_id not in registry:
        print(f"❌ Agent '{agent_id}' not found in registry.")
        return

    entry = registry[agent_id]
    proof = entry.get("identity_proof", {})

    print(f"\n🔍 Verifying agent: {agent_id}")
    print(f"   Type:       {entry.get('agent_type', 'unknown')}")
    print(f"   Role:       {entry.get('role', 'unknown')}")
    print(f"   Trust Tier: {entry.get('trust_tier', 'UNVERIFIED')}")

    if isinstance(proof, str) and proof == "pending":
        print(f"   Identity:   ⚠️  PENDING — No cryptographic proof!")
        print(f"   Status:     UNVERIFIED — Agent cannot perform T3 actions.")
        log_alert(
            "verification_failed",
            {
                "agent_id": agent_id,
                "reason": "identity_proof is 'pending'",
            },
        )
        return

    if not isinstance(proof, dict):
        print(f"   Identity:   ❌ Invalid proof format: {type(proof)}")
        return

    proof_type = proof.get("type", "unknown")
    print(f"   Proof Type: {proof_type}")

    if proof_type == "ed25519":
        fingerprint = proof.get("public_key_fingerprint", "unknown")
        registered = proof.get("registered_at", "unknown")
        method = proof.get("verification_method", "unknown")
        verified_by = proof.get("verified_by", "unknown")

        print(f"   Fingerprint: {fingerprint}")
        print(f"   Registered:  {registered}")
        print(f"   Method:      {method}")
        print(f"   Verified By: {verified_by}")

        # Check if public key file exists in keys dir
        key_dir = KEYS_DIR / agent_id
        if key_dir.exists():
            pub_keys = list(key_dir.glob("*_public.pem"))
            if pub_keys:
                print(f"   Key File:    ✅ {pub_keys[0]}")
            else:
                print(f"   Key File:    ⚠️  No public key in {key_dir}")
        else:
            print(f"   Key Dir:     ⚠️  No key directory at {key_dir}")

        print(f"\n   Status: ✅ Identity proof is structurally valid.")
        print(f"   (Crypto verification requires live challenge-response)")
    else:
        print(f"   Status: ❌ Unknown proof type: {proof_type}")


def patch_pending_proofs() -> None:
    """Migration: Mark all 'pending' identity proofs as UNVERIFIED."""
    registry = load_registry()
    patched = 0

    for agent_id, entry in registry.items():
        proof = entry.get("identity_proof")
        if proof == "pending":
            entry["identity_proof"] = {
                "type": "unverified",
                "reason": "migrated_from_pending",
                "migrated_at": datetime.now(timezone.utc).isoformat(),
            }
            entry["trust_tier"] = "UNVERIFIED"
            patched += 1
            print(f"  ⬇️  {agent_id}: pending → UNVERIFIED")

    if patched > 0:
        save_registry(registry)
        log_alert("migration_pending_to_unverified", {"patched_count": patched})
        print(f"\n✅ Patched {patched} agents from 'pending' to UNVERIFIED.")
    else:
        print("No 'pending' proofs found. Registry is clean.")


def main():
    parser = argparse.ArgumentParser(
        description="Agent Onboarding Ceremony — arifOS Federation"
    )
    parser.add_argument("--agent-id", help="Agent identifier")
    parser.add_argument(
        "--agent-type", default="custom", help="Agent type (opencode|external|custom)"
    )
    parser.add_argument("--role", default="governed_coder", help="Agent role")
    parser.add_argument("--public-key", help="Path to Ed25519 public key PEM file")
    parser.add_argument("--authority", help="JSON string of authority bounds")
    parser.add_argument(
        "--sovereign-approval",
        action="store_true",
        help="Bypass challenge-response (sovereign approved)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing Ed25519 registration without prompt",
    )
    parser.add_argument(
        "--list", action="store_true", help="List all registered agents"
    )
    parser.add_argument("--verify", help="Verify an agent's identity proof")
    parser.add_argument(
        "--patch-pending",
        action="store_true",
        help="Migration: mark 'pending' proofs as UNVERIFIED",
    )

    args = parser.parse_args()

    if args.list:
        list_agents()
        return

    if args.verify:
        verify_agent(args.verify)
        return

    if args.patch_pending:
        print("🔧 Patching 'pending' identity proofs...")
        patch_pending_proofs()
        return

    # Standard onboarding flow
    if not args.agent_id:
        parser.error("--agent-id is required for onboarding")
    if not args.public_key:
        parser.error("--public-key is required for onboarding")

    agent_id = args.agent_id

    # Default authority bounds
    default_authority = {
        "observe": True,
        "dry_run": True,
        "propose_patch": True,
        "mutate_files": "lease_required",
        "shell_exec": "lease_required",
        "git_commit": "888_HOLD",
        "deploy": "888_HOLD",
        "vault_seal": "888_HOLD",
    }
    authority = json.loads(args.authority) if args.authority else default_authority

    # Gate 1: Validate public key
    print("=== Agent Onboarding Ceremony ===")
    print(f"Agent: {agent_id} ({args.agent_type}/{args.role})")
    print()
    print("GATE 1: Validating public key...")
    valid, pem_content, fingerprint = validate_ed25519_key(args.public_key)
    if not valid:
        print(f"❌ FAILED: {fingerprint}")
        log_alert(
            "onboarding_failed",
            {
                "agent_id": agent_id,
                "gate": 1,
                "reason": fingerprint,
            },
        )
        sys.exit(1)
    print(f"   ✅ Ed25519 public key validated")
    print(f"   Fingerprint: {fingerprint}")

    # Gate 2: Challenge-response (unless sovereign approval)
    if args.sovereign_approval:
        print()
        print("GATE 2: ⏭️  Bypassed (sovereign approval)")
        verification_method = "sovereign_approval"
    else:
        print()
        print("GATE 2: Challenge-response ceremony...")
        verified, reason = challenge_response_ceremony(agent_id, pem_content)
        if not verified:
            print(f"   ❌ FAILED: {reason}")
            log_alert(
                "onboarding_failed",
                {
                    "agent_id": agent_id,
                    "gate": 2,
                    "reason": reason,
                },
            )
            sys.exit(1)
        print(f"   ✅ Challenge-response verified")
        verification_method = "challenge_response"

    # Gate 3: Register
    print()
    print("GATE 3: Registering agent...")
    if args.force:
        os.environ["ARIFOS_ONBOARD_FORCE"] = "1"
    entry = register_agent(
        agent_id=agent_id,
        agent_type=args.agent_type,
        role=args.role,
        public_key_pem=pem_content,
        fingerprint=fingerprint,
        authority=authority,
        verification_method=verification_method,
        sovereign_approval=args.sovereign_approval,
    )

    print()
    print("=== Onboarding Complete ===")
    print(f"   Agent ID:    {agent_id}")
    print(f"   Trust Tier:  {entry.get('trust_tier', 'UNKNOWN')}")
    print(f"   Identity:    {fingerprint}")
    print(f"   Method:      {verification_method}")
    print()
    print("   The agent can now be authenticated via challenge-response.")
    print("   Private key must be kept secure on the agent's own machine.")


if __name__ == "__main__":
    main()
