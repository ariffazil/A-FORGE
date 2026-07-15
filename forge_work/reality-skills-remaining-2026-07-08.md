# Reality Skills — Remaining Tasks (post-v1.0.1)

> **Session:** FORGE recursive improvement cycle
> **Date:** 2026-07-08
> **Sealed:** VAULT999 mem_1783549489084_0bkle

---

## Completed ✅

- [x] 7 Reality Skills forged (health-sweep, entropy-sweep, self-audit, skill-map, sentinel, skill-forge, tool-gate)
- [x] 3 naming trials (cognitive, functional, zen-hybrid) — functional won (8.03)
- [x] 20 legacy skills absorbed (65% reduction)
- [x] Full run of all 7 skills (YELLOW-PROCEED)
- [x] Recursive improvement v1.0.1 (7 improvements applied)
- [x] Sealed to VAULT999

---

## Remaining — WAJIB (Must Do)

### R1: Wire Reality Skills into Agent Configs
**Priority:** HIGH
**Effort:** 30 min
**What:** Add `/root/.agents/skills/reality-skills/` to opencode agent references so agents can load them at boot.
**How:** Edit `/root/.config/opencode/agents/opencode.md` or equivalent config to add reality-skills to references.

### R2: Archive Absorbed Skills
**Priority:** HIGH
**Effort:** 15 min
**What:** Move the 20 absorbed skills from active to archive:
- service-health-triage, federation-health-scan, drift-response, infra-guardian, docker-guardian, mcp-smoke-test
- entropy-thermo-zen, repo-hygiene-audit, active-maintenance, tool-fitness-compiler
- constitutional-auditor, arifos-recursive-audit, tool-health-check
- meta-mesa-skill-atlas, unified-skill-binding
- mcp-lifeguard, model-fallback-monitor
- recursive-skill-forge, tool-creation-gate, skill-trigger-linter
**How:** `mv` each to `/root/.agents/skills/.archive-2026-07-08/`

### R3: Fix searxng Container
**Priority:** MEDIUM
**Effort:** 10 min
**What:** `docker restart searxng` or investigate why it's unhealthy.
**How:** `docker logs searxng` → diagnose → restart or rebuild.

### R4: Resolve Identity Drift
**Priority:** MEDIUM
**Effort:** 20 min
**What:** Investigate why carry_forward reports DRIFT. Common cause: kernel build ≠ live commit (known anomaly).
**How:** Run identity-drift-watchdog.sh manually, check arifOS runtime_drift flag.

---

## Remaining — SUNAT (Should Do)

### S1: Forge deploy-verification Skill
**Priority:** LOW
**Effort:** 1 hour
**What:** Create a skill that wraps forge_health_check + forge_probe into a post-deploy validation pipeline.
**Decision:** Could also be absorbed into sentinel as a deploy mode.

### S2: Resolve Overlaps
**Priority:** LOW
**Effort:** 30 min
**What:** Wire cooling-ledger-rsi as entropy-sweep sub-routine. Archive tools-embodiment-application. Document shadow-diagnostic ↔ self-audit relationship.

### S3: Unified Sentinel Process
**Priority:** LOW
**Effort:** 2 hours
**What:** Consolidate 3 watchdog cron jobs into one sentinel process. Only needed when watchdog jobs exceed 5.

---

## Decision Points for Arif

1. **R1 (wiring):** Auto-do or needs approval? → AUTO-DO (config change, reversible)
2. **R2 (archive):** Auto-do or needs approval? → AUTO-DO (move to archive, reversible)
3. **R3 (searxng):** Auto-restart or investigate first? → AUTO-RESTART (non-critical container)
4. **S1 (deploy-verify):** Forge new skill or extend sentinel? → NEEDS DECISION

---

*Remaining tasks for next FORGE session.*
*DITEMPA BUKAN DIBERI.*
