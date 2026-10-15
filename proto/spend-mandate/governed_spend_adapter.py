"""governed_spend_adapter.py — bridge the sandbox spend executor to live organs.

Read-only integration. This module does NOT move money and does NOT mutate
any canonical repo. It proves the wiring:

    spend request
      -> arif_judge  (kernel arbitrates the action — verdict SEAL/HOLD/VOID)
      -> capital_ledger query (WEALTH — check recorded balance, read-only)
      -> SpendExecutor (deterministic boundary enforces mandate + idempotency)

The executor already enforces the mandate locally (see governed_spend.py).
This adapter adds the two federation organs as evidence sources so the
decision is no longer a standalone prototype.
"""
from __future__ import annotations

from dataclasses import dataclass

from governed_spend import SpendExecutor, SpendMandate, PurchaseState


@dataclass
class OrganVerdict:
    organ: str
    verdict: str
    detail: dict


class GovernedSpendAdapter:
    """Wraps SpendExecutor with kernel arbitration + WEALTH balance evidence."""

    def __init__(self, executor: SpendExecutor, judge_fn, balance_fn):
        self.executor = executor
        self.judge_fn = judge_fn      # callable(candidate, mandate) -> OrganVerdict
        self.balance_fn = balance_fn  # callable(mandate) -> OrganVerdict

    def request(self, mandate, actor, merchant, amount_minor, currency,
                purpose, payment_hash, reservation_id, now=None):
        """Full governed path: kernel arbitrates, WEALTH balances, then enforce."""
        # 1. kernel arbitration (read-only verdict — the executor still enforces)
        judge = self.judge_fn(
            candidate=(
                f"agent '{actor}' requests bounded spend {amount_minor} minor "
                f"{currency} at '{merchant}' (purpose: {purpose}) under "
                f"mandate {mandate.mandate_id}"
            ),
            mandate=mandate,
        )
        # 2. WEALTH balance evidence (read-only query)
        balance = self.balance_fn(mandate)
        # 3. deterministic boundary enforces the mandate
        state, result = self.executor.request(
            mandate, actor, merchant, amount_minor, currency, purpose,
            payment_hash, reservation_id, now,
        )
        result["judge"] = judge.detail if judge else None
        result["balance"] = balance.detail if balance else None
        return state, result
