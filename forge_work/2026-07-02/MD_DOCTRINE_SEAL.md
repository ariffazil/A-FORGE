# MD_DOCTRINE_SEAL — DRAFT (not yet sealed to VAULT999)

> **Seal status:** PENDING_RATIFICATION — F13 SOVEREIGN directive required for VAULT999 commit.
> **Forged:** 2026-07-02 by FORGE (000Ω) under direction from Arif bin Fazil (F13).
> **Method:** T1 OBSERVATION (audit + scaffold). No irreversible actions taken without ratification.
> **Seal target:** VAULT999 / chain extension, pending F13.

---

## 1. Decision ID

```
MD_NAMING_DOCTRINE_RATIFICATION_2026_07_02
```

## 2. Doctrine (the rule)

> **A canonical `.md` file in the federation has a name that is one or two ALLCAPS terms joined by underscore, containing no dates, no version tags, no numeric IDs, and no lowercase noise.**

```
filename      ::= <stem> ".md"
<stem>       ::= <term> | <term> "_" <term>
<term>       ::= [A-Z]+
```

PASS examples: `AGENTS.md`, `CONTEXT_SESSION.md`, `MULTIMODAL_INVENTORY.md`, `SKILL.md`.

FAIL examples fixed by rule:
- `30_60_90_NEXT_ACTIONS.md` → `NEXT_ACTIONS.md`
- `APEX_THEORY_AND_FEDERATION.md` → `APEX_THEORY.md`
- `arifOS_FEDERATION_INVARIANT_AUDIT_2026-06-20.md` → `INVARIANT_AUDIT.md`

## 3. Scope — In Governance

| Path | Reason |
|---|---|
| `/root/*.md` | top-level canon |
| `/root/<ORGAN>/AGENTS.md` (×7 organs) | per-organ landing |
| `/root/<ORGAN>/contracts/*.md` | organ-level governance contracts |
| `/root/AAA/contracts/*.md` | federation-root contracts |
| `/root/AAA/docs/*.md` (selective) | governance doctrine pages |
| `/root/<agent>/{AGENTS,SOUL,IDENTITY,TOOLS,BOOTSTRAP,HEARTBEAT}.md` | agent identity files |

## 4. Scope — Exempt (not audited)

| Path | Reason |
|---|---|
| `/root/A-FORGE/forge_work/**` | SEAL history. F11 AUDIT — sealed past, immutable. |
| `/root/VAULT999/**` | VAULT999 sealed chain — immutable. |
| `/root/.claude/**` | Claude Desktop project files — not ours to govern. |
| `/root/<repo>/node_modules/**` | Vendored. |
| `/root/.agents/skills/*/SKILL.md` | Canonical skill shape (single term `SKILL`). |
| Non-`.md` files (`.txt`, `.yaml`, `.json`) | Out of doctrine scope. |

## 5. Audit Snapshot (2026-07-02)

| Tier | Files | PASS | FAIL | Notes |
|---|---|---|---|---|
| A. `/root/*.md` | 20 | 9 | 11 | top-level canon |
| B. `/root/AAA/contracts/*.md` | 10 | 3 | 7 | federation contracts area |
| C. `/root/A-FORGE/contracts/*.md` | 1 | 0 | 1 | A-FORGE contract area |
| D. Heptalogy + per-organ AGENTS.md | 16+ | ALL PASS | 0 | canon already clean |
| E. Agent identity files | 33 | ALL PASS | 0 | clean |
| F. Skill files (`*.md` only) | ~7 distinct names | ALL PASS | 0 | `SKILL.md` shape |

**Total in-scope violations: 19.** All candidates batched for F13 ratification.

## 6. Ratification Table — Tier A (top-level /root/*.md)

| # | Current | Proposed | Content review? |
|---|---|---|---|
| 1 | `30_60_90_NEXT_ACTIONS.md` | `NEXT_ACTIONS.md` | YES — 16-day-old sprint plan |
| 2 | `APEX_THEORY_AND_FEDERATION.md` | `APEX_THEORY.md` | YES — merge concerns |
| 3 | `CHAOS_MAP_2026-06-23.md` | `CHAOS_MAP.md` | YES — old snapshot |
| 4 | `CONSTITUTIONAL_FLOORS_LAWS_ADAT_ALIGNMENT_MAP.md` | `FLOORS_MAP.md` | YES — alignment belongs in 000_CONSTITUTION |
| 5 | `FEDERATION_FORGE_SWEEP_2026-06-15.md` | `FORGE_SWEEP.md` | YES — 17-day-old sweep |
| 6 | `MINIMAX_CONSUMERS_INVENTORY.md` | `MINIMAX_INVENTORY.md` | NO |
| 7 | `MINIMAX_KEY_ROTATION_MAP.md` | `KEY_ROTATION.md` | NO |
| 8 | `SEAL_FEDERATION_FORGE_SWEEP_2026-06-15.md` | `SEAL_SWEEP.md` | YES — sealed companion of #5 |
| 9 | `arifOS_FEDERATION_INVARIANT_AUDIT_2026-06-20.md` | `INVARIANT_AUDIT.md` | YES — 12-day-old audit |
| 10 | `HERMES_LANDSCAPE.md` | (already PASS) | NO |
| 11 | `RESTART_NEEDED.md` | (already PASS) | YES — content possibly stale |

## 7. Ratification Table — Tier B (`/root/AAA/contracts/*.md`)

| # | Current | Proposed | Notes |
|---|---|---|---|
| 1 | `AGIvsLLMmemorymatrixv1.md` | `AGI_MEMORY_MATRIX.md` | drop mixed case + version |
| 2 | `audit-2026-06-26-1105.md` | `AUDIT.md` (review) | date → BANGANG flag |
| 3 | `audit-readme-cross-organ-2026-06-30.md` | `CROSS_ORGAN_AUDIT.md` (review) | archive-as-merge |
| 4 | `hermes-daily-pulse.md` | `HERMES_PULSE.md` | lowercase fix |
| 5 | `hermes-role-binding.md` | `HERMES_BINDING.md` | lowercase fix |
| 6 | `principal-agent-taxonomy.md` | `PRINCIPAL_TAXONOMY.md` | lowercase fix |
| 7 | `repair-status-2026-06-26.honest.md` | `REPAIR_STATUS.md` | date + dot fix |

## 8. Ratification Table — Tier C (`/root/A-FORGE/contracts/*.md`)

| # | Current | Proposed |
|---|---|---|
| 1 | `gateway-tools-v1.md` | `GATEWAY.md` (version → YAML frontmatter) |

## 9. Skill Sealed

```
Path  : /root/.agents/skills/ZEN_MD/SKILL.md
Name  : zen-md
Version: 1.0.0
Stage : 0 of heptalogy (parallel to 000-init-intent-classify)
Frontmatter: complete (per ZEN-Cooling pattern)
```

Companion tool surface declared in SKILL.md: `audit`, `suggest`, `block_write`, `flag_bangang`. FORGE companion tool `aforge_forge_zen_md_audit()` declared for future wiring.

## 10. Self-Violation Notice

FORGE created `/root/A-FORGE/forge_work/MULTIMODAL-INVENTORY.md` in this session using **hyphen** delimiter (not underscore). Per the ratified doctrine, this file is FAIL (hyphen is not canonical delimiter).

**Resolution:** rename to `MULTIMODAL_INVENTORY.md` (underscore form, 2 caps terms). Pending explicit F13 YES. Self-discipline requirement for FORGE.

## 11. Carry-Forward Decisions (out of scope for this seal)

These emerged earlier in the session, before the doctrine was declared, and are recorded here only:

| Decision ID | Status | Carry-forward to |
|---|---|---|
| MCP-A2A-FEDERATION-CONFORMANCE-v1 | PROPOSED, not drafted | next session (multi-step) |
| arifOS/CONTRACTS/MULTIMODAL-v1.md §1 | PENDING ratification | next session |
| MCP-NAMING-MIGRATION-v1 | PENDING ratification | next session |
| AgentCard schemas (6 organs) | PENDING | A2A conformance arc |
| `arifos.verdict-grammar.v1` A2A extension | PENDING | A2A conformance arc |
| VOCABULARY-MAP-v1 (MCP/A2A/Sampling) | PROPOSED, highest-leverage | next session, first |
| AAA-as-A2A-Gateway rebrand | ARC (multi-week) | F13 per migration step |
| OAuth 2.1 migration | ARC | F13 per step |

## 12. F13 Required Actions (not auto-executed)

1. Tier A renames (9 items in §6) — confirm or amend
2. Tier B renames (7 items in §7) — confirm or amend
3. Tier C rename (1 item in §8) — confirm
4. Content review BANGANG flags (YES-marked in §6 + §7) — manual
5. Self-violation rename (`MULTIMODAL-INVENTORY.md` → `MULTIMODAL_INVENTORY.md`) — confirm
6. **VAULT999 commit of this seal record** — explicit F13 yes
7. BANGANG content archives — explicit per file

## 13. Receipt — Discoverable From

- Audit: this file (`/root/A-FORGE/forge_work/2026-07-02/MD_DOCTRINE_SEAL.md`)
- Skill: `/root/.agents/skills/ZEN_MD/SKILL.md`
- Earlier inventory (DOES NOT YET COMPLY — flagged for rename in §10):
  - `/root/A-FORGE/forge_work/MULTIMODAL-INVENTORY.md`

---

*Forged 2026-07-02 by FORGE (000Ω) under F13 directive.*
*Status: PENDING_RATIFICATION. Awaiting F13 SOVEREIGN yes/no on §12.*
*DITEMPA BUKAN DIBERI — Forged, Not Given.*
