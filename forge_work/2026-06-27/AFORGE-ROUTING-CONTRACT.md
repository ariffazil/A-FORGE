# A-FORGE ROUTING CONTRACT — Native Tools vs forge_* Tools

> **Ratified:** 2026-06-27 | **Session:** SEAL-5c92a324fff1472b
> **Actor:** 000_INIT_FORGE | **Doctrine:** DITEMPA BUKAN DIBERI
> **For:** OpenCode · FORGE (000Ω) · AUDITOR (Ψ) · OPS (🌐)

---

## THE PARADOX: Governance = Freedom

```
TANPA A-FORGE GATE:
  Agent guna bash raw → agent kena self-police → agent slow → agent tanya Arif
  "Patut ke aku commit ni?"
  "Bahaya ke rm ni?"
  "Arif, ok ke aku restart docker?"
  → Arif tak boleh AFK. Agent fragile.

DENGAN A-FORGE GATE:
  Agent guna forge_git → FloorEnforcer auto-check → lease valid? JALAN.
  "Aku dah ada lease untuk MUTATE-class. Jalan je."
  → Agent laju. Arif AFK. Governance dalam kod, bukan dalam kepala agent.
```

---

## ROUTING TABLE (BINDING)

| Action Class | Native Tool (current) | forge_* Tool (target) | Gate | Why |
|---|---|---|---|---|
| **OBSERVE** | `read`, `glob`, `grep` | `forge_filesystem(mode=read/glob/grep)` | None | Native OK. F8 boundary auto via forge. |
| **OBSERVE** | `bash curl` | `forge_health_check` | None | Structured output better. |
| **OBSERVE** | `bash journalctl` | `forge_journalctl(mode=logs)` | None | PII-redacted, safer. |
| **OBSERVE** | `bash systemctl status` | `forge_systemctl(mode=status)` | None | Structured output. |
| **OBSERVE** | `bash docker ps` | `forge_docker(mode=ps)` | None | Scoped, auditable. |
| **DRAFT** | `write`, `edit` | `forge_filesystem(mode=write)` | F1 AMANAH auto | Overwrite=false by default. |
| **MUTATE** | `bash git commit` | `forge_git(mode=commit)` | Lease required | Receipt trail. Class MUTATE. |
| **MUTATE** | `bash systemctl restart` | `forge_systemctl(mode=status)` + `forge_shell` | Lease required | Who restarted what, logged. |
| **MUTATE** | `bash docker restart` | `forge_docker(mode=restart)` | Lease required | Auditable container ops. |
| **HIGH** | `bash git push` | `forge_git(mode=push)` | Lease + SEAL | Auto 888_HOLD if force-push. |
| **HIGH** | `bash npm install` | `forge_shell` | Lease required | Dependency changes logged. |
| **IRREVERSIBLE** | `bash rm -rf` | `forge_filesystem(mode=write)` + `forge_lock` | 888_HOLD | Cannot delete without sovereign ack. |
| **IRREVERSIBLE** | `bash git push --force` | `forge_git` → auto-blocked | 888_HOLD | Hard blocked. Cannot force-push. |

---

## AFK AND YOLO PATTERN

```
╔══════════════════════════════════════════════════════════╗
║           ARIF'S AFK AND YOLO PLAYBOOK                   ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  1. Arif bagi lease broad:                               ║
║     "Ko boleh commit, push, edit, build — semua           ║
║      dalam /root. Jangan deploy production."             ║
║                                                          ║
║  2. Arif AFK. Pergi makan. Tidur. Main golf.             ║
║                                                          ║
║  3. Agent dapat task: "refactor module X"                ║
║     → forge_filesystem read existing code                ║
║     → forge_filesystem write new code                    ║
║     → forge_shell npm test                               ║
║     → forge_git commit                                   ║
║     → forge_git push                                     ║
║     → Semua auto-gated. Agent tak payah tanya.           ║
║                                                          ║
║  4. Agent nak buat sesuatu luar lease:                   ║
║     "forge_shell: rm -rf /srv"                           ║
║     → FloorEnforcer: F8 LAW — path /srv NOT in           ║
║       ALLOWED_ROOTS. BLOCKED.                            ║
║     → Agent report: "Cannot rm /srv — outside             ║
║       forge boundary. Need 888_HOLD."                    ║
║                                                          ║
║  5. Arif balik. Baca receipt log.                        ║
║     "OK, ko buat 7 commits, 42 file changes,              ║
║      0 floor violations. Padu."                          ║
║                                                          ║
║  RESULT: Arif AFK 6 jam. Agent productive 6 jam.         ║
║  Zero anxiety. Full audit trail.                         ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

---

## WHY THIS WORKS (and manual self-governance doesn't)

| Without forge_* gates | With forge_* gates |
|---|---|
| Agent must remember F1-F13 | FloorEnforcer checks every call |
| Agent hesitates on every mutation | Lease boundary = "within this, I'm free" |
| Arif must approve every push | Lease covers routine pushes |
| No receipt trail for bash commands | Every forge_shell call logged |
| Agent can `rm -rf /` by accident | F8 LAW blocks paths outside /root |
| Agent confidence = fragile | Agent confidence = bounded, verified |
| **Arif cannot AFK** | **Arif CAN AFK** |

---

## THE REAL INSIGHT

**Governance is not restriction. Governance is ENABLEMENT.**

Without gates:
- Boundaries exist only in agent's "head" (prompt)
- Agent must simulate FloorEnforcer manually
- This is slow, unreliable, and anxiety-inducing

With gates:
- Boundaries are CODE-ENFORCED
- Agent operates at full speed within known boundaries
- Agent doesn't think "should I?" — it checks "does my lease cover this?"

**The machine enforces the law. The agent enforces the mission.**
**This separation is what makes true autonomy possible.**

---

## LEASE TIERS (Recommended)

| Tier | Scope | Max Class | TTL | Use Case |
|---|---|---|---|---|
| **OBSERVE** | All paths | OBSERVE | ∞ | Read-only research, audit, exploration |
| **DEV** | /root/* | EXECUTE_REVERSIBLE | 8h | Active development, refactoring, building |
| **DEPLOY** | /root/*, /srv/* | EXECUTE_HIGH_IMPACT | 2h | Production deployment window |
| **FULL** | All | IRREVERSIBLE | 30min | Emergency ops — requires 888_HOLD for each IRREVERSIBLE action |

---

*Forged 2026-06-27 by 000_INIT_FORGE*
*DITEMPA BUKAN DIBERI — the forge is the gate, and the gate is the freedom*
