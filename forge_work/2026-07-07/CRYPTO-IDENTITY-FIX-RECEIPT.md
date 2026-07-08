# Cryptographic Identity Fix — Item 1

**Date:** 2026-07-07
**Files changed:** 2

## Changes

### 1. A-FORGE src/interfaces/mcp/client.ts — injectSovereignSignature()

| Before | After |
|--------|-------|
| Signed dummy "auto-seal" payload | Signs real constitution_hash |
| Hex with "ed25519:" prefix | Raw base64 (matching verifier) |
| Silent fail on missing key | Throws error (fail-closed) |
| Silent catch on sign error | Throws error (fail-closed) |
| String key to crypto.sign | crypto.createPrivateKey() |

New `computeConstitutionHash()` function matches sovereign_signer.py exactly (KERNEL_CANON file or FLOOR_SPEC hash).

### 2. arifOS session_auth.py — Protected ID gate

New step 4: if session claims protected sovereign ID but signature_verified=false -> reject.

## Fail-Closed Matrix

| Scenario | Before | After |
|----------|--------|-------|
| Key file missing | Silent pass | THROW |
| Key file corrupt | Silent pass | THROW |
| Signature fails | Dummy payload passes nothing | Real payload, verifier catches |
| Protected ID without sig | Session created | Session rejected |

## Verification path

client.ts signs `actor_id:constitution_hash:nonce` -> arifOS tools.py verifies ed25519 -> session_auth.py gates on signature_verified

**DITEMPA BUKAN DIBERI — The signature is forged, not given.**
