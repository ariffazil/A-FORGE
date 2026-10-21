#!/usr/bin/env python3
"""FED Context Guard — pre-call guardrail for the LiteLLM proxy.

Throttles runaway-context patterns first surfaced in the $1.14 claude-cli
session 767c09b2 (2026-10-20). Phase A evidence + threshold calibration:
/root/work/fed-context-guard-verification-2026-10-21.md (p50=181k, p90=372k,
p99=657k over 10,290 deepseek calls / 48h).

Dispatch note (2026-10-21, F2-verified): this litellm build does NOT call
plain CustomLogger.async_pre_call_hook from litellm_settings.callbacks —
pre-call hooks only run through the guardrails pipeline. Hence this extends
CustomGuardrail and registers under top-level `guardrails:` with
mode: pre_call + default_on: true.

THRESHOLDS (env-tunable, defaults calibrated):
  WARN  384_000  ≈ p90 — structured log line, never blocks (F2 witness).
  HOLD  704_000  above p99 (657k), below max (843k) — 413 pre-call.
Loop-guard: ≥3 identical payloads (sha256) within 600s AND est ≥ WARN → 429.
Heartbeat cron is safe: small identical poll payloads sit below WARN, and
the loop counter only arms at/above WARN (2026-10-18 per-lane law).

OVERRIDE (escape hatch): if ARIF_CONTEXT_OVERRIDE_SECRET is set, header
"x-arif-context-override: <hex hmac-sha256(secret, 'context-override:' +
UTC_YYYY-MM-DDTHH)>" passes HOLD/LOOP for that UTC hour. Every use emits
an OVERRIDE audit line. Secret unset → override disabled (stricter).

F1 HONOUR: internal errors fail-open (call proceeds) with bounded stderr
visibility (first 5 + every 100th), mirroring fed_spend_callback. The
guard must never crash the proxy.
"""

import os
import sys
import json
import hmac
import hashlib
import datetime

from fastapi import HTTPException
import litellm
from litellm.integrations.custom_guardrail import CustomGuardrail

WARN = int(os.environ.get("ARIF_CONTEXT_WARN_TOKENS", "384000"))
HOLD = int(os.environ.get("ARIF_CONTEXT_HOLD_TOKENS", "704000"))
LOOP_MAX = int(os.environ.get("ARIF_CONTEXT_LOOP_MAX", "3"))
LOOP_WINDOW_S = int(os.environ.get("ARIF_CONTEXT_LOOP_WINDOW_S", "600"))
OVERRIDE_SECRET = os.environ.get("ARIF_CONTEXT_OVERRIDE_SECRET") or None
MODELS = [
    m.strip() for m in os.environ.get("ARIF_CONTEXT_MODELS", "").split(",") if m.strip()
]
# ARIF_CONTEXT_GUARD="" / "off" disables the guard (kill-switch).
GUARD_ON = os.environ.get("ARIF_CONTEXT_GUARD", "on").lower() not in (
    "",
    "0",
    "false",
    "off",
)

# Dedicated kill switch & target for authorized production canary (2026-10-21)
BUDGET_GATE_ON = os.environ.get("ARIF_FALLBACK_BUDGET_GATE", "on").lower() not in (
    "",
    "0",
    "false",
    "off",
)
BUDGET_GATE_ROUTE = "go-gpt-6-luna"
BUDGET_PER_CALL_CAP_USD = float(os.environ.get("ARIF_BUDGET_PER_CALL_CAP_USD", "0.25"))

_FAIL_COUNT = [0]
_LOOP_WIN = {}  # (key_alias:body_hash) -> [count, window_start_ts]


def _key_suffix(user_api_key_dict) -> str:
    """Short key identifier for logs. Never log the full key."""
    if not user_api_key_dict:
        return "nokey"
    alias = (
        getattr(user_api_key_dict, "key_alias", None)
        or getattr(user_api_key_dict, "key_name", None)
        or ""
    )
    if alias:
        return alias[-12:]
    token = getattr(user_api_key_dict, "api_key", "") or ""
    return f"key:{token[-6:]}" if token else "nokey"


def _char_len(messages, tools) -> int:
    """Cheap character total. Natural text runs ~3-5 chars/token."""
    total = 0
    try:
        for m in messages or []:
            if isinstance(m, dict):
                c = m.get("content")
                if isinstance(c, str):
                    total += len(c)
                elif c is not None:
                    total += len(json.dumps(c, default=str))
            else:
                total += len(str(m))
        if tools:
            total += len(json.dumps(tools, default=str))
    except Exception:
        return 0
    return total


def _estimate(model: str, messages, tools) -> int:
    """Token estimate. litellm's own counter first; fallback chars//4."""
    if not messages:
        return 0
    try:
        n = litellm.token_counter(model=model, messages=messages, tools=tools or None)
        return int(n or 0)
    except Exception:
        pass
    try:
        flat = json.dumps(messages, default=str, ensure_ascii=False)
        if tools:
            flat += json.dumps(tools, default=str, ensure_ascii=False)
        return len(flat) // 4
    except Exception:
        return 0


def _hash_body(messages) -> str:
    try:
        flat = json.dumps(messages, sort_keys=True, default=str, ensure_ascii=False)
        return hashlib.sha256(flat.encode("utf-8")).hexdigest()[:16]
    except Exception:
        return "nohash"


def _request_headers(data: dict) -> dict:
    """Headers can ride at data['headers'] or the proxy_server_request."""
    if not isinstance(data, dict):
        return {}
    h = data.get("headers")
    if isinstance(h, dict) and h:
        return h
    psr = data.get("proxy_server_request")
    if isinstance(psr, dict):
        h = psr.get("headers")
        if isinstance(h, dict):
            return h
    return {}


def _loop_check(body_hash: str, key_alias: str):
    """Identical-payload loop counter, in-process.

    Deployment fact (2026-10-21): litellm-federation runs --num_workers 1,
    so one process sees every request — an in-memory window is exact and
    avoids coupling the guard to redis auth (redis requires a password;
    plumbing REDIS_PASSWORD into the guard would add a secret surface for
    zero coordination benefit at n=1). IF WORKERS EVER > 1, replace this
    with a redis-backed counter — in-process counting undercounts.
    """
    import time

    now = time.time()
    k = f"{key_alias}:{body_hash}"
    ent = _LOOP_WIN.get(k)
    if ent is None or now - ent[1] > LOOP_WINDOW_S:
        _LOOP_WIN[k] = [1, now]
        n = 1
    else:
        ent[0] += 1
        n = ent[0]
    if len(_LOOP_WIN) > 2000:  # bounded memory; prune expired, then cap
        cutoff = now - LOOP_WINDOW_S
        for kk in [k2 for k2, v in _LOOP_WIN.items() if v[1] < cutoff]:
            _LOOP_WIN.pop(kk, None)
        if len(_LOOP_WIN) > 4000:
            _LOOP_WIN.clear()
    return n, n >= LOOP_MAX


def _hour_sigs() -> list:
    now = datetime.datetime.now(datetime.timezone.utc)
    hours = [now.strftime("%Y-%m-%dT%H")]
    prev = now - datetime.timedelta(hours=1)
    hours.append(prev.strftime("%Y-%m-%dT%H"))
    return hours


def _override_valid(headers: dict) -> bool:
    if not OVERRIDE_SECRET or not headers:
        return False
    sig = headers.get("x-arif-context-override") or headers.get(
        "X-Arif-Context-Override"
    )
    if not sig:
        return False
    for h in _hour_sigs():
        expect = hmac.new(
            OVERRIDE_SECRET.encode("utf-8"),
            f"context-override:{h}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if hmac.compare_digest(sig, expect):
            return True
    return False


def _audit(event: dict) -> None:
    try:
        print(json.dumps(event), flush=True)
    except Exception:
        pass


def _check_route_budget(model: str, messages, tools) -> tuple[bool, dict]:
    """Pre-dispatch budget check for authorized canary route only."""
    import time
    # Approximate pricing: $10/M input tokens for go-gpt-6-luna
    est_tokens = _estimate(model, messages, tools)
    est_cost = est_tokens * (10.0 / 1_000_000.0)
    allowed = est_cost <= BUDGET_PER_CALL_CAP_USD
    decision = "ALLOW" if allowed else "HOLD"
    reason = (
        "Within budget envelope"
        if allowed
        else f"Estimated call cost ${est_cost:.4f} exceeds per-call ceiling ${BUDGET_PER_CALL_CAP_USD:.2f}"
    )
    raw = f"{model}:{est_tokens}:{est_cost}:{decision}:{reason}"
    receipt_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    receipt = {
        "event": "budget_gate_decision",
        "receipt_id": f"rcpt-bgt-{receipt_hash[:12]}",
        "receipt_hash": f"sha256:{receipt_hash}",
        "model": model,
        "decision": decision,
        "allowed": allowed,
        "est_tokens": est_tokens,
        "est_cost_usd": round(est_cost, 6),
        "per_call_cap_usd": BUDGET_PER_CALL_CAP_USD,
        "reason": reason,
        "timestamp": time.time(),
    }
    return allowed, receipt


class FedContextGuard(CustomGuardrail):
    """Pre-call context guardrail. Raises HTTPException to reject."""

    async def async_pre_call_hook(
        self, user_api_key_dict, cache, data: dict, call_type: str
    ):
        if not GUARD_ON:
            return data
        try:
            model = data.get("model") or "unknown"
            if MODELS and not any(m in model for m in MODELS):
                return data
            messages = data.get("messages") or []
            tools = data.get("tools")

            # CANARY: Pre-dispatch budget gate for authorized route (go-gpt-6-luna)
            if BUDGET_GATE_ON and model == BUDGET_GATE_ROUTE:
                ok, bgt_receipt = _check_route_budget(model, messages, tools)
                _audit(bgt_receipt)
                if not ok:
                    hdrs = _request_headers(data)
                    key_alias = _key_suffix(user_api_key_dict)
                    if _override_valid(hdrs):
                        _audit({
                            "event": "budget_override",
                            "receipt_id": bgt_receipt["receipt_id"],
                            "model": model,
                            "key": key_alias,
                        })
                    else:
                        raise HTTPException(
                            status_code=413,
                            detail={
                                "error": "budget_gate",
                                "kind": "hold",
                                "receipt_id": bgt_receipt["receipt_id"],
                                "receipt_hash": bgt_receipt["receipt_hash"],
                                "reason": bgt_receipt["reason"],
                                "est_cost_usd": bgt_receipt["est_cost_usd"],
                                "limit_usd": BUDGET_PER_CALL_CAP_USD,
                                "model": model,
                            },
                        )
            chars = _char_len(messages, tools)
            if chars <= 0:
                return data
            # Stage 1+2 (cheap): skip precise counting only when the payload
            # cannot reach WARN even at a 2 chars/token worst-case ratio
            # (every real tokenizer on prose/code is >= 2.5; BPE on random
            # syllable content measured 2.53). Guarantees: everything that
            # could WARN or HOLD gets the precise token_counter pass; the
            # median fleet call (<= ~300k tokens) keeps its fast path.
            if chars < WARN * 2:
                return data
            est = _estimate(model, messages, tools)
            if est <= 0:
                return data
            hdrs = _request_headers(data)
            key_alias = _key_suffix(user_api_key_dict)

            if est >= HOLD:
                if _override_valid(hdrs):
                    _audit(
                        {
                            "event": "context_override",
                            "kind": "hold",
                            "est": est,
                            "model": model,
                            "key": key_alias,
                            "limit": HOLD,
                        }
                    )
                    return data
                raise HTTPException(
                    status_code=413,
                    detail={
                        "error": "context_guard",
                        "kind": "hold",
                        "estimated_tokens": est,
                        "limit": HOLD,
                        "model": model,
                    },
                )

            if est >= WARN:
                _audit(
                    {
                        "event": "context_warn",
                        "est": est,
                        "model": model,
                        "key": key_alias,
                        "warn": WARN,
                        "hold": HOLD,
                    }
                )
                body_hash = _hash_body(messages)
                count, tripped = _loop_check(body_hash, key_alias)
                if tripped:
                    if _override_valid(hdrs):
                        _audit(
                            {
                                "event": "context_override",
                                "kind": "loop",
                                "est": est,
                                "model": model,
                                "key": key_alias,
                                "loop_count": count,
                            }
                        )
                        return data
                    raise HTTPException(
                        status_code=429,
                        detail={
                            "error": "context_guard",
                            "kind": "loop",
                            "loops": count,
                            "window_s": LOOP_WINDOW_S,
                            "limit": LOOP_MAX,
                            "estimated_tokens": est,
                            "model": model,
                        },
                    )

            return data
        except HTTPException:
            raise
        except Exception as e:  # F1: never crash the proxy on guard bug
            _FAIL_COUNT[0] += 1
            n = _FAIL_COUNT[0]
            if n <= 5 or n % 100 == 0:
                print(
                    f"[fed_context_guard] internal_error x{n}: {e}",
                    file=sys.stderr,
                    flush=True,
                )
            return data  # fail-open


guard_instance = FedContextGuard()
print(
    f"[fed_context_guard] loaded warn={WARN} hold={HOLD} "
    f"loop_max={LOOP_MAX} loop_window_s={LOOP_WINDOW_S} "
    f"guard_on={GUARD_ON} override={'on' if OVERRIDE_SECRET else 'off'} "
    f"budget_gate={'on' if BUDGET_GATE_ON else 'off'} "
    f"budget_route={BUDGET_GATE_ROUTE} cap=${BUDGET_PER_CALL_CAP_USD} "
    f"models={MODELS or 'ALL'}",
    file=sys.stderr,
    flush=True,
)
