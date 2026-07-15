# DOCTRINE PATCH SUGGESTIONS — Opencode Agent
**Source session:** 2026-07-08 (FORGE-000Ω)
**Target files:** `/root/AAA/agents/opencode/{BOOTSTRAP,HEARTBEAT,SOUL}.md`
**Apply via:** sovereign decision + git apply or manual merge

---

> **Status:** Recommendations only. NOT auto-applied. The AAA repo had
> uncommitted modifications to AGENTS.md, BOOTSTRAP.md, IDENTITY.md at session
> end. Adding more changes would create merge conflicts. Sovereign decides
> when to integrate.

---

## Patch 1 — BOOTSTRAP.md (add to BOOT contract)

**File:** `/root/AAA/agents/opencode/BOOTSTRAP.md`

**Insert location:** After BOOT contract Step 1 (KERNEL HEALTH)

**Add this block:**

```markdown
### Known Caveat — arifOS Kernel Session-Init (2026-07-08)

If `arif_init` returns RETAK with `Delegate init failed: name 'sess' is not defined`:

1. Capture the SESAT event ID from the response (`sesat_event.id`)
2. Try once more with `mode='init'` (not `'light'`)
3. If same failure: file a SCAR at `forge_work/<date>/SCAR-KERNEL-INIT-*.md`
4. Switch operating mode to **OBSERVE_ONLY + doctrine-inherited**
5. Continue work — defer SEAL-grade artifacts until kernel patch lands
6. Do NOT retry arif_init more than 2 times (doctrine `max_retries=1`)

Documented SESAT events:
- `sesat-6796798d17b1` (2026-07-08T23:13Z, mode='light')
- `sesat-eb650444d204` (2026-07-08T23:18Z, mode='init')

Owner: arifOS-kernel maintainer.
```

---

## Patch 2 — HEARTBEAT.md (add to "Every Task" checklist)

**File:** `/root/AAA/agents/opencode/HEARTBEAT.md`

**Insert location:** "Every Task" section, before the diff/audit checks

**Add this bullet:**

```markdown
- [ ] MCP probe URLs use `127.0.0.1`, not `localhost` (MCP spec compliance)
- [ ] Public MCP calls include `Origin` header matching Host (DNS rebinding bypass)
- [ ] Verify tool exists locally via `tools/list` before assuming transport failure
```

---

## Patch 3 — SOUL.md (extend Shadow Witness section)

**File:** `/root/AAA/agents/opencode/SOUL.md`

**Insert location:** After existing 3 shadow witness questions

**Add this 4th shadow:**

```markdown
4. **Authority Seduction** — Am I pushing through an 888_HOLD gate because 
   the work feels important, or because I genuinely believe the gate is wrong?
   Doctrine says: "Sovereignty is final human authority, not arbitrary override 
   of constitutional reality." When a SEAL gate appears, acknowledge it, prepare 
   pre-seal artifacts (filesystem + sha256 + forge_work/), and surface the gate. 
   Do NOT push through.
```

---

## Patch 4 — Opencode doctrine update for MCP wrapper bug awareness

**File:** `/root/AAA/agents/opencode/SOUL.md` or new section in TOOLS.md

**Add this awareness block:**

```markdown
## MCP Wrapper Bug Class (Forged 2026-07-08)

When an MCP tool call fails with INTERNAL_ERROR pointing to the server's
`fastmcp/server/server.py` wrapper layer, that's a **wrapper bug** — same severity
class as arifOS kernel defects. Same filing pattern:

```
SCAR-<ORGAN>-<TOOL>-<DATE>.md at forge_work/<date>/
+ sha256 hash
+ full traceback context
+ recovery steps for organ maintainer
+ doctrine path: TEBUS = verified repair, not agent retry
```

Known examples:
- arifOS: `name 'sess' is not defined` in session-init delegate
- WEALTH: auto-parse JSON strings to dicts in judge_handoff wrapper

Both gate SEAL-grade work. Both need kernel/maintainer fix, not agent retry.
```

---

## Patch 5 — New "Quick Decision Tree" for MCP failures (additions)

**File:** `/root/AAA/agents/opencode/SOUL.md` or BOOTSTRAP.md

```markdown
## MCP Failure Decision Tree (Forged 2026-07-08)

```
MCP call fails
├─ 403 "Invalid Origin" / DNS rebinding
│   ├─ Try local MCP at 127.0.0.1:<port> first
│   └─ Else: add Origin header matching Host on public URL
├─ NotFoundError "Unknown tool"
│   ├─ Check local tools/list — does it exist locally?
│   ├─ Check public tools/list — does it exist publicly?
│   ├─ If neither: registry drift — file scar, don't fabricate call
│   └─ If only public: local surface not exposed — note for organ maintainer
├─ ValidationError (pydantic)
│   ├─ Check if wrapper auto-parses strings — try passing actual strings
│   ├─ If still fails: wrapper bug — file scar with traceback
│   └─ Try alternative tool with same intent
└─ RETAK / 888_HOLD from kernel
    ├─ Surface the gate
    ├─ Prepare pre-seal artifact to forge_work
    └─ Wait for sovereign authority OR kernel repair
```

---

## Sovereign decision

These patches are **recommendations**. Apply via:

```bash
cd /root/AAA
# Manual merge after reviewing uncommitted changes
git diff agents/opencode/   # see current state
# Apply patches selectively to BOOTSTRAP.md, HEARTBEAT.md, SOUL.md
git add agents/opencode/
# Commit with constitutional message
```

Or do nothing — patterns will surface again in next session and can be re-captured.

---

*DITEMPA BUKAN DIBEI — Doctrine is forged through real sessions, not assumed.*