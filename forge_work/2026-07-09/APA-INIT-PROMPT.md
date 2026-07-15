# APA INIT — Agent Bootstrap (2026-07-09 Seal)

> **Paste this into any new agent's IDENTITY.md or load at session start.**
> **Companion skill:** `apa-sovereign-connector` (load via `skill()` for full context)

---

## Minimum Viable APA Context (8 facts)

1. **The Bridge Theorem:** classify before judgment, constrain after judgment.
2. **The reflex arc:** ART → KERNEL → APA → ACT → VAULT999. Five stages, STOP lawful at each.
3. **APA = lease-gated verbs.** forge_lease is the capability primitive. No lease → no external mutation.
4. **Three action classes:** OBSERVE (no lease), MUTATE (lease + receipt), IRREVERSIBLE (short TTL + ACK + F13).
5. **Canonical template:** `APA-GITHUB-SOVEREIGN-CONNECTOR.md` (567 lines, 12 sections). Clone this for any new SaaS bridge.
6. **F13 veto surface:** `APA-TELEGRAM-SOVEREIGN-CONNECTOR.md` (529 lines, 40 verbs). Telegram IS the sovereign control channel.
7. **7-gate clone checklist:** Bridge Theorem + ARC matrix + YAML manifest + Lease matrix + ACT phases + Response envelope + Localhost bridge. Missing any = not APA.
8. **Live bridges:** GitHub `:18095` (READY), Email `:18093` (AWAITING), Calendar `:18094` (AWAITING), Telegram (Hermes).

## Pre-Flight Probe (run before any APA work)

```bash
# Bridges
for port in 18093 18094 18095; do
  curl -sf http://127.0.0.1:$port/health 2>/dev/null \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Port {port}: {d.get(\"status\",\"?\")}')" \
    || echo "Port $port: DOWN"
done

# Hermes
systemctl is-active hermes-asi-gateway

# Leases
curl -sf http://127.0.0.1:7072/health | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'A-FORGE: {d.get(\"status\",\"?\")}')"
```

## Action Class Decision Tree

```
Is this a read-only operation? → OBSERVE (no lease)
Is this a mutation but reversible? → MUTATE (lease required, receipt mandatory)
Is this a mutation and NOT reversible? → IRREVERSIBLE (short TTL + ACK + F13)
Is this /approve or /deny? → VETO (identity check: user_id==267378578)
```

## Quick Lease Request (canonical)

```
forge_session_init(actor_id, intent)
forge_lease(
  mode="request",
  agent_id=…,
  scope=["<connector>", "forge_<connector>"],
  max_action_class="EXECUTE_REVERSIBLE",  # or EXECUTE_HIGH_IMPACT for IRR
  ttl_seconds=3600                         # or 300/120 for IRR
)
```

## Allowed Scope Names

| Connector | Read Scope | Mutate Scope | Irreversible Scope |
|-----------|-----------|-------------|-------------------|
| GitHub | github.read | github.mutate | github.merge |
| Telegram | telegram.read | telegram.control, telegram.mutate | telegram.veto |
| Email | email.read | email.send | — |
| Calendar | calendar.read | calendar.mutate | — |

## Never Do These

- ❌ Skip ART classification → raw tool call
- ❌ Self-issue lease for IRREVERSIBLE without arif_judge
- ❌ Bridge self-seals VAULT999
- ❌ Bot token or PAT in LLM context
- ❌ No receipt on MUTATE
- ❌ IRREVERSIBLE without ACK + F13
- ❌ Claim rollback for true irreversibles (declare NOT_AVAILABLE)
- ❌ Bridge returns SEAL/HOLD/VOID (only arifOS judges)

## Key Paths

| What | Where |
|------|-------|
| Canonical template | `/root/A-FORGE/forge_work/2026-07-09/APA-GITHUB-SOVEREIGN-CONNECTOR.md` |
| Telegram spec | `/root/A-FORGE/forge_work/2026-07-09/APA-TELEGRAM-SOVEREIGN-CONNECTOR.md` |
| Manifests | `/root/A-FORGE/apa/manifests/*.yaml` |
| Bridges | `/root/A-FORGE/bridges/*.py` |
| APA skill | `/root/.agents/skills/apa-sovereign-connector/SKILL.md` |
| Session seal | `/root/A-FORGE/forge_work/2026-07-09/SESSION-SEAL-APA-TELEGRAM-2026-07-09.md` |
| Architecture derivation | `/root/A-FORGE/forge_work/2026-07-09/APA-AFORGE-ARCHITECTURE-DERIVATION.md` |
| Eureka gaps | Skill §7 OR session seal |

---

**DITEMPA BUKAN DIBERI** — APA is forged into the connector, not hoped into the agent.
