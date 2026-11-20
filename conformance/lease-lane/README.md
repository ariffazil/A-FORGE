# Federation Lane Conformance — Lease Lane (lease-lane)

Directive: AUDIT_RECEPTACLE CONSTITUTIONAL_ALIGNMENT (2026-11-05) —
"Penguatkuasaan Runtime Penuh (Live Enforcement) = UNVERIFIED — memerlukan
suite ujian kepatuhan (conformance suite)" untuk membuktikan penolakan
automatik (fail-closed) apabila pajakan tidak sah atau skop diluaskan.

This directory is that suite. Three lanes:

| Lane | File | Target | Proves |
|------|------|--------|--------|
| B (deterministic) | `leaseLaneConformance.test.mjs` | the BUILT module `dist/src/interfaces/mcp/forgeTools.js` (same artifact the live :7072 service runs, build 97b90bc0) | every named lease gate refuses its failure class + 2 controls pass |
| A (live ingress) | `lease_lane_probe.py` | A-FORGE MCP :7072 | session gate + lease gate refuse invalid/expired/out-of-scope/unknown leases on the running surface |
| C (live kernel) | `lease_lane_probe.py` | arifOS :8088 `arif_forge` | execution refuses without a SEAL verdict, and refuses a forged seal id |

## Run

```bash
AF_SESSION_ID=<sess-…> AF_ACT=<act_v1.…> bash conformance/lease-lane/run_all.sh
```

Lane B runs standalone without credentials. Results JSON lands in
`results/lease-lane-conformance-<ts>.json` (credentials redacted to prefix+sha256).

## Baseline result (2026-11-05, HEAD 97b90bc0)

- Lane B: **13/13 PASS**
- Lane A+C: **8/8 PASS**

## Findings carried by the suite (recorded, not hidden)

1. **Revoked/expired local leases fail under `LEASE_KERNEL_UNKNOWN`, not
   `LEASE_REVOKED`/`LEASE_EXPIRED`.** `inspectLeaseViaKernel()` is a measured
   stub returning null (arifOS exposes no lease verbs on the canonical
   surface), so those two named gates are dead code. Fail-closed behavior
   HOLDS — the refusal happens either way — but the label drifts (Lane B B3/B4).
2. **Live scope-gate ordering:** for out-of-scope governed tools, the aThink
   GOVERN guard refuses BEFORE the lease scope gate runs (A5 observes
   `A_THINK_GUARD`). `LEASE_SCOPE_DENIED` itself is proven deterministically
   (Lane B B6). Fail-closed on scope expansion holds on both layers.
3. **arifOS :8088 MCP HTTP requires `Accept: application/json, text/event-stream`**
   — without it the endpoint answers HTTP 406 with an empty body. Any probe
   client must send that header.

## Why this lives in `conformance/` and not `test/`

`test/`, `tests/`, `package.json`, `src/` are `chattr +i` sealed by the deploy
immutability cycle (`scripts/immutability_cycle.sh`). Promotion into `test/`
plus the `package.json` CI list is a follow-up gated on the F13 unlock cycle;
until then this directory is the runnable SOT of the suite.

## Positive-control clause

A conformance suite that only ever refuses is vacuously green. B11 (valid
scoped lease + verdict trace → ok) and B12 (OBSERVE lane needs no lease → ok)
prove the gate still lets legitimate traffic through.
