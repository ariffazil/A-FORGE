# Contributing to A-FORGE

> **SOT:** 2026-07-25 | **DITEMPA BUKAN DIBERI**

A-FORGE is the governed execution shell of the arifOS Federation. It builds, deploys, and mutates — but only after arifOS SEAL and F13 approval.

## Before You Start

1. Read the [README](README.md) — understand the 4-layer forge gate
2. Read [AGENTS.md](AGENTS.md) — execution boundary
3. Run `curl :7071/health` — ensure the forge is running

## Setup

```bash
git clone git@github.com:ariffazil/A-FORGE.git && cd A-FORGE
npm ci && npm run build
npm start                    # starts on :7071
curl http://localhost:7071/health
```

## Making Changes

1. **Fork → Branch → Edit → Test → PR**
2. Run `make test` before pushing (security-audit + build + all suites)
3. NodeNext ESM: intra-repo imports require explicit `.js` extensions
4. Tests run from `dist/test/` — rebuild before testing

## Boundaries

- A-FORGE executes — never adjudicates (arifOS does that)
- A-FORGE mutates — never self-authorizes
- Every execution passes the 4-layer forge gate: F1 → Model → Governance → Irreversibility
- No `rm -rf` of unknown directories without F13 approval

## Federation

A-FORGE is one of 7 organs. See [ariffazil/ariffazil](https://github.com/ariffazil/ariffazil) for the federation map.

---

*Maintained under F13 SOVEREIGN by Muhammad Arif bin Fazil.*
