# arifOS MCP Migration: Universal Naming

**999_SEAL** | Constitution-Safe Interface Migration | 2026-04-11

---

## Executive Summary

Migrating arifOS MCP tool names from dotted notation (`arifos.init`) to universal snake_case (`arifos_init`) for cross-platform compatibility (Kimi, Claude, Cursor, VS Code).

**Key Principle**: Non-breaking migration with Phase A/B/C rollout.

---

## Migration Phases

### Phase A — Alias-Safe Seal (CURRENT)
- ✅ Canonical names are snake_case
- ✅ Old dotted names remain as aliases
- ✅ Public discovery shows only new names
- ✅ Internal logs record alias usage
- 🟡 **Status**: Ready for deployment

### Phase B — Compatibility Observation (30 days)
- Monitor alias traffic frequency
- Track client compatibility
- Measure unexpected tool selection drift
- Collect evidence for hard-cut decision

### Phase C — Hard Cut (Evidence-based)
- Remove dotted aliases only after telemetry shows safety
- Bump registry hash
- Seal migration in vault with rollback path

---

## Tool Consolidation

### Final Public Surface: 10 Tools

| Tool | Stage | Capabilities | Absorbs |
|------|-------|--------------|---------|
| `arifos_init` | 000 | READ, REASON | — |
| `arifos_sense` | 111 | READ, REASON | `fetch` (as mode) |
| `arifos_mind` | 333 | REASON | — |
| `arifos_kernel` | 444 | READ, REASON, GOVERN | `reply`, `route` (as modes) |
| `arifos_heart` | 666 | REASON, GOVERN | — |
| `arifos_ops` | 777 | READ, REASON | `vps_monitor` (as mode) |
| `arifos_judge` | 888 | GOVERN | — |
| `arifos_memory` | 555 | READ | — |
| `arifos_vault` | 999 | READ, GOVERN, WRITE | — |
| `arifos_forge` | 010 | EXECUTE | `git_status`, `git_commit`, `forge_bridge` (as modes) |

### Internal/Folded Tools

| Old Tool | New Home | Migration |
|----------|----------|-----------|
| `arifos_reply` | `arifos_kernel(mode="reply")` | Phase B |
| `arifos_fetch` | `arifos_sense(mode="fetch")` | Phase B |
| `arifos_vps_monitor` | `arifos_ops(mode="monitor")` | Phase B |
| `arifos_git_status` | `arifos_forge(mode="git_status")` | Phase B |
| `arifos_git_commit` | `arifos_forge(mode="git_commit")` | Phase B |

---

## RBAC Capability Axes

| Axis | Action | Public Tools |
|------|--------|--------------|
| **READ** | Observe / inspect / query | init, sense, kernel, ops, memory, vault |
| **REASON** | Analyze / synthesize / plan | init, sense, mind, kernel, heart, ops |
| **GOVERN** | Judge / gate / verdict | heart, judge, vault, forge |
| **WRITE** | Persist / mutate / archive | vault |
| **EXECUTE** | Trigger external side effects | forge |

---

## Invariant Preservation

| Floor | Invariant | Mechanism |
|-------|-----------|-----------|
| **F1** | Reversibility | `LEGACY_ALIAS_MAP` enables instant rollback; `ARIFOS_LEGACY_NAMES_ONLY=1` flag |
| **F2** | Truth | Test suite validates canonical + alias produce identical outputs |
| **F4** | Clarity | 10 public tools vs 16 previous; internal hidden from discovery |
| **F11** | Audit | Vault entries record `canonical_name` + `called_alias` |
| **F13** | Sovereignty | Tool logic unchanged; only surface names migrated |

---

## Legacy Alias Map

```json
{
  "arifos.init": "arifos_init",
  "arifos.sense": "arifos_sense",
  "arifos.mind": "arifos_mind",
  "arifos.kernel": "arifos_kernel",
  "arifos.heart": "arifos_heart",
  "arifos.ops": "arifos_ops",
  "arifos.judge": "arifos_judge",
  "arifos.memory": "arifos_memory",
  "arifos.vault": "arifos_vault",
  "arifos.forge": "arifos_forge",
  "arifos.reply": "arifos_kernel",
  "arifos.vps_monitor": "arifos_ops",
  "arifos.fetch": "arifos_sense",
  "arifos.git_status": "arifos_forge",
  "arifos.git_commit": "arifos_forge"
}
```

---

## Files & Registry

| Path | Purpose |
|------|---------|
| `arifOS/APEX/ASF1/tool_registry.json` | Single source of truth |
| `arifosmcp/runtime/tool_specs.py` | Tool specifications |
| `arifosmcp/runtime/tools.py` | Handler implementations + alias resolver |

---

## Seal Checklist

- [ ] Tool registry hash computed
- [ ] Alias resolver tested
- [ ] Equivalence tests pass (old vs new names)
- [ ] Rollback path verified
- [ ] Vault migration entry created
- [ ] Documentation updated
- [ ] Telemetry logging enabled

---

**DITEMPA BUKAN DIBERI — 999_SEAL_PENDING**
