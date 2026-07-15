# Systemd Geometry — Ψ-Skeleton of the Federation

> **Status:** CANONICAL · T1 probe 2026-07-09 · F13  
> **Parent law:** [ariffazil/CANON.md](https://github.com/ariffazil/ariffazil/blob/main/CANON.md)  
> **Live units:** `/etc/systemd/system/` (host truth)  
> **This file:** classification map only — do **not** treat copies of unit files as source of truth.

---

## 0. Probe truth (F2 — no inflation)

| Signal | T1 value (2026-07-09) |
|--------|------------------------|
| `systemctl` service unit-files (host total) | **343** (all of Linux + docker + timers-as-listed, not all “organs”) |
| Running services | **~70** |
| Federation-classified units in this map | **~39** |

**So what:** the civilization’s Ψ-skeleton is the **classified federation set**, not the raw host count.  
Saying “244 organs” without classification is entropy. Classify first.

---

## 1. Systemd is ACTΨ (and support Ψ)

Systemd is **not** the constitution. It is the **machine axis** that keeps processes alive.

| Axis | Who | What |
|------|-----|------|
| **ACTΨ** | systemd | restart, dependency, cgroup, failure policy |
| **ACTΩ** | A-FORGE / dispatchers | 7-phase hands, leases, MCP tools |
| **ACTΔ** | Arif / Hermes witness | human-facing gate, veto path |

Autonomic nervous system metaphor is useful only after this split is locked.

---

## 2. Product space (reminder)

```
ART × KERNEL × APA × ACT  →  VAULT999
```

| Organ | Question | Must not |
|-------|----------|----------|
| ART | WHAT is this? | Judge or execute |
| KERNEL | MAY this? | Mutate host / own ledger storage |
| APA | THROUGH which door? | Seal judgments |
| ACT | HOW do we touch reality? | Self-authorize SEAL |
| VAULT999 | WHAT forever? | Edit history |

**VAULT999 ownership (iron):** VPS stores · **arifos writes** · A-FORGE **reads**/types · AAA **defines**.

---

## 3. Thordial table (Δ × Ω × Ψ)

```
                 Δ (Human)           Ω (Agent)              Ψ (Machine)
                 ─────────────────────────────────────────────────────────
ART       Intent surface        Classifier             Observability hooks
KERNEL    Veto (F13)            Verdict engine         Non-mutating law daemons
APA       Lived apps (Δ only)   Bridge law + verbs     Secrets + bridge processes
ACT       Human witness         7-phase / MCP hands    systemd supervision
VAULT999  Sovereign truth       Episodic memory        Append-only chain + API
```

---

## 4. Unit → organ map (live)

Status columns = T1 probe. Re-probe before irreversible ops.

### ART + KERNEL (arifos axis)

| Unit | Organ | ΔΩΨ weight | Active | Enabled | Notes |
|------|-------|------------|--------|---------|-------|
| `arifos.service` | ART/KERNEL host | ΩΨ | active | enabled | Main MCP/governance surface |
| `arifosd.service` | KERNEL daemon | ΩΨ | active | enabled | Constitutional daemon |
| `arifos-mcp.service` | ART/KERNEL MCP alias | ΩΨ | **inactive** | disabled | Collapsed / unused path — do not invent dual truth |
| `arifOS-NATS-heartbeat.service` | KERNEL support | Ψ | active | enabled | Nerve pulse |
| `arifos-gateway.service` | ART edge | ΩΨ | inactive | disabled | Standby |
| `arifos-observatory.service` | ART observe | ΩΨ | inactive | disabled | Standby |
| `arifos-scar-listener.service` | KERNEL scar I/O | ΩΨ | inactive | disabled | Standby |

### VAULT999 (memory organ — not A-FORGE-owned)

| Unit | Organ | ΔΩΨ | Active | Enabled | Notes |
|------|-------|-----|--------|---------|-------|
| `vault999-writer.service` | VAULT999 write path | ΩΨ | active | enabled | Derivative / mirror writer — chain file still VPS canonical |
| `vault999-api.service` | VAULT999 read API | ΩΨ | active | enabled | Query surface (cooling/conformance) |
| `vault-flat-generator.service` | VAULT999 derived | Ψ | active | enabled | Flat views — not canon |

Canonical ledger path: `/root/.local/share/arifos/vault999/seal_chain.jsonl`

### APA (A-FORGE bridges)

| Unit | Organ | Δ surface | Active | Enabled |
|------|-------|-----------|--------|---------|
| `apa-telegram-bridge.service` | APA | messenger / F13 wire | active | enabled |
| `apa-github-bridge.service` | APA | code identity | active | enabled |
| `apa-email-bridge.service` | APA | communication | active | enabled |
| `apa-calendar-bridge.service` | APA | time | active | enabled |

### ACT (A-FORGE + dispatch body)

| Unit | Organ | ΔΩΨ | Active | Enabled | Notes |
|------|-------|-----|--------|---------|-------|
| `a-forge.service` | ACT body | ΩΨ | active | enabled | Execution shell |
| `a-forge-mcp.service` | ACT MCP | ΩΨ | active | enabled | Hands on wire |
| `aforge-heartbeat.service` | ACT health | Ψ | active | enabled | |
| `hermes-dispatcher.service` | ACT/route | Ω | active | enabled | Dispatch plane |
| `mind.service` | ACT/mind plane | Ω | active | enabled | Separate from kernel law |
| `forge-gateway.service` | ACT edge | ΩΨ | inactive | disabled | Standby |

### AAA (civilization state / cockpit)

| Unit | Organ | Active | Enabled |
|------|-------|--------|---------|
| `aaa-a2a.service` | AAA A2A + cockpit gateway | active | enabled |
| `aaa-preforge.service` | AAA preflight | active | enabled |

### Hermes (sovereign gateway — Δ face)

| Unit | Organ | Active | Enabled |
|------|-------|--------|---------|
| `hermes-asi-gateway.service` | Hermes Δ/Ω gateway | active | enabled |
| `hermes-dispatcher.service` | Hermes dispatch | active | enabled |
| `hermes-mcp.service` | Hermes MCP | inactive | disabled |

### Domain organs

| Unit | Organ | Role | Active | Enabled |
|------|-------|------|--------|---------|
| `well.service` | WELL | Δ care / cooling reflect | active | enabled |
| `well-heartbeat.service` | WELL | health pulse | active | enabled |
| `wealth-organ.service` | WEALTH | capital compute | active | enabled |
| `wealth.service` | WEALTH | companion surface | active | enabled |
| `wealth-heartbeat.service` | WEALTH | pulse | active | enabled |
| `geox-mcp.service` | GEOX | earth evidence | active | enabled |
| `geox-heartbeat.service` | GEOX | pulse | active | enabled |
| `geox-static-server.service` | GEOX | static evidence UI | active | enabled |

### Substrate / tooling Ψ (support — not law)

| Unit | Role | Active | Enabled |
|------|------|--------|---------|
| `graphiti-mcp.service` | graph memory substrate | active | enabled |
| `playwright-mcp.service` | browser tooling | active | enabled |
| `1mcp.service` | MCP aggregator | active | enabled |
| `mcp-telemetry-proxy.service` | telemetry | inactive | disabled |

### Masked / retired (do not resurrect without SEAL)

| Unit | Enabled | Note |
|------|---------|------|
| `arif-agent-worker.service` | masked | retired worker |
| `arif-heartbeat.service` | masked | retired |
| `arifos-backup.service` | masked | retired unit (backup may live elsewhere) |

---

## 5. Repo × axis (civilization substrate)

| Repo | Primary organ code | Axis emphasis |
|------|--------------------|---------------|
| [arifos](https://github.com/ariffazil/arifos) | ART + KERNEL + VAULT999 **write** | ΩΨ law plane |
| [AAA](https://github.com/ariffazil/AAA) | doctrine, TREE777, cockpit, A2A | Ω state / Δ visibility |
| [A-FORGE](https://github.com/ariffazil/A-FORGE) | APA + ACT + vault **read** | ΩΨ hands |
| [well](https://github.com/ariffazil/well) | WELL cooling / vitality | ΔΨ |
| [wealth](https://github.com/ariffazil/wealth) | capital intelligence | ΔΩ (compute only) |
| [geox](https://github.com/ariffazil/geox) | earth intelligence | Ω evidence |
| [ariffazil](https://github.com/ariffazil/ariffazil) | CANON + sovereign identity | Δ root |

**Pillar one-liners**

- **arifOS** — AGI substrate (reflex arc + seal write)  
- **AAA** — ASI civilization law + state  
- **A-FORGE** — governed agentic autonomy (APA + ACT)  
- **systemd** — Ψ supervision only; never judgment  

---

## 6. What lives in this directory

| Path | Role |
|------|------|
| `geometry.md` | **This file** — orthogonal map + T1 statuses |
| `units-manifest.yaml` | Machine-readable organ tags for agents |
| `*.service` (existing templates) | Deploy templates for A-FORGE only — not full host inventory |

**Do not** dump all 343 host units into git. Host truth stays on VPS. Git holds **geometry + templates**.

---

## 7. Agent rule when adding a unit

1. Name the **organ** (ART / KERNEL / APA / ACT / VAULT999 / domain).  
2. Name **ΔΩΨ** weights.  
3. Name **repo** that owns the code.  
4. Register here + `units-manifest.yaml`.  
5. Never give a Ψ unit the right to SEAL without arifOS.

---

*T1 freeze 2026-07-09. Geometry, not poetry. DITEMPA BUKAN DIBERI.*
