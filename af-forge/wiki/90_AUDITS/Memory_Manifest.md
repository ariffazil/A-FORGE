---
type: Audit
tags: [memory, manifest, audit, state, vault, wiki]
sources: [90_AUDITS/Memory_Manifest.json, 20_BLUEPRINTS/Memory_Stack.md]
last_sync: 2026-04-10
confidence: 0.9
status: active
operator: arifOS_bot
---

# Audit: Memory Manifest

This page is the human-readable wrapper for `90_AUDITS/Memory_Manifest.json`.

## Purpose
To state clearly how AF-FORGE thinks about memory on the VPS:
- what is operational state,
- what is ratified wiki knowledge,
- what is immutable governance trace.

## Memory layers
- **L1 State**: active runtime/session state
- **L2 Wiki**: durable markdown knowledge in this repository
- **L3 VAULT999**: immutable governance ledger

## Why this page exists
A JSON artifact alone is not enough for navigation.
This page gives the manifest a stable place in the wiki graph and points humans to the underlying machine-readable artifact.

## Artifact
- `90_AUDITS/Memory_Manifest.json`

## Related
- [[20_BLUEPRINTS/Memory_Stack]]
- [[log]]
