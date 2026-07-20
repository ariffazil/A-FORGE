---
type: System
title: arifOS Constitutional Kernel
description: Constitutional AI governance kernel — F1-F13 floors enforcement, session management, identity, judge (arif_judge), seal (arif_seal), VAULT999 immutable ledger
resource: http://localhost:8088/health
tags: [federation, kernel, governance, constitution, vault]
timestamp: 2026-07-20T08:00:00Z
links:
  - ../atlas333.md
  - ../skills/index.md
---
# arifOS (Constitutional Kernel)

Sovereign: Muhammad Arif bin Fazil (F13, 888)
Doctrine: DITEMPA BUKAN DIBERI — Forged, Not Given

## What it does

arifOS is the **MIND** of the federation. It:

- **Governs** — Enforces F1-F13 constitutional floors on every action
- **Judges** — Issues SEAL / HOLD / SABAR / VOID verdicts via `arif_judge`
- **Seals** — Appends to VAULT999 immutable hash chain via `arif_seal`
- **Remembers** — Manages memory across 6 tiers (KSR → Ledger → Vault)
- **Routes** — Directs intent to correct domain organ via `arif_route`
- **Observes** — Gathers evidence from reality via `arif_observe`
- **Reasons** — Structured thinking under F2/F7 via `arif_think`

## VAULT999

The immutable append-only ledger. Every SEAL verdict is recorded as a JSONL entry with:

- `seq` — Monotonic sequence
- `verdict` — SEAL/HOLD/SABAR/VOID
- `actor` — Who acted
- `this_hash` — SHA-256 of this entry
- `prev_hash` — SHA-256 of previous entry (hash chain)

## Port

`:8088` — FastMCP + FastAPI server

## Key Paths

- `/root/arifOS/` — Source
- `/root/arifOS/docs/` — Documentation (79 active docs, indexed)
- `/root/arifOS/GENESIS/` — Constitutional canon (51 docs, indexed)
- `/root/.local/share/arifos/vault999/` — VAULT999 seal chain
