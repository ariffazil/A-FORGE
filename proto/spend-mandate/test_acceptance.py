"""test_acceptance.py — adversarial acceptance cases for the spend mandate sandbox."""
import time

from governed_spend import (
    SpendMandate, Ledger, SpendExecutor, PurchaseState, MandateStatus,
)
from fake_provider import FakeProvider

PASS = 0
FAIL = 0
RESULTS = []


def check(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        RESULTS.append((name, "PASS", detail))
    else:
        FAIL += 1
        RESULTS.append((name, "FAIL", detail))


def mk_mandate(**kw):
    base = dict(
        mandate_id="M-001", principal="F13", agent="agent-1",
        purpose="API subscription", merchant_allowlist=["api.co", "data.io"],
        currency="MYR", total_cap_minor=10000, per_action_cap_minor=3000,
        expiry_epoch=time.time() + 3600,
    )
    base.update(kw)
    return SpendMandate(**base)


def verified_actor(a):
    return a == "agent-1"  # signing-lane stand-in


def fresh():
    return Ledger(), FakeProvider(), verified_actor


# ── Case 1: valid bounded request settles and reconciles ──
led, prov, va = fresh()
ex = SpendExecutor(led, prov, va)
m = mk_mandate()
st, r = ex.request(m, "agent-1", "api.co", 1000, "MYR", "sub", "ph-1", "r-1")
check("valid_request_settles", st == PurchaseState.SETTLED and r["entry"] is not None, f"state={st}")

# ── Case 2: wrong actor fails closed ──
st, r = ex.request(m, "agent-2", "api.co", 1000, "MYR", "sub", "ph-2", "r-2")
check("wrong_actor_fails_closed", st == PurchaseState.FAILED and r["reason"] == "actor_not_verified", r.get("reason"))

# ── Case 3: expired mandate fails closed ──
m_exp = mk_mandate(expiry_epoch=time.time() - 10)
st, r = ex.request(m_exp, "agent-1", "api.co", 1000, "MYR", "sub", "ph-3", "r-3")
check("expired_fails_closed", st == PurchaseState.FAILED and r["reason"] == "mandate_expired", r.get("reason"))

# ── Case 4: revoked mandate fails closed ──
m_rev = mk_mandate(status=MandateStatus.REVOKED)
st, r = ex.request(m_rev, "agent-1", "api.co", 1000, "MYR", "sub", "ph-4", "r-4")
check("revoked_fails_closed", st == PurchaseState.FAILED and "revoked" in r["reason"], r.get("reason"))

# ── Case 5: unlisted merchant fails closed ──
st, r = ex.request(m, "agent-1", "evil.shop", 1000, "MYR", "sub", "ph-5", "r-5")
check("unlisted_merchant_fails_closed", st == PurchaseState.FAILED and r["reason"] == "merchant_not_allowlisted", r.get("reason"))

# ── Case 6: tampered amount fails closed ──
st, r = ex.request(m, "agent-1", "api.co", 99999, "MYR", "sub", "ph-6", "r-6")
check("tampered_amount_fails_closed", st == PurchaseState.FAILED and r["reason"] == "per_action_cap_exceeded", r.get("reason"))

# ── Case 7: currency mismatch fails closed ──
st, r = ex.request(m, "agent-1", "api.co", 1000, "USD", "sub", "ph-7", "r-7")
check("currency_mismatch_fails_closed", st == PurchaseState.FAILED and r["reason"] == "currency_mismatch", r.get("reason"))

# ── Case 8: duplicate retry produces no second debit ──
st, r = ex.request(m, "agent-1", "api.co", 1000, "MYR", "sub", "ph-1", "r-8")
check("duplicate_no_second_debit", st == PurchaseState.FAILED and r["reason"] == "duplicate_payment", r.get("reason"))
check("ledger_single_entry_for_ph1", len([e for e in led.entries if e["payment_hash"] == "ph-1"]) == 1, f"count={len(led.entries)}")

# ── Case 9: concurrent requests cannot exceed shared cap ──
led2, prov2, va2 = fresh()
ex2 = SpendExecutor(led2, prov2, va2)
m2 = mk_mandate(total_cap_minor=1500, per_action_cap_minor=1000)
st, r = ex2.request(m2, "agent-1", "api.co", 1000, "MYR", "sub", "ph-A", "r-A")
check("first_spend_ok", st == PurchaseState.SETTLED, f"state={st}")
st, r = ex2.request(m2, "agent-1", "data.io", 1000, "MYR", "sub", "ph-B", "r-B")
check("concurrent_exhaustion_blocked", st == PurchaseState.FAILED and r["reason"] == "budget_exhausted", r.get("reason"))

# ── Case 10: provider timeout stays PENDING, no debit ──
led3, prov3, va3 = fresh()
ex3 = SpendExecutor(led3, prov3, va3)
prov3.timeout_merchants.add("api.co")
m3 = mk_mandate()
st, r = ex3.request(m3, "agent-1", "api.co", 1000, "MYR", "sub", "ph-T", "r-T")
check("timeout_stays_pending", st == PurchaseState.PENDING and r["reason"] == "provider_timeout", f"state={st}")
check("timeout_no_debit", len(led3.entries) == 0, f"entries={len(led3.entries)}")

# ── Case 11: missing evidence stays UNKNOWN, never PASS ──
st, r = ex3.reconcile(m3, "ph-ghost", 1000, "r-G")
check("missing_evidence_not_pass", st == PurchaseState.UNKNOWN, f"state={st}")

# ── Case 12: crash after acceptance reconciles without second debit ──
led4, prov4, va4 = fresh()
ex4 = SpendExecutor(led4, prov4, va4)
m4 = mk_mandate()
# simulate: provider accepted, then crash before ledger persisted
q = prov4.quote("api.co", 500, "MYR")
prov4.settle(q, "ph-C")          # provider has evidence of acceptance
# ledger has NOT recorded ph-C (crash window)
check("crash_precondition_no_ledger", not any(e["payment_hash"] == "ph-C" for e in led4.entries), "")
st, r = ex4.reconcile(m4, "ph-C", 505, "r-C")
check("crash_reconciles", st == PurchaseState.SETTLED and r["entry"] is not None, f"state={st}")
st, r = ex4.reconcile(m4, "ph-C", 505, "r-C2")
check("crash_no_second_debit", st == PurchaseState.SETTLED and r["entry"] is None, f"state={st}, reason={r.get('reason')}")
check("crash_single_entry", len([e for e in led4.entries if e["payment_hash"] == "ph-C"]) == 1, f"count={len(led4.entries)}")

print("=" * 64)
for name, ok, detail in RESULTS:
    print(f"[{ok}] {name}  {detail}")
print("=" * 64)
print(f"TOTAL: {PASS} pass, {FAIL} fail")
import sys as _sys_spend_exit
_sys_spend_exit.exit(0 if FAIL == 0 else 1)
