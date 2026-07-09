# FEDERATION EXECUTION BOARD — 2026-07-09

## Verdict

Security comes first. Do not spend operator time on broad cleanup until BS-4 is closed enough that identity, caller attribution, and origin checks are real again.

## Auto-Do Now

1. Run Wave 1 housekeeping in dry-run mode:
   `python3 /root/A-FORGE/scripts/federation_housekeeping.py /root/A-FORGE/forge_work/2026-07-09/FEDERATION-HOUSEKEEPING-MANIFEST.json`
2. Commit dirty trees per organ without mixing security fixes and housekeeping in the same commit.
3. Review and prune superseded stashes in repos where the sweep already marks them stale.
4. Keep all deeper deletes behind explicit manifests, not ad hoc shell removal.

## Secure Next

1. Close BS-4 chain in this order:
   `P0-2 arifOS Ed25519` -> `P0-4 A-FORGE caller identity` -> `P0-8 WEALTH origin allowlist` -> `P0-5 actor_verified`
2. Fix WELL identity bug and stale biometric state as a separate lane.
3. Hold GEOX production promotion until the 3 HIGH red-team findings are closed or bounded.

## 888 Hold

1. Constitutional floor changes: `S1`
2. Draft canon and GENESIS seals: `S2`, `S3`, `S4`, `S5`, `S9`
3. Runtime topology decisions: `S6`, `S7`, `S8`, `S10`
4. Roadmap unfreeze and major feature revival: `S11`, `S12`, `S13`, `S14`, `S15`
5. Final security posture choice on WEALTH rebinding: `S16`

## Notes

- The housekeeping manifest is intentionally narrow. It covers reversible root and A-FORGE clutter only.
- The 272-file cold-store purge should be Wave 2, after dry-run review and after the current unrelated worktree changes are either committed or isolated.
