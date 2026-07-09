# Ghost Task Lineage Lock — 2026-07-09

**Problem:** Seals #9902, #84, #85 (and class) entered history without session/context umbilical — entropy in the log.

**Fix (live on aaa-a2a):**
1. `session_id` mandatory on all task/message create paths; `session-unknown` rejected.
2. Tasks store `session_id` + `metadata.lineage=bound`.
3. `contextLineage` refuses null session; session cannot drift on same contextId.
4. VAULT `writeSeal` throws if no session/context.
5. seal_chain **INV-4** holds SEAL without lineage.
6. Registry: `AAA/a2a-server/agent-state/wire_state_lineage.json`
7. `llms.txt` documents the road map for agents.

**Probe:**
- no session → 400 Ghost Task blocked
- session-unknown → 400
- real session → 200 with session_id echo
- INV-4 no session → HOLD; with lineage → SEAL

Historical ghosts remain in the chain (append-only). New ghosts have no entry path.
