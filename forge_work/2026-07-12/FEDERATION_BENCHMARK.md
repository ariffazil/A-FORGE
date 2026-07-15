# Federation Benchmark — One End-to-End Proof

**Date:** 2026-07-12  
**Purpose:** One runnable benchmark of organ existence + boundary contracts + autonomy proof.  
**Not:** AGI claim. Not full ASI state claim.

---

## Checklist

| # | Proof | How | Status |
|---|-------|-----|--------|
| 1 | Organs alive | `health` ports | Script |
| 2 | APEX schema present | `contracts/apex.schema.json` | File |
| 3 | Organ evidence schema present | `contracts/organ_evidence.schema.json` | File |
| 4 | Authority map present | `AAA/docs/REPOSITORY_AUTHORITY_MAP.md` | File |
| 5 | Measurement boundary present | `MEASUREMENT_BOUNDARY_CONTRACT.md` | File |
| 6 | WELL readiness envelope separates H/M | MCP or in-process | Script |
| 7 | WELL registry dual-list empty | well_registry_status | Script |
| 8 | Bounded autonomy proof | WELL loop receipt SEAL mut≤1 | Receipt file |
| 9 | A-FORGE health | :7071 | Script |
| 10 | arifOS health | :8088 | Script (may FAIL — report honestly) |

---

## Run

```bash
python3 /root/A-FORGE/forge_work/2026-07-12/federation_benchmark.py
```

## Autonomy proof (already demonstrated)

Controlled fault on `well-heartbeat.service`:

- detect inactive  
- A_effective service_local  
- max 1 restart  
- verify active  
- receipt under `WELL/loop/receipts/`  

See: `WELL/loop/README.md`

## Independent witness (minimal layer)

| Witness type | Status |
|--------------|--------|
| External instrument (ChatGPT audits) | Used as L4 interpretation |
| Human F13 | Required for RED/C5 |
| Second model adversarial | Not automated yet |
| Physical measurement (GEOX) | Domain-gated |
| seal_chain integrity | Currently DEGRADED — do not claim full GREEN |

**Falsification rule:** Any claim of “federation GREEN” must list which of 1–10 failed.
