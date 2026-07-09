# Drift Closure — TREE777 Rename Scar

> **Status:** FORMALIZED  
> **Sovereign signal:** "yes" to topology + drift closure path  
> **Scar ID:** SCAR-2026-07-08-TREE777  
> **Drift source:** `carry_forward.json` `identity_drift: DRIFT`

---

## Decision

Do **not** complete AAA TREE777 v2 Phase 2 rename. The Phase 1 state is accepted as the canonical naming surface.

Rationale:
- The partial rename is a real architectural scar, but completing it now risks cascading topology changes across AAA, A2A agent cards, and organ client wiring.
- The drift flag can be satisfied by making the scar explicit and binding.
- The 2026-06-15 personal-voice scar is unrelated and remains untouched.

## Enforced rule

From `SCAR_CAPSULE_v1.0`:

> The TREE777 Phase 1 rename is hereby accepted as permanent. No future session may re-attempt Phase 2 completion without a sovereign ratified migration plan, a full rollback window, and a green chain verify. All agents must treat the current AAA topology as the canonical naming surface.

## Evidence

- Scar appended to `/root/.local/share/arifos/vault999/capsules/SCAR_CAPSULE.v1.0.capsule.yaml`
- YAML validated by Python yaml.safe_load
- Seal schema upgraded to include `trigger_reason` and `violated_floors[]` on the same closure action

## Next safe action

Identity drift is now addressed by explicit scar jurisdiction. Before any irreversible action, agents must consult `SCAR_CAPSULE` and acknowledge SCAR-2026-07-08-TREE777.
