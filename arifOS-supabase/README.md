# arifOS Supabase Deployment Package

**Version:** 1.0.0
**Date:** 2026-04-17
**Author:** A-FORGE Agent (arifOS constitutional runtime)
**Sovereign:** Muhammad Arif bin Fazil

---

## What's in This Package

```
arifOS-supabase/
├── supabase/
│   └── migrations/
│       └── 20260417000000_initial_arifosmcp_schema.sql   ← Run once
├── clients/
│   ├── supabase_client.py    ← Python client for Prefect Horizon
│   └── supabase_client.ts    ← TypeScript client for A-FORGE Node.js
├── docs/
│   ├── DEPLOYMENT.md         ← Step-by-step deployment guide
│   ├── SCHEMA_REFERENCE.md   ← Table schema documentation
│   └── RLS_GUIDE.md          ← Future: Row Level Security design
├── README.md                 ← This file
└── CHECKLIST.md              ← Pre-deployment verification
```

---

## Deployment Summary

| Step | Action | Duration |
|------|--------|----------|
| 1 | F13 HOLD — Account ownership decision | Human decides |
| 2 | Create Supabase project in Singapore | 5 min |
| 3 | Install Supabase CLI, init, link | 10 min |
| 4 | Run migration (dry-run first) | 5 min |
| 5 | Verify 9 tables created | 2 min |
| 6 | Wire env vars into Horizon panels | 5 min |
| 7 | Install `pip install supabase` on Horizon | 2 min |
| 8 | Replace first JSON state read with Supabase call | 15 min |
| 9 | Test — confirm data persists across redeploy | 10 min |
| **Total** | | **~55 min** |

---

## Schema Tables (9 total)

| Table | Purpose | Replaces |
|-------|---------|----------|
| `arifosmcp_vault_seals` | VAULT999 immutable ledger | `/root/.agent-workbench/vault999.jsonl` |
| `arifosmcp_sessions` | Agent session lifecycle | `/root/WELL/state.json` |
| `arifosmcp_tool_calls` | Per-tool audit log | In-memory / tmp |
| `arifosmcp_canon_records` | ARCHIVIST ADR ledger | None |
| `arifosmcp_approval_tickets` | 888_HOLD queue | `/root/.arifos/tickets.jsonl` |
| `arifosmcp_floor_rules` | F1–F13 thresholds | In-memory |
| `arifosmcp_agent_telemetry` | MerkleV3 source rows | None |
| `arifosmcp_daily_roots` | MerkleV3 daily anchors | None |
| `arifosmcp_transactions` | WEALTH transaction ledger | None |
| `arifosmcp_portfolio_snapshots` | WEALTH portfolio snapshots | None |

---

## Environment Variables

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_jwt>
```

**Where to put them:**
- Prefect Horizon → AFWELL env var panel
- Prefect Horizon → WEALTH env var panel
- A-FORGE VPS → `~/.bashrc` or systemd service environment

**NEVER put `SUPABASE_SERVICE_ROLE_KEY` in:**
- Logs
- Commit messages
- Public repos
- Frontend code

---

## Migration Commands

```bash
# Navigate to project
cd /root/arifOS-supabase

# Login to Supabase CLI
supabase login

# Link to project (get project-ref from Dashboard → Settings → General)
supabase link --project-ref <YOUR_PROJECT_REF>

# Dry run (validate without applying)
supabase db push --dry-run

# Apply migration
supabase db push

# Verify tables
supabase db diff --dry-run  # should show no drift
```

---

## Key Design Decisions

1. **Append-only enforcement** — `enforce_vault_seal_immutability()` trigger blocks UPDATE/DELETE on `arifosmcp_vault_seals`. Immutability is NOT automatic in Postgres; the trigger enforces it.

2. **MerkleV3 compatible** — `record_id`, `prev_hash` columns present for chain verification. `MerkleV3Service` can still operate against Supabase Postgres.

3. **JSONB preserved** — Full `VaultSealRecord` and `ApprovalTicket` stored as `data JSONB` alongside flat columns. Enables complete record reconstruction without joins.

4. **No RLS in v1** — Row Level Security deferred until tables are stable and data is flowing. Premature RLS creates invisible failures.

5. **No Edge Functions in v1** — Python/FastMCP is the execution plane. Edge Functions (Deno/TypeScript) are sidecars, not center-stage.

---

## Client Libraries

**Python** (`clients/supabase_client.py`):
```bash
pip install supabase  # v2
```

**TypeScript** (`clients/supabase_client.ts`):
```bash
npm install @supabase/supabase-js
```

---

## Verification After Deployment

```bash
# 1. Check migration status
supabase db push --dry-run
# Expected: No pending migrations

# 2. Verify tables exist
psql "postgresql://<user>:<pass>@<host>:5432/postgres" -c "\dt arifosmcp_*"

# 3. Test Python client
python3 -c "
from supabase import create_client
import os
sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
print(sb.table('arifosmcp_sessions').select('count').execute())
"
```

---

## What NOT To Do

- ❌ Run raw `psql` DDL directly — creates schema drift, bypasses migration ledger
- ❌ `CREATE TABLE` from Python runtime — structure lives in migrations only
- ❌ Implement RLS before tables are stable
- ❌ Deploy Edge Functions before database layer is proven
- ❌ Put `service_role` key in any log or commit
- ❌ Replace Horizon/Python runtime with Supabase Edge Functions

---

## F13 Ownership Decision Required

> **Who owns the Supabase project — personal account or `arifos` org?**

This determines:
- Who controls database credentials
- Who gets billed
- Who has sovereign access
- What `SUPABASE_URL` looks like

This is not a technical question. It is a sovereignty question.
**You hold final veto, Arif.**

---

**DITEMPA BUKAN DIBERI — 999 SEAL ALIVE**

```
Epoch: 2026-04-17T18:00+08
Verdict: SUPABASE_SCHEMA_FORGED_AND_SEALED
QDF: 888_HOLD_ACCOUNT_OWNERSHIP
```