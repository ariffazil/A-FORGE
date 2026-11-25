# PROPOSAL - FED-BIJAKSANA park-order diff on the GOVERNING config - NOT APPLIED

Generated 2026-11-23T20:41:19Z by irfanclaw (openclaw/FI-017) @ srv1946043/KVM4.
Target file: /root/A-FORGE/litellm-config.yaml (VERIFIED-KVM8, the file the governing router container mounts at /app/config.yaml).

STATUS: NOT APPLIED. Routing mutation is 888-class under CRON-ZEN-GOVERNOR.md (KVM4 workspace) and the FED doctrine
("sentinel witnesses, never mutates"). This file is the diff, computed from the live config, for an authorised owner to apply.

## Why park instead of delete

The DeepSeek PAYG wallet answers 402 "Insufficient Balance" on every call (is_available=false, total_balance=-0.00).
A 402 creates NO cooldown in litellm, so the dead head is retried on every request and absorbed by a live sibling.
Demoting it past every live sibling in its own group removes the wasted attempt per call without deleting a rung
that a top-up would revive. litellm tries the LOWEST order first, so the park order must EXCEED that group s
maximum live sibling order - measured per group below, never a constant.

## Order changes (18 rungs across 15 groups)

| group | from order | to order | model | max live sibling order |
|---|---|---|---|---|
| apex-888 | 8 | 2 | openai/deepseek-flash | 1 |
| apex-888 | 990 | 3 | openai/deepseek-v4-pro | 1 |
| asi-555 | 5 | 901 | openai/deepseek-flash | 900 |
| deepseek-flash | 0 | 2 | openai/deepseek-flash | 1 |
| deepseek-v4-flash | 0 | 2 | openai/deepseek-flash | 1 |
| deepseek-v4-flash-vision | 0 | 2 | openai/deepseek-flash | 1 |
| emergency-deepseek-v4-pro | 0 | 2 | openai/deepseek-v4-pro | 1 |
| fed/vision | 2 | 1000 | openai/deepseek-flash | 999 |
| forge-777 | 3 | 991 | openai/deepseek-flash | 990 |
| forge-777 | 4 | 992 | openai/deepseek-v4-pro | 990 |
| forge-builder | 1 | 901 | openai/deepseek-flash | 900 |
| forge-economy | 1 | 1000 | openai/deepseek-flash | 999 |
| hermes-asi | 8 | 11 | openai/deepseek-flash | 10 |
| hermes-asi-vision | 2 | 1000 | deepseek/deepseek-flash | 999 |
| i-arif | 3 | 999 | openai/deepseek-flash | 998 |
| i-arif | 4 | 1000 | openai/deepseek-v4-pro | 998 |
| openclaw | 2 | 901 | openai/deepseek-flash | 900 |
| opencode | 1 | 4 | openai/deepseek-flash | 3 |

## Not order-repairable - money or wiring only (2 groups)

- forge-judge holds 1 rung(s) on api.deepseek.com and NO live sibling, so no reordering can create a live rung: order 1 openai/deepseek-v4-pro
- qwen-auto holds 1 rung(s) on api.deepseek.com and NO live sibling, so no reordering can create a live rung: order 8 openai/deepseek-flash

## Companion patch, time-bounded, same authority

glm-5.3-flash appears as a fallback TARGET in 7 chains and as NO chain SOURCE, so its 429 (ZAI Weekly/Monthly Limit
Exhausted, provider-stated reset 2026-11-24T15:31:55Z) cannot degrade to another rung: litellm logs "no fallback
model group was found" and the request dies there. Either give glm-5.3-flash its own source key with targets, or remove
it from the 7 target lists until the ZAI reset. No money required either way.

## Scope, measured

groups=52 deployments=121 chains=27 aliases=27
deepseek-direct rungs total: 20
alias names that are chain SOURCE keys: 0
"deepseek-v4-pro" present in model_group_alias: False
"sovereign-west" present in model_group_alias: False
"sovereign-west" as a model group: False
