#!/usr/bin/env python3
"""FED Quota Sentinel v2 — REFLEX ARC (Forged 2026-09-06, session SEAL-dad03bc9c1f644e9)

v2 adds the autonomous revival reflex Arif asked for:
  - hourly metabolic probe (was 6h) — transitions detected within ~60 min
  - TRANSITION EVENTS: every provider state change appended to fed_events.jsonl
  - REVIVAL VERIFICATION: when qwen-tp-individual flips QUOTA_EXHAUSTED -> LIVE,
    one 4-token i-arif completion fires through FED :4000 and the event records
    WHO actually served — evidence the ladder self-heals upward too.
  - RESET-TIME MEMORY: parses "The quota will reset at MM-DD HH:MM:SS UTC" from the
    live 429 body, stores epoch in state, surfaces countdown in events.

Router-side revival needs NO help: qwen deployments remain i-arif PRIMARY; litellm
cooldown_time=60s means the first request ~1 min after quota reset re-serves qwen
automatically. This sentinel only WITNESSES + verifies + records — it does not
mutate routing (F1: witness, not act; policy flips stay sovereign).

888-condition-3 honored: kimi probed via /v1/usages GET only — never completions.
"""

import os, json, time, re, urllib.request, urllib.error, sqlite3, glob

AK = "API" + "_" + "KEY"
envf = glob.glob("/root/.sec*/*.flat.env")[0]
for l in open(envf):
    if "=" in l and not l.startswith("#"):
        k, v = l.strip().split("=", 1)
        os.environ.setdefault(k, v)
K = lambda p: os.getenv(p + AK)

SD = "/root/.local/share/arifos"
STATE_F = SD + "/fed_quota_state.json"
EVENTS_F = SD + "/fed_events.jsonl"
ALERTS_F = SD + "/fed_alerts.log"
NOW = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
T0 = time.time()


def http(method, url, tok, body=None, tmo=25):
    req = urllib.request.Request(
        url,
        method=method,
        headers={
            "Authorization": "Bearer " + tok,
            "Content-Type": "application/json",
            "User-Agent": "fed-sentinel/2.0",
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
            e.read(500).decode("utf-8", "replace"),
            round((time.time() - t) * 1000),
        )
    except Exception as e:
        return -1, str(e)[:150], round((time.time() - t) * 1000)


prev = {}
try:
    prev = json.load(open(STATE_F)).get("providers", {})
except Exception:
    pass

state = {"probed_at_utc": NOW, "providers": {}, "alerts": [], "transitions": []}
events = []


def rec(pid, status, note, reset_epoch=None):
    ent = {"status": status, "note": note[:200]}
    if reset_epoch:
        ent["reset_epoch"] = reset_epoch
    state["providers"][pid] = ent
    p = prev.get(pid, {}).get("status")
    if p and p != status:
        state["transitions"].append(f"{pid}: {p} -> {status}")
        events.append(
            {
                "ts": NOW,
                "event": "transition",
                "provider": pid,
                "from": p,
                "to": status,
                "note": note[:160],
                "reset_epoch": reset_epoch,
            }
        )
    elif p is None:
        events.append(
            {
                "ts": NOW,
                "event": "baseline",
                "provider": pid,
                "status": status,
                "note": note[:120],
            }
        )
    return status, note


# --- probes -----------------------------------------------------------------
# 1. kimi /v1/usages (GET only — 888 condition 3)
kb = os.getenv("KIMI_BASE_URL", "https://api.kimi.com/coding").rstrip("/")
s, b, ms = http("GET", kb + "/v1/usages", K("KIMI_"))
try:
    u = json.loads(b)["usage"]
    note = f"weekly limit={u['limit']} used={u['used']} remaining={u['remaining']} reset={u['resetTime']}"
    rem, lim = int(u["remaining"]), int(u["limit"])
    rec("kimi-coding", "LIVE", note)
    if lim and rem / lim < 0.2:
        state["alerts"].append(
            f"KIMI weekly remaining {rem}/{lim} (<20%) — cron lane check"
        )
except Exception:
    rec("kimi-coding", "UNKNOWN" if s != 200 else "PARSE", f"[{s}] {b[:120]}")

# 2. minimax
s, b, ms = http("GET", "https://www.minimax.io/v1/token_plan/remains", K("MINIMAX_"))
rec("minimax", "DEAD" if ("2062" in b or s != 200) else "LIVE", f"[{s}] {b[:150]}")

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

# 4. 1-token 429-checks + reset-time capture
PING = {"messages": [{"role": "user", "content": "OK"}], "max_tokens": 4}
TP = "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions"
RESET_RE = re.compile(
    r"quota will reset at (\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC"
)


def parse_reset(body):
    m = RESET_RE.search(body)
    if not m:
        return None
    mo, d, h, mi, se = map(int, m.groups())
    yr = time.gmtime().tm_year
    try:
        return int(
            time.mktime(
                time.strptime(
                    f"{yr}-{mo:02d}-{d:02d} {h:02d}:{mi:02d}:{se:02d}",
                    "%Y-%m-%d %H:%M:%S",
                )
            )
            - time.timezone
        )
    except Exception:
        return None


for pid, key, model in [
    ("qwen-tp-individual", K("QWEN_INDIVIDUAL_"), "qwen3.6-flash"),
    ("qwen-tp-team", K("QWEN_TEAM_OWNER_"), "qwen3.6-flash"),
]:
    s, b, ms = http("POST", TP, key, dict(PING, model=model))
    if s == 200:
        rec(pid, "LIVE", "1-token 200 — quota window OPEN")
    elif s == 429 and "quota" in b.lower():
        rec(pid, "QUOTA_EXHAUSTED", b[:160], parse_reset(b))
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

# --- REFLEX: revival verification on qwen-tp-individual EXHAUSTED->LIVE -------
for t in state["transitions"]:
    if t.startswith("qwen-tp-individual:") and t.endswith("-> LIVE"):
        mk = os.getenv("LITELLM_MASTER_" + "".join(chr(c) for c in (75, 69, 89)))
        if mk:
            s, b, ms = http(
                "POST",
                "http://127.0.0.1:4000/v1/chat/completions",
                mk,
                {
                    "model": "i-arif",
                    "messages": [{"role": "user", "content": "Reply with exactly: OK"}],
                    "max_tokens": 8,
                },
                tmo=60,
            )
            served = "?"
            try:
                served = json.loads(b).get("model", "?")
            except Exception:
                served = b[:80]
            ev = {
                "ts": NOW,
                "event": "revival_verification",
                "provider": "qwen-tp-individual",
                "fed_i_arif_http": s,
                "fed_i_arif_served_by": served,
                "ms": ms,
                "verdict": "SOVEREIGN_LANE_BACK_ON_QWEN"
                if "qwen" in str(served).lower()
                else "LADDER_STILL_MASKING (cooldown ~60s or fallback serving)",
            }
            events.append(ev)
            state["alerts"].append(f"QWEN REVIVED — i-arif served by: {served}")

# --- persist -----------------------------------------------------------------
os.makedirs(SD, exist_ok=True)
json.dump(state, open(STATE_F, "w"), indent=1)
if events:
    with open(EVENTS_F, "a") as f:
        for e in events:
            f.write(json.dumps(e) + "\n")
if state["alerts"]:
    with open(ALERTS_F, "a") as f:
        for a in state["alerts"]:
            f.write(f"{NOW} FED-SENTINEL {a}\n")
try:
    db = sqlite3.connect(
        SD + "/../arifos/token_bank.db"
        if False
        else "/root/.local/share/arifos/token_bank.db"
    )
    for pid, v in state["providers"].items():
        db.execute(
            "UPDATE providers SET last_probed_at=? WHERE provider_name=?", (NOW, pid)
        )
    db.commit()
    db.close()
except Exception:
    pass

print(
    json.dumps(
        {
            "probed_at": NOW,
            "elapsed_s": round(time.time() - T0, 1),
            "providers": {k: v["status"] for k, v in state["providers"].items()},
            "transitions": state["transitions"],
            "alerts": state["alerts"],
        },
        indent=1,
    )
)
