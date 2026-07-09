# Seal Chain Integrity Note

> **Discovered during:** TRINITY-33 seal schema upgrade  
> **Status:** Pre-existing anomaly, not caused by schema change  
> **Action:** Do not seal until resolved or formally accepted

---

## Finding

`node /root/AAA/a2a-server/seal_chain.js verify` reports:

```json
{
  "ok": false,
  "broken_at_seq": 84,
  "reason": "this_hash mismatch (payload tampered)",
  "expected": "sha256:9ed946d032ecd05bb5416bacd80dff51dcb21807dffa5e21ca77da0de6477677",
  "actual": "sha256:33dbaf4e98f40243057168c5a9835193109974ff30f5cc2bcea2835b51a83cc2"
}
```

## Context

- The seal chain has known historical gaps (seq 18–60) and anomalous entries (seq 83) already handled by the verifier.
- Seq 84 is the most recent entry, written 2026-07-08T14:07:00Z, labeled `HARDENING_2026-07-08` with `sovereign_ack: true`.
- The entry uses `hash` instead of `this_hash` and `prev_hash` correctly, so the verifier accepts the field alias.
- The hash recomputation does not match, indicating the payload or header fields were modified after sealing, or the entry was written with a different canonicalization.

## Relevance to schema upgrade

The TRINITY-33 schema upgrade (adding `trigger_reason` and `violated_floors[]`) did **not** modify `hashSeal`, `canonicalJson`, or any existing entry. It only affects new entries. The chain break is pre-existing.

## Recommended next actions

1. **HOLD on new SEALs** until chain integrity is restored or the anomaly is formally accepted.
2. **Investigate seq 84 writer** — identify which process wrote it and which canonicalization it used.
3. **Add seq 84 to verifier anomaly list** as a temporary measure only if the sovereign accepts the historical anomaly.
4. **Do not rewrite history** — VAULT999 is append-only.

## Files

- Chain: `/root/.local/share/arifos/vault999/seal_chain.jsonl`
- Head: `/root/.local/share/arifos/vault999/seal_chain_head.json`
- Verifier: `/root/AAA/a2a-server/seal_chain.js`
