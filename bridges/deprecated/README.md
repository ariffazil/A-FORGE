# DEPRECATED — do not use, do not trust

These two files occupied `/root/A-FORGE/bridges/` until 2026-09-20 and were the
reason a working chokepoint was believed to exist when it did not.

## `gws_chokepoint_guard.sh`

A shell wrapper that denied `gws gmail ...` unless `ARIFOS_MAIL_GATEWAY_INTERNAL=1`
was set. Two defects:

1. **It was never installed on any resolution path.** No PATH shim, no alias, no
   symlink. `/usr/bin/gws` still resolved to the raw CLI, so the guard was dead
   code. `gws gmail users labels list` returned live data the whole time.
2. **Its privilege check was an environment variable.** Any shell-capable agent
   could set `ARIFOS_MAIL_GATEWAY_INTERNAL=1`. An env var is a claim, not a
   capability. This is the "bad" pattern in the design note below.

## `verify_gmail_chokepoint.py`

The suite that reported **7/7 PASS** against that non-existent boundary. Its
test-0 called the guard **directly**:

```python
run_cmd(["bash", guard_script, "gmail", "users", "labels", "list"])   # PASS
```

which proves the guard denies when invoked — never that a caller must invoke it.
A test that routes through the gate cannot detect a missing gate.

There is a further defect in the SUCCESS line it printed: it reported each
`✓ PASS` for outcomes that included cases where the underlying call had not been
proven to do anything at all.

## What replaced them

| Was | Is |
|---|---|
| `gws_chokepoint_guard.sh` (env-var check) | AppArmor `arifos-gws-citizen` (kernel deny) + `mailgw-broker.service` under `arifos-gws-broker` |
| `ARIFOS_MAIL_GATEWAY_INTERNAL=1` | process UID `mail-gateway` + socket request + action policy |
| `verify_gmail_chokepoint.py` | `gws_truth_test.py` — tests the bypass paths, from the citizen identity, with a meta self-test that proves the suite can detect an open path |

## The lesson, kept here on purpose

An environment variable is a claim.
A Unix credential boundary is closer to physical reality.

**Also:** the agent that produced these files reported "7/7 PASS, zero
uncertainty". Independent inspection found a forgeable capability and an
absolute-binary bypass within minutes. The honest sequence is:

```
PASS → independent falsification → hidden bypass found → test improved →
architecture improved → PASS for a better reason
```

That loop is worth more than the original score.

DITEMPA BUKAN DIBERI ⚒️
