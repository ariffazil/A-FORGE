"""governed_spend.py — bounded spend mandate executor (sandbox, simulated money).

DITEMPA BUKAN DIBERI.
Kernel decides policy; this deterministic boundary enforces it. The model
cannot mint its own authority: every path is fail-closed.
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from enum import StrEnum


class MandateStatus(StrEnum):
    ACTIVE = "ACTIVE"
    REVOKED = "REVOKED"
    EXPIRED = "EXPIRED"


class PurchaseState(StrEnum):
    PROPOSED = "PROPOSED"
    AUTHORIZED = "AUTHORIZED"
    SUBMITTED = "SUBMITTED"
    PENDING = "PENDING"
    SETTLED = "SETTLED"
    FAILED = "FAILED"
    DISPUTED = "DISPUTED"
    UNKNOWN = "UNKNOWN"


@dataclass
class SpendMandate:
    mandate_id: str
    principal: str
    agent: str
    purpose: str
    merchant_allowlist: list[str]
    currency: str
    total_cap_minor: int
    per_action_cap_minor: int
    expiry_epoch: float
    version: int = 1
    revocation_version: int = 0
    status: MandateStatus = MandateStatus.ACTIVE

    def is_authorized(self, now: float | None = None) -> tuple[bool, str]:
        now = now if now is not None else time.time()
        if self.status is not MandateStatus.ACTIVE:
            return False, f"mandate_{self.status.value.lower()}"
        if now > self.expiry_epoch:
            return False, "mandate_expired"
        return True, "ok"

    def allows_merchant(self, merchant: str) -> bool:
        return merchant in self.merchant_allowlist


@dataclass
class Quote:
    provider_ref: str
    merchant: str
    amount_minor: int
    fee_minor: int
    currency: str
    expires_at: float
    fx_source: str = "simulated"
    fx_rate: float = 1.0


class Ledger:
    """In-memory double-entry ledger with idempotency + budget reservations."""

    def __init__(self):
        self._lock = threading.Lock()
        self.entries: list[dict] = []
        self.reservations: dict[str, dict] = {}
        self.payment_hashes: set[str] = set()

    def available_balance(self, mandate: SpendMandate) -> int:
        with self._lock:
            spent = sum(
                e["amount_minor"] for e in self.entries
                if e["mandate_id"] == mandate.mandate_id
            )
            reserved = sum(
                r["amount_minor"] for r in self.reservations.values()
                if r["mandate_id"] == mandate.mandate_id and r["active"]
            )
            return mandate.total_cap_minor - spent - reserved

    def reserve(self, reservation_id: str, mandate_id: str, amount_minor: int) -> tuple[bool, str]:
        with self._lock:
            if reservation_id in self.reservations:
                return False, "duplicate_reservation"
            self.reservations[reservation_id] = {
                "amount_minor": amount_minor,
                "mandate_id": mandate_id,
                "active": True,
            }
            return True, "reserved"

    def release(self, reservation_id: str) -> None:
        with self._lock:
            if reservation_id in self.reservations:
                self.reservations[reservation_id]["active"] = False

    def settle(self, payment_hash: str, mandate_id: str, amount_minor: int,
               reservation_id: str | None = None) -> tuple[str, dict | None]:
        with self._lock:
            if payment_hash in self.payment_hashes:
                return "DUPLICATE", None
            self.payment_hashes.add(payment_hash)
            entry = {
                "payment_hash": payment_hash,
                "mandate_id": mandate_id,
                "amount_minor": amount_minor,
            }
            self.entries.append(entry)
            if reservation_id and reservation_id in self.reservations:
                self.reservations[reservation_id]["active"] = False
            return "APPENDED", entry


class SpendExecutor:
    """Deterministic execution boundary around one bounded purchase."""

    def __init__(self, ledger: Ledger, provider, verify_actor):
        self.ledger = ledger
        self.provider = provider
        self.verify_actor = verify_actor  # callable(actor_id) -> bool (signing lane)

    def request(self, mandate, actor, merchant, amount_minor, currency,
                purpose, payment_hash, reservation_id, now=None):
        # 1. identity: is this actor's identity verified, and is it the bound agent?
        if not self.verify_actor(actor):
            return PurchaseState.FAILED, {"reason": "actor_not_verified"}
        if actor != mandate.agent:
            return PurchaseState.FAILED, {"reason": "actor_not_bound_to_mandate"}
        # 2. mandate still authorized?
        ok, why = mandate.is_authorized(now)
        if not ok:
            return PurchaseState.FAILED, {"reason": why}
        # 3. merchant allowlist
        if not mandate.allows_merchant(merchant):
            return PurchaseState.FAILED, {"reason": "merchant_not_allowlisted"}
        # 4. currency
        if currency != mandate.currency:
            return PurchaseState.FAILED, {"reason": "currency_mismatch"}
        # 5. per-action cap
        if amount_minor > mandate.per_action_cap_minor:
            return PurchaseState.FAILED, {"reason": "per_action_cap_exceeded"}
        # 6. quote (provider may be unreachable -> PENDING, never guessed)
        quote = self.provider.quote(merchant, amount_minor, currency)
        if quote is None:
            return PurchaseState.PENDING, {
                "reason": "provider_timeout", "payment_hash": payment_hash,
            }
        # 7. stale quote
        if (now if now is not None else time.time()) > quote.expires_at:
            return PurchaseState.FAILED, {"reason": "stale_quote"}
        # 8. total incl fee, against cap AND available (atomic via reservation)
        total = amount_minor + quote.fee_minor
        available = self.ledger.available_balance(mandate)
        if total > available:
            return PurchaseState.FAILED, {
                "reason": "budget_exhausted", "available_minor": available,
            }
        # 9. reserve budget before settling (blocks concurrent overspend)
        ok_r, why_r = self.ledger.reserve(reservation_id, mandate.mandate_id, total)
        if not ok_r:
            return PurchaseState.FAILED, {"reason": why_r}
        # 10. settle ledger (idempotent on payment_hash)
        status, entry = self.ledger.settle(payment_hash, mandate.mandate_id, total, reservation_id)
        if status == "DUPLICATE":
            self.ledger.release(reservation_id)
            return PurchaseState.FAILED, {"reason": "duplicate_payment"}
        # 11. provider settle (external side effect)
        ps = self.provider.settle(quote, payment_hash)
        return PurchaseState.SETTLED, {
            "entry": entry, "provider": ps, "quote": quote, "total_minor": total,
        }

    def reconcile(self, mandate, payment_hash, amount_minor, reservation_id=None):
        """After a crash: query provider evidence, then settle idempotently."""
        if not self.provider.has_accepted(payment_hash):
            return PurchaseState.UNKNOWN, {"reason": "no_provider_evidence"}
        status, entry = self.ledger.settle(payment_hash, mandate.mandate_id, amount_minor, reservation_id)
        if status == "DUPLICATE":
            return PurchaseState.SETTLED, {"reason": "already_settled", "entry": None}
        return PurchaseState.SETTLED, {"entry": entry}
