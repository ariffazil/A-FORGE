# Spend-Mandate Sandbox — Handoff Packet to Executor (OpenClaw)

Prepared by HERMES, 2026-10-16 MYT. Read-only proof-of-concept complete.
This packet is for the EXECUTOR lane (OpenClaw / A-FORGE) to commit + seal
into a canonical repo, per custody split (HERMES does not commit/seal).

## What was built (and where)
- `/root/.hermes/cache/scratch/spend-mandate-sandbox/`
  - `spend_mandate_schema.json` — JSON schema for a bounded spend mandate
    (principal, agent, purpose, merchant_allowlist, currency, total_cap_minor,
    per_action_cap_minor, expiry_epoch, revocation_version, status).
  - `governed_spend.py` — deterministic SpendExecutor + Ledger (reserve-before-
    settle, idempotent payment_hash, fail-closed on every path).
  - `fake_provider.py` — simulated provider (quote/settle/timeout).
  - `governed_spend_adapter.py` — bridges executor to arif_judge + capital_ledger.
  - `test_acceptance.py` — 18 adversarial cases.

## Proof
- `python3 test_acceptance.py` → 18 pass, 0 fail.
- Live `arif_judge` probed → verdict HOLD (actor_not_verified), wiring works.
- Live `capital_ledger` probed → SESSION_REQUIRED (WEALTH has its own session
  gate; token does not cross from arifOS).

## Findings (gap report — grep-verified, not speculation)
EXISTS:
- WEALTH `capital_ledger` already has idempotency (payment_hash double-belt,
  P6 2026-09-22) + 888 gate (ack_irreversible) + double-entry ledger.
- arifOS has budget primitives (AAA-GOV-BUDGET-v1.json, budget_enforcement.py)
  for token/entropy/retry/side-effect budgets — NOT money.

MISSING (the actual glue):
1. No spend-mandate schema (bounded money authority).
2. No reserve/cap enforcement against concurrent requests.
3. No purchase lifecycle (proposed→authorized→submitted→settled→failed→disputed).
4. No payment rail in A-FORGE (gmail/drive/github/telegram/voice bridges exist;
   zero payment bridge).

## Identity blocker (for the executor to resolve)
- HERMES Ed25519 key verified present + matches (hermes_public.pem ↔
  hermes_private.pem, /root/AAA/IDENTITY/keys/).
- But `arif_challenge` is NOT exposed on the public MCP facade (only 8 verbs:
  arif_init/observe/think/route/memory/judge/forge/seal). Challenge nonce
  cannot be issued from outside the kernel process.
- Signing lane :18900 (aaa-signing.service) is up, signs with the SOVEREIGN
  key, CORS-restricted to AAA origins, PAM transitional.
- Result: HERMES remains OBSERVE_ONLY until an executor/signing lane issues
  a challenge + verifies the signature. Do NOT sign on HERMES's behalf with
  another actor's key (actor-id collision scar).

## Suggested executor sequence
1. Expose `arif_challenge` (or use signing lane) to issue a nonce for `hermes`.
2. Sign `hermes:{nonce}` with hermes_private.pem; submit via verify path.
3. With LIMITED_MUTATE, commit these 4 files to an isolated branch (no push).
4. Run test_acceptance.py in CI; seal the receipt.

## No readiness claim
This is a sandbox proof. No live money, no production deploy, no payment
authority. Committing it does not make it production-ready.
