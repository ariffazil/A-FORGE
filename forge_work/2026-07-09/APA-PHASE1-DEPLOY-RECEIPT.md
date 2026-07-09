# APA Phase 1 Deploy Receipt — 2026-07-09

## What shipped this turn

| Artifact | Path | Status |
|----------|------|--------|
| Email bridge | `/root/A-FORGE/scripts/email_bridge.py` | LIVE service |
| Calendar bridge (full verbs) | `/root/A-FORGE/scripts/calendar_bridge.py` | LIVE — +update_event, +quick_add |
| email-bridge.service | `/etc/systemd/system/email-bridge.service` | enabled |
| calendar-bridge.service | `/etc/systemd/system/calendar-bridge.service` | enabled |
| Cred paths | `/root/.secrets/email/gmail.json`, `…/calendar/google.json` | present (do not log values) |
| APA-GitHub connector | `forge_work/2026-07-09/APA-GITHUB-SOVEREIGN-CONNECTOR.md` | SPEC + live forge_github path |
| Competitive map | `forge_work/2026-07-09/RESEARCH-COMPOSIO-APA-COMPETITIVE-MAP.md` | prior |

## Health (T1)

- `GET :18093/health` → email_bridge `apa_version=1.0`
- `GET :18094/health` → calendar_bridge verbs include list/get/create/update/delete/find_free_slots/quick_add

## Sovereignty geometry (ratified narrative)

Only APA owns **protocol + session + audit + override + exit**.  
Nango/Arcade/Peta are cousins (engineering / MCP auth / vault) — not constitutional peers.

## Still open

1. Human fills/rotates App Password if template — agents must not request paste in chat.  
2. Optional: wire `forge_email` / `forge_calendar` MCP tools in A-FORGE core as HTTP proxies to bridges.  
3. MUTATE smoke only after lease + dry-run.

## Sequence remaining

Secrets green → OBSERVE smoke → MCP proxy tools → APA-Slack/Drive later.
