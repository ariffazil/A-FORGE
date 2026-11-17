# MCP Adversarial Audit — Root-Cause Reduction & Repair Set (Addendum)
Date: 2026-10-22  Author: Claude (auditor→reducer)  Base: MCP-ADVERSARIAL-AUDIT-2026-10-22.md

## 0. Falsification of RC-3+RC-4 merge (Arif's question)
Claim: "RC-3 (manifest-authored metadata) and RC-4 (authority declared but unenforced)
are one meta-cause: contracts exist as documentation, not executable constraints."

RESULT: PARTIALLY FALSIFIED — keep separate.
- Counter-example: WELL envelope missing `resultType` (RC-3/observability) is a SCHEMA-shape
  failure produced by an authoring tool. It does not touch authority. Fixing the schema
  author does NOT gate a single mutation.
- Counter-example: CHRON ungated write (RC-1/authority) is an ENFORCEMENT failure. Its
  metadata (declared HUMAN_WITNESS) is correct; enforcement is absent. Fixing the schema
  author does NOT stop the write.
- Shared ancestor exists ("documentation != enforcement") but the repair SURFACE differs:
  RC-3 fixed at author/reader; RC-4 fixed at chokepoint. Merging them would produce a repair
  that passes validation while a real authority bypass stays open. KEEP SEPARATE.

## 1. Heartbeat contradiction (found post-report)
DECLARED  : shadow.chain_heartbeat_gap = "147.6h; head seq 72 @ 2026-10-15T09:48:35Z";
            hours_since_last_seal = 189.2h
OBSERVED  : SEALED_EVENTS.jsonl head recorded_at = 2026-10-18T09:01:04Z → 94.8h; 1357 rows;
            0 rows carry a 'seq' field → "seq 72" is phantom
SOURCE    : canonical chain file (authoritative); shadow block (declared)
WRONG SIDE: declaration
ROOT CAUSE: heartbeat computer keys on a 'seq' field the canonical writer never emits
BLAST     : metabolism already HOLD/held on 2026-10-22T07:01:24Z — every ">72h" gate
PRIORITY  : P1 (governance/observability); belongs to RC-5 family, not a new RC

## 2. Repair set (smallest changes, ranked)
R1 Bring sibling ledgers under the fence (gate + binding + inverse)   → CON-01,02,03   [2×P0,1×P1]
R5 One canonical kernel state/verdict computer                        → CON-12,14,15,17  (+heartbeat)
R2 Bind every health/security claim to an executed path               → CON-04,07,08,09,11,20,23,24
R4 Enforce declared authority contracts at the chokepoint             → CON-10,13,16
R3 Compute registry/identity metadata from live state at read time    → CON-05,06,18,19,22
R6 Separate test store from production memory                          → CON-21

80% coverage = R1 + R5 + R2 + R4 = 19/24 = 79.2% (≈80%, and 100% of P0/P1).
Full set = R1..R6 = 24/24 = 100%.

## 3. OO-Harness lens (rohanpaul_ai / Google paper)
Repair set maps onto specialist-harness routing: R1/R4 are authority-chokepoint specialists;
R2 is an execution-binding specialist; R5 is one canonical state class; R3 is a read-time
metadata class; R6 is an environment-boundary class. Base harness = current federation.
Route to a specialist only when a run shows the matching defect class. Unfamiliar surfaces
keep the base harness (no forced specialist).
