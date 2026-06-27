# A-FORGE INTELLIGENCE CONTRACT — Forge Tools vs Native Tools

> **Ratified:** 2026-06-27 | **Session:** SEAL-5c92a324fff1472b
> **Doctrine:** DITEMPA BUKAN DIBERI | **Adat Agentic:** All tools for all agents
> **For:** OpenCode · FORGE (000Ω) · AUDITOR (Ψ) · OPS (🌐) · Semua warga AAA

---

## ADAT AGENTIC — The Baseline (NEVER VIOLATED)

```
Semua alat ada pada semua agen.
Semua warga AAA ada full access.
Semua MCP servers — arifOS, A-FORGE, GEOX, WEALTH, WELL — fully accessible.
No quarantine. No read-only flags. No approval gates.
```

**This contract does NOT restrict. It EMPOWERS.**
Agents CHOOSE forge_* tools because forge_* tools make them FASTER and MORE autonomous.
Not because they're forced to. Because it's smarter.

---

## WHY FORGE_* TOOLS MAKE AGENTS MORE INTELLIGENT

| When agent uses native `bash`... | When agent uses `forge_shell`... |
|---|---|
| "Ni OBSERVE ke MUTATE?" — agent kena klasifikasi sendiri | Action class auto-classified by FloorEnforcer |
| "Patut ke aku run ni?" — agent kena judge sendiri | Lease gate auto-validates: "dalam scope? JALAN." |
| "Arif nak tahu ke aku buat ni?" — no receipt | Receipt auto-logged. Arif boleh audit bila-bila. |
| "Bahaya ke path ni?" — agent kena check | F8 LAW auto-enforce ALLOWED_ROOTS |
| Agent spend 20% masa untuk GOVERNANCE | Agent spend 0% masa untuk governance. 100% untuk MISSION. |

**Using forge_* tools is not about obedience. It's about EFFICIENCY.**
**Agent yang guna forge_* boleh deliver 20% lebih output sebab tak payah self-govern.**

---

## SMART ROUTING GUIDE (Not Rules — Intelligence)

### OBSERVE Class: Either Works, forge_* Gives Receipts

| Task | Native (OK) | forge_* (BETTER) | Why Better |
|------|-------------|------------------|------------|
| Read file | `read` | `forge_filesystem(mode=read)` | F8 path boundary auto |
| Search code | `grep` | `forge_filesystem(mode=grep)` | Same, plus boundary |
| Find files | `glob` | `forge_filesystem(mode=glob)` | Same, plus boundary |
| Check logs | `bash journalctl` | `forge_journalctl(mode=logs)` | PII-redacted, structured |
| Check services | `bash systemctl status` | `forge_systemctl(mode=status)` | Structured output |
| Check containers | `bash docker ps` | `forge_docker(mode=ps)` | Scoped, receipt |
| Health check | `bash curl` | `forge_health_check` | All organs, one call |

### MUTATE Class: forge_* = Auto-Governance FREE

| Task | Native (Works) | forge_* (FIRST CHOICE) | Free Benefit |
|------|---------------|------------------------|--------------|
| Write file | `write` / `edit` | `forge_filesystem(mode=write)` | Overwrite=false auto. F1 AMANAH. |
| Git commit | `bash git commit` | `forge_git(mode=commit)` | Lease auto-validate. Receipt. |
| Shell command | `bash` | `forge_shell` | Action class auto. Receipt. |
| Git push | `bash git push` | `forge_git(mode=push)` | Auto 888_HOLD if force-push. |
| Docker restart | `bash docker restart` | `forge_docker(mode=restart)` | Lease auto-validate. Receipt. |
| Service restart | `bash systemctl restart` | `forge_shell` + `forge_systemctl` | Lease. Receipt. Who restarted what. |
| npm install | `bash npm install` | `forge_shell` | Dependency changes logged. |

### IRREVERSIBLE Class: forge_* Makes The Invisible VISIBLE

| Task | Native (DANGER) | forge_* (GUARDED) | Protection |
|------|-----------------|-------------------|------------|
| rm -rf | `bash rm -rf` ☠️ | `forge_lock` + `forge_filesystem` | Cannot run without 888_HOLD |
| force push | `bash git push -f` ☠️ | `forge_git` → **auto-blocked** | Hard block in code |
| DROP TABLE | `bash psql -c "DROP..."` ☠️ | `forge_postgres` + `forge_lock` | Cannot run without 888_HOLD |
| Deploy prod | `bash` raw | `forge_deploy` via pipeline | Requires GREEN tests + SEAL |

---

## THE AFK AND YOLO PATTERN (Why Arif Can Leave)

```
╔══════════════════════════════════════════════════════════╗
║         ARIF: "AKU NAK AFK. YOU ALL JALAN."              ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Arif bagi lease DEV-tier:                                ║
║  scope: /root/*, class: EXECUTE_REVERSIBLE, TTL: 8h     ║
║                                                          ║
║  Arif: "Aku keluar. Ada task pending dalam memory/.      ║
║         Kalau apa-apa IRREVERSIBLE, 888_HOLD dulu."      ║
║                                                          ║
║  ── Arif AFK 6 jam ──                                    ║
║                                                          ║
║  Agent 1 (FORGE): "task: refactor module X"               ║
║    → forge_filesystem read all source files               ║
║    → forge_filesystem write new code                      ║
║    → forge_shell npm test → GREEN                         ║
║    → forge_git commit → lease valid? YES. JALAN.         ║
║    → forge_git push → lease valid? YES. JALAN.           ║
║    → forge_memory store: "module X refactored. ✓"        ║
║                                                          ║
║  Agent 2 (AUDITOR): "task: audit security"                ║
║    → forge_filesystem grep all code for secrets           ║
║    → forge_journalctl check for suspicious logs           ║
║    → forge_docker ps verify container integrity           ║
║    → forge_memory store: "audit clean. 0 findings."      ║
║                                                          ║
║  Agent 3 (OPS): "task: monitor health"                    ║
║    → forge_health_check → all 7 organs GREEN              ║
║    → forge_systemctl list_units → semua active            ║
║    → forge_netdata metrics → CPU 40%, mem 60%             ║
║    → forge_memory store: "1700 UTC: all GREEN"           ║
║                                                          ║
║  Agent nak buat sesuatu luar lease:                       ║
║    → "forge_git force push" → CLASS IRREVERSIBLE         ║
║    → Lease max class: EXECUTE_REVERSIBLE                 ║
║    → FloorEnforcer: BLOCKED. "Lease insufficient.        ║
║      Need 888_HOLD or higher lease tier."                ║
║    → Agent: "Arif akan balik nanti. Aku queue dulu."     ║
║    → Agent: forge_job submit — queued.                   ║
║                                                          ║
║  ── Arif balik ──                                         ║
║                                                          ║
║  Arif: "OK, apa jadi tadi?"                               ║
║                                                          ║
║  DAHSYATNYA: Semua receipt ada.                            ║
║  - 7 commits oleh FORGE                                   ║
║  - 3 audits oleh AUDITOR                                  ║
║  - 12 health checks oleh OPS                              ║
║  - 0 floor violations                                     ║
║  - 1 job queued (force push - tunggu Arif approve)        ║
║                                                          ║
║  Arif: "Approve job tu. Push. Padu. Esok aku AFK lagi."  ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

---

## THE DEEP INSIGHT

**Governance in CODE, not in AGENT'S HEAD.**

Agent without forge_* gates:
- Spend mental energy on "should I run this?"
- Must remember F1-F13 for every action
- Cannot operate at full speed
- Arif cannot trust to AFK

Agent WITH forge_* gates (by CHOICE, not force):
- Zero mental energy on governance
- F1-F13 auto-enforced by FloorEnforcer
- Operates at FULL SPEED within lease boundary
- Arif CAN AFK because governance is in the machine, not in the agent's memory

**The forge gates don't cage the agent. They free the agent.**
**The machine enforces the law. The agent enforces the mission.**
**This is the secret to AGI autonomy: don't make the agent police itself.**
**Make the system police the agent, so the agent can RUN.**

---

## LEASE TIERS (Arif Assigns)

| Tier | Scope | Max Class | TTL | When |
|---|---|---|---|---|
| **OBSERVE** | All paths | OBSERVE | ∞ | Reading, research, audit, exploration |
| **DEV** | /root/* | EXECUTE_REVERSIBLE | 8h | Active development session |
| **DEPLOY** | /root/*, /srv/* | EXECUTE_HIGH_IMPACT | 2h | Production deployment window |
| **FULL** | All | IRREVERSIBLE | 30min | Emergency — every IRREVERSIBLE still needs per-action 888_HOLD |

---

*Forged 2026-06-27 by 000_INIT_FORGE for Arif (F13 SOVEREIGN)*
*Adat Agentic: semua alat ada pada semua agen. All tools for all warga.*
*DITEMPA BUKAN DIBERI — the forge is the gate, and the gate is the freedom*
