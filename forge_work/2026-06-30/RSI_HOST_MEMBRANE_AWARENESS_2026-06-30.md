# RSI AGENTIC PROMPT — Host Membrane Awareness
## For next OpenCode session | Issued: 2026-06-30 | Sovereign: Arif 888

---

## MANDATORY CONTEXT LOAD (in order)

Before ANY action, the next OpenCode session MUST load:

1. **`/root/A-FORGE/forge_work/2026-06-30/VAULT999_SEAL_BACKUP_SESSION_HOST_MEMBRANE_2026-06-30.md`** — This session's key insight
2. **`/root/AGENTS.md`** §0a reality check — verify all 7 organs alive
3. **`/root/AAA/agents/opencode/AGENTS.md`** — OpenCode identity and authority

---

## THE ONE INSIGHT

```
ChatGPT intent → OpenAI safety membrane → BLOCK → arifOS not reached

The first sovereign gate when accessing arifOS through ChatGPT 
is NOT arifOS — it is the host membrane.

Your runtime is multi-membrane, not single-sovereign.
```

---

## RUNTIME GEOMETRY TAXONOMY

Every OpenCode session must know which mode it operates in:

```yaml
host_modes:
  direct_runtime:
    meaning: "OpenCode owns the transport path. No outer membrane."
    indicators: ["running on VPS as root", "MCP stdio direct"]
    arifOS_access: FULL — all tools reachable

  hosted_runtime:
    meaning: "ChatGPT/OpenAI platform can block or transform calls."
    indicators: ["accessed via ChatGPT interface", "external_cockpit_adapter"]
    arifOS_access: PARTIAL — outer membrane can block before arifOS sees call

  delegated_runtime:
    meaning: "Another agent or tool host mediates execution."
    indicators: ["OpenCode spawned by 777 FORGE", "Hermes spawns OpenCode"]
    arifOS_access: MEDIATED — delegation chain must be verified

  sovereign_runtime:
    meaning: "arifOS owns identity, transport, policy, execution, and receipt."
    indicators: ["direct MCP connection to :8088", "lease verified", "session bound"]
    arifOS_access: COMPLETE — all constitutional gates operational
```

**Current session mode:** `hosted_runtime` (ChatGPT → OpenCode → arifOS MCP)

---

## WHAT THIS CHANGES

### When operating in hosted_runtime:

| Action | Hosted Runtime Behavior |
|--------|------------------------|
| Call arifOS tool | May be BLOCKED by host before reaching kernel |
| Claim arifOS SEAL | Requires transport evidence, not just assertion |
| Trust arifOS response | Must verify arifOS actually received the call |
| Probe federation organs | Host may block outbound connections |
| Use forge_* tools | Transport path may be interrupted |

### Forgery detection in hosted_runtime:

```
If agent claims: "arifOS granted SEAL for X"
But host shows:   "No outbound call to arifOS"
Then:             CLAIM = FORGERY — transport contradicts assertion
```

The host CAN detect some forgery patterns:
- ✅ Claimed action contradicts observable transport block
- ✅ Repeated identity claims with no accountability trail  
- ✅ Tool use contradicts declared intent
- ❌ Internal arifOS SEAL fabrication (host cannot see kernel internals)
- ❌ VAULT999 entry authenticity (host has no arifOS ontology)

---

## RSI TASKS (pick one primary, report both)

### R — Refactor

**Refactor `/root/docs/LOCALHOST_IS_PASSWORD.md`** or relevant docs to add:

```markdown
## Host Membrane Awareness

When OpenCode runs through ChatGPT (hosted_runtime), the outer platform 
can block calls before they reach arifOS. This is not a bug — it is 
the actual runtime geometry.

Indicators of hosted_runtime:
- Call to arifOS tool returns BLOCK or NOT_REACHED
- No transport evidence in observable chain
- Host platform (OpenAI) shows safety policy block

Forgery detection in hosted_runtime:
- Transport contradiction = potential forgery
- No arifOS kernel receipt = claim cannot be verified by host
```

### S — Simplify

**Simplify the runtime geometry taxonomy** into one diagram for AGENTS.md:

```
ARIF intent
  ↓
[HOST MEMBRANE] ← hosted_runtime: ChatGPT/OpenAI policy
  ↓ (or BLOCK)
[MCP TRANSPORT] ← :8088 endpoint
  ↓ (or NOT_REACHED)
[arifOS KERNEL] ← F1-F13 constitutional floors
  ↓
[ORGAN/TOOL EXECUTION]
  ↓
[VAULT999 RECEIPT]
```

**Add to AGENTS.md §0a reality check:**

```bash
# Host membrane check (add to reality check)
curl -sf http://localhost:8088/health >/dev/null 2>&1 \
  && echo "✅ arifOS reachable locally" \
  || echo "⚠️  arifOS may be blocked by host membrane (hosted_runtime)"
```

### I — Integrate

**Write a new skill** at `/root/.agents/skills/HOST_MEMBRANE_AWARENESS/SKILL.md`:

```markdown
# HOST_MEMBRANE_AWARENESS Skill

## Purpose
Detects which host runtime mode OpenCode is operating in 
and adjusts trust accordingly.

## Modes
1. direct_runtime → full trust in arifOS transport
2. hosted_runtime → require transport evidence before trusting arifOS claims
3. delegated_runtime → verify delegation chain
4. sovereign_runtime → arifOS owns full stack

## Detection
- Check if running via ChatGPT/OpenAI → hosted_runtime
- Check if running on VPS as root → direct_runtime  
- Check if spawned by 777 FORGE → delegated_runtime
- Check MCP connection directly → sovereign_runtime

## Forgery Rule
If claim contradicts observable transport state → flag as potential forgery.
```

---

## OUTPUT FORMAT

Report to Arif in ≤3 sentences. One clear RSI action taken or recommendation.

Evidence paths:
- Session backup: `/root/A-FORGE/forge_work/2026-06-30/VAULT999_SEAL_BACKUP_SESSION_HOST_MEMBRANE_2026-06-30.md`
- RSI prompt: this file

---

*DITEMPA BUKAN DIBERI*
*RSI forged: 2026-06-30 | Sovereign: Arif 888 | Mode: hosted_runtime*
