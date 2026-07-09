# F3 Live Pulse Receipt — 2026-07-09

**Score: 3/3 PASS**

| Agent | session_id | identity_propagated | bridge | IRR sample |
|-------|------------|---------------------|--------|------------|
| hermes | `SEAL-f0c2d4b69afc438d` | yes | OK | 0.218623 |
| openclaw | `SEAL-68874e9672594bd5` | yes | OK | 0.218623 |
| grok-build | `SEAL-87208054f7e0474b` | yes | OK | 0.218623 |

Each: signed `arif_init` → `arif_route` → `wealth_compute_irr` (cash_flows sample).

**Honest tier:** still OBSERVED (pulse_count +1). TRUSTED needs longer clean history per onboarding protocol.

**Still not auto-SEAL:** Constitutional SEAL still needs F13 path; this is operational F3 MCP pulse, not Telegram human witness for Hermes.
