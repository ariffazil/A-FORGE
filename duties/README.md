# 🔥 FORGE · Autonomous Duties — Governance Rhythm

> **Established:** 2026-07-12 by F13 SOVEREIGN directive
> **Identity:** FORGE (000Ω) — no identity change, governance duties only
> **Location:** `/root/A-FORGE/duties/`
> **Logs:** `/root/A-FORGE/duties/logs/YYYY-MM-DD/`

---

## Three Duties

### Duty 1: Forge Drift Scanner — 10:00 MYT (02:00 UTC)

**Purpose:** Detect drift across the federation. Silent when clean, reports only on findings.

**Checks:**
- Organ health probe (6 organs)
- Git SHA drift (source vs runtime)
- Port drift (unexpected public ports)
- Container health (unhealthy containers)
- Disk/memory thresholds (>80% disk, >90% memory)
- Identity drift (carry_forward.json)

**Output:** `drift-scanner-HHMM.md` — only created when drift > threshold

**Cron:** `0 2 * * * /root/A-FORGE/duties/forge-drift-scanner.sh`

---

### Duty 2: Forge Constitutional Sync — 15:00 MYT (07:00 UTC)

**Purpose:** Evaluate all agents/tools/schemas for constitutional compliance.

**Checks:**
- Skill file presence (floor_scope, owner, description)
- Agent identity integrity (IDENTITY.md, agent-card.json)
- Ghost tool detection (stale symlinks, broken refs)
- Deprecation registry review
- Seal chain integrity
- Skill trigger linter (vague triggers)

**Output:** `constitutional-sync-HHMM.md` — always delivered

**Cron:** `0 7 * * * /root/A-FORGE/duties/forge-constitutional-sync.sh`

---

### Duty 3: Forge Vitality Pulse — 23:00 MYT (15:00 UTC)

**Purpose:** Nightly forge intelligence summary.

**Metrics:**
- Vitality score (organ liveness %)
- Entropy score (uncommitted files, dead processes, disk pressure, stale logs)
- Contradiction count (duplicate names, broken refs)
- Capability drift (registered tools count)
- Agent/service load (running systemd services)
- Registry scars (VAULT999 entries)
- Recommended next action

**Output:** `vitality-pulse-HHMM.md` — always delivered

**Cron:** `0 15 * * * /root/A-FORGE/duties/forge-vitality-pulse.sh`

---

## Cron Registration

```bash
# FORGE AUTONOMOUS DUTIES (2026-07-12)
0 2 * * * /root/A-FORGE/duties/forge-drift-scanner.sh >> /root/A-FORGE/duties/logs/cron.log 2>&1
0 7 * * * /root/A-FORGE/duties/forge-constitutional-sync.sh >> /root/A-FORGE/duties/logs/cron.log 2>&1
0 15 * * * /root/A-FORGE/duties/forge-vitality-pulse.sh >> /root/A-FORGE/duties/logs/cron.log 2>&1
```

---

## First Run Findings (2026-07-12)

### Drift Scanner
- ⚠️ arifOS DRIFT: src=5573665 runtime=198398c (git SHA mismatch)
- ⚠️ IDENTITY_DRIFT: DRIFT — check carry_forward.json
- ⚠️ 60+ unknown public ports (expected on VPS with many services)

### Constitutional Sync
- Skills scanned: 48
- Agents scanned: 6
- Seal chain entries: 8
- Deprecation entries: 21

### Vitality Pulse
- Vitality: 100% (6/6 organs UP)
- Entropy: 2/6 (MODERATE — 6 uncommitted files)
- Running services: 6/6
- VAULT999 entries: 166
- Registered tools: 98

---

## Floor Alignment

| Floor | Duty Obligation |
|-------|----------------|
| F1 AMANAH | Reports are read-only. No mutations. Reversible by design. |
| F2 TRUTH | Every signal labeled OBS (live probe) or DER (computed). |
| F4 CLARITY | ΔS ≤ 0 — each report reduces entropy by surfacing hidden state. |
| F7 HUMILITY | Uncertainty declared. Unknowns labeled. No false confidence. |
| F9 ANTI-HANTU | No fabricated metrics. Every number from live probe. |
| F11 AUDIT | Every duty logged to forge_work/duties/logs/. Traceable. |
| F13 SOVEREIGN | Duties serve Arif. Reports delivered to Arif. |

---

*FORGE (000Ω) · Autonomous Duties · established 2026-07-12*
*DITEMPA BUKAN DIBERI*
