<!-- SOT-MANIFEST
owner: Arif
forged: 2026-06-28
valid_from: 2026-06-28
valid_until: 2026-07-07
confidence: high
scope: federation-wide
epistemic_status: MASTER_INIT_PROMPT — load FIRST in next session
load_order: 0 of 4 (before P0/P1/P2)
doctrine: DITEMPA BUKAN DIBERI
-->

# INIT PROMPT — Next Session Bootstrap

> **THIS IS THE MASTER BOOTSTRAP for the next OpenCode session.**
> **Load this FIRST. It points to all task-specific init prompts.**
> **The federation is currently OBSERVE + ROUTE only. The goal is REASON + JUDGE + ACT.**

---

## Bootstrap Sequence (Load Order)

| Step | What | File |
|------|------|------|
| 1 | Federation constitution | `/root/AGENTS.md` |
| 2 | Live machine state | `/root/CONTEXT.md` |
| 3 | **This master bootstrap** | `INIT-PROMPT-NEXT-SESSION.md` (this file) |
| 4 | P0 Critical Fixes | `INIT-PROMPT-P0-CRITICAL-FIXES.md` |
| 5 | P1 Cleanup & Bridge | `INIT-PROMPT-P1-CLEANUP.md` |
| 6 | P2 Hardening | `INIT-PROMPT-P2-HARDENING.md` |

**All init prompts at:** `/root/A-FORGE/forge_work/2026-06-28/`

---

## Federation State (At Session Start)

```
6/6 organs alive ✅
arifOS :8088  — constitution valid, authority matrix intact, 888_HOLD fires
A-FORGE :7071 — build/deploy functional
AAA :3001     — control plane alive, NOT on MCP bridge
GEOX :8081    — 30 canonical tools, 31 phantom tools (P1-A)
WEALTH :18082 — 24/28 tools callable, 4-tool gap (P1-B)
WELL :18083   — 23 tools, identity_valid=False (P1-D)
VAULT999      — WinError 10061, unreachable (P0-D)

actor_verified=False  → session authority: OBSERVE_ONLY
arif_think: LLM_UNAVAILABLE → cannot REASON
hermes_vault_query: returns nothing → vault_replay fails
```

---

## Prioritized Task Queue

### P0 — BLOCKING (Do These First)

| ID | Task | Time | Impact |
|----|------|------|--------|
| P0-A | Fix claude.ai connector → mcp.arif-fazil.com/mcp | 30 min | Unblocks actor_verified=True |
| P0-C | Wire Azure OpenAI into arif_think hot path | 45 min | Unblocks REASON stage |
| P0-B | Fix hermes_vault_query outputSchema | 20 min | Unblocks vault_replay |
| P0-D | Bring VAULT999 up (Windows) | 15 min | Unblocks cooling_ledger (requires Arif) |

### P1 — HIGH (Clean Surface After P0)

| ID | Task | Time | Impact |
|----|------|------|--------|
| P1-A | Delete 31 phantom GEOX tools | 15 min | Clean canonical surface |
| P1-B | Fix WEALTH 4-tool gap | 20 min | Close claimed vs actual |
| P1-C | Wire AAA+A-FORGE into MCP bridge | 30 min | Complete mesh |
| P1-D | Fix WELL identity_valid=False | 20 min | ADAM gets a name |

### P2 — MEDIUM (Harden After P1)

| ID | Task | Time | Impact |
|----|------|------|--------|
| P2-A | Publish .well-known/mcp.json | 15 min | Kill topology ambiguity |
| P2-B | Wire enforcement spine into interceptor.py | 45 min | Governance as execution |
| P2-C | Populate arif_observe affordance action_class | 10 min | Authority classification |

---

## Sampah to Delete (Run After Refactor)

```
1. arifos.arif-fazil.com/mcp → redirect to mcp.arif-fazil.com/mcp (P2-A handles this)
2. 31 phantom GEOX tools → delete registrations (P1-A handles this)
3. WEALTH ghost tools (wealth_emv_risk + 3) → delete or fix (P1-B handles this)
4. WELL autonomic aliases to broken targets → P1-D
5. Ghost reference: arif_daily_intelligence_brief → delete from all docs
```

---

## Eureka Margin

**Phase change target:** P0-A + P0-C → federation crosses from OBSERVE_ONLY router → REASON + RECOMMEND agent.

**Next unsolved problem:** Cross-organ proxy-objective detector. Tri-Witness signal bus does not exist. WELL (somatic anomaly), WEALTH (entropy scorer), GEOX (physical reality anchor) — they don't talk to each other about mesa-optimization. This is the P0 for agentic safety.

---

## Session Init Command

When the next OpenCode session starts, run:
```bash
# Reality check
for svc in "arifos:8088" "aforge:7071" "aaa:3001" "geox:8081" "wealth:18082" "well:18083"; do
  curl -sf "http://localhost:${svc##*:}/health" >/dev/null && echo "✅ $svc" || echo "❌ $svc"
done

# Load init prompts
cat /root/A-FORGE/forge_work/2026-06-28/INIT-PROMPT-NEXT-SESSION.md
cat /root/A-FORGE/forge_work/2026-06-28/INIT-PROMPT-P0-CRITICAL-FIXES.md
```

---

## Evidence Expected from This Session

- [ ] P0-A: `actor_verified=True` on `arif_init`
- [ ] P0-C: `arif_think` returns reasoning with confidence > 0.5
- [ ] P0-B: `hermes_vault_query` returns valid JSON matching outputSchema
- [ ] P1-A: GEOX tool count = canonical number (no phantoms)
- [ ] P1-B: WEALTH tool count matches claimed vs actual
- [ ] P1-C: AAA and A-FORGE respond to MCP tools/list
- [ ] P1-D: WELL identity_valid=True
- [ ] P2-A: `https://mcp.arif-fazil.com/.well-known/mcp.json` returns valid JSON
- [ ] P2-B: Enforcement spine wired and tested
- [ ] P2-C: `arif_observe` action_class != UNKNOWN

---

*DITEMPA BUKAN DIBERI. The scaffold is laid. The next session picks up the forge.* 🔥⚒️
