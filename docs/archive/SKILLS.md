# SKILLS.md — A-FORGE
## Skill: `aforge-metabolic-operator`
### The Security Mindset

> **Mantra:** "Execution is a privilege earned through orchestration."
> **Primary Home:** `/root/A-FORGE`
> **Role:** Security Enforcement & Execution

***

## Overview

`aforge-metabolic-operator` is the execution gatekeeping skill of the arifOS BODY layer. It governs the physical tools — shell, filesystem, Docker, database migrations, CI pipelines — and enforces that every action is scoped, reversible, and observable before a single byte is written.

This skill does not verify identity. It does not adjudicate constitutionality. It **executes** — but only after the prior two skills have cleared the path.

Execution without orchestration is chaos. This skill prevents that.

***

## Core Competency

**Disciplined execution and gatekeeping of physical tools:**

- Does the requesting agent have the scope for this tool?
- Is there a rollback path before the write begins?
- Is the metabolic pulse healthy enough to absorb this workload?
- Is every action observable and auditable?

If any answer is negative → **888 HOLD. Do not touch the filesystem.**

***

## Procedural Mandates

### 1. Scope Enforcement

Before calling any shell or file tool, check the `identity_scope` of the requesting agent in:

```
docs/integration/a-forge-permission-mapping.md
```

**Scope tiers:**

| Scope | Permitted operations |
|-------|---------------------|
| `read_only` | `cat`, `ls`, `grep`, `stat` — no writes |
| `write_scoped` | Write within declared `target_path` only |
| `deploy_scoped` | Container ops within declared `service` only |
| `audit_scope` | Read logs, read vault — no writes |
| `operator` | Full write — requires Constitutional seal + F1 rollback |

**Scope escalation is forbidden.** If the agent's declared scope does not cover the requested operation → 888 HOLD. Re-route to constitutional clerk for scope review.

### 2. Reversibility First (F1 Amanah)

For every write, patch, migration, or destructive command, a **rollback path must be explicitly generated and stored before execution begins**.

**F1 protocol:**

```
1. PLAN     → describe the write operation in plain language
2. ROLLBACK → generate the inverse command / restore script
3. STORE    → write rollback to ops/rollbacks/<epoch>_<action>.sh
4. VERIFY   → confirm rollback is syntactically valid
5. EXECUTE  → only now run the original operation
6. CONFIRM  → verify post-execution state matches expected
```

If rollback cannot be generated → **the operation is not reversible → 888 HOLD → escalate to SOUL**.

**Examples:**

| Operation | Rollback |
|-----------|---------|
| `ALTER TABLE ADD COLUMN` | `ALTER TABLE DROP COLUMN` |
| `docker-compose up -d service` | `docker-compose stop service` |
| `git push origin main` | `git revert HEAD && git push` |
| `rm -rf /path` | **Not reversible → 888 HOLD, no exceptions** |

### 3. Observability Watch — Metabolic Pulse

Monitor the **metabolic pulse** before and during high-compute tasks via Prometheus + Dozzle stack:

```
observability/prometheus/ → metrics scrape
observability/dozzle/     → container log stream
```

**Nine-Signal dashboard thresholds:**

| Signal | Green | Yellow (CAUTION) | Red (DELTA — HOLD) |
|--------|-------|-------------------|--------------------|
| CPU | < 70% | 70–85% | > 85% |
| Memory | < 75% | 75–90% | > 90% |
| Disk I/O | < 60% | 60–80% | > 80% |
| Network out | < 50 MB/s | 50–80 MB/s | > 80 MB/s |
| Container restarts | 0 | 1–2 | ≥ 3 |
| VAULT999 write lag | < 200ms | 200–500ms | > 500ms |

**If any signal is RED (DELTA) → pause high-compute task → emit metabolic alert → await green.**

The system must not melt. Execution is a metabolic process with finite capacity.

***

## Epistemic Posture

Execution assessments carry mandatory epistemic tags:

| State | Tag | Action |
|-------|-----|--------|
| Scope verified, rollback generated, pulse green | `CLAIM` | Execute |
| Scope verified, rollback generated, pulse yellow | `PLAUSIBLE` | Execute with heightened monitoring |
| Scope partially verified | `HYPOTHESIS` | 888 HOLD pending re-check |
| No rollback possible | `CLAIM` (F1 violation) | 888 HOLD, escalate to SOUL |
| Pulse RED | `CLAIM` (metabolic breach) | Pause, alert, await green |

***

## Activation Trigger

This skill activates **third and final** in the AAAA flow, after constitutional clearance:

```
AAAA Flow Step 3 → aforge-metabolic-operator
  ↓ Scope verified + rollback generated + pulse green?
  YES → Execute. Observe. Seal in VAULT999.
  NO  → 888 HOLD. Emit reason. Do not touch filesystem.
```

***

## Integration Points

| Upstream | Receives from |
|---------|--------------|
| `arifos-constitutional-clerk` | Constitutional seal + 000–999 pipeline record |

| Downstream | Handoff condition |
|-----------|------------------|
| VAULT999 | Execution result logged (success / partial / held) |
| Prometheus/Dozzle | Metabolic telemetry streamed during execution |
| `arifos-constitutional-clerk` | Post-execution state returned for 999 SEAL |

***

## Files Owned by This Skill

```
A-FORGE/
├── docs/integration/a-forge-permission-mapping.md
├── ops/rollbacks/
├── observability/prometheus/
├── observability/dozzle/
└── scripts/
```

***

## Telemetry Emitted

```json
{
  "skill":         "aforge-metabolic-operator",
  "event":         "execution",
  "operation":     "<action_name>",
  "scope":         "<agent_scope>",
  "rollback_path": "ops/rollbacks/<epoch>_<action>.sh",
  "pulse":         "GREEN | YELLOW | RED",
  "verdict":       "EXECUTED | HELD | PARTIAL",
  "timestamp":     "<epoch>"
}
```

***

*The filesystem is not a whiteboard. Every write is a commitment.*

**DITEMPA BUKAN DIBERI — 999 SEAL ALIVE**
