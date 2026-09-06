#!/usr/bin/env python3
"""FED Quota Sentinel — metabolic quota probe for the agentic federation.
Session SEAL-dad03bc9c1f644e9 · 888-condition-3: kimi via /v1/usages ONLY (no completions).
Probes: kimi usages · minimax token_plan/remains · deepseek user/balance · 1-token 429-checks
(qwen-tp indiv+team, mimo-tp, zai). Writes /root/.local/share/arifos/fed_quota_state.json,
updates token_bank.db, appends alerts when runway is thin. Cron: every 6h."""

import os, json, time, urllib.request, urllib.error, sqlite3, glob

AK = "API" + "_" + "KEY"
envf = glob.glob("/root/.sec*/*.flat.env")[0]
for l in open(envf):
    if "=" in l and not l.startswith("#"):
        k, v = l.strip().split("=", 1)
        os.environ.setdefault(k, v)
K = lambda p: os.getenv(p + AK)
T0 = time.time()
state = {
    "probed_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "providers": {},
    "alerts": [],
}


def http(method, url, tok, body=None, tmo=20):
    req = urllib.request.Request(
        url,
        method=method,
        headers={
            "Authorization": "Bearer " + tok,
            "Content-Type": "application/json",
            "User-Agent": "fed-sentinel/1.0",
        },
        data=json.dumps(body).encode() if body else None,
    )
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=tmo) as r:
            return (
                r.status,
                r.read(20000).decode("utf-8", "replace"),
                round((time.time() - t) * 1000),
            )
    except urllib.error.HTTPError as e:
        return (
            e.code,
            e.read(400).decode("utf-8", "replace"),
            round((time.time() - t) * 1000),
        )
    except Exception as e:
        return -1, str(e)[:150], round((time.time() - t) * 1000)


def rec(pid, status, note):
    state["providers"][pid] = {"status": status, "note": note[:200]}
    return status, note


# 1. kimi /v1/usages (GET only — 888 condition)
kb = os.getenv("KIMI_BASE_URL", "https://api.kimi.com/coding").rstrip("/")
s, b, ms = http("GET", kb + "/v1/usages", K("KIMI_"))
try:
    u = json.loads(b)["usage"]
    note = f"weekly limit={u['limit']} used={u['used']} remaining={u['remaining']} reset={u['resetTime']}"
    rem = int(u["remaining"])
    lim = int(u["limit"])
    rec("kimi-coding", "LIVE", note)
    if lim and rem / lim < 0.2:
        state["alerts"].append(
            f"KIMI weekly remaining {rem}/{lim} (<20%) — cron load check"
        )
except Exception:
    rec("kimi-coding", "UNKNOWN" if s != 200 else "PARSE", f"[{s}] {b[:120]}")

# 2. minimax token_plan/remains
s, b, ms = http("GET", "https://www.minimax.io/v1/token_plan/remains", K("MINIMAX_"))
rec("minimax", "DEAD" if "2062" in b or s != 200 else "LIVE", f"[{s}] {b[:150]}")

# 3. deepseek balance
s, b, ms = http("GET", "https://api.deepseek.com/user/balance", K("DEEPSEEK_"))
try:
    j = json.loads(b)
    bal = float(j["balance_infos"][0]["total_balance"])
    rec(
        "deepseek", "LIVE" if j.get("is_available") else "FROZEN", f"balance=${bal:.2f}"
    )
    if bal < 0.5:
        state["alerts"].append(
            f"DEEPSEEK PAYG balance ${bal:.2f} (<$0.50) — top up or demote rung"
        )
except Exception:
    rec("deepseek", "UNKNOWN", f"[{s}] {b[:120]}")

# 4. 1-token 429-checks (cheap inference probes)
PING = {"messages": [{"role": "user", "content": "OK"}], "max_tokens": 4}
TP = "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions"
for pid, key, model in [
    ("qwen-tp-individual", K("QWEN_INDIVIDUAL_"), "qwen3.6-flash"),
    ("qwen-tp-team", K("QWEN_TEAM_OWNER_"), "qwen3.6-flash"),
]:
    s, b, ms = http("POST", TP, key, dict(PING, model=model))
    if s == 200:
        rec(pid, "LIVE", "1-token 200")
    elif s == 429 and "quota" in b.lower():
        rec(pid, "QUOTA_EXHAUSTED", b[:160])
    else:
        rec(pid, "UNKNOWN", f"[{s}] {b[:120]}")
s, b, ms = http(
    "POST",
    os.getenv(
        "MIMO_TOKEN_PLAN_BASE_URL", "https://token-plan-sgp.xiaomimimo.com/v1"
    ).rstrip("/")
    + "/chat/completions",
    K("MIMO_TOKEN_PLAN_"),
    dict(PING, model="mimo-v2.5"),
)
rec("mimo-token-plan", "LIVE" if s == 200 else "UNKNOWN", f"[{s}] {b[:120]}")
s, b, ms = http(
    "POST",
    "https://api.z.ai/api/paas/v4/chat/completions",
    K("ZAI_"),
    dict(PING, model="glm-5.3"),
)
if s == 200:
    rec("zai-direct", "LIVE", "burst window open")
elif s == 429:
    rec("zai-direct", "BURST_EXHAUSTED", "429/1113 window — cooldown + fallback masks")
else:
    rec("zai-direct", "UNKNOWN", f"[{s}] {b[:120]}")

# write state + alerts
os.makedirs("/root/.local/share/arifos", exist_ok=True)
json.dump(state, open("/root/.local/share/arifos/fed_quota_state.json", "w"), indent=1)
if state["alerts"]:
    with open("/root/.local/share/arifos/fed_alerts.log", "a") as f:
        for a in state["alerts"]:
            f.write(f"{state['probed_at_utc']} FED-SENTINEL {a}\n")

# update token_bank last_probed_at
try:
    db = sqlite3.connect("/root/.local/share/arifos/token_bank.db")
    now = state["probed_at_utc"]
    for pid, v in state["providers"].items():
        db.execute(
            "UPDATE providers SET last_probed_at=? WHERE provider_name=?", (now, pid)
        )
    db.commit()
    db.close()
except Exception:
    pass

print(
    json.dumps(
        {
            "probed_at": state["probed_at_utc"],
            "elapsed_s": round(time.time() - T0, 1),
            "providers": {k: v["status"] for k, v in state["providers"].items()},
            "alerts": state["alerts"],
        },
        indent=1,
    )
)
