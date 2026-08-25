# APA Google Bridges - ZEN-FORGED 2026-08-25

6 HTTP bridges + shared OAuth core. FFF round output.

## Bridges

| File | Port | Service | Health |
|---|---|---|---|
| calendar_bridge.py | 18094 | Calendar OAuth | AWAITING_CREDENTIALS |
| drive_bridge.py | 18099 | Drive OAuth | AWAITING_CREDENTIALS |
| sheets_bridge.py | 18096 | Sheets OAuth | AWAITING_CREDENTIALS |
| gmail_bridge.py | 18097 | Gmail OAuth readonly | AWAITING_CREDENTIALS |
| gemini_bridge.py | 18092 | Gemini AI Studio | READY 50 models |
| gws_bridge.py | 18098 | FED gws OAuth chain | OK |
| google_bridge_base.py | - | Shared OAuth core | n/a |

## Architecture

```
[forge_gemini @ :7072] --HTTP--> [gemini_bridge.py :18092]
                                          |
                                          v
                                  [bearer-style HTTP header]
                                          |
                                          v
                              [generativelanguage.googleapis.com]
```

OAuth bridges use Authorization: Bearer with auto-refresh.
Token file: /root/HERMES/google_token.json

## Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| /health | GET | Service health, mode, credentials |
| /verbs  | GET | List available action verbs |
| /{verb} | POST | Execute verb with {verb, params} body |

All responses are APA envelope:
```json
{"ok": true/false, "connector": "...", "verb": "...",
 "verdict": "PROCEED|HOLD", "result": ..., "error": ...,
 "receipt": {"receipt_id": "...", "timestamp": "..."}}
```

## Testing

```bash
/root/venv/bin/pytest /root/A-FORGE/tests/test_google_bridges.py -v
curl -s http://127.0.0.1:18092/health
```

## Known limitations

- Stateless HTTP cannot invoke forge_gemini (STATELESS_WHITELIST gate)
- OAuth refresh tokens expired (calendar invalid_grant since 17:25 UTC)
- F1 AMANAH filter blocks commands matching credential regex

DITEMPA BUKAN DIBERI
