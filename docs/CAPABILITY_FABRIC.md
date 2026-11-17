# ZPEX-ZEN Capability Fabric (A-FORGE detail)
> **Moved verbatim from README.md** during the AGENTIC-README-DOCTRINE v1 restructure
> (2026-10-16). Source archive: `docs/archive/README-2026-10-16-pre-doctrine.md`.

A-FORGE participates in the federation's capability fabric under one law: **CAPABILITY ≠ AUTHORITY**. Knowing a tool exists never implies permission to use it.

The fabric extends four existing registries — it does not fork a fifth (F13 doctrine, 2026-09-17):

| Registry | Location | Carries |
|---|---|---|
| **Kernel capability index** | `arifOS/core/capability_index` | `action_class`, `effective_class`, `authority_ceiling`, `risk_tier` per capability |
| **A-FORGE affordances** | `a_think/affordances.yaml` | `capability_surface`, `kernel_verb`, `risk_label` (R1–R5) per tool |
| **AAA agent-card registry** | AAA | identity, interfaces, authority per warga agent |
| **Live-verified matrix** | capability-fabric observation (2026-09-12) | 118/118 tools live-witnessed, reconciliation state *(dated measurement — the live count is `tools_listed` on `:7072/health`)* |

A-FORGE's fabric sensors keep declared and live capability in agreement:

- `forge_registry_status` — callable / blocked / degraded / drift per tool (the live truth)
- `forge_fingerprint_check` — duplicate and schema-drift detection
- `forge_surface_audit` + `forge_surface_guard` — registry vs. affordances phantom/missing/drift detection

The one open fabric build item is kernel-side: `resolve_capabilities(task_id, agent_id, role, domains)` → eager/deferred/hidden capability sets. A-FORGE will consume it; it will not define it.

> Historical note: the "118/118 tools live-witnessed" figure is a dated 2026-09-12
> capability-fabric observation, not a standing score. Reconciliation is continuous.
