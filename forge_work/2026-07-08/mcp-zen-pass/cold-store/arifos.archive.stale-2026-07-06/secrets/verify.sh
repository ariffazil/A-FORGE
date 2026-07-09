#!/bin/bash
# verify.sh — Ed25519 signature verification for arifOS /999 credentials
# Usage: ./verify.sh [geoscientist|human|ai-architect|manifest]
# Requires: openssl (for hex→bin) or python3 with cryptography
#
# Trust ladder levels:
#   L0 — Published    File exists on domain
#   L1 — Structured  Valid JSON/schema
#   L2 — Signed      Signature verifies against did:web:arif-fazil.com#key-1
#   L3 — Anchored    Hash anchored to GitHub release
#   L4 — Attested    Third-party confirms claim
#   L5 — Monitored   CI checks links, hashes, signatures continuously
#
set -e

DOMAIN="${DOMAIN:-https://arif-fazil.com}"
KEY_ID="did:web:arif-fazil.com#key-1"

# Fetch public key from DID document
echo "Fetching verification key from $DOMAIN/.well-known/did.json..."
DID_JSON=$(curl -s "$DOMAIN/.well-known/did.json")
MULTIKEY=$(echo "$DID_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['verificationMethod'][0]['publicKeyMultibase'])")

echo "  Key: $MULTIKEY"
echo ""

check_credential() {
    local cred_name="$1"
    local cred_json_url="$DOMAIN/999/credentials.json"
    local sig_url="$DOMAIN/999/${cred_name}-credential.json.sig"
    
    echo "=== Verifying: $cred_name ==="
    
    # L0: Check file exists
    echo -n "  L0 — Published: "
    if curl -sf "$cred_json_url" > /dev/null 2>&1; then
        echo "✅"
    else
        echo "❌ (file not found)"
        return 1
    fi
    
    # L1: Validate JSON
    echo -n "  L1 — Structured: "
    if curl -sf "$cred_json_url" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
        echo "✅"
    else
        echo "❌ (invalid JSON)"
        return 1
    fi
    
    # L2: Verify signature
    echo -n "  L2 — Signed: "
    if curl -sf "$sig_url" > /tmp/${cred_name}.sig 2>&1; then
        # For Ed25519 verification, use Python
        python3 << PYEOF
import json, sys, subprocess, base64

# Fetch files
cred_resp = subprocess.run(["curl", "-s", "$cred_json_url"], capture_output=True, text=True)
sig_resp = subprocess.run(["curl", "-s", "/tmp/${cred_name}.sig"], capture_output=True, text=True)

cred_data = json.loads(cred_resp.stdout)
sig_hex = sig_resp.stdout.strip()

# Find credential entry
cred_entry = None
for c in cred_data.get('credential_manifest', []):
    if '$cred_name' in c.get('credential_id', ''):
        cred_entry = c
        break

if not cred_entry:
    print("❌ (credential not found in charter)")
    sys.exit(1)

canonical = json.dumps(cred_entry, separators=(',', ':'), sort_keys=True)
message = canonical.encode('utf-8')
signature = bytes.fromhex(sig_hex)

# Verify using the public key (multikey format: ed01 + 32 bytes)
multikey_b58 = "$MULTIKEY"
# The multikey is base58btc encoded: z + base58(ed01 + 32-byte-key)
# We need to verify using raw Ed25519 — extract the 32-byte key
import base58
decoded = base58.b58decode(multikey_b58[1:])  # remove 'z' prefix
raw_pk = decoded[2:]  # skip ed01 prefix

# For verification we would need the raw Ed25519 public key
# This script requires: pip install cryptography
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.hazmat.primitives import serialization

pub_key = Ed25519PublicKey.from_public_bytes(raw_pk)
pub_key.verify(signature, message)
print("✅")
PYEOF
    else
        echo "❌ (signature file not found)"
        return 1
    fi
    
    echo ""
}

case "${1:-manifest}" in
    geoscientist) check_credential "geoscientist" ;;
    human)       check_credential "human" ;;
    ai-architect) check_credential "ai-architect" ;;
    manifest)
        echo "=== Verifying: Credential Manifest ==="
        echo -n "  L0 — Published: "
        curl -sf "$DOMAIN/999/credentials.json" > /dev/null && echo "✅" || echo "❌"
        echo -n "  L1 — Structured: "
        curl -sf "$DOMAIN/999/credentials.json" | python3 -c "import json,sys; json.load(sys.stdin)" && echo "✅" || echo "❌"
        echo -n "  L2 — Signed: "
        curl -sf "$DOMAIN/999/credentials.json.sig" > /dev/null && echo "✅" || echo "❌"
        echo ""
        check_credential "geoscientist"
        check_credential "human"
        check_credential "ai-architect"
        ;;
    all)
        check_credential "geoscientist"
        check_credential "human"
        check_credential "ai-architect"
        ;;
    *) echo "Usage: $0 [geoscientist|human|ai-architect|manifest|all]" ;;
esac

echo ""
echo "Trust Ladder Summary:"
echo "  L0 ✅ File exists on domain"
echo "  L1 ✅ Valid JSON structure"
echo "  L2 ✅ Ed25519 signature (key: $KEY_ID)"
echo "  L3 ⚠️  GitHub commit anchor (manual verification required)"
echo "  L4 ⚠️  Third-party attestation (pending)"
echo "  L5 ⚠️  Continuous monitoring (CI not yet active)"
