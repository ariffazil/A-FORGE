# External Witness Pending (F3)

## Status

| Agent | Card+Key | Commission | Authority cap | F3 external witness |
|-------|----------|------------|---------------|---------------------|
| hermes-asi | yes | COMMISSIONED | EXECUTE_APPROVED | **PENDING** Telegram first live check-in |
| openclaw / 333-AGI | yes | COMMISSIONED | EXECUTE_APPROVED | **PENDING** channel/A2A check-in |
| grok-build | card only | CARD_ONLY | OBSERVE_ONLY | n/a until PEM |

## Rule

- EXECUTE_APPROVED: operate, mutate under lease after handshake
- Autonomous Constitutional SEAL: blocked until W³ external leg present
- First live message on sovereign channel = external witness candidate (must still pass kernel F3, not auto-seal by chat alone)

## Complete third leg

1. Hermes: message via @ASI_arifos_bot / sovereign Telegram topic
2. OpenClaw: live A-FORGE MCP / A2A observe tool under signed session
3. Kernel records external witness type HUMAN or EARTH/channel attestation
4. Only then SEAL path may clear F3 for that session (still F13 for irreversible)

## Executable checklist

→ **`/root/A-FORGE/forge_work/2026-07-09/F3-WITNESS-CHECKLIST.md`**  
→ Prep sessions: `python3 /root/A-FORGE/scripts/identity/f3-witness-prep.py`  
→ Live sessions JSON: `F3-WITNESS-SESSIONS.json`
