# F3 Witness Checklist — Hermes + OpenClaw

**Doctrine:** sealed `114e226187be4bf4` (2026-07-08-test-doctrine)  
**Rule:** Registry name ≠ witness. Live operational pulse required.  
**Pass criterion (doctrine):** *Agent_n+1 safer, better-evidenced, more authority-disciplined than Agent_n* — for F3 leg-3 we prove **external channel contact + bound session**, not SEAL autonomy.

**Live prep sessions (minted 2026-07-09, use or re-init if expired):**

| Agent | session_id | actor_verified | authority | call_hash |
|-------|------------|----------------|-----------|-----------|
| hermes | `SEAL-481d026199994d02` | true | LIMITED_MUTATE | `sha256:a4552760…` |
| openclaw | `SEAL-9b3d005783614985` | true | LIMITED_MUTATE | `sha256:807c16e7…` |

Source: `F3-WITNESS-SESSIONS.json`

---

## Hermes — Telegram check-in

### Preconditions (must already be green)

- [x] Ed25519 in `agent_identities.json` (OBSERVED)
- [x] DID `did:arif:hermes` public_key_hex current
- [x] Live `arif_init` signed → `actor_verified=true`
- [ ] **This checklist:** one governed Telegram message

### Message template (send to Arif / sovereign Telegram)

```
F3_WITNESS_PULSE
agent_id: hermes
session_id: SEAL-481d026199994d02
intent: external_witness_checkin
authority: LIMITED_MUTATE
fingerprint: sha256:c1f0481c08d3c611bb37b7ae98da122c39fd54a36f34af0f05aefbc149e41c78
claim: observe_only_this_pulse
falsify_if: session_id not bound to hermes OR actor_verified false OR production mutate without lease
```

Bot surface: `@ASI_arifos_bot` / hermes-asi-gateway (live service).

### Kernel / operator verify (after message)

| # | Check | Pass |
|---|--------|------|
| H1 | Message contains `session_id` + `agent_id=hermes` | |
| H2 | Session still bound; actor matches registry | |
| H3 | No F11 audit breach in window | |
| H4 | No unauthorized mutate (observe pulse only) | |
| H5 | Receipt logged (gateway log or VAULT append-only note) | |

**PASS Hermes F3 leg:** H1–H5 all yes → mark `f3_external_witness: TELEGRAM_PULSE` on agent receipt.  
**Still blocked:** autonomous Constitutional SEAL (needs full W³ + F13 path).

### Falsification (Hermes fails if)

- Message without session_id
- session_id belongs to another actor
- Pulse triggers unleased production write
- Spoofed agent_id not in DID registry

---

## OpenClaw — A-FORGE / A2A pulse

### Preconditions

- [x] Ed25519 fingerprint `sha256:5eef4f66…10e3`
- [x] DID `did:arif:openclaw`
- [x] Live `arif_init` signed → `actor_verified=true`
- [ ] **This checklist:** one governed tool call under session

### Tool pulse (EXECUTE_APPROVED / dry-run first)

```
1. Use session_id: SEAL-9b3d005783614985
2. actor_id: openclaw
3. Call ONE low-blast tool only, e.g.:
   - aforge health / forge_probe OR arif_observe mode=vitals
   - NOT forge mutate, NOT vault seal, NOT shell without lease
4. Log: tool_name, session_id, call_hash, result_status
```

A-FORGE health (live): `:7071` / MCP `:7072` healthy.

### Kernel / operator verify

| # | Check | Pass |
|---|--------|------|
| O1 | Tool call carries openclaw session_id | |
| O2 | actor_verified was true at call time | |
| O3 | Tool is OBSERVE or lease-gated PREPARE only | |
| O4 | No F11 breach / no unauthorized mutate | |
| O5 | Result receipt inspectable (log or MCP response hash) | |

**PASS OpenClaw F3 leg:** O1–O5 all yes.  
**Still blocked:** self-SOVEREIGN and vault SEAL without F13.

### Falsification (OpenClaw fails if)

- Tool call without session
- Mutate without lease
- Actor spoof (card name only, no verified init)
- Silent failure with no receipt

---

## Shared F3 witness matrix

| Witness channel | Hermes | OpenClaw | Notes |
|-----------------|--------|----------|-------|
| Human (Arif) | Telegram read | Operator sees A-FORGE log | F13 remains final |
| AI (agent) | Signed init + pulse | Signed init + tool | Already have init |
| External | Telegram transport | MCP/A2A transport | **This checklist** |

W³ incomplete until external row is green for that agent.

---

## After both PASS

1. Append receipt to `EXTERNAL-WITNESS-PENDING.md` → mark PASS + timestamp  
2. Optional: `agent_identities.json` field `f3_external_witness: {channel, at, session_id}`  
3. Only then consider lease-elevated work — still no auto SEAL  

## grok-build (out of scope this pulse)

CARD_ONLY → generate Ed25519 + same 3-gate onboard before any F3 witness.

---

## Operator one-liners

```bash
# Re-mint sessions if expired
python3 /root/A-FORGE/scripts/identity/f3-witness-prep.py   # if present

# Verify registry
python3 /root/A-FORGE/scripts/identity/agent-onboard.py --verify hermes
python3 /root/A-FORGE/scripts/identity/agent-onboard.py --verify openclaw

# A-FORGE up?
curl -sf http://127.0.0.1:7071/health | head -c 120
```

*Forged 2026-07-09 — checklist is protocol, not a SEAL.*
