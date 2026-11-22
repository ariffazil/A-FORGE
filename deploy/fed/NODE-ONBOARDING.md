# Node Onboarding & Repair — FED attribution flow

**Scope:** kvm8 (primary), kvm4 (standby front door), kvm2 (edge consumer), future nodes.
**Rule:** one writer per node; no service restart without an explicit deploy gate.

---

## 0. Current topology (OBS 2026-11-22)

```
kvm8  af-forge 100.64.0.2     HAProxy :4000 → litellm-federation docker :4013
                              callback /root/.local/share/arifos/fed_attribution_callback.py
                              ledger   /root/.local/share/arifos/token_bank.db

kvm4  srv1946043 100.64.0.5   docker litellm :4000 (direct)
                              config   /docker/litellm/config.yaml
                              callback /root/A-FORGE/scripts/data/fed_attribution_callback.py (older, 15 KB)
                              ledger   /root/A-FORGE/scripts/data/token_bank.db  ← 0 bytes, no table

kvm2  azwaos / flow-edge      fed-tunnel.service: 127.0.0.1:4000 → kvm4 litellm
                              arifosmcp.service + fed-router.service :7074
```

## 1. kvm4 repair (highest-value stabilization)

Observed defect: `token_bank.db` is 0 bytes with no `token_bank_spend` table, so
the spend callback has nowhere to INSERT. Requests still return 200; rows are lost.

Order of operations (each step reversible, each step gated):

1. **Back up** the current callback + config:
   `cp /root/A-FORGE/scripts/data/fed_attribution_callback.py{,.bak-$(date -u +%Y%m%dT%H%M%SZ)}`
   `cp /docker/litellm/config.yaml{,.bak-$(date -u +%Y%m%dT%H%M%SZ)}`
2. **Initialize the ledger** (additive, idempotent):
   `python3 scripts/init_fed_ledger.py --db /root/A-FORGE/scripts/data/token_bank.db`
3. **Deploy the same callback version as kvm8** (PR-FED-1 artifact) into
   `/root/A-FORGE/scripts/data/fed_attribution_callback.py`.
4. **Set the node identity** on the receiving gateway:
   `FED_ENTRY_GATEWAY=litellm_kvm4_4000` in the container environment.
5. **Restart only litellm** (deploy gate) and watch:
   `docker logs --since 5m litellm | grep -iE "attribution|traceback|error"`
6. **Canary:** `python3 scripts/fed_flow_probe.py --live --base-url http://100.64.0.5:4000/v1 --node kvm4`
7. **Receipt:** append before/after row counts + canary verdict.

## 2. kvm2 (edge consumer)

No local litellm. Its agents reach FED through `fed-tunnel.service` → kvm4.

Required on kvm2 only:

- `ARIFOS_NODE_ID=kvm2` exported in the agent environment (or per-request metadata).
- No local ledger. Rows land in kvm4's ledger; see §3 for reconciliation.

When kvm2 later hosts its own front door, add a `kvm2` inference block to
`deploy/fed/nodes.json` and set `FED_ENTRY_GATEWAY=litellm_kvm2_<port>`.

## 3. Ledger reconciliation (when >1 node writes)

Canonical ledger = kvm8 `/root/.local/share/arifos/token_bank.db`.
Standby nodes buffer locally, then reconcile by `trace_id` (idempotent upsert).

Minimum contract:

- `trace_id` is unique per logical request.
- rows carry `origin_node` + `entry_gateway`.
- reconciliation inserts only unseen `trace_id`s; never rewrites history.
- a node that cannot reconcile keeps local rows and reports `PENDING_SYNC`, never deletes.

Do not run SQLite over a network filesystem. Ship rows, not the file.

## 4. Future node checklist

- [ ] row in `deploy/fed/nodes.json` (hostnames, role, loopback_gateway, listen, ledger)
- [ ] `FED_ENTRY_GATEWAY=litellm_<node>_<port>` on the receiving gateway
- [ ] ledger schema initialized before traffic (`init_fed_ledger.py`)
- [ ] same callback version mounted
- [ ] `fed_flow_probe.py` offline PASS (reachability) then live PASS (ledger row)
- [ ] `ARIFOS_NODE_ID` set for every agent process
- [ ] receipt with before/after unknown-actor share

## 5. Rollback

| Change | Rollback |
|---|---|
| callback file | restore `.bak-*`, restart litellm |
| ledger init | additive only — no rollback needed; delete file only if it was empty |
| env `FED_ENTRY_GATEWAY` | unset, restart |
| `nodes.json` row | revert commit |

## 6. Stop conditions

Stop and report if: another writer is active on the node; config backup fails;
canary returns PASS without a ledger row; ledger has a non-empty schema that
differs from the expected columns; or a restart is required without an explicit
deploy gate.
