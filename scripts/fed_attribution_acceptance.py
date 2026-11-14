#!/usr/bin/env python3
"""FED Attribution Contract — acceptance suite.

Runs against the live proxy. Exit 0 only if every test meets its contract.
Written 2026-10-27 after the batch-5 finding that a 200 response did not prove
which model produced it.

Usage:  python3 fed_attribution_acceptance.py [base_url]
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4000").rstrip("/")
URL = BASE + "/v1/chat/completions"


def _key():
    for env in ("LITELLM_MASTER_KEY",):
        v = os.environ.get(env)
        if v:
            return v
    for path in ("/root/.secrets/kunci-root.env", "/root/.secrets/a-forge.env"):
        try:
            for line in open(path):
                m = re.match(rf'export {name}="?([^"]+)"?', line.strip()) if (name := "LITELLM_MASTER_KEY") else None
                if m:
                    return m.group(1)
        except FileNotFoundError:
            pass
    raise SystemExit("LITELLM_MASTER_KEY not found")


KEY = _key()
RESULTS = []


def call(model, prompt, strict=False, stream=False, timeout=240):
    body = {"model": model, "messages": [{"role": "user", "content": prompt}], "max_tokens": 8}
    if stream:
        body["stream"] = True
    req = urllib.request.Request(
        URL,
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            **({"x-arifos-model-integrity": "strict"} if strict else {}),
        },
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            hdrs = {k.lower(): v for k, v in r.headers.items()}
            raw = r.read()
        return {"status": r.status, "headers": hdrs, "raw": raw, "secs": round(time.time() - t0, 1)}
    except urllib.error.HTTPError as e:
        return {
            "status": e.code,
            "headers": {k.lower(): v for k, v in e.headers.items()},
            "raw": e.read(),
            "secs": round(time.time() - t0, 1),
        }
    except Exception as e:
        return {"status": None, "error": f"{type(e).__name__}: {e}", "secs": round(time.time() - t0, 1)}


def has_content(raw):
    try:
        d = json.loads(raw)
        if "error" in d:
            return False
        return bool((d.get("choices") or [{}])[0].get("message", {}).get("content")) or bool(
            (d.get("choices") or [{}])[0].get("message", {}).get("reasoning_content")
        )
    except Exception:
        return bool(raw.strip())


def check(name, cond, detail):
    RESULTS.append((name, bool(cond), detail))
    print(f"{'PASS' if cond else 'FAIL'}  {name}\n      {detail}")


def nonce(tag):
    return f"{tag}-{time.time_ns()}"


print(f"FED attribution acceptance — {BASE}\n")

# --- T1: direct match -------------------------------------------------------
r = call("deepseek-flash", nonce("t1"))
h = r.get("headers", {})
check(
    "T1 direct match",
    r["status"] == 200
    and h.get("x-arifos-model-substituted") == "false"
    and h.get("x-arifos-attribution-status") in ("DIRECT", "CACHE_REPLAY"),
    f"status={r['status']} substituted={h.get('x-arifos-model-substituted')} "
    f"attribution={h.get('x-arifos-attribution-status')}",
)

# --- T2: availability fallback ---------------------------------------------
r = call("kimi-k3", nonce("t2"))
h = r.get("headers", {})
check(
    "T2 availability fallback stamps substitution",
    r["status"] == 200
    and h.get("x-arifos-model-substituted") == "true"
    and h.get("x-arifos-attribution-status") == "SUBSTITUTED"
    and h.get("x-arifos-fallback-reason"),
    f"status={r['status']} requested={h.get('x-arifos-requested-alias')} "
    f"served={h.get('x-arifos-served-model')} substituted={h.get('x-arifos-model-substituted')} "
    f"reason={h.get('x-arifos-fallback-reason')}",
)

# --- T3: strict rejects substitution ---------------------------------------
r = call("kimi-k3", nonce("t3"), strict=True)
body = r.get("raw", b"").decode(errors="replace")
check(
    "T3 strict lane rejects substituted output",
    r["status"] == 409 and "MODEL_SUBSTITUTED" in body and not has_content(r.get("raw", b"")),
    f"status={r['status']} content_released={has_content(r.get('raw', b''))} body={body[:120]}",
)

# --- T4: identity is always stated, never silently released -----------------
# The MODEL_IDENTITY_UNKNOWN (502) branch fires only when the served model cannot
# be established at all (response.model echoes the group name). No live request
# against the current config reaches that state — verified by unit assertion in
# _attrib_selftest.py. Live contract here: identity must be DEFINITE (not null)
# for every released answer, and the lane mode must be read correctly.
r = call("hermes-default", nonce("t4"), strict=True)
h = r.get("headers", {})
body = r.get("raw", b"").decode(errors="replace")
mode_ok = h.get("x-arifos-model-integrity-mode") == "strict"
if r["status"] == 200:
    identity_ok = h.get("x-arifos-model-substituted") in ("true", "false")
elif r["status"] == 502:
    identity_ok = "MODEL_IDENTITY_UNKNOWN" in body
else:
    identity_ok = False
check(
    "T4 released output always carries definite identity (or 502)",
    identity_ok and mode_ok,
    f"status={r['status']} mode={h.get('x-arifos-model-integrity-mode')} "
    f"substituted={h.get('x-arifos-model-substituted')} "
    f"served={h.get('x-arifos-served-model')}",
)

# --- T5: streaming headers precede content ---------------------------------
r = call("deepseek-flash", nonce("t5"), stream=True)
h = r.get("headers", {})
arifos_hdrs = [k for k in h if k.startswith("x-arifos-")]
check(
    "T5 streaming carries attribution headers",
    r["status"] == 200 and len(arifos_hdrs) >= 5,
    f"status={r['status']} x-arifos_headers={len(arifos_hdrs)}",
)

# --- T6: strict must NOT block lawful direct work --------------------------
r = call("deepseek-flash", nonce("t6"), strict=True)
h = r.get("headers", {})
check(
    "T6 strict lane allows proven-direct work",
    r["status"] == 200 and has_content(r.get("raw", b"")) and h.get("x-arifos-model-substituted") == "false",
    f"status={r['status']} content_released={has_content(r.get('raw', b''))} "
    f"substituted={h.get('x-arifos-model-substituted')}",
)

passed = sum(1 for _, ok, _ in RESULTS if ok)
print(f"\n{passed}/{len(RESULTS)} passed")
if passed != len(RESULTS):
    print("\nFAILED:")
    for name, ok, detail in RESULTS:
        if not ok:
            print(f"  - {name}: {detail}")
sys.exit(0 if passed == len(RESULTS) else 1)
