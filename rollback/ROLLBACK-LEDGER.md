# FED config rollback ledger — 2026-10-31

**Rule:** one snapshot per immutable window. A backup must name the state it holds,
not just the day. Conflating two windows into one file is a rollback hazard.

| sha (16) | file | state it holds | rollback scope |
|---|---|---|---|
| `8e6a6e47` | `litellm-config.yaml.bak-mimo-team-20261031` | BEFORE all of today's windows (MiMo personal seat still tp-, PAYG rung still present, hermes-default + agi-333 still present) | revert ALL of 2026-10-31 |
| `af6bb760` | — not snapshotted — | after rpm/tpm guard on 4 MiMo aliases | **unrecoverable as a file**; reconstruct from receipt Addendum 2 |
| `97a8f34f` | — not snapshotted — | after rung-4 repair (mimo pro @ team seat + min_tokens removal) and after alias deletion (`af6bb760`+alias window) | **unrecoverable as a file**; reconstruct from Addenda 3+4 |
| `8da13347` | `rollback/fed-config-20261031T075849Z-8da13347.yaml` (this dir) | after apex-888 / forge-judge head repair — **current** | revert Addendum 5 only |

Honest status: intermediate states were not snapshotted during their windows. That is a
process defect, not a documentation one. From this point: snapshot on window OPEN, before
the first write, and never reuse a backup across windows.
