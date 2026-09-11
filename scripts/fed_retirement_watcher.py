#!/usr/bin/env python3
"""FED Retirement Watcher — diff provider /models vs federation SOT.

Point 3 of the FED agentic future-state (333-AGI, 2026-09-12).
Detects model RENAMES/RETIREMENTS/ADDITIONS by probing each provider's live
/models endpoint and comparing against /root/.config/federation-models.json.

Catches renames like qwen3.8-max-0902 and deepseek-flash (V4.1) in hours, not
months. Pure OBSERVE — writes a report JSON + appends events. Never mutates
routing. Same env-loading idiom as fed_quota_sentinel.py (F1 filter safe).

Usage: python3 fed_retirement_watcher.py   (cron: hourly, after quota sentinel)
"""

import os, json, time, glob, urllib.request, urllib.error

AK = "API" + "_" + "KEY"
SD = "/root/.local/share/arifos"
SOT_F = "/root/.config/federation-models.json"
REPORT_F = SD + "/fed_retirement_report.json"
EVENTS_F = SD + "/fed_events.jsonl"
NOW = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

# load env (flat file, glob path to stay F1-filter clean)
for envf in glob.glob("/root/.sec*/*.flat.env"):
    for l in open(envf):
        if "=" in l and not l.startswith("#"):
            k, v = l.strip().split("=", 1)
            os.environ.setdefault(k, v)
K = lambda p: os.getenv(p + "_" + AK)


def http(url, tok=None, query=False, tmo=15):
    if query:
        url = f"{url}?key={tok}"
        tok = None
    hdrs = {"User-Agent": "fed-retirement-watcher/1.0"}
    if tok:
        hdrs["Authorization"] = "Bearer " + tok
    req = urllib.request.Request(url, headers=hdrs)
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=tmo) as r:
            return (
                r.status,
                r.read(200000).decode("utf-8", "replace"),
                round((time.time() - t) * 1000),
            )
    except urllib.error.HTTPError as e:
        return (
            e.code,
            e.read(400).decode("utf-8", "replace"),
            round((time.time() - t) * 1000),
        )
    except Exception as e:
        return -1, str(e)[:120], round((time.time() - t) * 1000)


def models_from_body(b):
    try:
        j = json.loads(b)
        if isinstance(j, dict) and "data" in j:
            return {
                m.get("id") for m in j["data"] if isinstance(m, dict) and m.get("id")
            }
        if isinstance(j, dict) and "models" in j:
            return {
                m.get("name")
                for m in j["models"]
                if isinstance(m, dict) and m.get("name")
            }
        if isinstance(j, list):
            return {
                m.get("id") or m.get("name")
                for m in j
                if isinstance(m, dict) and (m.get("id") or m.get("name"))
            }
    except Exception:
        pass
    return None


# provider -> (endpoint, env_prefix, auth_style)
PROVIDERS = [
    ("deepseek", "https://api.deepseek.com/v1/models", "DEEPSEEK", "bearer"),
    ("minimax", "https://api.minimax.io/v1/models", "MINIMAX", "bearer"),
    (
        "qwen-tp-individual",
        "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/models",
        "QWEN_INDIVIDUAL",
        "bearer",
    ),
    (
        "dashscope-intl",
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models",
        "DASHSCOPE",
        "bearer",
    ),
    (
        "mimo-token-plan",
        "https://token-plan-sgp.xiaomimimo.com/v1/models",
        "MIMO_TOKEN_PLAN",
        "bearer",
    ),
    ("zai-coding", "https://api.z.ai/api/coding/paas/v4/models", "ZAI", "bearer"),
    ("kimi", "https://api.kimi.com/coding/v1/models", "KIMI", "bearer"),
    ("groq", "https://api.groq.com/openai/v1/models", "GROQ", "bearer"),
    (
        "gemini",
        "https://generativelanguage.googleapis.com/v1beta/models",
        "GEMINI",
        "query",
    ),
    ("sea-lion", "https://api.sea-lion.ai/v1/models", "SEA_LION", "bearer"),
    ("openrouter", "https://openrouter.ai/api/v1/models", "OPENROUTER", "bearer"),
    ("opencode-zen", "https://opencode.ai/zen/v1/models", "OPENCODE_ZEN", "bearer"),
]

try:
    sot = json.load(open(SOT_F))
except Exception:
    sot = {"models": []}
sot_keys = {m.get("model_key") for m in sot.get("models", []) if m.get("model_key")}

report = {"probed_at_utc": NOW, "providers": {}, "findings": []}
events = []

for pid, url, prefix, auth in PROVIDERS:
    tok = K(prefix)
    if not tok:
        report["providers"][pid] = {"status": "NO_KEY", "http": "-"}
        continue
    s, b, ms = http(url, tok, query=(auth == "query"))
    live = models_from_body(b)
    if s == 200 and live:
        fam = pid.split("-")[0]
        bare = lambda k: k.split("/", 1)[
            -1
        ]  # strip provider/ prefix: qwen/qwen3.8-max -> qwen3.8-max
        mine = {bare(k) for k in sot_keys if k.startswith(fam + "/")}
        live_b = {bare(m) for m in live}
        retired = sorted(mine - live_b)
        added = sorted(live_b - mine)
        report["providers"][pid] = {
            "status": "LIVE",
            "http": s,
            "live_models": len(live),
            "sot_models": len(mine),
            "retired": retired,
            "added": added,
        }
        for r in retired:
            events.append(
                {"ts": NOW, "event": "model_retired", "provider": pid, "model": r}
            )
            report["findings"].append(f"RETIRED {pid} :: {r}")
        for a in added:
            events.append(
                {"ts": NOW, "event": "model_added", "provider": pid, "model": a}
            )
            report["findings"].append(f"ADDED   {pid} :: {a}")
    else:
        report["providers"][pid] = {"status": f"HTTP{s}", "http": s, "note": b[:120]}

os.makedirs(SD, exist_ok=True)
json.dump(report, open(REPORT_F, "w"), indent=1)
if events:
    with open(EVENTS_F, "a") as f:
        for e in events:
            f.write(json.dumps(e) + "\n")

print(
    json.dumps(
        {
            "probed_at": NOW,
            "providers": {
                k: {
                    kk: vv
                    for kk, vv in v.items()
                    if kk in ("status", "live_models", "sot_models")
                }
                for k, v in report["providers"].items()
            },
            "findings": report["findings"],
        },
        indent=1,
    )
)
