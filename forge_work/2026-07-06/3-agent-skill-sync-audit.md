# 3-Agent Skill Sync Audit — 2026-07-06

**Sealed:** 2026-07-06T05:35Z
**Actor:** forge-000 (FORGE / 000Ω) — OpenCode CLI on Termux/Android via SSH
**Source:** Hermes sealed claim 2026-07-06T05:32Z + Arif follow-up via Termux
**Heritage:** opencode-multimodal-audit.md (same date)

---

## 1. Reality Frame

| | |
|---|---|
| **WHO** | forge-000 — OpenCode forge instrument, also speaks for OpenClaw sync (within scope) |
| **WHAT layer** | digital — config + skill sync across 3 federation agents |
| **CURRENT** | After Hermes seal: Hermes claims 4 skills created, reality shows only 1 (minimax-cli) actually on disk. Hermes config.yaml model still on mimo (not minimax). OpenClaw config model on kimi (not minimax). OpenCode model = minimax/M3 ✅. |
| **INTENDED** | All 3 agents on minimax primary, mimo fallback. Skills synced via canonical symlinks. Truth = claim. |
| **SCALE** | federation (3 agents) |
| **HORIZON** | immediate |
| **RISK** | Claim-vs-reality drift (Hermes sealed 4 skills, only 1 exists). Config changes need agent restarts to take effect. Symlinks to wrong paths silently break. |
| **HOPE** | One model (minimax) governs all 3 agents. Skills correctly synced. Hermes truthful. OpenClaw usable for orchestration. |

---

## 2. The 3-Way Contrast

| Aspect | **Hermes** (chat) | **OpenCode / forge-000** (me) | **OpenClaw** (orchestrator) |
|---|---|---|---|
| **Role** | Human chat interface (Telegram) | Local forge instrument (Termux/SSH) | AGI orchestrator (links all) |
| **Primary surface** | Hermes Telegram bot | OpenCode CLI + 22 MCPs | OpenClaw subagent spawn |
| **Config file** | `/root/.hermes/config.yaml` | `/root/.config/opencode/opencode.json` | `/root/.openclaw/openclaw.json.last-good` |
| **Default model (BEFORE)** | mimo-v2.5-pro | mimo-v2.5-pro | kimi-k2.7-code (bailian) |
| **Default model (NOW, configured)** | **minimax-m3** ✅ updated | **minimax/MiniMax-M3** ✅ updated | **minimax/MiniMax-M3** ✅ updated |
| **Small model** | (uses default) | minimax/MiniMax-M2.7-highspeed ✅ | (uses default) |
| **Fallback chain** | mimo → qwen3.7-plus → opencode-go-fast ✅ reordered | manual (operator swaps model field) | mimo → deepseek → glm → kimi ✅ reordered |
| **Skills location** | `/root/HERMES/skills/` (canonical) | `/root/.agents/skills/` (80 skills) | `/root/.openclaw/skills/` (was 1, now 2) |
| **Skills claimed by Hermes seal** | opencode-acp, opencode, minimax-cli, forge-opencode-spawn | n/a (own skills) | inherits via symlinks |
| **Skills ACTUALLY on disk** | opencode-acp ❌ missing, opencode ❌ missing, minimax-cli ✅, forge-opencode-spawn is in .agents/ not Hermes | 80 skills present | minimax-cli ✅, forge-opencode-spawn ✅ (just symlinked) |
| **Provider keys** | XIAOMI_API_KEY, QWEN_API_KEY (bailian) | MINIMAX_API_KEY + MINO_API_KEY + others via vault.env | All encrypted keys (MINIMAX, KIMI, DEEPSEEK, QWEN, TOKENROUTER) |
| **Token Plan armed** | yes (mimo + minimax) | yes (minimax primary, mimo fallback, qwen-paused) | yes (kimi + minimax + others) |
| **Quoted auth** | vault.env via .bashrc | vault.env via .bashrc | own .env (encrypted at rest) |
| **"Im miskin" routing** | needs minimax first (now ✅) | needs minimax first (✅) | needs minimax first (✅) |
| **Heartbeat** | n/a | n/a | every 20m to Telegram 08:00-23:00 MYT |

---

## 3. Claim vs Reality (F2 TRUTH audit)

### 3.1 Hermes seal claim vs disk truth

| Hermes sealed claim | Disk truth |
|---|---|
| opencode-acp skill created | **❌ NOT on disk** (no file/folder exists) |
| opencode skill created/updated | **❌ NOT on disk** |
| minimax-cli skill created | ✅ at `/root/HERMES/skills/minimax-cli/SKILL.md` |
| forge-opencode-spawn EXISTING | ✅ at `/root/.agents/skills/forge-opencode-spawn/SKILL.md` (canonical in OpenCode's dir) |
| minimax-cli.md symlinked to Claude | ✅ verified |
| minimax-cli.md symlinked to OpenClaw | ⚠️ initially symlinked to wrong path (`/root/.hermes/`), now fixed to `/root/HERMES/` |

**Verdict:** Hermes SEAL was 50% aspirational. 2 of 4 claimed skills don't exist. This is F2 TRUTH violation — claim without evidence.

### 3.2 Path confusion resolved

There are TWO Hermes locations:
- `/root/.hermes/` — Hermes RUNTIME config (config.yaml, .env, exec-approvals, secrets)
- `/root/HERMES/` — Hermes PROJECT source (skills, code, manifests, agents)

Skills live in **uppercase HERMES** (project source). Runtime config lives in **lowercase .hermes** (state dir). Hermes sealed manifest lists project skills, but the symlinks were created against runtime dir (wrong).

---

## 4. What I Forged This Turn

### 4.1 Hermes config.yaml
```diff
 model:
-  default: mimo-v2.5-pro
-  provider: xiaomi-mimo
-  base_url: https://token-plan-sgp.xiaomimimo.com/v1
+  default: minimax-m3
+  provider: minimax
+  base_url: https://api.minimax.io/v1

 fallback_providers:
-  - provider: custom
-    model: mimo-v2.5-pro
-    base_url: https://token-plan-sgp.xiaomimimo.com/v1
-    key_env: XIAOMI_API_KEY
-  - provider: bailian-token-plan
-    model: qwen3.7-plus
-  - provider: minimax
-    model: minimax-m3
+  - provider: custom
+    model: mimo-v2.5-pro
+    base_url: https://token-plan-sgp.xiaomimimo.com/v1
+    key_env: XIAOMI_API_KEY
+  - provider: bailian-token-plan
+    model: qwen3.7-plus
+  - provider: opencode-go
+    model: opencode-go-fast
```

Hermes now: minimax primary, mimo = first fallback, qwen = second, opencode-go = third.

### 4.2 OpenClaw openclaw.json
```diff
 "model": {
-  "primary": "xiaomi-coding/mimo-v2.5-pro",
+  "primary": "minimax/MiniMax-M3",
   "fallbacks": [
+    "xiaomi-coding/mimo-v2.5-pro",
     "bailian-token-plan/deepseek-v4-pro",
     "bailian-token-plan/glm-5.2",
+    "bailian-token-plan/kimi-k2.7-code"
   ]
 }
```

OpenClaw now: minimax primary, mimo first fallback, deepseek → glm → kimi as tertiary.

### 4.3 OpenClaw skill symlinks (fixed)
- minimax-cli.md → `/root/HERMES/skills/minimax-cli/SKILL.md` ✅ (was wrong, now fixed)
- forge-opencode-spawn.md → `/root/.agents/skills/forge-opencode-spawn/SKILL.md` ✅ (newly added)
- opencode-acp.md → ❌ CANNOT LINK (skill doesn't exist)
- opencode.md → ❌ CANNOT LINK (skill doesn't exist)

OpenClaw currently has 2 working skills. 2 missing per Hermes claim.

### 4.4 OpenCode (this session)
- opencode.json: model = minimax/MiniMax-M3 ✅ (updated earlier this conversation)
- small_model = minimax/MiniMax-M2.7-highspeed ✅
- enabled_providers: minimax first, mimo second, qwen-token REMOVED (paused), all others KEPT ✅
- forge agent model: minimax/M3 ✅
- planner agent model: minimax/M3 ✅
- auditor agent model: minimax/M3 (already was)
- ops agent model: minimax/M2.7-HS (already was)
- text-to-image agent model: mimo (kept — uses curl + DashScope API anyway)

---

## 5. Gateway Restart Verdict

**Question:** "Gateway restart untuk apply?"

**Answer:** **No gateway restart needed for skill/model changes.** Here's why:

| Change type | Needs restart? | Of what? |
|---|---|---|
| Hermes model swap (mimo → minimax) | Yes — Hermes process | Hermes itself, not 1mcp/a-forge-mcp |
| OpenClaw model swap (kimi → minimax) | Yes — OpenClaw process | OpenClaw itself, not 1mcp/a-forge-mcp |
| OpenCode model swap (already done this turn) | Yes — OpenCode process | OpenCode itself (when this session ends) |
| Skill symlinks in OpenClaw | Yes — OpenClaw process | OpenClaw itself |
| opencode.json MCP section | **No** — gateway already loaded (1mcp started 05:22 after config mtime 05:19) | n/a |
| a-forge-mcp.service | **Optional** — older (Jul 05 13:42), could refresh | a-forge-mcp itself |

**Summary:** 1mcp gateway does NOT need restart. a-forge-mcp is stable but older. The agents themselves (Hermes, OpenClaw, OpenCode) need their own restarts to load new config — but that's their decision, not gateway.

**For this OpenCode session:** I'm still running on the OLD model (mimo at session start). The new config will take effect on NEXT OpenCode session. When Arif restarts OpenCode in Termux, new session = minimax/M3 primary.

---

## 6. The OpenClaw Update Status — Honest Report

**Question:** "is my openclaw updated as well?"

**Answer:** Partially. Yes:
- ✅ Model config updated (minimax primary, mimo first fallback)
- ✅ minimax-cli symlink fixed (correct path)
- ✅ forge-opencode-spawn symlinked
- ❌ opencode-acp symlink CANNOT be created (skill doesn't exist on disk)
- ❌ opencode symlink CANNOT be created (skill doesn't exist on disk)

**To complete OpenClaw update:** Either:
1. **Forge the missing 2 skills now** (forge-opencode-spawn-style: write SKILL.md, link)
2. **Hermes must actually create them** (claim → reality)
3. **Drop them from OpenClaw** (acknowledge Hermes claim was aspirational, remove from registry)

For zen, **option 3** is the cleanest — don't symlink skills that don't exist.

---

## 7. F1-F13 Compliance on This Audit

| Floor | Compliance |
|---|---|
| F1 AMANAH | Backups: Hermes config has no .bak; OpenClaw config was already named `.last-good` (existing backup pattern); opencode.json has .bak-20260706 |
| F2 TRUTH | Caught claim-vs-reality (Hermes said 4 skills, 2 don't exist). Reported honestly. |
| F4 CLARITY | Reduced confusion between /root/.hermes/ and /root/HERMES/. Fixed 1 wrong symlink. |
| F7 HUMILITY | Did NOT create skill content for opencode-acp / opencode — that's Hermes's job. Did NOT restart agents — that's Arif's call. |
| F9 ANTI-HANTU | No claims about what skills DO. Just report file existence. |
| F11 AUDIT | This receipt + sealed audit trail in forge_work/2026-07-06/ |
| F13 SOVEREIGN | One question at end. Did not forge skill content without explicit ack. |

---

## 8. One ask (single, max)

The 2 missing skills (opencode-acp, opencode) — three options:

(a) **I forge them now** — minimal SKILL.md stubs that say "stub — Hermes to fill content". Quick but half-truth.

(b) **You tell Hermes to actually create them** — fixes at source. Slower but truthful.

(c) **Drop them from OpenClaw registry** — clean state, no broken symlinks. Most zen.

Which one? Or you want me to leave as-is and let Hermes fix at her own pace?

---

## 9. CORRECTION — 2026-07-06T05:42Z (F2 TRUTH self-correction)

**Per Arif's reality check, initial audit was WRONG on one key claim.**

### What I claimed

> ❌ "opencode-acp and opencode DON'T EXIST on disk"

### Reality (Arif-corrected)

> ✅ **All 4 skills exist on disk:**
> - `opencode-acp` — at `/root/HERMES/skills/autonomous-ai-agents/opencode-acp/`
> - `opencode` — at `/root/HERMES/skills/autonomous-ai-agents/opencode/`
> - `minimax-cli` — at `/root/HERMES/skills/minimax-cli/`
> - `forge-opencode-spawn` — at `/root/.agents/skills/forge-opencode-spawn/`
>
> ✅ `/root/.hermes/skills/` is a **SYMLINK to** `/root/HERMES/skills/` — same inode. I treated them as separate paths and confused myself.

### What was actually broken (and now fixed)

- ❌ OpenClaw skills dir: 2/4 symlinks → ✅ **4/4 symlinks** (Arif fixed)
- ❌ Claude skills dir: 1/4 symlinks → ✅ **4/4 symlinks** (Arif fixed)
- ✅ All symlinks point to canonical `/root/HERMES/skills/`

### My mistake — root cause

I ran `ls /root/.openclaw/skills/` and saw only 2 entries. I concluded "missing 2 skills don't exist on disk". The truth was: those 2 missing skills **existed at canonical source** but had **never been symlinked** to OpenClaw/Claude. I confused "not symlinked at path X" with "not present on disk".

### Lesson (binding for future audits)

> **ALWAYS check canonical source before declaring absence.**
> "Not present at path X" ≠ "not present on disk".
> The audit's USEFUL catch was the missing symlinks (real defect).
> The audit's WRONG claim was the "doesn't exist" framing.

### Floor alignment

- **F2 TRUTH violation** logged — claim without canonical-source check.
- **F7 HUMILITY** applied — accepted correction without defensiveness.
- **F11 AUDIT** upheld — this correction is now part of the receipt.

### Status after correction

| Item | Status |
|---|---|
| Skills on disk | 4/4 ✅ (always were) |
| OpenClaw symlinks | 4/4 ✅ (Arif fixed) |
| Claude symlinks | 4/4 ✅ (Arif fixed) |
| Hermes seal accuracy | "Created in Hermes" ✅ — "auto-symlinked everywhere" ❌ missed linking step |
| This audit | corrected |

The audit's SIGNAL was right (something was missing). The DIAGNOSIS was wrong (framed as "skills don't exist" instead of "symlinks missing"). Final reality: **skills created, symlinks not auto-propagated. skill_manage creates in Hermes; doesn't auto-symlink to OpenClaw/Claude.**

---

*Sealed by forge-000 at 2026-07-06T05:42Z (correction) under F13 directive.*
*Heritage: Hermes seal 2026-07-06T05:32Z, original audit 2026-07-06T05:35Z, Arif correction 2026-07-06T05:42Z.*
*DITEMPA BUKAN DIBERI — Truth forged, mistakes admitted, audit closed.*