#!/usr/bin/env bash
# agent-keygen.sh — Ed25519 keypair generator for arifOS federation agents
# ════════════════════════════════════════════════════════════════════════
# DITEMPA BUKAN DIBERI — Forged, Not Given.
#
# Usage:
#   ./agent-keygen.sh <agent_id> [output_dir]
#
# Example:
#   ./agent-keygen.sh FORGE /root/A-FORGE/IDENTITY/keys/FORGE
#   ./agent-keygen.sh hermes /tmp/hermes-keys
#
# Output:
#   <output_dir>/<agent_id>_ed25519_private.pem  (KEEP SECRET)
#   <output_dir>/<agent_id>_ed25519_public.pem   (submit to registry)
#   <output_dir>/<agent_id>_fingerprint.txt       (SHA256 of public key)
#
# Security:
#   - Private key NEVER leaves this machine
#   - Private key permissions set to 600
#   - Public key is safe to transfer
# ════════════════════════════════════════════════════════════════════════

set -euo pipefail

AGENT_ID="${1:?Usage: agent-keygen.sh <agent_id> [output_dir]}"
OUTPUT_DIR="${2:-/root/A-FORGE/IDENTITY/keys/${AGENT_ID}}"

# Validate agent_id (alphanumeric, hyphens, underscores only)
if [[ ! "$AGENT_ID" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "ERROR: agent_id must be alphanumeric (hyphens/underscores ok). Got: $AGENT_ID"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

PRIVATE_KEY="$OUTPUT_DIR/${AGENT_ID}_ed25519_private.pem"
PUBLIC_KEY="$OUTPUT_DIR/${AGENT_ID}_ed25519_public.pem"
FINGERPRINT="$OUTPUT_DIR/${AGENT_ID}_fingerprint.txt"

# Check if keys already exist
if [[ -f "$PRIVATE_KEY" ]]; then
    echo "WARNING: Private key already exists at $PRIVATE_KEY"
    echo "         Regenerating will invalidate the old key."
    read -p "         Continue? [y/N] " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

echo "=== Agent Key Generation ==="
echo "Agent ID:   $AGENT_ID"
echo "Output Dir: $OUTPUT_DIR"
echo ""

# Generate Ed25519 private key
openssl genpkey -algorithm Ed25519 -out "$PRIVATE_KEY" 2>/dev/null
chmod 600 "$PRIVATE_KEY"

# Extract public key
openssl pkey -in "$PRIVATE_KEY" -pubout -out "$PUBLIC_KEY" 2>/dev/null
chmod 644 "$PUBLIC_KEY"

# Compute SHA256 fingerprint of public key (DER format)
FINGERPRINT_HASH=$(openssl pkey -in "$PUBLIC_KEY" -pubin -outform DER 2>/dev/null | sha256sum | cut -d' ' -f1)
echo "sha256:${FINGERPRINT_HASH}" > "$FINGERPRINT"

echo "✅ Keys generated:"
echo "   Private:     $PRIVATE_KEY (mode 600)"
echo "   Public:      $PUBLIC_KEY"
echo "   Fingerprint: sha256:${FINGERPRINT_HASH}"
echo ""
echo "⚠️  SECURITY: Private key must NEVER leave this machine."
echo "   Transfer only the PUBLIC key to the federation registry."
echo ""
echo "Next step: Run agent-onboard.py to register this agent."
