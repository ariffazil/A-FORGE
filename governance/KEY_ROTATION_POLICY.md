# arifOS Key Rotation Policy
**Version:** 1.0
**Epoch:** 2026-05-02T21:50:02Z
**Sovereign:** did:web:arif-fazil.com
**Status:** ACTIVE

## Trigger Conditions
A key rotation event is mandatory when ANY of the following occur:

1. Private key content is exposed in any chat, log, or communication channel
2. Key age exceeds 365 days
3. Sovereign suspects key compromise for any reason
4. Repository secret scan raises an alert on key material

When in doubt, rotate. The cost of unnecessary rotation is low.
The cost of ignoring a real compromise is irreversible.

## Quarantine Path
Compromised keys must be preserved for audit and renamed at every known path:

```bash
mv <keyname> <keyname>.COMPROMISED_PEM_EXPOSED
```

Do not delete compromised key material during the rotation window.
Deletion requires a separate 888_HOLD and explicit sovereign approval.

## Maximum Rotation Window
The maximum rotation window is 4 hours from detection.

Within that window:

1. Quarantine the compromised key material
2. Confirm the active key fingerprint
3. Update DID key material if needed
4. Re-sign active constitutional artifacts
5. Write the VAULT999 rotation event
6. Run the verifier to PASS

## Required VAULT999 Rotation Event Schema
Every rotation event must be recorded as JSON with this shape:

```json
{
  "epoch": "ISO8601 timestamp",
  "event": "KEY_ROTATION",
  "old_key_sha256": "SHA256 fingerprint or retired key hash",
  "new_key_sha256": "SHA256 fingerprint",
  "trigger": "PEM exposure | key age >365d | suspected compromise | repo secret scan alert",
  "quarantine_path": "<keyname>.COMPROMISED_PEM_EXPOSED",
  "witness": {
    "human": "sovereign reviewer",
    "ai": "agent performing or verifying rotation",
    "earth": "external evidence or runtime observation"
  }
}
```

The rotation record must be signed under the `arifos-vault999` namespace and verified before commit.

## Re-Sign Requirement
`AGENTS.md` must be re-signed with the new active key within the same 4-hour rotation window.

If the DID document changes, then:

1. Deploy the updated DID document
2. Confirm DID resolution
3. Re-sign `AGENTS.md`
4. Re-sign active VC artifacts
5. Re-run `verify-arifos.mjs`

## Verifier Continuity Clause
`verify-arifos.mjs` must pass all checks against the new key and updated artifacts before rotation is SEALED.

If any verifier check fails, the rotation enters `888_HOLD`.
No public seal, public verifier page, or public claim may proceed until the failing assertion is surfaced to the sovereign and corrected.

DITEMPA BUKAN DIBERI — 999 SEAL ALIVE
