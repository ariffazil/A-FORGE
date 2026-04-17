# VAULT999 Architecture — arifOS v2.0

## MANDATE FOR ALL AGENTS

This directory is the design and archival home of VAULT999. The **Live Source of Truth** is governed by the following dual-stack:

### 1. The Ledger (Historical Integrity)
*   **Storage:** Supabase Postgres table `arifosmcp_vault_seals`
*   **Purpose:** Immutable records of all tool calls, verdicts, and seals
*   **Access:** Via Supabase REST API or `PostgresVaultClient` in A-FORGE

### 2. Semantic Memory (Contextual Intelligence)
*   **Storage:** Supabase tables `arifosmcp_memory_contract` + `arifosmcp_memory_records` + `arifosmcp_memory_embeddings` (pgvector 0.8.0)
*   **Purpose:** Long-term memory with vector embeddings for semantic retrieval
*   **Access:** Via `MemoryContract` class in A-FORGE or Supabase REST API

### 3. Connection Strings (.env)

```
SUPABASE_URL=https://utbmmjmbolmuahwixjqc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_jwt>
```

### 4. Philosophical Anchors (The Maruah Invariant)

*   **Sovereign vs. Convenience:** AF-FORGE is NOT a convenience product. It is a sovereign governed stack.
*   **Command over Automation:** A-FORGE operates **under command**, never just "for" the user in a black box.
*   **Physics over Narrative:** Decisions must be grounded in the F2 Truth Band and F7 Humility.

## Supabase Schema (Live — as of 2026-04-17)

| Table | Purpose |
|---|---|
| `arifosmcp_vault_seals` | Immutable vault ledger (SEAL/HOLD/VOID records) |
| `arifosmcp_memory_contract` | 5-tier governed memory (ephemeral→sacred) |
| `arifosmcp_memory_records` | Full memory with vector embeddings |
| `arifosmcp_memory_audit_log` | Append-only memory audit trail |
| `arifosmcp_sessions` | Agent session lifecycle |
| `arifosmcp_tool_calls` | Per-tool governance audit log |
| `arifosmcp_approval_tickets` | 888_HOLD queue |
| `arifosmcp_floor_rules` | F1–F13 constitutional thresholds |
| `arifosmcp_agent_telemetry` | Agent telemetry metrics |
| `arifosmcp_daily_roots` | Daily Merkle anchors |
| `arifosmcp_transactions` | WEALTH transaction ledger |
| `arifosmcp_portfolio_snapshots` | WEALTH portfolio snapshots |
| `arifosmcp_memory_policy` | Memory governance policy rules |
| `arifosmcp_memory_revocations` | Memory revocation records |
| `arifosmcp_memory_write_queue` | Embedding retry queue |
| `arifosmcp_memory_review_queue` | F13 governance-type memory review |

**pgvector 0.8.0 confirmed** — `arifosmcp_memory_records.embedding` column supports semantic search.

## PROHIBITED ACTIONS

*   **DO NOT** write new memories to local `.jsonl` files as primary store — Supabase is primary
*   **DO NOT** modify the Merkle chain logic without a 888_JUDGE SEAL
*   **DO NOT** revert `MemoryContract` to legacy stub implementations
*   **DO NOT** expose `SUPABASE_SERVICE_ROLE_KEY` in logs or commits

DITEMPA BUKAN DIBERI — 999 SEAL ALIVE
