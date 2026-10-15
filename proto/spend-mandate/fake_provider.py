"""fake_provider.py — simulated payment provider. No live money, no network."""
from __future__ import annotations

import time
import uuid

from governed_spend import Quote


class FakeProvider:
    def __init__(self, timeout_merchants: set | None = None):
        self.timeout_merchants = timeout_merchants or set()
        self.accepted: list[dict] = []

    def quote(self, merchant, amount_minor, currency):
        if merchant in self.timeout_merchants:
            return None  # simulates provider unreachable
        return Quote(
            provider_ref=f"q-{uuid.uuid4().hex[:12]}",
            merchant=merchant,
            amount_minor=amount_minor,
            fee_minor=max(0, amount_minor // 100),  # 1% fake fee
            currency=currency,
            expires_at=time.time() + 300,
        )

    def settle(self, quote, payment_hash):
        rec = {"provider_ref": quote.provider_ref, "payment_hash": payment_hash, "status": "ACCEPTED"}
        self.accepted.append(rec)
        return rec

    def has_accepted(self, payment_hash):
        return any(r["payment_hash"] == payment_hash for r in self.accepted)
