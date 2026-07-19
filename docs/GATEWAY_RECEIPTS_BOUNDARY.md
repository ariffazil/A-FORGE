# 🔗 GATEWAY_RECEIPTS vs VAULT999 CHAIN — Boundary

> **SOT:** 2026-07-19 · **Source:** F-004 R4 resolution

## Two Surfaces

| Surface | File | Records | Schema |
|---------|------|---------|--------|
| **Gateway receipts** | `/root/A-FORGE/data/gateway_receipts.jsonl` | 609 | API call receipts (receipt_id, tool, query, error, request_id) |
| **Shell ledger** | `/root/A-FORGE/data/vault999_chain.jsonl` | 28 | Shell execution records (seq, tool, args, judge_decision, exit_code) |
| **Canonical vault** | `/root/arifOS/VAULT999/outcomes.jsonl` | 28,171 | All epoch records, mixed format |

## Boundary Rule

- **gateway_receipts.jsonl**: Tracks EVERY MCP tool call through the A-FORGE gateway — success, error, HOLD. High volume, API-level.
- **vault999_chain.jsonl**: Tracks only `forge_shell` executions that pass through the ArifJudge → ArifSeal pipeline. Constitutional-level.
- **outcomes.jsonl**: Master append-only ledger. All sealed events from all epochs.

**These are SEPARATE surfaces with different purposes.** Gateway receipts are telemetry. Shell ledger is constitutional audit. They should NOT be merged.

## Verdict

**R4: CLOSED.** Gateway receipts and vault chain are confirmed separate surfaces. No merge needed. Documentation complete.

**DITEMPA BUKAN DIBERI.**
