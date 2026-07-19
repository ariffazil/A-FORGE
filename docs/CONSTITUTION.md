# A-FORGE Constitution

> **Ratified:** 2026-06-05 by arifOS F13 SOVEREIGN
> **Status:** BINDING — governs all execution paths in this repository

---

## I. Identity

A-FORGE is the **governed execution shell** of the arifOS federation.

It is not a constitutional authority. It does not judge. It does not seal. It does not veto.

It receives approved plans. It gates them. It executes them. It logs everything.

```
arifOS = constitutional kernel (can it be done?)
AAA    = control plane       (what should be done?)
A-FORGE = execution shell    (do it, safely, with evidence)
```

---

## II. Prime Directive

**A-FORGE must never execute a plan that has not received JUDGE_SEAL_AUTHORIZATION from arifOS.**

This is not a guideline. This is not "best effort." This is the lock. The forge stays cold until the verdict arrives.

---

## III. The Forge Gate (4-Layer Execution Pipeline)

Every execution path in A-FORGE passes through four gates, in order:

| Layer | Name | Role |
|-------|------|------|
| 1 | **F1 AMANAH Gate** | Catastrophic action detection — blocks `rm -rf /`, `DROP TABLE`, `dd if=/dev/zero`, etc. |
| 2 | **ModelCapabilityGate** | Fast spine-check — reads `model_governance_card` from arifOS registry before allowing any tool access |
| 3 | **Governance Bridge** | Full floor evaluation — F3 Witness, F6 Empathy, F9 Anti-Hantu, F11 Coherence |
| 4 | **ApprovalBoundary** | Irreversibility gate — if `ackIrreversible: true` required but missing → 888_HOLD escalation |

**Reordering any layer voids the constitutional guarantee.**

---

## IV. Boundary Contract

### A-FORGE MAY:

- Route intents to arifOS, GEOX, WEALTH, WELL MCP servers
- Execute builds, deployments, and approved plans
- Run advisory checks (non-binding)
- Handle orchestration, retries, and escalation
- Log all actions to observability pipeline
- Manage agent sessions, memory, and tool selection

### A-FORGE MUST NOT:

- Issue SEAL, SABAR, or VOID verdicts (→ arifOS)
- Perform geoscience computation — Vsh, PHIE, Sw, etc. (→ GEOX)
- Run economic evaluation logic — NPV, IRR, EMV (→ WEALTH)
- Self-authorize any irreversible action
- Import NumPy, Pandas, SciPy, lasio, or welly
- Modify constitutional floors (F1–F13)

---

## V. Sovereign Override

F13 SOVEREIGN (Muhammad Arif bin Fazil) holds absolute veto over all execution paths.

An explicit sovereign directive overrides any gate. But no agent may fabricate or infer sovereign intent — only a direct, verifiable instruction from Arif constitutes override.

---

## VI. Observability

Every execution produces:
1. **Tool call receipt** → Supabase `arifosmcp_tool_calls`
2. **Federation telemetry** → Prometheus + Grafana
3. **Escalation record** → VAULT999 (if 888_HOLD triggered)
4. **Session trace** → Langfuse

No execution path is silent. No 888_HOLD is invisible.

---

## VII. License

AGPL-3.0. See [LICENSE](LICENSE).

The governed execution runtime is free software. The constitutional authority (arifOS) remains the sole arbiter of its lawful use.

---

**DITEMPA BUKAN DIBERI — Forged, Not Given.**
