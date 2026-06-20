# RELEASE NOTES - A-FORGE v2026.05.22-pre

> **Pre-release date:** 2026-05-22  
> **Evidence date:** 2026-05-21  
> **Status:** PRE-RELEASE / PR REVIEW  
> **Authority:** arifOS policy gates, Arif final judgment

## Purpose

This pre-release lowers repo entropy and makes A-FORGE readable as the governed execution runtime for humans, AI agents, and institutional reviewers.

## Changed

- README rewritten as the human/agent front door.
- Historical entropy-reduction notes moved from README to `docs/archive/ENTROPY_REDUCTION_2026-05-20.md`.
- Shared federation layout contract repaired and normalized in `docs/AGENT_LAYOUT_CONTRACT.md`.
- Pre-push repo guard hardened against sibling-repo artifacts:
  - root `server.py`
  - `geox/`, `GEOX/`, `geox_*.py`
  - GEOX-style Docker/compose variants
  - LAS/DLIS field data
  - generated report CSVs
- Repo hygiene audit ledger added at `docs/REPO_HYGIENE_AUDIT_2026-05-21.md`.

## Verification

```txt
git diff --check: PASS
npm run build: PASS
npm test: PASS (7/7)
```

## Boundary

A-FORGE owns governed execution. It does not own constitutional law, UI cockpit, geoscience interpretation, or capital modeling.

## Release Note

This is a pre-release branch, not a direct push to `main`.

Ditempa Bukan Diberi.
